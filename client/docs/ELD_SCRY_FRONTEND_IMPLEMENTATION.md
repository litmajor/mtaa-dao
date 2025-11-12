# ELD-SCRY Frontend Dashboard Implementation

## Overview

This guide covers implementing the threat detection dashboard for ELD-SCRY. Two separate dashboards:
1. **Superuser Dashboard**: System-wide threat monitoring
2. **DAO Member Dashboard**: DAO-specific threat overview

---

## Components Structure

```
src/components/elders/
├── scry/
│   ├── ScryDashboard.tsx          (Router/Container)
│   ├── SuperuserThreatDashboard.tsx
│   ├── DAOMemberThreatDashboard.tsx
│   ├── ThreatCard.tsx
│   ├── ThreatTimeline.tsx
│   ├── ForecastChart.tsx
│   ├── RiskFactorChart.tsx
│   └── EarlyWarningAlert.tsx
```

---

## 1. Main Router Component

### `ScryDashboard.tsx`

```typescript
import React, { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import SuperuserThreatDashboard from './SuperuserThreatDashboard';
import DAOMemberThreatDashboard from './DAOMemberThreatDashboard';

export default function ScryDashboard() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch initial data
    setLoading(false);
  }, []);

  if (loading) {
    return <div className="p-8 text-center">Loading...</div>;
  }

  // Route based on user role
  if (user?.role === 'superuser') {
    return <SuperuserThreatDashboard />;
  }

  return <DAOMemberThreatDashboard />;
}
```

---

## 2. Superuser Dashboard

### `SuperuserThreatDashboard.tsx`

