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
// Dev-only Vite helpers are dynamically imported later to avoid bundling Vite into the production server build
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
import metricsRegister, { metricsEndpoint } from './utils/metrics';
import { ProposalExecutionService } from './proposalExecutionService';
import { vaultEventIndexer } from './vaultEventsIndexer';
import { ScheduledAggregationJobs } from './services/metricsAggregationService';
import { vaultAutomationService } from './vaultAutomation';
import { activityTracker } from './middleware/activityTracker';
import { bridgeRelayerService } from './services/bridgeRelayerService';
import { performanceMonitor } from './middleware/performance';

// Route Imports
import paymentReconciliationRoutes from './routes/payment-reconciliation';
import healthRoutes from './routes/health';
import analyticsRoutes from './routes/analytics';
import notificationRoutes from './routes/notifications';
import systemRoutes from './routes/system';
import proposalExecutionRouter from './routes/proposal-execution';
import pollProposalsRouter from './routes/poll-proposals';
import jobHealthRoutes from './routes/jobHealthRoutes';
import './middleware/validation'; 
import { ReputationService } from './reputationService'; 
import { authenticate, isAuthenticated, refreshTokenHandler, logoutHandler, authUserHandler, authLoginHandler, authRegisterHandler } from './auth';
import reputationRoutes from './routes/reputation'; 
import operationalFrameworkRoutes from './routes/admin/operational-framework';
import healthAdminRoutes from './routes/admin/health';
import kotaniPayStatusRoutes from './routes/kotanipay-status';
import mpesaStatusRoutes from './routes/mpesa-status';
import stripeStatusRoutes from './routes/stripe-status';
import referralsRoutes from './routes/referrals';
import eventsRoutes from './routes/events';
import treasuryManagementRoutes from './routes/treasuryManagement'; 
import multisigRoutes from './routes/multisig'; 
import userPreferencesRoutes from './routes/user-preferences';
import jwt from 'jsonwebtoken';
import nftMarketplaceRouter from './routes/nft-marketplace';
import paymentGatewayRoutes from './routes/payment-gateway';
import kycRouter from './routes/kyc';
import referralRewardsRouter from './routes/referral-rewards';
import economyRouter from './routes/economy';
import morioRoutes from './routes/morio';
// ✅ Removed: morioDataHubRoutes and morioElderInsightsRoutes (now mounted internally via morio.ts)
import jobRoutes from './routes/jobs';
import websocketMonitoringRoutes from './routes/websocket-monitoring';
import logsRoutes from './routes/logs';
import publicStatsRoutes from './routes/public-stats';
import analyzerRoutes from './routes/analyzer';
import defenderRoutes from './routes/defender'; 
import exchangeRoutes from './routes/exchanges'; 
import featureAnalyticsRoutes from './routes/featureAnalytics';
import graphPropagationRoutes from './routes/graph-propagation'; 
import personasRouter from './routes/personas';
import paymentRequestsRoutes from './routes/payment-requests';
import dexScreenerRoutes from './routes/dex-screener'; 
import amaraRoutes from './routes/amara'; 
import strategiesRouter from './routes/v1/yuki/strategies'; 
import adminConsolidated from './routes/adminConsolidated'; 

