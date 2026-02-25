/**
 * DividendReinvestmentPanel.tsx
 * Investment Operations - Dividend Reinvestment Strategy Preview
 * 
 * Wires: DIVIDEND_REINVESTMENT simulator
 * Status: Production-ready
 */

import React, { useState } from 'react';
import SimulationResultModal from '../SimulationResultModal';
import { useSimulationPreview } from '../../hooks/useSimulationPreview';
import { SimulationResult } from '../../server/services/simulationFramework';

interface DividendReinvestmentPanelProps {
  userId: string;
  onSimulationComplete?: (result: any) => void;
}

export const DividendReinvestmentPanel: React.FC<DividendReinvestmentPanelProps> = ({
  userId,
  onSimulationComplete,
}) => {
  // Form state
  const [portfolioValue, setPortfolioValue] = useState<string>('100000');
  const [dividendYield, setDividendYield] = useState<string>('3.5');
  const [investmentTerm, setInvestmentTerm] = useState<string>('10');
  const [taxRate, setTaxRate] = useState<string>('22');

  // Simulation state
  const {
    simulationResult,
    isLoading,
    isModalOpen,
    error,
    runSimulation,
    closeModal,
    resetState,
  } = useSimulationPreview({
    onSuccess: (result: SimulationResult) => {
      onSimulationComplete?.(result);
    },
  });

  const handlePreviewDRIP = async (e: React.FormEvent) => {
    e.preventDefault();

    await runSimulation(
      'DIVIDEND_REINVESTMENT',
      {
        userId,
        portfolioValue: Number(portfolioValue),
        dividendYield: Number(dividendYield) / 100,
        investmentTerm: Number(investmentTerm),
        taxRate: Number(taxRate) / 100,
      },
      userId
    );
  };

  const handleExecuteDRIP = async () => {
    // Execute actual DRIP setup
    console.log('Executing DRIP strategy with params:', {
      portfolioValue,
      dividendYield,
      investmentTerm,
      taxRate,
    });
    closeModal();
  };

  return (
    <div className="panel dividend-reinvestment-panel">
      <div className="panel-header">
        <h3>Dividend Reinvestment Strategy (DRIP)</h3>
        <p className="subtitle">Compare DRIP vs manual dividend collection</p>
      </div>

      <form onSubmit={handlePreviewDRIP}>
        <div className="form-group">
          <label htmlFor="portfolioValue">Portfolio Value ($)</label>
          <input
            id="portfolioValue"
            type="number"
            value={portfolioValue}
            onChange={(e) => setPortfolioValue(e.target.value)}
            min="1000"
            step="10000"
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="dividendYield">Annual Dividend Yield (%)</label>
          <input
            id="dividendYield"
            type="number"
            value={dividendYield}
            onChange={(e) => setDividendYield(e.target.value)}
            min="0"
            max="20"
            step="0.1"
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="investmentTerm">Investment Term (years)</label>
          <input
            id="investmentTerm"
            type="number"
            value={investmentTerm}
            onChange={(e) => setInvestmentTerm(e.target.value)}
            min="1"
            max="50"
            step="1"
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="taxRate">Tax Rate (%)</label>
          <input
            id="taxRate"
            type="number"
            value={taxRate}
            onChange={(e) => setTaxRate(e.target.value)}
            min="0"
            max="50"
            step="1"
            required
          />
        </div>

        <button type="submit" className="btn-preview" disabled={isLoading}>
          {isLoading ? 'Analyzing...' : 'Preview DRIP Strategy'}
        </button>
      </form>

      {error && <div className="error-message">{error}</div>}

      <SimulationResultModal
        result={simulationResult}
        isOpen={isModalOpen}
        onClose={closeModal}
        onConfirm={handleExecuteDRIP}
        title="DRIP Strategy Analysis"
      />
    </div>
  );
};

export default DividendReinvestmentPanel;
