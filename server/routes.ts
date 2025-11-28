import express, { Express } from 'express';
import { isAuthenticated } from './nextAuthMiddleware';
import Stripe from "stripe"; // Stripe integration

// Import route modules
import healthRoutes from './routes/health';
import sseRoutes from './routes/sse';
import walletRoutes from './routes/wallet';
import walletSetupRoutes from './routes/wallet-setup';
import governanceRoutes from './routes/governance';
import governanceQuorumRouter from './routes/governance-quorum';
import tasksRoutes from './routes/tasks';
import reputationRoutes from './routes/reputation';
import analyticsRoutes from './routes/analytics';
import notificationsRoutes from './routes/notifications';
import disbursementsRoutes from './routes/disbursements';
import daoTreasuryRoutes from './routes/dao_treasury';
import daoSubscriptionsRoutes from './routes/dao-subscriptions';
import daosRoutes from './routes/daos';
import bountyEscrowRoutes from './routes/bounty-escrow';
import proposalExecutionRoutes from './routes/proposal-execution';
import paymentReconciliationRoutes from './routes/payment-reconciliation';
import stripeStatusRoutes from './routes/stripe-status';
import kotanipayStatusRoutes from './routes/kotanipay-status';
import mpesaStatusRoutes from './routes/mpesa-status';
import monitoringRoutes from './routes/monitoring';
import taskTemplatesRoutes from './api/task_templates';
import achievementsRouter from './api/achievements';
import vaultRoutes from './routes/vault';
import challengesRoutes from './routes/challenges';
import morioRoutes from './routes/morio';
import profileRoutes from './routes/profile';
import accountRoutes from './routes/account';
import referralRewardsRoutes from './routes/referral-rewards';
import proposalEngagementRoutes from './routes/proposal-engagement';
import adminRoutes from './routes/admin';
import adminAIMetricsRoutes from './routes/admin-ai-metrics';
import announcementsRoutes from './routes/announcements';
import investmentPoolsRoutes from './routes/investment-pools';
import poolGovernanceRoutes from './routes/pool-governance';
import depositsWithdrawalsRoutes from './routes/deposits-withdrawals';
import treasuryIntelligenceRoutes from './routes/treasury-intelligence';
import phoneVerificationRouter from './routes/phone-verification';
import daoChatRoutes from './routes/dao-chat';
import onboardingRoutes from './routes/onboarding';
import subscriptionManagementRoutes from './routes/subscription-management'; // Import subscription management routes
import userSubscriptionRoutes from './routes/user-subscription';
import revenueRoutes from './routes/revenue';
// Import savings routes
import savingsRoutes from './routes/savings';
// Import Phase 3 Rules Engine routes
import rulesRoutes from './routes/rules';
// Import blog, support, and success stories routes
import blogRoutes from './routes/blog';
import supportRoutes from './routes/support';
import successStoriesRoutes from './routes/success-stories';

// Import Telegram and WhatsApp routes
import telegramBotRoutes from './routes/telegram-bot';
import telegramIntegrationRoutes from './routes/telegram-integration';
import whatsappIntegrationRoutes from './routes/whatsapp-integration';


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

// Import Vault API handlers
import { createVaultHandler, getUserVaultsHandler, getVaultHandler, depositToVaultHandler, withdrawFromVaultHandler, allocateToVaultHandler, rebalanceVaultHandler, getVaultPortfolioHandler, getVaultPerformanceHandler, assessVaultRiskHandler, getVaultTransactionsHandler } from './api/vaults';
import { allocateToStrategyHandler } from './api/vaults';
import { getSupportedTokensHandler, getTokenPriceHandler } from './api/vaults';
import { authorizeVaultAccess } from './api/authVault';

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

// RBAC middleware
import { requireRole, requireDAORole, requirePermission } from './middleware/rbac';

// Rate limiting middleware
import {
  registerRateLimiter,
  otpResendRateLimiter,
  otpVerifyRateLimiter,
  loginRateLimiter
} from './middleware/rateLimiter';

