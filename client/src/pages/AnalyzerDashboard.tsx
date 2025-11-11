
/**
 * Analyzer Agent Dashboard
 * Real-time monitoring and analysis interface
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Shield, AlertTriangle, Activity, TrendingUp } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';

export default function AnalyzerDashboard() {
  const { data: status } = useQuery({
    queryKey: ['analyzer-status'],
    queryFn: async () => {
      const res = await fetch('/api/analyzer/status', {
        credentials: 'include'
      });
      return res.json();
    },
    refetchInterval: 5000 // Refresh every 5 seconds
  });

  const getThreatBadge = (level: string) => {
    const colors: Record<string, string> = {
      minimal: 'bg-green-500',
      low: 'bg-blue-500',
      medium: 'bg-yellow-500',
      high: 'bg-orange-500',
      critical: 'bg-red-500'
    };
    return <Badge className={colors[level] || 'bg-gray-500'}>{level.toUpperCase()}</Badge>;
  };

  if (!status?.success) {
    return <div>Loading...</div>;
  }

  const { config, metrics, status: agentStatus } = status.data;

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Analyzer Agent</h1>
          <p className="text-muted-foreground">AI-powered threat detection and pattern recognition</p>
        </div>
        <Badge variant={agentStatus === 'active' ? 'default' : 'secondary'}>
          {agentStatus}
        </Badge>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tasks Processed</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.tasksProcessed}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Processing Time</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.averageProcessingTime.toFixed(2)}ms</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Error Rate</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{(metrics.errorRate * 100).toFixed(2)}%</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Last Active</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-sm">{new Date(metrics.lastActive).toLocaleString()}</div>
          </CardContent>
        </Card>
      </div>

      {/* Capabilities */}
      <Card>
        <CardHeader>
          <CardTitle>Agent Capabilities</CardTitle>
          <CardDescription>What the Analyzer can do</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {config.capabilities.map((cap: string) => (
              <Badge key={cap} variant="outline">
                {cap.replace(/_/g, ' ')}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Integration Status */}
      <Card>
        <CardHeader>
          <CardTitle>System Integration</CardTitle>
          <CardDescription>Connected services and data sources</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span>Treasury Intelligence</span>
              <Badge variant="default">Connected</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span>Fraud Detection</span>
              <Badge variant="default">Connected</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span>Pattern Database</span>
              <Badge variant="default">Active</Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
