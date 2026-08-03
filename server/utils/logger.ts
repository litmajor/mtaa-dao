import { createLogger, format, transports } from 'winston';
import { Logger as WinstonLogger } from 'winston';
import { env, isDevelopment, isProduction } from '../../shared/config.ts';
import fs from 'fs';
import path from 'path';
import type { Request, Response, NextFunction } from 'express';

const { combine, timestamp, errors, json, colorize, simple, printf } = format;

const REDACTED_VALUE = '[REDACTED_FOR_SECURITY]';
const SENSITIVE_KEY_PATTERN = /(password|passwd|pwd|secret|token|api[_-]?key|authorization|cookie|session|mnemonic|apikey|pin|ip[_-]?address|access[_-]?token|refresh[_-]?token|private[_-]?key|client_secret|jwt)/i;

function redactSensitiveData<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => redactSensitiveData(item)) as T;
  }

  if (value && typeof value === 'object') {
    if (value instanceof Error) {
      return value;
    }

    const redacted: Record<string, unknown> = {};
    for (const [key, nestedValue] of Object.entries(value as Record<string, unknown>)) {
      if (SENSITIVE_KEY_PATTERN.test(key)) {
        redacted[key] = REDACTED_VALUE;
      } else {
        redacted[key] = redactSensitiveData(nestedValue);
      }
    }
    return redacted as T;
  }

  return value;
}

// Custom log format for development
const devFormat = printf((info) => {
  const { level, message, timestamp, service, ...meta } = info;
  const metaStr = Object.keys(meta).length > 0 ? `\n${JSON.stringify(meta, null, 2)}` : '';
  return `${timestamp} [${service}] ${level}: ${message}${metaStr}`;
});

// Create Winston logger
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
      silent: env.NODE_ENV === 'test'
    })
  ],
});

