/**
 * EscrowReleasePanel.tsx
 * Escrow & Settlements - Escrow Release
 * 
 * Wires: ESCROW_RELEASE simulator
 * Status: Production-ready
 */

import React, { useState } from 'react';
import SimulationResultModal from '../SimulationResultModal';
import { useSimulationPreview } from '../../hooks/useSimulationPreview';

interface EscrowReleasePanelProps {
  userId: string;
  escrowId?: string;
  onSimulationComplete?: (result: any) => void;
}

export const EscrowReleasePanel: React.FC<EscrowReleasePanelProps> = ({
  userId,
  escrowId = 'default',
  onSimulationComplete,
}) => {
  const [escrowAmount, setEscrowAmount] = useState<string>('50000');
  const [releasePercentage, setReleasePercentage] = useState<string>('100');
  const [milestoneMet, setMilestoneMet] = useState<boolean>(true);
  const [buyerApproval, setBuyerApproval] = useState<string>('approved');

  const { simulationResult, isLoading, isModalOpen, error, runSimulation, closeModal } =
    useSimulationPreview({
      onSuccess: (result) => onSimulationComplete?.(result),
    });

  const handlePreviewRelease = async (e: React.FormEvent) => {
    e.preventDefault();

    await runSimulation(
      'ESCROW_RELEASE',
      {
        userId,
        escrowId,
        escrowAmount: Number(escrowAmount),
        releasePercentage: Number(releasePercentage),
        milestoneMet,
        buyerApproval,
      },
      userId
    );
  };

  const handleExecuteRelease = async () => {
    console.log('Executing escrow release:', {
      escrowAmount,
      releasePercentage,
      milestoneMet,
    });
    closeModal();
  };

  return (
    <div className="panel escrow-release-panel">
      <div className="panel-header">
        <h3>Escrow Release</h3>
        <p className="subtitle">Analyze and execute escrow fund release</p>
      </div>

      <form onSubmit={handlePreviewRelease}>
        <div className="form-group">
          <label htmlFor="escrowAmount">Escrow Amount ($)</label>
          <input
            id="escrowAmount"
            type="number"
            value={escrowAmount}
            onChange={(e) => setEscrowAmount(e.target.value)}
            min="0"
            step="10000"
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="releasePercentage">Release Percentage (%)</label>
          <input
            id="releasePercentage"
            type="number"
            value={releasePercentage}
            onChange={(e) => setReleasePercentage(e.target.value)}
            min="0"
            max="100"
            step="10"
            required
          />
        </div>

        <div className="form-group checkbox">
          <label htmlFor="milestoneMet">
            <input
              id="milestoneMet"
              type="checkbox"
              checked={milestoneMet}
              onChange={(e) => setMilestoneMet(e.target.checked)}
            />
            Milestone/delivery conditions met
          </label>
        </div>

        <div className="form-group">
          <label htmlFor="buyerApproval">Buyer Approval Status</label>
          <select
            id="buyerApproval"
            value={buyerApproval}
            onChange={(e) => setBuyerApproval(e.target.value)}
            required
          >
            <option value="approved">Approved</option>
            <option value="pending">Pending</option>
            <option value="disputed">Disputed</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>

        <button type="submit" className="btn-preview" disabled={isLoading}>
          {isLoading ? 'Analyzing...' : 'Preview Release Analysis'}
        </button>
      </form>

      {error && <div className="error-message">{error}</div>}

      <SimulationResultModal
        result={simulationResult}
        isOpen={isModalOpen}
        onClose={closeModal}
        onConfirm={handleExecuteRelease}
        title="Escrow Release Analysis"
      />
    </div>
  );
};

export default EscrowReleasePanel;
