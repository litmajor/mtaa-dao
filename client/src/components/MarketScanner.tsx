/**
 * Market Scanner Component
 * Browse and scan markets from all 6 exchanges with pagination
 * - Real-time market data loading
 * - Per-exchange symbol browsing  
 * - Paginated results (25/50/100 per page)
 * - Multi-exchange comparison
 */

import React, { useState, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';
// Note: Some icons may not exist in lucide-react, using available alternatives
// import { TrendingUp, RefreshCcw, Lightbulb, AlertTriangle } from 'lucide-react';
import { TrendingUp } from 'lucide-react';

interface Market {
  id: string;
  symbol: string;
  baseId?: string;
  quoteId?: string;
  base?: string;
  quote?: string;
  active?: boolean;
  maker?: number;
  taker?: number;
  precision?: {
    amount?: number;
    price?: number;
  };
  limits?: {
    amount?: { min?: number; max?: number };
    price?: { min?: number; max?: number };
    cost?: { min?: number; max?: number };
  };
  info?: any;
  // Enhanced fields
  lastPrice?: number;
  volume?: number;
  bidAsk?: {
    bid?: number;
    ask?: number;
    spread?: number;
  };
}

interface ExchangeStats {
  exchange: string;
  totalMarkets: number;
  activeMarkets: number;
  pairs: number;
  lastUpdate: string;
}

const EXCHANGES = ['binance', 'coinbase', 'kraken', 'bybit', 'kucoin', 'okx'];
const COLORS = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#06b6d4'];

interface UseMarketsScannerProps {
  exchange: string;
  page?: number;
  pageSize?: number;
  search?: string;
}

/**
 * Hook to fetch markets for a specific exchange
 */
const useMarketsScanner = ({ 
  exchange, 
  page = 1, 
  pageSize = 50, 
  search = '' 
}: UseMarketsScannerProps) => {
  return useQuery({
    queryKey: ['markets-scan', exchange, page, pageSize, search],
    queryFn: async () => {
      try {
        const url = new URL(`/api/exchanges/markets?exchange=${exchange}`);
        url.searchParams.append('page', page.toString());
        url.searchParams.append('pageSize', pageSize.toString());
        if (search) url.searchParams.append('search', search);

        const response = await fetch(url.toString());
        if (!response.ok) {
          throw new Error(`Failed to fetch markets for ${exchange}`);
        }

        const data = await response.json();
        
        return {
          markets: Array.isArray(data) ? data : data.markets || [],
          total: data.total || (Array.isArray(data) ? data.length : 0),
          page,
          pageSize,
          exchange
        };
      } catch (error) {
        console.error(`Error fetching markets for ${exchange}:`, error);
        throw error;
      }
    },
    staleTime: 30000, // 30 seconds
    retry: 2,
  } as any);
};

/**
 * Hook to fetch all exchanges status and statistics
 */
const useExchangesStatistics = () => {
  return useQuery({
    queryKey: ['exchanges-stats'],
    queryFn: async () => {
      try {
        const response = await fetch('/api/exchanges/statistics');
        if (!response.ok) {
          throw new Error('Failed to fetch exchange statistics');
        }
        return response.json();
      } catch (error) {
        console.error('Error fetching exchange statistics:', error);
        // Return default stats if endpoint doesn't exist
        return {
          exchanges: EXCHANGES.map(ex => ({
            exchange: ex,
            totalMarkets: 0,
            activeMarkets: 0,
            pairs: 0,
            lastUpdate: new Date().toISOString()
          }))
        };
      }
    },
    staleTime: 60000, // 1 minute
    retry: 1,
  } as any);
};

/**
 * Hook to reload/refresh market data from all exchanges
 */
const useReloadMarkets = () => {
  return useQuery({
    queryKey: ['reload-all-markets'],
    queryFn: async () => {
      try {
        const response = await fetch('/api/exchanges/reload-markets', { method: 'POST' });
        if (!response.ok) {
          throw new Error('Failed to reload markets');
        }
        return response.json();
      } catch (error) {
        console.error('Error reloading markets:', error);
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
      }
    },
    enabled: false, // Only call manually
    staleTime: 0,
  } as any);
};

/**
 * Market Row Component
 */
const MarketRow: React.FC<{ market: Market; exchange: string }> = ({ market, exchange }) => {
  const symbol = market.symbol || market.id || '';
  const baseId = market.baseId || market.base || '';
  const quoteId = market.quoteId || market.quote || '';
  const isActive = market.active !== false;
  const volume = market.volume || 0;
  const lastPrice = market.lastPrice || 0;
  const bid = market.bidAsk?.bid || 0;
  const ask = market.bidAsk?.ask || 0;
  const spread = market.bidAsk?.spread || 0;

  return (
    <tr className="border-b border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors">
      <td className="px-4 py-3">
        <Badge variant={isActive ? "default" : "secondary"} className="text-xs">
          {isActive ? "Active" : "Inactive"}
        </Badge>
      </td>
      <td className="px-4 py-3">
        <div className="font-mono text-sm font-medium text-gray-900 dark:text-white">
          {symbol}
        </div>
        <div className="text-xs text-gray-500 dark:text-gray-400">
          {baseId} / {quoteId}
        </div>
      </td>
      <td className="px-4 py-3 text-right">
        {lastPrice > 0 ? (
          <div>
            <div className="text-sm font-medium text-gray-900 dark:text-white">
              ${lastPrice.toFixed(lastPrice > 1 ? 2 : 8)}
            </div>
          </div>
        ) : (
          <span className="text-gray-400">-</span>
        )}
      </td>
      <td className="px-4 py-3 text-right text-sm">
        {bid > 0 && ask > 0 ? (
          <div>
            <div className="text-green-600 dark:text-green-400">B: ${bid.toFixed(8)}</div>
            <div className="text-red-600 dark:text-red-400">A: ${ask.toFixed(8)}</div>
          </div>
        ) : (
          <span className="text-gray-400">-</span>
        )}
      </td>
      <td className="px-4 py-3 text-right">
        {spread > 0 ? (
          <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
            {(spread * 100).toFixed(3)}%
          </span>
        ) : (
          <span className="text-gray-400">-</span>
        )}
      </td>
      <td className="px-4 py-3 text-right">
        {volume > 0 ? (
          <div className="text-sm">
            {volume > 1e9
              ? `$${(volume / 1e9).toFixed(2)}B`
              : volume > 1e6
              ? `$${(volume / 1e6).toFixed(2)}M`
              : volume > 1e3
              ? `$${(volume / 1e3).toFixed(2)}K`
              : `$${volume.toFixed(2)}`}
          </div>
        ) : (
          <span className="text-gray-400">-</span>
        )}
      </td>
      <td className="px-4 py-3 text-right">
        {market.maker !== undefined && market.taker !== undefined ? (
          <div className="text-xs">
            <div className="text-gray-600 dark:text-gray-400">M: {(market.maker * 100).toFixed(3)}%</div>
            <div className="text-gray-600 dark:text-gray-400">T: {(market.taker * 100).toFixed(3)}%</div>
          </div>
        ) : (
          <span className="text-gray-400">-</span>
        )}
      </td>
    </tr>
  );
};

/**
 * Main Market Scanner Component
 */
export const MarketScanner: React.FC = () => {
  const [selectedExchange, setSelectedExchange] = useState('binance');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedExchanges, setSelectedExchanges] = useState<string[]>(EXCHANGES);

  // Query hooks
  const marketsQuery = useMarketsScanner({
    exchange: selectedExchange,
    page: currentPage,
    pageSize,
    search: searchTerm
  });

  const statsQuery = useExchangesStatistics();
  const reloadMarketsQuery = useReloadMarkets();

  const { data: marketsData, isLoading, error, refetch } = marketsQuery as any;
  const { data: statsData, isLoading: statsLoading } = statsQuery;

  const markets = (marketsData as any)?.markets || [];
  const totalMarkets = (marketsData as any)?.total || 0;
  const totalPages = Math.ceil(totalMarkets / pageSize);

  // Statistics for pie chart
  const exchangeStats = useMemo(() => {
    if (!(statsData as any)?.exchanges) return [];
    return (statsData as any).exchanges
      .filter((stat: ExchangeStats) => selectedExchanges.includes(stat.exchange))
      .map((stat: ExchangeStats, idx: number) => ({
        name: stat.exchange.toUpperCase(),
        value: stat.activeMarkets || stat.totalMarkets || 0,
        color: COLORS[EXCHANGES.indexOf(stat.exchange) % COLORS.length]
      }));
  }, [statsData, selectedExchanges]);

  const handleReloadMarkets = async () => {
    if (confirm('Reload market data from all exchanges? This may take a moment.')) {
      if ((reloadMarketsQuery as any).refetch) {
        await (reloadMarketsQuery as any).refetch();
      }
      if (refetch) {
        refetch();
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Card */}
      <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-slate-900 dark:to-slate-800 border-blue-200 dark:border-slate-700">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <TrendingUp className="w-6 h-6 text-blue-600" />
              <div>
                <CardTitle>Market Scanner</CardTitle>
                <CardDescription>Browse and analyze 6 exchanges with real-time market data</CardDescription>
              </div>
            </div>
            <Button
              onClick={handleReloadMarkets}
              disabled={(reloadMarketsQuery as any).isFetching}
              variant="outline"
              size="sm"
              className="gap-2"
            >
              <RotateCw className={`w-4 h-4 ${(reloadMarketsQuery as any).isFetching ? 'animate-spin' : ''}`} />
              Reload All
            </Button>
          </div>
        </CardHeader>
      </Card>

      <Tabs defaultValue="scanner" className="w-full">
        <TabsList className="grid w-full grid-cols-2 lg:grid-cols-3 mb-6">
          <TabsTrigger value="scanner">Market Scanner</TabsTrigger>
          <TabsTrigger value="statistics">Statistics</TabsTrigger>
          <TabsTrigger value="comparison" className="hidden lg:block">Multi-Exchange</TabsTrigger>
        </TabsList>

        {/* Market Scanner Tab */}
        <TabsContent value="scanner" className="space-y-6">
          {/* Exchange Selection */}
          <Card className="bg-white dark:bg-slate-900">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Exchange Selection</CardTitle>
            </CardHeader>
            <CardContent>
              <Select value={selectedExchange} onValueChange={(value) => {
                setSelectedExchange(value);
                setCurrentPage(1);
              }}>
                <SelectTrigger className="w-full max-w-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EXCHANGES.map((exchange) => (
                    <SelectItem key={exchange} value={exchange}>
                      {exchange.toUpperCase()}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                {selectedExchange.toUpperCase()} · {totalMarkets.toLocaleString()} markets available
              </p>
            </CardContent>
          </Card>

          {/* Search and Pagination Controls */}
          <Card className="bg-white dark:bg-slate-900">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Search & Filter</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2 flex-wrap items-end">
                <div className="flex-1 min-w-[300px]">
                  <label className="text-sm font-medium mb-1 block text-gray-700 dark:text-gray-300">
                    Search by symbol
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-3 text-gray-400">🔍</span>
                    <Input
                      placeholder="e.g., BTC/USDT, ETH/USD..."
                      value={searchTerm}
                      onChange={(e) => {
                        setSearchTerm(e.target.value);
                        setCurrentPage(1);
                      }}
                      className="pl-10"
                    />
                    {searchTerm && (
                      <button
                        onClick={() => {
                          setSearchTerm('');
                          setCurrentPage(1);
                        }}
                        className="absolute right-3 top-3 text-gray-400 hover:text-gray-600"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                </div>

                <div className="flex items-end gap-2">
                  <div>
                    <label className="text-sm font-medium mb-1 block text-gray-700 dark:text-gray-300">
                      Items per page
                    </label>
                    <Select value={pageSize.toString()} onValueChange={(value) => {
                      setPageSize(parseInt(value));
                      setCurrentPage(1);
                    }}>
                      <SelectTrigger className="w-24">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="25">25</SelectItem>
                        <SelectItem value="50">50</SelectItem>
                        <SelectItem value="100">100</SelectItem>
                        <SelectItem value="250">250</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => refetch()}
                    disabled={isLoading}
                  >
                    <RotateCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                    Refresh
                  </Button>
                </div>
              </div>

              {/* Info Row */}
              <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400">
                <span>
                  {searchTerm && `Found: ${markets.length} · `}
                  Page {currentPage} of {totalPages}
                </span>
                <span>
                  Showing {(currentPage - 1) * pageSize + 1}-{Math.min(currentPage * pageSize, totalMarkets)} of {totalMarkets}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Markets Table */}
          <Card className="bg-white dark:bg-slate-900 overflow-hidden">
            {isLoading ? (
              <div className="p-8 text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <p className="text-gray-600 dark:text-gray-400">Loading markets from {selectedExchange.toUpperCase()}...</p>
              </div>
            ) : error ? (
              <div className="p-8 text-center">
                <div className="w-8 h-8 text-red-500 mx-auto mb-2">⚠️</div>
                <p className="text-red-600 dark:text-red-400 mb-4">Failed to load markets</p>
                <Button onClick={() => refetch()} variant="outline" size="sm">
                  Retry
                </Button>
              </div>
            ) : markets.length === 0 ? (
              <div className="p-8 text-center">
                <p className="text-gray-500 dark:text-gray-400">
                  {searchTerm ? `No markets found matching "${searchTerm}"` : 'No markets available'}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 dark:bg-slate-800/50 border-b border-gray-200 dark:border-slate-700">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400">Status</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400">Symbol</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 dark:text-gray-400">Last Price</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 dark:text-gray-400">Bid / Ask</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 dark:text-gray-400">Spread</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 dark:text-gray-400">Volume (24h)</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 dark:text-gray-400">Fees</th>
                    </tr>
                  </thead>
                  <tbody>
                    {markets.map((market: Market) => (
                      <MarketRow
                        key={market.id || market.symbol}
                        market={market}
                        exchange={selectedExchange}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          {/* Pagination */}
          {totalPages > 1 && !isLoading && markets.length > 0 && (
            <div className="flex justify-center">
              <Pagination>
                <PaginationContent className="gap-1">
                  <PaginationItem>
                    <PaginationPrevious
                      onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                      className={currentPage === 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                    />
                  </PaginationItem>

                  {/* Show page numbers */}
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    const pageNum = currentPage <= 3 ? i + 1 : currentPage - 2 + i;
                    if (pageNum > totalPages) return null;
                    return (
                      <PaginationItem key={pageNum}>
                        <PaginationLink
                          onClick={() => setCurrentPage(pageNum)}
                          isActive={currentPage === pageNum}
                          className="cursor-pointer"
                        >
                          {pageNum}
                        </PaginationLink>
                      </PaginationItem>
                    );
                  })}

                  {totalPages > 5 && currentPage < totalPages - 2 && (
                    <PaginationItem>
                      <PaginationEllipsis />
                    </PaginationItem>
                  )}

                  <PaginationItem>
                    <PaginationNext
                      onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                      className={currentPage === totalPages ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </div>
          )}
        </TabsContent>

        {/* Statistics Tab */}
        <TabsContent value="statistics" className="space-y-6">
          <Card className="bg-white dark:bg-slate-900">
            <CardHeader>
              <CardTitle>Exchange Statistics</CardTitle>
              <CardDescription>Market overview across all 6 exchanges</CardDescription>
            </CardHeader>
            <CardContent>
              {statsLoading ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Pie Chart */}
                  {exchangeStats.length > 0 && (
                    <div className="h-80">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={exchangeStats}
                            cx="50%"
                            cy="50%"
                            labelLine={false}
                            label={({ name, value }) => `${name}: ${value.toLocaleString()}`}
                            outerRadius={100}
                            fill="#8884d8"
                            dataKey="value"
                          >
                            {exchangeStats.map((entry: any, index: number) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip formatter={(value: any) => value.toLocaleString()} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  )}

                  {/* Stats Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {(statsData as any)?.exchanges?.map((stat: ExchangeStats) => (
                      <Card key={stat.exchange} className="bg-gray-50 dark:bg-slate-800/50">
                        <CardContent className="pt-6">
                          <div className="space-y-3">
                            <h3 className="font-semibold text-lg text-gray-900 dark:text-white">
                              {stat.exchange.toUpperCase()}
                            </h3>
                            <div className="space-y-2 text-sm">
                              <div className="flex justify-between">
                                <span className="text-gray-600 dark:text-gray-400">Total Markets:</span>
                                <span className="font-medium text-gray-900 dark:text-white">
                                  {(stat.totalMarkets || 0).toLocaleString()}
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-600 dark:text-gray-400">Active Markets:</span>
                                <span className="font-medium text-gray-900 dark:text-white">
                                  {(stat.activeMarkets || 0).toLocaleString()}
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-600 dark:text-gray-400">Pairs:</span>
                                <span className="font-medium text-gray-900 dark:text-white">
                                  {(stat.pairs || 0).toLocaleString()}
                                </span>
                              </div>
                              <div className="text-xs text-gray-500 dark:text-gray-500 mt-2">
                                Updated: {new Date(stat.lastUpdate).toLocaleTimeString()}
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Multi-Exchange Comparison Tab */}
        <TabsContent value="comparison" className="space-y-6">
          <Card className="bg-white dark:bg-slate-900">
            <CardHeader>
              <CardTitle>Multi-Exchange Comparison</CardTitle>
              <CardDescription>Select exchanges to compare markets</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2">
                {EXCHANGES.map((exchange) => (
                  <Button
                    key={exchange}
                    variant={selectedExchanges.includes(exchange) ? "default" : "outline"}
                    size="sm"
                    onClick={() => {
                      setSelectedExchanges(prev =>
                        prev.includes(exchange)
                          ? prev.filter(e => e !== exchange)
                          : [...prev, exchange]
                      );
                    }}
                  >
                    {exchange.toUpperCase()}
                  </Button>
                ))}
              </div>

              {selectedExchanges.length > 0 && (
                <div className="mt-6">
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">
                    Markets per Exchange
                  </h3>
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={(statsData as any)?.exchanges
                          ?.filter((s: ExchangeStats) => selectedExchanges.includes(s.exchange))
                          .map((s: ExchangeStats) => ({
                            name: s.exchange.toUpperCase(),
                            active: s.activeMarkets || 0,
                            total: s.totalMarkets || 0
                          })) || []}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#ccc" />
                        <XAxis dataKey="name" />
                        <YAxis />
                        <Tooltip />
                        <Bar dataKey="active" fill="#3b82f6" name="Active Markets" />
                        <Bar dataKey="total" fill="#93c5fd" name="Total Markets" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default MarketScanner;
