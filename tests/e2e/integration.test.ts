import { describe, it, expect, beforeAll, afterAll } from "vitest";
import express from "express";
import { Server } from "http";
import { spawn, ChildProcess } from "child_process";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SRC_INDEX = path.resolve(__dirname, "../../src/index.ts");

describe("Redmine MCP Server E2E Integration Tests", () => {
  let mockRedmineApp: express.Express;
  let mockRedmineServer: Server;
  let redmineUrl: string;

  beforeAll(async () => {
    mockRedmineApp = express();
    mockRedmineApp.use(express.json());

    mockRedmineApp.get("/projects.json", (req, res) => {
      res.json({ projects: [{ id: 1, name: "Test Project", identifier: "test-project" }] });
    });

    mockRedmineApp.get("/trackers.json", (req, res) => {
      res.json({ trackers: [{ id: 1, name: "결함" }, { id: 2, name: "새 기능" }] });
    });

    mockRedmineApp.get("/issue_statuses.json", (req, res) => {
      res.json({ issue_statuses: [{ id: 1, name: "신규" }, { id: 2, name: "진행중" }] });
    });

    mockRedmineApp.get("/enumerations/issue_priorities.json", (req, res) => {
      res.json({ issue_priorities: [{ id: 1, name: "낮음" }] });
    });

    mockRedmineApp.get("/users.json", (req, res) => {
      res.json({ users: [{ id: 1, firstname: "Test", lastname: "User", login: "testuser" }] });
    });

    mockRedmineApp.get("/issues.json", (req, res) => {
      const apiKey = req.headers["x-redmine-api-key"];
      if (apiKey === "Token_A") {
        return res.json({ issues: [{ id: 101, subject: "User A Issue", assigned_to: { name: "User A" } }] });
      }
      if (apiKey === "Token_B") {
        return res.json({ issues: [{ id: 102, subject: "User B Issue", assigned_to: { name: "User B" } }] });
      }
      
      if (req.query.tracker_id === "1" && req.query.status_id === "2") {
        return res.json({
          issues: [
            { id: 1, subject: "Bug 1" },
            { id: 2, subject: "Bug 2" },
            { id: 3, subject: "Bug 3" }
          ]
        });
      }
      res.json({ issues: [] });
    });

    mockRedmineApp.post("/issues.json", (req, res) => {
      res.status(201).json({
        issue: {
          id: 201,
          subject: req.body.issue?.subject,
          uploads: req.body.issue?.uploads,
        },
      });
    });

    mockRedmineApp.post("/uploads.json", (req, res) => {
      res.status(201).json({
        upload: {
          token: "sample_upload_token_123",
        },
      });
    });

    mockRedmineApp.get("/issues/9999999.json", (req, res) => {
      res.status(404).json({ error: "Not found" });
    });

    await new Promise<void>((resolve) => {
      mockRedmineServer = mockRedmineApp.listen(0, () => {
        const address = mockRedmineServer.address() as any;
        redmineUrl = `http://localhost:${address.port}`;
        resolve();
      });
    });
  });

  afterAll(() => {
    if (mockRedmineServer) mockRedmineServer.close();
  });

  describe("[TC-01, TC-02, TC-04, TC-05, TC-08] Stdio Transport", () => {
    let client: Client;
    let transport: StdioClientTransport;

    beforeAll(async () => {
      transport = new StdioClientTransport({
        command: "npx",
        args: ["tsx", SRC_INDEX],
        env: {
          ...process.env,
          TRANSPORT: "stdio",
          REDMINE_URL: redmineUrl,
          REDMINE_API_KEY: "test_api_key"
        }
      });
      client = new Client({ name: "test-client", version: "1.0.0" }, { capabilities: {} });
      await client.connect(transport);
      // Wait a little bit for the server to load its cache
      await new Promise(r => setTimeout(r, 1000));
    });

    afterAll(async () => {
      await transport.close();
    });

    it("[TC-01] 환경 변수를 통한 단일 인증 접속", async () => {
      const result: any = await client.callTool({
        name: "get_projects",
        arguments: {}
      });
      expect(result.content[0].text).toContain("Test Project");
    });

    it("[TC-02] 자연어 필터를 통한 일감 검색 (Smart Name Resolver)", async () => {
      const result: any = await client.callTool({
        name: "search_issues",
        arguments: { status: "진행중", tracker: "결함", limit: 3 }
      });
      expect(result.content[0].text).toContain("Bug 1");
      expect(result.content[0].text).toContain("Bug 3");
    });

    it("[TC-04] 존재하지 않는 일감 ID 상세 조회 (예외 처리)", async () => {
      const result: any = await client.callTool({
        name: "get_issue_details",
        arguments: { issue_id: 9999999 }
      });
      
      expect(result.content[0].text).toContain("해당 일감을 찾을 수 없습니다");
    });

    it("[TC-05] 쓰기 도구 안전성 검증 (create_issue dry_run 미리보기 및 실제 생성)", async () => {
      // 1. 기본값 dry_run: true 호출 시 미리보기 검증
      const previewResult: any = await client.callTool({
        name: "create_issue",
        arguments: {
          project_id: "test-project",
          subject: "New Bug",
          tracker: "결함",
        },
      });
      const previewText = previewResult.content[0].text;
      expect(previewText).toContain("[DRY_RUN 미리보기]");
      expect(previewText).toContain("New Bug");
      expect(previewText).toContain('"dry_run": true');

      // 2. dry_run: false 명시 호출 시 실제 생성 검증
      const realResult: any = await client.callTool({
        name: "create_issue",
        arguments: {
          project_id: "test-project",
          subject: "Real Bug",
          tracker: "결함",
          dry_run: false,
        },
      });
      const realText = realResult.content[0].text;
      const realData = JSON.parse(realText);
      expect(realData.issue.id).toBe(201);
      expect(realData.issue.subject).toBe("Real Bug");
    });

    it("[TC-08] 2단계 첨부파일 업로드 및 일감 연동 파이프라인", async () => {
      // 1. upload_attachment 도구 호출 및 token 추출
      const uploadResult: any = await client.callTool({
        name: "upload_attachment",
        arguments: {
          filename: "sample.txt",
          content: "hello test",
        },
      });
      const uploadText = uploadResult.content[0].text;
      const uploadData = JSON.parse(uploadText);
      expect(uploadData.token).toBe("sample_upload_token_123");

      // 2. 획득한 token을 create_issue의 uploads에 전달하여 dry_run: false 생성
      const createResult: any = await client.callTool({
        name: "create_issue",
        arguments: {
          project_id: "test-project",
          subject: "Real Bug with Attachment",
          tracker: "결함",
          uploads: [
            {
              token: uploadData.token,
              filename: "sample.txt",
            },
          ],
          dry_run: false,
        },
      });
      const createText = createResult.content[0].text;
      const createData = JSON.parse(createText);
      expect(createData.issue.id).toBe(201);
      expect(createData.issue.uploads).toBeDefined();
      expect(createData.issue.uploads[0].token).toBe("sample_upload_token_123");
      expect(createData.issue.uploads[0].filename).toBe("sample.txt");
    });
  });

  describe("[TC-03, TC-06, TC-07] HTTP (Streamable HTTP) 기반 다중 사용자 접속 및 인프라 검증", () => {
    let client: Client;
    let transport: StreamableHTTPClientTransport;
    let child: ChildProcess;
    let httpPort: number = 33333; // Fixed port for testing

    beforeAll(async () => {
      child = spawn("npx", ["tsx", SRC_INDEX], {
        env: {
          ...process.env,
          TRANSPORT: "http",
          PORT: httpPort.toString(),
          REDMINE_URL: redmineUrl
        }
      });

      await new Promise(r => setTimeout(r, 2000));

      transport = new StreamableHTTPClientTransport(new URL(`http://localhost:${httpPort}/mcp`), {
        requestInit: {
          headers: {
            "x-redmine-api-key": "Token_A"
          }
        }
      });
      client = new Client({ name: "test-client", version: "1.0.0" }, { capabilities: {} });
      await client.connect(transport);
    });

    afterAll(async () => {
      await transport.close();
      if (child) child.kill();
    });

    it("[TC-03] 사용자 별 헤더 인증", async () => {
      const result: any = await client.callTool({
        name: "search_issues",
        arguments: {}
      });
      
      expect(result.content[0].text).toContain("User A Issue");
    });

    it("[TC-06] 인프라 엔드포인트 검증 (경량 /health 및 CORS 프리플라이트)", async () => {
      // 1. GET /health
      const healthRes = await fetch(`http://localhost:${httpPort}/health`);
      expect(healthRes.status).toBe(200);
      const healthBody = await healthRes.json();
      expect(healthBody).toEqual({ status: "ok" });

      // 2. OPTIONS /mcp
      const corsRes = await fetch(`http://localhost:${httpPort}/mcp`, {
        method: "OPTIONS",
        headers: {
          Origin: "http://localhost:5173",
          "Access-Control-Request-Method": "POST",
        },
      });
      expect([200, 204]).toContain(corsRes.status);
      expect(corsRes.headers.get("access-control-allow-origin")).toBe("*");
    });

    it("[TC-07] Streamable HTTP 다중 사용자 동시 접속 교차 격리 (User A vs User B)", async () => {
      const transportA = new StreamableHTTPClientTransport(new URL(`http://localhost:${httpPort}/mcp`), {
        requestInit: {
          headers: {
            "x-redmine-api-key": "Token_A",
          },
        },
      });
      const clientA = new Client({ name: "client-a", version: "1.0.0" }, { capabilities: {} });
      await clientA.connect(transportA);

      const transportB = new StreamableHTTPClientTransport(new URL(`http://localhost:${httpPort}/mcp`), {
        requestInit: {
          headers: {
            "x-redmine-api-key": "Token_B",
          },
        },
      });
      const clientB = new Client({ name: "client-b", version: "1.0.0" }, { capabilities: {} });
      await clientB.connect(transportB);

      try {
        const [resA, resB]: [any, any] = await Promise.all([
          clientA.callTool({ name: "search_issues", arguments: {} }),
          clientB.callTool({ name: "search_issues", arguments: {} }),
        ]);

        expect(resA.content[0].text).toContain("User A Issue");
        expect(resA.content[0].text).not.toContain("User B Issue");

        expect(resB.content[0].text).toContain("User B Issue");
        expect(resB.content[0].text).not.toContain("User A Issue");
      } finally {
        await transportA.close();
        await transportB.close();
      }
    });
  });
});
