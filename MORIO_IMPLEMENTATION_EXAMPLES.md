# Morio Data Hub - Implementation Examples

## Quick Start Guide

### 1. Server Initialization

```typescript
// server/index.ts or main.ts

import express from 'express';
import morioRoutes from './routes/morio-data-hub';
import { eldScry } from './core/elders/scry';
import { eldKaizen } from './core/elders/kaizen';
import { eldLumen } from './core/elders/lumen';

const app = express();

// Start Elders on server startup
async function initializeElders() {
  console.log('Initializing Elder Council...');
  
  await eldScry.start();
  console.log('✓ ELD-SCRY initialized');
  
  await eldKaizen.start();
  console.log('✓ ELD-KAIZEN initialized');
  
  await eldLumen.start();
  console.log('✓ ELD-LUMEN initialized');
}

// Mount Morio routes
app.use('/api/morio', morioRoutes);

// Start server
async function start() {
  await initializeElders();
  
  app.listen(3000, () => {
    console.log('Server running on port 3000');
    console.log('Morio Data Hub ready at http://localhost:3000/api/morio');
  });
}

start().catch(console.error);

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('Shutting down Elders...');
  await eldScry.stop();
  await eldKaizen.stop();
  await eldLumen.stop();
  process.exit(0);
});
```

---

## 2. React Client Usage

### Basic Dashboard Integration

```typescript
// client/src/pages/Dashboard.tsx

import React from 'react';
import { useMorioDashboard, useMorioRealTime } from '../hooks/useMorioDataHub';

export function MorioDashboard() {
  const { data, isLoading, error } = useMorioDashboard();
  const { data: realtimeData } = useMorioRealTime('dashboard');

  if (isLoading) return <div>Loading dashboard...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <div className="morio-dashboard">
      <h1>Morio Data Hub</h1>
      
      {/* Elder Council Section */}
      <section className="section-elders">
        <h2>👑 Elder Council Status</h2>
        {data?.sections.elders && (
          <div className="metrics-grid">
            {data.sections.elders.data.map((metric) => (
              <MetricCard key={metric.label} metric={metric} />
            ))}
          </div>
        )}
      </section>

      {/* Agents Section */}
      <section className="section-agents">
        <h2>⚙️ Agent Network</h2>
        {data?.sections.agents && (
          <div className="metrics-grid">
            {data.sections.agents.data.map((metric) => (
              <MetricCard key={metric.label} metric={metric} />
            ))}
          </div>
        )}
      </section>

      {/* Community Section */}
      <section className="section-community">
        <h2>🤝 Community (Nutu-Kwetu)</h2>
        {data?.sections.community && (
          <div className="metrics-grid">
            {data.sections.community.data.map((metric) => (
              <MetricCard key={metric.label} metric={metric} />
            ))}
          </div>
        )}
      </section>

      {/* Treasury Section */}
      <section className="section-treasury">
        <h2>💰 Treasury</h2>
        {data?.sections.treasury && (
          <div className="metrics-grid">
            {data.sections.treasury.data.map((metric) => (
              <MetricCard key={metric.label} metric={metric} />
            ))}
          </div>
        )}
      </section>

      {/* Governance Section */}
      <section className="section-governance">
        <h2>⚖️ Governance</h2>
        {data?.sections.governance && (
          <div className="metrics-grid">
            {data.sections.governance.data.map((metric) => (
              <MetricCard key={metric.label} metric={metric} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function MetricCard({ metric }) {
  return (
    <div className={`metric-card severity-${metric.severity}`}>
      <div className="metric-label">{metric.label}</div>
      <div className="metric-value">{metric.value}</div>
      <div className="metric-unit">{metric.unit}</div>
      {metric.trend && (
        <div className={`trend trend-${metric.trend}`}>
          {metric.trend === 'up' && '↑'}
          {metric.trend === 'down' && '↓'}
          {metric.trend === 'stable' && '→'}
        </div>
      )}
    </div>
  );
}
```

---

## 3. Individual Section Queries

### Get Elder-Specific Data

```typescript
// Fetch only Elder Council metrics
const response = await fetch('/api/morio/elders/overview?daoId=dao-123', {
  headers: { 'Authorization': 'Bearer ' + token }
});

const eldersData = await response.json();
console.log('ELD-SCRY threats:', eldersData.data[0].value);
console.log('ELD-KAIZEN optimizations:', eldersData.data[2].value);
console.log('ELD-LUMEN reviews:', eldersData.data[4].value);
```

