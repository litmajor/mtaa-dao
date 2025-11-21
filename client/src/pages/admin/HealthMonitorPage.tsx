import React, { useEffect, useState } from 'react';
import { useAdminHealth } from '../../hooks/useAdmin';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { AlertCircle, CheckCircle, AlertTriangle, RefreshCw, Zap } from 'lucide-react';
import { Skeleton } from '../../components/ui/skeleton';

const StatusIcon = ({ status }: { status: 'healthy' | 'warning' | 'error' }) => {
  switch (status) {
    case 'healthy':
      return <CheckCircle className="w-6 h-6 text-green-500" />;
    case 'warning':
      return <AlertTriangle className="w-6 h-6 text-yellow-500" />;
    case 'error':
      return <AlertCircle className="w-6 h-6 text-red-500" />;
  }
};

const StatusBadge = ({ status }: { status: 'healthy' | 'warning' | 'error' }) => {
  const colors = {
    healthy: 'bg-green-100 text-green-800',
    warning: 'bg-yellow-100 text-yellow-800',
    error: 'bg-red-100 text-red-800',
  };

  return (
    <span className={`px-3 py-1 rounded-full text-sm font-semibold capitalize ${colors[status]}`}>
      {status}
    </span>
  );
};

export function HealthMonitorPage() {
  const { health, loading, fetchHealth } = useAdminHealth();
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  useEffect(() => {
    const refresh = async () => {
      await fetchHealth();
      setLastRefresh(new Date());
    };

    refresh();

    if (!autoRefresh) return;

    const interval = setInterval(() => {
      refresh();
    }, 10000); // Refresh every 10 seconds

    return () => clearInterval(interval);
  }, [autoRefresh, fetchHealth]);

  const handleManualRefresh = async () => {
    await fetchHealth();
    setLastRefresh(new Date());
  };

  if (loading && !health) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">System Health Monitor</h1>
          <p className="text-muted-foreground mt-2">
            Real-time monitoring of critical system components
          </p>
        </div>
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="pt-6">
              <div className="space-y-4">
                <Skeleton className="h-8 w-32" />
                <Skeleton className="h-24 w-full" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const overallStatus =
    health?.database?.status === 'error' ||
    health?.blockchain?.status === 'error' ||
    health?.payment?.status === 'error'
      ? 'error'
      : health?.database?.status === 'warning' ||
          health?.blockchain?.status === 'warning' ||
          health?.payment?.status === 'warning'
        ? 'warning'
        : 'healthy';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">System Health Monitor</h1>
          <p className="text-muted-foreground mt-2">
            Real-time monitoring of critical system components
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
            Auto-refresh (10s)
          </label>
          <button
            onClick={handleManualRefresh}
            disabled={loading}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 flex items-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Overall Status */}
      <Card className="border-2">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Overall System Status</CardTitle>
              <CardDescription>
                {lastRefresh && `Last updated: ${lastRefresh.toLocaleTimeString()}`}
              </CardDescription>
            </div>
            <div className="flex items-center gap-3">
              <StatusIcon status={overallStatus} />
              <StatusBadge status={overallStatus} />
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Individual Service Status */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Database */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Zap className="w-4 h-4" />
                Database
              </CardTitle>
              <StatusIcon status={health?.database?.status || 'healthy'} />
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <p className="text-sm text-muted-foreground">Status</p>
              <StatusBadge status={health?.database?.status || 'healthy'} />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Response Time</p>
              <p className="text-2xl font-bold">{health?.database?.latency || 0}ms</p>
            </div>
            <div className="pt-2 border-t border-border">
              <p className="text-xs text-muted-foreground">
                Checked: {health?.database?.lastChecked
                  ? new Date(health.database.lastChecked).toLocaleTimeString()
                  : 'Never'}
              </p>
            </div>
            {health?.database?.status === 'error' && (
              <div className="p-2 bg-red-100 border border-red-300 rounded text-xs text-red-800">
                Database is unreachable. Check PostgreSQL service.
              </div>
            )}
            {health?.database?.status === 'warning' && (
              <div className="p-2 bg-yellow-100 border border-yellow-300 rounded text-xs text-yellow-800">
                Database response time is elevated. Performance may be impacted.
              </div>
            )}
          </CardContent>
        </Card>

        {/* Blockchain */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Zap className="w-4 h-4" />
                Blockchain
              </CardTitle>
              <StatusIcon status={health?.blockchain?.status || 'healthy'} />
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <p className="text-sm text-muted-foreground">Status</p>
              <StatusBadge status={health?.blockchain?.status || 'healthy'} />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Response Time</p>
              <p className="text-2xl font-bold">{health?.blockchain?.latency || 0}ms</p>
            </div>
            <div className="pt-2 border-t border-border">
              <p className="text-xs text-muted-foreground">Chain ID: {health?.blockchain?.chainId}</p>
              <p className="text-xs text-muted-foreground">
                Checked: {health?.blockchain?.lastChecked
                  ? new Date(health.blockchain.lastChecked).toLocaleTimeString()
                  : 'Never'}
              </p>
            </div>
            {health?.blockchain?.status === 'error' && (
              <div className="p-2 bg-red-100 border border-red-300 rounded text-xs text-red-800">
                RPC endpoint is unreachable. Check network connection.
              </div>
            )}
            {health?.blockchain?.status === 'warning' && (
              <div className="p-2 bg-yellow-100 border border-yellow-300 rounded text-xs text-yellow-800">
                RPC response time is elevated. Transactions may be slow.
              </div>
            )}
          </CardContent>
        </Card>

        {/* Payment */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Zap className="w-4 h-4" />
                Payment Service
              </CardTitle>
              <StatusIcon status={health?.payment?.status || 'healthy'} />
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <p className="text-sm text-muted-foreground">Status</p>
              <StatusBadge status={health?.payment?.status || 'healthy'} />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Transaction Status</p>
              <p className="text-lg font-semibold capitalize">{health?.payment?.transactionStatus}</p>
            </div>
            <div className="pt-2 border-t border-border">
              <p className="text-xs text-muted-foreground">
                Checked: {health?.payment?.lastChecked
                  ? new Date(health.payment.lastChecked).toLocaleTimeString()
                  : 'Never'}
              </p>
            </div>
            {health?.payment?.status === 'error' && (
              <div className="p-2 bg-red-100 border border-red-300 rounded text-xs text-red-800">
                Payment service is down. Transactions cannot be processed.
              </div>
            )}
            {health?.payment?.status === 'warning' && (
              <div className="p-2 bg-yellow-100 border border-yellow-300 rounded text-xs text-yellow-800">
                Payment service issues detected. Monitor transactions closely.
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Health Recommendations */}
      <Card>
        <CardHeader>
          <CardTitle>System Recommendations</CardTitle>
          <CardDescription>
            Based on current system health
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {overallStatus === 'healthy' && (
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg text-green-700">
              ✓ All systems operational. No action required.
            </div>
          )}
          {overallStatus === 'warning' && (
            <div className="space-y-2">
              {health?.database?.status === 'warning' && (
                <div className="p-3 bg-yellow-50 border border-yellow-200 rounded text-sm text-yellow-700">
                  • Database latency is elevated. Consider checking server load and query performance.
                </div>
              )}
              {health?.blockchain?.status === 'warning' && (
                <div className="p-3 bg-yellow-50 border border-yellow-200 rounded text-sm text-yellow-700">
                  • Blockchain RPC latency is high. Consider using a different RPC endpoint.
                </div>
              )}
              {health?.payment?.status === 'warning' && (
                <div className="p-3 bg-yellow-50 border border-yellow-200 rounded text-sm text-yellow-700">
                  • Payment service has reported issues. Monitor transaction completion rates.
                </div>
              )}
            </div>
          )}
          {overallStatus === 'error' && (
            <div className="space-y-2">
              {health?.database?.status === 'error' && (
                <div className="p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
                  ✗ DATABASE ERROR: PostgreSQL service may be down. Check server logs immediately.
                </div>
              )}
              {health?.blockchain?.status === 'error' && (
                <div className="p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
                  ✗ BLOCKCHAIN ERROR: RPC endpoint unreachable. Verify network and endpoint configuration.
                </div>
              )}
              {health?.payment?.status === 'error' && (
                <div className="p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
                  ✗ PAYMENT ERROR: Payment service is down. Transactions cannot be processed.
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default HealthMonitorPage;
