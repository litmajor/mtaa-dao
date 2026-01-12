import {
  AreaChart,
  Area,
  ResponsiveContainer,
  Tooltip
} from "recharts";

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
  const color = isUp ? "#16c784" : "#ea3943";

  // Adjust opacity based on type for visual hierarchy
  const opacityStart = type === "volume" ? 0.3 : 0.4;
  const opacityEnd = type === "volume" ? 0.02 : 0.05;

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={normalized} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id={`sparkGradient-${type}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={opacityStart} />
            <stop offset="100%" stopColor={color} stopOpacity={opacityEnd} />
          </linearGradient>
        </defs>

        <Area
          type="monotone"
          dataKey="value"
          stroke={color}
          strokeWidth={1.5}
          fill={`url(#sparkGradient-${type})`}
          isAnimationActive={false}
          dot={false}
        />

        {showTooltip && (
          <Tooltip
            cursor={false}
            contentStyle={{
              backgroundColor: "rgba(0, 0, 0, 0.8)",
              border: "none",
              borderRadius: "4px",
              padding: "4px 8px",
              fontSize: "12px",
              color: color
            }}
            formatter={(value: number) => {
              // Denormalize for display
              const denorm = value * 100;
              return [`${denorm.toFixed(1)}%`, "Trend"];
            }}
          />
        )}
      </AreaChart>
    </ResponsiveContainer>
  );
}
