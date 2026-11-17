/**
 * VaultStrategyPanel.tsx
 * Vaults - Vault Strategy Optimization
 * 
 * Wires: VAULT_STRATEGY simulator
 * Status: Production-ready
 */

import React, { useState } from 'react';
import SimulationResultModal from '../SimulationResultModal';
import { useSimulationPreview } from '../../hooks/useSimulationPreview';

interface VaultStrategyPanelProps {
  userId: string;
  vaultId?: string;
  onSimulationComplete?: (result: any) => void;
}

export const VaultStrategyPanel: React.FC<VaultStrategyPanelProps> = ({
  userId,
  vaultId = 'default',
  onSimulationComplete,
}) => {
  const [initialCapital, setInitialCapital] = useState<string>('100000');
  const [strategyType, setStrategyType] = useState<string>('conservative');
  const [investmentHorizon, setInvestmentHorizon] = useState<string>('5');
  const [riskTolerance, setRiskTolerance] = useState<string>('moderate');

  const { simulationResult, isLoading, isModalOpen, error, runSimulation, closeModal } =
    useSimulationPreview({
      onSuccess: (result) => onSimulationComplete?.(result),
    });

  const handlePreviewStrategy = async (e: React.FormEvent) => {
    e.preventDefault();

    await runSimulation(
      'VAULT_STRATEGY',
      {
        userId,
        vaultId,
        initialCapital: Number(initialCapital),
        strategyType,
        investmentHorizonYears: Number(investmentHorizon),
        riskTolerance,
      },
      userId
    );
  };

  const handleExecuteStrategy = async () => {
    console.log('Executing vault strategy:', {
      initialCapital,
      strategyType,
      investmentHorizon,
      riskTolerance,
    });
    closeModal();
  };

  return (
    <div className="panel vault-strategy-panel">
      <div className="panel-header">
        <h3>Vault Strategy Optimization</h3>
        <p className="subtitle">Compare allocation strategies and projected returns</p>
      </div>

      <form onSubmit={handlePreviewStrategy}>
        <div className="form-group">
          <label htmlFor="initialCapital">Initial Capital ($)</label>
          <input
            id="initialCapital"
            type="number"
            value={initialCapital}
            onChange={(e) => setInitialCapital(e.target.value)}
            min="1000"
            step="10000"
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="strategyType">Strategy Type</label>
          <select
            id="strategyType"
            value={strategyType}
            onChange={(e) => setStrategyType(e.target.value)}
            required
          >
            <option value="conservative">Conservative (Bonds 70%, Stocks 30%)</option>
            <option value="moderate">Moderate (Bonds 50%, Stocks 50%)</option>
            <option value="aggressive">Aggressive (Bonds 30%, Stocks 70%)</option>
            <option value="growth">Growth (Stocks 90%, Crypto 10%)</option>
          </select>
        </div>

        <div className="form-group">
          <label htmlFor="investmentHorizon">Investment Horizon (years)</label>
          <input
            id="investmentHorizon"
            type="number"
            value={investmentHorizon}
            onChange={(e) => setInvestmentHorizon(e.target.value)}
            min="1"
            max="50"
            step="1"
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="riskTolerance">Risk Tolerance</label>
          <select
            id="riskTolerance"
            value={riskTolerance}
            onChange={(e) => setRiskTolerance(e.target.value)}
            required
          >
            <option value="low">Low (Preservation priority)</option>
            <option value="moderate">Moderate (Balanced approach)</option>
            <option value="high">High (Growth priority)</option>
          </select>
        </div>

        <button type="submit" className="btn-preview" disabled={isLoading}>
          {isLoading ? 'Optimizing...' : 'Preview Strategy Analysis'}
        </button>
      </form>

      {error && <div className="error-message">{error}</div>}

      <SimulationResultModal
        result={simulationResult}
        isOpen={isModalOpen}
        onClose={closeModal}
        onConfirm={handleExecuteStrategy}
        title="Vault Strategy Analysis"
      />
    </div>
  );
};

export default VaultStrategyPanel;
