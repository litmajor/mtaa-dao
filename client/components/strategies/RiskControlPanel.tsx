import React, { useState } from 'react';
import { RiskControl, Strategy } from '../hooks/useStrategyRegistry';

interface RiskLevel {
  name: 'Conservative' | 'Moderate' | 'Aggressive';
  description: string;
  config: RiskControl;
  emoji: string;
}

const RISK_PRESETS: RiskLevel[] = [
  {
    name: 'Conservative',
    description: 'Low risk, slow growth - ideal for beginners',
    emoji: '🛡️',
    config: {
      maxOpenTrades: 2,
      maxLossPerTrade: 2,
      maxDailyLoss: 5,
      maxLossStreak: 2,
      takeProfit: 10,
      stopLoss: 5,
      maxLeverage: 1,
      paused: false,
      maxDrawdown: 10
    }
  },
  {
    name: 'Moderate',
    description: 'Balanced risk/reward - most common',
    emoji: '⚖️',
    config: {
      maxOpenTrades: 5,
      maxLossPerTrade: 5,
      maxDailyLoss: 10,
      maxLossStreak: 3,
      takeProfit: 8,
      stopLoss: 3,
      maxLeverage: 2,
      paused: false,
      maxDrawdown: 20
    }
  },
  {
    name: 'Aggressive',
    description: 'High risk, high reward - experienced traders',
    emoji: '⚡',
    config: {
      maxOpenTrades: 10,
      maxLossPerTrade: 10,
      maxDailyLoss: 20,
      maxLossStreak: 5,
      takeProfit: 5,
      stopLoss: 2,
      maxLeverage: 5,
      paused: false,
      maxDrawdown: 30
    }
  }
];

interface RiskControlField {
  key: keyof RiskControl;
  label: string;
  description: string;
  unit: string;
  type: 'number' | 'toggle';
  min?: number;
  max?: number;
  step?: number;
}

const RISK_FIELDS: RiskControlField[] = [
  {
    key: 'maxOpenTrades',
    label: 'Max Open Trades',
    description: 'Maximum number of concurrent positions',
    unit: 'trades',
    type: 'number',
    min: 1,
    max: 50
  },
  {
    key: 'maxLossPerTrade',
    label: 'Max Loss Per Trade',
    description: 'Maximum loss allowed on single trade',
    unit: '%',
    type: 'number',
    min: 0.1,
    max: 50,
    step: 0.1
  },
  {
    key: 'maxDailyLoss',
    label: 'Max Daily Loss',
    description: 'Stop all trades if daily loss exceeds this',
    unit: '%',
    type: 'number',
    min: 1,
    max: 100,
    step: 1
  },
  {
    key: 'maxLossStreak',
    label: 'Max Loss Streak',
    description: 'Stop trading after this many consecutive losses',
    unit: 'trades',
    type: 'number',
    min: 1,
    max: 20
  },
  {
    key: 'takeProfit',
    label: 'Take Profit',
    description: 'Close position at this profit percentage',
    unit: '%',
    type: 'number',
    min: 0.1,
    max: 100,
    step: 0.1
  },
  {
    key: 'stopLoss',
    label: 'Stop Loss',
    description: 'Close position at this loss percentage',
    unit: '%',
    type: 'number',
    min: 0.1,
    max: 50,
    step: 0.1
  },
  {
    key: 'maxLeverage',
    label: 'Max Leverage',
    description: 'Maximum allowed leverage multiplier',
    unit: 'x',
    type: 'number',
    min: 1,
    max: 125
  },
  {
    key: 'maxDrawdown',
    label: 'Max Drawdown',
    description: 'Stop trading if drawdown exceeds this',
    unit: '%',
    type: 'number',
    min: 5,
    max: 100,
    step: 5
  }
];

interface RiskControlPanelProps {
  strategy: Strategy | null;
  onRiskControlChange: (riskControl: RiskControl) => void;
}

