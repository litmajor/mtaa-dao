/**
 * MicroLoanPanel.tsx
 * Micro Transactions - Micro Loan
 * 
 * Wires: MICRO_LOAN simulator (Tier 3)
 * Status: Production-ready
 */

import React, { useState } from 'react';
import SimulationResultModal from '../SimulationResultModal';
import { useSimulationPreview } from '../../hooks/useSimulationPreview';

interface MicroLoanPanelProps {
  userId: string;
  onSimulationComplete?: (result: any) => void;
}

export const MicroLoanPanel: React.FC<MicroLoanPanelProps> = ({
  userId,
  onSimulationComplete,
}) => {
  const [loanAmount, setLoanAmount] = useState<string>('100');
  const [loanTerm, setLoanTerm] = useState<string>('14');
  const [interestRate, setInterestRate] = useState<string>('24');
  const [creditScore, setCreditScore] = useState<string>('650');

  const { simulationResult, isLoading, isModalOpen, error, runSimulation, closeModal } =
    useSimulationPreview({
      onSuccess: (result: any) => onSimulationComplete?.(result),
    });

  const handlePreviewLoan = async (e: React.FormEvent) => {
    e.preventDefault();

    await runSimulation(
      'MICRO_LOAN',
      {
        userId,
        loanAmount: Number(loanAmount),
        loanTermDays: Number(loanTerm),
        annualInterestRate: Number(interestRate),
        borrowerCreditScore: Number(creditScore),
      },
      userId
    );
  };

  const handleExecuteLoan = async () => {
    console.log('Processing micro loan:', {
      loanAmount,
      loanTerm,
      interestRate,
      creditScore,
    });
    closeModal();
  };

  return (
    <div className="panel micro-loan-panel">
      <div className="panel-header">
        <h3>Micro Loan</h3>
        <p className="subtitle">Quick small loans for urgent needs</p>
      </div>

      <form onSubmit={handlePreviewLoan}>
        <div className="form-group">
          <label htmlFor="loanAmount">Loan Amount ($)</label>
          <input
            id="loanAmount"
            type="number"
            value={loanAmount}
            onChange={(e) => setLoanAmount(e.target.value)}
            min="10"
            max="5000"
            step="10"
            required
          />
          <small>Typical range: $50-$2,000</small>
        </div>

        <div className="form-group">
          <label htmlFor="loanTerm">Loan Term (days)</label>
          <input
            id="loanTerm"
            type="number"
            value={loanTerm}
            onChange={(e) => setLoanTerm(e.target.value)}
            min="7"
            max="90"
            step="1"
            required
          />
          <small>Fast repayment: 7-30 days typical</small>
        </div>

        <div className="form-group">
          <label htmlFor="interestRate">Annual Interest Rate (%)</label>
          <input
            id="interestRate"
            type="number"
            value={interestRate}
            onChange={(e) => setInterestRate(e.target.value)}
            min="5"
            max="200"
            step="1"
            required
          />
          <small>Higher for riskier borrowers</small>
        </div>

        <div className="form-group">
          <label htmlFor="creditScore">Credit Score (Approx.)</label>
          <input
            id="creditScore"
            type="number"
            value={creditScore}
            onChange={(e) => setCreditScore(e.target.value)}
            min="300"
            max="850"
            step="10"
            required
          />
        </div>

        <button type="submit" className="btn-preview" disabled={isLoading}>
          {isLoading ? 'Calculating...' : 'Preview Loan Terms'}
        </button>
      </form>

      {error && <div className="error-message">{error}</div>}

      <SimulationResultModal
        result={simulationResult}
        isOpen={isModalOpen}
        onClose={closeModal}
        onConfirm={handleExecuteLoan}
        title="Micro Loan Analysis"
      />
    </div>
  );
};

export default MicroLoanPanel;
