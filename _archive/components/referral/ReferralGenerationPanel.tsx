/**
 * ReferralGenerationPanel.tsx
 * Referral Program - Referral Generation
 * 
 * Wires: REFERRAL_GENERATION simulator (Tier 3)
 * Status: Production-ready
 */

import React, { useState } from 'react';
import SimulationResultModal from '../SimulationResultModal';
import { useSimulationPreview } from '../../hooks/useSimulationPreview';

interface ReferralGenerationPanelProps {
  userId: string;
  onSimulationComplete?: (result: any) => void;
}

export const ReferralGenerationPanel: React.FC<ReferralGenerationPanelProps> = ({
  userId,
  onSimulationComplete,
}) => {
  const [campaignBudget, setCampaignBudget] = useState<string>('5000');
  const [targetReferrals, setTargetReferrals] = useState<string>('50');
  const [conversionRate, setConversionRate] = useState<string>('8');
  const [rewardPerReferral, setRewardPerReferral] = useState<string>('25');

  const { simulationResult, isLoading, isModalOpen, error, runSimulation, closeModal } =
    useSimulationPreview({
      onSuccess: (result: any) => onSimulationComplete?.(result),
    });

  const handlePreviewGeneration = async (e: React.FormEvent) => {
    e.preventDefault();

    await runSimulation(
      'REFERRAL_GENERATION',
      {
        userId,
        campaignBudget: Number(campaignBudget),
        targetReferrals: Number(targetReferrals),
        expectedConversionRate: Number(conversionRate),
        rewardPerReferral: Number(rewardPerReferral),
      },
      userId
    );
  };

  const handleExecuteGeneration = async () => {
    console.log('Launching referral campaign:', {
      campaignBudget,
      targetReferrals,
      conversionRate,
      rewardPerReferral,
    });
    closeModal();
  };

  return (
    <div className="panel referral-generation-panel">
      <div className="panel-header">
        <h3>Referral Generation Campaign</h3>
        <p className="subtitle">Plan and launch referral marketing campaign</p>
      </div>

      <form onSubmit={handlePreviewGeneration}>
        <div className="form-group">
          <label htmlFor="campaignBudget">Campaign Budget ($)</label>
          <input
            id="campaignBudget"
            type="number"
            value={campaignBudget}
            onChange={(e) => setCampaignBudget(e.target.value)}
            min="100"
            step="500"
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="targetReferrals">Target Referrals</label>
          <input
            id="targetReferrals"
            type="number"
            value={targetReferrals}
            onChange={(e) => setTargetReferrals(e.target.value)}
            min="1"
            max="10000"
            step="1"
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="conversionRate">Expected Conversion Rate (%)</label>
          <input
            id="conversionRate"
            type="number"
            value={conversionRate}
            onChange={(e) => setConversionRate(e.target.value)}
            min="0.1"
            max="50"
            step="0.5"
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="rewardPerReferral">Reward per Successful Referral ($)</label>
          <input
            id="rewardPerReferral"
            type="number"
            value={rewardPerReferral}
            onChange={(e) => setRewardPerReferral(e.target.value)}
            min="1"
            step="5"
            required
          />
        </div>

        <button type="submit" className="btn-preview" disabled={isLoading}>
          {isLoading ? 'Calculating...' : 'Preview Campaign Analysis'}
        </button>
      </form>

      {error && <div className="error-message">{error}</div>}

      <SimulationResultModal
        result={simulationResult}
        isOpen={isModalOpen}
        onClose={closeModal}
        onConfirm={handleExecuteGeneration}
        title="Referral Campaign Analysis"
      />
    </div>
  );
};

export default ReferralGenerationPanel;