// Add file transports in production
if (isProduction) {
  winstonLogger.add(
    new transports.File({
      filename: 'logs/error.log',
      level: 'error',
      maxsize: 10485760, // 10MB
      maxFiles: 5,
    })
  );

  winstonLogger.add(
    new transports.File({
      filename: 'logs/combined.log',
      maxsize: 10485760, // 10MB
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

export class Logger {
  private service: string;
  private context: LogContext;

  // In-memory DB log rate limiting and circuit breaker
  private static DB_LOG_RATE_LIMIT = 20; // max DB log writes per minute
  private static dbLogWindowStart = Date.now();
  private static dbLogCount = 0;
  private static dbLoggingDisabledUntil = 0; // timestamp ms until which DB logging is disabled

  constructor(service: string = 'api', context: LogContext = {}) {
    this.service = service;
    this.context = context;
  }

  static getLogger(): Logger {
    return logger;
  }

  // Create child logger with additional context
  child(context: LogContext): Logger {
    return new Logger(this.service, { ...this.context, ...context });
  }

  private logToDatabase(level: string, message: string, metadata: Record<string, unknown> = {}): Promise<void> {
    const sanitizedMetadata = redactSensitiveData(metadata);

    // During startup, skip INFO logs to DB to avoid pool saturation
    // Console output is still visible - this only skips database writes
    const isStartup = (globalThis as typeof globalThis & { isServerStarting?: boolean }).isServerStarting === true;
    if (isStartup && level === 'info') {
      return Promise.resolve(); // Return resolved Promise, skip DB write
    }

    return (async () => {
      // Circuit breaker: if DB logging disabled, skip immediately
      if (Date.now() < Logger.dbLoggingDisabledUntil) {
        return Promise.resolve();
      }

      // Simple rate limiter: allow up to DB_LOG_RATE_LIMIT writes per minute
      const now = Date.now();
      if (now - Logger.dbLogWindowStart > 60_000) {
        Logger.dbLogWindowStart = now;
        Logger.dbLogCount = 0;
      }
      if (Logger.dbLogCount >= Logger.DB_LOG_RATE_LIMIT) {
        // Open circuit for 60s to protect the DB
        Logger.dbLoggingDisabledUntil = now + 60_000;
        console.warn('[DBLog] Rate limit exceeded — temporarily disabling DB logging for 60s');
        return Promise.resolve();
      }
      Logger.dbLogCount++;
      try {
        const storageModule = await import('../storage.ts');
        const storage = storageModule.storage;

        // If storage is not ready yet, skip DB logging
        if (!storage || typeof storage.createSystemLog !== 'function') {
          return Promise.resolve();
        }

        try {
          await storage.createSystemLog(level, message, this.service, {
            ...this.context,
            ...sanitizedMetadata
          });
        } catch (error: unknown) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          // If DB indicates saturation or connectivity issues, open circuit
          const critical = /timeout|too many clients|connection terminated|ECONNREFUSED|pool.*exhausted/i;
          if (critical.test(errorMsg)) {
            Logger.dbLoggingDisabledUntil = Date.now() + 60_000; // disable for 60s
            console.error('[DBLog] Database logging failing — disabling DB logging for 60s');

            try {
              const fallbackDir = path.join(process.cwd(), 'logs');
              if (!fs.existsSync(fallbackDir)) fs.mkdirSync(fallbackDir, { recursive: true });
              const fallbackPath = path.join(fallbackDir, 'db-fallback.log');
              const payload = { timestamp: new Date().toISOString(), level, service: this.service, message, metadata: sanitizedMetadata, error: errorMsg };
              fs.appendFileSync(fallbackPath, JSON.stringify(payload) + '\n');
            } catch (fsErr) {
              // If fallback write fails, write to console only
              console.error('[DBLog] Failed to write fallback log:', fsErr instanceof Error ? fsErr.message : fsErr);
            }
          }
        }
        return;
      } catch (err) {
        // If storage call fails, silently return resolved promise
        return Promise.resolve();
      }
    })();
  }

  private log(level: string, message: string, meta: Record<string, unknown> = {}) {
    const logData = redactSensitiveData({
      service: this.service,
      ...this.context,
      ...meta
    });

    // Always log to console (user sees all boot messages)
    winstonLogger.log(level, message, logData);

    // Also log to database for important messages, but skip INFO during startup
    if (['error', 'warn', 'info'].includes(level)) {
      this.logToDatabase(level, message, logData).catch(() => {
        // Silently ignore DB logging errors
      });
    }
  }

  error(message: string, error?: Error | unknown, meta: Record<string, unknown> = {}) {
    const errorMeta = error instanceof Error ? {
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack,
      }
    } : { errorData: String(error) };

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

  // Audit logging methods
  async auditLog(action: string, resource: string, details: Record<string, unknown> = {}) {
    const message = `Audit: ${action} on ${resource}`;
    this.info(message, { audit: true, action, resource, details });
  }

  // Performance logging
  async performanceLog(operation: string, duration: number, meta: Record<string, unknown> = {}) {
    const message = `Performance: ${operation} took ${duration}ms`;
    this.info(message, { performance: true, operation, duration, ...meta });
  }

  // Security logging
  async securityLog(event: string, severity: 'low' | 'medium' | 'high' | 'critical', details: Record<string, unknown> = {}) {
    const message = `Security: ${event}`;
    this.error(message, null as unknown as Error, { security: true, severity, event, details });
  }
}

type RequestWithLogger = Request & { requestId?: string | string[]; logger?: Logger };

// Export default logger instance
export const logger = new Logger();

// Express middleware for request logging
export const requestLogger = (req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  const rawRequestId = req.headers['x-request-id'];
  const requestId: string = Array.isArray(rawRequestId) ? (rawRequestId[0] ?? Math.random().toString(36).substring(7)) : (rawRequestId ?? Math.random().toString(36).substring(7));

  // Add request ID to headers
  (req as RequestWithLogger).requestId = requestId;
  res.setHeader('X-Request-ID', String(requestId));

  const requestLogger = logger.child({
    requestId: String(requestId),
    method: req.method,
    url: req.url,
    ipAddress: req.ip,
    userAgent: req.get('User-Agent') || '',
    userId: (req as Request & { user?: { claims?: Record<string, unknown> } }).user?.claims?.sub,
  });

  // Attach logger to req for route handlers
  (req as RequestWithLogger).logger = requestLogger;

  // Log request
  if (env.ENABLE_REQUEST_LOGGING === 'true') {
    requestLogger.info('Request started', {
      method: req.method,
      url: req.url,
      query: req.query,
      body: req.method !== 'GET' ? (req as Request).body : undefined,
    });
  }

  // Log response
  const originalSend = res.send;
  res.send = function(this: Response, body: unknown) {
    const duration = Date.now() - start;
    let responseSize = 0;
    try {
      responseSize = typeof body === 'string' ? body.length : JSON.stringify(body).length;
    } catch (_err) {
      responseSize = 0;
    }

    requestLogger.info('Request completed', {
      statusCode: res.statusCode,
      duration,
      responseSize,
    });
    return (originalSend as (this: Response, body?: unknown) => unknown).call(this, body);
  } as typeof res.send;

  next();
};

// Startup logger
export const logStartup = (port: string) => {
  logger.info('🚀 Server starting up', {
    port,
    environment: env.NODE_ENV,
    timestamp: new Date().toISOString(),
  });
};

// Shutdown logger
export const logShutdown = (reason: string) => {
  logger.warn('🛑 Server shutting down', { reason });
};