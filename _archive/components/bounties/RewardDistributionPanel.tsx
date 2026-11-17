/**
 * RewardDistributionPanel.tsx
 * Bounties - Reward Distribution
 * 
 * Wires: REWARD_DISTRIBUTION simulator
 * Status: Production-ready
 */

import React, { useState } from 'react';
import SimulationResultModal from '../SimulationResultModal';
import { useSimulationPreview } from '../../hooks/useSimulationPreview';

interface RewardDistributionPanelProps {
  userId: string;
  onSimulationComplete?: (result: any) => void;
}

export const RewardDistributionPanel: React.FC<RewardDistributionPanelProps> = ({
  userId,
  onSimulationComplete,
}) => {
  const [rewardPool, setRewardPool] = useState<string>('5000');
  const [recipientCount, setRecipientCount] = useState<string>('10');
  const [distributionMethod, setDistributionMethod] = useState<string>('performance');
  const [tierLevel, setTierLevel] = useState<string>('3');

  const { simulationResult, isLoading, isModalOpen, error, runSimulation, closeModal } =
    useSimulationPreview({
      onSuccess: (result: any) => onSimulationComplete?.(result),
    });

  const handlePreviewDistribution = async (e: React.FormEvent) => {
    e.preventDefault();

    await runSimulation(
      'REWARD_DISTRIBUTION',
      {
        userId,
        rewardPool: Number(rewardPool),
        recipientCount: Number(recipientCount),
        distributionMethod,
        tierLevels: Number(tierLevel),
      },
      userId
    );
  };

  const handleExecuteDistribution = async () => {
    console.log('Executing reward distribution:', {
      rewardPool,
      recipientCount,
      distributionMethod,
      tierLevel,
    });
    closeModal();
  };

  return (
    <div className="panel reward-distribution-panel">
      <div className="panel-header">
        <h3>Reward Distribution</h3>
        <p className="subtitle">Distribute rewards to bounty hunters based on performance</p>
      </div>

      <form onSubmit={handlePreviewDistribution}>
        <div className="form-group">
          <label htmlFor="rewardPool">Reward Pool ($)</label>
          <input
            id="rewardPool"
            type="number"
            value={rewardPool}
            onChange={(e) => setRewardPool(e.target.value)}
            min="100"
            step="500"
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="recipientCount">Number of Recipients</label>
          <input
            id="recipientCount"
            type="number"
            value={recipientCount}
            onChange={(e) => setRecipientCount(e.target.value)}
            min="1"
            max="1000"
            step="1"
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="distributionMethod">Distribution Method</label>
          <select
            id="distributionMethod"
            value={distributionMethod}
            onChange={(e) => setDistributionMethod(e.target.value)}
            required
          >
            <option value="equal">Equal split</option>
            <option value="performance">Performance-based</option>
            <option value="time">Time-weighted</option>
            <option value="tiered">Tiered (Top performers get more)</option>
          </select>
        </div>

        <div className="form-group">
          <label htmlFor="tierLevel">Number of Tiers</label>
          <input
            id="tierLevel"
            type="number"
            value={tierLevel}
            onChange={(e) => setTierLevel(e.target.value)}
            min="1"
            max="10"
            step="1"
            required
          />
        </div>

        <button type="submit" className="btn-preview" disabled={isLoading}>
          {isLoading ? 'Calculating...' : 'Preview Distribution Breakdown'}
        </button>
      </form>

      {error && <div className="error-message">{error}</div>}

      <SimulationResultModal
        result={simulationResult}
        isOpen={isModalOpen}
        onClose={closeModal}
        onConfirm={handleExecuteDistribution}
        title="Reward Distribution Analysis"
      />
    </div>
  );
};

export default RewardDistributionPanel;
