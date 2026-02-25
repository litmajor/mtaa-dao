/**
 * SmartRouterUI Component
 * Real-time fee comparison, liquidity analysis, and best execution paths
 */

'use client';

import React, { useState, useEffect } from 'react';
import { useSmartRouting, useFeeComparison, useLiquidityAnalysis, useSlippageCalculation } from '@/client/hooks/useSmartRouter';

interface SmartRouterUIProps {
  pair: string;
  quantity: number;
  side: 'BUY' | 'SELL';
  marketType?: 'spot' | 'margin' | 'futures' | 'swap';
}

export default function SmartRouterUI({ pair, quantity, side, marketType = 'spot' }: SmartRouterUIProps) {
  const [expandedPath, setExpandedPath] = useState<number | null>(0);
  const [selectedExchange, setSelectedExchange] = useState<string | null>(null);

  // Hooks for analysis
  const { routing, loading: routingLoading, error: routingError } = useSmartRouting(pair, quantity, side);
  const { fees, loading: feesLoading } = useFeeComparison();
  const { liquidity, loading: liquidityLoading } = useLiquidityAnalysis(pair);
  const { slippage, loading: slippageLoading } = useSlippageCalculation(pair, quantity, side);

  if (routingLoading || feesLoading) {
    return (
      <div className="bg-slate-800 rounded-lg border border-slate-700 p-6 animate-pulse">
        <div className="h-8 bg-slate-700 rounded w-1/3 mb-4"></div>
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 bg-slate-700 rounded"></div>
          ))}
        </div>
      </div>
    );
  }

  if (routingError) {
    return (
      <div className="bg-red-900/20 border border-red-700 rounded-lg p-6">
        <p className="text-red-400 font-semibold">Error loading routing data: {routingError}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-slate-800 rounded-lg border border-slate-700 p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-2xl font-bold text-white">Smart Router</h2>
            <p className="text-slate-400 text-sm mt-1">{pair} | {quantity.toFixed(4)} units | {side}</p>
          </div>
          <div className="text-right">
            <p className="text-slate-400 text-sm">Best Path</p>
            <p className="text-2xl font-bold text-green-400">{routing?.bestPath.exchange}</p>
          </div>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-slate-700/50 p-3 rounded">
            <p className="text-slate-400 text-sm">Fee</p>
            <p className="text-lg font-bold text-white">{(routing?.bestPath.feePercent * 100).toFixed(4)}%</p>
          </div>
          <div className="bg-slate-700/50 p-3 rounded">
            <p className="text-slate-400 text-sm">Slippage</p>
            <p className="text-lg font-bold text-white">{(slippage?.estimated * 100).toFixed(3)}%</p>
          </div>
          <div className="bg-slate-700/50 p-3 rounded">
            <p className="text-slate-400 text-sm">Total Cost</p>
            <p className="text-lg font-bold text-white">${(routing?.bestPath.totalCost || 0).toFixed(2)}</p>
          </div>
          <div className="bg-green-900/30 border border-green-700 p-3 rounded">
            <p className="text-green-400 text-sm">Savings</p>
            <p className="text-lg font-bold text-green-400">
              {(routing?.savings || 0).toFixed(2)} (
              {(routing?.savingsPercent || 0).toFixed(1)}%)
            </p>
          </div>
        </div>
      </div>

      {/* Best Execution Paths */}
      <div className="bg-slate-800 rounded-lg border border-slate-700 p-6">
        <h3 className="text-xl font-bold text-white mb-4">Best Execution Paths</h3>

        <div className="space-y-3">
          {routing?.paths.map((path, index) => (
            <div
              key={index}
              className={`rounded-lg border p-4 cursor-pointer transition ${
                expandedPath === index
                  ? 'bg-slate-700 border-blue-600'
                  : 'bg-slate-700/50 border-slate-600 hover:bg-slate-700 hover:border-slate-500'
              }`}
              onClick={() => setExpandedPath(expandedPath === index ? null : index)}
            >
              {/* Collapsed View */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4 flex-1">
                  <div className="flex items-center gap-2 min-w-fit">
                    {index === 0 && <span className="text-yellow-400 text-lg">⭐</span>}
                    <span className="font-bold text-white w-24">{path.exchange}</span>
                  </div>

                  <div className="hidden md:flex items-center gap-6 text-sm flex-1">
                    <div>
                      <p className="text-slate-400">Fee</p>
                      <p className="text-white font-semibold">{(path.feePercent * 100).toFixed(4)}%</p>
                    </div>
                    <div>
                      <p className="text-slate-400">Liquidity</p>
                      <p className="text-white font-semibold">${(path.liquidity || 0).toFixed(0)}</p>
                    </div>
                    <div>
                      <p className="text-slate-400">Slippage</p>
                      <p className="text-white font-semibold">{(path.slippage * 100).toFixed(3)}%</p>
                    </div>
                  </div>
                </div>

                <div className="text-right">
                  <p className="text-slate-400 text-xs">Total</p>
                  <p className="text-white font-bold text-lg">${(path.totalCost || 0).toFixed(2)}</p>
                </div>

                <span className="ml-4 text-slate-400">{expandedPath === index ? '▼' : '▶'}</span>
              </div>

              {/* Expanded View */}
              {expandedPath === index && (
                <div className="mt-4 pt-4 border-t border-slate-600 space-y-3">
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    <div>
                      <p className="text-slate-400 text-xs uppercase">Exchange</p>
                      <p className="text-white font-semibold">{path.exchange}</p>
                    </div>
                    <div>
                      <p className="text-slate-400 text-xs uppercase">Maker Fee</p>
                      <p className="text-white font-semibold">{(path.makerFee * 100).toFixed(4)}%</p>
                    </div>
                    <div>
                      <p className="text-slate-400 text-xs uppercase">Taker Fee</p>
                      <p className="text-white font-semibold">{(path.takerFee * 100).toFixed(4)}%</p>
                    </div>

                    <div>
                      <p className="text-slate-400 text-xs uppercase">Liquidity</p>
                      <p className="text-white font-semibold">${(path.liquidity || 0).toFixed(0)}</p>
                    </div>
                    <div>
                      <p className="text-slate-400 text-xs uppercase">Slippage</p>
                      <p className="text-white font-semibold">{(path.slippage * 100).toFixed(3)}%</p>
                    </div>
                    <div>
                      <p className="text-slate-400 text-xs uppercase">Available</p>
                      <p className={`font-semibold ${path.availableForOrder ? 'text-green-400' : 'text-red-400'}`}>
                        {path.availableForOrder ? 'Yes' : 'Insufficient'}
                      </p>
                    </div>
                  </div>

                  {/* Cost Breakdown */}
                  <div className="bg-slate-600/30 p-3 rounded space-y-2">
                    <p className="text-slate-300 font-semibold text-sm">Cost Breakdown</p>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-400">Order Value:</span>
                      <span className="text-white">${(path.orderValue || 0).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-400">Fee Amount:</span>
                      <span className="text-white">${(path.feeAmount || 0).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-400">Slippage Impact:</span>
                      <span className="text-white">${(path.slippageAmount || 0).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm border-t border-slate-500 pt-2">
                      <span className="text-slate-300 font-semibold">Total Cost:</span>
                      <span className="text-white font-bold">${(path.totalCost || 0).toFixed(2)}</span>
                    </div>
                  </div>

                  {/* Alternative Routes */}
                  {path.alternativeRoutes && path.alternativeRoutes.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-slate-300 font-semibold text-sm">Alternative Routes</p>
                      {path.alternativeRoutes.map((alt, altIdx) => (
                        <div key={altIdx} className="bg-slate-600/20 p-2 rounded text-xs">
                          <p className="text-slate-300">{alt.path}</p>
                          <p className="text-slate-400 mt-1">
                            Cost: ${(alt.cost || 0).toFixed(2)} | Fee: {(alt.fee * 100).toFixed(4)}%
                          </p>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Select Button */}
                  <button
                    onClick={() => setSelectedExchange(path.exchange)}
                    className="w-full mt-3 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition"
                  >
                    Use This Exchange
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Liquidity Heatmap */}
      {liquidity && liquidity.exchanges.length > 0 && (
        <div className="bg-slate-800 rounded-lg border border-slate-700 p-6">
          <h3 className="text-xl font-bold text-white mb-4">Liquidity by Exchange</h3>

          <div className="space-y-2">
            {liquidity.exchanges
              .sort((a, b) => (b.depth || 0) - (a.depth || 0))
              .map((ex) => (
                <div key={ex.exchange} className="space-y-1">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-white font-semibold">{ex.exchange}</span>
                    <span className="text-slate-400 text-sm">${(ex.depth || 0).toFixed(0)}</span>
                  </div>
                  <div className="w-full bg-slate-700 rounded-full h-2 overflow-hidden">
                    <div
                      className={`h-full transition-all ${
                        (ex.depth || 0) > liquidity.avgDepth
                          ? 'bg-green-600'
                          : 'bg-yellow-600'
                      }`}
                      style={{
                        width: `${Math.min(100, ((ex.depth || 0) / (liquidity.maxDepth || 1)) * 100)}%`,
                      }}
                    ></div>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Slippage Analysis */}
      {slippage && (
        <div className="bg-slate-800 rounded-lg border border-slate-700 p-6">
          <h3 className="text-xl font-bold text-white mb-4">Slippage Analysis</h3>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div className="bg-slate-700/50 p-3 rounded">
              <p className="text-slate-400 text-sm">Estimated</p>
              <p className="text-xl font-bold text-white">{(slippage.estimated * 100).toFixed(3)}%</p>
            </div>
            <div className="bg-slate-700/50 p-3 rounded">
              <p className="text-slate-400 text-sm">Best Case</p>
              <p className="text-xl font-bold text-green-400">{(slippage.bestCase * 100).toFixed(3)}%</p>
            </div>
            <div className="bg-slate-700/50 p-3 rounded">
              <p className="text-slate-400 text-sm">Worst Case</p>
              <p className="text-xl font-bold text-red-400">{(slippage.worstCase * 100).toFixed(3)}%</p>
            </div>
          </div>

          {slippage.warning && (
            <div className="mt-4 bg-yellow-900/30 border border-yellow-700 rounded-lg p-3">
              <p className="text-yellow-400 text-sm font-semibold">⚠ {slippage.warning}</p>
            </div>
          )}
        </div>
      )}

      {/* Selected Exchange Info */}
      {selectedExchange && (
        <div className="bg-blue-900/20 border border-blue-600 rounded-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-blue-400 text-sm">Selected Exchange</p>
              <p className="text-2xl font-bold text-blue-300">{selectedExchange}</p>
            </div>
            <button
              onClick={() => setSelectedExchange(null)}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition"
            >
              Proceed to Order
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
