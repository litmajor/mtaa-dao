/**
 * Trading Domain — Barrel Export
 * 
 * All trading domain contracts, state machines, repository, and handlers
 * are re-exported from this single entry point.
 */

export {
  OrderStatus,
  type OrderStatusType,
  validateOrderTransition,
  validateFillAmount,
  validateFillPriceImmutability,
  validateCancellationAllowed,
  isTerminalOrderStatus,
  getValidTransitions,
  OrderStateTransitionError,
  OrderInvariantViolationError,
} from './OrderStateMachine';

export {
  OrderRepository,
  OptimisticLockError,
  type OrderAggregate,
  type CreateOrderInput,
  type UpdateOrderFields,
} from './OrderRepository';

export {
  TradingCommandTypes,
  type CreateOrderPayload,
  type UpdateOrderFillPayload,
  type CancelOrderPayload,
  type ExpireOrderPayload,
  type TransitionOrderStatusPayload,
  type CreateOrderCommand,
  type UpdateOrderFillCommand,
  type CancelOrderCommand,
  type ExpireOrderCommand,
  type TransitionOrderStatusCommand,
} from './TradingCommands';

export {
  CreateOrderHandler,
  UpdateOrderFillHandler,
  CancelOrderHandler,
  ExpireOrderHandler,
} from './TradingHandlers';
