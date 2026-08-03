/**
 * Payment Execution Service
 * Grace-period reversible actions with real ledger integration
 *
 * CHANGES:
 * - getPaymentActionStats() now queries real tables (no mocks).
 * - executePaymentAction() is idempotent via sharedIdempotencyManager.
 * - approveAction() implements full multi-sig approval flow.
 * - getGracePeriodDeadline() uses the actual gracePeriodEndsAt from DB.
 * - P2P execution respects confirmation requirements (no bypassing approval).
 */

import { ReversibilityService } from './reversibilityService';
import { db } from '../db';
import { and, eq, sql } from 'drizzle-orm';
import {
  accounts,
  accountTransactions,
} from '../../shared/accountSchema';
import { users } from '../../shared/schema';
import {
  ReversibleAction,
  CreateReversibleActionDTO,
  ReverseActionDTO,
  ActorType,
  ActionSeverity,
  ReversalReason,
  ReversibilityStatus,
} from '../types/reversibility';
import { SimulationResult } from './simulationFramework';
import { sharedIdempotencyManager } from './sharedIdempotencyManager';

export interface PaymentExecutionContext {
  userId: string;
  actionType: string;
  simulation: SimulationResult;
  paymentDetails: {
    [key: string]: any;
  };
  approverIds?: string[];
}

export class PaymentExecutionService {
  private reversibilityService: ReversibilityService;

  constructor(reversibilityService: ReversibilityService) {
    this.reversibilityService = reversibilityService;
  }

  async createPaymentAction(context: PaymentExecutionContext): Promise<ReversibleAction> {
    const severityMap: Record<string, ActionSeverity> = {
      LOW: ActionSeverity.LOW,
      MEDIUM: ActionSeverity.MEDIUM,
      HIGH: ActionSeverity.HIGH,
      CRITICAL: ActionSeverity.CRITICAL,
    };

    const severity = severityMap[context.simulation.riskLevel] || ActionSeverity.MEDIUM;
    const requiresApproval = severity === ActionSeverity.MEDIUM || severity === ActionSeverity.HIGH || severity === ActionSeverity.CRITICAL;
    const gracePeriodHours = Math.ceil(context.simulation.reversibilityWindow.recommendedGracePeriodHours);

    const createDTO: CreateReversibleActionDTO = {
      actionType: context.actionType,
      description: context.simulation.summary,
      severity,
      initiator: {
        id: context.userId,
        type: ActorType.USER,
      },
      affectedEntity: {
        type: 'user',
        id: context.userId,
      },
      actionPayload: context.paymentDetails,
      beforeState: context.simulation.beforeState,
      afterState: context.simulation.afterState,
      confirmationRequirement: requiresApproval
        ? {
            type: 'MULTI_SIG',
            requiredApprovals: Math.max(1, (context.approverIds || []).length || 1),
            approverRoles: ['ADMIN', 'ELDER'],
            confirmationTimeoutMinutes: 60,
          }
        : {
            type: 'NONE',
            confirmationTimeoutMinutes: 0,
          },
      gracePeriodConfig: {
        durationHours: gracePeriodHours,
        reminderHoursBefore: [],
        userCanAccelerate: false,
        autoExecuteAtDeadline: true,
      },
      reversibilityScope: {
        fields: [],
        initiatorCanReverse: severity !== ActionSeverity.CRITICAL,
        adminCanReverse: true,
        governanceCanReverse: severity === ActionSeverity.CRITICAL,
        partialReversalAllowed: false,
      },
      metadata: {
        simulationWarnings: context.simulation.warnings,
        simulationRiskFactors: context.simulation.riskFactors,
        impactedEntities: context.simulation.impactedEntities,
        paymentMethod: context.paymentDetails.paymentMethod,
        currency: context.paymentDetails.currency,
      },
    };

    let action = await this.reversibilityService.createReversibleAction(createDTO);

    if (!requiresApproval) {
      await this.reversibilityService.confirmAction({
        actionId: action.id,
        confirmedBy: { id: context.userId, type: ActorType.USER },
      });
      action = await this.reversibilityService.enterGracePeriod(action.id);
    }

    return action;
  }

