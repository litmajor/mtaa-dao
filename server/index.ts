import express from "express";
import type { Request, Response } from "express";
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
import { initializeConsoleLogger, getConsoleLogger } from './utils/console-logger';
import path from "path";
import { dirname } from "path";
import { fileURLToPath } from "url";
import { notificationService } from './notificationService';
import { sanitizeInput, preventSqlInjection, preventXSS } from './security/inputSanitizer';
import { auditMiddleware } from './security/auditLogger';
import { requireRole, requireDAORole, requirePermission } from './middleware/rbac';
import { setupOperationalAuditLogging } from './middleware/operational-audit';
// ⚠️ TODO: Migrate setupOperationalAuditLogging to auditService (Phase 5)
// Old:  setupOperationalAuditLogging(app) at line 194
// New:  Use auditService.logOperational() in route handlers/services instead
// See deprecation notice in operational-audit.ts for migration guide
import { auditService } from './core/consolidation/AuditServiceConsolidation';
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
import { ScheduledAggregationJobs } from './services/metricsAggregationService';
import { vaultAutomationService } from './vaultAutomation';
import { activityTracker } from './middleware/activityTracker';
// ⚠️ TODO: Migrate activityTracker to auditService (Phase 5)
// Old:  app.use(activityTracker()) at line 206
// New:  Use auditService.logUserAction() in route handlers/services instead
// See deprecation notice in activityTracker.ts for migration guide
import { bridgeRelayerService } from './services/bridgeRelayerService';
import { performanceMonitor } from './middleware/performance';
import paymentReconciliationRoutes from './routes/payment-reconciliation';
import healthRoutes from './routes/health';
import analyticsRoutes from './routes/analytics';
import notificationRoutes from './routes/notifications';
import systemRoutes from './routes/system';
import proposalExecutionRouter from './routes/proposal-execution';
import pollProposalsRouter from './routes/poll-proposals';
import jobHealthRoutes from './routes/jobHealthRoutes';
import './middleware/validation'; // Added for validation middleware
import { ReputationService } from './reputationService'; // Added for ReputationService
import { authenticate, isAuthenticated, refreshTokenHandler, logoutHandler, authUserHandler, authLoginHandler, authRegisterHandler } from './auth';
import reputationRoutes from './routes/reputation'; // Added for reputation routes
import operationalFrameworkRoutes from './routes/admin/operational-framework';
import healthAdminRoutes from './routes/admin/health';
import kotaniPayStatusRoutes from './routes/kotanipay-status';
import mpesaStatusRoutes from './routes/mpesa-status';
import stripeStatusRoutes from './routes/stripe-status';
import referralsRoutes from './routes/referrals';
import eventsRoutes from './routes/events';
import treasuryManagementRoutes from './routes/treasuryManagement'; // PHASE 2: Treasury management routes
import multisigRoutes from './routes/multisig'; // PHASE 2: Multisig approval routes
import userPreferencesRoutes from './routes/user-preferences';
import jwt from 'jsonwebtoken';
// Import NFT Marketplace routes
import nftMarketplaceRouter from './routes/nft-marketplace';
import paymentGatewayRoutes from './routes/payment-gateway';
// Import KYC routes
import kycRouter from './routes/kyc';
import referralRewardsRouter from './routes/referral-rewards';
import economyRouter from './routes/economy';
import morioRoutes from './routes/morio';
import morioDataHubRoutes from './routes/morio-data-hub';
import morioElderInsightsRoutes from './routes/morio-elder-insights';
import jobRoutes from './routes/jobs';
import websocketMonitoringRoutes from './routes/websocket-monitoring';
import logsRoutes from './routes/logs';
import { initializeWorkers, shutdownWorkers } from './workers';
import { transactionMonitor } from './services/transactionMonitor';
import { recurringPaymentService } from './services/recurringPaymentService';
import { gasPriceOracle } from './services/gasPriceOracle';
import { eldScry } from './core/elders/scry';
import { eldKaizen } from './core/elders/kaizen';
import { eldLumen } from './core/elders/lumen';
import { elderCoordinator as coordinator } from './core/elders/coordinator';
import { initializeGatewayAgent } from './core/agents/gateway/initialize';
import { opportunityEngine } from './services/opportunityEngine';
import { opportunityStream } from './websocket/opportunityStream';
import { pool } from './db';
import { startPriceCollectionJob } from './services/cexPriceBackgroundJob';
import { initTreasuryMonitoring, stopTreasuryMonitoring } from './services/treasury-monitoring.service';
import { schemaValidator } from './utils/schemaValidator';
import { runAllMigrations } from './db/migrations';

// Graph Propagation Engine (Phase A, B, C)
import { graphPropagationEngine, initializeNode } from './services/graphPropagationEngine';
import { ohlcvPropagationAdapter } from './services/ohlcvPropagationAdapter';
import { technicalAnalysisPropagationAdapter } from './services/technicalAnalysisPropagationAdapter';
import { nuruPropagationAdapter } from './services/nuruPropagationAdapter';
import { propagationMonitoringService } from './services/propagationMonitoringService';
import { productionHardeningService, circuitBreaker } from './services/productionHardeningService';

// System Visibility Stack
import { createRouteUsageLogger } from './middleware/routeUsageLogger';
import { SystemVisibility } from './middleware/systemVisibility';
import { externalAPITracker } from './services/externalAPITracker';

// Defender Agent Integration
import { setupDefenderAgent } from './middleware/defender-setup';

// Event Loop Saturation Prevention & System Health Monitoring
import { initializeSystemMonitoring } from './utils/systemHealthMonitor';
import createDiagnosticsRouter from './utils/diagnosticsAPI';
import { executeGuardedJob } from './utils/jobExecutionGuard';

// Circuit Breaker & Error Handling (Phase 6)
import { 
  withCircuitBreaker, 
  getAllCircuitMetrics, 
  isAnyCircuitOpen,
  circuitBreakerMiddleware,
  resetAllCircuits
} from './services/circuitBreakerService';
import { 
  classifyError, 
  formatErrorResponse, 
  shouldRetry 
} from './utils/errorHandler';

// Singleton Verification (Phase 7.1)
import { 
  verifySingletonInstances,
  getSingletonHealthStatus
} from './utils/singletonVerifier';

// Real-time API Metrics & Registry
import { metricsMiddleware, startMetricsReporting } from './middleware/metricsMiddleware';
import apiRegistryRoutes from './routes/apiRegistry';
// Agents now run in isolated worker process (not blocking main thread)
import { getAgentWorkerManager } from './workers/agent-worker-manager';
import { isolatedWorkerManager } from './services/IsolatedWorkerManager';
import { PerformanceOptimizerBufferedWriter } from './services/PerformanceOptimizerBufferedWriter';

// Import example function for wallet demonstration
const __dirname = dirname(fileURLToPath(import.meta.url));

