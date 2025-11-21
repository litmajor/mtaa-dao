import React, { useEffect, useState } from 'react';
import { useAdminAnalytics, useAdminHealth } from '../../hooks/useAdmin';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { AlertCircle, CheckCircle, AlertTriangle, DollarSign, TrendingUp, Zap } from 'lucide-react';
import { Skeleton } from '../../components/ui/skeleton';

interface MetricCard {
  label: string;
  value: string | number;
  change?: number;
  icon: React.ReactNode;
}

export function AnalyticsPage() {
  const { metrics, loading, error, fetchMetrics } = useAdminAnalytics();
  const { health, fetchHealth } = useAdminHealth();
  const [autoRefresh, setAutoRefresh] = useState(true);

  useEffect(() => {
    fetchMetrics();
    fetchHealth();

    if (!autoRefresh) return;

    const interval = setInterval(() => {
      fetchMetrics();
      fetchHealth();
    }, 30000); // Refresh every 30 seconds

    return () => clearInterval(interval);
  }, [autoRefresh, fetchMetrics, fetchHealth]);

  const metricCards: MetricCard[] = metrics
    ? [
        {
          label: 'Monthly Revenue',
          value: `$${metrics.monthlyRevenue?.toLocaleString() || '0'}`,
          icon: <DollarSign className="w-5 h-5" />,
        },
        {
          label: 'Quarterly Revenue',
          value: `$${metrics.quarterlyRevenue?.toLocaleString() || '0'}`,
          icon: <TrendingUp className="w-5 h-5" />,
        },
        {
          label: 'Annual Revenue',
          value: `$${metrics.annualRevenue?.toLocaleString() || '0'}`,
          icon: <TrendingUp className="w-5 h-5" />,
        },
        {
          label: 'Avg Reputation Score',
          value: metrics.averageReputationScore?.toFixed(2) || '0',
          icon: <Zap className="w-5 h-5" />,
        },
      ]
    : [];

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Platform Analytics</h1>
          <p className="text-muted-foreground mt-2">
            Real-time system metrics and performance data
          </p>
        </div>
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="rounded"
            />
            Auto-refresh (30s)
          </label>
          <button
            onClick={() => {
              fetchMetrics();
              fetchHealth();
            }}
            disabled={loading}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50"
          >
            {loading ? 'Loading...' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="p-4 bg-destructive/10 border border-destructive rounded-lg text-destructive flex items-center gap-2">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Revenue Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {loading
          ? Array.from({ length: 4 }).map((_, i) => (
              <Card key={i}>
                <CardHeader className="pb-2">
                  <Skeleton className="h-4 w-24" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-8 w-32" />
                </CardContent>
              </Card>
            ))
          : metricCards.map((card, index) => (
              <Card key={index}>
                <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
                  <CardTitle className="text-sm font-medium">{card.label}</CardTitle>
                  <div className="text-muted-foreground">{card.icon}</div>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{card.value}</div>
                  {card.change && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {card.change > 0 ? '+' : ''}{card.change}% from last period
                    </p>
                  )}
                </CardContent>
              </Card>
            ))}
      </div>

      {/* System Health */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Zap className="w-4 h-4" />
              Database Health
            </CardTitle>
          </CardHeader>
          <CardContent>
            {health?.database ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  {health.database.status === 'healthy' ? (
                    <CheckCircle className="w-5 h-5 text-green-500" />
                  ) : health.database.status === 'warning' ? (
                    <AlertTriangle className="w-5 h-5 text-yellow-500" />
                  ) : (
                    <AlertCircle className="w-5 h-5 text-red-500" />
                  )}
                  <span className="capitalize font-semibold">
                    {health.database.status}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Latency: {health.database.latency}ms
                </p>
                <p className="text-xs text-muted-foreground">
                  Last checked: {new Date(health.database.lastChecked).toLocaleTimeString()}
                </p>
              </div>
            ) : (
              <Skeleton className="h-20" />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Zap className="w-4 h-4" />
              Blockchain Health
            </CardTitle>
          </CardHeader>
          <CardContent>
            {health?.blockchain ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  {health.blockchain.status === 'healthy' ? (
                    <CheckCircle className="w-5 h-5 text-green-500" />
                  ) : health.blockchain.status === 'warning' ? (
                    <AlertTriangle className="w-5 h-5 text-yellow-500" />
                  ) : (
                    <AlertCircle className="w-5 h-5 text-red-500" />
                  )}
                  <span className="capitalize font-semibold">
                    {health.blockchain.status}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Latency: {health.blockchain.latency}ms
                </p>
                <p className="text-sm text-muted-foreground">
                  Chain ID: {health.blockchain.chainId}
                </p>
                <p className="text-xs text-muted-foreground">
                  Last checked: {new Date(health.blockchain.lastChecked).toLocaleTimeString()}
                </p>
              </div>
            ) : (
              <Skeleton className="h-24" />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <DollarSign className="w-4 h-4" />
              Payment Health
            </CardTitle>
          </CardHeader>
          <CardContent>
            {health?.payment ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  {health.payment.status === 'healthy' ? (
                    <CheckCircle className="w-5 h-5 text-green-500" />
                  ) : health.payment.status === 'warning' ? (
                    <AlertTriangle className="w-5 h-5 text-yellow-500" />
                  ) : (
                    <AlertCircle className="w-5 h-5 text-red-500" />
                  )}
                  <span className="capitalize font-semibold">
                    {health.payment.status}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Status: {health.payment.transactionStatus}
                </p>
                <p className="text-xs text-muted-foreground">
                  Last checked: {new Date(health.payment.lastChecked).toLocaleTimeString()}
                </p>
              </div>
            ) : (
              <Skeleton className="h-20" />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Top Reputation Users */}
      {metrics?.topReputationUsers && (
        <Card>
          <CardHeader>
            <CardTitle>Top Reputation Users</CardTitle>
            <CardDescription>
              Users with the highest reputation scores
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {metrics.topReputationUsers.map((user, index) => (
                <div key={user.userId} className="flex items-center justify-between pb-4 border-b last:border-b-0 last:pb-0">
                  <div className="flex items-center gap-4">
                    <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-sm">
                      {index + 1}
                    </div>
                    <div>
                      <p className="font-medium">{user.username}</p>
                      <p className="text-sm text-muted-foreground">{user.userId}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">{user.score.toFixed(2)}</p>
                    <p className="text-xs text-muted-foreground">Score</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default AnalyticsPage;
