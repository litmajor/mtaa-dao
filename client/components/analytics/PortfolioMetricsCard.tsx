/**
 * PortfolioMetricsCard Component
 * Displays overall portfolio performance metrics
 */

import React from 'react';

interface Summary {
  totalCapital: number;
  totalProfit: number;
  profitPercent: number;
  totalFees: number;
  totalTrades: number;
  winRate: number;
  riskScore: number;
  volatility: number;
  topPair: any;
  bestExchange: any;
  weeklyTrend: number;
}

interface PortfolioMetricsCardProps {
  summary: Summary | null;
  loading: boolean;
}

export default function PortfolioMetricsCard({
  summary,
  loading,
}: PortfolioMetricsCardProps) {
  if (loading) {
    return (
      <div className="bg-slate-800 rounded-lg border border-slate-700 p-6 animate-pulse">
        <div className="h-6 bg-slate-700 rounded w-1/3 mb-4"></div>
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-4 bg-slate-700 rounded w-full"></div>
          ))}
        </div>
      </div>
    );
  }

  if (!summary) {
    return (
      <div className="bg-slate-800 rounded-lg border border-slate-700 p-6 text-center">
        <p className="text-slate-400">No portfolio data available</p>
      </div>
    );
  }

  const profitColor = summary.totalProfit > 0 ? 'text-green-400' : 'text-red-400';
  const profitBgColor = summary.totalProfit > 0 ? 'bg-green-900/20' : 'bg-red-900/20';
  const trendIcon = summary.weeklyTrend > 0 ? '📈' : summary.weeklyTrend < 0 ? '📉' : '➡️';

  return (
    <div className="bg-slate-800 rounded-lg border border-slate-700 p-6">
      <h2 className="text-2xl font-bold text-white mb-6">Portfolio Overview</h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        {/* Capital & Profit */}
        <div className={`rounded-lg p-4 ${profitBgColor}`}>
          <p className="text-slate-400 text-sm mb-2">Total Capital</p>
          <p className="text-2xl font-bold text-white mb-3">
            ${summary.totalCapital.toFixed(2)}
          </p>
          <div className="space-y-1">
            <p className="text-slate-300 text-sm">
              Profit: <span className={`font-bold ${profitColor}`}>
                {summary.totalProfit > 0 ? '+' : ''} ${summary.totalProfit.toFixed(2)}
              </span>
            </p>
            <p className="text-slate-300 text-sm">
              Return: <span className={`font-bold ${profitColor}`}>
                {summary.profitPercent > 0 ? '+' : ''} {summary.profitPercent.toFixed(2)}%
              </span>
            </p>
          </div>
        </div>

        {/* Performance Stats */}
        <div className="space-y-3">
          <StatItem
            label="Total Orders"
            value={summary.totalTrades.toString()}
            icon="📊"
          />
          <StatItem
            label="Win Rate"
            value={`${(summary.winRate * 100).toFixed(1)}%`}
            icon="🎯"
            valueColor={summary.winRate > 0.5 ? 'text-green-400' : 'text-red-400'}
          />
          <StatItem
            label="Weekly Trend"
            value={`${summary.weeklyTrend > 0 ? '+' : ''} ${summary.weeklyTrend.toFixed(2)}%`}
            icon={trendIcon}
            valueColor={summary.weeklyTrend > 0 ? 'text-green-400' : summary.weeklyTrend < 0 ? 'text-red-400' : 'text-slate-400'}
          />
          <StatItem
            label="Total Fees"
            value={`$${summary.totalFees.toFixed(2)}`}
            icon="💸"
          />
        </div>
      </div>

      {/* Risk & Volatility */}
      <div className="mt-6 pt-6 border-t border-slate-700">
        <p className="text-white font-semibold mb-4">Risk Profile</p>
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-slate-700/50 rounded-lg p-4">
            <p className="text-slate-400 text-sm mb-2">Risk Score</p>
            <div className="flex items-end gap-2">
              <span className="text-2xl font-bold text-white">{summary.riskScore.toFixed(1)}</span>
              <span className="text-slate-400 text-sm mb-1">/ 100</span>
            </div>
            <div className="w-full h-2 bg-slate-600 rounded-full mt-2 overflow-hidden">
              <div
                className={`h-full ${
                  summary.riskScore > 70
                    ? 'bg-red-500'
                    : summary.riskScore > 50
                    ? 'bg-orange-500'
                    : 'bg-green-500'
                }`}
                style={{ width: `${summary.riskScore}%` }}
              />
            </div>
          </div>

          <div className="bg-slate-700/50 rounded-lg p-4">
            <p className="text-slate-400 text-sm mb-2">Volatility</p>
            <div className="flex items-end gap-2">
              <span className="text-2xl font-bold text-white">{(summary.volatility * 100).toFixed(1)}</span>
              <span className="text-slate-400 text-sm mb-1">%</span>
            </div>
            <p className="text-slate-400 text-xs mt-2">
              {summary.volatility > 0.3
                ? 'High volatility'
                : summary.volatility > 0.15
                ? 'Moderate volatility'
                : 'Low volatility'}
            </p>
          </div>
        </div>
      </div>

      {/* Top Performers */}
      {summary.topPair && (
        <div className="mt-6 pt-6 border-t border-slate-700">
          <p className="text-white font-semibold mb-3">Top Performers</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-slate-700/50 rounded-lg p-3">
              <p className="text-slate-400 text-xs mb-1">Best Pair</p>
              <p className="text-white font-bold">{summary.topPair.pair}</p>
              <p className="text-green-400 text-sm">
                +{(summary.topPair.totalPnL || 0).toFixed(2)} $
              </p>
            </div>
            {summary.bestExchange && (
              <div className="bg-slate-700/50 rounded-lg p-3">
                <p className="text-slate-400 text-xs mb-1">Best Exchange</p>
                <p className="text-white font-bold capitalize">{summary.bestExchange.exchange}</p>
                <p className="text-green-400 text-sm">
                  +{(summary.bestExchange.totalPnL || 0).toFixed(2)} $
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * StatItem Component - Reusable stat display
 */
function StatItem({
  label,
  value,
  icon,
  valueColor = 'text-white',
}: {
  label: string;
  value: string;
  icon: string;
  valueColor?: string;
}) {
  return (
    <div className="flex items-center justify-between p-3 rounded-lg bg-slate-700/50">
      <div className="flex items-center gap-2">
        <span className="text-lg">{icon}</span>
        <span className="text-slate-300 text-sm">{label}</span>
      </div>
      <span className={`font-bold text-lg ${valueColor}`}>{value}</span>
    </div>
  );
}
