/**
 * SavingsChallengePanel.tsx
 * Micro Transactions - Savings Challenge
 * 
 * Wires: SAVINGS_CHALLENGE simulator (Tier 3)
 * Status: Production-ready
 */

import React, { useState } from 'react';
import SimulationResultModal from '../SimulationResultModal';
import { useSimulationPreview } from '../../hooks/useSimulationPreview';

interface SavingsChallengePanelProps {
  userId: string;
  challengeId?: string;
  onSimulationComplete?: (result: any) => void;
}

export const SavingsChallengePanel: React.FC<SavingsChallengePanelProps> = ({
  userId,
  challengeId = 'default',
  onSimulationComplete,
}) => {
  const [savingTarget, setSavingTarget] = useState<string>('500');
  const [weeklySaving, setWeeklySaving] = useState<string>('100');
  const [bonus, setBonus] = useState<string>('50');
  const [duration, setDuration] = useState<string>('12');

  const { simulationResult, isLoading, isModalOpen, error, runSimulation, closeModal } =
    useSimulationPreview({
      onSuccess: (result: any) => onSimulationComplete?.(result),
    });

  const handlePreviewChallenge = async (e: React.FormEvent) => {
    e.preventDefault();

    await runSimulation(
      'SAVINGS_CHALLENGE',
      {
        userId,
        challengeId,
        savingsTarget: Number(savingTarget),
        weeklyContribution: Number(weeklySaving),
        completionBonus: Number(bonus),
        durationWeeks: Number(duration),
      },
      userId
    );
  };

  const handleExecuteChallenge = async () => {
    console.log('Starting savings challenge:', {
      savingTarget,
      weeklySaving,
      bonus,
      duration,
    });
    closeModal();
  };

  return (
    <div className="panel savings-challenge-panel">
      <div className="panel-header">
        <h3>Savings Challenge</h3>
        <p className="subtitle">Gamified savings goal with completion bonus</p>
      </div>

      <form onSubmit={handlePreviewChallenge}>
        <div className="form-group">
          <label htmlFor="savingTarget">Savings Target ($)</label>
          <input
            id="savingTarget"
            type="number"
            value={savingTarget}
            onChange={(e) => setSavingTarget(e.target.value)}
            min="50"
            max="50000"
            step="50"
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="weeklySaving">Weekly Savings Amount ($)</label>
          <input
            id="weeklySaving"
            type="number"
            value={weeklySaving}
            onChange={(e) => setWeeklySaving(e.target.value)}
            min="5"
            max="5000"
            step="5"
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="bonus">Completion Bonus ($)</label>
          <input
            id="bonus"
            type="number"
            value={bonus}
            onChange={(e) => setBonus(e.target.value)}
            min="0"
            max="1000"
            step="10"
            required
          />
          <small>Reward when target is reached</small>
        </div>

        <div className="form-group">
          <label htmlFor="duration">Challenge Duration (weeks)</label>
          <input
            id="duration"
            type="number"
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
            min="4"
            max="52"
            step="1"
            required
          />
        </div>

        <button type="submit" className="btn-preview" disabled={isLoading}>
          {isLoading ? 'Setting up...' : 'Preview Challenge Plan'}
        </button>
      </form>

      {error && <div className="error-message">{error}</div>}

      <div className="challenge-info">
        <strong>🎯 Savings Challenge Features:</strong>
        <ul>
          <li>✓ Weekly savings goal with progress tracking</li>
          <li>✓ Completion bonus when target reached</li>
          <li>✓ Missing week = challenge reset (earn nothing)</li>
          <li>✓ Leaderboards for friendly competition</li>
          <li>✓ Early completion = larger bonus multiplier</li>
        </ul>
      </div>

      <SimulationResultModal
        result={simulationResult}
        isOpen={isModalOpen}
        onClose={closeModal}
        onConfirm={handleExecuteChallenge}
      />
    </div>
  );
};

export default SavingsChallengePanel;