```typescript
import React, { useState, useEffect } from 'react';
import { AlertTriangle, Eye, TrendingUp, Shield } from 'lucide-react';
import ThreatCard from './ThreatCard';
import ThreatTimeline from './ThreatTimeline';
import EarlyWarningAlert from './EarlyWarningAlert';

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

export default function SuperuserThreatDashboard() {
  const [threatStats, setThreatStats] = useState<ThreatStats | null>(null);
  const [daoMetrics, setDaoMetrics] = useState<DaoMetrics[]>([]);
  const [selectedDao, setSelectedDao] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchThreatDashboard();
    const interval = setInterval(fetchThreatDashboard, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, []);

  const fetchThreatDashboard = async () => {
    try {
      const response = await fetch('/api/elders/scry/dashboard', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      const data = await response.json();
      
      if (data.success) {
        setThreatStats(data.threatStats);
        setDaoMetrics(data.daos || []);
      }
    } catch (error) {
      console.error('Failed to fetch threat dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="p-8">Loading threat intelligence...</div>;
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
            <div className="text-sm text-gray-400">
              Last updated: {new Date().toLocaleTimeString()}
            </div>
          </div>
          <p className="text-gray-400">System-wide threat monitoring and early warning</p>
        </div>

        {/* Threat Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-slate-700/50 rounded-lg p-6 border border-slate-600">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Total Threats</p>
                <p className="text-3xl font-bold text-white">
                  {threatStats?.totalThreatsDetected || 0}
                </p>
              </div>
              <Eye className="w-12 h-12 text-blue-500 opacity-30" />
            </div>
          </div>

          <div className="bg-red-500/20 rounded-lg p-6 border border-red-500/30">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-red-300 text-sm">Critical Threats</p>
                <p className="text-3xl font-bold text-red-400">
                  {threatStats?.criticalThreats || 0}
                </p>
              </div>
              <AlertTriangle className="w-12 h-12 text-red-500 opacity-50" />
            </div>
          </div>

          <div className="bg-slate-700/50 rounded-lg p-6 border border-slate-600">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Monitored DAOs</p>
                <p className="text-3xl font-bold text-white">
                  {threatStats?.activeMonitoredDAOs || 0}
                </p>
              </div>
              <Shield className="w-12 h-12 text-green-500 opacity-30" />
            </div>
          </div>

          <div className="bg-slate-700/50 rounded-lg p-6 border border-slate-600">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Analyses</p>
                <p className="text-3xl font-bold text-white">
                  {threatStats?.analysisCount || 0}
                </p>
              </div>
              <TrendingUp className="w-12 h-12 text-purple-500 opacity-30" />
            </div>
          </div>
        </div>

        {/* Critical Threats Alert */}
        {criticalDAOs.length > 0 && (
          <div className="mb-8 bg-red-500/20 border border-red-500/50 rounded-lg p-6">
            <h3 className="text-xl font-bold text-red-400 mb-4 flex items-center gap-2">
              <AlertTriangle className="w-6 h-6" />
              Critical Threats - Immediate Action Required
            </h3>
            <div className="space-y-3">
              {criticalDAOs.map(dao => (
                <div
                  key={dao.daoId}
                  className="bg-slate-900/50 p-4 rounded border border-red-500/30 cursor-pointer hover:bg-slate-800/50"
                  onClick={() => setSelectedDao(dao.daoId)}
                >
                  <p className="font-semibold text-white">{dao.daoId}</p>
                  <p className="text-sm text-red-300">{dao.threats} threats detected</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Risk Level Distribution */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
          {/* Critical DAOs */}
          <div className="bg-slate-700/50 rounded-lg p-6 border border-red-500/30">
            <h3 className="text-lg font-bold text-red-400 mb-4">Critical Risk ({criticalDAOs.length})</h3>
            <div className="space-y-2">
              {criticalDAOs.map(dao => (
                <ThreatCard key={dao.daoId} dao={dao} onClick={() => setSelectedDao(dao.daoId)} />
              ))}
            </div>
          </div>

          {/* High Risk DAOs */}
          <div className="bg-slate-700/50 rounded-lg p-6 border border-yellow-500/30">
            <h3 className="text-lg font-bold text-yellow-400 mb-4">High Risk ({highRiskDAOs.length})</h3>
            <div className="space-y-2">
              {highRiskDAOs.map(dao => (
                <ThreatCard key={dao.daoId} dao={dao} onClick={() => setSelectedDao(dao.daoId)} />
              ))}
            </div>
          </div>

          {/* All DAOs Sorted by Threat Count */}
          <div className="bg-slate-700/50 rounded-lg p-6 border border-slate-600">
            <h3 className="text-lg font-bold text-white mb-4">All DAOs by Risk</h3>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {daoMetrics.sort((a, b) => b.threats - a.threats).map(dao => (
                <div
                  key={dao.daoId}
                  className="p-2 bg-slate-600/30 rounded cursor-pointer hover:bg-slate-600/50 transition"
                  onClick={() => setSelectedDao(dao.daoId)}
                >
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-300">{dao.daoId}</span>
                    <span className={`text-xs font-bold px-2 py-1 rounded ${
                      dao.riskLevel === 'critical' ? 'bg-red-500/50 text-red-300' :
                      dao.riskLevel === 'high' ? 'bg-yellow-500/50 text-yellow-300' :
                      dao.riskLevel === 'medium' ? 'bg-orange-500/50 text-orange-300' :
                      'bg-green-500/50 text-green-300'
                    }`}>
                      {dao.threats} threats
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Selected DAO Details */}
        {selectedDao && (
          <div className="bg-slate-700/50 rounded-lg p-6 border border-slate-600">
            <h3 className="text-xl font-bold text-white mb-4">Selected DAO: {selectedDao}</h3>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <ThreatTimeline daoId={selectedDao} />
              <ForecastChart daoId={selectedDao} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
```

---

## 3. DAO Member Dashboard

### `DAOMemberThreatDashboard.tsx`

