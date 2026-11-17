// frontend/src/components/dashboard/MarketExplorer.tsx
import React, { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, Search } from 'lucide-react';
import { useMarketData } from '../../hooks/useMarketData';

interface FilterType {
  label: string;
  value: 'all' | 'cex' | 'dex';
  icon: string;
}

export const MarketExplorer: React.FC = () => {
  const [isOpen, setIsOpen] = useState(true);
  const [searchInput, setSearchInput] = useState('');
  const [filter, setFilter] = useState<'all' | 'cex' | 'dex'>('all');
  const [activeTab, setActiveTab] = useState<'summary' | 'detail'>('summary');
  const [recentSearches, setRecentSearches] = useState<string[]>([
    'BTC/USDT',
    'ETH/USDT',
    'SOL/USDT'
  ]);

  const {
    marketData,
    sources,
    loading,
    error,
    searchPair,
    getDetailedData
  } = useMarketData();

  const filters: FilterType[] = [
    { label: 'ALL', value: 'all', icon: '🌐' },
    { label: 'CEX', value: 'cex', icon: '🏢' },
    { label: 'DEX', value: 'dex', icon: '🔄' }
  ];

  const handleSearch = async (pair: string) => {
    if (!pair.trim()) return;

    const formatted = pair.toUpperCase();
    
    // Add to recent searches
    setRecentSearches(prev => {
      const filtered = prev.filter(s => s !== formatted);
      return [formatted, ...filtered].slice(0, 5);
    });

    await searchPair(formatted);
    setActiveTab('summary');
  };

  const handleDetailView = async () => {
    if (marketData?.pair) {
      await getDetailedData(marketData.pair);
      setActiveTab('detail');
    }
  };

  const filteredSources = sources.filter(source => {
    if (filter === 'cex') return source.type === 'CEX';
    if (filter === 'dex') return source.type === 'DEX';
    return true;
  });

  const cexSources = sources.filter(s => s.type === 'CEX');
  const dexSources = sources.filter(s => s.type === 'DEX');

  const formatPrice = (price: number) => {
    if (price > 1) {
      return price.toFixed(2);
    } else if (price > 0.01) {
      return price.toFixed(4);
    }
    return price.toFixed(8);
  };

  const formatUSD = (value: number) => {
    if (value >= 1e12) return `$${(value / 1e12).toFixed(2)}T`;
    if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
    if (value >= 1e6) return `$${(value / 1e6).toFixed(2)}M`;
    if (value >= 1e3) return `$${(value / 1e3).toFixed(2)}K`;
    return `$${value.toFixed(2)}`;
  };

  return (
    <div className="border border-gray-700 rounded-lg bg-gray-800 bg-opacity-50">
      {/* Header */}
      <div
        className="p-4 flex items-center justify-between cursor-pointer hover:bg-gray-700 hover:bg-opacity-30 transition-colors"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex items-center gap-2">
          <span className={`transition-transform ${isOpen ? 'rotate-90' : ''}`}>
            ▶
          </span>
          <Search className="w-5 h-5 text-blue-400" />
          <h3 className="text-lg font-semibold">MARKET EXPLORER</h3>
          {marketData && (
            <span className="text-xs text-gray-400 ml-2">
              {marketData.pair}
            </span>
          )}
        </div>
        <div className="text-xs text-gray-400">
          {sources.length > 0 ? `${sources.length} sources` : 'Ready to search'}
        </div>
      </div>

      {/* Content */}
      {isOpen && (
        <div className="border-t border-gray-700 p-4 space-y-4">
          {/* Search Bar */}
          <div className="space-y-2">
            <label className="text-sm text-gray-300">Search Trading Pair</label>
            <div className="relative">
              <input
                type="text"
                placeholder="e.g., BTC/USDT, ETH/USDC..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    handleSearch(searchInput);
                  }
                }}
                className="w-full bg-gray-900 border border-gray-600 rounded px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
              />
              <button
                onClick={() => handleSearch(searchInput)}
                disabled={loading || !searchInput.trim()}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-blue-400 hover:text-blue-300 disabled:text-gray-500"
              >
                <Search className="w-4 h-4" />
              </button>
            </div>

            {/* Recent Searches */}
            {recentSearches.length > 0 && !marketData && (
              <div className="flex flex-wrap gap-2">
                <span className="text-xs text-gray-400">Recent:</span>
                {recentSearches.map(pair => (
                  <button
                    key={pair}
                    onClick={() => {
                      setSearchInput(pair);
                      handleSearch(pair);
                    }}
                    className="text-xs px-2 py-1 bg-gray-700 text-gray-300 rounded hover:bg-gray-600 transition-colors"
                  >
                    {pair}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Error Display */}
          {error && (
            <div className="p-3 bg-red-900 bg-opacity-30 border border-red-700 rounded text-sm text-red-300">
              {error}
            </div>
          )}

          {/* Loading State */}
          {loading && (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin w-6 h-6 border-2 border-blue-400 border-t-transparent rounded-full"></div>
              <span className="ml-2 text-gray-300">Fetching market data...</span>
            </div>
          )}

          {/* Market Data Display */}
          {marketData && !loading && (
            <>
              {/* Filters */}
              <div className="flex gap-2">
                {filters.map(f => (
                  <button
                    key={f.value}
                    onClick={() => setFilter(f.value)}
                    className={`flex items-center gap-1 px-3 py-1.5 rounded text-sm transition-colors ${
                      filter === f.value
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    }`}
                  >
                    <span>{f.icon}</span>
                    {f.label}
                  </button>
                ))}
              </div>

              {/* Tabs */}
              <div className="flex gap-2 border-b border-gray-700">
                <button
                  onClick={() => setActiveTab('summary')}
                  className={`px-3 py-2 text-sm font-medium transition-colors ${
                    activeTab === 'summary'
                      ? 'text-blue-400 border-b-2 border-blue-400'
                      : 'text-gray-400 hover:text-gray-300'
                  }`}
                >
                  Summary
                </button>
                <button
                  onClick={handleDetailView}
                  className={`px-3 py-2 text-sm font-medium transition-colors ${
                    activeTab === 'detail'
                      ? 'text-blue-400 border-b-2 border-blue-400'
                      : 'text-gray-400 hover:text-gray-300'
                  }`}
                >
                  All Sources
                </button>
              </div>

              {/* Summary Tab */}
              {activeTab === 'summary' && (
                <div className="space-y-4">
                  {/* Aggregated Price Box */}
                  <div className="p-4 bg-gradient-to-br from-blue-900 to-blue-800 rounded-lg border border-blue-700">
                    <div className="text-sm text-gray-300 mb-2">
                      Weighted Average Price (Across All Sources)
                    </div>
                    <div className="text-3xl font-bold text-white mb-2">
                      {formatPrice(marketData.weighted_price)}
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs text-gray-300">
                      <div>
                        <div className="text-gray-400">Best Bid</div>
                        <div className="text-green-400">
                          {formatPrice(marketData.best_bid)}
                        </div>
                      </div>
                      <div>
                        <div className="text-gray-400">Best Ask</div>
                        <div className="text-red-400">
                          {formatPrice(marketData.best_ask)}
                        </div>
                      </div>
                      <div>
                        <div className="text-gray-400">Spread</div>
                        <div className="text-yellow-400">
                          {marketData.spread_pct.toFixed(3)}%
                        </div>
                      </div>
                      <div>
                        <div className="text-gray-400">Sources</div>
                        <div className="text-blue-400">
                          {marketData.source_count}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* CEX vs DEX Comparison */}
                  <div className="grid grid-cols-2 gap-3">
                    {/* CEX Card */}
                    {cexSources.length > 0 && (
                      <div className="p-3 bg-gray-700 bg-opacity-50 rounded border border-gray-600">
                        <div className="text-xs text-gray-400 mb-1">🏢 CEX Average</div>
                        <div className="text-2xl font-bold text-white mb-2">
                          {formatPrice(marketData.cex_price)}
                        </div>
                        <div className="space-y-1 text-xs text-gray-300">
                          <div>
                            Liquidity: <span className="text-blue-400">{formatUSD(marketData.cex_liquidity)}</span>
                          </div>
                          <div>
                            Sources: <span className="text-gray-400">{marketData.cex_count}</span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* DEX Card */}
                    {dexSources.length > 0 && (
                      <div className="p-3 bg-gray-700 bg-opacity-50 rounded border border-gray-600">
                        <div className="text-xs text-gray-400 mb-1">🔄 DEX Average</div>
                        <div className="text-2xl font-bold text-white mb-2">
                          {formatPrice(marketData.dex_price)}
                        </div>
                        <div className="space-y-1 text-xs text-gray-300">
                          <div>
                            Liquidity: <span className="text-purple-400">{formatUSD(marketData.dex_liquidity)}</span>
                          </div>
                          <div>
                            Sources: <span className="text-gray-400">{marketData.dex_count}</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Action Buttons */}
                  <div className="grid grid-cols-2 gap-2">
                    <button className="px-3 py-2 bg-green-600 hover:bg-green-500 text-white rounded text-sm font-medium transition-colors">
                      💰 Trade
                    </button>
                    <button className="px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded text-sm font-medium transition-colors">
                      ⭐ Add to Watch
                    </button>
                  </div>
                </div>
              )}

              {/* Detail Tab */}
              {activeTab === 'detail' && (
                <div className="space-y-3">
                  <div className="text-xs text-gray-400 mb-2">
                    Showing {filteredSources.length} of {sources.length} sources
                  </div>

                  {/* Sources Table */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead className="text-gray-400 border-b border-gray-600">
                        <tr>
                          <th className="text-left py-2 px-2">Exchange</th>
                          <th className="text-right py-2 px-2">Price</th>
                          <th className="text-right py-2 px-2">Liquidity</th>
                          <th className="text-right py-2 px-2">Spread</th>
                          <th className="text-right py-2 px-2">Volume (24h)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredSources
                          .sort((a, b) => b.liquidity_usd - a.liquidity_usd)
                          .map((source, idx) => (
                            <tr
                              key={idx}
                              className="border-b border-gray-700 hover:bg-gray-700 hover:bg-opacity-30 transition-colors"
                            >
                              <td className="py-2 px-2">
                                <div className="font-medium text-white">
                                  {source.exchange}
                                </div>
                                <div className="text-gray-500">
                                  {source.type}
                                </div>
                              </td>
                              <td className="text-right py-2 px-2 text-white font-medium">
                                {formatPrice(source.price)}
                              </td>
                              <td className="text-right py-2 px-2">
                                <span className={source.type === 'CEX' ? 'text-blue-400' : 'text-purple-400'}>
                                  {formatUSD(source.liquidity_usd)}
                                </span>
                              </td>
                              <td className="text-right py-2 px-2">
                                <span className={
                                  source.spread_pct > 0.5
                                    ? 'text-red-400'
                                    : source.spread_pct > 0.1
                                    ? 'text-yellow-400'
                                    : 'text-green-400'
                                }>
                                  {source.spread_pct.toFixed(3)}%
                                </span>
                              </td>
                              <td className="text-right py-2 px-2 text-gray-400">
                                {formatUSD(source.volume_24h_usd)}
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>

                  {filteredSources.length === 0 && (
                    <div className="text-center py-4 text-gray-400">
                      No {filter !== 'all' ? filter.toUpperCase() : ''} sources available
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {!marketData && !loading && !error && (
            <div className="text-center py-8 text-gray-400">
              Search for a trading pair to get started
            </div>
          )}
        </div>
      )}
    </div>
  );
};
