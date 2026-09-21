import { getCorsMiddleware } from "../../src/index.js";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import express from "express";
import { createStreamableHttpRouter } from "../../src/server/streamable-http-runner.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Server } from "node:http";

describe("Streamable HTTP Transport Layer", () => {
  let app: express.Express;
  let server: Server;
  let baseUrl: string;

  beforeEach(async () => {
    app = express();
    app.all(
      "/mcp",
      createStreamableHttpRouter(
        (headers) => {
          const mcp = new McpServer({
            name: "test-mcp-server",
            version: "1.0.0",
          });
          mcp.tool("ping_tool", {}, async () => ({
            content: [{ type: "text", text: "pong" }],
          }));
          return mcp;
        },
        {
          sessionTtlMs: 200,
          checkIntervalMs: 50,
        }
      )
    );

    await new Promise<void>((resolve) => {
      server = app.listen(0, "127.0.0.1", () => {
        const address = server.address();
        if (typeof address === "object" && address !== null) {
          baseUrl = `http://127.0.0.1:${address.port}/mcp`;
        }
        resolve();
      });
    });
  });

  afterEach(async () => {
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
  });

  it("should initialize session and return mcp-session-id header on initialize POST request", async () => {
    const res = await fetch(baseUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "initialize",
        id: 1,
        params: {
          protocolVersion: "2024-11-05",
          capabilities: {},
          clientInfo: { name: "test-client", version: "1.0.0" },
        },
      }),
    });

    expect(res.status).toBe(200);
    const sessionId = res.headers.get("mcp-session-id");
    expect(sessionId).toBeDefined();
    expect(sessionId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);

    const bodyText = await res.text();
    expect(bodyText).toContain("test-mcp-server");
  });

  it("should process follow-up POST requests containing mcp-session-id", async () => {
    // 1. Initialize session
    const initRes = await fetch(baseUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "initialize",
        id: 1,
        params: {
          protocolVersion: "2024-11-05",
          capabilities: {},
          clientInfo: { name: "test-client", version: "1.0.0" },
        },
      }),
    });
    expect(initRes.status).toBe(200);
    const sessionId = initRes.headers.get("mcp-session-id")!;

    // 2. Send ping with session ID
    const pingRes = await fetch(baseUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
        "mcp-session-id": sessionId,
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "ping",
        id: 2,
      }),
    });
    expect(pingRes.status).toBe(200);
    const pingText = await pingRes.text();
    expect(pingText).toContain('"id":2');
  });

  it("should return 400 Bad Request when non-init request lacks mcp-session-id", async () => {
    const res = await fetch(baseUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "ping",
        id: 1,
      }),
    });

    expect(res.status).toBe(400);
    const body = (await res.json()) as { error?: { message?: string } };
    expect(body.error?.message).toContain("Mcp-Session-Id header is required");
  });

  it("should return 404 Not Found for invalid or unknown session ID", async () => {
    const res = await fetch(baseUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
        "mcp-session-id": "unknown-or-invalid-session-id",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "ping",
        id: 1,
      }),
    });

    expect(res.status).toBe(404);
    const body = (await res.json()) as { error?: { message?: string } };
    expect(body.error?.message).toContain("Session not found");
  });

  it("should terminate session and reject subsequent requests after DELETE", async () => {
    // 1. Initialize
    const initRes = await fetch(baseUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "initialize",
        id: 1,
        params: {
          protocolVersion: "2024-11-05",
          capabilities: {},
          clientInfo: { name: "test-client", version: "1.0.0" },
        },
      }),
    });
    const sessionId = initRes.headers.get("mcp-session-id")!;

    // 2. DELETE session
    const delRes = await fetch(baseUrl, {
      method: "DELETE",
      headers: {
        "mcp-session-id": sessionId,
      },
    });
    expect(delRes.status).toBe(200);

    // 3. Subsequent request should be 404
    const postAfterDel = await fetch(baseUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
        "mcp-session-id": sessionId,
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "ping",
        id: 2,
      }),
    });
    expect(postAfterDel.status).toBe(404);
  });

  it("should clean up session when inactivity TTL expires", async () => {
    // 1. Initialize
    const initRes = await fetch(baseUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "initialize",
        id: 1,
        params: {
          protocolVersion: "2024-11-05",
          capabilities: {},
          clientInfo: { name: "test-client", version: "1.0.0" },
        },
      }),
    });
    const sessionId = initRes.headers.get("mcp-session-id")!;

    // 2. Wait for TTL (200ms) to expire
    await new Promise((resolve) => setTimeout(resolve, 300));

    // 3. Subsequent request should return 404
    const res = await fetch(baseUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
        "mcp-session-id": sessionId,
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "ping",
        id: 2,
      }),
    });
    expect(res.status).toBe(404);
  });
});

