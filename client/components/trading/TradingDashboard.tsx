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
} from '../../hooks/useTrading';
import { useTradingAccount } from '../../contexts/trading-account-context';

type MarketType = 'margin' | 'futures' | 'swap';
import OrderListPanel from './OrderListPanel';
import PositionsPanel from './PositionsPanel';
import QuickOrderPanel from './QuickOrderPanel';
import PortfolioMetricsPanel from './PortfolioMetricsPanel';
import AdvancedOrderPanel from './AdvancedOrderPanel';
import SmartRouterUI from './SmartRouterUI';
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">Trading Dashboard</h1>
          <p className="text-slate-400">Manage orders and positions across all exchanges</p>
        </div>

        {/* Portfolio Metrics Summary */}
        <PortfolioMetricsPanel metrics={metrics} loading={metricsLoading} />

        {/* Main Navigation Tabs */}
        <div className="bg-slate-800 rounded-lg border border-slate-700 p-4 mb-6">
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
                  className="px-6 py-2 rounded-lg bg-green-600 hover:bg-green-700 text-white font-semibold transition-all text-sm"
                >
                  {showOrderPanel ? '✕ Close' : '+ Place Order'}
                </button>
              )}
            </div>
          )}
        </div>

        {/* Tab Content */}

        {/* QUICK ORDER TAB */}
        {mainTab === 'quick' && (
          <>
            {/* Quick Order Panel */}
            {showOrderPanel && (
              <div className="mb-6">
                <QuickOrderPanel onClose={() => setShowOrderPanel(false)} selectedExchange={selectedExchange} />
              </div>
            )}

        {/* Error Display */}
            {(ordersError || positionsLoading) && (
              <div className="bg-red-900 border border-red-700 rounded-lg p-4 mb-6">
                <p className="text-red-100">
                  {ordersError || 'Error loading data. Please refresh.'}
                </p>
              </div>
            )}

            {/* No Exchanges Connected State */}
            {!hasExchanges && (
              <div className="mt-8 text-center py-16 bg-slate-800 rounded-lg border border-slate-700">
                <p className="text-slate-400 text-lg mb-4">No trading exchanges connected</p>
                <p className="text-slate-500 mb-6">Connect your exchange accounts to start trading</p>
                <button
                  onClick={() => {/* Navigate to exchange settings */}}
                  className="px-6 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold"
                >
                  Connect Exchange
                </button>
              </div>
            )}

            {/* Main Content Grid */}
            {hasExchanges && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Orders Section (70% width) */}
                <div className="lg:col-span-2">
                  <OrderListPanel
                    orders={filteredOrders}
                    loading={ordersLoading}
                    selectedExchange={selectedExchange}
                    marketType={activeTab === 'all' ? undefined : (activeTab as MarketType)}
                  />
                </div>

                {/* Positions Section (30% width) */}
                <div>
                  <PositionsPanel
                    positions={filteredPositions}
                    loading={positionsLoading}
                    metrics={positionMetrics}
                  />
                </div>
              </div>
            )}

            {/* Empty State */}
            {!isLoading && hasExchanges && filteredOrders.length === 0 && filteredPositions.length === 0 && (
              <div className="mt-8 text-center py-16 bg-slate-800 rounded-lg border border-slate-700">
                <p className="text-slate-400 text-lg mb-4">No open orders or positions</p>
                <button
                  onClick={() => setShowOrderPanel(true)}
                  className="px-6 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold"
                >
                  Place Your First Order
                </button>
              </div>
            )}
          </>
        )}

        {/* SMART ROUTING TAB */}
        {mainTab === 'smart-routing' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Advanced Order Panel */}
            <div>
              <AdvancedOrderPanel />
            </div>

            {/* Smart Router UI */}
            <div>
              <SmartRouterUI pair={smartRoutingPair} quantity={smartRoutingQty} side={smartRoutingSide} />
            </div>
          </div>
        )}

        {/* HISTORY TAB */}
        {mainTab === 'history' && (
          <div>
            <OrderExecutionStatus 
              trades={trades}
              isLoading={historyLoading}
            />
          </div>
        )}
      </div>
    </div>
  );
}
