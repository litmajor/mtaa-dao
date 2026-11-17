/**
 * WithdrawalHistory Component
 * Displays user's past withdrawals with filtering and sorting
 */

import React, { useEffect, useState } from 'react';
import { useMultichainWithdrawal } from '../../hooks/useMultichainWithdrawal';

const WithdrawalHistory: React.FC = () => {
  const { history, getHistory, loading } = useMultichainWithdrawal();

  const [sortBy, setSortBy] = useState<'date' | 'amount' | 'cost'>('date');
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'completed' | 'failed'>('all');
  const [page, setPage] = useState(0);
  const pageSize = 10;

  useEffect(() => {
    getHistory(pageSize * 3, page * pageSize);
  }, [page, getHistory]);

  const filteredHistory = history.filter((item) => {
    if (filterStatus === 'all') return true;
    return item.status === filterStatus;
  });

  const sortedHistory = [...filteredHistory].sort((a, b) => {
    switch (sortBy) {
      case 'date':
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      case 'amount':
        return parseFloat(b.amount) - parseFloat(a.amount);
      case 'cost':
        return parseFloat(b.costUSD) - parseFloat(a.costUSD);
      default:
        return 0;
    }
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'failed':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      default:
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
    }
  };

  const getChainColor = (chain: string) => {
    const colors: Record<string, string> = {
      ethereum: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
      polygon: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
      bsc: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
      arbitrum: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
      optimism: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
      avalanche: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
    };
    return colors[chain] || 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
  };

  if (loading && history.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
        <div className="flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
      <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Withdrawal History</h2>

      {/* Controls */}
      <div className="flex flex-col md:flex-row gap-4 mb-6">
        {/* Filter */}
        <div className="flex-1">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Filter by Status
          </label>
          <select
            value={filterStatus}
            onChange={(e) => {
              setFilterStatus(e.target.value as any);
              setPage(0);
            }}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Statuses</option>
            <option value="completed">Completed</option>
            <option value="pending">Pending</option>
            <option value="failed">Failed</option>
          </select>
        </div>

        {/* Sort */}
        <div className="flex-1">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Sort By
          </label>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="date">Newest First</option>
            <option value="amount">Highest Amount</option>
            <option value="cost">Highest Cost</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200 dark:border-gray-700">
              <th className="text-left py-3 px-4 font-semibold text-gray-700 dark:text-gray-300">
                ID
              </th>
              <th className="text-left py-3 px-4 font-semibold text-gray-700 dark:text-gray-300">
                Route
              </th>
              <th className="text-left py-3 px-4 font-semibold text-gray-700 dark:text-gray-300">
                Amount
              </th>
              <th className="text-left py-3 px-4 font-semibold text-gray-700 dark:text-gray-300">
                Cost
              </th>
              <th className="text-left py-3 px-4 font-semibold text-gray-700 dark:text-gray-300">
                Time
              </th>
              <th className="text-left py-3 px-4 font-semibold text-gray-700 dark:text-gray-300">
                Status
              </th>
              <th className="text-left py-3 px-4 font-semibold text-gray-700 dark:text-gray-300">
                Date
              </th>
            </tr>
          </thead>
          <tbody>
            {sortedHistory.slice(page * pageSize, (page + 1) * pageSize).map((item) => (
              <tr
                key={item.withdrawalId}
                className="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition"
              >
                <td className="py-4 px-4">
                  <span className="font-mono text-xs text-gray-600 dark:text-gray-400">
                    {item.withdrawalId.slice(-6)}
                  </span>
                </td>
                <td className="py-4 px-4">
                  <div className="flex items-center gap-1">
                    <span
                      className={`px-2 py-1 rounded text-xs font-semibold ${getChainColor(
                        item.sourceChain
                      )}`}
                    >
                      {item.sourceChain.slice(0, 3).toUpperCase()}
                    </span>
                    <span className="text-gray-600 dark:text-gray-400">→</span>
                    <span
                      className={`px-2 py-1 rounded text-xs font-semibold ${getChainColor(
                        item.targetChain
                      )}`}
                    >
                      {item.targetChain.slice(0, 3).toUpperCase()}
                    </span>
                  </div>
                </td>
                <td className="py-4 px-4">
                  <span className="font-semibold text-gray-900 dark:text-white">
                    {item.amount} {item.token}
                  </span>
                </td>
                <td className="py-4 px-4">
                  <span className="text-gray-600 dark:text-gray-400">${item.costUSD}</span>
                </td>
                <td className="py-4 px-4">
                  <span className="text-gray-600 dark:text-gray-400">
                    {item.timeSeconds < 60
                      ? `${item.timeSeconds}s`
                      : `${Math.ceil(item.timeSeconds / 60)}m`}
                  </span>
                </td>
                <td className="py-4 px-4">
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusBadge(
                      item.status
                    )}`}
                  >
                    {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
                  </span>
                </td>
                <td className="py-4 px-4 text-sm text-gray-600 dark:text-gray-400">
                  {new Date(item.createdAt).toLocaleDateString()} <br />
                  {new Date(item.createdAt).toLocaleTimeString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {sortedHistory.length === 0 && (
        <div className="text-center py-8">
          <p className="text-gray-500 dark:text-gray-400">No withdrawals found</p>
        </div>
      )}

      {/* Pagination */}
      {Math.ceil(sortedHistory.length / pageSize) > 1 && (
        <div className="flex justify-center gap-2 mt-6">
          <button
            onClick={() => setPage(Math.max(0, page - 1))}
            disabled={page === 0}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            ← Previous
          </button>
          <span className="px-4 py-2 text-gray-700 dark:text-gray-300">
            Page {page + 1} of {Math.ceil(sortedHistory.length / pageSize)}
          </span>
          <button
            onClick={() => setPage(page + 1)}
            disabled={page >= Math.ceil(sortedHistory.length / pageSize) - 1}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
};

export default WithdrawalHistory;
