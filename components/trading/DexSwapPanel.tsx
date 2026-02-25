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
  const [expectedAmountOut, setExpectedAmountOut] = useState<number>(0);

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

  // Calculate expected output with slippage
  const calculateExpectedOutput = () => {
    // Simple estimation (would fetch real rates from DEX API)
    const baseOutput = formData.amountIn * exchangeRate;
    const slippageAmount = baseOutput * (formData.slippageTolerance / 100);
    const finalOutput = baseOutput - slippageAmount;

    setExpectedAmountOut(finalOutput);
    setFormData({
      ...formData,
      minAmountOut: finalOutput,
    });

    return finalOutput;
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

    // Build token path
    const tokenPath = [formData.tokenFrom, formData.tokenTo];

    // Run simulation
    await runSimulation(
      'DEX_SWAP',
      {
        userId,
        tokenPath,
        amountIn: formData.amountIn,
        slippageTolerance: formData.slippageTolerance,
        minAmountOut: formData.minAmountOut,
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
          tokenPath: [formData.tokenFrom, formData.tokenTo],
          amountIn: formData.amountIn,
          minAmountOut: formData.minAmountOut,
          slippageTolerance: formData.slippageTolerance,
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

  const priceImpact = ((formData.amountIn * exchangeRate - expectedAmountOut) / (formData.amountIn * exchangeRate)) * 100;

  return (
    <div className="dex-swap-panel">
      <div className="panel-header">
        <h3>DEX Swap</h3>
        <div className="header-info">
          <span className="exchange-rate">
            1 {formData.tokenFrom} = {exchangeRate.toFixed(6)} {formData.tokenTo}
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
              onBlur={calculateExpectedOutput}
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
              value={expectedAmountOut}
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
            onChangeCapture={calculateExpectedOutput}
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
              {priceImpact.toFixed(3)}%
            </span>
          </div>

          <div className="detail">
            <span>Min Amount Out</span>
            <span className="value">{formData.minAmountOut.toFixed(6)} {formData.tokenTo}</span>
          </div>

          <div className="detail">
            <span>Expected Fee</span>
            <span className="value">0.25%</span>
          </div>
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
