/**
 * YUKI TRADING DASHBOARD - UNIFIED TRADING HUB
 * 
 * Real-time market intelligence, CEX/DEX trading, and strategy automation
 * for active traders and MTAA investors.
 * 
 * Features:
 * - 6 CEX Exchanges (CCXT integrated)
 * - DEX Swaps (Uniswap, Curve, Sushiswap, Ubeswap)
 * - Price Comparison & Arbitrage Detection
 * - Technical Analysis & Charts
 * - Watchlist Management
 * - Strategy Builder & Automation
 * - Real-time Alerts & Signals
 */

import React, { useState, useEffect, lazy, Suspense } from 'react';
// lucide-react may lack types in this project; require and cast to any to avoid TS errors
// eslint-disable-next-line @typescript-eslint/no-var-requires
const _lucide = require('lucide-react') as any;
const TrendingUp = _lucide.TrendingUp as any;
const Settings = _lucide.Settings as any;
import CexManager from './CexManager';
import StrategyMarketplace from './StrategyMarketplace';
import type { OpportunityData as Opportunity } from '../../types/opportunities';
import WatchlistSection from '../../../../frontend/src/components/dashboard/WatchlistSection';
import * as yukiApi from '../../api/yukiApi';
import { OpportunityScannerDashboard } from '../OpportunityScannerDashboard';
import { useYukiStore } from '../../stores/useYukiStore';
import { useWatchlist, type WatchlistItemWithLiveValue } from '@/hooks/useWatchlist';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import StakingComponent from '../staking/StakingComponent';
import { YukiProvider } from '../../contexts/YukiProvider';
import RiskControls from './RiskControls';
import AlgoTradingPanel from './AlgoTradingPanel';
import RebalancingPanel from './RebalancingPanel';
import useOHLCV, { type OHLCVTimeframe } from '../../hooks/useOHLCV';

const ChartsSection = lazy(() => import('../dashboard/ChartsSection'));

// TypeScript interfaces
interface MarketData {
  symbol: string;
  price: number;
  changePercent?: string;
  volume?: number;
  highPrice?: number;
  lowPrice?: number;
  timestamp?: string;
}

// NOTE: the old flat { symbol, price, change, exchanges } WatchlistItem
// interface that used to live here is gone. Watchlist items are now the
// polymorphic shape from '@/api/yukiApi' (WatchlistItem, WatchlistItemType),
// consumed here only through useWatchlist() -- this component no longer
// owns any watchlist state directly.

