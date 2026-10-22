export interface MpesaSettlementPolicyInput {
  amount: number;
  amountMatches: boolean;
  phoneVerified: boolean;
  isFirstPayment: boolean;
  paymentsInLast24Hours: number;
  receiptUnique: boolean;
  riskFlagged: boolean;
}

export interface MpesaSettlementPolicyDecision {
  status: 'auto_approved' | 'pending_review';
  reasons: string[];
}

function readLimit(value: string | undefined, fallback: number, maximum: number): number | null {
  if (value === undefined || value.trim() === '') return fallback;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 && parsed <= maximum ? parsed : null;
}

export function evaluateMpesaSettlementPolicy(
  input: MpesaSettlementPolicyInput,
  env: NodeJS.ProcessEnv = process.env,
): MpesaSettlementPolicyDecision {
  const maxAmount = readLimit(env.MPESA_AUTO_APPROVAL_MAX_KES, 20_000, 1_000_000);
  const maxPaymentsPer24Hours = readLimit(env.MPESA_AUTO_APPROVAL_MAX_PAYMENTS_24H, 5, 1000);
  const reasons: string[] = [];

  if (maxAmount === null || maxPaymentsPer24Hours === null) {
    reasons.push('invalid_policy_configuration');
  }
  if (!input.amountMatches) reasons.push('amount_mismatch');
  if (!input.phoneVerified) reasons.push('payer_phone_unverified');
  if (!input.receiptUnique) reasons.push('duplicate_receipt');
  if (input.isFirstPayment) reasons.push('first_payment');
  if (maxAmount !== null && input.amount > maxAmount) reasons.push('amount_over_auto_approval_limit');
  if (maxPaymentsPer24Hours !== null && input.paymentsInLast24Hours >= maxPaymentsPer24Hours) {
    reasons.push('velocity_limit');
  }
  if (input.riskFlagged) reasons.push('risk_flag');

  return {
    status: reasons.length === 0 ? 'auto_approved' : 'pending_review',
    reasons,
  };
}
