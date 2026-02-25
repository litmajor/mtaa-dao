/**
 * VaultLiquidationPanel.tsx
 * Vaults - Vault Liquidation Risk Assessment
 * 
 * Wires: VAULT_LIQUIDATION simulator
 * Status: Production-ready
 */

import React, { useState } from 'react';
import SimulationResultModal from '../SimulationResultModal';
import { useSimulationPreview } from '../../hooks/useSimulationPreview';

interface VaultLiquidationPanelProps {
  userId: string;
  vaultId?: string;
  onSimulationComplete?: (result: any) => void;
}

export const VaultLiquidationPanel: React.FC<VaultLiquidationPanelProps> = ({
  userId,
  vaultId = 'default',
  onSimulationComplete,
}) => {
  const [collateralValue, setCollateralValue] = useState<string>('250000');
  const [debtAmount, setDebtAmount] = useState<string>('100000');
  const [liquidationRatio, setLiquidationRatio] = useState<string>('150');
  const [collateralVolatility, setCollateralVolatility] = useState<string>('25');

  const { simulationResult, isLoading, isModalOpen, error, runSimulation, closeModal } =
    useSimulationPreview({
      onSuccess: (result) => onSimulationComplete?.(result),
    });

  const handlePreviewLiquidation = async (e: React.FormEvent) => {
    e.preventDefault();

    await runSimulation(
      'VAULT_LIQUIDATION',
      {
        userId,
        vaultId,
        collateralValue: Number(collateralValue),
        debtAmount: Number(debtAmount),
        liquidationRatio: Number(liquidationRatio),
        collateralVolatility: Number(collateralVolatility),
      },
      userId
    );
  };

  const handleExecuteLiquidation = async () => {
    console.log('Processing vault liquidation analysis:', {
      collateralValue,
      debtAmount,
      liquidationRatio,
    });
    closeModal();
  };

  return (
    <div className="panel vault-liquidation-panel">
      <div className="panel-header">
        <h3>Vault Liquidation Risk Assessment</h3>
        <p className="subtitle">Evaluate liquidation threshold and collateral health</p>
      </div>

      <form onSubmit={handlePreviewLiquidation}>
        <div className="form-group">
          <label htmlFor="collateralValue">Collateral Value ($)</label>
          <input
            id="collateralValue"
            type="number"
            value={collateralValue}
            onChange={(e) => setCollateralValue(e.target.value)}
            min="0"
            step="10000"
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="debtAmount">Debt Amount ($)</label>
          <input
            id="debtAmount"
            type="number"
            value={debtAmount}
            onChange={(e) => setDebtAmount(e.target.value)}
            min="0"
            step="10000"
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="liquidationRatio">Liquidation Ratio (%)</label>
          <input
            id="liquidationRatio"
            type="number"
            value={liquidationRatio}
            onChange={(e) => setLiquidationRatio(e.target.value)}
            min="100"
            max="300"
            step="10"
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="collateralVolatility">Collateral Volatility (%)</label>
          <input
            id="collateralVolatility"
            type="number"
            value={collateralVolatility}
            onChange={(e) => setCollateralVolatility(e.target.value)}
            min="1"
            max="100"
            step="1"
            required
          />
        </div>

        <button type="submit" className="btn-preview" disabled={isLoading}>
          {isLoading ? 'Analyzing...' : 'Preview Liquidation Risk'}
        </button>
      </form>

      {error && <div className="error-message">{error}</div>}

      <SimulationResultModal
        result={simulationResult}
        isOpen={isModalOpen}
        onClose={closeModal}
        onConfirm={handleExecuteLiquidation}
        title="Vault Liquidation Risk Analysis"
      />
    </div>
  );
};

export default VaultLiquidationPanel;
