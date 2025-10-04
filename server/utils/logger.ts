import { createLogger, format, transports } from 'winston';
import { Logger as WinstonLogger } from 'winston';
import { env, isDevelopment, isProduction } from '@shared/config';
import { storage } from '../storage';

const { combine, timestamp, errors, json, colorize, simple, printf } = format;

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
  [key: string]: any;
}

export class Logger {
  private service: string;
  private context: LogContext;

  constructor(service: string = 'api', context: LogContext = {}) {
    this.service = service;
    this.context = context;
  }

  // Create child logger with additional context
  child(context: LogContext): Logger {
    return new Logger(this.service, { ...this.context, ...context });
  }

  private async logToDatabase(level: string, message: string, metadata: any = {}) {
    try {
      await storage.createSystemLog(level, message, this.service, {
        ...this.context,
        ...metadata
      });
    } catch (error) {
      console.error('Failed to log to database:', error);
    }
  }

  private log(level: string, message: string, meta: any = {}) {
    const logData = {
      service: this.service,
      ...this.context,
      ...meta
    };

    winstonLogger.log(level, message, logData);

    // Also log to database for important messages
    if (['error', 'warn', 'info'].includes(level)) {
      this.logToDatabase(level, message, logData).catch(console.error);
    }
  }

  error(message: string, error?: Error | any, meta: any = {}) {
    const errorMeta = error instanceof Error ? {
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack,
      }
    } : { errorData: error };

    this.log('error', message, { ...errorMeta, ...meta });
  }

  warn(message: string, meta: any = {}) {
    this.log('warn', message, meta);
  }

  info(message: string, meta: any = {}) {
    this.log('info', message, meta);
  }

  debug(message: string, meta: any = {}) {
    this.log('debug', message, meta);
  }

  // Audit logging methods
  async auditLog(action: string, resource: string, details: any = {}) {
    const message = `Audit: ${action} on ${resource}`;
    this.info(message, { audit: true, action, resource, details });
  }

  // Performance logging
  async performanceLog(operation: string, duration: number, meta: any = {}) {
    const message = `Performance: ${operation} took ${duration}ms`;
    this.info(message, { performance: true, operation, duration, ...meta });
  }

  // Security logging
  async securityLog(event: string, severity: 'low' | 'medium' | 'high' | 'critical', details: any = {}) {
    const message = `Security: ${event}`;
    this.error(message, null, { security: true, severity, event, details });
  }
}

// Export default logger instance
export const logger = new Logger();

// Static accessor for legacy usage: Logger.getLogger()
// Returns the module-level logger instance
export namespace Logger {
  export function getLogger(): Logger {
    return logger;
  }
}

// Express middleware for request logging
export const requestLogger = (req: any, res: any, next: any) => {
  const start = Date.now();
  const requestId = req.headers['x-request-id'] || Math.random().toString(36).substring(7);

  // Add request ID to headers
  req.requestId = requestId;
  res.setHeader('X-Request-ID', requestId);

  const requestLogger = logger.child({
    requestId,
    method: req.method,
    url: req.url,
    ipAddress: req.ip,
    userAgent: req.get('User-Agent'),
    userId: req.user?.claims?.sub,
  });

  req.logger = requestLogger;

  // Log request
  if (env.ENABLE_REQUEST_LOGGING === 'true') {
    requestLogger.info('Request started', {
      method: req.method,
      url: req.url,
      query: req.query,
      body: req.method !== 'GET' ? req.body : undefined,
    });
  }

  // Log response
  const originalSend = res.send;
  res.send = function(body: any) {
    const duration = Date.now() - start;

    requestLogger.info('Request completed', {
      statusCode: res.statusCode,
      duration,
      responseSize: JSON.stringify(body).length,
    });

    return originalSend.call(this, body);
  };

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