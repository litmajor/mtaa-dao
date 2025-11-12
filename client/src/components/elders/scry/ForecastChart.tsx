import React, { useEffect, useState } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Area,
  AreaChart
} from 'recharts';

interface ChartData {
  time: string;
  score: number;
  treasury?: number;
  governance?: number;
  community?: number;
}

interface ForecastChartProps {
  daoId: string;
  dataPoints?: number;
}

/**
 * Health forecast visualization component
 * Shows predicted DAO health trajectory over 24 hours
 */
export default function ForecastChart({ daoId, dataPoints = 24 }: ForecastChartProps) {
  const [data, setData] = useState<ChartData[]>([]);

  useEffect(() => {
    // Generate mock forecast data (24 hourly data points)
    const mockData: ChartData[] = [];
    for (let i = 0; i < dataPoints; i++) {
      mockData.push({
        time: `${i}:00`,
        score: Math.max(20, 70 - Math.random() * 30 + (i * 0.5)),
        treasury: 70 - Math.random() * 20,
        governance: 65 - Math.random() * 15,
        community: 75 - Math.random() * 10
      });
    }
    setData(mockData);
  }, [daoId, dataPoints]);

  return (
    <div className="bg-slate-700/50 rounded-lg p-6 border border-slate-600">
      <h4 className="font-bold text-white mb-4">24-Hour Health Forecast</h4>
      <ResponsiveContainer width="100%" height={300}>
        <AreaChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="colorScore" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
              <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(100,116,139,0.3)" />
          <XAxis 
            dataKey="time" 
            stroke="rgba(148,163,184,0.5)"
            tick={{ fontSize: 12 }}
          />
          <YAxis 
            domain={[0, 100]} 
            stroke="rgba(148,163,184,0.5)"
            tick={{ fontSize: 12 }}
          />
          <Tooltip
            contentStyle={{ 
              backgroundColor: 'rgba(15,23,42,0.9)', 
              border: '1px solid rgba(71,85,105,0.5)',
              borderRadius: '0.5rem'
            }}
            labelStyle={{ color: '#e2e8f0' }}
            formatter={(value) => `${Math.round(value as number)}%`}
          />
          <Area
            type="monotone"
            dataKey="score"
            stroke="#3b82f6"
            strokeWidth={2}
            fillOpacity={1}
            fill="url(#colorScore)"
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
      
      <div className="mt-4 pt-4 border-t border-slate-600">
        <p className="text-xs text-gray-400">
          <strong>Health Score:</strong> Overall DAO health metric combining treasury, governance, and community factors.
        </p>
      </div>
    </div>
  );
}
