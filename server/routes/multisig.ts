/**
 * Multisig Approval Workflow Routes - PHASE 2
 * 
 * Handles multisig approval workflows for large treasury transfers:
 * - List pending approvals requiring signatures
 * - Submit signatures from authorized signers
 * - Reject pending approvals
 * - View approval status and expiration
 * 
 * PHASE 2 Feature: Transfers > $10,000 USD require 2-of-3 admin signatures
 */

import express, { Request, Response } from 'express';
import { isAuthenticated } from '../nextAuthMiddleware';
import { TreasuryValidationService } from '../services/treasuryValidationService';
import { Logger } from '../utils/logger';
import { db } from '../db';
import { daoMemberships, treasuryApprovals } from '../../shared/schema';
import { eq, and, desc } from 'drizzle-orm';

const logger = Logger.getLogger();
const router = express.Router();

// Deprecation middleware: mark legacy multisig endpoints as deprecated
// and suggest the canonical v1 DAO-scoped multisig endpoints.
router.use((req, res, next) => {
  res.setHeader('X-Deprecated', 'true');
  res.setHeader('X-Redirect-To', '/api/v1/daos/:daoId/treasury/multisig');
  res.setHeader('Sunset', new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toUTCString());
  next();
});

/**
 * GET /api/multisig/:daoId/pending
 * Get all pending multisig approvals for this DAO
 * 
 * Admin/Creator/Elder can view all pending approvals
 * Returns: list of approvals waiting for signatures
 */
router.get('/:daoId/pending', isAuthenticated, async (req: any, res) => {
  try {
    const { daoId } = req.params;
    const userId = req.user?.id;

    // Verify user is DAO member
    const membership = await db.select()
      .from(daoMemberships)
      .where(and(
        eq(daoMemberships.userId, userId),
        eq(daoMemberships.daoId, daoId as any)
      ))
      .limit(1);

    if (!membership.length) {
      return res.status(403).json({
        success: false,
        message: 'You are not a member of this DAO',
        code: 'NOT_DAO_MEMBER'
      });
    }

    // Get available signers (admin/creator/elder)
    const signers = await TreasuryValidationService.getAvailableSigners(daoId);
    const isApprover = signers.some((s: any) => s === userId);

    // Query pending multisig approvals from treasury_approvals table
    const pendingApprovals = await db.select()
      .from(treasuryApprovals)
      .where(
        and(
          eq(treasuryApprovals.daoId, daoId as any),
          eq(treasuryApprovals.status, 'pending')
        )
      )
      .orderBy(desc(treasuryApprovals.createdAt));

    res.json({
      success: true,
      message: 'Pending multisig approvals retrieved',
      data: {
        daoId,
        totalPending: pendingApprovals.length,
        userCanApprove: isApprover,
        approvals: pendingApprovals.map((approval: any) => {
          const currentSignatures = approval.signatures ? (Array.isArray(approval.signatures) ? approval.signatures.length : 0) : 0;
          return {
            id: approval.id,
            transactionId: approval.transactionId,
            recipientAddress: approval.recipientAddress,
            amount: approval.amount,
            amountUSD: approval.amountUSD,
            description: approval.description,
            requiredSignatures: approval.requiredSignatures,
            currentSignatures: currentSignatures,
            signers: signers.map((signer: any) => ({
              userId: signer,
              hasSigned: approval.signatures && Array.isArray(approval.signatures) 
                ? approval.signatures.some((s: any) => s.signerId === signer)
                : false
            })),
            expiresAt: approval.expiresAt,
            createdAt: approval.createdAt,
            status: approval.status
          };
        })
      }
    });
  } catch (error: any) {
    logger.error('[Multisig] Error fetching pending approvals:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch pending approvals',
      error: error.message,
      code: 'PENDING_FETCH_FAILED'
    });
  }
});

/**
 * GET /api/multisig/:daoId/approval/:approvalId
 * Get detailed status of a specific multisig approval
 */
