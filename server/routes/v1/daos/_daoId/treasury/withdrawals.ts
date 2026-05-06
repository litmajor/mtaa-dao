/**
 * Withdrawal Approval Endpoints
 * 
 * API routes for managing withdrawal approvals:
 * - GET /pending - list pending approvals for DAO
 * - GET /:approvalId - get approval details
 * - GET /signer-pending - get approvals requiring current user's signature
 * - POST /:approvalId/approve - submit approval signature
 * - POST /:approvalId/reject - submit rejection
 * - GET /:approvalId/signatures - get signature history
 */

import { Router, Request, Response } from 'express';
import { db } from '../../../../../storage';
import { eq, and } from 'drizzle-orm';
import { treasuryWithdrawalApprovals, treasuryMultisigTransactions, vaults, daoMemberships } from '@shared/schema';
import { 
  addSignature,
  getApprovalRequest,
  getPendingApprovals,
  getApprovalsForSigner,
  getSignatureHistory,
} from '../../../../../services/multisigApprovalHandler';
import { authenticate } from '../../../../../auth';
import { treasuryAdminGuard } from './security';
import { logConsolidatedAuditEvent } from '../../../../../services/auditConsolidated';

interface ApprovalSigner {
  userId: string;
  userRole: 'member' | 'elder' | 'admin';
  approved?: boolean;
  rejected?: boolean;
  signature?: string;
  signedAt?: Date;
  ipAddress?: string;
}

const router = Router({ mergeParams: true });

/**
 * GET /v1/daos/:daoId/treasury/withdrawals/pending
 * 
 * List all pending withdrawal approvals for this DAO
 * Requires: DAO member
 */
