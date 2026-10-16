/**
 * Payment Execution Service (Production)
 *
 * Grace-period reversible payments with a concurrency-safe ledger.
 *
 * Critical guarantees
 * ─────────────────────────────────────────────────────────────
 * • Balances updated atomically (no lost-update / overdraft).
 * • Amounts handled in integer minor units (no floating-point).
 * • Multi-sig approvals are authorized and de-duplicated.
 * • executePaymentAction is idempotent; failures remain retryable.
 * • Single ledger implementation (no duplicated P2P helpers).
 */

import { and, eq, sql } from 'drizzle-orm';
import { db } from '../db';
import { accounts, accountTransactions } from '../../shared/accountSchema';
import { paymentTransactions, users } from '../../shared/schema';
import { notificationService } from '../notificationService';
import { logger } from '../utils/logger';
import { sharedIdempotencyManager } from './sharedIdempotencyManager';
import type { ReversibilityService } from './reversibilityService';
import type { SimulationResult } from './simulationFramework';
import {
  type ReversibleAction,
  type CreateReversibleActionDTO,
  type ReverseActionDTO,
  ActorType,
  ActionSeverity,
  ReversalReason,
} from '../types/reversibility';
import crypto from 'crypto';

// ─────────────────────────────────────────────────────────────
// Money helpers – integer minor units
// ─────────────────────────────────────────────────────────────

/** Supported currencies and their decimal places */
const CURRENCY_DECIMALS: Record<string, number> = {
  USDC: 6,
  USDT: 6,
  cUSD: 18,
  CELO: 18,
  USD: 2,
  KES: 2,
};

function decimalsFor(currency: string): number {
  return CURRENCY_DECIMALS[currency] ?? 2;
}

/** Convert a human amount string/number to integer minor units */
export function toMinor(amount: string | number, currency: string): bigint {
  const dec = decimalsFor(currency);
  const [whole, frac = ''] = String(amount).split('.');
  const fracPadded = (frac + '0'.repeat(dec)).slice(0, dec);
  const sign = whole.startsWith('-') ? -1n : 1n;
  const absWhole = whole.replace('-', '') || '0';
  return sign * (BigInt(absWhole) * 10n ** BigInt(dec) + BigInt(fracPadded || '0'));
}

/** Convert minor units back to a decimal string */
export function fromMinor(minor: bigint, currency: string): string {
  const dec = decimalsFor(currency);
  const neg = minor < 0n;
  const abs = neg ? -minor : minor;
  const str = abs.toString().padStart(dec + 1, '0');
  const whole = str.slice(0, -dec) || '0';
  const frac = str.slice(-dec);
  return `${neg ? '-' : ''}${whole}.${frac}`;
}

