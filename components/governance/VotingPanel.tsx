/**
 * VotingPanel.tsx (Week 2 Governance)
 * 
 * Vote casting with voting power display and outcome projection
 * Real-time vote tracking and results preview
 */

import React, { useState, useEffect } from 'react';
import SimulationResultModal from '../SimulationResultModal';
import { useSimulationPreview } from '../../hooks/useSimulationPreview';
import { SimulationResult } from '../../server/services/simulationFramework';

interface ProposalVote {
  proposalId: string;
  proposalTitle: string;
  votingPeriodEnd: number; // timestamp
  currentFor: number;
  currentAgainst: number;
  currentAbstain: number;
}

interface VotingFormData {
  proposalId: string;
  voiceTokens: number; // User's voting power
  voteChoice: 'for' | 'against' | 'abstain';
  reasoning: string;
}

interface VotingPanelProps {
  userId: string;
  userVotingPower?: number;
  activeProposals?: ProposalVote[];
  onVoteCast?: (result: any) => void;
}

/**
 * VotingPanel Component
 * Cast votes on active proposals with power delegation support
 */
export const VotingPanel: React.FC<VotingPanelProps> = ({
  userId,
  userVotingPower = 0,
  activeProposals = [],
  onVoteCast,
}) => {
  // Form state
  const [formData, setFormData] = useState<VotingFormData>({
    proposalId: '',
    voiceTokens: userVotingPower,
    voteChoice: 'for',
    reasoning: '',
  });

  const [selectedProposal, setSelectedProposal] = useState<ProposalVote | null>(
    activeProposals?.[0] || null
  );
  const [timeRemaining, setTimeRemaining] = useState<string>('');
  const [projectedOutcome, setProjectedOutcome] = useState<{
    for: number;
    against: number;
    abstain: number;
  }>({ for: 0, against: 0, abstain: 0 });

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
      console.log('Vote simulation successful:', result);
    },
  });

  // Calculate voting metrics
  useEffect(() => {
    if (!selectedProposal) return;

    // Calculate time remaining
    const now = Date.now() / 1000;
    const secondsRemaining = Math.max(0, selectedProposal.votingPeriodEnd - now);
    const daysRemaining = Math.floor(secondsRemaining / 86400);
    const hoursRemaining = Math.floor((secondsRemaining % 86400) / 3600);

    if (daysRemaining > 0) {
      setTimeRemaining(`${daysRemaining}d ${hoursRemaining}h`);
    } else if (hoursRemaining > 0) {
      setTimeRemaining(`${hoursRemaining}h`);
    } else {
      setTimeRemaining('Voting closed');
    }

    // Project outcome with user's vote
    const newProj = {
      for:
        formData.voteChoice === 'for'
          ? selectedProposal.currentFor + formData.voiceTokens
          : selectedProposal.currentFor,
      against:
        formData.voteChoice === 'against'
          ? selectedProposal.currentAgainst + formData.voiceTokens
          : selectedProposal.currentAgainst,
      abstain:
        formData.voteChoice === 'abstain'
          ? selectedProposal.currentAbstain + formData.voiceTokens
          : selectedProposal.currentAbstain,
    };

    setProjectedOutcome(newProj);
    setFormData({ ...formData, proposalId: selectedProposal.proposalId });
  }, [selectedProposal, formData.voiceTokens, formData.voteChoice]);

  // Calculate voting percentages
  const calculatePercentages = (votes: typeof projectedOutcome) => {
    const total = votes.for + votes.against + votes.abstain;
    if (total === 0) return { for: 0, against: 0, abstain: 0 };

    return {
      for: (votes.for / total) * 100,
      against: (votes.against / total) * 100,
      abstain: (votes.abstain / total) * 100,
    };
  };

  // Handle preview vote
  const handlePreviewVote = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedProposal) {
      alert('Please select a proposal');
      return;
    }

    const percs = calculatePercentages(projectedOutcome);
    const passageChance = projectedOutcome.for > projectedOutcome.against ? 95 : 15;

    /**
     * Run simulation
     */
    await runSimulation(
      'GOVERNANCE_VOTE',
      {
        userId,
        proposalId: selectedProposal.proposalId,
        proposalTitle: selectedProposal.proposalTitle,
        voteChoice: formData.voteChoice,
        votingPower: formData.voiceTokens,
        currentVotes: {
          for: selectedProposal.currentFor,
          against: selectedProposal.currentAgainst,
          abstain: selectedProposal.currentAbstain,
        },
        projectedVotes: projectedOutcome,
        projectedPercentages: percs,
        estimatedPassageChance: passageChance,
        voteWeight: (formData.voiceTokens / (projectedOutcome.for + projectedOutcome.against + projectedOutcome.abstain)) * 100,
      },
      userId
    );
  };

  // Handle vote submission
  const handleSubmitVote = async () => {
    try {
      const response = await fetch('/api/governance/votes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          proposalId: selectedProposal?.proposalId,
          voteChoice: formData.voteChoice,
          votingPower: formData.voiceTokens,
          reasoning: formData.reasoning,
        }),
      });

      if (response.ok) {
        const result = await response.json();
        onVoteCast?.(result);
        resetState();
        setFormData({
          proposalId: '',
          voiceTokens: userVotingPower,
          voteChoice: 'for',
          reasoning: '',
        });
      }
    } catch (error) {
      console.error('Vote submission failed:', error);
    }
  };

  if (!activeProposals || activeProposals.length === 0) {
    return (
      <div className="voting-panel">
        <div className="panel-header">
          <h3>Active Votes</h3>
        </div>
        <div className="empty-state">No active proposals available for voting.</div>
      </div>
    );
  }

  const currentPercs = calculatePercentages({
    for: selectedProposal?.currentFor || 0,
    against: selectedProposal?.currentAgainst || 0,
    abstain: selectedProposal?.currentAbstain || 0,
  });

  const projectedPercs = calculatePercentages(projectedOutcome);
  const totalVoteCasted =
    (selectedProposal?.currentFor || 0) +
    (selectedProposal?.currentAgainst || 0) +
    (selectedProposal?.currentAbstain || 0);

  return (
    <div className="voting-panel">
      <div className="panel-header">
        <h3>Cast Vote</h3>
        <div className="header-info">
          <span className="voting-power">Power: {formData.voiceTokens.toLocaleString()}</span>
        </div>
      </div>

      <form onSubmit={handlePreviewVote} className="voting-form">
        {/* Proposal Selection */}
        <div className="form-group">
          <label htmlFor="proposal">Select Proposal</label>
          <select
            id="proposal"
            onChange={(e) => {
              const props = activeProposals.find((p) => p.proposalId === e.target.value);
              setSelectedProposal(props || null);
            }}
            value={selectedProposal?.proposalId || ''}
          >
            <option value="">Choose a proposal...</option>
            {activeProposals.map((prop) => (
              <option key={prop.proposalId} value={prop.proposalId}>
                {prop.proposalTitle.substring(0, 50)}...
              </option>
            ))}
          </select>
        </div>

        {selectedProposal && (
          <>
            {/* Current Vote Status */}
            <div className="vote-status">
              <div className="status-header">
                <span>Current Votes: {totalVoteCasted.toLocaleString()}</span>
                <span className="time-remaining">⏱ {timeRemaining}</span>
              </div>

              <div className="vote-bars">
                <div className="vote-bar-item">
                  <span className="bar-label">For</span>
                  <div className="bar-container">
                    {/* eslint-disable-next-line react/style-prop-object */}
                    <div
                      className="bar-fill for"
                      style={{ width: `${currentPercs.for}%` }}
                    />
                  </div>
                  <span className="bar-value">
                    {selectedProposal.currentFor.toLocaleString()} ({currentPercs.for.toFixed(1)}%)
                  </span>
                </div>

                <div className="vote-bar-item">
                  <span className="bar-label">Against</span>
                  <div className="bar-container">
                    {/* eslint-disable-next-line react/style-prop-object */}
                    <div
                      className="bar-fill against"
                      style={{ width: `${currentPercs.against}%` }}
                    />
                  </div>
                  <span className="bar-value">
                    {selectedProposal.currentAgainst.toLocaleString()} ({currentPercs.against.toFixed(1)}%)
                  </span>
                </div>

                <div className="vote-bar-item">
                  <span className="bar-label">Abstain</span>
                  <div className="bar-container">
                    {/* eslint-disable-next-line react/style-prop-object */}
                    <div
                      className="bar-fill abstain"
                      style={{ width: `${currentPercs.abstain}%` }}
                    />
                  </div>
                  <span className="bar-value">
                    {selectedProposal.currentAbstain.toLocaleString()} ({currentPercs.abstain.toFixed(1)}%)
                  </span>
                </div>
              </div>
            </div>

            {/* Vote Choice */}
            <div className="form-group">
              <label>Your Vote</label>
              <div className="vote-buttons">
                {(['for', 'against', 'abstain'] as const).map((choice) => (
                  <button
                    key={choice}
                    type="button"
                    onClick={() => setFormData({ ...formData, voteChoice: choice })}
                    className={`vote-btn ${formData.voteChoice === choice ? 'active' : ''}`}
                  >
                    {choice === 'for' && '👍 For'}
                    {choice === 'against' && '👎 Against'}
                    {choice === 'abstain' && '🤷 Abstain'}
                  </button>
                ))}
              </div>
            </div>

            {/* Voting Power Input */}
            <div className="form-group">
              <label htmlFor="power">
                Voting Power to Use: {formData.voiceTokens.toLocaleString()}
              </label>
              <input
                id="power"
                type="range"
                min="0"
                max={userVotingPower}
                step="1"
                value={formData.voiceTokens}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    voiceTokens: parseInt(e.target.value) || 0,
                  })
                }
              />
              <small>Available: {userVotingPower.toLocaleString()}</small>
            </div>

            {/* Reasoning */}
            <div className="form-group">
              <label htmlFor="reasoning">Reasoning (optional)</label>
              <textarea
                id="reasoning"
                placeholder="Explain your voting choice..."
                value={formData.reasoning}
                onChange={(e) => setFormData({ ...formData, reasoning: e.target.value })}
                rows={3}
              />
            </div>

            {/* Projected Outcome */}
            <div className="projection-section">
              <h4>Projected Outcome After Your Vote</h4>
              <div className="projected-bars">
                <div className="proj-bar-item">
                  <span className="bar-label">For</span>
                  <div className="bar-value">{projectedOutcome.for.toLocaleString()} ({projectedPercs.for.toFixed(1)}%)</div>
                </div>
                <div className="proj-bar-item">
                  <span className="bar-label">Against</span>
                  <div className="bar-value">{projectedOutcome.against.toLocaleString()} ({projectedPercs.against.toFixed(1)}%)</div>
                </div>
                <div className="proj-bar-item">
                  <span className="bar-label">Abstain</span>
                  <div className="bar-value">{projectedOutcome.abstain.toLocaleString()} ({projectedPercs.abstain.toFixed(1)}%)</div>
                </div>
              </div>

              <div className="projection-info">
                <span>
                  {projectedOutcome.for > projectedOutcome.against
                    ? '✅ Proposal likely PASSES'
                    : '❌ Proposal likely FAILS'}
                </span>
              </div>
            </div>

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
                disabled={isLoading || formData.voiceTokens === 0}
                className="btn btn-primary"
              >
                {isLoading ? 'Analyzing...' : 'Preview Vote'}
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
        onConfirm={handleSubmitVote}
        confirmButtonText="Cast Vote"
      />
    </div>
  );
};

export default VotingPanel;
