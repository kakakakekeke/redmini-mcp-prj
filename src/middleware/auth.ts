import type { Request, Response, NextFunction } from "express";
import { timingSafeEqual } from "node:crypto";
import { RedmineClient } from "../client/redmine.js";
import { loadConfig } from "../utils/config.js";

export function safeTokenCompare(provided: string, expected: string): boolean {
  const bufA = Buffer.from(provided);
  const bufB = Buffer.from(expected);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

export function getAuthClient(headers: Record<string, string | string[] | undefined> = {}): RedmineClient {
  const config = loadConfig();
  const safeHeaders = headers && typeof headers === "object" ? headers : {};
  
  const headerKey = Object.keys(safeHeaders).find(k => k.toLowerCase() === "x-redmine-api-key");
  const userApiKeyRaw = headerKey ? safeHeaders[headerKey] : undefined;
  const userApiKey = Array.isArray(userApiKeyRaw) ? userApiKeyRaw[0] : userApiKeyRaw;

  let apiKey = typeof userApiKey === "string" ? userApiKey.trim() : undefined;
  if (!apiKey || apiKey.length === 0) {
    apiKey = undefined;
  }

  const isStdio = process.env.TRANSPORT === "stdio";
  if (!apiKey && isStdio) {
    const fallback = config.REDMINE_API_KEY?.trim();
    if (fallback && fallback.length > 0) {
      apiKey = fallback;
    }
  }

  if (!apiKey) {
    throw new Error("Authentication failed: Missing Redmine API Key");
  }
  
  return new RedmineClient(config.REDMINE_URL, apiKey);
}

export function verifyHttpBearerToken(req: Request, res: Response, next: NextFunction) {
  const rawRequiredToken = process.env.MCP_AUTH_TOKEN;
  const requiredToken = typeof rawRequiredToken === "string" ? rawRequiredToken.trim() : undefined;
  if (!requiredToken) {
    return next();
  }

  if (req.method === "OPTIONS") {
    return next();
  }

  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: "Unauthorized: Missing Authorization header" });
  }

  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    return res.status(401).json({ error: "Unauthorized: Invalid or missing MCP Bearer Token" });
  }

  const providedToken = match[1].trim();
  if (!safeTokenCompare(providedToken, requiredToken)) {
    return res.status(401).json({ error: "Unauthorized: Invalid or missing MCP Bearer Token" });
  }

  next();
}