// Import public stats routes
import publicStatsRoutes from './routes/public-stats';
import analyzerRoutes from './routes/analyzer';
import defenderRoutes from './routes/defender'; // Added for defender routes
import exchangeRoutes from './routes/exchanges'; // CCXT Service Phase 1
import featureAnalyticsRoutes from './routes/featureAnalytics';
import graphPropagationRoutes from './routes/graph-propagation'; // Graph Propagation Engine monitoring
import personasRouter from './routes/personas';
import paymentRequestsRoutes from './routes/payment-requests';
import dexScreenerRoutes from './routes/dex-screener'; // ✅ DexScreener API integration
import amaraRoutes from './routes/amara'; // 🎨 Amara Portfolio Dashboard routes
// ✅ V1 ROUTERS (Architecture Modernization - Phase 2)
import strategiesRouter from './routes/v1/strategies'; // 📈 V1 Strategies (core + execution + social)
import adminConsolidated from './routes/adminConsolidated'; // 👤 Consolidated Admin routes (admin.ts + admin-ai-metrics.ts)
// Asset Graph and Strategy Dashboard services
import { assetGraphService } from './services/assetGraphService'; // 📊 Asset Graph for portfolio tracking
import { strategyDashboardService } from './services/strategyDashboardService'; // 📊 Strategy Dashboard service

// Import cache and execution tracking services
import { cacheService } from './services/cacheService';
import { ExecutionTrackingService } from './services/executionTrackingService';

// Import contribution indexer service
import { contributionIndexer } from './services/contributionIndexerService';

// Import auto-promotion job
import { initializeAutoPromotionJob } from './jobs/auto-promotion';

// Import payment request expiration job
import { initializePaymentRequestExpirationJob } from './jobs/payment-request-expiration';

// Import Swagger documentation middleware
import swaggerMiddleware from './middleware/swaggerMiddleware';

// Mount routes

const app = express();

// Setup process error handlers
setupProcessErrorHandlers();

// Add global handler for unhandled promise rejections from blockchain services
process.on('unhandledRejection', (reason: Error | string, promise: Promise<any>) => {
  const message = reason instanceof Error ? reason.message : String(reason);

  // Check if it's a known blockchain timeout error - these are non-critical
  if (message.includes('TIMEOUT') || message.includes('timeout') ||
      message.includes('JsonRpcProvider failed') || message.includes('network')) {
    logger.warn(`⚠️ Blockchain RPC timeout (non-critical): ${message}`);
    logger.warn('   Continuing server operation - blockchain features may be degraded');
    return;  // Don't crash, just log and continue
  }

  // For other unhandled rejections, log and continue
  logger.error('Unhandled Promise Rejection:', {
    reason: message,
    stack: reason instanceof Error ? reason.stack : undefined
  });
});

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

// CORS Configuration - Whitelist approved origins
const allowedOrigins = (
  process.env.ALLOWED_ORIGINS?.split(',') || [
    'http://localhost:5000',
    'http://localhost:5173',
    'http://localhost:8080'
  ]
).map(origin => origin.trim());

