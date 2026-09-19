import { Router, Response } from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";

export interface SSERouterOptions {
  heartbeatIntervalMs?: number;
  sessionTtlMs?: number;
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
    try {
      const transport = new SSEServerTransport("/mcp/message", res);
      const mcpServer = createServer(req.headers);
      
      // Bind close before connect to ensure it fires if connect fails partway but socket closes
      res.on("close", () => {
        const session = transports.get(transport.sessionId);
        if (session) {
          transports.delete(transport.sessionId);
          session.server.close().catch(() => {});
        }
      });

      await mcpServer.connect(transport);
      
      transports.set(transport.sessionId, { 
        transport, 
        server: mcpServer,
        lastActive: Date.now(),
        res
      });

      startHeartbeat();
    } catch (err) {
      next(err);
    }
  });

  router.post("/message", async (req, res, next) => {
    try {
      const sessionId = req.query.sessionId as string;
      const session = transports.get(sessionId);
      
      if (session) {
        session.lastActive = Date.now();
        await session.transport.handlePostMessage(req, res);
      } else {
        res.status(404).send("SSE connection not found or expired");
      }
    } catch (err) {
      next(err);
    }
  });

  return router;
}
