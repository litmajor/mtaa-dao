/* stylelint-disable */
/* stylelint-disable declaration-no-important, no-descending-specificity, no-duplicate-selectors */
/**
 * Market Changes Visualization Component
 * Display market cap and volume changes over multiple periods
 *
 * Note: This component uses inline styles for dynamic color mapping based on percentage values.
 * Stylelint warnings are intentionally suppressed as these styles cannot be externalized.
 */

import React, { useMemo, useState } from 'react';
import { useMarketChanges } from '@/hooks/useFearGreed';
import { formatLargeNumber, formatChangePercent } from '@/hooks/useFearGreed';
import { formatNumberCompact, calculateOptimalDomain } from '@/utils/dataVisualization';
import ChartJS from '@/components/charts/ChartJSSetup';
import { Chart } from 'react-chartjs-2';
import type { MarketChangeMetrics } from '@/types/exchanges';

export const MarketChangesVisualization: React.FC = () => {
  const { data, isLoading, error } = useMarketChanges();
  const [chartType, setChartType] = useState<'bar' | 'line'>('bar');

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-64 bg-gray-200 rounded-lg animate-pulse"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <div className="text-red-700 font-semibold">Failed to load market changes</div>
      </div>
    );
  }

  if (!data?.marketChanges || data.marketChanges.length === 0) {
    return (
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="text-blue-700 font-semibold">No market data available</div>
      </div>
    );
  }

  const changes = data.marketChanges;

  // Prepare chart data with calculated optimal domains
  const percentages = changes.map((item) => item.marketCapChangePercent).concat(changes.map((item) => item.volumeChangePercent));
  const percentageDomain = calculateOptimalDomain(percentages, 0.1);

  const chartData = changes.map((item) => ({
    period: getPeriodLabel(item.period),
    marketCapChange: parseFloat(item.marketCapChangePercent.toFixed(2)),
    volumeChange: parseFloat(item.volumeChangePercent.toFixed(2)),
    marketCap: item.marketCap,
    volume24h: item.volume24h
  }));

  return (
    <div className="space-y-6">
      {/* Header with Chart Type Toggle */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Market Changes</h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Market cap and volume trends over time
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setChartType('bar')}
            className={`px-4 py-2 rounded-lg font-semibold text-sm transition-colors ${
              chartType === 'bar'
                ? 'bg-blue-500 text-white'
                : 'bg-gray-200 dark:bg-slate-700 text-gray-700 dark:text-gray-300'
            }`}
          >
            Bar Chart
          </button>
          <button
            onClick={() => setChartType('line')}
            className={`px-4 py-2 rounded-lg font-semibold text-sm transition-colors ${
              chartType === 'line'
                ? 'bg-blue-500 text-white'
                : 'bg-gray-200 dark:bg-slate-700 text-gray-700 dark:text-gray-300'
            }`}
          >
            Line Chart
          </button>
        </div>
      </div>

      {/* Market Cap Change Chart */}
      <div className="bg-white dark:bg-slate-800 rounded-lg p-6 border border-gray-200 dark:border-slate-700 shadow-sm">
        <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-4">Market Cap Change (%)</h3>
        <div style={{ height: 300 }}>
          {chartType === 'bar' ? (
            <Chart
              type="bar"
              data={{ labels: chartData.map(c => c.period), datasets: [{ label: 'Market Cap Change %', data: chartData.map(c => c.marketCapChange), backgroundColor: '#3b82f6' }] }}
              options={{ responsive: true, maintainAspectRatio: false, plugins: { tooltip: { callbacks: { label: (ctx: any) => `${(ctx.raw as number).toFixed(1)}%` } } } }}
            />
          ) : (
            <Chart
              type="line"
              data={{ labels: chartData.map(c => c.period), datasets: [{ label: 'Market Cap Change %', data: chartData.map(c => c.marketCapChange), borderColor: '#3b82f6', backgroundColor: 'rgba(59,130,246,0.06)', tension: 0.2 }] }}
              options={{ responsive: true, maintainAspectRatio: false, plugins: { tooltip: { callbacks: { label: (ctx: any) => `${(ctx.raw as number).toFixed(1)}%` } } } }}
            />
          )}
        </div>
      </div>

      {/* Volume Change Chart */}
      <div className="bg-white dark:bg-slate-800 rounded-lg p-6 border border-gray-200 dark:border-slate-700 shadow-sm">
        <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-4">24h Volume Change (%)</h3>
        <div style={{ height: 300 }}>
          {chartType === 'bar' ? (
            <Chart
              type="bar"
              data={{ labels: chartData.map(c => c.period), datasets: [{ label: 'Volume Change %', data: chartData.map(c => c.volumeChange), backgroundColor: '#10b981' }] }}
              options={{ responsive: true, maintainAspectRatio: false, plugins: { tooltip: { callbacks: { label: (ctx: any) => `${(ctx.raw as number).toFixed(1)}%` } } } }}
            />
          ) : (
            <Chart
              type="line"
              data={{ labels: chartData.map(c => c.period), datasets: [{ label: 'Volume Change %', data: chartData.map(c => c.volumeChange), borderColor: '#10b981', backgroundColor: 'rgba(16,185,129,0.06)', tension: 0.2 }] }}
              options={{ responsive: true, maintainAspectRatio: false, plugins: { tooltip: { callbacks: { label: (ctx: any) => `${(ctx.raw as number).toFixed(1)}%` } } } }}
            />
          )}
        </div>
      </div>

      {/* Detailed Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
        {changes.map((change) => (
          <div
            key={change.period}
            className="bg-white dark:bg-slate-800 rounded-lg p-4 border border-gray-200 dark:border-slate-700"
          >
            <div className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase mb-3">
              {getPeriodLabel(change.period)}
            </div>

            {/* Market Cap */}
            <div className="mb-4">
              <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">Market Cap</div>
              <div className="text-sm font-bold text-gray-900 dark:text-white mb-1">
                {formatLargeNumber(change.marketCap)}
              </div>
              {/* stylelint-disable-next-line */}
              <div
                className="text-xs font-semibold"
                style={{ color: formatChangePercent(change.marketCapChangePercent).color }}
              >
                {formatChangePercent(change.marketCapChangePercent).emoji}{' '}
                {formatChangePercent(change.marketCapChangePercent).formatted}
              </div>
            </div>

            {/* Volume */}
            <div className="border-t border-gray-200 dark:border-slate-700 pt-3">
              <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">24h Volume</div>
              <div className="text-sm font-bold text-gray-900 dark:text-white mb-1">
                {formatLargeNumber(change.volume24h)}
              </div>
              {/* stylelint-disable-next-line */}
              <div
                className="text-xs font-semibold"
                style={{ color: formatChangePercent(change.volumeChangePercent).color }}
              >
                {formatChangePercent(change.volumeChangePercent).emoji}{' '}
                {formatChangePercent(change.volumeChangePercent).formatted}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

/**
 * Helper to format period labels
 */
function getPeriodLabel(period: string): string {
  const labels: Record<string, string> = {
    '1d': '1 Day',
    '7d': '7 Days',
    '30d': '30 Days',
    '90d': '90 Days',
    '180d': '180 Days'
  };
  return labels[period] || period;
}

export default MarketChangesVisualization;
