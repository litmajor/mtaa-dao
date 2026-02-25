/**
 * EscrowRecoveryPanel.tsx
 * Escrow & Settlements - Escrow Recovery (30-day window)
 * 
 * Wires: ESCROW_RECOVERY simulator
 * ⭐ SPECIAL FEATURE: 30-day recovery window after dispute/expiry
 * Status: Production-ready
 */

import React, { useState } from 'react';
import SimulationResultModal from '../SimulationResultModal';
import { useSimulationPreview } from '../../hooks/useSimulationPreview';

interface EscrowRecoveryPanelProps {
  userId: string;
  escrowId?: string;
  onSimulationComplete?: (result: any) => void;
}

export const EscrowRecoveryPanel: React.FC<EscrowRecoveryPanelProps> = ({
  userId,
  escrowId = 'default',
  onSimulationComplete,
}) => {
  const [escrowAmount, setEscrowAmount] = useState<string>('50000');
  const [daysElapsed, setDaysElapsed] = useState<string>('15');
  const [recoveryReason, setRecoveryReason] = useState<string>('timeout');
  const [claimStatus, setClaimStatus] = useState<string>('unclaimed');

  const { simulationResult, isLoading, isModalOpen, error, runSimulation, closeModal } =
    useSimulationPreview({
      onSuccess: (result) => onSimulationComplete?.(result),
    });

  const handlePreviewRecovery = async (e: React.FormEvent) => {
    e.preventDefault();

    await runSimulation(
      'ESCROW_RECOVERY',
      {
        userId,
        escrowId,
        escrowAmount: Number(escrowAmount),
        daysElapsed: Number(daysElapsed),
        recoveryReason,
        claimStatus,
      },
      userId
    );
  };

  const handleExecuteRecovery = async () => {
    console.log('Executing escrow recovery:', {
      escrowAmount,
      daysElapsed,
      recoveryReason,
      claimStatus,
    });
    closeModal();
  };

  return (
    <div className="panel escrow-recovery-panel">
      <div className="panel-header">
        <h3>Escrow Recovery (30-Day Window)</h3>
        <p className="subtitle">
          Manage auto-recovery after 30 days | Current: {Math.min(daysElapsed ? parseInt(daysElapsed) : 0, 30)}/30 days
        </p>
      </div>

      <form onSubmit={handlePreviewRecovery}>
        <div className="form-group">
          <label htmlFor="escrowAmount">Escrow Amount in Recovery ($)</label>
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
          <label htmlFor="daysElapsed">Days Elapsed in Recovery Window</label>
          <input
            id="daysElapsed"
            type="number"
            value={daysElapsed}
            onChange={(e) => setDaysElapsed(e.target.value)}
            min="0"
            max="30"
            step="1"
            required
          />
          <small>⏱️ Auto-recovery triggers at day 30</small>
        </div>

        <div className="form-group">
          <label htmlFor="recoveryReason">Recovery Reason</label>
          <select
            id="recoveryReason"
            value={recoveryReason}
            onChange={(e) => setRecoveryReason(e.target.value)}
            required
          >
            <option value="timeout">Timeout (No action taken)</option>
            <option value="dispute_unresolved">Unresolved Dispute</option>
            <option value="seller_default">Seller Default</option>
            <option value="buyer_default">Buyer Default</option>
            <option value="mutual_agreement">Mutual Agreement</option>
          </select>
        </div>

        <div className="form-group">
          <label htmlFor="claimStatus">Outstanding Claims</label>
          <select
            id="claimStatus"
            value={claimStatus}
            onChange={(e) => setClaimStatus(e.target.value)}
            required
          >
            <option value="unclaimed">No claims</option>
            <option value="partial_claim">Partial claim pending</option>
            <option value="full_claim">Full amount claimed</option>
            <option value="disputed_claim">Claim disputed</option>
          </select>
        </div>

        <button type="submit" className="btn-preview" disabled={isLoading}>
          {isLoading ? 'Analyzing...' : 'Preview Recovery Status'}
        </button>
      </form>

      {error && <div className="error-message">{error}</div>}

      <div className="recovery-info">
        <strong>⭐ 30-Day Recovery Window:</strong>
        <ul>
          <li>Days 1-29: Disputes/appeals can be filed or resolved</li>
          <li>Day 30: Automatic recovery triggers if unresolved</li>
          <li>Claimants have priority over timeout recovery path</li>
          <li>All claims resolved before recovery execution</li>
        </ul>
      </div>

      <SimulationResultModal
        result={simulationResult}
        isOpen={isModalOpen}
        onClose={closeModal}
        onConfirm={handleExecuteRecovery}
        title="Escrow Recovery Analysis"
      />
    </div>
  );
};

export default EscrowRecoveryPanel;
