/**
 * OrderExecutionStatus Component
 * Real-time order tracking, status updates, and execution details
 */

'use client';

import React, { useState, useEffect } from 'react';
import { useOrderTracking } from '@/client/hooks/useOrderTracking';

interface OrderStatusProps {
  orderId?: string;
  onClose?: () => void;
}

export default function OrderExecutionStatus({ orderId, onClose }: OrderStatusProps) {
  const { orders, loading, error } = useOrderTracking();
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(orderId || null);

  useEffect(() => {
    if (orderId && orders.length > 0) {
      const order = orders.find((o) => o.id === orderId);
      if (order) {
        setSelectedOrder(order);
        setExpandedOrderId(orderId);
      }
    }
  }, [orderId, orders]);

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'filled':
      case 'completed':
        return 'bg-green-600 text-white';
      case 'pending':
      case 'open':
        return 'bg-blue-600 text-white';
      case 'partial':
      case 'partially_filled':
        return 'bg-yellow-600 text-white';
      case 'cancelled':
      case 'canceled':
        return 'bg-red-600 text-white';
      default:
        return 'bg-slate-600 text-white';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'filled':
      case 'completed':
        return '✓';
      case 'pending':
      case 'open':
        return '⏱';
      case 'partial':
      case 'partially_filled':
        return '◐';
      case 'cancelled':
      case 'canceled':
        return '✕';
      default:
        return '•';
    }
  };

  if (loading) {
    return (
      <div className="bg-slate-800 rounded-lg border border-slate-700 p-6 animate-pulse">
        <div className="h-8 bg-slate-700 rounded w-1/3 mb-4"></div>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 bg-slate-700 rounded"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-slate-800 rounded-lg border border-slate-700 p-6 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Order Execution Status</h2>
          <p className="text-slate-400 text-sm mt-1">{orders.length} orders total</p>
        </div>
        {onClose && (
          <button onClick={onClose} className="text-slate-400 hover:text-slate-200 text-2xl">
            ✕
          </button>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-900/20 border border-red-700 rounded-lg p-4">
          <p className="text-red-400 font-semibold">Error: {error}</p>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex gap-2 flex-wrap">
        {['All', 'Open', 'Filled', 'Partial', 'Cancelled'].map((filter) => (
          <button
            key={filter}
            className="px-4 py-2 rounded-lg font-semibold text-sm transition bg-slate-700 hover:bg-slate-600 text-slate-200"
          >
            {filter}
          </button>
        ))}
      </div>

      {/* Orders List */}
      <div className="space-y-3">
        {orders.length === 0 ? (
          <div className="bg-slate-800 rounded-lg border border-slate-700 p-8 text-center">
            <p className="text-slate-400">No orders yet</p>
          </div>
        ) : (
          orders.map((order) => (
            <div
              key={order.id}
              className={`rounded-lg border p-4 cursor-pointer transition ${
                expandedOrderId === order.id
                  ? 'bg-slate-700 border-blue-600'
                  : 'bg-slate-800 border-slate-700 hover:bg-slate-750 hover:border-slate-600'
              }`}
              onClick={() => setExpandedOrderId(expandedOrderId === order.id ? null : order.id)}
            >
              {/* Collapsed View */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4 flex-1">
                  {/* Status Badge */}
                  <div className={`px-3 py-1 rounded-full font-bold text-sm ${getStatusColor(order.status)}`}>
                    {getStatusIcon(order.status)} {order.status}
                  </div>

                  {/* Order Info */}
                  <div className="min-w-fit">
                    <p className="text-white font-bold">{order.pair}</p>
                    <p className="text-slate-400 text-sm">{order.type}</p>
                  </div>

                  {/* Amount */}
                  <div className="hidden md:block">
                    <p className="text-white font-semibold">{order.quantity} units</p>
                    <p className="text-slate-400 text-sm">
                      @ {order.price ? `$${order.price.toFixed(2)}` : 'Market'}
                    </p>
                  </div>
                </div>

                {/* Summary Metrics */}
                <div className="text-right space-y-1">
                  <div>
                    <p className="text-slate-400 text-xs">Total</p>
                    <p className="text-white font-bold text-lg">
                      ${(order.total || order.quantity * (order.price || 0)).toFixed(2)}
                    </p>
                  </div>
                  {order.filled > 0 && (
                    <p className="text-green-400 text-xs font-semibold">
                      {((order.filled / order.quantity) * 100).toFixed(1)}% Filled
                    </p>
                  )}
                </div>

                <span className="ml-4 text-slate-400">{expandedOrderId === order.id ? '▼' : '▶'}</span>
              </div>

              {/* Expanded View */}
              {expandedOrderId === order.id && (
                <div className="mt-4 pt-4 border-t border-slate-600 space-y-4">
                  {/* Order Details Grid */}
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    <div>
                      <p className="text-slate-400 text-xs uppercase">Order ID</p>
                      <p className="text-white font-mono text-sm truncate">{order.id}</p>
                    </div>
                    <div>
                      <p className="text-slate-400 text-xs uppercase">Exchange</p>
                      <p className="text-white font-semibold">{order.exchange}</p>
                    </div>
                    <div>
                      <p className="text-slate-400 text-xs uppercase">Side</p>
                      <p
                        className={`font-bold ${order.side === 'BUY' ? 'text-green-400' : 'text-red-400'}`}
                      >
                        {order.side}
                      </p>
                    </div>

                    <div>
                      <p className="text-slate-400 text-xs uppercase">Type</p>
                      <p className="text-white capitalize">{order.type}</p>
                    </div>
                    <div>
                      <p className="text-slate-400 text-xs uppercase">Market</p>
                      <p className="text-white capitalize">{order.market || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-slate-400 text-xs uppercase">Leverage</p>
                      <p className="text-white">{order.leverage ? `${order.leverage}x` : '1x'}</p>
                    </div>
                  </div>

                  {/* Execution Details */}
                  <div className="bg-slate-700/50 p-4 rounded space-y-2">
                    <p className="text-slate-300 font-semibold text-sm">Execution Details</p>

                    <div className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-400">Quantity:</span>
                        <span className="text-white font-semibold">{order.quantity}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-400">Filled:</span>
                        <span className={`font-semibold ${order.filled > 0 ? 'text-green-400' : 'text-slate-400'}`}>
                          {order.filled} ({((order.filled / order.quantity) * 100).toFixed(1)}%)
                        </span>
                      </div>

                      {order.price && (
                        <div className="flex justify-between text-sm">
                          <span className="text-slate-400">Price:</span>
                          <span className="text-white font-semibold">${order.price.toFixed(2)}</span>
                        </div>
                      )}

                      {order.avgFillPrice && (
                        <div className="flex justify-between text-sm">
                          <span className="text-slate-400">Avg Fill Price:</span>
                          <span className="text-white font-semibold">${order.avgFillPrice.toFixed(2)}</span>
                        </div>
                      )}

                      <div className="flex justify-between text-sm border-t border-slate-600 pt-2 mt-2">
                        <span className="text-slate-300 font-semibold">Total Value:</span>
                        <span className="text-white font-bold">${(order.total || order.quantity * (order.price || 0)).toFixed(2)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Fee Information */}
                  <div className="bg-slate-700/50 p-4 rounded space-y-2">
                    <p className="text-slate-300 font-semibold text-sm">Fee Information</p>
                    <div className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-400">Fee Percent:</span>
                        <span className="text-white font-semibold">{(order.feePercent * 100).toFixed(4)}%</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-400">Fee Amount:</span>
                        <span className="text-white font-semibold">${(order.feeAmount || 0).toFixed(2)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Fill Breakdown */}
                  {order.fills && order.fills.length > 0 && (
                    <div className="bg-slate-700/50 p-4 rounded space-y-2">
                      <p className="text-slate-300 font-semibold text-sm">Fill History</p>
                      <div className="space-y-2 max-h-40 overflow-y-auto">
                        {order.fills.map((fill, idx) => (
                          <div
                            key={idx}
                            className="flex justify-between text-sm p-2 bg-slate-600/30 rounded"
                          >
                            <div>
                              <p className="text-white font-semibold">{fill.quantity} units</p>
                              <p className="text-slate-400 text-xs">{new Date(fill.timestamp).toLocaleTimeString()}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-white font-semibold">${fill.price.toFixed(2)}</p>
                              <p className="text-slate-400 text-xs">${(fill.quantity * fill.price).toFixed(2)}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Progress Bar */}
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-300 font-semibold">Execution Progress</span>
                      <span className="text-white font-bold">
                        {((order.filled / order.quantity) * 100).toFixed(1)}%
                      </span>
                    </div>
                    <div className="w-full bg-slate-700 rounded-full h-3 overflow-hidden">
                      <div
                        className={`h-full transition-all ${
                          order.status === 'filled' || order.status === 'completed'
                            ? 'bg-green-600'
                            : order.status === 'cancelled' || order.status === 'canceled'
                            ? 'bg-red-600'
                            : 'bg-blue-600'
                        }`}
                        style={{
                          width: `${Math.min(100, (order.filled / order.quantity) * 100)}%`,
                        }}
                      ></div>
                    </div>
                  </div>

                  {/* Timestamps */}
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <p className="text-slate-400">Created</p>
                      <p className="text-slate-300">
                        {new Date(order.createdAt).toLocaleString()}
                      </p>
                    </div>
                    {order.updatedAt && (
                      <div>
                        <p className="text-slate-400">Updated</p>
                        <p className="text-slate-300">
                          {new Date(order.updatedAt).toLocaleString()}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-2 pt-2 border-t border-slate-600">
                    {(order.status === 'open' || order.status === 'pending') && (
                      <>
                        <button className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg transition">
                          Cancel Order
                        </button>
                        {order.type === 'limit' && (
                          <button className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition">
                            Modify Price
                          </button>
                        )}
                      </>
                    )}
                    <button className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white font-semibold rounded-lg transition">
                      View Details
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Summary Statistics */}
      {orders.length > 0 && (
        <div className="bg-slate-800 rounded-lg border border-slate-700 p-6">
          <h3 className="text-xl font-bold text-white mb-4">Summary Statistics</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-slate-700/50 p-3 rounded">
              <p className="text-slate-400 text-sm">Total Orders</p>
              <p className="text-2xl font-bold text-white">{orders.length}</p>
            </div>
            <div className="bg-green-900/20 border border-green-700 p-3 rounded">
              <p className="text-green-400 text-sm">Filled</p>
              <p className="text-2xl font-bold text-green-400">
                {orders.filter((o) => o.status === 'filled' || o.status === 'completed').length}
              </p>
            </div>
            <div className="bg-blue-900/20 border border-blue-700 p-3 rounded">
              <p className="text-blue-400 text-sm">Open</p>
              <p className="text-2xl font-bold text-blue-400">
                {orders.filter((o) => o.status === 'open' || o.status === 'pending').length}
              </p>
            </div>
            <div className="bg-red-900/20 border border-red-700 p-3 rounded">
              <p className="text-red-400 text-sm">Cancelled</p>
              <p className="text-2xl font-bold text-red-400">
                {orders.filter((o) => o.status === 'cancelled' || o.status === 'canceled').length}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
