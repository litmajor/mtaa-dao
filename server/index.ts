import express from "express";
import type { Request, Response, NextFunction } from "express";
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { registerRoutes } from "./routes";
import { setupWeeklyRewardsDistribution } from "./jobs/weeklyRewardsDistribution";
import { setupInvestmentPoolsAutomation } from "./jobs/investmentPoolsAutomation";
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
import { env, corsConfig } from "../shared/config.js";
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
import { bridgeRelayerService } from './services/bridgeRelayerService';
import { performanceMonitor } from './middleware/performance';
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
import reputationRoutes from './routes/reputation'; // Added for reputation routes
import kotaniPayStatusRoutes from './routes/kotanipay-status';
import mpesaStatusRoutes from './routes/mpesa-status';
import stripeStatusRoutes from './routes/stripe-status';
import referralsRoutes from './routes/referrals';
import eventsRoutes from './routes/events';
import crossChainRoutes from './routes/cross-chain';
import jwt from 'jsonwebtoken';
// Import NFT Marketplace routes
import nftMarketplaceRouter from './routes/nft-marketplace';
import walletRouter from './routes/wallet';
import walletSetupRouter from './routes/wallet-setup';
import paymentGatewayRouter from './routes/payment-gateway';
// Import KYC routes
import kycRouter from './routes/kyc';
import referralRewardsRouter from './routes/referral-rewards';
import economyRouter from './routes/economy';
import morioRoutes from './routes/morio';
import { transactionMonitor } from './services/transactionMonitor';
import { recurringPaymentService } from './services/recurringPaymentService';
import { gasPriceOracle } from './services/gasPriceOracle';
// Import example function for wallet demonstration
import { enhancedExample } from './example-wallet';
const __dirname = dirname(fileURLToPath(import.meta.url));


const app = express();

// Setup process error handlers
setupProcessErrorHandlers();

// Initialize Socket.IO
// Note: 'server' variable is used here but not defined in the provided snippet. Assuming it's to be defined by `createServer`.
const server = createServer(app); // Assuming server is created here for Socket.IO initialization
const io = new SocketIOServer(server, {
  cors: corsConfig,
  // Allow token authentication via query or handshake
  allowEIO3: true,
});

// Trust proxy for accurate IP addresses
app.set('trust proxy', 1);

// Response compression (gzip/deflate) - must be early in middleware chain, but after security
// Note: Will be applied after helmet and security middleware
const compressionMiddleware = compression({
  level: 6, // Compression level (0-9)
  threshold: 1024, // Only compress responses > 1KB
  filter: (req: Request, res: Response) => {
    const contentType = res.getHeader('Content-Type') as string || '';
    // Don't compress already-compressed formats
    if (contentType.includes('image/') || 
        contentType.includes('video/') ||
        contentType.includes('application/zip') ||
        contentType.includes('application/pdf')) {
      return false;
    }
    // Use default compression filter for text-based responses
    return compression.filter(req, res);
  }
});

// Body parsing middleware
app.use(express.json({
  limit: '10mb',
  verify: (req: any, res, buf) => {
    req.rawBody = buf;
  }
}));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// CORS Configuration - Allow all origins
app.use(cors({
  origin: true, // Allow all origins
  credentials: true
}));

// Request logging middleware (before other middleware)
app.use(requestLogger);

// Apply security middleware (rate limiting handled per-route in API)
app.use(sanitizeInput);
app.use(preventSqlInjection);
app.use(preventXSS);
app.use(auditMiddleware);

// Apply compression AFTER security middleware
app.use(compressionMiddleware);

// Performance monitoring - must be early to track all requests
app.use(performanceMonitor(1000)); // Log requests > 1000ms

// Add metrics collection
app.use(metricsCollector.requestMiddleware());

// User activity tracking middleware
app.use(activityTracker());

// Initialize WebSocket service
import { WebSocketService } from './services/WebSocketService';
const webSocketService = new WebSocketService(server);
app.locals.webSocketService = webSocketService;

// Store user socket connections
const userSockets = new Map();

// Socket.IO authentication middleware
io.use(async (socket: any, next) => {
  try {
    // Get token from handshake query or auth
    const token = socket.handshake.query.token || socket.handshake.auth?.token;

    if (!token) {
      // Allow connection but mark as unauthenticated
      socket.userId = null;
      return next();
    }

    // Verify JWT token
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key') as any;

    socket.userId = decoded.userId || decoded.id;
    logger.info('Socket.IO client authenticated via token', { userId: socket.userId, socketId: socket.id });
    next();
  } catch (error) {
    logger.warn('Socket.IO auth failed, allowing unauthenticated connection', { error: (error as Error).message });
    socket.userId = null;
    next(); // Allow connection even if auth fails
  }
});

