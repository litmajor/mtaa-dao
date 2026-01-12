/**
 * CEXChart Component
 * 
 * Display candlestick charts with OHLCV data
 */

import React, { useState, useEffect, useRef } from 'react';
import { useCEXOHLCV, type Candle, type Timeframe } from '../hooks/useCEXOHLCV';

interface CEXChartProps {
  symbol?: string;
  exchange?: string;
  defaultTimeframe?: Timeframe;
  height?: number;
  onCandleHover?: (candle: Candle) => void;
}

interface ChartData {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  x: number;
  y: number;
  width: number;
}

/**
 * Component to display OHLCV candlestick chart
 */
export const CEXChart: React.FC<CEXChartProps> = ({
  symbol = 'BTC/USDT',
  exchange = 'binance',
  defaultTimeframe = '1h',
  height = 400,
  onCandleHover,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [timeframe, setTimeframe] = useState<Timeframe>(defaultTimeframe as Timeframe);
  const [hoveredCandle, setHoveredCandle] = useState<ChartData | null>(null);
  const [chartData, setChartData] = useState<ChartData[]>([]);

  const {
    candles,
    loading,
    error,
    source,
    refetch,
  } = useCEXOHLCV(symbol, timeframe, 24, exchange);

  const timeframes: Timeframe[] = ['1m', '5m', '15m', '30m', '1h', '4h', '1d', '1w', '1M'];

  /**
   * Draw candlestick chart
   */
  const drawChart = () => {
    const canvas = canvasRef.current;
    if (!canvas || !candles || candles.length === 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const padding = { top: 30, right: 30, bottom: 60, left: 60 };
    const chartWidth = canvas.width - padding.left - padding.right;
    const chartHeight = canvas.height - padding.top - padding.bottom;

    // Clear canvas
    ctx.fillStyle = 'rgba(26, 31, 58, 0.8)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (!candles || candles.length === 0) return;

    // Calculate price range
    const prices = candles.map((c) => [c.high, c.low]).flat();
    const maxPrice = Math.max(...prices);
    const minPrice = Math.min(...prices);
    const priceRange = maxPrice - minPrice;
    const pricePadding = priceRange * 0.05;

    // Calculate scale
    const candleWidth = chartWidth / candles.length;
    const yScale = chartHeight / (priceRange + pricePadding * 2);

    // Draw grid
    ctx.strokeStyle = 'rgba(100, 200, 255, 0.1)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 5; i++) {
      const y = padding.top + (i * chartHeight) / 5;
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(canvas.width - padding.right, y);
      ctx.stroke();

      const price = maxPrice - (i * priceRange) / 5;
      ctx.fillStyle = 'rgba(160, 160, 160, 0.5)';
      ctx.font = '11px Monaco, Courier New, monospace';
      ctx.textAlign = 'right';
      ctx.fillText(price.toFixed(0), padding.left - 10, y + 3);
    }

    // Draw axes
    ctx.strokeStyle = 'rgba(100, 200, 255, 0.3)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(padding.left, padding.top);
    ctx.lineTo(padding.left, canvas.height - padding.bottom);
    ctx.lineTo(canvas.width - padding.right, canvas.height - padding.bottom);
    ctx.stroke();

    // Draw axis labels
    ctx.fillStyle = 'rgba(160, 160, 160, 0.8)';
    ctx.font = 'bold 11px Monaco, Courier New, monospace';
    ctx.textAlign = 'center';

    // Draw candles
    const data: ChartData[] = [];
    if (candles) {
      candles.forEach((candle, idx) => {
        const x = padding.left + idx * candleWidth + candleWidth / 2;
        const yOpen =
          canvas.height - padding.bottom - (candle.open - minPrice + pricePadding) * yScale;
        const yClose =
          canvas.height - padding.bottom - (candle.close - minPrice + pricePadding) * yScale;
        const yHigh =
          canvas.height - padding.bottom - (candle.high - minPrice + pricePadding) * yScale;
        const yLow =
          canvas.height - padding.bottom - (candle.low - minPrice + pricePadding) * yScale;

        const color = candle.close >= candle.open ? '#64ff64' : '#ff6464';

        // Draw wick
        ctx.strokeStyle = color;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x, yHigh);
        ctx.lineTo(x, yLow);
        ctx.stroke();

        // Draw body
        ctx.fillStyle = color;
        const bodyWidth = candleWidth * 0.6;
        const bodyY = Math.min(yOpen, yClose);
        const bodyHeight = Math.abs(yOpen - yClose) || 1;

        ctx.fillRect(x - bodyWidth / 2, bodyY, bodyWidth, bodyHeight);

        data.push({
          timestamp: candle.timestamp,
          open: candle.open,
          high: candle.high,
          low: candle.low,
          close: candle.close,
          volume: candle.volume,
          x,
          y: bodyY,
          width: bodyWidth,
        });

        // Draw time label every 4th candle
        if (idx % Math.max(1, Math.floor(candles.length / 4)) === 0) {
          const date = new Date(candle.timestamp);
          ctx.fillStyle = 'rgba(160, 160, 160, 0.6)';
          ctx.textAlign = 'center';
          ctx.fillText(date.toLocaleTimeString().slice(0, 5), x, canvas.height - padding.bottom + 15);
        }
      });
    }

    setChartData(data);

    // Draw title and source
    ctx.fillStyle = '#64c8ff';
    ctx.font = 'bold 14px Monaco, Courier New, monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`${symbol} - ${timeframe}`, padding.left, 20);

    ctx.fillStyle = 'rgba(160, 160, 160, 0.6)';
    ctx.font = '10px Monaco, Courier New, monospace';
    ctx.fillText(`Source: ${source}`, padding.left, canvas.height - 5);
  };

  /**
   * Handle canvas mouse move for hover effects
   */
  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Find closest candle
    let closest: ChartData | null = null;
    let closestDistance = Infinity;

    chartData.forEach((data: ChartData) => {
      const distance = Math.sqrt(Math.pow(x - data.x, 2) + Math.pow(y - data.y, 2));
      if (distance < closestDistance && distance < 20) {
        closest = data;
        closestDistance = distance;
      }
    });

    setHoveredCandle(closest);
    if (closest) {
      const candleData = closest as ChartData;
      if (onCandleHover) {
        onCandleHover({
          timestamp: candleData.timestamp,
          open: candleData.open,
          high: candleData.high,
          low: candleData.low,
          close: candleData.close,
          volume: candleData.volume,
        });
      }
    }
  };

  /**
   * Redraw on candles update
   */
  useEffect(() => {
    if (candles && candles.length > 0) {
      drawChart();
    }
  }, [candles]);

  /**
   * Setup canvas
   */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.width = canvas.offsetWidth;
    canvas.height = height;
    drawChart();
  }, [height]);

  return (
    <div className="cex-chart">
      <div className="cex-chart-header">
        <h2>Price Chart</h2>
        <div className="cex-chart-controls">
          <div className="cex-chart-timeframes">
            {timeframes.map((tf) => (
              <button
                key={tf}
                className={`cex-chart-tf-btn ${timeframe === tf ? 'active' : ''}`}
                onClick={() => setTimeframe(tf)}
                disabled={loading}
              >
                {tf}
              </button>
            ))}
          </div>
          <button
            className={`cex-chart-refresh ${loading ? 'loading' : ''}`}
            onClick={refetch}
            disabled={loading}
          >
            {loading ? '⟳' : '↻'}
          </button>
        </div>
      </div>

      {error && (
        <div className="cex-chart-error">
          <span className="cex-chart-error-icon">⚠</span>
          {error}
        </div>
      )}

      {loading && candles && candles.length === 0 ? (
        <div className="cex-chart-loading">
          <div className="cex-chart-spinner"></div>
          <p>Loading chart...</p>
        </div>
      ) : (
        <>
          <canvas
            ref={canvasRef}
            className="cex-chart-canvas"
            onMouseMove={handleCanvasMouseMove}
            onMouseLeave={() => setHoveredCandle(null)}
          />

          {hoveredCandle && (
            <div className="cex-chart-hover">
              <div className="cex-chart-hover-item">
                <span className="label">Open</span>
                <span className="value">{hoveredCandle.open.toFixed(2)}</span>
              </div>
              <div className="cex-chart-hover-item">
                <span className="label">High</span>
                <span className="value">{hoveredCandle.high.toFixed(2)}</span>
              </div>
              <div className="cex-chart-hover-item">
                <span className="label">Low</span>
                <span className="value">{hoveredCandle.low.toFixed(2)}</span>
              </div>
              <div className="cex-chart-hover-item">
                <span className="label">Close</span>
                <span className="value">{hoveredCandle.close.toFixed(2)}</span>
              </div>
              <div className="cex-chart-hover-item">
                <span className="label">Volume</span>
                <span className="value">{hoveredCandle.volume.toFixed(4)}</span>
              </div>
              <div className="cex-chart-hover-item">
                <span className="label">Time</span>
                <span className="value">
                  {new Date(hoveredCandle.timestamp).toLocaleString()}
                </span>
              </div>
            </div>
          )}
        </>
      )}

      <div className="cex-chart-footer">
        <small>Chart powered by {source}</small>
      </div>
    </div>
  );
};

export default CEXChart;
