/**
 * TradingDashboard Component
 * Main entry point for trading operations
 * Displays all open orders/positions across all exchanges
 * Supports all market types with real-time updates
 * Includes tabs: Quick Order, Smart Routing, History
 * 
 * CONNECTED TO: Trading Account System via TradingAccountProvider
 * - Manages exchange connections
 * - Tracks balances, positions, and orders across all connected exchanges
 * - Provides real-time updates every 30 seconds
 * - Handles order placement, cancellation, and position closing
 */

import React, { useState, useMemo } from 'react';
import {
  useOpenOrders,
  usePositions,
  useTradingMetrics,
  useTradeHistory,
  useHasConnectedExchanges,
} from '../../src/hooks/useTrading';
import { useTradingAccount } from '../../src/contexts/trading-account-context';

type MarketType = 'margin' | 'futures' | 'swap';
import OrderListPanel from './OrderListPanel';
import PositionsPanel from './PositionsPanel';
import QuickOrderPanel from './QuickOrderPanel';
import PortfolioMetricsPanel from './PortfolioMetricsPanel';
import AdvancedOrderPanel from './AdvancedOrderPanel';
import SmartRouterUI from './SmartRouterUI';
import Shell from '../../src/components/ui/shell';
import { Grid } from '../../src/components/ui/grid';
import { OrderExecutionStatus } from '../strategies/OrderExecutionStatus';

type TabType = 'all' | 'spot' | 'margin' | 'futures' | 'swap';
type MainTab = 'quick' | 'smart-routing' | 'history';

