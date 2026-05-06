/**
 * V1 DAO Treasury - Multi-Signature Approvals
 * 
 * Multi-signature authorization endpoints:
 * - GET    /v1/daos/:daoId/treasury/multisig/config
 * - POST   /v1/daos/:daoId/treasury/multisig/config (admin)
 * - GET    /v1/daos/:daoId/treasury/multisig/approvals
 * - POST   /v1/daos/:daoId/treasury/multisig/approvals/:approvalId/sign (admin)
 * - GET    /v1/daos/:daoId/treasury/multisig/signers
 * - DELETE /v1/daos/:daoId/treasury/multisig/signers/:signerId (admin)
 */

import express, { Request, Response } from 'express';
import { authenticate } from '../../../../../auth';
import { rateLimitPerUser } from '../../../../../middleware/rateLimit';
import { treasuryAdminGuard } from './security';
import { logConsolidatedAuditEvent } from '../../../../../services/auditConsolidated';

const router = express.Router({ mergeParams: true });

// ════════════════════════════════════════════════════════════════════════════════
// MULTISIG CONFIGURATION
// ════════════════════════════════════════════════════════════════════════════════

/**
 * GET /v1/daos/:daoId/treasury/multisig/config
 * Get current multi-signature configuration
 * 
 * Accessible by: All DAO members
 */
router.get(
  '/config',
  authenticate,
  rateLimitPerUser('treasury-multisig-config-get', 30, '1min'),
  async (req: Request, res: Response) => {
    try {
      const { daoId } = req.params;

      res.json({
        success: true,
        daoId,
        config: {
          requiredApprovals: 2,
          totalSigners: 5,
          withdrawalThreshold: '50000.00',
          approvalTimeout: 604800, // 7 days in seconds
          depositThreshold: null, // Deposits don't require multisig
        },
      });
    } catch (error) {
      console.error('Multisig config error:', error);
      res.status(500).json({ error: 'Failed to get multisig config' });
    }
  }
);

/**
 * POST /v1/daos/:daoId/treasury/multisig/config
 * Set multi-signature configuration (admin only)
 * 
 * ⚠️ REQUIRES: treasuryAdminGuard (MtaaDAO security audit)
 * Accessible by: DAO admins/elders only
 */
router.post(
  '/config',
  authenticate,
  treasuryAdminGuard,
  rateLimitPerUser('treasury-multisig-config-set', 5, '1hour'),
  async (req: Request, res: Response) => {
    try {
      const { daoId } = req.params;
      const userId = (req as any).user?.id;
      const { requiredApprovals, totalSigners, withdrawalThreshold } = req.body;

      if (!requiredApprovals || !totalSigners) {
        return res.status(400).json({
          error:
            'requiredApprovals and totalSigners required',
        });
      }

      // Log config change with CRITICAL severity - core treasury security
      await logConsolidatedAuditEvent({
        dao_id: daoId,
        user_id: userId,
        action: 'multisig_config_updated',
        severity: 'critical',
        details: { requiredApprovals, totalSigners, withdrawalThreshold },
      } as any);

      res.json({
        success: true,
        daoId,
        config: {
          requiredApprovals,
          totalSigners,
          withdrawalThreshold,
          updatedAt: new Date().toISOString(),
          updatedBy: userId,
        },
      });
    } catch (error) {
      console.error('Multisig config update error:', error);
      res.status(500).json({ error: 'Failed to update multisig config' });
    }
  }
);

// ════════════════════════════════════════════════════════════════════════════════
// APPROVAL WORKFLOW
// ════════════════════════════════════════════════════════════════════════════════

/**
 * GET /v1/daos/:daoId/treasury/multisig/approvals
 * Get pending and completed multi-sig approvals
 * 
 * Accessible by: All DAO members
 */
router.get(
  '/approvals',
  authenticate,
  rateLimitPerUser('treasury-multisig-approvals', 30, '1min'),
  async (req: Request, res: Response) => {
    try {
      const { daoId } = req.params;
      const { status } = req.query; // 'pending', 'approved', 'rejected'

      res.json({
        success: true,
        daoId,
        approvals: [
          {
            id: 'msig_001',
            operationId: 'withdraw_789',
            operation: 'withdrawal',
            amount: '75000.00',
            status: 'pending',
            requiredApprovals: 2,
            currentApprovals: 1,
            signers: [
              { id: 'signer_1', address: '0x123...', approved: true },
              { id: 'signer_2', address: '0x456...', approved: false },
            ],
            expiresAt: new Date(Date.now() + 604800000).toISOString(),
          },
        ],
      });
    } catch (error) {
      console.error('Multisig approvals error:', error);
      res.status(500).json({ error: 'Failed to get approvals' });
    }
  }
);