```typescript
import React, { useState, useEffect } from 'react';
import { AlertTriangle, TrendingDown, Clock } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import ForecastChart from './ForecastChart';
import RiskFactorChart from './RiskFactorChart';
import EarlyWarningAlert from './EarlyWarningAlert';

interface Threat {
  patternId: string;
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  confidence: number;
  affectedEntities: string[];
  timestamp: string;
}

interface Forecast {
  timeframeHours: number;
  predictedScore: number;
  confidence: number;
  riskFactors: RiskFactor[];
  earlyWarnings: EarlyWarning[];
}

interface RiskFactor {
  category: string;
  riskLevel: string;
  probability: number;
  impact: number;
  description: string;
}

interface EarlyWarning {
  id: string;
  severity: 'warning' | 'alert' | 'critical';
  message: string;
  timeToEvent: number;
  requiredAction: string;
}

export default function DAOMemberThreatDashboard() {
  const { user } = useAuth();
  const daoId = user?.daos?.[0]; // Primary DAO

  const [threats, setThreats] = useState<Threat[]>([]);
  const [forecast, setForecast] = useState<Forecast | null>(null);
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
      const [threatsRes, forecastRes] = await Promise.all([
        fetch(`/api/elders/scry/dao/${daoId}/threats`, {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        }),
        fetch(`/api/elders/scry/dao/${daoId}/forecast`, {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        })
      ]);

      const threatsData = await threatsRes.json();
      const forecastData = await forecastRes.json();

      if (threatsData.success) setThreats(threatsData.threats || []);
      if (forecastData.success) setForecast(forecastData.forecast);
    } catch (error) {
      console.error('Failed to fetch DAO data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="p-8">Loading threat intelligence...</div>;
  }

  const criticalThreats = threats.filter(t => t.severity === 'critical');
  const highThreats = threats.filter(t => t.severity === 'high');
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

        {/* Health Score Card */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-slate-700/50 rounded-lg p-6 border border-slate-600">
            <p className="text-gray-400 text-sm mb-2">Health Score (24h Forecast)</p>
            <div className="flex items-end justify-between">
              <div>
                <p className="text-4xl font-bold text-white">{healthScore}</p>
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
              {criticalThreats.length} critical, {highThreats.length} high
            </p>
          </div>

          <div className="bg-slate-700/50 rounded-lg p-6 border border-slate-600">
            <p className="text-gray-400 text-sm mb-2">Analysis</p>
            <p className="text-3xl font-bold text-white">24h</p>
            <p className="text-xs text-gray-500 mt-1">Forecast horizon</p>
          </div>
        </div>

        {/* Critical Alerts */}
        {criticalThreats.length > 0 && (
          <div className="mb-8 bg-red-500/20 border border-red-500/50 rounded-lg p-6">
            <h3 className="text-xl font-bold text-red-400 mb-4 flex items-center gap-2">
              <AlertTriangle className="w-6 h-6" />
              Critical Threats
            </h3>
            <div className="space-y-3">
              {criticalThreats.map(threat => (
                <ThreatAlert key={threat.patternId} threat={threat} />
              ))}
            </div>
          </div>
        )}

        {/* Early Warnings from Forecast */}
        {forecast?.earlyWarnings && forecast.earlyWarnings.length > 0 && (
          <div className="mb-8 space-y-3">
            {forecast.earlyWarnings.map(warning => (
              <EarlyWarningAlert key={warning.id} warning={warning} />
            ))}
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
            Current Threats ({threats.length})
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
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {activeTab === 'threats' ? (
            <>
              {/* Threats List */}
              <div className="lg:col-span-2 space-y-4">
                {threats.length === 0 ? (
                  <div className="bg-slate-700/50 rounded-lg p-6 border border-slate-600 text-center text-gray-400">
                    No threats detected ✓
                  </div>
                ) : (
                  threats
                    .sort((a, b) => {
                      const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
                      return severityOrder[a.severity] - severityOrder[b.severity];
                    })
                    .map(threat => (
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
                        <p className="text-sm text-gray-400 mb-2">
                          Confidence: {Math.round(threat.confidence * 100)}%
                        </p>
                        {threat.affectedEntities.length > 0 && (
                          <p className="text-xs text-gray-500">
                            Affected: {threat.affectedEntities.join(', ')}
                          </p>
                        )}
                        <p className="text-xs text-gray-600 mt-2">
                          {new Date(threat.timestamp).toLocaleString()}
                        </p>
                      </div>
                    ))
                )}
              </div>

              {/* Threat Summary */}
              <div className="bg-slate-700/50 rounded-lg p-6 border border-slate-600 h-fit">
                <h4 className="font-bold text-white mb-4">Threat Summary</h4>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Critical</span>
                    <span className="font-bold text-red-400">{criticalThreats.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">High</span>
                    <span className="font-bold text-yellow-400">{highThreats.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Medium/Low</span>
                    <span className="font-bold text-gray-300">
                      {threats.filter(t => t.severity === 'medium' || t.severity === 'low').length}
                    </span>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <>
              {/* Forecast Charts */}
              <div className="lg:col-span-2">
                <ForecastChart daoId={daoId!} />
              </div>

              {/* Risk Factors */}
              <div className="bg-slate-700/50 rounded-lg p-6 border border-slate-600">
                <h4 className="font-bold text-white mb-4">Risk Factors</h4>
                {forecast?.riskFactors && forecast.riskFactors.length > 0 ? (
                  <div className="space-y-3">
                    {forecast.riskFactors.map((factor, idx) => (
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
                        <p className="text-xs text-gray-400 mb-2">{factor.description}</p>
                        <div className="text-xs text-gray-500">
                          Prob: {Math.round(factor.probability * 100)}% | Impact: {factor.impact}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-400 text-sm">No major risk factors identified</p>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
```

