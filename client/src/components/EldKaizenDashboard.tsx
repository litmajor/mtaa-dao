/**
 * ELD-KAIZEN Dashboard - Superuser View
 * 
 * Real-time performance monitoring and optimization recommendations
 * for all DAOs in the system
 */

'use client';

import React, { useEffect, useState } from 'react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { AlertCircle, TrendingUp, Users, Zap, Shield, DollarSign } from 'lucide-react';

interface DAOMetrics {
  daoId: string;
  scores: {
    overall: number;
    treasury: number;
    governance: number;
    community: number;
    system: number;
  };
  treasury: {
    balance: number;
    burnRate: number;
    runway: number;
    growthRate: number;
  };
  governance: {
    participationRate: number;
    proposalSuccessRate: number;
    quorumMet: number;
  };
  community: {
    activeMembers: number;
    engagementScore: number;
    retentionRate: number;
  };
  timestamp: string;
}

interface Opportunity {
  id: string;
  category: 'gas' | 'route' | 'ux' | 'governance' | 'treasury' | 'community';
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  expectedImprovement: number;
  priority: number;
}

interface DashboardData {
  elderName: string;
  status: string;
  lastAnalysis: string;
  daos: Array<{
    daoId: string;
    metrics: DAOMetrics;
    recommendations: any;
  }>;
  improvements: {
    totalOptimizations: number;
    successfulOptimizations: number;
    failedOptimizations: number;
    averageImprovementPercent: number;
  };
}

