/**
 * Treasury Management Routes - PHASE 2
 * 
 * Handles:
 * - Recipient whitelist management (add, approve, revoke)
 * - Treasury limit configuration (read, update)
 * - Multisig approval workflows
 * 
 * PHASE 2 Security: Whitelist, Amount Limits, Multisig Requirements
 */

import express, { Request, Response } from 'express';
import { isAuthenticated } from '../nextAuthMiddleware';
import { TreasuryValidationService } from '../services/treasuryValidationService';
import { Logger } from '../utils/logger';
import { db } from '../db';
import { daoMemberships, treasuryWhitelist } from '../../shared/schema';
import { eq, and } from 'drizzle-orm';

const logger = Logger.getLogger();
const router = express.Router();

/**
 * POST /api/treasury-management/:daoId/whitelist/request
 * Request to add a new recipient to the whitelist
 * 
 * Required fields:
 * - walletAddress: string (Ethereum address)
 * - category: 'charity' | 'payments' | 'team' | 'disbursements' | 'other'
 * 
 * Optional:
 * - recipientName: string
 */
router.post('/:daoId/whitelist/request', isAuthenticated, async (req: any, res) => {
  try {
    const { daoId } = req.params;
    const { walletAddress, recipientName, category } = req.body;
    const userId = req.user?.id;

    // Validate inputs
    if (!walletAddress || !category) {
      return res.status(400).json({
        success: false,
        message: 'Wallet address and category are required',
        code: 'INVALID_INPUT'
      });
    }

    // Validate Ethereum address format
    if (!/^0x[a-fA-F0-9]{40}$/.test(walletAddress)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid Ethereum wallet address format',
        code: 'INVALID_ADDRESS'
      });
    }

    if (!['charity', 'payments', 'team', 'disbursements', 'other'].includes(category)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid category. Must be one of: charity, payments, team, disbursements, other',
        code: 'INVALID_CATEGORY'
      });
    }

    // Check DAO membership
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

    // Request whitelist approval
    const result = await TreasuryValidationService.requestWhitelistApproval(
      daoId,
      walletAddress,
      recipientName || walletAddress,
      category as any,
      userId
    );

    logger.info(`[AUDIT] Whitelist request submitted for DAO ${daoId}: ${walletAddress} (${category}) by ${userId}`);

    res.status(201).json({
      success: true,
      message: 'Whitelist request submitted. Awaiting admin approval.',
      code: 'WHITELIST_REQUEST_CREATED',
      data: {
        id: result.id,
        status: 'pending',
        walletAddress,
        category,
        recipientName: recipientName || walletAddress,
        createdAt: new Date().toISOString(),
        nextSteps: 'A DAO admin must approve this whitelist entry before this address can receive treasury funds'
      }
    });
  } catch (error: any) {
    logger.error('[Treasury] Error requesting whitelist approval:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to request whitelist approval',
      error: error.message,
      code: 'WHITELIST_REQUEST_FAILED'
    });
  }
});

/**
 * POST /api/treasury-management/:daoId/whitelist/:entryId/approve
 * Admin approves a pending whitelist entry
 * 
 * Admin/Creator/Elder required
 */
router.post('/:daoId/whitelist/:entryId/approve', isAuthenticated, async (req: any, res) => {
  try {
    const { daoId, entryId } = req.params;
    const userId = req.user?.id;

    // Check if user is DAO admin/creator
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
        message: 'Only DAO admins and creators can approve whitelist entries',
        code: 'INSUFFICIENT_PERMISSIONS'
      });
    }

    // Approve the entry
    const result = await TreasuryValidationService.approveWhitelistEntry(entryId, userId, daoId);

    logger.info(`[AUDIT] Whitelist entry ${entryId} approved for DAO ${daoId} by ${userId}`);

    res.json({
      success: true,
      message: 'Whitelist entry approved successfully',
      code: 'WHITELIST_APPROVED',
      data: {
        id: entryId,
        status: 'approved',
        approvedBy: userId,
        approvedAt: new Date().toISOString(),
        effectiveness: 'This address can now receive treasury fund transfers'
      }
    });
  } catch (error: any) {
    logger.error('[Treasury] Error approving whitelist entry:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to approve whitelist entry',
      error: error.message,
      code: 'WHITELIST_APPROVAL_FAILED'
    });
  }
});

/**
 * GET /api/treasury-management/:daoId/whitelist
 * Get all whitelist entries for this DAO
 */
router.get('/:daoId/whitelist', isAuthenticated, async (req: any, res) => {
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

    // Query whitelist entries from treasury_whitelist table
    const whitelist = await db.select()
      .from(treasuryWhitelist)
      .where(eq(treasuryWhitelist.daoId, daoId as any));

    res.json({
      success: true,
      message: 'Whitelist retrieved successfully',
      data: {
        daoId,
        totalEntries: whitelist.length,
        entries: whitelist.map(entry => ({
          id: entry.id,
          walletAddress: entry.walletAddress,
          recipientName: entry.recipientName,
          category: entry.category,
          status: entry.status,
          approvedBy: entry.approvedBy,
          approvedAt: entry.approvedAt,
          expiresAt: entry.expiresAt,
          createdAt: entry.createdAt
        })),
        categories: ['charity', 'payments', 'team', 'disbursements', 'other']
      }
    });
  } catch (error: any) {
    logger.error('[Treasury] Error fetching whitelist:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch whitelist',
      error: error.message,
      code: 'WHITELIST_FETCH_FAILED'
    });
  }
});

