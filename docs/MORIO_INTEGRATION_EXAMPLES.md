/**
 * Morio Data Hub - Complete Integration Examples
 * 
 * Real-world examples for integrating Morio into your application
 */

// ============================================================================
// EXAMPLE 1: Server Integration
// ============================================================================

import express from 'express';
import { createServer } from 'http';
import morioRoutes from './routes/morio-data-hub';
import { createMorioWebSocketServer } from './websocket/morio-websocket';

export async function setupMorioInServer() {
  const app = express();

  // Add other middleware...
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Mount Morio routes
  app.use('/api/morio', morioRoutes);

  // Create HTTP server for WebSocket
  const httpServer = createServer(app);

  // Initialize WebSocket server
  const wsServer = createMorioWebSocketServer(httpServer);

  // Start server
  const PORT = process.env.PORT || 3000;
  httpServer.listen(PORT, () => {
    console.log(`✅ Morio Data Hub running on port ${PORT}`);
  });

  return { httpServer, wsServer };
}

// ============================================================================
// EXAMPLE 2: React Dashboard Component
// ============================================================================

import React from 'react';
import { useMorioDashboard, useMorioRealTime } from '@/hooks/useMorioDataHub';

export function MorioDashboard() {
  const { data: dashboard, isLoading } = useMorioDashboard();
  const { systemStatus, alerts, isConnected } = useMorioRealTime();

  if (isLoading) {
    return <div className="loading">Loading dashboard...</div>;
  }

  return (
    <div className="morio-dashboard">
      {/* Header with connection status */}
      <div className="dashboard-header">
        <h1>Morio Data Hub Dashboard</h1>
        <div className={`connection-status ${isConnected ? 'connected' : 'disconnected'}`}>
          {isConnected ? '🟢 Connected' : '🔴 Disconnected'}
        </div>
      </div>

      {/* Alerts section */}
      {alerts.length > 0 && (
        <div className="alerts-section">
          <h2>Recent Alerts ({alerts.length})</h2>
          {alerts.slice(0, 5).map(alert => (
            <div key={alert.id} className={`alert alert-${alert.severity}`}>
              <h3>{alert.title}</h3>
              <p>{alert.description}</p>
            </div>
          ))}
        </div>
      )}

      {/* System status */}
      {systemStatus && (
        <div className="system-status">
          <h2>System Status: {systemStatus.overall}</h2>
          <div className="components-grid">
            {Object.entries(systemStatus.components).map(([name, component]: any) => (
              <div key={name} className="component-card">
                <h3>{name}</h3>
                <p>Status: {component.status}</p>
                {component.uptime && <p>Uptime: {component.uptime}%</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Dashboard sections */}
      {dashboard?.sections && (
        <div className="sections-grid">
          {Object.entries(dashboard.sections).map(([key, section]: any) => (
            <DashboardSection key={key} section={section} />
          ))}
        </div>
      )}
    </div>
  );
}

function DashboardSection({ section }: any) {
  return (
    <div className="section-card">
      <div className="section-header">
        <span className="section-icon">{section.icon}</span>
        <h2>{section.title}</h2>
      </div>
      <p className="section-description">{section.description}</p>
      <div className="metrics-grid">
        {section.data.map((metric: any, idx: number) => (
          <Metric key={idx} metric={metric} />
        ))}
      </div>
      <p className="last-updated">Last updated: {new Date(section.lastUpdated).toLocaleTimeString()}</p>
    </div>
  );
}

function Metric({ metric }: any) {
  return (
    <div className={`metric metric-${metric.severity}`}>
      <span className="label">{metric.label}</span>
      <span className="value">{metric.value}</span>
      <span className="unit">{metric.unit}</span>
      {metric.trend && <span className="trend">{getTrendIcon(metric.trend)}</span>}
    </div>
  );
}

function getTrendIcon(trend: string) {
  switch (trend) {
    case 'up': return '📈';
    case 'down': return '📉';
    case 'stable': return '➡️';
    default: return '—';
  }
}

// ============================================================================
// EXAMPLE 3: Alerts Component with Real-Time Updates
// ============================================================================

import { useEffect, useState } from 'react';

export function AlertsMonitor() {
  const { alerts } = useMorioRealTime();
  const [displayedAlerts, setDisplayedAlerts] = useState<any[]>([]);

  useEffect(() => {
    // Show toast notification for new alerts
    alerts.forEach(alert => {
      if (!alert.read) {
        showNotification(alert);
      }
    });

    setDisplayedAlerts(alerts);
  }, [alerts]);

  function showNotification(alert: any) {
    // Implementation for toast/notification
    console.log(`New alert: ${alert.title}`);
  }

  return (
    <div className="alerts-monitor">
      <h2>System Alerts</h2>
      {displayedAlerts.length === 0 ? (
        <p className="no-alerts">✅ No active alerts</p>
      ) : (
        <div className="alerts-list">
          {displayedAlerts.map(alert => (
            <AlertItem key={alert.id} alert={alert} />
          ))}
        </div>
      )}
    </div>
  );
}

function AlertItem({ alert }: any) {
  const severityColors: Record<string, string> = {
    success: 'bg-green-100 border-green-300 text-green-800',
    warning: 'bg-yellow-100 border-yellow-300 text-yellow-800',
    danger: 'bg-red-100 border-red-300 text-red-800',
    info: 'bg-blue-100 border-blue-300 text-blue-800'
  };

  return (
    <div className={`alert-item border-l-4 p-4 ${severityColors[alert.severity]}`}>
      <div className="alert-header">
        <h3 className="font-bold">{alert.title}</h3>
        <time className="text-sm">{new Date(alert.timestamp).toLocaleTimeString()}</time>
      </div>
      <p className="mt-2">{alert.description}</p>
      {alert.action && (
        <button className="mt-3 px-3 py-1 bg-current rounded hover:opacity-80">
          {alert.action}
        </button>
      )}
    </div>
  );
}

// ============================================================================
// EXAMPLE 4: Performance Metrics Display
// ============================================================================

export function PerformanceMetrics() {
  const { performance } = useMorioRealTime();

  if (!performance) {
    return <div>Loading metrics...</div>;
  }

  return (
    <div className="performance-metrics">
      <h2>System Performance</h2>
      <div className="metrics-container">
        <MetricCard
          label="Uptime"
          value={performance.uptime}
          unit="%"
        />
        <MetricCard
          label="Response Time (p50)"
          value={performance.responseTime.p50}
          unit="ms"
        />
        <MetricCard
          label="Response Time (p95)"
          value={performance.responseTime.p95}
          unit="ms"
        />
        <MetricCard
          label="Response Time (p99)"
          value={performance.responseTime.p99}
          unit="ms"
        />
        <MetricCard
          label="Requests/Second"
          value={performance.requestsPerSecond}
          unit="req/s"
        />
        <MetricCard
          label="Error Rate"
          value={performance.errorRate}
          unit="%"
        />
      </div>
    </div>
  );
}

function MetricCard({ label, value, unit }: { label: string; value: number; unit: string }) {
  return (
    <div className="metric-card">
      <h3>{label}</h3>
      <div className="metric-value">
        {typeof value === 'number' ? value.toFixed(2) : value}
        <span className="unit">{unit}</span>
      </div>
    </div>
  );
}

// ============================================================================
// EXAMPLE 5: DAO-Specific Dashboard
// ============================================================================

export function DaoSpecificDashboard({ daoId }: { daoId: string }) {
  const { data: dashboard, isLoading } = useMorioDashboard(daoId);
  const { systemStatus, alerts } = useMorioRealTime(daoId);

  return (
    <div className="dao-dashboard">
      <h1>DAO Dashboard: {daoId}</h1>

      {/* Treasury Section */}
      {dashboard?.sections.treasury && (
        <TreasurySection data={dashboard.sections.treasury} />
      )}

      {/* Governance Section */}
      {dashboard?.sections.governance && (
        <GovernanceSection data={dashboard.sections.governance} />
      )}

      {/* Community Section */}
      {dashboard?.sections.community && (
        <CommunitySection data={dashboard.sections.community} />
      )}

      {/* DAO-Specific Alerts */}
      {alerts.length > 0 && (
        <div className="dao-alerts">
          <h2>DAO Alerts</h2>
          {alerts.filter(a => a.daoId === daoId).map(alert => (
            <AlertItem key={alert.id} alert={alert} />
          ))}
        </div>
      )}
    </div>
  );
}

// Placeholder sections
function TreasurySection({ data }: any) {
  return <div className="section">Treasury Data</div>;
}

function GovernanceSection({ data }: any) {
  return <div className="section">Governance Data</div>;
}

function CommunitySection({ data }: any) {
  return <div className="section">Community Data</div>;
}

// ============================================================================
// EXAMPLE 6: Custom Data Fetch Hook
// ============================================================================

import { useQuery } from '@tanstack/react-query';

export function useMorioCustom(endpoint: string, daoId?: string) {
  return useQuery({
    queryKey: ['morio:custom', endpoint, daoId],
    queryFn: async () => {
      const url = new URL(`/api/morio/${endpoint}`, window.location.origin);
      if (daoId) url.searchParams.set('daoId', daoId);

      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('auth_token')}`
        }
      });

      if (!response.ok) throw new Error('Failed to fetch');
      return response.json();
    },
    refetchInterval: 30000,
    staleTime: 10000
  });
}

// ============================================================================
// EXAMPLE 7: Error Handling and Retry Logic
// ============================================================================

export async function fetchWithRetry(
  url: string,
  maxRetries: number = 3,
  delayMs: number = 1000
): Promise<any> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('auth_token')}`
        }
      });

      if (!response.ok) {
        if (response.status === 429) {
          // Rate limited, wait longer
          await new Promise(resolve => setTimeout(resolve, delayMs * (i + 1)));
          continue;
        }
        throw new Error(`HTTP ${response.status}`);
      }

      return response.json();
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, delayMs * (i + 1)));
    }
  }
}

