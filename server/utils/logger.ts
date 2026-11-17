import { createLogger, format, transports, type Logger as WinstonLogger } from 'winston';
import { env, isDevelopment, isProduction } from '../../shared/config.ts';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import type { Request, Response, NextFunction } from 'express';

const { combine, timestamp, errors, json, colorize, printf } = format;

const REDACTED_VALUE = '[REDACTED_FOR_SECURITY]';
const SENSITIVE_KEY_PATTERN = /(password|passwd|pwd|secret|token|api[_-]?key|authorization|cookie|session|mnemonic|apikey|pin|ip[_-]?address|access[_-]?token|refresh[_-]?token|private[_-]?key|client_secret|jwt)/i;

function redactSensitiveData<T>(value: T, seen = new WeakSet<object>()): T {
  if (value === null || typeof value !== 'object') {
    return value;
  }

  // Prevent RangeError stack overflow on circular references
  if (seen.has(value)) {
    return '[Circular]' as T;
  }
  seen.add(value);

  if (Array.isArray(value)) {
    return value.map((item) => redactSensitiveData(item, seen)) as T;
  }

  if (value instanceof Error) {
    const sanitizedError: Record<string, unknown> = {
      name: value.name,
      message: value.message,
      stack: value.stack,
    };
    for (const [key, nestedValue] of Object.entries(value)) {
      sanitizedError[key] = SENSITIVE_KEY_PATTERN.test(key)
        ? REDACTED_VALUE
        : redactSensitiveData(nestedValue, seen);
    }
    return sanitizedError as T;
  }

  const redacted: Record<string, unknown> = {};
  for (const [key, nestedValue] of Object.entries(value as Record<string, unknown>)) {
    if (SENSITIVE_KEY_PATTERN.test(key)) {
      redacted[key] = REDACTED_VALUE;
    } else {
      redacted[key] = redactSensitiveData(nestedValue, seen);
    }
  }
  return redacted as T;
}

const devFormat = printf((info) => {
  const { level, message, timestamp, service, ...meta } = info;
  const metaStr = Object.keys(meta).length > 0 ? `\n${JSON.stringify(meta, null, 2)}` : '';
  return `${timestamp} [${service}] ${level}: ${message}${metaStr}`;
});

const winstonLogger: WinstonLogger = createLogger({
  level: env.LOG_LEVEL || 'info',
  format: combine(
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    errors({ stack: true }),
    isDevelopment ? combine(colorize(), devFormat) : json()
  ),
  defaultMeta: { service: 'mtaa-dao-api' },
  transports: [
    new transports.Console({
      silent: env.NODE_ENV === 'test',
    }),
  ],
});

if (isProduction) {
  fs.mkdirSync(path.join(process.cwd(), 'logs'), { recursive: true });

  winstonLogger.add(
    new transports.File({
      filename: 'logs/error.log',
      level: 'error',
      maxsize: 10485760,
      maxFiles: 5,
    })
  );

  winstonLogger.add(
    new transports.File({
      filename: 'logs/combined.log',
      maxsize: 10485760,
      maxFiles: 10,
    })
  );
}

export interface LogContext {
  userId?: string;
  sessionId?: string;
  requestId?: string;
  ipAddress?: string;
  userAgent?: string;
  action?: string;
  resource?: string;
  resourceId?: string;
  duration?: number;
  statusCode?: number;
  [key: string]: unknown;
}

export type DbLogSink = (
  level: string,
  message: string,
  service: string,
  meta: Record<string, unknown>
) => Promise<void>;

let customDbLogSink: DbLogSink | null = null;

/** Optional: register a DB log sink at startup to decouple logger from storage.ts */
export function registerDbLogSink(sink: DbLogSink): void {
  customDbLogSink = sink;
}

export class Logger {
  private service: string;
  private context: LogContext;

  private static DB_LOG_RATE_LIMIT = 20;
  private static dbLogWindowStart = Date.now();
  private static dbLogCount = 0;
  private static dbLoggingDisabledUntil = 0;
  private static fallbackDirEnsured = false;

  constructor(service: string = 'api', context: LogContext = {}) {
    this.service = service;
    this.context = context;
  }

  static getLogger(): Logger {
    return logger;
  }

  child(context: LogContext): Logger {
    return new Logger(this.service, { ...this.context, ...context });
  }

