import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import express from "express";
import cors from "cors";
import { rateLimit, type Options } from "express-rate-limit";
import { createStreamableHttpRouter } from "./server/streamable-http-runner.js";
import { getAuthClient, verifyHttpBearerToken } from "./middleware/auth.js";
import { processToolResult } from "./utils/prompt_injection_detector.js";
import { getProjectsHandler, getProjectsSchema } from "./tools/get_projects.js";
import { getIssueDetailsHandler, getIssueDetailsSchema } from "./tools/get_issue_details.js";
import { searchIssuesHandler, searchIssuesSchema } from "./tools/search_issues.js";
import { updateIssueHandler, updateIssueSchema } from "./tools/update_issue.js";
import { createIssueHandler, createIssueSchema } from "./tools/create_issue.js";
import { addIssueNoteHandler, addIssueNoteSchema } from "./tools/add_issue_note.js";
import { logTimeHandler, logTimeSchema } from "./tools/logTime.js";
import { getTimeEntriesHandler, getTimeEntriesSchema } from "./tools/get_time_entries.js";
import { searchWikiHandler, searchWikiSchema } from "./tools/search_wiki.js";
import { createOrUpdateWikiHandler, createOrUpdateWikiSchema } from "./tools/create_or_update_wiki.js";
import { getMyAccountHandler, getMyAccountSchema } from "./tools/get_my_account.js";
import { searchAllHandler, searchAllSchema } from "./tools/search_all.js";
import { manageIssueRelationHandler, manageIssueRelationSchema } from "./tools/manage_issue_relation.js";
import { manageWatchersHandler, manageWatchersSchema } from "./tools/manage_watchers.js";
import { manageVersionsHandler, manageVersionsSchema } from "./tools/manage_versions.js";
import { uploadAttachmentHandler, uploadAttachmentSchema } from "./tools/upload_attachment.js";
import { getAttachmentContentHandler, getAttachmentContentSchema } from "./tools/get_attachment_content.js";
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
    "Redmine 프로젝트 목록 또는 단일 프로젝트 상세 정보를 조회합니다. project_id를 지정하면 일감 커스텀 필드(issue_custom_fields) 및 트래커(trackers) 등 상세 정보를 조회하며, 생략 시 전체 프로젝트 목록을 조회합니다. 보관된 프로젝트 포함 여부를 지정할 수 있습니다.",
    getProjectsSchema.shape,
    async (args) => {
      const result = await getProjectsHandler(args as any, client);
      return { content: [{ type: "text", text: JSON.stringify(processToolResult(result), null, 2) }] };
    }
  );
  
  server.tool(
    "get_issue_details",
    "지정한 일감 ID의 상세 정보(상태, 담당자, 설명, 변경 이력 및 첨부파일)를 조회합니다.",
    getIssueDetailsSchema.shape,
    async (args) => {
      const result = await getIssueDetailsHandler(args as any, client);
      return { content: [{ type: "text", text: JSON.stringify(processToolResult(result), null, 2) }] };
    }
  );
  
  server.tool(
    "search_issues",
    "키워드, 프로젝트, 상태(이름 또는 ID), 트래커(이름 또는 ID), 담당자 등 다양한 조건으로 일감을 검색합니다.",
    searchIssuesSchema.shape,
    async (args) => {
      const result = await searchIssuesHandler(args as any, client);
      return { content: [{ type: "text", text: JSON.stringify(processToolResult(result), null, 2) }] };
    }
  );

  server.tool(
    "add_issue_note",
    "지정한 일감에 댓글(저널)을 추가합니다. (dry_run 지원, 기본값: true) [주의: 쓰기 도구] 실제 댓글을 등록하려면 명시적으로 dry_run: false를 전달해야 합니다.",
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
    "get_time_entries",
    "Redmine 작업 시간 기록(Time Entries) 목록을 조회하거나 특정 시간 기록의 상세 정보를 단건 조회합니다. (GET /time_entries.json, GET /time_entries/{id}.json)",
    getTimeEntriesSchema.shape,
    async (args) => {
      const result = await getTimeEntriesHandler(args as any, client);
      return { content: [{ type: "text", text: JSON.stringify(processToolResult(result), null, 2) }] };
    }
  );

  server.tool(
    "search_wiki",
    "특정 프로젝트의 위키 문서 목록과 제목 기반 상세 내용을 조회합니다. 읽기 전용으로 안전합니다.",
    searchWikiSchema.shape,
    async (args) => {
      const result = await searchWikiHandler(args as any, client);
      return { content: [{ type: "text", text: JSON.stringify(processToolResult(result), null, 2) }] };
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
    "get_my_account",
    "현재 인증된 사용자의 계정 및 프로필 정보(이름, 이메일, API 키, 프로젝트 멤버십, 그룹 등)를 조회합니다.",
    getMyAccountSchema.shape,
    async (args) => {
      const result = await getMyAccountHandler(args as any, client);
      return { content: [{ type: "text", text: JSON.stringify(processToolResult(result), null, 2) }] };
    }
  );

  server.tool(
    "search_all",
    "Redmine 전체 도메인(일감, 위키, 뉴스, 문서, 변경이력, 메시지, 프로젝트)을 대상으로 키워드 통합 검색을 수행합니다.",
    searchAllSchema.shape,
    async (args) => {
      const result = await searchAllHandler(args as any, client);
      return { content: [{ type: "text", text: JSON.stringify(processToolResult(result), null, 2) }] };
    }
  );

  server.tool(
    "manage_issue_relation",
    "일감 간의 관계(블록, 선행, 후행, 관련, 중복 등)를 목록 조회, 생성 또는 삭제합니다. 생성 및 삭제 시 기본값이 true인 dry_run 파라미터를 통해 안전한 미리보기를 제공하며, 실제 변경을 원할 경우에만 명시적으로 dry_run: false로 전달하세요.",
    manageIssueRelationSchema.shape,
    async (args) => {
      const result = await manageIssueRelationHandler(args as any, client);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.tool(
    "manage_versions",
    "프로젝트의 버전/마일스톤을 조회, 생성, 수정 또는 삭제합니다. 생성, 수정, 삭제 시 기본값이 true인 dry_run 파라미터를 통해 안전한 미리보기를 제공하며, 실제 변경을 원할 경우에만 명시적으로 dry_run: false로 전달하세요.",
    manageVersionsSchema.shape,
    async (args) => {
      const result = await manageVersionsHandler(args as any, client);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.tool(
    "manage_watchers",
    "일감의 관찰자(Watcher)를 목록 조회, 추가 또는 제거합니다. 추가 및 제거 시 기본값이 true인 dry_run 파라미터를 통해 안전한 미리보기를 제공하며, 실제 변경을 원할 경우에만 명시적으로 dry_run: false로 전달하세요.",
    manageWatchersSchema.shape,
    async (args) => {
      const result = await manageWatchersHandler(args as any, client);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.tool(
    "upload_attachment",
    "Redmine에 파일(텍스트 또는 Base64 인코딩 바이너리/이미지)을 업로드하고 첨부 토큰(token)을 발급받습니다. 발급된 토큰은 일감 생성(create_issue) 또는 수정(update_issue) 시 uploads 필드에 전달하여 첨부 파일로 연동할 수 있습니다.",
    uploadAttachmentSchema.shape,
    async (args) => {
      const result = await uploadAttachmentHandler(args as any, client);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.tool(
    "get_attachment_content",
    "Redmine 첨부파일의 본문 내용을 다운로드하여 조회합니다. 텍스트 파일(로그, 소스코드, 마크다운 등)은 UTF-8 문자열로, 바이너리 파일(이미지 등)은 Base64로 자동 변환되며, 컨텍스트 초과 방지를 위해 max_bytes Truncation을 지원합니다.",
    getAttachmentContentSchema.shape,
    async (args) => {
      const result = await getAttachmentContentHandler(args as any, client);
      return { content: [{ type: "text", text: JSON.stringify(processToolResult(result), null, 2) }] };
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

export function getMcpRateLimiter(options?: Partial<Options>) {
  return rateLimit({
    windowMs: 60 * 1000,
    max: 120,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Too many requests from this IP, please try again later." },
    ...options,
  });
}

export function getHealthRateLimiter(options?: Partial<Options>) {
  return rateLimit({
    windowMs: 60 * 1000,
    max: 300,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Too many requests from this IP, please try again later." },
    ...options,
  });
}

export function getCorsMiddleware() {
  const allowedOriginsEnv = process.env.CORS_ALLOWED_ORIGINS;
  const allowedOrigins = allowedOriginsEnv
    ? allowedOriginsEnv.split(",").map((o) => o.trim())
    : ["http://localhost:3000", "http://localhost:5173", "http://127.0.0.1:3000", "http://127.0.0.1:5173"];

  return cors({
    origin: (origin, callback) => {
      // 브라우저가 아닌 도구(curl, postman, server-to-server 등)는 origin이 없을 수 있음
      if (!origin) return callback(null, true);
      if (
        allowedOrigins.includes("*") ||
        allowedOrigins.includes(origin) ||
        /^http:\/\/localhost(:\d+)?$/.test(origin) ||
        /^http:\/\/127\.0\.0\.1(:\d+)?$/.test(origin)
      ) {
        return callback(null, true);
      }
      return callback(new Error(`CORS policy: Origin ${origin} not allowed`));
    },
    methods: ["GET", "POST", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Redmine-API-Key", "Mcp-Session-Id", "Last-Event-Id"],
    exposedHeaders: ["Mcp-Session-Id"],
  });
}

async function main() {
  const isStdio = process.env.TRANSPORT === "stdio";

  if (!isStdio) {
    const app = express();
    app.use(getCorsMiddleware());
    app.get("/health", getHealthRateLimiter(), (req, res) => res.status(200).json({ status: "ok" }));
    app.all("/mcp", getMcpRateLimiter(), verifyHttpBearerToken, createStreamableHttpRouter(createRedmineMcpServer));
    app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
      if (err?.message?.includes("Missing Redmine API Key") || err?.message?.includes("Authentication failed")) {
        return res.status(401).json({ error: err.message });
      }
      logger.error("Unhandled server error", err);
      res.status(500).json({ error: "Internal server error" });
    });
    const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

    app.listen(port, () => {
      logger.info(`Redmine MCP Server is running on Streamable HTTP mode at http://localhost:${port}`);
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
