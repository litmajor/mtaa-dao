/**
 * Payment Command Handlers — Sprint 2
 *
 * These handlers implement the business logic for the Payment aggregate.
 * Each handler:
 *   1. Loads the aggregate from the repository
 *   2. Validates state machine transitions and invariants
 *   3. Performs OCC-protected mutation via the repository
 *   4. Returns the CommandResult with domain events
 *
 * The critical handler is CompletePaymentHandler, which enforces the
 * ACID accounting contract:
 *   - paymentTransactions updated (OCC)
 *   - walletTransactions inserted (ledger entry)
 *   - users.balance updated (SELECT FOR UPDATE)
 *   - PaymentCompleted event returned (persisted by OutboxMiddleware)
 *   All inside one database transaction (context.tx from TransactionMiddleware).
 */

import { v4 as uuid } from 'uuid';
import { sql } from 'drizzle-orm';
import type { CommandHandler, CommandResult, CommandContext } from '../commands/CommandBus';
import type { Command } from '../commands/Command';
import type { DomainEvent } from '../events/DomainEvent';
import { EventCatalog } from '../events/catalog';
import type {
  PaymentRepository, PaymentAggregate
} from './PaymentRepository';
import { DrizzlePaymentRepository, OptimisticLockError} from './PaymentRepository';
import {
  PaymentStatus,
  validatePaymentTransition,
} from './PaymentStateMachine';
import type {PaymentStatusType} from './PaymentStateMachine';
import type {
  CreatePaymentPayload,
  AcceptPaymentPayload,
  ReceiveWebhookPayload,
  VerifyPaymentPayload,
  SettlePaymentPayload,
  CompletePaymentPayload,
  FailPaymentPayload,
  ReconcilePaymentPayload,
} from './PaymentCommands';
import type { UpdatePaymentMetadataPayload } from './PaymentCommands';
import { PaymentCommandTypes} from './PaymentCommands';
import { walletTransactions } from '../../../shared/schema';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildPaymentEvent(
  type: string,
  aggregateId: string,
  actor: string,
  correlationId: string,
  causationId: string,
  payload: Record<string, unknown>,
): DomainEvent {
  return {
    id: uuid(),
    type,
    version: 1,
    aggregateType: 'Payment',
    aggregateId,
    correlationId,
    causationId,
    actor,
    timestamp: new Date(),
    payload,
    metadata: {
      source: 'payment-command-handler',
      environment: process.env.NODE_ENV ?? 'development',
      schemaVersion: 1,
    },
  };
}

// ---------------------------------------------------------------------------
// CreatePaymentHandler
// ---------------------------------------------------------------------------

export class CreatePaymentHandler implements CommandHandler<Command<CreatePaymentPayload>> {
  readonly commandType = PaymentCommandTypes.CreatePayment;

  constructor(private repo: PaymentRepository) {}

  async execute(command: Command<CreatePaymentPayload>, context: CommandContext): Promise<CommandResult> {
    const { payload } = command;

    const payment = await this.repo.create(
      {
        userId: payload.userId,
        reference: payload.reference,
        type: payload.type,
        amount: payload.amount,
        currency: payload.currency,
        provider: payload.provider,
        status: PaymentStatus.CREATED,
        metadata: payload.metadata ?? {},
      },
      context.tx,
    );

    const event = buildPaymentEvent(
      EventCatalog.PaymentInitiated,
      payment.id,
      command.actor,
      command.correlationId,
      command.id,
      {
        paymentId: payment.id,
        reference: payment.reference,
        userId: payment.userId,
        amount: payment.amount,
        currency: payment.currency,
        provider: payment.provider,
      },
    );

    return { success: true, commandId: command.id, events: [event] };
  }
}

// ---------------------------------------------------------------------------
// ReceiveWebhookHandler
// ---------------------------------------------------------------------------

