import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import express from "express";
import { createSSERouter } from "./server/sse-runner.js";
import { getAuthClient } from "./middleware/auth.js";
import { getProjectsHandler, getProjectsSchema } from "./tools/get_projects.js";
import { getIssueDetailsHandler, getIssueDetailsSchema } from "./tools/get_issue_details.js";
import { searchIssuesHandler, searchIssuesSchema } from "./tools/search_issues.js";
import { updateIssueHandler, updateIssueSchema } from "./tools/update_issue.js";

// Factory function to create a new MCP Server instance per connection
export function createRedmineMcpServer(headers: Record<string, string | string[] | undefined> = {}) {
  const server = new McpServer({
    name: "redmine-mcp-server",
    version: "1.0.0",
  });

  const client = getAuthClient(headers);

  server.tool(
    "get_projects",
    "Redmine 프로젝트 목록을 조회합니다. 보관된 프로젝트 포함 여부를 지정할 수 있습니다.",
    getProjectsSchema.shape,
    async (args) => {
      const result = await getProjectsHandler(args as any, client);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );
  
  server.tool(
    "get_issue_details",
    "지정한 일감 ID의 상세 정보(상태, 담당자, 설명, 변경 이력 및 첨부파일)를 조회합니다.",
    getIssueDetailsSchema.shape,
    async (args) => {
      const result = await getIssueDetailsHandler(args as any, client);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );
  
  server.tool(
    "search_issues",
    "키워드, 프로젝트, 상태(이름 또는 ID), 트래커(이름 또는 ID), 담당자 등 다양한 조건으로 일감을 검색합니다.",
    searchIssuesSchema.shape,
    async (args) => {
      const result = await searchIssuesHandler(args as any, client);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.tool(
    "update_issue",
    "일감의 상태나 내용을 업데이트합니다. (dry_run 지원)",
    updateIssueSchema.shape,
    async (args) => {
      const result = await updateIssueHandler(args as any, client);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.tool(
    "ping",
    "Redmine MCP 서버의 연결 상태 및 헬스체크를 수행합니다.",
    {},
    async () => {
      return {
        content: [{ type: "text", text: "pong! MCP Server is running successfully." }],
      };
    }
  );

  return server;
}

async function main() {
  const transportMode = process.env.TRANSPORT === "sse" ? "sse" : "stdio";

  if (transportMode === "sse") {
    const app = express();
    app.use("/mcp", createSSERouter(createRedmineMcpServer));
    const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
    
    app.listen(port, () => {
      console.error(`Redmine MCP Server is running on SSE mode at http://localhost:${port}`);
    });
  } else {
    // For stdio, we don't have request headers, so it will fall back to process.env.REDMINE_API_KEY
    const server = createRedmineMcpServer({});
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("Redmine MCP Server is running on stdio!");
  }
}

import { fileURLToPath } from "url";
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error("Failed to start server", err);
    process.exit(1);
  });
}
