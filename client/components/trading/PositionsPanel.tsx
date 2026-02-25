/**
 * PositionsPanel Component
 * Displays open positions for margin and perpetual trading
 * Shows liquidation risk, unrealized PnL, and position metrics
 */

import React, { useState } from 'react';
import { Position } from '@/client/hooks';
import { useLiquidationRisk } from '@/client/hooks';
import PositionCard from './PositionCard';

interface PositionsPanelProps {
  positions: Position[];
  loading: boolean;
  metrics?: {
    totalPositions: number;
    longPositions: number;
    shortPositions: number;
    totalExposure: number;
    totalUnrealizedPnL: number;
  };
}

export default function PositionsPanel({
  positions,
  loading,
  metrics,
}: PositionsPanelProps) {
  const [expandedPosition, setExpandedPosition] = useState<string | null>(null);

  // Calculate summary
  const summary = {
    total: positions.length,
    longs: positions.filter((p) => p.side === 'long').length,
    shorts: positions.filter((p) => p.side === 'short').length,
    totalExposure: positions.reduce((sum, p) => sum + p.amount * p.currentPrice, 0),
    totalPnL: positions.reduce((sum, p) => sum + p.unrealizedPnL, 0),
    avgLiquidationRisk: positions.length > 0
      ? positions.reduce((sum, p) => sum + p.liquidationRisk, 0) / positions.length
      : 0,
  };

  // Determine portfolio risk level
  const getRiskLevel = (avgRisk: number) => {
    if (avgRisk >= 80) return { label: 'Critical', color: 'bg-red-900 text-red-100' };
    if (avgRisk >= 50) return { label: 'High', color: 'bg-orange-900 text-orange-100' };
    if (avgRisk >= 25) return { label: 'Moderate', color: 'bg-yellow-900 text-yellow-100' };
    return { label: 'Safe', color: 'bg-green-900 text-green-100' };
  };

  const riskLevel = getRiskLevel(summary.avgLiquidationRisk);

  return (
    <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden h-full flex flex-col">
      {/* Header */}
      <div className="bg-slate-700 border-b border-slate-600 px-4 py-4">
        <div className="flex justify-between items-center mb-3">
          <h2 className="text-lg font-bold text-white">Open Positions</h2>
          <span className="bg-purple-600 text-white px-2 py-1 rounded-full text-sm font-semibold">
            {summary.total}
          </span>
        </div>

        {/* Summary Stats */}
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-slate-400">Unrealized P&L</span>
            <span className={summary.totalPnL >= 0 ? 'text-green-400' : 'text-red-400'}>
              {summary.totalPnL >= 0 ? '+' : ''} ${summary.totalPnL.toFixed(2)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Exposure</span>
            <span className="text-white font-semibold">${summary.totalExposure.toFixed(2)}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-slate-400">Risk Level</span>
            <span className={`text-xs px-2 py-1 rounded-full font-semibold ${riskLevel.color}`}>
              {riskLevel.label}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400 text-xs">Long/Short</span>
            <span className="text-slate-300 text-xs">
              {summary.longs} / {summary.shorts}
            </span>
          </div>
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="px-4 py-8 text-center flex-1 flex items-center justify-center">
          <div className="inline-block animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-purple-500"></div>
        </div>
      )}

      {/* Positions List */}
      {!loading && positions.length > 0 && (
        <div className="flex-1 overflow-y-auto">
          <div className="divide-y divide-slate-700">
            {positions.map((position) => (
              <PositionCard
                key={position.positionId}
                position={position}
                isExpanded={expandedPosition === position.positionId}
                onToggle={() =>
                  setExpandedPosition(
                    expandedPosition === position.positionId ? null : position.positionId
                  )
                }
              />
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {!loading && positions.length === 0 && (
        <div className="flex-1 flex items-center justify-center px-4 py-8">
          <div className="text-center">
            <p className="text-slate-400 text-sm">No open positions</p>
            <p className="text-slate-500 text-xs mt-1">
              Positions from perpetuals and margin trading appear here
            </p>
          </div>
        </div>
      )}

      {/* Risk Alert */}
      {summary.avgLiquidationRisk >= 50 && (
        <div className="bg-red-900/30 border-t border-red-700 px-4 py-3">
          <p className="text-red-100 text-sm font-semibold">⚠ High Liquidation Risk</p>
          <p className="text-red-300 text-xs mt-1">
            Consider adding collateral or reducing positions
          </p>
        </div>
      )}
    </div>
  );
}