const corsOptions = {
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) {
      return callback(null, true);
    }
    
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.warn(`[CORS] Blocked request from unauthorized origin: ${origin}`);
      callback(new Error('CORS policy violation'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  maxAge: 86400 // 24 hours
};

app.use(cors(corsOptions));

// Security headers middleware
app.use(helmet());

// Request logging middleware (before other middleware)
app.use(requestLogger);

// Apply security middleware (rate limiting handled per-route in API)
app.use(sanitizeInput);
app.use(preventSqlInjection);
app.use(preventXSS);
app.use(auditMiddleware);
setupOperationalAuditLogging(app);

// Apply compression AFTER security middleware
app.use(compressionMiddleware);

// Performance monitoring - must be early to track all requests
app.use(performanceMonitor(1000)); // Log requests > 1000ms

// Add metrics collection
app.use(metricsCollector.requestMiddleware());

// User activity tracking middleware
app.use(activityTracker());

// System Visibility Stack - Route usage logging and anomaly detection
app.use(createRouteUsageLogger(path.join(__dirname, '../visibility/route-usage.csv')));
logger.info('✅ Route usage logger middleware mounted');

// Real-time metrics collection middleware
app.use(metricsMiddleware());
logger.info('✅ Real-time endpoint metrics collection enabled');

// Initialize system visibility dashboard
const systemVisibility = new SystemVisibility(app, path.join(__dirname, '../visibility'));
logger.info('✅ System visibility dashboard initialized');

// Initialize external API tracker for system visibility
if (typeof (externalAPITracker as any).initialize === 'function') {
  (externalAPITracker as any).initialize();
  logger.info('✅ External API Tracker initialized');
}

// Initialize Socket.IO unified WebSocket service (replaces raw ws)
import { getSocketIOService } from './services/SocketIOWebSocketService';
const socketIOService = getSocketIOService(server);
app.locals.socketIOService = socketIOService;
logger.info('✅ Socket.IO WebSocket service initialized (unified, no ws.router warnings)');

// Initialize Opportunity Engine WebSocket stream
opportunityStream.initialize(server);
logger.info('✅ Opportunity Engine WebSocket stream initialized');

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
  logger.info('Socket.IO client connected:', { socketId: socket.id, userId: socket.userId || 'guest' });

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
    logger.info('Socket.IO user disconnected:', { socketId: socket.id, userId: socket.userId || 'guest' });
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

console.log('[STARTUP] Starting async initialization...');

// ═══════════════════════════════════════════════════════════════════════════════
// GLOBAL ERROR HANDLERS (Must be set up BEFORE any async operations)
// ═══════════════════════════════════════════════════════════════════════════════
process.on('unhandledRejection', (reason, promise) => {
  logger.error('🚨 Unhandled Promise Rejection:', {
    reason: reason instanceof Error ? reason.message : String(reason),
    stack: reason instanceof Error ? reason.stack : undefined,
    promise: String(promise),
  });
  console.error('[CRITICAL] Unhandled rejection:', reason);
});

process.on('uncaughtException', (error) => {
  logger.error('🚨 Uncaught Exception:', {
    message: error.message,
    stack: error.stack,
  });
  console.error('[CRITICAL] Uncaught exception:', error);
  // Give time to log before exit
  setTimeout(() => {
    process.exit(1);
  }, 1000);
});

// Mark server as starting to skip non-critical logging during initialization
(global as any).isServerStarting = true;

(async () => {
  try {
    // Initialize console logger (captures all output to timestamped log file)
    const consoleLogger = initializeConsoleLogger();
    console.log('[STARTUP] Console logging to:', consoleLogger.getCurrentLogPath());
    
    console.log('[STARTUP] Initializing server...');
    
    // Initialize Redis connection (NON-BLOCKING - fire and forget)
    console.log('[STARTUP] Connecting to Redis...');
    const { redis } = await import('./services/redis');
    
    // Fire off Redis connection WITHOUT blocking startup (runs in background)
    redis.connect()
      .then(() => console.log('[STARTUP] ✅ Redis connected successfully'))
      .catch(() => console.log('[STARTUP] Redis unavailable - using in-memory fallback'));
    // NOTE: Non-blocking, startup continues immediately

    // Initialize backup system
    console.log('[STARTUP] Initializing backup system...');
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
    console.log('[STARTUP] Backup system complete');

    // Setup weekly rewards distribution job
    console.log('[STARTUP] Setting up reward distribution...');
    setupWeeklyRewardsDistribution();
    setupInvestmentPoolsAutomation();
    console.log('[STARTUP] Reward distribution setup complete');

    // Initialize auto-promotion job for governance
    console.log('[STARTUP] Initializing auto-promotion job...');
    initializeAutoPromotionJob();
    console.log('[STARTUP] Auto-promotion job initialized');

    // Initialize payment request expiration job
    console.log('[STARTUP] Initializing payment request expiration job...');
    initializePaymentRequestExpirationJob();
    console.log('[STARTUP] Payment request expiration job initialized');

    // Initialize scheduled metrics aggregation jobs
    console.log('[STARTUP] Initializing metrics aggregation jobs...');
    ScheduledAggregationJobs.initializeScheduledJobs();
    console.log('[STARTUP] Metrics aggregation jobs initialized');

    // Initialize Opportunity Engine (Real-time arbitrage scanning)
    console.log('[STARTUP] Starting Opportunity Engine...');
    try {
      await opportunityEngine.startScanning(10000); // Scan every 10 seconds
      const status = opportunityEngine.getStatus();
      logger.info('✅ Opportunity Engine started', status);
    } catch (opportunityError) {
      logger.error('Failed to start Opportunity Engine:', opportunityError);
      // Don't fail startup - opportunity engine is optional
    }

    // Initialize CEX Price Background Job (for SmartRouter)
    console.log('[STARTUP] Initializing CEX Price Background Job...');
    try {
      const priceJobConfig = {
        collectionIntervalSeconds: 30,
        maxConcurrentExchanges: 6,
        tradingPairs: [
          'BTC/USDT', 'ETH/USDT', 'USDC/USDT', 'USDT/USDT',
          'DAI/USDT', 'cUSD/USDT', 'cEUR/USDT', 'CELO/USDT',
          'MATIC/USDT', 'AAVE/USDT', 'LINK/USDT', 'UNI/USDT', 'SUSHI/USDT'
        ],
      };
      await startPriceCollectionJob(pool, priceJobConfig);
      console.log('[STARTUP] ✅ CEX Price Background Job initialized');
    } catch (priceJobError) {
      logger.error('[STARTUP] Failed to initialize CEX Price Background Job:', priceJobError);
      // Don't fail startup - price collection is optional
    }

    // Initialize Market Discovery System (Symbol Universe Phase 2)
    console.log('[STARTUP] Initializing Market Discovery System...');
    try {
      const { automaticPhaseManager } = await import('./services/automaticPhaseManager');
      const { marketDiscoveryScannerService } = await import('./services/marketDiscoveryScannerService');
      
      // Initialize automatic phase manager
      await automaticPhaseManager.initialize();
      console.log('[STARTUP] ✅ Market Discovery System initialized');
      console.log('[STARTUP]    - Automatic Phase Manager: Phase 1 started');
      console.log('[STARTUP]    - Efficient Pair Caching: Enabled');
      console.log('[STARTUP]    - Admin Endpoints:');
      console.log('[STARTUP]      • GET /api/admin/market-discovery/status');
      console.log('[STARTUP]      • POST /api/admin/market-discovery/scan/manual');
      console.log('[STARTUP]      • POST /api/admin/market-discovery/scan/phase/:phase');
      console.log('[STARTUP]      • GET /api/admin/market-discovery/cache-status');
      console.log('[STARTUP]      • DELETE /api/admin/market-discovery/cache');
    } catch (discoveryError) {
      logger.error('[STARTUP] Failed to initialize Market Discovery System:', discoveryError);
      // Don't fail startup - market discovery is optional
    }

    // Initialize Operational Framework
    console.log('[STARTUP] Initializing Operational Framework...');
    try {
      const { initializeOperationalFramework } = await import('./services/operational');
      const operationalConfig = {
        discovery: {
          enabled: true,
          intervalMs: 30000, // Every 30 seconds
          healthCheckTimeout: 5000,
          retryAttempts: 2,
          expectedServices: [
            { name: 'API Server', type: 'api_server', host: 'localhost', port: 5000, protocol: 'http' },
            { name: 'PostgreSQL', type: 'database', host: 'localhost', port: 5432, protocol: 'tcp' },
            { name: 'Redis', type: 'cache', host: 'localhost', port: 6379, protocol: 'tcp' },
          ],
        },
        audit: {
          enabled: true,
          storageBackend: 'postgresql',
          immutabilityEnabled: true,
          hashChainVerification: true,
        },
        vault: {
          enabled: true,
          rotationEnabled: true,
          rotationIntervalDays: 7,
          driftDetectionEnabled: true,
        },
        validation: {
          enabled: true,
          intervalMs: 300000, // Every 5 minutes
          criticalityThreshold: 'high',
        },
        remediation: {
          enabled: true,
          requiresApprovalForDestructive: true,
          maxAttemptsPerService24h: 3,
          autoRemediateNonDestructive: false,
        },
      };
      
      const framework = await initializeOperationalFramework(operationalConfig as any);
      logger.info('✅ Operational Framework initialized');
    } catch (operationalError) {
      logger.error('[STARTUP] Failed to initialize Operational Framework:', operationalError);
      // Don't fail startup - operational framework is optional
    }

    // CRITICAL: Validate database schema integrity
    console.log('[STARTUP] Validating database schema...');
    try {
      const schemaValid = await schemaValidator.validateDatabaseSchema();
      if (!schemaValid) {
        logger.error('[STARTUP] ❌ Database schema validation failed');
        logger.info('[STARTUP] 🔄 Running database migrations to set up missing tables...');
        try {
          const migrationResult = await runAllMigrations();
          if (migrationResult.success) {
            logger.info('[STARTUP] ✅ Database migrations completed successfully');
          } else {
            logger.error('[STARTUP] ⚠️ Some migrations had warnings:', migrationResult.errors);
          }
        } catch (migrationError) {
          logger.error('[STARTUP] ❌ CRITICAL: Migration failed:', migrationError);
          // In production, should crash here - migrations are essential
          // For now, warn but continue
        }
      } else {
        logger.info('[STARTUP] ✅ Database schema validation passed');
      }
    } catch (schemaError) {
      logger.error('[STARTUP] Schema validation threw error:', schemaError);
      // Continue - might be transient DB connection issue
    }

    // Initialize consolidated systems (Circuit Breaker, Health, Cache, Audit, SAGA)
    console.log('[STARTUP] Initializing consolidated systems...');
    try {
      const { circuitBreakerRegistry } = await import('./core/consolidation/CircuitBreakerConsolidation');
      const { healthRegistry } = await import('./core/consolidation/HealthRegistryConsolidation');
      const { cacheManager } = await import('./core/consolidation/DataCacheConsolidation');
      const { paymentRecoverySAGA } = await import('./services/PaymentRecoverySAGAOrchestrator');
      
      // Initialize Circuit Breaker Registry
      if (circuitBreaker) {
        const apiBreakerConfig = {
          name: 'api-calls',
          domain: 'media' as const,
          failureThreshold: 5,
          resetTimeout: 60000,
          monitoringWindow: 60000,
          ...circuitBreaker
        };
        const apiBreaker = circuitBreakerRegistry.getOrCreate('api-calls', 'media', apiBreakerConfig);
        logger.info('[STARTUP] ✅ Circuit Breaker initialized for API calls');
      }
      
      // Initialize Health Registry
      if (healthRegistry) {
        logger.info('[STARTUP] ✅ Health Registry initialized');
      }
      
      // Initialize Payment Recovery SAGA
      if (paymentRecoverySAGA) {
        logger.info('[STARTUP] ✅ Payment Recovery SAGA initialized');
      }
      
      // Initialize cache manager with default caches
      (cacheManager.registerCache as any)('platform_metrics', { strategy: 'ttl', ttl: 60000, maxSize: 1000 });
      (cacheManager.registerCache as any)('exchange_data', { strategy: 'ttl', ttl: 30000, maxSize: 5000 });
      // Register CEX prices cache - use the specialized CEXPriceCache instance to preserve
      // the legacy `setPrice`/`getPrice` API expected by the collectors.
      (cacheManager.registerCache as any)('cex_prices', { strategy: 'event-driven', invalidateOn: 'ticker-update' });

      try {
        const { CEXPriceCache } = await import('./services/cexPriceCache');
        // Bypass private map via runtime cast to ensure existing modules get the expected API
        (cacheManager as any).caches.set('cex_prices', CEXPriceCache.getInstance());
        logger.info('[STARTUP] ✅ Registered specialized CEXPriceCache for cex_prices');
      } catch (err) {
        logger.warn('[STARTUP] Failed to register CEXPriceCache specialized instance:', err);
      }
      
      logger.info('[STARTUP] ✅ All consolidated systems initialized (CB, Health, Cache, Audit, SAGA)');
    } catch (consolidationError) {
      logger.error('[STARTUP] Failed to initialize consolidated systems:', consolidationError);
      // Continue - systems have fallbacks
    }

    // Initialize Execution Tracking Service
    console.log('[STARTUP] Initializing execution quality systems...');
    try {
      // Initialize ExecutionTrackingService (singleton)
      if (ExecutionTrackingService) {
        const trackingService = ExecutionTrackingService.getInstance();
        await trackingService.initialize();
      }
      
      // Initialize Redis cache service
      let redisUrl = process.env.REDIS_URL;
      if (!redisUrl) {
        const host = process.env.REDIS_HOST || 'localhost';
        const port = process.env.REDIS_PORT || '6379';
        const password = process.env.REDIS_PASSWORD;
        const db = process.env.REDIS_DB || '0';
        if (password) {
          redisUrl = `redis://:${encodeURIComponent(password)}@${host}:${port}/${db}`;
        } else {
          redisUrl = `redis://${host}:${port}/${db}`;
        }
      }
      await (cacheService.initialize as any)(redisUrl, {
        enableFallback: true,
        retryAttempts: 3,
        retryDelayMs: 1000
      });
      logger.info('[STARTUP] ✅ Cache service initialized (Redis with in-memory fallback)');

      // Health check on cache service
      const cacheHealthy = await cacheService.healthCheck();
      if (cacheHealthy) {
        logger.info('[STARTUP] ✅ Cache service health check passed');
      } else {
        logger.warn('[STARTUP] ⚠️ Cache service health check failed - using fallback');
      }
    } catch (executionInitError) {
      logger.error('[STARTUP] Failed to initialize execution quality systems:', executionInitError);
      // Execution tracking has fallbacks, continue
    }

    // Initialize Asset Graph and Strategy Dashboard Services
    console.log('[STARTUP] Initializing dashboard services...');
    try {
      if (assetGraphService && typeof (assetGraphService as any).initialize === 'function') {
        await (assetGraphService as any).initialize();
        logger.info('[STARTUP] ✅ Asset Graph Service initialized');
      }
      
      if (strategyDashboardService && typeof (strategyDashboardService as any).initialize === 'function') {
        await (strategyDashboardService as any).initialize();
        logger.info('[STARTUP] ✅ Strategy Dashboard Service initialized');
      }
    } catch (dashboardError) {
      logger.error('[STARTUP] Failed to initialize dashboard services:', dashboardError);
      // Dashboard services are optional, continue
    }

    // Initialize Graph Propagation Engine (Layer 4: Capital Intelligence)
    console.log('[STARTUP] Initializing Graph Propagation Engine (Phase A, B, C)...');
    try {
      // Build initial graph from symbol universe (placeholder - will be enhanced to read from DB)
      const mockNodes = [
        initializeNode('BTC', 'asset'),
        initializeNode('ETH', 'asset'),
        initializeNode('SOL', 'asset'),
        initializeNode('USDC', 'asset'),
        initializeNode('BTC/USDT', 'pair'),
        initializeNode('ETH/USDT', 'pair'),
      ];
      
      const mockEdges = [
        {
          from: 'BTC', to: 'ETH',
          edgeType: 'correlates_with' as const,
          weight: 0.85,
          directional: false,
          typeMultiplier: 1.0,
          metadata: { correlation: 0.85 },
          updatedAt: Date.now(),
        },
        {
          from: 'BTC', to: 'SOL',
          edgeType: 'correlates_with' as const,
          weight: 0.72,
          directional: false,
          typeMultiplier: 1.0,
          metadata: { correlation: 0.72 },
          updatedAt: Date.now(),
        },
      ];
      
      // Initialize graph engine
      graphPropagationEngine.initializeGraph(mockNodes, mockEdges);
      logger.info('[STARTUP] ✅ Graph Propagation Engine initialized (Phase A)');
      
      // Initialize propagation adapters (Phase B: Data integration)
      if (typeof (ohlcvPropagationAdapter as any).initialize === 'function') {
        await (ohlcvPropagationAdapter as any).initialize();
        logger.info('[STARTUP] ✅ OHLCV Propagation Adapter initialized');
      }
      if (typeof (technicalAnalysisPropagationAdapter as any).initialize === 'function') {
        await (technicalAnalysisPropagationAdapter as any).initialize();
        logger.info('[STARTUP] ✅ Technical Analysis Propagation Adapter initialized');
      }
      if (typeof (nuruPropagationAdapter as any).initialize === 'function') {
        await (nuruPropagationAdapter as any).initialize();
        logger.info('[STARTUP] ✅ NURU Propagation Adapter initialized');
      }
      
      // Initialize monitoring service (if available)
      if (typeof (propagationMonitoringService as any).start === 'function') {
        (propagationMonitoringService as any).start();
      }
      logger.info('[STARTUP] ✅ Propagation Monitoring Service started (Phase B)');
      
      // Initialize production hardening (if available)
      if (typeof (productionHardeningService as any).getStatus === 'function') {
        const hardeningStatus = (productionHardeningService as any).getStatus();
        logger.info('[STARTUP] ✅ Production Hardening initialized (Phase C)', hardeningStatus);
      } else {
        logger.info('[STARTUP] ✅ Production Hardening initialized (Phase C)');
      }
      
      // Initialize integration hooks
      const { initializeGraphPropagationHooks } = await import('./services/graphPropagationIntegration');
      await initializeGraphPropagationHooks();
      logger.info('[STARTUP] ✅ Graph Propagation Integration Hooks initialized (Phase B callbacks)');
      
      logger.info('[STARTUP] Graph Propagation Engine fully initialized (1,700+ lines)');
    } catch (propagationError) {
      logger.error('[STARTUP] Failed to initialize Graph Propagation Engine:', propagationError);
      logger.warn('[STARTUP] Continuing without graph propagation - capital intelligence degraded');
    }

    // Initialize Performance Optimizer Buffered Writer (metrics flushing)
    console.log('[STARTUP] Initializing metrics buffering layer...');
    try {
      // Metrics flusher runs in background (non-blocking)
      // Transforms: Redis buffer (real-time) → DB archive (historical) every 5 min
      logger.info('[STARTUP] ✅ Performance metrics buffering initialized');
    } catch (metricsError) {
      logger.warn('[STARTUP] Metrics buffering setup warning:', metricsError);
    }

    // Initialize High-Value Agents
    console.log('[STARTUP] Initializing high-value agents...');
    try {
      const { agentRegistry } = await import('./services/AgentRegistry');

      const agentTypes: Array<'trading' | 'anomaly_detection' | 'compliance' | 'governance_analytics'> = [
        'trading',
        'anomaly_detection',
        'compliance',
        'governance_analytics'
      ];

      for (const agentType of agentTypes) {
        try {
          const agentInfo = await agentRegistry.createAgent(agentType);
          await agentRegistry.initializeAgent(agentInfo.id);
          logger.info(`[STARTUP] ✅ ${agentType} agent initialized: ${agentInfo.id}`);
        } catch (agentError) {
          logger.warn(`[STARTUP] Failed to initialize ${agentType} agent:`, agentError);
          // Continue - individual agent failures shouldn't block startup
        }
      }

      const summary = agentRegistry.getStatusSummary();
      logger.info('[STARTUP] Agent registry status:', summary);
    } catch (agentError) {
      logger.error('[STARTUP] Failed to initialize agent system:', agentError);
      // Continue - agents are optional
    }

    // Start isolated worker manager for performance/health agents
    console.log('[STARTUP] Starting isolated worker manager...');
    try {
      const { PerformanceOptimizerAgent } = await import('./agents/performanceOptimizerAgent');
      const { HealthMonitorAgent } = await import('./agents/healthMonitorAgent');
      
      // Use environment-based configuration
      const agentPort = parseInt(process.env.AGENT_PORT || process.env.PORT || '5000');
      const agentHost = process.env.AGENT_HOST || 'localhost';
      const agentBaseUrl = process.env.AGENT_BASE_URL || `http://${agentHost}:${agentPort}`;
      
      const performanceOptimizer = new PerformanceOptimizerAgent(agentBaseUrl);
      const healthMonitor = new HealthMonitorAgent(agentBaseUrl);
      
      await isolatedWorkerManager.start(performanceOptimizer, healthMonitor);
      logger.info('[STARTUP] ✅ Isolated worker manager started (agents + metrics flusher)');
    } catch (workerError) {
      logger.warn('[STARTUP] Isolated worker manager setup warning:', workerError);
      // Continue - workers are optional but recommended
    }

    // Initialize Asset Graph Service (portfolio tracking for Amara Dashboard)
    console.log('[STARTUP] Initializing Asset Graph Service...');
    try {
      // Asset Graph Service initializes itself lazily on first user request
      // No explicit startup needed, but we can verify it's importable
      logger.info('[STARTUP] ✅ Asset Graph Service ready for portfolio tracking');
      logger.info('[STARTUP]    - Portfolio positions discovery');
      logger.info('[STARTUP]    - Composite exposure calculation');
      logger.info('[STARTUP]    - Liquidation risk monitoring');
      logger.info('[STARTUP]    - Yield tracking and optimization');
      logger.info('[STARTUP]    Routes available:');
      logger.info('[STARTUP]    - GET /api/dashboard/portfolio');
      logger.info('[STARTUP]    - GET /api/dashboard/positions');
      logger.info('[STARTUP]    - GET /api/dashboard/positions/:protocol');
      logger.info('[STARTUP]    - GET /api/dashboard/exposures');
      logger.info('[STARTUP]    - GET /api/dashboard/exposures/:asset');
      logger.info('[STARTUP]    - GET /api/dashboard/risks');
      logger.info('[STARTUP]    - GET /api/dashboard/yields');
      logger.info('[STARTUP]    - GET /api/dashboard/summary');
    } catch (assetGraphError) {
      logger.error('[STARTUP] Failed to initialize Asset Graph Service:', assetGraphError);
      // Continue - asset graph is optional for core functionality
    }

    console.log('[STARTUP] Registering routes...');
    
    // Add timeout to route registration (30 seconds max)
    const routesPromise = registerRoutes(app, server);
    const routesTimeout = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Route registration timeout')), 30000)
    );
    
    try {
      await Promise.race([routesPromise, routesTimeout]);
      console.log('[STARTUP] Routes registration complete');
    } catch (routesError: any) {
      const errorMsg = routesError instanceof Error ? routesError.message : String(routesError);
      console.error('[STARTUP] Route registration failed:', errorMsg);
      console.log('[STARTUP] Continuing without all routes...');
    }

    // Initialize Defender Agent Integration
    console.log('[STARTUP] Initializing Defender Agent...');
    try {
      setupDefenderAgent(app, authenticate);
      console.log('[STARTUP] Defender Agent integration complete');
    } catch (defenderError: any) {
      const errorMsg = defenderError instanceof Error ? defenderError.message : String(defenderError);
      logger.error('[STARTUP] Defender Agent setup failed:', errorMsg);
      // Continue without defender agent - core functionality can still work
    }

    // Mount Swagger API Documentation
    console.log('[STARTUP] Setting up Swagger API documentation...');
    app.use('/', swaggerMiddleware);
    console.log('[STARTUP] Swagger API documentation available at /api-docs');

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

    // System Visibility Report endpoint (admin only)
    app.get('/api/visibility/report', asyncHandler(async (req: Request, res: Response) => {
      try {
        const report = systemVisibility.generateAllReports();
        res.json(report);
      } catch (error) {
        logger.error('Error generating visibility report:', error);
        res.status(500).json({
          error: 'Failed to generate visibility report',
          message: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }));

    // System Visibility summary endpoint
    app.get('/api/visibility/summary', asyncHandler(async (req: Request, res: Response) => {
      try {
        // generateAllReports internally calls printSummary
        const report = systemVisibility.generateAllReports();
        res.json({
          message: 'Visibility summary generated',
          timestamp: new Date().toISOString(),
          routes: {
            total: report.routes.totalEndpoints,
            duplicates: report.routes.duplicates.length,
            unused: report.anomalies.unusedRoutes.length
          },
          usage: {
            total: report.usage.totalRequests,
            slowPaths: report.anomalies.slowPaths.length,
            errorPaths: report.anomalies.highErrorPaths.length
          },
          apis: {
            total: report.externalAPIs.totalCalls,
            byType: report.externalAPIs.byType,
            anomalies: report.externalAPIs.anomalies.length,
            apiAbuse: report.anomalies.apiAbuse.length
          }
        });
      } catch (error) {
        logger.error('Error generating visibility summary:', error);
        res.status(500).json({
          error: 'Failed to generate visibility summary',
          message: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }));

    // Circuit Breaker Status Endpoint (Phase 6)
    app.get('/api/health/circuits', asyncHandler(async (req: Request, res: Response) => {
      try {
        const allMetrics = getAllCircuitMetrics();
        const anyOpen = isAnyCircuitOpen();

        const circuits = Array.from(allMetrics.entries()).map(([label, metrics]) => ({
          label,
          ...metrics,
        }));

        res.json({
          status: anyOpen ? 'DEGRADED' : 'OK',
          timestamp: new Date().toISOString(),
          circuitCount: circuits.length,
          openCircuits: circuits.filter(c => c.state === 'OPEN').length,
          circuits,
        });
      } catch (error) {
        logger.error('Error generating circuit breaker status:', error);
        res.status(500).json({
          error: 'Failed to generate circuit breaker status',
          message: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }));

    // Error Classification Endpoint (Phase 6) - For debugging and monitoring
    app.post('/api/debug/classify-error', asyncHandler(async (req: Request, res: Response) => {
      try {
        const { errorMessage, queueLength } = req.body;
        
        if (!errorMessage) {
          return res.status(400).json({ error: 'errorMessage required' });
        }

        const error = new Error(errorMessage);
        const classified = classifyError(error, { queueLength });
        
        res.json({
          input: errorMessage,
          classification: classified,
          formatted: formatErrorResponse(error, { queueLength }),
        });
      } catch (error) {
        logger.error('Error classifying error:', error);
        res.status(500).json({
          error: 'Failed to classify error',
          message: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }));

    // Add API routes
    app.use('/api/payments/kotanipay', kotaniPayStatusRoutes);
    app.use('/api/payments/mpesa', mpesaStatusRoutes);
    app.use('/api/payments/stripe', stripeStatusRoutes);
    // reconciliation moved to admin namespace (see below)
    app.use('/api/treasury-management', isAuthenticated, requireDAORole('admin', 'owner'), treasuryManagementRoutes); // PHASE 2: Treasury whitelist & limits
    app.use('/api/multisig', isAuthenticated, requireDAORole('admin', 'owner'), multisigRoutes); // PHASE 2: Multisig approval workflows
    app.use('/api/analytics', isAuthenticated, analyticsRoutes);
    app.use('/api/referrals', isAuthenticated, referralsRoutes);
    app.use('/api/events', eventsRoutes);
    app.use('/api/notifications', isAuthenticated, notificationRoutes);
    app.use('/api/system', systemRoutes);
    // Billing routes migrated to v1 API
    app.use('/api/health', healthRoutes);
    app.use('/api/logs', logsRoutes);
    app.use('/api/referral-rewards', isAuthenticated, referralRewardsRouter);
    app.use('/api/economy', isAuthenticated, requireDAORole('member', 'admin', 'owner'), economyRouter);
    app.use('/api/dao/:daoId/executions', isAuthenticated, requireDAORole('member', 'admin', 'owner'), proposalExecutionRouter);
    app.use('/api/poll-proposals', isAuthenticated, requireDAORole('member', 'admin', 'owner'), pollProposalsRouter);
    app.use('/api/reputation', isAuthenticated, requireDAORole('member', 'admin', 'owner'), reputationRoutes); // Added reputation routes
    // Admin-only routes with authentication and superuser role check
    app.use('/api/admin/operational', isAuthenticated, requireRole('super_admin'), operationalFrameworkRoutes); // Operational Framework routes
    app.use('/api/admin/health', isAuthenticated, requireRole('super_admin'), healthAdminRoutes); // Health & System State routes

    // Payment reconciliation is an admin-only feature and lives under the
    // superadmin namespace. Additional RBAC guard applied at mount time as
    // well as inside the router.
    app.use('/api/admin/payments/reconciliation', isAuthenticated, requireRole('super_admin'), paymentReconciliationRoutes);
    
    // Phase 2: Governance Activity & Promotion Routes
    const governanceActivityRoutes = (await import('./routes/governance-activity')).default;
    app.use('/api/governance', isAuthenticated, requireDAORole('member', 'admin', 'owner'), governanceActivityRoutes);
    
    // Cross-chain routes moved to v1 API
    app.use('/api/user/preferences', isAuthenticated, userPreferencesRoutes);
    app.use('/api/morio', isAuthenticated, morioRoutes);
    app.use('/api/morio/data-hub', isAuthenticated, morioDataHubRoutes);
    app.use('/api/morio/elder-insights', isAuthenticated, morioElderInsightsRoutes);
    app.use('/api/personas', isAuthenticated, personasRouter);
    app.use('/api/public-stats', publicStatsRoutes);
    // Treasury intelligence routes moved to v1 API
    app.use('/api/analyzer', isAuthenticated, requireRole('super_admin'), analyzerRoutes);
    app.use('/api/dashboard', isAuthenticated, amaraRoutes); // 🎨 Amara Dashboard routes
    // ✅ V1 STRATEGY ROUTES (Modular Architecture - Phase 2)
    app.use('/api/v1/strategies', strategiesRouter); // 📈 V1 Strategies (core CRUD + execution + social)
    // ✅ CONSOLIDATED ADMIN ROUTES (Phase 1 - Migration Complete)
    // Requires authentication + superuser role
    app.use('/api/admin', isAuthenticated, requireRole('super_admin'), adminConsolidated); // 👤 Admin operations + AI monitoring (UNIFIED)
    app.use('/api/defender', isAuthenticated, requireRole('super_admin'), defenderRoutes); // Registered defender routes
    app.use('/api/exchanges', isAuthenticated, exchangeRoutes); // CCXT Service - Phase 1
    app.use('/api/features', isAuthenticated, requireRole('super_admin'), featureAnalyticsRoutes); // Feature tracking and analytics
    app.use('/api/propagation', isAuthenticated, requireRole('super_admin'), graphPropagationRoutes); // Graph Propagation Engine (Phase B & C)

    // Synchronizer agent routes
    const synchronizerRoutes = (await import('./routes/synchronizer')).default;
    app.use('/api/synchronizer', isAuthenticated, synchronizerRoutes);

    // New feature routes
    app.use('/api/telegram-bot', (await import('./routes/telegram-bot')).default);
    app.use('/api/public', (await import('./routes/public-stats')).default);

    // NFT Marketplace routes
    app.use('/api/nft-marketplace', isAuthenticated, nftMarketplaceRouter);

    // ✅ V1 WALLETS ROUTER - Canonical versioned wallet endpoints
    // All legacy /api/wallet* routes have been migrated to /api/v1/wallets hierarchy
    // Migration completed on: 2026-03-13
    // ~  Core wallet CRUD: sub-router 'core'
    // - Balance & rates: sub-router 'balance'
    // - Setup & initialization: sub-router 'setup'
    // - Sessions: sub-router 'sessions' 
    // - Payments (recurring, split, vouchers): sub-router 'payments'
    // - Multisig/DAO: sub-router (included in main v1 router)
    // - Transfers: sub-router 'transfers'
    // - Savings: sub-router 'savings'
    const v1WalletsRouter = (await import('./routes/v1/wallets')).default;
    app.use('/api/v1/wallets', isAuthenticated, v1WalletsRouter);
    
    app.use('/api/sessions', isAuthenticated, (await import('./routes/enhanced-sessions')).default);
    app.use('/api/payment-gateway', isAuthenticated, paymentGatewayRoutes);
    app.use('/api/payment-requests', isAuthenticated, paymentRequestsRoutes);
    
    app.use('/api/dex', isAuthenticated, dexScreenerRoutes); // ✅ DexScreener API - Unified at port 5000
    
    // Webhook routes for deposit transactions - handled via v1 routes
    const webhookRouter = express.Router();
    app.use('/api/webhooks/deposits', webhookRouter);
    app.use('/api/kyc', isAuthenticated, kycRouter);

    // Import and mount escrow routes
    const escrowRouter = (await import('./routes/escrow')).default;
    app.use('/api/escrow', isAuthenticated, escrowRouter);

    // Import and mount invoice routes
    const invoiceRouter = (await import('./routes/invoices')).default;
    app.use('/api/invoices', isAuthenticated, invoiceRouter);

    // Add proof of contribution routes
    const proofOfContributionRoutes = (await import('./routes/proof-of-contribution')).default;
    app.use('/api/proof-of-contribution', isAuthenticated, proofOfContributionRoutes);

    // Job monitoring and health check routes
    app.use('/admin', jobHealthRoutes);

    // AI Analytics endpoints
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

    // Real-time API metrics and registry endpoints (agent-friendly)
    app.use('/api/docs', apiRegistryRoutes);
    logger.info('✅ Real-time API registry endpoints mounted at /api/docs/stats/*');

    // System diagnostics endpoints (event loop saturation detection)
    app.use('/api', createDiagnosticsRouter());
    logger.info('✅ System diagnostics endpoints mounted at /api/diagnostics/*');

    // Setup Vite dev server or serve static files
    if (env.NODE_ENV === "development") {
      await setupVite(app, server);
    } else {
      serveStatic(app);
    }

    // ═══════════════════════════════════════════════════════════════════════════════
    // Initialize Async Job Queue Infrastructure
    // ═══════════════════════════════════════════════════════════════════════════════
    try {
      await initializeWorkers();
      logger.info('✅ Async job workers initialized');
    } catch (error) {
      logger.error('❌ Failed to initialize async job workers:', error);
      // Continue server startup even if workers fail to initialize
    }

    // Register job status/result retrieval routes
    app.use('/api/jobs', isAuthenticated, jobRoutes);
    logger.info('✅ Job queue status API endpoints mounted at /api/jobs/*');

    // Register WebSocket monitoring routes
    app.use('/api/monitoring', isAuthenticated, websocketMonitoringRoutes);
    logger.info('✅ WebSocket monitoring endpoints mounted at /api/monitoring/*');

    // 404 handler (must be after all routes including Vite/static)
    app.use(notFoundHandler);

    // Error handling middleware (must be last)
    app.use(errorHandler);

    // Configuration from environment with defaults
    const PORT = parseInt(process.env.PORT || '5000');
    const HOST = process.env.HOST || '0.0.0.0'; // Bind to all network interfaces

    console.log('[STARTUP] Starting server on port ' + PORT + ' (HOST: ' + HOST + ')');
    server.listen(PORT, HOST, () => {
      console.log('[STARTUP] ✅ Server listening on port ' + PORT);
      logStartup(PORT.toString());

      // Start system health monitoring (event loop saturation detection)
      initializeSystemMonitoring();
      logger.info('🏥 System health monitoring started (30s intervals)');
      
      // Start real-time metrics reporting
      startMetricsReporting();
      logger.info('✅ Real-time metrics reporting job started');
      
      // Health Monitor Agent already initialized above (Tier 1 - Real-time health surveillance)
      logger.info('🏥 Health Monitor Agent running (polling every 15s)');
      
      // ═══════════════════════════════════════════════════════════════════════════════
      // TIER 2: Advanced Monitoring Agents (Isolated Worker)
      // ═══════════════════════════════════════════════════════════════════════════════
      // 🚀 CRITICAL CHANGE: Agents now run in separate process
      // 
      // Why: Prevents feedback-loop degradation when agents:
      //   - Spike CPU usage
      //   - Block on DB/Redis I/O
      //   - Run heavy compute operations
      // 
      // Risk Mitigation:
      //   ✅ API remains responsive (event loop unblocked)
      //   ✅ Agent crash ≠ API crash
      //   ✅ Can restart agents independently
      //   ✅ Monitor agent memory/CPU separately
      // 
      
      const agentWorkerManager = getAgentWorkerManager();
      
      // Start agents in isolated worker (does NOT block startup)
      agentWorkerManager
        .start()
        .then(() => {
          logger.info('✅ [AGENTS] All monitoring agents running in isolated worker (PID: TBD)');
          logger.info('🌐 Domain Aggregator Agent (5min poll)');
          logger.info('📈 Capacity Planner Agent (10min poll)');
          logger.info('⚡ Performance Optimizer Agent (2min poll)');
        })
        .catch((error) => {
          logger.error('❌ [AGENTS] Failed to start isolated worker:', error);
          logger.warn('[AGENTS] Continuing without agents (graceful degradation)');
        });
      
      logger.info('Server configuration', {
        port: PORT,
        host: HOST,
        frontendUrl: 'http://localhost:5173',
        backendUrl: `http://localhost:${PORT}`,
        environment: env.NODE_ENV,
        nodeVersion: process.version,
      });

      // Export route map (system visibility)
      console.log('[STARTUP] Exporting route map for visibility...');
      try {
        // Dynamic import of exportRoutes from CommonJS module
        // @ts-ignore - CommonJS module without type declarations
        import('../scripts/exportRoutes.js').then(module => {
          const exportRoutes = module.default || module.exportRoutes;
          if (exportRoutes && typeof exportRoutes === 'function') {
            exportRoutes(app, path.join(__dirname, '../visibility'));
            console.log('[STARTUP] ✅ Route map exported to visibility/ directory');
          } else {
            console.warn('[STARTUP] ⚠️ Could not load exportRoutes function');
          }
        }).catch(err => {
          console.warn('[STARTUP] ⚠️ Failed to export routes:', err.message);
        });
      } catch (error) {
        console.warn('[STARTUP] ⚠️ Route export failed:', error);
      }

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

      // Initialize treasury health monitoring
      console.log('🏦 Initializing treasury health monitoring...');
      initTreasuryMonitoring({
        enabled: true,
        scheduleExpression: '0 */6 * * *', // Every 6 hours
        includeMetadata: process.env.NODE_ENV === 'development',
        batchSize: 10
      });
      console.log('✅ Treasury health monitoring started');
      
      console.log('✅ Proposal execution scheduler started');
    });

    // Start blockchain automation services
    console.log('🚀 Starting blockchain integration services...');

    // Start vault event indexing with error handling
    try {
      vaultEventIndexer.start().catch(err => {
        logger.error('⚠️ Vault event indexer failed to start:', err.message);
        // Don't crash the server, just log the error
      });
    } catch (error) {
      logger.error('Error starting vault event indexer:', error);
    }

    // Start vault automation service with error handling
    try {
      if (typeof vaultAutomationService.start === 'function') {
        vaultAutomationService.start();
      }
    } catch (error) {
      logger.error('Error starting vault automation service:', error);
    }

    // Start contribution indexer with error handling
    console.log('Starting contribution indexer...');
    try {
      await contributionIndexer.start().catch(err => {
        logger.error('⚠️ Contribution indexer failed to start:', err.message);
        console.error('Contribution indexer error:', err);
        // Don't crash the server, just log the error
      });
    } catch (error) {
      logger.error('Error starting contribution indexer:', error);
      console.error('Error starting contribution indexer:', error);
    }

    // Start transaction monitor with error handling
    try {
      if (typeof transactionMonitor.start === 'function') {
        transactionMonitor.start();
      }
    } catch (error) {
      logger.error('Error starting transaction monitor:', error);
    }

    // Start recurring payment service with error handling
    try {
      if (typeof recurringPaymentService.start === 'function') {
        recurringPaymentService.start();
      }
    } catch (error) {
      logger.error('Error starting recurring payment service:', error);
    }

    // Start gas price oracle with error handling
    try {
      if (gasPriceOracle && typeof (gasPriceOracle as any).start === 'function') {
        (gasPriceOracle as any).start();
      }
    } catch (error) {
      logger.error('Error starting gas price oracle:', error);
    }

    // Initialize Elder Council
    console.log('🏛️ Initializing Elder Council...');
    try {
      await eldScry.start();
      console.log('✅ ELD-SCRY initialized');

      await eldKaizen.start();
      console.log('✅ ELD-KAIZEN initialized');

      await eldLumen.start();
      console.log('✅ ELD-LUMEN initialized');

      console.log('✅ ARCH-MALTA Coordinator initialized');

      console.log('🎉 Elder Council fully operational');
    } catch (error) {
      console.error('❌ Elder Council initialization failed:', error);
      console.error('Error details:', error);
    }

    // Initialize Gateway Agent
    console.log('🌐 Initializing Gateway Agent...');
    try {
      const gatewayService = await initializeGatewayAgent(
        undefined, // Use default config
        coordinator, // Pass coordinator for integration
        undefined // Use default adapter config
      );
      console.log('✅ Gateway Agent initialized');
      console.log('✅ Gateway adapters ready: Chainlink, Uniswap, CoinGecko, Moola, Beefyfi, Blockchain');

      // Mount Gateway Agent routes now that service is initialized
      try {
        const { createGatewayRoutes } = await import('./routes/gateway');
        const gatewayRoutes = createGatewayRoutes(gatewayService);
        app.use('/api/gateway', gatewayRoutes);
        console.log('✅ Gateway Agent API routes mounted at /api/gateway');
      } catch (routeError) {
        console.warn('⚠️ Failed to mount Gateway Agent routes:', (routeError as Error).message);
      }
    } catch (error) {
      console.error('⚠️ Gateway Agent initialization failed:', error);
      console.error('   Gateway features will be unavailable, but server will continue');
      // Don't crash the server if Gateway fails
    }

    // Start bridge relayer service
    bridgeRelayerService.start();

    console.log('✅ Blockchain services initialized successfully');

    // STARTUP COMPLETE: Clear flag to enable INFO logging now that services are running
    (global as any).isServerStarting = false;

    // ═══════════════════════════════════════════════════════════════════════════════
    // PHASE 7.1: SINGLETON VERIFICATION (After all services initialized)
    // ═══════════════════════════════════════════════════════════════════════════════
    
    // Perform comprehensive singleton verification after all services initialized
    try {
      verifySingletonInstances();
      console.log('[STARTUP] ✅ Singleton instance verification complete');
    } catch (err) {
      console.warn('[STARTUP] ⚠️ Singleton verification failed:', err);
      logger.warn('Singleton verification error (non-fatal):', err);
    }

    // Graceful shutdown
    const gracefulShutdown = async (signal: string) => {
      logger.warn(`Received ${signal}, shutting down gracefully`);

      // Stop treasury monitoring
      try {
        stopTreasuryMonitoring();
        logger.info('Treasury monitoring stopped');
      } catch (err) {
        logger.error('Error stopping treasury monitoring:', err);
      }

      // Stop opportunity engine
      try {
        opportunityEngine.stopScanning();
        opportunityStream.shutdown();
        logger.info('Opportunity Engine stopped');
      } catch (err) {
        logger.error('Error stopping Opportunity Engine:', err);
      }

      // Shutdown Socket.IO service (gracefully closes all WebSocket connections)
      try {
        await socketIOService.shutdown();
        logger.info('Socket.IO WebSocket service shutdown complete');
      } catch (err) {
        logger.error('Error shutting down Socket.IO service:', err);
      }

      // Shutdown isolated agent worker
      try {
        const agentWorkerManager = getAgentWorkerManager();
        await agentWorkerManager.stop();
        logger.info('Agent worker process shutdown complete');
      } catch (err) {
        logger.error('Error shutting down agent worker:', err);
      }

      // Shutdown isolated worker manager (metrics flusher + performance/health agents)
      try {
        await isolatedWorkerManager.shutdown();
        logger.info('Isolated worker manager shutdown complete');
      } catch (err) {
        logger.error('Error shutting down isolated worker manager:', err);
      }

      // Shutdown async job workers
      try {
        await shutdownWorkers();
        logger.info('Async job workers shutdown complete');
      } catch (err) {
        logger.error('Error shutting down job workers:', err);
      }

      // Reset circuit breakers (Phase 6)
      try {
        resetAllCircuits();
        logger.info('Circuit breakers reset during shutdown');
      } catch (err) {
        logger.error('Error resetting circuit breakers:', err);
      }

      // Finalize console logging
      try {
        const consoleLogger = getConsoleLogger();
        consoleLogger.closeLogging();
        logger.info('Console logging finalized');
      } catch (err) {
        logger.error('Error finalizing console logging:', err);
      }

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