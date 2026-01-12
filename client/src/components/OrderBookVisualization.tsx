/**
 * Order Book Visualization Component
 * Displays bid/ask depth, walls, and liquidity analysis
 * 
 * @note Dynamic inline styles required for real-time color updates based on market data
 */
/* stylelint-disable */

import React, { useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp } from 'lucide-react';
import { useOrderBook } from '@/hooks/useOrderBook';
import {
  getWallStrengthDescription,
  getPressureColor,
  getPressureLabel,
  formatVolume,
  getLiquidityRatingColor
} from '@/hooks/useOrderBook';
import type { OrderBookMetrics } from '@/hooks/useOrderBook';
import { orderBookStyles } from './orderBookStyles';

export interface OrderBookVisualizationProps {
  symbol: string;
  exchange?: string;
}

/**
 * OrderBookVisualization Component
 * Displays real-time order book depth with metrics and analysis
 */
export const OrderBookVisualization: React.FC<OrderBookVisualizationProps> = ({
  symbol,
  exchange = 'binance'
}) => {
  const { data: orderBook, isLoading, error } = useOrderBook(symbol, exchange, 30);

  // Prepare chart data for depth visualization
  const chartData = useMemo(() => {
    if (!orderBook) return [];

    // Combine bids and asks into depth visualization
    // Bids are inverted (left side, prices ascending)
    const combinedData = [
      // Asks (right side, prices ascending)
      ...orderBook.asks.map((ask) => ({
        price: ask.price,
        ask: ask.cumulative,
        bid: 0,
        type: 'ask' as const
      })),
      // Bids (left side, prices descending - reversed for proper visualization)
      ...orderBook.bids.slice().reverse().map((bid) => ({
        price: bid.price,
        ask: 0,
        bid: bid.cumulative,
        type: 'bid' as const
      }))
    ];

    return combinedData;
  }, [orderBook]);

  // Calculate liquidit metrics
  const metrics = useMemo(() => {
    if (!orderBook) {
      return {
        bidAskRatio: 0,
        imbalance: 0,
        liquidityScore: 0,
        pressure: 'neutral' as const
      };
    }

    return {
      bidAskRatio: orderBook.analysis.bidAskRatio,
      imbalance: orderBook.analysis.volumeImbalance,
      liquidityScore: orderBook.analysis.liquidityScore,
      pressure: orderBook.analysis.pressure
    };
  }, [orderBook]);

  if (isLoading) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Order Book Analysis</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-96 flex items-center justify-center">
            <div className="text-gray-400">Loading order book data...</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error || !orderBook) {
    return (
      <Card className="w-full border-red-200 bg-red-50">
        <CardHeader>
          <CardTitle className="text-red-900">Order Book Error</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-start gap-3">
            <span className="text-2xl">⚠️</span>
            <p className="text-sm text-red-800">
              {error?.message || 'Failed to load order book data'}
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const imbalancePercent = Math.abs(metrics.imbalance);
  const spreadBps = Math.round(orderBook.spreadPercent * 10000) / 100; // Convert to basis points

  return (
    <div className="w-full space-y-4">
      {/* Main Order Book Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Market Depth</CardTitle>
          <CardDescription>
            Cumulative bid/ask volume across price levels (Last updated:{' '}
            {new Date(orderBook.timestamp).toLocaleTimeString()})
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={350}>
            <AreaChart
              data={chartData}
              margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="price"
                type="number"
                tickFormatter={(value) => `$${value.toFixed(2)}`}
                width={60}
              />
              <YAxis
                tickFormatter={(value) => formatVolume(value)}
                width={60}
              />
              <Tooltip
                cursor={{ strokeDasharray: '3 3' }}
                formatter={(value) => formatVolume(value as number)}
                labelFormatter={(label) => `$${(label as number).toFixed(2)}`}
                contentStyle={{
                  backgroundColor: 'rgba(0, 0, 0, 0.8)',
                  border: 'none',
                  borderRadius: '8px',
                  color: '#fff'
                }}
              />
              <Area
                type="monotone"
                dataKey="bid"
                stackId="1"
                stroke="#10b981"
                fill="#10b981"
                fillOpacity={0.6}
                name="Bids (Buy)"
              />
              <Area
                type="monotone"
                dataKey="ask"
                stackId="2"
                stroke="#ef4444"
                fill="#ef4444"
                fillOpacity={0.6}
                name="Asks (Sell)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Liquidity Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Trading Pressure */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Market Pressure</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div
                className="p-4 rounded-lg"
                style={orderBookStyles.pressureContainer(getPressureColor(metrics.pressure))}
              >
                <p className="text-sm text-gray-600 mb-2">Current Status</p>
                <p
                  className="text-2xl font-bold"
                  style={orderBookStyles.pressureText(getPressureColor(metrics.pressure))}
                >
                  {getPressureLabel(metrics.pressure)}
                </p>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Volume Imbalance</span>
                  <span className="font-semibold">
                    {metrics.imbalance > 0 ? '+' : ''}{metrics.imbalance.toFixed(2)}%
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="h-2 rounded-full transition-all"
                    style={{
                      width: `${Math.min(50 + (metrics.imbalance / 2), 100)}%`,
                      backgroundColor: getPressureColor(metrics.pressure)
                    }}
                  />
                </div>
                <p className="text-xs text-gray-500">
                  {Math.abs(metrics.imbalance) > 30 && metrics.imbalance > 0
                    ? '🟢 Strong Buy Signal'
                    : Math.abs(metrics.imbalance) > 30 && metrics.imbalance < 0
                    ? '🔴 Strong Sell Signal'
                    : '➡️ Neutral Balance'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Spread & Ratio */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Spread & Ratio</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-blue-50 p-3 rounded-lg">
                  <p className="text-xs text-gray-600 mb-1">Spread</p>
                  <p className="text-lg font-semibold">{spreadBps.toFixed(2)} bps</p>
                  <p className="text-xs text-gray-500">
                    ${orderBook.spread.toFixed(4)}
                  </p>
                </div>

                <div className="bg-purple-50 p-3 rounded-lg">
                  <p className="text-xs text-gray-600 mb-1">Bid/Ask Ratio</p>
                  <p className="text-lg font-semibold">{metrics.bidAskRatio.toFixed(2)}x</p>
                  <p className="text-xs text-gray-500">
                    {metrics.bidAskRatio > 1 ? 'More bids' : 'More asks'}
                  </p>
                </div>
              </div>

              <div className="bg-gradient-to-r from-green-50 to-red-50 p-3 rounded-lg">
                <p className="text-xs text-gray-600 mb-2">Mid Price</p>
                <p className="text-2xl font-bold">${orderBook.mid.toFixed(4)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Liquidity Score */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Liquidity Score</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-end justify-between">
                <div>
                  <p className="text-sm text-gray-600 mb-2">Overall Rating</p>
                  <p className="text-3xl font-bold">{metrics.liquidityScore.toFixed(1)}</p>
                  <p className="text-xs text-gray-500">/ 100</p>
                </div>
                <div
                  className="text-4xl"
                  style={orderBookStyles.ratingContainer(getLiquidityRatingColor(getRatingLabel(metrics.liquidityScore)))}
                >
                  {getRatingEmoji(metrics.liquidityScore)}
                </div>
              </div>

              <div className="w-full bg-gray-200 rounded-full h-3">
                <div
                  className="h-3 rounded-full transition-all"
                  style={orderBookStyles.liquidityScore(getLiquidityRatingColor(getRatingLabel(metrics.liquidityScore)), metrics.liquidityScore)}
                />
              </div>

              <Badge
                variant="secondary"
                className="w-full justify-center text-center"
                style={orderBookStyles.liquidityBadge(getLiquidityRatingColor(getRatingLabel(metrics.liquidityScore)))}
              >
                {getRatingLabel(metrics.liquidityScore)}
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Depth Analysis */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Depth at Key Levels</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-green-50 p-3 rounded-lg">
                  <p className="text-xs text-gray-600 mb-1">Bid @ 1%</p>
                  <p className="text-sm font-semibold">{formatVolume(orderBook.analysis.bidDepth1pct)}</p>
                </div>

                <div className="bg-red-50 p-3 rounded-lg">
                  <p className="text-xs text-gray-600 mb-1">Ask @ 1%</p>
                  <p className="text-sm font-semibold">{formatVolume(orderBook.analysis.askDepth1pct)}</p>
                </div>

                <div className="bg-green-50 p-3 rounded-lg">
                  <p className="text-xs text-gray-600 mb-1">Bid @ 5%</p>
                  <p className="text-sm font-semibold">{formatVolume(orderBook.analysis.bidDepth5pct)}</p>
                </div>

                <div className="bg-red-50 p-3 rounded-lg">
                  <p className="text-xs text-gray-600 mb-1">Ask @ 5%</p>
                  <p className="text-sm font-semibold">{formatVolume(orderBook.analysis.askDepth5pct)}</p>
                </div>
              </div>

              <div className="bg-gray-50 p-2 rounded text-xs text-gray-600">
                <p>💡 Higher depth indicates better liquidity at that level</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Volume Summary */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Volume Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between pb-3 border-b">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-green-600" />
                  <span className="text-sm text-gray-600">Total Bids</span>
                </div>
                <span className="font-semibold">{formatVolume(orderBook.analysis.totalBidVolume)}</span>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-lg">📉</span>
                  <span className="text-sm text-gray-600">Total Asks</span>
                </div>
                <span className="font-semibold">{formatVolume(orderBook.analysis.totalAskVolume)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Bid Walls */}
        {orderBook.bidWalls.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <span className="text-lg">⚡</span>
                Bid Walls
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {orderBook.bidWalls.map((wall, index) => (
                  <div key={index} className="bg-green-50 p-2 rounded">
                    <p className="text-xs text-gray-600 mb-1">
                      {getWallStrengthDescription(wall.amount, orderBook.mid)}
                    </p>
                    <p className="text-sm font-semibold">${wall.price.toFixed(2)}</p>
                    <p className="text-xs text-gray-500">{formatVolume(wall.amount)}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Ask Walls */}
        {orderBook.askWalls.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <span className="text-lg">⚡</span>
                Ask Walls
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {orderBook.askWalls.map((wall, index) => (
                  <div key={index} className="bg-red-50 p-2 rounded">
                    <p className="text-xs text-gray-600 mb-1">
                      {getWallStrengthDescription(wall.amount, orderBook.mid)}
                    </p>
                    <p className="text-sm font-semibold">${wall.price.toFixed(2)}</p>
                    <p className="text-xs text-gray-500">{formatVolume(wall.amount)}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

/**
 * Helper: Get rating label from score
 */
function getRatingLabel(score: number): string {
  if (score > 80) return 'Excellent';
  if (score > 60) return 'Good';
  if (score > 40) return 'Fair';
  return 'Poor';
}

/**
 * Helper: Get rating emoji
 */
function getRatingEmoji(score: number): string {
  if (score > 80) return '⭐';
  if (score > 60) return '👍';
  if (score > 40) return '👌';
  return '⚠️';
}
