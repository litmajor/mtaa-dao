/**
 * ExecutionPanel.tsx (Week 2 Governance)
 * 
 * Proposal execution with timelock and risk assessment
 * Queue and execute passed proposals with safety checks
 */

import React, { useState, useEffect } from 'react';
import SimulationResultModal from '../SimulationResultModal';
import { useSimulationPreview } from '../../hooks/useSimulationPreview';
import { SimulationResult } from '../../server/services/simulationFramework';

interface QueuedProposal {
  proposalId: string;
  title: string;
  description: string;
  eta: number; // timestamp when execution becomes available
  executionRisk: number; // 1-10
  estimatedGasCost: number;
  executedCount: number;
}

interface ExecutionFormData {
  proposalId: string;
  executionMethod: 'standard' | 'multisig' | 'timelock';
  gasPriceGwei: number;
  maxGasUnits: number;
  allowanceFallback: boolean;
}

interface ExecutionPanelProps {
  userId: string;
  queuedProposals?: QueuedProposal[];
  onProposalExecuted?: (result: any) => void;
}

/**
 * ExecutionPanel Component
 * Execute queued governance proposals with timelock and safety
 */
export const ExecutionPanel: React.FC<ExecutionPanelProps> = ({
  userId,
  queuedProposals = [],
  onProposalExecuted,
}) => {
  // Form state
  const [formData, setFormData] = useState<ExecutionFormData>({
    proposalId: '',
    executionMethod: 'standard',
    gasPriceGwei: 50,
    maxGasUnits: 5000000,
    allowanceFallback: true,
  });

  const [selectedProposal, setSelectedProposal] = useState<QueuedProposal | null>(
    queuedProposals?.[0] || null
  );
  const [timeUntilExecution, setTimeUntilExecution] = useState<string>('');
  const [isExecutable, setIsExecutable] = useState<boolean>(false);
  const [estimatedCost, setEstimatedCost] = useState<number>(0);

  // Simulation state
  const {
    simulationResult,
    isLoading,
    isModalOpen,
    error,
    runSimulation,
    closeModal,
    resetState,
  } = useSimulationPreview({
    onSuccess: (result: SimulationResult) => {
      console.log('Execution simulation successful:', result);
    },
  });

  // Update execution metrics
  useEffect(() => {
    if (!selectedProposal) return;

    // Calculate time until execution eligible
    const now = Date.now() / 1000;
    const secondsUntil = Math.max(0, selectedProposal.eta - now);

    if (secondsUntil === 0) {
      setTimeUntilExecution('Ready to execute');
      setIsExecutable(true);
    } else {
      const days = Math.floor(secondsUntil / 86400);
      const hours = Math.floor((secondsUntil % 86400) / 3600);
      const minutes = Math.floor((secondsUntil % 3600) / 60);

      if (days > 0) {
        setTimeUntilExecution(`${days}d ${hours}h until execution`);
      } else if (hours > 0) {
        setTimeUntilExecution(`${hours}h ${minutes}m until execution`);
      } else {
        setTimeUntilExecution(`${minutes}m until execution`);
      }
      setIsExecutable(false);
    }

    // Calculate gas cost
    const totalCost = (formData.gasPriceGwei / 1e9) * formData.maxGasUnits * 1e-9;
    setEstimatedCost(totalCost);

    setFormData({ ...formData, proposalId: selectedProposal.proposalId });
  }, [selectedProposal, formData.gasPriceGwei, formData.maxGasUnits]);

  // Handle preview execution
  const handlePreviewExecution = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedProposal) {
      alert('Please select a proposal');
      return;
    }

    if (!isExecutable) {
      alert('Proposal is not yet executable. Please wait for the timelock to expire.');
      return;
    }

    const successChance = 95 - selectedProposal.executionRisk * 5;
    const failureScenarios = [];

    if (formData.maxGasUnits < 3000000) {
      failureScenarios.push('Gas limit too low for execution');
    }

    /**
     * Run simulation
     */
    await runSimulation(
      'GOVERNANCE_EXECUTE',
      {
        userId,
        proposalId: selectedProposal.proposalId,
        proposalTitle: selectedProposal.title,
        executionMethod: formData.executionMethod,
        eta: selectedProposal.eta,
        delayRemaining: Math.max(0, selectedProposal.eta - Date.now() / 1000),
        executionRisk: selectedProposal.executionRisk,
        estimatedGasCost: selectedProposal.estimatedGasCost,
        gasPriceGwei: formData.gasPriceGwei,
        maxGasUnits: formData.maxGasUnits,
        estimatedSuccessChance: successChance,
        failureScenarios,
        allowanceFallback: formData.allowanceFallback,
        priorExecutions: selectedProposal.executedCount,
      },
      userId
    );
  };

  // Handle execution submission
  const handleSubmitExecution = async () => {
    try {
      const response = await fetch('/api/governance/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          proposalId: selectedProposal?.proposalId,
          executionMethod: formData.executionMethod,
          gasPriceGwei: formData.gasPriceGwei,
          maxGasUnits: formData.maxGasUnits,
          allowanceFallback: formData.allowanceFallback,
        }),
      });

      if (response.ok) {
        onProposalExecuted?.(await response.json());
        resetState();
        setFormData({
          proposalId: '',
          executionMethod: 'standard',
          gasPriceGwei: 50,
          maxGasUnits: 5000000,
          allowanceFallback: true,
        });
      }
    } catch (error) {
      console.error('Execution failed:', error);
    }
  };

  const getRiskColor = (risk: number) => {
    if (risk <= 2) return '#10b981';
    if (risk <= 5) return '#f59e0b';
    if (risk <= 8) return '#ef4444';
    return '#991b1b';
  };

  const getRiskLabel = (risk: number) => {
    if (risk <= 2) return 'Low Risk';
    if (risk <= 5) return 'Medium Risk';
    if (risk <= 8) return 'High Risk';
    return 'Critical Risk';
  };

  if (!queuedProposals || queuedProposals.length === 0) {
    return (
      <div className="execution-panel">
        <div className="panel-header">
          <h3>Execute Proposals</h3>
        </div>
        <div className="empty-state">No proposals queued for execution.</div>
      </div>
    );
  }

  return (
    <div className="execution-panel">
      <div className="panel-header">
        <h3>Execute Proposal</h3>
        <div className="header-info">
          <span className="status-badge">
            {isExecutable ? '✅ Ready' : '⏱ Queued'}
          </span>
        </div>
      </div>

      <form onSubmit={handlePreviewExecution} className="execution-form">
        {/* Proposal Selection */}
        <div className="form-group">
          <label htmlFor="proposal">Select Proposal</label>
          <select
            id="proposal"
            onChange={(e) => {
              const props = queuedProposals.find((p) => p.proposalId === e.target.value);
              setSelectedProposal(props || null);
            }}
            value={selectedProposal?.proposalId || ''}
          >
            <option value="">Choose a proposal...</option>
            {queuedProposals.map((prop) => (
              <option key={prop.proposalId} value={prop.proposalId}>
                {prop.title.substring(0, 50)}...
              </option>
            ))}
          </select>
        </div>

        {selectedProposal && (
          <>
            {/* Timelock Status */}
            <div className={`timelock-status ${isExecutable ? 'ready' : 'waiting'}`}>
              <div className="status-icon">{isExecutable ? '✅' : '⏳'}</div>
              <div className="status-info">
                <span className="status-label">{timeUntilExecution}</span>
                <span className="status-detail">
                  {selectedProposal.executedCount > 0 && ` (executed ${selectedProposal.executedCount}x)`}
                </span>
              </div>
            </div>

            {/* Risk Assessment */}
            {/* eslint-disable-next-line react/style-prop-object */}
            <div
              className="execution-risk"
              style={{ borderLeftColor: getRiskColor(selectedProposal.executionRisk) }}
            >
              <div className="risk-item">
                <span>Execution Risk</span>
                {/* eslint-disable-next-line react/style-prop-object */}
                <span
                  className="risk-badge"
                  style={{ backgroundColor: getRiskColor(selectedProposal.executionRisk) }}
                >
                  {selectedProposal.executionRisk}/10 - {getRiskLabel(selectedProposal.executionRisk)}
                </span>
              </div>
            </div>

            {/* Execution Method */}
            <div className="form-group">
              <label>Execution Method</label>
              <div className="method-buttons">
                {(['standard', 'multisig', 'timelock'] as const).map((method) => (
                  <button
                    key={method}
                    type="button"
                    onClick={() => setFormData({ ...formData, executionMethod: method })}
                    className={`method-btn ${formData.executionMethod === method ? 'active' : ''}`}
                  >
                    {method === 'standard' && '🚀 Standard'}
                    {method === 'multisig' && '🔐 Multi-Sig'}
                    {method === 'timelock' && '⏲ Timelock'}
                  </button>
                ))}
              </div>
            </div>

            {/* Gas Price */}
            <div className="form-group">
              <label htmlFor="gasPrice">
                Gas Price: {formData.gasPriceGwei} Gwei
              </label>
              <input
                id="gasPrice"
                type="range"
                min="10"
                max="200"
                step="5"
                value={formData.gasPriceGwei}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    gasPriceGwei: parseInt(e.target.value),
                  })
                }
              />
            </div>

            {/* Max Gas Units */}
            <div className="form-group">
              <label htmlFor="maxGas">
                Max Gas Units: {formData.maxGasUnits.toLocaleString()}
              </label>
              <input
                id="maxGas"
                type="number"
                step="100000"
                min="1000000"
                max="30000000"
                value={formData.maxGasUnits}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    maxGasUnits: parseInt(e.target.value) || 5000000,
                  })
                }
              />
              <small>Estimated cost: ~{estimatedCost.toFixed(4)} ETH</small>
            </div>

            {/* Fallback Option */}
            <div className="form-group checkbox">
              <label htmlFor="fallback">
                <input
                  id="fallback"
                  type="checkbox"
                  checked={formData.allowanceFallback}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      allowanceFallback: e.target.checked,
                    })
                  }
                />
                Allow for allowance fallback if execution fails
              </label>
            </div>

            {/* Warning for unexecutable proposals */}
            {!isExecutable && (
              <div className="warning-message">
                <span>⏳ This proposal is not yet executable. Please wait for the timelock.</span>
              </div>
            )}

            {/* Warning for high-risk execution */}
            {selectedProposal.executionRisk >= 7 && (
              <div className="warning-message">
                <span>⚠️ High execution risk. Review proposal details before proceeding.</span>
              </div>
            )}

            {/* Error Display */}
            {error && (
              <div className="error-message">
                <span>⚠️ {error}</span>
              </div>
            )}

            {/* Buttons */}
            <div className="form-actions">
              <button
                type="submit"
                disabled={isLoading || !isExecutable}
                className="btn btn-primary"
              >
                {isLoading ? 'Analyzing...' : 'Preview Execution'}
              </button>
            </div>
          </>
        )}
      </form>

      {/* Simulation Result Modal */}
      <SimulationResultModal
        result={simulationResult}
        isOpen={isModalOpen}
        onClose={closeModal}
        onConfirm={handleSubmitExecution}
        confirmButtonText="Execute Proposal"
      />
    </div>
  );
};

export default ExecutionPanel;
