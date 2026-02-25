/**
 * Yuki CEX Manager
 * 
 * Manage connected exchanges, view positions, execute trades automatically.
 * Smart order routing across CEX/DEX with unified dashboard.
 */

import React, { useState, useEffect, useMemo } from 'react';
import { Plus, TrendingUp, Settings } from 'lucide-react';
import * as yukiApi from '../../api/yukiApi';

type Exchange = {
  id: string;
  name: string;
  icon: string;
  connected: boolean;
  apiKeyStatus: 'active' | 'inactive' | 'expired';
  balance: number;
  balances: Record<string, number>;
  openOrders: number;
  positions: Position[];
  lastSync: string;
};

type Position = {
  symbol: string;
  side: 'long' | 'short';
  size: number;
  entryPrice: number;
  currentPrice: number;
  pnl: number;
  pnlPercent: number;
  leverage?: number;
  liquidationPrice?: number;
  fundingRate?: number;
};

type Order = {
  id: string;
  exchange: string;
  symbol: string;
  type: 'buy' | 'sell';
  quantity: number;
  price: number;
  filledQuantity: number;
  status: 'open' | 'partial' | 'closed';
  createdAt: string;
};

export default function CexManager() {
  const [exchanges, setExchanges] = useState<Exchange[]>([]);
  const [showAPIModal, setShowAPIModal] = useState(false);
  const [selectedExchange, setSelectedExchange] = useState<Exchange | null>(null);
  const [hiddenBalances, setHiddenBalances] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchExchanges = async () => {
      try {
        const connectedExchanges = await yukiApi.getConnectedExchanges();
        
        // Fetch positions for each exchange
        const exchangesWithPositions = await Promise.all(
          (connectedExchanges || []).map(async (ex: any) => {
            try {
              const positions = await yukiApi.getExchangePositions(ex.id);
              return { ...ex, positions };
            } catch (err) {
              return { ...ex, positions: [] };
            }
          })
        );
        
        setExchanges(exchangesWithPositions || []);
      } catch (err) {
        console.error('Failed to fetch exchanges:', err);
        setExchanges([]);
      } finally {
        setLoading(false);
      }
    };
    fetchExchanges();
  }, []);

  const totalBalance = useMemo(() => {
    return exchanges.reduce((sum, ex) => sum + ex.balance, 0);
  }, [exchanges]);

  const allPositions = useMemo(() => {
    return exchanges.flatMap((ex) =>
      ex.positions.map((pos) => ({ ...pos, exchange: ex.name }))
    );
  }, [exchanges]);

  const totalPnL = useMemo(() => {
    return allPositions.reduce((sum, pos) => sum + pos.pnl, 0);
  }, [allPositions]);

  const liquidationRisks = useMemo(() => {
    return allPositions.filter((pos) => {
      if (!pos.liquidationPrice) return false;
      const distancePercent = Math.abs(
        ((pos.currentPrice - pos.liquidationPrice) / pos.currentPrice) * 100
      );
      return distancePercent < 20; // Alert if within 20% of liquidation
    });
  }, [allPositions]);

  const toggleBalanceVisibility = (exchangeId: string) => {
    setHiddenBalances((prev) =>
      prev.includes(exchangeId)
        ? prev.filter((id) => id !== exchangeId)
        : [...prev, exchangeId]
    );
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white p-4 md:p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* HEADER */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2 flex items-center gap-2">
              🏦 CEX Manager
            </h1>
            <p className="text-slate-400">
              Manage connected exchanges, monitor positions, smart order routing
            </p>
          </div>
          <button className="px-4 py-2 rounded bg-blue-600 hover:bg-blue-700 flex items-center gap-2 transition-colors">
            <Plus className="h-4 w-4" />
            Connect Exchange
          </button>
        </div>

        {/* SUMMARY CARDS */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
            <p className="text-slate-400 text-sm">Total Balance</p>
            <p className="text-3xl font-bold mt-2">${totalBalance.toLocaleString()}</p>
            <p className="text-xs text-slate-500 mt-1">{exchanges.length} exchanges</p>
          </div>
          <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
            <p className="text-slate-400 text-sm">Total P&L</p>
            <p className={`text-3xl font-bold mt-2 ${totalPnL >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              ${totalPnL >= 0 ? '+' : ''}{totalPnL.toLocaleString()}
            </p>
            <p className="text-xs text-slate-500 mt-1">All positions</p>
          </div>
          <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
            <p className="text-slate-400 text-sm">Open Positions</p>
            <p className="text-3xl font-bold mt-2">{allPositions.length}</p>
            <p className="text-xs text-slate-500 mt-1">Across all exchanges</p>
          </div>
          <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
            <p className="text-slate-400 text-sm">Liquidation Risks</p>
            <p className={`text-3xl font-bold mt-2 ${liquidationRisks.length > 0 ? 'text-red-400' : 'text-green-400'}`}>
              {liquidationRisks.length}
            </p>
            <p className="text-xs text-slate-500 mt-1">Positions at risk</p>
          </div>
        </div>

        {/* ALERTS */}
        {liquidationRisks.length > 0 && (
          <div className="bg-red-900/20 border border-red-500/50 rounded-lg p-4 flex items-start gap-3">
            <div>
              <h4 className="font-bold text-red-300 mb-1">⚠️ Liquidation Risk Detected</h4>
              <p className="text-red-200 text-sm">
                {liquidationRisks.length} position(s) within 20% of liquidation price.
                Consider closing or reducing leverage.
              </p>
            </div>
          </div>
        )}

        {/* EXCHANGES GRID */}
        <div className="space-y-4">
          <h3 className="text-lg font-bold">Connected Exchanges</h3>
          {exchanges.map((exchange) => (
            <div key={exchange.id} className="bg-slate-800 rounded-lg border border-slate-700">
              {/* EXCHANGE HEADER */}
              <div className="p-4 border-b border-slate-700 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-3xl">{exchange.icon}</span>
                  <div>
                    <h4 className="font-bold text-lg">{exchange.name}</h4>
                    <div className="flex items-center gap-2 mt-1">
                      <span
                        className={`text-xs px-2 py-0.5 rounded ${
                          exchange.apiKeyStatus === 'active'
                            ? 'bg-green-600/20 text-green-300'
                            : 'bg-red-600/20 text-red-300'
                        }`}
                      >
                        {exchange.apiKeyStatus === 'active'
                          ? '✓ Connected'
                          : exchange.apiKeyStatus === 'expired'
                          ? '⚠ Expired'
                          : '✕ Inactive'}
                      </span>
                      <span className="text-xs text-slate-500">
                        Last sync: {new Date(exchange.lastSync).toLocaleTimeString()}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="text-right">
                    <p className="text-2xl font-bold">
                      {hiddenBalances.includes(exchange.id)
                        ? '••••'
                        : `$${exchange.balance.toLocaleString()}`}
                    </p>
                    <p className="text-sm text-slate-400">{exchange.openOrders} open orders</p>
                  </div>
                  <button
                    onClick={() => toggleBalanceVisibility(exchange.id)}
                    className="p-2 hover:bg-slate-700 rounded transition-colors text-lg"
                  >
                    {hiddenBalances.includes(exchange.id) ? '👁️' : '🚫'}
                  </button>
                </div>
              </div>

              {/* BALANCES */}
              <div className="p-4 border-b border-slate-700">
                <p className="text-sm text-slate-400 mb-2">Balances</p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {Object.entries(exchange.balances).map(([token, balance]) => (
                    <div key={token} className="bg-slate-700 rounded p-2">
                      <p className="text-xs text-slate-400">{token}</p>
                      <p className="text-sm font-bold">
                        {balance.toLocaleString(undefined, {
                          maximumFractionDigits: 2,
                        })}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* POSITIONS */}
              {exchange.positions.length > 0 && (
                <div className="p-4 border-b border-slate-700">
                  <p className="text-sm text-slate-400 mb-2">Open Positions</p>
                  <div className="space-y-2">
                    {exchange.positions.map((pos) => (
                      <div
                        key={pos.symbol}
                        className="bg-slate-700 rounded p-3 flex items-center justify-between"
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h5 className="font-semibold">{pos.symbol}</h5>
                            <span
                              className={`text-xs px-2 py-0.5 rounded ${
                                pos.side === 'long'
                                  ? 'bg-green-600/20 text-green-300'
                                  : 'bg-red-600/20 text-red-300'
                              }`}
                            >
                              {pos.side.toUpperCase()}
                            </span>
                            {pos.leverage && (
                              <span className="text-xs px-2 py-0.5 rounded bg-orange-600/20 text-orange-300">
                                {pos.leverage}x
                              </span>
                            )}
                          </div>
                          <div className="grid grid-cols-3 gap-2 text-xs text-slate-400">
                            <div>
                              Size: <span className="text-white font-semibold">{pos.size}</span>
                            </div>
                            <div>
                              Entry: <span className="text-white font-semibold">${pos.entryPrice}</span>
                            </div>
                            <div>
                              Current:{' '}
                              <span className="text-white font-semibold">${pos.currentPrice}</span>
                            </div>
                          </div>
                          {pos.liquidationPrice && (
                            <div className="text-xs text-red-400 mt-1">
                              Liquidation: ${pos.liquidationPrice} (
                              {(
                                ((pos.currentPrice - pos.liquidationPrice) /
                                  pos.currentPrice) *
                                100
                              ).toFixed(1)}
                              % away)
                            </div>
                          )}
                          {pos.fundingRate && (
                            <div className="text-xs text-blue-400 mt-1">
                              Funding: {(pos.fundingRate * 100).toFixed(4)}%
                            </div>
                          )}
                        </div>
                        <div className="text-right">
                          <p
                            className={`text-lg font-bold ${
                              pos.pnl >= 0 ? 'text-green-400' : 'text-red-400'
                            }`}
                          >
                            {pos.pnl >= 0 ? '+' : ''}${pos.pnl.toLocaleString()}
                          </p>
                          <p
                            className={`text-sm ${
                              pos.pnl >= 0 ? 'text-green-400' : 'text-red-400'
                            }`}
                          >
                            {pos.pnlPercent >= 0 ? '+' : ''}
                            {pos.pnlPercent.toFixed(2)}%
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ACTIONS */}
              <div className="p-4 flex gap-2">
                <button className="px-4 py-2 rounded bg-blue-600 hover:bg-blue-700 text-sm font-semibold transition-colors flex-1">
                  📊 View Orders
                </button>
                <button className="px-4 py-2 rounded bg-green-600 hover:bg-green-700 text-sm font-semibold transition-colors flex-1">
                  ➕ Add API Key
                </button>
                <button className="px-2 py-2 rounded bg-red-600 hover:bg-red-700 text-sm font-semibold transition-colors" title="Delete">
                  🗑️
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* SMART ORDER ROUTING PREVIEW */}
        <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
          <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Smart Order Routing
          </h3>
          <p className="text-slate-400 text-sm mb-4">
            Execute orders across optimal venues (DEX/CEX) for best execution price
          </p>
          <div className="bg-slate-700 rounded p-4">
            <p className="text-sm text-slate-300 mb-3">
              Example: Buy 10 ETH
            </p>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between items-center">
                <span>Uniswap V3 (DEX)</span>
                <span className="font-semibold">Price: $2,845 | Gas: $45 | Total: $28,495</span>
              </div>
              <div className="flex justify-between items-center">
                <span>Kraken (CEX)</span>
                <span className="font-semibold text-green-400">Price: $2,840 | Fee: $28.40 | Total: $28,428 ✓</span>
              </div>
              <div className="flex justify-between items-center">
                <span>Coinbase (CEX)</span>
                <span className="font-semibold">Price: $2,842 | Fee: $28.42 | Total: $28,450</span>
              </div>
            </div>
            <button className="mt-4 w-full bg-green-600 hover:bg-green-700 px-4 py-2 rounded font-semibold transition-colors">
              Execute Best Route (Save $67)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
