/**
 * Smart Order Router Component - Enhanced
 * 
 * Phase 3: Advanced routing with multi-exchange data aggregation
 * - Compare best execution across 5+ exchanges
 * - Real-time price feeds with spread analysis
 * - Intelligent order splitting recommendations
 * - Volume/liquidity-aware routing
 */

import React, { useState, useMemo } from 'react';
import { useOrderRouting, useOrderSplitting, useBestExecutionVenue, usePrices, useLimitOrderAnalysis } from '@/hooks/useExchangeData';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  AlertTriangle,
  CheckCircle,
  TrendingUp,
  DollarSign,
  Zap as ZapIcon,
  Sliders,
  RotateCw,
  Activity,
  Flame,
  Target,
  Lightbulb,
} from 'lucide-react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ScatterChart,
  Scatter,
} from 'recharts';

interface SmartOrderRouterProps {
  defaultSymbol?: string;
  defaultAmount?: number;
}

interface VenueOption {
  venue: 'dex' | 'cex';
  exchange?: string;
  price: number;
  totalCost: number;
  slippage?: number;
  gasCost?: number;
  fee?: number;
  totalWithCosts: number;
  confidence: 'high' | 'medium' | 'low';
  reasoning: string;
}

export const SmartOrderRouter: React.FC<SmartOrderRouterProps> = ({
  defaultSymbol = 'BTC',
  defaultAmount = 1,
}) => {
  const [symbol, setSymbol] = useState(defaultSymbol);
  const [amount, setAmount] = useState(defaultAmount);
  const [showSplitting, setShowSplitting] = useState(false);
  const [limitPrice, setLimitPrice] = useState(0);

  // Fetch data from multiple sources
  const routingQuery = useOrderRouting(symbol || null, amount || null);
  const splittingQuery = useOrderSplitting(symbol || null, amount || null);
  const bestVenueQuery = useBestExecutionVenue(symbol || null, amount || null);
  const pricesQuery = usePrices(
    symbol ? `${symbol}/USDT` : null,
    ['binance', 'coinbase', 'kraken', 'bybit', 'kucoin']
  );
  const limitQuery = useLimitOrderAnalysis(symbol || null, limitPrice || null, amount || null);

  const handleCalculate = () => {
    (routingQuery as any).refetch?.();
    (splittingQuery as any).refetch?.();
    (bestVenueQuery as any).refetch?.();
    (pricesQuery as any).refetch?.();
  };

  // Calculate routing metrics from real prices
  const routingMetrics = useMemo(() => {
    if (!pricesQuery.data || !(pricesQuery.data as any).prices) return null;

    const prices = (pricesQuery.data as any).prices;
    const validExchanges = Object.entries(prices)
      .filter(([_, p]: any) => p && p.ask)
      .map(([exchange, p]: any) => ({
        exchange,
        ask: p.ask,
        bid: p.bid,
        volume: p.volume,
        spread: ((p.ask - p.bid) / p.bid) * 100,
        totalCost: p.ask * amount,
      }))
      .sort((a, b) => a.ask - b.ask);

    if (validExchanges.length === 0) return null;

    const best = validExchanges[0];
    const worst = validExchanges[validExchanges.length - 1];
    const avgPrice = validExchanges.reduce((sum, e) => sum + e.ask, 0) / validExchanges.length;

    return {
      validExchanges,
      best,
      worst,
      avgPrice,
      savings: (worst.totalCost - best.totalCost) * 0.8, // Account for slippage
      savingsPercent: ((worst.ask - best.ask) / worst.ask) * 100,
      spread: (Math.max(...validExchanges.map(e => e.ask)) - Math.min(...validExchanges.map(e => e.ask))) / avgPrice * 100,
    };
  }, [pricesQuery.data, amount]);

  return (
    <Card className="col-span-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Zap className="w-5 h-5 text-yellow-500" />
          Smart Order Router (Phase 3)
        </CardTitle>
        <CardDescription>
          Compare DEX vs CEX prices, get routing recommendations, and split orders for optimal execution
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="compare" className="space-y-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="compare">Price Comparison</TabsTrigger>
            <TabsTrigger value="splitting">Order Splitting</TabsTrigger>
            <TabsTrigger value="limit">Limit Orders</TabsTrigger>
          </TabsList>

          {/* Tab 1: Price Comparison with Real Data */}
          <TabsContent value="compare" className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-900 dark:text-white">Symbol</label>
                <Input
                  value={symbol}
                  onChange={(e) => setSymbol(e.target.value)}
                  placeholder="BTC, ETH, CELO..."
                  className="bg-gray-50 dark:bg-slate-800"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-900 dark:text-white">Amount</label>
                <Input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(Number(e.target.value))}
                  placeholder="1.0"
                  className="bg-gray-50 dark:bg-slate-800"
                />
              </div>
              <div className="flex items-end gap-2">
                <Button
                  onClick={handleCalculate}
                  className="w-full"
                  disabled={routingQuery.isLoading || pricesQuery.isLoading}
                >
                  {routingQuery.isLoading || pricesQuery.isLoading ? (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                      Analyzing...
                    </>
                  ) : (
                    'Compare Routes'
                  )}
                </Button>
              </div>
            </div>

            {/* Loading State */}
            {(routingQuery.isLoading || pricesQuery.isLoading) && (
              <Card>
                <CardContent className="pt-6">
                  <div className="flex flex-col items-center justify-center py-12">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
                    <p className="text-gray-500 dark:text-gray-400">Fetching live prices from exchanges...</p>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Routing Results with Real Data */}
            {routingMetrics && (
              <div className="space-y-4">
                {/* Key Metrics */}
                <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                  <Card className="bg-gradient-to-br from-emerald-50 to-transparent dark:from-emerald-900/20">
                    <CardContent className="pt-4">
                      <div className="text-sm font-medium text-gray-600 dark:text-gray-400">Best Exchange</div>
                      <div className="text-xl font-bold text-gray-900 dark:text-white capitalize mt-1">
                        {routingMetrics.best.exchange}
                      </div>
                      <div className="text-xs text-emerald-600 dark:text-emerald-400 font-medium mt-2">
                        RECOMMENDED
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="bg-gradient-to-br from-blue-50 to-transparent dark:from-blue-900/20">
                    <CardContent className="pt-4">
                      <div className="text-sm font-medium text-gray-600 dark:text-gray-400">Price per Unit</div>
                      <div className="text-xl font-bold text-gray-900 dark:text-white mt-1">
                        ${routingMetrics.best.ask.toFixed(4)}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                        Avg: ${routingMetrics.avgPrice.toFixed(4)}
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="bg-gradient-to-br from-purple-50 to-transparent dark:from-purple-900/20">
                    <CardContent className="pt-4">
                      <div className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Cost</div>
                      <div className="text-xl font-bold text-gray-900 dark:text-white mt-1">
                        ${routingMetrics.best.totalCost.toFixed(2)}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                        {amount} {symbol}
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="bg-gradient-to-br from-green-50 to-transparent dark:from-green-900/20">
                    <CardContent className="pt-4">
                      <div className="text-sm font-medium text-gray-600 dark:text-gray-400">Max Savings</div>
                      <div className="text-xl font-bold text-green-600 dark:text-green-400 mt-1">
                        ${routingMetrics.savings.toFixed(2)}
                      </div>
                      <div className="text-xs text-green-600 dark:text-green-400 mt-2">
                        {routingMetrics.savingsPercent.toFixed(2)}% vs worst
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Price Spread Visualization */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Price Spread Analysis</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {routingMetrics.validExchanges.map((venue) => {
                        const position = ((venue.ask - routingMetrics.best.ask) / (routingMetrics.worst.ask - routingMetrics.best.ask)) * 100;
                        const isOverage = venue.ask > routingMetrics.avgPrice;

                        return (
                          <div key={venue.exchange}>
                            <div className="flex items-center justify-between mb-1">
                              <span className="font-medium capitalize text-gray-900 dark:text-white">
                                {venue.exchange}
                              </span>
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-bold text-gray-900 dark:text-white">
                                  ${venue.ask.toFixed(4)}
                                </span>
                                <Badge
                                  variant="outline"
                                  className={`text-xs ${
                                    isOverage
                                      ? 'border-red-300 text-red-700 dark:border-red-700 dark:text-red-400'
                                      : 'border-green-300 text-green-700 dark:border-green-700 dark:text-green-400'
                                  }`}
                                >
                                  {isOverage ? '+' : '-'}
                                  {Math.abs(((venue.ask - routingMetrics.avgPrice) / routingMetrics.avgPrice) * 100).toFixed(2)}%
                                </Badge>
                              </div>
                            </div>
                            <div className="w-full bg-gray-200 dark:bg-slate-700 rounded-full h-2">
                              <div
                                className={`h-2 rounded-full transition-all ${
                                  venue.exchange === routingMetrics.best.exchange
                                    ? 'bg-gradient-to-r from-emerald-500 to-green-500'
                                    : 'bg-gradient-to-r from-blue-500 to-cyan-500'
                                }`}
                                style={{ width: `${Math.max(5, position)}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>

                {/* Volume & Liquidity Analysis */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Liquidity & Volume</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-48">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={routingMetrics.validExchanges.map((v) => ({
                            name: v.exchange,
                            volume: v.volume / 1e6,
                            ask: v.ask,
                          }))}
                        >
                          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" opacity={0.3} />
                          <XAxis dataKey="name" stroke="#94a3b8" />
                          <YAxis yAxisId="left" stroke="#94a3b8" />
                          <YAxis yAxisId="right" orientation="right" stroke="#94a3b8" />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: 'rgba(255, 255, 255, 0.95)',
                              border: '1px solid #e2e8f0',
                              borderRadius: '8px',
                            }}
                          />
                          <Bar yAxisId="left" dataKey="volume" fill="#3b82f6" name="Volume (M $)" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>

                {/* Exchange Comparison Table */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">All Exchanges</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-gray-200 dark:border-slate-700">
                            <th className="text-left py-2 px-3 font-semibold text-gray-700 dark:text-gray-300">Exchange</th>
                            <th className="text-right py-2 px-3 font-semibold text-gray-700 dark:text-gray-300">Bid</th>
                            <th className="text-right py-2 px-3 font-semibold text-gray-700 dark:text-gray-300">Ask</th>
                            <th className="text-right py-2 px-3 font-semibold text-gray-700 dark:text-gray-300">Spread %</th>
                            <th className="text-right py-2 px-3 font-semibold text-gray-700 dark:text-gray-300">Order Cost</th>
                            <th className="text-center py-2 px-3 font-semibold text-gray-700 dark:text-gray-300">Rank</th>
                          </tr>
                        </thead>
                        <tbody>
                          {routingMetrics.validExchanges.map((venue, idx) => (
                            <tr
                              key={venue.exchange}
                              className={`border-b border-gray-100 dark:border-slate-800 ${
                                idx === 0
                                  ? 'bg-emerald-50 dark:bg-emerald-900/20'
                                  : 'hover:bg-gray-50 dark:hover:bg-slate-800/50'
                              }`}
                            >
                              <td className="py-3 px-3 capitalize font-semibold text-gray-900 dark:text-white">
                                {venue.exchange}
                              </td>
                              <td className="text-right py-3 px-3 text-gray-700 dark:text-gray-300">
                                ${venue.bid.toFixed(4)}
                              </td>
                              <td className="text-right py-3 px-3 text-gray-900 dark:text-white font-medium">
                                ${venue.ask.toFixed(4)}
                              </td>
                              <td className="text-right py-3 px-3 text-amber-600 dark:text-amber-400 font-medium">
                                {venue.spread.toFixed(3)}%
                              </td>
                              <td className="text-right py-3 px-3 text-gray-900 dark:text-white font-medium">
                                ${venue.totalCost.toFixed(2)}
                              </td>
                              <td className="text-center py-3 px-3">
                                {idx === 0 ? (
                                  <Badge className="bg-emerald-600">Best</Badge>
                                ) : (
                                  <Badge variant="outline">#{idx + 1}</Badge>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {routingQuery.error && (
              <Card className="bg-red-50 dark:bg-red-900/20">
                <CardContent className="pt-4 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400" />
                  <span className="text-sm text-red-700 dark:text-red-300">
                    Failed to analyze routes: {(routingQuery.error as Error).message}
                  </span>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Tab 2: Order Splitting - Smart Split Recommendations */}
          <TabsContent value="splitting" className="space-y-4">
            <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800 flex gap-3">
              <ZapIcon className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-blue-900 dark:text-blue-200">
                <strong>Smart Order Splitting:</strong> Large orders are automatically split across the best-priced exchanges
                to minimize slippage and execution costs while maximizing fill rates.
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-900 dark:text-white">Symbol</label>
                <Input value={symbol} disabled className="bg-gray-100 dark:bg-slate-700" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-900 dark:text-white">Total Amount</label>
                <Input value={amount} disabled className="bg-gray-100 dark:bg-slate-700" />
              </div>
              <div className="flex items-end">
                <Button
                  onClick={() => (splittingQuery as any).refetch?.()}
                  className="w-full"
                  disabled={splittingQuery.isLoading}
                >
                  {splittingQuery.isLoading ? (
                    <>
                      <RotateCw className="w-4 h-4 mr-2 animate-spin" />
                      Calculating...
                    </>
                  ) : (
                    'Calculate Optimal Split'
                  )}
                </Button>
              </div>
            </div>

            {/* Splitting Results */}
            {splittingQuery.data && (
              <div className="space-y-4">
                {/* Overview Card */}
                <Card className="bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20">
                  <CardContent className="pt-4">
                    <div className="font-semibold text-gray-900 dark:text-white mb-3">
                      {((splittingQuery.data as any).recommendation)}
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="p-3 bg-white/50 dark:bg-slate-800/50 rounded-lg">
                        <p className="text-xs text-gray-600 dark:text-gray-400 font-semibold mb-1">TOTAL COST</p>
                        <p className="text-xl font-bold text-gray-900 dark:text-white">
                          ${((splittingQuery.data as any).totalCost).toFixed(2)}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          Best aggregated price
                        </p>
                      </div>
                      <div className="p-3 bg-white/50 dark:bg-slate-800/50 rounded-lg">
                        <p className="text-xs text-gray-600 dark:text-gray-400 font-semibold mb-1">AVG PRICE</p>
                        <p className="text-xl font-bold text-gray-900 dark:text-white">
                          ${((splittingQuery.data as any).averagePrice).toFixed(4)}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          Weighted average
                        </p>
                      </div>
                      <div className="p-3 bg-white/50 dark:bg-slate-800/50 rounded-lg">
                        <p className="text-xs text-gray-600 dark:text-gray-400 font-semibold mb-1">EXCHANGES</p>
                        <p className="text-xl font-bold text-gray-900 dark:text-white">
                          {((splittingQuery.data as any).splits)?.length || 1}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          Orders to place
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Split Visualization */}
                {((splittingQuery.data as any).splits) && ((splittingQuery.data as any).splits).length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Split Breakdown</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {((splittingQuery.data as any).splits).map((split: any, idx: number) => (
                          <div key={idx} className="space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="font-semibold capitalize text-gray-900 dark:text-white">
                                {split.venue === 'dex' ? '🔀 DEX' : `📊 ${split.exchange || 'CEX'}`}
                              </span>
                              <Badge variant="outline" className="text-xs">
                                {split.percentage.toFixed(1)}%
                              </Badge>
                            </div>
                            <div className="bg-gray-200 dark:bg-slate-700 rounded-full h-3">
                              <div
                                className="bg-gradient-to-r from-blue-500 to-cyan-500 h-3 rounded-full transition-all"
                                style={{ width: `${split.percentage}%` }}
                              />
                            </div>
                            <div className="grid grid-cols-4 gap-2 text-sm text-gray-600 dark:text-gray-400">
                              <div>
                                <span className="text-xs text-gray-500">Amount:</span>
                                <p className="font-medium text-gray-900 dark:text-white">{split.amount} {symbol}</p>
                              </div>
                              <div>
                                <span className="text-xs text-gray-500">Price:</span>
                                <p className="font-medium text-gray-900 dark:text-white">${split.price.toFixed(4)}</p>
                              </div>
                              <div>
                                <span className="text-xs text-gray-500">Cost:</span>
                                <p className="font-medium text-gray-900 dark:text-white">${split.cost.toFixed(2)}</p>
                              </div>
                              <div className="flex items-end">
                                <Button variant="outline" size="sm" className="w-full">
                                  Execute
                                </Button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Split Distribution Chart */}
                {((splittingQuery.data as any).splits) && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Distribution Analysis</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="h-48">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart
                            data={((splittingQuery.data as any).splits).map((s: any) => ({
                              name: s.venue === 'dex' ? 'DEX' : s.exchange,
                              amount: parseFloat(s.amount),
                              cost: s.cost,
                            }))}
                          >
                            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" opacity={0.3} />
                            <XAxis dataKey="name" stroke="#94a3b8" />
                            <YAxis yAxisId="left" stroke="#94a3b8" />
                            <YAxis yAxisId="right" orientation="right" stroke="#94a3b8" />
                            <Tooltip
                              contentStyle={{
                                backgroundColor: 'rgba(255, 255, 255, 0.95)',
                                border: '1px solid #e2e8f0',
                                borderRadius: '8px',
                              }}
                            />
                            <Bar yAxisId="left" dataKey="amount" fill="#3b82f6" name={`Amount (${symbol})`} />
                            <Bar yAxisId="right" dataKey="cost" fill="#10b981" name="Cost ($)" />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}

            {splittingQuery.isLoading && (
              <Card>
                <CardContent className="pt-6">
                  <div className="flex flex-col items-center justify-center py-12">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
                    <p className="text-gray-500 dark:text-gray-400">Calculating optimal split across exchanges...</p>
                  </div>
                </CardContent>
              </Card>
            )}

            {splittingQuery.error && (
              <Card className="bg-red-50 dark:bg-red-900/20">
                <CardContent className="pt-4 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400" />
                  <span className="text-sm text-red-700 dark:text-red-300">
                    Failed to calculate split: {(splittingQuery.error as Error).message}
                  </span>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Tab 3: Limit Orders - Price Target Analysis */}
          <TabsContent value="limit" className="space-y-4">
            <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg border border-purple-200 dark:border-purple-800 flex gap-3">
              <Target className="w-5 h-5 text-purple-600 dark:text-purple-400 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-purple-900 dark:text-purple-200">
                <strong>Limit Order Analytics:</strong> Set price targets across multiple exchanges. Smart routing
                analyzes order book depth to predict fill probability and optimal execution venue.
              </div>
            </div>

            <div className="grid grid-cols-4 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-900 dark:text-white">Symbol</label>
                <Input value={symbol} disabled className="bg-gray-100 dark:bg-slate-700" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-900 dark:text-white">Amount</label>
                <Input value={amount} disabled className="bg-gray-100 dark:bg-slate-700" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-900 dark:text-white">Limit Price ($)</label>
                <Input
                  type="number"
                  placeholder="0.00"
                  value={limitPrice}
                  onChange={(e) => setLimitPrice(parseFloat(e.target.value) || 0)}
                  step="0.0001"
                  className="dark:bg-slate-700"
                />
              </div>
              <div className="flex items-end">
                <Button
                  onClick={() => (limitQuery as any).refetch?.()}
                  className="w-full"
                  disabled={limitQuery.isLoading || !limitPrice}
                >
                  {limitQuery.isLoading ? (
                    <>
                      <RotateCw className="w-4 h-4 mr-2 animate-spin" />
                      Analyzing...
                    </>
                  ) : (
                    'Analyze Limit Order'
                  )}
                </Button>
              </div>
            </div>

            {/* Limit Order Results */}
            {limitQuery.data && (
              <div className="space-y-4">
                {/* Overview */}
                <Card className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20">
                  <CardContent className="pt-4">
                    <div className="grid grid-cols-4 gap-4">
                      <div className="p-3 bg-white/50 dark:bg-slate-800/50 rounded-lg">
                        <p className="text-xs text-gray-600 dark:text-gray-400 font-semibold mb-1">LIMIT PRICE</p>
                        <p className="text-xl font-bold text-gray-900 dark:text-white">
                          ${limitPrice.toFixed(4)}
                        </p>
                        <p className="text-xs mt-1">
                          <span className={limitPrice > ((limitQuery.data as any).currentPrice || 0) ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}>
                            {limitPrice > ((limitQuery.data as any).currentPrice || 0) ? "+" : ""}
                            {((limitPrice - ((limitQuery.data as any).currentPrice || 0)) / ((limitQuery.data as any).currentPrice || 1) * 100).toFixed(2)}%
                          </span>
                        </p>
                      </div>
                      <div className="p-3 bg-white/50 dark:bg-slate-800/50 rounded-lg">
                        <p className="text-xs text-gray-600 dark:text-gray-400 font-semibold mb-1">BEST CURRENT PRICE</p>
                        <p className="text-xl font-bold text-gray-900 dark:text-white">
                          ${(((limitQuery.data as any).currentPrice) || 0).toFixed(4)}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Across all exchanges</p>
                      </div>
                      <div className="p-3 bg-white/50 dark:bg-slate-800/50 rounded-lg">
                        <p className="text-xs text-gray-600 dark:text-gray-400 font-semibold mb-1">FILL PROBABILITY</p>
                        <p className="text-xl font-bold text-gray-900 dark:text-white">
                          {((limitQuery.data as any).fillProbability || 0).toFixed(0)}%
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Estimated success rate</p>
                      </div>
                      <div className="p-3 bg-white/50 dark:bg-slate-800/50 rounded-lg">
                        <p className="text-xs text-gray-600 dark:text-gray-400 font-semibold mb-1">RECOMMENDED VENUE</p>
                        <p className="text-xl font-bold text-gray-900 dark:text-white capitalize">
                          {((limitQuery.data as any).bestVenue) || 'N/A'}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Deepest order book</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Price Target Visualization */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Price Target Analysis</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-56">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart
                          data={[
                            { name: 'Limit Price', price: limitPrice },
                            { name: 'Best Bid', price: ((limitQuery.data as any).currentPrice) || 0 },
                          ]}
                        >
                          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" opacity={0.3} />
                          <XAxis dataKey="name" stroke="#94a3b8" />
                          <YAxis stroke="#94a3b8" domain={[((limitQuery.data as any).currentPrice || 0) * 0.98, limitPrice * 1.02]} />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: 'rgba(255, 255, 255, 0.95)',
                              border: '1px solid #e2e8f0',
                              borderRadius: '8px',
                            }}
                            formatter={(value) => `$${(value as number).toFixed(4)}`}
                          />
                          <Legend />
                          <Line type="monotone" dataKey="price" stroke="#a855f7" strokeWidth={3} dot={{ fill: '#a855f7', r: 6 }} />
                          <Line type="monotone" dataKey="price" stroke="#06b6d4" strokeWidth={2} dot={{ fill: '#06b6d4', r: 4 }} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>

                {/* Exchange Analysis Table */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Exchange Order Book Depth</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-gray-200 dark:border-gray-700">
                            <th className="text-left py-2 px-2 text-gray-700 dark:text-gray-300 font-semibold">Exchange</th>
                            <th className="text-right py-2 px-2 text-gray-700 dark:text-gray-300 font-semibold">Best Bid</th>
                            <th className="text-right py-2 px-2 text-gray-700 dark:text-gray-300 font-semibold">Ask Above Limit</th>
                            <th className="text-right py-2 px-2 text-gray-700 dark:text-gray-300 font-semibold">Order Book Depth</th>
                            <th className="text-right py-2 px-2 text-gray-700 dark:text-gray-300 font-semibold">Fill Likelihood</th>
                          </tr>
                        </thead>
                        <tbody>
                          {((limitQuery.data as any).exchangeAnalysis)?.map((ex: any, idx: number) => (
                            <tr
                              key={idx}
                              className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-slate-800/50"
                            >
                              <td className="py-3 px-2 capitalize font-medium text-gray-900 dark:text-white">
                                {ex.exchange}
                              </td>
                              <td className="text-right py-3 px-2 text-gray-900 dark:text-white">
                                ${ex.bestBid.toFixed(4)}
                              </td>
                              <td className="text-right py-3 px-2">
                                <span className={ex.asksAboveLimit > 0 ? "text-green-600 dark:text-green-400 font-semibold" : "text-red-600 dark:text-red-400"}>
                                  {ex.asksAboveLimit > 0 ? "✓" : "✗"} {ex.asksAboveLimit} orders
                                </span>
                              </td>
                              <td className="text-right py-3 px-2 text-gray-900 dark:text-white">
                                <div className="flex items-center justify-end gap-2">
                                  <div className="w-16 bg-gray-200 dark:bg-slate-700 rounded-full h-2">
                                    <div
                                      className={`h-2 rounded-full ${ex.depth > 75 ? 'bg-green-500' : ex.depth > 40 ? 'bg-yellow-500' : 'bg-red-500'}`}
                                      style={{ width: `${Math.min(ex.depth, 100)}%` }}
                                    />
                                  </div>
                                  <span>{ex.depth.toFixed(0)}%</span>
                                </div>
                              </td>
                              <td className="text-right py-3 px-2">
                                <Badge
                                  variant={ex.likelihood > 75 ? 'default' : ex.likelihood > 40 ? 'outline' : 'secondary'}
                                  className="text-xs"
                                >
                                  {ex.likelihood.toFixed(0)}%
                                </Badge>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>

                {/* Recommendation */}
                <Card className="border-2 border-purple-300 dark:border-purple-700 bg-purple-50/50 dark:bg-purple-900/10">
                  <CardContent className="pt-4">
                    <div className="flex gap-3">
                      <Lightbulb className="w-5 h-5 text-purple-600 dark:text-purple-400 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="font-semibold text-gray-900 dark:text-white mb-2">Smart Recommendation</p>
                        <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                          {((limitQuery.data as any).recommendation) || 
                            `Place limit orders on ${((limitQuery.data as any).bestVenue)} (best order book depth). 
                             Expected fill probability: ${((limitQuery.data as any).fillProbability)?.toFixed(0)}%. 
                             Monitor for 24-48 hours; if unfilled, adjust limit price down by 0.5-1.0%.`}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {limitQuery.isLoading && (
              <Card>
                <CardContent className="pt-6">
                  <div className="flex flex-col items-center justify-center py-12">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mb-4"></div>
                    <p className="text-gray-500 dark:text-gray-400">Analyzing order books and fill probability...</p>
                  </div>
                </CardContent>
              </Card>
            )}

            {limitQuery.error && (
              <Card className="bg-red-50 dark:bg-red-900/20">
                <CardContent className="pt-4 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400" />
                  <span className="text-sm text-red-700 dark:text-red-300">
                    Failed to analyze limit order: {(limitQuery.error as Error).message}
                  </span>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};

export default SmartOrderRouter;
