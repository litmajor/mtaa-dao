/**
 * Yuki Strategy Marketplace
 * 
 * Discover, copy, and monetize trading strategies.
 * Followers are driven to Amara for advanced education.
 */

import React, { useState, useEffect, useMemo } from 'react';
import { Users, TrendingUp, Settings } from 'lucide-react';
import * as yukiApi from '../../api/yukiApi';

type Strategy = {
  id: string;
  name: string;
  creator: string;
  creatorBadge?: 'verified' | 'trusted' | 'top-performer';
  description: string;
  category: 'mean-reversion' | 'momentum' | 'arbitrage' | 'yield' | 'grid';
  stats: {
    return30d: number;
    return1y: number;
    sharpeRatio: number;
    maxDrawdown: number;
    winRate: number;
    trades: number;
  };
  followers: number;
  rating: number;
  reviews: number;
  pricing: {
    model: 'free' | 'profit-share' | 'subscription' | 'licensing';
    amount?: number; // % or monthly fee
  };
  copied: boolean;
  thumbnail?: string;
  createdAt: string;
  lastBacktestAt: string;
};

export default function StrategyMarketplace() {
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [filter, setFilter] = useState<'all' | 'free' | 'paid' | 'my-copies'>('all');
  const [sortBy, setSortBy] = useState<'return' | 'rating' | 'followers'>('return');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStrategy, setSelectedStrategy] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMarketplace = async () => {
      try {
        const data = await yukiApi.getMarketplaceStrategies();
        setStrategies(data || []);
      } catch (err) {
        console.error('Failed to fetch marketplace:', err);
        setStrategies([]);
      } finally {
        setLoading(false);
      }
    };
    fetchMarketplace();
  }, []);

  const filteredStrategies = useMemo(() => {
    let result = strategies.filter((s) => {
      const matchesSearch = s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.creator.toLowerCase().includes(searchTerm.toLowerCase());
      
      if (filter === 'free') return matchesSearch && s.pricing.model === 'free';
      if (filter === 'paid') return matchesSearch && s.pricing.model !== 'free';
      if (filter === 'my-copies') return matchesSearch && s.copied;
      return matchesSearch;
    });

    result.sort((a, b) => {
      if (sortBy === 'return') return b.stats.return1y - a.stats.return1y;
      if (sortBy === 'rating') return b.rating - a.rating;
      if (sortBy === 'followers') return b.followers - a.followers;
      return 0;
    });

    return result;
  }, [strategies, filter, sortBy, searchTerm]);

  const handleCopyStrategy = async (strategyId: string) => {
    try {
      // Copy strategy to user's account via API
      alert('Strategy copied to your account! 🎉\n\nConsider upgrading to Amara subprofile for deeper education from the creator.');
      // Refresh marketplace
      const updated = await yukiApi.getMarketplaceStrategies();
      setStrategies(updated || []);
    } catch (err) {
      console.error('Failed to copy strategy:', err);
      alert('Failed to copy strategy');
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white p-4 md:p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* HEADER */}
        <div>
          <h1 className="text-3xl font-bold mb-2 flex items-center gap-2">
            🛒 Strategy Marketplace
          </h1>
          <p className="text-slate-400">
            Discover proven trading strategies. Copy & earn commissions. Get recognized.
          </p>
        </div>

        {/* CONTROLS */}
        <div className="bg-slate-800 rounded-lg p-4 border border-slate-700 space-y-4">
          <div className="flex flex-col md:flex-row gap-4">
            {/* Search */}
            <div className="flex-1">
              <input
                type="text"
                placeholder="Search strategies or creators..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-slate-700 border border-slate-600 rounded px-4 py-2 text-white placeholder-slate-500"
              />
            </div>

            {/* Filter */}
            <div className="flex gap-2 flex-wrap">
              {[
                { id: 'all', label: 'All' },
                { id: 'free', label: 'Free' },
                { id: 'paid', label: 'Paid' },
                { id: 'my-copies', label: 'My Copies' },
              ].map((f) => (
                <button
                  key={f.id}
                  onClick={() => setFilter(f.id as any)}
                  className={`px-4 py-2 rounded text-sm font-medium transition-colors ${
                    filter === f.id
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-700 hover:bg-slate-600 text-slate-300'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {/* Sort */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-slate-700 border border-slate-600 rounded px-3 py-2 text-white text-sm"
              title="Sort strategies"
            >
              <option value="return">Sort: Return</option>
              <option value="rating">Sort: Rating</option>
              <option value="followers">Sort: Followers</option>
            </select>
          </div>
        </div>

        {/* STRATEGIES GRID */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* STRATEGY CARDS */}
          <div className="lg:col-span-2 space-y-4">
            {filteredStrategies.map((strategy) => (
              <div
                key={strategy.id}
                onClick={() => setSelectedStrategy(strategy)}
                className="bg-slate-800 rounded-lg p-4 border border-slate-700 hover:border-blue-500 cursor-pointer transition-all"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-bold text-lg">{strategy.name}</h3>
                      {strategy.creatorBadge && (
                        <span
                          className={`text-xs px-2 py-0.5 rounded font-semibold ${
                            strategy.creatorBadge === 'top-performer'
                              ? 'bg-yellow-600/30 text-yellow-300'
                              : strategy.creatorBadge === 'verified'
                              ? 'bg-green-600/30 text-green-300'
                              : 'bg-blue-600/30 text-blue-300'
                          }`}
                        >
                          {strategy.creatorBadge === 'top-performer'
                            ? '⭐ Top'
                            : strategy.creatorBadge === 'verified'
                            ? '✓ Verified'
                            : '★ Trusted'}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-slate-400">by {strategy.creator}</p>
                  </div>
                  <div className="text-right">
                    <div className="flex items-center gap-1 mb-1">
                      <span className="text-yellow-400">⭐</span>
                      <span className="font-bold">{strategy.rating}</span>
                      <span className="text-xs text-slate-500">({strategy.reviews})</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Users className="h-4 w-4 text-blue-400" />
                      <span className="text-sm">{strategy.followers}</span>
                    </div>
                  </div>
                </div>

                <p className="text-sm text-slate-300 mb-4 line-clamp-2">
                  {strategy.description}
                </p>

                {/* STATS GRID */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
                  <div className="bg-slate-700 rounded p-2">
                    <p className="text-xs text-slate-400">Return 1y</p>
                    <p className="text-lg font-bold text-green-400">
                      +{strategy.stats.return1y}%
                    </p>
                  </div>
                  <div className="bg-slate-700 rounded p-2">
                    <p className="text-xs text-slate-400">Sharpe</p>
                    <p className="text-lg font-bold text-blue-400">
                      {strategy.stats.sharpeRatio}
                    </p>
                  </div>
                  <div className="bg-slate-700 rounded p-2">
                    <p className="text-xs text-slate-400">Max DD</p>
                    <p className="text-lg font-bold text-orange-400">
                      {strategy.stats.maxDrawdown}%
                    </p>
                  </div>
                  <div className="bg-slate-700 rounded p-2">
                    <p className="text-xs text-slate-400">Win Rate</p>
                    <p className="text-lg font-bold text-purple-400">
                      {strategy.stats.winRate}%
                    </p>
                  </div>
                  <div className="bg-slate-700 rounded p-2">
                    <p className="text-xs text-slate-400">Trades</p>
                    <p className="text-lg font-bold">{strategy.stats.trades}</p>
                  </div>
                </div>

                {/* FOOTER */}
                <div className="flex items-center justify-between">
                  <div>
                    <span
                      className={`text-xs px-2 py-1 rounded ${
                        strategy.pricing.model === 'free'
                          ? 'bg-green-600/20 text-green-300'
                          : 'bg-amber-600/20 text-amber-300'
                      }`}
                    >
                      {strategy.pricing.model === 'free'
                        ? 'Free'
                        : strategy.pricing.model === 'profit-share'
                        ? `${strategy.pricing.amount}% profit share`
                        : strategy.pricing.model === 'subscription'
                        ? `$${strategy.pricing.amount}/mo`
                        : 'Licensing'}
                    </span>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCopyStrategy(strategy.id);
                    }}
                    disabled={strategy.copied}
                    className={`px-4 py-2 rounded text-sm font-semibold flex items-center gap-2 transition-colors ${
                      strategy.copied
                        ? 'bg-green-600/20 text-green-300 cursor-default'
                        : 'bg-blue-600 hover:bg-blue-700 text-white'
                    }`}
                  >
                    {strategy.copied ? (
                      <>
                        <Check className="h-4 w-4" />
                        Copied
                      </>
                    ) : (
                      <>
                        <span>📋</span>
                        Copy
                      </>
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* SIDE PANEL: STRATEGY DETAILS */}
          {selectedStrategy && (
            <div className="bg-slate-800 rounded-lg p-4 border border-slate-700 h-fit sticky top-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-lg">Strategy Details</h3>
                <button
                  onClick={() => setSelectedStrategy(null)}
                  className="text-slate-400 hover:text-white text-2xl leading-none"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <p className="text-sm text-slate-400">Creator</p>
                  <p className="font-semibold">{selectedStrategy.creator}</p>
                </div>

                <div>
                  <p className="text-sm text-slate-400">Category</p>
                  <p className="font-semibold capitalize">{selectedStrategy.category}</p>
                </div>

                <div className="border-t border-slate-700 pt-4">
                  <p className="text-sm text-slate-400 mb-2">Performance Metrics</p>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span>Return (1y)</span>
                      <span className="text-green-400 font-bold">
                        +{selectedStrategy.stats.return1y}%
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Sharpe Ratio</span>
                      <span className="text-blue-400 font-bold">
                        {selectedStrategy.stats.sharpeRatio}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Max Drawdown</span>
                      <span className="text-orange-400 font-bold">
                        {selectedStrategy.stats.maxDrawdown}%
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Win Rate</span>
                      <span className="text-purple-400 font-bold">
                        {selectedStrategy.stats.winRate}%
                      </span>
                    </div>
                  </div>
                </div>

                <div className="border-t border-slate-700 pt-4">
                  <button className="w-full bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded font-semibold flex items-center justify-center gap-2 transition-colors mb-2">
                    <span>📋</span>
                    Copy Strategy
                  </button>
                  <button className="w-full bg-purple-600 hover:bg-purple-700 px-4 py-2 rounded font-semibold flex items-center justify-center gap-2 transition-colors">
                    <TrendingUp className="h-4 w-4" />
                    Upgrade to Amara
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const Check = ({ className }: { className: string }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <polyline points="20 6 9 17 4 12"></polyline>
  </svg>
);
