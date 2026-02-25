/**
 * StatusMonitor Component
 * Real-time withdrawal progress tracking
 * Shows confirmations, estimated time, and transaction links
 */

import React, { useEffect, useState } from 'react';
import { useMultichainWithdrawal } from '../../hooks/useMultichainWithdrawal';

interface StatusMonitorProps {
  withdrawalId: string;
  onComplete?: (status: any) => void;
  onFailed?: (reason: string) => void;
}

const StatusMonitor: React.FC<StatusMonitorProps> = ({ withdrawalId, onComplete, onFailed }) => {
  const { executionStatus, getWithdrawalStatus, cancelWithdrawal, isPolling } =
    useMultichainWithdrawal();

  const [countdown, setCountdown] = useState(0);
  const [showDetails, setShowDetails] = useState(false);

  // Load initial status
  useEffect(() => {
    getWithdrawalStatus(withdrawalId);
  }, [withdrawalId, getWithdrawalStatus]);

  // Update countdown
  useEffect(() => {
    if (!executionStatus) return;

    const interval = setInterval(() => {
      setCountdown((prev) => {
        const newCount = Math.max(0, prev - 1);
        if (newCount === 0 && executionStatus.status === 'completed') {
          onComplete?.(executionStatus);
        }
        if (executionStatus.status === 'failed') {
          onFailed?.(executionStatus.failureReason || 'Unknown error');
        }
        return newCount;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [executionStatus, onComplete, onFailed]);

  if (!executionStatus) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
        <div className="flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          <span className="ml-3 text-gray-600 dark:text-gray-400">Loading status...</span>
        </div>
      </div>
    );
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'failed':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      case 'bridging':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      default:
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return '✓';
      case 'failed':
        return '✕';
      case 'bridging':
        return '🌉';
      default:
        return '⏳';
    }
  };

  const formatTime = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}m ${secs}s`;
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            {getStatusIcon(executionStatus.status)} Withdrawal #{withdrawalId.slice(-8)}
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            ID: <span className="font-mono">{withdrawalId}</span>
          </p>
        </div>
        <span
          className={`px-4 py-2 rounded-full font-semibold text-sm ${getStatusColor(
            executionStatus.status
          )}`}
        >
          {executionStatus.status.toUpperCase()}
        </span>
      </div>

      {/* Progress Bar */}
      <div className="mb-6">
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Progress
          </span>
          <span className="text-sm font-semibold text-gray-900 dark:text-white">
            {executionStatus.progressPercent}%
          </span>
        </div>
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3 overflow-hidden">
          <div
            className="bg-blue-500 h-full transition-all duration-500"
            style={{ width: `${executionStatus.progressPercent}%` }}
          ></div>
        </div>
      </div>

      {/* Status Cards Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {/* Confirmations */}
        <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
          <div className="text-2xl font-bold text-gray-900 dark:text-white">
            {executionStatus.confirmations}/{executionStatus.totalConfirmationsNeeded}
          </div>
          <div className="text-xs text-gray-600 dark:text-gray-400">Confirmations</div>
        </div>

        {/* Est. Time */}
        <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
          <div className="text-2xl font-bold text-gray-900 dark:text-white">
            {formatTime(executionStatus.estimatedTimeRemaining)}
          </div>
          <div className="text-xs text-gray-600 dark:text-gray-400">Est. Time Remaining</div>
        </div>

        {/* Source Chain */}
        <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
          <div className="text-lg font-bold text-gray-900 dark:text-white">ETH</div>
          <div className="text-xs text-gray-600 dark:text-gray-400">Source</div>
        </div>

        {/* Target Chain */}
        <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
          <div className="text-lg font-bold text-gray-900 dark:text-white">POLYGON</div>
          <div className="text-xs text-gray-600 dark:text-gray-400">Target</div>
        </div>
      </div>

      {/* Transaction Links */}
      {(executionStatus.sourceTransactionHash ||
        executionStatus.bridgeTransactionHash ||
        executionStatus.targetTransactionHash) && (
        <div className="mb-6">
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="text-sm font-semibold text-blue-500 hover:text-blue-600 mb-3 flex items-center"
          >
            {showDetails ? '▼' : '▶'} Transaction Details
          </button>

          {showDetails && (
            <div className="space-y-2">
              {executionStatus.sourceTransactionHash && (
                <div className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Source TX:</span>
                  <a
                    href={`https://etherscan.io/tx/${executionStatus.sourceTransactionHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-mono text-blue-500 hover:text-blue-600 break-all"
                  >
                    {executionStatus.sourceTransactionHash.slice(0, 16)}...
                  </a>
                </div>
              )}

              {executionStatus.bridgeTransactionHash && (
                <div className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Bridge TX:</span>
                  <a
                    href="#"
                    className="text-xs font-mono text-blue-500 hover:text-blue-600 break-all"
                  >
                    {executionStatus.bridgeTransactionHash.slice(0, 16)}...
                  </a>
                </div>
              )}

              {executionStatus.targetTransactionHash && (
                <div className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Target TX:</span>
                  <a
                    href={`https://polygonscan.com/tx/${executionStatus.targetTransactionHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-mono text-blue-500 hover:text-blue-600 break-all"
                  >
                    {executionStatus.targetTransactionHash.slice(0, 16)}...
                  </a>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Failure Reason */}
      {executionStatus.status === 'failed' && executionStatus.failureReason && (
        <div className="mb-6 p-4 bg-red-50 dark:bg-red-900 border border-red-200 dark:border-red-700 rounded-lg">
          <div className="text-sm font-semibold text-red-800 dark:text-red-200 mb-1">
            Failure Reason
          </div>
          <div className="text-sm text-red-700 dark:text-red-100">
            {executionStatus.failureReason}
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-4">
        {(executionStatus.status === 'pending' || executionStatus.status === 'bridging') && (
          <button
            onClick={() => cancelWithdrawal(executionStatus.withdrawalId)}
            className="flex-1 py-2 px-4 bg-red-500 hover:bg-red-600 text-white rounded-lg font-medium transition"
          >
            Cancel Withdrawal
          </button>
        )}

        {(executionStatus.status === 'completed' || executionStatus.status === 'failed') && (
          <button
            onClick={() => window.location.reload()}
            className="flex-1 py-2 px-4 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium transition"
          >
            Start New Withdrawal
          </button>
        )}
      </div>

      {/* Polling Indicator */}
      {isPolling && (
        <div className="mt-4 flex items-center justify-center text-xs text-gray-500 dark:text-gray-400">
          <div className="animate-pulse w-2 h-2 bg-green-500 rounded-full mr-2"></div>
          Monitoring in real-time...
        </div>
      )}
    </div>
  );
};

export default StatusMonitor;