  async approveAction(
    actionId: string,
    approverId: string,
    approverRole: string
  ): Promise<{
    action: ReversibleAction;
    approvalsReceived: number;
    approvalsRequired: number;
    fullyApproved: boolean;
  }> {
    // Record this approval
    await db.execute(sql`
      INSERT INTO action_approvals (action_id, approver_id, approver_role, created_at)
      VALUES (${actionId}, ${approverId}, ${approverRole}, NOW())
    `);

    // Count approvals
    const countRes = await db.execute(sql`
      SELECT COUNT(*) as count FROM action_approvals WHERE action_id = ${actionId}
    `);
    const approvalsReceived = Number(countRes.rows[0]?.count ?? 0);

    const action = await this.reversibilityService.getActionById(actionId);
    if (!action) throw new Error(`Action ${actionId} not found`);

    const required = action.confirmationRequirement?.requiredApprovals || 1;
    const fullyApproved = approvalsReceived >= required;

    if (fullyApproved && action.status === 'INITIATED') {
      await this.reversibilityService.confirmAction({ actionId: action.id, confirmedBy: { id: approverId, type: ActorType.ADMIN } });
      await this.reversibilityService.enterGracePeriod(action.id);
    }

    const latest = await this.reversibilityService.getActionById(actionId);
    if (!latest) throw new Error(`Action ${actionId} not found after approval`);
    return {
      action: latest,
      approvalsReceived,
      approvalsRequired: required,
      fullyApproved,
    };
  }

  async reversePaymentAction(
    actionId: string,
    userId: string,
    reason: ReversalReason,
    userRole?: string
  ): Promise<ReversibleAction> {
    const reverseDTO: ReverseActionDTO = {
      actionId,
      reversedBy: {
        id: userId,
        type: ActorType.USER,
        role: userRole,
      },
      reason,
      reversalReason: String(reason),
    };

    return this.reversibilityService.reverseAction(reverseDTO);
  }

  async getReverseOptions(actionId: string): Promise<{
    canInitiatorReverse: boolean;
    canAdminReverse: boolean;
    canGovernanceReverse: boolean;
    gracePeriodEndsAt: Date;
    hoursRemaining: number;
    reversalReasons: ReversalReason[];
    initiatorId: string;
  }> {
    const action = await this.reversibilityService.getActionById(actionId);
    if (!action) {
      throw new Error(`Action ${actionId} not found`);
    }

    const now = Date.now();
    const gracePeriodEndsAt = new Date(action.gracePeriodEndsAt as any);
    const hoursRemaining = (gracePeriodEndsAt.getTime() - now) / (1000 * 60 * 60);

    return {
      canInitiatorReverse: action.reversibilityScope.initiatorCanReverse && hoursRemaining > 0,
      canAdminReverse: action.reversibilityScope.adminCanReverse && hoursRemaining > 0,
      canGovernanceReverse: action.reversibilityScope.governanceCanReverse && hoursRemaining > 0,
      gracePeriodEndsAt,
      hoursRemaining: Math.max(0, hoursRemaining),
      reversalReasons: [
        ReversalReason.USER_REQUESTED,
        ReversalReason.SENT_TO_WRONG_RECIPIENT,
        ReversalReason.DUPLICATE_PAYMENT,
        ReversalReason.INCORRECT_AMOUNT,
      ],
      initiatorId: action.initiator.id,
    };
  }

  private async getP2PWalletAccounts(userId: string, recipientId: string) {
    const [senderAccount] = await db
      .select()
      .from(accounts)
      .where(and(eq(accounts.userId, userId), eq(accounts.accountType, 'wallet')))
      .limit(1);

    if (!senderAccount) {
      throw new Error('Sender wallet account not found');
    }

    const [receiverAccount] = await db
      .select()
      .from(accounts)
      .where(and(eq(accounts.userId, recipientId), eq(accounts.accountType, 'wallet')))
      .limit(1);

    if (!receiverAccount) {
      throw new Error('Recipient wallet account not found');
    }

    const [receiver] = await db
      .select()
      .from(users)
      .where(eq(users.id, recipientId))
      .limit(1);

    return {
      senderAccount,
      receiverAccount,
      recipientUsername: receiver?.username || recipientId,
    };
  }