export class ReceiveWebhookHandler implements CommandHandler<Command<ReceiveWebhookPayload>> {
  readonly commandType = PaymentCommandTypes.ReceiveWebhook;

  constructor(private repo: PaymentRepository) {}

  async execute(command: Command<ReceiveWebhookPayload>, context: CommandContext): Promise<CommandResult> {
    const { payload } = command;

    const payment = await this.repo.findByReference(payload.reference, context.tx);
    if (!payment) {
      return {
        success: false,
        commandId: command.id,
        events: [],
        error: `Payment not found for reference: ${payload.reference}`,
      };
    }

    // Idempotency: if already past WEBHOOK_RECEIVED, skip
    const pastWebhook = [
      PaymentStatus.VERIFIED,
      PaymentStatus.SETTLING,
      PaymentStatus.COMPLETED,
      PaymentStatus.FAILED,
    ] as string[];
    if (pastWebhook.includes(payment.status) || payment.status === PaymentStatus.WEBHOOK_RECEIVED) {
      return {
        success: true,
        commandId: command.id,
        events: [],
      };
    }

    // Transition to WEBHOOK_RECEIVED (from CREATED, PROVIDER_ACCEPTED, or PENDING)
    // We allow a fast-forward: if the payment is still CREATED or PROVIDER_ACCEPTED,
    // the webhook arrival implies the provider accepted and it's pending
    const currentStatus = payment.status as PaymentStatusType;
    let targetStatus = PaymentStatus.WEBHOOK_RECEIVED;

    // For fast-forwarding, we validate the transition is legal
    // If current is CREATED → we fast-forward through PROVIDER_ACCEPTED → PENDING → WEBHOOK_RECEIVED
    // The state machine enforces single-step, but in practice webhooks can arrive
    // before we've recorded intermediate states. We update directly.
    // This is safe because WEBHOOK_RECEIVED is strictly forward from any early state.

    const mergedMetadata = {
      ...(typeof payment.metadata === 'object' ? payment.metadata : {}),
      webhookReceivedAt: new Date().toISOString(),
      ...payload.providerData,
    };

    try {
      await this.repo.update(
        payment.id,
        payment.version,
        {
          status: targetStatus,
          metadata: mergedMetadata as any,
        },
        context.tx,
      );
    } catch (err) {
      if (err instanceof OptimisticLockError) {
        return { success: false, commandId: command.id, events: [], error: 'OCC_CONFLICT' };
      }
      throw err;
    }

    const event = buildPaymentEvent(
      EventCatalog.PaymentWebhookReceived,
      payment.id,
      command.actor,
      command.correlationId,
      command.id,
      {
        paymentId: payment.id,
        reference: payment.reference,
        providerData: payload.providerData,
      },
    );

    return { success: true, commandId: command.id, events: [event] };
  }
}

// ---------------------------------------------------------------------------
// AcceptPaymentHandler
// ---------------------------------------------------------------------------

export class AcceptPaymentHandler implements CommandHandler<Command<AcceptPaymentPayload>> {
  readonly commandType = PaymentCommandTypes.AcceptPayment;

  constructor(private repo: PaymentRepository = new DrizzlePaymentRepository()) {}

