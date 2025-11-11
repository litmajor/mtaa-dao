
/**
 * Synchronizer Agent Monitoring Dashboard
 */

import React, { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Activity, Database, GitBranch, RefreshCw } from 'lucide-react';

export default function SynchronizerMonitor() {
  const { data: status, refetch } = useQuery({
    queryKey: ['/api/synchronizer/status'],
    refetchInterval: 5000
  });

  const { data: snapshots } = useQuery({
    queryKey: ['/api/synchronizer/snapshots'],
    refetchInterval: 10000
  });

  const { data: commits } = useQuery({
    queryKey: ['/api/synchronizer/commits?limit=20']
  });

  const handleResolveDrift = async () => {
    try {
      const res = await fetch('/api/synchronizer/resolve-drift', {
        method: 'POST',
        credentials: 'include'
      });
      const result = await res.json();
      if (result.success) {
        refetch();
      }
    } catch (error) {
      console.error('Failed to resolve drift:', error);
    }
  };

  const statusColor = {
    ALIVE: 'green',
    DEGRADED: 'yellow',
    OFFLINE: 'red',
    RECOVERING: 'blue'
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Synchronizer Agent Monitor</h1>
        <Button onClick={() => refetch()} variant="outline">
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Status Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Agent Status</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              <Badge 
                variant={status?.data?.metrics?.status === 'ALIVE' ? 'default' : 'destructive'}
              >
                {status?.data?.metrics?.status || 'UNKNOWN'}
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">State Snapshots</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {status?.data?.metrics?.snapshots || 0}
            </div>
            <p className="text-xs text-muted-foreground">Active nodes</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Drift Index</CardTitle>
            <GitBranch className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {((status?.data?.metrics?.clusterDriftIndex || 0) * 100).toFixed(1)}%
            </div>
            <p className="text-xs text-muted-foreground">
              {(status?.data?.metrics?.clusterDriftIndex || 0) > 0.5 ? (
                <span className="text-red-500">Drift detected</span>
              ) : (
                <span className="text-green-500">Synchronized</span>
              )}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Rollback Events</CardTitle>
            <RefreshCw className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {status?.data?.metrics?.rollbackEvents || 0}
            </div>
            <p className="text-xs text-muted-foreground">Total recoveries</p>
          </CardContent>
        </Card>
      </div>

      {/* Drift Resolution */}
      {(status?.data?.metrics?.clusterDriftIndex || 0) > 0.5 && (
        <Card className="border-yellow-500">
          <CardHeader>
            <CardTitle className="text-yellow-600">State Drift Detected</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm mb-4">
              The cluster has diverged. Click below to resolve conflicts automatically.
            </p>
            <Button onClick={handleResolveDrift} variant="default">
              Resolve Drift
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Recent Snapshots */}
      <Card>
        <CardHeader>
          <CardTitle>Recent State Snapshots</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {snapshots?.data?.slice(0, 5).map((snapshot: any, idx: number) => (
              <div key={idx} className="flex justify-between items-center p-2 border rounded">
                <div>
                  <p className="font-medium">{snapshot.nodeId}</p>
                  <p className="text-xs text-muted-foreground">
                    Version {snapshot.version} • {new Date(snapshot.timestamp).toLocaleString()}
                  </p>
                </div>
                <Badge variant="outline">{snapshot.checksum.slice(0, 8)}...</Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Commit History */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Commits</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {commits?.data?.slice(0, 10).map((commit: any, idx: number) => (
              <div key={idx} className="flex justify-between items-center p-2 border rounded text-sm">
                <div>
                  <p className="font-medium">{commit.operation}</p>
                  <p className="text-xs text-muted-foreground">
                    {commit.affectedNodes.join(', ')}
                  </p>
                </div>
                <span className="text-xs text-muted-foreground">
                  {new Date(commit.timestamp).toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
