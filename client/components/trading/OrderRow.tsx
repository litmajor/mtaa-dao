/**
 * OrderRow Component
 * Single order row in the order table
 * Displays all key order information and action buttons
 */

import React from 'react';
import { OrderStatus } from '@/client/hooks';

interface OrderRowProps {
  order: OrderStatus;
  onSelect: () => void;
  onCancel: () => void;
  cancelLoading: boolean;
}

export default function OrderRow({
  order,
  onSelect,
  onCancel,
  cancelLoading,
}: OrderRowProps) {
  // Determine status badge color
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'closed':
        return 'bg-green-900 text-green-100';
      case 'canceled':
        return 'bg-red-900 text-red-100';
      case 'expired':
        return 'bg-yellow-900 text-yellow-100';
      default:
        return 'bg-blue-900 text-blue-100';
    }
  };

  // Determine order type color
  const getTypeColor = (type: string) => {
    return type === 'buy' ? 'text-green-400' : 'text-red-400';
  };

  // Determine market type badge
  const getMarketTypeBadge = (marketType: string) => {
    const badges: { [key: string]: string } = {
      spot: 'bg-slate-700 text-slate-100',
      margin: 'bg-yellow-900 text-yellow-100',
      futures: 'bg-purple-900 text-purple-100',
      swap: 'bg-indigo-900 text-indigo-100',
      option: 'bg-pink-900 text-pink-100',
      dex: 'bg-green-900 text-green-100',
    };
    return badges[marketType] || badges['spot'];
  };

  const fillPercentage = order.fillPercentage || 0;
  const timeAgo = formatTimeAgo(new Date(order.timestamp));

  return (
    <tr className="border-b border-slate-700 hover:bg-slate-700/50 transition-colors">
      {/* Pair */}
      <td className="px-6 py-4">
        <div className="flex items-center gap-2">
          <div>
            <p className="text-white font-semibold">{order.tradingPair}</p>
            <p className="text-slate-400 text-sm">{order.exchange}</p>
          </div>
        </div>
      </td>

      {/* Type */}
      <td className="px-6 py-4">
        <div className="flex items-center gap-2">
          <span className={`font-bold ${getTypeColor(order.type)}`}>
            {order.type.toUpperCase()}
          </span>
          <span className={`text-xs px-2 py-1 rounded-full ${getMarketTypeBadge(order.marketType)}`}>
            {order.marketType}
          </span>
        </div>
      </td>

      {/* Amount */}
      <td className="px-6 py-4 text-right">
        <p className="text-white font-semibold">{order.amount.toFixed(4)}</p>
        <p className="text-slate-400 text-sm">{order.orderType}</p>
      </td>

      {/* Filled */}
      <td className="px-6 py-4 text-right">
        <div>
          <p className="text-white font-semibold">{order.filled.toFixed(4)}</p>
          <div className="w-20 h-2 bg-slate-700 rounded-full overflow-hidden mt-1">
            <div
              className="h-full bg-gradient-to-r from-blue-500 to-blue-400 transition-all"
              style={{ width: `${fillPercentage}%` }}
            />
          </div>
          <p className="text-slate-400 text-xs mt-1">{fillPercentage.toFixed(1)}%</p>
        </div>
      </td>

      {/* Price */}
      <td className="px-6 py-4 text-right">
        <p className="text-white font-semibold">${order.averageFillPrice.toFixed(2)}</p>
        <p className="text-slate-400 text-sm">${order.totalCost.toFixed(0)} total</p>
      </td>

      {/* Status */}
      <td className="px-6 py-4 text-center">
        <span className={`text-xs px-3 py-1 rounded-full font-semibold ${getStatusColor(order.status)}`}>
          {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
        </span>
        <p className="text-slate-400 text-xs mt-1">{timeAgo}</p>
      </td>

      {/* Actions */}
      <td className="px-6 py-4 text-center">
        <div className="flex gap-2 justify-center">
          <button
            onClick={onSelect}
            className="px-3 py-1 rounded bg-slate-700 hover:bg-slate-600 text-slate-100 text-sm transition-all"
            title="View details"
          >
            Details
          </button>
          {order.status === 'open' && (
            <button
              onClick={onCancel}
              disabled={cancelLoading}
              className="px-3 py-1 rounded bg-red-900 hover:bg-red-800 text-red-100 text-sm transition-all disabled:opacity-50"
              title="Cancel order"
            >
              {cancelLoading ? '...' : 'Cancel'}
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}

/**
 * Format time difference in human-readable format
 */
function formatTimeAgo(date: Date): string {
  const now = new Date();
  const secondsAgo = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (secondsAgo < 60) return `${secondsAgo}s ago`;
  if (secondsAgo < 3600) return `${Math.floor(secondsAgo / 60)}m ago`;
  if (secondsAgo < 86400) return `${Math.floor(secondsAgo / 3600)}h ago`;
  return `${Math.floor(secondsAgo / 86400)}d ago`;
}
