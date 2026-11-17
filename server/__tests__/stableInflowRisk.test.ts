import { describe, expect, it } from 'vitest';
import { hasStableInflowRiskFlagsCleared } from '../types/stableInflow';

describe('hasStableInflowRiskFlagsCleared', () => {
  it('accepts inflows only when every risk flag is explicitly clear', () => {
    expect(hasStableInflowRiskFlagsCleared({
      depegDetected: false,
      delayedConfirmation: false,
      lowLiquidity: false,
      highRiskScore: false,
      notes: [],
    })).toBe(true);

    expect(hasStableInflowRiskFlagsCleared({
      depegDetected: false,
      delayedConfirmation: false,
      lowLiquidity: true,
      highRiskScore: false,
      notes: ['Liquidity score below recommended threshold'],
    })).toBe(false);
    expect(hasStableInflowRiskFlagsCleared({})).toBe(false);
    expect(hasStableInflowRiskFlagsCleared(null)).toBe(false);
  });
});
