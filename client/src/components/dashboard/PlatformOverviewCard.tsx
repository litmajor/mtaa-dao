import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface PlatformMetrics {
  tvl: number;
  assetCount: number;
  daoCount: number;
  memberCount: number;
  healthScores: {
    overall: number;
    treasury: number;
    governance: number;
    community: number;
    system: number;
  };
}

interface PlatformOverviewCardProps {
  data?: PlatformMetrics;
  loading?: boolean;
  lastUpdated?: Date;
}

export function PlatformOverviewCard({ data, loading, lastUpdated }: PlatformOverviewCardProps) {
  if (loading || !data) {
    return (
      <Card className="bg-slate-800 border-slate-700">
        <CardHeader>
          <CardTitle>Platform Overview</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-12 bg-slate-700" />
          <Skeleton className="h-8 bg-slate-700" />
        </CardContent>
      </Card>
    );
  }

  const formatCurrency = (num: number) => {
    if (num >= 1e6) return `$${(num / 1e6).toFixed(2)}M`;
    if (num >= 1e3) return `$${(num / 1e3).toFixed(2)}K`;
    return `$${num.toFixed(2)}`;
  };

  const getHealthColor = (score: number) => {
    if (score >= 80) return 'bg-emerald-500';
    if (score >= 60) return 'bg-amber-500';
    return 'bg-red-500';
  };

  const getHealthText = (score: number) => {
    if (score >= 80) return 'text-emerald-400';
    if (score >= 60) return 'text-amber-400';
    return 'text-red-400';
  };

  return (
    <Card className="bg-gradient-to-r from-slate-800 to-slate-800/50 border-slate-700">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-2xl">🌍 Platform Overview</CardTitle>
          <span className="text-xs text-slate-400">Updated {lastUpdated?.toLocaleTimeString() || 'now'}</span>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-slate-700/50 p-4 rounded-lg">
            <p className="text-slate-400 text-sm mb-1">Total TVL</p>
            <p className="text-2xl font-bold text-white">{formatCurrency(data.tvl)}</p>
            <p className="text-xs text-emerald-400 mt-1">↑ 5.2%</p>
          </div>
          <div className="bg-slate-700/50 p-4 rounded-lg">
            <p className="text-slate-400 text-sm mb-1">Total Assets</p>
            <p className="text-2xl font-bold text-white">{data.assetCount.toLocaleString()}</p>
            <p className="text-xs text-emerald-400 mt-1">↑ 320 this week</p>
          </div>
          <div className="bg-slate-700/50 p-4 rounded-lg">
            <p className="text-slate-400 text-sm mb-1">Active DAOs</p>
            <p className="text-2xl font-bold text-white">{data.daoCount}</p>
            <p className="text-xs text-slate-500 mt-1">Stable</p>
          </div>
          <div className="bg-slate-700/50 p-4 rounded-lg">
            <p className="text-slate-400 text-sm mb-1">Total Members</p>
            <p className="text-2xl font-bold text-white">{data.memberCount}</p>
            <p className="text-xs text-emerald-400 mt-1">↑ 12 new today</p>
          </div>
        </div>

        {/* Health Scores */}
        <div className="bg-slate-700/50 p-4 rounded-lg space-y-3">
          <p className="text-sm font-semibold text-white mb-3">Platform Health Scores</p>
          <div className="space-y-2">
            {Object.entries(data.healthScores).map(([key, score]) => (
              <div key={key} className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-slate-300 capitalize">{key}</span>
                    <span className={`font-bold ${getHealthText(score)}`}>{score}/100</span>
                  </div>
                  <div className="w-full bg-slate-600 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full transition-all ${getHealthColor(score)}`}
                      style={{ width: `${score}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Summary */}
        <div className="bg-gradient-to-r from-blue-900/30 to-blue-800/30 p-3 rounded-lg border border-blue-700/50">
          <p className="text-sm text-blue-100">
            ✨ Platform Status: <span className="font-semibold">Healthy</span> - All metrics within optimal ranges
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

export default PlatformOverviewCard;