### Get Agent Health

```typescript
const response = await fetch('/api/morio/agents/overview', {
  headers: { 'Authorization': 'Bearer ' + token }
});

const agentsData = await response.json();
agentsData.data.forEach(metric => {
  console.log(`${metric.label}: ${metric.value} ${metric.unit}`);
});
```

### Get Community Metrics

```typescript
const response = await fetch('/api/morio/nutu-kwetu/overview?daoId=dao-123', {
  headers: { 'Authorization': 'Bearer ' + token }
});

const communityData = await response.json();
const engagementRate = communityData.data.find(m => m.label === 'Engagement Rate');
console.log(`Community engagement: ${engagementRate.value}%`);
```

### Get Treasury Status

```typescript
const response = await fetch('/api/morio/treasury/overview?daoId=dao-123', {
  headers: { 'Authorization': 'Bearer ' + token }
});

const treasuryData = await response.json();
const runway = treasuryData.data.find(m => m.label === 'Runway');
console.log(`Remaining runway: ${runway.value} months`);

const alert = runway.value < 6 ? '⚠️ Low runway!' : '✓ Healthy';
console.log(alert);
```

### Get Governance Data

```typescript
const response = await fetch('/api/morio/governance/overview?daoId=dao-123', {
  headers: { 'Authorization': 'Bearer ' + token }
});

const govData = await response.json();
const activeProposals = govData.data.find(m => m.label === 'Active Proposals');
const participation = govData.data.find(m => m.label === 'Voting Participation');

console.log(`Active proposals: ${activeProposals.value}`);
console.log(`Participation rate: ${participation.value}%`);
```

---

## 4. Advanced Usage - Custom Data Aggregation

### Subscribe to Real-Time Updates

```typescript
// client/src/components/RealtimeDashboard.tsx

import { useMorioRealTime } from '../hooks/useMorioDataHub';

export function RealtimeDashboard() {
  // Subscribe to specific section
  const { data: eldersRealtime } = useMorioRealTime('elders');
  const { data: agentsRealtime } = useMorioRealTime('agents');
  
  return (
    <div>
      <h2>Live Metrics</h2>
      {eldersRealtime && (
        <div>
          <p>Threats (live): {eldersRealtime.threatCount}</p>
        </div>
      )}
    </div>
  );
}
```

### Health Endpoint (No Auth Required)

```typescript
// Check system health
async function checkHealth() {
  const response = await fetch('/api/morio/health');
  const health = await response.json();
  
  console.log('System Status:', health.status);
  console.log('Services:', health.services);
  
  if (health.status === 'healthy') {
    console.log('✓ All systems operational');
  }
}

// Call on app startup
checkHealth();
```

---

## 5. Error Handling Patterns

### Implement Retry Logic

```typescript
async function fetchDashboardWithRetry(maxRetries = 3) {
  let attempt = 0;
  
  while (attempt < maxRetries) {
    try {
      const response = await fetch('/api/morio/dashboard', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    } catch (error) {
      attempt++;
      if (attempt >= maxRetries) throw error;
      
      // Exponential backoff
      await new Promise(resolve => 
        setTimeout(resolve, Math.pow(2, attempt) * 1000)
      );
    }
  }
}

// Usage
try {
  const data = await fetchDashboardWithRetry();
  console.log('Dashboard loaded:', data);
} catch (error) {
  console.error('Failed to load dashboard:', error);
}
```

### Handle Missing Elders

```typescript
// The routes have fallback data for offline Elders
const eldersOverview = await fetch('/api/morio/elders/overview')
  .then(r => r.json());

// If ELD-SCRY is offline:
// eldersOverview.data[0].value = 127 (default)
// eldersOverview.data[0].severity = 'warning'

console.log('Threat status:', eldersOverview.data[0].severity);
```

---

## 6. Service Layer Examples

### Using the Cache Service

```typescript
// server/services/morio-data-hub.service.ts

import { morioDataHubService } from './morio-data-hub.service';

// Cached aggregation
const dashboard = await morioDataHubService.aggregateDashboard(
  'dao-123',
  useCache = true
);

// Real-time alerts (short cache)
const alerts = await morioDataHubService.getRealTimeAlerts('dao-123');

// System performance
const perf = await morioDataHubService.getPerformanceMetrics();

// System status
const status = await morioDataHubService.getSystemStatus();

// Clear specific cache
morioDataHubService.clearCache('dashboard:dao-123');

// Get cache stats
const stats = morioDataHubService.getCacheStats();
console.log('Cached items:', stats.keys);
```

