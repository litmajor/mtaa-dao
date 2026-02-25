/**
 * ProposalPanel.tsx (Week 2 Governance)
 * 
 * DAO Proposal creation and submission with risk analysis
 * Simulate proposal outcomes before on-chain voting
 */

import React, { useState } from 'react';
import SimulationResultModal from '../SimulationResultModal';
import { useSimulationPreview } from '../../hooks/useSimulationPreview';
import { SimulationResult } from '../../server/services/simulationFramework';

interface ProposalFormData {
  title: string;
  description: string;
  proposalType: 'text' | 'parameter' | 'spending' | 'upgrade';
  votingPeriodDays: number;
  proposalThreshold: number; // Tokens required to propose
  executionDelay: number; // Days before execution
  estimatedImpact: 'low' | 'medium' | 'high' | 'critical';
}

interface ProposalPanelProps {
  userId: string;
  daoName?: string;
  onProposalSubmitted?: (result: any) => void;
}

/**
 * ProposalPanel Component
 * DAO proposal creation with analysis and preview
 */
export const ProposalPanel: React.FC<ProposalPanelProps> = ({
  userId,
  daoName = 'DAO',
  onProposalSubmitted,
}) => {
  // Form state
  const [formData, setFormData] = useState<ProposalFormData>({
    title: '',
    description: '',
    proposalType: 'text',
    votingPeriodDays: 7,
    proposalThreshold: 5000,
    executionDelay: 1,
    estimatedImpact: 'low',
  });

  const [wordCount, setWordCount] = useState<number>(0);
  const [riskScore, setRiskScore] = useState<number>(1);

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
      console.log('Proposal simulation successful:', result);
    },
  });

  // Calculate metrics
  const calculateMetrics = () => {
    const words = formData.description.split(/\s+/).length;
    setWordCount(words);

    // Calculate risk score based on impact and parameters
    let score = 1;
    if (formData.estimatedImpact === 'medium') score = 3;
    if (formData.estimatedImpact === 'high') score = 6;
    if (formData.estimatedImpact === 'critical') score = 9;

    // Adjust for Type
    if (formData.proposalType === 'upgrade') score += 2;
    if (formData.proposalType === 'parameter') score += 1;

    // Reduce for longer voting periods (more time for discussion)
    if (formData.votingPeriodDays >= 14) score = Math.max(1, score - 1);

    setRiskScore(Math.min(10, score));
    return { words, riskScore: Math.min(10, score) };
  };

  // Handle preview button click
  const handlePreviewProposal = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.title.trim()) {
      alert('Proposal title is required');
      return;
    }

    if (!formData.description.trim()) {
      alert('Proposal description is required');
      return;
    }

    const { words, riskScore: score } = calculateMetrics();

    /**
     * Run simulation
     */
    await runSimulation(
      'PROPOSAL_CREATION',
      {
        userId,
        title: formData.title,
        description: formData.description,
        proposalType: formData.proposalType,
        votingPeriodDays: formData.votingPeriodDays,
        proposalThreshold: formData.proposalThreshold,
        executionDelay: formData.executionDelay,
        estimatedImpact: formData.estimatedImpact,
        descriptionWordCount: words,
        riskScore: score,
        daoName,
      },
      userId
    );
  };

  // Handle proposal submission
  const handleSubmitProposal = async () => {
    try {
      const response = await fetch('/api/governance/proposals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          title: formData.title,
          description: formData.description,
          proposalType: formData.proposalType,
          votingPeriodDays: formData.votingPeriodDays,
          proposalThreshold: formData.proposalThreshold,
          executionDelay: formData.executionDelay,
          estimatedImpact: formData.estimatedImpact,
        }),
      });

      if (response.ok) {
        const result = await response.json();
        onProposalSubmitted?.(result);
        resetState();
        setFormData({
          title: '',
          description: '',
          proposalType: 'text',
          votingPeriodDays: 7,
          proposalThreshold: 5000,
          executionDelay: 1,
          estimatedImpact: 'low',
        });
      }
    } catch (error) {
      console.error('Proposal submission failed:', error);
    }
  };

  const proposalTypeInfo: Record<string, string> = {
    text: 'Textual proposition (no execution)',
    parameter: 'Parameter change (affects protocol)',
    spending: 'Treasury spending or grants',
    upgrade: 'Smart contract upgrade',
  };

  const impactLevelColor: Record<string, string> = {
    low: '#10b981',
    medium: '#f59e0b',
    high: '#ef4444',
    critical: '#991b1b',
  };

  return (
    <div className="proposal-panel">
      <div className="panel-header">
        <h3>Create Proposal</h3>
        <div className="header-info">
          <span className="dao-name">{daoName}</span>
        </div>
      </div>

      <form onSubmit={handlePreviewProposal} className="proposal-form">
        {/* Proposal Title */}
        <div className="form-group">
          <label htmlFor="title">Proposal Title</label>
          <input
            id="title"
            type="text"
            placeholder="e.g., Increase Treasury Allocation to ETH"
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            maxLength={100}
          />
          <small>{formData.title.length} / 100 characters</small>
        </div>

        {/* Proposal Description */}
        <div className="form-group">
          <label htmlFor="description">Detailed Description</label>
          <textarea
            id="description"
            placeholder="Explain the proposal, rationale, and expected outcomes..."
            value={formData.description}
            onChange={(e) => {
              setFormData({ ...formData, description: e.target.value });
              calculateMetrics();
            }}
            rows={6}
          />
          <small>{wordCount} words</small>
        </div>

        {/* Proposal Type */}
        <div className="form-group">
          <label htmlFor="type">Proposal Type</label>
          <select
            id="type"
            value={formData.proposalType}
            onChange={(e) =>
              setFormData({
                ...formData,
                proposalType: e.target.value as 'text' | 'parameter' | 'spending' | 'upgrade',
              })
            }
          >
            <option value="text">Text Proposal</option>
            <option value="parameter">Parameter Change</option>
            <option value="spending">Treasury Spending</option>
            <option value="upgrade">Smart Contract Upgrade</option>
          </select>
          <small>{proposalTypeInfo[formData.proposalType]}</small>
        </div>

        {/* Voting Period */}
        <div className="form-group">
          <label htmlFor="votingPeriod">
            Voting Period: {formData.votingPeriodDays} days
          </label>
          <input
            id="votingPeriod"
            type="range"
            min="1"
            max="30"
            step="1"
            value={formData.votingPeriodDays}
            onChange={(e) =>
              setFormData({
                ...formData,
                votingPeriodDays: parseInt(e.target.value),
              })
            }
          />
          <small>Longer periods allow more discussion and deliberation</small>
        </div>

        {/* Proposal Threshold Tokens */}
        <div className="form-group">
          <label htmlFor="threshold">Proposal Threshold (Tokens)</label>
          <input
            id="threshold"
            type="number"
            step="100"
            min="0"
            value={formData.proposalThreshold}
            onChange={(e) =>
              setFormData({
                ...formData,
                proposalThreshold: parseInt(e.target.value) || 0,
              })
            }
          />
          <small>Minimum tokens required to create this proposal</small>
        </div>

        {/* Execution Delay */}
        <div className="form-group">
          <label htmlFor="delay">Execution Delay: {formData.executionDelay} day(s)</label>
          <input
            id="delay"
            type="range"
            min="0"
            max="14"
            step="1"
            value={formData.executionDelay}
            onChange={(e) =>
              setFormData({
                ...formData,
                executionDelay: parseInt(e.target.value),
              })
            }
          />
          <small>Time between proposal passing and execution</small>
        </div>

        {/* Estimated Impact */}
        <div className="form-group">
          <label>Estimated Impact Level</label>
          <div className="impact-buttons">
            {(['low', 'medium', 'high', 'critical'] as const).map((level) => (
              // eslint-disable-next-line react/style-prop-object
              <button
                key={level}
                type="button"
                onClick={() => {
                  setFormData({ ...formData, estimatedImpact: level });
                  calculateMetrics();
                }}
                className={`impact-btn ${formData.estimatedImpact === level ? 'active' : ''}`}
                style={
                  formData.estimatedImpact === level
                    ? { backgroundColor: impactLevelColor[level], color: 'white' }
                    : {}
                }
              >
                {level.charAt(0).toUpperCase() + level.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Risk Assessment */}
        <div className="proposal-analysis">
          <div className="analysis-item">
            <span>Risk Score</span>
            <span className={`risk-score risk-${riskScore}`}>
              {riskScore}/10
            </span>
          </div>

          <div className="analysis-item">
            <span>Description Length</span>
            <span className="value">{wordCount} words</span>
          </div>

          <div className="analysis-item">
            <span>Estimated Quorum</span>
            <span className="value">35%+</span>
          </div>

          <div className="analysis-item">
            <span>Timeline</span>
            <span className="value">
              {formData.votingPeriodDays + formData.executionDelay + 2} days total
            </span>
          </div>
        </div>

        {/* Risk Warning */}
        {riskScore >= 6 && (
          <div className="warning-message">
            <span>⚠ High-risk proposal. Ensure community is aligned before submission.</span>
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
            disabled={isLoading || !formData.title.trim() || !formData.description.trim()}
            className="btn btn-primary"
          >
            {isLoading ? 'Analyzing...' : 'Preview Proposal'}
          </button>
        </div>
      </form>

      {/* Simulation Result Modal */}
      <SimulationResultModal
        result={simulationResult}
        isOpen={isModalOpen}
        onClose={closeModal}
        onConfirm={handleSubmitProposal}
        confirmButtonText="Submit Proposal"
      />
    </div>
  );
};

export default ProposalPanel;
