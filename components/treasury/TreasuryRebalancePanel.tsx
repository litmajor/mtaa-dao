/**
 * TreasuryRebalancePanel.tsx (Week 2 Treasury)
 * 
 * Dynamic portfolio rebalancing with Monte Carlo simulations
 * Simulates 10,000 market scenarios to optimize asset allocation
 */

import React, { useState } from 'react';
import SimulationResultModal from '../SimulationResultModal';
import { useSimulationPreview } from '../../hooks/useSimulationPreview';
import { SimulationResult } from '../../server/services/simulationFramework';

interface AssetPosition {
  symbol: string;
  currentAmount: number;
  currentPrice: number;
  targetPercentage: number;
}

interface RebalanceFormData {
  positions: AssetPosition[];
  riskProfile: 'conservative' | 'moderate' | 'aggressive';
  rebalancingStrategy: 'threshold' | 'schedule' | 'optimal';
  thresholdPercentage: number;
  simulationRuns: number;
}

interface TreasuryRebalancePanelProps {
  userId: string;
  initialPositions?: AssetPosition[];
  onRebalanceExecuted?: (result: any) => void;
}

/**
 * TreasuryRebalancePanel Component
 * Advanced portfolio rebalancing with Monte Carlo analysis
 */
export const TreasuryRebalancePanel: React.FC<TreasuryRebalancePanelProps> = ({
  userId,
  initialPositions = [
    { symbol: 'USDC', currentAmount: 500000, currentPrice: 1, targetPercentage: 40 },
    { symbol: 'ETH', currentAmount: 50, currentPrice: 2500, targetPercentage: 35 },
    { symbol: 'BTC', currentAmount: 5, currentPrice: 65000, targetPercentage: 25 },
  ],
  onRebalanceExecuted,
}) => {
  // Form state
  const [formData, setFormData] = useState<RebalanceFormData>({
    positions: initialPositions,
    riskProfile: 'moderate',
    rebalancingStrategy: 'optimal',
    thresholdPercentage: 5,
    simulationRuns: 10000,
  });

  const [allocationDrift, setAllocationDrift] = useState<Record<string, number>>({});
  const [totalValue, setTotalValue] = useState<number>(0);

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
      console.log('Rebalancing simulation successful:', result);
    },
  });

  // Calculate portfolio metrics
  const calculateMetrics = () => {
    let total = 0;
    const drift: Record<string, number> = {};

    formData.positions.forEach((pos) => {
      const posValue = pos.currentAmount * pos.currentPrice;
      total += posValue;
    });

    formData.positions.forEach((pos) => {
      const posValue = pos.currentAmount * pos.currentPrice;
      const currentPercentage = total > 0 ? (posValue / total) * 100 : 0;
      drift[pos.symbol] = currentPercentage - pos.targetPercentage;
    });

    setTotalValue(total);
    setAllocationDrift(drift);

    return { total, drift };
  };

  // Handle preview button click
  const handlePreviewRebalance = async (e: React.FormEvent) => {
    e.preventDefault();

    const { total, drift } = calculateMetrics();

    if (total <= 0) {
      alert('Portfolio value must be greater than 0');
      return;
    }

    // Check if rebalancing is needed
    const needsRebalance = formData.positions.some(
      (pos) => Math.abs(drift[pos.symbol]) > formData.thresholdPercentage
    );

    if (!needsRebalance) {
      alert('Portfolio is within threshold. Rebalancing not necessary.');
      return;
    }

    // Run simulation
    await runSimulation(
      'TREASURY_REBALANCE',
      {
        userId,
        positions: formData.positions,
        totalValue: total,
        riskProfile: formData.riskProfile,
        rebalancingStrategy: formData.rebalancingStrategy,
        thresholdPercentage: formData.thresholdPercentage,
        simulationRuns: formData.simulationRuns,
        currentDrift: drift,
      },
      userId
    );
  };

  // Handle rebalance execution
  const handleExecuteRebalance = async () => {
    try {
      const response = await fetch('/api/treasury/rebalance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          positions: formData.positions,
          riskProfile: formData.riskProfile,
          rebalancingStrategy: formData.rebalancingStrategy,
        }),
      });

      if (response.ok) {
        const result = await response.json();
        onRebalanceExecuted?.(result);
        resetState();
      }
    } catch (error) {
      console.error('Rebalance execution failed:', error);
    }
  };

  // Get target allocation buttons
  const getTargetAllocationPreset = (profile: 'conservative' | 'moderate' | 'aggressive') => {
    const targets: Record<string, { USDC: number; ETH: number; BTC: number }> = {
      conservative: { USDC: 60, ETH: 25, BTC: 15 },
      moderate: { USDC: 40, ETH: 35, BTC: 25 },
      aggressive: { USDC: 20, ETH: 50, BTC: 30 },
    };
    return targets[profile];
  };

  const applyAllocationPreset = (profile: 'conservative' | 'moderate' | 'aggressive') => {
    const targets = getTargetAllocationPreset(profile);
    setFormData({
      ...formData,
      riskProfile: profile,
      positions: formData.positions.map((pos) => ({
        ...pos,
        targetPercentage: targets[pos.symbol as keyof typeof targets] || pos.targetPercentage,
      })),
    });
  };

  const maxDrift = Math.max(...Object.values(allocationDrift).map(Math.abs));
  const needsRebalance = maxDrift > formData.thresholdPercentage;

  return (
    <div className="treasury-rebalance-panel">
      <div className="panel-header">
        <h3>Treasury Rebalancing</h3>
        <div className="header-info">
          <span className="total-value">
            Total Value: ${totalValue.toLocaleString('en-US', { maximumFractionDigits: 2 })}
          </span>
        </div>
      </div>

      <form onSubmit={handlePreviewRebalance} className="rebalance-form">
        {/* Current Allocation */}
        <div className="allocation-section">
          <h4>Current Allocation</h4>
          <div className="allocation-grid">
            {formData.positions.map((pos) => {
              const posValue = pos.currentAmount * pos.currentPrice;
              const currentPct = totalValue > 0 ? (posValue / totalValue) * 100 : 0;
              const driftAmount = currentPct - pos.targetPercentage;
              const driftColor = Math.abs(driftAmount) > formData.thresholdPercentage ? 'warning' : 'normal';

              return (
                <div key={pos.symbol} className="allocation-item">
                  <div className="item-header">
                    <span className="symbol">{pos.symbol}</span>
                    <span className={`drift ${driftColor}`}>
                      {driftAmount > 0 ? '+' : ''}{driftAmount.toFixed(1)}%
                    </span>
                  </div>
                  <div className="item-bar">
                    {/* eslint-disable-next-line react/style-prop-object */}
                    <div
                      className="bar-current"
                      style={{
                        width: `${Math.min(currentPct, 100)}%`,
                        backgroundColor:
                          driftColor === 'warning'
                            ? '#f59e0b'
                            : '#4834d4',
                      }}
                    />
                    {/* eslint-disable-next-line react/style-prop-object */}
                    <div
                      className="bar-target"
                      style={{
                        left: `${Math.min(pos.targetPercentage, 100)}%`,
                      }}
                    />
                  </div>
                  <div className="item-stats">
                    <span>Current: {currentPct.toFixed(1)}%</span>
                    <span>Target: {pos.targetPercentage}%</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Risk Profile Buttons */}
        <div className="form-group">
          <label>Risk Profile Presets</label>
          <div className="preset-buttons">
            <button
              type="button"
              onClick={() => applyAllocationPreset('conservative')}
              className={`preset ${formData.riskProfile === 'conservative' ? 'active' : ''}`}
            >
              Conservative
              <span className="preset-desc">60% USDC / 25% ETH / 15% BTC</span>
            </button>
            <button
              type="button"
              onClick={() => applyAllocationPreset('moderate')}
              className={`preset ${formData.riskProfile === 'moderate' ? 'active' : ''}`}
            >
              Moderate
              <span className="preset-desc">40% USDC / 35% ETH / 25% BTC</span>
            </button>
            <button
              type="button"
              onClick={() => applyAllocationPreset('aggressive')}
              className={`preset ${formData.riskProfile === 'aggressive' ? 'active' : ''}`}
            >
              Aggressive
              <span className="preset-desc">20% USDC / 50% ETH / 30% BTC</span>
            </button>
          </div>
        </div>

        {/* Rebalancing Strategy */}
        <div className="form-group">
          <label htmlFor="strategy">Rebalancing Strategy</label>
          <select
            id="strategy"
            value={formData.rebalancingStrategy}
            onChange={(e) =>
              setFormData({
                ...formData,
                rebalancingStrategy: e.target.value as 'threshold' | 'schedule' | 'optimal',
              })
            }
          >
            <option value="threshold">Threshold-Based (Rebalance when drift exceeds %)</option>
            <option value="schedule">Schedule-Based (Monthly/Quarterly rebalancing)</option>
            <option value="optimal">Optimal (AI-determined timing)</option>
          </select>
        </div>

        {/* Threshold Setting */}
        <div className="form-group">
          <label htmlFor="threshold">
            Rebalance Threshold: {formData.thresholdPercentage}%
          </label>
          <input
            id="threshold"
            type="range"
            min="1"
            max="20"
            step="1"
            value={formData.thresholdPercentage}
            onChange={(e) =>
              setFormData({
                ...formData,
                thresholdPercentage: parseInt(e.target.value),
              })
            }
          />
          <small>Assets will be rebalanced when drift exceeds this threshold</small>
        </div>

        {/* Simulation Info */}
        <div className="form-group">
          <label htmlFor="simulations">
            Monte Carlo Simulations: {formData.simulationRuns.toLocaleString()}
          </label>
          <input
            id="simulations"
            type="range"
            min="1000"
            max="50000"
            step="1000"
            value={formData.simulationRuns}
            onChange={(e) =>
              setFormData({
                ...formData,
                simulationRuns: parseInt(e.target.value),
              })
            }
          />
          <small>More simulations = more accurate analysis (slow with 50k+)</small>
        </div>

        {/* Rebalancing Analysis */}
        <div className="rebalance-analysis">
          <div className="analysis-item">
            <span>Max Drift</span>
            <span className={`value ${maxDrift > formData.thresholdPercentage ? 'warning' : 'normal'}`}>
              {maxDrift.toFixed(2)}%
            </span>
          </div>

          <div className="analysis-item">
            <span>Rebalancing Needed</span>
            <span className={`value ${needsRebalance ? 'warning' : 'success'}`}>
              {needsRebalance ? '✓ YES' : '✗ NO'}
            </span>
          </div>

          <div className="analysis-item">
            <span>Expected Gas Cost</span>
            <span className="value">~$200-500</span>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="error-message">
            <span>⚠️ {error}</span>
          </div>
        )}

        {needsRebalance && (
          <div className="warning-message">
            <span>⚠ Portfolio drift exceeds {formData.thresholdPercentage}% threshold</span>
          </div>
        )}

        {/* Buttons */}
        <div className="form-actions">
          <button
            type="submit"
            disabled={isLoading || !needsRebalance}
            className="btn btn-primary"
          >
            {isLoading ? 'Analyzing...' : 'Preview Rebalance'}
          </button>
        </div>
      </form>

      {/* Simulation Result Modal */}
      <SimulationResultModal
        result={simulationResult}
        isOpen={isModalOpen}
        onClose={closeModal}
        onConfirm={handleExecuteRebalance}
        confirmButtonText="Execute Rebalance"
      />
    </div>
  );
};

export default TreasuryRebalancePanel;
