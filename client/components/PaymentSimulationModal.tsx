/**
 * PaymentSimulationModal Component
 * 
 * Displays simulation preview before user confirms payment action
 * Shows: before/after state, fees, risks, grace period countdown
 */

import React, { useState } from 'react';

// Inline types
interface SimulationResult {
  id: string;
  actionType: string;
  summary: string;
  beforeState: Record<string, any>;
  afterState: Record<string, any>;
  delta: Record<string, any>;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  riskFactors: string[];
  warnings: string[];
  errors?: string[];
  affectedEntities?: string[];
  status?: 'SUCCESS' | 'WARNING' | 'ERROR';
  reversibilityInformation?: { 
    gracePeriodHours: number; 
    maxGracePeriodDays?: number;
  };
}

interface PaymentSimulationModalProps {
  isOpen: boolean;
  simulation: SimulationResult | null;
  isLoading: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  actionType: string;
}

export const PaymentSimulationModal: React.FC<PaymentSimulationModalProps> = ({
  isOpen,
  simulation,
  isLoading,
  onConfirm,
  onCancel,
  actionType,
}) => {
  if (!isOpen || !simulation) return null;

  const gracePeriodHours = simulation.reversibilityInformation?.gracePeriodHours || 72;
  const maxGracePeriodDays = simulation.reversibilityInformation?.maxGracePeriodDays || 30;

  const gracePeriodDeadline = new Date(
    Date.now() + gracePeriodHours * 60 * 60 * 1000
  );

  const getReversibilityLabel = (maxDays: number) => {
    if (maxDays >= 30) return '✅ Fully Reversible';
    if (maxDays >= 7) return '⚠️ Reversible (Limited)';
    return '🔒 Limited Reversal';
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-2xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-blue-600 to-blue-700 text-white p-6 border-b">
          <h2 className="text-2xl font-bold">Confirm {actionType}</h2>
          <p className="text-blue-100 mt-1">Review the simulation before confirming</p>
        </div>

        {/* Content */}
        <div className="p-6">
          {isLoading ? (
            <div className="flex justify-center items-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
              <span className="ml-3 text-gray-600">Simulating...</span>
            </div>
          ) : (
            <>
              {/* Summary */}
              <div className="mb-6 p-4 bg-blue-50 rounded-lg border-l-4 border-blue-600">
                <p className="text-lg font-semibold text-gray-800">{simulation.summary}</p>
              </div>

              {/* Before/After Comparison */}
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">Financial Impact</h3>
                <div className="grid grid-cols-2 gap-4">
                  {/* Before State */}
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <p className="text-sm font-semibold text-gray-600 uppercase mb-3">Before</p>
                    {Object.entries(simulation.beforeState).map(([key, value]) => (
                      <div key={key} className="flex justify-between text-sm text-gray-700 mb-2">
                        <span className="capitalize text-gray-600">{key.replace(/([A-Z])/g, ' $1')}</span>
                        <span className="font-medium">{formatValue(value)}</span>
                      </div>
                    ))}
                  </div>

                  {/* After State */}
                  <div className="p-4 bg-green-50 rounded-lg">
                    <p className="text-sm font-semibold text-gray-600 uppercase mb-3">After</p>
                    {Object.entries(simulation.afterState).map(([key, value]) => (
                      <div key={key} className="flex justify-between text-sm text-green-700 mb-2">
                        <span className="capitalize text-gray-600">{key.replace(/([A-Z])/g, ' $1')}</span>
                        <span className="font-medium">{formatValue(value)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Fees and Deltas */}
              <div className="mb-6 p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                <h4 className="font-semibold text-gray-800 mb-3">Fees & Charges</h4>
                <div className="space-y-2">
                  {Object.entries(simulation.delta).map(([key, value]) => (
                    <div key={key} className="flex justify-between text-sm">
                      <span className="text-gray-700">{key.replace(/([A-Z])/g, ' $1')}</span>
                      <span className={`font-semibold ${String(value).startsWith('-') ? 'text-red-600' : 'text-green-600'}`}>
                        {formatValue(value)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Risk Assessment */}
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-3">Risk Assessment</h3>

                {/* Risk Level Badge */}
                <div className="mb-4 p-3 rounded-lg flex items-center justify-between" 
                  style={{
                    backgroundColor: getRiskColor(simulation.riskLevel).bg,
                    borderLeft: `4px solid ${getRiskColor(simulation.riskLevel).border}`,
                  }}>
                  <span className="font-semibold" style={{ color: getRiskColor(simulation.riskLevel).text }}>
                    Risk Level: {simulation.riskLevel}
                  </span>
                  <span className="text-3xl">{getRiskEmoji(simulation.riskLevel)}</span>
                </div>

                {/* Risk Factors */}
                {simulation.riskFactors.length > 0 && (
                  <div className="mb-3">
                    <p className="text-sm font-semibold text-gray-700 mb-2">Risk Factors Detected:</p>
                    <ul className="space-y-1">
                      {simulation.riskFactors.map((factor: string, idx?: number) => (
                        <li key={idx} className="text-sm text-gray-600 flex items-start">
                          <span className="text-orange-500 mr-2">⚠️</span>
                          <span className="capitalize">{factor.replace(/-/g, ' ')}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Warnings */}
                {simulation.warnings.length > 0 && (
                  <div className="mb-3 p-3 bg-orange-50 rounded border border-orange-200">
                    <p className="text-sm font-semibold text-orange-800 mb-2">⚠️ Warnings:</p>
                    <ul className="space-y-1">
                      {simulation.warnings.map((warning: string, idx?: number) => (
                        <li key={idx} className="text-sm text-orange-700">{warning}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {/* Reversibility */}
              <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
                <h4 className="font-semibold text-gray-800 mb-3">
                  🔄 {getReversibilityLabel(maxGracePeriodDays)}
                </h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-700">Grace Period:</span>
                    <span className="font-semibold text-blue-600">
                      {gracePeriodHours}h (up to {maxGracePeriodDays}d)
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-700">Becomes Irreversible At:</span>
                    <span className="font-semibold text-blue-600">{gracePeriodDeadline.toLocaleString()}</span>
                  </div>
                </div>
              </div>

              {/* Affected Entities */}
              {simulation.affectedEntities && simulation.affectedEntities.length > 0 && (
                <div className="mb-6">
                  <h4 className="font-semibold text-gray-800 mb-3">Entities Affected</h4>
                  <div className="space-y-2">
                    {simulation.affectedEntities.map((entity: string, idx?: number) => (
                      <div key={idx || 0} className="p-3 bg-gray-50 rounded">
                        <p className="text-sm text-gray-600">{entity}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-gray-50 border-t p-6 flex gap-3 justify-end">
          <button
            onClick={onCancel}
            disabled={isLoading}
            className="px-6 py-2 rounded-lg border border-gray-300 text-gray-700 font-semibold hover:bg-gray-100 disabled:opacity-50 transition"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isLoading}
            className="px-6 py-2 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700 disabled:opacity-50 transition"
          >
            {isLoading ? 'Processing...' : 'Confirm & Execute'}
          </button>
        </div>
      </div>
    </div>
  );
};

// Helper Functions

function formatValue(value: any): string {
  if (typeof value === 'number') {
    if (value % 1 === 0) {
      return value.toLocaleString();
    }
    return value.toFixed(2);
  }
  if (typeof value === 'object') {
    if (Array.isArray(value)) return `[${value.length} items]`;
    return JSON.stringify(value);
  }
  return String(value);
}

function getRiskColor(risk: string) {
  switch (risk) {
    case 'LOW':
      return { bg: '#dcfce7', text: '#166534', border: '#22c55e' };
    case 'MEDIUM':
      return { bg: '#fef3c7', text: '#b45309', border: '#f59e0b' };
    case 'HIGH':
      return { bg: '#fee2e2', text: '#b91c1c', border: '#ef4444' };
    case 'CRITICAL':
      return { bg: '#fecaca', text: '#7f1d1d', border: '#dc2626' };
    default:
      return { bg: '#f3f4f6', text: '#374151', border: '#6b7280' };
  }
}

function getRiskEmoji(risk: string) {
  switch (risk) {
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
}
