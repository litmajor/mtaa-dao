import express, { Express } from 'express';
import { Server as HTTPServer } from 'http';
import { isAuthenticated } from './nextAuthMiddleware';
import Stripe from "stripe"; // Stripe integration
import { validateDaoIdMiddleware, sanitizeObject } from './middleware/security';
// Import route modules
import healthRoutes from './routes/health';
import sseRoutes from './routes/sse';
import governanceRoutes from './routes/governance';
import governanceQuorumRouter from './routes/governance-quorum';
import tasksRoutes from './routes/tasks';
import reputationRoutes from './routes/reputation';
import analyticsRoutes from './routes/analytics';
import notificationsRoutes from './routes/notifications';
import userNotificationsRoutes from './routes/user/notifications';
import userRecoveryRoutes from './routes/user/recovery';
import daosRoutes from './routes/daos';
import proposalExecutionRoutes from './routes/proposal-execution';
import paymentReconciliationRoutes from './routes/payment-reconciliation';
import stripeStatusRoutes from './routes/stripe-status';
import kotanipayStatusRoutes from './routes/kotanipay-status';
import mpesaStatusRoutes from './routes/mpesa-status';
import monitoringRoutes from './routes/monitoring';
import taskTemplatesRoutes from './api/task_templates';
import achievementsRouter from './api/achievements';
import challengesRoutes from './routes/challenges';
import morioRoutes from './routes/morio';
import profileRoutes from './routes/profile';
import accountRoutes from './routes/account';
import ensRoutes from './routes/ens';
import multisigCreateRoutes from './routes/multisig_create';
import proofOfContributionRoutes from './routes/proof-of-contribution';
import referralRewardsRoutes from './routes/referral-rewards';
import economyRoutes from './routes/economy';
import contributionIndexerRoutes from './routes/contribution-indexer';
import adminRoutes from './routes/admin';
import adminAIMetricsRoutes from './routes/admin-ai-metrics';
import announcementsRoutes from './routes/announcements';
import depositsWithdrawalsRoutes from './routes/deposits-withdrawals';
import accountInitializationRoutes from './routes/account-initialization';
import phoneVerificationRouter from './routes/phone-verification';
import agentRoutes from './routes/agents';
import onboardingRoutes from './routes/onboarding';
import subscriptionManagementRoutes from './routes/subscription-management';
// V1 ROUTERS (Versioned API Architecture)
let v1DaosRouter: any;
let v1TreasuryRouter: any;
import treasuryDataRoutes from './routes/treasury-data';
import graphPropagationRoutes from './routes/graph-propagation';
import userSubscriptionRoutes from './routes/user-subscription';
import revenueRoutes from './routes/revenue';
// Import Phase 3 Rules Engine routes
import rulesRoutes from './routes/rules';
// Import blog, support, and success stories routes
import blogRoutes from './routes/blog';
import supportRoutes from './routes/support';
import successStoriesRoutes from './routes/success-stories';
// Import Yuki trading platform routes (V1 - versioned)
import yukiRoutesV1 from './routes/v1/yuki';
import marketDataRoutes from './routes/marketData';
import executionQualityRoutes from './routes/executionQuality';
import marketInsightsRoutes from './routes/marketInsights';
import tradingSignalsRoutes from './routes/trading-signals';
// Telegram and WhatsApp routes
import telegramBotRoutes from './routes/telegram-bot';
import telegramIntegrationRoutes from './routes/telegram-integration';
import whatsappIntegrationRoutes from './routes/whatsapp-integration';

// Import User Follows routes
import userFollowsRoutes from './routes/user-follows';
// V1 wallets router (required by legacy 410 tombstones)
let v1WalletsRouter: any;

// Import Symbol Universe routes for CEX integration
import symbolUniverseRoutes from './routes/symbolUniverse';

// Import P2P Transfers routes
import p2pTransfersRoutes from './routes/p2p-transfers';

// Import Exchange and Order Router routes
import exchangeRoutes from './routes/exchanges';

// Import Withdrawal Verification routes (2FA and PIN)
// TODO: 2FA/PIN verification migrated to v1 API routes

// Import Job Status routes
import jobsRoutes from './routes/jobs';

// Import Phase 4 WebSocket Price Stream Server
import { priceStreamServer } from './websocket/priceStream';

// Import Market Discovery routes (Symbol Universe Phase 2)
import marketDiscoveryRouter from './routes/marketDiscovery';

// Import API handlers
import { authUserHandler } from './api/auth_user';
import { authLoginHandler } from './api/auth_login';
import { authRegisterHandler, verifyOtpHandler, resendOtpHandler } from './api/auth_register';
import { authTelegramLinkHandler } from './api/auth_telegram_link';
import { authOauthGoogleHandler } from './api/auth_oauth_google';
import { authOauthGoogleCallbackHandler } from './api/auth_oauth_google_callback';
import { accountDeleteHandler } from './api/account_delete';
import { daoDeployHandler } from './api/dao_deploy';
import { getSpawnFeeQuote, SPAWN_FEE_KES } from './services/daoSpawnService';
import { paymentsEstimateGasHandler } from './api/payments_estimate_gas';
import { paymentsIndexHandler } from './api/payments_index';
import { getWalletTransactions, createWalletTransaction } from './api/wallet_transactions';

// Import Rotation and Invitation handlers
import {
  getRotationStatusHandler,
  processRotationHandler,
  getNextRecipientHandler
} from './api/rotation_service';
import {
  createInvitationHandler,
  getPendingInvitationsHandler,
  acceptInvitationHandler,
  rejectInvitationHandler,
  getPeerInviteLinkHandler,
  getDaoInvitationsHandler,
  revokeInvitationHandler
} from './api/invitation_service';

// Import Dashboard handlers
import {
  getDashboardStatsHandler,
  getDashboardProposalsHandler,
  getDashboardVaultsHandler,
  getDashboardContributionsHandler,
  getDashboardMembersHandler,
  getDashboardTasksHandler,
  getDashboardCompleteHandler
} from './api/dashboard';

// Token utilities (used by V1 endpoints if needed)
// import { getSupportedTokensHandler, getTokenPriceHandler } from './api/vaults';

// Import DAO Settings handlers
import { getDaoSettingsHandler, updateDaoSettingsHandler, resetInviteCodeHandler, getDaoAnalyticsHandler } from './api/daoSettings';

// Import Reputation handlers
import {getUserReputationHandler, getReputationLeaderboardHandler, getDaoReputationLeaderboardHandler } from './api/reputation';

// Auth handlers
import {refreshTokenHandler,logoutHandler } from './auth';

// User profile handlers
import {
  getUserProfileHandler,
  updateUserProfileHandler,
  changePasswordHandler,
  updateWalletAddressHandler
} from './api/user_profile';

// Auth middleware (JWT token validation)
import { authenticateToken } from './middleware/auth';

