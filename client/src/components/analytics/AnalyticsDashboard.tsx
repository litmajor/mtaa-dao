
import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Progress } from '../ui/progress';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area
} from 'recharts';
import { 
  TrendingUp, 
  TrendingDown, 
  Users, 
  Vote, 
  DollarSign, 
  Target,
  Download,
  RefreshCw,
  Activity,
  BarChart3,
  FileText,
  Calendar
} from 'lucide-react';

interface AnalyticsMetrics {
  totalDaos: number;
  totalProposals: number;
  totalVotes: number;
  totalUsers: number;
  totalTasks: number;
  totalTransactionVolume: number;
  avgProposalSuccessRate: number;
  avgUserEngagement: number;
  topPerformingDaos: Array<{
    id: string;
    name: string;
    memberCount: number;
    proposalCount: number;
    successRate: number;
    treasuryValue: number;
  }>;
}

interface HistoricalData {
  timestamp: string;
  daoCount: number;
  userCount: number;
  proposalCount: number;
  transactionVolume: number;
  avgSuccessRate: number;
}

interface PerformanceBenchmarks {
  industry: {
    avgGovernanceParticipation: number;
    avgProposalSuccessRate: number;
    avgTreasuryGrowth: number;
  };
  platform: {
    topQuartile: AnalyticsMetrics;
    median: AnalyticsMetrics;
    bottomQuartile: AnalyticsMetrics;
  };
}

interface AnalyticsDashboardProps {
  daoId?: string;
}

