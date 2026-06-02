/**
 * PositionCard Component
 * Single position card with expandable details
 * Shows position metrics, liquidation risk, and quick actions
 */

import React, { useState } from 'react';
import ConfirmDialog from '@/components/ConfirmDialog';
import { Position } from '../../client/hooks';
import { useLiquidationRisk, useUpdateTPSL, useClosePosition } from '@/client/hooks';

interface PositionCardProps {
  position: Position;
  isExpanded: boolean;
  onToggle: () => void;
}

export default function PositionCard({
  position,
  isExpanded,
  onToggle,
}: PositionCardProps) {
  const { risk, isRisky } = useLiquidationRisk(position.positionId, position.exchange);
  const { update: updateTPSL, isLoading: tpslLoading } = useUpdateTPSL();
  const { close: closePosition, isLoading: closeLoading } = useClosePosition();

  const [showTPSL, setShowTPSL] = useState(false);
  const [tpPrice, setTpPrice] = useState(position.takeProfit?.price || 0);
  const [slPrice, setSlPrice] = useState(position.stopLoss?.price || 0);

  // Determine side color
  const sideColor = position.side === 'long' ? 'text-green-400' : 'text-red-400';
  const sideBgColor = position.side === 'long' ? 'bg-green-900/20' : 'bg-red-900/20';

  // Determine risk color
  const getRiskColor = (liquidationRisk: number) => {
    if (liquidationRisk >= 80) return 'bg-red-900 text-red-100';
    if (liquidationRisk >= 50) return 'bg-orange-900 text-orange-100';
    if (liquidationRisk >= 25) return 'bg-yellow-900 text-yellow-100';
    return 'bg-green-900 text-green-100';
  };

  // Handle TP/SL update
  const handleUpdateTPSL = () => {
    updateTPSL(
      position.positionId,
      position.exchange,
      tpPrice > 0 ? { price: tpPrice, amount: position.amount } : undefined,
      slPrice > 0 ? { price: slPrice, amount: position.amount } : undefined
    );
    setShowTPSL(false);
  };

  // Handle close position
  const handleClosePosition = () => {
    // open confirm dialog
    setCloseConfirmOpen(true);
  };

  const [closeConfirmOpen, setCloseConfirmOpen] = useState(false);

  const confirmClose = () => {
    closePosition(position.positionId, position.exchange);
  };

  return (
    <div className={`px-4 py-3 transition-colors ${isExpanded ? 'bg-slate-700/50' : ''}`}>
      {/* Collapsed View */}
      <button
        onClick={onToggle}
        className="w-full text-left hover:bg-slate-700/30 rounded transition-colors p-2 -m-2"
      >
        <div className="flex items-center justify-between">
          <div className="flex-1">
            {/* Pair & Side */}
            <div className="flex items-center gap-2 mb-1">
              <span className={`text-sm font-bold ${sideColor}`}>
                {position.side.toUpperCase()}
              </span>
              <span className="text-white font-semibold">{position.pair}</span>
              <span className="text-slate-400 text-xs">{position.amount.toFixed(4)}</span>
              <span className="text-slate-500 text-xs">{position.leverage}x</span>
            </div>

            {/* Price Info */}
            <div className="text-xs text-slate-400">
              Entry: ${position.entryPrice.toFixed(2)} → Current: ${position.currentPrice.toFixed(2)}
            </div>
          </div>

          {/* PnL & Risk */}
          <div className="text-right">
            <div className={position.unrealizedPnl >= 0 ? 'text-green-400' : 'text-red-400'}>
              {position.unrealizedPnl >= 0 ? '+' : ''} ${position.unrealizedPnl.toFixed(2)}
            </div>
            <div className="text-xs text-slate-400">
              {position.unrealizedPnlPercent >= 0 ? '+' : ''} {position.unrealizedPnlPercent.toFixed(2)}%
            </div>
          </div>

          {/* Expand Arrow */}
          <div className="ml-4 text-slate-400">
            {isExpanded ? '▼' : '▶'}
          </div>
        </div>
      </button>

      {/* Expanded View */}
      {isExpanded && (
        <div className="mt-4 pt-4 border-t border-slate-600 space-y-3">
          {/* Liquidation Risk */}
          {risk && (
            <div className="space-y-2">
              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-400">Liquidation Risk</span>
                <span className={`text-xs px-2 py-1 rounded-full font-semibold ${getRiskColor(position.liquidationRisk)}`}>
                  {position.liquidationRisk.toFixed(1)}%
                </span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-400">Liquidation Price</span>
                <span className={position.side === 'long' ? 'text-red-400' : 'text-green-400'}>
                  ${position.liquidationPrice.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-400">Distance</span>
                <span className="text-white font-semibold">
                  {risk.liquidationDistance.toFixed(1)}%
                </span>
              </div>
            </div>
          )}

          {/* Collateral */}
          <div className="flex justify-between items-center text-sm">
            <span className="text-slate-400">Collateral</span>
            <span className="text-white font-semibold">${position.collateral.toFixed(2)}</span>
          </div>

          {/* Fees */}
          <div className="flex justify-between items-center text-sm">
            <span className="text-slate-400">Fees Paid</span>
            <span className="text-slate-300">${position.fees.toFixed(2)}</span>
          </div>

          {/* Take Profit / Stop Loss */}
          <div className="bg-slate-700/50 rounded p-2 space-y-1 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-400">Take Profit</span>
              <span className="text-green-400">
                {position.takeProfit ? `$${position.takeProfit.price.toFixed(2)}` : 'Not set'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Stop Loss</span>
              <span className="text-red-400">
                {position.stopLoss ? `$${position.stopLoss.price.toFixed(2)}` : 'Not set'}
              </span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 pt-2">
            <button
              onClick={() => setShowTPSL(!showTPSL)}
              className="flex-1 px-3 py-2 rounded bg-slate-700 hover:bg-slate-600 text-slate-100 text-xs font-semibold transition-all"
            >
              {showTPSL ? 'Hide TP/SL' : 'Set TP/SL'}
            </button>
            <button
              onClick={handleClosePosition}
              disabled={closeLoading}
              className="flex-1 px-3 py-2 rounded bg-red-900 hover:bg-red-800 text-red-100 text-xs font-semibold transition-all disabled:opacity-50"
            >
              {closeLoading ? 'Closing...' : 'Close'}
            </button>
          </div>

          <ConfirmDialog
            open={closeConfirmOpen}
            onClose={setCloseConfirmOpen}
            title="Close Position"
            description={`Close ${position.side} position in ${position.pair}?`}
            confirmLabel="Close"
            cancelLabel="Cancel"
            onConfirm={confirmClose}
          />

          {/* TP/SL Input */}
          {showTPSL && (
            <div className="bg-slate-700/30 rounded p-3 space-y-2 text-xs">
              <div>
                <label className="text-slate-400 block mb-1">Take Profit Price</label>
                <input
                  type="number"
                  value={tpPrice}
                  onChange={(e) => setTpPrice(parseFloat(e.target.value))}
                  placeholder="Enter TP price"
                  className="w-full px-2 py-1 rounded bg-slate-700 border border-slate-600 text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="text-slate-400 block mb-1">Stop Loss Price</label>
                <input
                  type="number"
                  value={slPrice}
                  onChange={(e) => setSlPrice(parseFloat(e.target.value))}
                  placeholder="Enter SL price"
                  className="w-full px-2 py-1 rounded bg-slate-700 border border-slate-600 text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none"
                />
              </div>
              <button
                onClick={handleUpdateTPSL}
                disabled={tpslLoading}
                className="w-full px-3 py-2 rounded bg-blue-600 hover:bg-blue-700 text-white font-semibold transition-all disabled:opacity-50"
              >
                {tpslLoading ? 'Updating...' : 'Update'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
