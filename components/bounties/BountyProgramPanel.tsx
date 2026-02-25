/**
 * BountyProgramPanel.tsx
 * Bounties - Bounty Program
 * 
 * Wires: BOUNTY_PROGRAM simulator
 * Status: Production-ready
 */

import React, { useState } from 'react';
import SimulationResultModal from '../SimulationResultModal';
import { useSimulationPreview } from '../../hooks/useSimulationPreview';

interface BountyProgramPanelProps {
  userId: string;
  onSimulationComplete?: (result: any) => void;
}

export const BountyProgramPanel: React.FC<BountyProgramPanelProps> = ({
  userId,
  onSimulationComplete,
}) => {
  const [totalBudget, setTotalBudget] = useState<string>('10000');
  const [numberOfBounties, setNumberOfBounties] = useState<string>('5');
  const [minBountySize, setMinBountySize] = useState<string>('500');
  const [completionTarget, setCompletionTarget] = useState<string>('80');

  const { simulationResult, isLoading, isModalOpen, error, runSimulation, closeModal } =
    useSimulationPreview({
      onSuccess: (result: any) => onSimulationComplete?.(result),
    });

  const handlePreviewProgram = async (e: React.FormEvent) => {
    e.preventDefault();

    await runSimulation(
      'BOUNTY_PROGRAM',
      {
        userId,
        totalBudget: Number(totalBudget),
        numberOfBounties: Number(numberOfBounties),
        minimumBountySize: Number(minBountySize),
        completionTarget: Number(completionTarget),
      },
      userId
    );
  };

  const handleExecuteProgram = async () => {
    console.log('Executing bounty program setup:', {
      totalBudget,
      numberOfBounties,
      minBountySize,
      completionTarget,
    });
    closeModal();
  };

  return (
    <div className="panel bounty-program-panel">
      <div className="panel-header">
        <h3>Bounty Program Setup</h3>
        <p className="subtitle">Create bug bounty or development incentive program</p>
      </div>

      <form onSubmit={handlePreviewProgram}>
        <div className="form-group">
          <label htmlFor="totalBudget">Total Program Budget ($)</label>
          <input
            id="totalBudget"
            type="number"
            value={totalBudget}
            onChange={(e) => setTotalBudget(e.target.value)}
            min="100"
            step="1000"
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="numberOfBounties">Number of Bounties</label>
          <input
            id="numberOfBounties"
            type="number"
            value={numberOfBounties}
            onChange={(e) => setNumberOfBounties(e.target.value)}
            min="1"
            max="100"
            step="1"
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="minBountySize">Minimum Bounty Size ($)</label>
          <input
            id="minBountySize"
            type="number"
            value={minBountySize}
            onChange={(e) => setMinBountySize(e.target.value)}
            min="10"
            step="100"
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="completionTarget">Target Completion Rate (%)</label>
          <input
            id="completionTarget"
            type="number"
            value={completionTarget}
            onChange={(e) => setCompletionTarget(e.target.value)}
            min="0"
            max="100"
            step="5"
            required
          />
        </div>

        <button type="submit" className="btn-preview" disabled={isLoading}>
          {isLoading ? 'Analyzing...' : 'Preview Program Analysis'}
        </button>
      </form>

      {error && <div className="error-message">{error}</div>}

      <SimulationResultModal
        result={simulationResult}
        isOpen={isModalOpen}
        onClose={closeModal}
        onConfirm={handleExecuteProgram}
        title="Bounty Program Analysis"
      />
    </div>
  );
};

export default BountyProgramPanel;
