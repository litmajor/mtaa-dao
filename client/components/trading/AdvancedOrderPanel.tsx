/**
 * AdvancedOrderPanel Component
 * Smart order placement with routing, fee comparison, and order types
 * Integrates all CEX trading features
 */

'use client';

import React, { useState, useEffect } from 'react';
import { usePlaceOrder, useMarketOrder, useLimitOrder, useValidateOrder } from '@/client/hooks/usePlaceOrder';
import { useSmartRouting, useFeeComparison, useSavingsBySmartRouting } from '@/client/hooks/useSmartRouter';
import { useExchanges } from '@/client/hooks/useExchangeManagement';

type OrderType = 'market' | 'limit' | 'stop-loss' | 'take-profit';
type OrderSide = 'BUY' | 'SELL';
type MarketType = 'spot' | 'margin' | 'futures' | 'swap';

interface OrderFormData {
  pair: string;
  market: MarketType;
  side: OrderSide;
  type: OrderType;
  quantity: number;
  price?: number;
  stopPrice?: number;
  leverage?: number;
  exchange?: string;
  useSmartRouting: boolean;
}

export default function AdvancedOrderPanel() {
  const [formData, setFormData] = useState<OrderFormData>({
    pair: 'BTC/USDT',
    market: 'spot',
    side: 'BUY',
    type: 'market',
    quantity: 0.1,
    useSmartRouting: true,
  });

  const [showPreview, setShowPreview] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  // Hooks
  const { placeOrder, loading: orderLoading, error: orderError } = usePlaceOrder();
  const { validateOrder } = useValidateOrder();
  const { routing, loading: routingLoading } = useSmartRouting(formData.pair, formData.quantity, formData.side);
  const { exchanges } = useExchanges();
  const { savings, savingsPercent } = useSavingsBySmartRouting(formData.pair, formData.quantity, formData.side);
  const { fees, loading: feesLoading } = useFeeComparison();

  // Get best exchange from routing
  const selectedExchange = formData.useSmartRouting ? routing?.bestPath.exchange : formData.exchange;

  const handleInputChange = (field: string, value: any) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handlePlaceOrder = async () => {
    const validation = validateOrder(formData as any);
    if (!validation.valid) {
      alert('Order validation failed:\n' + validation.errors.join('\n'));
      return;
    }

    const result = await placeOrder(formData as any);
    if (result.success) {
      setSuccessMessage('Order placed successfully!');
      setFormData({
        pair: 'BTC/USDT',
        market: 'spot',
        side: 'BUY',
        type: 'market',
        quantity: 0.1,
        useSmartRouting: true,
      });
      setTimeout(() => setSuccessMessage(''), 3000);
    } else {
      alert(`Order failed: ${result.error}`);
    }
  };

  return (
    <div className="bg-slate-800 rounded-lg border border-slate-700 p-6 space-y-6 max-w-2xl">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-white">Place Order</h2>
        <p className="text-slate-400 text-sm mt-1">Smart routing enabled for best execution</p>
      </div>

      {/* Success Message */}
      {successMessage && (
        <div className="bg-green-900/20 border border-green-600 text-green-400 p-3 rounded-lg text-sm">
          ✓ {successMessage}
        </div>
      )}

      {/* Error Message */}
      {orderError && (
        <div className="bg-red-900/20 border border-red-600 text-red-400 p-3 rounded-lg text-sm">
          ✗ {orderError}
        </div>
      )}

      {/* Main Form */}
      <div className="grid grid-cols-2 gap-4">
        {/* Trading Pair */}
        <div className="col-span-2">
          <label className="block text-slate-300 font-semibold mb-2">Trading Pair</label>
          <input
            type="text"
            placeholder="BTC/USDT"
            value={formData.pair}
            onChange={(e) => handleInputChange('pair', e.target.value.toUpperCase())}
            className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:border-blue-500 outline-none"
          />
        </div>

        {/* Market Type */}
        <div>
          <label className="block text-slate-300 font-semibold mb-2">Market Type</label>
          <select
            value={formData.market}
            onChange={(e) => handleInputChange('market', e.target.value)}
            className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:border-blue-500 outline-none"
          >
            <option value="spot">Spot</option>
            <option value="margin">Margin</option>
            <option value="futures">Futures</option>
            <option value="swap">Swap</option>
          </select>
        </div>

        {/* Buy/Sell */}
        <div>
          <label className="block text-slate-300 font-semibold mb-2">Side</label>
          <div className="flex gap-2">
            <button
              onClick={() => handleInputChange('side', 'BUY')}
              className={`flex-1 py-2 rounded-lg font-semibold transition ${
                formData.side === 'BUY'
                  ? 'bg-green-600 text-white'
                  : 'bg-slate-700 text-slate-400 hover:text-slate-200'
              }`}
            >
              BUY
            </button>
            <button
              onClick={() => handleInputChange('side', 'SELL')}
              className={`flex-1 py-2 rounded-lg font-semibold transition ${
                formData.side === 'SELL'
                  ? 'bg-red-600 text-white'
                  : 'bg-slate-700 text-slate-400 hover:text-slate-200'
              }`}
            >
              SELL
            </button>
          </div>
        </div>

        {/* Order Type */}
        <div className="col-span-2">
          <label className="block text-slate-300 font-semibold mb-2">Order Type</label>
          <div className="grid grid-cols-4 gap-2">
            {['market', 'limit', 'stop-loss', 'take-profit'].map((type) => (
              <button
                key={type}
                onClick={() => handleInputChange('type', type)}
                className={`py-2 rounded-lg font-semibold text-sm transition ${
                  formData.type === type
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-700 text-slate-400 hover:text-slate-200'
                }`}
              >
                {type.charAt(0).toUpperCase() + type.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Quantity */}
        <div className="col-span-2">
          <label className="block text-slate-300 font-semibold mb-2">Quantity</label>
          <input
            type="number"
            placeholder="0.00"
            value={formData.quantity}
            onChange={(e) => handleInputChange('quantity', parseFloat(e.target.value) || 0)}
            className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:border-blue-500 outline-none"
          />
        </div>

        {/* Price (for limit orders) */}
        {formData.type === 'limit' && (
          <div className="col-span-2">
            <label className="block text-slate-300 font-semibold mb-2">Limit Price</label>
            <input
              type="number"
              placeholder="0.00"
              value={formData.price || ''}
              onChange={(e) => handleInputChange('price', parseFloat(e.target.value) || undefined)}
              className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:border-blue-500 outline-none"
            />
          </div>
        )}

        {/* Stop Price */}
        {(formData.type === 'stop-loss' || formData.type === 'take-profit') && (
          <div className="col-span-2">
            <label className="block text-slate-300 font-semibold mb-2">Stop Price</label>
            <input
              type="number"
              placeholder="0.00"
              value={formData.stopPrice || ''}
              onChange={(e) => handleInputChange('stopPrice', parseFloat(e.target.value) || undefined)}
              className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:border-blue-500 outline-none"
            />
          </div>
        )}

        {/* Leverage (for margin/futures) */}
        {(formData.market === 'margin' || formData.market === 'futures' || formData.market === 'swap') && (
          <div>
            <label className="block text-slate-300 font-semibold mb-2">Leverage</label>
            <select
              value={formData.leverage || 1}
              onChange={(e) => handleInputChange('leverage', parseInt(e.target.value))}
              className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:border-blue-500 outline-none"
            >
              {[1, 2, 5, 10, 25, 50, 100].map((lev) => (
                <option key={lev} value={lev}>
                  {lev}x
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Smart Routing Toggle */}
      <div className="border-t border-slate-700 pt-4">
        <div className="flex items-center justify-between mb-4">
          <label className="text-slate-300 font-semibold">Smart Routing (Auto Best Exchange)</label>
          <button
            onClick={() => handleInputChange('useSmartRouting', !formData.useSmartRouting)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              formData.useSmartRouting ? 'bg-blue-600' : 'bg-slate-700'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                formData.useSmartRouting ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>

        {/* Smart Routing Info */}
        {formData.useSmartRouting && routing && !routingLoading && (
          <div className="bg-blue-900/20 border border-blue-700 rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-blue-300">Best Exchange</span>
              <span className="font-bold text-blue-400">{routing.bestPath.exchange}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-blue-300">Estimated Fee</span>
              <span className="font-bold text-blue-400">{(routing.bestPath.feePercent * 100).toFixed(4)}%</span>
            </div>
            {savings > 0 && (
              <div className="flex items-center justify-between bg-green-900/30 p-2 rounded border border-green-700">
                <span className="text-green-300">Savings vs Worst</span>
                <span className="font-bold text-green-400">
                  {savings.toFixed(2)} ({savingsPercent.toFixed(1)}%)
                </span>
              </div>
            )}
          </div>
        )}

        {/* Manual Exchange Selection */}
        {!formData.useSmartRouting && (
          <div>
            <label className="block text-slate-300 font-semibold mb-2 mt-4">Select Exchange</label>
            <select
              value={formData.exchange || ''}
              onChange={(e) => handleInputChange('exchange', e.target.value)}
              className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:border-blue-500 outline-none"
            >
              <option value="">Choose exchange...</option>
              {exchanges.map((ex) => (
                <option key={ex.id} value={ex.exchange}>
                  {ex.exchange} {ex.connected ? '✓' : '✗'}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Fee Comparison */}
      <div className="border-t border-slate-700 pt-4">
        <h3 className="text-slate-300 font-semibold mb-3">Fee Comparison</h3>
        <div className="space-y-2">
          {fees.map((fee) => (
            <div key={fee.exchange} className="flex items-center justify-between bg-slate-700/50 p-3 rounded">
              <div>
                <p className="text-white font-semibold">{fee.exchange}</p>
                <p className="text-slate-400 text-sm">Maker: {(fee.makerFee * 100).toFixed(3)}% | Taker: {(fee.takerFee * 100).toFixed(3)}%</p>
              </div>
              {fee.savingsPercent > 0 && (
                <span className="px-3 py-1 bg-green-600/20 text-green-400 text-sm font-semibold rounded">
                  Save {fee.savingsPercent.toFixed(1)}%
                </span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Order Preview Button */}
      <button
        onClick={() => setShowPreview(!showPreview)}
        className="w-full px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white font-semibold rounded-lg transition"
      >
        {showPreview ? '✕ Hide Preview' : '👁 Show Preview'}
      </button>

      {/* Order Preview */}
      {showPreview && (
        <div className="bg-slate-700/50 p-4 rounded-lg border border-slate-600 space-y-2">
          <div className="flex justify-between">
            <span className="text-slate-400">Order Type:</span>
            <span className="text-white font-semibold">{formData.type.toUpperCase()}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Exchange:</span>
            <span className="text-white font-semibold">{selectedExchange}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Quantity:</span>
            <span className="text-white font-semibold">{formData.quantity} {formData.pair.split('/')[0]}</span>
          </div>
          {routing && (
            <div className="flex justify-between pt-2 border-t border-slate-600">
              <span className="text-slate-400">Est. Total:</span>
              <span className="text-white font-bold">
                {(routing.bestPath.totalCost || 0).toFixed(2)} USDT
              </span>
            </div>
          )}
        </div>
      )}

      {/* Place Order Button */}
      <button
        onClick={handlePlaceOrder}
        disabled={orderLoading || !formData.quantity}
        className={`w-full py-3 rounded-lg font-bold text-white transition ${
          formData.side === 'BUY'
            ? 'bg-green-600 hover:bg-green-700 disabled:bg-green-600/50'
            : 'bg-red-600 hover:bg-red-700 disabled:bg-red-600/50'
        }`}
      >
        {orderLoading ? 'Placing Order...' : `${formData.side} ${formData.pair}`}
      </button>
    </div>
  );
}
