/**
 * DiversificationCard Component
 * Shows portfolio diversification analysis and correlation matrix
 */

import React from 'react';
import { useCorrelationAnalysis } from '@/client/hooks';

export default function DiversificationCard({ loading }: { loading: boolean }) {
  const { correlations, loading: corrLoading, diversificationScore, isWellDiversified } =
    useCorrelationAnalysis();

  const isLoading = loading || corrLoading;

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

  // Get diversification status
  const getDiversificationStatus = (score: number) => {
    if (score > 75) return { label: 'Excellent', color: 'text-green-400', icon: '★★★★★' };
    if (score > 60) return { label: 'Good', color: 'text-green-400', icon: '★★★★☆' };
    if (score > 40) return { label: 'Moderate', color: 'text-yellow-400', icon: '★★★☆☆' };
    if (score > 20) return { label: 'Poor', color: 'text-orange-400', icon: '★★☆☆☆' };
    return { label: 'Very Poor', color: 'text-red-400', icon: '★☆☆☆☆' };
  };

  const status = getDiversificationStatus(diversificationScore);

  return (
    <div className="bg-slate-800 rounded-lg border border-slate-700 p-6">
      <h2 className="text-xl font-bold text-white mb-4">Portfolio Diversification</h2>

      {/* Score Display */}
      <div className="bg-slate-700/50 rounded-lg p-4 mb-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-slate-300 font-semibold">Diversification Score</span>
          <span className={`text-3xl font-bold ${status.color}`}>
            {diversificationScore.toFixed(0)}
          </span>
        </div>

        {/* Progress Bar */}
        <div className="w-full h-3 bg-slate-600 rounded-full overflow-hidden">
          <div
            className={`h-full transition-all ${
              diversificationScore > 60
                ? 'bg-gradient-to-r from-green-500 to-green-400'
                : diversificationScore > 40
                ? 'bg-gradient-to-r from-yellow-500 to-yellow-400'
                : 'bg-gradient-to-r from-red-500 to-red-400'
            }`}
            style={{ width: `${diversificationScore}%` }}
          />
        </div>

        {/* Status */}
        <div className="flex items-center gap-2 mt-3">
          <span className={status.color}>{status.icon}</span>
          <span className={`font-semibold ${status.color}`}>{status.label}</span>
          <span className="text-slate-400 text-sm ml-2">
            {isWellDiversified
              ? 'Portfolio is well diversified'
              : 'Consider increasing diversification'}
          </span>
        </div>
      </div>

      {/* Insights */}
      <div className="space-y-2">
        <InsightItem
          icon="📊"
          title="Pair Concentration"
          description={
            diversificationScore > 60
              ? 'Well-distributed across pairs'
              : 'Concentrated in few pairs'
          }
        />
        <InsightItem
          icon="🏦"
          title="Exchange Diversification"
          description={
            diversificationScore > 60
              ? 'Trading across multiple exchanges'
              : 'Most volume on single exchange'
          }
        />
        <InsightItem
          icon="📈"
          title="Market Type Mix"
          description={
            diversificationScore > 60
              ? 'Balanced across market types'
              : 'Focused on specific market types'
          }
        />
        <InsightItem
          icon="⚠️"
          title="Risk Impact"
          description={
            diversificationScore > 60
              ? 'Reduced portfolio volatility'
              : 'Higher exposure to single asset'
          }
        />
      </div>

      {/* Recommendations */}
      <div className="mt-4 pt-4 border-t border-slate-700">
        <p className="text-white font-semibold mb-2">Recommendations:</p>
        <ul className="text-slate-400 text-sm space-y-1">
          {diversificationScore < 60 && (
            <>
              <li>• Add more trading pairs to your portfolio</li>
              <li>• Consider trading on additional exchanges</li>
              <li>• Mix different market types (spot + perpetuals)</li>
            </>
          )}
          {diversificationScore >= 60 && (
            <>
              <li>• Maintain current diversification level</li>
              <li>• Monitor correlation changes regularly</li>
              <li>• Rebalance if one position dominates</li>
            </>
          )}
        </ul>
      </div>

      {/* Correlation Matrix Preview */}
      {correlations && Object.keys(correlations).length > 0 && (
        <div className="mt-4 pt-4 border-t border-slate-700">
          <p className="text-white font-semibold mb-3">Correlation Matrix</p>
          <div className="grid grid-cols-2 gap-2">
            {Object.entries(correlations).slice(0, 4).map(([pair, corr]: [string, any]) => (
              <div key={pair} className="bg-slate-700/50 rounded-lg p-2">
                <p className="text-slate-300 text-xs font-semibold">{pair}</p>
                <p className={`text-sm font-bold ${getCorrelationColor(corr)}`}>
                  {typeof corr === 'number' ? corr.toFixed(2) : 'N/A'}
                </p>
              </div>
            ))}
          </div>
          {Object.keys(correlations).length > 4 && (
            <p className="text-slate-400 text-xs mt-2">
              +{Object.keys(correlations).length - 4} more pairs
            </p>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * InsightItem Component
 */
function InsightItem({
  icon,
  title,
  description,
}: {
  icon: string;
  title: string;
  description: string;
}) {
  return (
    <div className="flex gap-3 p-3 rounded-lg bg-slate-700/30">
      <span className="text-xl">{icon}</span>
      <div>
        <p className="text-slate-300 text-sm font-semibold">{title}</p>
        <p className="text-slate-400 text-xs">{description}</p>
      </div>
    </div>
  );
}

/**
 * Get color based on correlation value
 */
function getCorrelationColor(value: number | any): string {
  if (typeof value !== 'number') return 'text-slate-400';
  if (value > 0.7) return 'text-red-400';
  if (value > 0.4) return 'text-yellow-400';
  if (value > 0) return 'text-blue-400';
  if (value > -0.4) return 'text-green-400';
  return 'text-green-500';
}
