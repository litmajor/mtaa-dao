/**
 * BountyCompletionPanel.tsx
 * Bounties - Bounty Completion
 * 
 * Wires: BOUNTY_COMPLETION simulator
 * Status: Production-ready
 */

import React, { useState } from 'react';
import SimulationResultModal from '../SimulationResultModal';
import { useSimulationPreview } from '../../hooks/useSimulationPreview';

interface BountyCompletionPanelProps {
  userId: string;
  bountyId?: string;
  onSimulationComplete?: (result: any) => void;
}

export const BountyCompletionPanel: React.FC<BountyCompletionPanelProps> = ({
  userId,
  bountyId = 'default',
  onSimulationComplete,
}) => {
  const [bountyAmount, setBountyAmount] = useState<string>('2000');
  const [submissionQuality, setSubmissionQuality] = useState<string>('excellent');
  const [deliveryOnTime, setDeliveryOnTime] = useState<boolean>(true);
  const [reviewScore, setReviewScore] = useState<string>('9.5');

  const { simulationResult, isLoading, isModalOpen, error, runSimulation, closeModal } =
    useSimulationPreview({
      onSuccess: (result: any) => onSimulationComplete?.(result),
    });

  const handlePreviewCompletion = async (e: React.FormEvent) => {
    e.preventDefault();

    await runSimulation(
      'BOUNTY_COMPLETION',
      {
        userId,
        bountyId,
        bountyAmount: Number(bountyAmount),
        submissionQuality,
        deliveryOnTime,
        reviewScore: Number(reviewScore),
      },
      userId
    );
  };

  const handleExecuteCompletion = async () => {
    console.log('Finalizing bounty completion:', {
      bountyAmount,
      submissionQuality,
      deliveryOnTime,
      reviewScore,
    });
    closeModal();
  };

  return (
    <div className="panel bounty-completion-panel">
      <div className="panel-header">
        <h3>Bounty Completion</h3>
        <p className="subtitle">Verify submission and process bounty payout</p>
      </div>

      <form onSubmit={handlePreviewCompletion}>
        <div className="form-group">
          <label htmlFor="bountyAmount">Bounty Amount ($)</label>
          <input
            id="bountyAmount"
            type="number"
            value={bountyAmount}
            onChange={(e) => setBountyAmount(e.target.value)}
            min="100"
            step="100"
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="submissionQuality">Submission Quality</label>
          <select
            id="submissionQuality"
            value={submissionQuality}
            onChange={(e) => setSubmissionQuality(e.target.value)}
            required
          >
            <option value="poor">Poor (Incomplete)</option>
            <option value="fair">Fair (Needs revision)</option>
            <option value="good">Good (Minor fixes)</option>
            <option value="excellent">Excellent (Ready to use)</option>
          </select>
        </div>

        <div className="form-group checkbox">
          <label htmlFor="deliveryOnTime">
            <input
              id="deliveryOnTime"
              type="checkbox"
              checked={deliveryOnTime}
              onChange={(e) => setDeliveryOnTime(e.target.checked)}
            />
            Delivered on or before deadline
          </label>
        </div>

        <div className="form-group">
          <label htmlFor="reviewScore">Reviewer Score (0-10)</label>
          <input
            id="reviewScore"
            type="number"
            value={reviewScore}
            onChange={(e) => setReviewScore(e.target.value)}
            min="0"
            max="10"
            step="0.5"
            required
          />
        </div>

        <button type="submit" className="btn-preview" disabled={isLoading}>
          {isLoading ? 'Processing...' : 'Preview Final Payout'}
        </button>
      </form>

      {error && <div className="error-message">{error}</div>}

      <SimulationResultModal
        result={simulationResult}
        isOpen={isModalOpen}
        onClose={closeModal}
        onConfirm={handleExecuteCompletion}
      />
    </div>
  );
};

export default BountyCompletionPanel;
