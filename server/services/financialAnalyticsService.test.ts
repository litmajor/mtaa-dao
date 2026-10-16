import { describe, expect, it, vi } from 'vitest';

vi.mock('../storage', () => ({ db: {} }));

import { FinancialAnalyticsService, type TreasuryHealthThresholds } from './financialAnalyticsService';

const thresholds: TreasuryHealthThresholds = {
  balance: { critical: 10, attention: 20, low: 30, healthy: 40 },
  netFlow: { positive: 0, stable: -5, declining: -10 },
  transactionCount: { high: 30, medium: 20, low: 10 }
};

describe('FinancialAnalyticsService treasury scoring', () => {
  it('uses injected thresholds and returns bounded scores', () => {
    const service = new FinancialAnalyticsService(thresholds);
    const score = (service as any).calculateTreasuryHealthScore(41, 1, 31);
    expect(score).toBe(100);
    expect((service as any).calculateTreasuryHealthScore(-1, -11, 0)).toBe(50);
  });

  it('emits structured recommendation codes and configured balance warnings', () => {
    const service = new FinancialAnalyticsService(thresholds);
    const recommendations = (service as any).generateTreasuryRecommendations(20, -1, 5);
    expect(recommendations).toEqual(expect.arrayContaining([
      expect.objectContaining({ severity: 'critical', code: 'treasury_critical' }),
      expect.objectContaining({ severity: 'warning', code: 'negative_net_flow' }),
      expect.objectContaining({ severity: 'critical', code: 'low_treasury_balance' })
    ]));
  });
});
