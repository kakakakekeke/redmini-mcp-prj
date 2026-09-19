import { describe, it, expect, beforeEach, afterEach } from "vitest";
import express from "express";
import { createSSERouter } from "../../src/server/sse-runner";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import axios from "axios";
import http from "http";

describe("SSE Transport Layer", () => {
  let app;
  let server;
  let baseUrl;

  beforeEach(async () => {
    app = express();
    app.use("/mcp", createSSERouter(() => new McpServer({
      name: "test-mcp-server",
      version: "1.0.0",
    })));
    
    await new Promise((resolve) => {
      server = app.listen(0, "127.0.0.1", () => {
        const address = server.address();
        if (typeof address === "object" && address !== null) {
          baseUrl = "http://127.0.0.1:" + address.port;
        }
        resolve();
      });
    });
  });

  afterEach(async () => {
    await new Promise((resolve) => {
      server.close(() => resolve());
    });
  });

  it("should establish SSE connection at /mcp/sse", async () => {
    const res = await axios.get(baseUrl + "/mcp/sse", {
      headers: {
        Accept: "text/event-stream"
      },
      responseType: "stream"
    });
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("text/event-stream");
    res.data.destroy();
  });

  it("should accept POST messages at /mcp/message", async () => {
    try {
      await axios.post(baseUrl + "/mcp/message?sessionId=invalid_session", {
        jsonrpc: "2.0",
        method: "ping",
        id: 1,
      });
    } catch (e) {
      if (e.response) {
        expect(e.response.status).toBe(404);
      } else {
        throw e;
      }
    }
  });
});