/**
 * TransactionsTab Component
 * View all deposit and withdrawal transactions
 */

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowDown, ArrowUp, Clock, CheckCircle, AlertCircle } from 'lucide-react';

interface Transaction {
  id: string;
  type: 'deposit' | 'withdrawal';
  source?: string;
  destination?: string;
  amount: string;
  currency: string;
  status: 'pending' | 'completed' | 'failed' | 'cancelled';
  transactionHash?: string;
  createdAt: string;
}

export default function TransactionsTab() {
  const [filter, setFilter] = useState<'all' | 'deposits' | 'withdrawals'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'completed' | 'pending' | 'failed'>('all');

  // Fetch deposits
  const { data: deposits = [] } = useQuery<any[]>({
    queryKey: ['deposits'],
    queryFn: async () => {
      const response = await fetch('/api/deposits/user/history', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      if (!response.ok) throw new Error('Failed to fetch deposits');
      const result = await response.json();
      return result.data;
    },
  });

  // Fetch withdrawals
  const { data: withdrawals = [] } = useQuery<any[]>({
    queryKey: ['withdrawals'],
    queryFn: async () => {
      const response = await fetch('/api/withdrawals/user/history', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      if (!response.ok) throw new Error('Failed to fetch withdrawals');
      const result = await response.json();
      return result.data;
    },
  });

  // Combine and filter transactions
  let transactions: Transaction[] = [];

  if (filter === 'all' || filter === 'deposits') {
    transactions = transactions.concat(
      deposits.map((d) => ({
        id: d.id,
        type: 'deposit',
        source: d.source,
        amount: d.amount,
        currency: d.currency,
        status: d.status,
        transactionHash: d.transactionHash,
        createdAt: d.createdAt,
      }))
    );
  }

  if (filter === 'all' || filter === 'withdrawals') {
    transactions = transactions.concat(
      withdrawals.map((w) => ({
        id: w.id,
        type: 'withdrawal',
        destination: w.destination,
        amount: w.amount,
        currency: w.currency,
        status: w.status,
        transactionHash: w.transactionHash,
        createdAt: w.createdAt,
      }))
    );
  }

  // Apply status filter
  if (statusFilter !== 'all') {
    transactions = transactions.filter((t) => t.status === statusFilter);
  }

  // Sort by date
  transactions.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-400" />;
      case 'pending':
        return <Clock className="w-4 h-4 text-yellow-400" />;
      case 'failed':
        return <AlertCircle className="w-4 h-4 text-red-400" />;
      default:
        return null;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'text-green-400';
      case 'pending':
        return 'text-yellow-400';
      case 'failed':
        return 'text-red-400';
      case 'cancelled':
        return 'text-gray-400';
      default:
        return 'text-gray-400';
    }
  };

  return (
    <div className="space-y-6">
      {/* Filters */}
      <Card className="bg-gray-700 border-gray-600">
        <CardHeader>
          <CardTitle className="text-white">Filters</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Transaction Type Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Transaction Type
              </label>
              <select
                value={filter}
                onChange={(e) =>
                  setFilter(e.target.value as 'all' | 'deposits' | 'withdrawals')
                }
                aria-label="Filter transactions by type"
                className="w-full px-4 py-2 bg-gray-800 border border-gray-600 rounded text-white focus:border-blue-500 focus:outline-none"
              >
                <option value="all">All Transactions</option>
                <option value="deposits">Deposits Only</option>
                <option value="withdrawals">Withdrawals Only</option>
              </select>
            </div>

            {/* Status Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Status
              </label>
              <select
                value={statusFilter}
                onChange={(e) =>
                  setStatusFilter(e.target.value as 'all' | 'completed' | 'pending' | 'failed')
                }
                aria-label="Filter transactions by status"
                className="w-full px-4 py-2 bg-gray-800 border border-gray-600 rounded text-white focus:border-blue-500 focus:outline-none"
              >
                <option value="all">All Statuses</option>
                <option value="completed">Completed</option>
                <option value="pending">Pending</option>
                <option value="failed">Failed</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Transactions List */}
      <Card className="bg-gray-700 border-gray-600">
        <CardHeader>
          <CardTitle className="text-white">
            Transactions ({transactions.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {transactions.length > 0 ? (
            <div className="space-y-3">
              {transactions.map((transaction) => (
                <div
                  key={transaction.id}
                  className="flex items-center justify-between p-4 bg-gray-800 rounded border border-gray-600 hover:border-gray-500 transition"
                >
                  {/* Left Section - Type and Details */}
                  <div className="flex items-center space-x-4 flex-1">
                    {/* Icon */}
                    <div className="p-2 bg-gray-700 rounded-full">
                      {transaction.type === 'deposit' ? (
                        <ArrowDown className="w-5 h-5 text-green-400" />
                      ) : (
                        <ArrowUp className="w-5 h-5 text-orange-400" />
                      )}
                    </div>

                    {/* Details */}
                    <div>
                      <div className="text-white font-medium capitalize">
                        {transaction.type}
                        {transaction.source && ` from ${transaction.source}`}
                        {transaction.destination && ` to ${transaction.destination}`}
                      </div>
                      <div className="text-xs text-gray-400">
                        {new Date(transaction.createdAt).toLocaleString()}
                      </div>
                      {transaction.transactionHash && (
                        <div className="text-xs text-gray-500 font-mono mt-1">
                          {transaction.transactionHash.substring(0, 12)}...
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Middle Section - Amount */}
                  <div className="text-right mr-4">
                    <div className={`font-semibold ${
                      transaction.type === 'deposit' ? 'text-green-400' : 'text-orange-400'
                    }`}>
                      {transaction.type === 'deposit' ? '+' : '-'}
                      {parseFloat(transaction.amount).toFixed(2)} {transaction.currency}
                    </div>
                  </div>

                  {/* Right Section - Status */}
                  <div className="flex items-center space-x-2">
                    {getStatusIcon(transaction.status)}
                    <span className={`text-xs capitalize font-semibold ${getStatusColor(transaction.status)}`}>
                      {transaction.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-gray-400">
              <div className="mb-2">No transactions found with the selected filters.</div>
              <div className="text-sm">Try adjusting your filters or make a deposit/withdrawal.</div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Statistics */}
      {transactions.length > 0 && (
        <Card className="bg-gray-700 border-gray-600">
          <CardHeader>
            <CardTitle className="text-white">Statistics</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {/* Total Deposits */}
              <div className="p-3 bg-gray-800 rounded border border-gray-600">
                <div className="text-xs text-gray-400 mb-1">Total Deposits</div>
                <div className="text-lg font-semibold text-green-400">
                  {deposits.length}
                </div>
              </div>

              {/* Total Withdrawals */}
              <div className="p-3 bg-gray-800 rounded border border-gray-600">
                <div className="text-xs text-gray-400 mb-1">Total Withdrawals</div>
                <div className="text-lg font-semibold text-orange-400">
                  {withdrawals.length}
                </div>
              </div>

              {/* Completed Transactions */}
              <div className="p-3 bg-gray-800 rounded border border-gray-600">
                <div className="text-xs text-gray-400 mb-1">Completed</div>
                <div className="text-lg font-semibold text-white">
                  {transactions.filter((t) => t.status === 'completed').length}
                </div>
              </div>

              {/* Pending Transactions */}
              <div className="p-3 bg-gray-800 rounded border border-gray-600">
                <div className="text-xs text-gray-400 mb-1">Pending</div>
                <div className="text-lg font-semibold text-yellow-400">
                  {transactions.filter((t) => t.status === 'pending').length}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
