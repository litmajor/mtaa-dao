/* stylelint-disable */
/* stylelint-disable */
/* stylelint-disable declaration-no-important, no-descending-specificity, no-duplicate-selectors */
/**
 * Fear & Greed Index Visualization Component
 * Creative gauge display with sentiment indicators
 *
 * Note: This component uses dynamic inline styles for SVG rotation and color mapping.
 * These styles are data-driven (fear/greed classification, metric status) and cannot
 * be externalized to CSS files. Stylelint warnings are intentionally suppressed.
 */

import React, { useMemo } from 'react';
import { useFearGreedIndex } from '@/hooks/useFearGreed';
import {
  getClassificationColor,
  getFearGreedGradient,
  getSentimentEmoji,
  getSentimentDescription,
  getMetricStatus
} from '@/hooks/useFearGreed';
import { formatDisplayValue, getOptimalDecimals } from '@/utils/dataVisualization';
import type { FearGreedMetrics } from '@/types/exchanges';

export const FearGreedGauge: React.FC = () => {
  const { data, isLoading, error } = useFearGreedIndex();

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
        <div className="text-red-700 font-semibold">Failed to load Fear & Greed Index</div>
      </div>
    );
  }

  if (!data?.fearGreedIndex) {
    return null;
  }

  const { fearGreedIndex } = data;
  const { score, classification, metrics, emoji, color } = fearGreedIndex;

  const gradient = getFearGreedGradient(classification);

  // Calculate gauge needle rotation (-90 to 90 degrees)
  const rotation = (score / 100) * 180 - 90;

  return (
    <div className="space-y-6">
      {/* Main Gauge Display */}
      <div className="bg-white dark:bg-slate-800 rounded-xl p-6 border border-gray-200 dark:border-slate-700 shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Fear & Greed Index</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Market Sentiment Analysis</p>
          </div>
          <div className="text-5xl">{emoji}</div>
        </div>

        {/* Gauge Container */}
        <div className="flex justify-center mb-8">
          <div className="relative w-64 h-32">
            {/* Gauge Background */}
            {/* stylelint-disable-next-line */}
            <svg
              className="w-full h-full"
              viewBox="0 0 200 120"
              style={{ filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.3))' }}
            >
              {/* Fear side (red) */}
              <defs>
                <linearGradient id="fearGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#8b0000" />
                  <stop offset="50%" stopColor="#ef4444" />
                </linearGradient>
                <linearGradient id="greedGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="50%" stopColor="#84cc16" />
                  <stop offset="100%" stopColor="#22c55e" />
                </linearGradient>
              </defs>

              {/* Background arc */}
              <path
                d="M 20 100 A 80 80 0 0 1 180 100"
                fill="none"
                stroke="#374151"
                strokeWidth="8"
                strokeLinecap="round"
              />

              {/* Fear arc (0-45) */}
              <path
                d="M 20 100 A 80 80 0 0 1 76.4 23.6"
                fill="none"
                stroke="url(#fearGradient)"
                strokeWidth="8"
                strokeLinecap="round"
                opacity="0.8"
              />

              {/* Neutral arc (45-55) */}
              <path
                d="M 76.4 23.6 A 80 80 0 0 1 123.6 23.6"
                fill="none"
                stroke="#f59e0b"
                strokeWidth="8"
                strokeLinecap="round"
                opacity="0.8"
              />

              {/* Greed arc (55-100) */}
              <path
                d="M 123.6 23.6 A 80 80 0 0 1 180 100"
                fill="none"
                stroke="url(#greedGradient)"
                strokeWidth="8"
                strokeLinecap="round"
                opacity="0.8"
              />

              {/* Scale labels */}
              <text x="20" y="115" fontSize="10" fill="#9ca3af" textAnchor="middle">
                0
              </text>
              <text x="50" y="25" fontSize="10" fill="#9ca3af" textAnchor="middle">
                Fear
              </text>
              <text x="100" y="10" fontSize="11" fill="#f59e0b" fontWeight="bold" textAnchor="middle">
                50
              </text>
              <text x="150" y="25" fontSize="10" fill="#9ca3af" textAnchor="middle">
                Greed
              </text>
              <text x="180" y="115" fontSize="10" fill="#9ca3af" textAnchor="middle">
                100
              </text>

              {/* Needle */}
              {/* stylelint-disable-next-line */}
              <g style={{ transform: `rotate(${rotation}deg)`, transformOrigin: '100px 100px' }}>
                <line x1="100" y1="100" x2="100" y2="25" stroke={color} strokeWidth="3" strokeLinecap="round" />
                <circle cx="100" cy="100" r="5" fill={color} />
              </g>
            </svg>

            {/* Score Display */}
            <div className="absolute inset-0 flex items-end justify-center pb-2">
              <div className="text-center">
                {/* stylelint-disable-next-line */}
                <div className="text-4xl font-black" style={{ color: color }}>
                  {score.toFixed(1)}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Classification Info */}
        <div className="text-center">
          {/* stylelint-disable-next-line */}
          <div
            className="inline-block px-4 py-2 rounded-full font-semibold text-sm mb-2"
            style={{ backgroundColor: color + '20', color: color }}
          >
            {getSentimentDescription(classification)}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <MetricCard label="Volatility" value={metrics.volatility} metric="volatility" />
        <MetricCard label="Momentum" value={metrics.momentum} metric="momentum" />
        <MetricCard label="Market Trend" value={metrics.marketTrend} metric="marketTrend" />
        <MetricCard label="Dominance" value={metrics.dominance} metric="dominance" />
        <MetricCard label="Volume" value={metrics.volume} metric="volume" />
      </div>

      {/* Interpretation Guide */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-red-50 dark:bg-slate-800 rounded-lg p-4 border border-red-200 dark:border-slate-700 shadow-sm">
          <div className="text-sm font-semibold text-red-900 dark:text-red-400 mb-2">😨 Fear Zone</div>
          <div className="text-xs text-red-800 dark:text-red-300">
            High volatility, negative momentum, and weak market trend. Often marks potential buying opportunities.
          </div>
        </div>
        <div className="bg-green-50 dark:bg-slate-800 rounded-lg p-4 border border-green-200 dark:border-slate-700 shadow-sm">
          <div className="text-sm font-semibold text-green-900 dark:text-green-400 mb-2">🤑 Greed Zone</div>
          <div className="text-xs text-green-800 dark:text-green-300">
            Low volatility, positive momentum, and strong market trend. May signal overheated market conditions.
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * Individual Metric Card
 */
const MetricCard: React.FC<{
  label: string;
  value: number;
  metric: string;
}> = ({ label, value, metric }) => {
  const status = getMetricStatus(metric, value);

  const statusColor: Record<string, string> = {
    excellent: '#22c55e',
    good: '#84cc16',
    fair: '#f59e0b',
    poor: '#ef4444'
  };

  // Smart rounding: show 1 decimal for values under 50, whole number for values 50+
  const displayValue = value < 50 ? value.toFixed(1) : value.toFixed(0);

  return (
    <div className="bg-white dark:bg-slate-800 rounded-lg p-3 border border-gray-200 dark:border-slate-700">
      <div className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase mb-2">
        {label}
      </div>
      <div className="flex items-baseline gap-2 mb-2">
        <div className="text-2xl font-bold text-gray-900 dark:text-white">
          {displayValue}
        </div>
        {/* stylelint-disable-next-line */}
        <div className="text-xs font-semibold capitalize" style={{ color: statusColor[status] }}>
          {status}
        </div>
      </div>
      {/* Mini bar */}
      <div className="w-full h-1.5 bg-gray-200 dark:bg-slate-700 rounded-full overflow-hidden">
        {/* stylelint-disable-next-line */}
        <div
          className="h-full transition-all duration-300"
          style={{
            width: `${Math.min(100, value)}%`,
            backgroundColor: statusColor[status]
          }}
        ></div>
      </div>
    </div>
  );
};

export default FearGreedGauge;
