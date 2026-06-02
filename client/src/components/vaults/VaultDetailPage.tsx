/**
 * Vault Detail Page
 * 
 * View vault details, positions, P&L, and manage deposits/withdrawals
 */

import React, { useState, useEffect } from 'react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { ArrowUpRight, ArrowDownLeft, TrendingUp, Eye, EyeOff } from 'lucide-react';

interface VaultDetail {
  vaultId: string;
  name: string;
  strategyId: string;
  totalValue: number;
  depositorCount: number;
  positions: any[];
  isActive: boolean;
}

interface UserPosition {
  userId: string;
  vaultId: string;
  shares: number;
  currentValue: number;
  profitLoss: number;
  depositAmount: number;
  depositedAt: Date;
  sharePrice: number;
}

export default function VaultDetailPage({ vaultId }: { vaultId: string }) {
  const [vault, setVault] = useState<VaultDetail | null>(null);
  const [position, setPosition] = useState<UserPosition | null>(null);
  const [performanceData, setPerformanceData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'positions' | 'performance' | 'history'>('overview');
  const [showHideValues, setShowHideValues] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch vault details
        const vaultRes = await fetch(`/api/vaults/${vaultId}`).then(r => r.json());
        setVault(vaultRes.data);

        // Fetch user position
        const posRes = await fetch(`/api/vaults/${vaultId}/my-position`, {
          headers: { 'Authorization': `Bearer ${sessionStorage.getItem('authToken')}` },
        }).then(r => r.json());
        setPosition(posRes.data);

        // Fetch performance data
        const perfRes = await fetch(`/api/vaults/${vaultId}/performance?days=90`).then(r => r.json());
        setPerformanceData(perfRes.data.performance || []);
      } catch (err) {
        console.error('Failed to fetch vault data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [vaultId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-900">
        <p className="text-slate-400">Loading vault details...</p>
      </div>
    );
  }

  if (!vault) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-900">
        <p className="text-slate-400">Vault not found</p>
      </div>
    );
  }

  const pnlPercent = position ? ((position.profitLoss / position.depositAmount) * 100).toFixed(2) : 0;

  return (
    <div className="min-h-screen bg-slate-900 text-white p-4 md:p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* HEADER */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold">{vault.name}</h1>
            <p className="text-slate-400 mt-1">
              {vault.isActive ? '🟢 Active' : '🔴 Paused'} • {vault.depositorCount} Depositors
            </p>
          </div>
          <button
            onClick={() => setShowHideValues(!showHideValues)}
            className="flex items-center gap-2 px-4 py-2 bg-slate-800 rounded hover:bg-slate-700 transition-colors"
          >
            {showHideValues ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
            {showHideValues ? 'Hide' : 'Show'} Values
          </button>
        </div>

        {/* YOUR POSITION */}
        {position && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
              <p className="text-slate-400 text-sm">Your Balance</p>
              <p className="text-2xl font-bold mt-2">
                {showHideValues ? `$${position.currentValue.toLocaleString(undefined, { maximumFractionDigits: 2 })}` : '••••••'}
              </p>
              <p className="text-xs text-slate-500 mt-1">{position.shares.toFixed(4)} shares</p>
            </div>

            <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
              <p className="text-slate-400 text-sm">Deposited</p>
              <p className="text-2xl font-bold mt-2">
                {showHideValues ? `$${position.depositAmount.toLocaleString()}` : '••••••'}
              </p>
              <p className="text-xs text-slate-500 mt-1">
                {new Date(position.depositedAt).toLocaleDateString()}
              </p>
            </div>

            <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
              <p className="text-slate-400 text-sm">Profit/Loss</p>
              <p
                className={`text-2xl font-bold mt-2 ${
                  position.profitLoss >= 0 ? 'text-green-400' : 'text-red-400'
                }`}
              >
                {showHideValues
                  ? `${position.profitLoss >= 0 ? '+' : ''}$${position.profitLoss.toLocaleString(undefined, { maximumFractionDigits: 2 })}`
                  : '••••••'}
              </p>
              <p
                className={`text-xs mt-1 ${
                  parseFloat(pnlPercent as string) >= 0
                    ? 'text-green-400'
                    : 'text-red-400'
                }`}
              >
                {parseFloat(pnlPercent as string) >= 0 ? '+' : ''}{pnlPercent}%
              </p>
            </div>

            <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
              <p className="text-slate-400 text-sm">Share Price</p>
              <p className="text-2xl font-bold mt-2">${position.sharePrice.toFixed(4)}</p>
              <p className="text-xs text-slate-500 mt-1">Current price</p>
            </div>
          </div>
        )}

        {/* ACTIONS */}
        <div className="flex gap-4">
          <button className="flex-1 bg-green-600 hover:bg-green-700 px-6 py-3 rounded-lg font-semibold flex items-center justify-center gap-2 transition-colors">
            <ArrowDownLeft className="h-4 w-4" />
            Deposit More
          </button>
          <button className="flex-1 bg-orange-600 hover:bg-orange-700 px-6 py-3 rounded-lg font-semibold flex items-center justify-center gap-2 transition-colors">
            <ArrowUpRight className="h-4 w-4" />
            Withdraw
          </button>
        </div>

        {/* TABS */}
        <div className="flex gap-4 border-b border-slate-700">
          {[
            { id: 'overview', label: '📊 Overview' },
            { id: 'positions', label: '💼 Positions' },
            { id: 'performance', label: '📈 Performance' },
            { id: 'history', label: '📜 History' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-4 py-3 border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-400'
                  : 'border-transparent text-slate-400 hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* CONTENT */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Strategy Description */}
            <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
              <h3 className="text-lg font-bold mb-3">🎯 Strategy</h3>
              <p className="text-slate-300 leading-relaxed">
                This vault executes an automated trading strategy that monitors market conditions and executes
                trades when specific criteria are met. The strategy is designed to generate consistent returns
                while managing downside risk through stop-loss and take-profit mechanisms.
              </p>
              <p className="text-sm text-slate-500 mt-4">Strategy ID: {vault.strategyId}</p>
            </div>

            {/* Key Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
                <p className="text-slate-400 text-sm">Total AUM</p>
                <p className="text-2xl font-bold mt-2">
                  ${(vault.totalValue / 1_000_000).toFixed(1)}M
                </p>
              </div>
              <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
                <p className="text-slate-400 text-sm">30-Day Return</p>
                <p className="text-2xl font-bold text-green-400 mt-2">+2.14%</p>
              </div>
              <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
                <p className="text-slate-400 text-sm">Max Drawdown</p>
                <p className="text-2xl font-bold text-orange-400 mt-2">-5.2%</p>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'positions' && (
          <div className="space-y-4">
            <h3 className="text-lg font-bold">Current Positions</h3>
            <div className="space-y-3">
              {vault.positions && vault.positions.length > 0 ? (
                vault.positions.map((pos, i) => (
                  <div key={i} className="bg-slate-800 rounded-lg p-4 border border-slate-700 flex items-center justify-between">
                    <div>
                      <p className="font-semibold">{pos.symbol}</p>
                      <p className="text-sm text-slate-400">{pos.amount.toFixed(4)} units</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">${(pos.amount * pos.currentPrice).toLocaleString(undefined, { maximumFractionDigits: 2 })}</p>
                      <p
                        className={`text-sm ${
                          pos.unrealizedPnl >= 0
                            ? 'text-green-400'
                            : 'text-red-400'
                        }`}
                      >
                        {pos.unrealizedPnl >= 0 ? '+' : ''}${pos.unrealizedPnl.toFixed(2)}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-slate-400 text-center py-8">No positions yet</p>
              )}
            </div>
          </div>
        )}

        {activeTab === 'performance' && (
          <div className="space-y-4">
            <h3 className="text-lg font-bold">Performance (90 Days)</h3>
            {performanceData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={performanceData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="timestamp" stroke="#94a3b8" />
                  <YAxis stroke="#94a3b8" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1e293b',
                      border: '1px solid #475569',
                      borderRadius: '8px',
                    }}
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="dailyReturn"
                    stroke="#10b981"
                    name="Daily Return %"
                    isAnimationActive={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-slate-400 text-center py-8">No performance data yet</p>
            )}
          </div>
        )}

        {activeTab === 'history' && (
          <div className="space-y-4">
            <h3 className="text-lg font-bold">Transaction History</h3>
            <div className="space-y-2">
              <div className="bg-slate-800 rounded-lg p-4 border border-slate-700 flex items-center justify-between">
                <div>
                  <p className="font-semibold">Deposit</p>
                  <p className="text-sm text-slate-400">Jan 15, 2026</p>
                </div>
                <p className="text-green-400 font-semibold">+${position?.depositAmount.toLocaleString()}</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
