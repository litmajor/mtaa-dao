import express from "express";
import type { Request, Response } from "express";
import type { Socket as SocketIOClientSocket } from 'socket.io';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { registerRoutes } from "./routes";
import { setupWeeklyRewardsDistribution } from "./jobs/weeklyRewardsDistribution";
import { setupInvestmentPoolsAutomation } from "./jobs/investmentPoolsAutomation";
import {
  startValuationCandidatePipeline,
  stopValuationCandidatePipeline,
} from './services/valuationCandidateService';
import { startSupportTicketMetricsJob } from './jobs/supportTicketMetrics';
import { mtaaTokenomicsIndexer } from './services/mtaaTokenomicsIndexer';
// Dev-only Vite helpers are dynamically imported later to avoid bundling Vite into the production server build
import { logger, requestLogger, logStartup } from './utils/logger';
import { initializeConsoleLogger, getConsoleLogger } from './utils/console-logger';
import path from "path";
import v8 from 'node:v8';
import { dirname } from "path";
import { fileURLToPath } from "url";
import { notificationService } from './notificationService';
import { sanitizeInput, preventXSS } from './security/inputSanitizer';
import cookieParser from 'cookie-parser';
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
import { authenticate, isAuthenticated, refreshTokenHandler, logoutHandler, authUserHandler, authLoginHandler, authRegisterHandler, verifyAccessToken } from './auth';
import reputationRoutes from './routes/reputation'; 
import operationalFrameworkRoutes from './routes/admin/operational-framework';
import healthAdminRoutes from './routes/admin/health';
import valuationAssetsRoutes from './routes/admin/valuation-assets';
import kotaniPayStatusRoutes from './routes/kotanipay-status';
import { kotaniRampWebhookRouter } from './routes/v1/wallets/self-custody-ramps';
import mpesaStatusRoutes from './routes/mpesa-status';
import stripeStatusRoutes from './routes/stripe-status';
import referralsRoutes from './routes/referrals';
import eventsRoutes from './routes/events';
import treasuryManagementRoutes from './routes/treasuryManagement'; 
import multisigRoutes from './routes/multisig'; 
import userPreferencesRoutes from './routes/user-preferences';
import nftMarketplaceRouter from './routes/nft-marketplace';
import paymentGatewayRoutes from './routes/payment-gateway';
import kycRouter from './routes/kyc';
import referralRewardsRouter from './routes/referral-rewards';
import economyRouter from './routes/economy';
import morioRoutes from './routes/morio';
// Removed: morioDataHubRoutes and morioElderInsightsRoutes (now mounted internally via morio.ts)
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
import { initializeWebSocketManager } from './websocket/websocket';
import WebSocketEventService from './websocket/gateway-websocket-integration';
import { WS_PATHS, NotificationsWS } from './websocket/websocket-events';
import { initializeEventEmitter } from './middleware/websocket-event-emitter';
import { JobMonitoringService } from './services/jobMonitoringService';
import { pool, waitForDatabase } from './db';
import { withClient } from './utils/dbClient';
import { startPriceCollectionJob } from './services/cexPriceBackgroundJob';
import { exchangeFeeService, parseTradingPair } from './services/exchangeFeeService';
import {
  ensureBootstrapFeeSchedules,
  listFeeScheduleVersions,
} from './services/exchangeFeeScheduleRepository';
import { exchangeFeeApiSyncService } from './services/exchangeFeeApiSyncService';
import { marketUniverseBuilder } from './services/marketUniverseBuilder';
import { tokenDiscoveryService } from './services/tokenDiscoveryService';
import { initTreasuryMonitoring, stopTreasuryMonitoring } from './services/treasury-monitoring.service';
import { startRotationEventListener } from './services/rotation_listener';
import { startAchievementListener } from './services/achievement_listener';
import { startRewardsBatchWorker } from './services/rewards_batch_worker';
import { watchlistAlertEvaluator } from './services/watchlistAlertEvaluator';
import { paymentRecoveryWorkflowService } from './services/paymentRecoveryWorkflowService';
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
import { signalsStreamHandler, signalsPollHandler, signalsPublishHandler } from './services/signalsStreamer';
import { requireSuperAdminEnhanced } from './middleware/adminAuth';
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
import controlPlaneRouter from './control-plane';
import eventFabric, { createRequestLifecycleMiddleware } from './event-fabric';
import { getAgentWorkerManager } from './workers/agent-worker-manager';
import { isolatedWorkerManager } from './services/IsolatedWorkerManager';
import { PerformanceOptimizerBufferedWriter } from './services/PerformanceOptimizerBufferedWriter';
import { assetGraphService } from './services/assetGraphService'; 
import { strategyDashboardService } from './services/strategyDashboardService'; 
import { cacheService } from './services/cacheService';
import { ExecutionTrackingService } from './services/executionTrackingService';
import { contributionIndexer } from './services/contributionIndexerService';
import { advancedOrderMonitor } from './services/advancedOrderMonitor';
import { ensureYukiAdvancedOrdersTable } from './services/yukiAdvancedOrders';
import { initializeAutoPromotionJob } from './jobs/auto-promotion';
import { initializePaymentRequestExpirationJob } from './jobs/payment-request-expiration';
import { initRetentionJob } from './jobs/retention';
import swaggerMiddleware from './middleware/swaggerMiddleware';


// Helper: safely convert an unknown value into a metadata object for logger calls
function metaFromUnknown(x: unknown): Record<string, unknown> {
  if (x == null) return {};
  if (x instanceof Error) return { message: x.message, stack: x.stack };
  if (typeof x === 'object') return x as Record<string, unknown>;
  return { value: String(x) };
}

// Type guards for optional extension points (adapters/services)
function hasInitialize(obj: unknown): obj is { initialize: () => Promise<void> | void } {
  return typeof obj === 'object' && obj !== null && 'initialize' in obj && typeof (obj as { initialize: unknown }).initialize === 'function';
}

function hasStart(obj: unknown): obj is { start: () => Promise<void> | void } {
  return typeof obj === 'object' && obj !== null && 'start' in obj && typeof (obj as { start: unknown }).start === 'function';
}

function hasGetStatus(obj: unknown): obj is { getStatus: () => unknown } {
  return typeof obj === 'object' && obj !== null && 'getStatus' in obj && typeof (obj as { getStatus: unknown }).getStatus === 'function';
}

async function withStartupStageTimeout<T>(
  stage: string,
  operation: () => Promise<T>,
  timeoutMs = 10000
): Promise<T> {
  console.log(`[STARTUP] >>> ${stage} START`);
  let timeoutHandle: NodeJS.Timeout | undefined;
  try {
    const result = await Promise.race([
      operation(),
      new Promise<T>((_, reject) => {
        timeoutHandle = setTimeout(
          () => reject(new Error(`[STARTUP] ${stage} timed out after ${timeoutMs}ms`)),
          timeoutMs
        );
      })
    ]);
    console.log(`[STARTUP] <<< ${stage} COMPLETE`);
    return result;
  } catch (error) {
    console.error(`[STARTUP] !!! ${stage} FAILED or TIMED OUT`, error instanceof Error ? error.message : error);
    throw error;
  } finally {
    if (timeoutHandle) clearTimeout(timeoutHandle);
  }
}


const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();

const USD_FEE_VOLUME_QUOTES = new Set([
  'USD', 'USDT', 'USDC', 'FDUSD', 'BUSD', 'TUSD', 'USDP',
]);

