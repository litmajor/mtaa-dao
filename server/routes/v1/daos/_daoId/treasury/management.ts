/**
 * V1 DAO Treasury - Management (Limits & Whitelist)
 * 
 * Treasury policy endpoints:
 * - GET    /v1/daos/:daoId/treasury/management/whitelist
 * - POST   /v1/daos/:daoId/treasury/management/whitelist/request
 * - POST   /v1/daos/:daoId/treasury/management/whitelist/:entryId/approve (admin only)
 * - GET    /v1/daos/:daoId/treasury/management/limits
 * - PUT    /v1/daos/:daoId/treasury/management/limits (admin only)
 */

import express, { Request, Response } from 'express';
import { authenticate } from '../../../../../auth';
import { rateLimitPerUser } from '../../../../../middleware/rateLimit';
import { treasuryAdminGuard } from './security';
import { logConsolidatedAuditEvent } from '../../../../../services/auditConsolidated';

const router = express.Router({ mergeParams: true });

// ════════════════════════════════════════════════════════════════════════════════
// WHITELIST MANAGEMENT
// ════════════════════════════════════════════════════════════════════════════════

/**
 * GET /v1/daos/:daoId/treasury/management/whitelist
 * Get treasury whitelist
 * 
 * Accessible by: All DAO members (read-only)
 */
router.get(
  '/whitelist',
  authenticate,
  rateLimitPerUser('treasury-whitelist', 30, '1min'),
  async (req: Request, res: Response) => {
    try {
      const { daoId } = req.params;

      res.json({
        success: true,
        daoId,
        whitelist: [],
      });
    } catch (error) {
      console.error('Treasury whitelist error:', error);
      res.status(500).json({ error: 'Failed to get whitelist' });
    }
  }
);

/**
 * POST /v1/daos/:daoId/treasury/management/whitelist/request
 * Request whitelist entry (for transfers to new addresses)
 * 
 * Accessible by: All DAO members
 */
router.post(
  '/whitelist/request',
  authenticate,
  rateLimitPerUser('treasury-whitelist-request', 10, '10min'),
  async (req: Request, res: Response) => {
    try {
      const { daoId } = req.params;
      const userId = (req as any).user?.id;
      const { address, name, reason } = req.body;

      if (!address) {
        return res.status(400).json({ error: 'Address required' });
      }

      // Log whitelist request
      await logConsolidatedAuditEvent({
        dao_id: daoId,
        user_id: userId,
        action: 'whitelist_entry_requested',
        severity: 'medium',
        details: { address, name, reason },
      } as any);

      res.status(201).json({
        success: true,
        daoId,
        requestId: `wl_req_${Date.now()}`,
        address,
        name,
        status: 'pending',
        requiredApprovals: 1,
      });
    } catch (error) {
      console.error('Treasury whitelist request error:', error);
      res.status(500).json({ error: 'Failed to submit whitelist request' });
    }
  }
);

/**
 * POST /v1/daos/:daoId/treasury/management/whitelist/:entryId/approve
 * Approve whitelist entry (admin only)
 * 
 * ⚠️ REQUIRES: treasuryAdminGuard (MtaaDAO security audit)
 * Accessible by: DAO admins/elders only
 */
router.post(
  '/whitelist/:entryId/approve',
  authenticate,
  treasuryAdminGuard,
  rateLimitPerUser('treasury-whitelist-approve', 20, '10min'),
  async (req: Request, res: Response) => {
    try {
      const { daoId, entryId } = req.params;
      const userId = (req as any).user?.id;
      const { approved, comment } = req.body;

      // Log approval with HIGH severity - whitelist changes affect treasury transfers
      await logConsolidatedAuditEvent({
        dao_id: daoId,
        user_id: userId,
        action: 'whitelist_entry_approved',
        severity: 'high',
        details: { entryId, approved, comment },
      } as any);

      res.json({
        success: true,
        entryId,
        approved,
        comment,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Treasury whitelist approve error:', error);
      res.status(500).json({ error: 'Failed to approve whitelist entry' });
    }
  }
);

// ════════════════════════════════════════════════════════════════════════════════
// TREASURY LIMITS
// ════════════════════════════════════════════════════════════════════════════════

/**
 * GET /v1/daos/:daoId/treasury/management/limits
 * Get treasury spending limits
 * 
 * Accessible by: All DAO members (read-only)
 */
router.get(
  '/limits',
  authenticate,
  rateLimitPerUser('treasury-limits', 30, '1min'),
  async (req: Request, res: Response) => {
    try {
      const { daoId } = req.params;

      res.json({
        success: true,
        daoId,
        limits: {
          dailyWithdrawalLimit: '50000.00',
          monthlyWithdrawalLimit: '500000.00',
          perTransactionLimit: '100000.00',
          singleApprovalThreshold: '10000.00',
          multiSigThreshold: '50000.00',
        },
      });
    } catch (error) {
      console.error('Treasury limits error:', error);
      res.status(500).json({ error: 'Failed to get limits' });
    }
  }
);

/**
 * PUT /v1/daos/:daoId/treasury/management/limits
 * Update treasury spending limits (admin only)
 * 
 * ⚠️ REQUIRES: treasuryAdminGuard
 * Accessible by: DAO admins/elders only
 */
router.put(
  '/limits',
  authenticate,
  treasuryAdminGuard,
  rateLimitPerUser('treasury-limits-update', 5, '1hour'),
  async (req: Request, res: Response) => {
    try {
      const { daoId } = req.params;
      const userId = (req as any).user?.id;
      const {
        dailyWithdrawalLimit,
        monthlyWithdrawalLimit,
        perTransactionLimit,
        multiSigThreshold,
      } = req.body;

      // Log limits update with HIGH severity - core treasury security
      await logConsolidatedAuditEvent({
        dao_id: daoId,
        user_id: userId,
        action: 'treasury_limits_updated',
        severity: 'high',
        details: {
          dailyWithdrawalLimit,
          monthlyWithdrawalLimit,
          perTransactionLimit,
          multiSigThreshold,
        },
      } as any);

      res.json({
        success: true,
        daoId,
        limits: {
          dailyWithdrawalLimit,
          monthlyWithdrawalLimit,
          perTransactionLimit,
          multiSigThreshold,
          updatedAt: new Date().toISOString(),
        },
      });
    } catch (error) {
      console.error('Treasury limits update error:', error);
      res.status(500).json({ error: 'Failed to update limits' });
    }
  }
);

export default router;
