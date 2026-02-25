/**
 * FeeOptimizationCard Component
 * Shows fee analysis and optimization recommendations
 */

import React from 'react';
import { useFeeOptimization } from '@/client/hooks';

export default function FeeOptimizationCard({ loading }: { loading: boolean }) {
  const { optimization, loading: optLoading, recommendations, totalPotentialSavings } = useFeeOptimization();

  const isLoading = loading || optLoading;

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
      <h2 className="text-xl font-bold text-white mb-4">Fee Optimization</h2>

      {totalPotentialSavings > 0 && (
        <div className="bg-green-900/30 border border-green-700 rounded-lg p-4 mb-4">
          <p className="text-green-100 font-semibold">Potential Savings</p>
          <p className="text-3xl font-bold text-green-400">${totalPotentialSavings.toFixed(2)}</p>
          <p className="text-green-300 text-sm mt-1">
            Apply recommendations to reduce trading costs
          </p>
        </div>
      )}

      <div className="space-y-3">
        {recommendations && recommendations.length > 0 ? (
          recommendations.map((rec, idx) => (
            <div
              key={idx}
              className="bg-slate-700/50 rounded-lg p-4 hover:bg-slate-700 transition-colors border-l-4 border-blue-500"
            >
              <div className="flex items-start justify-between mb-2">
                <h3 className="font-semibold text-white">{rec.title}</h3>
                <span className="text-green-400 font-bold text-sm">
                  Save ${rec.savings.toFixed(2)}
                </span>
              </div>
              <p className="text-slate-400 text-sm">{rec.description}</p>
            </div>
          ))
        ) : (
          <p className="text-slate-400 text-center py-8">No recommendations at this time</p>
        )}
      </div>

      {/* Fee Details */}
      {optimization && (
        <div className="mt-4 pt-4 border-t border-slate-700 space-y-2 text-sm">
          {optimization.makerTakerDifference && (
            <div className="flex justify-between">
              <span className="text-slate-400">Maker vs Taker Diff</span>
              <span className="text-white font-semibold">
                ~{optimization.makerTakerDifference}%
              </span>
            </div>
          )}
          {optimization.bestExchangeForFees && (
            <div className="flex justify-between">
              <span className="text-slate-400">Best Exchange for Fees</span>
              <span className="text-white font-semibold capitalize">
                {optimization.bestExchangeForFees}
              </span>
            </div>
          )}
          {optimization.nextVipTierVolumeNeeded && (
            <div className="flex justify-between">
              <span className="text-slate-400">Next VIP Tier</span>
              <span className="text-white font-semibold">
                ${optimization.nextVipTierVolumeNeeded.toFixed(0)} volume needed
              </span>
            </div>
          )}
        </div>
      )}

      {/* Action Recommendation */}
      <div className="mt-4 pt-4 border-t border-slate-700">
        <p className="text-slate-400 text-xs mb-2">💡 Recommendation:</p>
        <p className="text-slate-300 text-sm">
          {totalPotentialSavings > 0
            ? 'Implement the above strategies to reduce your trading costs.'
            : 'Your fee structure is already optimized for your trading pattern.'}
        </p>
      </div>
    </div>
  );
}
