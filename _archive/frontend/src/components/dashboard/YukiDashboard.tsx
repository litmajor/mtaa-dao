/**
 * YUKI TRADING DASHBOARD — v3.0 UNIFIED BUILD
 * 
 * Architecture: File 2 (pro mode, hooks, theming, error boundaries)
 * UI DNA: File 1 (global market bar, intelligence sidebar, DEX form, alerts)
 * Charts: Real lightweight-charts integration (source-agnostic CEX/DEX)
 * 
 * View Modes:
 *   • Sections (default) — collapsible scroll layout
 *   • Workspace — tab-based terminal layout
 *   • Pro — Sections + Intelligence Stream sidebar + Global Market Bar
 * 
 * Data Sources:
 *   • CEX: Binance → Kraken → Coinbase → KuCoin (fallback chain)
 *   • DEX: DexScreener (Celo-native pairs: cUSD, cEUR, cKES, cREAL, eXOF)
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { TrendingUp, Settings, LayoutTemplate, Columns, Terminal, Bell, Zap, Activity, RotateCcw } from 'lucide-react';

// Hooks
import { useDashboardData, type DashboardData } from '../../hooks/useDashboardData';
import { useMarketData, type MarketData as MarketDataType } from '../../hooks/useMarketData';
import type { Opportunity as UIOpportunity } from './OpportunitiesSection';
import { useWatchlist } from '@/hooks/useWatchlist';
import useOHLCV, { type OHLCVTimeframe } from '../../hooks/useOHLCV';

// Components (File 2)
import BalanceHeader from './BalanceHeader';
import OpportunitiesSection from './OpportunitiesSection';
import CEXMarketsSection from './CEXMarketsSection';
import StrategiesSection from './StrategiesSection';
import PortfolioSection from './PortfolioSection';
import MarketplaceSection from './MarketplaceSection';
import MultiChainWithdrawalSection from './multichain/MultiChainWithdrawalSection';
import ProSidebar from './ProSidebar';
import CollapsibleSection from './CollapsibleSection';
import ChartsSection from './ChartsSection';



// ─── TYPES ───────────────────────────────────────────────────────────────────

type MarketData = MarketDataType;

interface WatchlistItem {
  symbol: string;
  price: number;
  change: string;
  exchanges: string[];
}

export interface OHLCVCandle {
  timestamp: number; // Unix seconds
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

type ViewMode = 'sections' | 'workspace' | 'pro';
type ActiveTab = 'overview' | 'cex' | 'dex' | 'charts' | 'watchlist' | 'opportunities' | 'strategies' | 'alerts';

// ─── MAIN COMPONENT ────────────────────────────────────────────────────────

const YukiDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { data, isLoading, error } = useDashboardData();

  // ── Persistent UI State ──
  const [proMode, setProMode] = useState<boolean>(() => {
    try { const saved = localStorage.getItem('proMode'); return saved ? JSON.parse(saved) : false; }
    catch { return false; }
  });

  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    try { const saved = localStorage.getItem('viewMode'); return (saved as ViewMode) || 'sections'; }
    catch { return 'sections'; }
  });

  const [chartTimeframe, setChartTimeframe] = useState<OHLCVTimeframe>('5m');
  const [activeTab, setActiveTab] = useState<ActiveTab>('overview');
  const [chartSymbol, setChartSymbol] = useState<string>('SOL/USDC');

  const { marketData, loading: marketLoading, error: marketError, searchPair } = useMarketData();

  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    opportunities: true,
    watchlist: false,
    cex: false,
    dex: false,
    strategies: false,
    charts: true,
    portfolio: false,
    marketplace: false,
    multichain: false,
    alerts: false,
  });

  // ── Local Data State (merged from File 1) ──
  const opportunities = data?.opportunities ?? [];

  const uiOpportunities: UIOpportunity[] = (data?.opportunities ?? []).map((op: any) => ({
    id: op.id,
    type: op.type === 'arbitrage' ? 'exchange_spread' : op.type === 'volatility' ? 'dex_spread' : 'exchange_spread',
    entryPrice: Number(op.buyPrice ?? op.price1 ?? 0),
    exitPrice: Number(op.sellPrice ?? op.price2 ?? 0),
    expectedProfit: Number(op.profitPct ?? op.profitPercent ?? 0),
    timeEstimate: 'N/A',
    gasCost: Number(op.gasCost ?? 0),
    riskLevel: op.confidence >= 0.8 ? 'Low' : op.confidence >= 0.5 ? 'Medium' : 'High',
    confidence: Number(op.confidence ?? 0),
    pair: op.symbol ?? '',
  }));

  // Use centralized watchlist hook (server-driven)
  const {
    watchlists: serverWatchlists,
    loading: watchlistLoading,
    refresh: refreshWatchlists,
    createWatchlist,
    addItem,
    removeItem,
  } = useWatchlist() as {
    watchlists: Array<{
      id: string;
      items: Array<{
        id?: string;
        item_type: string;
        target_name: string;
        liveValue?: number | null;
        metadata?: { exchanges?: string[] };
      }>;
    }>;
    loading: boolean;
    refresh: () => Promise<void>;
    createWatchlist?: (name: string) => Promise<any>;
    addItem?: (listId: string, payload: any) => Promise<void>;
    removeItem?: (itemId: string) => Promise<void>;
  };

  const { candles: chartCandles, loading: chartLoading, error: chartError, refetch: refetchChart, isRefetching: chartIsRefetching } = useOHLCV(
    chartSymbol,
    chartTimeframe,
    200,
    'auto'
  );

  useEffect(() => {
    if (chartSymbol) {
      searchPair(chartSymbol);
    }
  }, [chartSymbol, searchPair]);

  const handleChartTimeframeChange = useCallback((newTimeframe: OHLCVTimeframe) => {
    setChartTimeframe(newTimeframe);
  }, []);

  // Derive a flat symbol-only watchlist compatible with the dashboard's legacy UI
  const watchlist = useMemo(() => {
    const symbols: { symbol: string; price: number; change: string; exchanges: string[] }[] = [];
    for (const wl of serverWatchlists) {
      for (const item of wl.items) {
        if (item.item_type === 'symbol') {
          symbols.push({
            symbol: item.target_name,
            price: item.liveValue ?? 0,
            change: item.liveValue !== null ? '+0%' : '—',
            exchanges: (item.metadata && (item.metadata.exchanges || [])) || [],
          });
        }
      }
    }
    return symbols;
  }, [serverWatchlists]);

  // Ensure there is at least one watchlist to add items into
  const ensurePrimaryWatchlist = useCallback(async () => {
    if (serverWatchlists.length > 0) return serverWatchlists[0];
    const created = await createWatchlist?.('My Watchlist');
    // refresh and return first available
    await refreshWatchlists();
    return created ?? serverWatchlists[0];
  }, [serverWatchlists, createWatchlist, refreshWatchlists]);

  const addSymbolToWatchlist = useCallback(async (symbol: string) => {
    try {
      const primary = await ensurePrimaryWatchlist();
      const listId = (primary as any)?.id || (serverWatchlists[0] && serverWatchlists[0].id);
      if (!listId) return;
      await addItem?.(listId, { itemType: 'symbol', targetId: symbol });
      await refreshWatchlists();
    } catch (err) {
      console.error('Failed to add symbol to watchlist', err);
    }
  }, [ensurePrimaryWatchlist, addItem, refreshWatchlists, serverWatchlists]);

  const removeSymbolFromWatchlist = useCallback(async (symbol: string) => {
    try {
      // find the item id
      for (const wl of serverWatchlists) {
        const found = wl.items.find((i: { id?: string; item_type: string; target_name: string }) => i.item_type === 'symbol' && i.target_name === symbol);
        if (found?.id) {
          await removeItem?.(found.id);
          await refreshWatchlists();
          return;
        }
      }
    } catch (err) {
      console.error('Failed to remove symbol from watchlist', err);
    }
  }, [serverWatchlists, removeItem, refreshWatchlists]);

  // Charting is now rendered by ChartsSection, using the shared useOHLCV hook.

  // ── Callbacks ──
  const toggleSection = useCallback((sectionId: string) => {
    setExpandedSections((prev) => ({ ...prev, [sectionId]: !prev[sectionId] }));
  }, []);

  const scrollToSection = useCallback((sectionId: string) => {
    const element = document.getElementById(`section-${sectionId}`);
    if (element) {
      setExpandedSections((prev) => (prev[sectionId] ? prev : { ...prev, [sectionId]: true }));
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
      element.classList.add('highlight-glow');
      setTimeout(() => element.classList.remove('highlight-glow'), 1500);
    }
  }, []);

  const toggleProMode = useCallback(() => {
    setProMode((prev) => {
      const next = !prev;
      localStorage.setItem('proMode', JSON.stringify(next));
      if (next && viewMode === 'sections') setViewMode('pro');
      if (!next && viewMode === 'pro') setViewMode('sections');
      return next;
    });
  }, [viewMode]);

  const toggleTheme = useCallback(() => {
    const isDark = document.documentElement.classList.toggle('dark');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
  }, []);

  const setView = useCallback((mode: ViewMode) => {
    setViewMode(mode);
    localStorage.setItem('viewMode', mode);
    if (mode === 'pro') setProMode(true);
  }, []);

  const handleSelectPair = useCallback((symbol: string) => {
    setChartSymbol(symbol);
  }, []);

  // ── Hotkeys ──
  useEffect(() => {
    const handleKeydown = (e: KeyboardEvent) => {
      if (!e.ctrlKey) return;
      const activeEl = document.activeElement?.tagName;
      if (activeEl === 'INPUT' || activeEl === 'TEXTAREA' || document.activeElement?.hasAttribute('contenteditable')) return;

      const shortcuts: Record<string, string> = {
        '1': 'opportunities', '2': 'watchlist', '3': 'cex', '4': 'dex',
        '5': 'strategies', '6': 'charts', '7': 'portfolio', '8': 'marketplace', '9': 'multichain',
        'p': 'proMode', 't': 'theme', '0': 'alerts',
      };
      const action = shortcuts[e.key.toLowerCase()];
      if (!action) return;

      e.preventDefault();
      if (action === 'proMode') toggleProMode();
      else if (action === 'theme') toggleTheme();
      else if (viewMode === 'workspace') {
        const tabMap: Record<string, ActiveTab> = {
          opportunities: 'opportunities', watchlist: 'watchlist', cex: 'cex',
          dex: 'dex', strategies: 'strategies', charts: 'charts', alerts: 'alerts',
        };
        if (tabMap[action]) setActiveTab(tabMap[action]);
      } else {
        scrollToSection(action);
      }
    };
    window.addEventListener('keydown', handleKeydown);
    return () => window.removeEventListener('keydown', handleKeydown);
  }, [scrollToSection, toggleProMode, toggleTheme, viewMode]);

  // ── Error State ──
  if (error) {
    const errorMessage = typeof error === 'string' ? error : (error as any).message || 'Context system failure.';
    return (
      <div className="flex items-center justify-center h-screen bg-light-bg dark:bg-dark-bg">
        <div className="text-center max-w-sm p-6 bg-white dark:bg-dark-surface rounded-xl shadow-md border border-red-200">
          <p className="text-lg font-semibold text-red-500 mb-2">Dashboard Outage</p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">{errorMessage}</p>
          <button onClick={() => window.location.reload()} className="w-full py-2 bg-brand-blue text-white font-medium rounded-lg hover:bg-opacity-90 transition">
            Reconnect System
          </button>
        </div>
      </div>
    );
  }

  const showIntelligenceSidebar = viewMode === 'pro' || (proMode && viewMode === 'sections');
  const isWorkspace = viewMode === 'workspace';
  const isCeloPair = chartSymbol.toUpperCase().includes('CUSD') || chartSymbol.toUpperCase().includes('CEUR');

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-light-bg dark:bg-dark-bg text-gray-900 dark:text-gray-100 antialiased">
      {proMode && <ProSidebar onJump={scrollToSection} />}

      <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative">

        {/* ═══════════════════════════════════════════
            HEADER: Balance + Global Market State + View Controls
            ═══════════════════════════════════════════ */}
        <header className="sticky top-0 z-40 transform-gpu bg-white/95 dark:bg-dark-surface/95 backdrop-blur-sm border-b border-gray-200 dark:border-gray-800 transition-colors">
          <BalanceHeader data={data?.balance || undefined} isLoading={isLoading} />

          <div className="px-4 sm:px-6 lg:px-8 py-2 flex items-center justify-between bg-slate-50/80 dark:bg-slate-900/80 border-t border-gray-100 dark:border-gray-800">
            <div className="flex items-center gap-4 overflow-x-auto">
              <div className="flex items-center gap-2 text-sm">
                <TrendingUp className="h-4 w-4 text-emerald-500" />
                <span className="font-medium">Regime:</span>
                <span className="text-emerald-600 dark:text-emerald-400 font-semibold">Bull</span>
              </div>
              <div className="hidden sm:flex items-center gap-2 text-sm">
                <Activity className="h-4 w-4 text-blue-500" />
                <span className="font-medium">Vol:</span>
                <span className="text-slate-600 dark:text-slate-300">Low</span>
              </div>
              <div className="hidden sm:flex items-center gap-2 text-sm">
                <Zap className="h-4 w-4 text-amber-500" />
                <span className="font-medium">Ops:</span>
                <span className="text-amber-600 dark:text-amber-400 font-semibold">{opportunities.length}</span>
              </div>
              <div className="hidden md:flex items-center gap-2 text-sm">
                <span className="text-slate-400">|</span>
                <span className="text-xs text-slate-500 dark:text-slate-400">24h Vol: $2.4B</span>
                <span className="text-xs text-green-500">Top Gainer: +24.5%</span>
              </div>
              {/* Chart source/metrics shown inside the ChartsSection */}
            </div>

            <div className="flex items-center gap-2">
              <div className="flex bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
                <button onClick={() => setView('sections')} className={`px-2 py-1 rounded text-xs font-medium transition ${viewMode === 'sections' ? 'bg-white dark:bg-gray-700 shadow-sm text-brand-blue' : 'text-gray-500 hover:text-gray-700'}`}>
                  <LayoutTemplate className="h-3.5 w-3.5 inline mr-1" />Sections
                </button>
                <button onClick={() => setView('workspace')} className={`px-2 py-1 rounded text-xs font-medium transition ${viewMode === 'workspace' ? 'bg-white dark:bg-gray-700 shadow-sm text-brand-blue' : 'text-gray-500 hover:text-gray-700'}`}>
                  <Terminal className="h-3.5 w-3.5 inline mr-1" />Workspace
                </button>
                <button onClick={() => setView('pro')} className={`px-2 py-1 rounded text-xs font-medium transition ${viewMode === 'pro' ? 'bg-white dark:bg-gray-700 shadow-sm text-brand-blue' : 'text-gray-500 hover:text-gray-700'}`}>
                  <Columns className="h-3.5 w-3.5 inline mr-1" />Pro
                </button>
              </div>
              <button onClick={toggleTheme} className="p-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition" title="Toggle Theme (Ctrl+T)">
                <Settings className="h-4 w-4 text-gray-500" />
              </button>
            </div>
          </div>
        </header>

        {/* ═══════════════════════════════════════════
            MAIN CONTENT
            ═══════════════════════════════════════════ */}
        <div className="flex flex-1 overflow-hidden">

          <div className={`flex-1 overflow-y-auto ${showIntelligenceSidebar ? 'lg:mr-80' : ''}`}>
            <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">

              {isLoading ? (
                <div className="flex flex-col items-center justify-center py-32 space-y-4">
                  <div className="animate-spin rounded-full h-10 w-10 border-2 border-brand-blue border-t-transparent" />
                  <p className="text-xs text-gray-400 tracking-widest uppercase">Hydrating Exchange Context...</p>
                </div>
              ) : isWorkspace ? (
                <WorkspaceLayout
                  activeTab={activeTab}
                  setActiveTab={setActiveTab}
                  watchlist={watchlist}
                  onAddSymbol={addSymbolToWatchlist}
                  onRemoveSymbol={removeSymbolFromWatchlist}
                  opportunities={uiOpportunities}
                  marketData={marketData}
                  chartSymbol={chartSymbol}
                  chartTimeframe={chartTimeframe}
                  setChartTimeframe={handleChartTimeframeChange}
                  chartCandles={chartCandles ?? undefined}
                  chartError={chartError}
                  chartIsRefetching={chartIsRefetching}
                  refetchChart={refetchChart}
                  data={data}
                  navigate={navigate}
                  onSelectPair={handleSelectPair}
                />
              ) : (
                <>
                  <section id="section-opportunities" className="scroll-mt-24 transition-all">
                    <OpportunitiesSection opportunities={uiOpportunities} onSelectOpportunity={(opp) => console.log('Active Lead:', opp)} />
                  </section>

                  <section id="section-watchlist" className="scroll-mt-24">
                    <CollapsibleSection id="watchlist" title="⭐ WATCHLIST" expanded={expandedSections.watchlist} onToggle={() => toggleSection('watchlist')}>
                      <WatchlistManager watchlist={watchlist} onAddSymbol={addSymbolToWatchlist} onRemoveSymbol={removeSymbolFromWatchlist} onSelectPair={handleSelectPair} />
                    </CollapsibleSection>
                  </section>

                  <section id="section-cex" className="scroll-mt-24">
                    <CollapsibleSection id="cex" title="🏦 CEX MARKETS" expanded={expandedSections.cex} onToggle={() => toggleSection('cex')}>
                      <CEXMarketsSection markets={data?.cexMarkets || []} onSelectMarket={(market: any) => {
                      const symbol = market?.symbol || market?.pair;
                      if (symbol) {
                        handleSelectPair(symbol);
                        console.log(market);
                      }
                    }} />
                    </CollapsibleSection>
                  </section>

                  <section id="section-dex" className="scroll-mt-24">
                    <CollapsibleSection id="dex" title="🔄 DEX SWAPS" expanded={expandedSections.dex} onToggle={() => toggleSection('dex')}>
                      <DexSwapForm />
                    </CollapsibleSection>
                  </section>

                  <section id="section-strategies" className="scroll-mt-24">
                    <CollapsibleSection id="strategies" title="🤖 STRATEGIES" expanded={expandedSections.strategies} onToggle={() => toggleSection('strategies')}>
                      <StrategiesSection strategies={data?.strategies || []} onDeployStrategy={(s) => console.log(s)} />
                    </CollapsibleSection>
                  </section>

                  <section id="section-charts" className="scroll-mt-24">
                    <CollapsibleSection id="charts" title={`📊 CHARTS — ${chartSymbol}`} expanded={expandedSections.charts} onToggle={() => toggleSection('charts')}>
                      <ChartsSection
                        selectedPair={chartSymbol}
                        timeframe={chartTimeframe}
                        candles={chartCandles ?? undefined}
                        onTimeframeChange={handleChartTimeframeChange}
                        onRefresh={refetchChart}
                        isRefreshing={chartIsRefetching}
                        error={chartError}
                      />
                    </CollapsibleSection>
                  </section>

                  <section id="section-alerts" className="scroll-mt-24">
                    <CollapsibleSection id="alerts" title="🔔 ALERTS & SIGNALS" expanded={expandedSections.alerts} onToggle={() => toggleSection('alerts')}>
                      <AlertsFeed />
                    </CollapsibleSection>
                  </section>

                  <section id="section-portfolio" className="scroll-mt-24">
                    <CollapsibleSection id="portfolio" title="💼 PORTFOLIO" expanded={expandedSections.portfolio} onToggle={() => toggleSection('portfolio')}>
                      <PortfolioSection holdings={data?.portfolio || []} totalValue={data?.balance?.totalValue || 0} />
                    </CollapsibleSection>
                  </section>

                  <section id="section-marketplace" className="scroll-mt-24">
                    <CollapsibleSection id="marketplace" title="🏆 MARKETPLACE" expanded={expandedSections.marketplace} onToggle={() => toggleSection('marketplace')}>
                      <MarketplaceSection strategies={data?.marketplaceStrategies || []} onCopyStrategy={(s) => console.log(s)} />
                    </CollapsibleSection>
                  </section>

                  <section id="section-multichain" className="scroll-mt-24">
                    <CollapsibleSection id="multichain" title="🌉 MULTI-CHAIN WITHDRAWALS" expanded={expandedSections.multichain} onToggle={() => toggleSection('multichain')}>
                      <MultiChainWithdrawalSection />
                    </CollapsibleSection>
                  </section>
                </>
              )}
            </div>

            <footer className="bg-gray-50 dark:bg-dark-surface border-t border-gray-200 dark:border-gray-800 py-3 px-6 text-xs text-gray-500 flex justify-between items-center z-10 mt-6">
              <p>Yuki Engine Framework v3.0 • Sync: {new Date().toLocaleTimeString()}</p>
              {proMode && <span className="text-brand-blue font-semibold animate-pulse">PRO CONSOLE</span>}
            </footer>
          </div>

          {/* Intelligence Stream Sidebar */}
          {showIntelligenceSidebar && (
            <aside className="hidden lg:block w-80 fixed right-0 top-[105px] bottom-0 overflow-y-auto border-l border-gray-200 dark:border-gray-800 bg-gray-50/95 dark:bg-dark-surface/95 backdrop-blur-sm z-30">
              <div className="p-4 space-y-4">

                {/* Current Chart Info (summary only) */}
                <div className="bg-white dark:bg-gray-800/60 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-semibold text-sm">Active Chart</h4>
                  </div>
                  <div className="text-2xl font-bold text-gray-900 dark:text-white">{chartSymbol}</div>
                  <div className="text-xs text-gray-500 mt-1">{chartTimeframe}</div>
                  <div className="mt-2 text-xs text-gray-500">Chart render and OHLC sources are hosted in the Trading Terminal.</div>
                </div>

                {/* Signals & Alerts */}
                <div className="bg-white dark:bg-gray-800/60 rounded-lg border border-gray-200 dark:border-gray-700 p-4 text-sm">
                  <div className="flex items-center gap-2 mb-3">
                    <Bell className="h-4 w-4 text-yellow-500" />
                    <h4 className="font-semibold">Signals & Alerts</h4>
                  </div>
                  <div className="space-y-2">
                    <div className="p-2.5 bg-gray-50 dark:bg-gray-900 rounded border-l-2 border-yellow-500">
                      <p className="font-semibold text-yellow-600 dark:text-yellow-400 text-xs">⚠️ Volatility Alert</p>
                      <p className="text-xs text-gray-600 dark:text-gray-300 mt-0.5">ETH/USDT experiencing 5.2% movement</p>
                    </div>
                    <div className="p-2.5 bg-gray-50 dark:bg-gray-900 rounded border-l-2 border-green-500">
                      <p className="font-semibold text-green-600 dark:text-green-400 text-xs">✓ Buy Signal</p>
                      <p className="text-xs text-gray-600 dark:text-gray-300 mt-0.5">BTC/USDT crossed above MA50</p>
                    </div>
                    <div className="p-2.5 bg-gray-50 dark:bg-gray-900 rounded border-l-2 border-blue-500">
                      <p className="font-semibold text-blue-600 dark:text-blue-400 text-xs">ℹ️ Funding Alert</p>
                      <p className="text-xs text-gray-600 dark:text-gray-300 mt-0.5">SOL funding rate turning negative</p>
                    </div>
                  </div>
                </div>

                {/* Opportunity Feed */}
                <div className="bg-white dark:bg-gray-800/60 rounded-lg border border-gray-200 dark:border-gray-700 p-4 text-sm">
                  <div className="flex items-center gap-2 mb-3">
                    <Zap className="h-4 w-4 text-amber-500" />
                    <h4 className="font-semibold">Opportunity Feed</h4>
                  </div>
                  <div className="space-y-2">
                    {uiOpportunities.length > 0 ? uiOpportunities.map((op) => (
                      <div key={op.id || op.pair} className="p-3 bg-gray-50 dark:bg-gray-900 rounded flex items-start justify-between hover:bg-gray-100 dark:hover:bg-gray-800 transition cursor-pointer">
                        <div className="min-w-0">
                          <div className="text-sm font-medium truncate">{op.pair}</div>
                          <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{op.type}</div>
                          {op.expectedProfit != null && <div className="text-xs text-emerald-500 mt-1">+${op.expectedProfit} est.</div>}
                        </div>
                        <div className={`shrink-0 ml-2 px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          op.riskLevel === 'High' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                          op.riskLevel === 'Medium' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' :
                          'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                        }`}>{op.riskLevel || 'Low'}</div>
                      </div>
                    )) : (
                      <div className="text-gray-500 dark:text-gray-400 text-xs py-2">No opportunities detected — scanner idle.</div>
                    )}
                  </div>
                </div>

                {/* Strategy Triggers */}
                <div className="bg-white dark:bg-gray-800/60 rounded-lg border border-gray-200 dark:border-gray-700 p-4 text-sm">
                  <div className="flex items-center gap-2 mb-3">
                    <Activity className="h-4 w-4 text-purple-500" />
                    <h4 className="font-semibold">Strategy Triggers</h4>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-900 rounded text-xs">
                      <span className="text-gray-600 dark:text-gray-300">Mean Reversion #4</span>
                      <span className="text-emerald-500 font-medium">FILLED</span>
                    </div>
                    <div className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-900 rounded text-xs">
                      <span className="text-gray-600 dark:text-gray-300">Grid Bot SOL</span>
                      <span className="text-blue-500 font-medium">ACTIVE</span>
                    </div>
                    <div className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-900 rounded text-xs">
                      <span className="text-gray-600 dark:text-gray-300">Arb Scanner</span>
                      <span className="text-gray-400 font-medium">IDLE</span>
                    </div>
                  </div>
                </div>

                {/* Quick Stats */}
                <div className="bg-white dark:bg-gray-800/60 rounded-lg border border-gray-200 dark:border-gray-700 p-4 text-sm">
                  <h4 className="font-semibold mb-2">Quick Stats</h4>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="p-2 bg-gray-50 dark:bg-gray-900 rounded">
                      <div className="text-gray-500">24h Volume</div>
                      <div className="font-bold text-sm">$2.4B</div>
                    </div>
                    <div className="p-2 bg-gray-50 dark:bg-gray-900 rounded">
                      <div className="text-gray-500">Portfolio</div>
                      <div className="font-bold text-sm">$124.5K</div>
                    </div>
                    <div className="p-2 bg-gray-50 dark:bg-gray-900 rounded">
                      <div className="text-gray-500">Open Orders</div>
                      <div className="font-bold text-sm">12</div>
                    </div>
                    <div className="p-2 bg-gray-50 dark:bg-gray-900 rounded">
                      <div className="text-gray-500">PnL Today</div>
                      <div className="font-bold text-sm text-emerald-500">+$1,240</div>
                    </div>
                  </div>
                </div>
              </div>
            </aside>
          )}
        </div>
      </main>

      {/* Floating Console Panel */}
      {proMode && (
        <div className="fixed bottom-4 right-4 bg-white dark:bg-dark-surface rounded-xl shadow-2xl p-4 max-w-xs border border-gray-200 dark:border-gray-800 z-50 transform-gpu transition-all">
          <h3 className="font-bold mb-2 tracking-wider text-xs uppercase opacity-70">Console Controls</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-600 dark:text-gray-300">View Mode</span>
              <span className="font-mono text-brand-blue">{viewMode.toUpperCase()}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-600 dark:text-gray-300">Chart Source</span>
              <span className="font-mono text-brand-blue">—</span>
            </div>
            <label className="flex items-center text-xs font-medium cursor-pointer">
              <input type="checkbox" checked={document.documentElement.classList.contains('dark')} onChange={toggleTheme} className="rounded border-gray-300 dark:border-gray-700 text-brand-blue focus:ring-brand-blue mr-2 h-3.5 w-3.5" />
              System Dark Protocol
            </label>
            <button onClick={toggleProMode} className="w-full text-center py-1 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 rounded text-xs font-semibold transition">
              Exit Pro Mode (Ctrl+P)
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// WORKSPACE LAYOUT
// ═══════════════════════════════════════════════════════════════════════════════

const WorkspaceLayout: React.FC<{
  activeTab: ActiveTab;
  setActiveTab: (t: ActiveTab) => void;
  watchlist: WatchlistItem[];
  onAddSymbol?: (symbol: string) => void;
  onRemoveSymbol?: (symbol: string) => void;
  opportunities: UIOpportunity[];
  marketData: MarketData | null;
  chartSymbol: string;
  chartTimeframe: OHLCVTimeframe;
  setChartTimeframe: (t: OHLCVTimeframe) => void;
  chartCandles: Array<OHLCVCandle> | undefined;
  chartError: string | null;
  chartIsRefetching: boolean;
  refetchChart: () => Promise<void>;
  data: any;
  navigate: ReturnType<typeof useNavigate>;
  onSelectPair: (symbol: string) => void;
}> = ({ activeTab, setActiveTab, watchlist, onAddSymbol, onRemoveSymbol, opportunities, marketData, chartSymbol, chartTimeframe, setChartTimeframe, chartCandles, chartError, chartIsRefetching, refetchChart, data, navigate, onSelectPair }) => {
  const tabs: { id: ActiveTab; label: string }[] = [
    { id: 'overview', label: '📊 Overview' },
    { id: 'opportunities', label: '⚡ Opportunities' },
    { id: 'cex', label: '🏦 CEX' },
    { id: 'dex', label: '🔄 DEX' },
    { id: 'charts', label: '📈 Charts' },
    { id: 'watchlist', label: '⭐ Watchlist' },
    { id: 'strategies', label: '🤖 Strategies' },
    { id: 'alerts', label: '🔔 Alerts' },
  ];

  const isCeloPair = chartSymbol.toUpperCase().includes('CUSD') || chartSymbol.toUpperCase().includes('CEUR');

  return (
    <div className="space-y-4">
      <div className="bg-white dark:bg-dark-surface border border-gray-200 dark:border-gray-700 rounded-lg p-2 flex items-center overflow-x-auto">
        <div className="flex gap-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-3 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${
                activeTab === tab.id ? 'bg-brand-blue text-white shadow-sm' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white dark:bg-dark-surface border border-gray-200 dark:border-gray-700 rounded-lg p-6 min-h-[500px]">
        {activeTab === 'overview' && <OverviewSection watchlist={watchlist} marketData={marketData} opportunities={opportunities} />}
        {activeTab === 'opportunities' && <OpportunitiesSection opportunities={(data?.opportunities as any) || opportunities} onSelectOpportunity={(opp) => console.log('Active Lead:', opp)} />}
        {activeTab === 'cex' && <CEXMarketsSection markets={data?.cexMarkets || []} onSelectMarket={(m: any) => { onSelectPair(m.symbol || m.pair); console.log(m); }} />}
        {activeTab === 'dex' && <DexSwapForm />}
        {activeTab === 'charts' && (
          <ChartsSection
            selectedPair={chartSymbol}
            timeframe={chartTimeframe}
            candles={chartCandles}
            onTimeframeChange={setChartTimeframe}
            onRefresh={refetchChart}
            isRefreshing={chartIsRefetching}
            error={chartError}
          />
        )}
        {activeTab === 'watchlist' && <WatchlistManager watchlist={watchlist} onAddSymbol={onAddSymbol} onRemoveSymbol={onRemoveSymbol} onSelectPair={onSelectPair} />}
        {activeTab === 'strategies' && <StrategiesSection strategies={data?.strategies || []} onDeployStrategy={(s) => console.log(s)} />}
        {activeTab === 'alerts' && <AlertsFeed />}
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// MERGED COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════════

const OverviewSection: React.FC<{ watchlist: WatchlistItem[]; marketData: MarketData | null; opportunities?: UIOpportunity[] }> = ({ watchlist, opportunities }) => (
  <div className="space-y-6">
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <div className="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
        <p className="text-sm text-gray-500 dark:text-gray-400">24h Volume</p>
        <p className="text-2xl font-bold mt-1 text-gray-900 dark:text-white">$2.4B</p>
      </div>
      <div className="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
        <p className="text-sm text-gray-500 dark:text-gray-400">Top Gainers</p>
        <p className="text-2xl font-bold text-emerald-500 mt-1">+24.5%</p>
      </div>
      <div className="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
        <p className="text-sm text-gray-500 dark:text-gray-400">Portfolio Value</p>
        <p className="text-2xl font-bold mt-1 text-gray-900 dark:text-white">$124,500</p>
      </div>
    </div>

    <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
      <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Watchlist Summary</h3>
      <div className="space-y-3">
        {watchlist.map((item) => (
          <div key={item.symbol} className="flex items-center justify-between p-3 bg-white dark:bg-gray-900 rounded border border-gray-200 dark:border-gray-700">
            <div>
              <p className="font-semibold text-gray-900 dark:text-white">{item.symbol}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">{item.exchanges.join(', ')}</p>
            </div>
            <div className="text-right">
              <p className="font-semibold text-gray-900 dark:text-white">${item.price.toLocaleString()}</p>
              <p className={`text-sm font-medium ${item.change.startsWith('+') ? 'text-emerald-500' : 'text-red-500'}`}>{item.change}</p>
            </div>
          </div>
        ))}
      </div>
    </div>

    {opportunities && opportunities.length > 0 && (
      <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Top Opportunities</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {opportunities!.slice(0, 3).map((op) => (
            <div key={op.id} className="p-4 bg-white dark:bg-gray-900 rounded border border-gray-200 dark:border-gray-700">
              <div className="flex justify-between items-start mb-2">
                <span className="font-semibold text-sm text-gray-900 dark:text-white">{op.pair}</span>
                <span className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase ${
                  op.riskLevel === 'High' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                  op.riskLevel === 'Medium' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' :
                  'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                }`}>{op.riskLevel}</span>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400">{op.type}</p>
            </div>
          ))}
        </div>
      </div>
    )}
  </div>
);

const DexSwapForm: React.FC = () => {
  const [fromToken, setFromToken] = useState('ETH');
  const [toToken, setToToken] = useState('USDC');
  const [amount, setAmount] = useState('1');
  const [swapLoading, setSwapLoading] = useState(false);

  const handleSwap = async () => {
    setSwapLoading(true);
    try {
      console.log('Executing swap:', { fromToken, toToken, amount });
      await new Promise(r => setTimeout(r, 1000));
    } catch (error) {
      console.error('Swap failed:', error);
    } finally {
      setSwapLoading(false);
    }
  };

  return (
    <div className="max-w-md">
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">From</label>
          <input type="text" value={fromToken} onChange={(e) => setFromToken(e.target.value)}
            className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-blue outline-none transition" placeholder="Token symbol" />
        </div>
        <div className="flex justify-center">
          <div className="p-2 rounded-full bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
            <TrendingUp className="h-4 w-4 text-gray-400 rotate-90" />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">To</label>
          <input type="text" value={toToken} onChange={(e) => setToToken(e.target.value)}
            className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-blue outline-none transition" placeholder="Token symbol" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Amount</label>
          <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)}
            className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-blue outline-none transition" placeholder="0.00" />
        </div>
        <div className="p-3 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 text-xs text-gray-500 dark:text-gray-400 flex justify-between">
          <span>Est. Received</span>
          <span className="font-medium text-gray-900 dark:text-white">1,847.32 USDC</span>
        </div>
        <button onClick={handleSwap} disabled={swapLoading}
          className="w-full px-4 py-2.5 rounded-lg bg-brand-blue hover:bg-blue-700 disabled:bg-gray-300 dark:disabled:bg-gray-700 text-white transition-colors font-semibold shadow-sm">
          {swapLoading ? 'Executing Swap...' : 'Execute Swap'}
        </button>
      </div>
    </div>
  );
};

const WatchlistManager: React.FC<{
  watchlist: WatchlistItem[];
  onAddSymbol?: (symbol: string) => void;
  onRemoveSymbol?: (symbol: string) => void;
  onSelectPair?: (symbol: string) => void;
}> = ({ watchlist, onAddSymbol, onRemoveSymbol, onSelectPair }) => {
  const [newToken, setNewToken] = useState('');

  const addToWatchlist = () => {
    if (newToken) {
      onAddSymbol?.(newToken.toUpperCase());
      setNewToken('');
    }
  };

  const removeToken = (symbol: string) => {
    onRemoveSymbol?.(symbol);
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <input type="text" value={newToken} onChange={(e) => setNewToken(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addToWatchlist()}
          placeholder="Add token symbol (e.g. BTC/USDT)..."
          className="flex-1 px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-blue outline-none transition" />
        <button onClick={addToWatchlist} className="px-4 py-2 rounded-lg bg-brand-blue hover:bg-blue-700 text-white font-medium transition">Add</button>
      </div>
      <div className="space-y-2">
        {watchlist.map((item) => (
          <div key={item.symbol} className="p-3 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 flex justify-between items-center group">
            <div className="flex items-center gap-3">
              {onSelectPair && (
                <button onClick={() => onSelectPair(item.symbol)} className="p-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition" title="Chart this pair">
                  <Activity className="h-3.5 w-3.5 text-gray-400" />
                </button>
              )}
              <div>
                <p className="font-semibold text-gray-900 dark:text-white">{item.symbol}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">{item.exchanges.join(', ') || 'All exchanges'}</p>
              </div>
            </div>
            <div className="text-right flex items-center gap-4">
              <div>
                <p className="font-semibold text-gray-900 dark:text-white">${item.price ? item.price.toLocaleString() : '—'}</p>
                <p className={`text-sm font-medium ${item.change.startsWith('+') ? 'text-emerald-500' : 'text-red-500'}`}>{item.change}</p>
              </div>
              <button onClick={() => removeToken(item.symbol)}
                className="opacity-0 group-hover:opacity-100 p-1.5 rounded hover:bg-red-100 dark:hover:bg-red-900/30 text-red-500 transition" title="Remove">
                ×
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const AlertsFeed: React.FC = () => (
  <div className="space-y-3">
    <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg border-l-4 border-yellow-500">
      <div className="flex items-center gap-2 mb-1">
        <Bell className="h-4 w-4 text-yellow-500" />
        <p className="font-semibold text-yellow-600 dark:text-yellow-400">Volatility Alert</p>
      </div>
      <p className="text-sm text-gray-600 dark:text-gray-300">ETH/USDT experiencing 5.2% movement in the last 15 minutes. Consider adjusting stop-losses.</p>
      <div className="mt-2 flex gap-2">
        <button className="text-xs px-2 py-1 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 rounded font-medium">View Chart</button>
        <button className="text-xs px-2 py-1 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded font-medium">Dismiss</button>
      </div>
    </div>
    <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg border-l-4 border-emerald-500">
      <div className="flex items-center gap-2 mb-1">
        <TrendingUp className="h-4 w-4 text-emerald-500" />
        <p className="font-semibold text-emerald-600 dark:text-emerald-400">Buy Signal</p>
      </div>
      <p className="text-sm text-gray-600 dark:text-gray-300">BTC/USDT crossed above MA50 on 4h timeframe. RSI at 58 — room to run.</p>
      <div className="mt-2 flex gap-2">
        <button className="text-xs px-2 py-1 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 rounded font-medium">Create Order</button>
        <button className="text-xs px-2 py-1 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded font-medium">Dismiss</button>
      </div>
    </div>
    <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg border-l-4 border-blue-500">
      <div className="flex items-center gap-2 mb-1">
        <Zap className="h-4 w-4 text-blue-500" />
        <p className="font-semibold text-blue-600 dark:text-blue-400">Arbitrage Detected</p>
      </div>
      <p className="text-sm text-gray-600 dark:text-gray-300">SOL/USDC spread: 1.8% between Binance and Jupiter. Estimated profit: $180 after fees.</p>
      <div className="mt-2 flex gap-2">
        <button className="text-xs px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded font-medium">Execute Arb</button>
        <button className="text-xs px-2 py-1 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded font-medium">Dismiss</button>
      </div>
    </div>
  </div>
);

export default YukiDashboard;
