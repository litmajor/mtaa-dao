/**
 * Order State Machine
 * 
 * Pure domain logic defining the allowed state transitions for the Trade aggregate (limitOrders).
 * This is the single source of truth for order lifecycle rules.
 * 
 * State Machine:
 *   CREATED → RISK_APPROVED → EXECUTING → SUBMITTED → ACCEPTED → PARTIALLY_FILLED → FILLED
 * 
 * Terminal states: FILLED, REJECTED, CANCELLED, EXPIRED
 * Limbo states: UNKNOWN, RECONCILING (require saga/manual intervention)
 */

export const OrderStatus = {
  CREATED: 'created',
  RISK_APPROVED: 'risk_approved',
  EXECUTING: 'executing',
  SUBMITTED: 'submitted',
  ACCEPTED: 'accepted',
  PARTIALLY_FILLED: 'partially_filled',
  FILLED: 'filled',

  // Failure / Terminal
  REJECTED: 'rejected',
  CANCEL_PENDING: 'cancel_pending',
  CANCELLED: 'cancelled',
  EXPIRED: 'expired',

  // Limbo (requires reconciliation)
  UNKNOWN: 'unknown',
  RECONCILING: 'reconciling',
} as const;

export type OrderStatusType = typeof OrderStatus[keyof typeof OrderStatus];

/**
 * Allowed state transitions.
 * Every key maps to the set of states it is allowed to transition to.
 * If a status is not listed as a key, it is a terminal state.
 */
const ALLOWED_TRANSITIONS: Record<OrderStatusType, readonly OrderStatusType[]> = {
  [OrderStatus.CREATED]:          [OrderStatus.RISK_APPROVED, OrderStatus.CANCELLED, OrderStatus.EXPIRED],
  [OrderStatus.RISK_APPROVED]:    [OrderStatus.EXECUTING, OrderStatus.REJECTED],
  [OrderStatus.EXECUTING]:        [OrderStatus.SUBMITTED, OrderStatus.REJECTED, OrderStatus.UNKNOWN],
  [OrderStatus.SUBMITTED]:        [OrderStatus.ACCEPTED, OrderStatus.REJECTED, OrderStatus.UNKNOWN, OrderStatus.EXPIRED],
  [OrderStatus.ACCEPTED]:         [OrderStatus.PARTIALLY_FILLED, OrderStatus.FILLED, OrderStatus.CANCEL_PENDING, OrderStatus.UNKNOWN, OrderStatus.EXPIRED],
  [OrderStatus.PARTIALLY_FILLED]: [OrderStatus.PARTIALLY_FILLED, OrderStatus.FILLED, OrderStatus.CANCEL_PENDING, OrderStatus.UNKNOWN],
  [OrderStatus.CANCEL_PENDING]:   [OrderStatus.CANCELLED, OrderStatus.FILLED, OrderStatus.UNKNOWN],

  // Limbo states can be resolved
  [OrderStatus.UNKNOWN]:          [OrderStatus.RECONCILING, OrderStatus.FILLED, OrderStatus.CANCELLED, OrderStatus.EXPIRED],
  [OrderStatus.RECONCILING]:      [OrderStatus.FILLED, OrderStatus.CANCELLED, OrderStatus.EXPIRED, OrderStatus.UNKNOWN],

  // Terminal states — no outgoing transitions
  [OrderStatus.FILLED]:           [],
  [OrderStatus.REJECTED]:         [],
  [OrderStatus.CANCELLED]:        [],
  [OrderStatus.EXPIRED]:          [],
};

const TERMINAL_STATES: ReadonlySet<OrderStatusType> = new Set([
  OrderStatus.FILLED,
  OrderStatus.REJECTED,
  OrderStatus.CANCELLED,
  OrderStatus.EXPIRED,
]);

export class OrderStateTransitionError extends Error {
  constructor(
    public readonly from: OrderStatusType,
    public readonly to: OrderStatusType,
    public readonly orderId: string,
  ) {
    super(`Illegal order state transition: ${from} → ${to} (order: ${orderId})`);
    this.name = 'OrderStateTransitionError';
  }
}

export class OrderInvariantViolationError extends Error {
  constructor(
    public readonly invariant: string,
    public readonly orderId: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super(`Order invariant violated: ${invariant} (order: ${orderId})`);
    this.name = 'OrderInvariantViolationError';
  }
}

/**
 * Validates a state transition and throws if it is forbidden.
 */
export function validateOrderTransition(
  from: OrderStatusType,
  to: OrderStatusType,
  orderId: string,
): void {
  const allowed = ALLOWED_TRANSITIONS[from];
  if (!allowed || !allowed.includes(to)) {
    throw new OrderStateTransitionError(from, to, orderId);
  }
}

/**
 * Returns true if the order is in a terminal state (no further transitions allowed).
 */
export function isTerminalOrderStatus(status: OrderStatusType): boolean {
  return TERMINAL_STATES.has(status);
}

/**
 * Returns the list of valid next states from a given status.
 */
export function getValidTransitions(status: OrderStatusType): readonly OrderStatusType[] {
  return ALLOWED_TRANSITIONS[status] ?? [];
}

// ---------------------------------------------------------------------------
// Aggregate Invariant Validators
// ---------------------------------------------------------------------------

/**
 * Validates that a fill update does not exceed the original order amount.
 * Invariant: filledAmount <= amount
 */
export function validateFillAmount(
  orderId: string,
  orderAmount: number,
  newFilledAmount: number,
): void {
  if (newFilledAmount < 0) {
    throw new OrderInvariantViolationError(
      'filledAmount must be non-negative',
      orderId,
      { orderAmount, newFilledAmount },
    );
  }
  if (newFilledAmount > orderAmount) {
    throw new OrderInvariantViolationError(
      'filledAmount cannot exceed order amount',
      orderId,
      { orderAmount, newFilledAmount, overfill: newFilledAmount - orderAmount },
    );
  }
}

/**
 * Validates that averageFillPrice is not modified after FILLED.
 * Invariant: averageFillPrice is immutable once FILLED.
 */
export function validateFillPriceImmutability(
  orderId: string,
  currentStatus: OrderStatusType,
  currentFillPrice: number | undefined,
  newFillPrice: number | undefined,
): void {
  if (
    currentStatus === OrderStatus.FILLED &&
    currentFillPrice !== undefined &&
    newFillPrice !== undefined &&
    currentFillPrice !== newFillPrice
  ) {
    throw new OrderInvariantViolationError(
      'averageFillPrice is immutable after FILLED',
      orderId,
      { currentFillPrice, attemptedNewPrice: newFillPrice },
    );
  }
}

/**
 * Validates that a cancellation is not attempted on a FILLED order.
 * Invariant: Cannot cancel a FILLED order.
 */
export function validateCancellationAllowed(
  orderId: string,
  currentStatus: OrderStatusType,
): void {
  if (currentStatus === OrderStatus.FILLED) {
    throw new OrderInvariantViolationError(
      'cannot cancel a FILLED order',
      orderId,
      { currentStatus },
    );
  }
}
