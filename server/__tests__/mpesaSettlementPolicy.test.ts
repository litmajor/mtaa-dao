import { describe, expect, it } from 'vitest';
import { evaluateMpesaSettlementPolicy } from '../services/mpesaSettlementPolicy';

const cleanPayment = {
  amount: 2_000,
  amountMatches: true,
  phoneVerified: true,
  isFirstPayment: false,
  paymentsInLast24Hours: 1,
  receiptUnique: true,
  riskFlagged: false,
};

describe('M-Pesa settlement policy', () => {
  it("auto-approves a returning user's clean payment under the configured thresholds", () => {
    expect(evaluateMpesaSettlementPolicy(cleanPayment, {})).toEqual({
      status: 'auto_approved',
      reasons: [],
    });
  });

  it('holds first payments, amount mismatches, duplicates, velocity, and risk flags', () => {
    expect(evaluateMpesaSettlementPolicy({
      ...cleanPayment,
      amountMatches: false,
      isFirstPayment: true,
      paymentsInLast24Hours: 5,
      receiptUnique: false,
      riskFlagged: true,
    }, {})).toEqual({
      status: 'pending_review',
      reasons: [
        'amount_mismatch',
        'duplicate_receipt',
        'first_payment',
        'velocity_limit',
        'risk_flag',
      ],
    });
  });

  it('holds payments above the default 20,000 KES limit', () => {
    expect(evaluateMpesaSettlementPolicy({
      ...cleanPayment,
      amount: 20_001,
    }, {}).reasons).toContain('amount_over_auto_approval_limit');
  });

  it('fails closed when configured limits are invalid', () => {
    expect(evaluateMpesaSettlementPolicy(cleanPayment, {
      MPESA_AUTO_APPROVAL_MAX_KES: '0',
    } as NodeJS.ProcessEnv).reasons).toContain('invalid_policy_configuration');
  });
});
