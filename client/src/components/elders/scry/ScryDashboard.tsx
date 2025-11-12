import React, { useState, useEffect } from 'react';
import { AlertTriangle, Eye, TrendingUp, Shield, Activity, Zap } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

interface ThreatStats {
  totalThreatsDetected: number;
  criticalThreats: number;
  activeMonitoredDAOs: number;
  analysisCount: number;
}

interface DaoMetrics {
  daoId: string;
  threats: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  healthTrend: 'improving' | 'stable' | 'declining' | 'volatile';
  latestPatterns: string[];
}

interface ScryHealthStatus {
  elderName: string;
  status: string;
  active: boolean;
  monitoredDAOs: number;
  threatsDetected: number;
  lastAnalysis: string;
}

/**
 * Main router component for ELD-SCRY threat dashboard
 * Routes to appropriate dashboard based on user role
 */
export default function ScryDashboard() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    checkSystemHealth();
  }, []);

  const checkSystemHealth = async () => {
    try {
      const response = await fetch('/api/elders/scry/health');
      if (!response.ok) throw new Error('System health check failed');
      setLoading(false);
    } catch (err) {
      setError((err as Error).message);
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-400">Initializing ELD-SCRY threat detection...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center">
        <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-6 max-w-md">
          <h3 className="text-red-400 font-bold mb-2">Connection Error</h3>
          <p className="text-red-300 text-sm">{error}</p>
        </div>
      </div>
    );
  }

  // Route based on user role
  if (user?.role === 'superuser') {
    return <SuperuserThreatDashboard />;
  }

  return <DAOMemberThreatDashboard />;
}

/**
 * Superuser dashboard - system-wide threat monitoring
 * Shows all DAOs, global threats, and system metrics
 */