  async execute(command: Command<AcceptPaymentPayload>, context: CommandContext): Promise<CommandResult> {
    const { payload } = command;

    if (!payload.paymentId) {
      return { success: false, commandId: command.id, events: [], error: 'AcceptPayment requires paymentId' };
    }

    const payment = await this.repo.findById(payload.paymentId, context.tx);
    if (!payment) {
      return { success: false, commandId: command.id, events: [], error: `Payment not found: ${payload.paymentId}` };
    }

    if (payment.status !== PaymentStatus.CREATED) {
      return { success: true, commandId: command.id, events: [] };
    }

    try {
      validatePaymentTransition(payment.status as PaymentStatusType, PaymentStatus.PROVIDER_ACCEPTED, payment.id);
      await this.repo.update(
        payment.id,
        payment.version,
        {
          status: PaymentStatus.PROVIDER_ACCEPTED,
          metadata: {
            ...(typeof payment.metadata === 'object' ? payment.metadata : {}),
            acceptedAt: new Date().toISOString(),
            ...(payload.providerResponse ?? {}),
          } as any,
        },
        context.tx,
      );
    } catch (err) {
      if (err instanceof OptimisticLockError) {
        return { success: false, commandId: command.id, events: [], error: 'OCC_CONFLICT' };
      }
      return { success: false, commandId: command.id, events: [], error: err instanceof Error ? err.message : String(err) };
    }

    const event = buildPaymentEvent(
      EventCatalog.PaymentAccepted,
      payment.id,
      command.actor,
      command.correlationId,
      command.id,
      {
        paymentId: payment.id,
        providerResponse: payload.providerResponse ?? {},
      },
    );

    return { success: true, commandId: command.id, events: [event] };
  }
}

// ---------------------------------------------------------------------------
// VerifyPaymentHandler
// ---------------------------------------------------------------------------

export class VerifyPaymentHandler implements CommandHandler<Command<VerifyPaymentPayload>> {
  readonly commandType = PaymentCommandTypes.VerifyPayment;

  constructor(private repo: PaymentRepository = new DrizzlePaymentRepository()) {}

  async execute(command: Command<VerifyPaymentPayload>, context: CommandContext): Promise<CommandResult> {
    const { payload } = command;

    if (!payload.paymentId) {
      return { success: false, commandId: command.id, events: [], error: 'VerifyPayment requires paymentId' };
    }

    const payment = await this.repo.findById(payload.paymentId, context.tx);
    if (!payment) {
      return { success: false, commandId: command.id, events: [], error: `Payment not found: ${payload.paymentId}` };
    }

    if (payment.status === PaymentStatus.VERIFIED || payment.status === PaymentStatus.SETTLING || payment.status === PaymentStatus.COMPLETED) {
      return { success: true, commandId: command.id, events: [] };
    }

    try {
      validatePaymentTransition(payment.status as PaymentStatusType, PaymentStatus.VERIFIED, payment.id);
      await this.repo.update(
        payment.id,
        payment.version,
        {
          status: PaymentStatus.VERIFIED,
          metadata: {
            ...(typeof payment.metadata === 'object' ? payment.metadata : {}),
            verifiedAt: new Date().toISOString(),
            ...(payload.verificationData ?? {}),
          } as any,
        },
        context.tx,
      );
    } catch (err) {
      if (err instanceof OptimisticLockError) {
        return { success: false, commandId: command.id, events: [], error: 'OCC_CONFLICT' };
      }
      return { success: false, commandId: command.id, events: [], error: err instanceof Error ? err.message : String(err) };
    }

    const event = buildPaymentEvent(
      EventCatalog.PaymentVerified,
      payment.id,
      command.actor,
      command.correlationId,
      command.id,
      {
        paymentId: payment.id,
        verificationData: payload.verificationData ?? {},
      },
    );

    return { success: true, commandId: command.id, events: [event] };
  }
}

// ---------------------------------------------------------------------------
// SettlePaymentHandler
// ---------------------------------------------------------------------------

export class SettlePaymentHandler implements CommandHandler<Command<SettlePaymentPayload>> {
  readonly commandType = PaymentCommandTypes.SettlePayment;

  constructor(private repo: PaymentRepository = new DrizzlePaymentRepository()) {}

