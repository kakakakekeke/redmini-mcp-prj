import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import express from "express";
import { createSSERouter } from "./server/sse-runner.js";

// Initialize a very basic MCP Server
const server = new McpServer({
  name: "redmine-mcp-server",
  version: "1.0.0",
});

// A simple Ping tool for health check
server.tool(
  "ping",
  {}, // No parameters required
  async () => {
    return {
      content: [
        {
          type: "text",
          text: "pong! MCP Server is running successfully.",
        },
      ],
    };
  }
);

async function main() {
  const transportMode = process.env.TRANSPORT === 'sse' ? 'sse' : 'stdio';

  if (transportMode === 'sse') {
    const app = express();
    app.use('/mcp', createSSERouter(server));
    const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
    
    app.listen(port, () => {
      console.error(`Redmine MCP Server is running on SSE mode at http://localhost:${port}`);
    });
  } else {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("Redmine MCP Server is running on stdio!");
  }
}

main().catch((err) => {
  console.error("Failed to start server", err);
  process.exit(1);
});
