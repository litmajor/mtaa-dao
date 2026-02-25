import React, { useState, useEffect } from 'react';

export interface TradeRecord {
  id: string;
  type: 'manual' | 'bot' | 'strategy';
  source?: string;
  pair: string;
  side: 'BUY' | 'SELL' | 'CLOSE';
  status: 'pending' | 'partial' | 'filled' | 'cancelled';
  quantity: number;
  price: number;
  filledQuantity: number;
  totalValue: number;
  fee: number;
  exchange: string;
  pnl?: number;
  createdAt: Date;
}

interface OrderExecutionStatusProps {
  trades?: TradeRecord[];
  isLoading?: boolean;
  onRefresh?: () => void;
}

const statusColors = {
  pending: 'bg-yellow-900 text-yellow-100',
  partial: 'bg-blue-900 text-blue-100',
  filled: 'bg-green-900 text-green-100',
  cancelled: 'bg-slate-900 text-slate-100'
};

const statusEmojis = {
  pending: '⏳',
  partial: '⚙️',
  filled: '✓',
  cancelled: '✕'
};

const typeColors = {
  manual: 'text-slate-400',
  bot: 'text-green-400',
  strategy: 'text-blue-400'
};

const typeEmojis = {
  manual: '👤',
  bot: '🤖',
  strategy: '📊'
};