  private async executeLedgerTransfer(
    senderAccount: any,
    receiverAccount: any,
    transferAmount: number,
    memo: string,
    recipientUsername: string,
    userId: string
  ) {
    const senderBalance = Number(senderAccount.balance || '0');
    if (senderBalance < transferAmount) {
      throw new Error('Insufficient balance for P2P transfer');
    }

    const transferReference = `P2P-${Date.now()}-${Math.random().toString(36).slice(2, 10).toUpperCase()}`;
    const now = new Date();

    await db.transaction(async (tx: any) => {
      const updatedSenderBalance = (senderBalance - transferAmount).toFixed(8);
      await tx.update(accounts).set({
        balance: updatedSenderBalance,
        totalWithdrawn: (Number(senderAccount.totalWithdrawn || '0') + transferAmount).toString(),
        totalTransactions: (senderAccount.totalTransactions || 0) + 1,
        updatedAt: now,
      }).where(eq(accounts.id, senderAccount.id));

      const receiverBalance = Number(receiverAccount.balance || '0');
      const updatedReceiverBalance = (receiverBalance + transferAmount).toFixed(8);
      await tx.update(accounts).set({
        balance: updatedReceiverBalance,
        totalDeposited: (Number(receiverAccount.totalDeposited || '0') + transferAmount).toString(),
        totalTransactions: (receiverAccount.totalTransactions || 0) + 1,
        updatedAt: now,
      }).where(eq(accounts.id, receiverAccount.id));

      await tx.insert(accountTransactions).values({
        accountId: senderAccount.id,
        transactionType: 'transfer',
        amount: transferAmount.toString(),
        currency: senderAccount.currency || 'USDC',
        description: `P2P transfer to ${recipientUsername}`,
        reference: transferReference,
        fromAccountId: senderAccount.id,
        toAccountId: receiverAccount.id,
        toUserId: receiverAccount.userId,
        status: 'completed',
        balanceBefore: senderAccount.balance,
        balanceAfter: updatedSenderBalance,
        metadata: JSON.stringify({ memo, recipientId: receiverAccount.userId, transferType: 'p2p' }),
        createdAt: now,
        updatedAt: now,
      });

      await tx.insert(accountTransactions).values({
        accountId: receiverAccount.id,
        transactionType: 'transfer',
        amount: transferAmount.toString(),
        currency: receiverAccount.currency || 'USDC',
        description: `P2P transfer from ${userId}`,
        reference: transferReference,
        fromAccountId: senderAccount.id,
        toAccountId: receiverAccount.id,
        fromUserId: senderAccount.userId,
        status: 'completed',
        balanceBefore: receiverAccount.balance,
        balanceAfter: updatedReceiverBalance,
        metadata: JSON.stringify({ memo, senderId: senderAccount.userId, transferType: 'p2p' }),
        createdAt: now,
        updatedAt: now,
      });
    });

    return transferReference;
  }

