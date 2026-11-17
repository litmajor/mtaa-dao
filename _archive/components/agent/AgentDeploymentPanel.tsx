/**
 * AgentDeploymentPanel.tsx (Week 2 Agent)
 * 
 * Autonomous agent deployment with configuration and risk assessment
 * Deploy and monitor individual DAO agents
 */

import React, { useState } from 'react';
import SimulationResultModal from '../SimulationResultModal';
import { useSimulationPreview } from '../../hooks/useSimulationPreview';
import { SimulationResult } from '../../server/services/simulationFramework';

interface AgentTemplate {
  templateId: string;
  name: string;
  description: string;
  category: 'trading' | 'treasury' | 'monitoring' | 'rebalancing';
  requiredCapital: number;
  estimatedGasPerTx: number;
  successRate: number;
  complexity: 1 | 2 | 3 | 4 | 5;
}

interface DeploymentFormData {
  templateId: string;
  agentName: string;
  allocatedCapital: number;
  maxDailyLoss: number;
  executionFrequency: string; // 'hourly' | 'daily' | 'weekly'
  riskTolerance: 'low' | 'medium' | 'high';
  targetYield: number;
  enableAutoRebalance: boolean;
  enableEmergencyStop: boolean;
}

interface AgentDeploymentPanelProps {
  userId: string;
  availableTemplates?: AgentTemplate[];
  onAgentDeployed?: (result: any) => void;
}

/**
 * AgentDeploymentPanel Component
 * Deploy autonomous agents with custom configuration
 */
