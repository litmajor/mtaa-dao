/**
 * Trading Domain Tests — Sprint 1
 *
 * Tests the Order State Machine (pure domain logic) and Command Handlers.
 * The state machine tests require zero mocking. Handler tests mock the repository.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  OrderStatus,
  OrderStatusType,
  validateOrderTransition,
  validateFillAmount,
  validateFillPriceImmutability,
  validateCancellationAllowed,
  isTerminalOrderStatus,
  getValidTransitions,
  OrderStateTransitionError,
  OrderInvariantViolationError,
} from '../../domain/trading/OrderStateMachine';
import {
  CreateOrderHandler,
  UpdateOrderFillHandler,
  CancelOrderHandler,
  ExpireOrderHandler,
} from '../../domain/trading/TradingHandlers';
import { OrderRepository, OptimisticLockError, OrderAggregate } from '../../domain/trading/OrderRepository';
import { TradingCommandTypes } from '../../domain/trading/TradingCommands';
import { Command } from '../../domain/commands/Command';

// ---------------------------------------------------------------------------
// Test Helpers
// ---------------------------------------------------------------------------

function makeOrder(overrides: Partial<OrderAggregate> = {}): OrderAggregate {
  return {
    id: 'order-1',
    userId: 'user-1',
    exchange: 'binance',
    orderId: 'binance-order-123',
    symbol: 'BTC/USDT',
    side: 'buy' as const,
    amount: 1.0,
    price: 50000,
    status: OrderStatus.CREATED,
    filledAmount: 0,
    filledPrice: undefined,
    fee: 0,
    version: 1,
    createdAt: new Date(),
    expiresAt: new Date(Date.now() + 86400000),
    filledAt: undefined,
    canceledAt: undefined,
    lastCheckedAt: undefined,
    ...overrides,
  };
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

describe('OrderStateMachine', () => {
  describe('validateOrderTransition', () => {
    // --- Happy path transitions ---
    const validTransitions: Array<[OrderStatusType, OrderStatusType]> = [
      [OrderStatus.CREATED, OrderStatus.RISK_APPROVED],
      [OrderStatus.CREATED, OrderStatus.CANCELLED],
      [OrderStatus.CREATED, OrderStatus.EXPIRED],
      [OrderStatus.RISK_APPROVED, OrderStatus.EXECUTING],
      [OrderStatus.RISK_APPROVED, OrderStatus.REJECTED],
      [OrderStatus.EXECUTING, OrderStatus.SUBMITTED],
      [OrderStatus.EXECUTING, OrderStatus.REJECTED],
      [OrderStatus.EXECUTING, OrderStatus.UNKNOWN],
      [OrderStatus.SUBMITTED, OrderStatus.ACCEPTED],
      [OrderStatus.SUBMITTED, OrderStatus.REJECTED],
      [OrderStatus.SUBMITTED, OrderStatus.UNKNOWN],
      [OrderStatus.SUBMITTED, OrderStatus.EXPIRED],
      [OrderStatus.ACCEPTED, OrderStatus.PARTIALLY_FILLED],
      [OrderStatus.ACCEPTED, OrderStatus.FILLED],
      [OrderStatus.ACCEPTED, OrderStatus.CANCEL_PENDING],
      [OrderStatus.ACCEPTED, OrderStatus.UNKNOWN],
      [OrderStatus.ACCEPTED, OrderStatus.EXPIRED],
      [OrderStatus.PARTIALLY_FILLED, OrderStatus.PARTIALLY_FILLED],
      [OrderStatus.PARTIALLY_FILLED, OrderStatus.FILLED],
      [OrderStatus.PARTIALLY_FILLED, OrderStatus.CANCEL_PENDING],
      [OrderStatus.PARTIALLY_FILLED, OrderStatus.UNKNOWN],
      [OrderStatus.CANCEL_PENDING, OrderStatus.CANCELLED],
      [OrderStatus.CANCEL_PENDING, OrderStatus.FILLED],
      [OrderStatus.CANCEL_PENDING, OrderStatus.UNKNOWN],
      [OrderStatus.UNKNOWN, OrderStatus.RECONCILING],
      [OrderStatus.UNKNOWN, OrderStatus.FILLED],
      [OrderStatus.UNKNOWN, OrderStatus.CANCELLED],
      [OrderStatus.UNKNOWN, OrderStatus.EXPIRED],
      [OrderStatus.RECONCILING, OrderStatus.FILLED],
      [OrderStatus.RECONCILING, OrderStatus.CANCELLED],
      [OrderStatus.RECONCILING, OrderStatus.EXPIRED],
      [OrderStatus.RECONCILING, OrderStatus.UNKNOWN],
    ];

    it.each(validTransitions)(
      'allows transition %s → %s',
      (from, to) => {
        expect(() => validateOrderTransition(from, to, 'test-order')).not.toThrow();
      },
    );

    // --- Forbidden transitions from terminal states ---
    const terminalStates: OrderStatusType[] = [
      OrderStatus.FILLED,
      OrderStatus.REJECTED,
      OrderStatus.CANCELLED,
      OrderStatus.EXPIRED,
    ];

    const nonTerminalStates: OrderStatusType[] = [
      OrderStatus.CREATED,
      OrderStatus.EXECUTING,
      OrderStatus.SUBMITTED,
    ];

    it.each(terminalStates)(
      'blocks all transitions from terminal state %s',
      (terminalState) => {
        for (const target of nonTerminalStates) {
          expect(() => validateOrderTransition(terminalState, target, 'test-order')).toThrow(
            OrderStateTransitionError,
          );
        }
      },
    );

    it('prevents FILLED → EXECUTING', () => {
      expect(() =>
        validateOrderTransition(OrderStatus.FILLED, OrderStatus.EXECUTING, 'test-order'),
      ).toThrow(OrderStateTransitionError);
    });

    it('prevents CANCELLED → EXECUTING', () => {
      expect(() =>
        validateOrderTransition(OrderStatus.CANCELLED, OrderStatus.EXECUTING, 'test-order'),
      ).toThrow(OrderStateTransitionError);
    });

    it('prevents FILLED → CREATED', () => {
      expect(() =>
        validateOrderTransition(OrderStatus.FILLED, OrderStatus.CREATED, 'test-order'),
      ).toThrow(OrderStateTransitionError);
    });
  });

  describe('isTerminalOrderStatus', () => {
    it('identifies terminal states', () => {
      expect(isTerminalOrderStatus(OrderStatus.FILLED)).toBe(true);
      expect(isTerminalOrderStatus(OrderStatus.REJECTED)).toBe(true);
      expect(isTerminalOrderStatus(OrderStatus.CANCELLED)).toBe(true);
      expect(isTerminalOrderStatus(OrderStatus.EXPIRED)).toBe(true);
    });

    it('identifies non-terminal states', () => {
      expect(isTerminalOrderStatus(OrderStatus.CREATED)).toBe(false);
      expect(isTerminalOrderStatus(OrderStatus.EXECUTING)).toBe(false);
      expect(isTerminalOrderStatus(OrderStatus.PARTIALLY_FILLED)).toBe(false);
      expect(isTerminalOrderStatus(OrderStatus.UNKNOWN)).toBe(false);
    });
  });

  describe('getValidTransitions', () => {
    it('returns valid next states for CREATED', () => {
      const transitions = getValidTransitions(OrderStatus.CREATED);
      expect(transitions).toContain(OrderStatus.RISK_APPROVED);
      expect(transitions).toContain(OrderStatus.CANCELLED);
      expect(transitions).not.toContain(OrderStatus.FILLED);
    });

    it('returns empty array for terminal states', () => {
      expect(getValidTransitions(OrderStatus.FILLED)).toEqual([]);
      expect(getValidTransitions(OrderStatus.REJECTED)).toEqual([]);
    });
  });

  // -------------------------------------------------------------------------
  // Aggregate Invariants
  // -------------------------------------------------------------------------

  describe('validateFillAmount', () => {
    it('allows fill within bounds', () => {
      expect(() => validateFillAmount('o-1', 1.0, 0.5)).not.toThrow();
      expect(() => validateFillAmount('o-1', 1.0, 1.0)).not.toThrow();
    });

    it('rejects overfill', () => {
      expect(() => validateFillAmount('o-1', 1.0, 1.001)).toThrow(OrderInvariantViolationError);
    });

    it('rejects negative fill', () => {
      expect(() => validateFillAmount('o-1', 1.0, -0.1)).toThrow(OrderInvariantViolationError);
    });
  });

  describe('validateFillPriceImmutability', () => {
    it('allows price update on non-FILLED orders', () => {
      expect(() =>
        validateFillPriceImmutability('o-1', OrderStatus.PARTIALLY_FILLED, 50000, 50100),
      ).not.toThrow();
    });

    it('rejects price change on FILLED order', () => {
      expect(() =>
        validateFillPriceImmutability('o-1', OrderStatus.FILLED, 50000, 50100),
      ).toThrow(OrderInvariantViolationError);
    });

    it('allows same price on FILLED order', () => {
      expect(() =>
        validateFillPriceImmutability('o-1', OrderStatus.FILLED, 50000, 50000),
      ).not.toThrow();
    });
  });

  describe('validateCancellationAllowed', () => {
    it('allows cancellation of non-filled orders', () => {
      expect(() => validateCancellationAllowed('o-1', OrderStatus.CREATED)).not.toThrow();
      expect(() => validateCancellationAllowed('o-1', OrderStatus.ACCEPTED)).not.toThrow();
    });

    it('rejects cancellation of FILLED order', () => {
      expect(() => validateCancellationAllowed('o-1', OrderStatus.FILLED)).toThrow(
        OrderInvariantViolationError,
      );
    });
  });
});

// ===========================================================================
// Command Handler Tests
// ===========================================================================

describe('Trading Command Handlers', () => {
  let mockRepo: {
    create: ReturnType<typeof vi.fn>;
    findById: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    findByStatus: ReturnType<typeof vi.fn>;
    findByUser: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    mockRepo = {
      create: vi.fn(),
      findById: vi.fn(),
      update: vi.fn(),
      findByStatus: vi.fn(),
      findByUser: vi.fn(),
    };
  });

  describe('CreateOrderHandler', () => {
    it('creates an order and returns success with event ID', async () => {
      const handler = new CreateOrderHandler(mockRepo as unknown as OrderRepository);
      const newOrder = makeOrder();
      mockRepo.create.mockResolvedValue(newOrder);

      const command = makeCommand(TradingCommandTypes.CreateOrder, {
        userId: 'user-1',
        exchange: 'binance',
        exchangeOrderId: 'binance-order-123',
        symbol: 'BTC/USDT',
        side: 'buy' as const,
        amount: 1.0,
        price: 50000,
        expiresAt: new Date(Date.now() + 86400000).toISOString(),
      });

      const result = await handler.execute(command, { tx: {} });

      expect(result.success).toBe(true);
      expect(result.events).toHaveLength(1);
      expect(mockRepo.create).toHaveBeenCalledOnce();
    });
  });

  describe('UpdateOrderFillHandler', () => {
    it('processes a partial fill', async () => {
      const handler = new UpdateOrderFillHandler(mockRepo as unknown as OrderRepository);
      const order = makeOrder({ status: OrderStatus.ACCEPTED });
      mockRepo.findById.mockResolvedValue(order);
      mockRepo.update.mockResolvedValue({ ...order, status: OrderStatus.PARTIALLY_FILLED, filledAmount: 0.5 });

      const command = makeCommand(TradingCommandTypes.UpdateOrderFill, {
        orderId: 'order-1',
        filledAmount: 0.5,
        filledPrice: 50100,
        fee: 0.001,
        isFinalFill: false,
      });

      const result = await handler.execute(command, { tx: {} });

      expect(result.success).toBe(true);
      expect(result.events).toHaveLength(1);
    });

    it('processes a final fill', async () => {
      const handler = new UpdateOrderFillHandler(mockRepo as unknown as OrderRepository);
      const order = makeOrder({ status: OrderStatus.PARTIALLY_FILLED, filledAmount: 0.5 });
      mockRepo.findById.mockResolvedValue(order);
      mockRepo.update.mockResolvedValue({ ...order, status: OrderStatus.FILLED, filledAmount: 1.0 });

      const command = makeCommand(TradingCommandTypes.UpdateOrderFill, {
        orderId: 'order-1',
        filledAmount: 1.0,
        filledPrice: 50100,
        fee: 0.002,
        isFinalFill: true,
      });

      const result = await handler.execute(command, { tx: {} });

      expect(result.success).toBe(true);
      expect(result.events).toHaveLength(1);
    });

    it('rejects overfill', async () => {
      const handler = new UpdateOrderFillHandler(mockRepo as unknown as OrderRepository);
      const order = makeOrder({ status: OrderStatus.ACCEPTED, amount: 1.0 });
      mockRepo.findById.mockResolvedValue(order);

      const command = makeCommand(TradingCommandTypes.UpdateOrderFill, {
        orderId: 'order-1',
        filledAmount: 1.5,
        filledPrice: 50100,
        fee: 0.001,
        isFinalFill: false,
      });

      await expect(handler.execute(command, { tx: {} })).rejects.toThrow(OrderInvariantViolationError);
    });

    it('rejects fill on a FILLED order', async () => {
      const handler = new UpdateOrderFillHandler(mockRepo as unknown as OrderRepository);
      const order = makeOrder({ status: OrderStatus.FILLED, filledAmount: 1.0 });
      mockRepo.findById.mockResolvedValue(order);

      const command = makeCommand(TradingCommandTypes.UpdateOrderFill, {
        orderId: 'order-1',
        filledAmount: 1.0,
        filledPrice: 50100,
        fee: 0.001,
        isFinalFill: false,
      });

      expect(() => {
        validateOrderTransition(OrderStatus.FILLED, OrderStatus.PARTIALLY_FILLED, 'order-1');
      }).toThrow(OrderStateTransitionError);
    });

    it('returns OCC_CONFLICT on version mismatch', async () => {
      const handler = new UpdateOrderFillHandler(mockRepo as unknown as OrderRepository);
      const order = makeOrder({ status: OrderStatus.ACCEPTED });
      mockRepo.findById.mockResolvedValue(order);
      mockRepo.update.mockRejectedValue(new OptimisticLockError('order-1', 1));

      const command = makeCommand(TradingCommandTypes.UpdateOrderFill, {
        orderId: 'order-1',
        filledAmount: 0.5,
        filledPrice: 50100,
        fee: 0.001,
        isFinalFill: false,
      });

      const result = await handler.execute(command, { tx: {} });

      expect(result.success).toBe(false);
      expect(result.error).toContain('OCC_CONFLICT');
    });

    it('returns error for non-existent order', async () => {
      const handler = new UpdateOrderFillHandler(mockRepo as unknown as OrderRepository);
      mockRepo.findById.mockResolvedValue(null);

      const command = makeCommand(TradingCommandTypes.UpdateOrderFill, {
        orderId: 'non-existent',
        filledAmount: 0.5,
        filledPrice: 50100,
        fee: 0.001,
        isFinalFill: false,
      });

      const result = await handler.execute(command, { tx: {} });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Order not found');
    });
  });

  describe('CancelOrderHandler', () => {
    it('cancels a CREATED order directly', async () => {
      const handler = new CancelOrderHandler(mockRepo as unknown as OrderRepository);
      const order = makeOrder({ status: OrderStatus.CREATED });
      mockRepo.findById.mockResolvedValue(order);
      mockRepo.update.mockResolvedValue({ ...order, status: OrderStatus.CANCELLED });

      const command = makeCommand(TradingCommandTypes.CancelOrder, {
        orderId: 'order-1',
        reason: 'user request',
      });

      const result = await handler.execute(command, { tx: {} });

      expect(result.success).toBe(true);
      expect(mockRepo.update).toHaveBeenCalledWith(
        'order-1',
        1,
        expect.objectContaining({ status: OrderStatus.CANCELLED }),
        {}
      );
    });

    it('sets CANCEL_PENDING for an ACCEPTED order', async () => {
      const handler = new CancelOrderHandler(mockRepo as unknown as OrderRepository);
      const order = makeOrder({ status: OrderStatus.ACCEPTED });
      mockRepo.findById.mockResolvedValue(order);
      mockRepo.update.mockResolvedValue({ ...order, status: OrderStatus.CANCEL_PENDING });

      const command = makeCommand(TradingCommandTypes.CancelOrder, {
        orderId: 'order-1',
      });

      const result = await handler.execute(command, { tx: {} });

      expect(result.success).toBe(true);
      expect(mockRepo.update).toHaveBeenCalledWith(
        'order-1',
        1,
        expect.objectContaining({ status: OrderStatus.CANCEL_PENDING }),
        {}
      );
    });

    it('rejects cancellation of a FILLED order', async () => {
      const handler = new CancelOrderHandler(mockRepo as unknown as OrderRepository);
      const order = makeOrder({ status: OrderStatus.FILLED });
      mockRepo.findById.mockResolvedValue(order);

      const command = makeCommand(TradingCommandTypes.CancelOrder, {
        orderId: 'order-1',
      });

      await expect(handler.execute(command, { tx: {} })).rejects.toThrow(OrderInvariantViolationError);
    });
  });

  describe('ExpireOrderHandler', () => {
    it('expires a SUBMITTED order', async () => {
      const handler = new ExpireOrderHandler(mockRepo as unknown as OrderRepository);
      const order = makeOrder({ status: OrderStatus.SUBMITTED });
      mockRepo.findById.mockResolvedValue(order);
      mockRepo.update.mockResolvedValue({ ...order, status: OrderStatus.EXPIRED });

      const command = makeCommand(TradingCommandTypes.ExpireOrder, {
        orderId: 'order-1',
      });

      const result = await handler.execute(command, { tx: {} });

      expect(result.success).toBe(true);
    });

    it('rejects expiration of a FILLED order', async () => {
      const handler = new ExpireOrderHandler(mockRepo as unknown as OrderRepository);
      const order = makeOrder({ status: OrderStatus.FILLED });
      mockRepo.findById.mockResolvedValue(order);

      const command = makeCommand(TradingCommandTypes.ExpireOrder, {
        orderId: 'order-1',
      });

      await expect(handler.execute(command, { tx: {} })).rejects.toThrow(OrderStateTransitionError);
    });
  });
});