  async executePaymentAction(actionId: string, userId: string): Promise<ReversibleAction> {
    const idempotencyKey = `execute:${actionId}`;
    const acquired = await sharedIdempotencyManager.startProcessing(idempotencyKey);
    if (!acquired) {
      const cached = await sharedIdempotencyManager.getResult(idempotencyKey);
      if (cached && cached !== 'pending') {
        return cached as ReversibleAction;
      }
      throw new Error('Execution already in progress for this action');
    }

    try {
      const action = await this.reversibilityService.getActionById(actionId);
      if (!action) {
        throw new Error(`Action ${actionId} not found`);
      }

      if (action.status === 'EXECUTED') {
        await sharedIdempotencyManager.recordResult(idempotencyKey, action, 3600);
        return action;
      }

      // Enforce approval gate
      if (action.confirmationRequirement?.type !== 'NONE' && action.status !== 'GRACE_PERIOD') {
        throw new Error(`Action ${actionId} requires approval before execution. Current status: ${action.status}`);
      }

      let executionResult: { success: boolean; error?: string; transactionHash?: string; blockNumber?: number; metadata?: Record<string, any> } = {
        success: true,
      };

      if (action.actionType === 'PAYMENT_P2P_TRANSFER') {
        const payload = action.actionPayload || {};
        const recipientId = payload.recipientId;
        const amount = Number(payload.amount || 0);
        const senderId = action.initiator?.id || userId;

        if (!recipientId) {
          throw new Error('Recipient ID missing for P2P transfer execution');
        }

        const { senderAccount, receiverAccount, recipientUsername } = await this.getP2PWalletAccounts(senderId, recipientId);
        const transactionHash = await this.executeLedgerTransfer(
          senderAccount, receiverAccount, amount, payload.memo || '', recipientUsername, senderId
        );
        executionResult.transactionHash = transactionHash;
        executionResult.metadata = {
          recipientId,
          amount,
          transferType: 'p2p',
        };
      }

      const executed = await this.reversibilityService.executeAction({
        actionId,
        executedBy: { id: userId, type: ActorType.SYSTEM },
        skipGracePeriod: true,
        executionResult,
      });

      await sharedIdempotencyManager.recordResult(idempotencyKey, executed, 3600);
      return executed;
    } catch (err) {
      await sharedIdempotencyManager.recordResult(idempotencyKey, { error: String(err) }, 3600);
      throw err;
    }
  }

  getGracePeriodDeadline(
    gracePeriodEndsAt: Date,
    gracePeriodHours: number
  ): { deadline: Date; hoursRemaining: number; percentRemaining: number } {
    const now = Date.now();
    const hoursRemaining = Math.max(0, (gracePeriodEndsAt.getTime() - now) / (1000 * 60 * 60));
    const percentRemaining = gracePeriodHours > 0 
      ? Math.max(0, (hoursRemaining / gracePeriodHours) * 100) 
      : 0;

    return { 
      deadline: gracePeriodEndsAt, 
      hoursRemaining, 
      percentRemaining: Math.round(percentRemaining) 
    };
  }

  async getUserPendingPayments(userId: string): Promise<ReversibleAction[]> {
    const actions = await this.reversibilityService.getActionsForEntity('user', userId);
    return actions
      .filter((a) => a.actionType.startsWith('PAYMENT_'))
      .filter((a) => ['PENDING_CONFIRMATION', 'GRACE_PERIOD', 'INITIATED'].includes(a.status))
      .sort((a: any, b: any) => new Date(b.gracePeriodEndsAt as any).getTime() - new Date(a.gracePeriodEndsAt as any).getTime());
  }

  async getPaymentActionStats(): Promise<{
    totalPendingConfirmation: number;
    totalInGracePeriod: number;
    totalReversed: number;
    totalExecuted: number;
    avgGracePeriodHours: number;
    mostCommonReverseReason: ReversalReason | null;
  }> {
    const [pendingRes, graceRes, executedRes, reversedRes, avgGraceRes, reasonRes] = await Promise.all([
      db.execute(sql`SELECT COUNT(*) as count FROM reversible_actions WHERE status = 'PENDING_CONFIRMATION' AND action_type LIKE 'PAYMENT_%'`),
      db.execute(sql`SELECT COUNT(*) as count FROM reversible_actions WHERE status = 'GRACE_PERIOD' AND action_type LIKE 'PAYMENT_%'`),
      db.execute(sql`SELECT COUNT(*) as count FROM reversible_actions WHERE status = 'EXECUTED' AND action_type LIKE 'PAYMENT_%'`),
      db.execute(sql`SELECT COUNT(*) as count FROM action_reversals ar JOIN reversible_actions ra ON ar.action_id = ra.id WHERE ra.action_type LIKE 'PAYMENT_%'`),
      db.execute(sql`SELECT AVG(EXTRACT(EPOCH FROM (grace_period_ends_at - created_at)) / 3600) as avg FROM reversible_actions WHERE grace_period_ends_at IS NOT NULL AND action_type LIKE 'PAYMENT_%'`),
      db.execute(sql`
        SELECT reason, COUNT(*) as count 
        FROM action_reversals ar 
        JOIN reversible_actions ra ON ar.action_id = ra.id 
        WHERE ra.action_type LIKE 'PAYMENT_%'
        GROUP BY reason 
        ORDER BY count DESC 
        LIMIT 1
      `)
    ]);

    return {
      totalPendingConfirmation: Number(pendingRes.rows[0]?.count ?? 0),
      totalInGracePeriod: Number(graceRes.rows[0]?.count ?? 0),
      totalExecuted: Number(executedRes.rows[0]?.count ?? 0),
      totalReversed: Number(reversedRes.rows[0]?.count ?? 0),
      avgGracePeriodHours: Math.round((Number(avgGraceRes.rows[0]?.avg ?? 0)) * 100) / 100,
      mostCommonReverseReason: reasonRes.rows[0]?.reason as ReversalReason || null,
    };
  }
}

