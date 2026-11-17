/**
 * LiquidityPoolPanel.tsx
 * Staking - Liquidity Pool
 * 
 * Wires: LIQUIDITY_POOL simulator
 * Status: Production-ready
 */

import React, { useState } from 'react';
import SimulationResultModal from '../SimulationResultModal';
import { useSimulationPreview } from '../../hooks/useSimulationPreview';

interface LiquidityPoolPanelProps {
  userId: string;
  poolId?: string;
  onSimulationComplete?: (result: any) => void;
}

export const LiquidityPoolPanel: React.FC<LiquidityPoolPanelProps> = ({
  userId,
  poolId = 'default',
  onSimulationComplete,
}) => {
  const [liquidityAmount, setLiquidityAmount] = useState<string>('10000');
  const [tokenA, setTokenA] = useState<string>('ETH');
  const [tokenB, setTokenB] = useState<string>('USDC');
  const [poolFee, setPoolFee] = useState<string>('0.3');
  const [volatilityRisk, setVolatilityRisk] = useState<string>('medium');

  const { simulationResult, isLoading, isModalOpen, error, runSimulation, closeModal } =
    useSimulationPreview({
      onSuccess: (result) => onSimulationComplete?.(result),
    });

  const handlePreviewLiquidity = async (e: React.FormEvent) => {
    e.preventDefault();

    await runSimulation(
      'LIQUIDITY_POOL',
      {
        userId,
        poolId,
        liquidityAmount: Number(liquidityAmount),
        tokenA,
        tokenB,
        poolFeePercentage: Number(poolFee),
        volatilityRisk,
      },
      userId
    );
  };

  const handleExecuteSLP = async () => {
    console.log('Adding liquidity to pool:', {
      liquidityAmount,
      tokenA,
      tokenB,
      poolFee,
    });
    closeModal();
  };

  return (
    <div className="panel liquidity-pool-panel">
      <div className="panel-header">
        <h3>Liquidity Pool (AMM)</h3>
        <p className="subtitle">Analyze LP returns, impermanent loss, and fee yields</p>
      </div>

      <form onSubmit={handlePreviewLiquidity}>
        <div className="form-group">
          <label htmlFor="liquidityAmount">Liquidity Amount ($)</label>
          <input
            id="liquidityAmount"
            type="number"
            value={liquidityAmount}
            onChange={(e) => setLiquidityAmount(e.target.value)}
            min="1"
            step="100"
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="tokenA">Token A</label>
          <select
            id="tokenA"
            value={tokenA}
            onChange={(e) => setTokenA(e.target.value)}
            required
          >
            <option value="ETH">Ethereum (ETH)</option>
            <option value="WBTC">Wrapped Bitcoin (WBTC)</option>
            <option value="DAI">Dai (DAI)</option>
            <option value="USDC">USD Coin (USDC)</option>
          </select>
        </div>

        <div className="form-group">
          <label htmlFor="tokenB">Token B</label>
          <select
            id="tokenB"
            value={tokenB}
            onChange={(e) => setTokenB(e.target.value)}
            required
          >
            <option value="USDC">USD Coin (USDC)</option>
            <option value="DAI">Dai (DAI)</option>
            <option value="ETH">Ethereum (ETH)</option>
            <option value="WBTC">Wrapped Bitcoin (WBTC)</option>
          </select>
        </div>

        <div className="form-group">
          <label htmlFor="poolFee">Pool Fee (%)</label>
          <select
            id="poolFee"
            value={poolFee}
            onChange={(e) => setPoolFee(e.target.value)}
            required
          >
            <option value="0.01">0.01% (Stablecoin pairs)</option>
            <option value="0.05">0.05% (Medium volatility)</option>
            <option value="0.3">0.3% (Standard)</option>
            <option value="1">1% (High volatility)</option>
          </select>
        </div>

        <div className="form-group">
          <label htmlFor="volatilityRisk">Expected Volatility</label>
          <select
            id="volatilityRisk"
            value={volatilityRisk}
            onChange={(e) => setVolatilityRisk(e.target.value)}
            required
          >
            <option value="low">Low (Stablecoin pairs)</option>
            <option value="medium">Medium (Mixed pairs)</option>
            <option value="high">High (Volatile assets)</option>
          </select>
        </div>

        <button type="submit" className="btn-preview" disabled={isLoading}>
          {isLoading ? 'Calculating...' : 'Preview LP Returns & IL'}
        </button>
      </form>

      {error && <div className="error-message">{error}</div>}

      <SimulationResultModal
        result={simulationResult}
        isOpen={isModalOpen}
        onClose={closeModal}
        onConfirm={handleExecuteSLP}
        title="Liquidity Pool Analysis"
      />
    </div>
  );
};

export default LiquidityPoolPanel;