router.get('/:daoId/approval/:approvalId', isAuthenticated, async (req: any, res) => {
  try {
    const { daoId, approvalId } = req.params;
    const userId = req.user?.id;

    // Verify user is DAO member
    const membership = await db.select()
      .from(daoMemberships)
      .where(and(
        eq(daoMemberships.userId, userId),
        eq(daoMemberships.daoId, daoId as any)
      ))
      .limit(1);

    if (!membership.length) {
      return res.status(403).json({
        success: false,
        message: 'You are not a member of this DAO',
        code: 'NOT_DAO_MEMBER'
      });
    }

    // Query specific approval from treasury_approvals
    const approval = await db.select()
      .from(treasuryApprovals)
      .where(
        and(
          eq(treasuryApprovals.id, approvalId as any),
          eq(treasuryApprovals.daoId, daoId as any)
        )
      )
      .limit(1);

    if (!approval.length) {
      return res.status(404).json({
        success: false,
        message: 'Approval not found',
        code: 'APPROVAL_NOT_FOUND'
      });
    }

    const appr = approval[0];
    const currentSignatures = appr.signatures && Array.isArray(appr.signatures) ? appr.signatures.length : 0;

    res.json({
      success: true,
      message: 'Approval details retrieved',
      data: {
        id: appr.id,
        daoId: appr.daoId,
        transactionId: appr.transactionId,
        recipientAddress: appr.recipientAddress,
        amount: appr.amount,
        amountUSD: appr.amountUSD,
        description: appr.description,
        status: appr.status,
        requiredSignatures: appr.requiredSignatures,
        currentSignatures: currentSignatures,
        signatures: appr.signatures ? (Array.isArray(appr.signatures) ? appr.signatures.map((s: any) => ({
          signerId: s.signerId,
          signedAt: s.signedAt
          // Don't return the actual signature data
        })) : []) : [],
        rejectionReason: appr.rejectionReason,
        rejectedBy: appr.rejectedBy,
        rejectedAt: appr.rejectedAt,
        executedAt: appr.executedAt,
        executedBy: appr.executedBy,
        expiresAt: appr.expiresAt,
        isExpired: new Date(appr.expiresAt) < new Date(),
        createdBy: appr.createdBy,
        createdAt: appr.createdAt,
        updatedAt: appr.updatedAt
      }
    });
  } catch (error: any) {
    logger.error('[Multisig] Error fetching approval details:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch approval details',
      error: error.message,
      code: 'APPROVAL_FETCH_FAILED'
    });
  }
});

/**
 * POST /api/multisig/:daoId/approval/:approvalId/sign
 * Submit a cryptographic signature for a pending multisig approval
 * 
 * Required fields:
 * - signature: string (EIP-191 signature or multisig signature format)
 * 
 * Admin/Creator/Elder can sign
 */
