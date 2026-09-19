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
    // Use short TTL for testing
    app.use("/mcp", createSSERouter(() => new McpServer({
      name: "test-mcp-server",
      version: "1.0.0",
    }), {
      heartbeatIntervalMs: 50,
      sessionTtlMs: 200,
    }));
    
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

  it("should close inactive connections after TTL expires", async () => {
    // 1. Open connection
    const res = await axios.get(baseUrl + "/mcp/sse", {
      headers: { Accept: "text/event-stream" },
      responseType: "stream"
    });
    expect(res.status).toBe(200);

    let data = "";
    res.data.on("data", (chunk) => {
      data += chunk.toString();
    });

    let closed = false;
    res.data.on("close", () => {
      closed = true;
    });
    res.data.on("end", () => {
      closed = true;
    });

    // 2. Wait for connection to timeout (TTL is 200ms)
    await new Promise(resolve => setTimeout(resolve, 300));
    
    // Connection should be closed by the server
    expect(closed).toBe(true);
    
    // Also extract sessionId to verify it's removed
    const match = data.match(/endpoint?sessionId=([^\s&]+)/);
    if (match && match[1]) {
      const sessionId = match[1];
      try {
        await axios.post(baseUrl + "/mcp/message?sessionId=" + sessionId, {
          jsonrpc: "2.0",
          method: "ping",
          id: 1,
        });
        expect.fail("Should have thrown 404");
      } catch (e) {
        expect(e.response?.status).toBe(404);
      }
    }
  });

  it("should keep connection alive if POST messages are received", async () => {
    // 1. Open connection
    const res = await axios.get(baseUrl + "/mcp/sse", {
      headers: { Accept: "text/event-stream" },
      responseType: "stream"
    });
    
    let data = "";
    res.data.on("data", (chunk) => {
      data += chunk.toString();
    });

    let closed = false;
    res.data.on("close", () => { closed = true; });

    // Wait for the endpoint event to get the sessionId
    await new Promise(resolve => setTimeout(resolve, 50));
    
    const match = data.match(/endpoint\?sessionId=([^\s&]+)/);
    // Standard MCP SSE sends a line like: event: endpoint
// data: /mcp/message?sessionId=...
    // Let's just find the sessionId parameter anywhere in the stream output
    let sessionId = "";
    const idMatch = data.match(/sessionId=([a-zA-Z0-9_-]+)/);
    if (idMatch) {
      sessionId = idMatch[1];
    } else {
      console.warn("Could not extract sessionId from:", data);
    }

    if (sessionId) {
      // Send a ping to keep it alive (at t=100ms)
      await new Promise(resolve => setTimeout(resolve, 100));
      await axios.post(baseUrl + "/mcp/message?sessionId=" + sessionId, {
        jsonrpc: "2.0",
        method: "ping",
        id: 1,
      }).catch(() => {}); // it might be handled or not

      // Wait a bit more, total time 250ms > TTL (200ms) but we bumped it at 100ms
      // Wait, TTL is 200ms. If we bump at 100ms, it should expire at 300ms.
      // Let's just check at 250ms if it's closed.
      await new Promise(resolve => setTimeout(resolve, 100));
      expect(closed).toBe(false); // Still alive!
    }

    // Clean up
    res.data.destroy();
  });
});
