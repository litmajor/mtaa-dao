import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { TrendingUp, DollarSign, CheckCircle, AlertCircle, Clock } from 'lucide-react';
import { apiGet } from '@/lib/api';

interface EscrowMetrics {
  totalEscrows: number;
  totalVolume: string;
  completionRate: number;
  averageAmount: string;
  disputeRate: number;
  pendingCount: number;
  acceptedCount: number;
  fundedCount: number;
  completedCount: number;
  disputedCount: number;
  refundedCount: number;
}

interface ChartData {
  status: string;
  count: number;
}

interface TimeSeriesData {
  date: string;
  escrows: number;
  volume: number;
}

export function EscrowAnalyticsDashboard({ userId }: { userId: string }) {
  const [metrics, setMetrics] = useState<EscrowMetrics | null>(null);
  const [chartData, setChartData] = useState<ChartData[]>([]);
  const [timeSeriesData, setTimeSeriesData] = useState<TimeSeriesData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMetrics();
  }, [userId]);

  const fetchMetrics = async () => {
    try {
      setLoading(true);

      // Fetch escrow data
      const escrowsRes = await apiGet('/api/escrow/my-escrows');
      const escrows = escrowsRes.escrows || [];

      // Calculate metrics
      const totalVolume = escrows.reduce(
        (sum: number, e: any) => sum + parseFloat(e.amount),
        0
      );

      const completed = escrows.filter((e: any) => e.status === 'completed').length;
      const disputed = escrows.filter((e: any) => e.status === 'disputed').length;
      const completionRate =
        escrows.length > 0 ? ((completed / escrows.length) * 100).toFixed(1) : '0';
      const disputeRate =
        escrows.length > 0 ? ((disputed / escrows.length) * 100).toFixed(1) : '0';
      const averageAmount =
        escrows.length > 0 ? (totalVolume / escrows.length).toFixed(2) : '0';

      const metricsData: EscrowMetrics = {
        totalEscrows: escrows.length,
        totalVolume: totalVolume.toFixed(2),
        completionRate: parseFloat(completionRate as string),
        averageAmount,
        disputeRate: parseFloat(disputeRate as string),
        pendingCount: escrows.filter((e: any) => e.status === 'pending').length,
        acceptedCount: escrows.filter((e: any) => e.status === 'accepted').length,
        fundedCount: escrows.filter((e: any) => e.status === 'funded').length,
        completedCount: completed,
        disputedCount: disputed,
        refundedCount: escrows.filter((e: any) => e.status === 'refunded').length,
      };

      setMetrics(metricsData);

      // Prepare chart data
      const statusCounts: ChartData[] = [
        { status: 'Pending', count: metricsData.pendingCount },
        { status: 'Accepted', count: metricsData.acceptedCount },
        { status: 'Funded', count: metricsData.fundedCount },
        { status: 'Completed', count: metricsData.completedCount },
        { status: 'Disputed', count: metricsData.disputedCount },
        { status: 'Refunded', count: metricsData.refundedCount },
      ].filter((item) => item.count > 0);

      setChartData(statusCounts);

      // Generate time series data (last 30 days)
      const timeSeriesArray: TimeSeriesData[] = [];
      const dates = new Set<string>();

      escrows.forEach((e: any) => {
        const date = new Date(e.createdAt).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
        });
        dates.add(date);
      });

      Array.from(dates)
        .sort((a, b) => new Date(a).getTime() - new Date(b).getTime())
        .forEach((date) => {
          const dayEscrows = escrows.filter(
            (e: any) =>
              new Date(e.createdAt).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
              }) === date
          );

          const dayVolume = dayEscrows.reduce(
            (sum: number, e: any) => sum + parseFloat(e.amount),
            0
          );

          timeSeriesArray.push({
            date,
            escrows: dayEscrows.length,
            volume: dayVolume,
          });
        });

      setTimeSeriesData(timeSeriesArray);
    } catch (error) {
      console.error('Failed to fetch analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i}>
            <CardHeader>
              <div className="h-6 w-32 bg-gray-200 rounded animate-pulse" />
            </CardHeader>
            <CardContent>
              <div className="h-32 bg-gray-200 rounded animate-pulse" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (!metrics) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-center text-gray-500">No analytics data available</p>
        </CardContent>
      </Card>
    );
  }

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#6b7280'];

  return (
    <div className="space-y-6">
      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Escrows</CardTitle>
            <DollarSign className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.totalEscrows}</div>
            <p className="text-xs text-gray-500">Across all statuses</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Volume</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${metrics.totalVolume}</div>
            <p className="text-xs text-gray-500">USD equivalent</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completion Rate</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.completionRate}%</div>
            <p className="text-xs text-gray-500">
              {metrics.completedCount} of {metrics.totalEscrows} completed
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Average Amount</CardTitle>
            <DollarSign className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${metrics.averageAmount}</div>
            <p className="text-xs text-gray-500">Per escrow</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Dispute Rate</CardTitle>
            <AlertCircle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.disputeRate}%</div>
            <p className="text-xs text-gray-500">
              {metrics.disputedCount} disputes
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Review</CardTitle>
            <Clock className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.pendingCount}</div>
            <p className="text-xs text-gray-500">Awaiting action</p>
          </CardContent>
        </Card>
      </div>

      {/* Status Distribution */}
      <Card>
        <CardHeader>
          <CardTitle>Escrow Status Distribution</CardTitle>
          <CardDescription>
            Breakdown of escrows by current status
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ status, count }) => `${status}: ${count}`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="count"
                >
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>

            <div className="space-y-3">
              {chartData.map((item, index) => (
                <div key={item.status} className="flex items-center gap-3">
                  <div
                    className="w-4 h-4 rounded"
                    style={{ backgroundColor: COLORS[index % COLORS.length] }}
                  />
                  <span className="text-sm font-medium flex-1">{item.status}</span>
                  <Badge variant="outline">{item.count}</Badge>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Timeline */}
      {timeSeriesData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Activity Timeline</CardTitle>
            <CardDescription>
              Escrows created over time
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={timeSeriesData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Line
                  type="monotone"
                  dataKey="escrows"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  dot={{ fill: '#3b82f6', r: 4 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Detailed Status Cards */}
      <Card>
        <CardHeader>
          <CardTitle>Detailed Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-200">
              <p className="text-sm text-gray-600">Pending</p>
              <p className="text-2xl font-bold text-yellow-600">
                {metrics.pendingCount}
              </p>
            </div>
            <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
              <p className="text-sm text-gray-600">Accepted</p>
              <p className="text-2xl font-bold text-blue-600">
                {metrics.acceptedCount}
              </p>
            </div>
            <div className="p-4 bg-indigo-50 rounded-lg border border-indigo-200">
              <p className="text-sm text-gray-600">Funded</p>
              <p className="text-2xl font-bold text-indigo-600">
                {metrics.fundedCount}
              </p>
            </div>
            <div className="p-4 bg-green-50 rounded-lg border border-green-200">
              <p className="text-sm text-gray-600">Completed</p>
              <p className="text-2xl font-bold text-green-600">
                {metrics.completedCount}
              </p>
            </div>
            <div className="p-4 bg-red-50 rounded-lg border border-red-200">
              <p className="text-sm text-gray-600">Disputed</p>
              <p className="text-2xl font-bold text-red-600">
                {metrics.disputedCount}
              </p>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
              <p className="text-sm text-gray-600">Refunded</p>
              <p className="text-2xl font-bold text-gray-600">
                {metrics.refundedCount}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
