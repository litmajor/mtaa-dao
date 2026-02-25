/**
 * PendingActionsDashboard Component
 * 
 * Shows all reversible payment actions with countdown to irreversibility
 */

import React, { useEffect, useState } from 'react';
import { usePaymentSimulation } from '../hooks/usePaymentSimulation';

interface PendingActionsDashboardProps {
  onReverseSuccess?: (actionId: string) => void;
}

export const PendingActionsDashboard: React.FC<PendingActionsDashboardProps> = ({ onReverseSuccess }) => {
  const {
    pendingActions,
    isLoadingPendingActions,
    isReversing,
    reversalError,
    getPendingActions,
    confirmReversal,
    handleSimulationCancel: resetHook,
  } = usePaymentSimulation();

  const [reversalId, setReversalId] = useState<string | null>(null);
  const [reversalReason, setReversalReason] = useState('USER_REQUESTED');
  const [countdowns, setCountdowns] = useState<Record<string, number>>({});

  // Load pending actions on mount
  useEffect(() => {
    getPendingActions();
  }, [getPendingActions]);

  // Update countdowns every second
  useEffect(() => {
    const interval = setInterval(() => {
      const newCountdowns: Record<string, number> = {};
      pendingActions.forEach(action => {
        const deadline = new Date(action.gracePeriodEndsAt).getTime();
        const remaining = Math.max(0, deadline - Date.now());
        newCountdowns[action.id] = remaining;
      });
      setCountdowns(newCountdowns);
    }, 1000);

    return () => clearInterval(interval);
  }, [pendingActions]);

  const handleReverse = async (actionId: string) => {
    const result = await confirmReversal(actionId, reversalReason);
    if (result) {
      onReverseSuccess?.(actionId);
      setReversalId(null);
      setReversalReason('USER_REQUESTED');
      resetHook();
    }
  };

  const formatCountdown = (ms: number): string => {
    if (ms <= 0) return 'Expired';
    
    const days = Math.floor(ms / (1000 * 60 * 60 * 24));
    const hours = Math.floor((ms % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));

    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  const getRiskColor = (severity: string) => {
    switch (severity) {
      case 'LOW':
        return 'text-green-600 bg-green-50';
      case 'MEDIUM':
        return 'text-yellow-600 bg-yellow-50';
      case 'HIGH':
        return 'text-red-600 bg-red-50';
      case 'CRITICAL':
        return 'text-red-700 bg-red-100';
      default:
        return 'text-gray-600 bg-gray-50';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PENDING_CONFIRMATION':
        return 'bg-blue-100 text-blue-800';
      case 'GRACE_PERIOD':
        return 'bg-yellow-100 text-yellow-800';
      case 'EXECUTED':
        return 'bg-green-100 text-green-800';
      case 'REVERSED':
        return 'bg-purple-100 text-purple-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (isLoadingPendingActions && pendingActions.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-6 text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
        <p className="text-gray-600 mt-3">Loading pending actions...</p>
      </div>
    );
  }

  if (pendingActions.length === 0) {
    return (
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 text-center">
        <p className="text-lg font-semibold text-blue-800">✅ No Pending Actions</p>
        <p className="text-blue-600 mt-2">All your recent payment actions have been finalized.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-lg overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-6">
        <h2 className="text-2xl font-bold">⏱️ Pending Payment Actions</h2>
        <p className="text-blue-100 mt-1">
          Actions within grace period that can be reversed ({pendingActions.length} total)
        </p>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-3 gap-4 p-6 bg-gray-50 border-b">
        <div className="text-center">
          <p className="text-2xl font-bold text-blue-600">{pendingActions.length}</p>
          <p className="text-xs text-gray-600">Total Actions</p>
        </div>
        <div className="text-center">
          <p className="text-2xl font-bold text-green-600">
            {pendingActions.filter(a => a.canReverse).length}
          </p>
          <p className="text-xs text-gray-600">Reversible Now</p>
        </div>
        <div className="text-center">
          <p className="text-2xl font-bold text-orange-600">
            {pendingActions.filter(a => a.percentRemaining < 25 && a.canReverse).length}
          </p>
          <p className="text-xs text-gray-600">Expiring Soon</p>
        </div>
      </div>

      {/* Actions List */}
      <div className="divide-y">
        {pendingActions.map(action => {
          const countdown = countdowns[action.id];
          const isExpiring = countdown && countdown < 24 * 60 * 60 * 1000; // Less than 24h

          return (
            <div key={action.id} className="p-6 hover:bg-gray-50 transition">
              {/* Action Header */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(action.status)}`}>
                      {action.status.replace(/_/g, ' ')}
                    </span>
                    <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${getRiskColor(action.severity)}`}>
                      {action.severity}
                    </span>
                    {isExpiring && <span className="text-orange-600 font-bold">⚠️ Expiring Soon</span>}
                  </div>
                  <p className="text-lg font-semibold text-gray-800 mt-2">{action.description}</p>
                  <p className="text-sm text-gray-500 mt-1">ID: <span className="font-mono text-xs">{action.id}</span></p>
                </div>
              </div>

              {/* Countdown */}
              {action.canReverse && (
                <div className="mb-4 p-3 bg-blue-50 rounded border border-blue-200">
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="text-xs font-semibold text-gray-600">Time Remaining</p>
                      <p className="text-lg font-bold text-blue-600 font-mono">
                        {formatCountdown(countdown || 0)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-semibold text-gray-600">Progress</p>
                      <div className="w-32 h-2 bg-gray-200 rounded-full overflow-hidden mt-1">
                        <div
                          className="h-full bg-blue-600 transition-all"
                          style={{ width: `${action.percentRemaining}%` }}
                        ></div>
                      </div>
                      <p className="text-xs text-gray-600 mt-1">{action.percentRemaining}% remaining</p>
                    </div>
                  </div>
                  <p className="text-xs text-gray-600 mt-2">
                    Becomes irreversible: {new Date(action.gracePeriodEndsAt).toLocaleString()}
                  </p>
                </div>
              )}

              {/* Before/After Comparison */}
              <div className="mb-4 grid grid-cols-2 gap-3">
                <div className="p-3 bg-gray-50 rounded">
                  <p className="text-xs font-semibold text-gray-600 uppercase mb-2">Before</p>
                  <p className="text-sm text-gray-700">
                    {JSON.stringify(action.beforeState, null, 2).split('\n').slice(0, 3).join(' ')}...
                  </p>
                </div>
                <div className="p-3 bg-green-50 rounded">
                  <p className="text-xs font-semibold text-gray-600 uppercase mb-2">After</p>
                  <p className="text-sm text-green-700">
                    {JSON.stringify(action.afterState, null, 2).split('\n').slice(0, 3).join(' ')}...
                  </p>
                </div>
              </div>

              {/* Actions */}
              {action.canReverse ? (
                <>
                  {reversalId === action.id ? (
                    <div className="space-y-3 p-4 bg-gray-50 rounded border border-gray-200">
                      <p className="text-sm font-semibold text-gray-700">Reason for reversal:</p>
                      <select
                        value={reversalReason}
                        onChange={e => setReversalReason(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded"
                      >
                        <option value="USER_REQUESTED">User Requested</option>
                        <option value="SENT_TO_WRONG_RECIPIENT">Sent to Wrong Recipient</option>
                        <option value="DUPLICATE_PAYMENT">Duplicate Payment</option>
                        <option value="INCORRECT_AMOUNT">Incorrect Amount</option>
                      </select>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleReverse(action.id)}
                          disabled={isReversing}
                          className="flex-1 px-4 py-2 bg-red-600 text-white rounded font-semibold hover:bg-red-700 disabled:opacity-50 transition"
                        >
                          {isReversing ? '⏳ Reversing...' : '⏮️ Confirm Reversal'}
                        </button>
                        <button
                          onClick={() => setReversalId(null)}
                          className="flex-1 px-4 py-2 border border-gray-300 rounded font-semibold hover:bg-gray-100 transition"
                        >
                          Cancel
                        </button>
                      </div>
                      {reversalError && (
                        <p className="text-sm text-red-600">{reversalError}</p>
                      )}
                    </div>
                  ) : (
                    <button
                      onClick={() => setReversalId(action.id)}
                      className="px-4 py-2 bg-red-600 text-white rounded font-semibold hover:bg-red-700 transition"
                    >
                      ⏮️ Reverse This Action
                    </button>
                  )}
                </>
              ) : (
                <div className="p-3 bg-red-50 rounded text-red-700 text-sm">
                  🔒 Grace period expired - this action can no longer be reversed
                </div>
              )}

              {/* Reversal Success Message */}
              {isReversing && reversalId === action.id && (
                <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded text-blue-700 text-sm">
                  ⏳ Processing reversal...
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
