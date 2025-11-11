
import React, { useState, useEffect } from 'react';
import { Shield, AlertTriangle, Lock, Eye, Activity, Users } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';

interface DefenderMetrics {
  agentId: string;
  mode: string;
  activeThreats: number;
  quarantinedAgents: number;
  totalActions: number;
  recentActions: Array<{
    action: string;
    target: string;
    success: boolean;
    timestamp: string;
  }>;
  trustScoresSummary: {
    avgTrust: number;
    lowTrustAgents: string[];
    highTrustAgents: string[];
  };
  quarantineStatus: {
    quarantinedCount: number;
    quarantinedAgents: string[];
    policies: Record<string, any>;
  };
}

export default function DefenderMonitor() {
  const [metrics, setMetrics] = useState<DefenderMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMetrics();
    const interval = setInterval(fetchMetrics, 5000);
    return () => clearInterval(interval);
  }, []);

  const fetchMetrics = async () => {
    try {
      const response = await fetch('/api/defender/status');
      const data = await response.json();
      setMetrics(data);
    } catch (error) {
      console.error('Failed to fetch defender metrics:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Shield className="w-16 h-16 mx-auto mb-4 animate-pulse" />
          <p>Loading Defender Status...</p>
        </div>
      </div>
    );
  }

  if (!metrics) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p>Failed to load defender metrics</p>
      </div>
    );
  }

  const getModeColor = (mode: string) => {
    switch (mode) {
      case 'silent_monitor': return 'bg-green-500';
      case 'reactive_defense': return 'bg-yellow-500';
      case 'engaged_combat': return 'bg-red-500';
      case 'ethical_wait': return 'bg-blue-500';
      default: return 'bg-gray-500';
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Shield className="w-8 h-8" />
            Defender Monitor
          </h1>
          <p className="text-muted-foreground">DEF-OBSIDIAN Security System</p>
        </div>
        <Badge className={getModeColor(metrics.mode)}>
          {metrics.mode.replace('_', ' ').toUpperCase()}
        </Badge>
      </div>

      {/* Overview Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Threats</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.activeThreats}</div>
            <p className="text-xs text-muted-foreground">
              Currently being monitored
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Quarantined</CardTitle>
            <Lock className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.quarantinedAgents}</div>
            <p className="text-xs text-muted-foreground">
              Agents in isolation
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Actions</CardTitle>
            <Activity className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.totalActions}</div>
            <p className="text-xs text-muted-foreground">
              Defense actions taken
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Trust Score</CardTitle>
            <Users className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {(metrics.trustScoresSummary.avgTrust * 100).toFixed(0)}%
            </div>
            <Progress value={metrics.trustScoresSummary.avgTrust * 100} className="mt-2" />
          </CardContent>
        </Card>
      </div>

      {/* Recent Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Defense Actions</CardTitle>
          <CardDescription>Last 10 defensive actions taken</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {metrics.recentActions.map((action, idx) => (
              <div key={idx} className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center gap-3">
                  <Badge variant={action.success ? 'default' : 'destructive'}>
                    {action.action}
                  </Badge>
                  <span className="text-sm text-muted-foreground">
                    Target: {action.target}
                  </span>
                </div>
                <span className="text-xs text-muted-foreground">
                  {new Date(action.timestamp).toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Trust Scores */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-red-500">Low Trust Agents</CardTitle>
            <CardDescription>Agents requiring attention</CardDescription>
          </CardHeader>
          <CardContent>
            {metrics.trustScoresSummary.lowTrustAgents.length > 0 ? (
              <div className="space-y-2">
                {metrics.trustScoresSummary.lowTrustAgents.map((agent, idx) => (
                  <div key={idx} className="p-2 border rounded">
                    <code className="text-sm">{agent}</code>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No low trust agents</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-green-500">High Trust Agents</CardTitle>
            <CardDescription>Verified trusted agents</CardDescription>
          </CardHeader>
          <CardContent>
            {metrics.trustScoresSummary.highTrustAgents.length > 0 ? (
              <div className="space-y-2">
                {metrics.trustScoresSummary.highTrustAgents.map((agent, idx) => (
                  <div key={idx} className="p-2 border rounded">
                    <code className="text-sm">{agent}</code>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No high trust agents yet</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
