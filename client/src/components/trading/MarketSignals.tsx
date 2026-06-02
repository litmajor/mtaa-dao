import React from 'react';
import { AlertCircle, TrendingUp, Activity } from 'lucide-react';

export interface MarketSignal {
  type: 'opportunity' | 'warning' | 'info';
  title: string;
  description: string;
  action?: string;
  metric?: string;
  priority: 'high' | 'medium' | 'low';
}

interface AlertBannerProps {
  signals: MarketSignal[];
  onDismiss?: (index: number) => void;
}

export const AlertBanner: React.FC<AlertBannerProps> = ({ signals, onDismiss }) => {
  if (!signals.length) return null;

  const highPriority = signals.filter((s) => s.priority === 'high');
  const display = highPriority.length > 0 ? highPriority : signals.slice(0, 3);

  return (
    <div className="space-y-2 mb-6">
      {display.map((signal, idx) => (
        <div
          key={idx}
          className={`rounded-lg p-4 border flex items-start gap-3 ${getSignalStyles(signal.type)}`}
        >
          <div className="flex-shrink-0 mt-0.5">
            {signal.type === 'opportunity' && (
              <TrendingUp className="h-5 w-5 text-green-500" />
            )}
            {signal.type === 'warning' && (
              <AlertCircle className="h-5 w-5 text-yellow-500" />
            )}
            {signal.type === 'info' && (
              <AlertCircle className="h-5 w-5 text-blue-500" />
            )}
          </div>

          <div className="flex-1 min-w-0">
            <h4 className="font-semibold text-sm flex items-center gap-2">
              {signal.title}
              {signal.metric && (
                <span className="ml-auto text-xs font-mono bg-black/20 px-2 py-1 rounded">
                  {signal.metric}
                </span>
              )}
            </h4>
            <p className="text-sm mt-1 opacity-90">{signal.description}</p>
            {signal.action && (
              <button className="text-xs mt-2 px-3 py-1 rounded bg-white/20 hover:bg-white/30 transition-colors font-semibold">
                {signal.action}
              </button>
            )}
          </div>

          {onDismiss && (
            <button
              onClick={() => onDismiss(idx)}
              className="flex-shrink-0 text-white/50 hover:text-white/80 transition-colors"
            >
              ✕
            </button>
          )}
        </div>
      ))}
    </div>
  );
};

function getSignalStyles(type: MarketSignal['type']): string {
  const baseStyles = 'bg-slate-800/50 border-slate-700';
  
  switch (type) {
    case 'opportunity':
      return `${baseStyles} bg-green-900/20 border-green-700/50`;
    case 'warning':
      return `${baseStyles} bg-yellow-900/20 border-yellow-700/50`;
    case 'info':
      return `${baseStyles} bg-blue-900/20 border-blue-700/50`;
    default:
      return baseStyles;
  }
}

/**
 * Detect market signals from exchange data
 */
export function detectMarketSignals(
  exchanges: Array<{ name: string; price: number; uptime: number; volume24h: number }>,
  avgPrice: number
): MarketSignal[] {
  const signals: MarketSignal[] = [];

  if (!exchanges.length) return signals;

  // Arbitrage Detection
  const sorted = [...exchanges].sort((a, b) => a.price - b.price);
  const cheapest = sorted[0];
  const expensive = sorted[sorted.length - 1];
  const spread = ((expensive.price - cheapest.price) / cheapest.price) * 100;

  if (spread > 0.5) {
    signals.push({
      type: 'opportunity',
      title: '💰 Arbitrage Opportunity',
      description: `Buy ${cheapest.name} @ $${cheapest.price.toFixed(2)}, sell ${expensive.name} @ $${expensive.price.toFixed(2)}`,
      metric: `+${spread.toFixed(2)}%`,
      action: 'Execute',
      priority: spread > 1 ? 'high' : 'medium',
    });
  }

  // Uptime Warning
  const downExchange = exchanges.find((e) => e.uptime < 99.5);
  if (downExchange) {
    signals.push({
      type: 'warning',
      title: '⚠️ Exchange Health Alert',
      description: `${downExchange.name} uptime dropped to ${downExchange.uptime.toFixed(2)}%`,
      priority: 'high',
    });
  }

  // Volume Anomaly
  const avgVolume =
    exchanges.reduce((sum, e) => sum + e.volume24h, 0) / exchanges.length;
  const spikeExchange = exchanges.find(
    (e) => e.volume24h > avgVolume * 1.5
  );
  if (spikeExchange) {
    signals.push({
      type: 'info',
      title: '📊 Volume Spike Detected',
      description: `${spikeExchange.name} volume +${(((spikeExchange.volume24h - avgVolume) / avgVolume) * 100).toFixed(0)}%`,
      metric: `$${(spikeExchange.volume24h / 1000000000).toFixed(1)}B`,
      priority: 'medium',
    });
  }

  // Price Concentration Risk
  const topThree = sorted.slice(-3);
  const topSpread =
    ((topThree[topThree.length - 1].price - topThree[0].price) /
      topThree[0].price) *
    100;
  if (topSpread > 1) {
    signals.push({
      type: 'info',
      title: '🎯 Liquidity Concentration',
      description: `Top 3 exchanges show ${topSpread.toFixed(2)}% price deviation`,
      priority: 'low',
    });
  }

  return signals;
}