---

## 4. Supporting Components

### `ThreatCard.tsx`

```typescript
import React from 'react';
import { AlertTriangle, TrendingUp } from 'lucide-react';

interface DaoMetrics {
  daoId: string;
  threats: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  healthTrend: 'improving' | 'stable' | 'declining' | 'volatile';
  latestPatterns: string[];
}

interface ThreatCardProps {
  dao: DaoMetrics;
  onClick: () => void;
}

export default function ThreatCard({ dao, onClick }: ThreatCardProps) {
  return (
    <div
      onClick={onClick}
      className={`p-3 rounded cursor-pointer transition transform hover:scale-105 ${
        dao.riskLevel === 'critical' ? 'bg-red-500/20 border border-red-500/50 hover:bg-red-500/30' :
        dao.riskLevel === 'high' ? 'bg-yellow-500/20 border border-yellow-500/50 hover:bg-yellow-500/30' :
        'bg-slate-600/30 border border-slate-500/50 hover:bg-slate-600/50'
      }`}
    >
      <div className="flex items-center justify-between mb-1">
        <span className="font-semibold text-white">{dao.daoId}</span>
        <AlertTriangle className="w-4 h-4 text-red-400" />
      </div>
      <div className="flex justify-between items-center text-sm">
        <span className="text-gray-400">{dao.threats} threats</span>
        <span className={`text-xs font-bold uppercase ${
          dao.healthTrend === 'declining' ? 'text-red-300' :
          dao.healthTrend === 'improving' ? 'text-green-300' :
          'text-yellow-300'
        }`}>
          {dao.healthTrend}
        </span>
      </div>
    </div>
  );
}
```

### `EarlyWarningAlert.tsx`

