/* stylelint-disable */
/* stylelint-disable declaration-no-important, no-descending-specificity, no-duplicate-selectors */
/**
 * BTC Dominance Card Component
 * Display Bitcoin dominance and price metrics
 *
 * Note: This component uses inline styles for dynamic color mapping based on change direction
 * and dominance status. Stylelint warnings are intentionally suppressed as these styles
 * are data-driven and cannot be externalized to CSS files.
 */

import React from 'react';
import { useBtcDominance } from '@/hooks/useFearGreed';
import { formatChangePercent, formatLargeNumber } from '@/hooks/useFearGreed';
import { formatNumberCompact } from '@/utils/dataVisualization';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';

export const BtcDominanceCard: React.FC = () => {
  const { data, isLoading, error } = useBtcDominance();

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-64 bg-gray-200 rounded-lg animate-pulse"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <div className="text-red-700 font-semibold">Failed to load BTC dominance</div>
      </div>
    );
  }

  if (!data?.btcDominance) {
    return null;
  }

  const { btcDominance } = data;
  const { dominancePercent, price, change24h, change7d, marketCap } = btcDominance;

  const altcoinPercent = 100 - dominancePercent;

  const pieData = [
    { name: 'Bitcoin', value: dominancePercent },
    { name: 'Altcoins', value: altcoinPercent }
  ];

  const change24hFormatted = formatChangePercent(change24h);
  const change7dFormatted = formatChangePercent(change7d);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">Bitcoin Dominance</h2>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
          Bitcoin's market share and price performance
        </p>
      </div>

      {/* Main Dominance Display */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Pie Chart */}
        <div className="bg-white dark:bg-slate-800 rounded-lg p-6 border border-gray-200 dark:border-slate-700 shadow-sm col-span-1">
          <div className="text-sm font-semibold text-gray-600 dark:text-gray-400 mb-4 text-center">
            Market Share
          </div>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie 
                data={pieData} 
                cx="50%" 
                cy="50%" 
                innerRadius={60} 
                outerRadius={100} 
                dataKey="value"
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(1)}%`}
                labelLine={false}
              >
                <Cell fill="#f7931a" /> {/* Bitcoin orange */}
                <Cell fill="#6b7280" /> {/* Altcoins gray */}
              </Pie>
              <Tooltip formatter={(value: any) => `${(value as number).toFixed(1)}%`} />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex gap-4 justify-center text-xs mt-4">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-orange-500 rounded-full"></div>
              <span className="text-gray-600 dark:text-gray-400">Bitcoin {dominancePercent.toFixed(1)}%</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-gray-500 rounded-full"></div>
              <span className="text-gray-600 dark:text-gray-400">Altcoins {altcoinPercent.toFixed(1)}%</span>
            </div>
          </div>
        </div>

        {/* Dominance & Price Stats */}
        <div className="bg-white dark:bg-slate-800 rounded-lg p-6 border border-gray-200 dark:border-slate-700 shadow-sm col-span-1 md:col-span-2">
          <div className="grid grid-cols-2 gap-6">
              {/* Dominance */}
            <div>
              <div className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider mb-3">
                Dominance
              </div>
              <div className="text-4xl font-black text-orange-600 dark:text-orange-400 mb-2">
                {dominancePercent.toFixed(1)}%
              </div>
              <div className="text-xs text-orange-600 dark:text-orange-300 mb-4">
                ₿ Bitcoin controls this much of total market cap
              </div>

              {/* Dominance Bar */}
              {/* stylelint-disable-next-line */}
              <div className="w-full h-2 bg-gray-300 dark:bg-slate-600 rounded-full overflow-hidden mb-4">
                {/* stylelint-disable-next-line */}
                <div
                  className="h-full bg-gradient-to-r from-orange-500 to-orange-600 transition-all duration-300"
                  style={{ width: `${dominancePercent}%` }}
                ></div>
              </div>

              {/* Interpretation */}
              <div className="text-xs space-y-1">
                <div className="text-gray-700 dark:text-gray-300">
                  {dominancePercent > 50
                    ? '📌 Bitcoin-dominated market (concentration)'
                    : '🎨 Altcoin-friendly market (diversified)'}
                </div>
              </div>
            </div>

            {/* Price & Changes */}
            <div>
              <div className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider mb-3">
                BTC Price
              </div>
              <div className="text-3xl font-black text-orange-600 dark:text-orange-400 mb-4">
                ${price.toFixed(2)}
              </div>

              {/* 24h Change */}
              <div className="mb-3">
                <div className="text-xs text-gray-700 dark:text-gray-300 mb-1">24h Change</div>
                <div className="flex items-center gap-2">
                  {/* stylelint-disable-next-line */}
                  <span style={{ color: change24hFormatted.color }} className="text-lg font-bold">
                    {change24hFormatted.emoji}
                  </span>
                  {/* stylelint-disable-next-line */}
                  <span style={{ color: change24hFormatted.color }} className="font-semibold">
                    {change24hFormatted.formatted}
                  </span>
                </div>
              </div>

              {/* 7d Change */}
              <div>
                <div className="text-xs text-gray-700 dark:text-gray-300 mb-1">7d Change</div>
                <div className="flex items-center gap-2">
                  {/* stylelint-disable-next-line */}
                  <span style={{ color: change7dFormatted.color }} className="text-lg font-bold">
                    {change7dFormatted.emoji}
                  </span>
                  {/* stylelint-disable-next-line */}
                  <span style={{ color: change7dFormatted.color }} className="font-semibold">
                    {change7dFormatted.formatted}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Market Cap Breakdown */}
      <div className="bg-white dark:bg-slate-800 rounded-lg p-6 border border-gray-200 dark:border-slate-700 shadow-sm">
        <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-4">Market Cap Breakdown</h3>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center">
            <div className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase mb-2">
              BTC Market Cap
            </div>
            <div className="text-2xl font-black text-orange-600 dark:text-orange-400">
              {formatNumberCompact(marketCap, 2)}
            </div>
          </div>

          <div className="text-center">
            <div className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase mb-2">
              % of Total
            </div>
            <div className="text-2xl font-black text-blue-600 dark:text-blue-400">
              {dominancePercent.toFixed(1)}%
            </div>
          </div>

          <div className="text-center">
            <div className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase mb-2">
              Altcoin Share
            </div>
            <div className="text-2xl font-black text-purple-600 dark:text-purple-400">
              {altcoinPercent.toFixed(1)}%
            </div>
          </div>

          <div className="text-center">
            <div className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase mb-2">
              Market Status
            </div>
            <div className="text-lg font-bold">
              {dominancePercent > 55
                ? '🔴 High'
                : dominancePercent > 45
                  ? '🟡 Normal'
                  : '🟢 Low'}
            </div>
          </div>
        </div>
      </div>

      {/* Key Insights */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-blue-50 dark:bg-slate-800 border border-blue-200 dark:border-slate-700 rounded-lg p-4 shadow-sm">
          <div className="text-sm font-semibold text-blue-900 dark:text-blue-400 mb-2">📊 What This Means</div>
          <ul className="text-xs text-blue-800 dark:text-blue-300 space-y-1">
            <li>• High dominance (&gt;50%): BTC leads the market</li>
            <li>• Low dominance (&lt;40%): Altseason likely</li>
            <li>• Rising dominance: Risk-off sentiment</li>
            <li>• Falling dominance: Risk-on sentiment</li>
          </ul>
        </div>

        <div className="bg-green-50 dark:bg-slate-800 border border-green-200 dark:border-slate-700 rounded-lg p-4 shadow-sm">
          <div className="text-sm font-semibold text-green-900 dark:text-green-400 mb-2">💡 Trading Insight</div>
          <div className="text-xs text-green-800 dark:text-green-300">
            When BTC dominance is {dominancePercent > 50 ? 'high' : 'low'}, traders should focus on{' '}
            {dominancePercent > 50 ? 'Bitcoin and major alts' : 'emerging altcoins and low-cap projects'}.
          </div>
        </div>
      </div>
    </div>
  );
};

export default BtcDominanceCard;
