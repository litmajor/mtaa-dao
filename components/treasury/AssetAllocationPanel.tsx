/**
 * AssetAllocationPanel.tsx (Week 2 Treasury)
 * 
 * Multi-asset allocation strategies with scenario comparison
 * Simulate different allocation models and compare outcomes
 */

import React, { useState } from 'react';
import SimulationResultModal from '../SimulationResultModal';
import { useSimulationPreview } from '../../hooks/useSimulationPreview';
import { SimulationResult } from '../../server/services/simulationFramework';

interface AllocationScenario {
  name: string;
  usdc: number;
  eth: number;
  btc: number;
  stables: number; // DAI, USDT, etc
  expectedYield: number;
  riskScore: number;
}

interface AllocationFormData {
  totalCapital: number;
  scenarios: AllocationScenario[];
  selectedScenario: number;
  timeHorizon: 'short' | 'medium' | 'long'; // 6mo, 1yr, 3yr+
  targetYield: number;
}

interface AssetAllocationPanelProps {
  userId: string;
  availableCapital?: number;
  onAllocationSet?: (result: any) => void;
}

/**
 * AssetAllocationPanel Component
 * Strategic asset allocation with scenario analysis
 */
export const AssetAllocationPanel: React.FC<AssetAllocationPanelProps> = ({
  userId,
  availableCapital = 2500000,
  onAllocationSet,
}) => {
  // Predefined allocation scenarios
  const defaultScenarios: AllocationScenario[] = [
    {
      name: 'Capital Preservation',
      usdc: 50,
      eth: 20,
      btc: 10,
      stables: 20,
      expectedYield: 3.5,
      riskScore: 2,
    },
    {
      name: 'Balanced Growth',
      usdc: 30,
      eth: 35,
      btc: 20,
      stables: 15,
      expectedYield: 8.5,
      riskScore: 4,
    },
    {
      name: 'Growth Focused',
      usdc: 15,
      eth: 50,
      btc: 25,
      stables: 10,
      expectedYield: 15.2,
      riskScore: 6,
    },
    {
      name: 'Yield Maximization',
      usdc: 10,
      eth: 40,
      btc: 20,
      stables: 30,
      expectedYield: 22.5,
      riskScore: 8,
    },
  ];

  // Form state
  const [formData, setFormData] = useState<AllocationFormData>({
    totalCapital: availableCapital,
    scenarios: defaultScenarios,
    selectedScenario: 1, // Default to Balanced Growth
    timeHorizon: 'medium',
    targetYield: 8.5,
  });

  const [projectedOutcome, setProjectedOutcome] = useState<Record<string, number>>({});

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
      console.log('Allocation simulation successful:', result);
    },
  });

  // Calculate projected values
  const calculateProjection = () => {
    const scenario = formData.scenarios[formData.selectedScenario];
    const timeMultiplier = {
      short: 0.5,
      medium: 1,
      long: 3,
    }[formData.timeHorizon];

    const projectedYield = scenario.expectedYield * timeMultiplier;
    const projectedValue = formData.totalCapital * (1 + projectedYield / 100);
    const projectedGain = projectedValue - formData.totalCapital;

    const projection = {
      projectedValue,
      projectedGain,
      annualYield: scenario.expectedYield,
      riskScore: scenario.riskScore,
    };

    setProjectedOutcome(projection);
    return projection;
  };

  // Handle preview button click
  const handlePreviewAllocation = async (e: React.FormEvent) => {
    e.preventDefault();

    const scenario = formData.scenarios[formData.selectedScenario];
    const projection = calculateProjection();

    if (formData.totalCapital <= 0) {
      alert('Capital must be greater than 0');
      return;
    }

    // Run simulation
    await runSimulation(
      'ASSET_ALLOCATION',
      {
        userId,
        totalCapital: formData.totalCapital,
        allocation: {
          usdc: scenario.usdc,
          eth: scenario.eth,
          btc: scenario.btc,
          stables: scenario.stables,
        },
        scenarioName: scenario.name,
        timeHorizon: formData.timeHorizon,
        expectedAnnualYield: scenario.expectedYield,
        projectedValue: projection.projectedValue,
        riskScore: scenario.riskScore,
      },
      userId
    );
  };

  // Handle allocation execution
  const handleExecuteAllocation = async () => {
    try {
      const scenario = formData.scenarios[formData.selectedScenario];
      const response = await fetch('/api/treasury/allocation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          totalCapital: formData.totalCapital,
          allocation: {
            usdc: scenario.usdc,
            eth: scenario.eth,
            btc: scenario.btc,
            stables: scenario.stables,
          },
          timeHorizon: formData.timeHorizon,
        }),
      });

      if (response.ok) {
        const result = await response.json();
        onAllocationSet?.(result);
        resetState();
      }
    } catch (error) {
      console.error('Allocation execution failed:', error);
    }
  };

  const currentScenario = formData.scenarios[formData.selectedScenario];
  const riskLevelLabels: Record<number, string> = {
    2: 'Low',
    4: 'Moderate',
    6: 'High',
    8: 'Very High',
  };
  const riskLevelLabel = riskLevelLabels[currentScenario.riskScore] || 'Unknown';

  return (
    <div className="asset-allocation-panel">
      <div className="panel-header">
        <h3>Asset Allocation Strategy</h3>
        <div className="header-info">
          <span className="capital-amount">
            Capital: ${formData.totalCapital.toLocaleString('en-US', { maximumFractionDigits: 0 })}
          </span>
        </div>
      </div>

      <form onSubmit={handlePreviewAllocation} className="allocation-strategy-form">
        {/* Scenario Selector */}
        <div className="scenarios-grid">
          {formData.scenarios.map((scenario, index) => (
            <button
              key={scenario.name}
              type="button"
              onClick={() => {
                setFormData({ ...formData, selectedScenario: index });
                calculateProjection();
              }}
              className={`scenario-card ${formData.selectedScenario === index ? 'active' : ''}`}
            >
              <div className="scenario-name">{scenario.name}</div>
              <div className="scenario-yield">
                <span className="label">Expected Yield</span>
                <span className="value">{scenario.expectedYield.toFixed(1)}%</span>
              </div>
              <div className="scenario-risk">
                <span className="label">Risk Level</span>
                <span className={`risk-badge risk-${scenario.riskScore}`}>
                  {scenario.riskScore}/10
                </span>
              </div>
              <div className="scenario-allocation">
                <div className="alloc-item">
                  <span>USDC: {scenario.usdc}%</span>
                </div>
                <div className="alloc-item">
                  <span>ETH: {scenario.eth}%</span>
                </div>
                <div className="alloc-item">
                  <span>BTC: {scenario.btc}%</span>
                </div>
                <div className="alloc-item">
                  <span>Stables: {scenario.stables}%</span>
                </div>
              </div>
            </button>
          ))}
        </div>

        {/* Time Horizon */}
        <div className="form-group">
          <label>Investment Time Horizon</label>
          <div className="horizon-buttons">
            <button
              type="button"
              onClick={() => setFormData({ ...formData, timeHorizon: 'short' })}
              className={`horizon ${formData.timeHorizon === 'short' ? 'active' : ''}`}
            >
              Short-term
              <span className="duration">6 months</span>
            </button>
            <button
              type="button"
              onClick={() => setFormData({ ...formData, timeHorizon: 'medium' })}
              className={`horizon ${formData.timeHorizon === 'medium' ? 'active' : ''}`}
            >
              Medium-term
              <span className="duration">1 year</span>
            </button>
            <button
              type="button"
              onClick={() => setFormData({ ...formData, timeHorizon: 'long' })}
              className={`horizon ${formData.timeHorizon === 'long' ? 'active' : ''}`}
            >
              Long-term
              <span className="duration">3+ years</span>
            </button>
          </div>
        </div>

        {/* Target Capital Input */}
        <div className="form-group">
          <label htmlFor="capital">Total Capital to Allocate (USD)</label>
          <input
            id="capital"
            type="number"
            step="1000"
            min="0"
            placeholder="$2,500,000"
            value={formData.totalCapital}
            onChange={(e) => {
              const value = parseFloat(e.target.value) || 0;
              setFormData({ ...formData, totalCapital: value });
              calculateProjection();
            }}
          />
        </div>

        {/* Projection Results */}
        <div className="projection-results">
          <div className="projection">
            <span>Initial Capital</span>
            <span className="value">
              ${formData.totalCapital.toLocaleString('en-US', { maximumFractionDigits: 0 })}
            </span>
          </div>

          <div className="projection">
            <span>Annual Yield</span>
            <span className="value">{currentScenario.expectedYield.toFixed(1)}%</span>
          </div>

          <div className="projection">
            <span>Risk Level</span>
            <span className={`value risk-${currentScenario.riskScore}`}>
              {riskLevelLabel} ({currentScenario.riskScore}/10)
            </span>
          </div>

          <div className="projection highlight">
            <span>Projected Value ({formData.timeHorizon === 'short' ? '6mo' : formData.timeHorizon === 'medium' ? '1yr' : '3yr+'})</span>
            <span className="value success">
              ${projectedOutcome.projectedValue?.toLocaleString('en-US', { maximumFractionDigits: 0 })}
            </span>
          </div>

          <div className="projection">
            <span>Projected Gain</span>
            <span className="value success">
              ${projectedOutcome.projectedGain?.toLocaleString('en-US', { maximumFractionDigits: 0 })}
            </span>
          </div>
        </div>

        {/* Asset Breakdown Chart */}
        <div className="allocation-chart">
          <h4>Target Allocation Distribution</h4>
          <div className="chart-bars">
            {[
              { name: 'USDC', value: currentScenario.usdc, color: '#4834d4' },
              { name: 'ETH', value: currentScenario.eth, color: '#627eea' },
              { name: 'BTC', value: currentScenario.btc, color: '#f7931a' },
              { name: 'Stables', value: currentScenario.stables, color: '#10b981' },
            ].map((asset) => (
              <div key={asset.name} className="chart-item">
                <div className="chart-bar">
                  {/* eslint-disable-next-line react/style-prop-object */}
                  <div
                    className="bar-fill"
                    style={{
                      width: `${asset.value}%`,
                      backgroundColor: asset.color,
                    }}
                  />
                </div>
                <div className="chart-label">
                  <span>{asset.name}</span>
                  <span className="percentage">{asset.value}%</span>
                </div>
              </div>
            ))}
          </div>
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
            disabled={isLoading || formData.totalCapital <= 0}
            className="btn btn-primary"
          >
            {isLoading ? 'Analyzing...' : 'Preview Allocation'}
          </button>
        </div>
      </form>

      {/* Simulation Result Modal */}
      <SimulationResultModal
        result={simulationResult}
        isOpen={isModalOpen}
        onClose={closeModal}
        onConfirm={handleExecuteAllocation}
        confirmButtonText="Set Allocation"
      />
    </div>
  );
};

export default AssetAllocationPanel;
