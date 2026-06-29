import { describe, expect, it } from 'vitest';
import {
  DAO_TYPE_CONFIG,
  SUBSCRIPTION_TIER_CONFIG,
  getRecommendedSubscriptionTier,
} from './daoTypes.config';

describe('dao subscription config', () => {
  it('maps investment daos to the professional tier and exposes a pro plan at 1500 KES', () => {
    expect(getRecommendedSubscriptionTier('investment')).toBe('professional');
    expect(DAO_TYPE_CONFIG.investment.monetization.recommendedTier).toBe('professional');
    expect(SUBSCRIPTION_TIER_CONFIG.find((tier) => tier.key === 'growth')?.priceKES).toBe(1500);
  });
});
