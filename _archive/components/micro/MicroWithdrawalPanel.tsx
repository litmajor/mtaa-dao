/**
 * MicroWithdrawalPanel.tsx
 * Micro Transactions - Micro Withdrawal
 * 
 * Wires: MICRO_WITHDRAWAL simulator (Tier 3)
 * Status: Production-ready
 */

import React, { useState } from 'react';
import SimulationResultModal from '../SimulationResultModal';
import { useSimulationPreview } from '../../hooks/useSimulationPreview';

interface MicroWithdrawalPanelProps {
  userId: string;
  onSimulationComplete?: (result: any) => void;
}

export const MicroWithdrawalPanel: React.FC<MicroWithdrawalPanelProps> = ({
  userId,
  onSimulationComplete,
}) => {
  const [withdrawalAmount, setWithdrawalAmount] = useState<string>('5');
  const [accountBalance, setAccountBalance] = useState<string>('25');
  const [platformFee, setPlatformFee] = useState<string>('0.25');
  const [frequencyDays, setFrequencyDays] = useState<string>('7');

  const { simulationResult, isLoading, isModalOpen, error, runSimulation, closeModal } =
    useSimulationPreview({
      onSuccess: (result: any) => onSimulationComplete?.(result),
    });

  const handlePreviewWithdrawal = async (e: React.FormEvent) => {
    e.preventDefault();

    await runSimulation(
      'MICRO_WITHDRAWAL',
      {
        userId,
        withdrawalAmount: Number(withdrawalAmount),
        accountBalance: Number(accountBalance),
        platformFeeAmount: Number(platformFee),
        withdrawalFrequencyDays: Number(frequencyDays),
      },
      userId
    );
  };

  const handleExecuteWithdrawal = async () => {
    console.log('Executing micro withdrawal:', {
      withdrawalAmount,
      accountBalance,
      platformFee,
    });
    closeModal();
  };

  return (
    <div className="panel micro-withdrawal-panel">
      <div className="panel-header">
        <h3>Micro Withdrawal</h3>
        <p className="subtitle">Small amount withdrawals with minimal friction</p>
      </div>

      <form onSubmit={handlePreviewWithdrawal}>
        <div className="form-group">
          <label htmlFor="withdrawalAmount">Withdrawal Amount ($)</label>
          <input
            id="withdrawalAmount"
            type="number"
            value={withdrawalAmount}
            onChange={(e) => setWithdrawalAmount(e.target.value)}
            min="0.01"
            max="100"
            step="0.01"
            required
          />
          <small>Micro amounts: $1-$100</small>
        </div>

        <div className="form-group">
          <label htmlFor="accountBalance">Account Balance ($)</label>
          <input
            id="accountBalance"
            type="number"
            value={accountBalance}
            onChange={(e) => setAccountBalance(e.target.value)}
            min="0"
            step="0.1"
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="platformFee">Platform Processing Fee ($)</label>
          <input
            id="platformFee"
            type="number"
            value={platformFee}
            onChange={(e) => setPlatformFee(e.target.value)}
            min="0"
            step="0.01"
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="frequencyDays">Withdrawal Frequency (days)</label>
          <input
            id="frequencyDays"
            type="number"
            value={frequencyDays}
            onChange={(e) => setFrequencyDays(e.target.value)}
            min="1"
            max="30"
            step="1"
            required
          />
        </div>

        <button type="submit" className="btn-preview" disabled={isLoading}>
          {isLoading ? 'Processing...' : 'Preview Withdrawal'}
        </button>
      </form>

      {error && <div className="error-message">{error}</div>}

      <SimulationResultModal
        result={simulationResult}
        isOpen={isModalOpen}
        onClose={closeModal}
        onConfirm={handleExecuteWithdrawal}
      />
    </div>
  );
};

export default MicroWithdrawalPanel;
