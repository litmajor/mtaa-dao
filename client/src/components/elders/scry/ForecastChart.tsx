import React, { useEffect, useState } from 'react';
import ChartJS from '@/components/charts/ChartJSSetup';
import { Line } from 'react-chartjs-2';

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

  const labels = data.map(d => d.time);
  const chartData = {
    labels,
    datasets: [
      {
        label: 'Health Score',
        data: data.map(d => d.score),
        borderColor: '#3b82f6',
        backgroundColor: 'rgba(59,130,246,0.15)',
        fill: true,
        tension: 0.2,
        pointRadius: 2,
        borderWidth: 2,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false }, tooltip: { mode: 'index', intersect: false } },
    scales: {
      x: { ticks: { color: 'rgba(148,163,184,0.9)' } },
      y: { min: 0, max: 100, ticks: { color: 'rgba(148,163,184,0.9)' } },
    },
  } as any;

  return (
    <div className="bg-slate-700/50 rounded-lg p-6 border border-slate-600">
      <h4 className="font-bold text-white mb-4">24-Hour Health Forecast</h4>
      <div style={{ height: 300 }}>
        <Line data={chartData} options={options} />
      </div>

      <div className="mt-4 pt-4 border-t border-slate-600">
        <p className="text-xs text-gray-400">
          <strong>Health Score:</strong> Overall DAO health metric combining treasury, governance, and community factors.
        </p>
      </div>
    </div>
  );
}
