import express from 'express';
import { db } from '../../storage';
import {
  walletTransactions,
  accounts,
  daoMemberships,
  daos,
  daoMultisigConfig,
  treasuryWithdrawalApprovals,
  daoContributionTypes,
  daoContributions,
  daoContributionApprovals,
} from '../../../shared/schema';
import { authenticate } from '../../auth';
import { eq, and, desc, gte, lte } from 'drizzle-orm';
import { z } from 'zod';
import { logConsolidatedAuditEvent, AuditEventType } from '../../services/auditConsolidated';
import { rateLimitPerUser } from '../../middleware/rateLimit.ts';

const router = express.Router({ mergeParams: true });

// ════════════════════════════════════════════════════════════════════════════════
// MIDDLEWARE: Reuse from bounty-escrow
// ════════════════════════════════════════════════════════════════════════════════

/**
 * Verify user is DAO member
 */
async function requireDaoMembership(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) {
  try {
    const { daoId } = req.params;
    const userId = (req as any).user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (!daoId) {
      return res.status(400).json({ error: 'daoId is required' });
    }

    // Verify DAO exists
// verify the DAO exists using the daos table (not accounts)
      const dao = await db
        .select()
        .from(daos)
        .where(eq(daos.id, daoId))
      .limit(1);

    if (!dao.length) {
      return res.status(404).json({ error: 'DAO not found' });
    }

    // Check membership
    const membership = await db
      .select()
      .from(daoMemberships)
      .where(
        and(
          eq(daoMemberships.daoId, daoId),
          eq(daoMemberships.userId, userId)
        )
      )
      .limit(1);

    if (!membership.length) {
      return res.status(403).json({ error: 'You are not a member of this DAO' });
    }

    (req as any).daoMembership = membership[0];
    (req as any).dao = dao[0];
    next();
  } catch (error) {
    console.error('DAO membership check error:', error);
    res.status(500).json({ error: 'Membership verification failed' });
  }
}

/**
 * Verify user is DAO admin or elder (high-value operations)
 */
async function requireDaoAdminOnly(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) {
  try {
    const membership = (req as any).daoMembership;
    if (!membership) {
      return res.status(401).json({ error: 'Membership verification required' });
    }

    const role = (membership.role?.toLowerCase() || '').trim();
    if (role !== 'admin' && role !== 'elder') {
      return res.status(403).json({
        error: 'Only DAO admins/elders can perform treasury operations',
        yourRole: membership.role,
      });
    }

    next();
  } catch (error) {
    console.error('Admin check error:', error);
    res.status(500).json({ error: 'Role verification failed' });
  }
}

// ════════════════════════════════════════════════════════════════════════════════
// SCHEMAS
// ════════════════════════════════════════════════════════════════════════════════

const treasuryWithdrawSchema = z.object({
  amount: z.number().positive('Amount must be positive'),
  currency: z.string().default('cUSD'),
  recipient: z.string().email('Valid recipient email required'),
  reason: z.string().min(10, 'Withdrawal reason required (min 10 chars)'),
  requiresMultiSig: z.boolean().default(false),
});

const treasuryApprovalSchema = z.object({
  withdrawalId: z.string().min(1),
  approved: z.boolean(),
  approverComment: z.string().optional(),
});

// ════════════════════════════════════════════════════════════════════════════════
// ROUTES: VIEW TREASURY BALANCE & HISTORY
// ════════════════════════════════════════════════════════════════════════════════

/**
 * GET /api/dao/:daoId/treasury/balance
 * Get current DAO treasury balance
 * 
 * Accessible by: All DAO members (read-only)
 */
