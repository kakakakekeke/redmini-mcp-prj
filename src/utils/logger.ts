export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'silent';

const LOG_LEVEL_PRIORITIES: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  silent: 4,
};

const SENSITIVE_KEYS = new Set([
  'apikey',
  'api_key',
  'key',
  'password',
  'token',
  'authorization',
  'secret',
  'cookie',
  'accesstoken',
  'access_token',
  'refreshtoken',
  'refresh_token',
  'private_key',
  'privatekey',
  'passphrase',
  'secret_key',
  'secretkey',
  'x-redmine-api-key',
]);

const REDMINE_API_KEY_REGEX = /\b[0-9a-fA-F]{40}\b/g;
const URL_QUERY_SENSITIVE_REGEX = /([?&](?:api_key|key|password|token|secret|authorization)=)[^& \s"']+/gi;
const HEADER_API_KEY_REGEX = /([Xx]-[Rr]edmine-[Aa][Pp][Ii]-[Kk]ey\s*[:=]\s*)[^\r\n,; \t]+/g;
const HEADER_AUTH_BEARER_REGEX = /(Authorization\s*[:=]\s*Bearer\s+)[^\r\n,; \t]+/gi;
const HEADER_AUTH_BASIC_REGEX = /(Authorization\s*[:=]\s*(?!Bearer\s+))[^\r\n,; \t]+/gi;
const EMAIL_REGEX = /\b([a-zA-Z0-9._%+-]+)@([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})\b/g;
const PHONE_REGEX = /(?:\+\d{1,3}[-.\s]?)?(?:0\d{1,2}|\d{2,3})[-.\s]\d{3,4}[-.\s]\d{4}\b/g;

function maskString(str: string): string {
  return str
    .replace(REDMINE_API_KEY_REGEX, '[REDACTED_API_KEY]')
    .replace(URL_QUERY_SENSITIVE_REGEX, '$1[REDACTED]')
    .replace(HEADER_API_KEY_REGEX, '$1[REDACTED]')
    .replace(HEADER_AUTH_BEARER_REGEX, '$1[REDACTED]')
    .replace(HEADER_AUTH_BASIC_REGEX, '$1[REDACTED]')
    .replace(EMAIL_REGEX, (_match, user, domain) => {
      const firstChar = user.length > 0 ? user[0] : '';
      return `${firstChar}***@${domain}`;
    })
    .replace(PHONE_REGEX, '[PHONE_REDACTED]');
}

export function maskSensitiveData(data: any, seen: WeakSet<object> = new WeakSet()): any {
  if (data === null || data === undefined) {
    return data;
  }

  if (typeof data === 'string') {
    return maskString(data);
  }

  if (typeof data !== 'object') {
    return data;
  }

  if (seen.has(data)) {
    return '[Circular]';
  }
  seen.add(data);

  if (Array.isArray(data)) {
    return data.map((item) => maskSensitiveData(item, seen));
  }

  if (data instanceof Error) {
    const maskedErr: Record<string, any> = {
      name: data.name,
      message: maskString(data.message),
      stack: data.stack ? maskString(data.stack) : undefined,
    };
    for (const key of Object.keys(data)) {
      const lowerKey = key.toLowerCase();
      if (SENSITIVE_KEYS.has(lowerKey)) {
        maskedErr[key] = '[REDACTED]';
      } else {
        maskedErr[key] = maskSensitiveData((data as any)[key], seen);
      }
    }
    return maskedErr;
  }

  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(data)) {
    const lowerKey = key.toLowerCase();
    if (SENSITIVE_KEYS.has(lowerKey)) {
      result[key] = '[REDACTED]';
    } else {
      result[key] = maskSensitiveData(value, seen);
    }
  }
  return result;
}

export class Logger {
  private level: LogLevel = 'info';

  constructor(initialLevel?: LogLevel) {
    if (initialLevel) {
      this.setLevel(initialLevel);
    } else {
      const envLevel = process.env.LOG_LEVEL?.toLowerCase() as LogLevel;
      if (envLevel && envLevel in LOG_LEVEL_PRIORITIES) {
        this.level = envLevel;
      } else {
        this.level = 'info';
      }
    }
  }

  public setLevel(level: LogLevel | string): void {
    const normalized = (level ?? '').toLowerCase() as LogLevel;
    if (normalized in LOG_LEVEL_PRIORITIES) {
      this.level = normalized;
    }
  }

  public getLevel(): LogLevel {
    return this.level;
  }

  public debug(message: string, ...args: any[]): void {
    this.log('debug', message, ...args);
  }

  public info(message: string, ...args: any[]): void {
    this.log('info', message, ...args);
  }

  public warn(message: string, ...args: any[]): void {
    this.log('warn', message, ...args);
  }

  public error(message: string, ...args: any[]): void {
    this.log('error', message, ...args);
  }

  public maskSensitiveData(data: any): any {
    return maskSensitiveData(data);
  }

  private log(level: LogLevel, message: string, ...args: any[]): void {
    if (LOG_LEVEL_PRIORITIES[level] < LOG_LEVEL_PRIORITIES[this.level]) {
      return;
    }

    const timestamp = new Date().toISOString();
    const maskedMsg = maskSensitiveData(message);
    const maskedArgs = args.map((arg) => {
      const masked = maskSensitiveData(arg);
      if (typeof masked === 'object' && masked !== null) {
        try {
          return JSON.stringify(masked);
        } catch {
          return String(masked);
        }
      }
      return String(masked);
    });

    const fullMessage = maskedArgs.length > 0
      ? `[${timestamp}] [${level.toUpperCase()}] ${maskedMsg} ${maskedArgs.join(' ')}\n`
      : `[${timestamp}] [${level.toUpperCase()}] ${maskedMsg}\n`;

    // Always output exclusively to stderr to maintain stdio channel integrity for MCP JSON-RPC
    process.stderr.write(fullMessage);
  }
}

export const logger = new Logger();
