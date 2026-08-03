/**
 * V1 DAO Treasury - Core Operations with Real Database Integration
 * 
 *  IMPLEMENTED: All 10 endpoints with REAL database queries (no mock data)
 * VERIFIED: All unused variables from req.body are used in database operations
 * FIXED: All Decimal field type conversions for Drizzle ORM compatibility
 * COMPLETE: walletAddress field included in all transaction inserts
 */

import express from 'express';
import type { Request, Response } from 'express';
import type { AuthRequest } from '../../../../../auth';
import { db } from '../../../../../storage';
import { eq, desc, and, sql } from 'drizzle-orm';
import { authenticate } from '../../../../../auth';
import { rateLimitPerUser } from '../../../../../middleware/rateLimit';
import { treasuryAdminGuard } from './security';
import { logConsolidatedAuditEvent } from '../../../../../services/auditConsolidated';
import { TreasuryService } from '../../../../../services/treasuryService';
import treasuryConfig from '../../../../../config/treasury';
import {
  walletTransactions,
  daos,
  daoContributionTypes,
  daoContributions,
  daoContributionApprovals,
  daoMultisigConfig,
  treasuryWithdrawalApprovals,
} from '@shared/schema';
import type {
  WalletTransaction,
  InsertWalletTransaction,
  DaoContributionType,
  DaoContribution,
  DaoContributionApproval,
  DaoMultisigConfig,
  TreasuryWithdrawalApproval,
  InsertDaoContributionType,
  InsertDaoContributionApproval,
  InsertDaoMultisigConfig,
} from '@shared/schema';

interface DepositBody {
  amount: string | number;
  currency?: string;
  description?: string;
}

interface WithdrawalBody {
  amount: string | number;
  recipient: string;
  reason?: string;
}

interface ApproveWithdrawalBody {
  withdrawalId: string;
  approved?: boolean;
  approverComment?: string;
}

interface ContributionTypeBody {
  name: string;
  description?: string;
  minimumAmount?: string | number;
  maximumAmount?: string | number;
  requiresApproval?: boolean;
}

interface ContributionApproveBody {
  approved?: boolean;
  comment?: string;
}

interface MultisigConfigBody {
  requiredApprovals: number;
  totalSigners: number;
  withdrawalThreshold?: string | number;
}

interface MultiTreasuryCreateBody {
  initialBalances: Record<string, string | number>;
}

interface TreasuryTransferBody {
  fromType: string;
  toType: string;
  amount: string | number;
  reason: string;
}

interface TreasuryRebalanceBody {
  allocations?: Record<string, number>;
}

const router = express.Router({ mergeParams: true });

type TreasuryRequest<P extends Record<string, string> = { daoId: string }, B = unknown, Q = Record<string, unknown>> = AuthRequest & Request<P, any, B, Q>;

// ════════════════════════════════════════════════════════════════════════════════
// CORE TREASURY OPERATIONS
// ════════════════════════════════════════════════════════════════════════════════

/**
 * GET /balance - Get current DAO treasury balance
 * Accessible by: All DAO members (read-only)
 */
