/**
 * MultiAgentPanel.tsx (Week 2 Agent)
 * 
 * Multi-agent management and fleet coordination
 * Monitor, rebalance, and manage multiple autonomous agents
 */

import React, { useState } from 'react';
import SimulationResultModal from '../SimulationResultModal';
import { useSimulationPreview } from '../../hooks/useSimulationPreview';
import { SimulationResult } from '../../server/services/simulationFramework';

interface DeployedAgent {
  agentId: string;
  name: string;
  status: 'running' | 'paused' | 'stopped' | 'error';
  allocatedCapital: number;
  currentValue: number;
  monthlyPnL: number;
  lastExecuted: number;
  successRate: number;
}

interface MultiAgentOperationData {
  operationType: 'rebalance' | 'redistribute' | 'optimize' | 'pause-all' | 'sync';
  selectedAgents: string[];
  rebalanceThreshold: number;
  targetRatio: number;
  estimatedGain: number;
}

interface MultiAgentPanelProps {
  userId: string;
  deployedAgents?: DeployedAgent[];
  onOperationExecuted?: (result: any) => void;
}

/**
 * MultiAgentPanel Component
 * Manage and orchestrate multiple autonomous agents
 */
export const MultiAgentPanel: React.FC<MultiAgentPanelProps> = ({
  userId,
  deployedAgents = [],
  onOperationExecuted,
}) => {
  // Form state
  const [formData, setFormData] = useState<MultiAgentOperationData>({
    operationType: 'rebalance',
    selectedAgents: [],
    rebalanceThreshold: 10,
    targetRatio: 0.5,
    estimatedGain: 0,
  });

  const [selectAllAgents, setSelectAllAgents] = useState(false);
  const [operationMetrics, setOperationMetrics] = useState<{
    totalCapital: number;
    totalPnL: number;
    fleetROI: number;
    performanceRisk: number;
  }>({ totalCapital: 0, totalPnL: 0, fleetROI: 0, performanceRisk: 1 });

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
      console.log('Multi-agent operation simulation successful:', result);
    },
  });

  // Calculate fleet metrics
  const calculateFleetMetrics = () => {
    const selectedAgentList = formData.selectedAgents.length > 0
      ? deployedAgents.filter((a) => formData.selectedAgents.includes(a.agentId))
      : deployedAgents;

    if (selectedAgentList.length === 0) {
      setOperationMetrics({ totalCapital: 0, totalPnL: 0, fleetROI: 0, performanceRisk: 1 });
      return;
    }

    const totalCapital = selectedAgentList.reduce((sum, a) => sum + a.allocatedCapital, 0);
    const totalPnL = selectedAgentList.reduce((sum, a) => sum + a.monthlyPnL, 0);
    const avgSuccessRate = selectedAgentList.reduce((sum, a) => sum + a.successRate, 0) / selectedAgentList.length;
    const fleetROI = totalCapital > 0 ? (totalPnL / totalCapital) * 100 : 0;

    let riskScore = 1;
    if (selectedAgentList.some((a) => a.status === 'error')) riskScore += 3;
    if (selectedAgentList.filter((a) => a.status === 'running').length < selectedAgentList.length * 0.8) {
      riskScore += 2;
    }
    if (fleetROI < 0) riskScore += 2;

    setOperationMetrics({
      totalCapital,
      totalPnL,
      fleetROI,
      performanceRisk: Math.min(10, riskScore),
    });
  };

  // Handle agent selection
  const handleAgentToggle = (agentId: string) => {
    const newSelected = formData.selectedAgents.includes(agentId)
      ? formData.selectedAgents.filter((id) => id !== agentId)
      : [...formData.selectedAgents, agentId];

    setFormData({ ...formData, selectedAgents: newSelected });
  };

  // Handle select all
  const handleSelectAll = (checked: boolean) => {
    setSelectAllAgents(checked);
    if (checked) {
      setFormData({
        ...formData,
        selectedAgents: deployedAgents.map((a) => a.agentId),
      });
    } else {
      setFormData({ ...formData, selectedAgents: [] });
    }
  };

  // Handle preview operation
  const handlePreviewOperation = async (e: React.FormEvent) => {
    e.preventDefault();

    if (formData.selectedAgents.length === 0) {
      alert('Please select at least one agent');
      return;
    }

    calculateFleetMetrics();

    const selectedAgentList = deployedAgents.filter((a) =>
      formData.selectedAgents.includes(a.agentId)
    );

    /**
     * Run simulation
     */
    await runSimulation(
      'AGENT_COORDINATION',
      {
        userId,
        operationType: formData.operationType,
        selectedAgentCount: selectedAgentList.length,
        selectedAgents: selectedAgentList.map((a) => ({
          id: a.agentId,
          name: a.name,
          value: a.currentValue,
        })),
        fleetMetrics: operationMetrics,
        rebalanceThreshold: formData.rebalanceThreshold,
        targetRatio: formData.targetRatio,
        operationDescription:
          formData.operationType === 'rebalance'
            ? 'Rebalance portfolio allocations'
            : formData.operationType === 'redistribute'
              ? 'Redistribute capital among agents'
              : formData.operationType === 'optimize'
                ? 'Optimize fleet performance'
                : formData.operationType === 'pause-all'
                  ? 'Pause all selected agents'
                  : 'Synchronize agent strategies',
      },
      userId
    );
  };

  // Handle operation submission
  const handleSubmitOperation = async () => {
    try {
      const response = await fetch('/api/agents/coordinate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          operationType: formData.operationType,
          selectedAgents: formData.selectedAgents,
          rebalanceThreshold: formData.rebalanceThreshold,
          targetRatio: formData.targetRatio,
        }),
      });

      if (response.ok) {
        const result = await response.json();
        onOperationExecuted?.(result);
        resetState();
        setFormData({
          operationType: 'rebalance',
          selectedAgents: [],
          rebalanceThreshold: 10,
          targetRatio: 0.5,
          estimatedGain: 0,
        });
      }
    } catch (error) {
      console.error('Multi-agent operation failed:', error);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'running':
        return '#10b981';
      case 'paused':
        return '#f59e0b';
      case 'stopped':
        return '#6b7280';
      case 'error':
        return '#ef4444';
      default:
        return '#6b7280';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'running':
        return '🟢';
      case 'paused':
        return '🟡';
      case 'stopped':
        return '⚫';
      case 'error':
        return '🔴';
      default:
        return '⚪';
    }
  };

  if (!deployedAgents || deployedAgents.length === 0) {
    return (
      <div className="multi-agent-panel">
        <div className="panel-header">
          <h3>Fleet Management</h3>
        </div>
        <div className="empty-state">No agents deployed yet. Deploy agents first to manage fleet.</div>
      </div>
    );
  }

  const selectedAgentList = deployedAgents.filter((a) =>
    formData.selectedAgents.includes(a.agentId)
  );

  const totalFleetCapital = deployedAgents.reduce((sum, a) => sum + a.allocatedCapital, 0);
  const totalFleetValue = deployedAgents.reduce((sum, a) => sum + a.currentValue, 0);
  const totalFleetPnL = deployedAgents.reduce((sum, a) => sum + a.monthlyPnL, 0);

  return (
    <div className="multi-agent-panel">
      <div className="panel-header">
        <h3>Fleet Management</h3>
        <div className="header-info">
          <span className="fleet-stats">
            {deployedAgents.length} Agents | Total: ${totalFleetValue.toLocaleString()}
          </span>
        </div>
      </div>

      <form onSubmit={handlePreviewOperation} className="multi-agent-form">
        {/* Fleet Overview */}
        <div className="fleet-overview">
          <div className="overview-stat">
            <span className="label">Total Capital</span>
            <span className="value">${totalFleetCapital.toLocaleString()}</span>
          </div>
          <div className="overview-stat">
            <span className="label">Current Value</span>
            <span className="value">${totalFleetValue.toLocaleString()}</span>
          </div>
          <div className="overview-stat">
            <span className="label">Monthly PnL</span>
            <span className="value" style={{ color: totalFleetPnL > 0 ? '#10b981' : '#ef4444' }}>
              ${totalFleetPnL.toLocaleString()}
            </span>
          </div>
          <div className="overview-stat">
            <span className="label">ROI</span>
            <span
              className="value"
              style={{
                color:
                  (totalFleetPnL / totalFleetCapital) * 100 > 0
                    ? '#10b981'
                    : '#ef4444',
              }}
            >
              {((totalFleetPnL / totalFleetCapital) * 100).toFixed(2)}%
            </span>
          </div>
        </div>

        {/* Operation Type Selection */}
        <div className="form-group">
          <label>Operation Type</label>
          <div className="operation-buttons">
            {(
              [
                { id: 'rebalance', label: '⚖️ Rebalance', desc: 'Adjust allocations' },
                { id: 'redistribute', label: '🔄 Redistribute', desc: 'Move capital' },
                { id: 'optimize', label: '✨ Optimize', desc: 'Maximize returns' },
                { id: 'pause-all', label: '⏸ Pause All', desc: 'Stop operations' },
                { id: 'sync', label: '🔗 Sync', desc: 'Synchronize strategies' },
              ] as const
            ).map((op) => (
              <button
                key={op.id}
                type="button"
                onClick={() => setFormData({ ...formData, operationType: op.id })}
                className={`op-btn ${formData.operationType === op.id ? 'active' : ''}`}
                title={op.desc}
              >
                {op.label}
              </button>
            ))}
          </div>
        </div>

        {/* Agent Selection */}
        <div className="agent-selection">
          <div className="selection-header">
            <h4>Select Agents</h4>
            <label className="select-all">
              <input
                type="checkbox"
                checked={selectAllAgents}
                onChange={(e) => handleSelectAll(e.target.checked)}
              />
              Select All
            </label>
          </div>

          <div className="agents-list">
            {deployedAgents.map((agent) => (
              <div key={agent.agentId} className="agent-item">
                <label>
                  <input
                    type="checkbox"
                    checked={formData.selectedAgents.includes(agent.agentId)}
                    onChange={() => handleAgentToggle(agent.agentId)}
                  />
                  <span className="agent-checkbox-content">
                    <span className="agent-name">
                      {getStatusIcon(agent.status)} {agent.name}
                    </span>
                    <span className="agent-details">
                      ${agent.currentValue.toLocaleString()} | ROI:{' '}
                      {((agent.monthlyPnL / agent.allocatedCapital) * 100).toFixed(1)}%
                    </span>
                  </span>
                </label>
              </div>
            ))}
          </div>
        </div>

        {/* Conditional Configuration Based on Operation Type */}
        {(formData.operationType === 'rebalance' ||
          formData.operationType === 'redistribute') && (
          <>
            <div className="form-group">
              <label htmlFor="threshold">
                Rebalance Threshold: {formData.rebalanceThreshold}%
              </label>
              <input
                id="threshold"
                type="range"
                min="1"
                max="50"
                step="1"
                value={formData.rebalanceThreshold}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    rebalanceThreshold: parseInt(e.target.value),
                  })
                }
              />
              <small>
                Rebalance when allocation drifts more than {formData.rebalanceThreshold}%
              </small>
            </div>

            <div className="form-group">
              <label htmlFor="ratio">
                Target Capital Ratio: {(formData.targetRatio * 100).toFixed(0)}%
              </label>
              <input
                id="ratio"
                type="range"
                min="0.1"
                max="0.9"
                step="0.1"
                value={formData.targetRatio}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    targetRatio: parseFloat(e.target.value),
                  })
                }
              />
              <small>Percentage of capital to allocate to best-performing agent</small>
            </div>
          </>
        )}

        {/* Selected Agents Metrics */}
        {selectedAgentList.length > 0 && (
          <div className="selected-metrics">
            <h4>Selected Fleet Metrics</h4>
            <div className="metrics-grid">
              <div className="metric-item">
                <span className="metric-label">Total Capital</span>
                <span className="metric-value">
                  ${operationMetrics.totalCapital.toLocaleString()}
                </span>
              </div>
              <div className="metric-item">
                <span className="metric-label">Total PnL</span>
                <span
                  className="metric-value"
                  style={{
                    color: operationMetrics.totalPnL > 0 ? '#10b981' : '#ef4444',
                  }}
                >
                  ${operationMetrics.totalPnL.toLocaleString()}
                </span>
              </div>
              <div className="metric-item">
                <span className="metric-label">Fleet ROI</span>
                <span
                  className="metric-value"
                  style={{
                    color: operationMetrics.fleetROI > 0 ? '#10b981' : '#ef4444',
                  }}
                >
                  {operationMetrics.fleetROI.toFixed(2)}%
                </span>
              </div>
              <div className="metric-item">
                <span className="metric-label">Risk Score</span>
                <span
                  className="metric-value"
                  style={{
                    color:
                      operationMetrics.performanceRisk <= 5
                        ? '#10b981'
                        : operationMetrics.performanceRisk <= 8
                          ? '#f59e0b'
                          : '#ef4444',
                  }}
                >
                  {operationMetrics.performanceRisk}/10
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Risk Warning */}
        {operationMetrics.performanceRisk >= 7 && selectedAgentList.length > 0 && (
          <div className="warning-message">
            <span>⚠️ Fleet risk elevated. Review individual agent statuses before operating.</span>
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
            disabled={isLoading || formData.selectedAgents.length === 0}
            className="btn btn-primary"
          >
            {isLoading ? 'Analyzing...' : 'Preview Operation'}
          </button>
        </div>
      </form>

      {/* Simulation Result Modal */}
      <SimulationResultModal
        result={simulationResult}
        isOpen={isModalOpen}
        onClose={closeModal}
        onConfirm={handleSubmitOperation}
        confirmButtonText="Execute Operation"
      />
    </div>
  );
};

export default MultiAgentPanel;
