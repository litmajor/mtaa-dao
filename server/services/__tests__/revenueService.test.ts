import { beforeEach, describe, expect, it, vi } from 'vitest';

const executeMock = vi.fn();

vi.mock('../../db', () => ({
  db: {
    execute: executeMock,
  },
}));

vi.mock('../../utils/logger', () => ({
  Logger: {
    getLogger: () => ({
      error: vi.fn(),
      info: vi.fn(),
      debug: vi.fn(),
    }),
  },
}));

vi.mock('../userSubscriptionService', () => ({
  userSubscriptionService: {},
}));

vi.mock('../tokenService', () => ({
  tokenService: {},
}));

describe('RevenueService collected revenue report', () => {
  beforeEach(() => {
    executeMock.mockReset();
  });

  it('reports confirmed revenue by source and currency without conversion', async () => {
    executeMock.mockResolvedValueOnce({
      rows: [
        { source: 'User Payments', currency: 'KES', amount: '500' , source_type: 'user_payment' },
        { source: 'DAO Billing', currency: 'KES', amount: '1500', source_type: 'dao_billing' },
        { source: 'Platform Ledger', currency: 'USD', amount: '12.50', source_type: 'platform_ledger' },
        { source: 'Platform Ledger', currency: 'MTAA', amount: '25', source_type: 'platform_ledger' },
      ],
    });
    executeMock.mockResolvedValueOnce({
      rows: [
        { source: 'Provider Fee Records', currency: 'KES', amount: '45' },
      ],
    });

    const { revenueService } = await import('../revenueService');
    const report = await revenueService.getRevenueReport('monthly');

    expect(report.total).toBe(12.5);
    expect(report.totalByCurrency).toEqual({ KES: 2000, USD: 12.5, MTAA: 25 });
    expect(report.streams).toHaveLength(4);
    expect(report.streams.every((stream) => stream.status === 'collected')).toBe(true);
    expect(report.recordedUnsettled).toHaveLength(1);
    expect(report.recordedUnsettled[0].status).toBe('recorded_unsettled');
    expect(report.streams.find((stream) => stream.currency === 'KES')?.sourceType).toBe('user_payment');
    expect(report.diversification).toBe(100);
  });

  it('returns an empty collected report when no paid rows exist', async () => {
    executeMock.mockResolvedValue({ rows: [] });

    const { revenueService } = await import('../revenueService');
    const report = await revenueService.getRevenueReport('daily');

    expect(report).toEqual({
      total: 0,
      totalByCurrency: {},
      streams: [],
      recordedUnsettled: [],
      diversification: 0,
    });
  });
});
