import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createSSERouter } from '../../src/server/sse-runner.js';

vi.mock('../../src/utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('@modelcontextprotocol/sdk/server/sse.js', () => ({
  SSEServerTransport: vi.fn(function (this: any) {
    this.sessionId = 'test-session-id-123';
    this.handlePostMessage = vi.fn().mockResolvedValue(undefined);
    this.close = vi.fn().mockResolvedValue(undefined);
  }),
}));

import { logger } from '../../src/utils/logger.js';
import { Request, Response, NextFunction } from 'express';

function getHandler(router: any, method: string, path: string) {
  const layer = router.stack?.find(
    (entry: any) => entry.route?.path === path && entry.route?.methods?.[method]
  );
  return layer?.route?.stack?.[0]?.handle as
    | ((req: Request, res: Response, next: NextFunction) => Promise<void>)
    | undefined;
}

describe('SSE Runner IP Logging', () => {
  let mockCreateServer: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateServer = vi.fn(() => ({
      connect: vi.fn().mockResolvedValue(undefined),
      close: vi.fn().mockResolvedValue(undefined),
    }));
  });

  function makeSseRes() {
    return {
      writeHead: vi.fn(),
      write: vi.fn(),
      end: vi.fn(),
      on: vi.fn(),
      setHeader: vi.fn(),
      flushHeaders: vi.fn(),
    } as unknown as Response;
  }

  function makeSseReq(
    headers: Record<string, string | string[]> = {},
    ip?: string
  ) {
    return { headers, ip, on: vi.fn() } as unknown as Request;
  }

  async function setupSession(router: any) {
    const handler = getHandler(router, 'get', '/sse');
    await handler?.(makeSseReq({}, '127.0.0.1'), makeSseRes(), vi.fn());
  }

  const sessionHash = expect.stringMatching(/^[0-9a-f]{16}$/);

  describe('GET /sse - IP Logging', () => {
    it('logs the first forwarded IP with a hashed session id', async () => {
      const handler = getHandler(createSSERouter(mockCreateServer), 'get', '/sse');

      await handler!(
        makeSseReq({ 'x-forwarded-for': '203.0.113.42, 198.51.100.1' }, '127.0.0.1'),
        makeSseRes(),
        vi.fn()
      );

      expect(logger.info).toHaveBeenCalledWith(
        'SSE connection established',
        expect.objectContaining({ ip: '203.0.113.42', sessionIdHash: sessionHash })
      );
    });

    it('falls back to req.ip for empty forwarded values', async () => {
      const handler = getHandler(createSSERouter(mockCreateServer), 'get', '/sse');

      await handler!(makeSseReq({ 'x-forwarded-for': [''] }, '192.168.1.1'), makeSseRes(), vi.fn());

      expect(logger.info).toHaveBeenCalledWith(
        'SSE connection established',
        expect.objectContaining({ ip: '192.168.1.1' })
      );
    });

    it('trims the first IP from an array header', async () => {
      const handler = getHandler(createSSERouter(mockCreateServer), 'get', '/sse');

      await handler!(
        makeSseReq({ 'x-forwarded-for': [' 203.0.113.42 ', '198.51.100.1'] }),
        makeSseRes(),
        vi.fn()
      );

      expect(logger.info).toHaveBeenCalledWith(
        'SSE connection established',
        expect.objectContaining({ ip: '203.0.113.42' })
      );
    });

    it('logs unknown when req.ip is unavailable', async () => {
      const handler = getHandler(createSSERouter(mockCreateServer), 'get', '/sse');

      await handler!(makeSseReq(), makeSseRes(), vi.fn());

      expect(logger.info).toHaveBeenCalledWith(
        'SSE connection established',
        expect.objectContaining({ ip: 'unknown' })
      );
    });

    it('rejects an invalid forwarded value and uses req.ip', async () => {
      const handler = getHandler(createSSERouter(mockCreateServer), 'get', '/sse');

      await handler!(
        makeSseReq({ 'x-forwarded-for': 'not-an-ip\r\n[ forged entry ]' }, '192.168.1.1'),
        makeSseRes(),
        vi.fn()
      );

      expect(logger.info).toHaveBeenCalledWith(
        'SSE connection established',
        expect.objectContaining({ ip: '192.168.1.1' })
      );
    });

    it('closes resources and forwards connect errors', async () => {
      const connectError = new Error('connect failed');
      const serverClose = vi.fn().mockResolvedValue(undefined);
      const createServer = vi.fn(() => ({
        connect: vi.fn().mockRejectedValue(connectError),
        close: serverClose,
      }));
      const handler = getHandler(createSSERouter(createServer), 'get', '/sse');
      const next = vi.fn();

      await handler!(makeSseReq(), makeSseRes(), next);

      expect(serverClose).toHaveBeenCalledOnce();
      expect(next).toHaveBeenCalledWith(connectError);
      expect(logger.info).not.toHaveBeenCalled();
    });
  });

  describe('POST /message - IP Logging', () => {
    it('logs a hashed session id and normalized IP', async () => {
      const router = createSSERouter(mockCreateServer);
      await setupSession(router);
      vi.clearAllMocks();
      const handler = getHandler(router, 'post', '/message');
      const req = {
        headers: { 'x-forwarded-for': '10.0.0.5' },
        ip: '127.0.0.1',
        query: { sessionId: 'test-session-id-123' },
        on: vi.fn(),
      } as unknown as Request;
      const res = { status: vi.fn().mockReturnThis(), send: vi.fn() } as unknown as Response;

      await handler!(req, res, vi.fn());

      expect(logger.info).toHaveBeenCalledWith(
        'Tool call received',
        expect.objectContaining({ ip: '10.0.0.5', sessionIdHash: sessionHash })
      );
    });

    it('falls back to req.ip when the forwarded header is absent', async () => {
      const router = createSSERouter(mockCreateServer);
      await setupSession(router);
      vi.clearAllMocks();
      const handler = getHandler(router, 'post', '/message');
      const req = {
        headers: {},
        ip: '172.16.0.1',
        query: { sessionId: 'test-session-id-123' },
        on: vi.fn(),
      } as unknown as Request;
      const res = { status: vi.fn().mockReturnThis(), send: vi.fn() } as unknown as Response;

      await handler!(req, res, vi.fn());

      expect(logger.info).toHaveBeenCalledWith(
        'Tool call received',
        expect.objectContaining({ ip: '172.16.0.1' })
      );
    });

    it('falls back to req.ip for an empty forwarded array', async () => {
      const router = createSSERouter(mockCreateServer);
      await setupSession(router);
      vi.clearAllMocks();
      const handler = getHandler(router, 'post', '/message');
      const req = {
        headers: { 'x-forwarded-for': [''] },
        ip: '172.16.0.1',
        query: { sessionId: 'test-session-id-123' },
        on: vi.fn(),
      } as unknown as Request;
      const res = { status: vi.fn().mockReturnThis(), send: vi.fn() } as unknown as Response;

      await handler!(req, res, vi.fn());

      expect(logger.info).toHaveBeenCalledWith(
        'Tool call received',
        expect.objectContaining({ ip: '172.16.0.1' })
      );
    });

    it('uses the first IP from a multi-value forwarded header', async () => {
      const router = createSSERouter(mockCreateServer);
      await setupSession(router);
      vi.clearAllMocks();
      const handler = getHandler(router, 'post', '/message');
      const req = {
        headers: { 'x-forwarded-for': '10.0.0.5, 172.16.0.1' },
        ip: '127.0.0.1',
        query: { sessionId: 'test-session-id-123' },
        on: vi.fn(),
      } as unknown as Request;
      const res = { status: vi.fn().mockReturnThis(), send: vi.fn() } as unknown as Response;

      await handler!(req, res, vi.fn());

      expect(logger.info).toHaveBeenCalledWith(
        'Tool call received',
        expect.objectContaining({ ip: '10.0.0.5' })
      );
    });

    it('logs an unknown session id without interpolating it into the message', async () => {
      const router = createSSERouter(mockCreateServer);
      const handler = getHandler(router, 'post', '/message');
      const maliciousSessionId = 'missing\r\nforged log entry';
      const res = { status: vi.fn().mockReturnThis(), send: vi.fn() } as unknown as Response;

      await handler!(
        { headers: {}, query: { sessionId: maliciousSessionId }, on: vi.fn() } as unknown as Request,
        res,
        vi.fn()
      );

      expect(logger.warn).toHaveBeenCalledWith(
        'SSE connection not found or expired',
        expect.objectContaining({ sessionIdHash: expect.stringMatching(/^[0-9a-f]{16}$/) })
      );
      expect(logger.warn).not.toHaveBeenCalledWith(expect.stringContaining(maliciousSessionId));
    });
  });
});
