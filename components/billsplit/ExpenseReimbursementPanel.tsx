/**
 * ExpenseReimbursementPanel.tsx
 * Bill Split - Expense Reimbursement
 * 
 * Wires: EXPENSE_REIMBURSEMENT simulator
 * Status: Production-ready
 */

import React, { useState } from 'react';
import SimulationResultModal from '../SimulationResultModal';
import { useSimulationPreview } from '../../hooks/useSimulationPreview';

interface ExpenseReimbursementPanelProps {
  userId: string;
  onSimulationComplete?: (result: any) => void;
}

export const ExpenseReimbursementPanel: React.FC<ExpenseReimbursementPanelProps> = ({
  userId,
  onSimulationComplete,
}) => {
  const [totalExpense, setTotalExpense] = useState<string>('500');
  const [personWhoPaid, setPersonWhoPaid] = useState<string>('Alice');
  const [sharedAmount, setSharedAmount] = useState<string>('0');
  const [numberOfShares, setNumberOfShares] = useState<string>('4');

  const { simulationResult, isLoading, isModalOpen, error, runSimulation, closeModal } =
    useSimulationPreview({
      onSuccess: (result: any) => onSimulationComplete?.(result),
    });

  const handlePreviewReimbursement = async (e: React.FormEvent) => {
    e.preventDefault();

    await runSimulation(
      'EXPENSE_REIMBURSEMENT',
      {
        userId,
        totalExpense: Number(totalExpense),
        personWhoPaid,
        sharedAmount: Number(sharedAmount) || Number(totalExpense),
        numberOfShareHolders: Number(numberOfShares),
      },
      userId
    );
  };

  const handleExecuteReimbursement = async () => {
    console.log('Processing expense reimbursement:', {
      totalExpense,
      personWhoPaid,
      sharedAmount,
      numberOfShares,
    });
    closeModal();
  };

  return (
    <div className="panel expense-reimbursement-panel">
      <div className="panel-header">
        <h3>Expense Reimbursement</h3>
        <p className="subtitle">Calculate reimbursements when one person paid for shared expenses</p>
      </div>

      <form onSubmit={handlePreviewReimbursement}>
        <div className="form-group">
          <label htmlFor="totalExpense">Total Expense Amount ($)</label>
          <input
            id="totalExpense"
            type="number"
            value={totalExpense}
            onChange={(e) => setTotalExpense(e.target.value)}
            min="0.01"
            step="10"
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="personWhoPaid">Person Who Paid</label>
          <input
            id="personWhoPaid"
            type="text"
            value={personWhoPaid}
            onChange={(e) => setPersonWhoPaid(e.target.value)}
            placeholder="e.g., Alice"
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="sharedAmount">Shared Amount ($ - leave 0 for all)</label>
          <input
            id="sharedAmount"
            type="number"
            value={sharedAmount}
            onChange={(e) => setSharedAmount(e.target.value)}
            min="0"
            step="10"
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="numberOfShares">Number of People Sharing</label>
          <input
            id="numberOfShares"
            type="number"
            value={numberOfShares}
            onChange={(e) => setNumberOfShares(e.target.value)}
            min="2"
            max="20"
            step="1"
            required
          />
        </div>

        <button type="submit" className="btn-preview" disabled={isLoading}>
          {isLoading ? 'Calculating...' : 'Preview Reimbursement Breakdown'}
        </button>
      </form>

      {error && <div className="error-message">{error}</div>}

      <SimulationResultModal
        result={simulationResult}
        isOpen={isModalOpen}
        onClose={closeModal}
        onConfirm={handleExecuteReimbursement}
      />
    </div>
  );
};

export default ExpenseReimbursementPanel;
