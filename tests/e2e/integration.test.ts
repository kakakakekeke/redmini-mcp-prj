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

  describe("[TC-01, TC-02, TC-04] Stdio Transport", () => {
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
  });

  describe("[TC-03] HTTP (Streamable HTTP) 기반 다중 사용자 접속", () => {
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
  });
});
