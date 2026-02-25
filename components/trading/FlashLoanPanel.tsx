/**
 * FlashLoanPanel.tsx (Enhanced)
 * 
 * Trading Dashboard Component with Flash Loan Simulation Preview
 * Uncollateralized loans with execution requirements and profit analysis
 */

import React, { useState } from 'react';
import SimulationResultModal from '../SimulationResultModal';
import { useSimulationPreview } from '../../hooks/useSimulationPreview';
import { SimulationResult } from '../../server/services/simulationFramework';

interface FlashLoanFormData {
  asset: string;
  loanAmount: number;
  loanFeePercentage: number; // 0.09% typical
  executionPlan: string; // 'ARBITRAGE' | 'LIQUIDATION' | 'REFINANCE'
  estimatedProfit: number;
  repaymentAmount: number;
}

interface FlashLoanPanelProps {
  userId: string;
  availableAssets: string[];
  onFlashLoanExecuted?: (result: any) => void;
}

/**
 * FlashLoanPanel Component
 * Flash loan execution with arbitrage/liquidation/refinance strategies
 */
export const FlashLoanPanel: React.FC<FlashLoanPanelProps> = ({
  userId,
  availableAssets,
  onFlashLoanExecuted,
}) => {
  // Form state
  const [formData, setFormData] = useState<FlashLoanFormData>({
    asset: availableAssets[0] || 'USDC',
    loanAmount: 0,
    loanFeePercentage: 0.09, // 0.09% is standard (e.g., Aave)
    executionPlan: 'ARBITRAGE',
    estimatedProfit: 0,
    repaymentAmount: 0,
  });

  const [profitMargin, setProfitMargin] = useState<number>(0);
  const [isViableFlashloan, setIsViableFlashLoan] = useState<boolean>(false);

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
      console.log('Flash loan simulation successful:', result);
    },
  });

  // Calculate repayment and profit margin
  const calculateFlashLoanMetrics = () => {
    const fee = formData.loanAmount * (formData.loanFeePercentage / 100);
    const repayment = formData.loanAmount + fee;
    const margin = formData.estimatedProfit - fee;
    const isViable = margin > 0;

    setFormData({
      ...formData,
      repaymentAmount: repayment,
    });

    setProfitMargin(margin);
    setIsViableFlashLoan(isViable);

    return { repayment, margin, isViable };
  };

  // Handle preview button click
  const handlePreviewFlashLoan = async (e: React.FormEvent) => {
    e.preventDefault();

    if (formData.loanAmount <= 0) {
      alert('Loan amount must be greater than 0');
      return;
    }

    if (formData.estimatedProfit <= 0) {
      alert('Estimated profit must be greater than 0');
      return;
    }

    const { repayment } = calculateFlashLoanMetrics();

    if (!isViableFlashloan) {
      alert('This flash loan would result in a loss. Strategy is not viable.');
      return;
    }

    // Run simulation
    await runSimulation(
      'FLASH_LOAN',
      {
        userId,
        asset: formData.asset,
        loanAmount: formData.loanAmount,
        loanFeePercentage: formData.loanFeePercentage,
        executionPlan: formData.executionPlan,
        estimatedProfit: formData.estimatedProfit,
        repaymentAmount: repayment,
      },
      userId
    );
  };

  // Handle flash loan execution
  const handleExecuteFlashLoan = async () => {
    try {
      const response = await fetch('/api/flash-loan/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          asset: formData.asset,
          loanAmount: formData.loanAmount,
          loanFeePercentage: formData.loanFeePercentage,
          executionPlan: formData.executionPlan,
          repaymentAmount: formData.repaymentAmount,
        }),
      });

      if (response.ok) {
        const result = await response.json();
        onFlashLoanExecuted?.(result);
        resetState();
        setFormData({
          ...formData,
          loanAmount: 0,
          estimatedProfit: 0,
          repaymentAmount: 0,
        });
      }
    } catch (error) {
      console.error('Flash loan execution failed:', error);
    }
  };

  const fee = formData.loanAmount * (formData.loanFeePercentage / 100);

  return (
    <div className="flash-loan-panel">
      <div className="panel-header">
        <h3>Flash Loan Arbitrage</h3>
        <div className="header-info">
          <span className="fee-rate">Fee: {formData.loanFeePercentage}% per loan</span>
        </div>
      </div>

      <form onSubmit={handlePreviewFlashLoan} className="flash-loan-form">
        {/* Asset Selection */}
        <div className="form-group">
          <label htmlFor="asset">Asset to Borrow</label>
          <select
            id="asset"
            value={formData.asset}
            onChange={(e) => setFormData({ ...formData, asset: e.target.value })}
          >
            {availableAssets.map((asset) => (
              <option key={asset} value={asset}>
                {asset}
              </option>
            ))}
          </select>
        </div>

        {/* Loan Amount */}
        <div className="form-group">
          <label htmlFor="loanAmount">Loan Amount ({formData.asset})</label>
          <input
            id="loanAmount"
            type="number"
            step="0.01"
            min="0"
            placeholder="0.00"
            value={formData.loanAmount}
            onChange={(e) => setFormData({ ...formData, loanAmount: parseFloat(e.target.value) || 0 })}
            onBlur={calculateFlashLoanMetrics}
          />
        </div>

        {/* Fee Display */}
        <div className="form-group">
          <label htmlFor="loanFee">Loan Fee</label>
          <div className="fee-display">
            <span className="fee-amount">{fee.toFixed(6)} {formData.asset}</span>
            <span className="fee-percentage">({formData.loanFeePercentage}%)</span>
          </div>
        </div>

        {/* Execution Plan */}
        <div className="form-group">
          <label htmlFor="executionPlan">Strategy</label>
          <select
            id="executionPlan"
            value={formData.executionPlan}
            onChange={(e) => setFormData({ ...formData, executionPlan: e.target.value })}
          >
            <option value="ARBITRAGE">Arbitrage (DEX/CEX price difference)</option>
            <option value="LIQUIDATION">Liquidation (flash loan + liquidation)</option>
            <option value="REFINANCE">Refinance (optimize debt position)</option>
          </select>

          {/* Strategy Description */}
          <div className="strategy-description">
            {formData.executionPlan === 'ARBITRAGE' && (
              <p>Execute arbitrage between multiple DEX/CEX venues. Profit from price discrepancies.</p>
            )}
            {formData.executionPlan === 'LIQUIDATION' && (
              <p>Use flash loan to liquidate undercollateralized positions. Keep liquidation bonus.</p>
            )}
            {formData.executionPlan === 'REFINANCE' && (
              <p>Flash loan to repay and rebalance debt at better rates or on better terms.</p>
            )}
          </div>
        </div>

        {/* Estimated Profit */}
        <div className="form-group">
          <label htmlFor="estimatedProfit">
            Estimated Profit ({formData.asset})
          </label>
          <input
            id="estimatedProfit"
            type="number"
            step="0.01"
            min="0"
            placeholder="0.00"
            value={formData.estimatedProfit}
            onChange={(e) => setFormData({ ...formData, estimatedProfit: parseFloat(e.target.value) || 0 })}
            onBlur={calculateFlashLoanMetrics}
          />
          <small>Expected profit after flash loan execution</small>
        </div>

        {/* Flash Loan Metrics */}
        <div className="flash-loan-metrics">
          <div className="metric">
            <span>Repayment Amount</span>
            <span className="value">{formData.repaymentAmount.toFixed(6)} {formData.asset}</span>
          </div>

          <div className={`metric ${profitMargin >= 0 ? 'positive' : 'negative'}`}>
            <span>Net Profit</span>
            <span className={`value ${profitMargin >= 0 ? 'success' : 'danger'}`}>
              {profitMargin.toFixed(6)} {formData.asset}
            </span>
          </div>

          <div className="metric">
            <span>Profit Margin</span>
            <span className={`value ${profitMargin > 0 ? 'success' : 'danger'}`}>
              {((profitMargin / formData.loanAmount) * 100).toFixed(2)}%
            </span>
          </div>

          {isViableFlashloan && (
            <div className="viability-indicator success">
              ✓ Flash loan is profitable
            </div>
          )}
          {!isViableFlashloan && formData.loanAmount > 0 && (
            <div className="viability-indicator error">
              ✗ Flash loan would result in loss
            </div>
          )}
        </div>

        {/* Risk Disclaimer */}
        <div className="risk-section">
          <h4>⚠️ Risks</h4>
          <ul>
            <li><strong>Execution Risk:</strong> Transaction must execute within same block</li>
            <li><strong>Slippage Risk:</strong> Price impact may reduce profitability</li>
            <li><strong>Gas Cost:</strong> High gas costs can eliminate small profit margins</li>
            <li><strong>Front-Running:</strong> MEV attacks can sandwich transactions</li>
          </ul>
        </div>

        {/* Error Display */}
        {error && (
          <div className="error-message">
            <span>⚠️ {error}</span>
          </div>
        )}

        {/* Buttons */}
        <div className="form-actions">
          <button
            type="submit"
            disabled={isLoading || formData.loanAmount <= 0 || !isViableFlashloan}
            className="btn btn-primary"
          >
            {isLoading ? 'Analyzing...' : 'Preview Flash Loan'}
          </button>

          {!isViableFlashloan && formData.loanAmount > 0 && (
            <span className="button-note">Not viable - would result in loss</span>
          )}
        </div>
      </form>

      {/* Simulation Result Modal */}
      <SimulationResultModal
        result={simulationResult}
        isOpen={isModalOpen}
        onClose={closeModal}
        onConfirm={handleExecuteFlashLoan}
        confirmButtonText="Execute Flash Loan"
      />
    </div>
  );
};

export default FlashLoanPanel;