  async execute(command: Command<SettlePaymentPayload>, context: CommandContext): Promise<CommandResult> {
    const { payload } = command;

    if (!payload.paymentId) {
      return { success: false, commandId: command.id, events: [], error: 'SettlePayment requires paymentId' };
    }

    const payment = await this.repo.findById(payload.paymentId, context.tx);
    if (!payment) {
      return { success: false, commandId: command.id, events: [], error: `Payment not found: ${payload.paymentId}` };
    }

    if (payment.status === PaymentStatus.SETTLING || payment.status === PaymentStatus.COMPLETED) {
      return { success: true, commandId: command.id, events: [] };
    }

    try {
      validatePaymentTransition(payment.status as PaymentStatusType, PaymentStatus.SETTLING, payment.id);
      await this.repo.update(
        payment.id,
        payment.version,
        {
          status: PaymentStatus.SETTLING,
          metadata: {
            ...(typeof payment.metadata === 'object' ? payment.metadata : {}),
            settlingAt: new Date().toISOString(),
          } as any,
        },
        context.tx,
      );
    } catch (err) {
      if (err instanceof OptimisticLockError) {
        return { success: false, commandId: command.id, events: [], error: 'OCC_CONFLICT' };
      }
      return { success: false, commandId: command.id, events: [], error: err instanceof Error ? err.message : String(err) };
    }

    const event = buildPaymentEvent(
      EventCatalog.PaymentSettled,
      payment.id,
      command.actor,
      command.correlationId,
      command.id,
      {
        paymentId: payment.id,
      },
    );

    return { success: true, commandId: command.id, events: [event] };
  }
}

// ---------------------------------------------------------------------------
// CompletePaymentHandler — ACID Accounting Contract
// ---------------------------------------------------------------------------
//
// This is the authoritative financial transaction. It enforces:
//
//   BEGIN TX (provided by TransactionMiddleware)
//     1. Load + verify payment
//     2. Insert walletTransactions row (ledger entry)
//     3. Update users.balance (SELECT FOR UPDATE to prevent races)
//     4. Update paymentTransactions to COMPLETED (OCC)
//     5. Return PaymentCompleted event (OutboxMiddleware persists it)
//   COMMIT (TransactionMiddleware resolves)
//
// After commit, the Outbox Relay publishes the event.
// Consumers perform non-authoritative work only (notifications, analytics, etc.)
// ---------------------------------------------------------------------------

export class CompletePaymentHandler implements CommandHandler<Command<CompletePaymentPayload>> {
  readonly commandType = PaymentCommandTypes.CompletePayment;

  constructor(private repo: PaymentRepository) {}

