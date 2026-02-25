/**
 * OrderDetailModal Component
 * Detailed view of a single order with all information
 */

import React from 'react';
import { OrderStatus } from '@/client/hooks';

interface OrderDetailModalProps {
  order: OrderStatus;
  onClose: () => void;
  onCancel: () => void;
}

export default function OrderDetailModal({
  order,
  onClose,
  onCancel,
}: OrderDetailModalProps) {
  const fillPercentage = order.fillPercentage || 0;
  const isPartiallyFilled = fillPercentage > 0 && fillPercentage < 100;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 rounded-lg border border-slate-700 max-w-md w-full max-h-96 overflow-y-auto">
        {/* Header */}
        <div className="bg-slate-700 border-b border-slate-600 px-6 py-4 flex justify-between items-center">
          <h2 className="text-xl font-bold text-white">Order Details</h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white text-2xl"
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-4 space-y-4">
          {/* Order ID */}
          <div>
            <p className="text-slate-400 text-sm mb-1">Order ID</p>
            <p className="text-white font-mono text-sm break-all">{order.orderId}</p>
          </div>

          {/* Trading Pair */}
          <div>
            <p className="text-slate-400 text-sm mb-1">Trading Pair</p>
            <div className="flex items-center gap-2">
              <span className="text-white font-bold text-lg">{order.tradingPair}</span>
              <span className="text-xs px-2 py-1 rounded-full bg-slate-700 text-slate-300">
                {order.marketType}
              </span>
            </div>
          </div>

          {/* Order Type & Side */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-slate-400 text-sm mb-1">Side</p>
              <p
                className={`text-lg font-bold ${
                  order.type === 'buy' ? 'text-green-400' : 'text-red-400'
                }`}
              >
                {order.type.toUpperCase()}
              </p>
            </div>
            <div>
              <p className="text-slate-400 text-sm mb-1">Type</p>
              <p className="text-white font-semibold capitalize">{order.orderType}</p>
            </div>
          </div>

          {/* Amount Information */}
          <div className="bg-slate-700/50 rounded-lg p-3 space-y-2">
            <div className="flex justify-between">
              <span className="text-slate-400 text-sm">Amount</span>
              <span className="text-white font-semibold">{order.amount.toFixed(4)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400 text-sm">Filled</span>
              <span className="text-white font-semibold">
                {order.filled.toFixed(4)} ({fillPercentage.toFixed(1)}%)
              </span>
            </div>
            <div className="w-full h-2 bg-slate-600 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-blue-500 to-blue-400"
                style={{ width: `${fillPercentage}%` }}
              />
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400 text-sm">Remaining</span>
              <span className="text-orange-400 font-semibold">{order.remaining.toFixed(4)}</span>
            </div>
          </div>

          {/* Price Information */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-slate-400 text-sm mb-1">Avg Fill Price</p>
              <p className="text-white font-semibold">${order.averageFillPrice.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-slate-400 text-sm mb-1">Total Cost</p>
              <p className="text-white font-semibold">${order.totalCost.toFixed(2)}</p>
            </div>
          </div>

          {/* Status */}
          <div>
            <p className="text-slate-400 text-sm mb-1">Status</p>
            <div className="flex items-center gap-2">
              <span
                className={`inline-block w-3 h-3 rounded-full ${
                  order.status === 'closed'
                    ? 'bg-green-500'
                    : order.status === 'canceled'
                    ? 'bg-red-500'
                    : 'bg-blue-500'
                }`}
              />
              <span className="text-white font-semibold capitalize">{order.status}</span>
            </div>
          </div>

          {/* Exchange */}
          <div>
            <p className="text-slate-400 text-sm mb-1">Exchange</p>
            <p className="text-white font-semibold capitalize">{order.exchange}</p>
          </div>

          {/* Timestamp */}
          <div>
            <p className="text-slate-400 text-sm mb-1">Created</p>
            <p className="text-slate-300 text-sm">
              {new Date(order.timestamp).toLocaleString()}
            </p>
          </div>

          {/* Updated At */}
          <div>
            <p className="text-slate-400 text-sm mb-1">Last Updated</p>
            <p className="text-slate-300 text-sm">
              {new Date(order.updatedAt).toLocaleString()}
            </p>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="bg-slate-700 border-t border-slate-600 px-6 py-4 flex gap-2">
          {order.status === 'open' && (
            <button
              onClick={onCancel}
              className="flex-1 px-4 py-2 rounded-lg bg-red-900 hover:bg-red-800 text-red-100 font-semibold transition-all"
            >
              Cancel Order
            </button>
          )}
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 rounded-lg bg-slate-600 hover:bg-slate-500 text-white font-semibold transition-all"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