router.post('/:daoId/approval/:approvalId/sign', isAuthenticated, async (req: any, res) => {
  try {
    const { daoId, approvalId } = req.params;
    const { signature } = req.body;
    const userId = req.user?.id;

    if (!signature) {
      return res.status(400).json({
        success: false,
        message: 'Signature is required',
        code: 'MISSING_SIGNATURE'
      });
    }

    // Verify user is authorized signer (admin/creator/elder)
    const membership = await db.select()
      .from(daoMemberships)
      .where(and(
        eq(daoMemberships.userId, userId),
        eq(daoMemberships.daoId, daoId as any)
      ))
      .limit(1);

    if (!membership.length || !['admin', 'creator', 'elder'].includes(membership[0].role || '')) {
      return res.status(403).json({
        success: false,
        message: 'Only DAO admins can sign multisig approvals',
        code: 'INSUFFICIENT_PERMISSIONS'
      });
    }

    // Get the approval record
    const approval = await db.select()
      .from(treasuryApprovals)
      .where(
        and(
          eq(treasuryApprovals.id, approvalId as any),
          eq(treasuryApprovals.daoId, daoId as any),
          eq(treasuryApprovals.status, 'pending')
        )
      )
      .limit(1);

    if (!approval.length) {
      return res.status(404).json({
        success: false,
        message: 'Approval not found or already finalized',
        code: 'APPROVAL_NOT_FOUND'
      });
    }

    // Check if approval has expired
    if (new Date(approval[0].expiresAt) < new Date()) {
      return res.status(410).json({
        success: false,
        message: 'This approval request has expired',
        code: 'APPROVAL_EXPIRED'
      });
    }

    // Get existing signatures
    const existingSignatures = approval[0].signatures && Array.isArray(approval[0].signatures) 
      ? approval[0].signatures 
      : [];

    // Check if user already signed
    if (existingSignatures.some((s: any) => s.signerId === userId)) {
      return res.status(400).json({
        success: false,
        message: 'You have already signed this approval',
        code: 'ALREADY_SIGNED'
      });
    }

    // Add new signature
    const newSignature = {
      signerId: userId,
      signature: signature,
      signedAt: new Date()
    };

    const updatedSignatures = [...existingSignatures, newSignature];

    // Update approval with new signature
    await db.update(treasuryApprovals)
      .set({
        signatures: updatedSignatures,
        updatedAt: new Date()
      })
      .where(eq(treasuryApprovals.id, approvalId as any));

    // Check if we now have enough signatures for approval
    const needsApproval = updatedSignatures.length >= approval[0].requiredSignatures;

    if (needsApproval) {
      // Auto-approved! Update status to 'approved'
      await db.update(treasuryApprovals)
        .set({
          status: 'approved',
          updatedAt: new Date()
        })
        .where(eq(treasuryApprovals.id, approvalId as any));

      logger.info(`[AUDIT] Multisig approval ${approvalId} APPROVED (all signatures collected) for DAO ${daoId}`);
    }

    logger.info(`[AUDIT] Multisig approval ${approvalId} signed by ${userId}`, {
      daoId,
      signatureLength: signature.length,
      currentSignatures: updatedSignatures.length,
      requiredSignatures: approval[0].requiredSignatures
    });

    res.json({
      success: true,
      message: needsApproval ? 'Signature submitted - approval finalized!' : 'Signature submitted successfully',
      code: needsApproval ? 'SIGNATURE_FINALIZED' : 'SIGNATURE_SUBMITTED',
      data: {
        approvalId,
        signedBy: userId,
        signedAt: new Date().toISOString(),
        currentSignatures: updatedSignatures.length,
        requiredSignatures: approval[0].requiredSignatures,
        isApproved: needsApproval,
        nextSteps: needsApproval 
          ? 'All signatures collected! Transfer is ready for execution.' 
          : `Awaiting ${approval[0].requiredSignatures - updatedSignatures.length} more signature(s)`
      }
    });
  } catch (error: any) {
    logger.error('[Multisig] Error submitting signature:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to submit signature',
      error: error.message,
      code: 'SIGNATURE_SUBMIT_FAILED'
    });
  }
});

/**
 * POST /api/multisig/:daoId/approval/:approvalId/reject
 * Reject a pending multisig approval (cancels the transfer)
 * 
 * Required fields:
 * - reason: string (explanation for rejection)
 * 
 * Admin/Creator can reject
 */
