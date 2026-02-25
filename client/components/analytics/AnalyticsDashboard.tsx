/**
 * AnalyticsDashboard Component
 * Comprehensive analytics view with performance metrics, pair analysis, and risk assessment
 * Integrates all analytics hooks from Iteration 8
 */

import React, { useState } from 'react';
import { useDashboardSummary, useTimeBasedAnalytics } from '@/client/hooks';
import PortfolioMetricsCard from './PortfolioMetricsCard';
import PairPerformanceCard from './PairPerformanceCard';
import ExchangeComparisonCard from './ExchangeComparisonCard';
import TimeSeriesChart from './TimeSeriesChart';
import RiskMetricsCard from './RiskMetricsCard';
import FeeOptimizationCard from './FeeOptimizationCard';
import DiversificationCard from './DiversificationCard';

type TimeframeType = 'day' | 'week' | 'month' | 'year';

export default function AnalyticsDashboard() {
  const [timeframe, setTimeframe] = useState<TimeframeType>('week');
  const { summary, loading: summaryLoading, error: summaryError } = useDashboardSummary();
  const { cumulativeMetrics, loading: timeLoading } = useTimeBasedAnalytics(timeframe);

  const isLoading = summaryLoading || timeLoading;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">Trading Analytics</h1>
          <p className="text-slate-400">Comprehensive performance analysis and insights</p>
        </div>

        {/* Timeframe Selector */}
        <div className="bg-slate-800 rounded-lg border border-slate-700 p-4 mb-6">
          <div className="flex flex-wrap gap-2">
            <span className="text-slate-400 font-semibold self-center">Timeframe:</span>
            {(['day', 'week', 'month', 'year'] as const).map((tf) => (
              <button
                key={tf}
                onClick={() => setTimeframe(tf)}
                className={`px-4 py-2 rounded-lg font-semibold transition-all ${
                  timeframe === tf
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                }`}
              >
                {tf.charAt(0).toUpperCase() + tf.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Error Display */}
        {summaryError && (
          <div className="bg-red-900 border border-red-700 rounded-lg p-4 mb-6">
            <p className="text-red-100">Error loading analytics. Please refresh.</p>
          </div>
        )}

        {/* Main Metrics Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          {/* Portfolio Metrics (spans 2 columns on desktop) */}
          <div className="lg:col-span-2">
            <PortfolioMetricsCard summary={summary} loading={isLoading} />
          </div>

          {/* Risk Metrics */}
          <div>
            <RiskMetricsCard loading={isLoading} />
          </div>
        </div>

        {/* Time Series Chart */}
        <div className="mb-6">
          <TimeSeriesChart metrics={cumulativeMetrics} timeframe={timeframe} loading={timeLoading} />
        </div>

        {/* Bottom Row: Pair, Exchange, Fee Analysis */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          <PairPerformanceCard loading={isLoading} />
          <ExchangeComparisonCard loading={isLoading} />
          <FeeOptimizationCard loading={isLoading} />
        </div>

        {/* Diversification & Insights */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <DiversificationCard loading={isLoading} />
          
          {/* Key Insights */}
          <div className="bg-slate-800 rounded-lg border border-slate-700 p-6">
            <h2 className="text-xl font-bold text-white mb-4">Key Insights</h2>
            <div className="space-y-3">
              {summary ? (
                <>
                  <InsightCard
                    icon="🎯"
                    title="Win Rate"
                    value={`${(summary.winRate * 100).toFixed(1)}%`}
                    status={summary.winRate > 0.5 ? 'positive' : 'negative'}
                  />
                  <InsightCard
                    icon="📊"
                    title="Total Trades"
                    value={summary.totalTrades.toString()}
                    status="neutral"
                  />
                  <InsightCard
                    icon="💰"
                    title="Profit Margin"
                    value={`${((summary.totalProfit / summary.totalCapital) * 100).toFixed(2)}%`}
                    status={summary.totalProfit > 0 ? 'positive' : 'negative'}
                  />
                  <InsightCard
                    icon="⚠️"
                    title="Fee Impact"
                    value={`${((summary.totalFees / summary.totalCapital) * 100).toFixed(2)}%`}
                    status={((summary.totalFees / summary.totalCapital) * 100) < 1 ? 'positive' : 'warning'}
                  />
                </>
              ) : (
                <p className="text-slate-400">Loading insights...</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * InsightCard Component - Small metric card
 */
function InsightCard({
  icon,
  title,
  value,
  status,
}: {
  icon: string;
  title: string;
  value: string;
  status: 'positive' | 'negative' | 'neutral' | 'warning';
}) {
  const statusColors = {
    positive: 'text-green-400',
    negative: 'text-red-400',
    warning: 'text-orange-400',
    neutral: 'text-blue-400',
  };

  return (
    <div className="flex items-center justify-between p-3 rounded-lg bg-slate-700/50">
      <div className="flex items-center gap-3">
        <span className="text-2xl">{icon}</span>
        <span className="text-slate-300 text-sm">{title}</span>
      </div>
      <span className={`font-bold ${statusColors[status]}`}>{value}</span>
    </div>
  );
}