export const AgentDeploymentPanel: React.FC<AgentDeploymentPanelProps> = ({
  userId,
  availableTemplates = [],
  onAgentDeployed,
}) => {
  // Form state
  const [formData, setFormData] = useState<DeploymentFormData>({
    templateId: '',
    agentName: '',
    allocatedCapital: 10000,
    maxDailyLoss: 500,
    executionFrequency: 'daily',
    riskTolerance: 'medium',
    targetYield: 10,
    enableAutoRebalance: true,
    enableEmergencyStop: true,
  });

  const [selectedTemplate, setSelectedTemplate] = useState<AgentTemplate | null>(
    availableTemplates?.[0] || null
  );
  const [agentMetrics, setAgentMetrics] = useState<{
    costPerExecution: number;
    monthlyEstimatedCost: number;
    estimatedROI: number;
    deploymentRisk: number;
  }>({ costPerExecution: 0, monthlyEstimatedCost: 0, estimatedROI: 0, deploymentRisk: 1 });

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
      console.log('Agent deployment simulation successful:', result);
    },
  });

  // Calculate deployment metrics
  const calculateMetrics = () => {
    if (!selectedTemplate) return;

    const executionsPerMonth =
      formData.executionFrequency === 'hourly'
        ? 24 * 30
        : formData.executionFrequency === 'daily'
          ? 30
          : 4;

    const costPerExecution = selectedTemplate.estimatedGasPerTx * 0.001; // Simplified gas cost
    const monthlyEstimatedCost = costPerExecution * executionsPerMonth;
    const estimatedROI = (formData.targetYield / 100) * formData.allocatedCapital - monthlyEstimatedCost;

    // Risk calculation
    let riskScore = 1;
    if (formData.riskTolerance === 'medium') riskScore = 5;
    if (formData.riskTolerance === 'high') riskScore = 8;
    if (selectedTemplate.complexity > 3) riskScore += 2;
    if (formData.allocatedCapital > 50000) riskScore += 1;

    setAgentMetrics({
      costPerExecution,
      monthlyEstimatedCost,
      estimatedROI,
      deploymentRisk: Math.min(10, riskScore),
    });
  };

  // Handle preview deployment
  const handlePreviewDeployment = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedTemplate) {
      alert('Please select an agent template');
      return;
    }

    if (!formData.agentName.trim()) {
      alert('Please provide an agent name');
      return;
    }

    calculateMetrics();

    /**
     * Run simulation
     */
    await runSimulation(
      'AGENT_DEPLOYMENT',
      {
        userId,
        agentName: formData.agentName,
        templateId: selectedTemplate.templateId,
        templateName: selectedTemplate.name,
        category: selectedTemplate.category,
        allocatedCapital: formData.allocatedCapital,
        maxDailyLoss: formData.maxDailyLoss,
        executionFrequency: formData.executionFrequency,
        riskTolerance: formData.riskTolerance,
        targetYield: formData.targetYield,
        enableAutoRebalance: formData.enableAutoRebalance,
        enableEmergencyStop: formData.enableEmergencyStop,
        templateSuccessRate: selectedTemplate.successRate,
        estimatedMetrics: agentMetrics,
        deploymentRisk: agentMetrics.deploymentRisk,
      },
      userId
    );
  };

  // Handle deployment submission
  const handleSubmitDeployment = async () => {
    try {
      const response = await fetch('/api/agents/deploy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          agentName: formData.agentName,
          templateId: selectedTemplate?.templateId,
          allocatedCapital: formData.allocatedCapital,
          maxDailyLoss: formData.maxDailyLoss,
          executionFrequency: formData.executionFrequency,
          riskTolerance: formData.riskTolerance,
          targetYield: formData.targetYield,
          enableAutoRebalance: formData.enableAutoRebalance,
          enableEmergencyStop: formData.enableEmergencyStop,
        }),
      });

      if (response.ok) {
        const result = await response.json();
        onAgentDeployed?.(result);
        resetState();
        setFormData({
          templateId: '',
          agentName: '',
          allocatedCapital: 10000,
          maxDailyLoss: 500,
          executionFrequency: 'daily',
          riskTolerance: 'medium',
          targetYield: 10,
          enableAutoRebalance: true,
          enableEmergencyStop: true,
        });
      }
    } catch (error) {
      console.error('Agent deployment failed:', error);
    }
  };

  const getRiskColor = (risk: number) => {
    if (risk <= 2) return '#10b981';
    if (risk <= 5) return '#f59e0b';
    if (risk <= 8) return '#ef4444';
    return '#991b1b';
  };

  if (!availableTemplates || availableTemplates.length === 0) {
    return (
      <div className="agent-deployment-panel">
        <div className="panel-header">
          <h3>Deploy Agent</h3>
        </div>
        <div className="empty-state">No agent templates available.</div>
      </div>
    );
  }

  return (
    <div className="agent-deployment-panel">
      <div className="panel-header">
        <h3>Deploy Agent</h3>
        <div className="header-info">
          <span className="template-count">{availableTemplates.length} templates</span>
        </div>
      </div>

      <form onSubmit={handlePreviewDeployment} className="deployment-form">
        {/* Agent Template Selection */}
        <div className="form-group">
          <label htmlFor="template">Agent Template</label>
          <select
            id="template"
            onChange={(e) => {
              const template = availableTemplates.find((t) => t.templateId === e.target.value);
              setSelectedTemplate(template || null);
              setFormData({ ...formData, templateId: e.target.value });
            }}
            value={selectedTemplate?.templateId || ''}
          >
            <option value="">Choose a template...</option>
            {availableTemplates.map((template) => (
              <option key={template.templateId} value={template.templateId}>
                {template.name} (Complexity: {template.complexity}/5)
              </option>
            ))}
          </select>
        </div>

        {selectedTemplate && (
          <>
            {/* Template Info Card */}
            <div className="template-info-card">
              <div className="info-item">
                <span className="label">Category</span>
                <span className="value">{selectedTemplate.category}</span>
              </div>
              <div className="info-item">
                <span className="label">Description</span>
                <span className="value">{selectedTemplate.description}</span>
              </div>
              <div className="info-item">
                <span className="label">Min Capital</span>
                <span className="value">${selectedTemplate.requiredCapital.toLocaleString()}</span>
              </div>
              <div className="info-item">
                <span className="label">Success Rate</span>
                <span className="value" style={{ color: '#10b981' }}>
                  {(selectedTemplate.successRate * 100).toFixed(1)}%
                </span>
              </div>
            </div>

            {/* Agent Name */}
            <div className="form-group">
              <label htmlFor="name">Agent Name</label>
              <input
                id="name"
                type="text"
                placeholder="e.g., TradingBot-001"
                value={formData.agentName}
                onChange={(e) => setFormData({ ...formData, agentName: e.target.value })}
                maxLength={50}
              />
              <small>{formData.agentName.length} / 50 characters</small>
            </div>

            {/* Allocated Capital */}
            <div className="form-group">
              <label htmlFor="capital">
                Allocated Capital: ${formData.allocatedCapital.toLocaleString()}
              </label>
              <input
                id="capital"
                type="range"
                min={selectedTemplate.requiredCapital}
                max="1000000"
                step="1000"
                value={formData.allocatedCapital}
                onChange={(e) => {
                  setFormData({ ...formData, allocatedCapital: parseInt(e.target.value) });
                  calculateMetrics();
                }}
              />
              <small>
                {formData.allocatedCapital < selectedTemplate.requiredCapital
                  ? `❌ Minimum: $${selectedTemplate.requiredCapital.toLocaleString()}`
                  : '✅ Sufficient capital'}
              </small>
            </div>

            {/* Max Daily Loss */}
            <div className="form-group">
              <label htmlFor="loss">
                Max Daily Loss: ${formData.maxDailyLoss.toLocaleString()}
              </label>
              <input
                id="loss"
                type="range"
                min="0"
                max={Math.floor(formData.allocatedCapital * 0.1)}
                step="100"
                value={formData.maxDailyLoss}
                onChange={(e) => setFormData({ ...formData, maxDailyLoss: parseInt(e.target.value) })}
              />
              <small>
                {(
                  (formData.maxDailyLoss / formData.allocatedCapital) *
                  100
                ).toFixed(1)}% of allocated capital
              </small>
            </div>

            {/* Execution Frequency */}
            <div className="form-group">
              <label>Execution Frequency</label>
              <div className="frequency-buttons">
                {(['hourly', 'daily', 'weekly'] as const).map((freq) => (
                  <button
                    key={freq}
                    type="button"
                    onClick={() => {
                      setFormData({ ...formData, executionFrequency: freq });
                      calculateMetrics();
                    }}
                    className={`freq-btn ${formData.executionFrequency === freq ? 'active' : ''}`}
                  >
                    {freq === 'hourly' && '⚡ Hourly'}
                    {freq === 'daily' && '📅 Daily'}
                    {freq === 'weekly' && '📆 Weekly'}
                  </button>
                ))}
              </div>
            </div>

            {/* Risk Tolerance */}
            <div className="form-group">
              <label>Risk Tolerance</label>
              <div className="risk-buttons">
                {(['low', 'medium', 'high'] as const).map((risk) => (
                  <button
                    key={risk}
                    type="button"
                    onClick={() => {
                      setFormData({ ...formData, riskTolerance: risk });
                      calculateMetrics();
                    }}
                    className={`risk-btn ${formData.riskTolerance === risk ? 'active' : ''}`}
                  >
                    {risk === 'low' && '🛡️ Low'}
                    {risk === 'medium' && '⚖️ Medium'}
                    {risk === 'high' && '⚡ High'}
                  </button>
                ))}
              </div>
            </div>

            {/* Target Yield */}
            <div className="form-group">
              <label htmlFor="yield">
                Target Annual Yield: {formData.targetYield}%
              </label>
              <input
                id="yield"
                type="range"
                min="1"
                max="100"
                step="1"
                value={formData.targetYield}
                onChange={(e) => {
                  setFormData({ ...formData, targetYield: parseInt(e.target.value) });
                  calculateMetrics();
                }}
              />
            </div>

            {/* Safety Toggles */}
            <div className="form-group checkbox-group">
              <label htmlFor="autorebalance">
                <input
                  id="autorebalance"
                  type="checkbox"
                  checked={formData.enableAutoRebalance}
                  onChange={(e) =>
                    setFormData({ ...formData, enableAutoRebalance: e.target.checked })
                  }
                />
                Enable automatic rebalancing
              </label>

              <label htmlFor="emergencystop">
                <input
                  id="emergencystop"
                  type="checkbox"
                  checked={formData.enableEmergencyStop}
                  onChange={(e) =>
                    setFormData({ ...formData, enableEmergencyStop: e.target.checked })
                  }
                />
                Enable emergency stop on max loss
              </label>
            </div>

            {/* Deployment Metrics */}
            <div className="metrics-grid">
              <div className="metric-card">
                <span className="metric-label">Cost per Execution</span>
                <span className="metric-value">${agentMetrics.costPerExecution.toFixed(2)}</span>
              </div>
              <div className="metric-card">
                <span className="metric-label">Monthly Cost</span>
                <span className="metric-value">${agentMetrics.monthlyEstimatedCost.toFixed(2)}</span>
              </div>
              <div className="metric-card">
                <span className="metric-label">Est. Monthly ROI</span>
                <span
                  className="metric-value"
                  style={{ color: agentMetrics.estimatedROI > 0 ? '#10b981' : '#ef4444' }}
                >
                  ${agentMetrics.estimatedROI.toFixed(2)}
                </span>
              </div>
              <div className="metric-card">
                <span className="metric-label">Deployment Risk</span>
                <span
                  className="metric-value"
                  style={{ color: getRiskColor(agentMetrics.deploymentRisk) }}
                >
                  {agentMetrics.deploymentRisk}/10
                </span>
              </div>
            </div>

            {/* Risk Warning */}
            {agentMetrics.deploymentRisk >= 7 && (
              <div className="warning-message">
                <span>⚠️ High-risk deployment. Monitor closely during initial operations.</span>
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
                disabled={
                  isLoading ||
                  !formData.agentName.trim() ||
                  formData.allocatedCapital < (selectedTemplate?.requiredCapital || 0)
                }
                className="btn btn-primary"
              >
                {isLoading ? 'Analyzing...' : 'Preview Deployment'}
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
        onConfirm={handleSubmitDeployment}
        confirmButtonText="Deploy Agent"
      />
    </div>
  );
};

export default AgentDeploymentPanel;