router.get(
  '/balance',
  authenticate,
  requireDaoMembership,
  rateLimitPerUser('treasury-balance', 30, '1min'),
  async (req, res) => {
    try {
      const { daoId } = req.params;

      // Get total treasury (all deposits minus withdrawals)
      const deposits = await db
        .select()
        .from(walletTransactions)
        .where(
          and(
            eq(walletTransactions.type, 'treasury_deposit'),
            eq(walletTransactions.status, 'completed')
          )
        );

      const withdrawals = await db
        .select()
        .from(walletTransactions)
        .where(
          and(
            eq(walletTransactions.type, 'treasury_withdrawal'),
            eq(walletTransactions.status, 'completed')
          )
        );

      const pendingWithdrawals = await db
        .select()
        .from(walletTransactions)
        .where(
          and(
            eq(walletTransactions.type, 'treasury_withdrawal'),
            eq(walletTransactions.status, 'pending')
          )
        );

      const totalDeposits = deposits.reduce((sum, tx) => sum + parseFloat(tx.amount), 0);
      const totalWithdrawn = withdrawals.reduce((sum, tx) => sum + parseFloat(tx.amount), 0);
      const pendingAmount = pendingWithdrawals.reduce((sum, tx) => sum + parseFloat(tx.amount), 0);

      const balance = totalDeposits - totalWithdrawn;
      const availableBalance = balance - pendingAmount;

      res.json({
        success: true,
        daoId,
        balances: {
          total: balance,
          available: availableBalance,
          pending: pendingAmount,
        },
        breakdown: {
          deposits: totalDeposits,
          withdrawn: totalWithdrawn,
          pendingWithdrawals: pendingAmount,
        },
        currency: 'cUSD',
        lastUpdated: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Error getting treasury balance:', error);
      res.status(500).json({ error: 'Failed to get treasury balance' });
    }
  }
);

/**
 * GET /api/dao/:daoId/treasury/history
 * Get treasury transaction history
 * 
 * Accessible by: All DAO members (read-only)
 */
router.get(
  '/history',
  authenticate,
  requireDaoMembership,
  rateLimitPerUser('treasury-history', 30, '1min'),
  async (req, res) => {
    try {
      const { daoId } = req.params;
      const { type, status, limit = '50', offset = '0' } = req.query;

      // start with an any-typed query so we can conditionally chain filters
      let query: any = db
        .select()
        .from(walletTransactions)
        .where(
          and(
            // Filter by treasury operations
          )
        );

      if (type && ['treasury_deposit', 'treasury_withdrawal'].includes(type as string)) {
        query = query.where(eq(walletTransactions.type, type as string));
      }

      if (status && ['pending', 'completed'].includes(status as string)) {
        query = query.where(eq(walletTransactions.status, status as string));
      }

      const history = await (
        query as any
      )
        .orderBy(desc(walletTransactions.createdAt))
        .limit(parseInt(limit as string) || 50)
        .offset(parseInt(offset as string) || 0);

      res.json({
        success: true,
        data: history,
        pagination: {
          limit: parseInt(limit as string),
          offset: parseInt(offset as string),
        },
      });
    } catch (error) {
      console.error('Error getting treasury history:', error);
      res.status(500).json({ error: 'Failed to get treasury history' });
    }
  }
);

// ════════════════════════════════════════════════════════════════════════════════
// ROUTES: WITHDRAWAL OPERATIONS (HIGH-VALUE - HARDENED)
// ════════════════════════════════════════════════════════════════════════════════

/**
 * POST /api/dao/:daoId/treasury/withdraw
 * Initiate a treasury withdrawal
 * 
 * SECURITY:
 *   1. authenticate
 *   2. requireDaoMembership
 *   3. requireDaoAdminOnly (only admins/elders)
 *   4. rateLimitPerUser (strict: 2 per 10min)
 *   5. auditConsolidated (critical severity for high-value)
 *   6. Input validation (amount, recipient, reason)
 */
router.post(
  '/withdraw',
  authenticate,
  requireDaoMembership,
  requireDaoAdminOnly,
  rateLimitPerUser('treasury-withdraw', 2, '10min'),
  async (req, res) => {
    try {
      const { daoId } = req.params;
      const userId = (req as any).user?.id;

      const validatedData = treasuryWithdrawSchema.parse(req.body);
      const { amount, currency, recipient, reason, requiresMultiSig } = validatedData;

      // Verify sufficient balance
      const deposits = await db
        .select()
        .from(walletTransactions)
        .where(eq(walletTransactions.type, 'treasury_deposit'));

      const withdrawals = await db
        .select()
        .from(walletTransactions)
        .where(eq(walletTransactions.type, 'treasury_withdrawal'));

      const balance =
        deposits.reduce((sum, tx) => sum + parseFloat(tx.amount), 0) -
        withdrawals.reduce((sum, tx) => sum + parseFloat(tx.amount), 0);

      if (amount > balance) {
        return res.status(400).json({
          error: 'Insufficient treasury balance',
          available: balance,
          requested: amount,
        });
      }

      // Create withdrawal request (pending approval if requiresMultiSig)
      const status = requiresMultiSig ? 'pending' : 'completed';

      const withdrawal = await db
        .insert(walletTransactions)
        .values({
          walletAddress: recipient,
          amount: amount.toString(),
          currency: currency || 'cUSD',
          type: 'treasury_withdrawal',
          status,
          description: `Treasury withdrawal: ${reason}`,
          metadata: {
            daoId,
            initiatedBy: userId,
            initiatedAt: new Date().toISOString(),
            recipient,
            reason,
            requiresMultiSig,
            approvals: [],
          },
        })
        .returning();

      // Log critical event
      await logConsolidatedAuditEvent({
        actorId: userId,
        actorType: 'user',
        actionType: AuditEventType.TRANSFER_INITIATED,
        actionCategory: 'treasury',
        targetType: 'treasury_withdrawal',
        targetId: withdrawal[0].id,
        result: 'success',
        severity: 'critical',
        metadata: {
          daoId,
          amount,
          recipient,
          requiresMultiSig,
        },
      });

      res.json({
        success: true,
        withdrawalId: withdrawal[0].id,
        amount,
        currency: currency || 'cUSD',
        recipient,
        status,
        reason,
        requiresMultiSig,
        initiatedAt: new Date().toISOString(),
        nextSteps: requiresMultiSig
          ? 'Awaiting approval from other DAO admins/elders'
          : 'Withdrawal completed',
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Validation error', details: error.errors });
      }
      console.error('Error initiating treasury withdrawal:', error);
      res.status(500).json({ error: 'Failed to initiate withdrawal' });
    }
  }
);

/**
 * POST /api/dao/:daoId/treasury/approve
 * Approve a pending treasury withdrawal (multi-sig)
 * 
 * SECURITY:
 *   1. authenticate
 *   2. requireDaoMembership
 *   3. requireDaoAdminOnly (only admins/elders)
 *   4. rateLimitPerUser (5 per min)
 *   5. auditConsolidated (critical severity)
 */
router.post(
  '/approve',
  authenticate,
  requireDaoMembership,
  requireDaoAdminOnly,
  rateLimitPerUser('treasury-approve', 5, '1min'),
  async (req, res) => {
    try {
      const { daoId } = req.params;
      const userId = (req as any).user?.id;

      const validatedData = treasuryApprovalSchema.parse(req.body);
      const { withdrawalId, approved, approverComment } = validatedData;

      // Find withdrawal
      const withdrawal = await db
        .select()
        .from(walletTransactions)
        .where(eq(walletTransactions.id, withdrawalId))
        .limit(1);

      if (!withdrawal.length) {
        return res.status(404).json({ error: 'Withdrawal not found' });
      }

      const tx = withdrawal[0];

      if (tx.type !== 'treasury_withdrawal') {
        return res.status(400).json({ error: 'Transaction is not a treasury withdrawal' });
      }

      if (tx.status !== 'pending') {
        return res.status(400).json({
          error: `Cannot approve withdrawal with status: ${tx.status}`,
        });
      }

      // Update approval
      const metadata: any = tx.metadata || {};
      const approvals = (metadata.approvals || []) as any[];

      // Check if already approved by this user
      if (approvals.some(a => a.approvedBy === userId)) {
        return res.status(400).json({ error: 'You have already voted on this withdrawal' });
      }

      approvals.push({
        approvedBy: userId,
        approved,
        comment: approverComment,
        approvedAt: new Date().toISOString(),
      });

      // ════════════════════════════════════════════════════════════════════════════════
      // MULTI-SIG LOGIC IMPLEMENTATION
      // ════════════════════════════════════════════════════════════════════════════════

      // Get DAO config for multi-sig requirements
      const daoConfig = await db
        .select()
        .from(daoMultisigConfig)
        .where(eq(daoMultisigConfig.daoId, daoId))
        .limit(1);

      const config = daoConfig.length ? daoConfig[0] : null;
      const requiredApprovals = config?.requiredApprovals || 2;

      // Count approvals
      const approvedCount = approvals.filter((a: any) => a.approved === true).length;
      const rejectedCount = approvals.filter((a: any) => a.approved === false).length;

      // Get total eligible signers (admin/elders in DAO)
      const eligibleSigners = await db
        .select()
        .from(daoMemberships)
        .where(
          and(
            eq(daoMemberships.daoId, daoId),
            // Only admin/elder roles can sign
          )
        );

      const eligibleAdminsElders = eligibleSigners.filter((m: any) => {
        const role = (m.role?.toLowerCase() || '').trim();
        return role === 'admin' || role === 'elder';
      });

      // Determine if threshold is met or if majority rejected
      let newStatus = 'pending';
      let completionReason = '';

      if (approvedCount >= requiredApprovals) {
        newStatus = 'completed';
        completionReason = `Approval threshold reached: ${approvedCount}/${requiredApprovals}`;
      } else if (rejectedCount > eligibleAdminsElders.length - requiredApprovals) {
        // Math: if rejections > (total_signers - required_approvals), then approval is impossible
        newStatus = 'rejected';
        completionReason = `Withdrawal rejected by majority: ${rejectedCount} rejections`;
      }

      // Update transaction status if threshold met or rejected
      const updateData: any = {
        metadata: {
          ...metadata,
          approvals,
          approvalStats: {
            approved: approvedCount,
            rejected: rejectedCount,
            required: requiredApprovals,
            eligibleSigners: eligibleAdminsElders.length,
          },
          lastApprovedAt: new Date().toISOString(),
          completionReason: completionReason || '',
        },
        updatedAt: new Date(),
      };

      // Only update status if threshold met or rejected
      if (newStatus !== 'pending') {
        updateData.status = newStatus;
      }

      const updatedTx = await db
        .update(walletTransactions)
        .set(updateData)
        .where(eq(walletTransactions.id, withdrawalId))
        .returning();

      // Log approval
      await db
        .insert(treasuryWithdrawalApprovals)
        .values({
          daoId,
          withdrawalId,
          approverId: userId,
          approved,
          votedAt: new Date(),
          comment: approverComment,
        });

      // Send response
      const responseData: any = {
        success: true,
        withdrawalId,
        approved,
        approverComment,
        totalApprovals: approvals.length,
        requiredApprovals,
        approvedCount,
        rejectedCount,
        approvedAt: new Date().toISOString(),
        status: newStatus,
      };

      if (newStatus === 'completed') {
        responseData.message = `✅ Withdrawal ${completionReason.toLowerCase()}`;
      } else if (newStatus === 'rejected') {
        responseData.message = `❌ ${completionReason}`;
      } else {
        responseData.message = approved
          ? `Vote recorded. Awaiting ${requiredApprovals - approvedCount} more approval(s).`
          : 'Withdrawal rejected by this approver.';
      }

      res.json(responseData);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Validation error', details: error.errors });
      }
      console.error('Error approving withdrawal:', error);
      res.status(500).json({ error: 'Failed to approve withdrawal' });
    }
  }
);

// ════════════════════════════════════════════════════════════════════════════════
// ROUTES: TREASURY DEPOSIT (For future DAO funding)
// ════════════════════════════════════════════════════════════════════════════════

/**
 * POST /api/dao/:daoId/treasury/deposit
 * Make a contribution/deposit to the DAO treasury
 * 
 * SECURITY:
 *   1. authenticate
 *   2. requireDaoMembership (ALL members can contribute)
 *   3. rateLimitPerUser (10 per 5min)
 *   4. auditConsolidated (medium severity)
 * 
 * Changes:
 *   - REMOVED admin-only restriction (all members can deposit)
 *   - ADDED support for different contribution types (contribution, donation, investment)
 *   - ADDED automated contribution tracking
 */
router.post(
  '/deposit',
  authenticate,
  requireDaoMembership,
  rateLimitPerUser('treasury-deposit', 10, '5min'),
  async (req, res) => {
    try {
      const { daoId } = req.params;
      const userId = (req as any).user?.id;

      const depositSchema = z.object({
        amount: z.number().positive('Amount must be positive'),
        currency: z.string().default('cUSD'),
        description: z.string().optional(),
        contributionTypeId: z.string().optional(), // UUID of contribution type
        contributionType: z.enum(['contribution', 'donation', 'investment']).default('contribution'),
      });

      const validatedData = depositSchema.parse(req.body);
      const { amount, currency, description, contributionTypeId, contributionType } = validatedData;

      let finalContributionTypeId = contributionTypeId;

      // If no specific type ID provided, find or create default for this type
      if (!finalContributionTypeId) {
        const existingType = await db
          .select()
          .from(daoContributionTypes)
          .where(
            and(
              eq(daoContributionTypes.daoId, daoId),
              eq(daoContributionTypes.name, contributionType)
            )
          )
          .limit(1);

        if (existingType.length) {
          finalContributionTypeId = existingType[0].id;
        } else {
          // Create default contribution type if none exists
          const newType = await db
            .insert(daoContributionTypes)
            .values({
              daoId,
              name: contributionType,
              description: `Auto-created ${contributionType} type`,
              minimumAmount: '0',
              requiresApproval: false,
              isActive: true,
            })
            .returning();
          finalContributionTypeId = newType[0].id;
        }
      }

      // Get contribution type config
      const typeConfig = await db
        .select()
        .from(daoContributionTypes)
        .where(eq(daoContributionTypes.id, finalContributionTypeId))
        .limit(1);

      if (!typeConfig.length) {
        return res.status(404).json({ error: 'Contribution type not found' });
      }

      const type = typeConfig[0];

      // Check minimum amount
      if (amount < parseFloat(type.minimumAmount || '0')) {
        return res.status(400).json({
          error: `Amount must be at least ${type.minimumAmount}`,
          minimum: type.minimumAmount,
          provided: amount,
        });
      }

      // Check maximum amount
      if (type.maximumAmount && amount > parseFloat(type.maximumAmount)) {
        return res.status(400).json({
          error: `Amount exceeds maximum of ${type.maximumAmount}`,
          maximum: type.maximumAmount,
          provided: amount,
        });
      }

      // Determine status based on approval requirement
      const requiresApproval = type.requiresApproval;
      const txStatus = requiresApproval ? 'pending' : 'completed';

      // Create contribution record
      const contribution = await db
        .insert(daoContributions)
        .values({
          daoId,
          contributorId: userId,
          contributionTypeId: finalContributionTypeId,
          amount: amount.toString(),
          currency: currency || 'cUSD',
          status: txStatus,
          approvalStatus: requiresApproval ? 'awaiting' : 'unanimousApproval',
          approvalsCount: 0,
          requiredApprovals: type.approvalsNeeded || 0,
          description: description || `${contributionType} contribution`,
        })
        .returning();

      // Create wallet transaction record (for treasury tracking)
      const deposit = await db
        .insert(walletTransactions)
        .values({
          walletAddress: daoId,
          fromUserId: userId,
          daoId,
          amount: amount.toString(),
          currency: currency || 'cUSD',
          type: 'treasury_deposit',
          status: txStatus,
          description: `${contributionType}: ${description || 'Contribution to treasury'}`,
          metadata: {
            daoId,
            contributorId: userId,
            contributionId: contribution[0].id,
            contributionType,
            contributionTypeId: finalContributionTypeId,
            requiresApproval,
            depositedAt: new Date().toISOString(),
          },
        })
        .returning();

      // Log event
      await logConsolidatedAuditEvent({
        actorId: userId,
        actorType: 'user',
        actionType: AuditEventType.TRANSFER_EXECUTED,
        actionCategory: 'treasury',
        targetType: 'treasury_deposit',
        targetId: deposit[0].id,
        result: 'success',
        severity: requiresApproval ? 'medium' : 'low',
        metadata: {
          daoId,
          depositId: deposit[0].id,
          contributionId: contribution[0].id,
          amount,
          contributionType,
          requiresApproval,
        },
      });

      res.json({
        success: true,
        depositId: deposit[0].id,
        contributionId: contribution[0].id,
        amount,
        currency: currency || 'cUSD',
        contributionType,
        status: txStatus,
        requiresApproval,
        depositedAt: new Date().toISOString(),
        nextSteps: requiresApproval
          ? `Awaiting ${type.approvalsNeeded || 1} approval(s) from DAO members`
          : 'Contribution recorded and added to treasury',
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Validation error', details: error.errors });
      }
      console.error('Error depositing to treasury:', error);
      res.status(500).json({ error: 'Failed to process contribution' });
    }
  }
);

// ════════════════════════════════════════════════════════════════════════════════
// ROUTES: DAO CONTRIBUTION TYPE MANAGEMENT
// ════════════════════════════════════════════════════════════════════════════════

/**
 * GET /api/dao/:daoId/treasury/contribution-types
 * Get all contribution types for a DAO
 * 
 * Accessible by: All DAO members (read-only)
 */
router.get(
  '/contribution-types',
  authenticate,
  requireDaoMembership,
  rateLimitPerUser('treasury-contrib-types', 30, '1min'),
  async (req, res) => {
    try {
      const { daoId } = req.params;

      const types = await db
        .select()
        .from(daoContributionTypes)
        .where(
          and(
            eq(daoContributionTypes.daoId, daoId),
            eq(daoContributionTypes.isActive, true)
          )
        );

      res.json({
        success: true,
        data: types,
        total: types.length,
      });
    } catch (error) {
      console.error('Error fetching contribution types:', error);
      res.status(500).json({ error: 'Failed to fetch contribution types' });
    }
  }
);

/**
 * POST /api/dao/:daoId/treasury/contribution-types
 * Create a new contribution type for DAO
 * 
 * Admin-only operation
 * Examples:
 *   - Recurring monthly contributions (allowRecurring: true)
 *   - Investment with equity tracking (trackEquity: true)
 *   - Donations requiring approval
 */
router.post(
  '/contribution-types',
  authenticate,
  requireDaoMembership,
  requireDaoAdminOnly,
  rateLimitPerUser('treasury-create-type', 5, '1min'),
  async (req, res) => {
    try {
      const { daoId } = req.params;

      const typeSchema = z.object({
        name: z.string().min(3, 'Name required'),
        description: z.string().optional(),
        minimumAmount: z.string().default('0'),
        maximumAmount: z.string().optional(),
        requiresApproval: z.boolean().default(false),
        approvalsNeeded: z.number().default(1),
        allowRecurring: z.boolean().default(false),
        trackEquity: z.boolean().default(false),
      });

      const validatedData = typeSchema.parse(req.body);

      const newType = await db
        .insert(daoContributionTypes)
        .values({
          daoId,
          ...validatedData,
          isActive: true,
        })
        .returning();

      res.json({
        success: true,
        data: newType[0],
        message: `Contribution type "${validatedData.name}" created`,
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Validation error', details: error.errors });
      }
      console.error('Error creating contribution type:', error);
      res.status(500).json({ error: 'Failed to create contribution type' });
    }
  }
);

/**
 * POST /api/dao/:daoId/treasury/contributions/:contributionId/approve
 * Approve a pending contribution
 * 
 * Contribution approval workflow for types that require approval
 */
router.post(
  '/contributions/:contributionId/approve',
  authenticate,
  requireDaoMembership,
  requireDaoAdminOnly,
  rateLimitPerUser('treasury-approve-contrib', 10, '5min'),
  async (req, res) => {
    try {
      const { daoId, contributionId } = req.params;
      const userId = (req as any).user?.id;

      const approveSchema = z.object({
        approved: z.boolean(),
        comment: z.string().optional(),
      });

      const validatedData = approveSchema.parse(req.body);
      const { approved, comment } = validatedData;

      // Get contribution
      const contribution = await db
        .select()
        .from(daoContributions)
        .where(
          and(
            eq(daoContributions.id, contributionId),
            eq(daoContributions.daoId, daoId)
          )
        )
        .limit(1);

      if (!contribution.length) {
        return res.status(404).json({ error: 'Contribution not found' });
      }

      const contrib = contribution[0];

      if (contrib.status !== 'pending') {
        return res.status(400).json({
          error: `Cannot approve contribution with status: ${contrib.status}`,
        });
      }

      // Check if already voted
      const existing = await db
        .select()
        .from(daoContributionApprovals)
        .where(
          and(
            eq(daoContributionApprovals.contributionId, contributionId),
            eq(daoContributionApprovals.approverId, userId)
          )
        );

      if (existing.length) {
        return res.status(400).json({ error: 'You have already voted on this contribution' });
      }

      // Record approval
      await db
        .insert(daoContributionApprovals)
        .values({
          daoId,
          contributionId,
          approverId: userId,
          approved,
          comment,
        });

      // Get all approvals
      const allApprovals = await db
        .select()
        .from(daoContributionApprovals)
        .where(eq(daoContributionApprovals.contributionId, contributionId));

      const approvedCount = allApprovals.filter(a => a.approved).length;
      const rejectedCount = allApprovals.filter(a => !a.approved).length;

      // Check if threshold met
      let newStatus = 'pending';
      let approvalStatus = 'awaiting';

      if (approvedCount >= contrib.requiredApprovals) {
        newStatus = 'completed';
        approvalStatus = 'unanimousApproval';
      } else if (rejectedCount > 0) {
        // If any rejection, mark rejected
        if (contrib.requiredApprovals === 1) {
          newStatus = 'rejected';
          approvalStatus = 'rejected';
        }
      }

      // Update contribution
      const updated = await db
        .update(daoContributions)
        .set({
          status: newStatus,
          approvalStatus,
          approvalsCount: approvedCount,
          updatedAt: new Date(),
        })
        .where(eq(daoContributions.id, contributionId))
        .returning();

      // If completed, update wallet transaction
      if (newStatus === 'completed') {
        const txs = await db
          .select()
          .from(walletTransactions)
          .where(
            and(
              eq(walletTransactions.daoId, daoId),
              eq(walletTransactions.type, 'treasury_deposit')
            )
          );
        const relatedTx = txs.find((t: any) => t.metadata?.contributionId === contributionId);
        if (relatedTx) {
          await db
            .update(walletTransactions)
            .set({ status: 'completed' })
            .where(eq(walletTransactions.id, relatedTx.id));
        }
      }

      res.json({
        success: true,
        contributionId,
        approved,
        approvedCount,
        requiredApprovals: contrib.requiredApprovals,
        status: newStatus,
        message:
          newStatus === 'completed'
            ? 'Contribution approved and added to treasury'
            : `Vote recorded (${approvedCount}/${contrib.requiredApprovals})`,
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Validation error', details: error.errors });
      }
      console.error('Error approving contribution:', error);
      res.status(500).json({ error: 'Failed to approve contribution' });
    }
  }
);

/**
 * POST /api/dao/:daoId/treasury/multisig-config
 * Configure multi-signature requirements for treasury withdrawals
 * 
 * Admin-only operation
 */
router.post(
  '/multisig-config',
  authenticate,
  requireDaoMembership,
  requireDaoAdminOnly,
  rateLimitPerUser('treasury-config', 5, '1min'),
  async (req, res) => {
    try {
      const { daoId } = req.params;

      const configSchema = z.object({
        requiredApprovals: z.number().min(1, 'At least 1 approval required'),
        totalSigners: z.number().min(1),
        withdrawalThreshold: z.string().optional().default('1000.00'),
        rolesAllowedToApprove: z.array(z.string()).default(['admin', 'elder']),
        autoCompleteOnThreshold: z.boolean().default(true),
      });

      const validatedData = configSchema.parse(req.body);

      // Check if config exists
      const existing = await db
        .select()
        .from(daoMultisigConfig)
        .where(eq(daoMultisigConfig.daoId, daoId));

      let result;
      if (existing.length) {
        result = await db
          .update(daoMultisigConfig)
          .set({
            ...validatedData,
            updatedAt: new Date(),
          })
          .where(eq(daoMultisigConfig.daoId, daoId))
          .returning();
      } else {
        result = await db
          .insert(daoMultisigConfig)
          .values({
            daoId,
            ...validatedData,
          })
          .returning();
      }

      res.json({
        success: true,
        data: result[0],
        message: 'Multi-signature configuration updated',
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Validation error', details: error.errors });
      }
      console.error('Error updating multisig config:', error);
      res.status(500).json({ error: 'Failed to update configuration' });
    }
  }
);

/**
 * GET /api/dao/:daoId/treasury/contributions
 * Get all contributions for a DAO
 * 
 * Accessible by: All DAO members (read-only)
 */
router.get(
  '/contributions',
  authenticate,
  requireDaoMembership,
  rateLimitPerUser('treasury-list-contrib', 30, '1min'),
  async (req, res) => {
    try {
      const { daoId } = req.params;
      const { status, type, limit = '50', offset = '0' } = req.query;

      let query: any = db
        .select()
        .from(daoContributions)
        .where(eq(daoContributions.daoId, daoId));

      if (status) {
        query = query.where(eq(daoContributions.status, status as string));
      }

      const contributions = await (query as any)
        .orderBy(desc(daoContributions.createdAt))
        .limit(parseInt(limit as string) || 50)
        .offset(parseInt(offset as string) || 0);

      const total = await db
        .select()
        .from(daoContributions)
        .where(eq(daoContributions.daoId, daoId));

      res.json({
        success: true,
        data: contributions,
        pagination: {
          limit: parseInt(limit as string),
          offset: parseInt(offset as string),
          total: total.length,
        },
      });
    } catch (error) {
      console.error('Error fetching contributions:', error);
      res.status(500).json({ error: 'Failed to fetch contributions' });
    }
  }
);

export default router;
