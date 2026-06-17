import React, { useEffect, useState } from 'react';
import ChartJS from '@/components/charts/ChartJSSetup';
import { Chart } from 'react-chartjs-2';

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
        <div style={{ height: 300 }}>
          {
            (() => {
              const chartData = {
                labels: data.map(d => d.name),
                datasets: [
                  { label: 'Baseline', data: data.map(d => d.baseline), backgroundColor: 'rgba(100,116,139,0.5)' },
                  { label: 'Current', data: data.map(d => d.current), backgroundColor: '#3b82f6' }
                ]
              };

              const chartOptions = {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  legend: { position: 'top' },
                  tooltip: { callbacks: { label: (ctx: any) => (Math.round((ctx.raw as number) || 0) + '%') } }
                },
                scales: { x: { stacked: false }, y: { min: 0, max: 100 } }
              };

              return <Chart type="bar" data={chartData} options={chartOptions} />;
            })()
          }
        </div>
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
