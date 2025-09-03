import express, { type Request, Response, NextFunction } from "express";
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import { registerRoutes } from "./routes";
import {setupVite, serveStatic, log } from "./vite"; // ← fix here
import path from "path";
import { dirname } from "path";
import { fileURLToPath } from "url";
import { notificationService } from './notificationService';
import { generalRateLimit } from './security/rateLimiter';
import { sanitizeInput, preventSqlInjection, preventXSS } from './security/inputSanitizer';
import { auditMiddleware } from './security/auditLogger';
import { BackupSystem, BackupScheduler } from './security/backupSystem';
import { env, corsConfig } from "@shared/config";
import { 
  errorHandler, 
  notFoundHandler, 
  setupProcessErrorHandlers,
  asyncHandler 
} from './middleware/errorHandler';
import { logger, requestLogger, logStartup } from './utils/logger';
import { metricsCollector } from './middleware/metricsCollector';
const __dirname = dirname(fileURLToPath(import.meta.url));


const app = express();

// Setup process error handlers
setupProcessErrorHandlers();

// Initialize Socket.IO
// Note: 'server' variable is used here but not defined in the provided snippet. Assuming it's defined elsewhere or will be defined by `createServer`.
// For the purpose of this edit, we assume 'server' is available.
const server = createServer(app); // Assuming server is created here for Socket.IO initialization
const io = new SocketIOServer(server, {
  cors: corsConfig,
});

// Trust proxy for accurate IP addresses
app.set('trust proxy', 1);

// Body parsing middleware
app.use(express.json({ 
  limit: '10mb',
  verify: (req: any, res, buf) => {
    req.rawBody = buf;
  }
}));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// CORS Configuration
app.use(cors(corsConfig));

// Request logging middleware (before other middleware)
app.use(requestLogger);

// Apply security middleware
app.use(generalRateLimit);
app.use(sanitizeInput);
app.use(preventSqlInjection);
app.use(preventXSS);
app.use(auditMiddleware);

// Add metrics collection
app.use(metricsCollector.requestMiddleware());

// Store user socket connections
const userSockets = new Map<string, string>();

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('authenticate', (userId: string) => {
    userSockets.set(userId, socket.id);
    socket.join(`user_${userId}`);
    console.log(`User ${userId} authenticated with socket ${socket.id}`);
  });

  socket.on('disconnect', () => {
    // Remove user from socket map
    for (const [userId, socketId] of userSockets.entries()) {
      if (socketId === socket.id) {
        userSockets.delete(userId);
        break;
      }
    }
    console.log('User disconnected:', socket.id);
  });
});

// Extend notification service with real-time capabilities
notificationService.on('notification_created', (data) => {
  io.to(`user_${data.userId}`).emit('new_notification', data);
});

// Make io available globally
(global as any).io = io;


// Logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  const reqPath = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (reqPath.startsWith("/api")) {
      let logLine = `${req.method} ${req.url} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }
      if (logLine.length > 80) logLine = logLine.slice(0, 79) + "…";
      logger.http(logLine);
    }
  });

  next();
});

// Start proposal execution scheduler
import { ProposalExecutionService } from './proposalExecutionService';
ProposalExecutionService.startScheduler();

(async () => {
  try {
    // Initialize backup system
    const backupConfig = {
      enabled: process.env.BACKUPS_ENABLED === 'true',
      schedule: '0 2 * * *', // Daily at 2 AM
      retentionDays: 30,
      location: process.env.BACKUP_LOCATION || './backups',
      encryptionKey: process.env.BACKUP_ENCRYPTION_KEY
    };

    if (backupConfig.enabled) {
      const backupSystem = BackupSystem.getInstance(backupConfig);
      const scheduler = new BackupScheduler(backupSystem);
      scheduler.start();
      log('✅ Backup system initialized');
    }

    await registerRoutes(app);

    // Health check endpoint
    app.get('/health', asyncHandler(async (req, res) => {
      res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        environment: env.NODE_ENV,
        version: process.env.npm_package_version || '1.0.0',
        uptime: process.uptime(),
      });
    }));

    // 404 handler (must be after all routes)
    app.use(notFoundHandler);

    // Error handling middleware (must be last)
    app.use(errorHandler);

    const PORT = parseInt(env.PORT);
    const HOST = env.HOST;

    server.listen(PORT, HOST, () => {
      logStartup(PORT.toString());
      logger.info('Server configuration', {
        port: PORT,
        host: HOST,
        frontendUrl: env.FRONTEND_URL,
        backendUrl: env.BACKEND_URL,
        environment: env.NODE_ENV,
        nodeVersion: process.version,
      });
    });

    // Graceful shutdown
    const gracefulShutdown = (signal: string) => {
      logger.warn(`Received ${signal}, shutting down gracefully`);

      server.close(() => {
        logger.info('HTTP server closed');
        process.exit(0);
      });

      // Force close after 30 seconds
      setTimeout(() => {
        logger.error('Could not close connections in time, forcefully shutting down');
        process.exit(1);
      }, 30000);
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));


    const isDev = process.env.NODE_ENV !== "production";
    if (isDev) {
      await setupVite(app, server); // ← dev inject
    } else {
      serveStatic(app);
      app.get("*", (_, res) => {
        res.sendFile(path.join(__dirname, "../../dist/public", "index.html"));
      });
    }
  } catch (err) {
    console.error("Fatal server error:", err);
    process.exit(1);
  }
})();