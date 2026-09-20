import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createSSERouter } from '../../src/server/sse-runner.js';

// Mock logger first (before any imports that use it)
vi.mock('../../src/utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// Mock SSEServerTransport - using constructor function form for vitest compatibility
vi.mock('@modelcontextprotocol/sdk/server/sse.js', () => ({
  SSEServerTransport: vi.fn(function (this: any) {
    this.sessionId = 'test-session-id-123';
    this.handlePostMessage = vi.fn().mockResolvedValue(undefined);
    this.close = vi.fn().mockResolvedValue(undefined);
  }),
}));

// Mock McpServer
vi.mock('@modelcontextprotocol/sdk/server/mcp.js', () => ({
  McpServer: vi.fn(function (this: any) {
    this.connect = vi.fn().mockResolvedValue(undefined);
    this.close = vi.fn().mockResolvedValue(undefined);
  }),
}));

import { logger } from '../../src/utils/logger.js';
import { Request, Response, NextFunction } from 'express';

/**
 * Helper: extract a route handler from router.stack by path and method.
 */
function getHandler(router: any, method: string, path: string) {
  const layer = router.stack?.find(
    (l: any) => l.route?.path === path && l.route?.methods?.[method]
  );
  return layer?.route?.stack?.[0]?.handle as
    | ((req: Request, res: Response, next: NextFunction) => Promise<void>)
    | undefined;
}

describe('SSE Runner IP Logging', () => {
  let mockCreateServer: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateServer = vi.fn(function (this: any) {
      return {
        connect: vi.fn().mockResolvedValue(undefined),
        close: vi.fn().mockResolvedValue(undefined),
      };
    });
  });

  function makeSseRes() {
    const res: any = {
      writeHead: vi.fn(),
      write: vi.fn(),
      end: vi.fn(),
      on: vi.fn(),
      setHeader: vi.fn(),
      flushHeaders: vi.fn(),
    };
    return res as Response;
  }

  function makeSseReq(headers: Record<string, string> = {}, ip = '127.0.0.1') {
    return {
      headers,
      ip,
      on: vi.fn(),
    } as unknown as Request;
  }

  /** Helper: establish a session in the router for POST /message tests */
  async function setupSession(router: any) {
    const sseHandler = getHandler(router, 'get', '/sse');
    if (sseHandler) {
      await sseHandler(makeSseReq({}, '127.0.0.1'), makeSseRes(), vi.fn());
    }
  }

  describe('GET /sse - IP Logging', () => {
    it('should log x-forwarded-for header when present on SSE connection', async () => {
      const router = createSSERouter(mockCreateServer);
      const handler = getHandler(router, 'get', '/sse');
      expect(handler, 'GET /sse handler must exist').toBeDefined();

      const req = makeSseReq({ 'x-forwarded-for': '203.0.113.42' }, '127.0.0.1');
      const res = makeSseRes();
      const next = vi.fn();

      await handler!(req, res, next);

      expect(logger.info).toHaveBeenCalledWith(
        'SSE connection established',
        expect.objectContaining({
          ip: '203.0.113.42',
          sessionId: 'test-session-id-123',
        })
      );
    });

    it('should log req.ip when x-forwarded-for header is absent on SSE connection', async () => {
      const router = createSSERouter(mockCreateServer);
      const handler = getHandler(router, 'get', '/sse');
      expect(handler, 'GET /sse handler must exist').toBeDefined();

      const req = makeSseReq({}, '192.168.1.1');
      const res = makeSseRes();
      const next = vi.fn();

      await handler!(req, res, next);

      expect(logger.info).toHaveBeenCalledWith(
        'SSE connection established',
        expect.objectContaining({
          ip: '192.168.1.1',
          sessionId: 'test-session-id-123',
        })
      );
    });

    it('should extract only the first IP when x-forwarded-for contains multiple IPs', async () => {
      const router = createSSERouter(mockCreateServer);
      const handler = getHandler(router, 'get', '/sse');
      expect(handler, 'GET /sse handler must exist').toBeDefined();

      const req = makeSseReq({ 'x-forwarded-for': '203.0.113.42, 198.51.100.1, 10.0.0.1' }, '127.0.0.1');
      const res = makeSseRes();
      const next = vi.fn();

      await handler!(req, res, next);

      expect(logger.info).toHaveBeenCalledWith(
        'SSE connection established',
        expect.objectContaining({
          ip: '203.0.113.42',
          sessionId: 'test-session-id-123',
        })
      );
    });
  });

  describe('POST /message - IP Logging', () => {
    it('should log x-forwarded-for header when present on tool call', async () => {
      const router = createSSERouter(mockCreateServer);
      await setupSession(router);
      vi.clearAllMocks();

      const handler = getHandler(router, 'post', '/message');
      expect(handler, 'POST /message handler must exist').toBeDefined();

      const req = {
        headers: { 'x-forwarded-for': '10.0.0.5' },
        ip: '127.0.0.1',
        query: { sessionId: 'test-session-id-123' },
        on: vi.fn(),
      } as unknown as Request;

      const res = {
        status: vi.fn().mockReturnThis(),
        send: vi.fn(),
        json: vi.fn(),
      } as unknown as Response;

      await handler!(req, res, vi.fn());

      expect(logger.info).toHaveBeenCalledWith(
        'Tool call received',
        expect.objectContaining({
          ip: '10.0.0.5',
          sessionId: 'test-session-id-123',
        })
      );
    });

    it('should log req.ip when x-forwarded-for header is absent on tool call', async () => {
      const router = createSSERouter(mockCreateServer);
      await setupSession(router);
      vi.clearAllMocks();

      const handler = getHandler(router, 'post', '/message');
      expect(handler, 'POST /message handler must exist').toBeDefined();

      const req = {
        headers: {},
        ip: '172.16.0.1',
        query: { sessionId: 'test-session-id-123' },
        on: vi.fn(),
      } as unknown as Request;

      const res = {
        status: vi.fn().mockReturnThis(),
        send: vi.fn(),
        json: vi.fn(),
      } as unknown as Response;

      await handler!(req, res, vi.fn());

      expect(logger.info).toHaveBeenCalledWith(
        'Tool call received',
        expect.objectContaining({
          ip: '172.16.0.1',
          sessionId: 'test-session-id-123',
        })
      );
    });

    it('should extract only the first IP when x-forwarded-for contains multiple IPs', async () => {
      const router = createSSERouter(mockCreateServer);
      await setupSession(router);
      vi.clearAllMocks();

      const handler = getHandler(router, 'post', '/message');
      expect(handler, 'POST /message handler must exist').toBeDefined();

      const req = {
        headers: { 'x-forwarded-for': '10.0.0.5, 172.16.0.1' },
        ip: '127.0.0.1',
        query: { sessionId: 'test-session-id-123' },
        on: vi.fn(),
      } as unknown as Request;

      const res = {
        status: vi.fn().mockReturnThis(),
        send: vi.fn(),
        json: vi.fn(),
      } as unknown as Response;

      await handler!(req, res, vi.fn());

      expect(logger.info).toHaveBeenCalledWith(
        'Tool call received',
        expect.objectContaining({
          ip: '10.0.0.5',
        })
      );
    });
  });
});
