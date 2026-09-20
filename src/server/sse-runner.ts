import { Router, Request, Response } from "express";
import { createHash } from "node:crypto";
import { isIP } from "node:net";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { logger } from "../utils/logger.js";

export interface SSERouterOptions {
  heartbeatIntervalMs?: number;
  sessionTtlMs?: number;
}

function getClientIp(req: Request): string {
  const forwardedFor = req.headers["x-forwarded-for"];
  const values = Array.isArray(forwardedFor) ? forwardedFor : [forwardedFor];

  for (const value of values) {
    const firstIp = value?.split(",").map((ip) => ip.trim()).find(Boolean);
    if (firstIp && isIP(firstIp)) {
      return firstIp;
    }
  }

  const requestIp = req.ip?.trim();
  return requestIp && isIP(requestIp) ? requestIp : "unknown";
}

function getSessionIdHash(sessionId: string): string {
  return createHash("sha256").update(sessionId).digest("hex").slice(0, 16);
}

export function createSSERouter(
  createServer: (headers: Record<string, string | string[] | undefined>) => McpServer,
  options: SSERouterOptions = {}
): Router {
  const router = Router();
  const heartbeatIntervalMs = options.heartbeatIntervalMs ?? 30000;
  const sessionTtlMs = options.sessionTtlMs ?? 300000; // 5 minutes by default

  const transports = new Map<string, { 
    transport: SSEServerTransport; 
    server: McpServer;
    lastActive: number;
    res: Response;
  }>();

  let heartbeatTimer: NodeJS.Timeout | null = null;

  const startHeartbeat = () => {
    if (!heartbeatTimer) {
      heartbeatTimer = setInterval(() => {
        const now = Date.now();
        for (const [sessionId, session] of transports.entries()) {
          if (now - session.lastActive > sessionTtlMs) {
            logger.debug(`Closing expired SSE session: ${sessionId}`);
            transports.delete(sessionId);
            
            session.transport.close().catch(() => {});
            try {
              session.res.end();
            } catch (e) {}
            
            session.server.close().catch(() => {});
          } else {
            try {
              session.res.write(":\n\n");
            } catch (e) {
              // Write can fail if connection dropped
            }
          }
        }
        
        // Stop interval if no active transports
        if (transports.size === 0 && heartbeatTimer) {
          clearInterval(heartbeatTimer);
          heartbeatTimer = null;
        }
      }, heartbeatIntervalMs);
      
      if (heartbeatTimer.unref) {
        heartbeatTimer.unref();
      }
    }
  };

  router.get("/sse", async (req, res, next) => {
    let transport: SSEServerTransport | undefined;
    let mcpServer: McpServer | undefined;

    try {
      transport = new SSEServerTransport("/mcp/message", res);
      mcpServer = createServer(req.headers);
      
      // Bind close before connect to ensure it fires if connect fails partway but socket closes
      res.on("close", () => {
        const session = transports.get(transport!.sessionId);
        if (session) {
          transports.delete(transport!.sessionId);
          session.transport.close().catch(() => {});
          session.server.close().catch(() => {});
        } else {
          transport!.close().catch(() => {});
          mcpServer!.close().catch(() => {});
        }
      });

      await mcpServer.connect(transport);

      const clientIp = getClientIp(req);
      logger.info(`SSE connection established`, {
        ip: clientIp,
        sessionIdHash: getSessionIdHash(transport.sessionId),
      });
      
      transports.set(transport.sessionId, { 
        transport, 
        server: mcpServer,
        lastActive: Date.now(),
        res
      });

      startHeartbeat();
    } catch (err) {
      transport?.close().catch(() => {});
      mcpServer?.close().catch(() => {});
      logger.error("Error establishing SSE connection", err);
      next(err);
    }
  });

  router.post("/message", async (req, res, next) => {
    try {
      const sessionId = typeof req.query.sessionId === "string" ? req.query.sessionId : undefined;
      const session = sessionId ? transports.get(sessionId) : undefined;
      
      if (session && sessionId) {
        const clientIp = getClientIp(req);
        logger.info(`Tool call received`, {
          ip: clientIp,
          sessionIdHash: getSessionIdHash(sessionId),
        });
        session.lastActive = Date.now();
        await session.transport.handlePostMessage(req, res);
      } else {
        logger.warn("SSE connection not found or expired", {
          sessionIdHash: sessionId ? getSessionIdHash(sessionId) : "missing",
        });
        res.status(404).send("SSE connection not found or expired");
      }
    } catch (err) {
      logger.error("Error processing SSE message", err);
      next(err);
    }
  });

  return router;
}