```typescript
import React from 'react';
import { AlertTriangle, AlertCircle, Clock } from 'lucide-react';

interface EarlyWarning {
  id: string;
  severity: 'warning' | 'alert' | 'critical';
  message: string;
  timeToEvent: number;
  requiredAction: string;
}

interface EarlyWarningAlertProps {
  warning: EarlyWarning;
}

export default function EarlyWarningAlert({ warning }: EarlyWarningAlertProps) {
  const bgColor = {
    critical: 'bg-red-500/20 border-red-500/50',
    alert: 'bg-orange-500/20 border-orange-500/50',
    warning: 'bg-yellow-500/20 border-yellow-500/50'
  }[warning.severity];

  const textColor = {
    critical: 'text-red-300',
    alert: 'text-orange-300',
    warning: 'text-yellow-300'
  }[warning.severity];

  return (
    <div className={`${bgColor} border rounded-lg p-4`}>
      <div className="flex items-start gap-3">
        {warning.severity === 'critical' ? (
          <AlertTriangle className={`w-5 h-5 ${textColor} mt-0.5 flex-shrink-0`} />
        ) : (
          <AlertCircle className={`w-5 h-5 ${textColor} mt-0.5 flex-shrink-0`} />
        )}
        <div className="flex-1">
          <h4 className={`font-bold ${textColor} mb-1`}>{warning.message}</h4>
          <p className="text-sm text-gray-300 mb-2">{warning.requiredAction}</p>
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <Clock className="w-4 h-4" />
            <span>Expected in {warning.timeToEvent} hours</span>
          </div>
        </div>
      </div>
    </div>
  );
}
```

### `ForecastChart.tsx`

```typescript
import React, { useEffect, useState } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts';

interface ChartData {
  time: string;
  score: number;
}

interface ForecastChartProps {
  daoId: string;
}

export default function ForecastChart({ daoId }: ForecastChartProps) {
  const [data, setData] = useState<ChartData[]>([]);

  useEffect(() => {
    // Generate mock forecast data
    const mockData: ChartData[] = [];
    for (let i = 0; i < 24; i++) {
      mockData.push({
        time: `${i}:00`,
        score: 70 - Math.random() * 30 + (i * 0.5)
      });
    }
    setData(mockData);
  }, [daoId]);

  return (
    <div className="bg-slate-700/50 rounded-lg p-6 border border-slate-600">
      <h4 className="font-bold text-white mb-4">24-Hour Health Forecast</h4>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(100,116,139,0.3)" />
          <XAxis dataKey="time" stroke="rgba(148,163,184,0.5)" />
          <YAxis domain={[0, 100]} stroke="rgba(148,163,184,0.5)" />
          <Tooltip
            contentStyle={{ backgroundColor: 'rgba(15,23,42,0.9)', border: '1px solid rgba(71,85,105,0.5)' }}
            labelStyle={{ color: '#e2e8f0' }}
          />
          <Line
            type="monotone"
            dataKey="score"
            stroke="#3b82f6"
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
```

---

## Installation & Usage

### Add to Route

```typescript
// In src/pages/dashboard.tsx or your routing file
import ScryDashboard from '@/components/elders/scry/ScryDashboard';

export default function DashboardPage() {
  return <ScryDashboard />;
}
```

### Required Dependencies

```bash
npm install recharts lucide-react
```

### CSS Requirements

Ensure Tailwind CSS is configured with slate color palette:

```javascript
// tailwind.config.ts
module.exports = {
  theme: {
    extend: {
      colors: {
        slate: { /* Tailwind default */ }
      }
    }
  }
}
```

---

## Real-time Updates

Add WebSocket support for live threat updates:

```typescript
useEffect(() => {
  const ws = new WebSocket(`wss://localhost:5000/ws/scry/${daoId}`);
  
  ws.onmessage = (event) => {
    const message = JSON.parse(event.data);
    if (message.type === 'THREAT_ALERT') {
      setThreats(prev => [message.threat, ...prev]);
      // Show toast notification
      showNotification(message.threat.type, 'error');
    }
  };

  return () => ws.close();
}, [daoId]);
```

---

## Next Steps

1. Implement WebSocket for real-time updates
2. Add threat detail modal
3. Create threat history timeline
4. Build threat comparison across DAOs
5. Add filtering and sorting options
6. Implement threat export (PDF/CSV)
