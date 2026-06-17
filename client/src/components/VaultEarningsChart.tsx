import React from 'react';
import ChartJS from '@/components/charts/ChartJSSetup';
import { Line } from 'react-chartjs-2';

interface Props {
  data: Array<{ date: string; earnings: number }>;
}

export default function VaultEarningsChart({ data }: Props) {
  const labels = data.map(d => d.date);
  const chartData = {
    labels,
    datasets: [
      {
        label: 'Earnings',
        data: data.map(d => d.earnings),
        borderColor: '#16a34a',
        backgroundColor: 'rgba(187,247,208,0.5)',
        fill: true,
        tension: 0.3,
        pointRadius: 0,
        borderWidth: 2,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: { mode: 'index', intersect: false },
    },
    scales: {
      x: { display: false },
      y: { display: false },
    },
  } as any;

  return (
    <div style={{ height: 250 }}>
      <Line data={chartData} options={options} />
    </div>
  );
}