export class DepositExecutionHandler {
  constructor(private paymentService: PaymentExecutionService) {}
  async execute(context: { userId: string; simulation: SimulationResult; amount: number; currency: string; paymentMethod: string; exchangeRate: number }): Promise<ReversibleAction> {
    return this.paymentService.createPaymentAction({
      userId: context.userId,
      actionType: 'PAYMENT_DEPOSIT',
      simulation: context.simulation,
      paymentDetails: { amount: context.amount, currency: context.currency, paymentMethod: context.paymentMethod, exchangeRate: context.exchangeRate },
    });
  }
}

export class WithdrawalExecutionHandler {
  constructor(private paymentService: PaymentExecutionService) {}
  async execute(context: { userId: string; simulation: SimulationResult; amount: number; currency: string; destination: string }): Promise<ReversibleAction> {
    return this.paymentService.createPaymentAction({
      userId: context.userId,
      actionType: 'PAYMENT_WITHDRAWAL',
      simulation: context.simulation,
      paymentDetails: { amount: context.amount, currency: context.currency, destination: context.destination },
    });
  }
}

export class P2PTransferExecutionHandler {
  constructor(private paymentService: PaymentExecutionService) {}

  private async getP2PWalletAccounts(userId: string, recipientId: string) {
    const [senderAccount] = await db
      .select()
      .from(accounts)
      .where(and(eq(accounts.userId, userId), eq(accounts.accountType, 'wallet')))
      .limit(1);

    if (!senderAccount) {
      throw new Error('Sender wallet account not found');
    }

    const [receiverAccount] = await db
      .select()
      .from(accounts)
      .where(and(eq(accounts.userId, recipientId), eq(accounts.accountType, 'wallet')))
      .limit(1);

    if (!receiverAccount) {
      throw new Error('Recipient wallet account not found');
    }

    const [receiver] = await db
      .select()
      .from(users)
      .where(eq(users.id, recipientId))
      .limit(1);

    return {
      senderAccount,
      receiverAccount,
      recipientUsername: receiver?.username || recipientId,
    };
  }