// Handle Socket.IO connections for notifications and other real-time events
io.on('connection', (socket: any) => {
  logger.info('Socket.IO client connected:', { socketId: socket.id, userId: socket.userId || 'anonymous' });

  // If authenticated via middleware, join user room automatically
  if (socket.userId) {
    userSockets.set(socket.userId, socket.id);
    socket.join(`user_${socket.userId}`);
  }

  // Legacy authenticate event for backwards compatibility
  socket.on('authenticate', (userId: string) => {
    logger.info('Socket.IO client authenticated via event', { userId, socketId: socket.id });
    socket.userId = userId;
    userSockets.set(userId, socket.id);
    socket.join(`user_${userId}`);
  });

  socket.on('disconnect', () => {
    // Remove user from socket map
    if (socket.userId) {
      userSockets.delete(socket.userId);
    }
    logger.info('Socket.IO user disconnected:', { socketId: socket.id, userId: socket.userId || 'anonymous' });
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
    // Initialize Redis connection
    const { redis } = await import('./services/redis');
    await redis.connect();

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

    // Setup weekly rewards distribution job
    setupWeeklyRewardsDistribution();
    setupInvestmentPoolsAutomation();

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
    app.use('/api/payments/kotanipay', kotaniPayStatusRoutes);
    app.use('/api/payments/mpesa', mpesaStatusRoutes);
    app.use('/api/payments/stripe', stripeStatusRoutes);
    app.use('/api/payments/reconciliation', paymentReconciliationRoutes);
    app.use('/api/referrals', referralsRoutes);
    app.use('/api/events', eventsRoutes);
    app.use('/api/notifications', notificationRoutes);
    app.use('/api/sse', sseRoutes);
    app.use('/api/billing', billingRoutes);
    app.use('/api/dao/:daoId/executions', proposalExecutionRouter);
    app.use('/api/proposals', pollProposalsRouter);
    app.use('/api/reputation', reputationRoutes); // Added reputation routes
    app.use('/api/cross-chain', crossChainRoutes);
    app.use('/api/morio', morioRoutes);

    // Blog routes
    const blogRoutes = (await import('./routes/blog')).default;
    app.use('/api/blog', blogRoutes);

    // NFT Marketplace routes
    app.use('/api/nft-marketplace', nftMarketplaceRouter);

    // Wallet routes
    app.use('/api/wallet', walletRouter);
    app.use('/api/wallet-setup', walletSetupRouter);
    app.use('/api/wallet/recurring-payments', (await import('./routes/recurring-payments')).default);
    app.use('/api/wallet/vouchers', (await import('./routes/vouchers')).default);
    app.use('/api/wallet/phone', (await import('./routes/phone-payments')).default);
    app.use('/api/payment-gateway', paymentGatewayRouter);
    // Mount KYC routes
    app.use('/api/kyc', kycRouter);

    // Import and mount escrow routes
    const escrowRouter = (await import('./routes/escrow')).default;
    app.use('/api/escrow', escrowRouter);

    // Import and mount invoice routes
    const invoiceRouter = (await import('./routes/invoices')).default;
    app.use('/api/invoices', invoiceRouter);

  // AI Analytics endpoints
  // Load authentication middleware dynamically (avoid top-level static import inside function scope)
  const { isAuthenticated } = await import('./auth'); // Dynamically imported
  app.get('/api/ai-analytics/:daoId', isAuthenticated, async (req: Request, res: Response) => {
      try {
        const { aiAnalyticsService } = await import('./services/aiAnalyticsService');
        const analytics = await aiAnalyticsService.getComprehensiveAnalytics(req.params.daoId);
        res.json({ success: true, data: analytics });
      } catch (error: any) {
        logger.error(`Error fetching AI analytics for DAO ${req.params.daoId}: ${error.message}`);
        res.status(500).json({ success: false, error: 'Failed to fetch AI analytics' });
      }
    });

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

    const PORT = 5000;
    const HOST = '0.0.0.0'; // Bind to all network interfaces

    server.listen(PORT, HOST, () => {
      logStartup(PORT.toString());
      logger.info('Server configuration', {
        port: PORT,
        host: HOST,
        frontendUrl: 'http://localhost:5173',
        backendUrl: `http://localhost:${PORT}`,
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

    // Start transaction monitoring with WebSocket support
    transactionMonitor.start();

    // Start recurring payment processor with balance validation
    recurringPaymentService.start();

    // Warm up gas price oracle cache
    gasPriceOracle.getCurrentGasPrices().catch(err => 
      console.warn('Failed to initialize gas price oracle:', err)
    );

    logger.info('✅ All payment monitoring services started');

    // Start bridge relayer service
    bridgeRelayerService.start();

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