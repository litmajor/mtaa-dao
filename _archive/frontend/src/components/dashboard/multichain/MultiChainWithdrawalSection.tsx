/**
 * MultiChainWithdrawalSection Component
 * Main dashboard section that combines form, status, and history
 * Ready to integrate into YukiDashboard
 */

import React, { useState, useEffect } from 'react';
import WithdrawalForm from './WithdrawalForm';
import StatusMonitor from './StatusMonitor';
import WithdrawalHistory from './WithdrawalHistory';

const MultiChainWithdrawalSection: React.FC = () => {
  const [activeWithdrawalId, setActiveWithdrawalId] = useState<string | null>(null);
  const [completedCount, setCompletedCount] = useState(0);

  const handleWithdrawalSuccess = (withdrawalId: string) => {
    setActiveWithdrawalId(withdrawalId);
  };

  const handleWithdrawalComplete = () => {
    setCompletedCount((prev) => prev + 1);
    setTimeout(() => {
      setActiveWithdrawalId(null);
    }, 3000);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg shadow-lg p-8 text-white">
        <h1 className="text-3xl font-bold mb-2">Multi-Chain Withdrawals</h1>
        <p className="text-blue-100">
          Withdraw across 7 blockchains with optimized routes and minimal fees
        </p>
        {completedCount > 0 && (
          <div className="mt-4 bg-green-500 bg-opacity-20 rounded-lg p-3">
            <p className="text-sm">✓ {completedCount} successful withdrawal{completedCount !== 1 ? 's' : ''}</p>
          </div>
        )}
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Form */}
        <div className="lg:col-span-1">
          <WithdrawalForm onSuccess={handleWithdrawalSuccess} />
        </div>

        {/* Right Column: Status & History */}
        <div className="lg:col-span-2">
          {activeWithdrawalId ? (
            <StatusMonitor
              withdrawalId={activeWithdrawalId}
              onComplete={handleWithdrawalComplete}
              onFailed={() => {
                setTimeout(() => setActiveWithdrawalId(null), 5000);
              }}
            />
          ) : (
            <WithdrawalHistory />
          )}
        </div>
      </div>

      {/* Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-blue-50 dark:bg-blue-900 rounded-lg p-4 border-l-4 border-blue-500">
          <h3 className="font-semibold text-blue-900 dark:text-blue-200 mb-1">⚡ Fast</h3>
          <p className="text-sm text-blue-700 dark:text-blue-300">
            Optimized routes complete in 5-30 minutes
          </p>
        </div>

        <div className="bg-green-50 dark:bg-green-900 rounded-lg p-4 border-l-4 border-green-500">
          <h3 className="font-semibold text-green-900 dark:text-green-200 mb-1">💰 Cheap</h3>
          <p className="text-sm text-green-700 dark:text-green-300">
            Smart routing finds the lowest-cost path
          </p>
        </div>

        <div className="bg-purple-50 dark:bg-purple-900 rounded-lg p-4 border-l-4 border-purple-500">
          <h3 className="font-semibold text-purple-900 dark:text-purple-200 mb-1">🔒 Secure</h3>
          <p className="text-sm text-purple-700 dark:text-purple-300">
            Password-protected with real-time monitoring
          </p>
        </div>
      </div>

      {/* Supported Chains */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Supported Chains</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-3">
          {[
            { name: 'Ethereum', icon: '⟠', color: 'blue' },
            { name: 'Polygon', icon: '🟣', color: 'purple' },
            { name: 'BSC', icon: '🟡', color: 'yellow' },
            { name: 'Arbitrum', icon: '🔷', color: 'blue' },
            { name: 'Optimism', icon: '🔴', color: 'red' },
            { name: 'Tron', icon: '❤️', color: 'red' },
            { name: 'Avalanche', icon: '🔻', color: 'orange' },
          ].map((chain) => (
            <div
              key={chain.name}
              className="text-center p-3 rounded-lg bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 transition"
            >
              <div className="text-2xl mb-1">{chain.icon}</div>
              <div className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                {chain.name}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default MultiChainWithdrawalSection;