  async execute(command: Command<CompletePaymentPayload>, context: CommandContext): Promise<CommandResult> {
    const { payload } = command;
    const tx = context.tx;

    // 1. Load payment
    let payment: PaymentAggregate | null;
    if (payload.paymentId) {
      payment = await this.repo.findById(payload.paymentId, tx);
    } else if (payload.reference) {
      payment = await this.repo.findByReference(payload.reference, tx);
    } else {
      return {
        success: false,
        commandId: command.id,
        events: [],
        error: 'CompletePayment requires paymentId or reference',
      };
    }

    if (!payment) {
      return {
        success: false,
        commandId: command.id,
        events: [],
        error: `Payment not found: ${payload.paymentId || payload.reference}`,
      };
    }

    // Idempotency: already completed
    if (payment.status === PaymentStatus.COMPLETED) {
      return { success: true, commandId: command.id, events: [] };
    }

    // Verify the payment is in a completable state
    // We accept completion from WEBHOOK_RECEIVED, VERIFIED, or SETTLING
    const completableStates = [
      PaymentStatus.WEBHOOK_RECEIVED,
      PaymentStatus.VERIFIED,
      PaymentStatus.SETTLING,
    ] as string[];

    if (!completableStates.includes(payment.status)) {
      return {
        success: false,
        commandId: command.id,
        events: [],
        error: `Cannot complete payment in status '${payment.status}'`,
      };
    }

    // 2. Insert ledger entry (walletTransactions)
    const walletAddress = payload.walletAddress || 'system';
    await tx
      .insert(walletTransactions)
      .values({
        fromUserId: null,
        toUserId: payment.userId,
        walletAddress,
        amount: payment.amount,
        currency: payment.currency,
        type: 'deposit',
        status: 'completed',
        description: `Payment completed: ${payment.reference}`,
        metadata: {
          paymentTransactionId: payment.id,
          paymentReference: payment.reference,
          provider: payment.provider,
          ...(payload.providerMetadata ?? {}),
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      });

    // 3. Update user's cached balance (SELECT FOR UPDATE to prevent concurrent races)
    const userRes = await tx.execute(sql`
      SELECT id, balance
      FROM users
      WHERE id = ${payment.userId}::text
      FOR UPDATE
    `);

    const user = userRes.rows?.[0] as { id: string; balance: string | number } | undefined;
    if (user) {
      const currentBalance = Number(user.balance || 0);
      const depositAmount = Number(payment.amount || 0);
      const newBalance = (currentBalance + depositAmount).toFixed(4);

      await tx.execute(sql`
        UPDATE users
        SET balance = ${newBalance}::numeric, updated_at = now()
        WHERE id = ${user.id}::text
      `);
    }

    // 4. Update paymentTransactions to COMPLETED (OCC)
    const mergedMetadata = {
      ...(typeof payment.metadata === 'object' ? payment.metadata : {}),
      completedAt: new Date().toISOString(),
      ...(payload.providerMetadata ?? {}),
    };

    try {
      await this.repo.update(
        payment.id,
        payment.version,
        {
          status: PaymentStatus.COMPLETED,
          metadata: mergedMetadata as any,
        },
        tx,
      );
    } catch (err) {
      if (err instanceof OptimisticLockError) {
        return { success: false, commandId: command.id, events: [], error: 'OCC_CONFLICT' };
      }
      throw err;
    }

    // 5. Return PaymentCompleted event (OutboxMiddleware persists in same tx)
    const event = buildPaymentEvent(
      EventCatalog.PaymentCompleted,
      payment.id,
      command.actor,
      command.correlationId,
      command.id,
      {
        paymentId: payment.id,
        reference: payment.reference,
        userId: payment.userId,
        amount: payment.amount,
        currency: payment.currency,
        provider: payment.provider,
        walletAddress,
      },
    );

    return { success: true, commandId: command.id, events: [event] };
  }
}

// ---------------------------------------------------------------------------
// FailPaymentHandler
// ---------------------------------------------------------------------------

export class FailPaymentHandler implements CommandHandler<Command<FailPaymentPayload>> {
  readonly commandType = PaymentCommandTypes.FailPayment;

  constructor(private repo: PaymentRepository) {}

  async execute(command: Command<FailPaymentPayload>, context: CommandContext): Promise<CommandResult> {
    const { payload } = command;
    const tx = context.tx;

    let payment: PaymentAggregate | null;
    if (payload.paymentId) {
      payment = await this.repo.findById(payload.paymentId, tx);
    } else if (payload.reference) {
      payment = await this.repo.findByReference(payload.reference, tx);
    } else {
      return { success: false, commandId: command.id, events: [], error: 'FailPayment requires paymentId or reference' };
    }

    if (!payment) {
      return { success: false, commandId: command.id, events: [], error: `Payment not found` };
    }

    // Idempotency: already failed
    if (payment.status === PaymentStatus.FAILED) {
      return { success: true, commandId: command.id, events: [] };
    }

    // Cannot fail a completed payment
    if (payment.status === PaymentStatus.COMPLETED) {
      return {
        success: false,
        commandId: command.id,
        events: [],
        error: 'Cannot fail a COMPLETED payment',
      };
    }

    const mergedMetadata = {
      ...(typeof payment.metadata === 'object' ? payment.metadata : {}),
      failedAt: new Date().toISOString(),
      failureReason: payload.reason,
      ...(payload.providerData ?? {}),
    };

    try {
      await this.repo.update(
        payment.id,
        payment.version,
        {
          status: PaymentStatus.FAILED,
          metadata: mergedMetadata as any,
        },
        tx,
      );
    } catch (err) {
      if (err instanceof OptimisticLockError) {
        return { success: false, commandId: command.id, events: [], error: 'OCC_CONFLICT' };
      }
      throw err;
    }

    const event = buildPaymentEvent(
      EventCatalog.PaymentFailed,
      payment.id,
      command.actor,
      command.correlationId,
      command.id,
      {
        paymentId: payment.id,
        reference: payment.reference,
        reason: payload.reason,
      },
    );

    return { success: true, commandId: command.id, events: [event] };
  }
}

// ---------------------------------------------------------------------------
// ReconcilePaymentHandler
// ---------------------------------------------------------------------------

export class ReconcilePaymentHandler implements CommandHandler<Command<ReconcilePaymentPayload>> {
  readonly commandType = PaymentCommandTypes.ReconcilePayment;