// ============================================================================
// EXAMPLE 8: Caching Strategy Implementation
// ============================================================================

export class MorioDashboardCache {
  private cache = new Map<string, { data: any; timestamp: number }>();
  private ttl = {
    standard: 5 * 60 * 1000, // 5 minutes
    short: 60 * 1000, // 1 minute
    long: 60 * 60 * 1000 // 1 hour
  };

  get(key: string): any | null {
    const item = this.cache.get(key);
    if (!item) return null;

    const age = Date.now() - item.timestamp;
    if (age > this.ttl.standard) {
      this.cache.delete(key);
      return null;
    }

    return item.data;
  }

  set(key: string, data: any, ttl: 'short' | 'standard' | 'long' = 'standard') {
    this.cache.set(key, { data, timestamp: Date.now() });
  }

  clear(key?: string) {
    if (key) {
      this.cache.delete(key);
    } else {
      this.cache.clear();
    }
  }

  getStats() {
    return {
      entries: this.cache.size,
      keys: Array.from(this.cache.keys())
    };
  }
}

// ============================================================================
// EXAMPLE 9: WebSocket Debugging Utilities
// ============================================================================

export function enableMorioDebug() {
  const originalSocket = io;

  return function debugSocket(url: string, options?: any) {
    const socket = originalSocket(url, options);

    // Log all events
    socket.onAny((event: string, ...args: any[]) => {
      console.log(`[Morio WS] ${event}`, args);
    });

    // Log connection events
    socket.on('connect', () => {
      console.log('[Morio WS] ✅ Connected');
    });

    socket.on('disconnect', () => {
      console.log('[Morio WS] ❌ Disconnected');
    });

    socket.on('connect_error', (error: any) => {
      console.error('[Morio WS] Connection error:', error);
    });

    return socket;
  };
}

