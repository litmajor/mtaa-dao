/**
 * ActionDetailModal Component
 * 
 * Shows detailed view of a single reversible action
 */

import React, { useEffect, useState } from 'react';
import { Lucide } from '../src/lib/icons';
const { X, Timer, DollarSign, TriangleAlert, Siren, Users, RotateCcw, Check, CheckCircle, Lock } = (Lucide as any) || {};

interface ActionState {
  [key: string]: any;
}

interface ActionDetail {
  id: string;
  type: string;
  status: string;
  severity: string;
  description: string;
  createdAt: string;
  gracePeriodEndsAt: string;
  canReverse: boolean;
  percentRemaining: number;
  beforeState: ActionState;
  afterState: ActionState;
  affectedEntities: string[];
  fees?: number;
  liquidityImpact?: number;
  riskFactors?: string[];
  warnings?: string[];
}

interface ActionDetailModalProps {
  isOpen: boolean;
  actionId?: string;
  action?: ActionDetail;
  isLoading?: boolean;
  onClose: () => void;
  onReverse?: (actionId: string, reason: string) => Promise<boolean>;
}

export const ActionDetailModal: React.FC<ActionDetailModalProps> = ({
  isOpen,
  actionId,
  action,
  isLoading = false,
  onClose,
  onReverse,
}) => {
  const [reversalReason, setReversalReason] = useState('USER_REQUESTED');
  const [isReversing, setIsReversing] = useState(false);
  const [reversalSuccess, setReversalSuccess] = useState(false);
  const [reversalError, setReversalError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(0);

  // Update countdown
  useEffect(() => {
    if (!action) {
      setCountdown(0);
      return;
    }

    const updateCountdown = () => {
      const deadline = new Date(action.gracePeriodEndsAt).getTime();
      const remaining = Math.max(0, deadline - Date.now());
      setCountdown(remaining);
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [action]);

  const formatCountdown = (ms: number): string => {
    if (ms <= 0) return 'Expired';
    
    const days = Math.floor(ms / (1000 * 60 * 60 * 24));
    const hours = Math.floor((ms % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));

    if (days > 0) return `${days} days ${hours} hours`;
    if (hours > 0) return `${hours} hours ${minutes} minutes`;
    return `${minutes} minutes`;
  };

  const getRiskEmoji = (severity: string): string => {
    switch (severity) {
      case 'LOW':
        return '✅';
      case 'MEDIUM':
        return '⚠️';
      case 'HIGH':
        return '🚨';
      case 'CRITICAL':
        return '🔴';
      default:
        return '❓';
    }
  };

  const getRiskColor = (severity: string): string => {
    switch (severity) {
      case 'LOW':
        return 'bg-green-50 border-green-200 text-green-800';
      case 'MEDIUM':
        return 'bg-yellow-50 border-yellow-200 text-yellow-800';
      case 'HIGH':
        return 'bg-red-50 border-red-200 text-red-800';
      case 'CRITICAL':
        return 'bg-red-100 border-red-300 text-red-900';
      default:
        return 'bg-gray-50 border-gray-200 text-gray-800';
    }
  };

  const getStatusColor = (status: string): string => {
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

  const handleReverse = async () => {
    if (!action || !onReverse) return;

    setIsReversing(true);
    setReversalError(null);
    setReversalSuccess(false);

    try {
      const success = await onReverse(action.id, reversalReason);
      if (success) {
        setReversalSuccess(true);
        setTimeout(() => {
          onClose();
        }, 2000);
      } else {
        setReversalError('Failed to reverse action. Please try again.');
      }
    } catch (error) {
      setReversalError(error instanceof Error ? error.message : 'An error occurred');
    } finally {
      setIsReversing(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-indigo-600 to-purple-600 text-white p-6 border-b">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-2xl font-bold">Action Details</h2>
              <p className="text-indigo-100 mt-1">ID: <span className="font-mono text-xs">{action?.id}</span></p>
            </div>
            <button
              onClick={onClose}
              className="text-white hover:bg-white hover:bg-opacity-20 rounded p-2 transition"
            >
              {X ? <X className="w-5 h-5" /> : '✕'}
            </button>
          </div>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="p-6 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
            <p className="text-gray-600 mt-4">Loading action details...</p>
          </div>
        )}

        {/* Content */}
        {!isLoading && action && (
          <div className="p-6 space-y-6">
            {/* Status & Severity */}
            <div className="flex gap-3">
              <span className={`inline-block px-4 py-2 rounded-full text-sm font-bold ${getStatusColor(action.status)}`}>
                {action.status.replace(/_/g, ' ')}
              </span>
              <span className={`inline-block px-4 py-2 rounded-full text-sm font-bold border ${getRiskColor(action.severity)}`}>
                {getRiskEmoji(action.severity)} {action.severity}
              </span>
            </div>

            {/* Action Description */}
            <div>
              <h3 className="text-lg font-bold text-gray-800">{action.description}</h3>
              <p className="text-sm text-gray-600 mt-2">Type: {action.type}</p>
              <p className="text-sm text-gray-600">Created: {new Date(action.createdAt).toLocaleString()}</p>
            </div>

            {/* Grace Period Countdown */}
            {action.canReverse && (
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm font-bold text-gray-700 mb-2">{Timer ? <Timer className="inline w-4 h-4 mr-2" /> : '⏱️'} Time to Reverse</p>
                <p className="text-2xl font-bold text-blue-600 font-mono">{formatCountdown(countdown)}</p>
                <p className="text-xs text-gray-600 mt-2">
                  Deadlineเก: {new Date(action.gracePeriodEndsAt).toLocaleString()}
                </p>
                {/* Progress Bar */}
                <div className="mt-3 space-y-1">
                  <div className="flex justify-between text-xs">
                    <span>Progress</span>
                    <span>{action.percentRemaining}%</span>
                  </div>
                  <div className="w-full h-2 bg-gray-300 rounded-full overflow-hidden">
                      <div className={`h-full bg-blue-600 transition-all w-[${action.percentRemaining}%]`}></div>
                  </div>
                </div>
              </div>
            )}

            {/* Before/After States */}
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
                <h4 className="font-bold text-gray-800 mb-3">Before</h4>
                <div className="space-y-2">
                  {Object.entries(action.beforeState).map(([key, value]) => (
                    <div key={key} className="text-sm">
                      <p className="font-semibold text-gray-700">{key}</p>
                      <p className="text-gray-600 font-mono text-xs">
                        {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <h4 className="font-bold text-green-800 mb-3">After</h4>
                <div className="space-y-2">
                  {Object.entries(action.afterState).map(([key, value]) => (
                    <div key={key} className="text-sm">
                      <p className="font-semibold text-gray-700">{key}</p>
                      <p className="text-gray-600 font-mono text-xs">
                        {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Impacts */}
            {action.fees !== undefined && (
              <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <h4 className="font-bold text-gray-800 mb-2">{DollarSign ? <DollarSign className="inline w-5 h-5 mr-2" /> : '💰'} Financial Impact</h4>
                <div className="space-y-2 text-sm">
                  {action.fees !== undefined && (
                    <p className="text-gray-700">
                      <span className="font-semibold">Fees:</span> {action.fees.toFixed(2)} MTAA
                    </p>
                  )}
                  {action.liquidityImpact !== undefined && (
                    <p className="text-gray-700">
                      <span className="font-semibold">Liquidity Impact:</span> {action.liquidityImpact.toFixed(2)} MTAA
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Risk Factors */}
            {action.riskFactors && action.riskFactors.length > 0 && (
              <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg">
                <h4 className="font-bold text-gray-800 mb-3">{TriangleAlert ? <TriangleAlert className="inline w-5 h-5 mr-2 text-orange-600" /> : '⚠️'} Risk Factors</h4>
                <ul className="space-y-2">
                  {action.riskFactors.map((factor, idx) => (
                    <li key={idx} className="text-sm text-orange-900 flex items-start gap-2">
                      <span className="text-orange-600 mt-0.5">•</span>
                      <span>{factor}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Warnings */}
            {action.warnings && action.warnings.length > 0 && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                <h4 className="font-bold text-gray-800 mb-3">{Siren ? <Siren className="inline w-5 h-5 mr-2 text-red-600" /> : '🚨'} Warnings</h4>
                <ul className="space-y-2">
                  {action.warnings.map((warning, idx) => (
                    <li key={idx} className="text-sm text-red-900 flex items-start gap-2">
                      <span className="text-red-600 mt-0.5">{TriangleAlert ? <TriangleAlert className="w-4 h-4 text-red-600" /> : '⚠️'}</span>
                      <span>{warning}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Affected Entities */}
            <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-lg">
              <h4 className="font-bold text-gray-800 mb-3">{Users ? <Users className="inline w-5 h-5 mr-2 text-indigo-600" /> : '👥'} Affected Entities</h4>
              <ul className="space-y-1">
                {action.affectedEntities.map((entity, idx) => (
                  <li key={idx} className="text-sm text-indigo-900">
                    <span className="text-indigo-600">→</span> {entity}
                  </li>
                ))}
              </ul>
            </div>

            {/* Reversal Section */}
            {action.canReverse && !reversalSuccess && (
              <div className="space-y-3 p-4 bg-red-50 border border-red-200 rounded-lg">
                <h4 className="font-bold text-gray-800">{RotateCcw ? <RotateCcw className="inline w-5 h-5 mr-2" /> : '⏮️'} Reverse This Action</h4>
                <div>
                  <label htmlFor="reversalReason" className="block text-sm font-semibold text-gray-700 mb-2">
                    Reason for Reversal
                  </label>
                  <select
                    id="reversalReason"
                    value={reversalReason}
                    onChange={e => setReversalReason(e.target.value)}
                    disabled={isReversing}
                    className="w-full px-3 py-2 border border-red-300 rounded bg-white text-gray-700"
                  >
                    <option value="USER_REQUESTED">User Requested</option>
                    <option value="SENT_TO_WRONG_RECIPIENT">Sent to Wrong Recipient</option>
                    <option value="DUPLICATE_PAYMENT">Duplicate Payment</option>
                    <option value="INCORRECT_AMOUNT">Incorrect Amount</option>
                    <option value="SECURITY_ISSUE">Security Issue</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>
                {reversalError && (
                  <p className="text-sm text-red-600 font-semibold">{reversalError}</p>
                )}
                <button
                  onClick={handleReverse}
                  disabled={isReversing}
                  className="w-full px-4 py-3 bg-red-600 text-white rounded font-bold hover:bg-red-700 disabled:opacity-50 transition"
                >
                  {isReversing ? (Timer ? <><Timer className="inline w-4 h-4 mr-2" />Reversing...</> : '⏳ Reversing...') : (Check ? <><Check className="inline w-4 h-4 mr-2" />Confirm Reversal</> : '✓ Confirm Reversal')}
                </button>
              </div>
            )}

            {/* Success Message */}
            {reversalSuccess && (
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <p className="text-green-800 font-bold">{CheckCircle ? <CheckCircle className="inline w-4 h-4 mr-2 text-green-600" /> : '✅'} Action reversed successfully!</p>
                <p className="text-green-700 text-sm mt-2">
                  All changes from this action have been reverted.
                </p>
              </div>
            )}

            {/* Expired Message */}
            {!action.canReverse && (
              <div className="p-4 bg-gray-50 border border-gray-300 rounded-lg">
                <p className="text-gray-800 font-bold">{Lock ? <Lock className="inline w-4 h-4 mr-2" /> : '🔒'} Grace Period Expired</p>
                <p className="text-gray-700 text-sm mt-2">
                  This action can no longer be reversed. It became permanent on{' '}
                  {new Date(action.gracePeriodEndsAt).toLocaleString()}.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="sticky bottom-0 bg-gray-50 border-t p-4 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 rounded font-semibold hover:bg-gray-100 transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
