/**
 * Payment Simulator UI Components
 * React TypeScript components for payment flow simulation and reversibility
 * 
 * Components:
 * - SimulationPreviewModal: Shows before/after comparison
 * - ConfirmationDialog: Gets user confirmation
 * - PendingActionsCard: Shows reversible actions
 * - ReversalConfirmationDialog: Handles reversals
 * - PaymentSimulationForm: Input form wrapper
 */

import React, { useState, useEffect } from 'react';

// Types matching backend SimulationResult
interface SimulationResult {
  status: 'SUCCESS' | 'WARNING' | 'ERROR';
  depth: 'BASIC' | 'INTERMEDIATE' | 'ADVANCED';
  timestamp: number;
  executionTimeMs: number;
  beforeState: Record<string, any>;
  afterState: Record<string, any>;
  delta: Record<string, any>;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  riskFactors: string[];
  warnings: string[];
  errors: string[];
  reversibilityWindow: {
    minGracePeriodHours: number;
    recommendedGracePeriodHours: number;
    maxGracePeriodDays: number;
  };
  summary: string;
  impactedEntities: Array<{
    type: string;
    id: string;
    impact: string;
  }>;
  simulationData?: Record<string, any>;
}

interface ReversibleAction {
  id: string;
  type: string;
  status: string;
  severity: string;
  createdAt: string;
  gracePeriodendsAt: string;
  hoursRemaining: number;
  percentRemaining: number;
  canReverse: boolean;
  reverseEndpoint: string;
  beforeState: Record<string, any>;
  afterState: Record<string, any>;
  description: string;
}

// ============================================================================
// COMPONENT 1: Simulation Preview Modal
// ============================================================================