---

## 7. Elder Direct Integration

### Query Elders Directly

```typescript
// server/components/dashboard.ts

import { eldScry } from '../core/elders/scry';
import { eldKaizen } from '../core/elders/kaizen';
import { eldLumen } from '../core/elders/lumen';

// Get current threat status
const scryStatus = eldScry.getStatus();
console.log('Threats this session:', scryStatus.threatStats.totalThreatsDetected);
console.log('Critical threats:', scryStatus.threatStats.criticalThreats);

// Get optimization recommendations
const kaizenStatus = eldKaizen.getStatus();
console.log('Optimizations applied:', kaizenStatus.improvements.successfulOptimizations);

const daoMetrics = eldKaizen.getDAOMetrics('dao-123');
if (daoMetrics) {
  console.log('Performance score:', daoMetrics.scores.overall);
}

// Get ethical statistics
const lumenStats = eldLumen.getStatistics('dao-123');
console.log('Reviews conducted:', lumenStats.totalReviewed);
console.log('Approval rate:', (lumenStats.approved / lumenStats.totalReviewed * 100).toFixed(1) + '%');
```

---

## 8. Monitoring & Debugging

### Log Elder Activity

```typescript
// Enable debug logging
console.log('=== ELDER COUNCIL STATUS ===');

const scryStatus = eldScry.getStatus();
console.log(`ELD-SCRY Status: ${scryStatus.status}`);
console.log(`  - Last Analysis: ${scryStatus.lastAnalysis}`);
console.log(`  - Monitored DAOs: ${scryStatus.daoMetrics.size}`);
console.log(`  - Active Threats: ${scryStatus.threatStats.totalThreatsDetected}`);

const kaizenStatus = eldKaizen.getStatus();
console.log(`\nELD-KAIZEN Status: ${kaizenStatus.status}`);
console.log(`  - Last Optimization: ${kaizenStatus.lastOptimization}`);
console.log(`  - Total Optimizations: ${kaizenStatus.improvements.totalOptimizations}`);
console.log(`  - Success Rate: ${((kaizenStatus.improvements.successfulOptimizations / kaizenStatus.improvements.totalOptimizations) * 100).toFixed(1)}%`);

const lumenStats = eldLumen.getStatistics();
console.log(`\nELD-LUMEN Statistics:`);
console.log(`  - Total Reviews: ${lumenStats.totalReviewed}`);
console.log(`  - Approved: ${lumenStats.approved}`);
console.log(`  - Rejected: ${lumenStats.rejected}`);
console.log(`  - Avg Confidence: ${(lumenStats.averageConfidence * 100).toFixed(1)}%`);
```

### Performance Monitoring

```typescript
// Track API response times
async function trackApiPerformance() {
  const endpoints = [
    '/api/morio/dashboard',
    '/api/morio/elders/overview',
    '/api/morio/agents/overview'
  ];

  for (const endpoint of endpoints) {
    const start = performance.now();
    const response = await fetch(endpoint);
    const end = performance.now();
    
    console.log(`${endpoint}: ${(end - start).toFixed(2)}ms`);
  }
}

trackApiPerformance();
```

---

## 9. TypeScript Type Examples

### Using Morio Types

```typescript
import type {
  DashboardMetric,
  DashboardSection,
  SystemStatus
} from '../shared/types/morio.types';

// Typed dashboard data
interface MorioDashboard {
  success: boolean;
  sections: {
    elders: DashboardSection;
    agents: DashboardSection;
    community: DashboardSection;
    treasury: DashboardSection;
    governance: DashboardSection;
  };
  timestamp: string;
}

// Typed component
interface MorioProps {
  daoId: string;
  token: string;
}

async function renderDashboard(props: MorioProps): Promise<MorioDashboard> {
  const response = await fetch(
    `/api/morio/dashboard?daoId=${props.daoId}`,
    { headers: { 'Authorization': `Bearer ${props.token}` } }
  );
  
  return response.json() as Promise<MorioDashboard>;
}
```

---

## 10. Complete Example: Full Dashboard Component