// RBAC middleware
import { requireRole, requireDAORole, requirePermission } from './middleware/rbac';
import { validate } from './middleware/validation';
import { daoDeploySchema } from './validators/dao_deploy';

// Rate limiting middleware
import {
  registerRateLimiter,
  otpResendRateLimiter,
  otpVerifyRateLimiter,
  loginRateLimiter
} from './middleware/rateLimiter';

// Timeout middleware
import { createTimeoutMiddleware } from './middleware/timeoutMiddleware';
import { metricsCollector } from './monitoring/metricsCollector';
import metricsAuth from './middleware/metricsAuth';

// Admin handlers
import {getUsersHandler,updateUserRoleHandler } from './api/admin_users';

// Week 1 Dashboard API handlers
import {
  getUserPersonaDataHandler,
  getUserDAOsHandler,
  getDashboardPersonaHandler
} from './api/week1_dashboard';

// Import new strategy and WebSocket routes

import { webSocketPriceStream } from './services/webSocketPriceStream';
import dashboardRouter from './routes/dashboard';

export async function registerRoutes(app: Express, server: HTTPServer) {
  console.log('[ROUTES] *** STARTING ROUTE REGISTRATION ***');
  
  // Initialize timeout middleware for auto-queuing long-running operations
  console.log('[ROUTES] Initializing timeout middleware...');
  const timeoutMiddleware = createTimeoutMiddleware({
    defaultTimeoutMs: 5000, // 5s default
    heavyComputeTimeoutMs: 30000, // 30s for heavy compute
  });
  app.use(timeoutMiddleware);
  console.log('[ROUTES] Timeout middleware activated (5s default, 30-60s for heavy compute)');
  
  // Health check
  console.log('[ROUTES] Mounting health routes...');
  app.use('/api/health', healthRoutes);

  // Prometheus scrape endpoint — protected by token or IP allowlist
  app.get('/metrics', metricsAuth, (req, res) => {
    try {
      res.set('Content-Type', 'text/plain');
      res.send(metricsCollector.getPrometheusMetrics());
    } catch (err) {
      res.status(500).send('# Error collecting metrics');
    }
  });

  // JSON metrics endpoint — protected by token or IP allowlist
  app.get('/metrics/json', metricsAuth, (req, res) => {
    try {
      res.json(metricsCollector.getMetrics());
    } catch (err) {
      res.status(500).json({ error: 'Failed to collect metrics' });
    }
  });

  // Backwards compatibility redirects for health check consolidation
  // Route: /health → /api/health (rename)
  app.get('/health', (req, res) => {
    res.set('X-Deprecated', 'true');
    res.set('X-Redirect-To', '/api/health');
    res.status(301).redirect('/api/health');
  });

  // Route: /api-health → /api/health (rename)
  app.get('/api-health', (req, res) => {
    res.set('X-Deprecated', 'true');
    res.set('X-Redirect-To', '/api/health');
    res.status(301).redirect('/api/health');
  });

  // Backwards compatibility: public impact stats (frontend sometimes requests /public/impact-stats)
  app.get('/public/impact-stats', (req, res) => {
    res.set('X-Deprecated', 'true');
    res.set('X-Redirect-To', '/api/public/impact-stats');
    res.status(301).redirect('/api/public/impact-stats');
  });

  // Route: /api/morio/health → /api/health/morio (move)
  app.get('/api/morio/health', (req, res) => {
    res.set('X-Deprecated', 'true');
    res.set('X-Redirect-To', '/api/health/morio');
    res.redirect(301, '/api/health/morio');
  });

  // Route: /api/dex/health → /api/health/dex (move)
  app.get('/api/dex/health', (req, res) => {
    res.set('X-Deprecated', 'true');
    res.set('X-Redirect-To', '/api/health/dex');
    res.redirect(301, '/api/health/dex');
  });

  // Route: /api/propagation/health → /api/health/propagation (move)
  app.get('/api/propagation/health', (req, res) => {
    res.set('X-Deprecated', 'true');
    res.set('X-Redirect-To', '/api/health/propagation');
    res.redirect(301, '/api/health/propagation');
  });

  // Route: /api/admin/operational/health → /api/health/operational (move)
  app.get('/api/admin/operational/health', (req, res) => {
    res.set('X-Deprecated', 'true');
    res.set('X-Redirect-To', '/api/health/operational');
    res.redirect(301, '/api/health/operational');
  });

  // SSE routes
  console.log('[ROUTES] Mounting SSE routes...');
  app.use('/api/sse', sseRoutes);

  // ✅ Wallet and Treasury routes migrated to V1 endpoints (see /api/v1/daos and /api/v1/treasury)


  // Market Discovery routes (Symbol Universe Phase 2)
  console.log('[ROUTES] Mounting market discovery routes...');
  app.use(marketDiscoveryRouter);

  // Governance routes (legacy compatibility and quorum subrouter)
  app.use('/api/governance', governanceRoutes);
  app.use('/api/governance/quorum', governanceQuorumRouter);


  // ✅ DAO consolidated routes now mounted via V1 router at /api/dao/:daoId
  
  // Economy routes - platform economic tools and balances
  app.use('/api/economy', economyRoutes);

  // Disbursements routes migrated to v1 API
  
  // Legacy route redirects for backwards compatibility
  console.log('[ROUTES] Setting up legacy DAO route redirects...');
  app.use('/api/governance/:daoId', (req, res) => {
    const newPath = `/api/dao/${req.params.daoId}/governance${req.path.replace(`/${req.params.daoId}`, '')}`;
    res.setHeader('Deprecation', 'true');
    res.setHeader('Sunset', new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toUTCString());
    res.setHeader('X-Deprecated-Route', `Please use ${newPath}`);
    res.redirect(307, newPath);
  });
  
  app.use('/api/dao-treasury/:daoId', (req, res) => {
    const newPath = `/api/dao/${req.params.daoId}/treasury${req.path.replace(`/${req.params.daoId}`, '')}`;
    res.setHeader('Deprecation', 'true');
    res.setHeader('Sunset', new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toUTCString());
    res.setHeader('X-Deprecated-Route', `Please use ${newPath}`);
    res.redirect(307, newPath);
  });
  
  app.use('/api/disbursements/:daoId', (req, res) => {
    const newPath = `/api/dao/${req.params.daoId}/disbursements${req.path.replace(`/${req.params.daoId}`, '')}`;
    res.setHeader('Deprecation', 'true');
    res.setHeader('Sunset', new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toUTCString());
    res.setHeader('X-Deprecated-Route', `Please use ${newPath}`);
    res.redirect(307, newPath);
  });
  
  // Regular DAO operations (meta endpoints)
  // Legacy DAO routes are deprecated. Add a tombstone redirect to the v1 router
  // so callers receive a deprecation notice and are steered to `/api/v1/daos/*`.
  app.use('/api/daos', (req: express.Request, res: express.Response, next: express.NextFunction) => {
    try {
      const newPath = `/api/v1/daos${req.path}`;
      res.setHeader('X-Deprecated', 'true');
      res.setHeader('X-Redirect-To', newPath);
      res.setHeader('Sunset', new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toUTCString());
      console.warn(`[ROUTES] Legacy /api/daos request redirected to ${newPath}`);
      return res.redirect(307, newPath);
    } catch (err) {
      console.warn('[ROUTES] Deprecation redirect failed, falling back to legacy handler', err);
      return daosRoutes(req, res, next);
    }
  });
  // ⚠️ DAO treasury flows removed - functionality consolidated to V1 endpoints

  // Task and bounty routes
  console.log('[ROUTES] Mounting task routes...');
  app.use('/api/tasks', tasksRoutes);
  app.use('/api/task-templates', taskTemplatesRoutes);
  
  // Deprecated: Old bounty-escrow endpoint - use /api/dao/:daoId/bounty-escrow instead
  app.use('/api/bounty-escrow', (req, res) => {
    res.set('Deprecation', 'true');
    res.set('Sunset', new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toUTCString());
    res.set('X-API-Warn', 'This endpoint is deprecated. Use /api/dao/:daoId/bounty-escrow instead.');
    res.status(410).json({
      error: 'Gone',
      message: 'The /api/bounty-escrow endpoint has been moved. Use /api/dao/:daoId/bounty-escrow instead.',
      deprecation: 'Deprecated since March 2026',
      sunsetting: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toUTCString()
    });
  });

  // Reputation and analytics
  console.log('[ROUTES] Mounting reputation routes...');
  app.use('/api/reputation', reputationRoutes);
  app.use("/api/analytics", analyticsRoutes);
  app.use("/api/challenges", challengesRoutes);

  // Notifications and disbursements
  console.log('[ROUTES] Mounting notifications routes...');
  app.use('/api/notifications', notificationsRoutes);
  app.use('/api/user/notifications', userNotificationsRoutes); // User notification endpoints (Phase 3c Part 4)
  app.use('/api/user/recovery', userRecoveryRoutes); // User recovery endpoints (Phase 3c Part 5)

  // Proposal execution
  console.log('[ROUTES] Mounting proposal execution routes...');
  app.use('/api/proposal-execution', proposalExecutionRoutes);

  // ============================================================================
  // PAYMENT ROUTES - CONSOLIDATED
  // ============================================================================
  // Reconciliation endpoint has been moved into the admin namespace for
  // additional assurance.  Provider-specific status routes remain here.
  // (Old `/api/payment-reconciliation` redirect removed.)
  app.use('/api/payments/stripe', stripeStatusRoutes);
  app.use('/api/payments/kotanipay', kotanipayStatusRoutes);
  app.use('/api/payments/mpesa', mpesaStatusRoutes);

  app.use('/api/stripe-status', (req, res, next) => {
    res.set('X-Deprecated', 'true');
    res.set('X-Redirect-To', '/api/payments/stripe');
    return stripeStatusRoutes(req, res, next);
  });
  app.use('/api/kotanipay-status', (req, res, next) => {
    res.set('X-Deprecated', 'true');
    res.set('X-Redirect-To', '/api/payments/kotanipay');
    return kotanipayStatusRoutes(req, res, next);
  });
  app.use('/api/mpesa-status', (req, res, next) => {
    res.set('X-Deprecated', 'true');
    res.set('X-Redirect-To', '/api/payments/mpesa');
    return mpesaStatusRoutes(req, res, next);
  });

  // ============================================================================
  // DEPOSITS, WITHDRAWALS & TRANSACTIONS CONSOLIDATION
  // ============================================================================
  // CANONICAL ENDPOINT: /api/v1/wallets/* (v1 API with full implementation)
  // LEGACY ENDPOINTS: /api/deposits, /api/withdrawals, /api/transactions
  // 
  // These 3 legacy paths were routing to identical handlers via depositsWithdrawalsRoutes.
  // Consolidating to v1 API endpoint to reduce duplication.
  console.log('[ROUTES] Mounting deposit/withdrawal legacy routes (redirecting to v1)...');
  
  // Canonical: Already mounted in index.ts via v1WalletsRouter at /api/v1/wallets
  // Deprecation redirects for backwards compatibility
  app.use('/api/deposits', (req, res, next) => {
    res.set('Deprecation', 'true');
    res.set('Sunset', new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toUTCString());
    res.set('X-API-Warn', 'Endpoint moved to /api/v1/wallets. All paths work at the new location.');
    const newPath = `/api/v1/wallets${req.path}`;
    res.set('X-Redirect-To', newPath);
    res.redirect(307, newPath);
  });
  
  app.use('/api/withdrawals', (req, res, next) => {
    res.set('Deprecation', 'true');
    res.set('Sunset', new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toUTCString());
    res.set('X-API-Warn', 'Endpoint moved to /api/v1/wallets. All paths work at the new location.');
    const newPath = `/api/v1/wallets${req.path}`;
    res.set('X-Redirect-To', newPath);
    res.redirect(307, newPath);
  });
  
  app.use('/api/transactions', (req, res, next) => {
    res.set('Deprecation', 'true');
    res.set('Sunset', new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toUTCString());
    res.set('X-API-Warn', 'Endpoint moved to /api/v1/wallets. All paths work at the new location.');
    const newPath = `/api/v1/wallets${req.path}`;
    res.set('X-Redirect-To', newPath);
    res.redirect(307, newPath);
  });
  
  app.use('/api/p2p-transfers', p2pTransfersRoutes);

  // ============================================================================
  // CONSOLIDATED ROUTE REDIRECTS (DEPRECATION)
  // ============================================================================
  // These routes have been consolidated to single canonical endpoints.
  // Old paths maintained for backwards compatibility.
  
  // Feature Analytics consolidation
  console.log('[ROUTES] Setting up consolidated feature analytics redirect...');
  app.use('/api/feature-analytics', (req, res, next) => {
    res.set('Deprecation', 'true');
    res.set('Sunset', new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toUTCString());
    res.set('X-API-Warn', 'Endpoint consolidated to /api/features');
    const newPath = `/api/features${req.path}`;
    res.set('X-Redirect-To', newPath);
    res.redirect(307, newPath);
  });
  
  // Graph Propagation consolidation
  console.log('[ROUTES] Setting up consolidated graph propagation redirect...');
  app.use('/api/graph-propagation', (req, res, next) => {
    res.set('Deprecation', 'true');
    res.set('Sunset', new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toUTCString());
    res.set('X-API-Warn', 'Endpoint consolidated to /api/propagation');
    const newPath = `/api/propagation${req.path}`;
    res.set('X-Redirect-To', newPath);
    res.redirect(307, newPath);
  });
  
  // DEX Screener consolidation
  console.log('[ROUTES] Setting up consolidated DEX screener redirect...');
  app.use('/api/dex-screener', (req, res, next) => {
    res.set('Deprecation', 'true');
    res.set('Sunset', new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toUTCString());
    res.set('X-API-Warn', 'Endpoint consolidated to /api/dex');
    const newPath = `/api/dex${req.path}`;
    res.set('X-Redirect-To', newPath);
    res.redirect(307, newPath);
  });
  
  // API Registry consolidation
  console.log('[ROUTES] Setting up consolidated API registry redirect...');
  app.use('/api/api-registry', (req, res, next) => {
    res.set('Deprecation', 'true');
    res.set('Sunset', new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toUTCString());
    res.set('X-API-Warn', 'Endpoint consolidated to /api/docs');
    const newPath = `/api/docs${req.path}`;
    res.set('X-Redirect-To', newPath);
    res.redirect(307, newPath);
  });
  
  // Proposal Execution consolidation
  console.log('[ROUTES] Setting up consolidated proposal execution redirect...');
  app.use('/api/proposal-execution', (req, res, next) => {
    res.set('Deprecation', 'true');
    res.set('Sunset', new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toUTCString());
    res.set('X-API-Warn', 'Endpoint consolidated to /api/v1/daos/:daoId/proposals. See mapping in X-Legacy-Redirect-Info.');
    
    // Parse legacy path and convert to v1
    // Legacy: /api/proposal-execution/:daoId/queue → /api/v1/daos/:daoId/proposals/execution/queue
    // Legacy: /api/proposal-execution/:daoId/execute/:proposalId → /api/v1/daos/:daoId/proposals/:proposalId/execute
    // Legacy: /api/proposal-execution/:daoId/cancel/:executionId → /api/v1/daos/:daoId/proposals/execution/:executionId (DELETE)
    
    const pathParts = req.path.split('/').filter(p => p);
    if (pathParts.length >= 2) {
      const daoId = pathParts[0];
      const operation = pathParts[1];
      
      let newPath: string;
      if (operation === 'queue') {
        newPath = `/api/v1/daos/${daoId}/proposals/execution/queue`;
      } else if (operation === 'execute' && pathParts[2]) {
        const proposalId = pathParts[2];
        newPath = `/api/v1/daos/${daoId}/proposals/${proposalId}/execute`;
      } else if (operation === 'cancel' && pathParts[2]) {
        const executionId = pathParts[2];
        newPath = `/api/v1/daos/${daoId}/proposals/execution/${executionId}`;
        // Note: Method should be DELETE for cancel
        res.set('X-Legacy-Method-Hint', 'Use DELETE method for cancel operations');
      } else {
        // Fallback
        newPath = `/api/v1/daos${req.path}`;
      }
      
      res.set('X-Redirect-To', newPath);
      res.set('X-Legacy-Redirect-Info', `Mapped from legacy proposal-execution structure to v1 daos/:daoId/proposals`);
      res.redirect(307, newPath);
      return;
    }
    
    // Fallback redirect
    res.set('X-Redirect-To', '/api/v1/daos');
    res.redirect(307, '/api/v1/daos');
  });

  // Treasury Data API - Real-time treasury state from smart contracts
  console.log('[ROUTES] Mounting treasury data routes...');
  app.use('/api/treasury', treasuryDataRoutes);

  // ============================================================================
  // 2FA AND PIN VERIFICATION ROUTES - CONSOLIDATED
  // ============================================================================
  // All 2FA and PIN verification routes migrated to v1 API
  // TODO: See routes/v1/auth/2fa.ts for current implementation
  console.log('[ROUTES] 2FA and PIN verification routes loaded from v1 API');

  // Monitoring (require authentication)
  app.use('/api/monitoring', isAuthenticated, monitoringRoutes);

  // User follows routes
  app.use('/api/user-follows', userFollowsRoutes);

  // Job Status and Progress Tracking (Async Job Management) — require authentication
  console.log('[ROUTES] Mounting job status and progress routes...');
  app.use('/api/jobs', isAuthenticated, jobsRoutes);

  // Agent management and control
  console.log('[ROUTES] Mounting agent management routes...');
  app.use('/api/agents', agentRoutes);

  // Auth endpoints (with rate limiting)
  app.get('/api/auth/user', isAuthenticated, authUserHandler);
  app.post('/api/auth/login', loginRateLimiter, (req: express.Request, res: express.Response, next: express.NextFunction) => {
    try {
      req.body = sanitizeObject(req.body || {});
      return authLoginHandler(req, res);
    } catch (err) {
      next(err);
    }
  });

  app.post('/api/auth/register', registerRateLimiter, (req: express.Request, res: express.Response, next: express.NextFunction) => {
    try {
      req.body = sanitizeObject(req.body || {});
      return authRegisterHandler(req, res);
    } catch (err) {
      next(err);
    }
  });

  app.post('/api/auth/verify-otp', otpVerifyRateLimiter, (req: express.Request, res: express.Response, next: express.NextFunction) => {
    try {
      req.body = sanitizeObject(req.body || {});
      return verifyOtpHandler(req, res);
    } catch (err) {
      next(err);
    }
  });

  app.post('/api/auth/resend-otp', otpResendRateLimiter, (req: express.Request, res: express.Response, next: express.NextFunction) => {
    try {
      req.body = sanitizeObject(req.body || {});
      return resendOtpHandler(req, res);
    } catch (err) {
      next(err);
    }
  });
  app.post('/api/auth/telegram-link', isAuthenticated, otpResendRateLimiter, authTelegramLinkHandler);
  app.get('/api/auth/oauth/google', authOauthGoogleHandler);
  app.get('/api/auth/oauth/google/callback', authOauthGoogleCallbackHandler);
  app.post('/api/auth/refresh-token', loginRateLimiter, refreshTokenHandler);
  app.post('/api/auth/logout', logoutHandler);

  // Profile and Account management
  app.use('/api/profile', profileRoutes);
  // ENS / address resolution (best-effort)
  app.use('/api/ens', ensRoutes);
  app.use('/api/account', accountRoutes);
  // Lightweight multisig creation enqueuer
  app.use('/api/multisig-create', multisigCreateRoutes);
  app.use('/api/admin', isAuthenticated, requireRole('super_admin', 'admin'), accountInitializationRoutes); // Account initialization endpoints
  app.delete('/api/account/delete', isAuthenticated, accountDeleteHandler); // Legacy endpoint
  app.use('/api/referral-rewards', referralRewardsRoutes);
  app.use('/api/admin', isAuthenticated, requireRole('super_admin', 'admin'), adminRoutes); // Admin/SuperUser management (protected)
  app.use('/api/announcements', isAuthenticated, announcementsRoutes); // Platform announcements (authenticated)
  app.use('/api/rules', rulesRoutes); // Phase 3 Custom Rules Engine (scoped)

  // DeFi DEX Integration - moved to v1 API

  // Graph Propagation System
  console.log('[ROUTES] Mounting graph propagation routes...');
  app.use('/api/propagation', graphPropagationRoutes);

  // Yuki Trading Platform (V1 - versioned API)
  console.log('[ROUTES] Mounting Yuki trading platform routes at /api/v1/yuki...');
  app.use('/api/v1/yuki', yukiRoutesV1);

  // Deprecation redirect: /api/yuki → /api/v1/yuki
  console.log('[ROUTES] Setting up Yuki versioning redirect...');
  app.all('/api/yuki*', (req, res) => {
    const newPath = `/api/v1/yuki${req.url.substring('/yuki'.length)}`;
    res.status(307);
    res.setHeader('Location', newPath);
    res.setHeader('Deprecation', 'true');
    res.setHeader('Sunset', new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toUTCString());
    res.setHeader('X-Redirect-To', newPath);
    res.json({
      deprecated: true,
      message: 'Yuki API has been moved to /api/v1/yuki',
      newLocation: newPath,
      sunsetDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString()
    });
  });

  // Symbol Universe & CEX Price Integration
  console.log('[ROUTES] Mounting symbol universe routes...');
  app.use('/api/symbol-universe', symbolUniverseRoutes);

  // Enhanced Market Data API
  console.log('[ROUTES] Mounting enhanced market data routes...');
  app.use('/api/v1/market', marketDataRoutes);


  // Execution Quality & Slippage Analysis API
  console.log('[ROUTES] Mounting execution quality routes...');
  app.use('/api/v1/execution', executionQualityRoutes);

  // Market Insights (Volatility, Analytics, Smart Retry) - Priority 3
  console.log('[ROUTES] Mounting market insights routes...');
  app.use('/api/v1/analytics', marketInsightsRoutes);

  // Trading Intelligence Engine - Real-Time Feeds, Futures, Microstructure
  console.log('[ROUTES] Mounting trading intelligence routes (Market signals, WebSocket, Futures)...');
  app.use('/api/trading', authenticateToken as any, tradingSignalsRoutes);

  // ⚠️ DEPRECATED: Legacy endpoint redirect
  // Old path /api/v1/priority4 was exposed without authentication - now moved and secured
  app.use('/api/v1/priority4', (req, res) => {
    res.status(410).json({
      error: 'Endpoint moved and secured',
      message: 'The trading signals endpoints have been moved from /api/v1/priority4 (unprotected) to /api/trading (authenticated)',
      newEndpoint: '/api/trading',
      note: 'All requests now require Authorization: Bearer <token>',
      timestamp: new Date().toISOString()
    });
  });

  // ⚠️ Legacy strategy vaults endpoint removed - use V1 endpoints instead

  // MTAA Staking & Governance - moved to v1 API

  // DAO deployment (canonical endpoint - requires canCreateDAO permission)
  app.post('/api/dao/deploy', isAuthenticated, validate({ body: daoDeploySchema }), async (req, res, next) => {
    try {
      req.body = sanitizeObject(req.body);
      await daoDeployHandler(req, res);
    } catch (error) {
      next(error);
    }
  });
  
  // Backwards compatibility (deprecated alias)
  app.post('/api/dao-deploy', isAuthenticated, async (req, res, next) => {
    try {
      res.set('X-Deprecated', 'true');
      res.set('X-Redirect-To', '/api/dao/deploy');
      await daoDeployHandler(req, res);
    } catch (error) {
      next(error);
    }
  });

  /**
   * POST /api/dao/initiate-spawn-payment
   * Phase 1: Initiates an M-Pesa STK push for the DAO spawn fee.
   * On webhook confirmation the server calls DAOSpawnGateway and deploys the DAO.
   *
   * Body: { daoData, founderWallet, phone, invitedMembers, selectedElders }
   * Response: { reference, spawnFeeKES, checkoutRequestId }
   */
  app.post('/api/dao/initiate-spawn-payment', isAuthenticated, async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    try {
      req.body = sanitizeObject(req.body);
      const { daoData, founderWallet, phone, invitedMembers, selectedElders, multisig } = req.body;

      if (!daoData?.daoType || !phone || !founderWallet) {
        return res.status(400).json({ error: 'daoData.daoType, phone, and founderWallet are required' });
      }

      const daoType = (daoData.daoType as string).toLowerCase().replace(/-/g, '');
      const { kes: spawnFeeKES, cusdEstimate, rate } = await getSpawnFeeQuote(daoType);

      // Initiate the STK push via the existing payments route logic
      const mpesaEnabled = String(process.env.FEATURE_MPESA_STK) === 'true';
      if (!mpesaEnabled) {
        return res.status(503).json({ error: 'M-Pesa STK feature is not enabled' });
      }

      const shortcode = process.env.MPESA_SHORTCODE;
      const passkey = process.env.MPESA_PASSKEY || process.env.MPESA_PASSWORD;
      const callbackUrl = process.env.MPESA_CALLBACK_URL || `${process.env.APP_BASE_URL || ''}/webhooks/mpesa`;
      const mpesaEnv = (process.env.MPESA_ENVIRONMENT || 'sandbox').toLowerCase();
      if (!shortcode || !passkey) {
        return res.status(503).json({ error: 'M-Pesa shortcode/passkey not configured' });
      }

      const timestamp = new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14);
      const password = Buffer.from(`${shortcode}${passkey}${timestamp}`).toString('base64');

      // Fetch Daraja token
      const mpesaConsumerKey = process.env.MPESA_CONSUMER_KEY;
      const mpesaConsumerSecret = process.env.MPESA_CONSUMER_SECRET;
      if (!mpesaConsumerKey || !mpesaConsumerSecret) {
        return res.status(503).json({ error: 'M-Pesa consumer key/secret not configured' });
      }
      const mpesaBase = mpesaEnv === 'live' ? 'https://api.safaricom.co.ke' : 'https://sandbox.safaricom.co.ke';
      const tokenResp = await fetch(
        `${mpesaBase}/oauth/v1/generate?grant_type=client_credentials`,
        { headers: { Authorization: `Basic ${Buffer.from(`${mpesaConsumerKey}:${mpesaConsumerSecret}`).toString('base64')}` } }
      );
      const tokenData = await tokenResp.json() as any;
      const mpesaToken = tokenData.access_token;
      if (!mpesaToken) {
        return res.status(502).json({ error: 'Failed to obtain M-Pesa access token' });
      }

      const stkBody = {
        BusinessShortCode: shortcode,
        Password: password,
        Timestamp: timestamp,
        TransactionType: 'CustomerPayBillOnline',
        Amount: spawnFeeKES,
        PartyA: phone.replace(/[^0-9+]/g, ''),
        PartyB: shortcode,
        PhoneNumber: phone.replace(/[^0-9+]/g, ''),
        CallBackURL: callbackUrl,
        AccountReference: `MtaaDAO-${daoType.toUpperCase()}`,
        TransactionDesc: `MtaaDAO ${daoType} DAO Spawn Fee`,
      };

      const stkResp = await fetch(`${mpesaBase}/mpesa/stkpush/v1/processrequest`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${mpesaToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(stkBody),
      });

      const stkData = await stkResp.json() as any;
      if (!stkResp.ok) {
        return res.status(502).json({ error: 'Daraja STK request failed', details: stkData });
      }

      const checkoutRequestId = stkData?.CheckoutRequestID;
      const reference = `SPAWN-${Date.now()}-${founderWallet.slice(2, 8)}`;

      // Persist the pending payment with full DAO creation payload embedded
      const { paymentTransactions } = await import('../shared/schema');
      const { db } = await import('./db');
      await db.insert(paymentTransactions).values({
        reference,
        userId: (req as any).user?.id || founderWallet,
        provider: 'mpesa',
        amount: String(spawnFeeKES),
        currency: 'KES',
        type: 'dao_spawn_fee',
        status: 'pending',
        metadata: {
          purpose: 'dao_spawn_fee',
          spawnStatus: 'awaiting_payment',
          checkoutRequestId,
          founderWallet,
          daoType,
          spawnFeeKES,
          cusdEstimate,
          rate,
          pendingDaoData: { daoData, founderWallet, invitedMembers: invitedMembers || [], selectedElders: selectedElders || [], multisig },
          darajaResponse: stkData,
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any);

      return res.status(202).json({
        success: true,
        reference,
        checkoutRequestId,
        spawnFeeKES,
        cusdEstimate,
        message: `Please enter your M-Pesa PIN to pay KES ${spawnFeeKES} and create your ${daoType} DAO.`,
      });
    } catch (error: any) {
      next(error);
    }
  });

  // DAO Rotation Management (DAO admin/owner only)
  app.get('/api/dao/:daoId/rotation/status', isAuthenticated, validateDaoIdMiddleware, getRotationStatusHandler);

  /**
   * GET /api/dao/spawn-fee-quote/:daoType
   * Returns the KES spawn fee and estimated cUSD equivalent for a given DAO type.
   * Used by the frontend to display "Pay KES 1,000" before initiating payment.
   */
  app.get('/api/dao/spawn-fee-quote/:daoType', isAuthenticated, async (req: express.Request, res: express.Response) => {
    try {
      const daoType = (req.params.daoType || '').toLowerCase().replace(/-/g, '');
      const quote = await getSpawnFeeQuote(daoType);
      return res.json({ success: true, daoType, ...quote });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  /**
   * GET /api/dao/spawn-status/:reference
   * Poll the status of a pending DAO spawn payment.
   * Returns spawnStatus: 'awaiting_payment' | 'processing' | 'completed' | 'spawn_failed'
   */
  app.get('/api/dao/spawn-status/:reference', isAuthenticated, async (req: express.Request, res: express.Response) => {
    try {
      const { reference } = req.params;
      const { paymentTransactions: ptTable } = await import('../shared/schema');
      const { db: dbConn } = await import('./db');
      const { eq: eqOp } = await import('drizzle-orm');

      const [tx] = await dbConn
        .select()
        .from(ptTable)
        .where(eqOp(ptTable.reference, reference))
        .limit(1);

      if (!tx) {
        return res.status(404).json({ success: false, error: 'Reference not found' });
      }

      const meta = (tx.metadata as any) ?? {};
      return res.json({
        success: true,
        reference,
        paymentStatus: tx.status,
        spawnStatus: meta.spawnStatus ?? 'unknown',
        daoId: meta.daoId ?? null,
        spawnFeeKES: meta.spawnFeeKES ?? null,
        error: meta.spawnError ?? null,
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });


  app.post('/api/dao/:daoId/rotation/process', isAuthenticated, validateDaoIdMiddleware, requireDAORole('owner', 'admin'), processRotationHandler);
  app.get('/api/dao/:daoId/rotation/next-recipient', isAuthenticated, validateDaoIdMiddleware, getNextRecipientHandler);

  // DAO Invitation Management (DAO admin/owner for managing, members for accepting)
  app.post('/api/dao/:daoId/invitations', isAuthenticated, validateDaoIdMiddleware, requireDAORole('owner', 'admin'), async (req, res, next) => {
    try {
      req.body = sanitizeObject(req.body);
      await createInvitationHandler(req, res);
    } catch (err) {
      next(err);
    }
  });
  app.get('/api/dao/:daoId/invitations', isAuthenticated, validateDaoIdMiddleware, requireDAORole('owner', 'admin', 'member'), getDaoInvitationsHandler);
  app.delete('/api/dao/:daoId/invitations/:invitationId', isAuthenticated, validateDaoIdMiddleware, requireDAORole('owner', 'admin'), revokeInvitationHandler);
  app.get('/api/invitations/pending', isAuthenticated, getPendingInvitationsHandler);
  app.post('/api/invitations/:inviteToken/accept', isAuthenticated, (req: express.Request, res: express.Response, next: express.NextFunction) => {
    try {
      req.body = sanitizeObject(req.body || {});
      return acceptInvitationHandler(req, res);
    } catch (err) {
      next(err);
    }
  });

  app.post('/api/invitations/:inviteToken/reject', (req: express.Request, res: express.Response, next: express.NextFunction) => {
    try {
      req.body = sanitizeObject(req.body || {});
      return rejectInvitationHandler(req, res);
    } catch (err) {
      next(err);
    }
  });
  app.get('/api/dao/:daoId/peer-invite-link', isAuthenticated, validateDaoIdMiddleware, getPeerInviteLinkHandler);

  // Payment endpoints
  app.post('/api/payments/estimate-gas', isAuthenticated, (req: express.Request, res: express.Response, next: express.NextFunction) => {
    try {
      req.body = sanitizeObject(req.body || {});
      return paymentsEstimateGasHandler(req, res);
    } catch (err) {
      next(err);
    }
  });
  app.get('/api/payments', isAuthenticated, paymentsIndexHandler);

  // Wallet transactions
  app.get('/api/wallet/transactions', isAuthenticated, getWalletTransactions);
  app.post('/api/wallet/transactions', isAuthenticated, (req: express.Request, res: express.Response, next: express.NextFunction) => {
    try {
      req.body = sanitizeObject(req.body || {});
      return createWalletTransaction(req, res);
    } catch (err) {
      next(err);
    }
  });

  // === DASHBOARD API ENDPOINTS ===
  app.get('/api/dashboard/stats', isAuthenticated, getDashboardStatsHandler);
  app.get('/api/dashboard/proposals', isAuthenticated, getDashboardProposalsHandler);
  app.get('/api/dashboard/vaults', isAuthenticated, getDashboardVaultsHandler);
  app.get('/api/dashboard/contributions', isAuthenticated, getDashboardContributionsHandler);
  app.get('/api/dashboard/members', isAuthenticated, getDashboardMembersHandler);
  app.get('/api/dashboard/tasks', isAuthenticated, getDashboardTasksHandler);
  app.get('/api/dashboard/complete', isAuthenticated, getDashboardCompleteHandler);

  // === MULTI-SIG ENDPOINTS ===
  // Treasury multi-sig delegates to daoTreasuryRoutes
  // Note: Multi-sig handlers are mounted via daoTreasuryRoutes at /api/dao/:daoId/treasury

  // === LEGACY VAULT API ENDPOINTS (410 Gone) ===
  // Migration: Personal vaults → /api/v1/wallets/vaults/*
  // Migration: DAO vaults → /api/v1/daos/:daoId/treasury/vaults/*
  app.use('/api/vaults', (req, res) => {
    res.setHeader('Deprecation', 'true');
    res.setHeader('Sunset', new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toUTCString());
    res.status(410).json({
      error: 'Gone',
      message: 'Vault endpoints have been migrated to V1 API structure',
      newEndpoints: {
        personal_vaults: '/api/v1/wallets/vaults',
        dao_vaults: '/api/v1/daos/:daoId/treasury/vaults',
        examples: {
          'POST /api/v1/wallets/vaults': 'Create personal vault',
          'GET /api/v1/wallets/vaults': 'List personal vaults',
          'POST /api/v1/daos/:daoId/treasury/vaults': 'Create DAO vault',
          'POST /api/v1/daos/:daoId/treasury/vaults/:vaultId/withdraw': 'Withdraw from DAO vault'
        }
      }
    });
  });

  // === LEGACY TOKEN UTILITIES (410 Gone) ===
  app.use('/api/tokens', (req, res) => {
    res.setHeader('Deprecation', 'true');
    res.setHeader('Sunset', new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toUTCString());
    res.status(410).json({
      error: 'Gone',
      message: 'Token utilities have been migrated to V1 endpoints',
      newEndpoints: {
        '/api/v1/tokens': 'GET - list supported tokens',
        '/api/v1/tokens/:tokenAddress/price': 'GET - get token price'
      }
    });
  });

  // === DAO SETTINGS API ===
  app.get('/api/dao/:daoId/settings', isAuthenticated, validateDaoIdMiddleware, getDaoSettingsHandler);
  app.patch('/api/dao/:daoId/settings', isAuthenticated, validateDaoIdMiddleware, requireDAORole('owner', 'admin'), async (req, res, next) => {
    try {
      req.body = sanitizeObject(req.body);
      await updateDaoSettingsHandler(req, res);
    } catch (err) {
      next(err);
    }
  });
  app.post('/api/dao/:daoId/settings/reset-invite', isAuthenticated, validateDaoIdMiddleware, requireDAORole('owner', 'admin'), resetInviteCodeHandler);
  app.get('/api/dao/:daoId/analytics', isAuthenticated, validateDaoIdMiddleware, getDaoAnalyticsHandler);

  // === REPUTATION API ===
  app.get('/api/reputation/user/:userId', isAuthenticated, getUserReputationHandler);
  app.get('/api/reputation/leaderboard', isAuthenticated, getReputationLeaderboardHandler);
  app.get('/api/reputation/leaderboard/:daoId', isAuthenticated, getDaoReputationLeaderboardHandler);

  // === ACHIEVEMENTS API ===
  app.use('/api/achievements', isAuthenticated, achievementsRouter);

  // === PROOF OF CONTRIBUTION API ===
  app.use('/api/proof-of-contribution', proofOfContributionRoutes);

  // === USER PROFILE API ===
  app.get('/api/user/profile', isAuthenticated, getUserProfileHandler);
  app.put('/api/user/profile', isAuthenticated, (req: express.Request, res: express.Response, next: express.NextFunction) => {
    try {
      req.body = sanitizeObject(req.body || {});
      return updateUserProfileHandler(req, res);
    } catch (err) {
      next(err);
    }
  });

  app.put('/api/user/profile/password', isAuthenticated, (req: express.Request, res: express.Response, next: express.NextFunction) => {
    try {
      req.body = sanitizeObject(req.body || {});
      return changePasswordHandler(req, res);
    } catch (err) {
      next(err);
    }
  });

  app.put('/api/user/profile/wallet', isAuthenticated, (req: express.Request, res: express.Response, next: express.NextFunction) => {
    try {
      req.body = sanitizeObject(req.body || {});
      return updateWalletAddressHandler(req, res);
    } catch (err) {
      next(err);
    }
  });

  // === WEEK 1 DASHBOARD API ===
  app.get('/api/users/persona-data', isAuthenticated, getUserPersonaDataHandler);
  app.get('/api/users/my-daos', isAuthenticated, getUserDAOsHandler);
  app.get('/api/dashboard/:persona', isAuthenticated, getDashboardPersonaHandler);

  // === STRIPE PAYMENT ROUTES === (Stripe integration)
  // Initialize Stripe if keys are available
  if (process.env.STRIPE_SECRET_KEY) {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: "2026-05-27.dahlia",
    });

    // One-time payment intent for DAO contributions, bounties, etc.
    app.post('/api/create-payment-intent', isAuthenticated, async (req, res) => {
      try {
        req.body = sanitizeObject(req.body || {});
        const amount = Number(req.body.amount);
        if (!Number.isFinite(amount) || amount <= 0 || amount > 100000) {
          return res.status(400).json({ error: 'INVALID_AMOUNT', message: 'Amount must be a positive number <= 100000' });
        }
        const paymentIntent = await stripe.paymentIntents.create({
          amount: Math.round(amount * 100), // Convert to cents
          currency: 'usd',
          metadata: {
            dao_payment: 'true',
            user_id: (req.user as any)?.claims?.id || 'guest'
          }
        });
        res.json({ clientSecret: paymentIntent.client_secret });
      } catch (error: any) {
        res.status(500).json({ message: 'Error creating payment intent: ' + error.message });
      }
    });

    // DAO membership subscription endpoint (simplified version for MVP)
    app.post('/api/get-or-create-subscription', isAuthenticated, (req, res, next) => {
      try {
        req.body = sanitizeObject(req.body || {});
        return (async (req2, res2) => {
          const user = req2.user as any;

          if (!user) {
            return res2.sendStatus(401);
          }

          try {
            // Create a customer first
            const customer = await stripe.customers.create({
              email: user.claims?.email || "user@example.com",
              name: user.claims?.username || "MtaaDAO Member",
            });

            // create subscription logic continued...
            return res2.json({ customerId: customer.id });
          } catch (err) {
            return res2.status(500).json({ error: 'SUBSCRIPTION_ERROR', message: String(err) });
          }
        })(req, res);
      } catch (err) {
        next(err);
      }
    });
  }

  // === MORIO AI ASSISTANT API ===
  app.use('/api/morio', morioRoutes);
  app.use('/api/onboarding', onboardingRoutes);
  app.use('/api/user-subscription', userSubscriptionRoutes);
  app.use('/api/revenue', isAuthenticated, requireRole('super_admin', 'admin'), revenueRoutes);

  // === SUBSCRIPTION MANAGEMENT API ===
  app.use('/api/subscription-management', subscriptionManagementRoutes);

  // === RBAC ENDPOINTS ===
  app.get('/api/admin/users', isAuthenticated, getUsersHandler);
  app.put('/api/admin/users/:userId/role', isAuthenticated, updateUserRoleHandler);

  // === PAYMENT RECONCILIATION ADMIN API ===
  console.log('[ROUTES] Mounting payment reconciliation admin routes...');
  app.use('/api/admin/payments/reconciliation', isAuthenticated, requireRole('super_admin'), paymentReconciliationRoutes);

  // === LEGACY TREASURY ENDPOINTS (410 Gone) ===
  app.use('/api/treasury-intelligence', (req, res) => {
    res.setHeader('Deprecation', 'true');
    res.setHeader('Sunset', new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toUTCString());
    res.status(410).json({
      error: 'Gone',
      message: 'Treasury intelligence endpoints have been reorganized.',
      newPaths: {
        '/api/v1/daos/:daoId/treasury/analyze': 'POST - analyze DAO treasury',
        '/api/v1/daos/:daoId/treasury/recommend-formula': 'POST - get governance formula',
        '/api/v1/daos/:daoId/treasury/health': 'GET - check DAO treasury health',
        '/api/v1/treasury/system/health': 'GET - system-wide health monitoring'
      }
    });
  });

  // NOTE: Legacy 410 handler for `/api/treasury` removed — routes are now served by `treasuryDataRoutes` above.

  app.use('/api/wallet-setup', (req, res) => {
    res.setHeader('Deprecation', 'true');
    res.setHeader('Sunset', new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toUTCString());
    res.status(410).json({
      error: 'Gone',
      message: 'Wallet setup has been reorganized to V1 endpoints',
      newPaths: {
        '/api/v1/wallets/setup': 'GET/POST - wallet creation and initialization',
        '/api/v1/wallets/core': 'GET/POST - core wallet operations'
      }
    });
  });

  app.use('/api/wallet/savings', (req, res) => {
    res.setHeader('Deprecation', 'true');
    res.setHeader('Sunset', new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toUTCString());
    res.status(410).json({
      error: 'Gone',
      message: 'Savings endpoints moved to V1 wallet routes',
      newPath: '/api/v1/wallets/savings'
    });
  });

  // === V1 TREASURY ROUTES ===
  // DAO-scoped treasury analysis
  // Dynamically import V1 routers to avoid top-level await issues
  v1DaosRouter = (await import('./routes/v1/daos')).default;
  v1TreasuryRouter = (await import('./routes/v1/treasury')).default;
  v1WalletsRouter = (await import('./routes/v1/wallets')).default;
  const v1BotsRouter = (await import('./routes/v1/bots')).default;
  const v1SettingsRouter = (await import('./routes/v1/settings')).default;

  app.use('/api/v1/daos', v1DaosRouter);
  // System-level treasury monitoring
  app.use('/api/v1/treasury', v1TreasuryRouter);
  // V1 wallets router (used by legacy 410 tombstones and new V1 wallets API)
  app.use('/api/v1/wallets', v1WalletsRouter);
  // V1 bots (trading) router
  app.use('/api/v1/bots', v1BotsRouter);
  // V1 settings router (advanced mode toggle, 2FA check)
  app.use('/api/v1/settings', v1SettingsRouter);

  // === PHONE VERIFICATION API ===
  app.use('/api/phone-verification', phoneVerificationRouter);

  // === CONTRIBUTION INDEXER API ===
  app.use('/api/contributions', contributionIndexerRoutes);

  // === EXCHANGE AND ORDER ROUTING API ===
  app.use('/api/exchanges', exchangeRoutes);
  // Order routes moved to v1 API

  // === STRATEGY DEPLOYMENT ===
  console.log('[ROUTES] Mounting strategy deployment routes...');

  // Rebalancing routes moved to v1 API

  // === WEBSOCKET PRICE STREAMING ===
  console.log('[ROUTES] Initializing WebSocket price stream service...');
  const existingIo = (server as any).io;
  let ioInstance;
  if (existingIo) {
    ioInstance = existingIo;
  } else {
    const { Server: IOServer } = await import('socket.io');
    ioInstance = new IOServer(server);
    // store on server to avoid duplicate servers later
    (server as any).io = ioInstance;
  }
  webSocketPriceStream.initialize(ioInstance);
  app.get('/api/websocket/price-stats', (req, res) => {
    res.json({
      status: 'active',
      subscriptions: webSocketPriceStream.getSubscriptionCount(),
      activeSubscriptions: webSocketPriceStream.getActiveSubscriptions(),
    });
  });

  // === PHASE 4: WEBSOCKET PRICE STREAMING ===
  priceStreamServer.initialize(server);
  app.get('/api/websocket/stats', (req, res) => {
    res.json({
      status: 'active',
      stats: priceStreamServer.getStats()
    });
  });

  // Admin AI Metrics routes (protected)
  //  CONSOLIDATED: adminAIMetricsRoutes merged into adminConsolidated (index.ts line 1226)
  console.log('[ROUTES] Admin routes consolidated at /api/admin (via index.ts)');

  // DAO Abuse Prevention routes (authenticated users)
  const daoAbusePreventionRouter = await import('./routes/dao-abuse-prevention');
  app.use('/api/dao-abuse-prevention', isAuthenticated, daoAbusePreventionRouter.default);

  // NOTE: Duplicate unauthenticated admin AI mount removed to prevent accidental exposure.

  // === BLOG, SUPPORT, AND SUCCESS STORIES ROUTES ===
  app.use('/api/blog', blogRoutes);
  app.use('/api/support', supportRoutes);
  app.use('/api/success-stories', successStoriesRoutes);

  // === TELEGRAM AND WHATSAPP INTEGRATION ROUTES ===
  app.use('/api/telegram-bot', telegramBotRoutes);
  app.use('/api/telegram', telegramIntegrationRoutes);
  app.use('/api/whatsapp', whatsappIntegrationRoutes);

  // === GATEWAY AGENT API ===
  // Gateway Agent is initialized asynchronously in server/index.ts
  // Dynamically import routes to avoid circular dependencies during app bootstrap
  try {
    // Note: Gateway routes are optionally mounted after Gateway Agent initialization
    // This prevents import errors during the initial registerRoutes() call
    // The routes will be properly mounted once the service is initialized
    console.log('ℹ️  Gateway Agent routes will be mounted asynchronously after service initialization');
  } catch (error) {
    console.warn('⚠️  Gateway Agent service initialization deferred');
  }
  // Mark routes as registered so index.ts doesn't re-mount duplicates
  (app as any).locals = (app as any).locals || {};
  (app as any).locals.routesRegistered = true;
  
  // Mount API V1 routes
  app.use('/api/v1', dashboardRouter);
}