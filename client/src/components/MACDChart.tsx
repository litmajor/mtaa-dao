/**
 * MACD Chart Component
 * Displays MACD line, Signal line, and Histogram
 */

import React from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ComposedChart } from 'recharts';
import { getMACDColor } from '@/hooks/useTechnicalIndicators';

interface MACDChartProps {
  macd: number;
  signal: number;
  histogram: number;
  position: 'bearish' | 'neutral' | 'bullish';
}

export const MACDChart: React.FC<MACDChartProps> = ({ macd, signal, histogram, position }) => {
  // Create sample data for visualization (in real implementation, would use full historical data)
  const data = [
    { name: 'Current', macd, signal, histogram }
  ];

  const positionColors = {
    bullish: { bg: 'bg-green-50', text: 'text-green-700', badge: 'bg-green-100' },
    neutral: { bg: 'bg-blue-50', text: 'text-blue-700', badge: 'bg-blue-100' },
    bearish: { bg: 'bg-red-50', text: 'text-red-700', badge: 'bg-red-100' }
  };

  const colors = positionColors[position];
  const histogramColor = histogram > 0 ? '#22c55e' : histogram < 0 ? '#ef4444' : '#6b7280';

  return (
    <Card className={`p-6 ${colors.bg}`}>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-700">MACD (12, 26, 9)</h3>
          <Badge className={`${colors.badge} text-xs`}>
            {position === 'bullish' ? '📈 Bullish' : position === 'bearish' ? '📉 Bearish' : '➡️ Neutral'}
          </Badge>
        </div>

        {/* Metrics Display */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white bg-opacity-60 rounded p-3">
            <div className="text-xs text-gray-600 font-medium">MACD Line</div>
            <div className="text-lg font-semibold text-blue-600">{macd.toFixed(4)}</div>
          </div>
          <div className="bg-white bg-opacity-60 rounded p-3">
            <div className="text-xs text-gray-600 font-medium">Signal Line</div>
            <div className="text-lg font-semibold text-orange-600">{signal.toFixed(4)}</div>
          </div>
          <div className="bg-white bg-opacity-60 rounded p-3">
            <div className="text-xs text-gray-600 font-medium">Histogram</div>
            <div className={`text-lg font-semibold ${histogram > 0 ? 'text-green-600' : 'text-red-600'}`}>
              {histogram.toFixed(4)}
            </div>
          </div>
        </div>

        {/* Visual Histogram */}
        <div className="h-16 flex items-end justify-center gap-1 bg-white bg-opacity-40 rounded p-3">
          {/* Negative bars (bearish) */}
          <div className="w-8 h-12 flex items-start justify-center">
            {histogram < 0 && (
              <div
                className="w-1 rounded-sm"
                style={{
                  height: `${Math.min(Math.abs(histogram) * 100, 48)}px`,
                  backgroundColor: '#ef4444'
                } as React.CSSProperties}
              />
            )}
          </div>

          {/* Zero line */}
          <div className="w-1 h-12 bg-gray-300" />

          {/* Positive bars (bullish) */}
          <div className="w-8 h-12 flex items-start justify-center">
            {histogram > 0 && (
              <div
                className="w-1 rounded-sm"
                style={{
                  height: `${Math.min(histogram * 100, 48)}px`,
                  backgroundColor: '#22c55e'
                } as React.CSSProperties}
              />
            )}
          </div>
        </div>

        {/* Explanation */}
        <div className="text-xs text-gray-600 bg-white bg-opacity-40 rounded p-2">
          {position === 'bullish' && 'MACD is above signal line with positive histogram - buy signal. Momentum increasing.'}
          {position === 'bearish' && 'MACD is below signal line with negative histogram - sell signal. Momentum decreasing.'}
          {position === 'neutral' && 'MACD and signal line are crossing or neutral - observe for next move.'}
        </div>
      </div>
    </Card>
  );
};
