/**
 * RiskMetricsCard Component
 * Displays risk analysis including VaR, volatility, Sharpe ratio
 */

import React from 'react';
import { useRiskMetrics } from '@/client/hooks';

export default function RiskMetricsCard({ loading }: { loading: boolean }) {
  const { risk, loading: riskLoading, isHighRisk, isStable } = useRiskMetrics();

  const isLoading = loading || riskLoading;

  if (isLoading) {
    return (
      <div className="bg-slate-800 rounded-lg border border-slate-700 p-6 animate-pulse">
        <div className="h-6 bg-slate-700 rounded w-1/3 mb-4"></div>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-12 bg-slate-700 rounded w-full"></div>
          ))}
        </div>
      </div>
    );
  }

  if (!risk) {
    return (
      <div className="bg-slate-800 rounded-lg border border-slate-700 p-6 text-center">
        <p className="text-slate-400">Risk data unavailable</p>
      </div>
    );
  }

  const riskBgColor = isHighRisk ? 'border-red-700 bg-red-900/10' : 'border-green-700 bg-green-900/10';
  const stabilityIcon = isStable ? '✓' : '⚠';

  return (
    <div className={`bg-slate-800 rounded-lg border border-slate-700 p-6 ${riskBgColor}`}>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-white">Risk Metrics</h2>
        <span className="text-2xl">{stabilityIcon}</span>
      </div>

      <div className="space-y-3">
        {/* Value at Risk */}
        <RiskMetricRow
          label="Value at Risk (95%)"
          value={`${(risk.valueAtRisk * 100).toFixed(2)}%`}
          status={risk.valueAtRisk > 0.2 ? 'warning' : 'good'}
          description="Max loss in 95% of scenarios"
        />

        {/* Max Drawdown */}
        <RiskMetricRow
          label="Max Drawdown"
          value={`${Math.abs(risk.maximumDrawdown * 100).toFixed(2)}%`}
          status={Math.abs(risk.maximumDrawdown) > 0.3 ? 'warning' : 'good'}
          description="Peak-to-trough decline"
        />

        {/* Volatility */}
        <RiskMetricRow
          label="Volatility"
          value={`${(risk.volatility * 100).toFixed(2)}%`}
          status={risk.volatility > 0.3 ? 'high' : risk.volatility > 0.15 ? 'moderate' : 'low'}
          description="Standard deviation of returns"
        />

        {/* Sharpe Ratio */}
        <RiskMetricRow
          label="Sharpe Ratio"
          value={risk.sharpeRatio.toFixed(2)}
          status={risk.sharpeRatio > 1 ? 'good' : risk.sharpeRatio > 0 ? 'moderate' : 'warning'}
          description="Risk-adjusted return"
        />

        {/* Sortino Ratio */}
        <RiskMetricRow
          label="Sortino Ratio"
          value={risk.sortinoRatio.toFixed(2)}
          status={risk.sortinoRatio > risk.sharpeRatio ? 'good' : 'moderate'}
          description="Downside risk-adjusted"
        />

        {/* Beta */}
        <RiskMetricRow
          label="Beta"
          value={risk.beta.toFixed(2)}
          status={Math.abs(risk.beta - 1) < 0.3 ? 'good' : 'warning'}
          description="Market correlation"
        />
      </div>

      {/* Risk Summary */}
      <div className="mt-4 pt-4 border-t border-slate-600">
        {isHighRisk && (
          <div className="bg-red-900/30 rounded-lg p-3 border border-red-700">
            <p className="text-red-100 text-sm font-semibold">⚠️ High Risk Alert</p>
            <p className="text-red-300 text-xs mt-1">
              Your portfolio has elevated risk. Consider reducing exposure or increasing collateral.
            </p>
          </div>
        )}
        {isStable && (
          <div className="bg-green-900/30 rounded-lg p-3 border border-green-700">
            <p className="text-green-100 text-sm font-semibold">✓ Stable Portfolio</p>
            <p className="text-green-300 text-xs mt-1">
              Low volatility with good risk-adjusted returns.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * RiskMetricRow Component
 */
function RiskMetricRow({
  label,
  value,
  status,
  description,
}: {
  label: string;
  value: string;
  status: 'good' | 'moderate' | 'high' | 'warning' | 'low';
  description: string;
}) {
  const statusColors = {
    good: 'text-green-400 bg-green-900/20',
    moderate: 'text-yellow-400 bg-yellow-900/20',
    warning: 'text-orange-400 bg-orange-900/20',
    high: 'text-red-400 bg-red-900/20',
    low: 'text-blue-400 bg-blue-900/20',
  };

  return (
    <div className={`rounded-lg p-3 ${statusColors[status]}`}>
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm font-semibold text-slate-200">{label}</span>
        <span className="text-lg font-bold">{value}</span>
      </div>
      <p className="text-xs text-slate-300">{description}</p>
    </div>
  );
}
