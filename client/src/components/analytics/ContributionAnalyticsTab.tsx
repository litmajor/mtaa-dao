/**
 * Contribution Analytics Tab
 * 
 * Displays member contribution metrics and participation analytics
 * - Contribution trends
 * - Member rankings
 * - Activity timeline
 * - Weighted scores
 * - Engagement metrics
 */

import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
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
  Download,
  RefreshCw,
  AlertTriangle,
  ArrowUp,
  Clock,
} from 'lucide-react';
import useRealtimeMetrics from '@/hooks/useRealtimeMetrics';
import { Logger } from '@/utils/logger';

const logger = new Logger('ContributionAnalyticsTab');

// ============================================================================
// TYPES
// ============================================================================

interface ContributionAnalyticsTabProps {
  daoId: string;
  timeRange?: '7d' | '30d' | '90d' | '1y' | 'all';
  onTimeRangeChange?: (range: '7d' | '30d' | '90d' | '1y' | 'all') => void;
}

interface ContributionMember {
  userId: string;
  name: string;
  tier: 'founder' | 'elder' | 'champion' | 'contributor' | 'participant';
  contributions: number;
  weightedScore: number;
  votes: number;
  proposals: number;
  participationRate: number;
  lastActive: Date;
  verified: boolean;
  avatar?: string;
}

interface ContributionTrend {
  date: string;
  totalContributions: number;
  contributors: number;
  byTier: {
    founder: number;
    elder: number;
    champion: number;
    contributor: number;
    participant: number;
  };
}

interface ContributionAnalyticsData {
  daoId: string;
  period: { from: Date; to: Date };
  
  summary: {
    totalContributors: number;
    totalContributions: number;
    averagePerMember: number;
    participationRate: number;
    newMembers: number;
    churnedMembers: number;
  };
  
  trends: ContributionTrend[];
  members: ContributionMember[];
  
  distribution: Array<{
    tier: string;
    count: number;
    percentage: number;
  }>;
}

// ============================================================================
// MOCK DATA
// ============================================================================

const generateMockContributionData = (): ContributionAnalyticsData => {
  const now = new Date();

  // Generate trends
  const trends = Array.from({ length: 90 }, (_, i) => {
    const date = new Date(now);
    date.setDate(date.getDate() - (90 - i));
    return {
      date: date.toISOString().split('T')[0],
      totalContributions: Math.floor(Math.random() * 50) + 30,
      contributors: Math.floor(Math.random() * 20) + 10,
      byTier: {
        founder: Math.floor(Math.random() * 5),
        elder: Math.floor(Math.random() * 10),
        champion: Math.floor(Math.random() * 15),
        contributor: Math.floor(Math.random() * 20),
        participant: Math.floor(Math.random() * 15),
      },
    };
  });

  // Generate members
  const tierNames = ['founder', 'elder', 'champion', 'contributor', 'participant'] as const;
  const members = Array.from({ length: 50 }, (_, i) => ({
    userId: `user-${i + 1}`,
    name: `Member ${i + 1}`,
    tier: tierNames[Math.floor(Math.random() * tierNames.length)],
    contributions: Math.floor(Math.random() * 100) + 10,
    weightedScore: Math.floor(Math.random() * 5000) + 500,
    votes: Math.floor(Math.random() * 50),
    proposals: Math.floor(Math.random() * 10),
    participationRate: Math.random() * 100,
    lastActive: new Date(now.getTime() - Math.random() * 30 * 24 * 60 * 60 * 1000),
    verified: Math.random() > 0.3,
  })).sort((a, b) => b.weightedScore - a.weightedScore);

  return {
    daoId: 'dao-001',
    period: {
      from: new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000),
      to: now,
    },
    summary: {
      totalContributors: 42,
      totalContributions: 2850,
      averagePerMember: 67.9,
      participationRate: 78.5,
      newMembers: 8,
      churnedMembers: 2,
    },
    trends,
    members,
    distribution: [
      { tier: 'Founder', count: 3, percentage: 7 },
      { tier: 'Elder', count: 8, percentage: 19 },
      { tier: 'Champion', count: 12, percentage: 29 },
      { tier: 'Contributor', count: 15, percentage: 36 },
      { tier: 'Participant', count: 4, percentage: 10 },
    ],
  };
};

// ============================================================================
// METRIC CARD COMPONENT
// ============================================================================

interface MetricCardProps {
  title: string;
  value: string | number;
  unit?: string;
  change?: number;
  trend?: 'up' | 'down' | 'stable';
  icon?: React.ReactNode;
  color?: string;
  subtext?: string;
}

