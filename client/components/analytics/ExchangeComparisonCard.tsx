/**
 * ExchangeComparisonCard Component
 * Compares performance across exchanges
 */

import React from 'react';
import { useExchangePerformance } from '@/client/hooks';

export default function ExchangeComparisonCard({ loading }: { loading: boolean }) {
  const { exchanges, loading: exchangeLoading, summary } = useExchangePerformance();

  const isLoading = loading || exchangeLoading;

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

  return (
    <div className="bg-slate-800 rounded-lg border border-slate-700 p-6">
      <h2 className="text-xl font-bold text-white mb-4">Exchange Performance</h2>

      {exchanges.length > 0 ? (
        <>
          <div className="space-y-2 mb-4">
            {exchanges.map((exchange) => {
              const pnlColor = exchange.totalPnL > 0 ? 'text-green-400' : 'text-red-400';

              return (
                <div
                  key={exchange.exchange}
                  className="bg-slate-700/50 rounded-lg p-3 hover:bg-slate-700 transition-colors"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-white capitalize">{exchange.exchange}</span>
                      <span className="text-xs bg-slate-600 text-slate-300 px-2 py-1 rounded">
                        {exchange.totalTrades} trades
                      </span>
                    </div>
                    <span className={`font-bold ${pnlColor}`}>
                      {exchange.totalPnL > 0 ? '+' : ''} ${exchange.totalPnL.toFixed(2)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400">
                      Fees: <span className="font-semibold text-orange-400">
                        ${exchange.totalFees.toFixed(2)}
                      </span>
                    </span>
                    <span className="text-slate-400">
                      Best Pair: <span className="font-semibold text-blue-400">
                        {exchange.bestPair}
                      </span>
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Summary */}
          {summary && (
            <div className="pt-4 border-t border-slate-700 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-400">Total Fees</span>
                <span className="text-white font-semibold">
                  ${summary.totalFees.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Total P&L</span>
                <span className={`font-semibold ${summary.totalPnL > 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {summary.totalPnL > 0 ? '+' : ''} ${summary.totalPnL.toFixed(2)}
                </span>
              </div>
              {summary.bestExchange && (
                <div className="flex justify-between">
                  <span className="text-slate-400">Best Exchange</span>
                  <span className="text-white font-semibold capitalize">
                    {summary.bestExchange.exchange}
                  </span>
                </div>
              )}
              {summary.lowestFees && (
                <div className="flex justify-between">
                  <span className="text-slate-400">Lowest Fees</span>
                  <span className="text-white font-semibold capitalize">
                    {summary.lowestFees.exchange}
                  </span>
                </div>
              )}
            </div>
          )}
        </>
      ) : (
        <div className="text-center py-8">
          <p className="text-slate-400">No exchange data available</p>
        </div>
      )}
    </div>
  );
}
