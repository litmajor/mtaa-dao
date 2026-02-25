/**
 * QuickOrderPanel Component
 * Fast order placement with market type selection
 * Supports spot, margin, and perpetuals trading
 */

import React, { useState } from 'react';
import { MarketType } from '@/client/hooks';
import { usePlaceOrder, useQuickBuy, useQuickSell, usePerpetualsTrading, useMarginTrading } from '@/client/hooks';

interface QuickOrderPanelProps {
  onClose: () => void;
  selectedExchange?: string;
}

export default function QuickOrderPanel({ onClose, selectedExchange }: QuickOrderPanelProps) {
  const [marketType, setMarketType] = useState<MarketType>('spot');
  const [pair, setPair] = useState('BTC/USDT');
  const [amount, setAmount] = useState('');
  const [side, setSide] = useState<'buy' | 'sell'>('buy');
  const [orderType, setOrderType] = useState<'market' | 'limit'>('market');
  const [price, setPrice] = useState('');
  const [leverage, setLeverage] = useState(1);

  // Hooks for different order types
  const { placeOrder, isLoading, error } = usePlaceOrder();
  const { quickBuy } = useQuickBuy();
  const { quickSell } = useQuickSell();
  const { openLongPosition, openShortPosition } = usePerpetualsTrading();
  const { buyWithLeverage, sellWithLeverage } = useMarginTrading();

  // Validation
  const isValid = pair && amount && (orderType === 'market' || price);
  const leverage1to10Valid = leverage >= 1 && leverage <= 10;
  const leverage1to125Valid = leverage >= 1 && leverage <= 125;

  // Handle order placement
  const handlePlaceOrder = async () => {
    if (!isValid) return;

    try {
      const amountNum = parseFloat(amount);
      const priceNum = price ? parseFloat(price) : undefined;

      switch (marketType) {
        case 'spot':
          if (side === 'buy') {
            await quickBuy(pair, amountNum);
          } else {
            await quickSell(pair, amountNum);
          }
          break;

        case 'margin':
          if (!leverage1to10Valid) {
            alert('Margin leverage must be between 1x and 10x');
            return;
          }
          if (side === 'buy') {
            await buyWithLeverage(pair, amountNum, leverage);
          } else {
            await sellWithLeverage(pair, amountNum, leverage);
          }
          break;

        case 'futures':
        case 'swap':
          if (!leverage1to125Valid) {
            alert(`${marketType} leverage must be between 1x and 125x`);
            return;
          }
          if (side === 'buy') {
            await openLongPosition(pair, amountNum, leverage, orderType, priceNum);
          } else {
            await openShortPosition(pair, amountNum, leverage, orderType, priceNum);
          }
          break;

        case 'option':
        case 'dex':
          alert(`${marketType} trading not yet implemented`);
          return;
      }

      // Reset form
      setAmount('');
      setPrice('');
      onClose();
    } catch (err) {
      console.error('Order placement error:', err);
    }
  };

  return (
    <div className="bg-slate-800 rounded-lg border border-slate-700 p-6">
      <div className="max-w-2xl">
        <h2 className="text-2xl font-bold text-white mb-6">Place Order</h2>

        {error && (
          <div className="mb-4 p-3 rounded bg-red-900 border border-red-700">
            <p className="text-red-100 text-sm">{error}</p>
          </div>
        )}

        <div className="space-y-4">
          {/* Market Type Selection */}
          <div>
            <label className="block text-sm font-semibold text-slate-300 mb-2">Market Type</label>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
              {(['spot', 'margin', 'futures', 'swap'] as const).map((type) => (
                <button
                  key={type}
                  onClick={() => {
                    setMarketType(type);
                    setLeverage(1);
                  }}
                  className={`px-3 py-2 rounded-lg font-semibold text-sm transition-all ${
                    marketType === type
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                  }`}
                >
                  {type.charAt(0).toUpperCase() + type.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Pair Input */}
          <div>
            <label className="block text-sm font-semibold text-slate-300 mb-2">Trading Pair</label>
            <input
              type="text"
              value={pair}
              onChange={(e) => setPair(e.target.value.toUpperCase())}
              placeholder="e.g., BTC/USDT"
              className="w-full px-4 py-2 rounded-lg bg-slate-700 border border-slate-600 text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none"
            />
          </div>

          {/* Buy/Sell Selection */}
          <div>
            <label className="block text-sm font-semibold text-slate-300 mb-2">Side</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setSide('buy')}
                className={`px-4 py-2 rounded-lg font-semibold transition-all ${
                  side === 'buy'
                    ? 'bg-green-600 text-white'
                    : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                }`}
              >
                Buy
              </button>
              <button
                onClick={() => setSide('sell')}
                className={`px-4 py-2 rounded-lg font-semibold transition-all ${
                  side === 'sell'
                    ? 'bg-red-600 text-white'
                    : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                }`}
              >
                Sell
              </button>
            </div>
          </div>

          {/* Amount */}
          <div>
            <label className="block text-sm font-semibold text-slate-300 mb-2">Amount</label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className="w-full px-4 py-2 rounded-lg bg-slate-700 border border-slate-600 text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none"
            />
          </div>

          {/* Order Type & Price */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-slate-300 mb-2">Order Type</label>
              <div className="flex gap-2">
                <button
                  onClick={() => setOrderType('market')}
                  className={`flex-1 px-3 py-2 rounded-lg font-semibold text-sm transition-all ${
                    orderType === 'market'
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                  }`}
                >
                  Market
                </button>
                <button
                  onClick={() => setOrderType('limit')}
                  className={`flex-1 px-3 py-2 rounded-lg font-semibold text-sm transition-all ${
                    orderType === 'limit'
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                  }`}
                >
                  Limit
                </button>
              </div>
            </div>

            {orderType === 'limit' && (
              <div>
                <label className="block text-sm font-semibold text-slate-300 mb-2">Price</label>
                <input
                  type="number"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="0.00"
                  className="w-full px-4 py-2 rounded-lg bg-slate-700 border border-slate-600 text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none"
                />
              </div>
            )}
          </div>

          {/* Leverage (for margin/futures/swap) */}
          {(marketType === 'margin' || marketType === 'futures' || marketType === 'swap') && (
            <div>
              <label className="block text-sm font-semibold text-slate-300 mb-2">
                Leverage: {leverage}x
                {marketType === 'margin' && <span className="text-xs text-slate-400"> (max 10x)</span>}
                {(marketType === 'futures' || marketType === 'swap') && (
                  <span className="text-xs text-slate-400"> (max 125x)</span>
                )}
              </label>
              <input
                type="range"
                min="1"
                max={marketType === 'margin' ? 10 : 125}
                value={leverage}
                onChange={(e) => setLeverage(parseInt(e.target.value))}
                className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer"
              />
              <div className="flex justify-between text-xs text-slate-400 mt-1">
                <span>1x</span>
                <span>{marketType === 'margin' ? '10x' : '125x'}</span>
              </div>
            </div>
          )}

          {/* Order Summary */}
          <div className="bg-slate-700/50 rounded-lg p-4 space-y-2 text-sm">
            <div className="flex justify-between text-slate-300">
              <span>Total Order Value</span>
              <span className="text-white font-semibold">
                ${(parseFloat(amount || '0') * parseFloat(price || '1')).toFixed(2)}
              </span>
            </div>
            {(marketType === 'margin' || marketType === 'futures' || marketType === 'swap') && (
              <div className="flex justify-between text-slate-300">
                <span>Estimated Collateral</span>
                <span className="text-white font-semibold">
                  ${(parseFloat(amount || '0') * parseFloat(price || '1') / leverage).toFixed(2)}
                </span>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex gap-4 pt-4">
            <button
              onClick={handlePlaceOrder}
              disabled={!isValid || isLoading}
              className="flex-1 px-6 py-3 rounded-lg bg-green-600 hover:bg-green-700 disabled:bg-slate-700 disabled:text-slate-400 text-white font-bold text-lg transition-all"
            >
              {isLoading ? 'Placing...' : `${side.charAt(0).toUpperCase() + side.slice(1)} ${amount || '0'} ${pair.split('/')[0]}`}
            </button>
            <button
              onClick={onClose}
              className="px-6 py-3 rounded-lg bg-slate-700 hover:bg-slate-600 text-white font-semibold transition-all"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
