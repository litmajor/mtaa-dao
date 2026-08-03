import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../auth', () => ({
  isAuthenticated: vi.fn((req: any, res: any, next: any) => next()),
}));

vi.mock('../services/ccxtService', () => ({
  default: {
    fetchMarkets: vi.fn(),
    fetchTicker: vi.fn(),
  },
}));

vi.mock('../utils/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
  Logger: {
    getLogger: () => ({
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    }),
  },
}));

vi.mock('../services/technicalIndicators', () => ({
  calculateAllIndicators: vi.fn(),
}));

vi.mock('../services/historicalData', () => ({
  getHistoricalAnalysis: vi.fn(),
  compareHistoricalPeriods: vi.fn(),
}));

vi.mock('../services/orderBookAnalyzer', () => ({
  analyzeOrderBook: vi.fn(),
  checkLiquidityAlerts: vi.fn(),
  getLiquidityProfile: vi.fn(),
}));

vi.mock('../services/liquidityScoring', () => ({
  calculateLiquidityMetrics: vi.fn(),
  rankAssetsByLiquidity: vi.fn(),
  getLiquidityWarnings: vi.fn(),
}));

vi.mock('../services/arbitrageDetection', () => ({
  findArbitrageOpportunities: vi.fn(),
  findBestArbitrage: vi.fn(),
  calculateTradeProfit: vi.fn(),
  clearArbitrageCache: vi.fn(),
}));

vi.mock('../services/fearGreedIndex', () => ({
  getFearGreedIndex: vi.fn(),
  getMarketChanges: vi.fn(),
  getBtcDominance: vi.fn(),
  getMarketSentiment: vi.fn(),
  clearFearGreedCache: vi.fn(),
}));

vi.mock('../middleware/advancedModeGuard', () => ({
  __esModule: true,
  default: vi.fn((req: any, res: any, next: any) => next()),
}));

const updateMock = vi.fn();
const dbMock = {
  query: {
    crossChainTransfers: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
    },
  },
  update: updateMock,
};

vi.mock('../db', () => ({
  db: dbMock,
}));

const checkStatusMock = vi.fn();
vi.mock('../services/bridgeIntegration', () => ({
  getBridgeIntegration: vi.fn(() => ({
    checkStatus: checkStatusMock,
  })),
}));

describe('bridge and analytics regressions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    updateMock.mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    });
  });

  it('registers the advanced-mode guard middleware on the analytics router', async () => {
    const analyticsRouter = (await import('../routes/v1/yuki/analytics')).default;
    const advancedModeGuard = (await import('../middleware/advancedModeGuard')).default;

    const hasGuardLayer = analyticsRouter.stack.some((layer: any) => layer.handle === advancedModeGuard);

    expect(hasGuardLayer).toBe(true);
  });

  it('uses the current cross-chain transfer fields when completing a relayer transfer', async () => {
    const { BridgeRelayerService } = await import('../services/bridgeRelayerService');
    const service = new BridgeRelayerService();

    const transfer = {
      id: 'transfer-1',
      sourceTxHash: '0x1234',
      bridgeProtocol: 'wormhole',
      sourceChain: 'ethereum',
      targetChain: 'celo',
      bridgeInitiatedAt: null,
      confirmedAt: null,
      completedAt: null,
      bridgeTransactionHash: null,
      status: 'pending',
    };

    checkStatusMock.mockResolvedValue({
      status: 'completed',
      transactionHash: '0x5678',
    });

    await (service as any).processTransfer(transfer);

    const setCall = updateMock.mock.calls[1]?.[0];

    expect(setCall).toMatchObject({
      status: 'completed',
      bridgeTransactionHash: '0x5678',
      confirmedAt: expect.any(Date),
      completedAt: expect.any(Date),
      statusReason: null,
    });
    expect(setCall).not.toHaveProperty('txHashSource');
    expect(setCall).not.toHaveProperty('txHashDestination');
    expect(setCall).not.toHaveProperty('failureReason');
  });
});