async function refreshExchangeFeeVolumes(): Promise<void> {
  const { rows } = await pool.query<{
    user_id: string;
    trading_pair: string;
    volume: string | number;
  }>(`
    SELECT user_id, trading_pair, SUM(filled_amount * price)::numeric AS volume
    FROM cex_orders
    WHERE filled_amount > 0
      AND price > 0
      AND COALESCE(completed_at, updated_at, created_at) >= NOW() - INTERVAL '30 days'
    GROUP BY user_id, trading_pair
  `);

  const volumes = new Map<string, number>();
  for (const row of rows) {
    const pair = parseTradingPair(row.trading_pair);
    if (!pair || !USD_FEE_VOLUME_QUOTES.has(pair.quote)) continue;
    const volume = Number(row.volume);
    if (!Number.isFinite(volume) || volume < 0) continue;
    volumes.set(row.user_id, (volumes.get(row.user_id) ?? 0) + volume);
  }
  exchangeFeeService.hydrateUserVolumes(volumes);
  logger.info('[STARTUP] Refreshed exchange fee volume tiers', { users: volumes.size });
}

function scheduleExchangeFeeVolumeRefresh(): void {
  const refresh = async () => {
    try {
      await refreshExchangeFeeVolumes();
    } catch (error) {
      logger.warn('[STARTUP] Unable to refresh exchange fee volume tiers', metaFromUnknown(error));
    }
  };

  void refresh();
  const timer = setInterval(() => void refresh(), 30 * 60 * 1000);
  timer.unref();
}

async function initializeExchangeFeeSchedules(): Promise<void> {
  await ensureBootstrapFeeSchedules(exchangeFeeService.getSchedules());
  const versions = await listFeeScheduleVersions();
  exchangeFeeService.loadScheduleVersions(versions);
  logger.info('[STARTUP] Loaded effective-dated exchange fee schedules', {
    exchanges: exchangeFeeService.getSchedules().length,
  });
  const timer = setInterval(() => {
    void listFeeScheduleVersions()
      .then((updatedVersions) => exchangeFeeService.loadScheduleVersions(updatedVersions))
      .catch((error) => {
        logger.error('[STARTUP] Unable to refresh persisted exchange fee schedules', metaFromUnknown(error));
      });
  }, 60 * 1000);
  timer.unref();
}

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
interface SocketWithAuth extends SocketIOClientSocket {
  userId?: string | null;
}

type SocketNext = (err?: Error) => void;

const io = new SocketIOServer(server, {
  path: WS_PATHS.NOTIFICATIONS,
  cors: {
    origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
      // Mirror the HTTP CORS logic: accept undefined origin (non-browser), or match configured origins
      try {
        if (!origin) return callback(null, true);
        const rawAllowed = (corsConfig.origin as string[]).map((o) => String(o).trim());
        const normalize = (o: string) => {
          try {
            const u = new URL(o.startsWith('http') ? o : `http://${o}`);
            return `${u.protocol}//${u.hostname}${u.port ? `:${u.port}` : ''}`.toLowerCase();
          } catch { return o.toLowerCase(); }
        };
        const allowedSet = new Set(rawAllowed.map(normalize));
        const u = new URL(String(origin));
        const normalized = `${u.protocol}//${u.hostname}${u.port ? `:${u.port}` : ''}`.toLowerCase();
        if (allowedSet.has(normalized)) return callback(null, true);
        // allow localhost/127.0.0.1 interchange
        const hostnames = Array.from(allowedSet).map(a => { try { return new URL(a).hostname; } catch { return a.split('://').pop()?.split(':')[0] ?? a; } });
        if (hostnames.includes(u.hostname)) return callback(null, true);
        if (u.hostname === '127.0.0.1' && hostnames.includes('localhost')) return callback(null, true);
        if (u.hostname === 'localhost' && hostnames.includes('127.0.0.1')) return callback(null, true);
        console.warn(`[CORS][WS] Blocked socket connection from unauthorized origin: ${origin}`);
        return callback(new Error('CORS policy violation'));
      } catch (e) {
        return callback(null, true);
      }
    },
    credentials: true,
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token'],
  },
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

const rawAllowedOrigins = (corsConfig.origin as string[]).map((origin) => origin.trim());
const allowAllOrigins = rawAllowedOrigins.some((o) => ['*', 'all'].includes(o.toLowerCase()));

// Normalize origins to canonical form (protocol://hostname:port) when possible
const normalizeOrigin = (o: string) => {
  try {
    const url = new URL(o.startsWith('http') ? o : `http://${o}`);
    return `${url.protocol}//${url.hostname}${url.port ? `:${url.port}` : ''}`.toLowerCase();
  } catch {
    return o.toLowerCase();
  }
};

const normalizedAllowed = new Set(rawAllowedOrigins.map(normalizeOrigin));

const isOriginAllowed = (origin: string | undefined | null) => {
  if (!origin) return true; // non-browser clients or same-origin
  if (allowAllOrigins) return true;

  try {
    const url = new URL(String(origin));
    const normalized = `${url.protocol}//${url.hostname}${url.port ? `:${url.port}` : ''}`.toLowerCase();

    if (normalizedAllowed.has(normalized)) return true;

    // Accept localhost/127.0.0.1 variants if hostname matches one of the allowed hostnames
    const hostnames = Array.from(normalizedAllowed).map((a) => {
      try { return new URL(a).hostname; } catch { return a.split('://').pop()?.split(':')[0] ?? a; }
    });
    if (hostnames.includes(url.hostname)) return true;

    // Common dev substitution: allow 127.0.0.1 when localhost is configured
    if (url.hostname === '127.0.0.1' && hostnames.includes('localhost')) return true;
    if (url.hostname === 'localhost' && hostnames.includes('127.0.0.1')) return true;

    return false;
  } catch (e) {
    return rawAllowedOrigins.map((o) => o.toLowerCase()).includes(String(origin).toLowerCase());
  }
};

app.use(cors({
  origin: (origin, callback) => {
    if (isOriginAllowed(origin)) return callback(null, true);
    console.warn(`[CORS] Blocked request from unauthorized origin: ${origin}`);
    callback(new Error('CORS policy violation'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token'],
  maxAge: 86400,
}));

// ── Body parsers ────────────────────────────────────────────────────────────
// CRITICAL (C5): express.json() and cookie-parser were missing entirely.
// Without these, req.body is undefined on every JSON request and req.cookies
// is always undefined — breaking auth, CSRF, and every POST handler.
const captureWebhookRawBody = (req: Request, _res: Response, body: Buffer) => {
  (req as Request & { rawBody?: Buffer }).rawBody = Buffer.from(body);
};
const webhookRawJsonParser = express.raw({
  type: 'application/json',
  limit: '10mb',
  verify: captureWebhookRawBody,
});
app.use('/api/v1/wallets/self-custody-ramps/webhook', webhookRawJsonParser);
app.use('/api/payments/kotanipay/callback', webhookRawJsonParser);
app.use('/api/kotanipay-status/callback', webhookRawJsonParser);
app.use(express.json({
  limit: '10mb',
  verify: (req: Request, _res, body) => {
    if (req.originalUrl.startsWith('/api/v1/wallets/self-custody-ramps/webhook')
      || req.originalUrl.startsWith('/api/payments/kotanipay/callback')
      || req.originalUrl.startsWith('/api/kotanipay-status/callback')) {
      (req as Request & { rawBody?: Buffer }).rawBody = Buffer.from(body);
    }
  },
}));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// Security headers (CSP, HSTS, X-Frame-Options, etc.)
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: [],
    },
  },
  crossOriginEmbedderPolicy: false, // allow CDN resources
}));

