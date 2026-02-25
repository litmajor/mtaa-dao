import React from 'react';
import { Strategy, RiskControl } from '../hooks/useStrategyRegistry';

interface DeploymentPreviewProps {
  strategy: Strategy | null;
  inputs: Record<string, any>;
  riskControl: RiskControl | null;
  exchanges: string[];
  botName: string;
  initialCapital: number;
  onBotNameChange: (name: string) => void;
  onInitialCapitalChange: (capital: number) => void;
  isValid: boolean;
}

export const DeploymentPreview: React.FC<DeploymentPreviewProps> = ({
  strategy,
  inputs,
  riskControl,
  exchanges,
  botName,
  initialCapital,
  onBotNameChange,
  onInitialCapitalChange,
  isValid
}) => {
  if (!strategy) {
    return (
      <div className="text-center py-12">
        <div className="text-4xl mb-2">👀</div>
        <p className="text-slate-600 dark:text-slate-400">
          Complete all steps to see deployment preview
        </p>
      </div>
    );
  }

  return (
    <div className="w-full space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold mb-2">Deployment Preview</h2>
        <p className="text-slate-600 dark:text-slate-400">
          Review all settings before deploying
        </p>
      </div>

      {/* Bot Name & Capital */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-bold text-slate-900 dark:text-white mb-2">
            Bot Name
          </label>
          <input
            type="text"
            value={botName}
            onChange={e => onBotNameChange(e.target.value)}
            placeholder="e.g., My RSI Strategy #1"
            className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded dark:bg-slate-700 dark:text-white focus:outline-none focus:border-blue-500"
          />
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Friendly name for this bot instance
          </p>
        </div>

        <div>
          <label className="block text-sm font-bold text-slate-900 dark:text-white mb-2">
            Initial Capital
          </label>
          <div className="flex gap-2">
            <input
              type="number"
              value={initialCapital}
              onChange={e => onInitialCapitalChange(parseFloat(e.target.value))}
              min={10}
              step={10}
              className="flex-1 px-3 py-2 border border-slate-300 dark:border-slate-600 rounded dark:bg-slate-700 dark:text-white focus:outline-none focus:border-blue-500"
            />
            <div className="px-3 py-2 bg-slate-200 dark:bg-slate-700 rounded font-bold">
              USD
            </div>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Starting trading capital
          </p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
          <div className="text-xs text-slate-600 dark:text-slate-400">Strategy</div>
          <div className="font-bold text-sm truncate">{strategy.name}</div>
        </div>
        <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
          <div className="text-xs text-slate-600 dark:text-slate-400">Exchanges</div>
          <div className="font-bold text-sm">{exchanges.length}</div>
        </div>
        <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
          <div className="text-xs text-slate-600 dark:text-slate-400">Capital</div>
          <div className="font-bold text-sm">${initialCapital}</div>
        </div>
        <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
          <div className="text-xs text-slate-600 dark:text-slate-400">Risk Level</div>
          <div className="font-bold text-sm">
            {riskControl?.maxLeverage === 1 ? '🛡️ Low' : riskControl?.maxLeverage === 2 ? '⚖️ Med' : '⚡ High'}
          </div>
        </div>
      </div>

      {/* Strategy Details */}
      <div className="space-y-3">
        <h3 className="font-bold text-lg">Strategy Configuration</h3>

        {/* Strategy Info */}
        <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <div className="text-slate-600 dark:text-slate-400">Version</div>
              <div className="font-bold">v{strategy.version}</div>
            </div>
            <div>
              <div className="text-slate-600 dark:text-slate-400">Author</div>
              <div className="font-bold">{strategy.author}</div>
            </div>
            <div>
              <div className="text-slate-600 dark:text-slate-400">Category</div>
              <div className="font-bold capitalize">{strategy.category}</div>
            </div>
            <div>
              <div className="text-slate-600 dark:text-slate-400">Verified</div>
              <div className="font-bold">{strategy.verified ? '✓ Yes' : 'No'}</div>
            </div>
          </div>
        </div>

        {/* Inputs */}
        {Object.keys(inputs).length > 0 && (
          <div className="p-4 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
            <div className="font-bold text-blue-900 dark:text-blue-100 mb-3">
              📋 Parameters
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
              {Object.entries(inputs).map(([key, value]) => (
                <div key={key} className="bg-white dark:bg-blue-900 p-2 rounded">
                  <div className="text-blue-600 dark:text-blue-300 text-xs">{key}</div>
                  <div className="font-bold">
                    {Array.isArray(value) ? value.join(', ') : String(value)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Exchanges */}
        {exchanges.length > 0 && (
          <div className="p-4 bg-green-50 dark:bg-green-950 rounded-lg border border-green-200 dark:border-green-800">
            <div className="font-bold text-green-900 dark:text-green-100 mb-3">
              🌐 Exchanges ({exchanges.length})
            </div>
            <div className="flex flex-wrap gap-2">
              {exchanges.map(exchange => (
                <div
                  key={exchange}
                  className="px-3 py-1 bg-white dark:bg-green-900 rounded-full text-sm font-bold text-green-700 dark:text-green-200 capitalize"
                >
                  {exchange}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Risk Controls */}
        {riskControl && (
          <div className="p-4 bg-orange-50 dark:bg-orange-950 rounded-lg border border-orange-200 dark:border-orange-800">
            <div className="font-bold text-orange-900 dark:text-orange-100 mb-3">
              🛡️ Risk Controls
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
              <div className="bg-white dark:bg-orange-900 p-2 rounded">
                <div className="text-orange-600 dark:text-orange-300 text-xs">Max Open Trades</div>
                <div className="font-bold">{riskControl.maxOpenTrades}</div>
              </div>
              <div className="bg-white dark:bg-orange-900 p-2 rounded">
                <div className="text-orange-600 dark:text-orange-300 text-xs">Max Loss/Trade</div>
                <div className="font-bold">{riskControl.maxLossPerTrade}%</div>
              </div>
              <div className="bg-white dark:bg-orange-900 p-2 rounded">
                <div className="text-orange-600 dark:text-orange-300 text-xs">Stop Loss</div>
                <div className="font-bold">{riskControl.stopLoss}%</div>
              </div>
              <div className="bg-white dark:bg-orange-900 p-2 rounded">
                <div className="text-orange-600 dark:text-orange-300 text-xs">Take Profit</div>
                <div className="font-bold">{riskControl.takeProfit}%</div>
              </div>
              <div className="bg-white dark:bg-orange-900 p-2 rounded">
                <div className="text-orange-600 dark:text-orange-300 text-xs">Max Leverage</div>
                <div className="font-bold">{riskControl.maxLeverage}x</div>
              </div>
              <div className="bg-white dark:bg-orange-900 p-2 rounded">
                <div className="text-orange-600 dark:text-orange-300 text-xs">Max Drawdown</div>
                <div className="font-bold">{riskControl.maxDrawdown}%</div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Validation Status */}
      {!isValid && (
        <div className="p-4 bg-red-50 dark:bg-red-950 border-l-4 border-red-600 rounded">
          <div className="font-bold text-red-900 dark:text-red-100">
            ❌ Deployment Not Ready
          </div>
          <p className="text-sm text-red-800 dark:text-red-200 mt-1">
            Please complete all required steps:
            1. Select a strategy
            2. Configure parameters
            3. Set risk controls
            4. Choose exchanges
          </p>
        </div>
      )}

      {isValid && (
        <div className="p-4 bg-green-50 dark:bg-green-950 border-l-4 border-green-600 rounded">
          <div className="font-bold text-green-900 dark:text-green-100">
            ✅ Ready to Deploy
          </div>
          <p className="text-sm text-green-800 dark:text-green-200 mt-1">
            All settings are configured. Click "Deploy Bot" to start trading.
          </p>
        </div>
      )}

      {/* Disclaimer */}
      <div className="p-3 bg-slate-100 dark:bg-slate-700 rounded text-xs text-slate-600 dark:text-slate-400">
        <strong>⚠️ Disclaimer:</strong> Trading bots involve financial risk. Start with small amounts
        and monitor performance closely. Past backtest results do not guarantee future profits.
      </div>
    </div>
  );
};
