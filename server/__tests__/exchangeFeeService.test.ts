import { beforeEach, describe, expect, it } from 'vitest';
import { exchangeFeeService } from '../services/exchangeFeeService';

describe('exchangeFeeService', () => {
  beforeEach(() => {
    exchangeFeeService.hydrateUserVolumes({});
  });

  it('adds buy fees and deducts sell fees', () => {
    const buy = exchangeFeeService.calculateTotalCost(1_000, 'binance', 'BTC/USDT', 'buy');
    const sell = exchangeFeeService.calculateTotalCost(1_000, 'binance', 'BTC/USDT', 'sell');

    expect(buy).toMatchObject({ fee: 1, total: 1_001 });
    expect(sell).toMatchObject({ fee: 1, total: 999 });
  });

  it('returns null instead of applying a default fee for unknown exchanges', () => {
    expect(exchangeFeeService.calculateTotalCost(1_000, 'unknown-exchange', 'BTC/USDT', 'buy'))
      .toBeNull();
  });

  it('applies the stablecoin rate only to pairs with two stablecoin legs', () => {
    const cryptoToStable = exchangeFeeService.resolveFees('binance', 'BTC/USDT', 'buy');
    const stableToStable = exchangeFeeService.resolveFees('binance', 'USDC/USDT', 'buy');

    expect(cryptoToStable?.isStablecoinPair).toBe(false);
    expect(cryptoToStable?.feeRate).toBe(0.001);
    expect(stableToStable?.isStablecoinPair).toBe(true);
    expect(stableToStable?.feeRate).toBe(0.0001);
  });

  it('replaces hydrated volume state and uses it for fee tiers', () => {
    exchangeFeeService.hydrateUserVolumes({ 'user-1': 500_000 });
    const volume = exchangeFeeService.getUserVolume('user-1');
    const tieredFees = exchangeFeeService.resolveFees('binance', 'BTC/USDT', 'buy', {
      userVolume30Day: volume,
    });

    expect(tieredFees?.maker).toBe(0.0008);

    exchangeFeeService.hydrateUserVolumes({});
    expect(exchangeFeeService.getUserVolume('user-1')).toBe(0);
  });

  it('keeps effective-dated versions and resolves historical fee rates', () => {
    exchangeFeeService.setFeeSchedule({
      exchange: 'history-test',
      asOf: '2025-01-01T00:00:00.000Z',
      baseStructure: { maker: 0.001, taker: 0.002 },
      volumeTiers: [{ volumeThreshold: 0, maker: 0.001, taker: 0.002 }],
      stablecoinPairs: { maker: 0.0001, taker: 0.0001 },
    }, {
      source: 'bootstrap',
      effectiveFrom: '2025-01-01T00:00:00.000Z',
    });
    exchangeFeeService.setFeeSchedule({
      exchange: 'history-test',
      asOf: '2026-01-01T00:00:00.000Z',
      baseStructure: { maker: 0.002, taker: 0.003 },
      volumeTiers: [{ volumeThreshold: 0, maker: 0.002, taker: 0.003 }],
      stablecoinPairs: { maker: 0.0002, taker: 0.0002 },
    }, {
      source: 'manual',
      effectiveFrom: '2026-01-01T00:00:00.000Z',
      reason: 'Published rate update',
      changedBy: 'admin-1',
    });

    const historical = exchangeFeeService.resolveFees('history-test', 'BTC/USDT', 'buy', {
      effectiveAt: new Date('2025-06-01T00:00:00.000Z'),
    });
    const historicalCost = exchangeFeeService.calculateTotalCost(
      1_000,
      'history-test',
      'BTC/USDT',
      'buy',
      { effectiveAt: new Date('2025-06-01T00:00:00.000Z') }
    );
    const current = exchangeFeeService.resolveFees('history-test', 'BTC/USDT', 'buy');

    expect(exchangeFeeService.getScheduleHistory('history-test')).toHaveLength(2);
    expect(exchangeFeeService.getScheduleHistory('history-test')[0].effectiveTo)
      .toBe('2026-01-01T00:00:00.000Z');
    expect(historical?.feeRate).toBe(0.002);
    expect(historicalCost?.total).toBe(1_002);
    expect(current?.feeRate).toBe(0.003);
    expect(exchangeFeeService.getRecentScheduleChanges(1)[0]).toMatchObject({
      exchange: 'history-test',
      source: 'manual',
      reason: 'Published rate update',
      changes: {
        baseStructure: {
          previous: { maker: 0.001, taker: 0.002 },
          next: { maker: 0.002, taker: 0.003 },
        },
      },
    });
  });

  it('uses credential-scoped symbol fees only for their owner', () => {
    exchangeFeeService.setFeeSchedule({
      exchange: 'credential-test',
      asOf: '2026-01-01T00:00:00.000Z',
      baseStructure: { maker: 0.001, taker: 0.002 },
      volumeTiers: [{ volumeThreshold: 0, maker: 0.001, taker: 0.002 }],
      stablecoinPairs: { maker: 0.0001, taker: 0.0001 },
    }, {
      source: 'bootstrap',
      effectiveFrom: '2026-01-01T00:00:00.000Z',
    });
    exchangeFeeService.setFeeSchedule({
      exchange: 'credential-test',
      asOf: new Date().toISOString(),
      baseStructure: { maker: 0.0015, taker: 0.0025 },
      volumeTiers: [],
      stablecoinPairs: { maker: 0.0015, taker: 0.0025 },
      pairFees: {
        'BTC/USDT': { maker: 0.0003, taker: 0.0007 },
      },
    }, {
      source: 'api-sync',
      userId: 'credential-owner',
      changedBy: 'credential-owner',
    });

    expect(exchangeFeeService.resolveFees('credential-test', 'BTC/USDT', 'buy', {
      userId: 'credential-owner',
    })?.feeRate).toBe(0.0007);
    expect(exchangeFeeService.resolveFees('credential-test', 'BTC/USDT', 'buy', {
      userId: 'different-user',
    })?.feeRate).toBe(0.002);
    expect(exchangeFeeService.getScheduleHistory('credential-test'))
      .toContainEqual(expect.objectContaining({ userId: 'credential-owner', source: 'api-sync' }));
  });
});
