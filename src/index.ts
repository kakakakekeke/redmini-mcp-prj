import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import express from "express";
import { createSSERouter } from "./server/sse-runner.js";
import { getAuthClient } from "./middleware/auth.js";
import { getProjectsHandler, getProjectsSchema } from "./tools/get_projects.js";
import { getIssueDetailsHandler, getIssueDetailsSchema } from "./tools/get_issue_details.js";
import { searchIssuesHandler, searchIssuesSchema } from "./tools/search_issues.js";
import { updateIssueHandler, updateIssueSchema } from "./tools/update_issue.js";
import { createIssueHandler, createIssueSchema } from "./tools/create_issue.js";
import { addIssueNoteHandler, addIssueNoteSchema } from "./tools/add_issue_note.js";
import { logTimeHandler, logTimeSchema } from "./tools/logTime.js";
import { searchWikiHandler, searchWikiSchema } from "./tools/search_wiki.js";
import { createOrUpdateWikiHandler, createOrUpdateWikiSchema } from "./tools/create_or_update_wiki.js";
import { logger } from "./utils/logger.js";


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
    "add_issue_note",
    "지정한 일감에 댓글(저널)을 추가합니다. [주의: 쓰기 도구] 실제 Redmine 데이터가 변경되므로, 호출 전 반드시 작성할 댓글 내용(notes)을 사용자에게 미리 안내하고 확인(승인)을 받은 후 실행해야 합니다.",
    addIssueNoteSchema.shape,
    async (args) => {
      const result = await addIssueNoteHandler(args as any, client);
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
    "create_issue",
    "새 일감을 생성합니다. 기본값이 true인 dry_run 파라미터를 통해 안전한 미리보기를 제공합니다. 실제 생성을 원할 경우에만 명시적으로 false로 전달하세요.",
    createIssueSchema.shape,
    async (args) => {
      const result = await createIssueHandler(args as any, client);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );


  server.tool(
    "log_time",
    "일감 또는 프로젝트에 작업 시간을 기록합니다 (POST /time_entries.json).",
    logTimeSchema.shape,
    async (args) => {
      const result = await logTimeHandler(args as any, client);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.tool(
    "search_wiki",
    "특정 프로젝트의 위키 문서 목록과 제목 기반 상세 내용을 조회합니다. 읽기 전용으로 안전합니다.",
    searchWikiSchema.shape,
    async (args) => {
      const result = await searchWikiHandler(args as any, client);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );


  server.tool(
    "create_or_update_wiki",
    "프로젝트의 위키 페이지를 신규 등록하거나 기존 위키 문서를 수정합니다. 기본값이 true인 dry_run 파라미터를 통해 안전한 미리보기를 제공하며, 실제 등록/수정을 원할 경우에만 명시적으로 dry_run: false로 전달하세요.",
    createOrUpdateWikiSchema.shape,
    async (args) => {
      const result = await createOrUpdateWikiHandler(args as any, client);
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
      logger.info(`Redmine MCP Server is running on SSE mode at http://localhost:${port}`);
    });
  } else {
    // For stdio, we don't have request headers, so it will fall back to process.env.REDMINE_API_KEY
    const server = createRedmineMcpServer({});
    const transport = new StdioServerTransport();
    await server.connect(transport);
    logger.info("Redmine MCP Server is running on stdio!");
  }
}

import { fileURLToPath } from "url";
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    logger.error("Failed to start server", err);
    process.exit(1);
  });
}
