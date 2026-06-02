/**
 * Opportunity Scanner Dashboard Component
 * 
 * Real-time display of arbitrage and DEX opportunities
 */

import React, { useState, useEffect, useMemo, useCallback, useRef, useLayoutEffect } from 'react';
import OpportunityCard from './OpportunityCard';
const [/* placeholder for lint */] = [] as any; // keep TS happy when using dynamic import below
import { useOpportunityStream, useFilteredOpportunities } from '@/hooks/useOpportunityStream';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface OpportunityData {
  id: string;
  type: 'arbitrage' | 'dex-spread' | 'emerging-token';
  symbol: string;
  chain?: string;
  profitPercent: number;
  profitAmount?: number;
  venue1: string;
  venue2: string;
  price1: number;
  price2: number;
  volume: number;
  risk: 'low' | 'medium' | 'high';
  timestamp: number;
  confidence: number;
  executionRecommendation?: {
    venue: 'dex' | 'cex';
    dex?: string;
    exchange?: string;
    estimatedOutput: number;
  };
}

export const OpportunityScannerDashboard: React.FC = () => {
  const {
    opportunities,
    connected,
    clientId,
    error,
    status,
    setFilter,
    subscribe,
  } = useOpportunityStream({
    minProfitPercent: 0.5,
    subscribeToTypes: ['arbitrage', 'dex-spread', 'emerging-token'],
    enabled: true,
  });

  const [filterMinProfit, setFilterMinProfit] = useState(0.5);
  const [selectedType, setSelectedType] = useState<'all' | 'arbitrage' | 'dex-spread' | 'emerging-token'>('all');
  const [sortBy, setSortBy] = useState<'profit' | 'confidence' | 'volume' | 'score'>('score');
  const [heatmapView, setHeatmapView] = useState(false);

  const filtered = useFilteredOpportunities(opportunities, {
    type: selectedType === 'all' ? undefined : selectedType,
    minProfit: filterMinProfit,
  });

  // Extended opportunity with computed metrics for sorting and display
  type ExtendedOpportunity = OpportunityData & {
    score: number;
    effectiveProfit: number;
    estimatedSlippage: number;
    netProfit: number;
    ageSeconds: number;
  };

  // Memoize sorting and computed metrics to avoid expensive work on every render
  const sorted: ExtendedOpportunity[] = useMemo(() => {
    const now = Date.now();
    const withMetrics = filtered.map((o) => {
      const ageSeconds = Math.max(0, (now - o.timestamp) / 1000);
      const ageDays = ageSeconds / (60 * 60 * 24);
      const freshnessMultiplier = Math.max(0.1, 1 - ageDays / 7);
      const effectiveProfit = o.profitPercent * freshnessMultiplier;
      // liquidity score normalized to millions (capped)
      const liquidityScore = Math.min(1, o.volume / 1_000_000);
      // simple composite score (weights can be tuned)
      const score = o.profitPercent * 0.5 + o.confidence * 0.3 + liquidityScore * 0.2 * 100;
      // estimated slippage heuristic (smaller for higher volume)
      const estimatedSlippage = Math.max(0.1, 1 - liquidityScore) * 0.5; // percent
      const netProfit = o.profitPercent - estimatedSlippage;
      return { ...o, score, effectiveProfit, estimatedSlippage, netProfit, ageSeconds } as ExtendedOpportunity;
    });

    const copy = withMetrics.slice();
    copy.sort((a, b) => {
      if (sortBy === 'profit') return b.effectiveProfit - a.effectiveProfit;
      if (sortBy === 'confidence') return b.confidence - a.confidence;
      if (sortBy === 'volume') return b.volume - a.volume;
      if (sortBy === 'score') return b.score - a.score;
      return b.score - a.score;
    });
    return copy;
  }, [filtered, sortBy]);

  const handleFilterChange = useCallback((profit: number) => {
    setFilterMinProfit(profit);
    setFilter(profit);
  }, [setFilter]);

  const getRiskColor = (risk: string): string => {
    if (risk === 'low') return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
    if (risk === 'medium') return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
    return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
  };

  const getTypeColor = (type: string): string => {
    if (type === 'arbitrage') return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
    if (type === 'dex-spread') return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200';
    return 'bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200';
  };

  // Memoized stats derived from sorted list
  const stats = useMemo(() => {
    if (!sorted || sorted.length === 0) {
      return {
        avgProfit: 0,
        highestProfit: 0,
        avgConfidence: 0,
        totalVolume: 0,
        topOpportunity: null as ExtendedOpportunity | null,
      };
    }
    const avgProfit = sorted.reduce((s, o) => s + o.profitPercent, 0) / sorted.length;
    const highestProfit = Math.max(...sorted.map((o) => o.profitPercent));
    const avgConfidence = Math.round(sorted.reduce((s, o) => s + o.confidence, 0) / sorted.length);
    const totalVolume = sorted.reduce((s, o) => s + o.volume, 0);
    const topOpportunity = sorted[0];
    return { avgProfit, highestProfit, avgConfidence, totalVolume, topOpportunity };
  }, [sorted]);

  // Chain breakdown (counts per chain) based on filtered results
  const chainBreakdown = useMemo(() => {
    const map: Record<string, number> = {};
    for (const o of filtered) {
      const c = o.chain || 'Unknown';
      map[c] = (map[c] || 0) + 1;
    }
    return map;
  }, [filtered]);

  // Helpers for heatmap coloring
  const maxEffectiveProfit = useMemo(() => Math.max(1, ...sorted.map((s) => s.effectiveProfit)), [sorted]);
  const profitToHsl = (p: number) => {
    const normalized = Math.max(0, Math.min(1, p / maxEffectiveProfit));
    const hue = Math.round(120 * normalized); // 0 (red) -> 120 (green)
    return `hsl(${hue} 70% 60%)`;
  };
  const profitToClass = (p: number) => {
    const n = Math.max(0, Math.min(1, p / maxEffectiveProfit));
    if (n > 0.8) return 'bg-green-600';
    if (n > 0.6) return 'bg-lime-500';
    if (n > 0.4) return 'bg-yellow-400';
    if (n > 0.2) return 'bg-orange-400';
    return 'bg-red-500';
  };

  // Handlers passed to card components (stable references)
  const handleView = useCallback((opp: any) => {
    // placeholder: open detail panel or route
    console.log('View', opp.id);
  }, []);

  const handleExecute = useCallback((opp: any) => {
    // placeholder: trigger execution flow
    console.log('Execute', opp.id);
  }, []);

  // Dynamically import react-window to avoid build-time type mismatches; this lets the app run
  const [ListComp, setListComp] = React.useState<any>(null);
  useEffect(() => {
    let mounted = true;
    import('react-window').then((mod) => {
      if (mounted) setListComp(() => (mod as any)['FixedSizeList'] || (mod as any)['default'] || null);
    }).catch(() => {
      // ignore; module may be missing in some dev flows
    });
    return () => { mounted = false; };
  }, []);

  // Row wrapper applies react-window style object via ref to avoid inline JSX style attribute
  const RowWrapper: React.FC<{ style: React.CSSProperties; children: React.ReactNode; id: string }> = ({ style, children, id }) => {
    const ref = useRef<HTMLDivElement | null>(null);
    useLayoutEffect(() => {
      if (ref.current && style) {
        Object.assign(ref.current.style, style as any);
      }
    }, [style]);
    return (
      <div ref={ref} data-row-id={id}>
        {children}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          🚀 Opportunity Scanner
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-2">
          Real-time arbitrage and DEX opportunities across all chains
        </p>
      </div>

      {/* Connection Status */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className={`w-3 h-3 rounded-full ${
                  connected ? 'bg-green-500 animate-pulse' : 'bg-red-500'
                }`}
              />
              <div>
                <p className="font-semibold text-gray-900 dark:text-white">
                  {connected ? 'Connected' : 'Disconnected'}
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {clientId && `Client: ${clientId.slice(0, 8)}...`}
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="font-bold text-2xl text-gray-900 dark:text-white">
                {opportunities.length}
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Opportunities found
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Error Alert */}
      {error && (
        <Card className="border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-900/20">
          <CardContent className="pt-6 flex gap-3">
            <span className="text-xl text-red-600 flex-shrink-0">⚠️</span>
            <div>
              <p className="font-semibold text-red-900 dark:text-red-200">Error</p>
              <p className="text-sm text-red-800 dark:text-red-300">{error.message}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Filters & Settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-sm font-medium text-gray-900 dark:text-white">
                Minimum Profit %
              </label>
              <Input
                type="number"
                min="0"
                max="100"
                step="0.1"
                value={filterMinProfit}
                onChange={(e) => {
                  const v = parseFloat(e.target.value);
                  handleFilterChange(Number.isNaN(v) ? 0 : v);
                }}
                className="mt-1"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-gray-900 dark:text-white">
                Opportunity Type
              </label>
              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value as any)}
                className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md dark:bg-slate-800 dark:border-slate-700"
                aria-label="Filter by opportunity type"
              >
                <option value="all">All Types</option>
                <option value="arbitrage">Arbitrage Only</option>
                <option value="dex-spread">DEX Spread Only</option>
                <option value="emerging-token">Emerging Tokens Only</option>
              </select>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-900 dark:text-white">
                Sort By
              </label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md dark:bg-slate-800 dark:border-slate-700"
                aria-label="Sort opportunities by"
              >
                <option value="score">Best (composite score)</option>
                <option value="profit">Profit %</option>
                <option value="confidence">Confidence</option>
                <option value="volume">Volume</option>
              </select>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant={heatmapView ? 'default' : 'outline'} size="sm" onClick={() => setHeatmapView((s) => !s)}>
              {heatmapView ? 'List View' : 'Heatmap View'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Opportunities List */}
      {/* Top Opportunity Banner & Chain Breakdown */}
      {stats.topOpportunity && (
        <Card className="border-yellow-200 bg-yellow-50/60">
          <CardContent>
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-3">
                  <div className="text-3xl">🏆</div>
                  <div>
                    <p className="text-sm text-gray-600">Top Opportunity Now</p>
                    <p className="text-2xl font-bold">{stats.topOpportunity.symbol} — {stats.topOpportunity.effectiveProfit.toFixed(2)}%</p>
                    <p className="text-sm text-gray-500">{stats.topOpportunity.confidence}% confidence • {(stats.topOpportunity.volume/1000000).toFixed(1)}M liquidity</p>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Button variant="outline">View</Button>
                {stats.topOpportunity.executionRecommendation && (
                  <Button variant="default">Execute</Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex items-center gap-2 flex-wrap">
        {Object.entries(chainBreakdown).map(([chain, count]) => (
          <Badge key={chain} className="mr-2">{chain}: {count}</Badge>
        ))}
      </div>

      <div className="space-y-3">
        {sorted.length === 0 ? (
          <Card>
            <CardContent className="pt-12 pb-12 text-center">
              <div className="text-6xl mb-4">⚡</div>
              <p className="text-gray-600 dark:text-gray-400">
                No opportunities found matching your filters
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-500 mt-2">
                Try adjusting the minimum profit percentage
              </p>
            </CardContent>
          </Card>
        ) : heatmapView ? (
          <div className="grid grid-cols-6 gap-2">
            {sorted.map((opp) => (
              <div key={opp.id} title={`${opp.symbol} ${opp.effectiveProfit.toFixed(2)}%`} className={`${profitToClass(opp.effectiveProfit)} h-16 rounded-md flex items-center justify-center text-sm text-white font-semibold`}>
                <div className="text-xs text-white/90">{opp.symbol} <span className="block text-xs">{opp.effectiveProfit.toFixed(1)}%</span></div>
              </div>
            ))}
          </div>
        ) : (
          <div>
            {ListComp ? (
              <ListComp
                height={Math.min(800, sorted.length * 140)}
                itemCount={sorted.length}
                itemSize={140}
                width={'100%'}
                itemKey={(index: number) => sorted[index].id}
              >
                {({ index, style }: any) => {
                  const opp = sorted[index];
                  return (
                    <RowWrapper style={style} id={opp.id}>
                      <OpportunityCard opp={opp} onView={handleView} onExecute={handleExecute} getTypeColor={getTypeColor} getRiskColor={getRiskColor} />
                    </RowWrapper>
                  );
                }}
              </ListComp>
            ) : (
              // fallback while react-window loads (or if it's unavailable)
              sorted.map((opp) => (
                <OpportunityCard key={opp.id} opp={opp} onView={handleView} onExecute={handleExecute} getTypeColor={getTypeColor} getRiskColor={getRiskColor} />
              ))
            )}
          </div>
        )}
      </div>

      {/* Stats Footer */}
      {opportunities.length > 0 && (
        <Card className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 border-blue-200 dark:border-blue-800">
          <CardContent className="pt-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Avg Profit</p>
                <p className="text-2xl font-bold text-green-600">{stats.avgProfit.toFixed(2)}%</p>
              </div>
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Highest Profit</p>
                <p className="text-2xl font-bold text-green-600">{stats.highestProfit.toFixed(2)}%</p>
              </div>
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Avg Confidence</p>
                <p className="text-2xl font-bold text-blue-600">{stats.avgConfidence}%</p>
              </div>
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Total Volume</p>
                <p className="text-2xl font-bold text-purple-600">${(stats.totalVolume / 1000000).toFixed(1)}M</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default OpportunityScannerDashboard;
