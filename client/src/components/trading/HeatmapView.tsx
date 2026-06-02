/**
 * HEATMAP VIEW - PHASE 2 ENHANCEMENT
 * 
 * Visual representation of 30+ exchanges
 * - Color intensity: Based on price deviation from median
 * - Opacity: Based on liquidity level
 * - Interactive: Hover for details, click for comparison
 */

import React, { useMemo } from 'react';
import { AlertCircle, TrendingDown, TrendingUp } from '../../lib/icons';
import { ExchangeData } from '@/pages/trading';

interface HeatmapViewProps {
  exchanges: ExchangeData[];
  bestPrice: number;
  onSelectExchange?: (exchange: ExchangeData) => void;
}

const HeatmapView: React.FC<HeatmapViewProps> = ({
  exchanges,
  bestPrice,
  onSelectExchange,
}) => {
  const heatmapData = useMemo(() => {
    if (exchanges.length === 0) return [];

    const prices = exchanges.map((e) => e.price);
    const avgPrice = prices.reduce((a, b) => a + b) / prices.length;

    return exchanges.map((exchange) => {
      // Calculate deviation from average (normalized to -1 to 1)
      const priceDeviation = ((exchange.price - avgPrice) / avgPrice) * 100;
      const normalizedDeviation = Math.max(-1, Math.min(1, priceDeviation / 5));

      // Color intensity based on deviation
      // Green (negative/best) to Red (positive/worst)
      let color: string;
      let bgColor: string;

      if (normalizedDeviation < -0.5) {
        color = 'bg-green-600';
        bgColor = 'from-green-50 to-green-100';
      } else if (normalizedDeviation < -0.2) {
        color = 'bg-green-500';
        bgColor = 'from-green-50 to-emerald-50';
      } else if (normalizedDeviation < 0.2) {
        color = 'bg-yellow-400';
        bgColor = 'from-yellow-50 to-yellow-100';
      } else if (normalizedDeviation < 0.5) {
        color = 'bg-orange-500';
        bgColor = 'from-orange-50 to-orange-100';
      } else {
        color = 'bg-red-600';
        bgColor = 'from-red-50 to-red-100';
      }

      // Opacity based on liquidity (0.4 to 1.0)
      const maxLiquidity = Math.max(...exchanges.map((e) => e.liquidity));
      const opacity = 0.4 + (exchange.liquidity / maxLiquidity) * 0.6;

      // Calculate savings vs worst price
      const worstPrice = Math.max(...exchanges.map((e) => e.price));
      const savings = ((worstPrice - exchange.price) / worstPrice) * 100;

      return {
        ...exchange,
        priceDeviation,
        normalizedDeviation,
        color,
        bgColor,
        opacity,
        savings,
      };
    });
  }, [exchanges]);

  const avgPrice = useMemo(
    () =>
      exchanges.length > 0
        ? exchanges.reduce((a, b) => a + b.price, 0) / exchanges.length
        : 0,
    [exchanges]
  );

  const bestExchange = useMemo(
    () => heatmapData.reduce((best, current) => (best.price < current.price ? best : current), heatmapData[0]),
    [heatmapData]
  );

  const worstExchange = useMemo(
    () => heatmapData.reduce((worst, current) => (worst.price > current.price ? worst : current), heatmapData[0]),
    [heatmapData]
  );

  if (exchanges.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-gray-500">
        <AlertCircle className="w-12 h-12 mb-2" />
        <p>No exchange data available</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Legend and Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-4 rounded-lg border border-blue-200">
          <p className="text-sm text-gray-600 mb-1">Average Price</p>
          <p className="text-2xl font-bold text-blue-900">${avgPrice.toFixed(2)}</p>
          <p className="text-xs text-gray-500 mt-1">Median across all exchanges</p>
        </div>

        <div className="bg-gradient-to-br from-green-50 to-green-100 p-4 rounded-lg border border-green-200">
          <p className="text-sm text-gray-600 mb-1">Best Price</p>
          <p className="text-2xl font-bold text-green-900">${bestExchange.price.toFixed(2)}</p>
          <p className="text-xs text-gray-500 mt-1">on {bestExchange.name}</p>
        </div>

        <div className="bg-gradient-to-br from-red-50 to-red-100 p-4 rounded-lg border border-red-200">
          <p className="text-sm text-gray-600 mb-1">Spread</p>
          <p className="text-2xl font-bold text-red-900">
            {(((worstExchange.price - bestExchange.price) / bestExchange.price) * 100).toFixed(2)}%
          </p>
          <p className="text-xs text-gray-500 mt-1">Best to worst</p>
        </div>
      </div>

      {/* Color Scale Legend */}
      <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
        <p className="text-sm font-semibold text-gray-700 mb-3">Price Deviation Scale</p>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded bg-green-600"></div>
            <span className="text-sm text-gray-600">-5% or better</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded bg-yellow-400"></div>
            <span className="text-sm text-gray-600">Average</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded bg-red-600"></div>
            <span className="text-sm text-gray-600">+5% or worse</span>
          </div>
        </div>
        <p className="text-xs text-gray-500 mt-2">Opacity indicates liquidity depth</p>
      </div>

      {/* Heatmap Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {heatmapData.map((exchange) => (
          <div
            key={exchange.name}
            onClick={() => onSelectExchange?.(exchange)}
            className={`
              relative p-4 rounded-lg border-2 cursor-pointer transition-all
              hover:shadow-lg hover:scale-105 hover:z-10
              bg-gradient-to-br ${exchange.bgColor}
              border-gray-200 hover:border-blue-400
            `}
            /* eslint-disable-next-line */
            style={{
              opacity: exchange.opacity,
            }}
          >
            {/* Best Price Badge */}
            {exchange.price === bestPrice && (
              <div className="absolute top-2 right-2 bg-green-500 text-white px-2 py-1 rounded text-xs font-bold">
                BEST
              </div>
            )}

            {/* Exchange Header */}
            <div className="mb-3 flex items-start justify-between">
              <div>
                <h3 className="font-bold text-gray-900">{exchange.name}</h3>
                <p className="text-xs text-gray-500">{exchange.region}</p>
              </div>
              <div
                className={`
                  w-3 h-3 rounded-full
                  ${exchange.color}
                `}
              ></div>
            </div>

            {/* Price Display */}
            <div className="space-y-2">
              <div>
                <p className="text-sm text-gray-600">Price</p>
                <p className="text-xl font-bold text-gray-900">${exchange.price.toFixed(2)}</p>
              </div>

              {/* Deviation Indicator */}
              <div className="flex items-center gap-2">
                {exchange.priceDeviation < 0 ? (
                  <TrendingDown className="w-4 h-4 text-green-600" />
                ) : (
                  <TrendingUp className="w-4 h-4 text-red-600" />
                )}
                <span
                  className={`
                    text-sm font-semibold
                    ${exchange.priceDeviation < 0 ? 'text-green-600' : 'text-red-600'}
                  `}
                >
                  {exchange.priceDeviation > 0 ? '+' : ''}
                  {exchange.priceDeviation.toFixed(2)}%
                </span>
              </div>

              {/* Savings */}
              {exchange.savings > 0 && (
                <div className="bg-green-100 text-green-800 px-2 py-1 rounded text-xs font-semibold">
                  Save {exchange.savings.toFixed(2)}% vs worst
                </div>
              )}
            </div>

            {/* Exchange Stats */}
            <div className="mt-3 pt-3 border-t border-gray-300 space-y-2">
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-600">Volume</span>
                <span className="font-semibold text-gray-900">
                  ${(exchange.volume24h / 1e9).toFixed(2)}B
                </span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-600">Liquidity</span>
                <span className="font-semibold text-gray-900">
                  ${(exchange.liquidity / 1e6).toFixed(2)}M
                </span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-600">Fees</span>
                <span className="font-semibold text-gray-900">
                  {(exchange.fees.maker * 100).toFixed(3)}%
                </span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-600">Uptime</span>
                <span className="font-semibold text-gray-900">{exchange.uptime.toFixed(2)}%</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Insights */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="font-semibold text-blue-900 mb-2">💡 Heatmap Insights</h4>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• Green cards indicate better prices relative to market average</li>
          <li>• Red cards indicate higher prices - potential arbitrage opportunity</li>
          <li>• Opacity shows liquidity depth - darker = more liquid</li>
          <li>
            • {Math.round(((worstExchange.price - bestExchange.price) / bestExchange.price) * 100)}%
            {' '}spread offers potential for {(((worstExchange.price - bestExchange.price) / bestExchange.price) * 100).toFixed(2)}% profit on arbitrage
          </li>
        </ul>
      </div>
    </div>
  );
};

export default HeatmapView;
