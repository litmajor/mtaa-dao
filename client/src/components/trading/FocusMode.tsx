import React, { useState } from 'react';
import { Zap, X } from 'lucide-react';

interface ExchangeData {
  name: string;
  symbol: string;
  price: number;
  volume24h: number;
  liquidity: number;
  spread: number;
  fees: { maker: number; taker: number };
  uptime: number;
  region: string;
  rating: number;
}

interface FocusModeProps {
  exchanges: ExchangeData[];
  bestPrice: number;
  onExecuteTrade?: (exchange: string, action: 'buy' | 'sell') => void;
}

/**
 * Focus Mode: Minimal execution interface
 * 
 * Shows only:
 * - Top 3 exchanges by price/liquidity
 * - Buy/Sell quick action buttons
 * - Price and spread
 * - No distractions, no analytics, no filters
 * 
 * Perfect for traders who know what they want
 */
export const FocusMode: React.FC<FocusModeProps> = ({
  exchanges,
  bestPrice,
  onExecuteTrade,
}) => {
  const [selectedEx, setSelectedEx] = useState<string | null>(null);
  const [orderSize, setOrderSize] = useState<string>('1.0');
  const [orderType, setOrderType] = useState<'limit' | 'market'>('market');

  // Top 3 by liquidity (best execution)
  const topExchanges = [...exchanges]
    .sort((a, b) => b.liquidity - a.liquidity)
    .slice(0, 3);

  const selected = selectedEx ? exchanges.find((e) => e.name === selectedEx) : topExchanges[0];

  if (!selected) return null;

  const slippage = ((selected.price - bestPrice) / bestPrice) * 100;
  const estimatedCost = parseFloat(orderSize) * selected.price;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Minimal Header */}
      <div className="border-b border-slate-700 bg-slate-900/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <h1 className="text-xl font-bold flex items-center gap-2 text-white">
            <Zap className="h-5 w-5 text-yellow-400" />
            Focus Mode
          </h1>
          <div className="text-sm text-slate-400">
            <span className="font-mono text-green-400">${selected.price.toFixed(2)}</span>
            <span className="mx-2">•</span>
            <span className={slippage > 0.5 ? 'text-orange-400' : 'text-slate-300'}>
              {slippage > 0 ? '+' : ''}{slippage.toFixed(2)}%
            </span>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-2xl mx-auto px-4 py-8">
        {/* Exchange Quick Select */}
        <div className="grid grid-cols-3 gap-2 mb-8">
          {topExchanges.map((ex) => (
            <button
              key={ex.name}
              onClick={() => setSelectedEx(ex.name)}
              className={`p-4 rounded-lg border-2 transition-all ${
                selected.name === ex.name
                  ? 'border-blue-500 bg-blue-500/10'
                  : 'border-slate-700 bg-slate-800/50 hover:border-slate-600'
              }`}
            >
              <p className="font-bold text-sm">{ex.name}</p>
              <p className="text-2xl font-bold text-blue-400 mt-2">
                ${ex.price.toFixed(2)}
              </p>
              <p className="text-xs text-slate-400 mt-1">
                Liquidity: ${(ex.liquidity / 1000000).toFixed(1)}M
              </p>
            </button>
          ))}
        </div>

        {/* Trading Form */}
        <div className="bg-slate-800 border border-slate-700 rounded-lg p-6 mb-6">
          <h2 className="text-lg font-bold mb-6 text-white">Execute Trade</h2>

          {/* Order Type */}
          <div className="mb-6">
            <label className="text-sm font-semibold text-slate-300 block mb-3">
              Order Type
            </label>
            <div className="grid grid-cols-2 gap-3">
              {(['market', 'limit'] as const).map((type) => (
                <button
                  key={type}
                  onClick={() => setOrderType(type)}
                  className={`p-3 rounded border transition-all ${
                    orderType === type
                      ? 'bg-blue-600 border-blue-500 text-white'
                      : 'bg-slate-700 border-slate-600 text-slate-300 hover:border-slate-500'
                  }`}
                >
                  {type === 'market' ? '⚡ Market' : '📊 Limit'}
                </button>
              ))}
            </div>
          </div>

          {/* Order Size */}
          <div className="mb-6">
            <label className="text-sm font-semibold text-slate-300 block mb-2">
              Amount
            </label>
            <input
              type="number"
              value={orderSize}
              onChange={(e) => setOrderSize(e.target.value)}
              placeholder="1.0"
              className="w-full px-4 py-3 rounded bg-slate-700 border border-slate-600 text-white font-mono text-lg focus:outline-none focus:border-blue-500"
              step="0.1"
              min="0"
            />
            <p className="text-xs text-slate-400 mt-2">
              Estimated cost: <span className="text-white font-semibold">${estimatedCost.toFixed(2)}</span>
            </p>
          </div>

          {/* Fee Info */}
          <div className="bg-slate-700/50 rounded p-3 mb-6 text-sm">
            <div className="flex justify-between text-slate-300 mb-1">
              <span>Maker Fee:</span>
              <span className="font-mono text-white">{(selected.fees.maker * 100).toFixed(3)}%</span>
            </div>
            <div className="flex justify-between text-slate-300">
              <span>Taker Fee:</span>
              <span className="font-mono text-white">{(selected.fees.taker * 100).toFixed(3)}%</span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => {
                onExecuteTrade?.(selected.name, 'buy');
                setOrderSize('');
              }}
              className="py-4 bg-green-600 hover:bg-green-500 rounded-lg font-bold text-white text-lg transition-colors"
            >
              💰 Buy Now
            </button>
            <button
              onClick={() => {
                onExecuteTrade?.(selected.name, 'sell');
                setOrderSize('');
              }}
              className="py-4 bg-orange-600 hover:bg-orange-500 rounded-lg font-bold text-white text-lg transition-colors"
            >
              📤 Sell Now
            </button>
          </div>
        </div>

        {/* Warning */}
        {slippage > 1 && (
          <div className="bg-yellow-900/30 border border-yellow-700/50 rounded p-4 text-sm text-yellow-200">
            ⚠️ <strong>High slippage:</strong> {slippage.toFixed(2)}% vs best price. Consider {topExchanges[0].name}.
          </div>
        )}

        {/* Minimal Footer */}
        <div className="mt-8 text-center text-xs text-slate-500">
          <p>Connected: {selected.name} • Uptime: {selected.uptime}%</p>
        </div>
      </div>
    </div>
  );
};
