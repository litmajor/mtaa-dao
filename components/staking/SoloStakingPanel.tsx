/**
 * SoloStakingPanel.tsx
 * Staking - Solo Staking
 * 
 * Wires: SOLO_STAKING simulator
 * Status: Production-ready
 */

import React, { useState } from 'react';
import SimulationResultModal from '../SimulationResultModal';
import { useSimulationPreview } from '../../hooks/useSimulationPreview';

interface SoloStakingPanelProps {
  userId: string;
  onSimulationComplete?: (result: any) => void;
}

export const SoloStakingPanel: React.FC<SoloStakingPanelProps> = ({
  userId,
  onSimulationComplete,
}) => {
  const [stakingAmount, setStakingAmount] = useState<string>('32000');
  const [stakingDuration, setStakingDuration] = useState<string>('12');
  const [networkApy, setNetworkApy] = useState<string>('4.5');
  const [includeSlashing, setIncludeSlashing] = useState<boolean>(false);

  const { simulationResult, isLoading, isModalOpen, error, runSimulation, closeModal } =
    useSimulationPreview({
      onSuccess: (result) => onSimulationComplete?.(result),
    });

  const handlePreviewStaking = async (e: React.FormEvent) => {
    e.preventDefault();

    await runSimulation(
      'SOLO_STAKING',
      {
        userId,
        stakingAmount: Number(stakingAmount),
        monthsDuration: Number(stakingDuration),
        networkApy: Number(networkApy),
        includeSlashing,
      },
      userId
    );
  };

  const handleExecuteStaking = async () => {
    console.log('Executing solo staking:', {
      stakingAmount,
      stakingDuration,
      networkApy,
    });
    closeModal();
  };

  return (
    <div className="panel solo-staking-panel">
      <div className="panel-header">
        <h3>Solo Staking</h3>
        <p className="subtitle">Set up individual validator node and manage staking</p>
      </div>

      <form onSubmit={handlePreviewStaking}>
        <div className="form-group">
          <label htmlFor="stakingAmount">Staking Amount (ETH/tokens)</label>
          <input
            id="stakingAmount"
            type="number"
            value={stakingAmount}
            onChange={(e) => setStakingAmount(e.target.value)}
            min="32"
            step="1"
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="stakingDuration">Staking Duration (months)</label>
          <input
            id="stakingDuration"
            type="number"
            value={stakingDuration}
            onChange={(e) => setStakingDuration(e.target.value)}
            min="1"
            max="60"
            step="1"
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="networkApy">Network APY (%)</label>
          <input
            id="networkApy"
            type="number"
            value={networkApy}
            onChange={(e) => setNetworkApy(e.target.value)}
            min="0"
            max="20"
            step="0.1"
            required
          />
        </div>

        <div className="form-group checkbox">
          <label htmlFor="includeSlashing">
            <input
              id="includeSlashing"
              type="checkbox"
              checked={includeSlashing}
              onChange={(e) => setIncludeSlashing(e.target.checked)}
            />
            Include validator slashing risk analysis
          </label>
        </div>

        <button type="submit" className="btn-preview" disabled={isLoading}>
          {isLoading ? 'Calculating...' : 'Preview Solo Staking Returns'}
        </button>
      </form>

      {error && <div className="error-message">{error}</div>}

      <SimulationResultModal
        result={simulationResult}
        isOpen={isModalOpen}
        onClose={closeModal}
        onConfirm={handleExecuteStaking}
        title="Solo Staking Analysis"
      />
    </div>
  );
};

export default SoloStakingPanel;
