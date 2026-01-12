/**
 * Moving Averages Component
 * Displays SMA20, SMA50, SMA200 and trend analysis
 */

import React from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface MovingAveragesProps {
  sma20: number;
  sma50: number;
  sma200: number;
  ema12: number;
  ema26: number;
  currentPrice?: number;
}

export const MovingAverages: React.FC<MovingAveragesProps> = ({
  sma20,
  sma50,
  sma200,
  ema12,
  ema26,
  currentPrice
}) => {
  // Determine trend
  let trend: 'strong_uptrend' | 'uptrend' | 'sideways' | 'downtrend' | 'strong_downtrend' =
    'sideways';
  let trendColor = 'text-gray-600';
  let trendBg = 'bg-gray-100';
  let trendEmoji = '➡️';

  if (currentPrice) {
    if (currentPrice > sma20 && sma20 > sma50 && sma50 > sma200) {
      trend = 'strong_uptrend';
      trendColor = 'text-green-700';
      trendBg = 'bg-green-100';
      trendEmoji = '📈';
    } else if (currentPrice > sma50 && sma50 > sma200) {
      trend = 'uptrend';
      trendColor = 'text-green-600';
      trendBg = 'bg-green-50';
      trendEmoji = '📈';
    } else if (currentPrice < sma20 && sma20 < sma50 && sma50 < sma200) {
      trend = 'strong_downtrend';
      trendColor = 'text-red-700';
      trendBg = 'bg-red-100';
      trendEmoji = '📉';
    } else if (currentPrice < sma50 && sma50 < sma200) {
      trend = 'downtrend';
      trendColor = 'text-red-600';
      trendBg = 'bg-red-50';
      trendEmoji = '📉';
    }
  }

  const trendLabels = {
    strong_uptrend: 'Strong Uptrend',
    uptrend: 'Uptrend',
    sideways: 'Sideways/No Clear Trend',
    downtrend: 'Downtrend',
    strong_downtrend: 'Strong Downtrend'
  };

  return (
    <Card className={`p-6 ${trendBg}`}>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-700">Moving Averages</h3>
          <Badge className={`${trendColor} bg-white border border-current text-xs`}>
            {trendEmoji} {trendLabels[trend]}
          </Badge>
        </div>

        {/* SMA Section */}
        <div className="space-y-2 bg-white bg-opacity-70 rounded p-3">
          <h4 className="text-xs font-semibold text-gray-600">Simple Moving Averages (SMA)</h4>

          <div className="space-y-2">
            {/* SMA 20 */}
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-700">SMA 20</span>
              <div className="flex items-center gap-2">
                <span className="font-mono font-semibold text-blue-600">{sma20.toFixed(2)}</span>
                {currentPrice && (
                  <span className={`text-xs font-medium ${currentPrice > sma20 ? 'text-green-600' : 'text-red-600'}`}>
                    {currentPrice > sma20 ? '↑' : '↓'}
                  </span>
                )}
              </div>
            </div>

            {/* SMA 50 */}
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-700">SMA 50</span>
              <div className="flex items-center gap-2">
                <span className="font-mono font-semibold text-orange-600">{sma50.toFixed(2)}</span>
                {currentPrice && (
                  <span className={`text-xs font-medium ${currentPrice > sma50 ? 'text-green-600' : 'text-red-600'}`}>
                    {currentPrice > sma50 ? '↑' : '↓'}
                  </span>
                )}
              </div>
            </div>

            {/* SMA 200 */}
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-700">SMA 200</span>
              <div className="flex items-center gap-2">
                <span className="font-mono font-semibold text-red-600">{sma200.toFixed(2)}</span>
                {currentPrice && (
                  <span className={`text-xs font-medium ${currentPrice > sma200 ? 'text-green-600' : 'text-red-600'}`}>
                    {currentPrice > sma200 ? '↑' : '↓'}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* SMA Trend Line */}
          <div className="mt-3 pt-3 border-t border-gray-200">
            <div className="flex gap-1 h-3 rounded-full overflow-hidden bg-gray-200">
              <div
                className="bg-blue-500"
                style={{
                  flex: `${(sma20 / (sma200 + sma20 + sma50)) * 300}%`
                } as React.CSSProperties}
                title="SMA 20"
              />
              <div
                className="bg-orange-500"
                style={{
                  flex: `${(sma50 / (sma200 + sma20 + sma50)) * 300}%`
                } as React.CSSProperties}
                title="SMA 50"
              />
              <div
                className="bg-red-500"
                style={{
                  flex: `${(sma200 / (sma200 + sma20 + sma50)) * 300}%`
                } as React.CSSProperties}
                title="SMA 200"
              />
            </div>
            <div className="flex gap-4 mt-2 text-xs">
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                <span>SMA20</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                <span>SMA50</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                <span>SMA200</span>
              </div>
            </div>
          </div>
        </div>

        {/* EMA Section */}
        <div className="space-y-2 bg-white bg-opacity-70 rounded p-3">
          <h4 className="text-xs font-semibold text-gray-600">Exponential Moving Averages (EMA)</h4>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="text-xs text-gray-500">EMA 12</div>
              <div className="font-mono font-semibold text-purple-600">{ema12.toFixed(2)}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500">EMA 26</div>
              <div className="font-mono font-semibold text-pink-600">{ema26.toFixed(2)}</div>
            </div>
          </div>

          <div className="text-xs text-gray-600 mt-2">
            {ema12 > ema26 ? '🟢 EMA 12 above EMA 26 - Bullish momentum' : '🔴 EMA 12 below EMA 26 - Bearish momentum'}
          </div>
        </div>

        {/* Trend Analysis */}
        <div className={`p-3 rounded border-2 ${trendColor === 'text-green-700' ? 'border-green-400 bg-green-50' : trendColor === 'text-green-600' ? 'border-green-300 bg-green-50' : trendColor === 'text-red-700' ? 'border-red-400 bg-red-50' : trendColor === 'text-red-600' ? 'border-red-300 bg-red-50' : 'border-gray-300 bg-gray-50'}`}>
          <div className={`text-sm font-semibold ${trendColor}`}>
            {trendLabels[trend]}
          </div>
          <div className="text-xs text-gray-600 mt-1">
            {trend === 'strong_uptrend' && 'Price above all three moving averages with bullish alignment. Strong buy signal.'}
            {trend === 'uptrend' && 'Price above 50-day MA with bullish alignment. Positive momentum.'}
            {trend === 'downtrend' && 'Price below 50-day MA with bearish alignment. Negative momentum.'}
            {trend === 'strong_downtrend' && 'Price below all three moving averages with bearish alignment. Strong sell signal.'}
            {trend === 'sideways' && 'Price not clearly aligned with moving averages. Watch for breakout.'}
          </div>
        </div>

        {/* Support/Resistance Levels */}
        <div className="bg-white bg-opacity-70 rounded p-3">
          <h4 className="text-xs font-semibold text-gray-600 mb-2">Support/Resistance</h4>
          <div className="space-y-1 text-xs">
            <div className="flex justify-between">
              <span className="text-gray-600">Resistance (SMA20)</span>
              <span className="font-semibold text-gray-700">{sma20.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Mid-Support (SMA50)</span>
              <span className="font-semibold text-gray-700">{sma50.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Strong Support (SMA200)</span>
              <span className="font-semibold text-gray-700">{sma200.toFixed(2)}</span>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
};