interface SimulationPreviewModalProps {
  isOpen: boolean;
  simulation: SimulationResult | null;
  actionType: string;
  onConfirm: (simulation: SimulationResult) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export const SimulationPreviewModal: React.FC<SimulationPreviewModalProps> = ({
  isOpen,
  simulation,
  actionType,
  onConfirm,
  onCancel,
  isLoading = false,
}) => {
  if (!isOpen || !simulation) return null;

  const getRiskColor = (level: string) => {
    switch (level) {
      case 'LOW': return '#10B981';
      case 'MEDIUM': return '#F59E0B';
      case 'HIGH': return '#EF4444';
      case 'CRITICAL': return '#DC2626';
      default: return '#6B7280';
    }
  };

  const getRiskBadgeClass = (level: string) => {
    switch (level) {
      case 'LOW': return 'bg-green-100 text-green-800';
      case 'MEDIUM': return 'bg-yellow-100 text-yellow-800';
      case 'HIGH': return 'bg-red-100 text-red-800';
      case 'CRITICAL': return 'bg-red-900 text-white';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex justify-between items-center">
          <h2 className="text-xl font-bold">
            {actionType.replace(/_/g, ' ')} Simulation Preview
          </h2>
          <button
            onClick={onCancel}
            className="text-gray-400 hover:text-gray-600"
            disabled={isLoading}
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-6 space-y-6">
          {/* Status & Risk */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-600 mb-2">Status</p>
              <div className="flex items-center gap-2">
                {simulation.status === 'SUCCESS' ? (
                  <span className="w-3 h-3 bg-green-500 rounded-full"></span>
                ) : simulation.status === 'WARNING' ? (
                  <span className="w-3 h-3 bg-yellow-500 rounded-full"></span>
                ) : (
                  <span className="w-3 h-3 bg-red-500 rounded-full"></span>
                )}
                <span className="font-medium">{simulation.status}</span>
              </div>
            </div>
            <div>
              <p className="text-sm text-gray-600 mb-2">Risk Level</p>
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${getRiskBadgeClass(simulation.riskLevel)}`}>
                {simulation.riskLevel}
              </span>
            </div>
          </div>

          {/* Before/After Comparison */}
          <div className="border rounded-lg overflow-hidden">
            <div className="grid grid-cols-2 bg-gray-50 border-b">
              <div className="p-4 border-r">
                <p className="text-sm font-semibold text-gray-700 mb-3">Before State</p>
                <div className="space-y-2 text-sm">
                  {Object.entries(simulation.beforeState).map(([key, value]) => (
                    <div key={key} className="flex justify-between">
                      <span className="text-gray-600">{key}:</span>
                      <span className="font-medium">{String(value)}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="p-4">
                <p className="text-sm font-semibold text-gray-700 mb-3">After State</p>
                <div className="space-y-2 text-sm">
                  {Object.entries(simulation.afterState).map(([key, value]) => (
                    <div key={key} className="flex justify-between">
                      <span className="text-gray-600">{key}:</span>
                      <span className="font-medium text-green-600">{String(value)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Delta (Changes) */}
            <div className="p-4 bg-blue-50">
              <p className="text-sm font-semibold text-gray-700 mb-3">Changes</p>
              <div className="space-y-2 text-sm">
                {Object.entries(simulation.delta).map(([key, value]) => (
                  <div key={key} className="flex justify-between">
                    <span className="text-gray-600">{key}:</span>
                    <span className="font-medium text-blue-600">
                      {typeof value === 'number' && value > 0 ? '+' : ''}{String(value)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Fees & Charges */}
          {simulation.delta.feesCollected && (
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
              <p className="text-sm font-semibold text-gray-700 mb-2">Fees</p>
              <p className="text-lg font-bold text-orange-600">
                {simulation.delta.feesCollected}
                {simulation.simulationData?.currency ? ` ${simulation.simulationData.currency}` : ''}
              </p>
            </div>
          )}

          {/* Risk Factors */}
          {simulation.riskFactors.length > 0 && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <p className="text-sm font-semibold text-gray-700 mb-3">Risk Factors Detected</p>
              <ul className="space-y-2">
                {simulation.riskFactors.map((factor, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-sm">
                    <span className="text-yellow-600 mt-1">⚠</span>
                    <span className="text-gray-700">{factor.replace(/-/g, ' ')}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Warnings */}
          {simulation.warnings.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-sm font-semibold text-gray-700 mb-3">Warnings</p>
              <ul className="space-y-2">
                {simulation.warnings.map((warning, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-sm">
                    <span className="text-red-600 mt-1">!</span>
                    <span className="text-gray-700">{warning}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Errors */}
          {simulation.errors.length > 0 && (
            <div className="bg-red-50 border border-red-300 rounded-lg p-4">
              <p className="text-sm font-semibold text-gray-700 mb-3">Errors</p>
              <ul className="space-y-2">
                {simulation.errors.map((error, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-sm">
                    <span className="text-red-700 mt-1">✕</span>
                    <span className="text-gray-700">{error}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Reversibility Window */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm font-semibold text-gray-700 mb-3">Reversibility</p>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Recommended Grace Period:</span>
                <span className="font-medium text-blue-600">
                  {simulation.reversibilityWindow.recommendedGracePeriodHours} hours
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Max Reversibility:</span>
                <span className="font-medium text-blue-600">
                  {simulation.reversibilityWindow.maxGracePeriodDays} days
                </span>
              </div>
              <p className="text-xs text-gray-600 mt-2">
                After the grace period expires, this action becomes irreversible.
              </p>
            </div>
          </div>

          {/* Summary */}
          <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
            <p className="text-sm font-semibold text-gray-700 mb-2">Summary</p>
            <p className="text-sm text-gray-700">{simulation.summary}</p>
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-white border-t px-6 py-4 flex justify-end gap-3">
          <button
            onClick={onCancel}
            disabled={isLoading}
            className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm(simulation)}
            disabled={isLoading || simulation.errors.length > 0 || simulation.status === 'ERROR'}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isLoading && <span className="animate-spin">⟳</span>}
            {simulation.errors.length > 0 ? 'Cannot Confirm (Errors)' : 'Confirm & Execute'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// COMPONENT 2: Pending Actions Card
// ============================================================================

interface PendingActionsCardProps {
  action: ReversibleAction;
  onReverse: (actionId: string) => void;
  isReversing?: boolean;
}

export const PendingActionsCard: React.FC<PendingActionsCardProps> = ({
  action,
  onReverse,
  isReversing = false,
}) => {
  const [timeRemaining, setTimeRemaining] = useState<string>('');

  useEffect(() => {
    const updateTimer = () => {
      const deadline = new Date(action.gracePeriodendsAt).getTime();
      const now = Date.now();
      const diff = Math.max(0, deadline - now);

      if (diff === 0) {
        setTimeRemaining('Expired');
      } else {
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        setTimeRemaining(`${hours}h ${minutes}m`);
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 60000); // Update every minute

    return () => clearInterval(interval);
  }, [action.gracePeriodendsAt]);

  const getStatusColor = (percent: number) => {
    if (percent <= 10) return 'bg-red-500';
    if (percent <= 25) return 'bg-orange-500';
    return 'bg-green-500';
  };

  return (
    <div className="border rounded-lg p-4 hover:shadow-md transition-shadow">
      <div className="flex justify-between items-start mb-3">
        <div>
          <p className="font-semibold text-gray-900">{action.type.replace(/_/g, ' ')}</p>
          <p className="text-sm text-gray-500">{action.description}</p>
        </div>
        <span className={`px-2 py-1 rounded text-xs font-medium ${
          action.status === 'GRACE_PERIOD' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'
        }`}>
          {action.status}
        </span>
      </div>

      {/* Timeline to Irreversibility */}
      <div className="mb-4">
        <div className="flex justify-between items-center mb-2">
          <span className="text-xs text-gray-600">Time to Irreversibility</span>
          <span className="text-sm font-medium text-gray-900">{timeRemaining}</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className={`h-2 rounded-full transition-all ${getStatusColor(action.percentRemaining)}`}
            style={{ width: `${action.percentRemaining}%` }}
          ></div>
        </div>
        <p className="text-xs text-gray-500 mt-1">
          {action.percentRemaining}% of grace period remaining
        </p>
      </div>

      {/* Before/After Preview */}
      <div className="grid grid-cols-2 gap-3 mb-4 text-xs">
        <div>
          <p className="text-gray-600 mb-1">Before</p>
          <div className="space-y-1 p-2 bg-gray-50 rounded">
            {Object.entries(action.beforeState).slice(0, 2).map(([key, value]) => (
              <div key={key} className="flex justify-between">
                <span className="text-gray-600">{key}:</span>
                <span className="font-medium">{String(value).slice(0, 20)}</span>
              </div>
            ))}
          </div>
        </div>
        <div>
          <p className="text-gray-600 mb-1">After</p>
          <div className="space-y-1 p-2 bg-green-50 rounded">
            {Object.entries(action.afterState).slice(0, 2).map(([key, value]) => (
              <div key={key} className="flex justify-between">
                <span className="text-gray-600">{key}:</span>
                <span className="font-medium text-green-600">{String(value).slice(0, 20)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Action Button */}
      {action.canReverse && (
        <button
          onClick={() => onReverse(action.id)}
          disabled={isReversing || action.percentRemaining <= 0}
          className="w-full px-3 py-2 bg-red-50 text-red-700 border border-red-200 rounded hover:bg-red-100 disabled:opacity-50 text-sm font-medium transition-colors"
        >
          {isReversing ? (
            <span className="flex items-center justify-center gap-2">
              <span className="animate-spin">⟳</span> Reversing...
            </span>
          ) : (
            'Reverse This Action'
          )}
        </button>
      )}

      {!action.canReverse && (
        <div className="p-2 bg-gray-100 rounded text-xs text-gray-600 text-center">
          Grace period expired - action is now irreversible
        </div>
      )}
    </div>
  );
};

// ============================================================================
// COMPONENT 3: Reversal Confirmation Dialog
// ============================================================================

interface ReversalConfirmationDialogProps {
  isOpen: boolean;
  actionId: string;
  actionType: string;
  onConfirm: (actionId: string, reason: string) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export const ReversalConfirmationDialog: React.FC<ReversalConfirmationDialogProps> = ({
  isOpen,
  actionId,
  actionType,
  onConfirm,
  onCancel,
  isLoading = false,
}) => {
  const [selectedReason, setSelectedReason] = useState('USER_REQUESTED');
  const [customDetails, setCustomDetails] = useState('');

  if (!isOpen) return null;

  const reasons = [
    { value: 'USER_REQUESTED', label: 'Changed my mind' },
    { value: 'SENT_TO_WRONG_RECIPIENT', label: 'Sent to wrong recipient' },
    { value: 'DUPLICATE_PAYMENT', label: 'Duplicate payment' },
    { value: 'INCORRECT_AMOUNT', label: 'Wrong amount' },
  ];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
        {/* Header */}
        <div className="border-b px-6 py-4">
          <h2 className="text-lg font-bold text-red-600">Reverse Action</h2>
          <p className="text-sm text-gray-600 mt-1">
            {actionType.replace(/_/g, ' ')}
          </p>
        </div>

        {/* Body */}
        <div className="px-6 py-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Reason for Reversal
            </label>
            <div className="space-y-2">
              {reasons.map((reason) => (
                <label key={reason.value} className="flex items-center gap-3 p-3 border rounded-lg hover:bg-gray-50 cursor-pointer">
                  <input
                    type="radio"
                    name="reason"
                    value={reason.value}
                    checked={selectedReason === reason.value}
                    onChange={(e) => setSelectedReason(e.target.value)}
                    disabled={isLoading}
                    className="w-4 h-4 text-red-600"
                  />
                  <span className="text-sm text-gray-700">{reason.label}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Additional Details (Optional)
            </label>
            <textarea
              value={customDetails}
              onChange={(e) => setCustomDetails(e.target.value)}
              disabled={isLoading}
              placeholder="Provide any additional context..."
              className="w-full px-3 py-2 border rounded-lg text-sm resize-vertical focus:outline-none focus:ring-2 focus:ring-red-500"
              rows={3}
            />
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <p className="text-sm text-blue-800">
              <strong>Note:</strong> This action will be reversed and funds will be restored within 1-2 business days for external withdrawals.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t px-6 py-4 flex justify-end gap-3">
          <button
            onClick={onCancel}
            disabled={isLoading}
            className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm(actionId, selectedReason)}
            disabled={isLoading}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-gray-400 flex items-center gap-2"
          >
            {isLoading && <span className="animate-spin">⟳</span>}
            Confirm Reversal
          </button>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// COMPONENT 4: Pending Actions Dashboard
// ============================================================================

interface PendingActionsDashboardProps {
  actions: ReversibleAction[];
  onReverse: (actionId: string) => void;
  isLoading?: boolean;
}

export const PendingActionsDashboard: React.FC<PendingActionsDashboardProps> = ({
  actions,
  onReverse,
  isLoading = false,
}) => {
  const reversibleCount = actions.filter(a => a.canReverse).length;
  const soonToExpire = actions.filter(a => a.percentRemaining < 25 && a.canReverse).length;

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-gray-600 text-sm mb-1">Total Pending</p>
          <p className="text-2xl font-bold text-blue-600">{actions.length}</p>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <p className="text-gray-600 text-sm mb-1">Can Reverse</p>
          <p className="text-2xl font-bold text-green-600">{reversibleCount}</p>
        </div>
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
          <p className="text-gray-600 text-sm mb-1">Soon to Expire</p>
          <p className="text-2xl font-bold text-orange-600">{soonToExpire}</p>
        </div>
      </div>

      {/* Actions List */}
      <div className="space-y-3">
        {actions.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-500">No pending actions</p>
          </div>
        ) : (
          actions.map((action) => (
            <PendingActionsCard
              key={action.id}
              action={action}
              onReverse={onReverse}
              isReversing={isLoading}
            />
          ))
        )}
      </div>
    </div>
  );
};

// ============================================================================
// COMPONENT 5: Success Notification
// ============================================================================

interface SuccessNotificationProps {
  isVisible: boolean;
  title: string;
  message: string;
  actionId?: string;
  onDismiss: () => void;
}

export const SuccessNotification: React.FC<SuccessNotificationProps> = ({
  isVisible,
  title,
  message,
  actionId,
  onDismiss,
}) => {
  useEffect(() => {
    if (isVisible) {
      const timer = setTimeout(onDismiss, 5000);
      return () => clearTimeout(timer);
    }
  }, [isVisible, onDismiss]);

  if (!isVisible) return null;

  return (
    <div className="fixed bottom-4 right-4 bg-green-50 border border-green-200 rounded-lg p-4 shadow-lg max-w-sm z-40">
      <div className="flex gap-3">
        <div className="text-green-600 text-xl">✓</div>
        <div className="flex-1">
          <p className="font-semibold text-green-900">{title}</p>
          <p className="text-sm text-green-800 mt-1">{message}</p>
          {actionId && (
            <p className="text-xs text-green-600 mt-2 font-mono">{actionId}</p>
          )}
        </div>
        <button
          onClick={onDismiss}
          className="text-green-400 hover:text-green-600"
        >
          ✕
        </button>
      </div>
    </div>
  );
};

// ============================================================================
// COMPONENT 6: Error Notification
// ============================================================================

interface ErrorNotificationProps {
  isVisible: boolean;
  title: string;
  message: string;
  onDismiss: () => void;
}

export const ErrorNotification: React.FC<ErrorNotificationProps> = ({
  isVisible,
  title,
  message,
  onDismiss,
}) => {
  useEffect(() => {
    if (isVisible) {
      const timer = setTimeout(onDismiss, 5000);
      return () => clearTimeout(timer);
    }
  }, [isVisible, onDismiss]);

  if (!isVisible) return null;

  return (
    <div className="fixed bottom-4 right-4 bg-red-50 border border-red-200 rounded-lg p-4 shadow-lg max-w-sm z-40">
      <div className="flex gap-3">
        <div className="text-red-600 text-xl">✕</div>
        <div className="flex-1">
          <p className="font-semibold text-red-900">{title}</p>
          <p className="text-sm text-red-800 mt-1">{message}</p>
        </div>
        <button
          onClick={onDismiss}
          className="text-red-400 hover:text-red-600"
        >
          ✕
        </button>
      </div>
    </div>
  );
};
