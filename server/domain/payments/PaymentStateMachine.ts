/**
 * Payment State Machine 
 *
 * Pure domain logic for payment state transitions.
 * No side-effects, no I/O, no database access.
 *
 * State flow:
 *   CREATED → PROVIDER_ACCEPTED → PENDING → WEBHOOK_RECEIVED → VERIFIED → SETTLING → COMPLETED
 *   Any non-terminal → FAILED
 *   FAILED → RECONCILING
 *   RECONCILING → VERIFIED | FAILED
 */

// ---------------------------------------------------------------------------
// Status Constants
// ---------------------------------------------------------------------------

export const PaymentStatus = {
  CREATED: 'created',
  PROVIDER_ACCEPTED: 'provider_accepted',
  PENDING: 'pending',
  WEBHOOK_RECEIVED: 'webhook_received',
  VERIFIED: 'verified',
  SETTLING: 'settling',
  COMPLETED: 'completed',
  FAILED: 'failed',
  RECONCILING: 'reconciling',
} as const;

export type PaymentStatusType = (typeof PaymentStatus)[keyof typeof PaymentStatus];

// ---------------------------------------------------------------------------
// Transition Table
// ---------------------------------------------------------------------------

const PAYMENT_TRANSITIONS: Record<PaymentStatusType, readonly PaymentStatusType[]> = {
  [PaymentStatus.CREATED]: [PaymentStatus.PROVIDER_ACCEPTED, PaymentStatus.FAILED],
  [PaymentStatus.PROVIDER_ACCEPTED]: [PaymentStatus.PENDING, PaymentStatus.FAILED],
  [PaymentStatus.PENDING]: [PaymentStatus.WEBHOOK_RECEIVED, PaymentStatus.FAILED],
  [PaymentStatus.WEBHOOK_RECEIVED]: [PaymentStatus.VERIFIED, PaymentStatus.FAILED],
  [PaymentStatus.VERIFIED]: [PaymentStatus.SETTLING, PaymentStatus.FAILED],
  [PaymentStatus.SETTLING]: [PaymentStatus.COMPLETED, PaymentStatus.FAILED],
  [PaymentStatus.COMPLETED]: [], // terminal
  [PaymentStatus.FAILED]: [PaymentStatus.RECONCILING],
  [PaymentStatus.RECONCILING]: [PaymentStatus.VERIFIED, PaymentStatus.FAILED],
};

const TERMINAL_STATUSES: ReadonlySet<PaymentStatusType> = new Set([
  PaymentStatus.COMPLETED,
]);

// ---------------------------------------------------------------------------
// Error Types
// ---------------------------------------------------------------------------

export class PaymentStateTransitionError extends Error {
  constructor(
    public readonly paymentId: string,
    public readonly fromStatus: PaymentStatusType,
    public readonly toStatus: PaymentStatusType,
  ) {
    super(
      `Invalid payment state transition: ${fromStatus} → ${toStatus} for payment '${paymentId}'`,
    );
    this.name = 'PaymentStateTransitionError';
  }
}

export class PaymentInvariantViolationError extends Error {
  constructor(
    public readonly paymentId: string,
    public readonly invariant: string,
  ) {
    super(`Payment invariant violated for '${paymentId}': ${invariant}`);
    this.name = 'PaymentInvariantViolationError';
  }
}

// ---------------------------------------------------------------------------
// Validation Functions
// ---------------------------------------------------------------------------

/**
 * Validates that a state transition is allowed.
 * Throws PaymentStateTransitionError if the transition is invalid.
 */
export function validatePaymentTransition(
  from: PaymentStatusType,
  to: PaymentStatusType,
  paymentId: string,
): void {
  const allowed = PAYMENT_TRANSITIONS[from];
  if (!allowed || !allowed.includes(to)) {
    throw new PaymentStateTransitionError(paymentId, from, to);
  }
}

/**
 * Returns true if the status is terminal (no further transitions allowed).
 */
export function isTerminalPaymentStatus(status: PaymentStatusType): boolean {
  return TERMINAL_STATUSES.has(status);
}

/**
 * Returns the list of valid next states for a given status.
 */
export function getValidPaymentTransitions(status: PaymentStatusType): readonly PaymentStatusType[] {
  return PAYMENT_TRANSITIONS[status] ?? [];
}

/**
 * Validates that a payment amount is positive and well-formed.
 */
export function validatePaymentAmount(paymentId: string, amount: string): void {
  const parsed = parseFloat(amount);
  if (isNaN(parsed) || parsed <= 0) {
    throw new PaymentInvariantViolationError(
      paymentId,
      `Payment amount must be positive, got '${amount}'`,
    );
  }
}

/**
 * Validates that a completed payment cannot have its amount changed.
 */
export function validateAmountImmutability(
  paymentId: string,
  status: PaymentStatusType,
  currentAmount: string,
  newAmount: string,
): void {
  if (status === PaymentStatus.COMPLETED && currentAmount !== newAmount) {
    throw new PaymentInvariantViolationError(
      paymentId,
      `Cannot change amount on a COMPLETED payment (current: ${currentAmount}, new: ${newAmount})`,
    );
  }
}
