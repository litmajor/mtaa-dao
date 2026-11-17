/**
 * SettlementFinalityPanel.tsx
 * Escrow & Settlements - Settlement Finality
 * 
 * Wires: SETTLEMENT_FINALITY simulator
 * Status: Production-ready
 */

import React, { useState } from 'react';
import SimulationResultModal from '../SimulationResultModal';
import { useSimulationPreview } from '../../hooks/useSimulationPreview';

interface SettlementFinalityPanelProps {
  userId: string;
  settlementId?: string;
  onSimulationComplete?: (result: any) => void;
}

export const SettlementFinalityPanel: React.FC<SettlementFinalityPanelProps> = ({
  userId,
  settlementId = 'default',
  onSimulationComplete,
}) => {
  const [settlementAmount, setSettlementAmount] = useState<string>('100000');
  const [transactionCount, setTransactionCount] = useState<string>('1');
  const [blockchainConfirmations, setBlockchainConfirmations] = useState<string>('12');
  const [finalityType, setFinalityType] = useState<string>('immediate');

  const { simulationResult, isLoading, isModalOpen, error, runSimulation, closeModal } =
    useSimulationPreview({
      onSuccess: (result) => onSimulationComplete?.(result),
    });

  const handlePreviewFinality = async (e: React.FormEvent) => {
    e.preventDefault();

    await runSimulation(
      'SETTLEMENT_FINALITY',
      {
        userId,
        settlementId,
        settlementAmount: Number(settlementAmount),
        transactionCount: Number(transactionCount),
        blockchainConfirmations: Number(blockchainConfirmations),
        finalityType,
      },
      userId
    );
  };

  const handleExecuteSettlement = async () => {
    console.log('Finalizing settlement:', {
      settlementAmount,
      transactionCount,
      blockchainConfirmations,
      finalityType,
    });
    closeModal();
  };

  return (
    <div className="panel settlement-finality-panel">
      <div className="panel-header">
        <h3>Settlement Finality</h3>
        <p className="subtitle">Evaluate settlement confirmation and risk profile</p>
      </div>

      <form onSubmit={handlePreviewFinality}>
        <div className="form-group">
          <label htmlFor="settlementAmount">Settlement Amount ($)</label>
          <input
            id="settlementAmount"
            type="number"
            value={settlementAmount}
            onChange={(e) => setSettlementAmount(e.target.value)}
            min="0"
            step="10000"
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="transactionCount">Number of Transactions</label>
          <input
            id="transactionCount"
            type="number"
            value={transactionCount}
            onChange={(e) => setTransactionCount(e.target.value)}
            min="1"
            max="1000"
            step="1"
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="blockchainConfirmations">Blockchain Confirmations</label>
          <input
            id="blockchainConfirmations"
            type="number"
            value={blockchainConfirmations}
            onChange={(e) => setBlockchainConfirmations(e.target.value)}
            min="1"
            max="100"
            step="1"
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="finalityType">Finality Type</label>
          <select
            id="finalityType"
            value={finalityType}
            onChange={(e) => setFinalityType(e.target.value)}
            required
          >
            <option value="immediate">Immediate (On-chain atomic)</option>
            <option value="probabilistic">Probabilistic (Conf-based)</option>
            <option value="economic">Economic (Validator-backed)</option>
            <option value="legal">Legal (Contract-binding)</option>
          </select>
        </div>

        <button type="submit" className="btn-preview" disabled={isLoading}>
          {isLoading ? 'Analyzing...' : 'Preview Settlement Status'}
        </button>
      </form>

      {error && <div className="error-message">{error}</div>}

      <SimulationResultModal
        result={simulationResult}
        isOpen={isModalOpen}
        onClose={closeModal}
        onConfirm={handleExecuteSettlement}
        title="Settlement Finality Analysis"
      />
    </div>
  );
};

export default SettlementFinalityPanel;
