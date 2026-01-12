/* stylelint-disable */
/* stylelint-disable */
/**
 * Arbitrage Opportunities Component
 * Display profitable arbitrage trading opportunities across exchanges
 */

import React, { useMemo, useState } from 'react';
import { useArbitrageOpportunities, useBestArbitrage, calculateArbitrageProfit } from '@/hooks/useArbitrage';
import {
  getRiskColor,
  getRiskEmoji,
  formatProfitPercentage,
  formatVolumeScore,
  formatSpread,
  getOpportunityQuality,
  formatNumber
} from '@/hooks/useArbitrage';
import type { ArbitrageOpportunity } from '@/types/exchanges';

interface ArbitrageOpportunitiesProps {
  symbol: string;
  exchange?: string;
  minProfitPercent?: number;
  showBestOnly?: boolean;
}

export const ArbitrageOpportunitiesCard: React.FC<ArbitrageOpportunitiesProps> = ({
  symbol,
  exchange = 'binance',
  minProfitPercent = 0.5,
  showBestOnly = false
}) => {
  const [selectedOpportunity, setSelectedOpportunity] = useState<ArbitrageOpportunity | null>(null);
  const [tradeAmount, setTradeAmount] = useState(1000);
  const [profitCalculation, setProfitCalculation] = useState<any>(null);

  const { data: oppData, isLoading, error } = useArbitrageOpportunities(symbol, undefined, minProfitPercent);
  const { data: bestData } = useBestArbitrage(symbol);

  const opportunities = useMemo(() => {
    if (!oppData?.opportunities) return [];
    if (showBestOnly && bestData?.bestOpportunity) {
      return [bestData.bestOpportunity];
    }
    return oppData.opportunities;
  }, [oppData, bestData, showBestOnly]);

  const handleCalculateProfit = async (opportunity: ArbitrageOpportunity) => {
    try {
      const result = await calculateArbitrageProfit(opportunity, tradeAmount);
      setProfitCalculation(result);
      setSelectedOpportunity(opportunity);
    } catch (error) {
      console.error('Failed to calculate profit:', error);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-8 bg-gray-200 rounded w-32 animate-pulse"></div>
        <div className="h-64 bg-gray-100 rounded animate-pulse"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <div className="text-red-700">
          <div className="font-semibold">Error Loading Opportunities</div>
          <div className="text-sm mt-1">{(error as Error).message}</div>
        </div>
      </div>
    );
  }

  if (!opportunities || opportunities.length === 0) {
    return (
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="text-blue-700">
          <div className="font-semibold">No Arbitrage Opportunities</div>
          <div className="text-sm mt-1">No profitable trading opportunities found above {minProfitPercent}% threshold.</div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-3 border border-blue-200">
          <div className="text-xs text-blue-600 font-semibold">OPPORTUNITIES</div>
          <div className="text-2xl font-bold text-blue-700 mt-1">{opportunities.length}</div>
        </div>
        <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-3 border border-green-200">
          <div className="text-xs text-green-600 font-semibold">BEST PROFIT</div>
          <div className="text-2xl font-bold text-green-700 mt-1">
            {opportunities[0] ? `${opportunities[0].netProfitPercent.toFixed(2)}%` : '-'}
          </div>
        </div>
        <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg p-3 border border-purple-200">
          <div className="text-xs text-purple-600 font-semibold">AVG SPREAD</div>
          <div className="text-2xl font-bold text-purple-700 mt-1">
            {opportunities.length > 0
              ? `${(
                  opportunities.reduce((sum, o) => sum + o.spreadPercent, 0) /
                  opportunities.length
                ).toFixed(2)}%`
              : '-'}
          </div>
        </div>
      </div>

      {/* Opportunities Table */}
      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">Buy Exchange</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">Price</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">Sell Exchange</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">Price</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-700">Net Profit</th>
                <th className="px-4 py-3 text-center font-semibold text-gray-700">Risk</th>
                <th className="px-4 py-3 text-center font-semibold text-gray-700">Volume</th>
                <th className="px-4 py-3 text-center font-semibold text-gray-700">Action</th>
              </tr>
            </thead>
            <tbody>
              {opportunities.map((opp, idx) => {
                const profit = formatProfitPercentage(opp.netProfitPercent);
                const volumeScore = formatVolumeScore(opp.volumeScore);

                return (
                  <tr key={idx} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="font-semibold text-gray-900">{opp.buyExchange}</div>
                      <div className="text-xs text-gray-500">ASK</div>
                    </td>
                    <td className="px-4 py-3 font-mono text-gray-700">
                      ${opp.buyPrice.toFixed(2)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-gray-900">{opp.sellExchange}</div>
                      <div className="text-xs text-gray-500">BID</div>
                    </td>
                    <td className="px-4 py-3 font-mono text-gray-700">
                      ${opp.sellPrice.toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {/* eslint-disable-next-line */}
                      <div style={{ color: profit.color }} className="font-bold text-lg">
                        {profit.formatted}
                      </div>
                      <div className="text-xs text-gray-500">${opp.netProfit.toFixed(2)}</div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {/* eslint-disable-next-line */}
                      <div style={{ color: getRiskColor(opp.risk) }} className="font-semibold">
                        {getRiskEmoji(opp.risk)}
                      </div>
                      <div className="text-xs text-gray-500 capitalize">{opp.risk}</div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {/* eslint-disable-next-line */}
                      <div style={{ color: volumeScore.color }} className="font-semibold">
                        {volumeScore.emoji}
                      </div>
                      <div className="text-xs text-gray-500">{volumeScore.label}</div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => handleCalculateProfit(opp)}
                        className="px-3 py-1.5 bg-blue-500 hover:bg-blue-600 text-white text-xs font-semibold rounded transition-colors"
                      >
                        Calculate
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Profit Calculation Panel */}
      {selectedOpportunity && profitCalculation && (
        <div className="bg-gradient-to-br from-green-50 to-green-100 border-2 border-green-200 rounded-lg p-4 space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <div className="text-sm font-semibold text-green-700">Trade Route</div>
              <div className="text-lg font-bold text-gray-900">
                {selectedOpportunity.buyExchange.toUpperCase()} → {selectedOpportunity.sellExchange.toUpperCase()}
              </div>
            </div>
            <button
              onClick={() => {
                setSelectedOpportunity(null);
                setProfitCalculation(null);
              }}
              className="text-gray-400 hover:text-gray-600 text-2xl"
            >
              ×
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* Buy Side */}
            <div className="bg-white rounded-lg p-3 border border-green-200">
              <div className="text-xs font-semibold text-green-600 uppercase mb-2">Buy</div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Amount:</span>
                  <span className="font-mono font-bold text-gray-900">
                    {profitCalculation.profit.buyAmount.toFixed(8)} {symbol.split('/')[0]}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Price:</span>
                  <span className="font-mono font-bold text-gray-900">
                    ${selectedOpportunity.buyPrice.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between pt-2 border-t border-green-100">
                  <span className="text-gray-600">Total Cost:</span>
                  <span className="font-mono font-bold text-gray-900">
                    ${formatNumber(profitCalculation.profit.buyTotal)}
                  </span>
                </div>
              </div>
            </div>

            {/* Sell Side */}
            <div className="bg-white rounded-lg p-3 border border-green-200">
              <div className="text-xs font-semibold text-green-600 uppercase mb-2">Sell</div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Amount:</span>
                  <span className="font-mono font-bold text-gray-900">
                    {profitCalculation.profit.buyAmount.toFixed(8)} {symbol.split('/')[0]}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Price:</span>
                  <span className="font-mono font-bold text-gray-900">
                    ${selectedOpportunity.sellPrice.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between pt-2 border-t border-green-100">
                  <span className="text-gray-600">Total Received:</span>
                  <span className="font-mono font-bold text-gray-900">
                    ${formatNumber(profitCalculation.profit.sellTotal)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Fees & Net Profit */}
          <div className="bg-white rounded-lg p-3 border border-green-200 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Trading Fees:</span>
              <span className="font-mono text-red-600 font-bold">
                -${formatNumber(profitCalculation.profit.fees)}
              </span>
            </div>
            <div className="flex justify-between pt-2 border-t border-green-100">
              <span className="font-semibold text-gray-900">NET PROFIT:</span>
              <div className="text-right">
                <div className="font-mono text-green-600 font-bold text-lg">
                  ${formatNumber(profitCalculation.profit.netProfit)}
                </div>
                <div className="text-green-600 font-bold">
                  {profitCalculation.profit.roi.toFixed(2)}% ROI
                </div>
              </div>
            </div>
          </div>

          {/* Trade Amount Input */}
          <div className="bg-white rounded-lg p-3 border border-green-200">
            <label className="block text-xs font-semibold text-green-700 mb-2" htmlFor="trade-amount">
              ADJUST TRADE AMOUNT (USD)
            </label>
            <div className="flex gap-2">
              <input
                id="trade-amount"
                type="number"
                placeholder="Enter trade amount in USD"
                value={tradeAmount}
                onChange={(e) => {
                  const newAmount = parseFloat(e.target.value) || 0;
                  setTradeAmount(newAmount);
                  handleCalculateProfit(selectedOpportunity);
                }}
                className="flex-1 px-3 py-2 border border-gray-300 rounded font-mono text-sm"
              />
              <button
                onClick={() => handleCalculateProfit(selectedOpportunity)}
                className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white font-semibold rounded transition-colors"
              >
                Recalculate
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ArbitrageOpportunitiesCard;
