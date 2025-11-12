/**
 * ELD-KAIZEN DAO Dashboard - Member View
 * 
 * Performance monitoring and optimization recommendations
 * for a specific DAO (DAO members only)
 */

'use client';

import React, { useEffect, useState } from 'react';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
import {
  AlertCircle,
  TrendingUp,
  TrendingDown,
  Users,
  Zap,
  Shield,
  DollarSign,
  ChevronDown,
  CheckCircle,
  AlertTriangle
} from 'lucide-react';
import { useParams } from 'next/navigation';

interface MetricTrend {
  timestamp: string;
  value: number;
}

interface Anomaly {
  metric: string;
  currentValue: number;
  expectedRange: {
    min: number;
    max: number;
  };
  severity: string;
}

interface Opportunity {
  id: string;
  category: string;
  severity: string;
  title: string;
  description: string;
  expectedImprovement: number;
  priority: number;
  implementationSteps: string[];
  estimatedEffort: string;
  risks: string[];
}

interface DAOStatus {
  scores: {
    overall: number;
    treasury: number;
    governance: number;
    community: number;
    system: number;
  };
  health: string;
  lastUpdate: string;
  treasury?: {
    balance: number;
    burnRate: number;
    runway: number;
    growthRate: number;
  };
  governance?: {
    participationRate: number;
    proposalSuccessRate: number;
    quorumMet: number;
  };
  community?: {
    activeMembers: number;
    engagementScore: number;
    retentionRate: number;
  };
}

interface DAORecommendations {
  opportunities: Opportunity[];
  summary: {
    totalOpportunities: number;
    criticalCount: number;
    highCount: number;
    estimatedTotalImprovement: number;
  };
}

