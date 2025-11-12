import React, { useEffect, useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from 'recharts';

interface RiskFactorData {
  name: string;
  current: number;
  baseline: number;
  trend: 'up' | 'down' | 'stable';
}

interface RiskFactorChartProps {
  daoId?: string;
  factors?: RiskFactorData[];
}

const DEFAULT_FACTORS: RiskFactorData[] = [
  { name: 'Treasury', current: 65, baseline: 70, trend: 'down' },
  { name: 'Governance', current: 72, baseline: 75, trend: 'down' },
  { name: 'Community', current: 58, baseline: 65, trend: 'down' },
  { name: 'System', current: 80, baseline: 80, trend: 'stable' }
];

/**
 * Risk factor visualization component
 * Shows current vs baseline risk scores for key DAO health factors
 */
export default function RiskFactorChart({ daoId, factors = DEFAULT_FACTORS }: RiskFactorChartProps) {
  const [data, setData] = useState<RiskFactorData[]>(DEFAULT_FACTORS);

  useEffect(() => {
    if (factors && factors.length > 0) {
      setData(factors);
    }
  }, [factors, daoId]);

  const getTrendIcon = (trend: 'up' | 'down' | 'stable') => {
    switch (trend) {
      case 'up':
        return <span className="text-green-400">↑</span>;
      case 'down':
        return <span className="text-red-400">↓</span>;
      case 'stable':
        return <span className="text-blue-400">→</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Chart */}
      <div className="bg-slate-700/50 rounded-lg p-6 border border-slate-600">
        <h4 className="font-bold text-white mb-4">Risk Factor Analysis</h4>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(100,116,139,0.3)" />
            <XAxis
              dataKey="name"
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
            <Legend
              wrapperStyle={{ paddingTop: '20px' }}
              iconType="square"
            />
            <Bar
              dataKey="baseline"
              fill="rgba(100,116,139,0.5)"
              name="Baseline"
              radius={[4, 4, 0, 0]}
            />
            <Bar
              dataKey="current"
              fill="#3b82f6"
              name="Current"
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Risk Factor Details */}
      <div className="bg-slate-700/50 rounded-lg p-6 border border-slate-600">
        <h4 className="font-bold text-white mb-4">Risk Factor Details</h4>
        <div className="space-y-3">
          {data.map((factor) => {
            const variance = factor.current - factor.baseline;
            const isRising = variance > 5;
            const isFalling = variance < -5;

            return (
              <div
                key={factor.name}
                className="bg-slate-600/30 p-3 rounded border border-slate-600 flex items-center justify-between"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-gray-200">{factor.name}</span>
                    <span className="text-sm">{getTrendIcon(factor.trend)}</span>
                  </div>
                  <div className="text-xs text-gray-400 mt-1">
                    Baseline: <span className="text-gray-300">{factor.baseline}%</span>
                  </div>
                </div>

                <div className="text-right">
                  <div className={`text-lg font-bold ${
                    factor.current < 50 ? 'text-red-400' :
                    factor.current < 70 ? 'text-yellow-400' :
                    'text-green-400'
                  }`}>
                    {factor.current}%
                  </div>
                  <div className={`text-xs font-semibold ${
                    isRising ? 'text-red-400' :
                    isFalling ? 'text-green-400' :
                    'text-gray-400'
                  }`}>
                    {variance > 0 ? '+' : ''}{variance}%
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Risk Summary */}
      <div className="bg-slate-700/50 rounded-lg p-6 border border-slate-600">
        <h4 className="font-bold text-white mb-3">Risk Summary</h4>
        <div className="space-y-2 text-sm text-gray-300">
          <p>
            <strong>Critical Factors:</strong>{' '}
            {data.filter(f => f.current < 50).length === 0 ? 'None' : 
             data.filter(f => f.current < 50).map(f => f.name).join(', ')}
          </p>
          <p>
            <strong>Deteriorating:</strong>{' '}
            {data.filter(f => f.current - f.baseline < -5).length === 0 ? 'None' :
             data.filter(f => f.current - f.baseline < -5).map(f => f.name).join(', ')}
          </p>
          <p>
            <strong>Improving:</strong>{' '}
            {data.filter(f => f.current - f.baseline > 5).length === 0 ? 'None' :
             data.filter(f => f.current - f.baseline > 5).map(f => f.name).join(', ')}
          </p>
        </div>
      </div>
    </div>
  );
}
