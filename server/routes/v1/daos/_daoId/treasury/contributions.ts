/**
 * V1 DAO Treasury - Contributions Management
 *
 * Contribution type and record endpoints:
 * - GET    /v1/daos/:daoId/treasury/contributions/types
 * - POST   /v1/daos/:daoId/treasury/contributions/types (admin)
 * - GET    /v1/daos/:daoId/treasury/contributions
 * - POST   /v1/daos/:daoId/treasury/contributions (member)
 * - GET    /v1/daos/:daoId/treasury/contributions/:contributionId
 * - POST   /v1/daos/:daoId/treasury/contributions/:contributionId/approve (admin)
 */

import express, { Request, Response } from 'express';
import { authenticate } from '../../../../../auth';
import { rateLimitPerUser } from '../../../../../middleware/rateLimit';
import { treasuryAdminGuard } from './security';
import { logConsolidatedAuditEvent } from '../../../../../services/auditConsolidated';

const router = express.Router({ mergeParams: true });

// ════════════════════════════════════════════════════════════════════════════════
// CONTRIBUTION TYPES
// ════════════════════════════════════════════════════════════════════════════════

/**
 * GET /v1/daos/:daoId/treasury/contributions/types
 * Get contribution types available for this DAO
 * 
 * Accessible by: All DAO members
 */
router.get(
  '/types',
  authenticate,
  rateLimitPerUser('treasury-contrib-types', 30, '1min'),
  async (req: Request, res: Response) => {
    try {
      const { daoId } = req.params;

      res.json({
        success: true,
        daoId,
        types: [
          {
            id: 'type_grant',
            name: 'Development Grant',
            description: 'Funding for development work',
            minimumAmount: '5000.00',
            maximumAmount: '50000.00',
            requiresApproval: true,
            createdAt: '2025-01-01T00:00:00Z',
          },
          {
            id: 'type_bounty',
            name: 'Bug Bounty Reward',
            description: 'Security vulnerability rewards',
            minimumAmount: '100.00',
            maximumAmount: '10000.00',
            requiresApproval: true,
            createdAt: '2025-01-05T00:00:00Z',
          },
          {
            id: 'type_donation',
            name: 'Community Donation',
            description: 'Voluntary contributions from community',
            minimumAmount: '10.00',
            maximumAmount: null,
            requiresApproval: false,
            createdAt: '2025-01-10T00:00:00Z',
          },
        ],
      });
    } catch (error) {
      console.error('Contribution types error:', error);
      res.status(500).json({ error: 'Failed to get contribution types' });
    }
  }
);

/**
 * POST /v1/daos/:daoId/treasury/contributions/types
 * Create new contribution type (admin only)
 * 
 * ⚠️ REQUIRES: treasuryAdminGuard
 * Accessible by: DAO admins/elders only
 */
router.post(
  '/types',
  authenticate,
  treasuryAdminGuard,
  rateLimitPerUser('treasury-contrib-types-create', 10, '10min'),
  async (req: Request, res: Response) => {
    try {
      const { daoId } = req.params;
      const userId = (req as any).user?.id;
      const { name, description, minimumAmount, maximumAmount, requiresApproval } =
        req.body;

      if (!name) {
        return res.status(400).json({ error: 'Type name required' });
      }

      // Log type creation with MEDIUM severity
      await logConsolidatedAuditEvent({
        dao_id: daoId,
        user_id: userId,
        action: 'contribution_type_created',
        severity: 'medium',
        details: { name, minimumAmount, maximumAmount, requiresApproval },
      } as any);

      res.status(201).json({
        success: true,
        daoId,
        type: {
          id: `type_${Date.now()}`,
          name,
          description,
          minimumAmount,
          maximumAmount,
          requiresApproval: requiresApproval ?? true,
          createdAt: new Date().toISOString(),
          createdBy: userId,
        },
      });
    } catch (error) {
      console.error('Contribution type creation error:', error);
      res.status(500).json({ error: 'Failed to create contribution type' });
    }
  }
);

// ════════════════════════════════════════════════════════════════════════════════
// CONTRIBUTIONS (RECORDS)
// ════════════════════════════════════════════════════════════════════════════════

/**
 * GET /v1/daos/:daoId/treasury/contributions
 * Get all contributions to this DAO treasury
 * 
 * Query params:
 * - limit: 50 (default)
 * - offset: 0 (default)
 * - status: pending, approved, rejected
 * - typeId: filter by contribution type
 * 
 * Accessible by: All DAO members
 */
