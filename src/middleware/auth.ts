import type { Request, Response, NextFunction } from "express";
import { RedmineClient } from "../client/redmine.js";
import { loadConfig } from "../utils/config.js";

export function getAuthClient(headers: Record<string, string | string[] | undefined>): RedmineClient {
  const config = loadConfig();
  
  const headerKey = Object.keys(headers).find(k => k.toLowerCase() === "x-redmine-api-key");
  const userApiKeyRaw = headerKey ? headers[headerKey] : undefined;
  const userApiKey = Array.isArray(userApiKeyRaw) ? userApiKeyRaw[0] : userApiKeyRaw;

  let apiKey = userApiKey;
  if (!apiKey) {
    const isStdio = process.env.TRANSPORT === "stdio";
    const allowFallback = process.env.ALLOW_SERVER_KEY_FALLBACK === "true";
    if (isStdio || allowFallback) {
      apiKey = config.REDMINE_API_KEY;
    }
  }

  if (!apiKey) {
    throw new Error("Authentication failed: Missing Redmine API Key");
  }
  
  return new RedmineClient(config.REDMINE_URL, apiKey);
}

export function verifyHttpBearerToken(req: Request, res: Response, next: NextFunction) {
  const requiredToken = process.env.MCP_AUTH_TOKEN;
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
  if (!match || match[1] !== requiredToken) {
    return res.status(401).json({ error: "Unauthorized: Invalid or missing MCP Bearer Token" });
  }

  next();
}
