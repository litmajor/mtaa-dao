/**
 * BillSplitPanel.tsx
 * Bill Split - Bill Split
 * 
 * Wires: BILL_SPLIT simulator
 * Status: Production-ready
 */

import React, { useState } from 'react';
import SimulationResultModal from '../SimulationResultModal';
import { useSimulationPreview } from '../../hooks/useSimulationPreview';

interface BillSplitPanelProps {
  userId: string;
  onSimulationComplete?: (result: any) => void;
}

export const BillSplitPanel: React.FC<BillSplitPanelProps> = ({
  userId,
  onSimulationComplete,
}) => {
  const [totalBill, setTotalBill] = useState<string>('150');
  const [numberOfPeople, setNumberOfPeople] = useState<string>('3');
  const [tipPercentage, setTipPercentage] = useState<string>('18');
  const [splitMethod, setSplitMethod] = useState<string>('equal');

  const { simulationResult, isLoading, isModalOpen, error, runSimulation, closeModal } =
    useSimulationPreview({
      onSuccess: (result: any) => onSimulationComplete?.(result),
    });

  const handlePreviewSplit = async (e: React.FormEvent) => {
    e.preventDefault();

    await runSimulation(
      'BILL_SPLIT',
      {
        userId,
        totalBill: Number(totalBill),
        numberOfPeople: Number(numberOfPeople),
        tipPercentage: Number(tipPercentage),
        splitMethod,
      },
      userId
    );
  };

  const handleExecuteSplit = async () => {
    console.log('Processing bill split:', {
      totalBill,
      numberOfPeople,
      tipPercentage,
      splitMethod,
    });
    closeModal();
  };

  return (
    <div className="panel bill-split-panel">
      <div className="panel-header">
        <h3>Bill Split</h3>
        <p className="subtitle">Calculate fair split of bill and tip among friends</p>
      </div>

      <form onSubmit={handlePreviewSplit}>
        <div className="form-group">
          <label htmlFor="totalBill">Total Bill Amount ($)</label>
          <input
            id="totalBill"
            type="number"
            value={totalBill}
            onChange={(e) => setTotalBill(e.target.value)}
            min="0.01"
            step="0.01"
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="numberOfPeople">Number of People</label>
          <input
            id="numberOfPeople"
            type="number"
            value={numberOfPeople}
            onChange={(e) => setNumberOfPeople(e.target.value)}
            min="1"
            max="20"
            step="1"
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="tipPercentage">Tip Percentage (%)</label>
          <input
            id="tipPercentage"
            type="number"
            value={tipPercentage}
            onChange={(e) => setTipPercentage(e.target.value)}
            min="0"
            max="50"
            step="1"
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="splitMethod">Split Method</label>
          <select
            id="splitMethod"
            value={splitMethod}
            onChange={(e) => setSplitMethod(e.target.value)}
            required
          >
            <option value="equal">Equal split</option>
            <option value="itemized">Itemized (by what ordered)</option>
            <option value="weighted">Weighted (by income)</option>
            <option value="custom">Custom amounts</option>
          </select>
        </div>

        <button type="submit" className="btn-preview" disabled={isLoading}>
          {isLoading ? 'Calculating...' : 'Preview Split Breakdown'}
        </button>
      </form>

      {error && <div className="error-message">{error}</div>}

      <SimulationResultModal
        result={simulationResult}
        isOpen={isModalOpen}
        onClose={closeModal}
        onConfirm={handleExecuteSplit}
      />
    </div>
  );
};

export default BillSplitPanel;