export default function TradingDashboard() {
  const [activeTab, setActiveTab] = useState<TabType>('all');
  const [mainTab, setMainTab] = useState<MainTab>('quick');
  const [selectedExchange, setSelectedExchange] = useState<string>('all');
  const [showOrderPanel, setShowOrderPanel] = useState(false);
  const [smartRoutingPair, setSmartRoutingPair] = useState('BTC/USDT');
  const [smartRoutingQty, setSmartRoutingQty] = useState(0.1);
  const [smartRoutingSide, setSmartRoutingSide] = useState<'BUY' | 'SELL'>('BUY');

  // Get trading account data
  const { connectedExchanges, balances, isLoading: accountLoading, error: accountError } = useTradingAccount();
  const hasExchanges = useHasConnectedExchanges();

  // Fetch data from hooks (automatically connected to trading account)
  const { orders: openOrders, loading: ordersLoading, error: ordersError } = useOpenOrders(
    selectedExchange === 'all' ? undefined : selectedExchange
  );
  const { positions, loading: positionsLoading, metrics: positionMetrics } = usePositions(
    selectedExchange === 'all' ? undefined : selectedExchange
  );
  const { metrics, loading: metricsLoading } = useTradingMetrics();
  
  // Load unified trade history (manual + bot + strategy trades)
  const { trades, loading: historyLoading } = useTradeHistory();

  // Filter orders by market type
  const filteredOrders = useMemo(() => {
    if (activeTab === 'all') return openOrders;
    return openOrders.filter((order: any) => order.marketType === activeTab);
  }, [openOrders, activeTab]);

  // Filter positions by market type
  const filteredPositions = useMemo(() => {
    if (activeTab === 'all') return positions;
    const marketTypeMap: { [key in TabType]: MarketType[] } = {
      all: ['margin', 'futures', 'swap'],
      spot: [],
      margin: ['margin'],
      futures: ['futures'],
      swap: ['swap'],
    };
    const marketTypes = marketTypeMap[activeTab];
    return positions.filter((p: any) => marketTypes.includes(p.marketType));
  }, [positions, activeTab]);

  // Get unique exchanges
  const exchanges = useMemo(() => {
    const set = new Set([...openOrders, ...positions].map((item) => item.exchange));
    return ['all', ...Array.from(set)];
  }, [openOrders, positions]);

  // Loading state
  const isLoading = ordersLoading || positionsLoading || metricsLoading;
  // Lightweight Top Strip: operational heartbeat (Layer 1)
  const TopStrip = () => {
    const totalEquity = metrics?.totalBalance ?? 0;
    const unrealized = metrics?.unrealizedPnl ?? 0;
    const marginHealth = (metrics as any)?.marginHealth ?? 'OK';
    const risk = (metrics as any)?.riskScore ?? 0;
    const exposure = positionMetrics?.totalExposure ?? 0;

    return (
      <div className="w-full bg-slate-800/40 border-b border-slate-700 text-slate-300 text-sm py-2 px-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-6">
          <div className="flex flex-col">
            <span className="text-xs text-slate-400">Equity</span>
            <span className="font-semibold">${totalEquity?.toLocaleString?.() ?? 0}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-xs text-slate-400">Unrealized PnL</span>
            <span className={`font-semibold ${unrealized >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>${unrealized}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-xs text-slate-400">Margin</span>
            <span className="font-semibold">{marginHealth}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-xs text-slate-400">Risk</span>
            <span className="font-semibold text-amber-400">{risk}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-xs text-slate-400">Exposure</span>
            <span className="font-semibold">${exposure?.toLocaleString?.() ?? 0}</span>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-xs text-slate-400">Exchanges</div>
          <div className="px-2 py-1 rounded text-xs bg-slate-700 text-white">{connectedExchanges.length}</div>
        </div>
      </div>
    );
  };

  // Active Context (Layer 2) — highlights positions and key exposure
  const ActiveContext = () => {
    const largest = positions.sort((a: any, b: any) => Math.abs(b.pnl) - Math.abs(a.pnl))[0];

    return (
      <div className="w-full bg-slate-800/30 border border-slate-700 rounded-lg p-4 mb-4 text-slate-200">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs text-slate-400">Active Positions</div>
            <div className="font-semibold text-lg">{positions.length} open</div>
          </div>
          <div className="text-right">
            <div className="text-xs text-slate-400">Largest Exposure</div>
            <div className="font-semibold">{largest ? `${largest.symbol} · ${Math.abs(largest.pnl).toFixed(2)}` : '—'}</div>
          </div>
        </div>
      </div>
    );
  };

  // Execution Surface (Layer 3) — focused controls for execution
  const ExecutionSurface = () => (
    <div className="w-full bg-slate-800/20 border border-slate-700 rounded-lg p-4 mb-6">
      <div className="flex flex-col lg:flex-row gap-4">
        <div className="flex-1">
          <div className="text-xs text-slate-400 mb-2">Quick Order</div>
          <div className="bg-slate-900/60 p-3 rounded"> 
            <QuickOrderPanel onClose={() => setShowOrderPanel(false)} selectedExchange={selectedExchange} />
          </div>
        </div>

        <div className="w-full lg:w-96">
          <div className="text-xs text-slate-400 mb-2">Smart Routing</div>
          <div className="bg-slate-900/60 p-3 rounded">
            <SmartRouterUI pair={smartRoutingPair} quantity={smartRoutingQty} side={smartRoutingSide} />
          </div>
        </div>
      </div>
    </div>
  );

  // Information Streams (Layer 4) — live lists, dense and readable
  const InformationStreams = () => (
    <div className="w-full grid grid-cols-1 lg:grid-cols-3 gap-4">
      <div className="col-span-1">
        <div className="text-xs text-slate-400 mb-2">Orders</div>
        <div className="bg-slate-900/40 border border-slate-700 rounded p-3">
          <OrderListPanel
            orders={filteredOrders}
            loading={ordersLoading}
            selectedExchange={selectedExchange}
            marketType={activeTab === 'all' ? undefined : (activeTab as MarketType)}
          />
        </div>
      </div>

      <div className="col-span-1">
        <div className="text-xs text-slate-400 mb-2">Positions</div>
        <div className="bg-slate-900/40 border border-slate-700 rounded p-3">
          <PositionsPanel positions={filteredPositions} loading={positionsLoading} metrics={positionMetrics} />
        </div>
      </div>

      <div className="col-span-1">
        <div className="text-xs text-slate-400 mb-2">Execution History</div>
        <div className="bg-slate-900/40 border border-slate-700 rounded p-3">
          <OrderExecutionStatus trades={trades} isLoading={historyLoading} />
        </div>
      </div>
    </div>
  );

  return (
    <Shell
      brand={
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">Trading Dashboard</h1>
          <p className="text-slate-400">Manage orders and positions across all exchanges</p>
        </div>
      }
      primaryNav={
        <div className="p-4 text-sm text-slate-300"> 
          {/* Place sidebar navigation items here or replace with SidebarMenu components */}
          <nav aria-label="Trading navigation"> 
            <ul className="space-y-2">
              <li className="font-medium">Overview</li>
              <li className="font-medium">Orders</li>
              <li className="font-medium">Positions</li>
              <li className="font-medium">History</li>
            </ul>
          </nav>
        </div>
      }
    >
      {/* Layer 1 — Top strip / operational heartbeat */}
      <TopStrip />

      {/* Small portfolio metrics summary (tonal) */}
      <div className="mb-4">
        <PortfolioMetricsPanel metrics={metrics} loading={metricsLoading} />
      </div>

      {/* Layer 2 — Active Context */}
      <ActiveContext />

      {/* Layer 3 — Execution Surface */}
      <ExecutionSurface />

      {/* Main Navigation Tabs (reduced visual weight) */}
      <div className="bg-slate-800/10 rounded-lg border border-slate-700 p-4 mb-6">
          <div className="flex gap-2 mb-4 border-b border-slate-700 pb-4">
            <button
              onClick={() => setMainTab('quick')}
              className={`px-6 py-2 rounded-lg font-semibold transition-all ${
                mainTab === 'quick'
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              }`}
            >
              📝 Quick Order
            </button>
            <button
              onClick={() => setMainTab('smart-routing')}
              className={`px-6 py-2 rounded-lg font-semibold transition-all ${
                mainTab === 'smart-routing'
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              }`}
            >
              🚀 Smart Routing
            </button>
            <button
              onClick={() => setMainTab('history')}
              className={`px-6 py-2 rounded-lg font-semibold transition-all ${
                mainTab === 'history'
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              }`}
            >
              📊 History
            </button>
          </div>

          {/* Controls for Quick Order and History tabs */}
          {mainTab !== 'smart-routing' && (
            <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
              {/* Market Type Tabs */}
              <div className="flex gap-2">
                {(['all', 'spot', 'margin', 'futures', 'swap'] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`px-4 py-2 rounded-lg font-semibold transition-all text-sm ${
                      activeTab === tab
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                    }`}
                  >
                    {tab.charAt(0).toUpperCase() + tab.slice(1)}
                  </button>
                ))}
              </div>

              {/* Exchange Filter */}
              <select
                aria-label="Filter by exchange"
                value={selectedExchange}
                onChange={(e) => setSelectedExchange(e.target.value)}
                className="px-4 py-2 rounded-lg bg-slate-700 text-white border border-slate-600 focus:border-blue-500 focus:outline-none text-sm"
              >
                {exchanges.map((exchange) => (
                  <option key={exchange} value={exchange}>
                    {exchange === 'all' ? 'All Exchanges' : exchange.charAt(0).toUpperCase() + exchange.slice(1)}
                  </option>
                ))}
              </select>

              {/* Place Order Button (Quick Tab Only) */}
              {mainTab === 'quick' && (
                <button
                  onClick={() => setShowOrderPanel(!showOrderPanel)}
                  className="px-4 py-1 rounded-lg bg-slate-700 text-white font-medium text-sm"
                >
                  {showOrderPanel ? 'Close' : 'Place Order'}
                </button>
              )}
            </div>
          )}
          {/* If the user has no exchanges connected show a subdued empty state */}
          {(!hasExchanges) && (
            <div className="mt-6 text-center py-8 bg-slate-800/20 rounded-lg border border-slate-700">
              <p className="text-slate-400 mb-4">No trading exchanges connected — connect to begin.</p>
              <button onClick={() => { /* navigate to exchange settings */ }} className="px-4 py-1 rounded bg-slate-700 text-white">Connect Exchange</button>
            </div>
          )}

          {/* Layer 4 — Information Streams */}
          <InformationStreams />
        </div>
      </Shell>
    );
}
