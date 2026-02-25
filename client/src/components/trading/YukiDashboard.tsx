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

import React, { useState, useEffect } from 'react';
import { TrendingUp, Settings } from 'lucide-react';
import CexManager from './CexManager';
import StrategyMarketplace from './StrategyMarketplace';
import * as yukiApi from '../../api/yukiApi';
import { OpportunityScannerDashboard } from '../OpportunityScannerDashboard';

// TypeScript interfaces
interface MarketData {
  symbol: string;
  price: number;
  change: number;
  changePercent: string;
  volume: number;
  highPrice: number;
  lowPrice: number;
  timestamp: string;
}

interface WatchlistItem {
  symbol: string;
  price: number;
  change: string;
  exchanges: string[];
}

export default function YukiDashboard() {
  const [activeTab, setActiveTab] = useState<'overview' | 'cex' | 'dex' | 'charts' | 'watchlist' | 'opportunities' | 'strategies' | 'alerts'>('overview');
  const [marketData, setMarketData] = useState<MarketData | null>(null);
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([
    { symbol: 'ETH/USDT', price: 2450, change: '+5.2%', exchanges: ['Binance', 'Coinbase', 'Kraken'] },
    { symbol: 'BTC/USDT', price: 48200, change: '+2.1%', exchanges: ['Binance', 'Kraken', 'OKX'] },
  ]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMarketData = async () => {
      try {
        // Fetch initial market data
        setLoading(false);
      } catch (error) {
        console.error('Error fetching market data:', error);
        setLoading(false);
      }
    };
    fetchMarketData();
  }, []);

  return (
    <div className="min-h-screen bg-slate-900 text-white p-4 md:p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* HEADER */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              📈 Yuki Trading Dashboard
            </h1>
            <p className="text-slate-400 text-sm mt-1">
              Market intelligence • Execution • Strategy automation
            </p>
          </div>
          <button className="px-4 py-2 rounded bg-blue-600 hover:bg-blue-700 flex items-center gap-2 transition-colors">
            <Settings className="h-4 w-4" />
            Settings
          </button>
        </div>

        {/* TABS */}
        <div className="flex gap-2 border-b border-slate-700 overflow-x-auto pb-2">
          {[
            { id: 'overview' as const, label: '📊 Overview' },
            { id: 'cex' as const, label: '🏦 CEX Markets' },
            { id: 'dex' as const, label: '🔄 DEX Swaps' },
            { id: 'charts' as const, label: '📈 Charts & TA' },
            { id: 'watchlist' as const, label: '⭐ Watchlist' },
            { id: 'opportunities' as const, label: '⚡ Opportunities' },
            { id: 'strategies' as const, label: '🤖 Strategies' },
            { id: 'alerts' as const, label: '🔔 Alerts' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-3 border-b-2 transition-colors whitespace-nowrap ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-400'
                  : 'border-transparent text-slate-400 hover:text-slate-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* CONTENT SECTIONS */}
        <div>
          {activeTab === 'overview' && (
            <OverviewSection watchlist={watchlist} marketData={marketData} />
          )}
          {activeTab === 'cex' && (
            <CexManager />
          )}
          {activeTab === 'dex' && (
            <DexSwapSection />
          )}
          {activeTab === 'charts' && (
            <ChartsSection />
          )}
          {activeTab === 'watchlist' && (
            <WatchlistSection watchlist={watchlist} setWatchlist={setWatchlist} />
          )}
          {activeTab === 'opportunities' && (
            <OpportunityScannerDashboard />
          )}
          {activeTab === 'strategies' && (
            <StrategyMarketplace />
          )}
          {activeTab === 'alerts' && (
            <AlertsSection />
          )}
        </div>
      </div>
    </div>
  );
}

// SECTION COMPONENTS

const OverviewSection = ({ watchlist, marketData }: { watchlist: WatchlistItem[]; marketData: MarketData | null }) => (
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
        {watchlist.map((item) => (
          <div key={item.symbol} className="flex items-center justify-between p-3 bg-slate-700 rounded">
            <div>
              <p className="font-semibold">{item.symbol}</p>
              <p className="text-xs text-slate-400">{item.exchanges.join(', ')}</p>
            </div>
            <div className="text-right">
              <p className="font-semibold">${item.price}</p>
              <p className={`text-sm ${item.change.startsWith('+') ? 'text-green-400' : 'text-red-400'}`}>
                {item.change}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  </div>
);

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

const ChartsSection = () => (
  <div className="bg-slate-800 rounded-lg border border-slate-700 p-6">
    <h3 className="text-lg font-semibold mb-4">Technical Analysis</h3>
    <div className="h-80 bg-slate-700 rounded flex items-center justify-center text-slate-400">
      <p>Charts integration coming soon</p>
    </div>
  </div>
);

const WatchlistSection = ({ watchlist, setWatchlist }: { watchlist: WatchlistItem[]; setWatchlist: (items: WatchlistItem[]) => void }) => {
  const [newToken, setNewToken] = useState('');

  const addToWatchlist = () => {
    if (newToken) {
      setWatchlist([
        ...watchlist,
        {
          symbol: newToken,
          price: 0,
          change: '+0%',
          exchanges: [],
        },
      ]);
      setNewToken('');
    }
  };

  return (
    <div className="bg-slate-800 rounded-lg border border-slate-700 p-6">
      <h3 className="text-lg font-semibold mb-4">Watchlist</h3>
      <div className="space-y-4">
        <div className="flex gap-2">
          <input
            type="text"
            value={newToken}
            onChange={(e) => setNewToken(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addToWatchlist()}
            placeholder="Add token symbol..."
            className="flex-1 px-3 py-2 bg-slate-700 rounded border border-slate-600 text-white"
          />
          <button
            onClick={addToWatchlist}
            className="px-4 py-2 rounded bg-blue-600 hover:bg-blue-700 transition-colors"
          >
            Add
          </button>
        </div>

        <div className="space-y-2">
          {watchlist.map((item) => (
            <div key={item.symbol} className="p-3 bg-slate-700 rounded flex justify-between items-center">
              <div>
                <p className="font-semibold">{item.symbol}</p>
                <p className="text-xs text-slate-400">{item.exchanges.join(', ')}</p>
              </div>
              <div className="text-right">
                <p className="font-semibold">${item.price}</p>
                <p className={`text-sm ${item.change.startsWith('+') ? 'text-green-400' : 'text-red-400'}`}>
                  {item.change}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

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
