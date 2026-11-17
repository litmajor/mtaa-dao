/**
 * ParameterPanel.tsx (Week 2 Governance)
 * 
 * DAO parameter modification with impact analysis
 * Preview parameter changes before on-chain governance
 */

import React, { useState } from 'react';
import SimulationResultModal from '../SimulationResultModal';
import { useSimulationPreview } from '../../hooks/useSimulationPreview';
import { SimulationResult } from '../../server/services/simulationFramework';

interface DAOParameter {
  name: string;
  currentValue: string | number;
  category: 'governance' | 'economic' | 'security' | 'operations';
  description: string;
  minValue?: number;
  maxValue?: number;
  historicalValues: Array<{ value: string | number; changedAt: number }>;
}

interface ParameterFormData {
  parameterId: string;
  newValue: string | number;
  justification: string;
  votingThreshold: number; // Required vote percentage
  impactAnalysis: string;
}

interface ParameterPanelProps {
  userId: string;
  availableParameters?: DAOParameter[];
  onParameterChange?: (result: any) => void;
}

/**
 * ParameterPanel Component
 * Propose and analyze DAO parameter changes
 */
export const ParameterPanel: React.FC<ParameterPanelProps> = ({
  userId,
  availableParameters = [],
  onParameterChange,
}) => {
  // Form state
  const [formData, setFormData] = useState<ParameterFormData>({
    parameterId: '',
    newValue: '',
    justification: '',
    votingThreshold: 50,
    impactAnalysis: '',
  });

  const [selectedParameter, setSelectedParameter] = useState<DAOParameter | null>(
    availableParameters?.[0] || null
  );
  const [changePercentage, setChangePercentage] = useState<number>(0);
  const [riskAssessment, setRiskAssessment] = useState<{
    severity: 'low' | 'medium' | 'high' | 'critical';
    concerns: string[];
  }>({ severity: 'low', concerns: [] });

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
      console.log('Parameter change simulation successful:', result);
    },
  });

  // Analyze parameter change
  const analyzeChange = () => {
    if (!selectedParameter || !formData.newValue) return;

    const currentVal = parseFloat(String(selectedParameter.currentValue));
    const newVal = parseFloat(String(formData.newValue));

    if (isNaN(currentVal) || isNaN(newVal)) {
      setChangePercentage(0);
      return;
    }

    const percentChange = ((newVal - currentVal) / currentVal) * 100;
    setChangePercentage(percentChange);

    // Build risk assessment
    const concerns: string[] = [];
    let severity: 'low' | 'medium' | 'high' | 'critical' = 'low';

    // Check for extreme changes
    if (Math.abs(percentChange) > 100) {
      concerns.push('Extreme change (>100%) may destabilize protocol');
      severity = 'critical';
    } else if (Math.abs(percentChange) > 50) {
      concerns.push('Significant change (>50%) - careful analysis needed');
      if (severity === 'low') severity = 'high';
    } else if (Math.abs(percentChange) > 20) {
      concerns.push('Moderate change (>20%) - monitor closely');
      if (severity === 'low') severity = 'medium';
    }

    // Category-specific concerns
    if (selectedParameter.category === 'security') {
      severity = 'critical';
      concerns.push('Security parameter - highest scrutiny required');
    } else if (selectedParameter.category === 'economic') {
      if (percentChange < 0) {
        concerns.push('Decreasing yields may reduce participation');
      }
    }

    setRiskAssessment({ severity, concerns });
  };

  // Handle preview change
  const handlePreviewChange = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedParameter) {
      alert('Please select a parameter');
      return;
    }

    if (!formData.newValue) {
      alert('Please enter a new value');
      return;
    }

    if (!formData.justification.trim()) {
      alert('Please provide justification for this change');
      return;
    }

    analyzeChange();

    // Get historical trend
    const historicalTrend =
      selectedParameter.historicalValues.length > 1
        ? selectedParameter.historicalValues[selectedParameter.historicalValues.length - 1]
            .value !== selectedParameter.currentValue
          ? 'increasing'
          : 'stable'
        : 'new';

    /**
     * Run simulation
     */
    await runSimulation(
      'GOVERNANCE_PARAMETER',
      {
        userId,
        parameterId: selectedParameter.name,
        parameterCategory: selectedParameter.category,
        currentValue: selectedParameter.currentValue,
        proposedValue: formData.newValue,
        changePercentage,
        historicalTrend,
        riskSeverity: riskAssessment.severity,
        riskConcerns: riskAssessment.concerns,
        votingThreshold: formData.votingThreshold,
        justification: formData.justification,
        impactLevel: Math.abs(changePercentage) > 50 ? 'high' : 'medium',
      },
      userId
    );
  };

  // Handle parameter change submission
  const handleSubmitChange = async () => {
    try {
      const response = await fetch('/api/governance/parameters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          parameterId: selectedParameter?.name,
          newValue: formData.newValue,
          justification: formData.justification,
          votingThreshold: formData.votingThreshold,
        }),
      });

      if (response.ok) {
        const result = await response.json();
        onParameterChange?.(result);
        resetState();
        setFormData({
          parameterId: '',
          newValue: '',
          justification: '',
          votingThreshold: 50,
          impactAnalysis: '',
        });
      }
    } catch (error) {
      console.error('Parameter change submission failed:', error);
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'governance':
        return '#6366f1';
      case 'economic':
        return '#10b981';
      case 'security':
        return '#ef4444';
      case 'operations':
        return '#3b82f6';
      default:
        return '#6b7280';
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'low':
        return '#10b981';
      case 'medium':
        return '#f59e0b';
      case 'high':
        return '#ef4444';
      case 'critical':
        return '#991b1b';
      default:
        return '#6b7280';
    }
  };

  if (!availableParameters || availableParameters.length === 0) {
    return (
      <div className="parameter-panel">
        <div className="panel-header">
          <h3>DAO Parameters</h3>
        </div>
        <div className="empty-state">No parameters available for modification.</div>
      </div>
    );
  }

  return (
    <div className="parameter-panel">
      <div className="panel-header">
        <h3>Modify Parameter</h3>
        <div className="header-info">
          <span className="param-count">{availableParameters.length} parameters</span>
        </div>
      </div>

      <form onSubmit={handlePreviewChange} className="parameter-form">
        {/* Parameter Selection */}
        <div className="form-group">
          <label htmlFor="parameter">Select Parameter</label>
          <select
            id="parameter"
            onChange={(e) => {
              const param = availableParameters.find((p) => p.name === e.target.value);
              setSelectedParameter(param || null);
              setFormData({ ...formData, parameterId: e.target.value });
            }}
            value={selectedParameter?.name || ''}
          >
            <option value="">Choose a parameter...</option>
            {availableParameters.map((param) => (
              <option key={param.name} value={param.name}>
                {param.name} ({param.category})
              </option>
            ))}
          </select>
        </div>

        {selectedParameter && (
          <>
            {/* Parameter Info */}
            <div className="parameter-info">
              <div className="info-item">
                <span className="label">Category</span>
                <span
                  className="category-badge"
                  style={{ backgroundColor: getCategoryColor(selectedParameter.category) }}
                >
                  {selectedParameter.category}
                </span>
              </div>
              <div className="info-item">
                <span className="label">Current Value</span>
                <span className="value">{selectedParameter.currentValue}</span>
              </div>
              <div className="info-item">
                <span className="label">Description</span>
                <span className="description">{selectedParameter.description}</span>
              </div>
            </div>

            {/* New Value Input */}
            <div className="form-group">
              <label htmlFor="newValue">New Value</label>
              {selectedParameter.minValue !== undefined &&
              selectedParameter.maxValue !== undefined ? (
                <input
                  id="newValue"
                  type="range"
                  min={selectedParameter.minValue}
                  max={selectedParameter.maxValue}
                  step="1"
                  value={formData.newValue || selectedParameter.minValue}
                  onChange={(e) => {
                    setFormData({ ...formData, newValue: e.target.value });
                    analyzeChange();
                  }}
                />
              ) : (
                <input
                  id="newValue"
                  type="text"
                  placeholder="Enter new value"
                  value={formData.newValue}
                  onChange={(e) => {
                    setFormData({ ...formData, newValue: e.target.value });
                    analyzeChange();
                  }}
                />
              )}
              {changePercentage !== 0 && (
                <small
                  style={{
                    color:
                      changePercentage > 0
                        ? '#ef4444'
                        : '#10b981',
                  }}
                >
                  {changePercentage > 0 ? '📈' : '📉'} {changePercentage.toFixed(1)}% change
                </small>
              )}
            </div>

            {/* Justification */}
            <div className="form-group">
              <label htmlFor="justification">Justification</label>
              <textarea
                id="justification"
                placeholder="Explain why this parameter should change..."
                value={formData.justification}
                onChange={(e) => setFormData({ ...formData, justification: e.target.value })}
                rows={4}
              />
            </div>

            {/* Voting Threshold */}
            <div className="form-group">
              <label htmlFor="threshold">
                Voting Threshold: {formData.votingThreshold}%
              </label>
              <input
                id="threshold"
                type="range"
                min="25"
                max="100"
                step="5"
                value={formData.votingThreshold}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    votingThreshold: parseInt(e.target.value),
                  })
                }
              />
              <small>Required vote percentage to approve this change</small>
            </div>

            {/* Risk Assessment */}
            {riskAssessment.concerns.length > 0 && (
              <div className="risk-assessment">
                <div className="assessment-header">
                  <span>Risk Assessment</span>
                  <span
                    className="severity-badge"
                    style={{ backgroundColor: getSeverityColor(riskAssessment.severity) }}
                  >
                    {riskAssessment.severity.toUpperCase()}
                  </span>
                </div>
                <ul className="concerns-list">
                  {riskAssessment.concerns.map((concern, idx) => (
                    <li key={idx}>⚠️ {concern}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Historical Context */}
            {selectedParameter.historicalValues.length > 0 && (
              <div className="historical-info">
                <span className="label">Last 3 Changes:</span>
                <div className="history-items">
                  {selectedParameter.historicalValues.slice(-3).map((hist, idx) => (
                    <span key={idx} className="history-item">
                      {hist.value}
                    </span>
                  ))}
                </div>
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
                  !formData.newValue ||
                  !formData.justification.trim()
                }
                className="btn btn-primary"
              >
                {isLoading ? 'Analyzing...' : 'Preview Change'}
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
        onConfirm={handleSubmitChange}
        confirmButtonText="Propose Parameter Change"
      />
    </div>
  );
};

export default ParameterPanel;
