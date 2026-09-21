import { Router, Request, Response, NextFunction } from "express";
import express from "express";
import { randomUUID, createHash } from "node:crypto";
import { isIP } from "node:net";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import { logger } from "../utils/logger.js";

export interface StreamableHttpRouterOptions {
  sessionTtlMs?: number;
  checkIntervalMs?: number;
}

export function getClientIp(req: Request): string {
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

export function getSessionIdHash(sessionId: string): string {
  return createHash("sha256").update(sessionId).digest("hex").slice(0, 16);
}

export function isInitRequest(body: unknown): boolean {
  if (Array.isArray(body)) {
    return body.some(isInitializeRequest);
  }
  return isInitializeRequest(body);
}

interface SessionEntry {
  transport: StreamableHTTPServerTransport;
  server: McpServer;
  lastActive: number;
}

export function createStreamableHttpRouter(
  createServer: (headers: Record<string, string | string[] | undefined>) => McpServer,
  options: StreamableHttpRouterOptions = {}
): Router {
  const router = Router();
  router.use(express.json());

  const sessionTtlMs = options.sessionTtlMs ?? 300000; // 5 minutes default
  const checkIntervalMs = options.checkIntervalMs ?? Math.min(sessionTtlMs, 30000);

  const transports = new Map<string, SessionEntry>();
  let cleanupTimer: NodeJS.Timeout | null = null;

  const startCleanupTimer = () => {
    if (!cleanupTimer) {
      cleanupTimer = setInterval(() => {
        const now = Date.now();
        for (const [sessionId, session] of transports.entries()) {
          if (now - session.lastActive > sessionTtlMs) {
            logger.debug(`Closing expired Streamable HTTP session: ${sessionId}`);
            transports.delete(sessionId);
            session.transport.close().catch(() => {});
            session.server.close().catch(() => {});
          }
        }

        if (transports.size === 0 && cleanupTimer) {
          clearInterval(cleanupTimer);
          cleanupTimer = null;
        }
      }, checkIntervalMs);

      if (cleanupTimer.unref) {
        cleanupTimer.unref();
      }
    }
  };

  const handleMcpRequest = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    let transport: StreamableHTTPServerTransport | undefined;
    let mcpServer: McpServer | undefined;

    try {
      const clientIp = getClientIp(req);
      const rawSessionId = req.headers["mcp-session-id"];
      const sessionId = typeof rawSessionId === "string" ? rawSessionId : undefined;

      // 1. Initialization POST request
      if (req.method === "POST" && isInitRequest(req.body)) {
        transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => randomUUID(),
        });
        mcpServer = createServer(req.headers);

        await mcpServer.connect(transport);
        await transport.handleRequest(req, res, req.body);

        const assignedSessionId = transport.sessionId;
        if (assignedSessionId) {
          logger.info("Streamable HTTP connection established", {
            ip: clientIp,
            sessionIdHash: getSessionIdHash(assignedSessionId),
          });

          transports.set(assignedSessionId, {
            transport,
            server: mcpServer,
            lastActive: Date.now(),
          });

          startCleanupTimer();
        }
        return;
      }

      // 2. Non-initialization request without session ID -> 400 Bad Request
      if (!sessionId) {
        logger.warn("Streamable HTTP request missing session ID", {
          ip: clientIp,
        });
        res.status(400).json({
          jsonrpc: "2.0",
          error: {
            code: -32000,
            message: "Bad Request: Mcp-Session-Id header is required",
          },
          id: null,
        });
        return;
      }

      // 3. Request with session ID
      const session = transports.get(sessionId);
      if (!session) {
        logger.warn("Streamable HTTP session not found or expired", {
          ip: clientIp,
          sessionIdHash: getSessionIdHash(sessionId),
        });
        res.status(404).json({
          jsonrpc: "2.0",
          error: {
            code: -32001,
            message: "Session not found",
          },
          id: null,
        });
        return;
      }

      // Update activity timestamp
      session.lastActive = Date.now();
      logger.info("Tool call received", {
        ip: clientIp,
        sessionIdHash: getSessionIdHash(sessionId),
      });

      // 4. DELETE request -> terminate session
      if (req.method === "DELETE") {
        transports.delete(sessionId);
        try {
          await session.transport.handleRequest(req, res, req.body);
        } finally {
          await session.server.close().catch(() => {});
          await session.transport.close().catch(() => {});
        }
        return;
      }

      // 5. POST / GET or other supported requests
      await session.transport.handleRequest(req, res, req.body);
    } catch (err) {
      transport?.close().catch(() => {});
      mcpServer?.close().catch(() => {});
      logger.error("Error processing Streamable HTTP request", err);
      next(err);
    }
  };

  // Bind routes to support both app.all('/mcp', router) and app.use('/mcp', router)
  for (const path of ["/", "/mcp"]) {
    router.post(path, handleMcpRequest);
    router.get(path, handleMcpRequest);
    router.delete(path, handleMcpRequest);
  }

  return router;
}