/**
 * GET /api/treasury-management/:daoId/limits
 * Get current treasury limits for this DAO
 * 
 * Returns:
 * - dailyCapPercentage: max % of treasury that can be withdrawn per day
 * - singleTransferMaxPercentage: max % per single transfer
 * - multisigThresholdUSD: amount in USD that triggers multisig requirement
 * - multisigRequiredSignatures: number required (e.g., 2 of 3)
 */
router.get('/:daoId/limits', isAuthenticated, async (req: any, res) => {
  try {
    const { daoId } = req.params;

    // Verify user is DAO member
    const membership = await db.select()
      .from(daoMemberships)
      .where(and(
        eq(daoMemberships.userId, req.user?.id),
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

    const limits = await TreasuryValidationService.getTreasuryLimits(daoId);

    res.json({
      success: true,
      message: 'Treasury limits retrieved',
      data: {
        daoId,
        dailyCapPercentage: limits.dailyCapPercentage,
        singleTransferMaxPercentage: limits.singleTransferMaxPercentage,
        multisigThresholdUSD: limits.multisigThreshold,
        multisigRequiredSignatures: limits.multisigRequiredSignatures,
        lastUpdated: limits.updatedAt,
        description: {
          dailyCapPercentage: `Maximum ${limits.dailyCapPercentage}% of treasury can be withdrawn per day`,
          singleTransferMaxPercentage: `Single transfers limited to ${limits.singleTransferMaxPercentage}% of treasury`,
          multisigThresholdUSD: `Transfers exceeding $${limits.multisigThreshold} USD require multisig approval`,
          multisigRequiredSignatures: `${limits.multisigRequiredSignatures} signatures required for large transfers`
        }
      }
    });
  } catch (error: any) {
    logger.error('[Treasury] Error fetching treasury limits:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch treasury limits',
      error: error.message,
      code: 'LIMITS_FETCH_FAILED'
    });
  }
});

/**
 * PUT /api/treasury-management/:daoId/limits
 * Update treasury limits for this DAO
 * 
 * Admin/Creator only
 * 
 * Optional fields (only provide the ones to update):
 * - dailyCapPercentage: number (1-100)
 * - singleTransferMaxPercentage: number (1-100, must be < dailyCapPercentage)
 * - multisigThresholdUSD: number (in USD)
 * - multisigRequiredSignatures: number (e.g., 2 for 2-of-3)
 */
router.put('/:daoId/limits', isAuthenticated, async (req: any, res) => {
  try {
    const { daoId } = req.params;
    const userId = req.user?.id;
    const { dailyCapPercentage, singleTransferMaxPercentage, multisigThresholdUSD, multisigRequiredSignatures } = req.body;

    // Check if user is DAO admin/creator
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
        message: 'Only DAO creators and admins can update treasury limits',
        code: 'INSUFFICIENT_PERMISSIONS'
      });
    }

    // Validate inputs
    if (dailyCapPercentage !== undefined) {
      if (typeof dailyCapPercentage !== 'number' || dailyCapPercentage < 1 || dailyCapPercentage > 100) {
        return res.status(400).json({
          success: false,
          message: 'Daily cap percentage must be a number between 1 and 100',
          code: 'INVALID_DAILY_CAP'
        });
      }
    }

    if (singleTransferMaxPercentage !== undefined) {
      if (typeof singleTransferMaxPercentage !== 'number' || singleTransferMaxPercentage < 1 || singleTransferMaxPercentage > 100) {
        return res.status(400).json({
          success: false,
          message: 'Single transfer max must be a number between 1 and 100',
          code: 'INVALID_SINGLE_MAX'
        });
      }
      
      if (dailyCapPercentage && singleTransferMaxPercentage > dailyCapPercentage) {
        return res.status(400).json({
          success: false,
          message: 'Single transfer max cannot exceed daily cap percentage',
          code: 'INVALID_COMPARISON'
        });
      }
    }

    if (multisigThresholdUSD !== undefined) {
      if (typeof multisigThresholdUSD !== 'number' || multisigThresholdUSD < 0) {
        return res.status(400).json({
          success: false,
          message: 'Multisig threshold must be a non-negative number',
          code: 'INVALID_THRESHOLD'
        });
      }
    }

    // Update limits
    await TreasuryValidationService.updateTreasuryLimits(daoId, {
      daoId: daoId as any,
      dailyCapPercentage: dailyCapPercentage ? parseFloat(dailyCapPercentage as any) : undefined,
      singleTransferMaxPercentage: singleTransferMaxPercentage ? parseFloat(singleTransferMaxPercentage as any) : undefined,
      multisigThreshold: multisigThresholdUSD ? parseFloat(multisigThresholdUSD as any) : undefined,
      multisigRequiredSignatures: multisigRequiredSignatures ? parseInt(multisigRequiredSignatures as any) : undefined,
      updatedAt: new Date()
    });

    logger.info(`[AUDIT] Treasury limits updated for DAO ${daoId} by ${userId}`, {
      dailyCapPercentage,
      singleTransferMaxPercentage,
      multisigThresholdUSD,
      multisigRequiredSignatures
    });

    res.json({
      success: true,
      message: 'Treasury limits updated successfully',
      code: 'LIMITS_UPDATED',
      data: {
        daoId,
        updatedFields: {
          ...(dailyCapPercentage && { dailyCapPercentage }),
          ...(singleTransferMaxPercentage && { singleTransferMaxPercentage }),
          ...(multisigThresholdUSD && { multisigThresholdUSD }),
          ...(multisigRequiredSignatures && { multisigRequiredSignatures })
        },
        updatedAt: new Date().toISOString(),
        updatedBy: userId
      }
    });
  } catch (error: any) {
    logger.error('[Treasury] Error updating treasury limits:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update treasury limits',
      error: error.message,
      code: 'LIMITS_UPDATE_FAILED'
    });
  }
});

export default router;
