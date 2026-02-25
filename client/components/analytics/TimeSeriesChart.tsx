/**
 * TimeSeriesChart Component
 * Displays P&L and metrics over time
 */

import React from 'react';

interface MetricPoint {
  date: string;
  cumulativePnL: number;
  cumulativeFees: number;
  netPnL: number;
  cumulativeWinRate: number;
}

interface TimeSeriesChartProps {
  metrics: MetricPoint[];
  timeframe: string;
  loading: boolean;
}

export default function TimeSeriesChart({
  metrics,
  timeframe,
  loading,
}: TimeSeriesChartProps) {
  if (loading) {
    return (
      <div className="bg-slate-800 rounded-lg border border-slate-700 p-6 animate-pulse">
        <div className="h-6 bg-slate-700 rounded w-1/3 mb-4"></div>
        <div className="h-64 bg-slate-700 rounded"></div>
      </div>
    );
  }

  if (!metrics || metrics.length === 0) {
    return (
      <div className="bg-slate-800 rounded-lg border border-slate-700 p-6 text-center">
        <p className="text-slate-400">No data available for {timeframe}</p>
      </div>
    );
  }

  // Calculate min/max for scaling
  const values = metrics.map(m => m.netPnL);
  const maxValue = Math.max(...values, 0);
  const minValue = Math.min(...values, 0);
  const range = maxValue - minValue || 1;

  // Create simple text-based chart
  const chartHeight = 150;
  const chartPoints = metrics.map(metric => {
    const normalized = (metric.netPnL - minValue) / range;
    const height = Math.max(5, chartHeight * normalized);
    return { metric, height, normalized };
  });

  // Get summary stats
  const latestMetric = metrics[metrics.length - 1];
  const firstMetric = metrics[0];
  const startingPnL = firstMetric?.netPnL || 0;
  const currentPnL = latestMetric?.netPnL || 0;
  const totalChange = currentPnL - startingPnL;
  const percentChange = startingPnL !== 0 ? (totalChange / Math.abs(startingPnL)) * 100 : 0;

  const trendColor = totalChange > 0 ? 'text-green-400' : 'text-red-400';
  const trendIcon = totalChange > 0 ? '📈' : totalChange < 0 ? '📉' : '➡️';

  return (
    <div className="bg-slate-800 rounded-lg border border-slate-700 p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-white">P&L Trend</h2>
        <div className="text-right">
          <div className="flex items-center gap-2 justify-end">
            <span className="text-4xl font-bold">{trendIcon}</span>
            <div>
              <p className={`text-2xl font-bold ${trendColor}`}>
                {totalChange > 0 ? '+' : ''} ${totalChange.toFixed(2)}
              </p>
              <p className={`text-sm ${trendColor}`}>
                {percentChange > 0 ? '+' : ''} {percentChange.toFixed(2)}%
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        <StatBox
          label="Current"
          value={`$${currentPnL.toFixed(2)}`}
          color={currentPnL > 0 ? 'text-green-400' : 'text-red-400'}
        />
        <StatBox
          label="Total Fees"
          value={`$${(latestMetric?.cumulativeFees || 0).toFixed(2)}`}
          color="text-orange-400"
        />
        <StatBox
          label="Win Rate"
          value={`${((latestMetric?.cumulativeWinRate || 0) * 100).toFixed(1)}%`}
          color={
            (latestMetric?.cumulativeWinRate || 0) > 0.5 ? 'text-green-400' : 'text-red-400'
          }
        />
        <StatBox
          label="Periods"
          value={metrics.length.toString()}
          color="text-blue-400"
        />
      </div>

      {/* Simplified Bar Chart */}
      <div className="bg-slate-700/50 rounded-lg p-4">
        <div className="flex items-end justify-between h-40 gap-1">
          {chartPoints.map((point, idx) => (
            <div
              key={idx}
              className="flex-1 flex flex-col items-center"
              title={`${point.metric.date}: $${point.metric.netPnL.toFixed(2)}`}
            >
              {/* Bar */}
              <div
                className={`w-full transition-all rounded-t ${
                  point.metric.netPnL > 0
                    ? 'bg-gradient-to-t from-green-500 to-green-400'
                    : 'bg-gradient-to-t from-red-500 to-red-400'
                }`}
                style={{
                  height: `${point.height}px`,
                  minHeight: '2px',
                }}
              />
            </div>
          ))}
        </div>

        {/* X-axis labels */}
        <div className="flex justify-between text-xs text-slate-400 mt-2 px-1">
          <span>{metrics[0]?.date}</span>
          <span>{metrics[Math.floor(metrics.length / 2)]?.date}</span>
          <span>{metrics[metrics.length - 1]?.date}</span>
        </div>
      </div>

      {/* Detail Metrics */}
      <div className="mt-4 pt-4 border-t border-slate-700 grid grid-cols-2 gap-4">
        <div className="bg-slate-700/50 rounded-lg p-3">
          <p className="text-slate-400 text-xs mb-1">Gross Profit</p>
          <p className="text-lg font-bold text-green-400">
            ${Math.max(0, currentPnL).toFixed(2)}
          </p>
        </div>
        <div className="bg-slate-700/50 rounded-lg p-3">
          <p className="text-slate-400 text-xs mb-1">Gross Loss</p>
          <p className="text-lg font-bold text-red-400">
            ${Math.abs(Math.min(0, currentPnL)).toFixed(2)}
          </p>
        </div>
      </div>
    </div>
  );
}

/**
 * StatBox Component
 */
function StatBox({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div className="bg-slate-700/50 rounded-lg p-3">
      <p className="text-slate-400 text-xs mb-1">{label}</p>
      <p className={`font-bold text-lg ${color}`}>{value}</p>
    </div>
  );
}
