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
// ✅ V1 ROUTERS (Versioned API Architecture)
const v1DaosRouter = (await import('./routes/v1/daos')).default;
const v1TreasuryRouter = (await import('./routes/v1/treasury')).default;
import graphPropagationRoutes from './routes/graph-propagation';
import userSubscriptionRoutes from './routes/user-subscription';
import revenueRoutes from './routes/revenue';
// Import Phase 3 Rules Engine routes
import rulesRoutes from './routes/rules';
// Import blog, support, and success stories routes
import blogRoutes from './routes/blog';
import supportRoutes from './routes/support';
import successStoriesRoutes from './routes/success-stories';
// Import Yuki trading platform routes
import yukiRoutes from './routes/yuki';
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

// Rate limiting middleware
import {
  registerRateLimiter,
  otpResendRateLimiter,
  otpVerifyRateLimiter,
  loginRateLimiter
} from './middleware/rateLimiter';

// Timeout middleware
import { createTimeoutMiddleware } from './middleware/timeoutMiddleware';

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

  // ✅ DAO consolidated routes now mounted via V1 router at /api/dao/:daoId
  
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
  app.use('/api/daos', daosRoutes);
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

  app.use('/api/deposits', depositsWithdrawalsRoutes);
  app.use('/api/withdrawals', depositsWithdrawalsRoutes);
  app.use('/api/transactions', depositsWithdrawalsRoutes);
  app.use('/api/p2p-transfers', p2pTransfersRoutes);

  // ============================================================================
  // 2FA AND PIN VERIFICATION ROUTES - CONSOLIDATED
  // ============================================================================
  // All 2FA and PIN verification routes migrated to v1 API
  // TODO: See routes/v1/auth/2fa.ts for current implementation
  console.log('[ROUTES] 2FA and PIN verification routes loaded from v1 API');

  // Monitoring
  app.use('/api/monitoring', monitoringRoutes);

  // Job Status and Progress Tracking (Async Job Management)
  console.log('[ROUTES] Mounting job status and progress routes...');
  app.use('/api/jobs', jobsRoutes);

  // Agent management and control
  console.log('[ROUTES] Mounting agent management routes...');
  app.use('/api/agents', agentRoutes);

  // Auth endpoints (with rate limiting)
  app.get('/api/auth/user', isAuthenticated, authUserHandler);
  app.post('/api/auth/login', loginRateLimiter, authLoginHandler);
  app.post('/api/auth/register', registerRateLimiter, authRegisterHandler);
  app.post('/api/auth/verify-otp', otpVerifyRateLimiter, verifyOtpHandler);
  app.post('/api/auth/resend-otp', otpResendRateLimiter, resendOtpHandler);
  app.post('/api/auth/telegram-link', authTelegramLinkHandler);
  app.get('/api/auth/oauth/google', authOauthGoogleHandler);
  app.get('/api/auth/oauth/google/callback', authOauthGoogleCallbackHandler);
  app.post('/api/auth/refresh-token', refreshTokenHandler);
  app.post('/api/auth/logout', logoutHandler);

  // Profile and Account management
  app.use('/api/profile', profileRoutes);
  app.use('/api/account', accountRoutes);
  app.use('/api/admin', isAuthenticated, requireRole('super_admin', 'admin'), accountInitializationRoutes); // Account initialization endpoints
  app.delete('/api/account/delete', isAuthenticated, accountDeleteHandler); // Legacy endpoint
  app.use('/api/referral-rewards', referralRewardsRoutes);
  app.use('/api/admin', isAuthenticated, requireRole('super_admin', 'admin'), adminRoutes); // Admin/SuperUser management (protected)
  app.use('/api/announcements', isAuthenticated, announcementsRoutes); // Platform announcements (authenticated)
  app.use('/api', rulesRoutes); // Phase 3 Custom Rules Engine

  // DeFi DEX Integration - moved to v1 API

  // Graph Propagation System
  console.log('[ROUTES] Mounting graph propagation routes...');
  app.use('/api/propagation', graphPropagationRoutes);

  // Yuki Trading Platform
  console.log('[ROUTES] Mounting Yuki trading platform routes...');
  app.use('/api/yuki', yukiRoutes);

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
  app.post('/api/dao/deploy', isAuthenticated, requireRole('admin', 'moderator'), async (req, res, next) => {
    try {
      await daoDeployHandler(req, res);
    } catch (error) {
      next(error);
    }
  });
  
  // Backwards compatibility (deprecated alias)
  app.post('/api/dao-deploy', isAuthenticated, requireRole('admin', 'moderator'), async (req, res, next) => {
    try {
      res.set('X-Deprecated', 'true');
      res.set('X-Redirect-To', '/api/dao/deploy');
      await daoDeployHandler(req, res);
    } catch (error) {
      next(error);
    }
  });

  // DAO Rotation Management (DAO admin/owner only)
  app.get('/api/dao/:daoId/rotation/status', getRotationStatusHandler);
  app.post('/api/dao/:daoId/rotation/process', isAuthenticated, requireDAORole('owner', 'admin'), processRotationHandler);
  app.get('/api/dao/:daoId/rotation/next-recipient', getNextRecipientHandler);

  // DAO Invitation Management (DAO admin/owner for managing, members for accepting)
  app.post('/api/dao/:daoId/invitations', isAuthenticated, requireDAORole('owner', 'admin'), createInvitationHandler);
  app.get('/api/dao/:daoId/invitations', isAuthenticated, requireDAORole('owner', 'admin', 'member'), getDaoInvitationsHandler);
  app.delete('/api/dao/:daoId/invitations/:invitationId', isAuthenticated, requireDAORole('owner', 'admin'), revokeInvitationHandler);
  app.get('/api/invitations/pending', isAuthenticated, getPendingInvitationsHandler);
  app.post('/api/invitations/:inviteToken/accept', isAuthenticated, acceptInvitationHandler);
  app.post('/api/invitations/:inviteToken/reject', rejectInvitationHandler);
  app.get('/api/dao/:daoId/peer-invite-link', isAuthenticated, getPeerInviteLinkHandler);

  // Payment endpoints
  app.post('/api/payments/estimate-gas', isAuthenticated, paymentsEstimateGasHandler);
  app.get('/api/payments', isAuthenticated, paymentsIndexHandler);

  // Wallet transactions
  app.get('/api/wallet/transactions', isAuthenticated, getWalletTransactions);
  app.post('/api/wallet/transactions', isAuthenticated, createWalletTransaction);

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
  app.get('/api/dao/:daoId/settings', isAuthenticated, getDaoSettingsHandler);
  app.patch('/api/dao/:daoId/settings', isAuthenticated, requireDAORole('owner', 'admin'), updateDaoSettingsHandler);
  app.post('/api/dao/:daoId/settings/reset-invite', isAuthenticated, requireDAORole('owner', 'admin'), resetInviteCodeHandler);
  app.get('/api/dao/:daoId/analytics', isAuthenticated, getDaoAnalyticsHandler);

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
  app.put('/api/user/profile', isAuthenticated, updateUserProfileHandler);
  app.put('/api/user/profile/password', isAuthenticated, changePasswordHandler);
  app.put('/api/user/profile/wallet', isAuthenticated, updateWalletAddressHandler);

  // === WEEK 1 DASHBOARD API ===
  app.get('/api/users/persona-data', isAuthenticated, getUserPersonaDataHandler);
  app.get('/api/users/my-daos', isAuthenticated, getUserDAOsHandler);
  app.get('/api/dashboard/:persona', isAuthenticated, getDashboardPersonaHandler);

  // === STRIPE PAYMENT ROUTES === (Stripe integration)
  // Initialize Stripe if keys are available
  if (process.env.STRIPE_SECRET_KEY) {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: "2025-08-27.basil",
    });

    // One-time payment intent for DAO contributions, bounties, etc.
    app.post("/api/create-payment-intent", async (req, res) => {
      try {
        const { amount } = req.body;
        const paymentIntent = await stripe.paymentIntents.create({
          amount: Math.round(amount * 100), // Convert to cents
          currency: "usd",
          metadata: {
            dao_payment: "true",
            user_id: (req.user as any)?.claims?.id || "guest"
          }
        });
        res.json({ clientSecret: paymentIntent.client_secret });
      } catch (error: any) {
        res
          .status(500)
          .json({ message: "Error creating payment intent: " + error.message });
      }
    });

    // DAO membership subscription endpoint (simplified version for MVP)
    app.post('/api/get-or-create-subscription', isAuthenticated, async (req, res) => {
      const user = req.user as any;

      if (!user) {
        return res.sendStatus(401);
      }

      try {
        // Create a customer first
        const customer = await stripe.customers.create({
          email: user.claims?.email || "user@example.com",
          name: user.claims?.username || "MtaaDAO Member",
        });

        // Create subscription (requires real STRIPE_PRICE_ID from dashboard)
        if (!process.env.STRIPE_PRICE_ID) {
          return res.status(400).json({
            error: { message: "Stripe price ID not configured. Please set STRIPE_PRICE_ID environment variable." }
          });
        }

        const subscription = await stripe.subscriptions.create({
          customer: customer.id,
          items: [{
            price: process.env.STRIPE_PRICE_ID,
          }],
          payment_behavior: 'default_incomplete',
          expand: ['latest_invoice.payment_intent'],
        });

        // Type assertion for the payment_intent
        const invoice = subscription.latest_invoice as any;
        const clientSecret = invoice?.payment_intent?.client_secret;

        res.send({
          subscriptionId: subscription.id,
          clientSecret: clientSecret,
        });
      } catch (error: any) {
        return res.status(400).send({ error: { message: error.message } });
      }
    });
  }

  // === MORIO AI ASSISTANT API ===
  app.use('/api/morio', morioRoutes);
  app.use('/api/onboarding', onboardingRoutes);
  app.use('/api/user-subscription', userSubscriptionRoutes);
  app.use('/api/revenue', revenueRoutes);

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

  app.use('/api/treasury', (req, res) => {
    res.setHeader('Deprecation', 'true');
    res.setHeader('Sunset', new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toUTCString());
    res.status(410).json({
      error: 'Gone',
      message: 'Treasury analysis endpoints have been migrated to V1 API structure.',
      newPaths: {
        '/api/v1/daos/:daoId/treasury': 'All treasury operations (vault, withdrawals, analysis)',
        '/api/v1/treasury/system/health': 'GET - system-wide treasury monitoring'
      }
    });
  });

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
  app.use('/api/v1/daos', v1DaosRouter);
  // System-level treasury monitoring
  app.use('/api/v1/treasury', v1TreasuryRouter);

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
  const io = (server as any).io || new (await import('socket.io')).Server(server);
  webSocketPriceStream.initialize(io);
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
  console.log('[ROUTES] Mounting admin AI metrics routes...');
  app.use('/api/admin', isAuthenticated, requireRole('super_admin', 'admin'), adminAIMetricsRoutes);

  // DAO Abuse Prevention routes (authenticated users)
  app.use('/api/dao-abuse-prevention', isAuthenticated);

  // Finalize remaining routes
  const daoAbusePreventionRouter = await import('./routes/dao-abuse-prevention');
  app.use('/api/dao-abuse-prevention', daoAbusePreventionRouter.default);

  // === ADMIN AI METRICS ROUTE ===
  app.use('/api/admin', adminAIMetricsRoutes);

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
}