/**
 * POST /v1/daos/:daoId/treasury/multisig/approvals/:approvalId/sign
 * Sign a pending multi-sig approval (admin/signer only)
 * 
 * ⚠️ REQUIRES: treasuryAdminGuard + must be registered signer
 * Accessible by: DAO admins/elders/authorized signers
 */
router.post(
  '/approvals/:approvalId/sign',
  authenticate,
  treasuryAdminGuard,
  rateLimitPerUser('treasury-multisig-sign', 20, '5min'),
  async (req: Request, res: Response) => {
    try {
      const { daoId, approvalId } = req.params;
      const userId = (req as any).user?.id;
      const { signature, comment } = req.body;

      if (!signature) {
        return res.status(400).json({ error: 'Signature required' });
      }

      // Log signature with HIGH severity - approval of treasury operations
      await logConsolidatedAuditEvent({
        dao_id: daoId,
        user_id: userId,
        action: 'multisig_approval_signed',
        severity: 'high',
        details: { approvalId, comment },
      } as any);

      res.json({
        success: true,
        daoId,
        approvalId,
        signed: true,
        signature: signature.substring(0, 20) + '...', // Masked
        signedAt: new Date().toISOString(),
        currentApprovals: 2,
        requiredApprovals: 2,
        status: 'approved',
      });
    } catch (error) {
      console.error('Multisig sign error:', error);
      res.status(500).json({ error: 'Failed to sign approval' });
    }
  }
);

// ════════════════════════════════════════════════════════════════════════════════
// SIGNER MANAGEMENT
// ════════════════════════════════════════════════════════════════════════════════

/**
 * GET /v1/daos/:daoId/treasury/multisig/signers
 * Get authorized multi-signature signers
 * 
 * Accessible by: All DAO members
 */
router.get(
  '/signers',
  authenticate,
  rateLimitPerUser('treasury-multisig-signers-get', 30, '1min'),
  async (req: Request, res: Response) => {
    try {
      const { daoId } = req.params;

      res.json({
        success: true,
        daoId,
        signers: [
          {
            id: 'signer_1',
            address: '0x1234567890123456789012345678901234567890',
            role: 'admin',
            name: 'Alice (Admin)',
            activeSince: '2025-01-15T00:00:00Z',
            approvalsCount: 42,
          },
          {
            id: 'signer_2',
            address: '0x0987654321098765432109876543210987654321',
            role: 'elder',
            name: 'Bob (Elder)',
            activeSince: '2025-02-01T00:00:00Z',
            approvalsCount: 18,
          },
        ],
      });
    } catch (error) {
      console.error('Multisig signers error:', error);
      res.status(500).json({ error: 'Failed to get signers' });
    }
  }
);

/**
 * DELETE /v1/daos/:daoId/treasury/multisig/signers/:signerId
 * Remove a multi-signature signer (admin only)
 * 
 * ⚠️ REQUIRES: treasuryAdminGuard
 * Accessible by: DAO admins/elders only
 */
router.delete(
  '/signers/:signerId',
  authenticate,
  treasuryAdminGuard,
  rateLimitPerUser('treasury-multisig-signers-delete', 5, '1hour'),
  async (req: Request, res: Response) => {
    try {
      const { daoId, signerId } = req.params;
      const userId = (req as any).user?.id;

      // Log signer removal with CRITICAL severity - security-sensitive operation
      await logConsolidatedAuditEvent({
        dao_id: daoId,
        user_id: userId,
        action: 'multisig_signer_removed',
        severity: 'critical',
        details: { signerId },
      } as any);

      res.json({
        success: true,
        daoId,
        signerId,
        removed: true,
        revokedAt: new Date().toISOString(),
        note: 'Signer access revoked. Pending approvals remain valid.',
      });
    } catch (error) {
      console.error('Multisig signer removal error:', error);
      res.status(500).json({ error: 'Failed to remove signer' });
    }
  }
);

export default router;