// Core & Advanced Infrastructure Services
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
import { marketStreamService } from './services/marketStreamService';
import { pool, waitForDatabase } from './db';
import { startPriceCollectionJob } from './services/cexPriceBackgroundJob';
import { marketUniverseBuilder } from './services/marketUniverseBuilder';
import { tokenDiscoveryService } from './services/tokenDiscoveryService';
import { initTreasuryMonitoring, stopTreasuryMonitoring } from './services/treasury-monitoring.service';
import { startRotationEventListener } from './services/rotation_listener';
import { startAchievementListener } from './services/achievement_listener';
import { startRewardsBatchWorker } from './services/rewards_batch_worker';
import { schemaValidator } from './utils/schemaValidator';
import { runAllMigrations } from './db/migrations';
import { graphPropagationEngine, initializeNode } from './services/graphPropagationEngine';
import { ohlcvPropagationAdapter } from './services/ohlcvPropagationAdapter';
import { technicalAnalysisPropagationAdapter } from './services/technicalAnalysisPropagationAdapter';
import { nuruPropagationAdapter } from './services/nuruPropagationAdapter';
import { propagationMonitoringService } from './services/propagationMonitoringService';
import { productionHardeningService, circuitBreaker } from './services/productionHardeningService';
import { createRouteUsageLogger } from './middleware/routeUsageLogger';
import { SystemVisibility } from './middleware/systemVisibility';
import { externalAPITracker } from './services/externalAPITracker';
import { setupDefenderAgent } from './middleware/defender-setup';
import { initializeSystemMonitoring } from './utils/systemHealthMonitor';
import createDiagnosticsRouter from './utils/diagnosticsAPI';
import { executeGuardedJob } from './utils/jobExecutionGuard';
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
import {  
  verifySingletonInstances,
  getSingletonHealthStatus
} from './utils/singletonVerifier';
import { metricsMiddleware, startMetricsReporting } from './middleware/metricsMiddleware';
import apiRegistryRoutes from './routes/apiRegistry';
import { getAgentWorkerManager } from './workers/agent-worker-manager';
import { isolatedWorkerManager } from './services/IsolatedWorkerManager';
import { PerformanceOptimizerBufferedWriter } from './services/PerformanceOptimizerBufferedWriter';
import { assetGraphService } from './services/assetGraphService'; 
import { strategyDashboardService } from './services/strategyDashboardService'; 
import { cacheService } from './services/cacheService';
import { ExecutionTrackingService } from './services/executionTrackingService';
import { contributionIndexer } from './services/contributionIndexerService';
import { initializeAutoPromotionJob } from './jobs/auto-promotion';
import { initializePaymentRequestExpirationJob } from './jobs/payment-request-expiration';
import { initRetentionJob } from './jobs/retention';
import swaggerMiddleware from './middleware/swaggerMiddleware';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();

// Setup early process global diagnostics error catchers
setupProcessErrorHandlers();

if (process.listenerCount('unhandledRejection') === 0) {
  process.on('unhandledRejection', (reason: Error | string) => {
    const message = reason instanceof Error ? reason.message : String(reason);
    if (message.includes('TIMEOUT') || message.includes('timeout') || message.includes('network') || message.includes('JsonRpcProvider')) {
      logger.warn(`⚠️ Blockchain RPC timeout (non-critical): ${message}`);
      return; 
    }
    logger.error('Unhandled Promise Rejection:', {
      reason: message,
      stack: reason instanceof Error ? reason.stack : undefined
    });
  });
}

const server = createServer(app);
const io = new SocketIOServer(server, {
  cors: corsConfig,
  allowEIO3: true,
});

app.set('trust proxy', 1);

const compressionMiddleware = compression({
  level: 6,
  threshold: 1024,
  filter: (req: Request, res: Response) => {
    const contentType = res.getHeader('Content-Type') as string || '';
    if (contentType.includes('image/') || contentType.includes('video/') || contentType.includes('application/zip') || contentType.includes('application/pdf')) {
      return false;
    }
    return compression.filter(req, res);
  }
});

const allowedOrigins = (
  process.env.ALLOWED_ORIGINS?.split(',') || [
    'http://localhost:5000',
    'http://localhost:5173',
    'http://localhost:8080',
    'https://mtaadao.com',
    'https://www.mtaadao.org',  
    'https://app.mtaadao.com',
  ]
).map(origin => origin.trim());

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    console.warn(`[CORS] Blocked request from unauthorized origin: ${origin}`);
    callback(new Error('CORS policy violation'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  maxAge: 86400
}));

app.use(sanitizeInput);
app.use(preventSqlInjection);
app.use(preventXSS);
app.use(auditMiddleware);
setupOperationalAuditLogging(app);
app.use(compressionMiddleware);
app.use(performanceMonitor(1000));

app.use(metricsCollector.requestMiddleware());
(app as any).locals = (app as any).locals || {};
(app as any).locals.metricsCollectorMounted = true;

app.use(activityTracker());
app.use(createRouteUsageLogger(path.join(__dirname, '../visibility/route-usage.csv')));
app.use('/api', circuitBreakerMiddleware);

const systemVisibility = new SystemVisibility(app, path.join(__dirname, '../visibility'));

if (typeof (externalAPITracker as any).initialize === 'function') {
  (externalAPITracker as any).initialize();
}

import { getSocketIOService } from './services/SocketIOWebSocketService';
const socketIOService = getSocketIOService(server);
app.locals.socketIOService = socketIOService;

opportunityStream.initialize(server);
marketStreamService.initialize(server);

const userSockets = new Map();

