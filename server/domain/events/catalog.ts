/**
 * Centralized catalog of all permitted Domain Event types.
 * Prevents free-form string typos and enforces bounded context boundaries.
 */
export const EventCatalog = {
  // Trading & Execution — Domain Events
  OrderCreated: 'OrderCreated',
  OrderRiskApproved: 'OrderRiskApproved',
  OrderSubmitted: 'OrderSubmitted',
  OrderAccepted: 'OrderAccepted',
  OrderPartiallyFilled: 'OrderPartiallyFilled',
  OrderFilled: 'OrderFilled',
  OrderRejected: 'OrderRejected',
  OrderCancelled: 'OrderCancelled',
  OrderExpired: 'OrderExpired',
  OrderEnteredUnknownState: 'OrderEnteredUnknownState',
  TradeExecuted: 'TradeExecuted',
  
  // Vault & Treasury — Domain Events
  DepositCompleted: 'DepositCompleted',
  WithdrawalCompleted: 'WithdrawalCompleted',
  VaultConstraintViolated: 'VaultConstraintViolated',
  
  // Payment — Domain Events
  PaymentInitiated: 'PaymentInitiated',
  PaymentAccepted: 'PaymentAccepted',
  PaymentWebhookReceived: 'PaymentWebhookReceived',
  PaymentVerified: 'PaymentVerified',
  PaymentSettled: 'PaymentSettled',
  PaymentCompleted: 'PaymentCompleted',
  PaymentFailed: 'PaymentFailed',
  
  // Integration Events (cross-domain notifications)
  VaultUpdated: 'VaultUpdated',
  UserBalanceChanged: 'UserBalanceChanged',
  
  // Market Data (Operational)
  CandleClosed: 'CandleClosed',
  
  // System & Observability
  TradeReconciliationFailed: 'TradeReconciliationFailed',
} as const;

export type EventType = typeof EventCatalog[keyof typeof EventCatalog];

