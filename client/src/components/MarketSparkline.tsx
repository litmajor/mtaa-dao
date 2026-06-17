import React from 'react';
import { Line } from 'react-chartjs-2';

export type SparklinePoint = {
  time: number;
  value: number;
};

export type SparklineStats = {
  min: number;
  max: number;
  change: number;
  changePercent: number;
  avgVolume?: number;
};

type Props = {
  data: SparklinePoint[];
  height?: number;
  type?: "price" | "marketCap" | "volume";
  showTooltip?: boolean;
  stats?: SparklineStats;
  isLoading?: boolean;
};

/**
 * Normalize data to 0-1 range for consistent visualization
 * across different scales (prices, volumes, market caps)
 */
function normalize(data: SparklinePoint[]) {
  const values = data.map(d => d.value);
  const min = Math.min(...values);
  const max = Math.max(...values);

  return data.map(d => ({
    ...d,
    value: max === min ? 0.5 : (d.value - min) / (max - min)
  }));
}

/**
 * MarketSparkline - Financial-grade sparkline component
 * 
 * Displays normalized price/volume/market cap trends with:
 * - Gradient area fill
 * - Direction-based coloring (green up, red down)
 * - No axes (clean, minimal)
 * - Monotone smoothing
 * - Responsive sizing
 * 
 * @example
 * ```tsx
 * <MarketSparkline 
 *   data={priceSeries} 
 *   height={48}
 *   type="price"
 * />
 * ```
 */
export default function MarketSparkline({
  data,
  height = 48,
  type = "price",
  showTooltip = false,
  stats,
  isLoading = false
}: Props) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center" style={{ height }}>
        <div className="animate-pulse flex gap-1">
          <div className="h-2 w-2 bg-gray-300 dark:bg-gray-600 rounded-full"></div>
          <div className="h-2 w-2 bg-gray-300 dark:bg-gray-600 rounded-full"></div>
          <div className="h-2 w-2 bg-gray-300 dark:bg-gray-600 rounded-full"></div>
        </div>
      </div>
    );
  }

  if (!data?.length) return null;

  const normalized = normalize(data);

  // Determine direction: up if last value >= first value
  const isUp = data[data.length - 1].value >= data[0].value;

  // Green for gains, red for losses (CMC standard)
  const color = isUp ? '#16c784' : '#ea3943';

  // Adjust opacity based on type for visual hierarchy
  const opacityStart = type === 'volume' ? 0.3 : 0.4;
  const opacityEnd = type === 'volume' ? 0.02 : 0.05;

  const chartData = {
    labels: normalized.map((d) => new Date(d.time).toISOString()),
    datasets: [
      {
        data: normalized.map((d) => d.value),
        borderColor: color,
        borderWidth: 1.2,
        tension: 0.25,
        pointRadius: 0,
        fill: true,
        backgroundColor: (context: any) => {
          const chart = context.chart;
          const { ctx, chartArea } = chart;
          if (!chartArea) return color;
          const gradient = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
          gradient.addColorStop(0, `${color}${Math.floor(opacityStart * 255).toString(16).padStart(2, '0')}`);
          gradient.addColorStop(1, `${color}${Math.floor(opacityEnd * 255).toString(16).padStart(2, '0')}`);
          return gradient;
        }
      }
    ]
  };

  const options: any = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        enabled: !!showTooltip,
        backgroundColor: 'rgba(0,0,0,0.8)',
        callbacks: {
          label: (ctx: any) => {
            const val = ctx.parsed.y ?? 0;
            return `${(val * 100).toFixed(1)}%`;
          }
        }
      }
    },
    scales: {
      x: { display: false, grid: { display: false } },
      y: { display: false, grid: { display: false }, min: 0, max: 1 }
    }
  };

  return (
    <div style={{ height }} className="w-full">
      <Line data={chartData} options={options} />
    </div>
  );
}
