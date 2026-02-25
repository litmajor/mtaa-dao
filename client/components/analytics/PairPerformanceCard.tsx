/**
 * PairPerformanceCard Component
 * Shows best and worst performing trading pairs
 */

import React from 'react';
import { usePairPerformance } from '@/client/hooks';

export default function PairPerformanceCard({ loading }: { loading: boolean }) {
  const { pairs, loading: pairsLoading, topPair, bestPerformer } = usePairPerformance();

  const isLoading = loading || pairsLoading;

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

  const topPairs = pairs.slice(0, 5);

  return (
    <div className="bg-slate-800 rounded-lg border border-slate-700 p-6">
      <h2 className="text-xl font-bold text-white mb-4">Pair Performance</h2>

      {topPairs.length > 0 ? (
        <div className="space-y-2">
          {topPairs.map((pair, idx) => {
            const pnlColor = pair.totalPnL > 0 ? 'text-green-400' : 'text-red-400';
            const winRateColor = pair.totalTrades > 0 && pair.winningTrades / pair.totalTrades > 0.5
              ? 'text-green-400'
              : 'text-red-400';

            return (
              <div
                key={pair.pair}
                className="bg-slate-700/50 rounded-lg p-3 hover:bg-slate-700 transition-colors"
              >
                {/* Pair Header */}
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-white">{pair.pair}</span>
                    <span className="text-xs bg-slate-600 text-slate-300 px-2 py-1 rounded">
                      {pair.totalTrades} trades
                    </span>
                  </div>
                  <span className={`font-bold ${pnlColor}`}>
                    {pair.totalPnL > 0 ? '+' : ''} ${pair.totalPnL.toFixed(2)}
                  </span>
                </div>

                {/* Metrics Row */}
                <div className="flex items-center justify-between gap-2 text-xs">
                  <div className="flex gap-3">
                    <span className="text-slate-400">
                      Win Rate: <span className={`font-semibold ${winRateColor}`}>
                        {((pair.winningTrades / pair.totalTrades) * 100 || 0).toFixed(1)}%
                      </span>
                    </span>
                    <span className="text-slate-400">
                      Avg Return: <span className={`font-semibold ${pnlColor}`}>
                        {pair.averageReturn.toFixed(2)}%
                      </span>
                    </span>
                  </div>
                  <span className="text-slate-400">
                    Max DD: <span className="font-semibold text-orange-400">
                      {Math.abs(pair.maxDrawdown).toFixed(2)}%
                    </span>
                  </span>
                </div>

                {/* Sharpe Ratio */}
                <div className="mt-2 pt-2 border-t border-slate-600/50">
                  <span className="text-xs text-slate-400">
                    Sharpe Ratio: <span className="font-semibold text-blue-400">
                      {pair.sharpRatio.toFixed(2)}
                    </span>
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-8">
          <p className="text-slate-400">No pair data available</p>
        </div>
      )}

      {/* Market Types Badge */}
      {topPair && topPair.marketTypes && topPair.marketTypes.length > 0 && (
        <div className="mt-4 pt-4 border-t border-slate-700">
          <p className="text-slate-400 text-xs mb-2">Market Types:</p>
          <div className="flex flex-wrap gap-2">
            {topPair.marketTypes.map((type) => (
              <span
                key={type}
                className="text-xs px-2 py-1 rounded-full bg-slate-600 text-slate-200"
              >
                {type}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
