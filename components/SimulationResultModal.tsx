/**
 * SimulationResultModal.tsx
 * 
 * Reusable modal component for displaying simulation results
 * Used across all simulators for consistent risk presentation
 */

import React, { useState } from 'react';
import { SimulationResult, SimulationStatus } from '../../server/services/simulationFramework';
import './SimulationResultModal.css';

interface SimulationResultModalProps {
  /** Simulation result to display */
  result: SimulationResult | null;

  /** Show/hide modal */
  isOpen: boolean;

  /** Close modal handler */
  onClose: () => void;

  /** Confirm action (execute despite risks) */
  onConfirm?: () => void | Promise<void>;

  /** Cancel action */
  onCancel?: () => void;

  /** Action button text (default: "Proceed") */
  confirmButtonText?: string;

  /** Whether to allow proceeding with CRITICAL risk */
  allowCriticalRisk?: boolean;

  /** Loading state for confirm button */
  isConfirming?: boolean;
}

/**
 * Risk level color mapping
 */
const RISK_COLORS = {
  LOW: '#10b981',      // Green
  MEDIUM: '#f59e0b',   // Amber
  HIGH: '#ef4444',     // Red
  CRITICAL: '#7c2d12', // Dark red
};

/**
 * Risk level badge styling
 */
const getRiskBadgeClass = (riskLevel: string): string => {
  const baseClass = 'risk-badge';
  return `${baseClass} risk-${riskLevel.toLowerCase()}`;
};

/**
 * Format large numbers with commas
 */
const formatNumber = (num: number): string => {
  if (typeof num !== 'number') return String(num);
  return num.toLocaleString('en-US', {
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
  });
};

/**
 * SimulationResultModal Component
 */