function SuperuserThreatDashboard() {
  const [threatStats, setThreatStats] = useState<ThreatStats | null>(null);
  const [daoMetrics, setDaoMetrics] = useState<DaoMetrics[]>([]);
  const [selectedDao, setSelectedDao] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchThreatDashboard();
    const interval = setInterval(fetchThreatDashboard, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, []);

  const fetchThreatDashboard = async () => {
    try {
      setRefreshing(true);
      const response = await fetch('/api/elders/scry/dashboard', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) throw new Error('Failed to fetch dashboard');
      const data = await response.json();

      if (data.success) {
        setThreatStats(data.threatStats);
        setDaoMetrics(data.daos || []);
      }
    } catch (error) {
      console.error('Failed to fetch threat dashboard:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 p-8">
        <div className="text-center text-gray-400">Loading threat intelligence...</div>
      </div>
    );
  }

  const criticalDAOs = daoMetrics.filter(d => d.riskLevel === 'critical');
  const highRiskDAOs = daoMetrics.filter(d => d.riskLevel === 'high');

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-4xl font-bold text-white flex items-center gap-3">
              <Shield className="w-10 h-10 text-red-500" />
              ELD-SCRY Threat Intelligence
            </h1>
            <div className="text-sm text-gray-400 flex items-center gap-2">
              {refreshing && <Zap className="w-4 h-4 animate-pulse text-blue-500" />}
              <span>Last updated: {new Date().toLocaleTimeString()}</span>
            </div>
          </div>
          <p className="text-gray-400">System-wide threat monitoring and early warning system</p>
        </div>

        {/* Threat Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <StatCard
            label="Total Threats"
            value={threatStats?.totalThreatsDetected || 0}
            icon={Eye}
            color="blue"
          />
          <StatCard
            label="Critical Threats"
            value={threatStats?.criticalThreats || 0}
            icon={AlertTriangle}
            color="red"
            highlight={threatStats?.criticalThreats ? true : false}
          />
          <StatCard
            label="Monitored DAOs"
            value={threatStats?.activeMonitoredDAOs || 0}
            icon={Shield}
            color="green"
          />
          <StatCard
            label="Analyses Run"
            value={threatStats?.analysisCount || 0}
            icon={TrendingUp}
            color="purple"
          />
        </div>

        {/* Critical Alert */}
        {criticalDAOs.length > 0 && (
          <div className="mb-8 bg-red-500/20 border border-red-500/50 rounded-lg p-6">
            <h3 className="text-xl font-bold text-red-400 mb-4 flex items-center gap-2">
              <AlertTriangle className="w-6 h-6" />
              {criticalDAOs.length} Critical Threat{criticalDAOs.length !== 1 ? 's' : ''} - Immediate Action Required
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {criticalDAOs.map(dao => (
                <button
                  key={dao.daoId}
                  onClick={() => setSelectedDao(dao.daoId)}
                  className="bg-slate-900/50 p-4 rounded border border-red-500/30 hover:bg-slate-800/50 transition text-left"
                >
                  <p className="font-semibold text-white">{dao.daoId}</p>
                  <p className="text-sm text-red-300">{dao.threats} threats detected</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* DAO Risk Distribution */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Critical DAOs */}
          <RiskLevelPanel
            title={`Critical Risk (${criticalDAOs.length})`}
            daos={criticalDAOs}
            color="red"
            onSelect={setSelectedDao}
          />

          {/* High Risk DAOs */}
          <RiskLevelPanel
            title={`High Risk (${highRiskDAOs.length})`}
            daos={highRiskDAOs}
            color="yellow"
            onSelect={setSelectedDao}
          />

          {/* All DAOs */}
          <div className="bg-slate-700/50 rounded-lg p-6 border border-slate-600">
            <h3 className="text-lg font-bold text-white mb-4">All DAOs by Risk</h3>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {daoMetrics
                .sort((a, b) => b.threats - a.threats)
                .map(dao => (
                  <button
                    key={dao.daoId}
                    onClick={() => setSelectedDao(dao.daoId)}
                    className="w-full p-2 bg-slate-600/30 rounded hover:bg-slate-600/50 transition text-left"
                  >
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-300">{dao.daoId}</span>
                      <span className={`text-xs font-bold px-2 py-1 rounded ${
                        dao.riskLevel === 'critical' ? 'bg-red-500/50 text-red-300' :
                        dao.riskLevel === 'high' ? 'bg-yellow-500/50 text-yellow-300' :
                        dao.riskLevel === 'medium' ? 'bg-orange-500/50 text-orange-300' :
                        'bg-green-500/50 text-green-300'
                      }`}>
                        {dao.threats}
                      </span>
                    </div>
                  </button>
                ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * DAO member dashboard - DAO-specific threat overview
 * Shows threats and forecasts for their DAO only
 */
function DAOMemberThreatDashboard() {
  const { user } = useAuth();
  const daoId = user?.daos?.[0];

  const [threats, setThreats] = useState<any[]>([]);
  const [forecast, setForecast] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'threats' | 'forecast'>('threats');

  useEffect(() => {
    if (daoId) {
      fetchDAOData();
      const interval = setInterval(fetchDAOData, 30000);
      return () => clearInterval(interval);
    }
  }, [daoId]);

  const fetchDAOData = async () => {
    if (!daoId) return;

    try {
      const token = localStorage.getItem('token');
      const [threatsRes, forecastRes] = await Promise.all([
        fetch(`/api/elders/scry/dao/${daoId}/threats`, {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch(`/api/elders/scry/dao/${daoId}/forecast`, {
          headers: { 'Authorization': `Bearer ${token}` }
        })
      ]);

      if (threatsRes.ok) {
        const threatsData = await threatsRes.json();
        setThreats(threatsData.threats || []);
      }

      if (forecastRes.ok) {
        const forecastData = await forecastRes.json();
        setForecast(forecastData.forecast);
      }
    } catch (error) {
      console.error('Failed to fetch DAO data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 p-8">
        <div className="text-center text-gray-400">Loading DAO threat intelligence...</div>
      </div>
    );
  }

  const criticalThreats = threats.filter(t => t.severity === 'critical');
  const healthScore = forecast?.predictedScore || 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2 flex items-center gap-3">
            <Shield className="w-10 h-10 text-blue-500" />
            DAO Security Status
          </h1>
          <p className="text-gray-400">Threats and forecasts for {daoId}</p>
        </div>

        {/* Health Score Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-slate-700/50 rounded-lg p-6 border border-slate-600">
            <p className="text-gray-400 text-sm mb-2">Health Score (24h Forecast)</p>
            <div className="flex items-end justify-between">
              <div>
                <p className="text-4xl font-bold text-white">{Math.round(healthScore)}</p>
                <p className="text-xs text-gray-500 mt-1">
                  Confidence: {Math.round((forecast?.confidence || 0) * 100)}%
                </p>
              </div>
              <div className={`text-sm font-bold px-3 py-1 rounded ${
                healthScore >= 70 ? 'bg-green-500/30 text-green-300' :
                healthScore >= 50 ? 'bg-yellow-500/30 text-yellow-300' :
                'bg-red-500/30 text-red-300'
              }`}>
                {healthScore >= 70 ? 'Healthy' : healthScore >= 50 ? 'At Risk' : 'Critical'}
              </div>
            </div>
          </div>

          <div className="bg-red-500/20 rounded-lg p-6 border border-red-500/30">
            <p className="text-red-300 text-sm mb-2">Threats Detected</p>
            <p className="text-4xl font-bold text-red-400">{threats.length}</p>
            <p className="text-xs text-red-300 mt-1">
              {criticalThreats.length} critical
            </p>
          </div>

          <div className="bg-slate-700/50 rounded-lg p-6 border border-slate-600">
            <p className="text-gray-400 text-sm mb-2">Analysis Horizon</p>
            <p className="text-3xl font-bold text-white">24h</p>
            <p className="text-xs text-gray-500 mt-1">Forecast window</p>
          </div>
        </div>

        {/* Critical Threats Alert */}
        {criticalThreats.length > 0 && (
          <div className="mb-8 bg-red-500/20 border border-red-500/50 rounded-lg p-6">
            <h3 className="text-xl font-bold text-red-400 mb-4 flex items-center gap-2">
              <AlertTriangle className="w-6 h-6" />
              Critical Threats
            </h3>
            <div className="space-y-3">
              {criticalThreats.map(threat => (
                <div key={threat.patternId} className="bg-slate-900/50 p-4 rounded border border-red-500/30">
                  <div className="flex justify-between items-start mb-2">
                    <h4 className="font-bold text-white">{threat.type}</h4>
                    <span className="text-xs font-bold px-2 py-1 rounded bg-red-500/50 text-red-300">CRITICAL</span>
                  </div>
                  <p className="text-sm text-gray-300 mb-2">
                    Confidence: {Math.round(threat.confidence * 100)}%
                  </p>
                  {threat.affectedEntities?.length > 0 && (
                    <p className="text-xs text-gray-500">
                      Affected: {threat.affectedEntities.join(', ')}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tab Navigation */}
        <div className="flex gap-4 mb-8 border-b border-slate-600">
          <button
            onClick={() => setActiveTab('threats')}
            className={`px-4 py-2 font-semibold transition ${
              activeTab === 'threats'
                ? 'text-white border-b-2 border-blue-500'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Threats ({threats.length})
          </button>
          <button
            onClick={() => setActiveTab('forecast')}
            className={`px-4 py-2 font-semibold transition ${
              activeTab === 'forecast'
                ? 'text-white border-b-2 border-blue-500'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            24-Hour Forecast
          </button>
        </div>

        {/* Tab Content */}
        {activeTab === 'threats' ? (
          <ThreatsView threats={threats} />
        ) : (
          <ForecastView forecast={forecast} />
        )}
      </div>
    </div>
  );
}

/**
 * Supporting components
 */

function StatCard({ label, value, icon: Icon, color, highlight }: any) {
  const colorStyles = {
    blue: 'bg-slate-700/50 border-slate-600',
    red: 'bg-red-500/20 border-red-500/30',
    green: 'bg-slate-700/50 border-slate-600',
    purple: 'bg-slate-700/50 border-slate-600'
  };

  const iconColors = {
    blue: 'text-blue-500 opacity-30',
    red: 'text-red-500 opacity-50',
    green: 'text-green-500 opacity-30',
    purple: 'text-purple-500 opacity-30'
  };

  return (
    <div className={`rounded-lg p-6 border ${colorStyles[color as keyof typeof colorStyles]}`}>
      <div className="flex items-center justify-between">
        <div>
          <p className={`${color === 'red' ? 'text-red-300' : 'text-gray-400'} text-sm mb-2`}>{label}</p>
          <p className="text-3xl font-bold text-white">{value}</p>
        </div>
        <Icon className={`w-12 h-12 ${iconColors[color as keyof typeof iconColors]}`} />
      </div>
    </div>
  );
}

function RiskLevelPanel({ title, daos, color, onSelect }: any) {
  const borderColor = color === 'red' ? 'border-red-500/30' : 'border-yellow-500/30';
  const titleColor = color === 'red' ? 'text-red-400' : 'text-yellow-400';

  return (
    <div className={`bg-slate-700/50 rounded-lg p-6 border ${borderColor}`}>
      <h3 className={`text-lg font-bold ${titleColor} mb-4`}>{title}</h3>
      <div className="space-y-2">
        {daos.length === 0 ? (
          <p className="text-gray-400 text-sm">No DAOs at this risk level</p>
        ) : (
          daos.map((dao: any) => (
            <button
              key={dao.daoId}
              onClick={() => onSelect(dao.daoId)}
              className="w-full p-3 bg-slate-600/30 rounded hover:bg-slate-600/50 transition text-left"
            >
              <p className="font-semibold text-white">{dao.daoId}</p>
              <p className="text-sm text-gray-300">{dao.threats} threats</p>
            </button>
          ))
        )}
      </div>
    </div>
  );
}

function ThreatsView({ threats }: any) {
  if (threats.length === 0) {
    return (
      <div className="bg-slate-700/50 rounded-lg p-6 border border-slate-600 text-center text-gray-400">
        <Activity className="w-8 h-8 mx-auto mb-2 opacity-50" />
        <p>No threats detected ✓</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {threats
        .sort((a: any, b: any) => {
          const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
          return (severityOrder[a.severity as keyof typeof severityOrder] || 4) - 
                 (severityOrder[b.severity as keyof typeof severityOrder] || 4);
        })
        .map((threat: any) => (
          <div
            key={threat.patternId}
            className={`rounded-lg p-4 border ${
              threat.severity === 'critical' ? 'bg-red-500/20 border-red-500/50' :
              threat.severity === 'high' ? 'bg-yellow-500/20 border-yellow-500/50' :
              'bg-slate-700/50 border-slate-600'
            }`}
          >
            <div className="flex justify-between items-start mb-2">
              <h4 className="font-bold text-white">{threat.type}</h4>
              <span className={`text-xs font-bold px-2 py-1 rounded uppercase ${
                threat.severity === 'critical' ? 'bg-red-500/50 text-red-300' :
                threat.severity === 'high' ? 'bg-yellow-500/50 text-yellow-300' :
                'bg-slate-600 text-gray-300'
              }`}>
                {threat.severity}
              </span>
            </div>
            <p className="text-sm text-gray-300 mb-1">
              Confidence: {Math.round(threat.confidence * 100)}%
            </p>
            <p className="text-xs text-gray-500">
              {new Date(threat.timestamp).toLocaleString()}
            </p>
          </div>
        ))}
    </div>
  );
}

function ForecastView({ forecast }: any) {
  if (!forecast) {
    return (
      <div className="bg-slate-700/50 rounded-lg p-6 border border-slate-600 text-center text-gray-400">
        <p>No forecast available yet</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      {/* Chart placeholder */}
      <div className="lg:col-span-2 bg-slate-700/50 rounded-lg p-6 border border-slate-600">
        <h4 className="font-bold text-white mb-4">24-Hour Health Forecast</h4>
        <div className="h-64 bg-slate-600/30 rounded flex items-center justify-center text-gray-500">
          [Chart rendering here]
        </div>
      </div>

      {/* Risk Factors */}
      <div className="bg-slate-700/50 rounded-lg p-6 border border-slate-600">
        <h4 className="font-bold text-white mb-4">Risk Factors</h4>
        {forecast.riskFactors?.length > 0 ? (
          <div className="space-y-3">
            {forecast.riskFactors.map((factor: any, idx: number) => (
              <div key={idx} className="p-3 bg-slate-600/30 rounded">
                <div className="flex justify-between items-start mb-1">
                  <span className="font-semibold text-white capitalize">{factor.category}</span>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                    factor.riskLevel === 'critical' ? 'bg-red-500/50 text-red-300' :
                    factor.riskLevel === 'high' ? 'bg-yellow-500/50 text-yellow-300' :
                    'bg-blue-500/50 text-blue-300'
                  }`}>
                    {factor.riskLevel}
                  </span>
                </div>
                <p className="text-xs text-gray-400">{factor.description}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-400 text-sm">No major risk factors</p>
        )}
      </div>
    </div>
  );
}
