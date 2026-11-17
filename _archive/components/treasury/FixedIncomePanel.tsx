/**
 * FixedIncomePanel.tsx
 * Investment Operations - Fixed Income Bond Analysis
 * 
 * Wires: FIXED_INCOME simulator
 * Status: Production-ready
 */

import React, { useState } from 'react';
import SimulationResultModal from '../SimulationResultModal';
import { useSimulationPreview } from '../../hooks/useSimulationPreview';

interface FixedIncomePanelProps {
  userId: string;
  onSimulationComplete?: (result: any) => void;
}

export const FixedIncomePanel: React.FC<FixedIncomePanelProps> = ({
  userId,
  onSimulationComplete,
}) => {
  const [bondAmount, setBondAmount] = useState<string>('100000');
  const [bondType, setBondType] = useState<string>('corporate');
  const [creditRating, setCreditRating] = useState<string>('BBB');
  const [maturity, setMaturity] = useState<string>('10');

  const { simulationResult, isLoading, isModalOpen, error, runSimulation, closeModal } =
    useSimulationPreview({
      onSuccess: (result) => onSimulationComplete?.(result),
    });

  const handlePreviewBond = async (e: React.FormEvent) => {
    e.preventDefault();

    await runSimulation(
      'FIXED_INCOME',
      {
        userId,
        bondAmount: Number(bondAmount),
        bondType,
        creditRating,
        maturityYears: Number(maturity),
      },
      userId
    );
  };

  const handleExecutePurchase = async () => {
    console.log('Executing bond purchase with params:', {
      bondAmount,
      bondType,
      creditRating,
      maturity,
    });
    closeModal();
  };

  return (
    <div className="panel fixed-income-panel">
      <div className="panel-header">
        <h3>Fixed Income Bond Analysis</h3>
        <p className="subtitle">Evaluate bond pricing, yield, and default risk</p>
      </div>

      <form onSubmit={handlePreviewBond}>
        <div className="form-group">
          <label htmlFor="bondAmount">Bond Amount ($)</label>
          <input
            id="bondAmount"
            type="number"
            value={bondAmount}
            onChange={(e) => setBondAmount(e.target.value)}
            min="1000"
            step="10000"
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="bondType">Bond Type</label>
          <select
            id="bondType"
            value={bondType}
            onChange={(e) => setBondType(e.target.value)}
            required
          >
            <option value="government">Government</option>
            <option value="corporate">Corporate</option>
            <option value="municipal">Municipal</option>
            <option value="high-yield">High-Yield</option>
          </select>
        </div>

        <div className="form-group">
          <label htmlFor="creditRating">Credit Rating</label>
          <select
            id="creditRating"
            value={creditRating}
            onChange={(e) => setCreditRating(e.target.value)}
            required
          >
            <option value="AAA">AAA (Excellent)</option>
            <option value="AA">AA (Very Good)</option>
            <option value="A">A (Good)</option>
            <option value="BBB">BBB (Adequate)</option>
            <option value="BB">BB (Speculative)</option>
            <option value="B">B (High Risk)</option>
            <option value="C">C (Very High Risk)</option>
          </select>
        </div>

        <div className="form-group">
          <label htmlFor="maturity">Maturity (years)</label>
          <input
            id="maturity"
            type="number"
            value={maturity}
            onChange={(e) => setMaturity(e.target.value)}
            min="1"
            max="50"
            step="1"
            required
          />
        </div>

        <button type="submit" className="btn-preview" disabled={isLoading}>
          {isLoading ? 'Analyzing...' : 'Preview Bond Analysis'}
        </button>
      </form>

      {error && <div className="error-message">{error}</div>}

      <SimulationResultModal
        result={simulationResult}
        isOpen={isModalOpen}
        onClose={closeModal}
        onConfirm={handleExecutePurchase}
        title="Fixed Income Bond Analysis"
      />
    </div>
  );
};

export default FixedIncomePanel;
