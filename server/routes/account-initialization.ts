/**
 * ⚠️  DEPRECATED - CONSOLIDATED INTO system.ts
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * THIS FILE IS DEPRECATED (Sunset: 2026-09-01)
 * 
 * Account initialization endpoints have been consolidated into:
 * 👉 server/routes/system.ts
 * 
 * Route Migration:
 * POST /api/admin/initialize-accounts → POST /api/system/admin/initialize-accounts
 * GET /api/admin/accounts/summary → GET /api/system/admin/accounts-summary
 * 
 * Original Description:
 * Initializes default multi-account structure for all users
 * Protected by superuser authentication
 * 
 * ═══════════════════════════════════════════════════════════════════════════════
 * This file will be DELETED on or after 2026-09-01.
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import { Router, Request, Response, NextFunction } from 'express';
import { authenticateToken } from '../middleware/auth';
import initializeUserAccounts, { getAccountInitializationSummary } from '../migrations/initialize-user-accounts';

const router = Router();

/**
 * POST /api/admin/initialize-accounts
 * Initialize accounts for all users (superuser only)
 */
router.post(
  '/initialize-accounts',
  authenticateToken,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Check if user is superuser
      if (!req.user?.isSuperUser) {
        return res.status(403).json({
          success: false,
          message: 'Only superusers can initialize accounts',
        });
      }

      console.log('🔧 Admin initializing user accounts...');

      // Run initialization
      await initializeUserAccounts();

      // Get summary
      const summary = await getAccountInitializationSummary();

      res.json({
        success: true,
        message: 'User accounts initialized successfully',
        summary,
      });
    } catch (error) {
      console.error('Account initialization error:', error);
      next(error);
    }
  }
);

/**
 * GET /api/admin/accounts/summary
 * Get account initialization summary
 */
router.get(
  '/accounts/summary',
  authenticateToken,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Check if user is superuser or admin
      if (!req.user?.isSuperUser) {
        return res.status(403).json({
          success: false,
          message: 'Only superusers can access this endpoint',
        });
      }

      const summary = await getAccountInitializationSummary();

      res.json({
        success: true,
        summary,
      });
    } catch (error) {
      console.error('Error getting account summary:', error);
      next(error);
    }
  }
);

export default router;
