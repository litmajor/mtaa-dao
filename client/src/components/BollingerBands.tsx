/**
 * Bollinger Bands Component
 * Displays Bollinger Bands information and volatility signals
 */

import React from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { getBBColor } from '@/hooks/useTechnicalIndicators';

interface BollingerBandsProps {
  upper: number;
  middle: number;
  lower: number;
  position: 'above' | 'within' | 'below';
  currentPrice?: number;
}

export const BollingerBands: React.FC<BollingerBandsProps> = ({
  upper,
  middle,
  lower,
  position,
  currentPrice
}) => {
  const positionColors = {
    above: { bg: 'bg-red-50', text: 'text-red-700', badge: 'bg-red-100', signal: 'Overbought (Sell Signal)' },
    within: { bg: 'bg-blue-50', text: 'text-blue-700', badge: 'bg-blue-100', signal: 'Normal Range' },
    below: { bg: 'bg-green-50', text: 'text-green-700', badge: 'bg-green-100', signal: 'Oversold (Buy Signal)' }
  };

  const colors = positionColors[position];
  const bandwidth = ((upper - lower) / middle) * 100;
  const pricePercent = currentPrice ? ((currentPrice - lower) / (upper - lower)) * 100 : 50;

  return (
    <Card className={`p-6 ${colors.bg}`}>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-700">Bollinger Bands (20, 2)</h3>
          <Badge className={`${colors.badge} text-xs`}>
            {position === 'above' ? '🔴 Above' : position === 'below' ? '🟢 Below' : '🔵 Within'}
          </Badge>
        </div>

        {/* Band Values */}
        <div className="space-y-2 bg-white bg-opacity-60 rounded p-3">
          <div className="flex justify-between items-center">
            <span className="text-xs text-gray-600">Upper Band</span>
            <span className="font-mono font-semibold text-red-600">{upper.toFixed(2)}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-xs text-gray-600">Middle Band (SMA20)</span>
            <span className="font-mono font-semibold text-blue-600">{middle.toFixed(2)}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-xs text-gray-600">Lower Band</span>
            <span className="font-mono font-semibold text-green-600">{lower.toFixed(2)}</span>
          </div>
        </div>

        {/* Visual Band Representation */}
        <div className="space-y-2">
          {/* Upper Band */}
          <div className="flex items-center gap-2">
            <div className="w-12 text-right text-xs font-mono text-red-600">
              {upper.toFixed(0)}
            </div>
            <div className="flex-1 h-6 bg-red-200 rounded flex items-center">
              <div className="w-full h-1 bg-red-400"></div>
            </div>
          </div>

          {/* Middle Band */}
          <div className="flex items-center gap-2">
            <div className="w-12 text-right text-xs font-mono text-blue-600">
              {middle.toFixed(0)}
            </div>
            <div className="flex-1 h-6 bg-blue-200 rounded flex items-center">
              <div className="w-full h-1 bg-blue-400"></div>
            </div>
          </div>

          {/* Lower Band */}
          <div className="flex items-center gap-2">
            <div className="w-12 text-right text-xs font-mono text-green-600">
              {lower.toFixed(0)}
            </div>
            <div className="flex-1 h-6 bg-green-200 rounded flex items-center">
              <div className="w-full h-1 bg-green-400"></div>
            </div>
          </div>

          {/* Current Price Position Bar */}
          {currentPrice && (
            <div className="mt-3 pt-3 border-t border-gray-300">
              <div className="flex items-center gap-2">
                <div className="w-12 text-right text-xs font-mono text-gray-700 font-semibold">
                  Price
                </div>
                <div className="flex-1 h-8 bg-gradient-to-r from-green-300 via-blue-300 to-red-300 rounded relative">
                  <div
                    className="absolute top-1/2 -translate-y-1/2 w-1 h-10 bg-gray-900 rounded"
                    style={{ left: `${Math.max(0, Math.min(100, pricePercent))}%` } as React.CSSProperties}
                  />
                </div>
              </div>
              <div className="text-xs text-center mt-1 text-gray-600">
                {position === 'below' && '🟢 Below bands - potential bounce'}
                {position === 'within' && '🔵 Within bands - normal volatility'}
                {position === 'above' && '🔴 Above bands - potential pullback'}
              </div>
            </div>
          )}
        </div>

        {/* Bandwidth (Volatility) */}
        <div className="bg-white bg-opacity-60 rounded p-3">
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs text-gray-600 font-medium">Bandwidth (Volatility)</span>
            <span className={`font-semibold ${bandwidth > 10 ? 'text-red-600' : bandwidth > 5 ? 'text-orange-600' : 'text-green-600'}`}>
              {bandwidth.toFixed(2)}%
            </span>
          </div>
          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all ${
                bandwidth > 10 ? 'bg-red-500' : bandwidth > 5 ? 'bg-orange-500' : 'bg-green-500'
              }`}
              style={{ width: `${Math.min(100, bandwidth * 10)}%` } as React.CSSProperties}
            />
          </div>
          <div className="text-xs text-gray-500 mt-2">
            {bandwidth > 10 && '⚠️ High volatility - expect larger price swings'}
            {bandwidth <= 10 && bandwidth > 5 && '⚡ Moderate volatility - normal trading conditions'}
            {bandwidth <= 5 && '⏱️ Low volatility - breakout expected soon'}
          </div>
        </div>

        {/* Trade Signal */}
        <div className={`p-3 rounded border border-gray-300 ${colors.text}`}>
          <div className="text-sm font-semibold">{colors.signal}</div>
          <div className="text-xs text-gray-600 mt-1">
            {position === 'below' && 'Price near support. Good entry for long positions.'}
            {position === 'within' && 'Price in normal range. Trade based on other signals.'}
            {position === 'above' && 'Price near resistance. Consider taking profits or shorting.'}
          </div>
        </div>
      </div>
    </Card>
  );
};