io.use(async (socket: any, next) => {
  try {
    const token = socket.handshake.query.token || socket.handshake.auth?.token;
    if (!token) {
      socket.userId = null;
      return next();
    }
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      logger.error('JWT_SECRET not configured — rejecting Socket.IO authentication');
      socket.userId = null;
      return next();
    }
    const decoded = jwt.verify(token, jwtSecret) as any;
    socket.userId = decoded.userId || decoded.id;
    next();
  } catch (error) {
    socket.userId = null;
    next();
  }
});

io.on('connection', (socket: any) => {
  if (socket.userId) {
    userSockets.set(socket.userId, socket.id);
    socket.join(`user_${socket.userId}`);
  }
  socket.on('authenticate', (userId: string) => {
    socket.userId = userId;
    userSockets.set(userId, socket.id);
    socket.join(`user_${userId}`);
  });
  socket.on('disconnect', () => {
    if (socket.userId) userSockets.delete(socket.userId);
  });
});

notificationService.on('notification_created', (data) => {
  io.to(`user_${data.userId}`).emit('new_notification', data);
});

app.locals.socketIO = io;

// Injected Tracking Custom JSON Capture Logger Middleware
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
      if (capturedJsonResponse) logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      if (logLine.length > 80) logLine = logLine.slice(0, 79) + "…";
      logger.info(logLine);
    }
  });
  next();
});

// Dynamic Route Registry Definitions 
const router = express.Router();
router.use('/payment-reconciliation', paymentReconciliationRoutes);
router.use('/health', healthRoutes);
router.use('/analytics', analyticsRoutes);
router.use('/notifications', notificationRoutes);
router.use('/system', systemRoutes);
router.use('/proposal-execution', proposalExecutionRouter);
router.use('/poll-proposals', pollProposalsRouter);
router.use('/job-health', jobHealthRoutes);
router.use('/reputation', reputationRoutes);
router.use('/admin/health', healthAdminRoutes);
router.use('/kotanipay-status', kotaniPayStatusRoutes);
router.use('/mpesa-status', mpesaStatusRoutes);
router.use('/stripe-status', stripeStatusRoutes);
router.use('/referrals', referralsRoutes);
router.use('/events', eventsRoutes);
router.use('/treasury-management', treasuryManagementRoutes);
router.use('/multisig', multisigRoutes);
router.use('/user-preferences', userPreferencesRoutes);
router.use('/nft-marketplace', nftMarketplaceRouter);
router.use('/payment-gateway', paymentGatewayRoutes);
router.use('/kyc', kycRouter);
router.use('/referral-rewards', referralRewardsRouter);
router.use('/economy', economyRouter);
// MORIO CONSOLIDATED: data-hub and elder-insights now mounted as /morio/data-hub and /morio/elder-insights
router.use('/morio', morioRoutes);
router.use('/jobs', jobRoutes);
router.use('/websocket-monitoring', websocketMonitoringRoutes);
router.use('/logs', logsRoutes);
router.use('/public-stats', publicStatsRoutes);
router.use('/analyzer', analyzerRoutes);
router.use('/defender', defenderRoutes);
router.use('/exchanges', exchangeRoutes);
// ⚠️ CONSOLIDATED ROUTES (now mounted at /api/* in app.use() section):
//  - /feature-analytics → /api/features (line ~1231)
//  - /graph-propagation → /api/propagation (line ~1233)
//  - /dex-screener → /api/dex (line ~1267)
//  - /api-registry → /api/docs (line ~1317)
// Deprecation redirects added to server/routes.ts for backwards compatibility
router.use('/personas', personasRouter);
router.use('/payment-requests', paymentRequestsRoutes);
router.use('/amara', amaraRoutes);
router.use('/admin-consolidated', adminConsolidated);

app.use('/api', router);

// Expose Prometheus metrics endpoint
app.get('/metrics', async (_req, res) => {
  try {
    const body = await metricsEndpoint();
    res.set('Content-Type', metricsRegister.contentType);
    res.send(body);
  } catch (err) {
    res.status(500).send('Failed to collect metrics');
  }
});

// Mount core application routers via default generator pipeline
// Route registration is performed later in the async startup block with the HTTP server instance

// Fallback error-handling mappings
app.use(notFoundHandler);
app.use(errorHandler);

console.log('[STARTUP] Starting async initialization lifecycle...');