router.get('/pending', authenticate, async (req: Request, res: Response) => {
  try {
    const { daoId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Get pending approvals for this DAO
    const pendingApprovals = await getPendingApprovals(daoId);

    // Enhance with signer status for current user
    const enhanced = pendingApprovals.map((approval: any) => {
      const currentUserSigner = approval.signers.find((s: ApprovalSigner) => s.userId === userId);
      return {
        ...approval,
        currentUserHasSigned: currentUserSigner?.approved || currentUserSigner?.rejected,
        currentUserApproved: currentUserSigner?.approved || false,
        currentUserRejected: currentUserSigner?.rejected || false,
      };
    });

    return res.json({
      approvals: enhanced,
      count: enhanced.length,
    });
  } catch (error) {
    console.error('Error fetching pending approvals:', error);
    return res.status(500).json({ error: 'Failed to fetch pending approvals' });
  }
});

/**
 * GET /v1/daos/:daoId/treasury/withdrawals/signer-pending
 * 
 * List withdrawal approvals that require signatures from current user
 * Requires: DAO member
 */
router.get('/signer-pending', authenticate, async (req: Request, res: Response) => {
  try {
    const { daoId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Get approvals requiring this user's signature
    const approvalsForUser = await getApprovalsForSigner(daoId, userId);

    // Get user's role in DAO for context
    const membershipData = await db
      .select()
      .from(daoMemberships)
      .where(
        and(
          eq(daoMemberships.daoId, daoId),
          eq(daoMemberships.userId, userId)
        )
      );

    const userRole = membershipData?.[0]?.role || 'member';

    return res.json({
      userRole,
      approvals: approvalsForUser,
      count: approvalsForUser.length,
    });
  } catch (error) {
    console.error('Error fetching approvals for signer:', error);
    return res.status(500).json({ error: 'Failed to fetch pending approvals' });
  }
});

/**
 * GET /v1/daos/:daoId/treasury/withdrawals/:approvalId
 * 
 * Get detailed approval request with signature history
 * Requires: DAO member
 */
router.get('/:approvalId', authenticate, async (req: Request, res: Response) => {
  try {
    const { daoId, approvalId } = req.params;

    // Get approval
    const approval = await getApprovalRequest(approvalId);

    if (!approval) {
      return res.status(404).json({ error: 'Approval not found' });
    }

    // Verify DAO ownership
    if (approval.daoId !== daoId) {
      return res.status(403).json({ error: 'Approval does not belong to this DAO' });
    }

    // Get signature history
    const signatures = await getSignatureHistory(approvalId);

    // Get vault details
    const vaultData = await db
      .select()
      .from(vaults)
      .where(eq(vaults.id, approval.vaultId));

    const vault = vaultData?.[0];

    return res.json({
      approval,
      signatures,
      vault: {
        id: vault?.id,
        name: vault?.name,
        vaultType: vault?.vaultType,
        balance: vault?.balance,
        currency: vault?.currency,
      },
    });
  } catch (error) {
    console.error('Error fetching approval details:', error);
    return res.status(500).json({ error: 'Failed to fetch approval details' });
  }
});

/**
 * GET /v1/daos/:daoId/treasury/withdrawals/:approvalId/signatures
 * 
 * Get signature history for an approval
 * Requires: DAO member
 */
router.get('/:approvalId/signatures', authenticate, async (req: Request, res: Response) => {
  try {
    const { daoId, approvalId } = req.params;

    // Verify approval belongs to this DAO
    const approval = await getApprovalRequest(approvalId);

    if (!approval || approval.daoId !== daoId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const signatures = await getSignatureHistory(approvalId);

    return res.json({
      approvalId,
      signatures,
      count: signatures.length,
    });
  } catch (error) {
    console.error('Error fetching signatures:', error);
    return res.status(500).json({ error: 'Failed to fetch signatures' });
  }
});

/**
 * POST /v1/daos/:daoId/treasury/withdrawals/:approvalId/approve
 * 
 * Submit approval signature for a withdrawal request
 * Requires: DAO admin/elder; must be listed as signer
 * Body: { signature: string }
 */
router.post('/:approvalId/approve', treasuryAdminGuard, async (req: Request, res: Response) => {
  const { daoId, approvalId } = req.params;
  try {
    const { signature } = req.body;
    const userId = req.user?.id;
    const ipAddress = req.ip;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!signature) {
      return res.status(400).json({ error: 'Signature required' });
    }

    // Verify approval belongs to this DAO
    const approval = await getApprovalRequest(approvalId);

    if (!approval || approval.daoId !== daoId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    // Verify user is authorized signer
    const isSigner = approval.signers.some((s: ApprovalSigner) => s.userId === userId);
    if (!isSigner) {
      return res.status(403).json({ error: 'Not authorized to sign this approval' });
    }

    // Add signature
    const result = await addSignature({
      approvalId,
      signerId: userId,
      signature,
      ipAddress: ipAddress || undefined,
      approved: true,
    });

    // Log action
    await logConsolidatedAuditEvent({
      dao_id: daoId,
      user_id: userId,
      action: 'withdrawal_signed_approved',
      severity: 'high',
      details: {
        approvalId: approvalId,
        newStatus: result.status,
        currentSignatures: result.currentSignatures,
      },
    } as any);

    return res.json({
      success: true,
      approved: result.approved,
      currentSignatures: result.currentSignatures,
      status: result.status,
      message: result.approved 
        ? 'Withdrawal approved! Executing transfer...'
        : `Approval recorded (${result.currentSignatures} signatures collected)`,
    });
  } catch (error: any) {
    console.error('Error approving withdrawal:', error);

    // Log error
    await logConsolidatedAuditEvent({
      dao_id: daoId,
      user_id: req.user?.id,
      action: 'withdrawal_signature_error',
      severity: 'medium',
      details: {
        approvalId: req.params.approvalId,
        error: error.message,
      },
    } as any);

    return res.status(400).json({ error: error.message || 'Failed to approve withdrawal' });
  }
});

/**
 * POST /v1/daos/:daoId/treasury/withdrawals/:approvalId/reject
 * 
 * Reject a withdrawal approval
 * Requires: DAO admin/elder; must be listed as signer
 * Body: { reason?: string }
 */
router.post('/:approvalId/reject', treasuryAdminGuard, async (req: Request, res: Response) => {
  const { daoId, approvalId } = req.params;
  const approvalIdStr = approvalId;
  try {
    const { reason } = req.body;
    const userId = req.user?.id;
    const ipAddress = req.ip;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Verify approval belongs to this DAO
    const approval = await getApprovalRequest(approvalId);

    if (!approval || approval.daoId !== daoId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    // Verify user is authorized signer
    const isSigner = approval.signers.some((s: ApprovalSigner) => s.userId === userId);
    if (!isSigner) {
      return res.status(403).json({ error: 'Not authorized to sign this approval' });
    }

    // Add rejection signature
    const result = await addSignature({
      approvalId,
      signerId: userId,
      signature: JSON.stringify({ rejected: true, reason: reason || null }),
      ipAddress: ipAddress || undefined,
      approved: false,
    });

    // Log action
    await logConsolidatedAuditEvent({
      dao_id: daoId,
      user_id: userId,
      action: 'withdrawal_signed_rejected',
      severity: 'high',
      details: {
        approvalId: approvalId,
        reason: reason || 'No reason provided',
        newStatus: result.status,
      },
    } as any);

    return res.json({
      success: true,
      rejected: true,
      status: result.status,
      message: result.status === 'rejected' 
        ? 'Withdrawal rejected - approval cancelled'
        : 'Rejection recorded',
    });
  } catch (error: any) {
    console.error('Error rejecting withdrawal:', error);

    await logConsolidatedAuditEvent({
      dao_id: daoId,
      user_id: req.user?.id,
      action: 'withdrawal_rejection_error',
      severity: 'medium',
      details: {
        approvalId,
        error: error.message,
      },
    } as any);

    return res.status(400).json({ error: error.message || 'Failed to reject withdrawal' });
  }
});

export default router;
