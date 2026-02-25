/**
 * PortfolioMetricsPanel Component
 * Summary of portfolio performance and key metrics
 * Displayed at top of dashboard
 */

import React from 'react';
import { TradingMetrics } from '@/client/hooks';

interface PortfolioMetricsPanelProps {
  metrics: TradingMetrics | null;
  loading: boolean;
}

export default function PortfolioMetricsPanel({
  metrics,
  loading,
}: PortfolioMetricsPanelProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="bg-slate-800 rounded-lg border border-slate-700 p-4 animate-pulse"
          >
            <div className="h-4 bg-slate-700 rounded w-1/2 mb-2"></div>
            <div className="h-6 bg-slate-700 rounded w-3/4"></div>
          </div>
        ))}
      </div>
    );
  }

  if (!metrics) return null;

  const metricCards = [
    {
      label: 'Total Orders',
      value: metrics.totalOrders,
      suffix: '',
      icon: '📊',
    },
    {
      label: 'Win Rate',
      value: (metrics.winRate * 100).toFixed(1),
      suffix: '%',
      icon: '🎯',
      color: metrics.winRate > 0.5 ? 'text-green-400' : 'text-red-400',
    },
    {
      label: 'Total P&L',
      value: metrics.totalPnL.toFixed(2),
      suffix: '$',
      icon: '💰',
      color: metrics.totalPnL > 0 ? 'text-green-400' : 'text-red-400',
    },
    {
      label: 'Avg Return',
      value: (metrics.averageReturn * 100).toFixed(2),
      suffix: '%',
      icon: '📈',
      color: metrics.averageReturn > 0 ? 'text-green-400' : 'text-red-400',
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
      {metricCards.map((card, idx) => (
        <div
          key={idx}
          className="bg-slate-800 rounded-lg border border-slate-700 p-4 hover:border-slate-600 transition-colors"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-slate-400 text-sm font-semibold">{card.label}</span>
            <span className="text-xl">{card.icon}</span>
          </div>
          <div className={`text-2xl font-bold ${card.color || 'text-white'}`}>
            {card.value}
            <span className="text-sm text-slate-400 ml-1">{card.suffix}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