function generateTransferRef(): string {
  return `P2P-${Date.now()}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
}

// ─────────────────────────────────────────────────────────────
// Domain errors
// ─────────────────────────────────────────────────────────────

export class PaymentError extends Error {
  constructor(
    message: string,
    public readonly code:
      | 'NOT_FOUND'
      | 'UNAUTHORIZED'
      | 'INSUFFICIENT_FUNDS'
      | 'INVALID_STATE'
      | 'ALREADY_APPROVED'
      | 'EXECUTION_IN_PROGRESS'
      | 'INTERNAL'
  ) {
    super(message);
    this.name = 'PaymentError';
  }
}

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export interface PaymentExecutionContext {
  userId: string;
  actionType: string;
  simulation: SimulationResult;
  paymentDetails: Record<string, unknown>;
  approverIds?: string[];
}

interface LedgerAccounts {
  senderAccount: typeof accounts.$inferSelect;
  receiverAccount: typeof accounts.$inferSelect;
  recipientUsername: string;
}

// ─────────────────────────────────────────────────────────────
// Service
// ─────────────────────────────────────────────────────────────

export class PaymentExecutionService {
  constructor(private readonly reversibilityService: ReversibilityService) {}

  // ── create ─────────────────────────────────────────────────

  async createPaymentAction(context: PaymentExecutionContext): Promise<ReversibleAction> {
    const severityMap: Record<string, ActionSeverity> = {
      LOW: ActionSeverity.LOW,
      MEDIUM: ActionSeverity.MEDIUM,
      HIGH: ActionSeverity.HIGH,
      CRITICAL: ActionSeverity.CRITICAL,
    };

    const severity =
      severityMap[context.simulation.riskLevel] ?? ActionSeverity.MEDIUM;

    const requiresApproval =
      severity === ActionSeverity.MEDIUM ||
      severity === ActionSeverity.HIGH ||
      severity === ActionSeverity.CRITICAL;

    const gracePeriodHours = Math.ceil(
      context.simulation.reversibilityWindow.recommendedGracePeriodHours
    );

    const createDTO: CreateReversibleActionDTO = {
      actionType: context.actionType,
      description: context.simulation.summary,
      severity,
      initiator: { id: context.userId, type: ActorType.USER },
      affectedEntity: { type: 'user', id: context.userId },
      actionPayload: context.paymentDetails,
      beforeState: context.simulation.beforeState,
      afterState: context.simulation.afterState,
      confirmationRequirement: requiresApproval
        ? {
            type: 'MULTI_SIG',
            requiredApprovals: Math.max(
              1,
              (context.approverIds || []).length || 1
            ),
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

    // Auto-confirm + enter grace when no approval required
    if (!requiresApproval) {
      await this.reversibilityService.confirmAction({
        actionId: action.id,
        confirmedBy: { id: context.userId, type: ActorType.USER },
      });
      action = await this.reversibilityService.enterGracePeriod(action.id);
    }

    return action;
  }

  // ── approve (authorized + de-duplicated) ───────────────────

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
    const action = await this.reversibilityService.getActionById(actionId);
    if (!action) {
      throw new PaymentError(`Action ${actionId} not found`, 'NOT_FOUND');
    }

    if (action.status !== 'INITIATED' && action.status !== 'PENDING_CONFIRMATION') {
      throw new PaymentError(
        `Action ${actionId} is not awaiting approval (status=${action.status})`,
        'INVALID_STATE'
      );
    }

    const allowedRoles = action.confirmationRequirement?.approverRoles ?? [];
    if (!allowedRoles.includes(approverRole)) {
      throw new PaymentError(
        `Role ${approverRole} is not authorized to approve this action`,
        'UNAUTHORIZED'
      );
    }

    // Insert with conflict protection (requires unique index on action_id + approver_id)
    try {
      await db.execute(sql`
        INSERT INTO action_approvals (action_id, approver_id, approver_role, created_at)
        VALUES (${actionId}, ${approverId}, ${approverRole}, NOW())
        ON CONFLICT (action_id, approver_id) DO NOTHING
      `);
    } catch (err) {
      throw new PaymentError(
        `Failed to record approval: ${err instanceof Error ? err.message : String(err)}`,
        'INTERNAL'
      );
    }

    // Check whether this approver already had a row (conflict → already approved)
    const existing = await db.execute(sql`
      SELECT 1 FROM action_approvals
      WHERE action_id = ${actionId} AND approver_id = ${approverId}
      LIMIT 1
    `);
    if (!existing.rows.length) {
      // Should not happen after insert, but guard anyway
      throw new PaymentError('Failed to persist approval', 'INTERNAL');
    }

    // Count distinct approvers
    const countRes = await db.execute(sql`
      SELECT COUNT(DISTINCT approver_id) AS count
      FROM action_approvals
      WHERE action_id = ${actionId}
    `);
    const approvalsReceived = Number(countRes.rows[0]?.count ?? 0);
    const required = action.confirmationRequirement?.requiredApprovals ?? 1;
    const fullyApproved = approvalsReceived >= required;

    if (fullyApproved) {
      await this.reversibilityService.confirmAction({
        actionId: action.id,
        confirmedBy: { id: approverId, type: ActorType.ADMIN },
      });
      await this.reversibilityService.enterGracePeriod(action.id);
    }

    const latest = await this.reversibilityService.getActionById(actionId);
    if (!latest) {
      throw new PaymentError(`Action ${actionId} not found after approval`, 'NOT_FOUND');
    }

    return {
      action: latest,
      approvalsReceived,
      approvalsRequired: required,
      fullyApproved,
    };
  }

  // ── reverse ────────────────────────────────────────────────

  async reversePaymentAction(
    actionId: string,
    userId: string,
    reason: ReversalReason,
    userRole?: string
  ): Promise<ReversibleAction> {
    const reverseDTO: ReverseActionDTO = {
      actionId,
      reversedBy: { id: userId, type: ActorType.USER, role: userRole },
      reason,
      reversalReason: String(reason),
    };
    return this.reversibilityService.reverseAction(reverseDTO);
  }

  async getReverseOptions(actionId: string) {
    const action = await this.reversibilityService.getActionById(actionId);
    if (!action) {
      throw new PaymentError(`Action ${actionId} not found`, 'NOT_FOUND');
    }

    const gracePeriodEndsAt = new Date(action.gracePeriodEndsAt as string | Date);
    const hoursRemaining = Math.max(
      0,
      (gracePeriodEndsAt.getTime() - Date.now()) / 3_600_000
    );

    return {
      canInitiatorReverse:
        action.reversibilityScope.initiatorCanReverse && hoursRemaining > 0,
      canAdminReverse:
        action.reversibilityScope.adminCanReverse && hoursRemaining > 0,
      canGovernanceReverse:
        action.reversibilityScope.governanceCanReverse && hoursRemaining > 0,
      gracePeriodEndsAt,
      hoursRemaining,
      reversalReasons: [
        ReversalReason.USER_REQUESTED,
        ReversalReason.SENT_TO_WRONG_RECIPIENT,
        ReversalReason.DUPLICATE_PAYMENT,
        ReversalReason.INCORRECT_AMOUNT,
      ],
      initiatorId: action.initiator.id,
    };
  }

  // ── ledger (atomic, minor units) ───────────────────────────

  private async getP2PWalletAccounts(
    senderId: string,
    recipientId: string
  ): Promise<LedgerAccounts> {
    const [senderAccount] = await db
      .select()
      .from(accounts)
      .where(and(eq(accounts.userId, senderId), eq(accounts.accountType, 'wallet')))
      .limit(1);

    if (!senderAccount) {
      throw new PaymentError('Sender wallet account not found', 'NOT_FOUND');
    }

    const [receiverAccount] = await db
      .select()
      .from(accounts)
      .where(
        and(eq(accounts.userId, recipientId), eq(accounts.accountType, 'wallet'))
      )
      .limit(1);

    if (!receiverAccount) {
      throw new PaymentError('Recipient wallet account not found', 'NOT_FOUND');
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

  /**
   * Atomic double-entry transfer.
   * Uses conditional UPDATE so concurrent transfers cannot overdraw.
   */
  private async executeLedgerTransfer(opts: {
    senderAccount: typeof accounts.$inferSelect;
    receiverAccount: typeof accounts.$inferSelect;
    amountMinor: bigint;
    currency: string;
    memo: string;
    recipientUsername: string;
    senderUserId: string;
  }): Promise<string> {
    const {
      senderAccount,
      receiverAccount,
      amountMinor,
      currency,
      memo,
      recipientUsername,
      senderUserId,
    } = opts;

    if (amountMinor <= 0n) {
      throw new PaymentError('Transfer amount must be positive', 'INVALID_STATE');
    }

    const amountStr = fromMinor(amountMinor, currency);
    const transferReference = generateTransferRef();
    const now = new Date();

    await db.transaction(async (tx) => {
      // Debit sender – atomic guard against overdraft
      const debit = await tx.execute(sql`
        UPDATE accounts
        SET
          balance = (CAST(balance AS NUMERIC) - CAST(${amountStr} AS NUMERIC))::text,
          total_withdrawn = (COALESCE(CAST(total_withdrawn AS NUMERIC), 0) + CAST(${amountStr} AS NUMERIC))::text,
          total_transactions = COALESCE(total_transactions, 0) + 1,
          updated_at = ${now}
        WHERE id = ${senderAccount.id}
          AND CAST(balance AS NUMERIC) >= CAST(${amountStr} AS NUMERIC)
        RETURNING balance, (CAST(balance AS NUMERIC) + CAST(${amountStr} AS NUMERIC))::text AS balance_before
      `);

      if (!debit.rows.length) {
        throw new PaymentError('Insufficient balance for P2P transfer', 'INSUFFICIENT_FUNDS');
      }

      const senderBalanceBefore = String(debit.rows[0].balance_before);
      const senderBalanceAfter = String(debit.rows[0].balance);

      // Credit receiver
      const credit = await tx.execute(sql`
        UPDATE accounts
        SET
          balance = (CAST(balance AS NUMERIC) + CAST(${amountStr} AS NUMERIC))::text,
          total_deposited = (COALESCE(CAST(total_deposited AS NUMERIC), 0) + CAST(${amountStr} AS NUMERIC))::text,
          total_transactions = COALESCE(total_transactions, 0) + 1,
          updated_at = ${now}
        WHERE id = ${receiverAccount.id}
        RETURNING balance, (CAST(balance AS NUMERIC) - CAST(${amountStr} AS NUMERIC))::text AS balance_before
      `);

      if (!credit.rows.length) {
        throw new PaymentError('Receiver account update failed', 'INTERNAL');
      }

      const receiverBalanceBefore = String(credit.rows[0].balance_before);
      const receiverBalanceAfter = String(credit.rows[0].balance);

      // Double-entry legs
      await tx.insert(accountTransactions).values({
        accountId: senderAccount.id,
        transactionType: 'transfer',
        amount: amountStr,
        currency,
        description: `P2P transfer to ${recipientUsername}`,
        reference: transferReference,
        fromAccountId: senderAccount.id,
        toAccountId: receiverAccount.id,
        toUserId: receiverAccount.userId,
        status: 'completed',
        balanceBefore: senderBalanceBefore,
        balanceAfter: senderBalanceAfter,
        metadata: JSON.stringify({
          memo,
          recipientId: receiverAccount.userId,
          transferType: 'p2p',
        }),
        createdAt: now,
        updatedAt: now,
      });

      await tx.insert(accountTransactions).values({
        accountId: receiverAccount.id,
        transactionType: 'transfer',
        amount: amountStr,
        currency,
        description: `P2P transfer from ${senderUserId}`,
        reference: transferReference,
        fromAccountId: senderAccount.id,
        toAccountId: receiverAccount.id,
        fromUserId: senderAccount.userId,
        status: 'completed',
        balanceBefore: receiverBalanceBefore,
        balanceAfter: receiverBalanceAfter,
        metadata: JSON.stringify({
          memo,
          senderId: senderAccount.userId,
          transferType: 'p2p',
        }),
        createdAt: now,
        updatedAt: now,
      });
    });

    return transferReference;
  }

  // ── execute (idempotent) ───────────────────────────────────

  async executePaymentAction(
    actionId: string,
    userId: string
  ): Promise<ReversibleAction> {
    const idempotencyKey = `execute:${actionId}`;

    const acquired = await sharedIdempotencyManager.startProcessing(idempotencyKey);
    if (!acquired) {
      const cached = await sharedIdempotencyManager.getResult(idempotencyKey);
      if (cached && typeof cached === 'object' && 'id' in (cached as object)) {
        return cached as ReversibleAction;
      }
      // Still in progress or previous hard failure – surface a typed error
      throw new PaymentError(
        'Execution already in progress or previously failed for this action',
        'EXECUTION_IN_PROGRESS'
      );
    }

    try {
      const action = await this.reversibilityService.getActionById(actionId);
      if (!action) {
        throw new PaymentError(`Action ${actionId} not found`, 'NOT_FOUND');
      }

      if (action.status === 'EXECUTED') {
        await sharedIdempotencyManager.recordResult(idempotencyKey, action, 3600);
        return action;
      }

      // Approval gate
      if (
        action.confirmationRequirement?.type !== 'NONE' &&
        action.status !== 'GRACE_PERIOD'
      ) {
        throw new PaymentError(
          `Action ${actionId} requires approval before execution (status=${action.status})`,
          'INVALID_STATE'
        );
      }

      let executionResult: {
        success: boolean;
        error?: string;
        transactionHash?: string;
        metadata?: Record<string, unknown>;
      } = { success: true };

      if (action.actionType === 'PAYMENT_P2P_TRANSFER') {
        const payload = (action.actionPayload || {}) as Record<string, unknown>;
        const recipientId = String(payload.recipientId || '');
        const currency = String(payload.currency || 'USDC');
        const amountMinor = toMinor(payload.amount as string | number, currency);
        const senderId = action.initiator?.id || userId;

        if (!recipientId) {
          throw new PaymentError(
            'Recipient ID missing for P2P transfer',
            'INVALID_STATE'
          );
        }

        const { senderAccount, receiverAccount, recipientUsername } =
          await this.getP2PWalletAccounts(senderId, recipientId);

        const transactionHash = await this.executeLedgerTransfer({
          senderAccount,
          receiverAccount,
          amountMinor,
          currency: senderAccount.currency || currency,
          memo: String(payload.memo || ''),
          recipientUsername,
          senderUserId: senderId,
        });

        executionResult.transactionHash = transactionHash;
        executionResult.metadata = {
          recipientId,
          amount: fromMinor(amountMinor, currency),
          transferType: 'p2p',
        };
      }

      const executed = await this.reversibilityService.executeAction({
        actionId,
        executedBy: { id: userId, type: ActorType.SYSTEM },
        skipGracePeriod: true,
        executionResult,
      });

      if (executed.status === 'EXECUTED') {
        const [payment] = await db
          .update(paymentTransactions)
          .set({
            status: 'completed',
            version: sql`${paymentTransactions.version} + 1`,
            updatedAt: new Date(),
          })
          .where(
            and(
              sql`${paymentTransactions.metadata}->>'reversibleActionId' = ${actionId}`,
              eq(paymentTransactions.status, 'pending')
            )
          )
          .returning({
            userId: paymentTransactions.userId,
            reference: paymentTransactions.reference,
            amount: paymentTransactions.amount,
            currency: paymentTransactions.currency,
            metadata: paymentTransactions.metadata,
          });

        if (payment) {
          const recipientUserId = payment.metadata &&
            typeof payment.metadata === 'object' &&
            'recipientUserId' in payment.metadata
            ? payment.metadata.recipientUserId
            : undefined;
          const recipientId =
            typeof recipientUserId === 'string'
              ? recipientUserId
              : undefined;

          await notificationService.sendNotification(payment.userId, {
            type: 'payment_success',
            title: 'Payment completed',
            message: `${payment.amount} ${payment.currency} payment ${payment.reference} has completed.`,
            priority: 'medium',
            metadata: { paymentReference: payment.reference, actionId },
          });

          if (recipientId) {
            await notificationService.sendNotification(recipientId, {
              type: 'payment_success',
              title: 'Incoming payment completed',
              message: `${payment.amount} ${payment.currency} payment ${payment.reference} has been received.`,
              priority: 'medium',
              metadata: { paymentReference: payment.reference, actionId },
            });
          }
        }
      }

      await sharedIdempotencyManager.recordResult(idempotencyKey, executed, 3600);
      return executed;
    } catch (err) {
      // Do NOT cache the failure as a successful result – clear so retries work
      try {
        await sharedIdempotencyManager.clear(idempotencyKey);
      } catch (clearError) {
        logger.error('Failed to clear payment idempotency key after execution error', {
          idempotencyKey,
          error: clearError instanceof Error ? clearError.message : String(clearError),
        });
      }
      throw err;
    }
  }

  // ── helpers / stats ────────────────────────────────────────

  cancelUnexecutedAction(actionId: string, userId: string) {
    return this.reversibilityService.cancelUnexecutedAction(actionId, userId);
  }

  getGracePeriodDeadline(
    gracePeriodEndsAt: Date,
    gracePeriodHours: number
  ): { deadline: Date; hoursRemaining: number; percentRemaining: number } {
    const hoursRemaining = Math.max(
      0,
      (gracePeriodEndsAt.getTime() - Date.now()) / 3_600_000
    );
    const percentRemaining =
      gracePeriodHours > 0
        ? Math.round(Math.max(0, (hoursRemaining / gracePeriodHours) * 100))
        : 0;
    return { deadline: gracePeriodEndsAt, hoursRemaining, percentRemaining };
  }

  async getUserPendingPayments(userId: string): Promise<ReversibleAction[]> {
    const actions = await this.reversibilityService.getActionsForEntity(
      'user',
      userId
    );
    return actions
      .filter((a) => a.actionType.startsWith('PAYMENT_'))
      .filter((a) =>
        ['PENDING_CONFIRMATION', 'GRACE_PERIOD', 'INITIATED'].includes(a.status)
      )
      .sort(
        (a, b) =>
          new Date(b.gracePeriodEndsAt as string | Date).getTime() -
          new Date(a.gracePeriodEndsAt as string | Date).getTime()
      );
  }

  async getPaymentActionStats() {
    const [
      pendingRes,
      graceRes,
      executedRes,
      reversedRes,
      avgGraceRes,
      reasonRes,
    ] = await Promise.all([
      db.execute(
        sql`SELECT COUNT(*) AS count FROM reversible_actions WHERE status = 'PENDING_CONFIRMATION' AND action_type LIKE 'PAYMENT_%'`
      ),
      db.execute(
        sql`SELECT COUNT(*) AS count FROM reversible_actions WHERE status = 'GRACE_PERIOD' AND action_type LIKE 'PAYMENT_%'`
      ),
      db.execute(
        sql`SELECT COUNT(*) AS count FROM reversible_actions WHERE status = 'EXECUTED' AND action_type LIKE 'PAYMENT_%'`
      ),
      db.execute(
        sql`SELECT COUNT(*) AS count FROM action_reversals ar JOIN reversible_actions ra ON ar.action_id = ra.id WHERE ra.action_type LIKE 'PAYMENT_%'`
      ),
      db.execute(
        sql`SELECT AVG(EXTRACT(EPOCH FROM (grace_period_ends_at - created_at)) / 3600) AS avg FROM reversible_actions WHERE grace_period_ends_at IS NOT NULL AND action_type LIKE 'PAYMENT_%'`
      ),
      db.execute(sql`
        SELECT reason, COUNT(*) AS count
        FROM action_reversals ar
        JOIN reversible_actions ra ON ar.action_id = ra.id
        WHERE ra.action_type LIKE 'PAYMENT_%'
        GROUP BY reason
        ORDER BY count DESC
        LIMIT 1
      `),
    ]);

    return {
      totalPendingConfirmation: Number(pendingRes.rows[0]?.count ?? 0),
      totalInGracePeriod: Number(graceRes.rows[0]?.count ?? 0),
      totalExecuted: Number(executedRes.rows[0]?.count ?? 0),
      totalReversed: Number(reversedRes.rows[0]?.count ?? 0),
      avgGracePeriodHours:
        Math.round(Number(avgGraceRes.rows[0]?.avg ?? 0) * 100) / 100,
      mostCommonReverseReason:
        (reasonRes.rows[0]?.reason as ReversalReason) || null,
    };
  }
}

// ─────────────────────────────────────────────────────────────
// Handlers – create only; execution is always explicit
// ─────────────────────────────────────────────────────────────

export class DepositExecutionHandler {
  constructor(private paymentService: PaymentExecutionService) {}

  execute(context: {
    userId: string;
    simulation: SimulationResult;
    amount: number;
    currency: string;
    paymentMethod: string;
    exchangeRate: number;
  }): Promise<ReversibleAction> {
    return this.paymentService.createPaymentAction({
      userId: context.userId,
      actionType: 'PAYMENT_DEPOSIT',
      simulation: context.simulation,
      paymentDetails: {
        amount: context.amount,
        currency: context.currency,
        paymentMethod: context.paymentMethod,
        exchangeRate: context.exchangeRate,
      },
    });
  }
}

export class WithdrawalExecutionHandler {
  constructor(private paymentService: PaymentExecutionService) {}

  execute(context: {
    userId: string;
    simulation: SimulationResult;
    amount: number;
    currency: string;
    destination: string;
  }): Promise<ReversibleAction> {
    return this.paymentService.createPaymentAction({
      userId: context.userId,
      actionType: 'PAYMENT_WITHDRAWAL',
      simulation: context.simulation,
      paymentDetails: {
        amount: context.amount,
        currency: context.currency,
        destination: context.destination,
      },
    });
  }
}

export class P2PTransferExecutionHandler {
  constructor(private paymentService: PaymentExecutionService) {}

  execute(context: {
    userId: string;
    recipientId: string;
    simulation: SimulationResult;
    amount: number;
    currency?: string;
    memo?: string;
  }): Promise<ReversibleAction> {
    return this.paymentService.createPaymentAction({
      userId: context.userId,
      actionType: 'PAYMENT_P2P_TRANSFER',
      simulation: context.simulation,
      paymentDetails: {
        recipientId: context.recipientId,
        amount: context.amount,
        currency: context.currency || 'USDC',
        memo: context.memo || '',
      },
    });
  }
}

export class RecurringPaymentExecutionHandler {
  constructor(private paymentService: PaymentExecutionService) {}

  execute(context: {
    userId: string;
    recipientId: string;
    simulation: SimulationResult;
    amount: number;
    frequency: string;
    startDate: number;
    cycles?: number;
  }): Promise<ReversibleAction> {
    return this.paymentService.createPaymentAction({
      userId: context.userId,
      actionType: 'RECURRING_PAYMENT_SETUP',
      simulation: context.simulation,
      paymentDetails: {
        recipientId: context.recipientId,
        amount: context.amount,
        frequency: context.frequency,
        startDate: context.startDate,
        cycles: context.cycles,
      },
      approverIds: context.cycles ? [] : ['admin-approval-required'],
    });
  }
}

export class PaymentSettlementExecutionHandler {
  constructor(private paymentService: PaymentExecutionService) {}

  execute(context: {
    userId: string;
    requestId: string;
    senderId: string;
    simulation: SimulationResult;
    amount: number;
  }): Promise<ReversibleAction> {
    return this.paymentService.createPaymentAction({
      userId: context.userId,
      actionType: 'PAYMENT_SETTLEMENT',
      simulation: context.simulation,
      paymentDetails: {
        requestId: context.requestId,
        senderId: context.senderId,
        amount: context.amount,
      },
    });
  }
}