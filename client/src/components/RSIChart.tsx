/**
 * RSI Chart Component
 * Displays Relative Strength Index as a gauge with signal interpretation
 */

import React from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { getRSIColor } from '@/hooks/useTechnicalIndicators';

interface RSIChartProps {
  value: number;
  signal: 'oversold' | 'neutral' | 'overbought';
}

export const RSIChart: React.FC<RSIChartProps> = ({ value, signal }) => {
  const radius = 45;
  const circumference = 2 * Math.PI * radius;

  // Calculate stroke offset (270 degrees starting from top-right)
  const percentage = value / 100;
  const strokeOffset = circumference - (percentage * circumference * 3) / 4;

  // Determine colors based on signal
  const signalColors = {
    oversold: { bg: 'bg-green-50', text: 'text-green-700', badge: 'bg-green-100' },
    neutral: { bg: 'bg-blue-50', text: 'text-blue-700', badge: 'bg-blue-100' },
    overbought: { bg: 'bg-red-50', text: 'text-red-700', badge: 'bg-red-100' }
  };

  const colors = signalColors[signal];
  const gaugeFillColor =
    signal === 'oversold' ? '#22c55e' : signal === 'overbought' ? '#ef4444' : '#3b82f6';

  return (
    <Card className={`p-6 ${colors.bg}`}>
      <div className="flex flex-col items-center gap-4">
        <h3 className="text-sm font-semibold text-gray-700">RSI (14)</h3>

        {/* SVG Gauge */}
        <div className="relative w-32 h-32">
          <svg viewBox="0 0 120 120" className="w-full h-full">
            {/* Background arc */}
            <circle
              cx="60"
              cy="60"
              r={radius}
              fill="none"
              stroke="#e5e7eb"
              strokeWidth="8"
              strokeLinecap="round"
              pathLength="100"
              strokeDasharray="75 25"
              className="transform origin-center"
              style={{
                transform: 'rotate(-90deg)',
                transformOrigin: '60px 60px'
              } as React.CSSProperties}
            />

            {/* Fill arc */}
            <circle
              cx="60"
              cy="60"
              r={radius}
              fill="none"
              stroke={gaugeFillColor}
              strokeWidth="8"
              strokeLinecap="round"
              pathLength="100"
              className="transition-all"
              strokeDasharray={`${percentage * 75} ${75 - percentage * 75}`}
              style={{
                transform: 'rotate(-90deg)',
                transformOrigin: '60px 60px',
                transition: 'stroke-dasharray 0.3s ease'
              } as React.CSSProperties}
            />

            {/* Text */}
            <text
              x="60"
              y="65"
              textAnchor="middle"
              className={`text-2xl font-bold ${colors.text}`}
              style={{ fontSize: '24px' } as React.CSSProperties}
            >
              {value.toFixed(1)}
            </text>
          </svg>

          {/* Center label */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <div className={`text-2xl font-bold ${colors.text}`}>{value.toFixed(1)}</div>
            </div>
          </div>
        </div>

        {/* Signal badge */}
        <Badge className={`${colors.badge} text-xs font-semibold`}>
          {signal === 'oversold' ? '🔵 Oversold (<30)' : signal === 'overbought' ? '🔴 Overbought (>70)' : '🟡 Neutral (30-70)'}
        </Badge>

        {/* Explanation */}
        <div className="text-center text-xs text-gray-600 max-w-xs">
          {signal === 'oversold' && 'Price may have fallen too far. Potential buy opportunity.'}
          {signal === 'overbought' && 'Price may have risen too far. Potential sell signal.'}
          {signal === 'neutral' && 'Price momentum is balanced. No extreme signal.'}
        </div>

        {/* Range indicators */}
        <div className="w-full px-2">
          <div className="flex justify-between text-xs text-gray-500 mb-1">
            <span>0</span>
            <span>50</span>
            <span>100</span>
          </div>
          <div className="flex gap-1 h-2 bg-gray-200 rounded-full overflow-hidden">
            <div className="flex-1 bg-green-500"></div>
            <div className="flex-1 bg-blue-500"></div>
            <div className="flex-1 bg-red-500"></div>
          </div>
          <div className="flex justify-between text-xs text-gray-500 mt-1">
            <span>Oversold</span>
            <span>Neutral</span>
            <span>Overbought</span>
          </div>
        </div>
      </div>
    </Card>
  );
};
