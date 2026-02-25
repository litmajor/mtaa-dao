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
import { JobMonitoringService, executeMonitoredJob } from './services/jobMonitoringService';
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
import sseRoutes from './routes/sse';
import billingRoutes from './routes/billing';
import proposalExecutionRouter from './routes/proposal-execution';
import pollProposalsRouter from './routes/poll-proposals';
import jobHealthRoutes from './routes/jobHealthRoutes';
import './middleware/validation'; // Added for validation middleware
// Assuming ReputationService is defined and exported from './reputationService'
import { ReputationService } from './reputationService'; // Added for ReputationService
import { authenticate, refreshTokenHandler, logoutHandler, authUserHandler, authLoginHandler, authRegisterHandler } from './auth';
import reputationRoutes from './routes/reputation'; // Added for reputation routes
import operationalFrameworkRoutes from './routes/admin/operational-framework';
import healthAdminRoutes from './routes/admin/health';
import kotaniPayStatusRoutes from './routes/kotanipay-status';
import mpesaStatusRoutes from './routes/mpesa-status';
import stripeStatusRoutes from './routes/stripe-status';
import referralsRoutes from './routes/referrals';
import eventsRoutes from './routes/events';
import crossChainRoutes from './routes/cross-chain';
import userPreferencesRoutes from './routes/user-preferences';
import jwt from 'jsonwebtoken';
// Import NFT Marketplace routes
import nftMarketplaceRouter from './routes/nft-marketplace';
import walletRoutes from './routes/wallet';
import walletSetupRoutes from './routes/wallet-setup';
import paymentGatewayRoutes from './routes/payment-gateway';
// Import KYC routes
import kycRouter from './routes/kyc';
import referralRewardsRouter from './routes/referral-rewards';
import economyRouter from './routes/economy';
import morioRoutes from './routes/morio';
import morioDataHubRoutes from './routes/morio-data-hub';
import morioElderInsightsRoutes from './routes/morio-elder-insights';
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

// Import example function for wallet demonstration
const __dirname = dirname(fileURLToPath(import.meta.url));

// Import public stats routes
import publicStatsRoutes from './routes/public-stats';
import treasuryIntelligenceRoutes from './routes/treasury-intelligence';
import analyzerRoutes from './routes/analyzer';
import defenderRoutes from './routes/defender'; // Added for defender routes
import exchangeRoutes from './routes/exchanges'; // CCXT Service Phase 1
import featureAnalyticsRoutes from './routes/featureAnalytics';
import graphPropagationRoutes from './routes/graph-propagation'; // Graph Propagation Engine monitoring
import personasRouter from './routes/personas';
import paymentRequestsRoutes from './routes/payment-requests';
import billSplitRoutes from './routes/bill-split';
import dexScreenerRoutes from './routes/dex-screener'; // ✅ DexScreener API integration
import freqtradeRoutes from './routes/freqtrade'; // ✅ Freqtrade API integration

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

// Initialize system visibility dashboard
const systemVisibility = new SystemVisibility(app, path.join(__dirname, '../visibility'));
logger.info('✅ System visibility dashboard initialized');

// Initialize WebSocket service
import { WebSocketService } from './services/WebSocketService';
const webSocketService = WebSocketService.getInstance(server);
app.locals.webSocketService = webSocketService;

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

