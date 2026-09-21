import { describe, it, expect, afterEach } from "vitest";
import express from "express";
import { getMcpRateLimiter, getHealthRateLimiter } from "../../src/index.js";
import type { Server } from "http";

describe("Rate Limiting Middleware", () => {
  let app: express.Express;
  let server: Server;
  let baseUrl: string;

  afterEach(async () => {
    if (server) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it("should configure getMcpRateLimiter and return 429 when max requests exceeded", async () => {
    app = express();
    // Test with a tight limit: max 2 requests
    const limiter = getMcpRateLimiter({
      windowMs: 1000,
      max: 2,
    });
    app.all("/mcp", limiter, (req, res) => res.status(200).json({ status: "ok" }));

    await new Promise<void>((resolve) => {
      server = app.listen(0, "127.0.0.1", () => {
        const addr = server.address() as any;
        baseUrl = `http://127.0.0.1:${addr.port}`;
        resolve();
      });
    });

    const res1 = await fetch(`${baseUrl}/mcp`);
    expect(res1.status).toBe(200);

    const res2 = await fetch(`${baseUrl}/mcp`);
    expect(res2.status).toBe(200);

    const res3 = await fetch(`${baseUrl}/mcp`);
    expect(res3.status).toBe(429);
    expect(res3.headers.get("ratelimit-limit")).toBe("2");
  });

  it("should configure getHealthRateLimiter and return 429 when max requests exceeded", async () => {
    app = express();
    // Test with a tight limit: max 3 requests
    const limiter = getHealthRateLimiter({
      windowMs: 1000,
      max: 3,
    });
    app.get("/health", limiter, (req, res) => res.status(200).json({ status: "ok" }));

    await new Promise<void>((resolve) => {
      server = app.listen(0, "127.0.0.1", () => {
        const addr = server.address() as any;
        baseUrl = `http://127.0.0.1:${addr.port}`;
        resolve();
      });
    });

    for (let i = 0; i < 3; i++) {
      const res = await fetch(`${baseUrl}/health`);
      expect(res.status).toBe(200);
    }

    const res4 = await fetch(`${baseUrl}/health`);
    expect(res4.status).toBe(429);
  });
});
