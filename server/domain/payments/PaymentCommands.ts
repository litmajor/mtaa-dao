/**
 * Payment Command Types — Sprint 2
 */

export const PaymentCommandTypes = {
  CreatePayment: 'CreatePayment',
  AcceptPayment: 'AcceptPayment',
  ReceiveWebhook: 'ReceiveWebhook',
  VerifyPayment: 'VerifyPayment',
  SettlePayment: 'SettlePayment',
  CompletePayment: 'CompletePayment',
  FailPayment: 'FailPayment',
  ReconcilePayment: 'ReconcilePayment',
  UpdatePaymentMetadata: 'UpdatePaymentMetadata',
} as const;

// ---------------------------------------------------------------------------
// Command Payloads
// ---------------------------------------------------------------------------

export interface CreatePaymentPayload {
  userId: string;
  reference: string;
  type: string;
  amount: string;
  currency: string;
  provider: string;
  metadata?: Record<string, any>;
}

export interface AcceptPaymentPayload {
  paymentId: string;
  providerResponse?: Record<string, any>;
}

export interface ReceiveWebhookPayload {
  reference: string;
  providerData: Record<string, any>;
}

export interface VerifyPaymentPayload {
  paymentId: string;
  verificationData?: Record<string, any>;
}

export interface SettlePaymentPayload {
  paymentId: string;
}

export interface CompletePaymentPayload {
  /** Payment can be identified by ID or reference */
  paymentId?: string;
  reference?: string;
  /** Wallet address for the ledger entry */
  walletAddress?: string;
  /** Additional metadata from the provider callback */
  providerMetadata?: Record<string, any>;
}

export interface FailPaymentPayload {
  paymentId?: string;
  reference?: string;
  reason: string;
  providerData?: Record<string, any>;
}

export interface ReconcilePaymentPayload {
  paymentId?: string;
  reference?: string;
  reason: string;
}

export interface UpdatePaymentMetadataPayload {
  paymentId?: string;
  reference?: string;
  metadata: Record<string, any>;
}
