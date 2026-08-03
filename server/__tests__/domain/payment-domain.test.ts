/**
 * Payment Domain Tests — Sprint 2
 *
 * Tests the Payment State Machine (pure domain logic) and Command Handlers.
 * State machine tests require zero mocking.
 * Handler tests mock the repository and database transaction.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  PaymentStatus,
  PaymentStatusType,
  validatePaymentTransition,
  isTerminalPaymentStatus,
  getValidPaymentTransitions,
  validatePaymentAmount,
  validateAmountImmutability,
  PaymentStateTransitionError,
  PaymentInvariantViolationError,
} from '../../domain/payments/PaymentStateMachine';
import {
  CreatePaymentHandler,
  ReceiveWebhookHandler,
  CompletePaymentHandler,
  FailPaymentHandler,
  ReconcilePaymentHandler,
} from '../../domain/payments/PaymentHandlers';
import { PaymentRepository, OptimisticLockError, PaymentAggregate } from '../../domain/payments/PaymentRepository';
import { PaymentCommandTypes } from '../../domain/payments/PaymentCommands';
import { Command } from '../../domain/commands/Command';

// ---------------------------------------------------------------------------
// Test Helpers
// ---------------------------------------------------------------------------

function makePayment(overrides: Partial<PaymentAggregate> = {}): PaymentAggregate {
  return {
    id: 'pay-1',
    userId: 'user-1',
    reference: 'REF-123',
    type: 'deposit',
    amount: '1000',
    currency: 'KES',
    provider: 'mpesa',
    status: PaymentStatus.CREATED,
    metadata: {},
    version: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as PaymentAggregate;
}

function makeCommand<T>(type: string, payload: T): Command<T> {
  return {
    id: 'cmd-1',
    type,
    actor: 'test-actor',
    correlationId: 'corr-1',
    timestamp: new Date(),
    payload,
  };
}

// ===========================================================================
// State Machine Tests
// ===========================================================================

describe('PaymentStateMachine', () => {
  describe('validatePaymentTransition', () => {
    // --- Happy path transitions ---
    const validTransitions: Array<[PaymentStatusType, PaymentStatusType]> = [
      [PaymentStatus.CREATED, PaymentStatus.PROVIDER_ACCEPTED],
      [PaymentStatus.CREATED, PaymentStatus.FAILED],
      [PaymentStatus.PROVIDER_ACCEPTED, PaymentStatus.PENDING],
      [PaymentStatus.PROVIDER_ACCEPTED, PaymentStatus.FAILED],
      [PaymentStatus.PENDING, PaymentStatus.WEBHOOK_RECEIVED],
      [PaymentStatus.PENDING, PaymentStatus.FAILED],
      [PaymentStatus.WEBHOOK_RECEIVED, PaymentStatus.VERIFIED],
      [PaymentStatus.WEBHOOK_RECEIVED, PaymentStatus.FAILED],
      [PaymentStatus.VERIFIED, PaymentStatus.SETTLING],
      [PaymentStatus.VERIFIED, PaymentStatus.FAILED],
      [PaymentStatus.SETTLING, PaymentStatus.COMPLETED],
      [PaymentStatus.SETTLING, PaymentStatus.FAILED],
      [PaymentStatus.FAILED, PaymentStatus.RECONCILING],
      [PaymentStatus.RECONCILING, PaymentStatus.VERIFIED],
      [PaymentStatus.RECONCILING, PaymentStatus.FAILED],
    ];

    it.each(validTransitions)(
      'allows transition %s → %s',
      (from, to) => {
        expect(() => validatePaymentTransition(from, to, 'test-pay')).not.toThrow();
      },
    );

    // --- Forbidden transitions ---
    it('blocks COMPLETED → any', () => {
      const targets: PaymentStatusType[] = [
        PaymentStatus.CREATED,
        PaymentStatus.PENDING,
        PaymentStatus.FAILED,
        PaymentStatus.RECONCILING,
      ];
      for (const target of targets) {
        expect(() => validatePaymentTransition(PaymentStatus.COMPLETED, target, 'test-pay')).toThrow(
          PaymentStateTransitionError,
        );
      }
    });

    it('blocks CREATED → COMPLETED (skipping intermediate states)', () => {
      expect(() =>
        validatePaymentTransition(PaymentStatus.CREATED, PaymentStatus.COMPLETED, 'test-pay'),
      ).toThrow(PaymentStateTransitionError);
    });

    it('blocks FAILED → COMPLETED directly', () => {
      expect(() =>
        validatePaymentTransition(PaymentStatus.FAILED, PaymentStatus.COMPLETED, 'test-pay'),
      ).toThrow(PaymentStateTransitionError);
    });

    it('blocks PENDING → COMPLETED (must go through WEBHOOK_RECEIVED)', () => {
      expect(() =>
        validatePaymentTransition(PaymentStatus.PENDING, PaymentStatus.COMPLETED, 'test-pay'),
      ).toThrow(PaymentStateTransitionError);
    });
  });

  describe('isTerminalPaymentStatus', () => {
    it('identifies COMPLETED as terminal', () => {
      expect(isTerminalPaymentStatus(PaymentStatus.COMPLETED)).toBe(true);
    });

    it('identifies FAILED as non-terminal (can reconcile)', () => {
      expect(isTerminalPaymentStatus(PaymentStatus.FAILED)).toBe(false);
    });

    it('identifies intermediate states as non-terminal', () => {
      expect(isTerminalPaymentStatus(PaymentStatus.CREATED)).toBe(false);
      expect(isTerminalPaymentStatus(PaymentStatus.PENDING)).toBe(false);
      expect(isTerminalPaymentStatus(PaymentStatus.SETTLING)).toBe(false);
      expect(isTerminalPaymentStatus(PaymentStatus.RECONCILING)).toBe(false);
    });
  });

  describe('getValidPaymentTransitions', () => {
    it('returns valid next states for CREATED', () => {
      const transitions = getValidPaymentTransitions(PaymentStatus.CREATED);
      expect(transitions).toContain(PaymentStatus.PROVIDER_ACCEPTED);
      expect(transitions).toContain(PaymentStatus.FAILED);
      expect(transitions).not.toContain(PaymentStatus.COMPLETED);
    });

    it('returns empty array for COMPLETED (terminal)', () => {
      expect(getValidPaymentTransitions(PaymentStatus.COMPLETED)).toEqual([]);
    });

    it('allows FAILED → RECONCILING', () => {
      const transitions = getValidPaymentTransitions(PaymentStatus.FAILED);
      expect(transitions).toContain(PaymentStatus.RECONCILING);
    });
  });

  describe('validatePaymentAmount', () => {
    it('allows positive amounts', () => {
      expect(() => validatePaymentAmount('p-1', '100.50')).not.toThrow();
    });

    it('rejects zero', () => {
      expect(() => validatePaymentAmount('p-1', '0')).toThrow(PaymentInvariantViolationError);
    });

    it('rejects negative', () => {
      expect(() => validatePaymentAmount('p-1', '-50')).toThrow(PaymentInvariantViolationError);
    });

    it('rejects non-numeric', () => {
      expect(() => validatePaymentAmount('p-1', 'abc')).toThrow(PaymentInvariantViolationError);
    });
  });

  describe('validateAmountImmutability', () => {
    it('allows amount change on non-COMPLETED payment', () => {
      expect(() => validateAmountImmutability('p-1', PaymentStatus.PENDING, '100', '200')).not.toThrow();
    });

    it('rejects amount change on COMPLETED payment', () => {
      expect(() => validateAmountImmutability('p-1', PaymentStatus.COMPLETED, '100', '200')).toThrow(
        PaymentInvariantViolationError,
      );
    });

    it('allows same amount on COMPLETED payment', () => {
      expect(() => validateAmountImmutability('p-1', PaymentStatus.COMPLETED, '100', '100')).not.toThrow();
    });
  });
});

// ===========================================================================
// Command Handler Tests
// ===========================================================================

describe('Payment Command Handlers', () => {
  let mockRepo: {
    findById: ReturnType<typeof vi.fn>;
    findByReference: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };

  let mockTx: {
    insert: ReturnType<typeof vi.fn>;
    execute: ReturnType<typeof vi.fn>;
  };

  let context: { tx: any };

  beforeEach(() => {
    mockRepo = {
      findById: vi.fn(),
      findByReference: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    };

    // Mock the tx for CompletePaymentHandler
    const insertChain = {
      values: vi.fn().mockResolvedValue(undefined),
    };
    mockTx = {
      insert: vi.fn().mockReturnValue(insertChain),
      execute: vi.fn().mockResolvedValue({
        rows: [{ id: 'user-1', balance: '500' }],
      }),
    };

    context = { tx: mockTx };
  });

  // -------------------------------------------------------------------------
  // CreatePaymentHandler
  // -------------------------------------------------------------------------
  describe('CreatePaymentHandler', () => {
    it('creates a payment and returns PaymentInitiated event', async () => {
      const handler = new CreatePaymentHandler(mockRepo as unknown as PaymentRepository);
      const newPayment = makePayment();
      mockRepo.create.mockResolvedValue(newPayment);

      const command = makeCommand(PaymentCommandTypes.CreatePayment, {
        userId: 'user-1',
        reference: 'REF-123',
        type: 'deposit',
        amount: '1000',
        currency: 'KES',
        provider: 'mpesa',
      });

      const result = await handler.execute(command, context);

      expect(result.success).toBe(true);
      expect(result.events).toHaveLength(1);
      expect(result.events![0].type).toBe('PaymentInitiated');
      expect(mockRepo.create).toHaveBeenCalledOnce();
    });
  });

  // -------------------------------------------------------------------------
  // ReceiveWebhookHandler
  // -------------------------------------------------------------------------
  describe('ReceiveWebhookHandler', () => {
    it('transitions payment to WEBHOOK_RECEIVED', async () => {
      const handler = new ReceiveWebhookHandler(mockRepo as unknown as PaymentRepository);
      const payment = makePayment({ status: PaymentStatus.PENDING });
      mockRepo.findByReference.mockResolvedValue(payment);
      mockRepo.update.mockResolvedValue({ ...payment, status: PaymentStatus.WEBHOOK_RECEIVED });

      const command = makeCommand(PaymentCommandTypes.ReceiveWebhook, {
        reference: 'REF-123',
        providerData: { mpesaReceipt: 'ABC123' },
      });

      const result = await handler.execute(command, context);

      expect(result.success).toBe(true);
      expect(result.events).toHaveLength(1);
      expect(result.events![0].type).toBe('PaymentWebhookReceived');
    });

    it('is idempotent for already-completed payments', async () => {
      const handler = new ReceiveWebhookHandler(mockRepo as unknown as PaymentRepository);
      const payment = makePayment({ status: PaymentStatus.COMPLETED });
      mockRepo.findByReference.mockResolvedValue(payment);

      const command = makeCommand(PaymentCommandTypes.ReceiveWebhook, {
        reference: 'REF-123',
        providerData: {},
      });

      const result = await handler.execute(command, context);

      expect(result.success).toBe(true);
      expect(result.events).toHaveLength(0);
      expect(mockRepo.update).not.toHaveBeenCalled();
    });

    it('returns error for non-existent payment', async () => {
      const handler = new ReceiveWebhookHandler(mockRepo as unknown as PaymentRepository);
      mockRepo.findByReference.mockResolvedValue(null);

      const command = makeCommand(PaymentCommandTypes.ReceiveWebhook, {
        reference: 'NON-EXISTENT',
        providerData: {},
      });

      const result = await handler.execute(command, context);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Payment not found');
    });
  });

  // -------------------------------------------------------------------------
  // CompletePaymentHandler — ACID Accounting Contract
  // -------------------------------------------------------------------------
  describe('CompletePaymentHandler', () => {
    it('executes the full accounting transaction atomically', async () => {
      const handler = new CompletePaymentHandler(mockRepo as unknown as PaymentRepository);
      const payment = makePayment({ status: PaymentStatus.WEBHOOK_RECEIVED });
      mockRepo.findByReference.mockResolvedValue(payment);
      mockRepo.update.mockResolvedValue({ ...payment, status: PaymentStatus.COMPLETED, version: 2 });

      const command = makeCommand(PaymentCommandTypes.CompletePayment, {
        reference: 'REF-123',
        walletAddress: '0xabc',
      });

      const result = await handler.execute(command, context);

      // 1. Success
      expect(result.success).toBe(true);

      // 2. PaymentCompleted event returned
      expect(result.events).toHaveLength(1);
      expect(result.events![0].type).toBe('PaymentCompleted');

      // 3. walletTransactions inserted (ledger entry)
      expect(mockTx.insert).toHaveBeenCalled();

      // 4. users.balance updated (SELECT FOR UPDATE)
      expect(mockTx.execute).toHaveBeenCalled();

      // 5. paymentTransactions updated (OCC)
      expect(mockRepo.update).toHaveBeenCalledWith(
        'pay-1',
        1,
        expect.objectContaining({ status: PaymentStatus.COMPLETED }),
        mockTx,
      );
    });

    it('is idempotent for already-completed payments', async () => {
      const handler = new CompletePaymentHandler(mockRepo as unknown as PaymentRepository);
      const payment = makePayment({ status: PaymentStatus.COMPLETED });
      mockRepo.findByReference.mockResolvedValue(payment);

      const command = makeCommand(PaymentCommandTypes.CompletePayment, {
        reference: 'REF-123',
      });

      const result = await handler.execute(command, context);

      expect(result.success).toBe(true);
      expect(result.events).toHaveLength(0);
      expect(mockTx.insert).not.toHaveBeenCalled();
      expect(mockRepo.update).not.toHaveBeenCalled();
    });

    it('rejects completion from CREATED state', async () => {
      const handler = new CompletePaymentHandler(mockRepo as unknown as PaymentRepository);
      const payment = makePayment({ status: PaymentStatus.CREATED });
      mockRepo.findByReference.mockResolvedValue(payment);

      const command = makeCommand(PaymentCommandTypes.CompletePayment, {
        reference: 'REF-123',
      });

      const result = await handler.execute(command, context);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Cannot complete payment');
    });

    it('returns OCC_CONFLICT on version mismatch', async () => {
      const handler = new CompletePaymentHandler(mockRepo as unknown as PaymentRepository);
      const payment = makePayment({ status: PaymentStatus.WEBHOOK_RECEIVED });
      mockRepo.findByReference.mockResolvedValue(payment);
      mockRepo.update.mockRejectedValue(new OptimisticLockError('pay-1', 1));

      const command = makeCommand(PaymentCommandTypes.CompletePayment, {
        reference: 'REF-123',
      });

      const result = await handler.execute(command, context);

      expect(result.success).toBe(false);
      expect(result.error).toBe('OCC_CONFLICT');
    });
  });

  // -------------------------------------------------------------------------
  // FailPaymentHandler
  // -------------------------------------------------------------------------
  describe('FailPaymentHandler', () => {
    it('fails a PENDING payment', async () => {
      const handler = new FailPaymentHandler(mockRepo as unknown as PaymentRepository);
      const payment = makePayment({ status: PaymentStatus.PENDING });
      mockRepo.findByReference.mockResolvedValue(payment);
      mockRepo.update.mockResolvedValue({ ...payment, status: PaymentStatus.FAILED });

      const command = makeCommand(PaymentCommandTypes.FailPayment, {
        reference: 'REF-123',
        reason: 'User cancelled',
      });

      const result = await handler.execute(command, context);

      expect(result.success).toBe(true);
      expect(result.events).toHaveLength(1);
      expect(result.events![0].type).toBe('PaymentFailed');
    });

    it('rejects failure of a COMPLETED payment', async () => {
      const handler = new FailPaymentHandler(mockRepo as unknown as PaymentRepository);
      const payment = makePayment({ status: PaymentStatus.COMPLETED });
      mockRepo.findByReference.mockResolvedValue(payment);

      const command = makeCommand(PaymentCommandTypes.FailPayment, {
        reference: 'REF-123',
        reason: 'Timeout',
      });

      const result = await handler.execute(command, context);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Cannot fail a COMPLETED payment');
    });

    it('is idempotent for already-failed payments', async () => {
      const handler = new FailPaymentHandler(mockRepo as unknown as PaymentRepository);
      const payment = makePayment({ status: PaymentStatus.FAILED });
      mockRepo.findByReference.mockResolvedValue(payment);

      const command = makeCommand(PaymentCommandTypes.FailPayment, {
        reference: 'REF-123',
        reason: 'Retry',
      });

      const result = await handler.execute(command, context);

      expect(result.success).toBe(true);
      expect(result.events).toHaveLength(0);
    });
  });

  // -------------------------------------------------------------------------
  // ReconcilePaymentHandler
  // -------------------------------------------------------------------------
  describe('ReconcilePaymentHandler', () => {
    it('reconciles a FAILED payment', async () => {
      const handler = new ReconcilePaymentHandler(mockRepo as unknown as PaymentRepository);
      const payment = makePayment({ status: PaymentStatus.FAILED });
      mockRepo.findByReference.mockResolvedValue(payment);
      mockRepo.update.mockResolvedValue({ ...payment, status: PaymentStatus.RECONCILING });

      const command = makeCommand(PaymentCommandTypes.ReconcilePayment, {
        reference: 'REF-123',
        reason: 'Manual review',
      });

      const result = await handler.execute(command, context);

      expect(result.success).toBe(true);
    });

    it('rejects reconciliation of a non-FAILED payment', async () => {
      const handler = new ReconcilePaymentHandler(mockRepo as unknown as PaymentRepository);
      const payment = makePayment({ status: PaymentStatus.PENDING });
      mockRepo.findByReference.mockResolvedValue(payment);

      const command = makeCommand(PaymentCommandTypes.ReconcilePayment, {
        reference: 'REF-123',
        reason: 'Investigate',
      });

      const result = await handler.execute(command, context);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Must be FAILED');
    });
  });
});