router.post('/:daoId/approval/:approvalId/reject', isAuthenticated, async (req: any, res) => {
  try {
    const { daoId, approvalId } = req.params;
    const { reason } = req.body;
    const userId = req.user?.id;

    if (!reason) {
      return res.status(400).json({
        success: false,
        message: 'Rejection reason is required',
        code: 'MISSING_REASON'
      });
    }

    // Verify user is authorized to reject (creator/admin)
    const membership = await db.select()
      .from(daoMemberships)
      .where(and(
        eq(daoMemberships.userId, userId),
        eq(daoMemberships.daoId, daoId as any)
      ))
      .limit(1);

    if (!membership.length || !['admin', 'creator'].includes(membership[0].role || '')) {
      return res.status(403).json({
        success: false,
        message: 'Only DAO creators and admins can reject approvals',
        code: 'INSUFFICIENT_PERMISSIONS'
      });
    }

    // Get the approval record
    const approval = await db.select()
      .from(treasuryApprovals)
      .where(
        and(
          eq(treasuryApprovals.id, approvalId as any),
          eq(treasuryApprovals.daoId, daoId as any),
          eq(treasuryApprovals.status, 'pending')
        )
      )
      .limit(1);

    if (!approval.length) {
      return res.status(404).json({
        success: false,
        message: 'Approval not found or already finalized',
        code: 'APPROVAL_NOT_FOUND'
      });
    }

    // Update treasury_approvals record
    await db.update(treasuryApprovals)
      .set({
        status: 'rejected',
        rejectionReason: reason,
        rejectedBy: userId,
        rejectedAt: new Date(),
        updatedAt: new Date()
      })
      .where(eq(treasuryApprovals.id, approvalId as any));

    logger.info(`[AUDIT] Multisig approval ${approvalId} rejected by ${userId}`, {
      daoId,
      reason
    });

    res.json({
      success: true,
      message: 'Approval rejected successfully',
      code: 'APPROVAL_REJECTED',
      data: {
        approvalId,
        status: 'rejected',
        rejectedBy: userId,
        rejectionReason: reason,
        rejectedAt: new Date().toISOString(),
        consequence: 'The planned treasury transfer has been cancelled'
      }
    });
  } catch (error: any) {
    logger.error('[Multisig] Error rejecting approval:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to reject approval',
      error: error.message,
      code: 'REJECTION_FAILED'
    });
  }
});

/**
 * GET /api/multisig/:daoId/approval/:approvalId/status
 * Check if approval is ready for execution
 * 
 * Returns:
 * - canExecute: boolean (true if all required signatures received)
 * - signaturesRemaining: number
 * - expiresAt: ISO timestamp
 */
router.get('/:daoId/approval/:approvalId/status', isAuthenticated, async (req: any, res) => {
  try {
    const { daoId, approvalId } = req.params;
    const userId = req.user?.id;

    // Verify user is DAO member
    const membership = await db.select()
      .from(daoMemberships)
      .where(and(
        eq(daoMemberships.userId, userId),
        eq(daoMemberships.daoId, daoId as any)
      ))
      .limit(1);

    if (!membership.length) {
      return res.status(403).json({
        success: false,
        message: 'You are not a member of this DAO',
        code: 'NOT_DAO_MEMBER'
      });
    }

    // Query approval from database
    const approval = await db.select()
      .from(treasuryApprovals)
      .where(
        and(
          eq(treasuryApprovals.id, approvalId as any),
          eq(treasuryApprovals.daoId, daoId as any)
        )
      )
      .limit(1);

    if (!approval.length) {
      return res.status(404).json({
        success: false,
        message: 'Approval not found',
        code: 'APPROVAL_NOT_FOUND'
      });
    }

    const appr = approval[0];
    const currentSignatures = appr.signatures && Array.isArray(appr.signatures) ? appr.signatures.length : 0;
    const canExecute = currentSignatures >= appr.requiredSignatures && appr.status === 'pending';
    const isExpired = new Date(appr.expiresAt) < new Date();

    res.json({
      success: true,
      message: 'Approval status retrieved',
      data: {
        approvalId,
        status: appr.status,
        canExecute: canExecute && !isExpired,
        currentSignatures: currentSignatures,
        requiredSignatures: appr.requiredSignatures,
        signaturesRemaining: Math.max(0, appr.requiredSignatures - currentSignatures),
        expiresAt: appr.expiresAt,
        isExpired: isExpired,
        createdAt: appr.createdAt,
        recipientAddress: appr.recipientAddress,
        amountUSD: appr.amountUSD,
        description: appr.description
      }
    });
  } catch (error: any) {
    logger.error('[Multisig] Error fetching approval status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch approval status',
      error: error.message,
      code: 'STATUS_FETCH_FAILED'
    });
  }
});

export default router;