// Global process exception bindings
if (process.listenerCount('unhandledRejection') === 0) {
  process.on('unhandledRejection', (reason, promise) => {
    logger.error('🚨 Unhandled Promise Rejection:', {
      reason: reason instanceof Error ? reason.message : String(reason),
      stack: reason instanceof Error ? reason.stack : undefined,
      promise: String(promise),
    });
  });
}

process.on('uncaughtException', (error) => {
  logger.error('🚨 Uncaught Exception:', { message: error.message, stack: error.stack });
  setTimeout(() => { process.exit(1); }, 1000);
});

(global as any).isServerStarting = true;

// ═══════════════════════════════════════════════════════════════════════════════
// ASYNC INITIALIZATION BLOCK (STAGE A TO STAGE E)
// ═══════════════════════════════════════════════════════════════════════════════
(async () => {
  try {
    const consoleLogger = initializeConsoleLogger();
    console.log('[STARTUP] Console logging to:', consoleLogger.getCurrentLogPath());
    console.log('[STARTUP] Initializing server database connections...');
    
    // STAGE A: REDIS CACHING GATEWAY HANDSHAKE (BLOCKING TIMEOUT)
    console.log('[STARTUP] Connecting to Redis...');
    const { redis } = await import('./services/redis');
    try {
      await Promise.race([
        redis.connect(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Redis connect timeout')), 5000))
      ]);
      console.log('[STARTUP] ✅ Redis connected successfully');
      try {
        const { loadFeatureOverrides } = await import('./services/featureService');
        if (typeof loadFeatureOverrides === 'function') {
          await loadFeatureOverrides();
          logger.info('[STARTUP] ✅ Feature overrides loaded from Redis');
        }
      } catch (e) {
        logger.warn('[STARTUP] Could not load feature overrides from Redis', e as any);
      }
    } catch (redisErr) {
      console.warn('[STARTUP] Redis unavailable - falling back to internal in-memory system storage matrices.', redisErr instanceof Error ? redisErr.message : redisErr);
    }
    const migrationResult: any = await runAllMigrations();
    if (migrationResult?.success) {
      logger.info('[STARTUP] ✅ Database migrations completed successfully');
      try {
        initRetentionJob();
        logger.info('[STARTUP] ✅ Retention job initialized');
      } catch (e) {
        logger.warn('[STARTUP] Retention job failed to initialize:', e instanceof Error ? e.message : e);
      }
    } else {
      logger.warn('[STARTUP] Database migrations completed with baseline environment warnings', { errors: migrationResult.errors });
      try {
        initRetentionJob();
      } catch (e) {}
    }

    console.log('[STARTUP] Validating database schema...');
    const schemaValid = await schemaValidator.validateDatabaseSchema();
    if (!schemaValid) {
      logger.error('[STARTUP] ❌ Database schema validation failed. Re-executing structure sync migrations...');
      await runAllMigrations();
    } else {
      logger.info('[STARTUP] ✅ Database schema validation passed');
    }

    // STAGE C: CONSOLIDATED SUBSYSTEMS (CIRCUIT BREAKERS, SAGAS, SINGLETONS)
    console.log('[STARTUP] Initializing consolidated systems...');
    const { circuitBreakerRegistry } = await import('./core/consolidation/CircuitBreakerConsolidation');
    const { healthRegistry } = await import('./core/consolidation/HealthRegistryConsolidation');
    const { cacheManager } = await import('./core/consolidation/DataCacheConsolidation');
    const { paymentRecoverySAGA } = await import('./services/PaymentRecoverySAGAOrchestrator');
    
    if (circuitBreaker) {
      const apiBreakerConfig = {
        name: 'api-calls',
        domain: 'media' as const,
        failureThreshold: 5,
        resetTimeout: 60000,
        monitoringWindow: 60000,
        ...circuitBreaker
      };
      circuitBreakerRegistry.getOrCreate('api-calls', 'media', apiBreakerConfig);
      logger.info('[STARTUP] ✅ Circuit Breaker registry system loaded.');
    }
    
    if (healthRegistry) logger.info('[STARTUP] ✅ Health Registry initialized');
    if (cacheManager) logger.info('[STARTUP] ✅ Data Cache Manager initialized');
    if (paymentRecoverySAGA) logger.info('[STARTUP] ✅ Payment Recovery SAGA Orchestrator initialized');

    console.log('[STARTUP] Running Phase 7.1 System Singleton Verification...');
    const verification: any = await verifySingletonInstances();
    if (!verification?.success) {
      logger.error('❌ Critical Singleton Conflict Matrix found during startup phase verification:', verification?.errors);
    } else {
      logger.info('✅ Singleton instances verification check passed.');
    }

    // STAGE D: CORE BACKGROUND WORKERS & SCHEDULERS
    console.log('[STARTUP] Initializing backup system...');
    const backupConfig = {
      enabled: process.env.BACKUPS_ENABLED === 'true',
      schedule: '0 2 * * *', 
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

    setupWeeklyRewardsDistribution();
    setupInvestmentPoolsAutomation();
    initializeAutoPromotionJob();
    initializePaymentRequestExpirationJob();
    ScheduledAggregationJobs.initializeScheduledJobs();
    // Start on-chain RotationModule event listener to reconcile rotation cycles
    try {
      startRotationEventListener();
      logger.info('[STARTUP] ✅ Rotation event listener started');
    } catch (err) {
      logger.warn('[STARTUP] Rotation event listener failed to start:', err);
    }

    try {
      startAchievementListener();
      logger.info('[STARTUP] ✅ Achievement event listener started');
    } catch (err) {
      logger.warn('[STARTUP] Achievement event listener failed to start:', err);
    }

    try {
      startRewardsBatchWorker();
      logger.info('[STARTUP] ✅ Rewards batch worker started');
    } catch (err) {
      logger.warn('[STARTUP] Rewards batch worker failed to start:', err);
    }
    
    // Agent Payment Gateway indexer for intelligence dashboards
    try {
      const { agentPaymentIndexer } = await import('./services/AgentPaymentIndexer');
      await agentPaymentIndexer.start();
      logger.info('[STARTUP] ✅ AgentPaymentIndexer started');
    } catch (err) {
      logger.warn('[STARTUP] AgentPaymentIndexer failed to start:', err);
    }

    // STAGE E: AGENT NETWORK & REAL-TIME INGESTION STREAM AUTOMATION 
    console.log('[STARTUP] Spawning decoupled agent networks and running graph adaptors...');
    try {
      // initializeNode is called later with explicit node ids; skip no-arg invocation here
      await (graphPropagationEngine as any)?.initialize?.();
      (ohlcvPropagationAdapter as any)?.initialize?.();
      (technicalAnalysisPropagationAdapter as any)?.initialize?.();
      (nuruPropagationAdapter as any)?.initialize?.();
      await (propagationMonitoringService as any)?.initialize?.();
      logger.info('✅ Graph Propagation Cluster engine nodes mapped seamlessly');
    } catch (graphError) {
      logger.error('[STARTUP] Non-fatal exception occurred spinning up graph propagation instances:', graphError);
    }
    
    // (Deferred background job startup moved later to ensure single server.listen)
    // NOTE: Deferred until HTTP server is listening to ensure network interfaces and cache
    // subsystems are fully available. Will be started after `server.listen` below.
    const _deferStartOpportunityEngine = true;
    const _opportunityEngineScanIntervalMs = 10000;

    // Initialize CEX Price Background Job (for SmartRouter)
    // NOTE: Defer starting price collection until after server is listening to avoid
    // race with cache/redis initialization.
    const _deferStartPriceJob = true;
    const _pendingPriceJobConfig = {
      collectionIntervalSeconds: 30,
      maxConcurrentExchanges: 6,
      tradingPairs: [
        'BTC/USDT', 'ETH/USDT', 'USDC/USDT', 'USDT/USDT',
        'DAI/USDT', 'cUSD/USDT', 'cEUR/USDT', 'CELO/USDT',
        'MATIC/USDT', 'AAVE/USDT', 'LINK/USDT', 'UNI/USDT', 'BNB/USDT'
      ],
    };

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

    // Initialize Token Discovery unified universe (resilient startup with local fallback)
    console.log('[STARTUP] Initializing Token Discovery unified universe (with local fallback)...');
    try {
      await tokenDiscoveryService.buildUnifiedUniverse();
      logger.info('[STARTUP] ✅ Token universe built successfully');
    } catch (error) {
      logger.error('[STARTUP] Failed to build fresh universe, loading local fallback cache...', error);
      try {
        await tokenDiscoveryService.loadFallbackUniverse();
        logger.info('[STARTUP] ✅ Loaded fallback token universe cache');
      } catch (fallbackErr) {
        logger.error('[STARTUP] Failed to load fallback universe cache:', fallbackErr);
      }
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
          const migrationResult: any = await runAllMigrations();
          if (migrationResult?.success) {
            logger.info('[STARTUP] ✅ Database migrations completed successfully');
          } else {
            logger.error('[STARTUP] ⚠️ Some migrations had warnings:', migrationResult?.errors);
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
      // Schedule periodic flush of buffered metrics (uses guarded job to avoid overlaps)
      const FLUSH_INTERVAL_MS = parseInt(process.env.PERF_BUFFER_FLUSH_MS || '300000'); // default 5 minutes
      const performFlush = async () => {
        await executeGuardedJob('perf:flush', async () => {
          await PerformanceOptimizerBufferedWriter.flushBufferedMetricsToDB();
        }, { timeout: 120000 });
      };

      // Run initial flush in background and schedule recurring flushes
      performFlush().catch(err => logger.warn('[BufferedWriter] Initial flush failed', err));
      setInterval(() => {
        performFlush().catch(err => logger.error('[BufferedWriter] Scheduled flush failed', err));
      }, FLUSH_INTERVAL_MS);
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

    // Mount Swagger API Documentation at /api-docs
    console.log('[STARTUP] Setting up Swagger API documentation...');
    app.use('/api-docs', swaggerMiddleware);
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
    if (!(app as any).locals?.routesRegistered) {
      app.get('/api/visibility/report', isAuthenticated, requireRole('super_admin'), asyncHandler(async (req: Request, res: Response) => {
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
    } else {
      console.log('[STARTUP] Skipping duplicate mount: /api/visibility/report (handled by registerRoutes)');
    }

    // System Visibility summary endpoint
    if (!(app as any).locals?.routesRegistered) {
      app.get('/api/visibility/summary', isAuthenticated, requireRole('super_admin'), asyncHandler(async (req: Request, res: Response) => {
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
    } else {
      console.log('[STARTUP] Skipping duplicate mount: /api/visibility/summary (handled by registerRoutes)');
    }

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

    // Admin endpoint to reset all circuits (Phase 6)
    app.post(
      '/api/admin/circuits/reset',
      isAuthenticated,
      requireRole('super_admin'),
      asyncHandler(async (req: Request, res: Response) => {
        try {
          resetAllCircuits();
          res.json({ success: true, message: 'All circuits reset' });
        } catch (error) {
          logger.error('Failed to reset circuits:', error);
          res.status(500).json({ success: false, error: (error as Error).message });
        }
      })
    );

    // Admin endpoint: singleton health status (Phase 7.1)
    app.get(
      '/api/admin/singletons',
      isAuthenticated,
      requireRole('super_admin'),
      asyncHandler(async (req: Request, res: Response) => {
        try {
          const status = getSingletonHealthStatus();
          res.json({ success: true, data: status });
        } catch (error) {
          logger.error('Failed to get singleton health status:', error);
          res.status(500).json({ success: false, error: (error as Error).message });
        }
      })
    );

    // Admin endpoints for PerformanceOptimizerBufferedWriter (buffered metrics)
    app.get(
      '/api/admin/metrics/buffered',
      isAuthenticated,
      requireRole('super_admin'),
      asyncHandler(async (req: Request, res: Response) => {
        try {
          const status = await PerformanceOptimizerBufferedWriter.getBufferedMetricsStatus();
          res.json({ success: true, data: status });
        } catch (error) {
          logger.error('Failed to get buffered metrics status:', error);
          res.status(500).json({ success: false, error: (error as Error).message });
        }
      })
    );

    app.post(
      '/api/admin/metrics/buffered/clear',
      isAuthenticated,
      requireRole('super_admin'),
      asyncHandler(async (req: Request, res: Response) => {
        try {
          await PerformanceOptimizerBufferedWriter.clearAllBuffers();
          res.json({ success: true, message: 'Buffered metrics cleared' });
        } catch (error) {
          logger.error('Failed to clear buffered metrics:', error);
          res.status(500).json({ success: false, error: (error as Error).message });
        }
      })
    );

    // Error Classification Endpoint (Phase 6) - For debugging and monitoring (admin only)
    if (!(app as any).locals?.routesRegistered) {
      app.post('/api/debug/classify-error', isAuthenticated, requireRole('super_admin'), asyncHandler(async (req: Request, res: Response) => {
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
    } else {
      console.log('[STARTUP] Skipping duplicate mount: /api/debug/classify-error (handled by registerRoutes)');
    }

    // Add API routes
    app.use('/api/payments/kotanipay', kotaniPayStatusRoutes);
    app.use('/api/payments/mpesa', mpesaStatusRoutes);
    app.use('/api/payments/stripe', stripeStatusRoutes);
    // reconciliation moved to admin namespace (see below)
    app.use('/api/treasury-management', isAuthenticated, requireDAORole('admin', 'owner'), treasuryManagementRoutes); // PHASE 2: Treasury whitelist & limits
    app.use('/api/multisig', isAuthenticated, requireDAORole('admin', 'owner'), multisigRoutes); // PHASE 2: Multisig approval workflows
    if (!(app as any).locals?.routesRegistered) {
      app.use('/api/analytics', isAuthenticated, analyticsRoutes);
    } else {
      console.log('[STARTUP] Skipping duplicate mount: /api/analytics (handled by registerRoutes)');
    }
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
    if (!(app as any).locals?.routesRegistered) {
      app.use('/api/reputation', isAuthenticated, requireDAORole('member', 'admin', 'owner'), reputationRoutes); // Added reputation routes
    } else {
      console.log('[STARTUP] Skipping duplicate mount: /api/reputation (handled by registerRoutes)');
    }
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
    if (!(app as any).locals?.routesRegistered) {
      app.use('/api/morio', isAuthenticated, morioRoutes);
    } else {
      console.log('[STARTUP] Skipping duplicate mount: /api/morio (handled by registerRoutes)');
    }
    app.use('/api/personas', isAuthenticated, personasRouter);
    app.use('/api/public-stats', publicStatsRoutes);
    // Treasury intelligence routes moved to v1 API
    app.use('/api/analyzer', isAuthenticated, requireRole('super_admin'), analyzerRoutes);
    app.use('/api/dashboard', isAuthenticated, amaraRoutes); // 🎨 Amara Dashboard routes
    // ✅ V1 STRATEGY ROUTES (Modular Architecture - Phase 2)
    // Require authentication for strategies endpoints
    app.use('/api/v1/strategies', isAuthenticated, strategiesRouter); // 📈 V1 Strategies (core CRUD + execution + social)
    // ✅ CONSOLIDATED ADMIN ROUTES (Phase 1 - Migration Complete)
    // Requires authentication + superuser role
    app.use('/api/admin', isAuthenticated, requireRole('super_admin'), adminConsolidated); // 👤 Admin operations + AI monitoring (UNIFIED)
    app.use('/api/defender', isAuthenticated, requireRole('super_admin'), defenderRoutes); // Registered defender routes
    if (!(app as any).locals?.routesRegistered) {
      app.use('/api/exchanges', isAuthenticated, exchangeRoutes); // CCXT Service - Phase 1
    } else {
      console.log('[STARTUP] Skipping duplicate mount: /api/exchanges (handled by registerRoutes)');
    }
    app.use('/api/features', isAuthenticated, requireRole('super_admin'), featureAnalyticsRoutes); // Feature tracking and analytics
    if (!(app as any).locals?.routesRegistered) {
      app.use('/api/propagation', isAuthenticated, requireRole('super_admin'), graphPropagationRoutes); // Graph Propagation Engine (Phase B & C)
    } else {
      console.log('[STARTUP] Skipping duplicate mount: /api/propagation (handled by registerRoutes)');
    }

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

    // Job monitoring and health check routes (secure under /api/admin/jobs)
    if (!(app as any).locals?.routesRegistered) {
      app.use('/api/admin/jobs', isAuthenticated, requireRole('super_admin'), jobHealthRoutes);
    } else {
      console.log('[STARTUP] Skipping duplicate mount: /api/admin/jobs (handled by registerRoutes)');
    }

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
    if (!(app as any).locals?.routesRegistered) {
      app.post('/api/auth/login', authLoginHandler);
      app.post('/api/auth/register', authRegisterHandler);
      app.post('/api/auth/refresh-token', refreshTokenHandler);
      app.post('/api/auth/logout', logoutHandler);
    } else {
      console.log('[STARTUP] Skipping duplicate mount: /api/auth/* (handled by registerRoutes)');
    }

    // Real-time API metrics and registry endpoints (agent-friendly)
    app.use('/api/docs', apiRegistryRoutes);
    logger.info('✅ Real-time API registry endpoints mounted at /api/docs/stats/*');

    // System diagnostics endpoints (event loop saturation detection)
    app.use('/api', createDiagnosticsRouter());
    logger.info('✅ System diagnostics endpoints mounted at /api/diagnostics/*');

    // Setup Vite dev server or serve static files
    if (env.NODE_ENV === "development") {
      try {
        const { setupVite } = await import('./vite');
        await setupVite(app, server);
      } catch (err) {
        logger.warn('⚠️ Dev Vite setup failed:', err);
      }
    } else {
      try {
        const { serveStatic } = await import('./vite');
        serveStatic(app);
      } catch (err) {
        logger.warn('⚠️ serveStatic import failed:', err);
      }
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

    // NOTE: job and monitoring routes are mounted centrally in routes.ts
    // Skipping duplicate mounts here to avoid route duplication and ordering issues
    logger.info('✅ Skipping duplicate /api/jobs and /api/monitoring mounts (handled by registerRoutes)');

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

      // Start deferred background jobs that require network/cache to be hot
      (async () => {
        if (typeof _deferStartOpportunityEngine !== 'undefined' && _deferStartOpportunityEngine) {
          try {
            await opportunityEngine.startScanning(_opportunityEngineScanIntervalMs);
            logger.info('✅ Opportunity Engine started (deferred)');
          } catch (err) {
            logger.error('Failed to start Opportunity Engine (deferred):', err);
          }
        }

        if (typeof _deferStartPriceJob !== 'undefined' && _deferStartPriceJob) {
          try {
            // Build dynamic trading pairs universe from configured exchanges
            try {
              const { symbolUniverseService } = await import('./services/symbolUniverseService');
              const cexConfig: Record<string, any> = { binance: { enabled: true }, kraken: { enabled: true }, coinbase: { enabled: true }, bybit: { enabled: true }, kucoin: { enabled: true }, okx: { enabled: true } };
              const exchanges = Object.keys(cexConfig).filter((e: string) => cexConfig[e]?.enabled);
              
              // Explicitly build universe upfront with stats logging
              await marketUniverseBuilder.buildUniverse(exchanges);
              const stats = marketUniverseBuilder.getStats();
              logger.info(
                `[STARTUP] Market Universe Built: ${stats.total} total assets, ` +
                `${stats.arbitrageEligible} arb-eligible (2+ exchanges), ` +
                `${stats.withMetadata} with metadata, age: ${stats.ageMs}ms`
              );
              
              // Now get dynamic trading pairs
              const pairs = await symbolUniverseService.getArbitrageEligiblePairs({ minExchanges: 2, preferredQuote: 'USDT', limit: 200 });
              if (pairs && pairs.length > 0) {
                _pendingPriceJobConfig.tradingPairs = pairs;
                logger.info(`[STARTUP] Using dynamic tradingPairs for price job (${pairs.length} pairs)`);
              } else {
                logger.warn('[STARTUP] No dynamic tradingPairs found - falling back to static pending list');
              }
            } catch (e) {
              logger.warn('[STARTUP] Failed to build dynamic tradingPairs:', e instanceof Error ? e.message : e);
            }

            await startPriceCollectionJob(pool, _pendingPriceJobConfig);
            logger.info('✅ CEX Price Background Job initialized (deferred)');
          } catch (err) {
            logger.error('Failed to initialize CEX Price Background Job (deferred):', err);
          }
        }
        // Start SAGA reconciliation job (background)
        try {
          const { startSagaReconciliationJob } = await import('./jobs/sagaReconciliationJob');
          const { startSagaWorker } = await import('./queues/sagaQueue');
          // start worker first to process enqueued jobs
          startSagaWorker();
          startSagaReconciliationJob();
          logger.info('✅ SAGA reconciliation job scheduled (background)');
        } catch (err) {
          logger.error('Failed to initialize SAGA reconciliation job:', err);
        }
        // Start webhook reconciliation worker (periodic catch-up for missed webhooks)
        try {
          const { startWebhookReconciliationWorker } = await import('./workers/webhookReconciliationWorker');
          startWebhookReconciliationWorker();
          logger.info('✅ Webhook reconciliation worker started (background)');
        } catch (err) {
          logger.error('Failed to initialize webhook reconciliation worker:', err);
        }
      })();
      
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

      // Close PostgreSQL pool to free database connections
      try {
        await pool.end();
        logger.info('PostgreSQL pool closed successfully');
      } catch (err) {
        logger.error('Error while closing PostgreSQL pool during shutdown:', err);
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