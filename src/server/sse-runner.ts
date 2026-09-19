import { Router } from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";

export function createSSERouter(createServer: () => McpServer): Router {
  const router = Router();
  const transports = new Map<string, { transport: SSEServerTransport, server: McpServer }>();

  router.get("/sse", async (req, res) => {
    const transport = new SSEServerTransport("/mcp/message", res);
    const mcpServer = createServer();
    await mcpServer.connect(transport);
    
    transports.set(transport.sessionId, { transport, server: mcpServer });
    
    res.on("close", async () => {
      transports.delete(transport.sessionId);
      await mcpServer.close();
    });
  });

  router.post("/message", async (req, res) => {
    const sessionId = req.query.sessionId as string;
    const session = transports.get(sessionId);
    
    if (session) {
      await session.transport.handlePostMessage(req, res);
    } else {
      res.status(404).send("SSE connection not found or expired");
    }
  });

  return router;
}