/**
 * Opportunity Scanner Dashboard Component
 * 
 * Real-time display of arbitrage and DEX opportunities
 */

import React, { useState, useEffect } from 'react';
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
  const [sortBy, setSortBy] = useState<'profit' | 'confidence' | 'volume'>('profit');

  const filtered = useFilteredOpportunities(opportunities, {
    type: selectedType === 'all' ? undefined : selectedType,
    minProfit: filterMinProfit,
  });

  const sorted = [...filtered].sort((a: OpportunityData, b: OpportunityData) => {
    if (sortBy === 'profit') return b.profitPercent - a.profitPercent;
    if (sortBy === 'confidence') return b.confidence - a.confidence;
    if (sortBy === 'volume') return b.volume - a.volume;
    return 0;
  });

  const handleFilterChange = (profit: number) => {
    setFilterMinProfit(profit);
    setFilter(profit);
  };

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
                onChange={(e) => handleFilterChange(parseFloat(e.target.value))}
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
                <option value="profit">Profit %</option>
                <option value="confidence">Confidence</option>
                <option value="volume">Volume</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Opportunities List */}
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
        ) : (
          sorted.length === 0 ? null : sorted.map((opp: OpportunityData) => (
            <Card
              key={opp.id}
              className="hover:shadow-lg transition-shadow cursor-pointer"
            >
              <CardContent className="pt-6">
                <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                  {/* Symbol & Type */}
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Symbol</p>
                    <div className="flex items-center gap-2 mt-1">
                      <p className="font-bold text-lg text-gray-900 dark:text-white">
                        {opp.symbol}
                      </p>
                      <Badge className={getTypeColor(opp.type)}>
                        {opp.type.replace('-', ' ')}
                      </Badge>
                    </div>
                  </div>

                  {/* Venues */}
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Venues</p>
                    <div className="mt-1 space-y-1">
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        {opp.venue1} → {opp.venue2}
                      </p>
                      <p className="text-xs text-gray-600 dark:text-gray-400">
                        ${opp.price1.toFixed(4)} → ${opp.price2.toFixed(4)}
                      </p>
                    </div>
                  </div>

                  {/* Profit */}
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Profit</p>
                    <div className="mt-1">
                      <p className="font-bold text-lg text-green-600">
                        {opp.profitPercent.toFixed(2)}%
                      </p>
                      {opp.profitAmount && (
                        <p className="text-xs text-gray-600 dark:text-gray-400">
                          ${opp.profitAmount.toFixed(2)}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Metrics */}
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <p className="text-xs text-gray-600 dark:text-gray-400">Risk</p>
                      <Badge className={getRiskColor(opp.risk)}>
                        {opp.risk}
                      </Badge>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600 dark:text-gray-400">Confidence</p>
                      <p className="font-bold text-gray-900 dark:text-white">
                        {opp.confidence}%
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600 dark:text-gray-400">Volume</p>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        {(opp.volume / 1000000).toFixed(1)}M
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600 dark:text-gray-400">Updated</p>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        {Math.round((Date.now() - opp.timestamp) / 1000)}s ago
                      </p>
                    </div>
                  </div>

                  {/* Action */}
                  <div className="flex flex-col justify-between">
                    {opp.executionRecommendation && (
                      <Button
                        className="w-full"
                        variant={
                          opp.executionRecommendation.venue === 'dex'
                            ? 'default'
                            : 'outline'
                        }
                      >
                        Execute on{' '}
                        {opp.executionRecommendation.venue === 'dex'
                          ? opp.executionRecommendation.dex
                          : opp.executionRecommendation.exchange}
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Stats Footer */}
      {opportunities.length > 0 && (
        <Card className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 border-blue-200 dark:border-blue-800">
          <CardContent className="pt-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Avg Profit</p>
                <p className="text-2xl font-bold text-green-600">
                  {(sorted.reduce((sum: number, o: OpportunityData) => sum + o.profitPercent, 0) / sorted.length).toFixed(2)}%
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Highest Profit</p>
                <p className="text-2xl font-bold text-green-600">
                  {Math.max(...sorted.map((o: OpportunityData) => o.profitPercent)).toFixed(2)}%
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Avg Confidence</p>
                <p className="text-2xl font-bold text-blue-600">
                  {(sorted.reduce((sum: number, o: OpportunityData) => sum + o.confidence, 0) / sorted.length).toFixed(0)}%
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Total Volume</p>
                <p className="text-2xl font-bold text-purple-600">
                  ${(sorted.reduce((sum: number, o: OpportunityData) => sum + o.volume, 0) / 1000000).toFixed(1)}M
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default OpportunityScannerDashboard;