export const OrderExecutionStatus: React.FC<OrderExecutionStatusProps> = ({
  trades = [],
  isLoading = false,
  onRefresh
}) => {
  const [expandedTradeId, setExpandedTradeId] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'manual' | 'bot' | 'strategy'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'partial' | 'filled' | 'cancelled'>('all');

  const filteredTrades = trades.filter(trade => {
    if (filter !== 'all' && trade.type !== filter) return false;
    if (statusFilter !== 'all' && trade.status !== statusFilter) return false;
    return true;
  });

  // Summary stats
  const totalTrades = filteredTrades.length;
  const filledTrades = filteredTrades.filter(t => t.status === 'filled').length;
  const totalVolume = filteredTrades.reduce((sum, t) => sum + t.totalValue, 0);
  const totalFees = filteredTrades.reduce((sum, t) => sum + t.fee, 0);
  const totalPnL = filteredTrades.reduce((sum, t) => sum + (t.pnl || 0), 0);

  if (isLoading) {
    return (
      <div className="text-center py-12">
        <div className="text-4xl mb-2 animate-spin">⏳</div>
        <p className="text-slate-400">Loading order history...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="p-3 bg-slate-800 rounded-lg">
          <div className="text-xs text-slate-500">Total Orders</div>
          <div className="text-2xl font-bold text-white">{totalTrades}</div>
        </div>

        <div className="p-3 bg-green-900 rounded-lg">
          <div className="text-xs text-green-300">Filled</div>
          <div className="text-2xl font-bold text-green-100">{filledTrades}</div>
        </div>

        <div className="p-3 bg-blue-900 rounded-lg">
          <div className="text-xs text-blue-300">Volume</div>
          <div className="text-2xl font-bold text-blue-100">${(totalVolume / 1000).toFixed(0)}k</div>
        </div>

        <div className="p-3 bg-orange-900 rounded-lg">
          <div className="text-xs text-orange-300">Fees</div>
          <div className="text-2xl font-bold text-orange-100">${totalFees.toFixed(2)}</div>
        </div>

        <div className={`p-3 rounded-lg ${totalPnL >= 0 ? 'bg-green-900' : 'bg-red-900'}`}>
          <div className={`text-xs ${totalPnL >= 0 ? 'text-green-300' : 'text-red-300'}`}>Total P&L</div>
          <div className={`text-2xl font-bold ${totalPnL >= 0 ? 'text-green-100' : 'text-red-100'}`}>
            ${totalPnL.toFixed(2)}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 p-3 bg-slate-800 rounded-lg">
        {/* Type Filter */}
        <div className="flex gap-1">
          {(['all', 'manual', 'bot', 'strategy'] as const).map(type => (
            <button
              key={type}
              onClick={() => setFilter(type)}
              className={`px-3 py-1 text-sm rounded transition-colors ${
                filter === type
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              }`}
            >
              {type === 'all' ? 'All Types' : type.charAt(0).toUpperCase() + type.slice(1)}
            </button>
          ))}
        </div>

        {/* Status Filter */}
        <div className="flex gap-1 ml-auto">
          {(['all', 'pending', 'partial', 'filled', 'cancelled'] as const).map(status => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`px-2 py-1 text-sm rounded transition-colors ${
                statusFilter === status
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              }`}
            >
              {status === 'all' ? 'All' : status.charAt(0).toUpperCase() + status.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Trades List */}
      {filteredTrades.length === 0 ? (
        <div className="text-center py-12 bg-slate-800 rounded-lg">
          <div className="text-4xl mb-2">📭</div>
          <p className="text-slate-400">No trades to display</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredTrades.map(trade => (
            <div key={trade.id} className="border border-slate-700 rounded-lg overflow-hidden">
              {/* Trade Summary Row */}
              <button
                onClick={() =>
                  setExpandedTradeId(expandedTradeId === trade.id ? null : trade.id)
                }
                className="w-full p-4 hover:bg-slate-800 transition-colors text-left"
              >
                <div className="flex items-center justify-between gap-4">
                  {/* Left Section */}
                  <div className="flex items-center gap-3 flex-1">
                    <div className="text-2xl">
                      {typeEmojis[trade.type]}
                    </div>
                    <div>
                      <div className="font-bold text-white">
                        {trade.pair}
                        <span className={`ml-2 text-sm ${typeColors[trade.type]}`}>
                          {trade.source ? `(${trade.source})` : ''}
                        </span>
                      </div>
                      <div className="text-sm text-slate-400">
                        {trade.side === 'BUY' ? '📈 Bought' : trade.side === 'SELL' ? '📉 Sold' : '🔄 Closed'}
                        {' '} {trade.quantity} @ ${trade.price.toFixed(2)}
                      </div>
                    </div>
                  </div>

                  {/* Middle Section */}
                  <div className="text-right hidden md:block">
                    <div className="font-bold text-white">${trade.totalValue.toFixed(2)}</div>
                    <div className="text-sm text-slate-400">{trade.exchange}</div>
                  </div>

                  {/* Right Section */}
                  <div className="flex items-center gap-3">
                    {trade.pnl !== undefined && (
                      <div className={`text-right font-bold ${trade.pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {trade.pnl >= 0 ? '+' : ''}{trade.pnl.toFixed(2)}
                      </div>
                    )}
                    <span
                      className={`px-3 py-1 rounded text-sm font-bold ${
                        statusColors[trade.status]
                      }`}
                    >
                      {statusEmojis[trade.status]} {trade.status}
                    </span>
                    <div className="text-slate-400">
                      {expandedTradeId === trade.id ? '▼' : '▶'}
                    </div>
                  </div>
                </div>
              </button>

              {/* Expanded Details */}
              {expandedTradeId === trade.id && (
                <div className="p-4 bg-slate-800 border-t border-slate-700 space-y-3">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <div className="text-slate-500">Quantity</div>
                      <div className="font-bold text-white">{trade.quantity}</div>
                    </div>
                    <div>
                      <div className="text-slate-500">Filled Qty</div>
                      <div className="font-bold text-white">{trade.filledQuantity}</div>
                    </div>
                    <div>
                      <div className="text-slate-500">Entry Price</div>
                      <div className="font-bold text-white">${trade.price.toFixed(2)}</div>
                    </div>
                    <div>
                      <div className="text-slate-500">Fee</div>
                      <div className="font-bold text-white">${trade.fee.toFixed(2)}</div>
                    </div>
                  </div>

                  <div className="text-xs text-slate-500 border-t border-slate-700 pt-3">
                    Order ID: {trade.id}
                  </div>
                  <div className="text-xs text-slate-500">
                    Created: {new Date(trade.createdAt).toLocaleString()}
                  </div>

                  {trade.source && (
                    <div className="text-xs text-slate-500">
                      Source: {trade.type === 'bot' ? '🤖 ' : ''}
                      {trade.source}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Refresh Button */}
      {onRefresh && (
        <div className="flex justify-center pt-4">
          <button
            onClick={onRefresh}
            className="px-4 py-2 text-sm border border-slate-600 text-slate-300 rounded hover:bg-slate-700 transition-colors"
          >
            🔄 Refresh
          </button>
        </div>
      )}
    </div>
  );
};
