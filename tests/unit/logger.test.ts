import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { logger, Logger, maskSensitiveData, LogLevel } from '../../src/utils/logger.js';

describe('Security Logger', () => {
  let stderrOutput: string[] = [];
  let stdoutOutput: string[] = [];
  let stderrSpy: any;
  let stdoutSpy: any;

  beforeEach(() => {
    stderrOutput = [];
    stdoutOutput = [];
    stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation((chunk: any) => {
      stderrOutput.push(typeof chunk === 'string' ? chunk : chunk.toString());
      return true;
    });
    stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation((chunk: any) => {
      stdoutOutput.push(typeof chunk === 'string' ? chunk : chunk.toString());
      return true;
    });
    logger.setLevel('debug');
  });

  afterEach(() => {
    stderrSpy.mockRestore();
    stdoutSpy.mockRestore();
  });

  describe('Stdio Channel Integrity', () => {
    it('should write all log levels exclusively to stderr and never to stdout', () => {
      logger.debug('debug message');
      logger.info('info message');
      logger.warn('warn message');
      logger.error('error message');

      expect(stdoutOutput.length).toBe(0);
      expect(stdoutSpy).not.toHaveBeenCalled();
      expect(stderrOutput.length).toBe(4);
      expect(stderrOutput.some(msg => msg.includes('debug message'))).toBe(true);
      expect(stderrOutput.some(msg => msg.includes('info message'))).toBe(true);
      expect(stderrOutput.some(msg => msg.includes('warn message'))).toBe(true);
      expect(stderrOutput.some(msg => msg.includes('error message'))).toBe(true);
    });
  });

  describe('Log Level Filtering', () => {
    it('should filter logs below current level', () => {
      logger.setLevel('info');
      logger.debug('debug message');
      logger.info('info message');
      logger.warn('warn message');

      expect(stderrOutput.some(msg => msg.includes('debug message'))).toBe(false);
      expect(stderrOutput.some(msg => msg.includes('info message'))).toBe(true);
      expect(stderrOutput.some(msg => msg.includes('warn message'))).toBe(true);
    });

    it('should only log error messages when level is error', () => {
      logger.setLevel('error');
      logger.debug('debug');
      logger.info('info');
      logger.warn('warn');
      logger.error('critical failure');

      expect(stderrOutput.length).toBe(1);
      expect(stderrOutput[0]).toContain('critical failure');
    });

    it('should not log anything when level is silent', () => {
      logger.setLevel('silent');
      logger.debug('debug');
      logger.info('info');
      logger.warn('warn');
      logger.error('error');

      expect(stderrOutput.length).toBe(0);
    });

    it('should handle case-insensitive log levels', () => {
      logger.setLevel('WARN' as LogLevel);
      expect(logger.getLevel()).toBe('warn');
      logger.info('info message');
      logger.warn('warn message');

      expect(stderrOutput).toHaveLength(1);
      expect(stderrOutput[0]).toContain('warn message');
    });

    it('should initialize default level from LOG_LEVEL env var', () => {
      const originalEnv = process.env.LOG_LEVEL;
      process.env.LOG_LEVEL = 'warn';
      const customLogger = new Logger();
      expect(customLogger.getLevel()).toBe('warn');
      process.env.LOG_LEVEL = originalEnv;
    });

    it('should fallback to info if LOG_LEVEL env var is invalid', () => {
      const originalEnv = process.env.LOG_LEVEL;
      process.env.LOG_LEVEL = 'invalid_level';
      const customLogger = new Logger();
      expect(customLogger.getLevel()).toBe('info');
      process.env.LOG_LEVEL = originalEnv;
    });
  });

  describe('Masking Sensitive Data (maskSensitiveData)', () => {
    it('should mask 40-character hex Redmine API keys in string', () => {
      const apiKey = '1234567890abcdef1234567890abcdef12345678';
      const input = `Connecting to Redmine with key ${apiKey} at endpoint`;
      const masked = maskSensitiveData(input);

      expect(masked).not.toContain(apiKey);
      expect(masked).toContain('[REDACTED_API_KEY]');
    });

    it('should mask URL query parameters containing sensitive keys', () => {
      const url1 = 'https://redmine.example.com/issues.json?key=mySecretKey123&tracker_id=1';
      const url2 = 'https://redmine.example.com/api?api_key=token_abc_xyz&status=open';
      const url3 = 'https://redmine.example.com/login?password=myPassword123&user=admin';

      expect(maskSensitiveData(url1)).toBe('https://redmine.example.com/issues.json?key=[REDACTED]&tracker_id=1');
      expect(maskSensitiveData(url2)).toBe('https://redmine.example.com/api?api_key=[REDACTED]&status=open');
      expect(maskSensitiveData(url3)).toBe('https://redmine.example.com/login?password=[REDACTED]&user=admin');
    });

    it('should mask X-Redmine-API-Key and Authorization headers in string', () => {
      const headerLog1 = 'Headers: X-Redmine-API-Key: 9999888877776666555544443333222211110000, Content-Type: application/json';
      const headerLog2 = 'x-redmine-api-key: secret_user_key_value';
      const authHeader = 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.xyz';

      const masked1 = maskSensitiveData(headerLog1);
      const masked2 = maskSensitiveData(headerLog2);
      const masked3 = maskSensitiveData(authHeader);

      expect(masked1).not.toContain('9999888877776666555544443333222211110000');
      expect(masked1).toContain('X-Redmine-API-Key: [REDACTED]');
      expect(masked2).toContain('x-redmine-api-key: [REDACTED]');
      expect(masked3).toContain('Authorization: Bearer [REDACTED]');
    });

    it('should mask sensitive object keys case-insensitively', () => {
      const sensitiveObj = {
        apiKey: 'secret_api_key_value',
        API_KEY: 'another_secret',
        key: 'simple_key_val',
        password: 'mypassword',
        token: 'token_12345',
        authorization: 'Bearer token',
        secret: 'my_secret',
        cookie: 'session_id=12345',
        safeProperty: 'public_value',
      };

      const masked = maskSensitiveData(sensitiveObj);

      expect(masked.apiKey).toBe('[REDACTED]');
      expect(masked.API_KEY).toBe('[REDACTED]');
      expect(masked.key).toBe('[REDACTED]');
      expect(masked.password).toBe('[REDACTED]');
      expect(masked.token).toBe('[REDACTED]');
      expect(masked.authorization).toBe('[REDACTED]');
      expect(masked.secret).toBe('[REDACTED]');
      expect(masked.cookie).toBe('[REDACTED]');
      expect(masked.safeProperty).toBe('public_value');
    });

    it('should mask PII email addresses and phone numbers in string and objects', () => {
      const email = 'john.doe@example.com';
      const phone1 = '010-1234-5678';
      const phone2 = '+82-10-9876-5432';
      const text = `User contact: ${email}, Phone: ${phone1} or ${phone2}`;

      const masked = maskSensitiveData(text);

      expect(masked).not.toContain('john.doe@example.com');
      expect(masked).toMatch(/(j\*{3}@example\.com|\[EMAIL_REDACTED\])/);
      expect(masked).not.toContain(phone1);
      expect(masked).not.toContain(phone2);
      expect(masked).toContain('[PHONE_REDACTED]');
    });

    it('should recursively mask nested objects and arrays', () => {
      const complexData = {
        meta: {
          timestamp: 123456789,
          client: {
            apiKey: 'super_secret',
            emails: ['alice@corp.com', 'bob@corp.com'],
          },
        },
        items: [
          { token: 'tok_1', detail: 'clean' },
          { secret: 'sec_2', detail: 'clean' },
        ],
      };

      const masked = maskSensitiveData(complexData);

      expect(masked.meta.client.apiKey).toBe('[REDACTED]');
      expect(masked.meta.client.emails[0]).toMatch(/(a\*{3}@corp\.com|\[EMAIL_REDACTED\])/);
      expect(masked.meta.client.emails[1]).toMatch(/(b\*{3}@corp\.com|\[EMAIL_REDACTED\])/);
      expect(masked.items[0].token).toBe('[REDACTED]');
      expect(masked.items[0].detail).toBe('clean');
      expect(masked.items[1].secret).toBe('[REDACTED]');
    });

    it('should safely handle circular references without infinite recursion', () => {
      const circularObj: any = { name: 'circular-test' };
      circularObj.self = circularObj;
      circularObj.nested = { parent: circularObj, password: 'password123' };

      expect(() => {
        const masked = maskSensitiveData(circularObj);
        expect(masked.name).toBe('circular-test');
        expect(masked.self).toBe('[Circular]');
        expect(masked.nested.password).toBe('[REDACTED]');
        expect(masked.nested.parent).toBe('[Circular]');
      }).not.toThrow();
    });

    it('should safely serialize and mask Error objects', () => {
      const apiKey = '1234567890abcdef1234567890abcdef12345678';
      const error = new Error(`Request failed with API key: ${apiKey}`);
      (error as any).config = {
        url: 'https://redmine.test/issues.json?key=secretkey',
        apiKey: apiKey,
      };

      const masked = maskSensitiveData(error);

      expect(masked.name).toBe('Error');
      expect(masked.message).not.toContain(apiKey);
      expect(masked.message).toContain('[REDACTED_API_KEY]');
      expect(masked.stack).not.toContain(apiKey);
      expect(masked.config.url).toBe('https://redmine.test/issues.json?key=[REDACTED]');
      expect(masked.config.apiKey).toBe('[REDACTED]');
    });

    it('should preserve primitive values and null/undefined', () => {
      expect(maskSensitiveData(null)).toBeNull();
      expect(maskSensitiveData(undefined)).toBeUndefined();
      expect(maskSensitiveData(123)).toBe(123);
      expect(maskSensitiveData(true)).toBe(true);
      expect(maskSensitiveData(false)).toBe(false);
    });
  });

  describe('Logger Integration with Masking', () => {
    it('should automatically mask sensitive arguments when logging', () => {
      const apiKey = '1234567890abcdef1234567890abcdef12345678';
      logger.info('User login successful', {
        email: 'alice.kim@example.com',
        apiKey: apiKey,
      });

      expect(stderrOutput.length).toBe(1);
      const output = stderrOutput[0];
      expect(output).not.toContain(apiKey);
      expect(output).not.toContain('alice.kim@example.com');
      expect(output).toContain('[REDACTED]');
      expect(output).toMatch(/(\[INFO\]|INFO)/);
    });
  });
});