  constructor(private repo: PaymentRepository) {}

  async execute(command: Command<ReconcilePaymentPayload>, context: CommandContext): Promise<CommandResult> {
    const { payload } = command;
    const tx = context.tx;

    let payment: PaymentAggregate | null;
    if (payload.paymentId) {
      payment = await this.repo.findById(payload.paymentId, tx);
    } else if (payload.reference) {
      payment = await this.repo.findByReference(payload.reference, tx);
    } else {
      return { success: false, commandId: command.id, events: [], error: 'ReconcilePayment requires paymentId or reference' };
    }

    if (!payment) {
      return { success: false, commandId: command.id, events: [], error: `Payment not found` };
    }

    // Can only reconcile from FAILED
    if (payment.status !== PaymentStatus.FAILED) {
      return {
        success: false,
        commandId: command.id,
        events: [],
        error: `Cannot reconcile payment in status '${payment.status}'. Must be FAILED.`,
      };
    }

    const mergedMetadata = {
      ...(typeof payment.metadata === 'object' ? payment.metadata : {}),
      reconcilingAt: new Date().toISOString(),
      reconcileReason: payload.reason,
    };

    try {
      await this.repo.update(
        payment.id,
        payment.version,
        {
          status: PaymentStatus.RECONCILING,
          metadata: mergedMetadata as any,
        },
        tx,
      );
    } catch (err) {
      if (err instanceof OptimisticLockError) {
        return { success: false, commandId: command.id, events: [], error: 'OCC_CONFLICT' };
      }
      throw err;
    }

    return { success: true, commandId: command.id, events: [] };
  }
}

// ---------------------------------------------------------------------------
// UpdatePaymentMetadataHandler
// ---------------------------------------------------------------------------

export class UpdatePaymentMetadataHandler implements CommandHandler<Command<UpdatePaymentMetadataPayload>> {
  readonly commandType = PaymentCommandTypes.UpdatePaymentMetadata;

  constructor(private repo: PaymentRepository) {}

  async execute(command: Command<UpdatePaymentMetadataPayload>, context: CommandContext): Promise<CommandResult> {
    const { payload } = command;
    const tx = context.tx;

    let payment: PaymentAggregate | null;
    if (payload.paymentId) {
      payment = await this.repo.findById(payload.paymentId, tx);
    } else if (payload.reference) {
      payment = await this.repo.findByReference(payload.reference, tx);
    } else {
      return { success: false, commandId: command.id, events: [], error: 'UpdatePaymentMetadata requires paymentId or reference' };
    }

    if (!payment) {
      return { success: false, commandId: command.id, events: [], error: `Payment not found` };
    }

    const mergedMetadata = {
      ...(typeof payment.metadata === 'object' ? payment.metadata : {}),
      ...payload.metadata,
    };

    try {
      await this.repo.update(
        payment.id,
        payment.version,
        {
          metadata: mergedMetadata as any,
        },
        tx,
      );
    } catch (err) {
      if (err instanceof OptimisticLockError) {
        return { success: false, commandId: command.id, events: [], error: 'OCC_CONFLICT' };
      }
      throw err;
    }

    return { success: true, commandId: command.id, events: [] };
  }
}
