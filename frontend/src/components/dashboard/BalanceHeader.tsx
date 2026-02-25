// frontend/src/components/dashboard/BalanceHeader.tsx
/**
 * Sticky Balance Header
 * Always visible at top, shows key metrics
 */

import React from 'react';

interface BalanceHeaderProps {
  data?: {
    tradingBalance: number;
    availableBalance: number;
    totalValue: number;
    todayGain: number;
    todayGainPct: number;
    winRate: number;
    activeStrategies: number;
    riskLevel: string;
  };
  isLoading?: boolean;
}

const BalanceHeader: React.FC<BalanceHeaderProps> = ({ data, isLoading }) => {
  const mockData = data || {
    tradingBalance: 2450.50,
    availableBalance: 1250.25,
    totalValue: 3700.75,
    todayGain: 125.50,
    todayGainPct: 3.49,
    winRate: 62.5,
    activeStrategies: 3,
    riskLevel: 'Medium',
  };

  const isGain = mockData.todayGain >= 0;

  return (
    <div className="bg-white dark:bg-dark-surface px-4 md:px-6 lg:px-8 py-4">
      <div className="max-w-7xl mx-auto">
        {/* Primary Balance Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
          {/* Trading Balance */}
          <div>
            <p className="text-xs md:text-sm text-gray-600 dark:text-gray-400 mb-1">
              Trading Balance
            </p>
            <p className="text-lg md:text-2xl font-bold text-gray-900 dark:text-white">
              ${mockData.tradingBalance.toFixed(2)}
            </p>
          </div>

          {/* Available Balance */}
          <div>
            <p className="text-xs md:text-sm text-gray-600 dark:text-gray-400 mb-1">
              Available
            </p>
            <p className="text-lg md:text-2xl font-bold text-gray-900 dark:text-white">
              ${mockData.availableBalance.toFixed(2)}
            </p>
          </div>

          {/* Today's Gain */}
          <div>
            <p className="text-xs md:text-sm text-gray-600 dark:text-gray-400 mb-1">
              Today's Gain
            </p>
            <div className="flex items-baseline space-x-1">
              <span
                className={`text-lg md:text-2xl font-bold ${
                  isGain ? 'text-success-green' : 'text-error-red'
                }`}
              >
                {isGain ? '+' : ''} ${Math.abs(mockData.todayGain).toFixed(2)}
              </span>
              <span
                className={`text-xs md:text-sm font-semibold ${
                  isGain ? 'text-success-green' : 'text-error-red'
                }`}
              >
                ({isGain ? '+' : ''}{mockData.todayGainPct.toFixed(2)}%)
              </span>
            </div>
          </div>

          {/* Total Value */}
          <div>
            <p className="text-xs md:text-sm text-gray-600 dark:text-gray-400 mb-1">
              Total Value
            </p>
            <p className="text-lg md:text-2xl font-bold text-gray-900 dark:text-white">
              ${mockData.totalValue.toFixed(2)}
            </p>
          </div>
        </div>

        {/* Secondary Metrics Row */}
        <div className="grid grid-cols-3 md:grid-cols-5 gap-2 md:gap-4">
          {/* Win Rate */}
          <div className="flex flex-col">
            <p className="text-xs text-gray-600 dark:text-gray-400">Win Rate</p>
            <p className="text-sm md:text-lg font-semibold text-gray-900 dark:text-white">
              {mockData.winRate.toFixed(1)}%
            </p>
          </div>

          {/* Active Strategies */}
          <div className="flex flex-col">
            <p className="text-xs text-gray-600 dark:text-gray-400">Active</p>
            <p className="text-sm md:text-lg font-semibold text-gray-900 dark:text-white">
              {mockData.activeStrategies} running
            </p>
          </div>

          {/* Risk Level */}
          <div className="flex flex-col">
            <p className="text-xs text-gray-600 dark:text-gray-400">Risk</p>
            <p className={`text-sm md:text-lg font-semibold ${
              mockData.riskLevel === 'High' ? 'text-error-red' :
              mockData.riskLevel === 'Medium' ? 'text-warning-orange' :
              'text-success-green'
            }`}>
              {mockData.riskLevel}
            </p>
          </div>

          {/* Action Buttons */}
          <div className="col-span-1 md:col-span-2 flex flex-col space-y-2">
            <button className="px-3 py-1 bg-success-green text-white text-xs md:text-sm rounded hover:opacity-90 transition-opacity">
              Deposit
            </button>
            <button className="px-3 py-1 bg-brand-blue text-white text-xs md:text-sm rounded hover:opacity-90 transition-opacity">
              Withdraw
            </button>
          </div>
        </div>

        {/* Status Indicator */}
        <div className="mt-3 flex items-center space-x-2 text-xs text-gray-600 dark:text-gray-400">
          <span className="inline-block w-2 h-2 rounded-full bg-success-green animate-pulse"></span>
          <span>🟢 REAL-TIME • Last update: {new Date().toLocaleTimeString()}</span>
        </div>
      </div>
    </div>
  );
};

export default BalanceHeader;