const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  unit,
  change,
  trend = 'stable',
  icon,
  color = 'blue',
  subtext,
}) => {
  const colorClasses = {
    blue: 'text-blue-600 bg-blue-50',
    green: 'text-green-600 bg-green-50',
    orange: 'text-orange-600 bg-orange-50',
    red: 'text-red-600 bg-red-50',
  };

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <p className="text-sm text-gray-600">{title}</p>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-bold">{value}</span>
              {unit && <span className="text-sm text-gray-500">{unit}</span>}
            </div>
            {subtext && <p className="mt-1 text-xs text-gray-500">{subtext}</p>}
            {change !== undefined && (
              <div className="mt-2 flex items-center gap-1">
                {trend === 'up' && <TrendingUp className="w-4 h-4 text-green-600" />}
                {trend === 'down' && <TrendingDown className="w-4 h-4 text-red-600" />}
                <span
                  className={`text-sm font-medium ${
                    trend === 'up'
                      ? 'text-green-600'
                      : trend === 'down'
                      ? 'text-red-600'
                      : 'text-gray-600'
                  }`}
                >
                  {change > 0 ? '+' : ''}{change.toFixed(1)}%
                </span>
              </div>
            )}
          </div>
          {icon && (
            <div className={`p-3 rounded-lg ${colorClasses[color as keyof typeof colorClasses] || colorClasses.blue}`}>
              {icon}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

// ============================================================================
// TIER BADGE COMPONENT
// ============================================================================

const TierBadge: React.FC<{ tier: string }> = ({ tier }) => {
  const tierConfig = {
    founder: { color: 'bg-yellow-100 text-yellow-800', icon: '👑' },
    elder: { color: 'bg-gray-100 text-gray-800', icon: '⭐' },
    champion: { color: 'bg-orange-100 text-orange-800', icon: '🏆' },
    contributor: { color: 'bg-blue-100 text-blue-800', icon: '📝' },
    participant: { color: 'bg-gray-100 text-gray-700', icon: '👤' },
  };

  const config = tierConfig[tier as keyof typeof tierConfig] || tierConfig.participant;

  return (
    <Badge className={`${config.color} capitalize gap-1`}>
      <span>{config.icon}</span>
      {tier}
    </Badge>
  );
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export const ContributionAnalyticsTab: React.FC<ContributionAnalyticsTabProps> = ({
  daoId,
  timeRange = '90d',
  onTimeRangeChange,
}) => {
  const [selectedTimeRange, setSelectedTimeRange] = useState(timeRange);
  const [sortBy, setSortBy] = useState<'score' | 'contributions' | 'votes' | 'proposals'>('score');
  const channel = `dao:${daoId}:contributions`;

  // Use real-time metrics or fallback to mock data
  const { data, isLoading, error, isConnected, refresh } = useRealtimeMetrics<ContributionAnalyticsData>(
    channel,
    {
      refreshInterval: 45000,
      staleTime: 15000,
    }
  );

  // Fallback to mock data for demonstration
  const analyticsData = data || generateMockContributionData();

  const handleTimeRangeChange = (range: '7d' | '30d' | '90d' | '1y' | 'all') => {
    setSelectedTimeRange(range);
    onTimeRangeChange?.(range);
  };

  // Sort members based on selection
  const sortedMembers = useMemo(() => {
    const sorted = [...analyticsData.members];
    switch (sortBy) {
      case 'contributions':
        return sorted.sort((a, b) => b.contributions - a.contributions);
      case 'votes':
        return sorted.sort((a, b) => b.votes - a.votes);
      case 'proposals':
        return sorted.sort((a, b) => b.proposals - a.proposals);
      case 'score':
      default:
        return sorted.sort((a, b) => b.weightedScore - a.weightedScore);
    }
  }, [analyticsData.members, sortBy]);

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          Failed to load contribution analytics: {error.message}
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Controls */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Contribution Analytics</h3>
          <p className="text-sm text-gray-600">
            {isConnected ? 'Real-time updates enabled' : 'Using cached data'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Time Range Selector */}
          <div className="flex gap-1">
            {(['7d', '30d', '90d', '1y', 'all'] as const).map((range) => (
              <Button
                key={range}
                variant={selectedTimeRange === range ? 'default' : 'outline'}
                size="sm"
                onClick={() => handleTimeRangeChange(range)}
              >
                {range === '7d' ? '7D'}
                {range === '30d' ? '30D'}
                {range === '90d' ? '90D'}
                {range === '1y' ? '1Y'}
                {range === 'all' ? 'All'}
              </Button>
            ))}
          </div>

          {/* Refresh Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => refresh()}
            disabled={isLoading}
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>

          {/* Export Button */}
          <Button variant="outline" size="sm">
            <Download className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Key Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Total Contributors"
          value={analyticsData.summary.totalContributors}
          change={15.2}
          trend="up"
          icon={<Users className="w-6 h-6" />}
          color="blue"
        />
        <MetricCard
          title="Total Contributions"
          value={analyticsData.summary.totalContributions}
          change={8.5}
          trend="up"
          icon={<Activity className="w-6 h-6" />}
          color="green"
        />
        <MetricCard
          title="Participation Rate"
          value={`${analyticsData.summary.participationRate.toFixed(1)}%`}
          change={3.2}
          trend="up"
          icon={<ArrowUp className="w-6 h-6" />}
          color="orange"
        />
        <MetricCard
          title="New Members"
          value={analyticsData.summary.newMembers}
          subtext={`${analyticsData.summary.churnedMembers} churned`}
          icon={<Users className="w-6 h-6" />}
          color="green"
        />
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Contribution Trends Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Contribution Trends</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={analyticsData.trends}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 12 }}
                  interval={Math.floor(analyticsData.trends.length / 4)}
                />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Legend />
                <Area
                  type="monotone"
                  dataKey="totalContributions"
                  stackId="1"
                  fill="#3B82F6"
                  stroke="#3B82F6"
                  fillOpacity={0.6}
                  name="Total Contributions"
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Member Growth Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Member Growth</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={analyticsData.trends}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 12 }}
                  interval={Math.floor(analyticsData.trends.length / 4)}
                />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="contributors"
                  stroke="#10B981"
                  strokeWidth={2}
                  dot={false}
                  name="Active Contributors"
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Member Tier Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Member Distribution by Tier</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center">
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={analyticsData.distribution}
                  dataKey="count"
                  nameKey="tier"
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  label={({ tier, percentage }) => `${tier} ${percentage}%`}
                >
                  {analyticsData.distribution.map((_, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={['#FFD700', '#C0C0C0', '#CD7F32', '#3B82F6', '#9CA3AF'][
                        index % 5
                      ]}
                    />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => `${value} members`} />
              </PieChart>
            </ResponsiveContainer>
            {/* Legend */}
            <div className="mt-4 w-full space-y-2">
              {analyticsData.distribution.map((item) => (
                <div key={item.tier} className="flex items-center justify-between">
                  <span className="text-sm font-medium">{item.tier}</span>
                  <span className="text-xs text-gray-600">
                    {item.count} ({item.percentage}%)
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Top Contributions Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top Contributors</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={sortedMembers.slice(0, 10)}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="weightedScore" fill="#3B82F6" isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Member Rankings Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Member Rankings</CardTitle>
            <div className="flex gap-2">
              {(['score', 'contributions', 'votes', 'proposals'] as const).map((sort) => (
                <Button
                  key={sort}
                  variant={sortBy === sort ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSortBy(sort)}
                  className="capitalize"
                >
                  {sort === 'score' ? 'Score'}
                  {sort === 'contributions' ? 'Contributions'}
                  {sort === 'votes' ? 'Votes'}
                  {sort === 'proposals' ? 'Proposals'}
                </Button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b">
                <tr>
                  <th className="text-left py-2 px-4">Rank</th>
                  <th className="text-left py-2 px-4">Member</th>
                  <th className="text-left py-2 px-4">Tier</th>
                  <th className="text-right py-2 px-4">Score</th>
                  <th className="text-right py-2 px-4">Contributions</th>
                  <th className="text-right py-2 px-4">Votes</th>
                  <th className="text-right py-2 px-4">Proposals</th>
                  <th className="text-right py-2 px-4">Participation</th>
                  <th className="text-left py-2 px-4">Last Active</th>
                </tr>
              </thead>
              <tbody>
                {sortedMembers.slice(0, 20).map((member, index) => (
                  <tr key={member.userId} className="border-b hover:bg-gray-50">
                    <td className="py-2 px-4">
                      <span className="font-semibold">#{index + 1}</span>
                    </td>
                    <td className="py-2 px-4">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-gray-300" />
                        <span className="font-medium">{member.name}</span>
                        {member.verified && <Badge variant="secondary">✓</Badge>}
                      </div>
                    </td>
                    <td className="py-2 px-4">
                      <TierBadge tier={member.tier} />
                    </td>
                    <td className="py-2 px-4 text-right font-semibold">
                      {member.weightedScore.toLocaleString()}
                    </td>
                    <td className="py-2 px-4 text-right">{member.contributions}</td>
                    <td className="py-2 px-4 text-right">{member.votes}</td>
                    <td className="py-2 px-4 text-right">{member.proposals}</td>
                    <td className="py-2 px-4 text-right">
                      {member.participationRate.toFixed(0)}%
                    </td>
                    <td className="py-2 px-4 text-xs text-gray-600">
                      {member.lastActive.toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ContributionAnalyticsTab;
