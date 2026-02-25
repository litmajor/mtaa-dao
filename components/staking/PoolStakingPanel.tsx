/**
 * PoolStakingPanel.tsx
 * Staking - Pool Staking
 * 
 * Wires: POOL_STAKING simulator
 * Status: Production-ready
 */

import React, { useState } from 'react';
import SimulationResultModal from '../SimulationResultModal';
import { useSimulationPreview } from '../../hooks/useSimulationPreview';

interface PoolStakingPanelProps {
  userId: string;
  poolId?: string;
  onSimulationComplete?: (result: any) => void;
}

export const PoolStakingPanel: React.FC<PoolStakingPanelProps> = ({
  userId,
  poolId = 'default',
  onSimulationComplete,
}) => {
  const [depositAmount, setDepositAmount] = useState<string>('5000');
  const [poolApy, setPoolApy] = useState<string>('5.2');
  const [lockupPeriod, setLockupPeriod] = useState<string>('12');
  const [poolFee, setPoolFee] = useState<string>('15');

  const { simulationResult, isLoading, isModalOpen, error, runSimulation, closeModal } =
    useSimulationPreview({
      onSuccess: (result) => onSimulationComplete?.(result),
    });

  const handlePreviewPoolStaking = async (e: React.FormEvent) => {
    e.preventDefault();

    await runSimulation(
      'POOL_STAKING',
      {
        userId,
        poolId,
        depositAmount: Number(depositAmount),
        poolApy: Number(poolApy),
        lockupMonths: Number(lockupPeriod),
        poolFeePercentage: Number(poolFee),
      },
      userId
    );
  };

  const handleExecutePoolStaking = async () => {
    console.log('Executing pool staking:', {
      depositAmount,
      poolApy,
      lockupPeriod,
      poolFee,
    });
    closeModal();
  };

  return (
    <div className="panel pool-staking-panel">
      <div className="panel-header">
        <h3>Pool Staking</h3>
        <p className="subtitle">Deposit in staking pool and earn shared validator rewards</p>
      </div>

      <form onSubmit={handlePreviewPoolStaking}>
        <div className="form-group">
          <label htmlFor="depositAmount">Deposit Amount ($)</label>
          <input
            id="depositAmount"
            type="number"
            value={depositAmount}
            onChange={(e) => setDepositAmount(e.target.value)}
            min="1"
            step="100"
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="poolApy">Pool APY (%)</label>
          <input
            id="poolApy"
            type="number"
            value={poolApy}
            onChange={(e) => setPoolApy(e.target.value)}
            min="0"
            max="20"
            step="0.1"
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="lockupPeriod">Lockup Period (months)</label>
          <input
            id="lockupPeriod"
            type="number"
            value={lockupPeriod}
            onChange={(e) => setLockupPeriod(e.target.value)}
            min="1"
            max="60"
            step="1"
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="poolFee">Pool Fee (% of rewards)</label>
          <input
            id="poolFee"
            type="number"
            value={poolFee}
            onChange={(e) => setPoolFee(e.target.value)}
            min="0"
            max="50"
            step="0.5"
            required
          />
        </div>

        <button type="submit" className="btn-preview" disabled={isLoading}>
          {isLoading ? 'Calculating...' : 'Preview Pool Returns'}
        </button>
      </form>

      {error && <div className="error-message">{error}</div>}

      <SimulationResultModal
        result={simulationResult}
        isOpen={isModalOpen}
        onClose={closeModal}
        onConfirm={handleExecutePoolStaking}
        title="Pool Staking Analysis"
      />
    </div>
  );
};

export default PoolStakingPanel;