describe("CORS Policy and Whitelist", () => {
  let corsApp: express.Express;
  let corsServer: Server;
  let corsBaseUrl: string;
  const originalEnv = process.env.CORS_ALLOWED_ORIGINS;

  afterEach(async () => {
    if (originalEnv !== undefined) {
      process.env.CORS_ALLOWED_ORIGINS = originalEnv;
    } else {
      delete process.env.CORS_ALLOWED_ORIGINS;
    }
    if (corsServer) {
      await new Promise<void>((resolve) => corsServer.close(() => resolve()));
    }
  });

  const setupCorsServer = async () => {
    corsApp = express();
    corsApp.use(getCorsMiddleware());
    corsApp.get("/test", (req, res) => res.json({ ok: true }));
    corsApp.use((err: any, req: any, res: any, next: any) => {
      if (err.message && err.message.includes("CORS policy")) {
        res.status(403).json({ error: err.message });
      } else {
        next(err);
      }
    });

    await new Promise<void>((resolve) => {
      corsServer = corsApp.listen(0, "127.0.0.1", () => {
        const addr = corsServer.address() as any;
        corsBaseUrl = "http://127.0.0.1:" + addr.port + "/test";
        resolve();
      });
    });
  };

  it("should allow request without origin (non-browser client)", async () => {
    delete process.env.CORS_ALLOWED_ORIGINS;
    await setupCorsServer();
    const res = await fetch(corsBaseUrl);
    expect(res.status).toBe(200);
  });

  it("should allow request from default whitelisted origin (localhost / 127.0.0.1)", async () => {
    delete process.env.CORS_ALLOWED_ORIGINS;
    await setupCorsServer();
    const res = await fetch(corsBaseUrl, {
      headers: { Origin: "http://localhost:5173" },
    });
    expect(res.status).toBe(200);
    expect(res.headers.get("access-control-allow-origin")).toBe("http://localhost:5173");
  });

  it("should reject request from unauthorized origin", async () => {
    delete process.env.CORS_ALLOWED_ORIGINS;
    await setupCorsServer();
    const res = await fetch(corsBaseUrl, {
      headers: { Origin: "http://malicious-site.com" },
    });
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toContain("CORS policy: Origin http://malicious-site.com not allowed");
  });

  it("should allow custom origin specified in CORS_ALLOWED_ORIGINS", async () => {
    process.env.CORS_ALLOWED_ORIGINS = "https://my-dashboard.example.com, https://internal.company.com";
    await setupCorsServer();
    const res = await fetch(corsBaseUrl, {
      headers: { Origin: "https://my-dashboard.example.com" },
    });
    expect(res.status).toBe(200);
    expect(res.headers.get("access-control-allow-origin")).toBe("https://my-dashboard.example.com");
  });

  it("should allow all origins if CORS_ALLOWED_ORIGINS contains wildcard *", async () => {
    process.env.CORS_ALLOWED_ORIGINS = "*";
    await setupCorsServer();
    const res = await fetch(corsBaseUrl, {
      headers: { Origin: "http://anywhere.com" },
    });
    expect(res.status).toBe(200);
    expect(res.headers.get("access-control-allow-origin")).toBe("http://anywhere.com");
  });
});
