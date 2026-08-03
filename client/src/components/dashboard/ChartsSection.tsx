/**
 * Copied from frontend ChartsSection — moved into client to avoid cross-folder imports
 */
import React, { useEffect, useRef, useState } from 'react';
import { CandlestickSeries, createChart, type IChartApi, type ISeriesApi, type CandlestickData, type Time } from 'lightweight-charts';
import { Activity, RotateCcw } from 'lucide-react';

interface ChartsSectionProps {
  selectedPair: string;
  timeframe: string;
  candles?: Array<{
    timestamp: number; // Unix seconds
    open: number;
    high: number;
    low: number;
    close: number;
    volume?: number;
  }>;
  onTimeframeChange: (tf: string) => void;
  onRefresh?: () => void;
  isRefreshing?: boolean;
  error?: string | null;
}

const TIMEFRAMES = ['1m', '5m', '15m', '1h', '4h', '1d'] as const;

const ChartsSection: React.FC<ChartsSectionProps> = ({
  selectedPair,
  timeframe,
  candles = [],
  onTimeframeChange,
  onRefresh,
  isRefreshing = false,
  error = null,
}) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const [isDarkMode, setIsDarkMode] = useState(false);

  useEffect(() => {
    const checkTheme = () => {
      const isDark =
        document.documentElement.classList.contains('dark') ||
        document.documentElement.getAttribute('data-theme') === 'dark';
      setIsDarkMode(isDark);
    };

    checkTheme();
    const observer = new MutationObserver(checkTheme);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class', 'data-theme'],
    });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!chartContainerRef.current) return;

    const textColor = isDarkMode ? '#d1d5db' : '#374151';
    const bgColor = isDarkMode ? '#111827' : '#f9fafb';
    const gridColor = isDarkMode ? '#1f2937' : '#e5e7eb';

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { color: bgColor },
        textColor,
        fontFamily: 'Inter, system-ui, sans-serif',
      },
      grid: {
        vertLines: { color: gridColor },
        horzLines: { color: gridColor },
      },
      rightPriceScale: {
        borderColor: gridColor,
        autoScale: true,
      },
      timeScale: {
        borderColor: gridColor,
        timeVisible: true,
        secondsVisible: false,
      },
      crosshair: { mode: 1 },
    });

    const series = chart.addSeries(CandlestickSeries, {
      upColor: '#10b981',
      downColor: '#ef4444',
      borderVisible: false,
      wickUpColor: '#10b981',
      wickDownColor: '#ef4444',
    });

    chartRef.current = chart;
    seriesRef.current = series;

    const handleResize = () => {
      if (chartContainerRef.current && chartRef.current) {
        chartRef.current.applyOptions({
          width: chartContainerRef.current.clientWidth,
        });
      }
    };

    window.addEventListener('resize', handleResize);
    handleResize();

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
    };
  }, [isDarkMode]);

  useEffect(() => {
    if (!seriesRef.current || !chartRef.current) return;

    if (candles.length === 0) {
      seriesRef.current.setData([]);
      return;
    }

    const chartData: CandlestickData<Time>[] = candles.map((c) => ({
      time: c.timestamp as Time,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
    }));

    seriesRef.current.setData(chartData);
    chartRef.current.timeScale().fitContent();
  }, [candles]);

  const isCelo = selectedPair.toUpperCase().includes('CUSD') ||
                 selectedPair.toUpperCase().includes('CEUR') ||
                 selectedPair.toUpperCase().includes('CKES') ||
                 selectedPair.toUpperCase().includes('CREAL');

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-4 py-3 border-b border-gray-100 dark:border-gray-700">
        <div className="flex items-center gap-2.5">
          <span className={`inline-block w-2.5 h-2.5 rounded-full ${isCelo ? 'bg-purple-500' : 'bg-emerald-500'} ${candles.length > 0 ? 'animate-pulse' : ''}`} />
          <h4 className="text-base font-semibold text-gray-900 dark:text-white">{selectedPair}</h4>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 font-mono">{timeframe}</span>
          {isCelo && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 font-medium">DEX</span>
          )}
          <span className="text-[10px] text-gray-400 dark:text-gray-500 font-mono">{candles.length} candles</span>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex bg-gray-100 dark:bg-gray-700 p-0.5 rounded-lg">
            {TIMEFRAMES.map((tf) => (
              <button
                key={tf}
                onClick={() => onTimeframeChange(tf)}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all ${tf === timeframe ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'}`}>
                {tf}
              </button>
            ))}
          </div>

          <button
            onClick={onRefresh}
            disabled={isRefreshing}
            className="flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-md bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <RotateCcw className={`h-3 w-3 ${isRefreshing ? 'animate-spin' : ''}`} />
            {isRefreshing ? 'Loading…' : 'Refresh'}
          </button>
        </div>
      </div>

      {error && (
        <div className="mx-4 mt-3 p-2.5 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-xs text-red-600 dark:text-red-400 flex items-center gap-2">
          <Activity className="h-3.5 w-3.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="p-4">
        <div ref={chartContainerRef} className="w-full h-96 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-100 dark:border-gray-800 relative">
          {candles.length === 0 && !error && (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400 dark:text-gray-500">
              <Activity className="h-8 w-8 mb-2 opacity-50" />
              <p className="text-sm">Waiting for data…</p>
              <p className="text-xs mt-1 opacity-70">Select a pair and timeframe</p>
            </div>
          )}
        </div>
      </div>

      {candles.length > 0 && (
        <div className="px-4 pb-4 flex flex-wrap gap-4 text-xs text-gray-500 dark:text-gray-400">
          <span>O: <span className="font-mono font-medium text-gray-700 dark:text-gray-200">{candles[0]?.open.toFixed(4)}</span></span>
          <span>H: <span className="font-mono font-medium text-gray-700 dark:text-gray-200">{Math.max(...candles.map(c => c.high)).toFixed(4)}</span></span>
          <span>L: <span className="font-mono font-medium text-gray-700 dark:text-gray-200">{Math.min(...candles.map(c => c.low)).toFixed(4)}</span></span>
          <span>C: <span className="font-mono font-medium text-gray-700 dark:text-gray-200">{candles[candles.length - 1]?.close.toFixed(4)}</span></span>
          <span>Vol: <span className="font-mono font-medium text-gray-700 dark:text-gray-200">{(candles.reduce((s, c) => s + (c.volume ?? 0), 0) / 1e6).toFixed(2)}M</span></span>
        </div>
      )}
    </div>
  );
};

export default ChartsSection;
