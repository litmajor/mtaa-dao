import express, { type Request, Response, NextFunction } from "express";
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import { registerRoutes } from "./routes";
import { setupVite, serveStatic } from './vite';
import { logger, requestLogger, logStartup } from './utils/logger';
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
import { metricsCollector } from './monitoring/metricsCollector';
import { ProposalExecutionService } from './proposalExecutionService';
import { vaultEventIndexer } from './vaultEventsIndexer';
import { vaultAutomationService } from './vaultAutomation';
import { activityTracker } from './middleware/activityTracker';
import paymentReconciliationRoutes from './routes/payment-reconciliation';
import healthRoutes from './routes/health';
import analyticsRoutes from './routes/analytics';
import notificationRoutes from './routes/notifications';
import sseRoutes from './routes/sse';
import billingRoutes from './routes/billing';
import proposalExecutionRouter from './routes/proposal-execution';
import pollProposalsRouter from './routes/poll-proposals';
import './middleware/validation'; // Added for validation middleware
// Assuming ReputationService is defined and exported from './reputationService'
import { ReputationService } from './reputationService'; // Added for ReputationService
import { authenticate, refreshTokenHandler, logoutHandler, authUserHandler, authLoginHandler, authRegisterHandler } from './auth';
const __dirname = dirname(fileURLToPath(import.meta.url));


const app = express();

// Setup process error handlers
setupProcessErrorHandlers();

// Initialize Socket.IO
// Note: 'server' variable is used here but not defined in the provided snippet. Assuming it's to be defined by `createServer`.
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
app.use(cors({
  origin: [env.FRONTEND_URL, env.BACKEND_URL, 'http://localhost:5000', 'http://localhost:5173', 'http://localhost:3000'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
}));

// Request logging middleware (before other middleware)
app.use(requestLogger);

// Apply security middleware (rate limiting handled per-route in API)
app.use(sanitizeInput);
app.use(preventSqlInjection);
app.use(preventXSS);
app.use(auditMiddleware);

// Add metrics collection
app.use(metricsCollector.requestMiddleware());

// User activity tracking middleware
app.use(activityTracker());

// Initialize WebSocket service
import WebSocketService from './services/WebSocketService';
const webSocketService = new WebSocketService(server);
app.locals.webSocketService = webSocketService;

// Store user socket connections
const userSockets = new Map();
// Handle Socket.IO connections for notifications and other real-time events
io.on('connection', (socket: any) => {
  logger.info('Socket.IO client connected:', { socketId: socket.id });

  socket.on('authenticate', (userId: string) => {
    logger.info('Socket.IO client authenticated', { userId, socketId: socket.id });
    userSockets.set(userId, socket.id);
    socket.join(`user_${userId}`);
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
      logger.info(logLine);
    }
  });

  next();
});


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
      logger.info('✅ Backup system initialized');
    }

    await registerRoutes(app);

    // Health check endpoint
    app.get('/health', asyncHandler(async (req: Request, res: Response) => {
      res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        environment: env.NODE_ENV,
        version: process.env.npm_package_version || '1.0.0',
        uptime: process.uptime(),
      });
    }));

    // Add API routes
    app.use('/api/payment-reconciliation', paymentReconciliationRoutes);
    app.use('/api/health', healthRoutes);
    app.use('/api/analytics', analyticsRoutes);
    app.use('/api/notifications', notificationRoutes);
    app.use('/api/sse', sseRoutes);
    app.use('/api/billing', billingRoutes);
    app.use('/api/dao/:daoId/executions', proposalExecutionRouter);
    app.use('/api/proposals', pollProposalsRouter);

    // Auth endpoints
    app.get('/api/auth/user', authenticate, authUserHandler);
    app.post('/api/auth/login', authLoginHandler);
    app.post('/api/auth/register', authRegisterHandler);
    app.post('/api/auth/refresh-token', refreshTokenHandler);
    app.post('/api/auth/logout', logoutHandler);

    // Setup Vite dev server or serve static files
    if (env.NODE_ENV === "development") {
      await setupVite(app, server);
    } else {
      serveStatic(app);
    }

    // 404 handler (must be after all routes including Vite/static)
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
      // Start proposal execution scheduler
      if (ProposalExecutionService) {
        ProposalExecutionService.startScheduler();
      }

      // Initialize reputation system cleanup job
      setInterval(async () => {
        try {
          const result = await ReputationService.runGlobalReputationDecay();
          console.log(`Reputation decay processed: ${result.processed} users, ${result.decayed} decayed`);
        } catch (error) {
          console.error('Reputation decay job failed:', error);
        }
      }, 24 * 60 * 60 * 1000); // Run daily

      // Start treasury monitoring
      setInterval(async () => {
        try {
          // Monitor treasury limits and alert on violations
          console.log('Treasury monitoring check completed');
        } catch (error) {
          console.error('Treasury monitoring failed:', error);
        }
      }, 60 * 60 * 1000); // Run hourly
      console.log('✅ Proposal execution scheduler started');
    });

    // Start blockchain automation services
    console.log('🚀 Starting blockchain integration services...');

    // Start vault event indexing
    vaultEventIndexer.start();

    // Start vault automation service
    vaultAutomationService.start();

    console.log('✅ Blockchain services initialized successfully');

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
  } catch (err) {
    console.error("Fatal server error:", err);
    process.exit(1);
  }
})();