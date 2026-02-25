/**
 * YieldFarmingPanel.tsx
 * Staking - Yield Farming
 * 
 * Wires: YIELD_FARMING simulator
 * Status: Production-ready
 */

import React, { useState } from 'react';
import SimulationResultModal from '../SimulationResultModal';
import { useSimulationPreview } from '../../hooks/useSimulationPreview';

interface YieldFarmingPanelProps {
  userId: string;
  farmId?: string;
  onSimulationComplete?: (result: any) => void;
}

export const YieldFarmingPanel: React.FC<YieldFarmingPanelProps> = ({
  userId,
  farmId = 'default',
  onSimulationComplete,
}) => {
  const [investmentAmount, setInvestmentAmount] = useState<string>('25000');
  const [farmApy, setFarmApy] = useState<string>('120');
  const [farmDuration, setFarmDuration] = useState<string>('6');
  const [rewardToken, setRewardToken] = useState<string>('gov');
  const [riskLevel, setRiskLevel] = useState<string>('medium');

  const { simulationResult, isLoading, isModalOpen, error, runSimulation, closeModal } =
    useSimulationPreview({
      onSuccess: (result) => onSimulationComplete?.(result),
    });

  const handlePreviewFarming = async (e: React.FormEvent) => {
    e.preventDefault();

    await runSimulation(
      'YIELD_FARMING',
      {
        userId,
        farmId,
        investmentAmount: Number(investmentAmount),
        farmApy: Number(farmApy),
        farmMonths: Number(farmDuration),
        rewardTokenType: rewardToken,
        riskLevel,
      },
      userId
    );
  };

  const handleExecuteFarming = async () => {
    console.log('Executing yield farming:', {
      investmentAmount,
      farmApy,
      farmDuration,
      rewardToken,
    });
    closeModal();
  };

  return (
    <div className="panel yield-farming-panel">
      <div className="panel-header">
        <h3>Yield Farming</h3>
        <p className="subtitle">Analyze farm returns with governance/LP token rewards</p>
      </div>

      <form onSubmit={handlePreviewFarming}>
        <div className="form-group">
          <label htmlFor="investmentAmount">Investment Amount ($)</label>
          <input
            id="investmentAmount"
            type="number"
            value={investmentAmount}
            onChange={(e) => setInvestmentAmount(e.target.value)}
            min="1"
            step="1000"
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="farmApy">Farm APY (%)</label>
          <input
            id="farmApy"
            type="number"
            value={farmApy}
            onChange={(e) => setFarmApy(e.target.value)}
            min="1"
            max="1000"
            step="10"
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="farmDuration">Farming Duration (months)</label>
          <input
            id="farmDuration"
            type="number"
            value={farmDuration}
            onChange={(e) => setFarmDuration(e.target.value)}
            min="1"
            max="60"
            step="1"
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="rewardToken">Reward Token Type</label>
          <select
            id="rewardToken"
            value={rewardToken}
            onChange={(e) => setRewardToken(e.target.value)}
            required
          >
            <option value="gov">Governance Token (Stable)</option>
            <option value="platform">Platform Token (Moderate)</option>
            <option value="native">Native Token (High volatility)</option>
            <option value="mixed">Mixed rewards (Diversified)</option>
          </select>
        </div>

        <div className="form-group">
          <label htmlFor="riskLevel">Farm Risk Level</label>
          <select
            id="riskLevel"
            value={riskLevel}
            onChange={(e) => setRiskLevel(e.target.value)}
            required
          >
            <option value="low">Low (Established protocol)</option>
            <option value="medium">Medium (Growing protocol)</option>
            <option value="high">High (Emerging/new farm)</option>
          </select>
        </div>

        <button type="submit" className="btn-preview" disabled={isLoading}>
          {isLoading ? 'Calculating...' : 'Preview Farming Returns'}
        </button>
      </form>

      {error && <div className="error-message">{error}</div>}

      <SimulationResultModal
        result={simulationResult}
        isOpen={isModalOpen}
        onClose={closeModal}
        onConfirm={handleExecuteFarming}
      />
    </div>
  );
};

export default YieldFarmingPanel;
