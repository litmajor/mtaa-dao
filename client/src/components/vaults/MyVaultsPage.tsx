/**
 * My Vaults Page
 * 
 * Display user's current vault deposits, P&L, and management options
 */

import React, { useState, useEffect } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { TrendingUp, TrendingDown, Wallet, Edit2, Trash2 } from 'lucide-react';

interface VaultPosition {
  vaultId: string;
  vaultName: string;
  category: string;
  shares: number;
  currentValue: number;
  depositAmount: number;
  profitLoss: number;
  profitLossPercent: number;
  depositedAt: Date;
  sharePrice: number;
}

interface PortfolioStats {
  totalDeposited: number;
  totalValue: number;
  totalProfitLoss: number;
  totalReturn: string;
  bestVault: string;
  worstVault: string;
}

export default function MyVaultsPage() {
  const [positions, setPositions] = useState<VaultPosition[]>([]);
  const [stats, setStats] = useState<PortfolioStats | null>(null);
  const [performanceData, setPerformanceData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<'return' | 'value' | 'aum'>('value');
  const [selectedVault, setSelectedVault] = useState<string | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch user positions across all vaults
        const posRes = await fetch('/api/vaults/my-positions', {
          headers: { 'Authorization': `Bearer ${sessionStorage.getItem('authToken')}` },
        }).then((r) => r.json());

        setPositions(posRes.data || []);

        // Calculate portfolio stats
        const totalDeposited = posRes.data.reduce(
          (sum: number, p: VaultPosition) => sum + p.depositAmount,
          0
        );
        const totalValue = posRes.data.reduce(
          (sum: number, p: VaultPosition) => sum + p.currentValue,
          0
        );
        const totalProfitLoss = totalValue - totalDeposited;
        const totalReturn = ((totalProfitLoss / totalDeposited) * 100).toFixed(2);

        const best = posRes.data.reduce((max: VaultPosition, p: VaultPosition) =>
          p.profitLossPercent > max.profitLossPercent ? p : max
        );
        const worst = posRes.data.reduce((min: VaultPosition, p: VaultPosition) =>
          p.profitLossPercent < min.profitLossPercent ? p : min
        );

        setStats({
          totalDeposited,
          totalValue,
          totalProfitLoss,
          totalReturn,
          bestVault: best.vaultName,
          worstVault: worst.vaultName,
        });

        // Fetch performance data
        const perfRes = await fetch('/api/vaults/portfolio-performance?days=90', {
          headers: { 'Authorization': `Bearer ${sessionStorage.getItem('authToken')}` },
        }).then((r) => r.json());

        setPerformanceData(perfRes.data || []);
      } catch (err) {
        console.error('Failed to fetch vault data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-900">
        <p className="text-slate-400">Loading your vaults...</p>
      </div>
    );
  }

  const sortedPositions = [...positions].sort((a, b) => {
    if (sortBy === 'return') return b.profitLossPercent - a.profitLossPercent;
    if (sortBy === 'value') return b.currentValue - a.currentValue;
    return b.depositAmount - a.depositAmount;
  });

  return (
    <div className="min-h-screen bg-slate-900 text-white p-4 md:p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* HEADER */}
        <div>
          <h1 className="text-4xl font-bold">My Vaults</h1>
          <p className="text-slate-400 mt-2">Manage your vault deposits and monitor returns</p>
        </div>

        {/* PORTFOLIO STATS */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
              <p className="text-slate-400 text-sm">Total Deposited</p>
              <p className="text-2xl font-bold mt-2">
                ${stats.totalDeposited.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </p>
            </div>

            <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
              <p className="text-slate-400 text-sm">Current Value</p>
              <p className="text-2xl font-bold mt-2">
                ${stats.totalValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </p>
            </div>

            <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
              <p className="text-slate-400 text-sm">Profit/Loss</p>
              <p
                className={`text-2xl font-bold mt-2 ${
                  stats.totalProfitLoss >= 0
                    ? 'text-green-400'
                    : 'text-red-400'
                }`}
              >
                {stats.totalProfitLoss >= 0 ? '+' : ''}
                ${Math.abs(stats.totalProfitLoss).toLocaleString(undefined, {
                  maximumFractionDigits: 0,
                })}
              </p>
              <p
                className={`text-xs mt-1 ${
                  parseFloat(stats.totalReturn) >= 0
                    ? 'text-green-400'
                    : 'text-red-400'
                }`}
              >
                {parseFloat(stats.totalReturn) >= 0 ? '+' : ''}{stats.totalReturn}%
              </p>
            </div>

            <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
              <p className="text-slate-400 text-sm">Best Vault</p>
              <p className="text-lg font-bold mt-2">{stats.bestVault}</p>
              <p className="text-xs text-green-400 mt-1">Highest return</p>
            </div>

            <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
              <p className="text-slate-400 text-sm">Worst Vault</p>
              <p className="text-lg font-bold mt-2">{stats.worstVault}</p>
              <p className="text-xs text-red-400 mt-1">Lowest return</p>
            </div>
          </div>
        )}

        {/* PORTFOLIO CHART */}
        {performanceData.length > 0 && (
          <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
            <h3 className="text-lg font-bold mb-4">Portfolio Performance (90 Days)</h3>
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
                  dataKey="portfolioReturn"
                  stroke="#10b981"
                  name="Portfolio Return %"
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* VAULT POSITIONS */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold">Vault Positions</h2>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-slate-800 border border-slate-700 rounded px-3 py-2 text-white focus:outline-none"
            >
              <option value="value">Sort by Value</option>
              <option value="return">Sort by Return</option>
              <option value="aum">Sort by Deposit</option>
            </select>
          </div>

          {sortedPositions.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {sortedPositions.map((position) => (
                <div
                  key={position.vaultId}
                  className="bg-slate-800 rounded-lg p-6 border border-slate-700 hover:border-slate-600 transition-colors cursor-pointer"
                  onClick={() => setSelectedVault(position.vaultId)}
                >
                  {/* Header */}
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="text-lg font-bold">{position.vaultName}</h3>
                      <p className="text-xs text-slate-500 mt-1">{position.category}</p>
                    </div>
                    <span
                      className={`px-2 py-1 rounded text-xs font-semibold ${
                        position.profitLoss >= 0
                          ? 'bg-green-900/30 text-green-400'
                          : 'bg-red-900/30 text-red-400'
                      }`}
                    >
                      {position.profitLoss >= 0 ? '+' : ''}
                      {position.profitLossPercent.toFixed(2)}%
                    </span>
                  </div>

                  {/* Stats */}
                  <div className="grid grid-cols-3 gap-3 mb-4">
                    <div>
                      <p className="text-slate-400 text-xs">Your Balance</p>
                      <p className="text-lg font-bold mt-1">
                        ${position.currentValue.toLocaleString(undefined, {
                          maximumFractionDigits: 0,
                        })}
                      </p>
                    </div>
                    <div>
                      <p className="text-slate-400 text-xs">Deposited</p>
                      <p className="text-lg font-bold mt-1">
                        ${position.depositAmount.toLocaleString(undefined, {
                          maximumFractionDigits: 0,
                        })}
                      </p>
                    </div>
                    <div>
                      <p className="text-slate-400 text-xs">Shares</p>
                      <p className="text-lg font-bold mt-1">{position.shares.toFixed(4)}</p>
                    </div>
                  </div>

                  {/* P&L */}
                  <div className="bg-slate-900 rounded p-3 mb-4 flex items-center justify-between">
                    <span className="text-slate-400">Profit/Loss</span>
                    <span
                      className={`font-bold ${
                        position.profitLoss >= 0
                          ? 'text-green-400'
                          : 'text-red-400'
                      }`}
                    >
                      {position.profitLoss >= 0 ? '+' : ''}$
                      {Math.abs(position.profitLoss).toLocaleString(undefined, {
                        maximumFractionDigits: 2,
                      })}
                    </span>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2">
                    <button className="flex-1 bg-blue-600 hover:bg-blue-700 px-3 py-2 rounded text-sm font-semibold flex items-center justify-center gap-2 transition-colors">
                      <Edit2 className="h-3 w-3" />
                      Manage
                    </button>
                    <button className="flex-1 bg-slate-700 hover:bg-slate-600 px-3 py-2 rounded text-sm font-semibold flex items-center justify-center gap-2 transition-colors">
                      <Wallet className="h-3 w-3" />
                      Details
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-slate-800 rounded-lg p-12 border border-slate-700 text-center">
              <Wallet className="h-12 w-12 text-slate-600 mx-auto mb-4" />
              <p className="text-slate-400 mb-4">No vault positions yet</p>
              <button className="bg-blue-600 hover:bg-blue-700 px-6 py-2 rounded-lg font-semibold transition-colors">
                Browse Vaults
              </button>
            </div>
          )}
        </div>

        {/* ALLOCATION */}
        {positions.length > 0 && (
          <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
            <h3 className="text-lg font-bold mb-4">Portfolio Allocation</h3>
            <div className="space-y-2">
              {positions.map((pos) => {
                const allocation = (
                  (pos.currentValue / (stats?.totalValue || 1)) *
                  100
                ).toFixed(1);
                return (
                  <div key={pos.vaultId}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm text-slate-300">{pos.vaultName}</span>
                      <span className="text-sm font-semibold">{allocation}%</span>
                    </div>
                    <div className="w-full bg-slate-900 rounded h-2">
                      <div
                        className={`h-full rounded ${
                          pos.profitLoss >= 0 ? 'bg-green-500' : 'bg-red-500'
                        }`}
                        style={{ width: `${allocation}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
