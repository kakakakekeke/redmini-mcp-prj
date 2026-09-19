import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import express from 'express';
import { createSSERouter } from '../../src/server/sse-runner';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import axios from 'axios';
import http from 'http';

describe('SSE Transport Layer', () => {
  let app: express.Express;
  let mcpServer: McpServer;
  let server: http.Server;
  let baseUrl: string;

  beforeEach(async () => {
    mcpServer = new McpServer({
      name: 'test-mcp-server',
      version: '1.0.0',
    });
    app = express();
    app.use('/mcp', createSSERouter(mcpServer));
    
    await new Promise<void>((resolve) => {
      server = app.listen(0, '127.0.0.1', () => {
        const address = server.address();
        if (typeof address === 'object' && address !== null) {
          baseUrl = `http://127.0.0.1:${address.port}`;
        }
        resolve();
      });
    });
  });

  afterEach(async () => {
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
    await mcpServer.close();
  });

  it('should establish SSE connection at /mcp/sse', async () => {
    const res = await axios.get(`${baseUrl}/mcp/sse`, {
      headers: {
        Accept: 'text/event-stream'
      },
      responseType: 'stream'
    });
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/event-stream');
    res.data.destroy(); // Close the stream
  });

  it('should accept POST messages at /mcp/message', async () => {
    try {
      await axios.post(`${baseUrl}/mcp/message?sessionId=invalid_session`, {
        jsonrpc: '2.0',
        method: 'ping',
        id: 1,
      });
    } catch (e: any) {
      if (e.response) {
        expect(e.response.status).not.toBe(404);
      } else {
        throw e;
      }
    }
  });
});