export default function AnalyticsDashboard({ daoId }: AnalyticsDashboardProps) {
  const [metrics, setMetrics] = useState<AnalyticsMetrics | null>(null);
  const [historical, setHistorical] = useState<HistoricalData[]>([]);
  const [benchmarks, setBenchmarks] = useState<PerformanceBenchmarks | null>(null);
  const [period, setPeriod] = useState<'week' | 'month' | 'quarter' | 'year'>('month');
  const [isLoading, setIsLoading] = useState(true);
  const [isLiveMode, setIsLiveMode] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    fetchAnalyticsData();
  }, [period, daoId]);

  useEffect(() => {
    if (isLiveMode) {
      startLiveUpdates();
    } else {
      stopLiveUpdates();
    }

    return () => stopLiveUpdates();
  }, [isLiveMode, daoId]);

  const fetchAnalyticsData = async () => {
    try {
      setIsLoading(true);
      const daoParam = daoId ? `?daoId=${daoId}` : '';
      
      const [metricsRes, historicalRes, benchmarksRes] = await Promise.all([
        fetch(`/api/analytics/metrics${daoParam}`),
        fetch(`/api/analytics/historical?period=${period}${daoId ? `&daoId=${daoId}` : ''}`),
        fetch('/api/analytics/benchmarks')
      ]);

      const [metricsData, historicalData, benchmarksData] = await Promise.all([
        metricsRes.json(),
        historicalRes.json(),
        benchmarksRes.json()
      ]);

      if (metricsData.success) setMetrics(metricsData.data);
      if (historicalData.success) setHistorical(historicalData.data);
      if (benchmarksData.success) setBenchmarks(benchmarksData.data);
    } catch (error) {
      console.error('Error fetching analytics data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const startLiveUpdates = () => {
    const daoParam = daoId ? `?daoId=${daoId}` : '';
    eventSourceRef.current = new EventSource(`/api/analytics/live${daoParam}`);
    
    eventSourceRef.current.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'metrics') {
        setMetrics(data.data);
      }
    };

    eventSourceRef.current.onerror = (error) => {
      console.error('Live updates error:', error);
      setIsLiveMode(false);
    };
  };

  const stopLiveUpdates = () => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
  };

  const exportData = async (format: 'csv' | 'pdf', type: 'metrics' | 'historical' | 'benchmarks') => {
    try {
      const daoParam = daoId ? `&daoId=${daoId}` : '';
      const response = await fetch(`/api/analytics/export/${format}?type=${type}&period=${period}${daoParam}`);
      
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = response.headers.get('Content-Disposition')?.split('filename=')[1]?.replace(/"/g, '') || `analytics.${format}`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }
    } catch (error) {
      console.error('Error exporting data:', error);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const getGrowthColor = (current: number, previous: number) => {
    if (current > previous) return 'text-green-600';
    if (current < previous) return 'text-red-600';
    return 'text-gray-600';
  };

  const COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#ff7300', '#8dd1e1'];

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-center h-64">
            <RefreshCw className="h-8 w-8 animate-spin text-blue-600" />
            <span className="ml-2">Loading analytics data...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              Analytics Dashboard {daoId && `- DAO ${daoId}`}
            </h1>
            <p className="text-gray-600">
              Comprehensive analytics and performance insights
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Select value={period} onValueChange={(value: any) => setPeriod(value)}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="week">Week</SelectItem>
                <SelectItem value="month">Month</SelectItem>
                <SelectItem value="quarter">Quarter</SelectItem>
                <SelectItem value="year">Year</SelectItem>
              </SelectContent>
            </Select>
            
            <Button
              variant={isLiveMode ? "default" : "outline"}
              onClick={() => setIsLiveMode(!isLiveMode)}
            >
              <Activity className={`h-4 w-4 mr-2 ${isLiveMode ? 'animate-pulse' : ''}`} />
              {isLiveMode ? 'Live' : 'Static'}
            </Button>
            
            <Button onClick={fetchAnalyticsData} variant="outline">
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </div>

        {/* Key Metrics Cards */}
        {metrics && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Total Users</p>
                    <p className="text-2xl font-bold">{metrics.totalUsers}</p>
                    <p className="text-xs text-gray-500">
                      {metrics.avgUserEngagement.toFixed(1)}% engagement
                    </p>
                  </div>
                  <Users className="h-8 w-8 text-blue-600" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Total Proposals</p>
                    <p className="text-2xl font-bold">{metrics.totalProposals}</p>
                    <p className="text-xs text-gray-500">
                      {metrics.avgProposalSuccessRate.toFixed(1)}% success rate
                    </p>
                  </div>
                  <Vote className="h-8 w-8 text-green-600" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Transaction Volume</p>
                    <p className="text-2xl font-bold">{formatCurrency(metrics.totalTransactionVolume)}</p>
                    <p className="text-xs text-gray-500">
                      {metrics.totalVotes} total votes
                    </p>
                  </div>
                  <DollarSign className="h-8 w-8 text-purple-600" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Active DAOs</p>
                    <p className="text-2xl font-bold">{metrics.totalDaos}</p>
                    <p className="text-xs text-gray-500">
                      {metrics.totalTasks} tasks
                    </p>
                  </div>
                  <Target className="h-8 w-8 text-orange-600" />
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        <Tabs defaultValue="trends" className="space-y-4">
          <div className="flex items-center justify-between">
            <TabsList>
              <TabsTrigger value="trends">Trends</TabsTrigger>
              <TabsTrigger value="performance">Performance</TabsTrigger>
              <TabsTrigger value="benchmarks">Benchmarks</TabsTrigger>
              <TabsTrigger value="exports">Exports</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="trends" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Historical Trends */}
              <Card className="col-span-2">
                <CardHeader>
                  <CardTitle>Historical Trends</CardTitle>
                  <CardDescription>Key metrics over time</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={historical}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="timestamp" />
                        <YAxis />
                        <Tooltip />
                        <Line type="monotone" dataKey="userCount" stroke="#8884d8" name="Users" />
                        <Line type="monotone" dataKey="proposalCount" stroke="#82ca9d" name="Proposals" />
                        <Line type="monotone" dataKey="transactionVolume" stroke="#ffc658" name="Volume" />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              {/* Success Rate Trend */}
              <Card>
                <CardHeader>
                  <CardTitle>Success Rate Trend</CardTitle>
                  <CardDescription>Proposal success rate over time</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={historical}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="timestamp" />
                        <YAxis />
                        <Tooltip />
                        <Area type="monotone" dataKey="avgSuccessRate" stroke="#82ca9d" fill="#82ca9d" fillOpacity={0.6} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              {/* Volume Distribution */}
              <Card>
                <CardHeader>
                  <CardTitle>Volume Distribution</CardTitle>
                  <CardDescription>Transaction volume by period</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={historical.slice(-7)}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="timestamp" />
                        <YAxis />
                        <Tooltip />
                        <Bar dataKey="transactionVolume" fill="#8884d8" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="performance" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Top Performing DAOs */}
              {metrics?.topPerformingDaos && (
                <Card>
                  <CardHeader>
                    <CardTitle>Top Performing DAOs</CardTitle>
                    <CardDescription>Ranked by success rate and activity</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {metrics.topPerformingDaos.map((dao, index) => (
                        <div key={dao.id} className="flex items-center justify-between p-3 border rounded-lg">
                          <div className="flex items-center gap-3">
                            <Badge variant="outline">#{index + 1}</Badge>
                            <div>
                              <p className="font-medium">{dao.name}</p>
                              <p className="text-sm text-gray-500">
                                {dao.memberCount} members • {dao.proposalCount} proposals
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="font-semibold text-green-600">{dao.successRate.toFixed(1)}%</p>
                            <p className="text-sm text-gray-500">{formatCurrency(dao.treasuryValue)}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Performance Metrics */}
              <Card>
                <CardHeader>
                  <CardTitle>Performance Overview</CardTitle>
                  <CardDescription>Key performance indicators</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <div className="flex justify-between text-sm">
                        <span>User Engagement</span>
                        <span>{metrics?.avgUserEngagement.toFixed(1)}%</span>
                      </div>
                      <Progress value={metrics?.avgUserEngagement || 0} className="mt-1" />
                    </div>
                    
                    <div>
                      <div className="flex justify-between text-sm">
                        <span>Proposal Success Rate</span>
                        <span>{metrics?.avgProposalSuccessRate.toFixed(1)}%</span>
                      </div>
                      <Progress value={metrics?.avgProposalSuccessRate || 0} className="mt-1" />
                    </div>
                    
                    <div>
                      <div className="flex justify-between text-sm">
                        <span>Platform Activity</span>
                        <span>85%</span>
                      </div>
                      <Progress value={85} className="mt-1" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="benchmarks" className="space-y-4">
            {benchmarks && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Industry Benchmarks</CardTitle>
                    <CardDescription>Compare against industry standards</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="flex justify-between items-center">
                        <span>Governance Participation</span>
                        <Badge variant="outline">{benchmarks.industry.avgGovernanceParticipation}%</Badge>
                      </div>
                      <div className="flex justify-between items-center">
                        <span>Proposal Success Rate</span>
                        <Badge variant="outline">{benchmarks.industry.avgProposalSuccessRate}%</Badge>
                      </div>
                      <div className="flex justify-between items-center">
                        <span>Treasury Growth</span>
                        <Badge variant="outline">{benchmarks.industry.avgTreasuryGrowth}%</Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Platform Quartiles</CardTitle>
                    <CardDescription>Performance distribution on platform</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div>
                        <p className="text-sm font-medium">Top Quartile</p>
                        <p className="text-2xl font-bold text-green-600">
                          {benchmarks.platform.topQuartile.avgUserEngagement.toFixed(1)}%
                        </p>
                        <p className="text-xs text-gray-500">avg engagement</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium">Median</p>
                        <p className="text-2xl font-bold text-blue-600">
                          {benchmarks.platform.median.avgUserEngagement.toFixed(1)}%
                        </p>
                        <p className="text-xs text-gray-500">avg engagement</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium">Bottom Quartile</p>
                        <p className="text-2xl font-bold text-red-600">
                          {benchmarks.platform.bottomQuartile.avgUserEngagement.toFixed(1)}%
                        </p>
                        <p className="text-xs text-gray-500">avg engagement</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </TabsContent>

          <TabsContent value="exports" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle>Current Metrics</CardTitle>
                  <CardDescription>Export current performance data</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  <Button 
                    onClick={() => exportData('csv', 'metrics')} 
                    variant="outline" 
                    className="w-full"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Export CSV
                  </Button>
                  <Button 
                    onClick={() => exportData('pdf', 'metrics')} 
                    variant="outline" 
                    className="w-full"
                  >
                    <FileText className="h-4 w-4 mr-2" />
                    Export PDF
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Historical Data</CardTitle>
                  <CardDescription>Export trend analysis data</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  <Button 
                    onClick={() => exportData('csv', 'historical')} 
                    variant="outline" 
                    className="w-full"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Export CSV
                  </Button>
                  <Button 
                    onClick={() => exportData('pdf', 'historical')} 
                    variant="outline" 
                    className="w-full"
                  >
                    <FileText className="h-4 w-4 mr-2" />
                    Export PDF
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Benchmarks</CardTitle>
                  <CardDescription>Export comparative analysis</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  <Button 
                    onClick={() => exportData('csv', 'benchmarks')} 
                    variant="outline" 
                    className="w-full"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Export CSV
                  </Button>
                  <Button 
                    onClick={() => exportData('pdf', 'benchmarks')} 
                    variant="outline" 
                    className="w-full"
                  >
                    <FileText className="h-4 w-4 mr-2" />
                    Export PDF
                  </Button>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
