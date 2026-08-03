/**
 * Trading Command Handlers
 * 
 * These handlers implement the business logic for the Trade aggregate.
 * Each handler:
 *   1. Loads the aggregate from the repository
 *   2. Validates state machine transitions and invariants
 *   3. Performs the OCC-protected mutation via the repository
 *   4. Returns the CommandResult with event IDs
 * 
 * The handler does NOT know about SQL, Redis, or the outbox.
 * It depends only on the Repository and StateMachine abstractions.
 */

import { v4 as uuid } from 'uuid';
import type { CommandHandler, CommandResult, CommandContext } from '../commands/CommandBus';
import { OrderRepository, OptimisticLockError } from './OrderRepository';
import type {  OrderStatusType } from './OrderStateMachine';
import {
  OrderStatus,
  validateOrderTransition,
  validateFillAmount,
  validateFillPriceImmutability,
  validateCancellationAllowed,
} from './OrderStateMachine';
import type {
  CreateOrderCommand,
  UpdateOrderFillCommand,
  CancelOrderCommand,
  ExpireOrderCommand,
} from './TradingCommands';
import { TradingCommandTypes } from './TradingCommands';
import type { DomainEvent } from '../events/DomainEvent';
import { EventCatalog } from '../events/catalog';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildEvent(
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
    aggregateType: 'Order',
    aggregateId,
    correlationId,
    causationId,
    actor,
    timestamp: new Date(),
    payload,
    metadata: {
      source: 'trading-command-handler',
      environment: process.env.NODE_ENV ?? 'development',
      schemaVersion: 1,
    },
  };
}

// ---------------------------------------------------------------------------
// CreateOrderHandler
// ---------------------------------------------------------------------------

export class CreateOrderHandler implements CommandHandler<CreateOrderCommand> {
  readonly commandType = TradingCommandTypes.CreateOrder;

  constructor(private repo: OrderRepository) {}

  async execute(command: CreateOrderCommand, context: CommandContext): Promise<CommandResult> {
    const { payload } = command;

    const order = await this.repo.create({
      userId: payload.userId,
      exchange: payload.exchange,
      orderId: payload.exchangeOrderId,
      symbol: payload.symbol,
      side: payload.side,
      amount: payload.amount,
      price: payload.price,
      status: OrderStatus.CREATED,
      expiresAt: new Date(payload.expiresAt),
    }, context.tx);

    const event = buildEvent(
      EventCatalog.OrderCreated,
      order.id,
      command.actor,
      command.correlationId,
      command.id,
      {
        orderId: order.id,
        exchange: order.exchange,
        symbol: order.symbol,
        side: order.side,
        amount: order.amount,
        price: order.price,
      },
    );

    return {
      success: true,
      commandId: command.id,
      events: [event],
    };
  }
}

// ---------------------------------------------------------------------------
// UpdateOrderFillHandler
// ---------------------------------------------------------------------------

export class UpdateOrderFillHandler implements CommandHandler<UpdateOrderFillCommand> {
  readonly commandType = TradingCommandTypes.UpdateOrderFill;

  constructor(private repo: OrderRepository) {}

  async execute(command: UpdateOrderFillCommand, context: CommandContext): Promise<CommandResult> {
    const { payload } = command;

    const order = await this.repo.findById(payload.orderId, context.tx);
    if (!order) {
      return {
        success: false,
        commandId: command.id,
        events: [],
        error: `Order not found: ${payload.orderId}`,
      };
    }

    // Determine target status
    const targetStatus: OrderStatusType = payload.isFinalFill
      ? OrderStatus.FILLED
      : OrderStatus.PARTIALLY_FILLED;

    // Validate state transition
    validateOrderTransition(order.status, targetStatus, order.id);

    // Validate invariants
    validateFillAmount(order.id, order.amount, payload.filledAmount);
    validateFillPriceImmutability(
      order.id,
      order.status,
      order.filledPrice,
      payload.filledPrice,
    );

    try {
      const updated = await this.repo.update(order.id, order.version, {
        status: targetStatus,
        filledAmount: payload.filledAmount,
        filledPrice: payload.filledPrice,
        fee: payload.fee,
        filledAt: payload.isFinalFill ? new Date() : undefined,
      }, context.tx);

      const eventType = payload.isFinalFill
        ? EventCatalog.OrderFilled
        : EventCatalog.OrderPartiallyFilled;

      const event = buildEvent(
        eventType,
        updated.id,
        command.actor,
        command.correlationId,
        command.id,
        {
          orderId: updated.id,
          filledAmount: updated.filledAmount,
          filledPrice: updated.filledPrice,
          fee: updated.fee,
          status: updated.status,
        },
      );

      return {
        success: true,
        commandId: command.id,
        events: [event],
      };
    } catch (err) {
      if (err instanceof OptimisticLockError) {
        return {
          success: false,
          commandId: command.id,
          events: [],
          error: `OCC_CONFLICT: ${err.message}`,
        };
      }
      throw err;
    }
  }
}