export const RiskControlPanel: React.FC<RiskControlPanelProps> = ({
  strategy,
  onRiskControlChange
}) => {
  const [riskControl, setRiskControl] = useState<RiskControl>(
    strategy?.riskControl || RISK_PRESETS[1].config
  );
  const [selectedPreset, setSelectedPreset] = useState<'Conservative' | 'Moderate' | 'Aggressive' | null>(null);

  if (!strategy) {
    return (
      <div className="text-center py-12">
        <div className="text-4xl mb-2">🛡️</div>
        <p className="text-slate-600 dark:text-slate-400">
          Select a strategy first to configure risk controls
        </p>
      </div>
    );
  }

  const handlePresetClick = (preset: RiskLevel) => {
    setSelectedPreset(preset.name);
    setRiskControl(preset.config);
    onRiskControlChange(preset.config);
  };

  const handleRiskChange = (key: keyof RiskControl, value: any) => {
    const updated = { ...riskControl, [key]: value };
    setRiskControl(updated);
    setSelectedPreset(null); // Clear preset selection when manually editing
    onRiskControlChange(updated);
  };

  const getRiskScore = (): number => {
    // Calculate overall risk score (1-100)
    const score =
      (riskControl.maxOpenTrades / 10) * 20 +
      (riskControl.maxLossPerTrade / 50) * 15 +
      (riskControl.maxDailyLoss / 100) * 15 +
      (riskControl.maxLeverage / 125) * 30 +
      (100 - riskControl.maxDrawdown);
    return Math.min(100, Math.max(0, score));
  };

  const getRiskLevel = (score: number): string => {
    if (score < 30) return 'Very Conservative';
    if (score < 50) return 'Conservative';
    if (score < 70) return 'Moderate';
    if (score < 85) return 'Aggressive';
    return 'Very Aggressive';
  };

  const riskScore = getRiskScore();
  const riskLevel = getRiskLevel(riskScore);
  const riskColor =
    riskScore < 30
      ? 'text-green-600'
      : riskScore < 50
        ? 'text-green-500'
        : riskScore < 70
          ? 'text-blue-500'
          : riskScore < 85
            ? 'text-orange-500'
            : 'text-red-600';

  return (
    <div className="w-full space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold mb-2">Risk Controls</h2>
        <p className="text-slate-600 dark:text-slate-400">
          Configure safety limits and risk parameters
        </p>
      </div>

      {/* Risk Score Gauge */}
      <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
        <div className="flex items-center justify-between mb-2">
          <div className="text-sm font-bold text-slate-700 dark:text-slate-300">
            Overall Risk Level
          </div>
          <div className={`text-2xl font-bold ${riskColor}`}>{riskScore.toFixed(0)}</div>
        </div>
        <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2">
          <div
            className={`h-2 rounded-full transition-all ${
              riskScore < 30
                ? 'bg-green-600'
                : riskScore < 50
                  ? 'bg-green-500'
                  : riskScore < 70
                    ? 'bg-blue-500'
                    : riskScore < 85
                      ? 'bg-orange-500'
                      : 'bg-red-600'
            }`}
            style={{ width: `${riskScore}%` }}
          />
        </div>
        <div className="mt-2 text-sm font-bold text-slate-700 dark:text-slate-300">
          {riskLevel}
        </div>
      </div>

      {/* Risk Presets */}
      <div>
        <div className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
          Risk Presets
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {RISK_PRESETS.map(preset => (
            <button
              key={preset.name}
              onClick={() => handlePresetClick(preset)}
              className={`p-3 rounded-lg border-2 transition-all text-left ${
                selectedPreset === preset.name
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-950'
                  : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 hover:border-blue-300'
              }`}
            >
              <div className="text-2xl mb-1">{preset.emoji}</div>
              <div className="font-bold text-sm">{preset.name}</div>
              <div className="text-xs text-slate-600 dark:text-slate-400">
                {preset.description}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Risk Parameters */}
      <div>
        <div className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-4">
          Advanced Parameters
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {RISK_FIELDS.map(field => (
            <div
              key={field.key}
              className="p-4 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700"
            >
              <div className="flex justify-between items-start mb-2">
                <div>
                  <label className="block text-sm font-bold text-slate-900 dark:text-white">
                    {field.label}
                  </label>
                  <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                    {field.description}
                  </p>
                </div>
              </div>

              <div className="mt-3 space-y-2">
                {field.type === 'number' ? (
                  <>
                    <input
                      type="range"
                      min={field.min}
                      max={field.max}
                      step={field.step || 1}
                      value={riskControl[field.key]}
                      onChange={e =>
                        handleRiskChange(field.key, parseFloat(e.target.value))
                      }
                      className="w-full"
                    />
                    <div className="flex gap-2">
                      <input
                        type="number"
                        min={field.min}
                        max={field.max}
                        step={field.step || 1}
                        value={riskControl[field.key]}
                        onChange={e =>
                          handleRiskChange(field.key, parseFloat(e.target.value))
                        }
                        className="flex-1 px-2 py-1 text-sm border border-slate-300 dark:border-slate-600 rounded dark:bg-slate-700 dark:text-white"
                      />
                      <div className="px-2 py-1 bg-slate-200 dark:bg-slate-700 rounded text-sm font-bold">
                        {field.unit}
                      </div>
                    </div>
                  </>
                ) : (
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={riskControl[field.key] as boolean}
                      onChange={e => handleRiskChange(field.key, e.target.checked)}
                      className="w-4 h-4"
                    />
                    <span className="text-sm">
                      {riskControl[field.key] ? 'Enabled' : 'Disabled'}
                    </span>
                  </label>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Risk Summary */}
      <div className="p-4 bg-yellow-50 dark:bg-yellow-950 border-l-4 border-yellow-600 rounded">
        <div className="font-bold text-yellow-900 dark:text-yellow-100 mb-2">
          ⚠️ Risk Configuration Summary
        </div>
        <ul className="text-sm text-yellow-800 dark:text-yellow-200 space-y-1">
          <li>• Max {riskControl.maxOpenTrades} concurrent positions</li>
          <li>• Stop loss at {riskControl.stopLoss}% per trade</li>
          <li>• Daily loss limit: {riskControl.maxDailyLoss}%</li>
          <li>• Max leverage: {riskControl.maxLeverage}x</li>
          <li>• Max drawdown: {riskControl.maxDrawdown}%</li>
        </ul>
      </div>
    </div>
  );
};
