/**
 * FlashLoanPanel.tsx (Enhanced)
 * 
 * Trading Dashboard Component with Flash Loan Simulation Preview
 * Uncollateralized loans with execution requirements and profit analysis
 */

import React, { useState } from 'react';
import { ethers } from 'ethers';
import { FlashLoanEngine, FlashLoanAnalysis } from './FlashLoanEngine';
import StateBadge from './StateBadge';
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
  strategyAddress?: string;
  strategyParamsHex?: string; // ABI-encoded hex params (optional)
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
    strategyAddress: '',
    strategyParamsHex: '',
  });

  const [analysis, setAnalysis] = useState<FlashLoanAnalysis | null>(null);
  const [paramTemplate, setParamTemplate] = useState<string>('none');
  const [templateFields, setTemplateFields] = useState<Record<string,string>>({});
  const [tokenDecimals, setTokenDecimals] = useState<number>(18);
  const [chain, setChain] = useState<string>('ethereum');

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

  // Compute analysis using the domain engine
  const computeAnalysis = () => {
    const req = {
      asset: formData.asset,
      loanAmount: formData.loanAmount,
      loanFeePercentage: formData.loanFeePercentage,
      executionPlan: formData.executionPlan,
      estimatedProfit: formData.estimatedProfit,
      chain,
      // optional: we could pass a chain-specific gas cost override here
    };

    const a = FlashLoanEngine.analyze(req);
    setAnalysis(a);
    setFormData({ ...formData, repaymentAmount: a.repaymentAmount });
    return a;
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

    const a = computeAnalysis();

    if (a.state === 'UNPROFITABLE' || a.state === 'HIGH_RISK' || a.state === 'DRAFT') {
      alert('This flash loan is not in a viable state: ' + a.state + (a.warnings.length ? ' — ' + a.warnings.join('; ') : ''));
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
        repaymentAmount: a.repaymentAmount,
      },
      userId
    );
  };

  // Handle flash loan execution
  const handleExecuteFlashLoan = async () => {
    try {
      // Determine token decimals (best-effort) using window.ethereum if available
      let tokenDecimals = 18;
      try {
        if ((window as any).ethereum && formData.asset) {
          const provider = new ethers.BrowserProvider((window as any).ethereum);
          const erc20 = new ethers.Contract(formData.asset, ['function decimals() view returns (uint8)'], provider);
          const d: any = await erc20.decimals();
          tokenDecimals = Number(d ?? 18);
        }
      } catch (err) {
        // fallback to 18
        tokenDecimals = 18;
      }

      if (!formData.strategyAddress) {
        alert('Please provide the on-chain strategy contract address to execute');
        return;
      }

      const response = await fetch('/api/lending/flash-loans/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          asset: formData.asset,
          loanAmount: formData.loanAmount,
          loanFeePercentage: formData.loanFeePercentage,
          strategy: formData.strategyAddress,
          strategyParams: formData.strategyParamsHex || '0x',
          tokenDecimals,
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
            onChange={async (e) => {
              const newAsset = e.target.value;
              setFormData({ ...formData, asset: newAsset });
              // try to fetch decimals from wallet if available
              try {
                if ((window as any).ethereum) {
                  const provider = new ethers.BrowserProvider((window as any).ethereum);
                  const erc20 = new ethers.Contract(newAsset, ['function decimals() view returns (uint8)'], provider);
                  const d: any = await erc20.decimals();
                  setTokenDecimals(Number(d ?? 18));
                } else {
                  setTokenDecimals(18);
                }
              } catch (err) {
                setTokenDecimals(18);
              }
            }}
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
            onBlur={() => computeAnalysis()}
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

          <div style={{ marginTop: 8 }}>
            <label htmlFor="chain">Chain</label>
            <select id="chain" value={chain} onChange={(e) => setChain(e.target.value)}>
              <option value="ethereum">Ethereum</option>
              <option value="polygon">Polygon</option>
              <option value="arbitrum">Arbitrum</option>
            </select>
          </div>

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
            onBlur={() => computeAnalysis()}
          />
          <small>Expected profit after flash loan execution</small>
        </div>

        {/* Strategy Address (on-chain) */}
        <div className="form-group">
          <label htmlFor="strategyAddress">Strategy Contract Address</label>
          <input
            id="strategyAddress"
            type="text"
            placeholder="0x..."
            value={formData.strategyAddress}
            onChange={(e) => setFormData({ ...formData, strategyAddress: e.target.value })}
          />
          <small>On-chain strategy contract to be invoked by the executor (required for execute)</small>
        </div>

        {/* Strategy Params (ABI-encoded hex) */}
        <div className="form-group">
          <label htmlFor="strategyParams">Strategy Params (ABI hex)</label>
          <input
            id="strategyParams"
            type="text"
            placeholder="0x... (optional)"
            value={formData.strategyParamsHex}
            onChange={(e) => setFormData({ ...formData, strategyParamsHex: e.target.value })}
          />
          <small>Optional: ABI-encoded parameters for the strategy (hex). Leave empty for none.</small>
        </div>

        {/* Param Encoder Helper */}
        <div className="form-group param-encoder">
          <label>Param Encoder Helper</label>
          <select value={paramTemplate} onChange={(e) => { setParamTemplate(e.target.value); setTemplateFields({}); }}>
            <option value="none">None</option>
            <option value="addr_uint">(address, uint256) — target, minProfit</option>
            <option value="addr_uint_uint">(address, uint256, uint256) — target, amount, minReturn</option>
          </select>

          {paramTemplate === 'addr_uint' && (
            <div className="template-fields">
              <input
                placeholder="target address"
                value={templateFields.target || ''}
                onChange={(e) => setTemplateFields({ ...templateFields, target: e.target.value })}
              />
              <input
                placeholder="minProfit"
                value={templateFields.minProfit || ''}
                onChange={(e) => setTemplateFields({ ...templateFields, minProfit: e.target.value })}
              />
            </div>
          )}

          {paramTemplate === 'addr_uint_uint' && (
            <div className="template-fields">
              <input
                placeholder="target address"
                value={templateFields.target || ''}
                onChange={(e) => setTemplateFields({ ...templateFields, target: e.target.value })}
              />
              <input
                placeholder="amount"
                value={templateFields.amount || ''}
                onChange={(e) => setTemplateFields({ ...templateFields, amount: e.target.value })}
              />
              <input
                placeholder="minReturn"
                value={templateFields.minReturn || ''}
                onChange={(e) => setTemplateFields({ ...templateFields, minReturn: e.target.value })}
              />
            </div>
          )}

          <div style={{ marginTop: 8 }}>
            <button
              type="button"
              className="btn"
              onClick={() => {
                try {
                  if (paramTemplate === 'none') {
                    setFormData({ ...formData, strategyParamsHex: '0x' });
                    return;
                  }

                  if (paramTemplate === 'addr_uint') {
                    const target = templateFields.target || '0x0000000000000000000000000000000000000000';
                    const minProfit = templateFields.minProfit || '0';
                    const encoded = new ethers.AbiCoder().encode(['address','uint256'], [target, ethers.parseUnits(minProfit || '0', tokenDecimals)]);
                    setFormData({ ...formData, strategyParamsHex: encoded });
                    return;
                  }

                  if (paramTemplate === 'addr_uint_uint') {
                    const target = templateFields.target || '0x0000000000000000000000000000000000000000';
                    const amount = templateFields.amount || '0';
                    const minReturn = templateFields.minReturn || '0';
                    const encoded = new ethers.AbiCoder().encode(['address','uint256','uint256'], [target, ethers.parseUnits(amount || '0', tokenDecimals), ethers.parseUnits(minReturn || '0', tokenDecimals)]);
                    setFormData({ ...formData, strategyParamsHex: encoded });
                    return;
                  }
                } catch (err) {
                  console.error('Encoding error', err);
                  alert('Failed to encode params: ' + String(err));
                }
              }}
            >
              Encode Params
            </button>
          </div>
        </div>

        {/* Flash Loan Metrics */}
        <div className="flash-loan-metrics">
          <div className="metric">
            <span>Repayment Amount</span>
            <span className="value">{(analysis?.repaymentAmount ?? formData.repaymentAmount).toFixed(6)} {formData.asset}</span>
          </div>

          <div className={`metric ${(analysis?.netProfit ?? 0) >= 0 ? 'positive' : 'negative'}`}>
            <span>Net Profit</span>
            <span className={`value ${(analysis?.netProfit ?? 0) >= 0 ? 'success' : 'danger'}`}>
              {(analysis?.netProfit ?? 0).toFixed(6)} {formData.asset}
            </span>
          </div>

          <div className="metric">
            <span>Profit Margin</span>
            <span className={`value ${(analysis?.profitMargin ?? 0) > 0 ? 'success' : 'danger'}`}>
              {((analysis?.profitMarginPct ?? 0)).toFixed(2)}%
            </span>
          </div>

          <div style={{ marginTop: 8 }}>
            <StateBadge state={analysis?.state ?? 'DRAFT'} />
            {analysis?.warnings?.length ? (
              <div className="warnings">{analysis.warnings.join(' — ')}</div>
            ) : null}
          </div>
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
            disabled={
              isLoading ||
              formData.loanAmount <= 0 ||
              !(analysis && (analysis.state === 'PROFITABLE' || analysis.state === 'READY_TO_EXECUTE'))
            }
            className="btn btn-primary"
          >
            {isLoading ? 'Analyzing...' : 'Preview Flash Loan'}
          </button>

          {analysis && analysis.state === 'UNPROFITABLE' && formData.loanAmount > 0 && (
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