app.use(sanitizeInput);
app.use(preventXSS);
app.use(auditMiddleware);
setupOperationalAuditLogging(app);
app.use(createRequestLifecycleMiddleware());
// Attach request logger middleware (adds `req.logger` and logs request/response)
app.use(requestLogger);
app.use(compressionMiddleware);
app.use(performanceMonitor(1000));

app.use(metricsCollector.requestMiddleware());
app.locals.metricsCollectorMounted = true;
// Expose requirePermission factory on app.locals for dynamic usages
(app.locals as any).requirePermission = requirePermission;
// Additional metrics middleware (instrumentation hooks)
app.use(metricsMiddleware());

app.use(activityTracker());
app.use(createRouteUsageLogger(path.join(__dirname, '../visibility/route-usage.csv')));
app.use('/api', circuitBreakerMiddleware('api'));

const systemVisibility = new SystemVisibility(app, path.join(__dirname, '../visibility'));

// Memory / heap sanity check: warn if Node was started with a low max-old-space-size
(() => {
  try {
    const execArg = process.execArgv.find((a) => a.includes('--max_old_space_size') || a.includes('--max-old-space-size'));
    let configuredMB: number | null = null;
    if (execArg) {
      const parts = execArg.split(/=|\s+/);
      const val = parts[1] || parts[0].split('=')[1];
      configuredMB = val ? parseInt(val.replace(/[^0-9]/g, ''), 10) : null;
    }

    const mem = process.memoryUsage();
    const usedMB = Math.round((mem.heapUsed / 1024 / 1024) * 100) / 100;
    const heapLimitMB = Math.round((v8.getHeapStatistics().heap_size_limit / 1024 / 1024) * 100) / 100;

    if (configuredMB && usedMB / configuredMB > 0.9) {
      logger.warn(`CRITICAL HEAP: ${usedMB}MB/${configuredMB}MB (~${Math.round((usedMB/configuredMB)*100)}%) — Node started with low heap.`);
      logger.warn('Consider increasing Node heap: update your dev script or run with: cross-env NODE_OPTIONS=--max_old_space_size=2048 npm run run:server');
    } else if (!configuredMB && usedMB / (heapLimitMB || 1) > 0.9) {
      logger.warn(`High heap usage detected: ${usedMB}MB/${heapLimitMB}MB (~${Math.round((usedMB/heapLimitMB)*100)}%) of V8 heap limit.`);
      logger.warn('Example: cross-env NODE_OPTIONS=--max_old_space_size=2048 npm run run:server');
    }
  } catch (e) {
    // best-effort only
  }
})();

if (typeof externalAPITracker.setLogDirectory === 'function') {
  externalAPITracker.setLogDirectory(path.join(__dirname, '../visibility'));
}

import { getSocketIOService } from './services/SocketIOWebSocketService';
const socketIOService = getSocketIOService(server);
app.locals.socketIOService = socketIOService;

opportunityStream.initialize(server);
marketStreamService.initialize(server);

// Initialize central WebSocket manager and event services
try {
  const wsManager = initializeWebSocketManager(server);
  // Initialize global emitter used by services
  initializeEventEmitter(wsManager);

  // Create the high-level WebSocketEventService and attach for app-wide use
  const webSocketEventService = new WebSocketEventService(wsManager);
  app.locals.webSocketEventService = webSocketEventService;

  // Wire job monitoring alerts to push into alerts room by default
  JobMonitoringService.setAlertHandler(async (metrics) => {
    try {
      webSocketEventService.notifyAlert({
        entityType: 'scheduled-job',
        entityId: metrics.jobName,
        alertType: 'job-failure',
        message: `Job ${metrics.jobName} failed: ${metrics.error}`,
        severity: 'high'
      } as any);
    } catch (err) {
      logger.error('[Startup] Failed to notify alert via WebSocketEventService', { err });
    }
  });
} catch (err) {
  logger.warn('[Startup] WebSocket manager/event service initialization failed', { err });
}

const userSockets = new Map<string, Set<string>>();

io.use(async (socket: SocketWithAuth, next: SocketNext) => {
  try {
        let token = socket.handshake.auth?.token || socket.handshake.query.token;

    if (!token && socket.handshake.headers?.cookie) {
      const cookieString = socket.handshake.headers.cookie as string;
      const cookies = cookieString.split(';').map(c => c.trim());
      for (const cookie of cookies) {
        const eqIdx = cookie.indexOf('=');
        if (eqIdx === -1) continue;
        const key = decodeURIComponent(cookie.slice(0, eqIdx));
        const value = decodeURIComponent(cookie.slice(eqIdx + 1));
        if (key === 'access_token') {
          token = value;
          break;
        }
      }
    }

    if (!token) {
      socket.userId = null;
      return next();
    }

    const payload = verifyAccessToken(token) as { sub?: string; userId?: string; id?: string } | null;
    if (!payload) {
      socket.userId = null;
      return next();
    }

    socket.userId = payload.sub || payload.userId || payload.id;
    next();
  } catch (error) {
    socket.userId = null;
    next();
  }
});

io.on('connection', (socket: SocketWithAuth) => {
  if (socket.userId) {
    if (!userSockets.has(socket.userId)) {
      userSockets.set(socket.userId, new Set());
    }
    userSockets.get(socket.userId)!.add(socket.id);
    socket.join(NotificationsWS.Rooms.user(socket.userId));
  }

  socket.on('disconnect', () => {
    if (socket.userId) {
      const sockets = userSockets.get(socket.userId);
      if (sockets) {
        sockets.delete(socket.id);
        if (sockets.size === 0) {
          userSockets.delete(socket.userId);
        }
      }
    }
  });
});

notificationService.on('notification_created', (data: NotificationsWS.NotificationPayload) => {
  io.to(NotificationsWS.Rooms.user(data.userId)).emit(NotificationsWS.ServerEvents.NEW_NOTIFICATION, data);
});

app.locals.socketIO = io;

