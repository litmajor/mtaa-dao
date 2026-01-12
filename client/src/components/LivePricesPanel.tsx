/**
 * Live Prices Panel Component
 * 
 * Displays real-time prices from WebSocket and arbitrage opportunities
 * Part of Phase 4: Real-Time WebSocket Streaming
 */

import React, { useEffect } from 'react';
import {
  useLiveExchangePrices,
  useArbitrageMonitor,
  useExchangePriceComparison,
  type ArbitrageAlert,
  type LivePrice,
} from '@/hooks/useLiveExchangePrices';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  AlertCircle,
  TrendingUp,
  TrendingDown,
  Zap,
  Eye,
  EyeOff,
  Bell,
  BellOff,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

interface LivePricesPanelProps {
  symbol: string;
  exchanges: string[];
  minArbitrageSpread?: number;
}

export const LivePricesPanel: React.FC<LivePricesPanelProps> = ({
  symbol,
  exchanges,
  minArbitrageSpread = 0.5,
}) => {
  const { subscribe, unsubscribe, isConnected } = useLiveExchangePrices({
    autoConnect: true,
    initialSymbols: [symbol],
    initialExchanges: exchanges,
  });

  const comparison = useExchangePriceComparison(symbol, exchanges);
  const arbitrage = useArbitrageMonitor(symbol, minArbitrageSpread);

  // Subscribe when component mounts with new symbol/exchanges
  useEffect(() => {
    subscribe([symbol], exchanges);
  }, [symbol, exchanges, subscribe]);

  const connectionStatusColor = isConnected ? 'bg-green-500' : 'bg-gray-400';
  const connectionStatusText = isConnected ? 'Connected' : 'Disconnected';

  // Request notification permission on first use
  const handleEnableNotifications = async () => {
    // This would be called when user clicks a notifications button
  };

  return (
    <div className="space-y-4">
      {/* Connection Status */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CardTitle className="text-lg">Live Prices</CardTitle>
              <div className={`w-3 h-3 rounded-full ${connectionStatusColor} animate-pulse`} />
              <span className="text-xs text-gray-500">{connectionStatusText}</span>
            </div>
            <Badge variant="outline">{symbol}</Badge>
          </div>
          <CardDescription>Real-time prices updated every 500ms</CardDescription>
        </CardHeader>
      </Card>

      {/* Price Comparison Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Exchange Prices</CardTitle>
        </CardHeader>
        <CardContent>
          {comparison.comparison.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p>No prices available yet. Waiting for WebSocket connection...</p>
            </div>
          ) : (
            <div className="space-y-3">
              {comparison.comparison.map((item) => (
                <div
                  key={item.exchange}
                  className={`flex items-center justify-between p-3 rounded-lg border ${
                    item.available
                      ? 'border-gray-200 bg-gray-50'
                      : 'border-gray-100 bg-gray-50 opacity-50'
                  }`}
                >
                  <div className="flex-1">
                    <p className="font-medium text-sm">{item.exchange}</p>
                    {item.available ? (
                      <div className="text-xs text-gray-500 mt-1">
                        <p>Bid: ${item.bid?.toFixed(4)}</p>
                        <p>Ask: ${item.ask?.toFixed(4)}</p>
                      </div>
                    ) : (
                      <p className="text-xs text-gray-400 mt-1">No data</p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-base">
                      ${item.midPrice?.toFixed(4) || 'N/A'}
                    </p>
                    <Badge
                      variant={
                        item.exchange === comparison.bestBuyExchange
                          ? 'default'
                          : item.exchange === comparison.bestSellExchange
                          ? 'secondary'
                          : 'outline'
                      }
                      className="text-xs mt-1"
                    >
                      {item.exchange === comparison.bestBuyExchange && 'Best Buy'}
                      {item.exchange === comparison.bestSellExchange && 'Best Sell'}
                      {item.exchange !== comparison.bestBuyExchange &&
                        item.exchange !== comparison.bestSellExchange &&
                        'Available'}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}

          {comparison.potentialSpread !== null && (
            <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm font-medium text-blue-900">
                Potential Spread: {comparison.potentialSpread.toFixed(2)}%
              </p>
              <p className="text-xs text-blue-700 mt-1">
                Buy @ {comparison.bestBuyExchange} at ${comparison.bestBuyPrice?.toFixed(4)} →
                Sell @ {comparison.bestSellExchange} at ${comparison.bestSellPrice?.toFixed(4)}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Arbitrage Opportunities */}
      {arbitrage.alerts.length > 0 && (
        <Card className="border-orange-200 bg-orange-50">
          <CardHeader>
            <div className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-orange-600" />
              <CardTitle className="text-base text-orange-900">
                Arbitrage Opportunities ({arbitrage.alertCount})
              </CardTitle>
            </div>
            <CardDescription className="text-orange-800">
              Profitable price spreads detected
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {arbitrage.alerts.slice(0, 5).map((alert, idx) => (
              <div
                key={idx}
                className="p-3 bg-white border border-orange-200 rounded-lg hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p className="font-medium text-sm">
                      {alert.buyExchange} → {alert.sellExchange}
                    </p>
                    <div className="text-xs text-gray-600 mt-2 space-y-1">
                      <p>Buy: ${alert.buyPrice.toFixed(4)}</p>
                      <p>Sell: ${alert.sellPrice.toFixed(4)}</p>
                      <p className="font-medium text-orange-600">
                        Profit on 100 {symbol}: ${alert.profit.toFixed(2)}
                      </p>
                    </div>
                  </div>
                  <div className="text-right ml-4">
                    <Badge variant="default" className="bg-orange-600">
                      {alert.spreadPct.toFixed(2)}%
                    </Badge>
                    <p className="text-xs text-gray-500 mt-2">
                      {new Date(alert.timestamp).toLocaleTimeString()}
                    </p>
                  </div>
                </div>
              </div>
            ))}

            {arbitrage.alerts.length > 5 && (
              <p className="text-xs text-gray-500 text-center py-2">
                +{arbitrage.alerts.length - 5} more opportunities
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* No Arbitrage Found */}
      {arbitrage.alerts.length === 0 && isConnected && (
        <Card>
          <CardContent className="pt-6 text-center">
            <TrendingDown className="w-8 h-8 text-gray-300 mx-auto mb-2" />
            <p className="text-sm text-gray-500">
              No arbitrage opportunities found (&gt;{minArbitrageSpread}%)
            </p>
          </CardContent>
        </Card>
      )}

      {/* Waiting for Connection */}
      {!isConnected && (
        <Card>
          <CardContent className="pt-6 text-center">
            <Zap className="w-8 h-8 text-gray-300 mx-auto mb-2 animate-pulse" />
            <p className="text-sm text-gray-500">Connecting to live price stream...</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

/**
 * Compact Live Prices Widget for embedding in other components
 */
export const LivePricesWidget: React.FC<{ symbol: string; exchanges: string[] }> = ({
  symbol,
  exchanges,
}) => {
  const { prices, isConnected } = useLiveExchangePrices({
    initialSymbols: [symbol],
    initialExchanges: exchanges,
  });

  return (
    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-indigo-200 rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-medium text-gray-900">{symbol}</h4>
        <div className="flex items-center gap-1">
          <div
            className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-gray-300'}`}
          />
          <span className="text-xs text-gray-500">
            {isConnected ? 'Live' : 'Offline'}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {exchanges.slice(0, 4).map((exchange) => {
          const priceKey = `${symbol}:${exchange}`;
          const price = Object.values(prices as any).find(
            (p: any) => p.symbol === symbol && p.exchange === exchange
          ) as LivePrice | undefined;

          return (
            <div key={exchange} className="bg-white rounded p-2 text-center">
              <p className="text-xs font-medium text-gray-600">{exchange}</p>
              <p className="text-sm font-bold text-indigo-600">
                {price ? `$${price.midPrice?.toFixed(4)}` : '-'}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
};