export default function DAOKaizenDashboard() {
  const params = useParams();
  const daoId = params?.daoId as string;

  const [status, setStatus] = useState<DAOStatus | null>(null);
  const [recommendations, setRecommendations] = useState<DAORecommendations | null>(null);
  const [trends, setTrends] = useState<Record<string, MetricTrend[]>>({});
  const [anomalies, setAnomalies] = useState<Anomaly[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedOpportunity, setExpandedOpportunity] = useState<string | null>(null);
  const [selectedMetric, setSelectedMetric] = useState<string>('overall');

  useEffect(() => {
    if (!daoId) return;
    fetchDAOData();
    const interval = setInterval(fetchDAOData, 60000); // Refresh every 1 minute
    return () => clearInterval(interval);
  }, [daoId]);

  const fetchDAOData = async () => {
    if (!daoId) return;
    try {
      const token = localStorage.getItem('token');
      const [statusRes, recsRes, trendsRes, anomaliesRes] = await Promise.all([
        fetch(`/api/elders/kaizen/dao/${daoId}/status`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        fetch(`/api/elders/kaizen/dao/${daoId}/recommendations`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        fetch(`/api/elders/kaizen/dao/${daoId}/trends?metric=${selectedMetric}&hours=168`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        fetch(`/api/elders/kaizen/dao/${daoId}/anomalies?metric=${selectedMetric}&threshold=20`, {
          headers: { Authorization: `Bearer ${token}` }
        })
      ]);

      if (!statusRes.ok || !recsRes.ok) throw new Error('Failed to fetch DAO data');

      const statusData = await statusRes.json();
      const recsData = await recsRes.json();
      const trendsData = trendsRes.ok ? await trendsRes.json() : {};
      const anomaliesData = anomaliesRes.ok ? await anomaliesRes.json() : [];

      setStatus(statusData?.data || statusData);
      setRecommendations(recsData?.data || recsData);
      setTrends(trendsData?.data || {});
      setAnomalies(anomaliesData?.data || []);
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
        <div className="text-white text-xl">Loading DAO Dashboard...</div>
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

  if (!status) return null;

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

  const getHealthColor = (score: number) => {
    if (score >= 80) return 'text-green-400';
    if (score >= 60) return 'text-yellow-400';
    return 'text-red-400';
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'treasury':
        return <DollarSign className="w-4 h-4" />;
      case 'governance':
        return <Shield className="w-4 h-4" />;
      case 'community':
        return <Users className="w-4 h-4" />;
      case 'system':
        return <Zap className="w-4 h-4" />;
      default:
        return <TrendingUp className="w-4 h-4" />;
    }
  };

  const chartData = trends[selectedMetric] || [];
  const criticalOpportunities = recommendations?.opportunities.filter(o => o.severity === 'critical') || [];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <div className="bg-slate-800/50 border-b border-slate-700 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-white">DAO Performance Hub</h1>
              <p className="text-slate-400 text-sm mt-1">
                Powered by ELD-KAIZEN • DAO: {daoId}
              </p>
            </div>
            <div className="flex items-center gap-4">
              <div
                className={`text-right px-6 py-3 rounded-lg bg-slate-700/50 border border-slate-600`}
              >
                <p className={`text-3xl font-bold ${getHealthColor(status.scores.overall)}`}>
                  {status.scores.overall}%
                </p>
                <p className="text-slate-400 text-xs">Overall Health</p>
              </div>
              <button
                onClick={fetchDAOData}
                className="px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition"
              >
                Refresh
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Health Scores Grid */}
        <div className="grid grid-cols-5 gap-4 mb-8">
          {Object.entries(status.scores).map(([key, value]) => (
            <div
              key={key}
              className={`bg-slate-800 border border-slate-700 rounded-lg p-4 cursor-pointer transition hover:border-slate-600 ${
                selectedMetric === key ? 'ring-2 ring-amber-500' : ''
              }`}
              onClick={() => setSelectedMetric(key)}
            >
              <p className="text-slate-400 text-xs font-medium uppercase">{key}</p>
              <p className={`text-2xl font-bold mt-2 ${getHealthColor(value)}`}>{value}%</p>
            </div>
          ))}
        </div>

        {/* Critical Alerts */}
        {criticalOpportunities.length > 0 && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-6 mb-8">
            <div className="flex items-center gap-2 mb-4">
              <AlertCircle className="w-5 h-5 text-red-400" />
              <h2 className="text-xl font-bold text-red-200">
                {criticalOpportunities.length} Critical Issues Detected
              </h2>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {criticalOpportunities.map(opp => (
                <div key={opp.id} className="bg-red-500/5 border border-red-500/20 rounded p-3">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="font-semibold text-red-200 text-sm">{opp.title}</p>
                      <p className="text-xs text-red-300/70 mt-1">{opp.description}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Metrics Trend Chart */}
        <div className="bg-slate-800 border border-slate-700 rounded-lg p-6 mb-8">
          <h2 className="text-xl font-bold text-white mb-4">
            {selectedMetric.charAt(0).toUpperCase() + selectedMetric.slice(1)} Trend (Last 7 Days)
          </h2>
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#475569" />
                <XAxis dataKey="timestamp" stroke="#94a3b8" />
                <YAxis stroke="#94a3b8" domain={[0, 100]} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569', borderRadius: '8px' }}
                  labelStyle={{ color: '#f1f5f9' }}
                />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke="#f59e0b"
                  fillOpacity={1}
                  fill="url(#colorValue)"
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-300 flex items-center justify-center text-slate-400">
              No trend data available
            </div>
          )}
        </div>

        {/* Anomalies */}
        {anomalies.length > 0 && (
          <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-6 mb-8">
            <h2 className="text-lg font-bold text-yellow-200 mb-4">Detected Anomalies</h2>
            <div className="space-y-2">
              {anomalies.map((anom, idx) => (
                <div
                  key={idx}
                  className="bg-yellow-500/5 border border-yellow-500/20 rounded p-3 flex items-center justify-between"
                >
                  <div>
                    <p className="text-yellow-200 font-semibold text-sm">{anom.metric}</p>
                    <p className="text-xs text-yellow-300/70">
                      Current: {anom.currentValue.toFixed(2)} | Expected: {anom.expectedRange.min.toFixed(2)} -{' '}
                      {anom.expectedRange.max.toFixed(2)}
                    </p>
                  </div>
                  <span className="text-xs bg-yellow-500/20 text-yellow-200 px-2 py-1 rounded">
                    {anom.severity}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Opportunities by Category */}
        <div className="bg-slate-800 border border-slate-700 rounded-lg p-6 mb-8">
          <h2 className="text-xl font-bold text-white mb-4">Optimization Opportunities</h2>
          <p className="text-slate-400 text-sm mb-6">
            {recommendations?.summary.totalOpportunities || 0} opportunities identified • Est. total improvement:{' '}
            <span className="font-semibold text-green-400">
              +{recommendations?.summary.estimatedTotalImprovement.toFixed(1) || 0}%
            </span>
          </p>

          <div className="space-y-3">
            {(recommendations?.opportunities || [])
              .sort((a, b) => b.priority - a.priority)
              .map(opp => (
                <div key={opp.id}>
                  <button
                    onClick={() => setExpandedOpportunity(expandedOpportunity === opp.id ? null : opp.id)}
                    className={`w-full border rounded-lg p-4 text-left transition hover:bg-slate-700/50 ${getSeverityColor(
                      opp.severity
                    )}`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 flex-1">
                        {getCategoryIcon(opp.category)}
                        <div className="min-w-0">
                          <p className="font-semibold">{opp.title}</p>
                          <p className="text-xs opacity-75 truncate">{opp.description}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="font-bold">+{opp.expectedImprovement.toFixed(1)}%</p>
                          <p className="text-xs opacity-75">Expected</p>
                        </div>
                        <ChevronDown
                          className={`w-5 h-5 transition ${
                            expandedOpportunity === opp.id ? 'rotate-180' : ''
                          }`}
                        />
                      </div>
                    </div>
                  </button>

                  {expandedOpportunity === opp.id && (
                    <div className="mt-2 ml-4 pl-4 border-l-2 border-slate-600 space-y-3">
                      <div>
                        <p className="text-xs font-semibold text-slate-300 mb-2">Implementation Steps:</p>
                        <ol className="text-xs text-slate-400 space-y-1 list-decimal list-inside">
                          {opp.implementationSteps.map((step, idx) => (
                            <li key={idx}>{step}</li>
                          ))}
                        </ol>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-xs font-semibold text-slate-300 mb-2">Effort Required:</p>
                          <p className="text-sm text-slate-400 bg-slate-700/50 px-3 py-2 rounded">
                            {opp.estimatedEffort}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-slate-300 mb-2">Priority Score:</p>
                          <p className="text-sm font-bold text-white bg-slate-700/50 px-3 py-2 rounded">
                            {opp.priority.toFixed(1)}/100
                          </p>
                        </div>
                      </div>

                      {opp.risks.length > 0 && (
                        <div>
                          <p className="text-xs font-semibold text-slate-300 mb-2">Identified Risks:</p>
                          <ul className="text-xs text-slate-400 space-y-1 list-disc list-inside">
                            {opp.risks.map((risk, idx) => (
                              <li key={idx}>{risk}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
          </div>
        </div>

        {/* DAO Stats */}
        {status.treasury && (
          <div className="grid grid-cols-3 gap-6 mb-8">
            {/* Treasury Stats */}
            <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
              <div className="flex items-center gap-2 mb-4">
                <DollarSign className="w-5 h-5 text-green-400" />
                <h3 className="text-lg font-bold text-white">Treasury</h3>
              </div>
              <div className="space-y-3">
                <div>
                  <p className="text-slate-400 text-xs">Balance</p>
                  <p className="text-2xl font-bold text-white">${status.treasury.balance?.toLocaleString() || 0}</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-slate-400 text-xs">Burn Rate</p>
                    <p className="text-sm font-bold text-red-400">
                      ${status.treasury.burnRate?.toLocaleString() || 0}/mo
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-400 text-xs">Runway</p>
                    <p className="text-sm font-bold text-amber-400">{status.treasury.runway?.toFixed(1) || 0}mo</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Governance Stats */}
            <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
              <div className="flex items-center gap-2 mb-4">
                <Shield className="w-5 h-5 text-blue-400" />
                <h3 className="text-lg font-bold text-white">Governance</h3>
              </div>
              <div className="space-y-3">
                <div>
                  <p className="text-slate-400 text-xs">Participation Rate</p>
                  <p className="text-2xl font-bold text-white">
                    {status.governance?.participationRate?.toFixed(1) || 0}%
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-slate-400 text-xs">Success Rate</p>
                    <p className="text-sm font-bold text-green-400">
                      {status.governance?.proposalSuccessRate?.toFixed(1) || 0}%
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-400 text-xs">Quorum Met</p>
                    <p className="text-sm font-bold text-blue-400">
                      {(status.governance?.quorumMet || 0) > 0 ? 'Yes' : 'No'}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Community Stats */}
            <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
              <div className="flex items-center gap-2 mb-4">
                <Users className="w-5 h-5 text-purple-400" />
                <h3 className="text-lg font-bold text-white">Community</h3>
              </div>
              <div className="space-y-3">
                <div>
                  <p className="text-slate-400 text-xs">Active Members</p>
                  <p className="text-2xl font-bold text-white">{status.community?.activeMembers || 0}</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-slate-400 text-xs">Engagement</p>
                    <p className="text-sm font-bold text-purple-400">
                      {status.community?.engagementScore?.toFixed(1) || 0}%
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-400 text-xs">Retention</p>
                    <p className="text-sm font-bold text-purple-400">
                      {status.community?.retentionRate?.toFixed(1) || 0}%
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