// ============================================================================
// EXAMPLE 10: Performance Monitoring
// ============================================================================

export class MorioPerformanceMonitor {
  private metrics: Record<string, number[]> = {};

  recordMetric(name: string, value: number) {
    if (!this.metrics[name]) {
      this.metrics[name] = [];
    }
    this.metrics[name].push(value);

    // Keep only last 100 measurements
    if (this.metrics[name].length > 100) {
      this.metrics[name].shift();
    }
  }

  getStats(name: string) {
    const values = this.metrics[name] || [];
    if (values.length === 0) return null;

    const sorted = [...values].sort((a, b) => a - b);
    return {
      min: sorted[0],
      max: sorted[sorted.length - 1],
      avg: values.reduce((a, b) => a + b) / values.length,
      p50: sorted[Math.floor(values.length * 0.5)],
      p95: sorted[Math.floor(values.length * 0.95)],
      p99: sorted[Math.floor(values.length * 0.99)],
      count: values.length
    };
  }

  getAllStats() {
    const stats: Record<string, any> = {};
    for (const [name] of Object.entries(this.metrics)) {
      stats[name] = this.getStats(name);
    }
    return stats;
  }
}

// Usage example
const monitor = new MorioPerformanceMonitor();

// In your API call
const start = performance.now();
const data = await fetch('/api/morio/dashboard');
const duration = performance.now() - start;
monitor.recordMetric('dashboard_fetch', duration);

// Check stats
console.log('Performance stats:', monitor.getAllStats());

// ============================================================================
// Export all examples
// ============================================================================

export {
  setupMorioInServer,
  MorioDashboard,
  AlertsMonitor,
  PerformanceMetrics,
  DaoSpecificDashboard,
  MorioDashboardCache,
  MorioPerformanceMonitor,
  enableMorioDebug,
  fetchWithRetry
};
