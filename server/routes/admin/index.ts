import { Router } from 'express';

// Import all admin subrouters
import adminUsersRouter from './admin-users';
import adminDaosRouter from './admin-daos';
import adminProposalsRouter from './admin-proposals';
import adminTreasuryRouter from './admin-treasury';
import adminMembersRouter from './admin-members';
import adminVotingRouter from './admin-voting';
import adminAnalyticsRouter from './admin-analytics';
import adminRiskRouter from './admin-risk';
import adminAgentsEldersRouter from './admin-agents-elders';
import adminSecurityRouter from './admin-security';
import adminAuthRouter from './admin-auth';
import adminSettingsRouter from './admin-settings';
import adminFlagsRouter from './admin-flags';
import adminLogsRouter from './admin-logs';
import adminMonitoringRouter from './admin-monitoring';
import adminCommunityRouter from './admin-community';
import adminErrorMonitoringRouter from './admin-error-monitoring';
import adminErrorAlertsRouter from './admin-error-alerts';
import adminErrorAnalyticsRouter from './admin-error-analytics';
import adminNotificationsRouter from './admin-notifications';
import adminRecoveryRouter from './admin-recovery';
import adminBillingRouter from './admin-billing';

const router = Router();

// Mount all admin sub-routes
router.use(adminUsersRouter);        // User management: /api/admin/users/*
router.use(adminDaosRouter);         // DAO management: /api/admin/daos/*
router.use(adminProposalsRouter);    // Proposals management: /api/admin/daos/:daoId/proposals/*
router.use(adminTreasuryRouter);     // Treasury management: /api/admin/daos/:daoId/treasury/*
router.use(adminMembersRouter);      // Members management: /api/admin/daos/:daoId/members/*
router.use(adminVotingRouter);       // Voting configuration: /api/admin/daos/:daoId/voting/*
router.use(adminAnalyticsRouter);    // Analytics: /api/admin/analytics/*
router.use(adminRiskRouter);         // Risk Assessment: /api/admin/daos/:daoId/risk/*
router.use(adminAgentsEldersRouter); // Agents & Elders: /api/admin/agents-elders/*
router.use(adminSecurityRouter);     // Security: /api/admin/security/*
router.use(adminAuthRouter);         // Auth logs: /api/admin/auth/*
router.use(adminSettingsRouter);     // Settings: /api/admin/settings/*
router.use(adminFlagsRouter);        // Flags: /api/admin/flags/*
router.use(adminLogsRouter);         // Logs: /api/admin/logs/*
router.use(adminMonitoringRouter);   // Monitoring: /api/admin/monitoring/* (Phase 1 & 2)
router.use(adminCommunityRouter);    // Community: /api/admin/referrals/*, /api/admin/leaderboard/*, etc (Phase 3)
router.use(adminErrorMonitoringRouter); // Error Monitoring Dashboard: /api/admin/errors/* (Phase 3c Part 1)
router.use(adminErrorAlertsRouter);  // Error Alerts: /api/admin/alerts/* (Phase 3c Part 2)
router.use(adminErrorAnalyticsRouter); // Error Analytics: /api/admin/analytics/* (Phase 3c Part 3)
router.use(adminNotificationsRouter); // Notifications: /api/admin/notifications/* (Phase 3c Part 4)
router.use(adminRecoveryRouter); // Recovery Workflows: /api/admin/recovery/* (Phase 3c Part 5)
router.use(adminBillingRouter);      // Billing: /api/admin/billing/* (Platform analytics)

export default router;