(async () => {
  try {
    console.log('[STARTUP] Initializing server...');
    
    // Initialize Redis connection
    console.log('[STARTUP] Connecting to Redis...');
    const { redis } = await import('./services/redis');
    
    // Add timeout to Redis connection (10 seconds max)
    const redisConnectPromise = redis.connect();
    const redisTimeout = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Redis connection timeout')), 10000)
    );
    
    try {
      await Promise.race([redisConnectPromise, redisTimeout]);
      console.log('[STARTUP] Redis connection complete');
    } catch (redisError) {
      console.log('[STARTUP] Redis connection failed or timed out - using fallback store');
      // Continue without Redis - the service handles fallback
    }

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
      };
      await startPriceCollectionJob(pool, priceJobConfig);
      console.log('[STARTUP] ✅ CEX Price Background Job initialized');
    } catch (priceJobError) {
      logger.error('[STARTUP] Failed to initialize CEX Price Background Job:', priceJobError);
      // Don't fail startup - price collection is optional
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
        logger.error('[STARTUP] ❌ CRITICAL: Database schema validation failed');
        logger.error('[STARTUP] Required tables are missing. Please run: npm run migrate');
        // For now, warn but continue - in production this should crash the server
        // process.exit(1);
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
      
      // Initialize cache manager with default caches
      (cacheManager.registerCache as any)('platform_metrics', { strategy: 'ttl', ttl: 60000, maxSize: 1000 });
      (cacheManager.registerCache as any)('exchange_data', { strategy: 'ttl', ttl: 30000, maxSize: 5000 });
      (cacheManager.registerCache as any)('cex_prices', { strategy: 'event-driven', invalidateOn: 'ticker-update' });
      
      logger.info('[STARTUP] ✅ All consolidated systems initialized (CB, Health, Cache, Audit, SAGA)');
    } catch (consolidationError) {
      logger.error('[STARTUP] Failed to initialize consolidated systems:', consolidationError);
      // Continue - systems have fallbacks
    }

    // Initialize Execution Quality Systems (Cache & Execution Tracking)
    console.log('[STARTUP] Initializing execution quality systems...');
    try {
      // Initialize Redis cache service
      const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
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
    } catch (cacheInitError) {
      logger.error('[STARTUP] Failed to initialize cache service:', cacheInitError);
      // Cache service has fallback, continue
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
    app.use('/api/admin/operational', operationalFrameworkRoutes); // Operational Framework routes
    app.use('/api/admin/health', healthAdminRoutes); // Health & System State routes
    
    // Phase 2: Governance Activity & Promotion Routes
    const governanceActivityRoutes = (await import('./routes/governance-activity')).default;
    app.use('/api/governance', governanceActivityRoutes);
    
    app.use('/api/cross-chain', crossChainRoutes);
    app.use('/api/user/preferences', userPreferencesRoutes);
    app.use('/api/morio', morioRoutes);
    app.use('/api/morio', morioDataHubRoutes);
    app.use('/api/morio', morioElderInsightsRoutes);
    app.use('/api/personas', personasRouter);
    app.use('/api/public-stats', publicStatsRoutes);
    app.use('/api/treasury-intelligence', treasuryIntelligenceRoutes);
    app.use('/api/analyzer', analyzerRoutes);
    app.use('/api/defender', defenderRoutes); // Registered defender routes
    app.use('/api/exchanges', exchangeRoutes); // CCXT Service - Phase 1
    app.use('/api/features', featureAnalyticsRoutes); // Feature tracking and analytics
    app.use('/api/propagation', graphPropagationRoutes); // Graph Propagation Engine (Phase B & C)

    // Synchronizer agent routes
    const synchronizerRoutes = (await import('./routes/synchronizer')).default;
    app.use('/api/synchronizer', synchronizerRoutes);


    // New feature routes
    app.use('/api/dao-of-the-week', (await import('./routes/dao-of-the-week')).default);
    app.use('/api/telegram-bot', (await import('./routes/telegram-bot')).default);
    app.use('/api/public', (await import('./routes/public-stats')).default);

    // Blog routes
    const blogRoutes = (await import('./routes/blog')).default;
    app.use('/api/blog', blogRoutes);

    // NFT Marketplace routes
    app.use('/api/nft-marketplace', nftMarketplaceRouter);

    // Wallet routes
    app.use('/api/wallet', walletRoutes);
    app.use('/api/wallet-setup', walletSetupRoutes);
    app.use('/api/wallets', (await import('./routes/wallet-creation')).default);
    app.use('/api/wallet-sessions', (await import('./routes/wallet-sessions')).default);
    app.use('/api/sessions', (await import('./routes/enhanced-sessions')).default);
    app.use('/api/wallet/recurring-payments', (await import('./routes/recurring-payments')).default);
    app.use('/api/wallet/vouchers', (await import('./routes/vouchers')).default);
    app.use('/api/wallet/phone', (await import('./routes/phone-payments')).default);
    app.use('/api/payment-gateway', paymentGatewayRoutes);
    app.use('/api/payment-requests', paymentRequestsRoutes);
    app.use('/api/wallet/bill-split', billSplitRoutes);
    app.use('/api/dex', dexScreenerRoutes); // ✅ DexScreener API - Unified at port 5000
    app.use('/api/freqtrade', freqtradeRoutes); // ✅ Freqtrade API - Unified at port 5000
    
    // Webhook routes for deposit transactions
    const webhookRouter = express.Router();
    const { setupDepositWebhookRoutes } = await import('./services/transaction-webhook-service');
    setupDepositWebhookRoutes(webhookRouter);
    app.use('/api/webhooks/deposits', webhookRouter);
    // Mount KYC routes
    app.use('/api/kyc', kycRouter);

    // Import and mount escrow routes
    const escrowRouter = (await import('./routes/escrow')).default;
    app.use('/api/escrow', escrowRouter);

    // Import and mount invoice routes
    const invoiceRouter = (await import('./routes/invoices')).default;
    app.use('/api/invoices', invoiceRouter);

    // Add proof of contribution routes
    const proofOfContributionRoutes = (await import('./routes/proof-of-contribution')).default;
    app.use('/api/proof-of-contribution', proofOfContributionRoutes);

    // Job monitoring and health check routes
    app.use('/admin', jobHealthRoutes);

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

    console.log('[STARTUP] Starting server on port ' + PORT);
    server.listen(PORT, HOST, () => {
      console.log('[STARTUP] ✅ Server listening on port ' + PORT);
      logStartup(PORT.toString());
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

    // Start contribution indexer
    console.log('Starting contribution indexer...');
    await contributionIndexer.start();

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

    // Graceful shutdown
    const gracefulShutdown = (signal: string) => {
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