// Injected Tracking Custom JSON Capture Logger Middleware
app.use((req, res, next) => {
  const start = Date.now();
  const reqPath = req.path;
  let capturedJsonResponse: Record<string, unknown> | undefined = undefined;
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

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC-ONLY early router
//   SECURITY INVARIANT: ONLY genuinely unauthenticated public routes belong
// here.  Every sensitive route MUST be mounted inside the async IIFE below,
// where isAuthenticated / requireRole / requireDAORole guards are applied.
// Adding a protected router here creates an auth-bypass because Express resolves
// middleware in registration order — this router fires before every guard below.
// ─────────────────────────────────────────────────────────────────────────────
const publicRouter = express.Router();

// Genuine public endpoints
publicRouter.use('/health', healthRoutes);
publicRouter.use('/public-stats', publicStatsRoutes);
publicRouter.use('/system', systemRoutes);
publicRouter.use('/events', eventsRoutes);

// Payment-provider status pages (webhook-level, no PII)
publicRouter.use('/kotanipay-status', kotaniPayStatusRoutes);
publicRouter.use('/v1/wallets/self-custody-ramps/webhook', kotaniRampWebhookRouter);
publicRouter.use('/mpesa-status', mpesaStatusRoutes);
publicRouter.use('/stripe-status', stripeStatusRoutes);

// Real-time Signals (SSE stream & poll are read-only public feeds;
// /publish is individually guarded by requireSuperAdminEnhanced)
publicRouter.get('/signals/stream', signalsStreamHandler);
publicRouter.get('/signals/poll', signalsPollHandler);
publicRouter.post('/signals/publish', requireSuperAdminEnhanced, signalsPublishHandler);

// Public health check (registered early so auth middleware added later can't shadow it)
app.get('/health', asyncHandler(async (req: Request, res: Response) => {
  const { redis: redisHealth } = await import('./services/redis');
  const redisStatus = redisHealth.getStatus();
  res.json({
    status: redisStatus.status === 'up' ? 'ok' : 'degraded',
    timestamp: new Date().toISOString(),
    environment: env.NODE_ENV,
    version: process.env.npm_package_version || '1.0.0',
    uptime: process.uptime(),
    redis: {
      status: redisStatus.status,
      usingFallback: redisStatus.usingFallback,
      lastError: redisStatus.lastError,
      lastErrorAt: redisStatus.lastErrorAt,
      circuitState: redisStatus.circuitState,
    },
  });
}));

app.use('/api', publicRouter);
app.use('/api/control-plane', controlPlaneRouter);

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

// (debug route removed) `requirePermission` is available on app.locals for runtime wiring

// Mount core application routers via default generator pipeline
// Route registration is performed later in the async startup block with the HTTP server instance

// NOTE: notFoundHandler and errorHandler are intentionally mounted INSIDE the
// async startup IIFE (see bottom of file), after ALL routes have been
// registered.  Mounting them here would cause every route added in the async
// block to return 404 because the catch-all would intercept first.

console.log('[STARTUP] Starting async initialization lifecycle...');

// unhandledRejection is already registered above (with blockchain-RPC filtering).
// A second registration is unreachable because the guard
// `process.listenerCount('unhandledRejection') === 0` was already false
// after the first registration.  Removed to avoid dead code confusion.

process.on('uncaughtException', (error) => {
  logger.error('🚨 Uncaught Exception:', { message: error.message, stack: error.stack });
  setTimeout(() => { process.exit(1); }, 1000);
});

(globalThis as typeof globalThis & { isServerStarting?: boolean }).isServerStarting = true;

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
      // redis.connect() is bounded by REDIS_CONNECT_TIMEOUT_MS and never throws;
      // the outer timeout is a last-resort guard so Redis can never hang startup.
      await withStartupStageTimeout('redis.connect', () => redis.connect(), 3000);
      const redisStatus = redis.getStatus();
      if (!redisStatus.connected) {
        throw new Error(redisStatus.lastError || 'Redis not ready');
      }
      console.log('[STARTUP] ✅ Redis connected successfully');
      try {
        const { loadFeatureOverrides } = await import('./services/featureService');
        if (typeof loadFeatureOverrides === 'function') {
          await loadFeatureOverrides();
          logger.info('[STARTUP] ✅ Feature overrides loaded from Redis');
        }
      } catch (e) {
        logger.warn('[STARTUP] Could not load feature overrides from Redis', metaFromUnknown(e));
        try {
          if (typeof shouldRetry === 'function' && shouldRetry(e)) {
            logger.info('[STARTUP] Feature overrides load will be retried per shouldRetry policy');
          }
        } catch {
          // ignore
        }
      }
    } catch (redisErr) {
      console.warn('[STARTUP] Redis unavailable - continuing with in-memory fallback; reconnecting in background.', redisErr instanceof Error ? redisErr.message : redisErr);
    }

    console.log('[STARTUP] Waiting for PostgreSQL to become available...');
    try {
      await waitForDatabase();
      console.log('[STARTUP] ✅ PostgreSQL is available');
    } catch (err) {
      logger.error('[STARTUP] PostgreSQL failed to become available during startup:', metaFromUnknown(err));
      throw err;
    }

    const shouldRunMigrations = process.env.RUN_MIGRATIONS === 'true';

    if (shouldRunMigrations) {
      logger.info('[STARTUP] RUN_MIGRATIONS=true -> running database migrations in this process');
      const migrationResult: any = await runAllMigrations();
      if (migrationResult?.success) {
        logger.info('[STARTUP] ✅ Database migrations completed successfully');
      } else {
        logger.error('[STARTUP] ❌ Database migrations failed, aborting startup', { errors: migrationResult.errors });
        throw new Error(`Database migrations failed: ${migrationResult.errors?.join('; ') || 'unknown error'}`);
      }
    } else {
      logger.info('[STARTUP] Database migrations are disabled for the main process. Ensure migrations are applied separately before starting.');
    }

    await initializeExchangeFeeSchedules();
    exchangeFeeApiSyncService.start();
    scheduleExchangeFeeVolumeRefresh();

    try {
      await withStartupStageTimeout(
        'paymentRecoveryWorkflowService.initialize',
        () => withClient(async (client) => {
          // Acquire a short-lived DB client to avoid thundering on shared pool while init runs.
          await paymentRecoveryWorkflowService.initialize();
          return true;
        }, 10000),
        15000
      );
      logger.info('[STARTUP] ✅ Payment recovery workflow service initialized');
    } catch (e) {
      logger.error('[STARTUP] ❌ Payment recovery workflow service initialization failed:', metaFromUnknown(e));
      throw e;
    }

    try {
      initRetentionJob();
      logger.info('[STARTUP] ✅ Retention job initialized');
    } catch (e) {
      logger.warn('[STARTUP] Retention job failed to initialize:', metaFromUnknown(e));
    }

    console.log('[STARTUP] Validating database schema...');
    const schemaValid = await withStartupStageTimeout(
      'schemaValidator.validateDatabaseSchema',
      () => schemaValidator.validateDatabaseSchema(),
      10000
    );
    if (!schemaValid) {
      logger.error('[STARTUP] ❌ Database schema validation failed. Aborting startup. Run migrations in a dedicated process and restart the server.');
      throw new Error('Database schema validation failed');
    } else {
      logger.info('[STARTUP] ✅ Database schema validation passed');
    }

    // STAGE C: CONSOLIDATED SUBSYSTEMS (CIRCUIT BREAKERS, SAGAS, SINGLETONS)
    console.log('[STARTUP] Initializing consolidated systems...');
    const { circuitBreakerRegistry } = await import('./core/consolidation/CircuitBreakerConsolidation');
    const { healthRegistry } = await import('./core/consolidation/HealthRegistryConsolidation');
    const { initializeHealthRegistryComponents } = await import('./core/consolidation/HealthBootstrap');
    const { cacheManager } = await import('./core/consolidation/DataCacheConsolidation');
    const { paymentRecoverySAGA } = await import('./services/PaymentRecoverySAGAOrchestrator');
    
    initializeHealthRegistryComponents();
    
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
    // Expose circuit breaker helper on app.locals so it's wired and available
    try {
      (app.locals as any).withCircuitBreaker = withCircuitBreaker;
    } catch {}
    
    if (healthRegistry) logger.info('[STARTUP] ✅ Health Registry initialized', {});
    if (cacheManager) logger.info('[STARTUP] ✅ Data Cache Manager initialized', {});
    if (paymentRecoverySAGA) logger.info('[STARTUP] ✅ Payment Recovery SAGA Orchestrator initialized', {});

    console.log('[STARTUP] Running Phase 7.1 System Singleton Verification...');
    const verification: any = await withStartupStageTimeout(
      'verifySingletonInstances',
      () => Promise.resolve(verifySingletonInstances()),
      10000
    );
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
    startValuationCandidatePipeline();
    startSupportTicketMetricsJob();
    mtaaTokenomicsIndexer.start().catch(error => logger.warn('[STARTUP] MTAA tokenomics indexer disabled or failed', metaFromUnknown(error)));
    initializeAutoPromotionJob();
    initializePaymentRequestExpirationJob();
    ScheduledAggregationJobs.initializeScheduledJobs();
    // Start on-chain RotationModule event listener to reconcile rotation cycles
      try {
        startRotationEventListener();
        logger.info('[STARTUP] ✅ Rotation event listener started');
      } catch (err) {
        logger.warn('[STARTUP] Rotation event listener failed to start:', metaFromUnknown(err));
      }

    try {
      startAchievementListener();
      logger.info('[STARTUP] ✅ Achievement event listener started');
    } catch (err) {
      logger.warn('[STARTUP] Achievement event listener failed to start:', metaFromUnknown(err));
    }

    try {
      startRewardsBatchWorker();
      logger.info('[STARTUP] ✅ Rewards batch worker started');
    } catch (err) {
      logger.warn('[STARTUP] Rewards batch worker failed to start:', metaFromUnknown(err));
    }

    try {
      watchlistAlertEvaluator.start();
      logger.info('[STARTUP] ✅ WatchlistAlertEvaluator started');
    } catch (err) {
      logger.warn('[STARTUP] Failed to start WatchlistAlertEvaluator:', metaFromUnknown(err));
    }
    
    // Agent Payment Gateway indexer for intelligence dashboards
    try {
      const { agentPaymentIndexer } = await import('./services/AgentPaymentIndexer');
      await withStartupStageTimeout(
        'agentPaymentIndexer.start',
        () => agentPaymentIndexer.start(),
        10000
      );
      logger.info('[STARTUP] ✅ AgentPaymentIndexer started');
    } catch (err) {
      logger.warn('[STARTUP] AgentPaymentIndexer failed to start:', metaFromUnknown(err));
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
        'BTC/USDT', 'ETH/USDT', 'USDC/USDT', 'USDT/USDT', 'ICP/USDT',
        'DAI/USDT', 'SOL/USDT', 'XRP/USDT', 'CELO/USDT', 'XAUt/USDT',
        'MATIC/USDT', 'AAVE/USDT', 'LINK/USDT', 'UNI/USDT', 'BNB/USDT',
        'TRX/USDT', 'LTC/USDT', 'BCH/USDT', 'ZEC/USDT', 'OKB/USDT',
        'NEAR/USDT', 'ONDO/USDT', 'HYPE/USDT', 'XMR/USDT', 'XLM/USDT'
      ],
    };

    // Initialize Market Discovery System (Symbol Universe Phase 2)
    console.log('[STARTUP] Initializing Market Discovery System...');
    try {
      const { automaticPhaseManager } = await import('./services/automaticPhaseManager');
      const { marketDiscoveryScannerService } = await import('./services/marketDiscoveryScannerService');
      
      // Initialize automatic phase manager
      await withStartupStageTimeout(
        'automaticPhaseManager.initialize',
        () => automaticPhaseManager.initialize(),
        10000
      );
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
      logger.error('[STARTUP] Failed to initialize Market Discovery System:', metaFromUnknown(discoveryError));
      // Don't fail startup - market discovery is optional
    }

    // Initialize Token Discovery unified universe (resilient startup with local fallback)
    console.log('[STARTUP] Initializing Token Discovery unified universe (with local fallback)...');
    try {
      await withStartupStageTimeout(
        'tokenDiscoveryService.buildUnifiedUniverse',
        () => tokenDiscoveryService.buildUnifiedUniverse(),
        15000
      );
      logger.info('[STARTUP] ✅ Token universe built successfully');
    } catch (error) {
      logger.error('[STARTUP] Failed to build fresh universe, loading local fallback cache...', metaFromUnknown(error));
      try {
        await tokenDiscoveryService.loadFallbackUniverse();
        logger.info('[STARTUP] ✅ Loaded fallback token universe cache');
      } catch (fallbackErr) {
        logger.error('[STARTUP] Failed to load fallback universe cache:', metaFromUnknown(fallbackErr));
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
      
      const framework = await withStartupStageTimeout(
        'initializeOperationalFramework',
        () => initializeOperationalFramework(operationalConfig as any),
        10000
      );
      logger.info('✅ Operational Framework initialized');
    } catch (operationalError) {
      logger.error('[STARTUP] Failed to initialize Operational Framework:', operationalError);
      // Don't fail startup - operational framework is optional
    }

    // Initialize Execution Tracking Service
    console.log('[STARTUP] Initializing execution quality systems...');
    try {
      // Initialize ExecutionTrackingService (singleton)
      if (ExecutionTrackingService) {
        const trackingService = ExecutionTrackingService.getInstance();
        await withStartupStageTimeout(
          'trackingService.initialize',
          () => trackingService.initialize(),
          10000
        );
      }
      
      // Initialize Redis cache service
      await withStartupStageTimeout(
        'cacheService.initialize',
        () => cacheService.initialize(),
        10000
      );
      logger.info('[STARTUP] ✅ Cache service initialized (Redis with in-memory fallback)');

      // Health check on cache service
      const cacheHealthy = await withStartupStageTimeout(
        'cacheService.healthCheck',
        () => cacheService.healthCheck(),
        10000
      );
      if (cacheHealthy) {
        logger.info('[STARTUP] ✅ Cache service health check passed');
      } else {
        logger.warn('[STARTUP] ⚠️ Cache service health check failed - using fallback');
      }
    } catch (executionInitError) {
      logger.error('[STARTUP] Failed to initialize execution quality systems:', metaFromUnknown(executionInitError));
      // Execution tracking has fallbacks, continue
    }

    // Initialize Asset Graph and Strategy Dashboard Services
    console.log('[STARTUP] Initializing dashboard services...');
    try {
      if (assetGraphService && typeof (assetGraphService as any).initialize === 'function') {
        await withStartupStageTimeout(
          'assetGraphService.initialize',
          () => (assetGraphService as any).initialize(),
          10000
        );
        logger.info('[STARTUP] ✅ Asset Graph Service initialized');
      }
      
      if (strategyDashboardService && typeof (strategyDashboardService as any).initialize === 'function') {
        await withStartupStageTimeout(
          'strategyDashboardService.initialize',
          () => (strategyDashboardService as any).initialize(),
          10000
        );
        logger.info('[STARTUP] ✅ Strategy Dashboard Service initialized');
      }
    } catch (dashboardError) {
      logger.error('[STARTUP] Failed to initialize dashboard services:', metaFromUnknown(dashboardError));
      // Dashboard services are optional, continue
    }

    // Initialize Graph Propagation Engine (Layer 4: Capital Intelligence)
    console.log('[STARTUP] Initializing Graph Propagation Engine (Phase A, B, C)...');
    try {
      // ── Seed Graph ───────────────────────────────────────────────────────────
      // In production, seed data should come from DB / real correlation feeds.
      // The hardcoded mock edges are only used in development/test so that the
      // engine is never silently running on stale placeholder correlations.
      if (env.NODE_ENV !== 'production') {
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
        graphPropagationEngine.initializeGraph(mockNodes, mockEdges);
        logger.info('[STARTUP] ✅ Graph seeded with dev/test placeholder correlations');
      } else {
        // Production: initialize empty graph; ohlcvPropagationAdapter will
        // populate real edges once price history is available.
        graphPropagationEngine.initializeGraph([], []);
        logger.info('[STARTUP] ✅ Graph Propagation Engine initialized with empty graph (production mode — real correlations fed by adapters)');
      }
      logger.info('[STARTUP] ✅ Graph Propagation Engine initialized (Phase A)');
      
      // Initialize propagation adapters (Phase B: Data integration)
      const ohlcvAdapter = ohlcvPropagationAdapter as unknown as { initialize?: () => Promise<void> | void };
      const taAdapter = technicalAnalysisPropagationAdapter as unknown as { initialize?: () => Promise<void> | void };
      const nuruAdapter = nuruPropagationAdapter as unknown as { initialize?: () => Promise<void> | void };

      if (hasInitialize(ohlcvAdapter)) {
        await withStartupStageTimeout(
          'ohlcvPropagationAdapter.initialize',
          () => Promise.resolve(ohlcvAdapter.initialize()),
          10000
        );
        logger.info('[STARTUP] ✅ OHLCV Propagation Adapter initialized');
      }
      if (hasInitialize(taAdapter)) {
        await withStartupStageTimeout(
          'technicalAnalysisPropagationAdapter.initialize',
          () => Promise.resolve(taAdapter.initialize()),
          10000
        );
        logger.info('[STARTUP] ✅ Technical Analysis Propagation Adapter initialized');
      }
      if (hasInitialize(nuruAdapter)) {
        await withStartupStageTimeout(
          'nuruPropagationAdapter.initialize',
          () => Promise.resolve(nuruAdapter.initialize()),
          10000
        );
        logger.info('[STARTUP] ✅ NURU Propagation Adapter initialized');
      }
      
      // Initialize monitoring service (if available)
      if (hasStart(propagationMonitoringService)) {
        propagationMonitoringService.start();
      }
      logger.info('[STARTUP] ✅ Propagation Monitoring Service started (Phase B)');
      
      // Initialize production hardening (if available)
      if (hasGetStatus(productionHardeningService)) {
        const hardeningStatus = productionHardeningService.getStatus();
        logger.info('[STARTUP] ✅ Production Hardening initialized (Phase C)', metaFromUnknown(hardeningStatus));
      } else {
        logger.info('[STARTUP] ✅ Production Hardening initialized (Phase C)');
      }
      
      // Initialize integration hooks
      const { initializeGraphPropagationHooks } = await import('./services/graphPropagationIntegration');
      await withStartupStageTimeout(
        'initializeGraphPropagationHooks',
        () => initializeGraphPropagationHooks(),
        10000
      );
      logger.info('[STARTUP] ✅ Graph Propagation Integration Hooks initialized (Phase B callbacks)');
      
      logger.info('[STARTUP] Graph Propagation Engine fully initialized (1,700+ lines)');
      } catch (propagationError) {
      logger.error('[STARTUP] Failed to initialize Graph Propagation Engine:', metaFromUnknown(propagationError));
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
      performFlush().catch(err => logger.warn('[BufferedWriter] Initial flush failed', metaFromUnknown(err)));
      setInterval(() => {
        performFlush().catch(err => logger.error('[BufferedWriter] Scheduled flush failed', metaFromUnknown(err)));
      }, FLUSH_INTERVAL_MS);
      // Start metrics reporting background task
      try {
        if (typeof startMetricsReporting === 'function') startMetricsReporting();
      } catch (e) {
        logger.warn('[STARTUP] startMetricsReporting failed to start', metaFromUnknown(e));
      }
    } catch (metricsError) {
      logger.warn('[STARTUP] Metrics buffering setup warning:', metaFromUnknown(metricsError));
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
          logger.warn(`[STARTUP] Failed to initialize ${agentType} agent:`, metaFromUnknown(agentError));
          // Continue - individual agent failures shouldn't block startup
        }
      }

      const summary = agentRegistry.getStatusSummary();
      logger.info('[STARTUP] Agent registry status:', summary);
      } catch (agentError) {
      logger.error('[STARTUP] Failed to initialize agent system:', metaFromUnknown(agentError));
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
      logger.warn('[STARTUP] Isolated worker manager setup warning:', metaFromUnknown(workerError));
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
      logger.error('[STARTUP] Failed to initialize Asset Graph Service:', metaFromUnknown(assetGraphError));
      // Continue - asset graph is optional for core functionality
    }

    console.log('[STARTUP] Registering routes...');
    
    // Add timeout to route registration (30 seconds max)
    const routesPromise = withStartupStageTimeout(
      'registerRoutes',
      () => registerRoutes(app, server),
      10000
    );
    const routesTimeout = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Route registration timeout')), 30000)
    );
    
    try {
      await Promise.race([routesPromise, routesTimeout]);
      console.log('[STARTUP] Routes registration complete');
    } catch (routesError: any) {
      const errorMsg = routesError instanceof Error ? routesError.message : String(routesError);
      console.error('[STARTUP] Route registration failed:', errorMsg);
      // FATAL: Do not start the server if routes failed to register, avoiding silent partial failures
      throw new Error(`Critical startup failure: Route registration failed - ${errorMsg}`);
    }

    // Initialize Defender Agent Integration
    console.log('[STARTUP] Initializing Defender Agent...');
    try {
      setupDefenderAgent(app, authenticate);
      console.log('[STARTUP] Defender Agent integration complete');
      } catch (defenderError: any) {
      const errorMsg = defenderError instanceof Error ? defenderError.message : String(defenderError);
      logger.error('[STARTUP] Defender Agent setup failed:', metaFromUnknown(errorMsg));
      // Continue without defender agent - core functionality can still work
    }

    // Mount Swagger API Documentation at /api-docs
    console.log('[STARTUP] Setting up Swagger API documentation...');
    app.use('/api-docs', swaggerMiddleware);
    console.log('[STARTUP] Swagger API documentation available at /api-docs');

    app.get('/health/fees', (_req: Request, res: Response) => {
      res.json({
        stale: exchangeFeeService.getStaleSchedules(),
        credentialSync: exchangeFeeApiSyncService.getStatus(),
        recentChanges: exchangeFeeService.getRecentScheduleChanges().map((change) => ({
          exchange: change.exchange,
          effectiveFrom: change.effectiveFrom,
          source: change.source,
          changes: change.changes,
        })),
        timestamp: new Date().toISOString(),
      });
    });

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
    // M3 FIX: requireDAORole moved inside sub-routers — at mount level :daoId is not yet parsed
    app.use('/api/treasury-management', isAuthenticated, treasuryManagementRoutes); // PHASE 2: Treasury whitelist & limits
    app.use('/api/multisig', isAuthenticated, multisigRoutes); // PHASE 2: Multisig approval workflows
    if (!(app as any).locals?.routesRegistered) {
      app.use('/api/analytics', isAuthenticated, analyticsRoutes);
    } else {
      console.log('[STARTUP] Skipping duplicate mount: /api/analytics (handled by registerRoutes)');
    }
    app.use('/api/referrals', isAuthenticated, referralsRoutes);
    app.use('/api/events', eventsRoutes);
    app.use('/api/notifications', isAuthenticated, notificationRoutes);
    app.use('/api/system', systemRoutes);
    // Mount job routes (admin protected)
    try {
      if (!(app as any).locals?.routesRegistered) {
        app.use('/api/jobs', isAuthenticated, requireRole('super_admin'), jobRoutes);
      } else {
        console.log('[STARTUP] Skipping duplicate mount: /api/jobs (handled by registerRoutes)');
      }
    } catch (e) {
      logger.warn('[STARTUP] Failed to mount job routes', metaFromUnknown(e));
    }
    // Billing routes migrated to v1 API
    app.use('/api/health', healthRoutes);
    // Logs are sensitive (stack traces, internal paths, request payloads) — guard them.
    app.use('/api/logs', isAuthenticated, requireRole('super_admin'), logsRoutes);
    app.use('/api/referral-rewards', isAuthenticated, referralRewardsRouter);
    // M3 FIX: economy/poll-proposals/reputation are platform-global (no :daoId) — requireDAORole was always failing
    app.use('/api/economy', isAuthenticated, economyRouter);
    app.use('/api/dao/:daoId/executions', isAuthenticated, requireDAORole('member', 'admin', 'owner'), proposalExecutionRouter);
    app.use('/api/poll-proposals', isAuthenticated, pollProposalsRouter);
    app.use('/api/reputation', isAuthenticated, reputationRoutes);
    // Admin-only routes with authentication and superuser role check
    app.use('/api/admin/operational', isAuthenticated, requireRole('super_admin'), operationalFrameworkRoutes); // Operational Framework routes
    app.use('/api/admin/health', isAuthenticated, requireRole('super_admin'), healthAdminRoutes); // Health & System State routes
    app.use('/api/admin/valuation-assets', isAuthenticated, valuationAssetsRoutes);

    // Payment reconciliation is an admin-only feature and lives under the
    // superadmin namespace. Additional RBAC guard applied at mount time as
    // well as inside the router.
    app.use('/api/admin/payments/reconciliation', isAuthenticated, requireRole('super_admin'), paymentReconciliationRoutes);
    
    // Phase 2: Governance Activity & Promotion Routes
    const governanceActivityRoutes = (await import('./routes/governance-activity')).default;
    // M3 FIX: requireDAORole moved inside governance-activity sub-router — :daoId is in sub-routes
    app.use('/api/governance', isAuthenticated, governanceActivityRoutes);
    
    // Cross-chain module routes (assets, transfers, governance, swaps, Solana,
    // TRON, and utilities) are versioned under this canonical mount. The
    // aggregate router and transaction-sensitive subrouters enforce auth.
    const crossChainModulesRouter = (await import('./routes/modules')).default;
    app.use('/api/v1/cross-chain', isAuthenticated, crossChainModulesRouter);

    app.use('/api/user/preferences', isAuthenticated, userPreferencesRoutes);
    app.use('/api/morio', isAuthenticated, morioRoutes);
    app.use('/api/personas', isAuthenticated, personasRouter);
    // WebSocket monitoring (was orphaned when the public router was stripped; re-mount with guard)
    app.use('/api/websocket-monitoring', isAuthenticated, requireRole('super_admin'), websocketMonitoringRoutes);

    // ── Compat redirects for renamed paths ─────────────────────────────────────────
    // These public aliases were removed from the early router; the authoritative
    // guarded mount now lives at a different path.  Rather than silently 404-ing
    // any consumer that still calls the old path, we return a 301 that points to
    // the correct endpoint so issues are immediately visible in logs/network tabs.
    app.use('/api/admin-consolidated', isAuthenticated, requireRole('super_admin'), (req: Request, res: Response) => {
      res.redirect(308, req.originalUrl.replace('/api/admin-consolidated', '/api/admin'));
    });
    app.use('/api/job-health', isAuthenticated, requireRole('super_admin'), (req: Request, res: Response) => {
      res.redirect(308, req.originalUrl.replace('/api/job-health', '/api/admin/jobs'));
    });
    // /api/proposal-execution is now /api/dao/:daoId/executions — a daoId is required.
    // We cannot inject an unknown daoId, so return a descriptive 410 Gone.
    app.use('/api/proposal-execution', isAuthenticated, (_req: Request, res: Response) => {
      res.status(410).json({
        error: 'ENDPOINT_MOVED',
        message: 'This endpoint has moved to /api/dao/:daoId/executions. Supply the target DAO id in the URL.',
      });
    });
    app.use('/api/amara', isAuthenticated, (req: Request, res: Response) => {
      res.redirect(308, req.originalUrl.replace('/api/amara', '/api/dashboard'));
    });
    // /api/user-preferences (dash) → /api/user/preferences (slash) — same router, different path.
    app.use('/api/user-preferences', isAuthenticated, (req: Request, res: Response) => {
      res.redirect(308, req.originalUrl.replace('/api/user-preferences', '/api/user/preferences'));
    });
    app.use('/api/public-stats', publicStatsRoutes);
    // Treasury intelligence routes moved to v1 API
    app.use('/api/analyzer', isAuthenticated, requireRole('super_admin'), analyzerRoutes);
    app.use('/api/dashboard', isAuthenticated, amaraRoutes); // 🎨 Amara Dashboard routes
    // ✅ V1 STRATEGY ROUTES (Modular Architecture - Phase 2)
    // Require authentication for strategies endpoints
    app.use('/api/v1/strategies', isAuthenticated, strategiesRouter); // 📈 V1 Strategies (core CRUD + execution + social)
    // ✅ CONSOLIDATED ADMIN ROUTES (Phase 1 - Migration Complete)
    // Requires authentication + superuser role
    app.use('/api/admin', adminConsolidated); // 👤 Admin operations + AI monitoring (UNIFIED)
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

    // V1 WALLETS ROUTER - Canonical versioned wallet endpoints
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
    
    app.use('/api/dex', dexScreenerRoutes); // ✅ DexScreener router enforces authentication and admin access locally
    
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
    // Security: add X-Robots-Tag header for sensitive front-end routes to prevent indexing
    // Registered BEFORE the SPA catch-all so the header is present on index.html responses.
    const noIndexPaths = ['/dashboard', '/wallet', '/treasury', '/admin', '/strategies'];
    app.use((req, res, next) => {
      try {
        const reqPath = (req.path || req.originalUrl || '').toString();
        for (const p of noIndexPaths) {
          if (reqPath === p || reqPath.startsWith(p + '/') || reqPath.startsWith(p + '?') || reqPath.startsWith(p)) {
            res.setHeader('X-Robots-Tag', 'noindex, nofollow');
            break;
          }
        }
      } catch (e) {
        // best-effort only
      }
      next();
    });
    if (env.NODE_ENV === "development") {
      // Vite is mounted on a dedicated router registered here (before the 404
      // handler), so if setup finishes after the timeout it still takes effect
      // without blocking server.listen().
      const viteRouter = express.Router();
      app.use(viteRouter);
      const viteSetupTimeoutMs = parseInt(process.env.VITE_SETUP_TIMEOUT_MS || '15000', 10) || 15000;
      try {
        await withStartupStageTimeout(
          'setupVite',
          async () => {
            const { setupVite } = await import('./vite');
            await setupVite(viteRouter, server);
          },
          viteSetupTimeoutMs
        );
      } catch (err) {
        logger.warn('⚠️ Dev Vite setup failed or timed out; continuing with API startup (Vite will attach if it finishes later):', metaFromUnknown(err));
      }
    } else {
      try {
        const { serveStatic } = await import('./vite');
        serveStatic(app);
      } catch (err) {
        logger.warn('⚠️ serveStatic import failed:', metaFromUnknown(err));
      }
    }

    // ═══════════════════════════════════════════════════════════════════════════════
    // Initialize Async Job Queue Infrastructure
    // ═══════════════════════════════════════════════════════════════════════════════
    try {
      await withStartupStageTimeout(
        'initializeWorkers',
        () => initializeWorkers(),
        10000
      );
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

    eventFabric.publish('server.startup.begin', { port: PORT, host: HOST, environment: process.env.NODE_ENV || 'development' });
    console.log('[STARTUP] Starting server on port ' + PORT + ' (HOST: ' + HOST + ')');
    // Explicit, unambiguous log of the exact parameters used for server.listen
    console.log(`[STARTUP] SERVER_LISTEN_PARAMS host=${HOST} port=${PORT} pid=${process.pid} exec=${process.execPath}`);
    logger.info('[STARTUP] server.listen parameters', { port: PORT, host: HOST, pid: process.pid, execPath: process.execPath, argv: process.argv, envHOST: process.env.HOST });
    server.listen(PORT, HOST, () => {
      console.log('[STARTUP] ✅ Server listening on port ' + PORT);
      eventFabric.publish('server.startup.ready', { port: PORT, host: HOST, environment: process.env.NODE_ENV || 'development' });
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
      const deferredBackgroundStartupDelayMs = 15_000;
      console.log(`[STARTUP] Scheduling deferred background startup in ${deferredBackgroundStartupDelayMs}ms`);
      setTimeout(async () => {
        if (typeof _deferStartOpportunityEngine !== 'undefined' && _deferStartOpportunityEngine) {
          try {
            await opportunityEngine.startScanning(_opportunityEngineScanIntervalMs);
            logger.info('✅ Opportunity Engine started (deferred)');
          } catch (err) {
            logger.error('Failed to start Opportunity Engine (deferred):', metaFromUnknown(err));
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
              logger.warn('[STARTUP] Failed to build dynamic tradingPairs:', metaFromUnknown(e));
            }

            await startPriceCollectionJob(pool, _pendingPriceJobConfig);
            logger.info('✅ CEX Price Background Job initialized (deferred)');
          } catch (err) {
            logger.error('Failed to initialize CEX Price Background Job (deferred):', metaFromUnknown(err));
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
          logger.error('Failed to initialize SAGA reconciliation job:', metaFromUnknown(err));
        }
        // Start webhook reconciliation worker (periodic catch-up for missed webhooks)
        try {
          const { startWebhookReconciliationWorker } = await import('./workers/webhookReconciliationWorker');
          startWebhookReconciliationWorker();
          logger.info('✅ Webhook reconciliation worker started (background)');
        } catch (err) {
          logger.error('Failed to initialize webhook reconciliation worker:', metaFromUnknown(err));
        }
        try {
          const { startKotaniSelfCustodyRampReconciliationWorker } = await import('./workers/kotaniSelfCustodyRampReconciliationWorker');
          startKotaniSelfCustodyRampReconciliationWorker();
        } catch (err) {
          logger.error('Failed to initialize KotaniPay ramp status reconciliation worker:', metaFromUnknown(err));
        }
      }, deferredBackgroundStartupDelayMs);
      
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
    logger.info('🌐 Initializing Gateway Agent...');
    try {
      const gatewayService = await initializeGatewayAgent(
        undefined, // Use default config
        coordinator, // Pass coordinator for integration
        undefined // Use default adapter config
      );
      logger.info('✅ Gateway Agent initialized');
      logger.info('✅ Gateway adapters ready: Chainlink, Mento, Ubeswap, Curve, Uniswap, Sushi, CoinGecko, Moola, Beefyfi, Blockchain');

      // Mount Gateway Agent routes now that service is initialized
      try {
        const { createGatewayRoutes } = await import('./routes/gateway');
        const gatewayRoutes = createGatewayRoutes(gatewayService);
        app.use('/api/v1/market', gatewayRoutes);
        app.use('/api/gateway', gatewayRoutes);
        logger.info('✅ Gateway Agent API routes mounted at /api/v1/market and /api/gateway');
      } catch (routeError) {
        logger.warn('⚠️ Failed to mount Gateway Agent routes:', { message: (routeError as Error).message, stack: (routeError as any)?.stack });
      }
    } catch (error: any) {
      const errMsg = error instanceof Error ? error.message : (Object.keys(error || {}).length ? JSON.stringify(error) : String(error));
      const errStack = error instanceof Error ? error.stack : (error && (error as any).stack) || undefined;
      logger.error('⚠️ Gateway Agent initialization failed: ' + errMsg, error, { stack: errStack });
      logger.warn('   Gateway features will be unavailable, but server will continue');
      // Don't crash the server if Gateway fails
    }

    // Start bridge relayer service
    bridgeRelayerService.start();

    // Initialize Yuki Advanced Orders table before starting monitor
    await ensureYukiAdvancedOrdersTable();

    // Start Advanced Orders Background Monitor
    advancedOrderMonitor.start();

    console.log('✅ Blockchain services initialized successfully');

    // STARTUP COMPLETE: Clear flag to enable INFO logging now that services are running
    (globalThis as typeof globalThis & { isServerStarting?: boolean }).isServerStarting = false;

    // ═══════════════════════════════════════════════════════════════════════════════
    // PHASE 7.1: SINGLETON VERIFICATION (After all services initialized)
    // ═══════════════════════════════════════════════════════════════════════════════
    
    // Perform comprehensive singleton verification after all services initialized
    try {
      verifySingletonInstances();
      console.log('[STARTUP] ✅ Singleton instance verification complete');
      } catch (err) {
      console.warn('[STARTUP] ⚠️ Singleton verification failed:', err);
      logger.warn('Singleton verification error (non-fatal):', metaFromUnknown(err));
    }

    // Graceful shutdown
    const gracefulShutdown = async (signal: string) => {
      logger.warn(`Received ${signal}, shutting down gracefully`);

      try {
        stopValuationCandidatePipeline();
      } catch (err) {
        logger.error('Error stopping valuation candidate pipeline:', err);
      }

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

      // Stop Advanced Order Monitor
      try {
        advancedOrderMonitor.stop();
        logger.info('Advanced Order Monitor stopped');
      } catch (err) {
        logger.error('Error stopping Advanced Order Monitor:', err);
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
        logger.error('Error shutting down job workers:', metaFromUnknown(err));
      }

      // Reset circuit breakers (Phase 6)
      try {
        resetAllCircuits();
        logger.info('Circuit breakers reset during shutdown');
      } catch (err) {
        logger.error('Error resetting circuit breakers:', metaFromUnknown(err));
      }

      // Finalize console logging
      try {
        const consoleLogger = getConsoleLogger();
        consoleLogger.closeLogging();
        logger.info('Console logging finalized');
      } catch (err) {
        logger.error('Error finalizing console logging:', metaFromUnknown(err));
      }

      // Close PostgreSQL pool to free database connections
      try {
        await pool.end();
        logger.info('PostgreSQL pool closed successfully');
      } catch (err) {
        logger.error('Error while closing PostgreSQL pool during shutdown:', metaFromUnknown(err));
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