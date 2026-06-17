import express from 'express';
import WalletAuditEngine from '../services/auditEngine';
import { logger } from '../utils/logger';
import { isAuthenticated, requireAdmin } from '../nextAuthMiddleware';

const adminRouter = express.Router();

// Use the app-wide auth middleware patterns: require authentication and admin role
adminRouter.get('/audit/user/:userId', isAuthenticated, requireAdmin, async (req: any, res) => {
  try {
    const report = await WalletAuditEngine.auditUserWallet(req.params.userId);
    return res.status(200).json({ status: 'success', report });
  } catch (error: any) {
    logger.error('Admin user audit command failed', { error: error.message });
    return res.status(500).json({ error: error.message });
  }
});

adminRouter.post('/audit/global-reconciliation', isAuthenticated, requireAdmin, async (_req, res) => {
  try {
    WalletAuditEngine.runGlobalAudit()
      .then((summary) => logger.info('[CRON WORKER STATUS] Global audit complete.', summary))
      .catch((err) => logger.error('[CRON WORKER FATAL] Global audit worker crashed.', { message: err.message }));

    return res.status(202).json({ status: 'accepted', message: 'Global ledger reconciliation dispatched.' });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

export default adminRouter;
