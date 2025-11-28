/**
 * Contribution Analytics Tab - Connected to Real API
 * 
 * Displays member contribution metrics and rankings
 * - Member contribution trends from /api/analyzer/contributions/:daoId
 * - Real-time contribution updates via WebSocket
 * - Member rankings by weighted score
 * - Tier distribution
 */

import React, { useState, useMemo, useContext } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  AreaChart,
  Area,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import {
  TrendingUp,
  TrendingDown,
  Users,
  Activity,
  RefreshCw,
  AlertTriangle,
  Check,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { useContributionAnalytics } from '@/hooks/useContributionAnalytics';
import { RealtimeMetricsContext } from '@/components/analytics/RealtimeMetricsProvider';

// ============================================================================
// TYPES & CONSTANTS
// ============================================================================

const TIER_CONFIG = {
  founder: {
    label: 'Founder',
    color: 'bg-yellow-100 text-yellow-800',
    icon: '👑',
    borderColor: 'border-yellow-300',
  },
  elder: {
    label: 'Elder',
    color: 'bg-slate-100 text-slate-800',
    icon: '⭐',
    borderColor: 'border-slate-300',
  },
  champion: {
    label: 'Champion',
    color: 'bg-orange-100 text-orange-800',
    icon: '🏆',
    borderColor: 'border-orange-300',
  },
  contributor: {
    label: 'Contributor',
    color: 'bg-blue-100 text-blue-800',
    icon: '📝',
    borderColor: 'border-blue-300',
  },
  participant: {
    label: 'Participant',
    color: 'bg-gray-100 text-gray-800',
    icon: '👤',
    borderColor: 'border-gray-300',
  },
};

const COLORS = ['#3B82F6', '#8B5CF6', '#14B8A6', '#F59E0B', '#EF4444'];

// ============================================================================
// UTILS
// ============================================================================

const formatNumber = (value: number) => {
  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
  return value.toFixed(0);
};

const formatPercent = (value: number) => `${value.toFixed(1)}%`;

// ============================================================================
// COMPONENT
// ============================================================================

interface ContributionAnalyticsTabProps {
  daoId: string;
  timeRange?: '7d' | '30d' | '90d' | '1y' | 'all';
  onTimeRangeChange?: (range: '7d' | '30d' | '90d' | '1y' | 'all') => void;
}

export const ContributionAnalyticsTab: React.FC<ContributionAnalyticsTabProps> = ({
  daoId,
  timeRange = '90d',
  onTimeRangeChange,
}) => {
  const context = useContext(RealtimeMetricsContext);
  const apiBaseUrl = context?.apiBaseUrl || process.env.VITE_API_URL || 'http://localhost:3001';

  const [selectedTimeRange, setSelectedTimeRange] = useState<'7d' | '30d' | '90d' | '1y' | 'all'>(timeRange);
  const [sortBy, setSortBy] = useState<'score' | 'contributions' | 'votes' | 'proposals'>('score');
  const [selectedTier, setSelectedTier] = useState<string>('all');

  const {
    members,
    summary,
    trends,
    distribution,
    isLoading,
    isError,
    error,
    isConnected,
    refresh,
    lastUpdated,
  } = useContributionAnalytics({
    daoId,
    timeframe: selectedTimeRange,
    apiBaseUrl,
  });

  const handleTimeRangeChange = (range: typeof selectedTimeRange) => {
    setSelectedTimeRange(range);
    onTimeRangeChange?.(range);
  };

  // Filter and sort members
  const filteredAndSorted = useMemo(() => {
    let filtered = [...members];

    // Filter by tier
    if (selectedTier !== 'all') {
      filtered = filtered.filter((m) => m.tier === selectedTier);
    }

    // Sort
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'contributions':
          return b.contributions - a.contributions;
        case 'votes':
          return b.votes - a.votes;
        case 'proposals':
          return b.proposals - a.proposals;
        case 'score':
        default:
          return b.weightedScore - a.weightedScore;
      }
    });

    return filtered;
  }, [members, sortBy, selectedTier]);

  // Process trend data
  const trendChartData = useMemo(() => {
    if (!trends) return [];
    return trends.map((trend) => ({
      date: trend.date,
      total: trend.totalContributions || 0,
      founder: trend.byTier?.founder || 0,
      elder: trend.byTier?.elder || 0,
      champion: trend.byTier?.champion || 0,
      contributor: trend.byTier?.contributor || 0,
      participant: trend.byTier?.participant || 0,
    }));
  }, [trends]);

  // Process distribution data
  const distributionChartData = useMemo(() => {
    if (!distribution) return [];
    return distribution.map((d) => ({
      name: d.tier,
      value: d.percentage || 0,
    }));
  }, [distribution]);

  // Top 10 contributors for bar chart
  const top10Data = useMemo(() => {
    return filteredAndSorted.slice(0, 10).map((member) => ({
      name: member.name,
      score: member.weightedScore,
      contributions: member.contributions,
    }));
  }, [filteredAndSorted]);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-96">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-gray-600">Loading contribution analytics...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (isError) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          Failed to load contributions: {error instanceof Error ? error.message : 'Unknown error'}
        </AlertDescription>
      </Alert>
    );
  }

  if (!summary || !members) {
    return (
      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>No contribution data available</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Contribution Analytics</h2>
          <p className="text-sm text-gray-600 mt-1">
            Member participation and contribution metrics
            <span className="ml-2">
              {isConnected ? (
                <Badge className="bg-green-100 text-green-800">
                  <Wifi className="w-3 h-3 mr-1 inline" />
                  Live
                </Badge>
              ) : (
                <Badge className="bg-gray-100 text-gray-800">
                  <WifiOff className="w-3 h-3 mr-1 inline" />
                  Polling
                </Badge>
              )}
            </span>
          </p>
        </div>

        <Button variant="outline" size="sm" onClick={refresh}>
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Time Range Selector */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-2 flex-wrap">
            {(['7d', '30d', '90d', '1y', 'all'] as const).map((range) => (
              <Button
                key={range}
                variant={selectedTimeRange === range ? 'default' : 'outline'}
                size="sm"
                onClick={() => handleTimeRangeChange(range)}
              >
                {range === '7d' ? '7 Days' : range === '30d' ? '30 Days' : range === '90d' ? '90 Days' : range === '1y' ? '1 Year' : 'All Time'}
              </Button>
            ))}
          </div>
          {lastUpdated && (
            <p className="text-xs text-gray-500 mt-3">
              Last updated: {new Date(lastUpdated).toLocaleTimeString()}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
              <Users className="w-4 h-4" />
              Total Contributors
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-600">{summary.totalContributors}</div>
            {summary.newMembers > 0 && (
              <p className="text-xs text-gray-500 mt-2">
                +{summary.newMembers} new this period
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
              <Activity className="w-4 h-4" />
              Total Contributions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-purple-600">
              {formatNumber(summary.totalContributions)}
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Avg: {summary.averagePerMember.toFixed(1)}/member
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">Participation Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">
              {formatPercent(summary.participationRate)}
            </div>
            <p className="text-xs text-gray-500 mt-2">Of active members</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">New Members</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-orange-600">{summary.newMembers}</div>
            {summary.churnedMembers > 0 && (
              <p className="text-xs text-red-600 mt-2">
                -{summary.churnedMembers} churned
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Contribution Trends */}
        <Card>
          <CardHeader>
            <CardTitle>Contribution Trends</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={trendChartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Area type="monotone" dataKey="founder" stackId="1" stroke={COLORS[0]} fill={COLORS[0]} />
                <Area type="monotone" dataKey="elder" stackId="1" stroke={COLORS[1]} fill={COLORS[1]} />
                <Area type="monotone" dataKey="champion" stackId="1" stroke={COLORS[2]} fill={COLORS[2]} />
                <Area type="monotone" dataKey="contributor" stackId="1" stroke={COLORS[3]} fill={COLORS[3]} />
                <Area type="monotone" dataKey="participant" stackId="1" stroke={COLORS[4]} fill={COLORS[4]} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Member Growth */}
        <Card>
          <CardHeader>
            <CardTitle>Member Growth Over Time</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={trendChartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="founder" stroke={COLORS[0]} strokeWidth={2} />
                <Line type="monotone" dataKey="elder" stroke={COLORS[1]} strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Tier Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Member Tier Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={distributionChartData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, value }) => `${name} ${value.toFixed(1)}%`}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {distributionChartData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: any) => `${value.toFixed(1)}%`} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Top Contributors */}
        <Card>
          <CardHeader>
            <CardTitle>Top 10 Contributors</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart
                data={top10Data}
                layout="vertical"
                margin={{ top: 5, right: 30, left: 200, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <Tooltip formatter={(value: any) => formatNumber(value)} />
                <Bar dataKey="score" fill={COLORS[0]} name="Weighted Score" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Member Rankings Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Member Rankings</span>
            <div className="flex gap-2">
              <select
                value={selectedTier}
                onChange={(e) => setSelectedTier(e.target.value)}
                className="text-sm px-3 py-1 border rounded"
              >
                <option value="all">All Tiers</option>
                <option value="founder">Founder</option>
                <option value="elder">Elder</option>
                <option value="champion">Champion</option>
                <option value="contributor">Contributor</option>
                <option value="participant">Participant</option>
              </select>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="text-sm px-3 py-1 border rounded"
              >
                <option value="score">Score</option>
                <option value="contributions">Contributions</option>
                <option value="votes">Votes</option>
                <option value="proposals">Proposals</option>
              </select>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b">
                <tr>
                  <th className="text-left p-3">Rank</th>
                  <th className="text-left p-3">Member</th>
                  <th className="text-left p-3">Tier</th>
                  <th className="text-right p-3">Score</th>
                  <th className="text-right p-3">Contributions</th>
                  <th className="text-right p-3">Votes</th>
                  <th className="text-right p-3">Proposals</th>
                  <th className="text-right p-3">Participation</th>
                  <th className="text-left p-3">Last Active</th>
                </tr>
              </thead>
              <tbody>
                {filteredAndSorted.slice(0, 20).map((member, index) => {
                  const tierConfig = TIER_CONFIG[member.tier];
                  const lastActive = new Date(member.lastActive);
                  const now = new Date();
                  const diffHours = (now.getTime() - lastActive.getTime()) / (1000 * 60 * 60);
                  const lastActiveStr =
                    diffHours < 1
                      ? 'Now'
                      : diffHours < 24
                      ? `${Math.floor(diffHours)}h ago`
                      : `${Math.floor(diffHours / 24)}d ago`;

                  return (
                    <tr key={member.userId} className="border-b hover:bg-gray-50">
                      <td className="p-3 font-semibold">#{index + 1}</td>
                      <td className="p-3 flex items-center gap-2">
                        {member.name}
                        {member.verified && (
                          <Check className="w-4 h-4 text-blue-600" title="Verified" />
                        )}
                      </td>
                      <td className="p-3">
                        <Badge className={tierConfig.color}>
                          {tierConfig.icon} {tierConfig.label}
                        </Badge>
                      </td>
                      <td className="p-3 text-right font-semibold">{formatNumber(member.weightedScore)}</td>
                      <td className="p-3 text-right">{member.contributions}</td>
                      <td className="p-3 text-right">{member.votes}</td>
                      <td className="p-3 text-right">{member.proposals}</td>
                      <td className="p-3 text-right">{formatPercent(member.participationRate)}</td>
                      <td className="p-3">{lastActiveStr}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {filteredAndSorted.length === 0 && (
              <p className="text-center py-6 text-gray-500">No members found</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ContributionAnalyticsTab;