// Admin handlers
import {getUsersHandler,updateUserRoleHandler } from './api/admin_users';


export async function registerRoutes(app: Express) {
  // Health check
  app.use('/api/health', healthRoutes);

  // SSE routes
  app.use('/api/sse', sseRoutes);

  // Wallet routes
  app.use('/api/wallet', walletRoutes);
  app.use('/api/wallet-setup', walletSetupRoutes);
  // Savings routes
  app.use('/api/wallet/savings', savingsRoutes);


  // Governance and DAO routes
  app.use('/api/governance', governanceRoutes);
  app.use('/api/governance', governanceQuorumRouter);
  app.use('/api/daos', daosRoutes);
  app.use('/api/dao-treasury', daoTreasuryRoutes);
  app.use('/api/dao-subscriptions', daoSubscriptionsRoutes);

  // Task and bounty routes
  app.use('/api/tasks', tasksRoutes);
  app.use('/api/task-templates', taskTemplatesRoutes);
  app.use('/api/bounty-escrow', bountyEscrowRoutes);

  // Reputation and analytics
  app.use('/api/reputation', reputationRoutes);
  app.use("/api/analytics", analyticsRoutes);
  app.use("/api/challenges", challengesRoutes);

  // Notifications and disbursements
  app.use('/api/notifications', notificationsRoutes);
  app.use('/api/disbursements', disbursementsRoutes);

  // Proposal execution
  app.use('/api/proposal-execution', proposalExecutionRoutes);

  // Payment and reconciliation
  app.use('/api/payment-reconciliation', paymentReconciliationRoutes);
  app.use('/api/stripe-status', stripeStatusRoutes);
  app.use('/api/kotanipay-status', kotanipayStatusRoutes);
  app.use('/api/mpesa-status', mpesaStatusRoutes);
  app.use('/api/deposits', depositsWithdrawalsRoutes);
  app.use('/api/withdrawals', depositsWithdrawalsRoutes);
  app.use('/api/transactions', depositsWithdrawalsRoutes);

  // Monitoring
  app.use('/api/monitoring', monitoringRoutes);

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
  app.delete('/api/account/delete', isAuthenticated, accountDeleteHandler); // Legacy endpoint
  app.use('/api/referral-rewards', referralRewardsRoutes);
  app.use('/api', proposalEngagementRoutes); // Proposal likes/comments/engagement
  app.use('/api/dao-chat', daoChatRoutes); // DAO chat messages and reactions
  app.use('/api/admin', adminRoutes); // Admin/SuperUser management
  app.use('/api/announcements', announcementsRoutes); // Platform announcements
  app.use('/api/investment-pools', investmentPoolsRoutes); // Multi-asset investment pools
  app.use('/api/pool-governance', poolGovernanceRoutes); // Pool weighted voting governance
  app.use('/api', rulesRoutes); // Phase 3 Custom Rules Engine

  // DAO deployment
  app.post('/api/dao/deploy', isAuthenticated, daoDeployHandler);
  app.post('/api/dao-deploy', isAuthenticated, daoDeployHandler); // Alias for client compatibility

  // DAO Rotation Management
  app.get('/api/dao/:daoId/rotation/status', getRotationStatusHandler);
  app.post('/api/dao/:daoId/rotation/process', isAuthenticated, processRotationHandler);
  app.get('/api/dao/:daoId/rotation/next-recipient', getNextRecipientHandler);

  // DAO Invitation Management
  app.post('/api/dao/:daoId/invitations', isAuthenticated, createInvitationHandler);
  app.get('/api/dao/:daoId/invitations', getDaoInvitationsHandler);
  app.delete('/api/dao/:daoId/invitations/:invitationId', isAuthenticated, revokeInvitationHandler);
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
  // Treasury multi-sig
  app.post('/api/dao-treasury/:daoId/multisig/propose', isAuthenticated, async (req, res) => {
    const { proposeWithdrawalHandler } = await import('./routes/dao_treasury');
    return proposeWithdrawalHandler(req, res);
  });
  
  app.post('/api/dao-treasury/:daoId/multisig/:txId/sign', isAuthenticated, async (req, res) => {
    const { signTransactionHandler } = await import('./routes/dao_treasury');
    return signTransactionHandler(req, res);
  });
  
  app.get('/api/dao-treasury/:daoId/multisig/pending', isAuthenticated, async (req, res) => {
    const { getPendingTransactionsHandler } = await import('./routes/dao_treasury');
    return getPendingTransactionsHandler(req, res);
  });

  // === VAULT API ENDPOINTS ===
  // Create vault
  app.post('/api/vaults', isAuthenticated, createVaultHandler);

  // Allocate to vault (new endpoint)
  app.post('/api/vaults/:vaultId/allocate', isAuthenticated, authorizeVaultAccess, allocateToVaultHandler);

  // Get user's vaults
  app.get('/api/vaults', isAuthenticated, getUserVaultsHandler);

  // Get vault details
  app.get('/api/vaults/:vaultId', isAuthenticated, authorizeVaultAccess, getVaultHandler);

  // Vault operations
  app.post('/api/vaults/:vaultId/deposit', isAuthenticated, authorizeVaultAccess, depositToVaultHandler);
  app.post('/api/vaults/:vaultId/withdraw', isAuthenticated, authorizeVaultAccess, withdrawFromVaultHandler);
  app.post('/api/vaults/:vaultId/allocate', isAuthenticated, authorizeVaultAccess, allocateToVaultHandler);
  app.post('/api/vaults/:vaultId/rebalance', isAuthenticated, authorizeVaultAccess, rebalanceVaultHandler);

  // Vault analytics
  app.get('/api/vaults/:vaultId/portfolio', isAuthenticated, authorizeVaultAccess, getVaultPortfolioHandler);
  app.get('/api/vaults/:vaultId/performance', isAuthenticated, authorizeVaultAccess, getVaultPerformanceHandler);
  app.get('/api/vaults/:vaultId/risk', isAuthenticated, authorizeVaultAccess, assessVaultRiskHandler);
  app.get('/api/vaults/:vaultId/transactions', isAuthenticated, authorizeVaultAccess, getVaultTransactionsHandler);

  // Token utilities
  app.get('/api/tokens', getSupportedTokensHandler);
  app.get('/api/tokens/:tokenAddress/price', getTokenPriceHandler);

  // === DAO SETTINGS API ===
  app.get('/api/dao/:daoId/settings', isAuthenticated, getDaoSettingsHandler);
  app.patch('/api/dao/:daoId/settings', isAuthenticated, updateDaoSettingsHandler);
  app.post('/api/dao/:daoId/settings/reset-invite', isAuthenticated, resetInviteCodeHandler);
  app.get('/api/dao/:daoId/analytics', isAuthenticated, getDaoAnalyticsHandler);

  // === REPUTATION API ===
  app.get('/api/reputation/user/:userId', isAuthenticated, getUserReputationHandler);
  app.get('/api/reputation/leaderboard', isAuthenticated, getReputationLeaderboardHandler);
  app.get('/api/reputation/leaderboard/:daoId', isAuthenticated, getDaoReputationLeaderboardHandler);

  // === ACHIEVEMENTS API ===
  app.use('/api/achievements', isAuthenticated, achievementsRouter);

  // === USERPROFILE API ===
  app.get('/api/user/profile', isAuthenticated, getUserProfileHandler);
  app.put('/api/user/profile', isAuthenticated, updateUserProfileHandler);
  app.put('/api/user/profile/password', isAuthenticated, changePasswordHandler);
  app.put('/api/user/profile/wallet', isAuthenticated, updateWalletAddressHandler);

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
            user_id: (req.user as any)?.claims?.id || "anonymous"
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

  // === TREASURY INTELLIGENCE API ===
  app.use('/api/treasury-intelligence', treasuryIntelligenceRoutes);

  // === PHONE VERIFICATION API ===
  app.use('/api/phone-verification', phoneVerificationRouter);

  // DAO Abuse Prevention routes
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