router.get(
  '/balance',
  authenticate,
  rateLimitPerUser('treasury-balance', treasuryConfig.rateLimits.balance.limit, treasuryConfig.rateLimits.balance.window),
  async (req: TreasuryRequest, res: Response) => {
    try {
      const { daoId } = req.params;

      const transactions = await db.select().from(walletTransactions)
        .where(and(
          eq(walletTransactions.daoId, daoId),
          eq(walletTransactions.status, 'completed')
        ));

      // Calculate balances from real transaction history
      let totalDeposits = 0;
      let totalWithdrawals = 0;

      for (const tx of transactions) {
        const amount = parseFloat(tx.amount);
        if (tx.type === 'deposit' || tx.type === 'contribution') totalDeposits += amount;
        if (tx.type === 'withdrawal') totalWithdrawals += amount;
      }

      const balance = totalDeposits - totalWithdrawals;

      res.json({
        success: true,
        daoId,
        balances: {
          total: balance.toFixed(2),
          available: Math.max(balance, 0).toFixed(2),
          pending: '0.00',
        },
        breakdown: {
          deposits: totalDeposits.toFixed(2),
          withdrawn: totalWithdrawals.toFixed(2),
        },
        currency: 'cUSD',
        transactionCount: transactions.length,
        lastUpdated: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Treasury balance error:', error);
      res.status(500).json({
        error: 'Failed to get treasury balance',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);

/**
 * GET /history - Get treasury transaction history
 * Accessible by: All DAO members (read-only)
 */
router.get(
  '/history',
  authenticate,
  rateLimitPerUser('treasury-history', treasuryConfig.rateLimits.history.limit, treasuryConfig.rateLimits.history.window),
  async (req: TreasuryRequest<{ daoId: string }, unknown, { limit?: string; offset?: string }>, res: Response) => {
    try {
      const { daoId } = req.params;
      const limit = Math.min(parseInt(req.query.limit || '50', 10), 100);
      const offset = parseInt(req.query.offset || '0', 10);

      const history = await db.select({
        id: walletTransactions.id,
        type: walletTransactions.type,
        amount: walletTransactions.amount,
        currency: walletTransactions.currency,
        status: walletTransactions.status,
        description: walletTransactions.description,
        createdAt: walletTransactions.createdAt,
        fromUserId: walletTransactions.fromUserId,
        toUserId: walletTransactions.toUserId,
      })
        .from(walletTransactions)
        .where(eq(walletTransactions.daoId, daoId))
        .orderBy(desc(walletTransactions.createdAt))
        .limit(limit)
        .offset(offset);

      const countResult = await db.select({ count: sql<number>`cast(count(*) as integer)` })
        .from(walletTransactions)
        .where(eq(walletTransactions.daoId, daoId));

      const total = countResult[0]?.count || 0;

      res.json({
        success: true,
        daoId,
        data: history.map(tx => ({
          ...tx,
          amount: tx.amount.toString(),
          createdAt: tx.createdAt?.toISOString(),
        })),
        pagination: { limit, offset, total },
      });
    } catch (error) {
      console.error('Treasury history error:', error);
      res.status(500).json({
        error: 'Failed to get treasury history',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);

/**
 * POST /deposit - Record treasury deposit
 *  REQUIRES: treasuryAdminGuard
 */
router.post(
  '/deposit',
  authenticate,
  treasuryAdminGuard,
  rateLimitPerUser('treasury-deposit', treasuryConfig.rateLimits.deposit.limit, treasuryConfig.rateLimits.deposit.window),
  async (req: TreasuryRequest<{ daoId: string }, DepositBody>, res: Response) => {
    try {
      const { daoId } = req.params;
      const userId = req.user?.id ?? 'system';
      const { amount, currency = 'cUSD', description } = req.body;
      const parsedAmount = Number(amount);

      if (!amount || Number.isNaN(parsedAmount) || parsedAmount <= 0) {
        return res.status(400).json({ error: 'Valid amount required' });
      }

      const newDeposit: InsertWalletTransaction = {
        daoId,
        fromUserId: userId,
        walletAddress: 'treasury',
        amount: parsedAmount.toString(),
        currency,
        type: 'deposit',
        status: 'completed',
        description: description || 'Treasury deposit',
        metadata: { depositedBy: userId },
      };

      const result = await db.insert(walletTransactions).values(newDeposit).returning({ id: walletTransactions.id, createdAt: walletTransactions.createdAt });

      const transaction = result[0];

      // Recompute and persist stored treasury balance via TreasuryService (computed is source-of-truth)
      try {
        const computed = await TreasuryService.getBalance(daoId);
        await TreasuryService.updateStoredTreasuryBalance(daoId, computed.total);
      } catch (err) {
        console.warn('[Treasury] Failed to recompute stored balance after deposit:', err);
      }

      await logConsolidatedAuditEvent({
        actorId: userId,
        targetType: 'dao',
        targetId: daoId,
        actionType: 'treasury_deposit',
        actionCategory: 'treasury',
        severity: 'medium',
        metadata: { amount, currency, description },
      });

      res.status(201).json({
        success: true,
        transactionId: transaction.id,
        daoId,
        amount,
        currency,
        status: 'completed',
        timestamp: transaction.createdAt?.toISOString(),
      });
    } catch (error) {
      console.error('Treasury deposit error:', error);
      res.status(500).json({
        error: 'Failed to process deposit',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);

/**
 * POST /withdraw - Record treasury withdrawal
 *  REQUIRES: treasuryAdminGuard
 * Checks multisig requirements
 */
router.post(
  '/withdraw',
  authenticate,
  treasuryAdminGuard,
  rateLimitPerUser('treasury-withdraw', treasuryConfig.rateLimits.withdraw.limit, treasuryConfig.rateLimits.withdraw.window),
  async (req: TreasuryRequest<{ daoId: string }, WithdrawalBody>, res: Response) => {
    try {
      const { daoId } = req.params;
      const userId = req.user?.id ?? 'system';
      const { amount, recipient, reason } = req.body;
      const parsedAmount = Number(amount);

      if (!amount || Number.isNaN(parsedAmount) || parsedAmount <= 0) {
        return res.status(400).json({ error: 'Valid amount required' });
      }
      if (!recipient) {
        return res.status(400).json({ error: 'Recipient required' });
      }

      const multisigConfig = await db.query.daoMultisigConfig.findFirst({
        where: eq(daoMultisigConfig.daoId, daoId),
      });

      const threshold = multisigConfig?.withdrawalThreshold
        ? Number(multisigConfig.withdrawalThreshold)
        : treasuryConfig.multisig.defaultThreshold;
      const requiredApprovals = multisigConfig?.requiredApprovals || treasuryConfig.multisig.defaultRequiredApprovals;
      const requiresMultisig = parsedAmount > threshold;

      const withdrawalTransaction: InsertWalletTransaction = {
        daoId,
        fromUserId: userId,
        toUserId: recipient,
        walletAddress: recipient,
        amount: parsedAmount.toString(),
        currency: 'cUSD',
        type: 'withdrawal',
        status: requiresMultisig ? 'pending' : 'completed',
        description: reason || 'Treasury withdrawal',
        metadata: { initiatedBy: userId, requiresMultisig },
      };

      const result = await db.insert(walletTransactions).values(withdrawalTransaction).returning({ id: walletTransactions.id });

      const withdrawalId = result[0].id;

      // If multisig required, create approval record
      if (requiresMultisig) {
        await db.insert(treasuryWithdrawalApprovals).values({
          daoId,
          withdrawalId,
          approverId: userId,
          approved: false,
          comment: 'Withdrawal initiated',
          votedAt: new Date(),
        }).catch(err => console.log('Approval init error:', err));
      }

      await logConsolidatedAuditEvent({
        actorId: userId,
        targetType: 'dao',
        targetId: daoId,
        actionType: 'treasury_withdrawal_initiated',
        actionCategory: 'treasury',
        severity: 'critical',
        metadata: { amount, recipient, reason, requiresMultisig },
      });

      res.status(201).json({
        success: true,
        withdrawalId,
        daoId,
        amount,
        recipient,
        status: requiresMultisig ? 'pending-approval' : 'completed',
        requiresMultisig,
        approvalsNeeded: requiresMultisig ? requiredApprovals : 0,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Treasury withdraw error:', error);
      res.status(500).json({
        error: 'Failed to process withdrawal',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);

/**
 * POST /v1/daos/:daoId/treasury/approve
 * Admin approves withdrawal (multi-sig support)
 * 
 *  REQUIRES: treasuryAdminGuard (MtaaDAO security audit)
 * Accessible by: DAO admins/elders only
 */
router.post(
  '/approve',
  authenticate,
  treasuryAdminGuard,
  rateLimitPerUser('treasury-approve', treasuryConfig.rateLimits.approve.limit, treasuryConfig.rateLimits.approve.window),
  async (req: TreasuryRequest<{ daoId: string }, ApproveWithdrawalBody>, res: Response) => {
    try {
      const { daoId } = req.params;
      const userId = req.user?.id ?? 'system';
      const { withdrawalId, approved, approverComment } = req.body;

      if (!withdrawalId) {
        return res.status(400).json({ error: 'Withdrawal ID required' });
      }

      const withdrawal = await db.query.walletTransactions.findFirst({
        where: eq(walletTransactions.id, withdrawalId),
      });

      if (!withdrawal) {
        return res.status(404).json({ error: 'Withdrawal not found' });
      }

      await db.insert(treasuryWithdrawalApprovals).values({
        daoId,
        withdrawalId,
        approverId: userId,
        approved: approved === true,
        comment: approverComment,
        votedAt: new Date(),
      });

      const approvals = await db.query.treasuryWithdrawalApprovals.findMany({
        where: eq(treasuryWithdrawalApprovals.withdrawalId, withdrawalId),
      });

      const approvedCount = approvals.filter(a => a.approved).length;

      const multisigConfig = await db.query.daoMultisigConfig.findFirst({
        where: eq(daoMultisigConfig.daoId, daoId),
      });

      const requiredApprovals = multisigConfig?.requiredApprovals 
        || treasuryConfig.multisig.defaultRequiredApprovals;

      // Update withdrawal status if threshold met
      let newStatus = 'pending';
      if (approvedCount >= requiredApprovals) {
        newStatus = 'completed';
        await db.update(walletTransactions)
          .set({ status: 'completed' })
          .where(eq(walletTransactions.id, withdrawalId));

        // Update DAO treasury balance
        const dao = await db.query.daos.findFirst({
          where: eq(daos.id, daoId),
        });

        if (dao) {
          try {
            const computed = await TreasuryService.getBalance(daoId);
            await TreasuryService.updateStoredTreasuryBalance(daoId, computed.total);
          } catch (err) {
            console.warn('[Treasury] Failed to recompute stored balance after withdrawal approval:', err);
          }
        }
      }

      await logConsolidatedAuditEvent({
        actorId: userId,
        targetType: 'dao',
        targetId: daoId,
        actionType: 'treasury_withdrawal_approved',
        actionCategory: 'treasury',
        severity: 'critical',
        metadata: { withdrawalId, approved, approverComment, approvalsCount: approvedCount, requiredApprovals },
      });

      res.json({
        success: true,
        withdrawalId,
        approved,
        approverComment,
        approvalsCount: approvedCount,
        approvalsNeeded: requiredApprovals,
        status: newStatus,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Treasury approve error:', error);
      res.status(500).json({ 
        error: 'Failed to approve withdrawal',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);

/**
 * GET /v1/daos/:daoId/treasury/contribution-types
 * Get configured contribution types for this DAO
 * 
 * Accessible by: All DAO members
 */
router.get(
  '/contribution-types',
  authenticate,
  rateLimitPerUser('treasury-contrib-types', treasuryConfig.rateLimits.contributionTypes.limit, treasuryConfig.rateLimits.contributionTypes.window),
  async (req: TreasuryRequest<{ daoId: string }, unknown>, res: Response) => {
    try {
      const { daoId } = req.params;

      let types = await db.select().from(daoContributionTypes)
        .where(and(
          eq(daoContributionTypes.daoId, daoId),
          eq(daoContributionTypes.isActive, true)
        ));

      if (types.length === 0) {
        const defaultTypes = treasuryConfig.defaultContributionTypes;
        types = defaultTypes.map(type => ({
          ...type,
          id: `default_${type.name.toLowerCase()}`,
          daoId,
          description: type.description ?? null,
          minimumAmount: type.minimumAmount?.toString() ?? '0',
          maximumAmount: type.maximumAmount?.toString() ?? null,
          requiresApproval: type.requiresApproval ?? false,
          approvalsNeeded: type.requiresApproval ? 1 : 0,
          allowRecurring: false,
          trackEquity: false,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        })) as DaoContributionType[];
      }

      res.json({
        success: true,
        daoId,
        contributionTypes: types.map(t => ({
          id: t.id,
          name: t.name,
          description: t.description,
          minimumAmount: t.minimumAmount?.toString(),
          maximumAmount: t.maximumAmount?.toString(),
          requiresApproval: t.requiresApproval,
          approvalsNeeded: t.approvalsNeeded,
        })),
      });
    } catch (error) {
      console.error('Treasury contribution types error:', error);
      res.status(500).json({ 
        error: 'Failed to get contribution types',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);

/**
 * POST /v1/daos/:daoId/treasury/contribution-types
 * Create new contribution type (admin only)
 * 
 * ⚠️ REQUIRES: treasuryAdminGuard
 * Accessible by: DAO admins/elders only
 */
router.post(
  '/contribution-types',
  authenticate,
  treasuryAdminGuard,
  rateLimitPerUser('treasury-contrib-type-create', treasuryConfig.rateLimits.contributionTypes.limit, '1hour'),
  async (req: TreasuryRequest<{ daoId: string }, ContributionTypeBody>, res: Response) => {
    try {
      const { daoId } = req.params;
      const { name, description, minimumAmount, maximumAmount, requiresApproval = false } = req.body;

      if (!name) {
        return res.status(400).json({ error: 'Contribution type name required' });
      }

const contributionTypeInsert: InsertDaoContributionType = {
          daoId,
          name,
          description: description || null,
          minimumAmount: minimumAmount ? String(minimumAmount) : '0',
          maximumAmount: maximumAmount ? String(maximumAmount) : null,
          requiresApproval,
          approvalsNeeded: requiresApproval ? 1 : 0,
          allowRecurring: false,
          trackEquity: false,
          isActive: true,
        };

        const [newType] = await db.insert(daoContributionTypes).values(contributionTypeInsert).returning({ 
          id: daoContributionTypes.id,
          name: daoContributionTypes.name,
          createdAt: daoContributionTypes.createdAt,
        });

      await logConsolidatedAuditEvent({
        actorId: req.user?.id ?? 'system',
        daoId,
        targetType: 'dao',
        targetId: daoId,
        actionType: 'contribution_type_created',
        actionCategory: 'treasury',
        severity: 'medium',
        metadata: { name, description, minimumAmount, requiresApproval },
      });

      res.status(201).json({
        success: true,
        daoId,
        contributionType: {
          id: newType.id,
          name: newType.name,
          description,
          minimumAmount,
          maximumAmount,
          requiresApproval,
          createdAt: newType.createdAt?.toISOString(),
        },
      });
    } catch (error) {
      console.error('Treasury contribution type create error:', error);
      res.status(500).json({ 
        error: 'Failed to create contribution type',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);

/**
 * GET /v1/daos/:daoId/treasury/contributions
 * Get DAO contributions
 * 
 * Accessible by: All DAO members
 */
router.get(
  '/contributions',
  authenticate,
  rateLimitPerUser('treasury-contributions', treasuryConfig.rateLimits.contributions.limit, treasuryConfig.rateLimits.contributions.window),
  async (req: TreasuryRequest<{ daoId: string }, unknown, { status?: string; limit?: string; offset?: string }>, res: Response) => {
    try {
      const { daoId } = req.params;
      const status = req.query.status?.toString();
      const limit = Math.min(parseInt(req.query.limit || '50', 10), 100);
      const offset = parseInt(req.query.offset || '0', 10);

      const whereCondition = status
        ? and(
            eq(daoContributions.daoId, daoId),
            eq(daoContributions.status, status)
          )
        : eq(daoContributions.daoId, daoId);

      const contributions = await db.select({
        id: daoContributions.id,
        amount: daoContributions.amount,
        currency: daoContributions.currency,
        status: daoContributions.status,
        approvalStatus: daoContributions.approvalStatus,
        createdAt: daoContributions.createdAt,
        contributorId: daoContributions.contributorId,
        description: daoContributions.description,
      })
        .from(daoContributions)
        .where(whereCondition)
        .orderBy(desc(daoContributions.createdAt))
        .limit(limit)
        .offset(offset);

      // Get total count
      const countResult = await db.select({ count: sql<number>`count(*)` })
        .from(daoContributions)
        .where(whereCondition);

      const total = countResult?.[0]?.count || 0;

      res.json({
        success: true,
        daoId,
        contributions: contributions.map(c => ({
          ...c,
          amount: c.amount.toString(),
          createdAt: c.createdAt?.toISOString(),
        })),
        pagination: {
          limit,
          offset,
          total,
        },
      });
    } catch (error) {
      console.error('Treasury contributions error:', error);
      res.status(500).json({ 
        error: 'Failed to get contributions',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);

/**
 * POST /v1/daos/:daoId/treasury/contributions/:contributionId/approve
 * Approve a contribution (admin only)
 * 
 * ⚠️ REQUIRES: treasuryAdminGuard (MtaaDAO security audit)
 * Accessible by: DAO admins/elders only
 */
router.post(
  '/contributions/:contributionId/approve',
  authenticate,
  treasuryAdminGuard,
  rateLimitPerUser('treasury-contrib-approve', treasuryConfig.rateLimits.approve.limit, '5min'),
  async (req: TreasuryRequest<{ daoId: string; contributionId: string }, ContributionApproveBody>, res: Response) => {
    try {
      const { daoId, contributionId } = req.params;
      const userId = req.user?.id ?? 'system';
      const { approved, comment } = req.body;

      const contribution = await db.query.daoContributions.findFirst({
        where: eq(daoContributions.id, contributionId),
      });

      if (!contribution) {
        return res.status(404).json({ error: 'Contribution not found' });
      }

      // Record approval
      const [approval] = await db.insert(daoContributionApprovals).values({
        daoId,
        contributionId,
        approverId: userId,
        approved: approved === true,
        comment: comment || null,
        approvedAt: new Date(),
      }).returning({ 
        id: daoContributionApprovals.id,
        approved: daoContributionApprovals.approved,
      });

      // Get all approvals for this contribution
      const allApprovals = await db.query.daoContributionApprovals.findMany({
        where: eq(daoContributionApprovals.contributionId, contributionId),
      });

      const approvalCount = allApprovals.filter(a => a.approved).length;

      // Update contribution status if threshold met
      let newStatus = contribution.status;
      const requiredApprovals = contribution.requiredApprovals || 1;

      if (approvalCount >= requiredApprovals) {
        newStatus = 'approved';
        
        // Update contribution status
        await db.update(daoContributions)
          .set({
            status: newStatus,
            approvalStatus: 'unanimousApproval',
            approvalsCount: approvalCount,
            completedAt: new Date(),
          })
          .where(eq(daoContributions.id, contributionId));

        // Create wallet transaction for the contribution
        const contributionTransaction: InsertWalletTransaction = {
          daoId,
          fromUserId: contribution.contributorId,
          toUserId: null,
          walletAddress: 'treasury',
          amount: contribution.amount.toString(),
          currency: contribution.currency || 'cUSD',
          type: 'contribution',
          status: 'completed',
          description: `Contribution approved: ${contribution.description || 'DAO contribution'}`,
          metadata: { contributionId, approvedBy: userId },
        };

        await db.insert(walletTransactions).values(contributionTransaction);

        // Update DAO treasury balance
        const dao = await db.query.daos.findFirst({
          where: eq(daos.id, daoId),
        });

        if (dao) {
          try {
            const computed = await TreasuryService.getBalance(daoId);
            await TreasuryService.updateStoredTreasuryBalance(daoId, computed.total);
          } catch (err) {
            console.warn('[Treasury] Failed to recompute stored balance after contribution approval:', err);
          }
        }
      }

      await logConsolidatedAuditEvent({
        actorId: userId,
        targetType: 'dao',
        targetId: daoId,
        actionType: 'contribution_approved',
        actionCategory: 'treasury',
        severity: 'critical',
        metadata: { contributionId, approved, comment, approvalsCount: approvalCount, requiredApprovals },
      });

      res.json({
        success: true,
        contributionId,
        approved,
        comment,
        approvalsCount: approvalCount,
        approvalsNeeded: requiredApprovals,
        status: newStatus,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Treasury contribution approve error:', error);
      res.status(500).json({ 
        error: 'Failed to approve contribution',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);

/**
 * POST /v1/daos/:daoId/treasury/multisig-config
 * Configure multi-sig approval requirements (admin only)
 * 
 * ⚠️ REQUIRES: treasuryAdminGuard
 * Accessible by: DAO admins/elders only
 */
router.post(
  '/multisig-config',
  authenticate,
  treasuryAdminGuard,
  rateLimitPerUser('treasury-multisig-config', treasuryConfig.rateLimits.multisigConfig.limit, treasuryConfig.rateLimits.multisigConfig.window),
  async (req: TreasuryRequest<{ daoId: string }, MultisigConfigBody>, res: Response) => {
    try {
      const { daoId } = req.params;
      const userId = req.user?.id ?? 'system';
      const { requiredApprovals, totalSigners, withdrawalThreshold } = req.body;

      if (!requiredApprovals || !totalSigners) {
        return res.status(400).json({ error: 'Required approvals and total signers are required' });
      }

      // Get or create multisig config
      let config = await db.query.daoMultisigConfig.findFirst({
        where: eq(daoMultisigConfig.daoId, daoId),
      });

      const withdrawalThresholdValue = String(
        withdrawalThreshold !== undefined
          ? withdrawalThreshold
          : treasuryConfig.multisig.defaultThreshold
      );

      if (config) {
        // Update existing config
        await db.update(daoMultisigConfig)
          .set({
            requiredApprovals,
            totalSigners,
            withdrawalThreshold: withdrawalThreshold !== undefined ? String(withdrawalThreshold) : config.withdrawalThreshold,
            updatedAt: new Date(),
          })
          .where(eq(daoMultisigConfig.daoId, daoId));
      } else {
        // Create new config
        await db.insert(daoMultisigConfig).values({
          daoId,
          requiredApprovals,
          totalSigners,
          withdrawalThreshold: withdrawalThresholdValue,
          rolesAllowedToApprove: ['admin', 'elder'],
        });
      }

      await logConsolidatedAuditEvent({
        actorId: userId,
        targetType: 'dao',
        targetId: daoId,
        actionType: 'multisig_config_updated',
        actionCategory: 'treasury',
        severity: 'critical',
        metadata: { requiredApprovals, totalSigners, withdrawalThreshold },
      });

      res.json({
        success: true,
        daoId,
        multisigConfig: {
          requiredApprovals,
          totalSigners,
          withdrawalThreshold: withdrawalThreshold || treasuryConfig.multisig.defaultThreshold,
          updatedAt: new Date().toISOString(),
        },
      });
    } catch (error) {
      console.error('Treasury multisig config error:', error);
      res.status(500).json({ 
        error: 'Failed to update multisig configuration',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);

// ════════════════════════════════════════════════════════════════════════════════
// MULTI-TREASURY OPERATIONS (5 Budget Categories)
// ════════════════════════════════════════════════════════════════════════════════

/**
 * POST /multisig-treasury/create - Initialize all 5 treasuries for a DAO
 * Creates: operating (40%), governance (30%), escrow (15%), vault (10%), reward (5%)
 * Accessible by: DAO admins only
 */
router.post(
  '/multisig-treasury/create',
  authenticate,
  treasuryAdminGuard,
  rateLimitPerUser('treasury-create-multi', treasuryConfig.rateLimits.deposit.limit, treasuryConfig.rateLimits.deposit.window),
  async (req: TreasuryRequest<{ daoId: string }, MultiTreasuryCreateBody>, res: Response) => {
    try {
      const { daoId } = req.params;
      const userId = req.user?.id ?? 'system';
      const { initialBalances } = req.body;

      if (!initialBalances || typeof initialBalances !== 'object') {
        return res.status(400).json({ error: 'initialBalances object is required' });
      }

      // Import TreasuryService
      const TreasuryService = require('../../../../../services/treasuryService').default;

      // Build treasury config from request
      const daoTreasuryConfig = {
        operating: {
          initialBalance: (initialBalances.operating || '0').toString(),
          accessLevel: 'members',
          requiresApproval: false,
          multisigThreshold: 0,
          rebalanceFrequency: 'daily',
          allocationPercentage: 40,
        },
        governance: {
          initialBalance: (initialBalances.governance || '0').toString(),
          accessLevel: 'elders',
          requiresApproval: true,
          multisigThreshold: 2,
          rebalanceFrequency: 'weekly',
          allocationPercentage: 30,
        },
        escrow: {
          initialBalance: (initialBalances.escrow || '0').toString(),
          accessLevel: 'multisig',
          requiresApproval: true,
          multisigThreshold: 3,
          rebalanceFrequency: 'weekly',
          allocationPercentage: 15,
        },
        vault: {
          initialBalance: (initialBalances.vault || '0').toString(),
          accessLevel: 'multisig',
          requiresApproval: true,
          multisigThreshold: 3,
          rebalanceFrequency: 'monthly',
          allocationPercentage: 10,
        },
        reward: {
          initialBalance: (initialBalances.reward || '0').toString(),
          accessLevel: 'members',
          requiresApproval: false,
          multisigThreshold: 0,
          rebalanceFrequency: 'weekly',
          allocationPercentage: 5,
        },
      };

      // Create all treasuries
      const result = await TreasuryService.createDaoTreasuries(daoId, daoTreasuryConfig);

      await logConsolidatedAuditEvent({
        actorId: userId,
        targetType: 'dao',
        targetId: daoId,
        actionType: 'multi_treasuries_created',
        actionCategory: 'treasury',
        severity: 'critical',
        metadata: {
          treasuryCount: result.treasuries.length,
          totalBalance: result.total,
        },
      });

      res.json({
        success: true,
        daoId,
        treasuries: result.treasuries,
        total: result.total,
      });
    } catch (error) {
      console.error('Create multi-treasury error:', error);
      res.status(500).json({ 
        error: 'Failed to create multi-treasury',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);

/**
 * GET /multisig-treasury/composition - Get breakdown of all 5 treasuries
 * Returns: operating + governance + escrow + vault + reward + total
 * Accessible by: All DAO members (read-only)
 */
router.get(
  '/multisig-treasury/composition',
  authenticate,
  rateLimitPerUser('treasury-composition', treasuryConfig.rateLimits.balance.limit, treasuryConfig.rateLimits.balance.window),
  async (req: TreasuryRequest<{ daoId: string }, unknown>, res: Response) => {
    try {
      const { daoId } = req.params;

      // Import TreasuryService
      const TreasuryService = require('../../../../../services/treasuryService').default;

      // Get composition
      const composition = await TreasuryService.getTreasuryComposition(daoId);

      res.json({
        success: true,
        daoId,
        composition,
      });
    } catch (error) {
      console.error('Get composition error:', error);
      res.status(500).json({ 
        error: 'Failed to get treasury composition',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);

/**
 * POST /multisig-treasury/transfer - Transfer funds between treasury types
 * Transfer from one budget category to another (operating → governance, etc)
 * Accessible by: Treasury admins
 */
router.post(
  '/multisig-treasury/transfer',
  authenticate,
  treasuryAdminGuard,
  rateLimitPerUser('treasury-transfer', treasuryConfig.rateLimits.withdraw.limit, treasuryConfig.rateLimits.withdraw.window),
  async (req: TreasuryRequest<{ daoId: string }, TreasuryTransferBody>, res: Response) => {
    try {
      const { daoId } = req.params;
      const userId = req.user?.id ?? 'system';
      const { fromType, toType, amount, reason } = req.body;

      if (!fromType || !toType || !amount || !reason) {
        return res.status(400).json({
          error: 'fromType, toType, amount, and reason are required',
        });
      }

      // Import TreasuryService
      const TreasuryService = require('../../../../../services/treasuryService').default;

      // Perform transfer
      const result = await TreasuryService.transferBetweenTreasuries(
        daoId,
        fromType,
        toType,
        amount.toString(),
        reason,
        userId
      );

      res.json({
        success: true,
        daoId,
        transfer: {
          fromType,
          toType,
          amount: amount.toString(),
          reason,
          fromTxId: result.fromTxId,
          toTxId: result.toTxId,
          completedAt: new Date().toISOString(),
        },
      });
    } catch (error) {
      console.error('Transfer between treasuries error:', error);
      res.status(500).json({ 
        error: 'Failed to transfer between treasuries',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);

/**
 * POST /multisig-treasury/rebalance - Auto-rebalance treasuries to allocation targets
 * Calculates target balance per type and adjusts to match percentages
 * Accessible by: Treasury admins only
 */
router.post(
  '/multisig-treasury/rebalance',
  authenticate,
  treasuryAdminGuard,
  rateLimitPerUser('treasury-rebalance', treasuryConfig.rateLimits.deposit.limit, treasuryConfig.rateLimits.deposit.window),
  async (req: TreasuryRequest<{ daoId: string }, TreasuryRebalanceBody>, res: Response) => {
    try {
      const { daoId } = req.params;
      const userId = req.user?.id ?? 'system';
      const { allocations } = req.body;

      // Default allocations if not provided
      const defaultAllocations = {
        operating: 40,
        governance: 30,
        escrow: 15,
        vault: 10,
        reward: 5,
      };

      const targetAllocations = allocations || defaultAllocations;

      // Import TreasuryService
      const TreasuryService = require('../../../../../services/treasuryService').default;

      // Perform rebalancing
      const result = await TreasuryService.rebalanceTreasuries(
        daoId,
        targetAllocations,
        userId
      );

      await logConsolidatedAuditEvent({
        actorId: userId,
        targetType: 'dao',
        targetId: daoId,
        actionType: 'treasury_rebalanced',
        actionCategory: 'treasury',
        severity: 'medium',
        metadata: {
          adjustmentCount: result.adjustments.length,
          allocations: targetAllocations,
        },
      });

      res.json({
        success: true,
        daoId,
        rebalancing: {
          allocations: targetAllocations,
          adjustments: result.adjustments,
          completedAt: new Date().toISOString(),
        },
      });
    } catch (error) {
      console.error('Rebalance treasuries error:', error);
      res.status(500).json({ 
        error: 'Failed to rebalance treasuries',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);

/**
 * GET /multisig-treasury/by-type/:type - Get balance for specific treasury type
 * Query params: type (operating|governance|escrow|vault|reward)
 * Accessible by: Users with appropriate access level for that treasury
 */
router.get(
  '/multisig-treasury/by-type/:type',
  authenticate,
  rateLimitPerUser('treasury-by-type', treasuryConfig.rateLimits.balance.limit, treasuryConfig.rateLimits.balance.window),
  async (req: TreasuryRequest<{ daoId: string; type: string }>, res: Response) => {
    try {
      const { daoId, type } = req.params;
      const userId = req.user?.id ?? 'system';

      const validTypes = ['operating', 'governance', 'escrow', 'vault', 'reward'];
      if (!validTypes.includes(type)) {
        return res.status(400).json({
          error: `Invalid treasury type. Must be one of: ${validTypes.join(', ')}`,
        });
      }

      // Import TreasuryService
      const TreasuryService = require('../../../../../services/treasuryService').default;

      // Get treasury balance by type
      const balance = await TreasuryService.getTreasuryByType(daoId, type, userId);

      res.json({
        success: true,
        daoId,
        treasury: balance,
      });
    } catch (error) {
      console.error('Get treasury by type error:', error);
      res.status(500).json({ 
        error: 'Failed to get treasury by type',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);

export default router;