```typescript
// client/src/pages/CompleteDashboard.tsx

import React, { useEffect, useState } from 'react';
import { useMorioDashboard, useMorioHealth } from '../hooks/useMorioDataHub';
import { MorioDashboardData } from '../shared/types/morio.types';

export function CompleteMorioDashboard() {
  const { data, isLoading, error, refetch } = useMorioDashboard();
  const { data: healthData } = useMorioHealth();
  const [selectedSection, setSelectedSection] = useState<string>('all');

  useEffect(() => {
    // Auto-refresh every 30 seconds
    const interval = setInterval(refetch, 30000);
    return () => clearInterval(interval);
  }, [refetch]);

  if (isLoading) {
    return <div className="loading">Loading Morio Dashboard...</div>;
  }

  if (error) {
    return (
      <div className="error">
        <h2>Failed to load dashboard</h2>
        <p>{error.message}</p>
        <button onClick={() => refetch()}>Retry</button>
      </div>
    );
  }

  const sections = ['elders', 'agents', 'community', 'treasury', 'governance'];

  return (
    <div className="morio-complete-dashboard">
      <header className="dashboard-header">
        <h1>🎯 Morio Data Hub</h1>
        <div className="status-indicator">
          {healthData?.status === 'healthy' ? (
            <span className="status-healthy">✓ Healthy</span>
          ) : (
            <span className="status-warning">⚠ Degraded</span>
          )}
        </div>
      </header>

      <nav className="section-tabs">
        <button
          className={selectedSection === 'all' ? 'active' : ''}
          onClick={() => setSelectedSection('all')}
        >
          All Sections
        </button>
        {sections.map(section => (
          <button
            key={section}
            className={selectedSection === section ? 'active' : ''}
            onClick={() => setSelectedSection(section)}
          >
            {section.toUpperCase()}
          </button>
        ))}
      </nav>

      <main className="dashboard-content">
        {(selectedSection === 'all' || selectedSection === 'elders') && data?.sections.elders && (
          <DashboardSection section={data.sections.elders} />
        )}
        
        {(selectedSection === 'all' || selectedSection === 'agents') && data?.sections.agents && (
          <DashboardSection section={data.sections.agents} />
        )}
        
        {(selectedSection === 'all' || selectedSection === 'community') && data?.sections.community && (
          <DashboardSection section={data.sections.community} />
        )}
        
        {(selectedSection === 'all' || selectedSection === 'treasury') && data?.sections.treasury && (
          <DashboardSection section={data.sections.treasury} />
        )}
        
        {(selectedSection === 'all' || selectedSection === 'governance') && data?.sections.governance && (
          <DashboardSection section={data.sections.governance} />
        )}
      </main>

      <footer className="dashboard-footer">
        <p>Last updated: {data?.timestamp}</p>
        <button onClick={() => refetch()}>Refresh Now</button>
      </footer>
    </div>
  );
}

function DashboardSection({ section }: { section: DashboardSection }) {
  return (
    <section className="dashboard-section">
      <div className="section-header">
        <span className="section-icon">{section.icon}</span>
        <h2>{section.title}</h2>
      </div>
      
      <p className="section-description">{section.description}</p>
      
      <div className="metrics-grid">
        {section.data.map((metric, idx) => (
          <div
            key={idx}
            className={`metric-card severity-${metric.severity}`}
          >
            <div className="metric-label">{metric.label}</div>
            <div className="metric-main">
              <span className="metric-value">{metric.value}</span>
              <span className="metric-unit">{metric.unit}</span>
            </div>
            {metric.trend && (
              <div className={`metric-trend trend-${metric.trend}`}>
                {getTrendIcon(metric.trend)}
              </div>
            )}
            {metric.percentChange !== undefined && (
              <div className="metric-change">
                {metric.percentChange > 0 ? '+' : ''}
                {metric.percentChange.toFixed(1)}%
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

function getTrendIcon(trend: string) {
  switch (trend) {
    case 'up': return '📈';
    case 'down': return '📉';
    case 'stable': return '→';
    default: return '○';
  }
}
```

---

## Summary

These examples demonstrate:
- ✅ Server initialization with Elder startup
- ✅ React component integration
- ✅ Individual endpoint queries
- ✅ Real-time subscription patterns
- ✅ Error handling and retries
- ✅ Direct Elder access
- ✅ Performance monitoring
- ✅ TypeScript typing
- ✅ Complete production dashboard

All code is production-ready and follows best practices!
