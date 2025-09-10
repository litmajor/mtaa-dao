import express from 'express';
import { isAuthenticated } from './nextAuthMiddleware';

// Import route modules
import healthRoutes from './routes/health';
import sseRoutes from './routes/sse';
import walletRoutes from './routes/wallet';
import walletSetupRoutes from './routes/wallet-setup';
import governanceRoutes from './routes/governance';
import tasksRoutes from './routes/tasks';
import reputationRoutes from './routes/reputation';
import analyticsRoutes from './routes/analytics';
import notificationsRoutes from './routes/notifications';
import disbursementsRoutes from './routes/disbursements';
import daoTreasuryRoutes from './routes/dao_treasury';
import daoSubscriptionsRoutes from './routes/dao-subscriptions';
import bountyEscrowRoutes from './routes/bounty-escrow';
import proposalExecutionRoutes from './routes/proposal-execution';
import paymentReconciliationRoutes from './routes/payment-reconciliation';
import stripeStatusRoutes from './routes/stripe-status';
import kotanipayStatusRoutes from './routes/kotanipay-status';
import mpesaStatusRoutes from './routes/mpesa-status';
import monitoringRoutes from './routes/monitoring';
import taskTemplatesRoutes from './api/task_templates';
import achievementsRouter from './api/achievements';

// Import API handlers
import { authUserHandler } from './api/auth_user';
import { authLoginHandler } from './api/auth_login';
import { authRegisterHandler } from './api/auth_register';
import { authTelegramLinkHandler } from './api/auth_telegram_link';
import { authOauthGoogleHandler } from './api/auth_oauth_google';
import { authOauthGoogleCallbackHandler } from './api/auth_oauth_google_callback';
import { accountDeleteHandler } from './api/account_delete';
import { daoDeployHandler } from './api/dao_deploy';
import { paymentsEstimateGasHandler } from './api/payments_estimate_gas';
import { paymentsIndexHandler } from './api/payments_index';
import { getWalletTransactions, createWalletTransaction } from './api/wallet_transactions';

// Import Vault API handlers
import { createVaultHandler, getUserVaultsHandler, getVaultHandler, depositToVaultHandler, withdrawFromVaultHandler, allocateToStrategyHandler, rebalanceVaultHandler, getVaultPortfolioHandler, getVaultPerformanceHandler, assessVaultRiskHandler, getVaultTransactionsHandler } from './api/vaults';
import { getSupportedTokensHandler, getTokenPriceHandler } from './api/vaults';
import { authorizeVaultAccess } from './api/authVault';

// Import DAO Settings handlers
import { getDaoSettingsHandler, updateDaoSettingsHandler, resetInviteCodeHandler, getDaoAnalyticsHandler } from './api/daoSettings';

// Import Reputation handlers
import { getUserReputationHandler, getReputationLeaderboardHandler, getDaoReputationLeaderboardHandler } from './api/reputation';

// Auth handlers
import { refreshTokenHandler, logoutHandler } from './auth';

// User profile handlers
import { 
  getUserProfileHandler, 
  updateUserProfileHandler, 
  changePasswordHandler, 
  updateWalletAddressHandler 
} from './api/user_profile';

// RBAC middleware
import { requireRole, requireDAORole, requirePermission } from './middleware/rbac';

// Admin handlers
import { getUsersHandler, updateUserRoleHandler } from './api/admin_users';


export function registerRoutes(app: express.Application) {
  // Health check
  app.use('/api/health', healthRoutes);

  // SSE routes
  app.use('/api/sse', sseRoutes);

  // Wallet routes
  app.use('/api/wallet', walletRoutes);
  app.use('/api/wallet-setup', walletSetupRoutes);

  // Governance and DAO routes
  app.use('/api/governance', governanceRoutes);
  app.use('/api/dao-treasury', daoTreasuryRoutes);
  app.use('/api/dao-subscriptions', daoSubscriptionsRoutes);

  // Task and bounty routes
  app.use('/api/tasks', tasksRoutes);
  app.use('/api/task-templates', taskTemplatesRoutes);
  app.use('/api/bounty-escrow', bountyEscrowRoutes);

  // Reputation and analytics
  app.use('/api/reputation', reputationRoutes);
  app.use('/api/analytics', analyticsRoutes);

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

  // Monitoring
  app.use('/api/monitoring', monitoringRoutes);

  // Auth endpoints
  app.get('/api/auth/user', isAuthenticated, authUserHandler);
  app.post('/api/auth/login', authLoginHandler);
  app.post('/api/auth/register', authRegisterHandler);
  app.post('/api/auth/telegram-link', authTelegramLinkHandler);
  app.get('/api/auth/oauth/google', authOauthGoogleHandler);
  app.get('/api/auth/oauth/google/callback', authOauthGoogleCallbackHandler);
  app.post('/api/auth/refresh-token', refreshTokenHandler);
  app.post('/api/auth/logout', logoutHandler);

  // Account management
  app.delete('/api/account/delete', isAuthenticated, accountDeleteHandler);

  // DAO deployment
  app.post('/api/dao/deploy', isAuthenticated, daoDeployHandler);

  // Payment endpoints
  app.post('/api/payments/estimate-gas', isAuthenticated, paymentsEstimateGasHandler);
  app.get('/api/payments', isAuthenticated, paymentsIndexHandler);

  // Wallet transactions
  app.get('/api/wallet/transactions', isAuthenticated, getWalletTransactions);
  app.post('/api/wallet/transactions', isAuthenticated, createWalletTransaction);

  // === VAULT API ENDPOINTS ===
  // Create vault
  app.post('/api/vaults', isAuthenticated, createVaultHandler);

  // Get user's vaults
  app.get('/api/vaults', isAuthenticated, getUserVaultsHandler);

  // Get vault details
  app.get('/api/vaults/:vaultId', isAuthenticated, authorizeVaultAccess, getVaultHandler);

  // Vault operations
  app.post('/api/vaults/:vaultId/deposit', isAuthenticated, authorizeVaultAccess, depositToVaultHandler);
  app.post('/api/vaults/:vaultId/withdraw', isAuthenticated, authorizeVaultAccess, withdrawFromVaultHandler);
  app.post('/api/vaults/:vaultId/allocate', isAuthenticated, authorizeVaultAccess, allocateToStrategyHandler);
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
  app.use('/api/achievements', achievementsRouter);

  // === USER PROFILE API ===
  app.get('/api/user/profile', isAuthenticated, getUserProfileHandler);
  app.put('/api/user/profile', isAuthenticated, updateUserProfileHandler);
  app.put('/api/user/profile/password', isAuthenticated, changePasswordHandler);
  app.put('/api/user/profile/wallet', isAuthenticated, updateWalletAddressHandler);

  // === RBAC ENDPOINTS ===
  app.get('/api/admin/users', isAuthenticated, requirePermission('read:users'), getUsersHandler);
  app.put('/api/admin/users/:userId/role', isAuthenticated, requirePermission('update:user_role'), updateUserRoleHandler);
}