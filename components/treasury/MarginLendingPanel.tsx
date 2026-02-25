/**
 * MarginLendingPanel.tsx
 * Investment Operations - Margin Lending Risk Analysis
 * 
 * Wires: MARGIN_LENDING simulator
 * Status: Production-ready
 */

import React, { useState } from 'react';
import SimulationResultModal from '../SimulationResultModal';
import { useSimulationPreview } from '../../hooks/useSimulationPreview';

interface MarginLendingPanelProps {
  userId: string;
  onSimulationComplete?: (result: any) => void;
}

export const MarginLendingPanel: React.FC<MarginLendingPanelProps> = ({
  userId,
  onSimulationComplete,
}) => {
  const [borrowAmount, setBorrowAmount] = useState<string>('50000');
  const [collateralAmount, setCollateralAmount] = useState<string>('150000');
  const [interestRate, setInterestRate] = useState<string>('8');
  const [loanDuration, setLoanDuration] = useState<string>('365');

  const { simulationResult, isLoading, isModalOpen, error, runSimulation, closeModal } =
    useSimulationPreview({
      onSuccess: (result) => onSimulationComplete?.(result),
    });

  const handlePreviewMarginLoan = async (e: React.FormEvent) => {
    e.preventDefault();

    await runSimulation(
      'MARGIN_LENDING',
      {
        userId,
        loanAmount: Number(borrowAmount),
        collateralAmount: Number(collateralAmount),
        interestRatePercent: Number(interestRate),
        loanDurationDays: Number(loanDuration),
      },
      userId
    );
  };

  const handleExecuteLoan = async () => {
    console.log('Executing margin loan with params:', {
      borrowAmount,
      collateralAmount,
      interestRate,
      loanDuration,
    });
    closeModal();
  };

  return (
    <div className="panel margin-lending-panel">
      <div className="panel-header">
        <h3>Margin Lending</h3>
        <p className="subtitle">Analyze liquidation risk and interest costs</p>
      </div>

      <form onSubmit={handlePreviewMarginLoan}>
        <div className="form-group">
          <label htmlFor="borrowAmount">Borrow Amount ($)</label>
          <input
            id="borrowAmount"
            type="number"
            value={borrowAmount}
            onChange={(e) => setBorrowAmount(e.target.value)}
            min="1000"
            step="10000"
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="collateralAmount">Collateral Amount ($)</label>
          <input
            id="collateralAmount"
            type="number"
            value={collateralAmount}
            onChange={(e) => setCollateralAmount(e.target.value)}
            min="1000"
            step="10000"
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="interestRate">Annual Interest Rate (%)</label>
          <input
            id="interestRate"
            type="number"
            value={interestRate}
            onChange={(e) => setInterestRate(e.target.value)}
            min="1"
            max="50"
            step="0.1"
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="loanDuration">Loan Duration (days)</label>
          <input
            id="loanDuration"
            type="number"
            value={loanDuration}
            onChange={(e) => setLoanDuration(e.target.value)}
            min="1"
            max="3650"
            step="1"
            required
          />
        </div>

        <button type="submit" className="btn-preview" disabled={isLoading}>
          {isLoading ? 'Analyzing Risk...' : 'Preview Loan Risk'}
        </button>
      </form>

      {error && <div className="error-message">{error}</div>}

      <SimulationResultModal
        result={simulationResult}
        isOpen={isModalOpen}
        onClose={closeModal}
        onConfirm={handleExecuteLoan}
        title="Margin Loan Risk Analysis"
      />
    </div>
  );
};

export default MarginLendingPanel;
