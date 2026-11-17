/**
 * DexSwapPanel.tsx (Enhanced)
 * 
 * Trading Dashboard Component with DEX Swap Simulation Preview
 * AMM-based trading with price impact and slippage analysis
 */

import React, { useState } from 'react';
import SimulationResultModal from '../SimulationResultModal';
import { useSimulationPreview } from '../../hooks/useSimulationPreview';
import { SimulationResult } from '../../server/services/simulationFramework';
import { SwapEngine, SwapAnalysis } from './SwapEngine';

interface SwapFormData {
  tokenFrom: string;
  tokenTo: string;
  amountIn: number;
  slippageTolerance: number; // Percentage
  minAmountOut: number;
}

interface DexSwapPanelProps {
  userId: string;
  supportedTokens: string[];
  onSwapExecuted?: (result: any) => void;
}

/**
 * DexSwapPanel Component
 * Decentralized exchange token swaps with AMM mechanics
 */
export const DexSwapPanel: React.FC<DexSwapPanelProps> = ({
  userId,
  supportedTokens,
  onSwapExecuted,
}) => {
  // Form state
  const [formData, setFormData] = useState<SwapFormData>({
    tokenFrom: supportedTokens[0] || 'USDC',
    tokenTo: supportedTokens[1] || 'ETH',
    amountIn: 0,
    slippageTolerance: 0.5, // 0.5% default
    minAmountOut: 0,
  });

  const [exchangeRate, setExchangeRate] = useState<number>(1);
  const [analysis, setAnalysis] = useState<SwapAnalysis | null>(null);

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
      console.log('DEX swap simulation successful:', result);
    },
  });

  // Use SwapEngine to compute quote and analysis
  const computeQuote = async () => {
    const req = {
      tokenIn: formData.tokenFrom,
      tokenOut: formData.tokenTo,
      amountIn: formData.amountIn,
      slippageTolerance: formData.slippageTolerance,
    };
    const a = await SwapEngine.analyzeLive(req).catch(() => SwapEngine.analyze(req));
    setAnalysis(a);
    setFormData({ ...formData, minAmountOut: a.minimumOut });
    return a;
  };

  // Handle preview button click
  const handlePreviewSwap = async (e: React.FormEvent) => {
    e.preventDefault();

    if (formData.amountIn <= 0) {
      alert('Amount must be greater than 0');
      return;
    }

    if (formData.tokenFrom === formData.tokenTo) {
      alert('Cannot swap token to itself');
      return;
    }

    const a = await computeQuote();

    // Run simulation with quote
    await runSimulation(
      'DEX_SWAP',
      {
        userId,
        tokenPath: a.route,
        amountIn: formData.amountIn,
        slippageTolerance: formData.slippageTolerance,
        minAmountOut: a.minimumOut,
        quote: a,
      },
      userId
    );
  };

  // Handle swap execution
  const handleExecuteSwap = async () => {
    try {
      const response = await fetch('/api/dex/swap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          tokenPath: analysis?.route || [formData.tokenFrom, formData.tokenTo],
          amountIn: formData.amountIn,
          minAmountOut: formData.minAmountOut,
          slippageTolerance: formData.slippageTolerance,
          quote: analysis,
        }),
      });

      if (response.ok) {
        const result = await response.json();
        onSwapExecuted?.(result);
        resetState();
        setFormData({ ...formData, amountIn: 0, minAmountOut: 0 });
      }
    } catch (error) {
      console.error('Swap execution failed:', error);
    }
  };

  const priceImpact = analysis ? analysis.priceImpact : 0;

  return (
    <div className="dex-swap-panel">
      <div className="panel-header">
        <h3>DEX Swap</h3>
        <div className="header-info">
            <span className="exchange-rate">
            1 {formData.tokenFrom} = {(analysis?.executionPrice ?? 0).toFixed(6)} {formData.tokenTo}
          </span>
        </div>
      </div>

      <form onSubmit={handlePreviewSwap} className="swap-form">
        {/* From Token */}
        <div className="form-group">
          <label htmlFor="tokenFrom">From</label>
          <div className="token-input">
            <select
              id="tokenFrom"
              value={formData.tokenFrom}
              onChange={(e) => setFormData({ ...formData, tokenFrom: e.target.value })}
            >
              {supportedTokens.map((token) => (
                <option key={token} value={token}>
                  {token}
                </option>
              ))}
            </select>
            <input
              type="number"
              step="0.0001"
              min="0"
              placeholder="0.0000"
              value={formData.amountIn}
              onChange={(e) => {
                const amount = parseFloat(e.target.value) || 0;
                setFormData({ ...formData, amountIn: amount });
              }}
            />
          </div>
        </div>

        {/* Swap Direction Toggle */}
        <div className="swap-toggle">
          <button
            type="button"
            onClick={() => {
              setFormData({
                ...formData,
                tokenFrom: formData.tokenTo,
                tokenTo: formData.tokenFrom,
                amountIn: 0,
            });
            }}
            className="toggle-button"
            title="Swap directions"
          >
            ⇅
          </button>
        </div>

        {/* To Token */}
        <div className="form-group">
          <label htmlFor="tokenTo">To</label>
          <div className="token-input">
            <select
              id="tokenTo"
              value={formData.tokenTo}
              onChange={(e) => setFormData({ ...formData, tokenTo: e.target.value })}
            >
              {supportedTokens.map((token) => (
                <option key={token} value={token}>
                  {token}
                </option>
              ))}
            </select>
            <input
              type="number"
              step="0.0001"
              min="0"
              placeholder="0.0000"
              value={(analysis?.expectedOut ?? 0)}
              readOnly
              className="output-field"
            />
          </div>
        </div>

        {/* Slippage Tolerance */}
        <div className="form-group">
          <label htmlFor="slippage">
            Slippage Tolerance: {formData.slippageTolerance}%
          </label>
          <input
            id="slippage"
            type="range"
            min="0.1"
            max="5"
            step="0.1"
            value={formData.slippageTolerance}
            onChange={(e) =>
              setFormData({ ...formData, slippageTolerance: parseFloat(e.target.value) })
            }
          />
          <div className="slippage-presets">
            <button
              type="button"
              onClick={() => setFormData({ ...formData, slippageTolerance: 0.5 })}
              className="preset"
            >
              0.5%
            </button>
            <button
              type="button"
              onClick={() => setFormData({ ...formData, slippageTolerance: 1 })}
              className="preset"
            >
              1%
            </button>
            <button
              type="button"
              onClick={() => setFormData({ ...formData, slippageTolerance: 2 })}
              className="preset"
            >
              2%
            </button>
          </div>
        </div>

        {/* Swap Details */}
        <div className="swap-details">
          <div className="detail">
            <span>Price Impact</span>
            <span className={`value ${priceImpact > 1 ? 'warning' : ''}`}>
              {(priceImpact).toFixed(3)}%
            </span>
          </div>

          <div className="detail">
            <span>Min Amount Out</span>
            <span className="value">{(analysis?.minimumOut ?? formData.minAmountOut).toFixed(6)} {formData.tokenTo}</span>
          </div>

          <div className="detail">
            <span>Expected Fee</span>
            <span className="value">{(analysis?.feePercent ?? 0).toFixed(2)}%</span>
          </div>

          {analysis?.warnings?.length ? (
            <div className="warning-message">
              <span>⚠ {analysis.warnings.join(' — ')}</span>
            </div>
          ) : null}

          {analysis && (analysis as any).hopDetails ? (
            <div className="route-details">
              <h5>Route</h5>
              <ul>
                {((analysis as any).hopDetails as any[]).map((h, idx) => (
                  <li key={idx}>
                    {h.dex}
                    {h.feePercent ? (
                      <span className="hop-fee"> — fee: {Number(h.feePercent).toFixed(3)}%</span>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>

        {/* Error Display */}
        {error && (
          <div className="error-message">
            <span>⚠️ {error}</span>
          </div>
        )}

        {priceImpact > 2 && (
          <div className="warning-message">
            <span>⚠ High price impact detected. Consider adjusting amount.</span>
          </div>
        )}

        {/* Buttons */}
        <div className="form-actions">
          <button
            type="submit"
            disabled={isLoading || formData.amountIn <= 0}
            className="btn btn-primary"
          >
            {isLoading ? 'Analyzing...' : 'Preview Swap'}
          </button>
        </div>
      </form>

      {/* Simulation Result Modal */}
      <SimulationResultModal
        result={simulationResult}
        isOpen={isModalOpen}
        onClose={closeModal}
        onConfirm={handleExecuteSwap}
        confirmButtonText="Execute Swap"
      />
    </div>
  );
};

export default DexSwapPanel;