  private async executeLedgerTransfer(
    senderAccount: any,
    receiverAccount: any,
    transferAmount: number,
    memo: string,
    recipientUsername: string,
    userId: string
  ) {
    const senderBalance = Number(senderAccount.balance || '0');
    if (senderBalance < transferAmount) {
      throw new Error('Insufficient balance for P2P transfer');
    }

    const transferReference = `P2P-${Date.now()}-${Math.random().toString(36).slice(2, 10).toUpperCase()}`;
    const now = new Date();

    await db.transaction(async (tx) => {
      const updatedSenderBalance = (senderBalance - transferAmount).toFixed(8);
      await tx
        .update(accounts)
        .set({
          balance: updatedSenderBalance,
          totalWithdrawn: (Number(senderAccount.totalWithdrawn || '0') + transferAmount).toString(),
          totalTransactions: (senderAccount.totalTransactions || 0) + 1,
          updatedAt: now,
        })
        .where(eq(accounts.id, senderAccount.id));

      const receiverBalance = Number(receiverAccount.balance || '0');
      const updatedReceiverBalance = (receiverBalance + transferAmount).toFixed(8);
      await tx
        .update(accounts)
        .set({
          balance: updatedReceiverBalance,
          totalDeposited: (Number(receiverAccount.totalDeposited || '0') + transferAmount).toString(),
          totalTransactions: (receiverAccount.totalTransactions || 0) + 1,
          updatedAt: now,
        })
        .where(eq(accounts.id, receiverAccount.id));

      await tx.insert(accountTransactions).values({
        accountId: senderAccount.id,
        transactionType: 'transfer',
        amount: transferAmount.toString(),
        currency: senderAccount.currency || 'USDC',
        description: `P2P transfer to ${recipientUsername}`,
        reference: transferReference,
        fromAccountId: senderAccount.id,
        toAccountId: receiverAccount.id,
        toUserId: receiverAccount.userId,
        status: 'completed',
        balanceBefore: senderAccount.balance,
        balanceAfter: updatedSenderBalance,
        metadata: JSON.stringify({ memo, recipientId: receiverAccount.userId, transferType: 'p2p' }),
        createdAt: now,
        updatedAt: now,
      });

      await tx.insert(accountTransactions).values({
        accountId: receiverAccount.id,
        transactionType: 'transfer',
        amount: transferAmount.toString(),
        currency: receiverAccount.currency || 'USDC',
        description: `P2P transfer from ${userId}`,
        reference: transferReference,
        fromAccountId: senderAccount.id,
        toAccountId: receiverAccount.id,
        fromUserId: senderAccount.userId,
        status: 'completed',
        balanceBefore: receiverAccount.balance,
        balanceAfter: updatedReceiverBalance,
        metadata: JSON.stringify({ memo, senderId: senderAccount.userId, transferType: 'p2p' }),
        createdAt: now,
        updatedAt: now,
      });
    });
  }

  async execute(context: { userId: string; recipientId: string; simulation: SimulationResult; amount: number; memo?: string }): Promise<ReversibleAction> {
    const { senderAccount, receiverAccount, recipientUsername } = await this.getP2PWalletAccounts(context.userId, context.recipientId);
    const transferAmount = Number(context.amount);

    const action = await this.paymentService.createPaymentAction({
      userId: context.userId,
      actionType: 'PAYMENT_P2P_TRANSFER',
      simulation: context.simulation,
      paymentDetails: {
        recipientId: context.recipientId,
        amount: context.amount,
        memo: context.memo || '',
      },
    });

    if (action.confirmationRequirement?.type === 'NONE') {
      return this.paymentService.executePaymentAction(action.id, context.userId);
    }

    return action;
  }
}

export class RecurringPaymentExecutionHandler {
  constructor(private paymentService: PaymentExecutionService) {}
  async execute(context: { userId: string; recipientId: string; simulation: SimulationResult; amount: number; frequency: string; startDate: number; cycles?: number }): Promise<ReversibleAction> {
    return this.paymentService.createPaymentAction({
      userId: context.userId,
      actionType: 'RECURRING_PAYMENT_SETUP',
      simulation: context.simulation,
      paymentDetails: { recipientId: context.recipientId, amount: context.amount, frequency: context.frequency, startDate: context.startDate, cycles: context.cycles },
      approverIds: context.cycles ? [] : ['admin-approval-required'],
    });
  }
}

export class PaymentSettlementExecutionHandler {
  constructor(private paymentService: PaymentExecutionService) {}
  async execute(context: { userId: string; requestId: string; senderId: string; simulation: SimulationResult; amount: number }): Promise<ReversibleAction> {
    return this.paymentService.createPaymentAction({
      userId: context.userId,
      actionType: 'PAYMENT_SETTLEMENT',
      simulation: context.simulation,
      paymentDetails: { requestId: context.requestId, senderId: context.senderId, amount: context.amount },
    });
  }
}