export default function EldKaizenDashboard() {
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDAO, setSelectedDAO] = useState<string | null>(null);
  const [refreshInterval, setRefreshInterval] = useState(60000); // 1 minute

  useEffect(() => {
    fetchDashboardData();
    const interval = setInterval(fetchDashboardData, refreshInterval);
    return () => clearInterval(interval);
  }, [refreshInterval]);

  const fetchDashboardData = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/elders/kaizen/dashboard', {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      if (!response.ok) throw new Error('Failed to fetch dashboard data');
      const data = await response.json();
      setDashboardData(data);
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-900 to-slate-800">
        <div className="text-white text-xl">Loading ELD-KAIZEN Dashboard...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-900 to-slate-800">
        <div className="bg-red-500/20 border border-red-500 text-red-200 px-6 py-4 rounded-lg">
          Error: {error}
        </div>
      </div>
    );
  }

  if (!dashboardData) return null;

  const daoMetrics = dashboardData.daos;
  const avgScore = Math.round(
    daoMetrics.reduce((sum, d) => sum + d.metrics.scores.overall, 0) / daoMetrics.length
  );

  // Prepare chart data
  const scoresByDAO = daoMetrics.map(d => ({
    name: d.daoId.substring(0, 8),
    overall: d.metrics.scores.overall,
    treasury: d.metrics.scores.treasury,
    governance: d.metrics.scores.governance,
    community: d.metrics.scores.community,
    system: d.metrics.scores.system
  }));

  const criticalOpportunities = daoMetrics.flatMap(d =>
    (d.recommendations?.opportunities || [])
      .filter((opp: Opportunity) => opp.severity === 'critical')
      .map(opp => ({ ...opp, daoId: d.daoId }))
  );

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'bg-red-500/20 border-red-500 text-red-200';
      case 'high':
        return 'bg-orange-500/20 border-orange-500 text-orange-200';
      case 'medium':
        return 'bg-yellow-500/20 border-yellow-500 text-yellow-200';
      default:
        return 'bg-blue-500/20 border-blue-500 text-blue-200';
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'treasury':
        return <DollarSign className="w-4 h-4" />;
      case 'governance':
        return <Shield className="w-4 h-4" />;
      case 'community':
        return <Users className="w-4 h-4" />;
      case 'ux':
        return <Zap className="w-4 h-4" />;
      default:
        return <TrendingUp className="w-4 h-4" />;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <div className="bg-slate-800/50 border-b border-slate-700 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-white flex items-center gap-2">
                <Zap className="w-8 h-8 text-amber-500" />
                ELD-KAIZEN Dashboard
              </h1>
              <p className="text-slate-400 text-sm mt-1">System Performance & Optimization Intelligence</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-2xl font-bold text-white">{avgScore}%</p>
                <p className="text-slate-400 text-xs">System Health</p>
              </div>
              <button
                onClick={fetchDashboardData}
                className="px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition"
              >
                Refresh
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Stats Overview */}
        <div className="grid grid-cols-4 gap-4 mb-8">
          <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
            <div className="text-slate-400 text-sm font-medium">Total DAOs Monitored</div>
            <div className="text-3xl font-bold text-white mt-2">{daoMetrics.length}</div>
          </div>
          <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
            <div className="text-slate-400 text-sm font-medium">Critical Issues</div>
            <div className="text-3xl font-bold text-red-400 mt-2">{criticalOpportunities.length}</div>
          </div>
          <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
            <div className="text-slate-400 text-sm font-medium">Total Optimizations</div>
            <div className="text-3xl font-bold text-green-400 mt-2">
              {dashboardData.improvements.totalOptimizations}
            </div>
          </div>
          <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
            <div className="text-slate-400 text-sm font-medium">Success Rate</div>
            <div className="text-3xl font-bold text-blue-400 mt-2">
              {dashboardData.improvements.totalOptimizations > 0
                ? Math.round(
                    (dashboardData.improvements.successfulOptimizations /
                      dashboardData.improvements.totalOptimizations) *
                      100
                  )
                : 0}
              %
            </div>
          </div>
        </div>

        {/* Performance Scores Chart */}
        <div className="bg-slate-800 border border-slate-700 rounded-lg p-6 mb-8">
          <h2 className="text-xl font-bold text-white mb-4">DAO Performance Scores</h2>
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={scoresByDAO}>
              <CartesianGrid strokeDasharray="3 3" stroke="#475569" />
              <XAxis dataKey="name" stroke="#94a3b8" />
              <YAxis stroke="#94a3b8" domain={[0, 100]} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569', borderRadius: '8px' }}
                labelStyle={{ color: '#f1f5f9' }}
              />
              <Legend />
              <Bar dataKey="overall" fill="#f59e0b" />
              <Bar dataKey="treasury" fill="#10b981" />
              <Bar dataKey="governance" fill="#3b82f6" />
              <Bar dataKey="community" fill="#8b5cf6" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Critical Issues */}
        {criticalOpportunities.length > 0 && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-6 mb-8">
            <div className="flex items-center gap-2 mb-4">
              <AlertCircle className="w-5 h-5 text-red-400" />
              <h2 className="text-xl font-bold text-red-200">Critical Issues Detected</h2>
            </div>
            <div className="space-y-3">
              {criticalOpportunities.slice(0, 5).map((opp: any) => (
                <div
                  key={opp.id}
                  className={`border rounded-lg p-4 ${getSeverityColor(opp.severity)}`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      {getCategoryIcon(opp.category)}
                      <div>
                        <p className="font-semibold">{opp.title}</p>
                        <p className="text-sm opacity-90">{opp.description}</p>
                        <p className="text-xs opacity-75 mt-1">DAO: {opp.daoId}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold">{opp.priority}</p>
                      <p className="text-xs opacity-75">Priority</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* DAO Metrics Details */}
        <div className="grid grid-cols-2 gap-6 mb-8">
          {daoMetrics.map(dao => (
            <div
              key={dao.daoId}
              className="bg-slate-800 border border-slate-700 rounded-lg p-6 hover:border-slate-600 transition cursor-pointer"
              onClick={() => setSelectedDAO(selectedDAO === dao.daoId ? null : dao.daoId)}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-white">{dao.daoId}</h3>
                <div
                  className={`px-3 py-1 rounded-full text-sm font-medium ${
                    dao.metrics.scores.overall >= 80
                      ? 'bg-green-500/20 text-green-200'
                      : dao.metrics.scores.overall >= 60
                      ? 'bg-yellow-500/20 text-yellow-200'
                      : 'bg-red-500/20 text-red-200'
                  }`}
                >
                  {dao.metrics.scores.overall}%
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="bg-slate-700/50 rounded p-3">
                  <p className="text-slate-400 text-xs">Treasury</p>
                  <p className="text-white font-bold">{dao.metrics.scores.treasury}%</p>
                </div>
                <div className="bg-slate-700/50 rounded p-3">
                  <p className="text-slate-400 text-xs">Governance</p>
                  <p className="text-white font-bold">{dao.metrics.scores.governance}%</p>
                </div>
                <div className="bg-slate-700/50 rounded p-3">
                  <p className="text-slate-400 text-xs">Community</p>
                  <p className="text-white font-bold">{dao.metrics.scores.community}%</p>
                </div>
                <div className="bg-slate-700/50 rounded p-3">
                  <p className="text-slate-400 text-xs">System</p>
                  <p className="text-white font-bold">{dao.metrics.scores.system}%</p>
                </div>
              </div>

              {selectedDAO === dao.daoId && (
                <div className="mt-4 pt-4 border-t border-slate-700 space-y-2">
                  <p className="text-xs text-slate-400">
                    <span className="font-semibold">Runway:</span> {dao.metrics.treasury.runway.toFixed(1)} months
                  </p>
                  <p className="text-xs text-slate-400">
                    <span className="font-semibold">Participation:</span>{' '}
                    {dao.metrics.governance.participationRate.toFixed(1)}%
                  </p>
                  <p className="text-xs text-slate-400">
                    <span className="font-semibold">Active Members:</span> {dao.metrics.community.activeMembers}
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Recommendations by Category */}
        <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
          <h2 className="text-xl font-bold text-white mb-4">Top Optimization Opportunities</h2>
          <div className="space-y-3">
            {daoMetrics
              .flatMap(d =>
                (d.recommendations?.opportunities || [])
                  .slice(0, 3)
                  .map((opp: Opportunity) => ({ ...opp, daoId: d.daoId }))
              )
              .sort((a, b) => b.priority - a.priority)
              .slice(0, 10)
              .map((opp: any) => (
                <div
                  key={`${opp.daoId}-${opp.id}`}
                  className={`border rounded-lg p-4 ${getSeverityColor(opp.severity)}`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {getCategoryIcon(opp.category)}
                      <div>
                        <p className="font-semibold">{opp.title}</p>
                        <p className="text-xs opacity-75">{opp.daoId}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold">+{opp.expectedImprovement.toFixed(1)}%</p>
                      <p className="text-xs opacity-75">Expected Improvement</p>
                    </div>
                  </div>
                </div>
              ))}
          </div>
        </div>
      </div>
    </div>
  );
}