export default function YukiDashboard() {
  const [activeTab, setActiveTab] = useState<'overview' | 'cex' | 'dex' | 'charts' | 'watchlist' | 'opportunities' | 'strategies' | 'alerts' | 'algo' | 'rebalance'>('overview');
  const [marketData, setMarketData] = useState<MarketData | null>(null);
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(true);

  const [stakingModalOpen, setStakingModalOpen] = useState(false);
  const [riskModalOpen, setRiskModalOpen] = useState(false);

  const setPreFilledTrade = useYukiStore((state) => state.setPreFilledTrade);

  // Single shared watchlist state for the whole dashboard -- both the
  // Overview summary card and the Watchlist tab read from this same hook
  // instance's underlying data via their own useWatchlist() calls. React
  // Query / SWR-style caching isn't in play here (no such library was
  // visible in what's been shared), so each call independently fetches;
  // that's an acceptable v1 cost, but worth dedup'ing later via context
  // or a shared query cache if this page re-renders often.
  const { watchlists } = useWatchlist();

  const handleOpportunityClick = (op: Opportunity) => {
    if (op.type === 'emerging-token') {
      setStakingModalOpen(true);
      return;
    }

    const [base, quote] = op.symbol?.split('/') ?? ['USDC', 'ETH'];
    setPreFilledTrade({
      tokenIn: base || 'USDC',
      tokenOut: quote || 'ETH',
      recommendedAmount: op.profitAmount != null ? String(op.profitAmount) : String(op.profitPercent ?? 100),
    });
    setActiveTab('dex');
  };

  const handleTradeToken = (symbol: string) => {
    setPreFilledTrade({ tokenIn: 'USDC', tokenOut: symbol, recommendedAmount: '100' });
    setActiveTab('dex');
  };

  // Chart state for the trading terminal
  const [chartSymbol, setChartSymbol] = useState('SOL/USDC');
  const [chartTimeframe, setChartTimeframe] = useState<OHLCVTimeframe>('5m');

  const handleChartTimeframeChange = (tf: string) => setChartTimeframe(tf as OHLCVTimeframe);

  const { candles, loading: chartLoading, error: chartError, source: chartSource, refetch: refetchOHLCV, isRefetching } = useOHLCV(
    chartSymbol,
    chartTimeframe,
    200,
    'auto'
  );

  useEffect(() => {
    const normalizeOpportunity = (raw: unknown): Opportunity | null => {
      if (!raw || typeof raw !== 'object') return null;
      const item = raw as Record<string, any>;
      // Map incoming payload to client OpportunityData shape with safe defaults
      const id = typeof item.id === 'string' ? item.id : String(item.id ?? '');
      const symbol = typeof item.symbol === 'string' ? item.symbol : String(item.pair ?? item.ticker ?? '');
      const type = (item.type === 'arbitrage' || item.type === 'dex-spread' || item.type === 'emerging-token') ? item.type : 'arbitrage';
      const venue1 = typeof item.buyVenue === 'string' ? item.buyVenue : typeof item.venue1 === 'string' ? item.venue1 : '';
      const venue2 = typeof item.sellVenue === 'string' ? item.sellVenue : typeof item.venue2 === 'string' ? item.venue2 : '';
      const price1 = typeof item.buyPrice === 'number' ? item.buyPrice : typeof item.price1 === 'number' ? item.price1 : Number(item.price ?? 0);
      const price2 = typeof item.sellPrice === 'number' ? item.sellPrice : typeof item.price2 === 'number' ? item.price2 : Number(item.price_alt ?? 0);
      const profitPercent = Number(item.profitPercent ?? item.profitPct ?? item.profit ?? 0);
      const profitAmount = typeof item.profitAmount === 'number' ? item.profitAmount : undefined;
      const volume = Number(item.volume ?? 0);
      const risk = item.severity === 'high' || item.risk === 'high' ? 'high' : item.severity === 'medium' || item.risk === 'medium' ? 'medium' : 'low';

      const timestamp = typeof item.timestamp === 'number' ? item.timestamp : Date.now();
      const confidence = Number(item.confidence ?? item.conf ?? 0);

      return {
        id,
        type,
        symbol,
        chain: typeof item.chain === 'string' ? item.chain : undefined,
        profitPercent,
        profitAmount,
        venue1,
        venue2,
        price1,
        price2,
        volume,
        risk: risk as 'low' | 'medium' | 'high',
        timestamp,
        confidence,
      } as Opportunity;
    };

    const normalizeMarketData = (raw: unknown, symbol: string): MarketData | null => {
      let payload: unknown = raw;
      if (payload && typeof payload === 'object' && 'data' in payload) {
        payload = (payload as Record<string, unknown>)['data'];
      }

      if (Array.isArray(payload)) {
        const entry = payload.find((row) => row && typeof row === 'object' && (row as Record<string, unknown>).symbol === symbol) as Record<string, unknown> | undefined;
        if (!entry) return null;
        return {
          symbol,
          price: typeof entry.price === 'number' ? entry.price : Number(entry.price ?? 0),
          changePercent: typeof entry.changePercent === 'string' ? entry.changePercent : undefined,
          volume: typeof entry.volume === 'number' ? entry.volume : undefined,
          highPrice: typeof entry.high === 'number' ? entry.high : undefined,
          lowPrice: typeof entry.low === 'number' ? entry.low : undefined,
          timestamp: typeof entry.timestamp === 'string' ? entry.timestamp : undefined,
        };
      }

      if (payload && typeof payload === 'object') {
        const map = payload as Record<string, unknown>;
        const symbolEntry = map[symbol];
        if (symbolEntry && typeof symbolEntry === 'object') {
          const record = symbolEntry as Record<string, unknown>;
          return {
            symbol,
            price: typeof record.price === 'number' ? record.price : Number(record.price ?? 0),
            changePercent: typeof record.changePercent === 'string' ? record.changePercent : undefined,
            volume: typeof record.volume === 'number' ? record.volume : undefined,
            highPrice: typeof record.high === 'number' ? record.high : undefined,
            lowPrice: typeof record.low === 'number' ? record.low : undefined,
            timestamp: typeof record.timestamp === 'string' ? record.timestamp : undefined,
          };
        }

        const topPrice = typeof map.price === 'number' ? map.price : Number(map.price ?? 0);
        if (topPrice !== 0) {
          return {
            symbol,
            price: topPrice,
            changePercent: typeof map.changePercent === 'string' ? map.changePercent : undefined,
            volume: typeof map.volume === 'number' ? map.volume : undefined,
            highPrice: typeof map.high === 'number' ? map.high : undefined,
            lowPrice: typeof map.low === 'number' ? map.low : undefined,
            timestamp: typeof map.timestamp === 'string' ? map.timestamp : undefined,
          };
        }
      }

      return null;
    };

    const fetchDashboardData = async () => {
      setLoading(true);
      try {
        const [opsResult, pricesResult] = await Promise.allSettled([
          yukiApi.fetchOpportunities(),
          yukiApi.getMarketPrices([chartSymbol]),
        ]);

        if (opsResult.status === 'fulfilled') {
          const rawOps = opsResult.value;
          const items = Array.isArray(rawOps)
            ? rawOps
            : rawOps && typeof rawOps === 'object'
              ? (rawOps as Record<string, unknown>)['data'] ?? rawOps
              : rawOps;

          if (Array.isArray(items)) {
            setOpportunities(
              items
                .map((item) => normalizeOpportunity(item))
                .filter((item): item is Opportunity => item !== null)
            );
          }
        } else {
          console.warn('No opportunities API available or fetch failed', opsResult.reason);
        }

        if (pricesResult.status === 'fulfilled') {
          setMarketData(normalizeMarketData(pricesResult.value, chartSymbol));
        }
      } catch (error) {
        console.error('Error fetching market data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, [chartSymbol]);

  return (
    <YukiProvider>
    <div className="min-h-screen bg-slate-900 text-white p-4 md:p-6">
      <div className="max-w-7xl mx-auto">
        {/* LAYER 1 — GLOBAL MARKET STATE (persistent) */}
        <div className="sticky top-4 z-40 bg-slate-800/90 backdrop-blur rounded-xl border border-slate-700 p-4 mb-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div>
              <h2 className="text-lg font-semibold">Global Market State</h2>
              <p className="text-sm text-slate-400">Market regime • Volatility • Connectivity • Opportunities</p>
            </div>
            <div className="hidden sm:flex items-center gap-6 ml-6 text-sm text-slate-300">
              <div>Regime: <span className="font-medium text-emerald-300">Bull</span></div>
              <div>Volatility: <span className="font-medium">Low</span></div>
              <div>Exchanges: <span className="font-medium">6</span></div>
              <div>Ops: <span className="font-medium text-amber-300">3</span></div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button className="px-3 py-2 rounded bg-slate-700 hover:bg-slate-600 text-sm">Refresh</button>
            <button onClick={() => setRiskModalOpen(true)} className="px-3 py-2 rounded bg-blue-600 hover:bg-blue-700 text-sm flex items-center gap-2"><Settings className="h-4 w-4" />Settings</button>
          </div>
        </div>

        {/* LAYER 2 + 3 — ACTIVE WORKSPACE + INTELLIGENCE STREAM */}
        <div className="grid grid-cols-12 gap-4">
          {/* Active Workspace (primary + secondary surfaces) */}
          <main className="col-span-12 lg:col-span-8 space-y-4">
            {/* Workspace Tabs (contextual focus surface) */}
            <div className="bg-slate-900 border border-slate-600 rounded-lg p-2 flex items-center">
              <div className="flex gap-2 overflow-x-auto">
                {[
                  { id: 'overview' as const, label: '📊 Overview' },
                  { id: 'cex' as const, label: '🏦 CEX Markets' },
                  { id: 'dex' as const, label: '🔄 DEX Swaps' },
                  { id: 'charts' as const, label: '📈 Charts & TA' },
                  { id: 'watchlist' as const, label: '⭐ Watchlist' },
                  { id: 'opportunities' as const, label: '⚡ Opportunities' },
                  { id: 'strategies' as const, label: '🤖 Strategies' },
                  { id: 'algo' as const, label: '⚙️ Algo (TWAP)' },
                  { id: 'rebalance' as const, label: '⚖️ Rebalance' },
                  { id: 'alerts' as const, label: '🔔 Alerts' },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`px-3 py-2 rounded text-sm transition-colors whitespace-nowrap ${
                      activeTab === tab.id
                        ? 'bg-blue-600 text-white'
                        : 'text-slate-300 hover:text-slate-200 hover:bg-slate-800/50'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Primary execution / content surface */}
            <section className="bg-slate-900 border border-slate-600 rounded-lg p-6">
              {activeTab === 'overview' && (
                <OverviewSection watchlists={watchlists} marketData={marketData} />
              )}
              {activeTab === 'cex' && (
                <div className="space-y-4">
                  <div className="bg-slate-800 p-4 rounded border border-slate-700"> <CexManager /> </div>
                </div>
              )}
              {activeTab === 'dex' && (
                <div className="bg-slate-800 p-4 rounded border border-slate-700"> <DexSwapSection /> </div>
              )}
              {activeTab === 'charts' && (
                <div className="bg-slate-800 p-4 rounded border border-slate-700">
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 flex-wrap mb-3">
                      {watchlists.flatMap((w) => w.items).filter((item) => item.item_type === 'symbol').map((item) => (
                        item.item_type === 'symbol' ? (
                          <button
                            key={item.id}
                            onClick={() => setChartSymbol(item.target_name)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                              chartSymbol === item.target_name
                                ? 'bg-blue-600 text-white'
                                : 'bg-gray-700 text-slate-300 hover:bg-slate-700/80'
                            }`}
                          >
                            {item.target_name}
                          </button>
                        ) : null
                      ))}
                    </div>

                    <Suspense fallback={
                      <div className="h-96 bg-slate-700 rounded-lg border border-slate-700 flex items-center justify-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-500 border-t-transparent" />
                      </div>
                    }>
                      <ChartsSection
                        selectedPair={chartSymbol}
                        timeframe={chartTimeframe}
                        candles={candles || []}
                        onTimeframeChange={handleChartTimeframeChange}
                        onRefresh={refetchOHLCV}
                        isRefreshing={isRefetching}
                        error={chartError}
                      />
                    </Suspense>
                  </div>
                </div>
              )}
              {activeTab === 'watchlist' && (
                <div className="bg-slate-800 p-4 rounded border border-slate-700"> <WatchlistSection onTradeToken={handleTradeToken} /> </div>
              )}
              {activeTab === 'opportunities' && (
                <div className="bg-slate-800 p-4 rounded border border-slate-700"> <OpportunityScannerDashboard /> </div>
              )}
              {activeTab === 'strategies' && (
                <div className="bg-slate-800 p-4 rounded border border-slate-700"> <StrategyMarketplace /> </div>
              )}
              {activeTab === 'algo' && (
                <AlgoTradingPanel />
              )}
              {activeTab === 'rebalance' && (
                <RebalancingPanel />
              )}
              {activeTab === 'alerts' && (
                <div className="bg-slate-800 p-4 rounded border border-slate-700"> <AlertsSection /> </div>
              )}
            </section>
          </main>

          {/* Intelligence Stream (tertiary surface) */}
          <aside className="col-span-12 lg:col-span-4 space-y-4">
            <div className="bg-slate-800/60 rounded-lg border border-slate-700 p-4 text-sm">
              <h4 className="font-semibold mb-2">Signals & Alerts</h4>
              <AlertsSection />
            </div>

            <div className="bg-slate-800/60 rounded-lg border border-slate-700 p-4 text-sm">
              <h4 className="font-semibold mb-2">Opportunity Feed</h4>
              <div className="space-y-2">
                {opportunities && opportunities.length > 0 ? (
                  opportunities.map((op, idx) => (
                    <button 
                      key={idx} 
                      onClick={() => handleOpportunityClick(op)}
                      className="w-full text-left p-3 bg-slate-900 rounded flex items-start justify-between hover:bg-slate-800 transition-colors border border-transparent hover:border-blue-500/50"
                    >
                      <div>
                        <div className="text-sm font-medium text-white">{op.symbol || op.id}</div>
                        <div className="text-xs text-slate-400">{op.venue1 && op.venue2 ? `${op.venue1} → ${op.venue2}` : op.type}</div>
                      </div>
                      <div className="text-right text-xs text-slate-300">
                        <div className={`inline-block px-2 py-1 rounded text-xs ${op.risk === 'high' ? 'bg-red-600' : op.risk === 'medium' ? 'bg-amber-600' : 'bg-emerald-600'}`}>{op.risk ? op.risk.toUpperCase() : 'LOW'}</div>
                      </div>
                    </button>
                  ))
                ) : (
                  <div className="text-slate-300">No opportunities detected — scanner idle.</div>
                )}
              </div>
            </div>

            <div className="bg-slate-800/60 rounded-lg border border-slate-700 p-4 text-sm">
              <h4 className="font-semibold mb-2">Strategy Triggers</h4>
              <div className="text-slate-300">Recent fills and strategy triggers.</div>
            </div>
          </aside>
        </div>
      </div>
      
      {/* Staking Hub Modal */}
      <Dialog open={stakingModalOpen} onOpenChange={setStakingModalOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-slate-900 border-slate-700 p-0 sm:rounded-xl">
          <div className="p-1">
            <StakingComponent />
          </div>
        </DialogContent>
      </Dialog>

      {/* Risk Controls Modal */}
      <Dialog open={riskModalOpen} onOpenChange={setRiskModalOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-slate-900 border-slate-700 p-0 sm:rounded-xl">
          <RiskControls />
        </DialogContent>
      </Dialog>
    </div>
    </YukiProvider>
  );
}

// SECTION COMPONENTS

const OverviewSection = ({
  watchlists,
  marketData,
}: {
  watchlists: ReturnType<typeof useWatchlist>['watchlists'];
  marketData: MarketData | null;
}) => {
  // Flatten items across all of the user's watchlists for the summary card.
  // Previously this rendered a single flat list with fake { price: 0,
  // change: '+0%', exchanges: [] } placeholders on every add -- none of
  // that data ever came from a server. Now it's real target names and, for
  // symbols, real live prices where the poll has resolved one.
  const allItems = watchlists.flatMap((w) => w.items);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-slate-800 p-4 rounded-lg border border-slate-700">
          <p className="text-sm text-slate-400">24h Volume</p>
          <p className="text-2xl font-bold mt-1">$2.4B</p>
        </div>
        <div className="bg-slate-800 p-4 rounded-lg border border-slate-700">
          <p className="text-sm text-slate-400">Top Gainers</p>
          <p className="text-2xl font-bold text-green-400 mt-1">+24.5%</p>
        </div>
        <div className="bg-slate-800 p-4 rounded-lg border border-slate-700">
          <p className="text-sm text-slate-400">Portfolio Value</p>
          <p className="text-2xl font-bold mt-1">$124,500</p>
        </div>
      </div>

      <div className="bg-slate-800 rounded-lg border border-slate-700 p-6">
        <h3 className="text-lg font-semibold mb-4">Watchlist Summary</h3>
        <div className="space-y-3">
          {allItems.length === 0 && (
            <p className="text-sm text-slate-400">No watchlist items yet. Add some from the Watchlist tab.</p>
          )}
          {allItems.map((item) => (
            <div key={item.id} className="flex items-center justify-between p-3 bg-slate-700 rounded">
              <div>
                <p className="font-semibold">{item.target_name}</p>
                <p className="text-xs text-slate-400 uppercase">{item.item_type}</p>
              </div>
              <div className="text-right">
                {item.liveValueSource === 'live' && item.liveValue !== null ? (
                  <p className="font-semibold">${item.liveValue.toLocaleString()}</p>
                ) : (
                  <p className="text-sm text-slate-500">live value unavailable</p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const DexSwapSection = () => {
  const [fromToken, setFromToken] = useState('ETH');
  const [toToken, setToToken] = useState('USDC');
  const [amount, setAmount] = useState('1');
  const [swapLoading, setSwapLoading] = useState(false);

  const handleSwap = async () => {
    setSwapLoading(true);
    try {
      // Execute swap through DEX aggregator
      console.log('Executing swap:', { fromToken, toToken, amount });
      setSwapLoading(false);
    } catch (error) {
      console.error('Swap failed:', error);
      setSwapLoading(false);
    }
  };

  return (
    <div className="bg-slate-800 rounded-lg border border-slate-700 p-6">
      <h3 className="text-lg font-semibold mb-6">DEX Swap</h3>
      <div className="space-y-4 max-w-md">
        <div>
          <label className="block text-sm text-slate-400 mb-2">From</label>
          <input
            type="text"
            value={fromToken}
            onChange={(e) => setFromToken(e.target.value)}
            className="w-full px-3 py-2 bg-slate-700 rounded border border-slate-600 text-white"
            placeholder="Token"
          />
        </div>
        <div>
          <label className="block text-sm text-slate-400 mb-2">To</label>
          <input
            type="text"
            value={toToken}
            onChange={(e) => setToToken(e.target.value)}
            className="w-full px-3 py-2 bg-slate-700 rounded border border-slate-600 text-white"
            placeholder="Token"
          />
        </div>
        <div>
          <label className="block text-sm text-slate-400 mb-2">Amount</label>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full px-3 py-2 bg-slate-700 rounded border border-slate-600 text-white"
            placeholder="0.00"
          />
        </div>
        <button
          onClick={handleSwap}
          disabled={swapLoading}
          className="w-full px-4 py-2 rounded bg-blue-600 hover:bg-blue-700 disabled:bg-slate-700 transition-colors font-semibold"
        >
          {swapLoading ? 'Swapping...' : 'Execute Swap'}
        </button>
      </div>
    </div>
  );
};

// ChartsSection placeholder removed — charts are rendered via the real
// `ChartsSection` component imported from the frontend bundle and driven
// by the `useOHLCV` hook above.

// NOTE: the old inline `WatchlistSection` primitive component (flat
// { symbol, price, change, exchanges } list, fake data on add) has been
// deleted. The dashboard now imports the real one from
// './WatchlistSection', which is wired to useWatchlist() and the
// polymorphic multi-entity schema.

const AlertsSection = () => (
  <div className="bg-slate-800 rounded-lg border border-slate-700 p-6">
    <h3 className="text-lg font-semibold mb-4">Price Alerts & Signals</h3>
    <div className="space-y-3">
      <div className="p-3 bg-slate-700 rounded border-l-2 border-yellow-500">
        <p className="font-semibold text-yellow-400">⚠️ Volatility Alert</p>
        <p className="text-sm text-slate-300 mt-1">ETH/USDT experiencing 5.2% movement</p>
      </div>
      <div className="p-3 bg-slate-700 rounded border-l-2 border-green-500">
        <p className="font-semibold text-green-400">✓ Buy Signal</p>
        <p className="text-sm text-slate-300 mt-1">BTC/USDT crossed above MA50</p>
      </div>
    </div>
  </div>
);