// ---------------------------------------------------------------------------
// CancelOrderHandler
// ---------------------------------------------------------------------------

export class CancelOrderHandler implements CommandHandler<CancelOrderCommand> {
  readonly commandType = TradingCommandTypes.CancelOrder;

  constructor(private repo: OrderRepository) {}

  async execute(command: CancelOrderCommand, context: CommandContext): Promise<CommandResult> {
    const { payload } = command;

    const order = await this.repo.findById(payload.orderId, context.tx);
    if (!order) {
      return {
        success: false,
        commandId: command.id,
        events: [],
        error: `Order not found: ${payload.orderId}`,
      };
    }

    // Validate invariant: cannot cancel a FILLED order
    validateCancellationAllowed(order.id, order.status);

    // Validate state transition to CANCEL_PENDING (or CANCELLED for simple cases)
    const targetStatus = order.status === OrderStatus.CREATED
      ? OrderStatus.CANCELLED // If never submitted, go directly to CANCELLED
      : OrderStatus.CANCEL_PENDING;

    validateOrderTransition(order.status, targetStatus, order.id);

    try {
      const updated = await this.repo.update(order.id, order.version, {
        status: targetStatus,
        canceledAt: new Date(),
      }, context.tx);

      const event = buildEvent(
        EventCatalog.OrderCancelled,
        updated.id,
        command.actor,
        command.correlationId,
        command.id,
        {
          orderId: updated.id,
          previousStatus: order.status,
          reason: payload.reason,
        },
      );

      return {
        success: true,
        commandId: command.id,
        events: [event],
      };
    } catch (err) {
      if (err instanceof OptimisticLockError) {
        return {
          success: false,
          commandId: command.id,
          events: [],
          error: `OCC_CONFLICT: ${err.message}`,
        };
      }
      throw err;
    }
  }
}

// ---------------------------------------------------------------------------
// ExpireOrderHandler
// ---------------------------------------------------------------------------

export class ExpireOrderHandler implements CommandHandler<ExpireOrderCommand> {
  readonly commandType = TradingCommandTypes.ExpireOrder;

  constructor(private repo: OrderRepository) {}

  async execute(command: ExpireOrderCommand, context: CommandContext): Promise<CommandResult> {
    const { payload } = command;

    const order = await this.repo.findById(payload.orderId, context.tx);
    if (!order) {
      return {
        success: false,
        commandId: command.id,
        events: [],
        error: `Order not found: ${payload.orderId}`,
      };
    }

    validateOrderTransition(order.status, OrderStatus.EXPIRED, order.id);

    try {
      const updated = await this.repo.update(order.id, order.version, {
        status: OrderStatus.EXPIRED,
        canceledAt: new Date(),
      }, context.tx);

      const event = buildEvent(
        EventCatalog.OrderExpired,
        updated.id,
        command.actor,
        command.correlationId,
        command.id,
        {
          orderId: updated.id,
          previousStatus: order.status,
          expiresAt: order.expiresAt.toISOString(),
        },
      );

      return {
        success: true,
        commandId: command.id,
        events: [event],
      };
    } catch (err) {
      if (err instanceof OptimisticLockError) {
        return {
          success: false,
          commandId: command.id,
          events: [],
          error: `OCC_CONFLICT: ${err.message}`,
        };
      }
      throw err;
    }
  }
}