  private async logToDatabase(
    level: string,
    message: string,
    alreadySanitizedMeta: Record<string, unknown>
  ): Promise<void> {
    const isStartup = (globalThis as typeof globalThis & { isServerStarting?: boolean }).isServerStarting === true;
    if (isStartup || Date.now() < Logger.dbLoggingDisabledUntil) {
      return;
    }

    const now = Date.now();
    if (now - Logger.dbLogWindowStart > 60_000) {
      Logger.dbLogWindowStart = now;
      Logger.dbLogCount = 0;
    }

    if (Logger.dbLogCount >= Logger.DB_LOG_RATE_LIMIT) {
      Logger.dbLoggingDisabledUntil = now + 60_000;
      console.warn('[DBLog] Rate limit exceeded — temporarily disabling DB logging for 60s');
      return;
    }

    Logger.dbLogCount++;

    try {
      if (customDbLogSink) {
        await customDbLogSink(level, message, this.service, alreadySanitizedMeta);
        return;
      }

      // Backwards-compatible fallback if registerDbLogSink wasn't called
      const { storage } = await import('../storage.ts');
      if (!storage || typeof storage.createSystemLog !== 'function') {
        return;
      }

      await storage.createSystemLog(level, message, this.service, alreadySanitizedMeta);
    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      const critical = /timeout|too many clients|connection terminated|ECONNREFUSED|pool.*exhausted/i;

      if (critical.test(errorMsg)) {
        Logger.dbLoggingDisabledUntil = Date.now() + 60_000;
        console.error('[DBLog] Database logging failing — disabling DB logging for 60s');

        try {
          const fallbackDir = path.join(process.cwd(), 'logs');
          if (!Logger.fallbackDirEnsured) {
            await fs.promises.mkdir(fallbackDir, { recursive: true });
            Logger.fallbackDirEnsured = true;
          }
          const fallbackPath = path.join(fallbackDir, 'db-fallback.log');
          const payload = {
            timestamp: new Date().toISOString(),
            level,
            service: this.service,
            message,
            metadata: alreadySanitizedMeta,
            error: errorMsg,
          };
          await fs.promises.appendFile(fallbackPath, JSON.stringify(payload) + '\n');
        } catch (fsErr) {
          console.error('[DBLog] Failed to write fallback log:', fsErr instanceof Error ? fsErr.message : fsErr);
        }
      }
    }
  }

  private log(level: string, message: string, meta: Record<string, unknown> = {}) {
    // Redact once and reuse for both Winston and DB sink
    const logData = redactSensitiveData({
      service: this.service,
      ...this.context,
      ...meta,
    });

    winstonLogger.log(level, message, logData);

    if (['error', 'warn', 'info'].includes(level)) {
      this.logToDatabase(level, message, logData).catch(() => {});
    }
  }

  error(message: string, error?: Error | unknown, meta: Record<string, unknown> = {}) {
    let errorMeta: Record<string, unknown> = {};
    if (error instanceof Error) {
      errorMeta = { error }; // redactSensitiveData handles Error instances safely
    } else if (error !== undefined && error !== null) {
      errorMeta = { errorData: String(error) };
    }

    this.log('error', message, { ...errorMeta, ...meta });
  }

  warn(message: string, meta: Record<string, unknown> = {}) {
    this.log('warn', message, meta);
  }

  info(message: string, meta: Record<string, unknown> = {}) {
    this.log('info', message, meta);
  }

  debug(message: string, meta: Record<string, unknown> = {}) {
    this.log('debug', message, meta);
  }

  async auditLog(action: string, resource: string, details: Record<string, unknown> = {}) {
    this.info(`Audit: ${action} on ${resource}`, { audit: true, action, resource, details });
  }

  async performanceLog(operation: string, duration: number, meta: Record<string, unknown> = {}) {
    this.info(`Performance: ${operation} took ${duration}ms`, { performance: true, operation, duration, ...meta });
  }

  async securityLog(event: string, severity: 'low' | 'medium' | 'high' | 'critical', details: Record<string, unknown> = {}) {
    this.error(`Security: ${event}`, undefined, { security: true, severity, event, details });
  }
}

type RequestWithLogger = Request & { requestId?: string | string[]; logger?: Logger };

export const logger = new Logger();

export const requestLogger = (req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  const rawRequestId = req.headers['x-request-id'];
  const requestId: string = Array.isArray(rawRequestId)
    ? (rawRequestId[0] ?? crypto.randomUUID())
    : (rawRequestId ?? crypto.randomUUID());

  (req as RequestWithLogger).requestId = requestId;
  res.setHeader('X-Request-ID', requestId);

  const reqLogger = logger.child({
    requestId,
    method: req.method,
    url: req.url,
    ipAddress: req.ip,
    userAgent: req.get('User-Agent') || '',
    userId: (req as Request & { user?: { claims?: Record<string, unknown> } }).user?.claims?.sub,
  });

  (req as RequestWithLogger).logger = reqLogger;

  if (env.ENABLE_REQUEST_LOGGING === 'true') {
    reqLogger.info('Request started', {
      method: req.method,
      url: req.url,
      query: req.query,
      body: req.method !== 'GET' ? req.body : undefined,
    });
  }

  let logged = false;
  const originalSend = res.send;
  res.send = function (this: Response, body: unknown) {
    if (!logged) {
      logged = true;
      const duration = Date.now() - start;
      let responseSize = 0;
      try {
        responseSize = typeof body === 'string'
          ? Buffer.byteLength(body)
          : Buffer.isBuffer(body)
            ? body.length
            : JSON.stringify(body)?.length ?? 0;
      } catch {
        responseSize = 0;
      }

      reqLogger.info('Request completed', {
        statusCode: res.statusCode,
        duration,
        responseSize,
      });
    }
    return (originalSend as (this: Response, body?: unknown) => unknown).call(this, body);
  } as typeof res.send;

  next();
};

export const logStartup = (port: string) => {
  logger.info('🚀 Server starting up', {
    port,
    environment: env.NODE_ENV,
    timestamp: new Date().toISOString(),
  });
};

export const logShutdown = (reason: string) => {
  logger.warn('🛑 Server shutting down', { reason });
};