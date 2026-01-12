/**
 * Liquidity Scoring Card Component
 * Displays comprehensive liquidity metrics with visual indicators
 * 
 * @note Dynamic inline styles required for real-time color updates based on liquidity data
 */
/* stylelint-disable */

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useLiquidityScore, useLiquidityRanking } from '@/hooks/useLiquidityScoring';
import {
  getLiquidityColor,
  getLiquidityEmoji,
  getRatingDescription,
  formatScoreWithIcon
} from '@/hooks/useLiquidityScoring';

export interface LiquidityScoringCardProps {
  symbol: string;
  exchange?: string;
}

/**
 * Liquidity Component Card
 */
const ComponentCard: React.FC<{
  title: string;
  score: number;
  rating: string;
  details: string;
  icon: string;
}> = ({ title, score, rating, details, icon }) => {
  const color = getLiquidityColor(rating);
  return (
    <div
      className="p-3 rounded-lg border"
      style={{
        borderColor: color,
        backgroundColor: color + '10'
      }}
    >
      <div className="flex items-start justify-between mb-2">
        <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">{title}</p>
        <span className="text-lg">{icon}</span>
      </div>
      <div className="flex items-baseline gap-2 mb-1">
        <p className="text-2xl font-bold" style={{ color }}>
          {score}
        </p>
        <span className="text-xs text-gray-500">/100</span>
      </div>
      <p className="text-xs text-gray-600 dark:text-gray-400">{details}</p>
      <Badge
        className="mt-2"
        style={{
          backgroundColor: color + '20',
          color: color,
          border: `1px solid ${color}`
        }}
      >
        {rating}
      </Badge>
    </div>
  );
};

/**
 * LiquidityScoringCard Component
 */
export const LiquidityScoringCard: React.FC<LiquidityScoringCardProps> = ({
  symbol,
  exchange = 'binance'
}) => {
  const { data: metrics, isLoading, error } = useLiquidityScore(symbol, exchange);
  const { data: ranking } = useLiquidityRanking(symbol);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Liquidity Scoring</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-40 flex items-center justify-center">
            <div className="text-gray-400">Calculating liquidity metrics...</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error || !metrics) {
    return (
      <Card className="border-red-200 bg-red-50">
        <CardHeader>
          <CardTitle className="text-red-900">Liquidity Analysis Error</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-red-800">{error?.message || 'Failed to load liquidity metrics'}</p>
        </CardContent>
      </Card>
    );
  }

  const { icon: scoreIcon, color: scoreColor } = formatScoreWithIcon(metrics.overall.score);

  return (
    <div className="space-y-4">
      {/* Overall Score Card */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center justify-between">
            <span>Overall Liquidity Score</span>
            <span className="text-4xl">{scoreIcon}</span>
          </CardTitle>
          <CardDescription>
            {exchange} • Updated {new Date(metrics.timestamp).toLocaleTimeString()}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Score Circle */}
            <div className="flex items-center justify-center">
              <div className="relative w-32 h-32 rounded-full border-8 flex items-center justify-center" 
                   style={{ borderColor: scoreColor, backgroundColor: scoreColor + '10' }}>
                <div className="text-center">
                  <p className="text-4xl font-bold" style={{ color: scoreColor }}>
                    {metrics.overall.score}
                  </p>
                  <p className="text-xs text-gray-500">/100</p>
                </div>
              </div>
            </div>

            {/* Rating and Description */}
            <div className="text-center">
              <Badge className="text-base mb-2" style={{ backgroundColor: scoreColor + '20', color: scoreColor, border: `1px solid ${scoreColor}` }}>
                {getRatingDescription(metrics.overall.rating)}
              </Badge>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                {metrics.overall.details}
              </p>
            </div>

            {/* Warnings */}
            {metrics.warnings && metrics.warnings.length > 0 && (
              <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-lg p-3">
                <p className="text-sm font-semibold text-yellow-900 dark:text-yellow-200 mb-2">⚠️ Warnings</p>
                <ul className="space-y-1">
                  {metrics.warnings.map((warning, idx) => (
                    <li key={idx} className="text-xs text-yellow-800 dark:text-yellow-300">
                      {warning}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Component Scores Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <ComponentCard
          title="Spread"
          score={metrics.spread.score}
          rating={metrics.spread.rating}
          details={metrics.spread.details}
          icon="📊"
        />
        <ComponentCard
          title="Depth"
          score={metrics.depth.score}
          rating={metrics.depth.rating}
          details={metrics.depth.details}
          icon="📈"
        />
        <ComponentCard
          title="Volume"
          score={metrics.volume.score}
          rating={metrics.volume.rating}
          details={metrics.volume.details}
          icon="💧"
        />
        <ComponentCard
          title="Stability"
          score={metrics.stability.score}
          rating={metrics.stability.rating}
          details={metrics.stability.details}
          icon="⚖️"
        />
        <ComponentCard
          title="Imbalance"
          score={metrics.imbalance.score}
          rating={metrics.imbalance.rating}
          details={metrics.imbalance.details}
          icon="⚡"
        />
        <ComponentCard
          title="Volatility"
          score={metrics.volatility.score}
          rating={metrics.volatility.rating}
          details={metrics.volatility.details}
          icon="📉"
        />
      </div>

      {/* Cross-Exchange Ranking */}
      {ranking && ranking.exchanges.length > 1 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Cross-Exchange Ranking</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {ranking.exchanges.map((ex, idx) => (
                <div key={ex.exchange} className="flex items-center justify-between p-2 bg-gray-50 dark:bg-slate-800 rounded">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-semibold text-gray-600 dark:text-gray-400 w-6">#{idx + 1}</span>
                    <span className="font-medium capitalize text-gray-900 dark:text-white">{ex.exchange}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="text-right">
                      <p className="text-sm font-bold" style={{ color: getLiquidityColor(ex.rating) }}>
                        {ex.score}
                      </p>
                      <p className="text-xs text-gray-500">{ex.rating}</p>
                    </div>
                  </div>
                </div>
              ))}
              <div className="pt-2 border-t border-gray-200 dark:border-slate-700 mt-2">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Best: <span className="font-semibold">{ranking.bestExchange.exchange}</span> ({ranking.bestExchange.score}/100)
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Average: <span className="font-semibold">{ranking.averageScore}/100</span>
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