router.get(
  '/',
  authenticate,
  rateLimitPerUser('treasury-contrib-list', 30, '1min'),
  async (req: Request, res: Response) => {
    try {
      const { daoId } = req.params;
      const { limit = '50', offset = '0', status, typeId } = req.query;

      res.json({
        success: true,
        daoId,
        contributions: [
          {
            id: 'contrib_001',
            typeId: 'type_grant',
            typeName: 'Development Grant',
            amount: '25000.00',
            contributor: 'dev-team',
            status: 'approved',
            description: 'Q1 development funding',
            createdAt: '2025-02-15T10:30:00Z',
            approvedAt: '2025-02-16T14:20:00Z',
            approvedBy: 'admin-1',
          },
          {
            id: 'contrib_002',
            typeId: 'type_bounty',
            typeName: 'Bug Bounty Reward',
            amount: '5000.00',
            contributor: 'security-researcher',
            status: 'pending',
            description: 'Smart contract vulnerability report',
            createdAt: '2025-02-18T16:45:00Z',
            requiredApprovals: 1,
          },
        ],
        pagination: {
          limit: parseInt(limit as string),
          offset: parseInt(offset as string),
          total: 2,
        },
      });
    } catch (error) {
      console.error('Contributions list error:', error);
      res.status(500).json({ error: 'Failed to list contributions' });
    }
  }
);

/**
 * POST /v1/daos/:daoId/treasury/contributions
 * Submit a new contribution (member)
 * 
 * Accessible by: All DAO members
 */
router.post(
  '/',
  authenticate,
  rateLimitPerUser('treasury-contrib-submit', 20, '10min'),
  async (req: Request, res: Response) => {
    try {
      const { daoId } = req.params;
      const userId = (req as any).user?.id;
      const { typeId, amount, currency, description } = req.body;

      if (!typeId || !amount) {
        return res
          .status(400)
          .json({ error: 'Type and amount required' });
      }

      // Log contribution submission with MEDIUM severity
      await logConsolidatedAuditEvent({
        dao_id: daoId,
        user_id: userId,
        action: 'contribution_submitted',
        severity: 'medium',
        details: { typeId, amount, currency, description },
      } as any);

      res.status(201).json({
        success: true,
        daoId,
        contribution: {
          id: `contrib_${Date.now()}`,
          typeId,
          amount,
          currency: currency || 'USDC',
          status: 'pending',
          description,
          submittedAt: new Date().toISOString(),
          submittedBy: userId,
        },
      });
    } catch (error) {
      console.error('Contribution submission error:', error);
      res.status(500).json({ error: 'Failed to submit contribution' });
    }
  }
);

/**
 * GET /v1/daos/:daoId/treasury/contributions/:contributionId
 * Get contribution details
 * 
 * Accessible by: All DAO members
 */
router.get(
  '/:contributionId',
  authenticate,
  rateLimitPerUser('treasury-contrib-get', 30, '1min'),
  async (req: Request, res: Response) => {
    try {
      const { daoId, contributionId } = req.params;

      res.json({
        success: true,
        daoId,
        contributionId,
        contribution: {
          id: contributionId,
          typeId: 'type_grant',
          typeName: 'Development Grant',
          amount: '25000.00',
          currency: 'USDC',
          contributor: 'dev-team',
          status: 'approved',
          description: 'Q1 development funding',
          createdAt: '2025-02-15T10:30:00Z',
          approvedAt: '2025-02-16T14:20:00Z',
          approvedBy: 'admin-1',
          approvalComment: 'Approved per budget allocation',
        },
      });
    } catch (error) {
      console.error('Contribution get error:', error);
      res.status(500).json({ error: 'Failed to get contribution' });
    }
  }
);

/**
 * POST /v1/daos/:daoId/treasury/contributions/:contributionId/approve
 * Approve a pending contribution (admin only)
 * 
 * ⚠️ REQUIRES: treasuryAdminGuard
 * Accessible by: DAO admins/elders only
 * 
 * Logs with CRITICAL severity for contributions that trigger transfers
 */
router.post(
  '/:contributionId/approve',
  authenticate,
  treasuryAdminGuard,
  rateLimitPerUser('treasury-contrib-approve', 20, '10min'),
  async (req: Request, res: Response) => {
    try {
      const { daoId, contributionId } = req.params;
      const userId = (req as any).user?.id;
      const { approved, comment } = req.body;

      // Log approval with CRITICAL severity - affects fund availability
      await logConsolidatedAuditEvent({
        dao_id: daoId,
        user_id: userId,
        action: 'contribution_approved',
        severity: 'critical',
        details: { contributionId, approved, comment },
      } as any);

      res.json({
        success: true,
        daoId,
        contributionId,
        approval: {
          approvedAt: new Date().toISOString(),
          approvedBy: userId,
          status: approved ? 'approved' : 'rejected',
          comment,
        },
      });
    } catch (error) {
      console.error('Contribution approval error:', error);
      res.status(500).json({ error: 'Failed to approve contribution' });
    }
  }
);

export default router;
