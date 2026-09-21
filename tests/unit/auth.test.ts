import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { getAuthClient, verifyHttpBearerToken } from "../../src/middleware/auth.js";
import * as redmineModule from "../../src/client/redmine.js";
import { RedmineClient } from "../../src/client/redmine.js";
import * as configModule from "../../src/utils/config.js";
import type { Request, Response } from "express";

vi.mock("../../src/utils/config.js");

describe("Auth Middleware", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  describe("getAuthClient", () => {
    it("should use X-Redmine-API-Key header if provided", () => {
      vi.mocked(configModule.loadConfig).mockReturnValue({ REDMINE_URL: "http://redmine.test", REDMINE_API_KEY: "fallback_key" });
      const reqHeaders = { "x-redmine-api-key": "user_specific_key" };
      
      const client = getAuthClient(reqHeaders);
      expect(client).toBeInstanceOf(RedmineClient);
    });

    it("should be case-insensitive for header keys", () => {
      vi.mocked(configModule.loadConfig).mockReturnValue({ REDMINE_URL: "http://redmine.test" });
      const reqHeaders = { "X-Redmine-API-Key": "user_specific_key" };
      
      const client = getAuthClient(reqHeaders);
      expect(client).toBeInstanceOf(RedmineClient);
    });

    it("should throw error if header is not provided in HTTP mode", () => {
      vi.mocked(configModule.loadConfig).mockReturnValue({ REDMINE_URL: "http://redmine.test", REDMINE_API_KEY: "fallback_key" });
      delete process.env.TRANSPORT;
      const reqHeaders = {};
      
      expect(() => getAuthClient(reqHeaders)).toThrow("Authentication failed: Missing Redmine API Key");
    });

    it("should throw error if X-Redmine-API-Key is whitespace-only", () => {
      vi.mocked(configModule.loadConfig).mockReturnValue({ REDMINE_URL: "http://redmine.test" });
      delete process.env.TRANSPORT;
      const reqHeaders = { "x-redmine-api-key": "   " };

      expect(() => getAuthClient(reqHeaders)).toThrow("Authentication failed: Missing Redmine API Key");
    });

    it("should trim surrounding whitespace from API key", () => {
      vi.mocked(configModule.loadConfig).mockReturnValue({ REDMINE_URL: "http://redmine.test" });
      delete process.env.TRANSPORT;
      const clientSpy = vi.spyOn(redmineModule, "RedmineClient");
      const reqHeaders = { "x-redmine-api-key": "  user_key  " };

      getAuthClient(reqHeaders);
      expect(clientSpy).toHaveBeenCalledWith("http://redmine.test", "user_key");
    });

    it("should properly extract and trim the first entry if header is an array", () => {
      vi.mocked(configModule.loadConfig).mockReturnValue({ REDMINE_URL: "http://redmine.test" });
      delete process.env.TRANSPORT;
      const clientSpy = vi.spyOn(redmineModule, "RedmineClient");
      const reqHeaders = { "x-redmine-api-key": ["  trimmed_key  ", "other"] };

      getAuthClient(reqHeaders as any);
      expect(clientSpy).toHaveBeenCalledWith("http://redmine.test", "trimmed_key");
    });

    it("should safely handle null or undefined headers without throwing TypeError", () => {
      vi.mocked(configModule.loadConfig).mockReturnValue({ REDMINE_URL: "http://redmine.test" });
      delete process.env.TRANSPORT;

      expect(() => getAuthClient(null as any)).toThrow("Authentication failed: Missing Redmine API Key");
      expect(() => getAuthClient(undefined as any)).toThrow("Authentication failed: Missing Redmine API Key");
    });

    it("should throw error in HTTP mode even if ALLOW_SERVER_KEY_FALLBACK=true or REDMINE_API_KEY is configured", () => {
      vi.mocked(configModule.loadConfig).mockReturnValue({ REDMINE_URL: "http://redmine.test", REDMINE_API_KEY: "fallback_key" });
      process.env.ALLOW_SERVER_KEY_FALLBACK = "true";
      delete process.env.TRANSPORT;
      const reqHeaders = {};
      
      expect(() => getAuthClient(reqHeaders)).toThrow("Authentication failed: Missing Redmine API Key");

      process.env.TRANSPORT = "http";
      expect(() => getAuthClient(reqHeaders)).toThrow("Authentication failed: Missing Redmine API Key");
    });

    it("should fallback to REDMINE_API_KEY if TRANSPORT is stdio", () => {
      vi.mocked(configModule.loadConfig).mockReturnValue({ REDMINE_URL: "http://redmine.test", REDMINE_API_KEY: "fallback_key" });
      process.env.TRANSPORT = "stdio";
      const reqHeaders = {};
      
      const client = getAuthClient(reqHeaders);
      expect(client).toBeInstanceOf(RedmineClient);
    });

    it("should throw error if no API key is available in header and env even in stdio mode", () => {
      vi.mocked(configModule.loadConfig).mockReturnValue({ REDMINE_URL: "http://redmine.test" }); 
      process.env.TRANSPORT = "stdio";
      const reqHeaders = {};
      
      expect(() => getAuthClient(reqHeaders)).toThrow("Authentication failed: Missing Redmine API Key");
    });
  });

  describe("verifyHttpBearerToken", () => {
    it("should call next() if MCP_AUTH_TOKEN is not configured", () => {
      delete process.env.MCP_AUTH_TOKEN;
      const req = { headers: {} } as Request;
      const res = { status: vi.fn().mockReturnThis(), json: vi.fn() } as unknown as Response;
      const next = vi.fn();

      verifyHttpBearerToken(req, res, next);
      expect(next).toHaveBeenCalledTimes(1);
      expect(res.status).not.toHaveBeenCalled();
    });

    it("should call next() for OPTIONS preflight request even if MCP_AUTH_TOKEN is configured", () => {
      process.env.MCP_AUTH_TOKEN = "secret-token-123";
      const req = { method: "OPTIONS", headers: {} } as Request;
      const res = { status: vi.fn().mockReturnThis(), json: vi.fn() } as unknown as Response;
      const next = vi.fn();

      verifyHttpBearerToken(req, res, next);
      expect(next).toHaveBeenCalledTimes(1);
      expect(res.status).not.toHaveBeenCalled();
    });

    it("should return 401 if MCP_AUTH_TOKEN is configured but Authorization header is missing", () => {
      process.env.MCP_AUTH_TOKEN = "secret-token-123";
      const req = { method: "POST", headers: {} } as Request;
      const jsonMock = vi.fn();
      const statusMock = vi.fn().mockReturnValue({ json: jsonMock });
      const res = { status: statusMock } as unknown as Response;
      const next = vi.fn();

      verifyHttpBearerToken(req, res, next);
      expect(next).not.toHaveBeenCalled();
      expect(statusMock).toHaveBeenCalledWith(401);
      expect(jsonMock).toHaveBeenCalledWith(expect.objectContaining({ error: expect.stringMatching(/unauthorized/i) }));
    });

    it("should return 401 if MCP_AUTH_TOKEN is configured but token does not match (different length)", () => {
      process.env.MCP_AUTH_TOKEN = "secret-token-123";
      const req = {
        method: "POST",
        headers: { authorization: "Bearer wrong-token" }
      } as unknown as Request;
      const jsonMock = vi.fn();
      const statusMock = vi.fn().mockReturnValue({ json: jsonMock });
      const res = { status: statusMock } as unknown as Response;
      const next = vi.fn();

      verifyHttpBearerToken(req, res, next);
      expect(next).not.toHaveBeenCalled();
      expect(statusMock).toHaveBeenCalledWith(401);
      expect(jsonMock).toHaveBeenCalledWith(expect.objectContaining({ error: expect.stringMatching(/unauthorized/i) }));
    });

    it("should return 401 if MCP_AUTH_TOKEN is configured but token does not match (same length)", () => {
      process.env.MCP_AUTH_TOKEN = "secret-token-123";
      const req = {
        method: "POST",
        headers: { authorization: "Bearer secret-token-456" }
      } as unknown as Request;
      const jsonMock = vi.fn();
      const statusMock = vi.fn().mockReturnValue({ json: jsonMock });
      const res = { status: statusMock } as unknown as Response;
      const next = vi.fn();

      verifyHttpBearerToken(req, res, next);
      expect(next).not.toHaveBeenCalled();
      expect(statusMock).toHaveBeenCalledWith(401);
      expect(jsonMock).toHaveBeenCalledWith(expect.objectContaining({ error: expect.stringMatching(/unauthorized/i) }));
    });

    it("should call next() if MCP_AUTH_TOKEN matches Bearer token", () => {
      process.env.MCP_AUTH_TOKEN = "secret-token-123";
      const req = {
        method: "POST",
        headers: { authorization: "Bearer secret-token-123" }
      } as unknown as Request;
      const res = { status: vi.fn().mockReturnThis(), json: vi.fn() } as unknown as Response;
      const next = vi.fn();

      verifyHttpBearerToken(req, res, next);
      expect(next).toHaveBeenCalledTimes(1);
      expect(res.status).not.toHaveBeenCalled();
    });

    it("should trim surrounding whitespace on bearer token and configured token", () => {
      process.env.MCP_AUTH_TOKEN = "  secret-token-123  ";
      const req = {
        method: "POST",
        headers: { authorization: "Bearer   secret-token-123   " }
      } as unknown as Request;
      const res = { status: vi.fn().mockReturnThis(), json: vi.fn() } as unknown as Response;
      const next = vi.fn();

      verifyHttpBearerToken(req, res, next);
      expect(next).toHaveBeenCalledTimes(1);
      expect(res.status).not.toHaveBeenCalled();
    });
  });
});
