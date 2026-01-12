import React from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface PriceData {
  price: number;
  currency: string;
  change24h: number;
  changePercent24h: number;
  priceHigh24h?: number;
  priceLow24h?: number;
  marketCap?: string;
  volume24h?: string;
}

interface PriceDisplayProps {
  priceData: PriceData | null;
  compact?: boolean;
  showHigh24h?: boolean;
  showLow24h?: boolean;
  showVolume?: boolean;
  showMarketCap?: boolean;
  className?: string;
}

/**
 * Real-time Price Display Component
 * 
 * Displays current market price with 24-hour change indicator
 * Supports compact and detailed views with optional metrics
 */
export function PriceDisplay({
  priceData,
  compact = false,
  showHigh24h = false,
  showLow24h = false,
  showVolume = false,
  showMarketCap = false,
  className = ''
}: PriceDisplayProps) {
  if (!priceData) {
    return (
      <div className={`text-sm text-gray-500 dark:text-gray-400 ${className}`}>
        Price unavailable
      </div>
    );
  }

  const isPositive = priceData.changePercent24h >= 0;
  const changeColor = isPositive
    ? 'text-green-600 dark:text-green-400'
    : 'text-red-600 dark:text-red-400';
  const bgColor = isPositive
    ? 'bg-green-50 dark:bg-green-900/20'
    : 'bg-red-50 dark:bg-red-900/20';
  const borderColor = isPositive
    ? 'border-green-200 dark:border-green-800'
    : 'border-red-200 dark:border-red-800';

  if (compact) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <div>
          <div className="font-semibold text-sm">
            {priceData.currency} {priceData.price.toLocaleString('en-US', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 8
            })}
          </div>
          <div className={`flex items-center gap-1 text-xs ${changeColor}`}>
            {isPositive ? (
              <TrendingUp className="w-3 h-3" />
            ) : (
              <TrendingDown className="w-3 h-3" />
            )}
            <span>
              {isPositive ? '+' : ''}{priceData.changePercent24h.toFixed(2)}%
            </span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Main Price */}
      <div className={`p-3 rounded-lg border ${bgColor} ${borderColor}`}>
        <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Current Price</p>
        <div className="flex items-end justify-between">
          <div className="text-2xl font-bold">
            {priceData.currency} {priceData.price.toLocaleString('en-US', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 8
            })}
          </div>
          <Badge
            className={`ml-2 ${
              isPositive
                ? 'bg-green-600 hover:bg-green-700'
                : 'bg-red-600 hover:bg-red-700'
            }`}
          >
            <span className="flex items-center gap-1">
              {isPositive ? (
                <TrendingUp className="w-3 h-3" />
              ) : (
                <TrendingDown className="w-3 h-3" />
              )}
              {isPositive ? '+' : ''}{priceData.changePercent24h.toFixed(2)}%
            </span>
          </Badge>
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-500 mt-2">
          24h change: {priceData.currency} {priceData.change24h.toLocaleString('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 8
          })}
        </p>
      </div>

      {/* 24h High/Low */}
      {(showHigh24h || showLow24h) && (priceData.priceHigh24h || priceData.priceLow24h) && (
        <div className="grid grid-cols-2 gap-2">
          {showHigh24h && priceData.priceHigh24h && (
            <div className="p-2 bg-gray-50 dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700">
              <p className="text-xs text-gray-600 dark:text-gray-400">24h High</p>
              <p className="font-semibold text-sm">
                {priceData.currency} {priceData.priceHigh24h.toLocaleString('en-US', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 8
                })}
              </p>
            </div>
          )}
          {showLow24h && priceData.priceLow24h && (
            <div className="p-2 bg-gray-50 dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700">
              <p className="text-xs text-gray-600 dark:text-gray-400">24h Low</p>
              <p className="font-semibold text-sm">
                {priceData.currency} {priceData.priceLow24h.toLocaleString('en-US', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 8
                })}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Volume & Market Cap */}
      {(showVolume || showMarketCap) && (
        <div className="grid grid-cols-2 gap-2">
          {showVolume && priceData.volume24h && (
            <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded border border-blue-200 dark:border-blue-800">
              <p className="text-xs text-gray-600 dark:text-gray-400">24h Volume</p>
              <p className="font-semibold text-sm text-blue-600 dark:text-blue-400">
                {priceData.volume24h}
              </p>
            </div>
          )}
          {showMarketCap && priceData.marketCap && (
            <div className="p-2 bg-indigo-50 dark:bg-indigo-900/20 rounded border border-indigo-200 dark:border-indigo-800">
              <p className="text-xs text-gray-600 dark:text-gray-400">Market Cap</p>
              <p className="font-semibold text-sm text-indigo-600 dark:text-indigo-400">
                {priceData.marketCap}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Compact Inline Price Badge
 * Used for displaying price in tight spaces (table cells, lists)
 */
export function PriceBadge({
  price,
  currency = 'USD',
  changePercent = 0,
  className = ''
}: {
  price: number;
  currency?: string;
  changePercent?: number;
  className?: string;
}) {
  const isPositive = changePercent >= 0;
  const colors = isPositive
    ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200'
    : 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200';

  return (
    <div className={`inline-flex items-center gap-1 px-2 py-1 rounded text-sm font-medium ${colors} ${className}`}>
      <span>
        {currency} {price.toLocaleString('en-US', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 6
        })}
      </span>
      {changePercent !== 0 && (
        <>
          <span className="text-xs">
            {isPositive ? '↑' : '↓'} {Math.abs(changePercent).toFixed(2)}%
          </span>
        </>
      )}
    </div>
  );
}

/**
 * Price Comparison Component
 * Shows price in multiple currencies side-by-side
 */
export function PriceComparison({
  prices,
  className = ''
}: {
  prices: {
    currency: string;
    price: number;
    changePercent: number;
  }[];
  className?: string;
}) {
  return (
    <div className={`space-y-2 ${className}`}>
      {prices.map((p) => (
        <div key={p.currency} className="flex items-center justify-between">
          <span className="text-sm font-medium">{p.currency}</span>
          <PriceBadge
            price={p.price}
            currency={p.currency}
            changePercent={p.changePercent}
          />
        </div>
      ))}
    </div>
  );
}

export default PriceDisplay;
