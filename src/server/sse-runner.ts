import { Router } from 'express';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';

export function createSSERouter(mcpServer: McpServer): Router {
  const router = Router();
  let transport: SSEServerTransport | null = null;

  router.get('/sse', async (req, res) => {
    transport = new SSEServerTransport("/mcp/message", res);
    await mcpServer.connect(transport);
  });

  router.post('/message', async (req, res) => {
    if (transport) {
      await transport.handlePostMessage(req, res);
    } else {
      res.status(400).send('SSE connection not initialized');
    }
  });

  return router;
}
