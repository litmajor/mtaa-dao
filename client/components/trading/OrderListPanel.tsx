/**
 * OrderListPanel Component
 * Displays all open orders in a table with real-time updates
 * Shows order details, fill status, and quick actions
 */

import React, { useState } from 'react';
import ConfirmDialog from '@/components/ConfirmDialog';
import { OrderStatus, MarketType } from '@/client/hooks';
import { useCancelOrder } from '@/client/hooks';
import OrderRow from './OrderRow';
import OrderDetailModal from './OrderDetailModal';

interface OrderListPanelProps {
  orders: OrderStatus[];
  loading: boolean;
  selectedExchange?: string;
  marketType?: MarketType;
}

export default function OrderListPanel({
  orders,
  loading,
  selectedExchange,
  marketType,
}: OrderListPanelProps) {
  const [selectedOrder, setSelectedOrder] = useState<OrderStatus | null>(null);
  const { cancelOrder, isLoading: cancelLoading } = useCancelOrder();

  // Sort orders by timestamp (newest first)
  const sortedOrders = [...orders].sort((a, b) => b.timestamp - a.timestamp);

  // Calculate summary stats
  const stats = {
    total: orders.length,
    totalCost: orders.reduce((sum, o) => sum + o.totalCost, 0),
    avgFillPercent: orders.length > 0 ? orders.reduce((sum, o) => sum + o.fillPercentage, 0) / orders.length : 0,
    pendingAmount: orders.reduce((sum, o) => sum + o.remaining * o.averageFillPrice, 0),
  };

  const handleCancel = async (orderId: string, exchange: string) => {
    setPendingCancel({ orderId, exchange });
    setCancelConfirmOpen(true);
  };

  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false);
  const [pendingCancel, setPendingCancel] = useState<{ orderId: string; exchange: string } | null>(null);

  const confirmCancel = () => {
    if (!pendingCancel) return;
    cancelOrder(pendingCancel.orderId, pendingCancel.exchange);
    setPendingCancel(null);
  };

  return (
    <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
      {/* Header */}
      <div className="bg-slate-700 border-b border-slate-600 px-6 py-4">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-white">Open Orders</h2>
          <span className="bg-blue-600 text-white px-3 py-1 rounded-full text-sm font-semibold">
            {stats.total} Orders
          </span>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-4 gap-4 text-sm">
          <div>
            <p className="text-slate-400">Total Value</p>
            <p className="text-white font-bold text-lg">${stats.totalCost.toFixed(2)}</p>
          </div>
          <div>
            <p className="text-slate-400">Avg Fill</p>
            <p className="text-white font-bold text-lg">{stats.avgFillPercent.toFixed(1)}%</p>
          </div>
          <div>
            <p className="text-slate-400">Pending</p>
            <p className="text-white font-bold text-lg">${stats.pendingAmount.toFixed(2)}</p>
          </div>
          <div>
            <p className="text-slate-400">Status</p>
            <p className="text-green-400 font-bold text-lg">
              {orders.every(o => o.status === 'closed') ? 'All Filled' : 'Pending'}
            </p>
          </div>
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="px-6 py-12 text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
          <p className="text-slate-400 mt-4">Loading orders...</p>
        </div>
      )}

      {/* Orders Table */}
      {!loading && sortedOrders.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-700 border-b border-slate-600">
              <tr>
                <th className="px-6 py-3 text-left text-sm font-semibold text-slate-300">Pair</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-slate-300">Type</th>
                <th className="px-6 py-3 text-right text-sm font-semibold text-slate-300">Amount</th>
                <th className="px-6 py-3 text-right text-sm font-semibold text-slate-300">Filled</th>
                <th className="px-6 py-3 text-right text-sm font-semibold text-slate-300">Price</th>
                <th className="px-6 py-3 text-center text-sm font-semibold text-slate-300">Status</th>
                <th className="px-6 py-3 text-center text-sm font-semibold text-slate-300">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sortedOrders.map((order) => (
                <OrderRow
                  key={`${order.orderId}-${order.exchange}`}
                  order={order}
                  onSelect={() => setSelectedOrder(order)}
                  onCancel={() => handleCancel(order.orderId, order.exchange)}
                  cancelLoading={cancelLoading}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Empty State */}
      {!loading && sortedOrders.length === 0 && (
        <div className="px-6 py-12 text-center">
          <p className="text-slate-400">
            {marketType ? `No ${marketType} orders` : 'No open orders'}
          </p>
        </div>
      )}

      {/* Detail Modal */}
      {selectedOrder && (
        <OrderDetailModal
          order={selectedOrder}
          onClose={() => setSelectedOrder(null)}
          onCancel={() => {
            setPendingCancel({ orderId: selectedOrder.orderId, exchange: selectedOrder.exchange });
            setCancelConfirmOpen(true);
            setSelectedOrder(null);
          }}
        />
      )}

      <ConfirmDialog
        open={cancelConfirmOpen}
        onClose={setCancelConfirmOpen}
        title="Cancel Order"
        description="Are you sure you want to cancel this order?"
        confirmLabel="Cancel Order"
        cancelLabel="Keep"
        onConfirm={confirmCancel}
      />
    </div>
  );
}