export const SimulationResultModal: React.FC<SimulationResultModalProps> = ({
  result,
  isOpen,
  onClose,
  onConfirm,
  onCancel,
  confirmButtonText = 'Proceed',
  allowCriticalRisk = false,
  isConfirming = false,
}) => {
  const [showDetails, setShowDetails] = useState(false);

  if (!isOpen || !result) {
    return null;
  }

  const canProceed =
    result.status === SimulationStatus.SUCCESS ||
    (result.status === SimulationStatus.WARNING && result.riskLevel !== 'CRITICAL') ||
    (result.status === SimulationStatus.WARNING &&
      result.riskLevel === 'CRITICAL' &&
      allowCriticalRisk);

  const handleConfirm = async () => {
    if (canProceed && onConfirm) {
      try {
        await onConfirm();
      } catch (error) {
        console.error('Error during confirmation:', error);
      }
    }
  };

  return (
    <div className="simulation-modal-overlay">
      <div className="simulation-modal">
        {/* Header */}
        <div className="modal-header">
          <h2>Simulation Results</h2>
          <button
            className="close-button"
            onClick={onClose}
            aria-label="Close modal"
          >
            ✕
          </button>
        </div>

        {/* Risk Banner */}
        <div className="risk-banner" style={{ borderLeftColor: RISK_COLORS[result.riskLevel as keyof typeof RISK_COLORS] }}>
          <div className="risk-content">
            <div className="risk-header">
              <span className={getRiskBadgeClass(result.riskLevel)}>
                {result.riskLevel} RISK
              </span>
              <span className="status-badge" data-status={result.status}>
                {result.status}
              </span>
            </div>

            {result.summary && (
              <p className="risk-summary">{result.summary}</p>
            )}
          </div>
        </div>

        {/* Main Content */}
        <div className="modal-content">
          {/* Key Metrics */}
          <section className="metrics-section">
            <h3>Simulation Details</h3>
            <div className="metrics-grid">
              <div className="metric">
                <label>Depth</label>
                <span className="metric-value">{result.depth}</span>
              </div>

              {result.executionTimeMs && (
                <div className="metric">
                  <label>Execution Time</label>
                  <span className="metric-value">{result.executionTimeMs}ms</span>
                </div>
              )}

              {result.timestamp && (
                <div className="metric">
                  <label>Timestamp</label>
                  <span className="metric-value">
                    {new Date(result.timestamp).toLocaleTimeString()}
                  </span>
                </div>
              )}
            </div>
          </section>

          {/* Risk Factors */}
          {result.riskFactors && result.riskFactors.length > 0 && (
            <section className="risks-section">
              <h3>Risk Factors</h3>
              <ul className="risk-factors">
                {result.riskFactors.map((factor: string, idx: number) => (
                  <li key={idx} className="risk-factor">
                    <span className="risk-indicator">⚠</span>
                    {factor}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Warnings */}
          {result.warnings && result.warnings.length > 0 && (
            <section className="warnings-section">
              <h3>Warnings</h3>
              <ul className="warnings-list">
                {result.warnings.map((warning: string, idx: number) => (
                  <li key={idx} className="warning-item">
                    <span className="warning-icon">⚠️</span>
                    {warning}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Errors */}
          {result.errors && result.errors.length > 0 && (
            <section className="errors-section">
              <h3>Errors</h3>
              <ul className="errors-list">
                {result.errors.map((error: string, idx: number) => (
                  <li key={idx} className="error-item">
                    <span className="error-icon">❌</span>
                    {error}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Reversibility */}
          {result.reversibilityWindow && (
            <section className="reversibility-section">
              <h3>Grace Period</h3>
              <div className="reversibility-info">
                <p>
                  <strong>Min Grace Period:</strong>{' '}
                  {result.reversibilityWindow.minGracePeriodHours} hours
                </p>
                <p>
                  <strong>Recommended:</strong>{' '}
                  {result.reversibilityWindow.recommendedGracePeriodHours} hours
                </p>
                <p>
                  <strong>Max Grace Period:</strong>{' '}
                  {result.reversibilityWindow.maxGracePeriodDays} days
                </p>
              </div>
            </section>
          )}

          {/* Details Toggle */}
          <button
            className="details-toggle"
            onClick={() => setShowDetails(!showDetails)}
          >
            {showDetails ? '▼' : '▶'} Advanced Details
          </button>

          {showDetails && (
            <section className="details-section">
              <h3>Simulation Data</h3>

              {/* Before State */}
              {result.beforeState && (
                <div className="state-block">
                  <h4>Before State</h4>
                  <pre className="code-block">
                    {JSON.stringify(result.beforeState, null, 2)}
                  </pre>
                </div>
              )}

              {/* After State */}
              {result.afterState && (
                <div className="state-block">
                  <h4>After State</h4>
                  <pre className="code-block">
                    {JSON.stringify(result.afterState, null, 2)}
                  </pre>
                </div>
              )}

              {/* Delta */}
              {result.delta && (
                <div className="state-block">
                  <h4>Changes (Delta)</h4>
                  <pre className="code-block">
                    {JSON.stringify(result.delta, null, 2)}
                  </pre>
                </div>
              )}

              {/* Simulation Data */}
              {result.simulationData && (
                <div className="state-block">
                  <h4>Simulation Metrics</h4>
                  <pre className="code-block">
                    {JSON.stringify(result.simulationData, null, 2)}
                  </pre>
                </div>
              )}

              {/* Impacted Entities */}
              {result.impactedEntities && result.impactedEntities.length > 0 && (
                <div className="entities-block">
                  <h4>Impacted Entities</h4>
                  <table className="entities-table">
                    <thead>
                      <tr>
                        <th>Type</th>
                        <th>ID</th>
                        <th>Impact</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.impactedEntities.map((entity: any, idx: number) => (
                        <tr key={idx}>
                          <td>{entity.type}</td>
                          <td className="entity-id">{entity.id}</td>
                          <td>{entity.impact}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          )}
        </div>

        {/* Action Buttons */}
        <div className="modal-actions">
          <button
            className="btn btn-secondary"
            onClick={() => {
              onCancel?.();
              onClose();
            }}
            disabled={isConfirming}
          >
            Cancel
          </button>

          <button
            className={`btn btn-primary ${
              canProceed ? 'enabled' : 'disabled'
            }`}
            onClick={handleConfirm}
            disabled={!canProceed || isConfirming}
          >
            {isConfirming ? 'Processing...' : confirmButtonText}
          </button>

          {result.riskLevel === 'CRITICAL' && !allowCriticalRisk && (
            <div className="critical-warning">
              CRITICAL risks must be approved before proceeding
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SimulationResultModal;
