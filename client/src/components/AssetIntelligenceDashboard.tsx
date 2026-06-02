/**
 * AssetIntelligenceDashboard Component
 * 
 * Single unified dashboard that renders all 5 intelligence layers
 * Consumes a single AssetState object from /api/intelligence/asset/:symbol
 */

import React, { useEffect, useState } from 'react';
import { AssetState } from '../../types/assetTypes';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface AssetIntelligenceDashboardProps {
  symbol: string;
  userId?: string;
  onTrade?: (action: 'BUY' | 'SELL' | 'SWAP') => void;
}

/**
 * Main Dashboard Component
 */
export const AssetIntelligenceDashboard: React.FC<AssetIntelligenceDashboardProps> = ({
  symbol,
  userId,
  onTrade,
}) => {
  const [assetState, setAssetState] = useState<AssetState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch AssetState on mount or when symbol changes
  useEffect(() => {
    const fetchAssetState = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/intelligence/asset/${symbol}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId }),
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch asset intelligence: ${response.statusText}`);
        }

        const data = await response.json();
        setAssetState(data.data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    fetchAssetState();

    // Re-fetch every 5 seconds for real-time feel
    const interval = setInterval(fetchAssetState, 5000);
    return () => clearInterval(interval);
  }, [symbol, userId]);

  if (loading) {
    return <LoadingState />;
  }

  if (error) {
    return <ErrorState error={error} />;
  }

  if (!assetState) {
    return <ErrorState error="No asset state data" />;
  }

  return (
    <div className="asset-intelligence-dashboard space-y-4 p-4">
      {/* Header */}
      <HeaderSection assetState={assetState} symbol={symbol} />

      {/* Price & Risk */}
      <PriceSection assetState={assetState} />

      {/* Technical Indicators */}
      <TechnicalSection assetState={assetState} />

      {/* Liquidity Comparison (CEX vs DEX) */}
      <LiquiditySection assetState={assetState} />

      {/* Cross-Exchange Opportunities */}
      <CrossExchangeSection assetState={assetState} />

      {/* Portfolio Impact */}
      {assetState.userContext && <PortfolioSection assetState={assetState} />}

      {/* AI Guidance */}
      {assetState.aiInsights && <AIGuidanceSection assetState={assetState} />}

      {/* Action Buttons */}
      <ActionButtonsSection assetState={assetState} onTrade={onTrade} />

      {/* Data Freshness Footer */}
      <DataFreshnessFooter assetState={assetState} />
    </div>
  );
};

/**
 * Header Section
 */
const HeaderSection: React.FC<{ assetState: AssetState; symbol: string }> = ({
  assetState,
  symbol,
}) => {
  return (
    <div className="flex items-center justify-between">
      <div>
        <h1 className="text-3xl font-bold">{symbol}</h1>
        <p className="text-gray-600">{assetState.identification.name || symbol}</p>
      </div>
      <div className="text-right">
        <div className="text-2xl font-bold">
          ${assetState.price.current.toLocaleString('en-US', { maximumFractionDigits: 2 })}
        </div>
        <div
          className={`text-sm ${
            assetState.price.changePercent24h >= 0 ? 'text-green-600' : 'text-red-600'
          }`}
        >
          {assetState.price.changePercent24h >= 0 ? '+' : ''}
          {assetState.price.changePercent24h.toFixed(2)}% (24h)
        </div>
      </div>
    </div>
  );
};

/**
 * Price & Risk Section
 */
const PriceSection: React.FC<{ assetState: AssetState }> = ({ assetState }) => {
  const riskLevel = assetState.price.volatility.current > 3 ? 'HIGH' : 'MODERATE';
  const riskColor = riskLevel === 'HIGH' ? 'text-red-600' : 'text-yellow-600';

  return (
    <Card>
      <CardHeader>
        <CardTitle>Price & Risk</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-gray-600">24h Range</p>
            <p className="font-semibold">
              ${assetState.price.low24h.toLocaleString()} - $
              {assetState.price.high24h.toLocaleString()}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Volatility</p>
            <p className="font-semibold">{assetState.price.volatility.current.toFixed(2)}%</p>
          </div>
          <div className="col-span-2">
            <p className="text-sm text-gray-600">Risk Level</p>
            <p className={`font-semibold ${riskColor}`}>{riskLevel}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

/**
 * Technical Indicators Section
 */
const TechnicalSection: React.FC<{ assetState: AssetState }> = ({ assetState }) => {
  if (!assetState.technicals) return null;

  const { rsi, macd, movingAverages, trend } = assetState.technicals;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Technical Indicators (1h)</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4">
          {rsi && (
            <div>
              <p className="text-sm text-gray-600">RSI (14)</p>
              <p className="text-xl font-bold">{rsi.value.toFixed(0)}</p>
              <p className="text-xs text-gray-500">{rsi.signal}</p>
            </div>
          )}

          {macd && (
            <div>
              <p className="text-sm text-gray-600">MACD</p>
              <p className="text-xs">
                Line: {macd.line.toFixed(0)} | Signal: {macd.signal.toFixed(0)}
              </p>
              <p className="text-xs font-semibold text-green-600">Histogram: {macd.histogram.toFixed(0)}</p>
            </div>
          )}

          {movingAverages && (
            <div>
              <p className="text-sm text-gray-600">Moving Averages</p>
              <p className="text-xs">
                MA20: ${movingAverages.ma20?.toLocaleString()} | MA50: $
                {movingAverages.ma50?.toLocaleString()}
              </p>
            </div>
          )}

          {trend && (
            <div>
              <p className="text-sm text-gray-600">Trend</p>
              <p className="font-semibold capitalize text-blue-600">{trend.direction}</p>
              <p className="text-xs text-gray-500">Strength: {trend.strength}%</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

/**
 * CEX vs DEX Liquidity Section
 */
const LiquiditySection: React.FC<{ assetState: AssetState }> = ({ assetState }) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Exchange Liquidity Comparison</CardTitle>
      </CardHeader>
      <CardContent>
        {/* CEX Sources */}
        <div className="mb-4">
          <h3 className="font-semibold mb-2">Centralized Exchanges</h3>
          <div className="space-y-2">
            {assetState.cex.sources?.slice(0, 3).map((source, idx) => (
              <div key={idx} className="flex justify-between items-center text-sm border-b pb-2">
                <span className="font-medium">{source.exchange.toUpperCase()}</span>
                <div className="text-right">
                  <div className="font-semibold">
                    Bid: ${source.bid} | Ask: ${source.ask}
                  </div>
                  <div className="text-xs text-gray-500">Spread: {(source.spread * 100).toFixed(3)}%</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* DEX Sources */}
        <div>
          <h3 className="font-semibold mb-2">Decentralized Pools</h3>
          <div className="space-y-2">
            {assetState.dex.sources?.slice(0, 3).map((source, idx) => (
              <div key={idx} className="flex justify-between items-center text-sm border-b pb-2">
                <span className="font-medium">{source.protocol.toUpperCase()}</span>
                <div className="text-right">
                  <div className="font-semibold">
                    Slippage: {source.slippage?.toFixed(2)}%
                  </div>
                  <div className="text-xs text-gray-500">
                    Liquidity: ${(source.liquidity / 1000000).toFixed(1)}M
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Best Recommendation */}
        {assetState.cex.best?.buy && (
          <div className="mt-4 p-3 bg-blue-50 rounded">
            <p className="text-sm font-semibold text-blue-900">
              Best Buy: {assetState.cex.best.buy.exchange.toUpperCase()} @ $
              {assetState.cex.best.buy.price}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

/**
 * Cross-Exchange Arbitrage Section
 */
const CrossExchangeSection: React.FC<{ assetState: AssetState }> = ({ assetState }) => {
  const { crossExchange } = assetState;

  if (!crossExchange.arbitrage.opportunities || crossExchange.arbitrage.opportunities.length === 0) {
    return null;
  }

  return (
    <Alert className="border-orange-200 bg-orange-50">
      <AlertDescription>
        <h3 className="font-bold text-orange-900 mb-2">🎯 Arbitrage Opportunity Detected</h3>
        {crossExchange.arbitrage.opportunities.slice(0, 2).map((opp, idx) => (
          <div key={idx} className="text-sm text-orange-800 mb-1">
            <p>
              <strong>{opp.route}</strong> → ${opp.profitUsd.toFixed(0)} profit ({opp.profitPercent.toFixed(2)}%)
            </p>
          </div>
        ))}
      </AlertDescription>
    </Alert>
  );
};

/**
 * Portfolio Impact Section
 */
const PortfolioSection: React.FC<{ assetState: AssetState }> = ({ assetState }) => {
  if (!assetState.userContext?.holding) return null;

  const { holding, performance } = assetState.userContext;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Your Portfolio Impact</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-gray-600">Holding</p>
            <p className="font-semibold">{holding.amount} {assetState.identification.symbol}</p>
            <p className="text-xs text-gray-500">${holding.value.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Portfolio %</p>
            <p className="font-semibold">{holding.allocation}%</p>
          </div>
          {performance && (
            <>
              <div>
                <p className="text-sm text-gray-600">Unrealized P&L</p>
                <p className={`font-semibold ${performance.unrealizedPnl >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  ${performance.unrealizedPnl.toLocaleString()}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Return %</p>
                <p className={`font-semibold ${performance.unrealizedPnlPercent >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {performance.unrealizedPnlPercent >= 0 ? '+' : ''}
                  {performance.unrealizedPnlPercent.toFixed(2)}%
                </p>
              </div>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

/**
 * AI Guidance Section (Morio)
 */
const AIGuidanceSection: React.FC<{ assetState: AssetState }> = ({ assetState }) => {
  if (!assetState.aiInsights?.primarySignal) return null;

  const { primarySignal, warnings, recommendations } = assetState.aiInsights;

  return (
    <Card className="border-purple-200 bg-purple-50">
      <CardHeader>
        <CardTitle className="text-purple-900">🤖 Morio AI Guidance</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Primary Signal */}
        <div className="p-3 bg-white rounded border border-purple-200">
          <p className="text-sm font-bold text-purple-900">
            Signal: <span className="text-lg">{primarySignal.action}</span>
          </p>
          <p className="text-sm text-purple-800 mt-1">{primarySignal.reasoning}</p>
          <p className="text-xs text-gray-500 mt-1">Confidence: {primarySignal.confidence}%</p>
        </div>

        {/* Warnings */}
        {warnings && warnings.length > 0 && (
          <div className="space-y-1">
            {warnings.map((warning, idx) => (
              <Alert key={idx} className={`border-red-200 ${warning.severity === 'critical' ? 'bg-red-50' : 'bg-yellow-50'}`}>
                <AlertDescription className={warning.severity === 'critical' ? 'text-red-800' : 'text-yellow-800'}>
                  ⚠️ {warning.message}
                </AlertDescription>
              </Alert>
            ))}
          </div>
        )}

        {/* Recommendations */}
        {recommendations && recommendations.length > 0 && (
          <div className="p-3 bg-white rounded border border-green-200">
            <p className="text-sm font-bold text-green-900">Recommendations:</p>
            <ul className="text-sm text-green-800 mt-2 space-y-1">
              {recommendations.slice(0, 2).map((rec, idx) => (
                <li key={idx}>• {rec.action} {rec.venue && `(via ${rec.venue})`}</li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

/**
 * Action Buttons Section
 */
const ActionButtonsSection: React.FC<{ assetState: AssetState; onTrade?: (action: any) => void }> = ({
  assetState,
  onTrade,
}) => {
  return (
    <div className="flex gap-2">
      <button
        onClick={() => onTrade?.('BUY')}
        className="flex-1 bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded"
      >
        💰 Buy
      </button>
      <button
        onClick={() => onTrade?.('SELL')}
        className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded"
      >
        📉 Sell
      </button>
      <button
        onClick={() => onTrade?.('SWAP')}
        className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
      >
        🔄 Swap
      </button>
    </div>
  );
};

/**
 * Data Freshness Footer
 */
const DataFreshnessFooter: React.FC<{ assetState: AssetState }> = ({ assetState }) => {
  const freshness = assetState.status.dataFreshness;
  const freshLabel = freshness < 1000 ? 'Just now' : `${Math.floor(freshness / 1000)}s ago`;

  return (
    <div className="text-center text-xs text-gray-500 pt-4">
      Data: {freshLabel} | Confidence: {assetState.status.confidence}% | Updated:{' '}
      {new Date(assetState.status.lastUpdated).toLocaleTimeString()}
    </div>
  );
};

/**
 * Loading State
 */
const LoadingState: React.FC = () => (
  <div className="flex items-center justify-center p-8">
    <div className="text-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
      <p className="text-gray-600">Loading asset intelligence...</p>
    </div>
  </div>
);

/**
 * Error State
 */
const ErrorState: React.FC<{ error: string }> = ({ error }) => (
  <Alert className="border-red-200 bg-red-50">
    <AlertDescription className="text-red-800">
      ❌ Failed to load asset intelligence: {error}
    </AlertDescription>
  </Alert>
);

export default AssetIntelligenceDashboard;
