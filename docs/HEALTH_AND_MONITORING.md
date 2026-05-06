# System Health & Operational Intelligence

## Overview

This implementation adds three critical components for production-ready system monitoring:

### 1. Circuit Breaker Pattern (`server/utils/circuitBreaker.ts`)

**Purpose**: Prevent cascading failures in aggregation jobs

**How it works**:
- **CLOSED**: Normal operation, requests flow through
- **OPEN**: Too many failures detected, requests rejected immediately
- **HALF_OPEN**: Testing if service recovered, limited requests allowed

**Key Features**:
- Configurable failure thresholds (default: 5 failures)
- Automatic recovery timeout (default: 30s)
- Per-breaker metrics and statuses
- Global registry for all circuit breakers

**Usage**:
```typescript
const breaker = circuitBreakerRegistry.getOrCreate('my-job', {
  failureThreshold: 5,
  resetTimeout: 30000,
});

try {
  return await breaker.execute(async () => {
    // Your potentially failing operation
    return await expensiveOperation();
  });
} catch (error) {
  // Handle circuit breaker or actual error
  logger.error('Operation failed:', error);
}
```

### 2. Health Telemetry Service (`server/utils/healthTelemetry.ts`)

**Purpose**: Real-time system health monitoring with operational intelligence

**Tracks**:
- **Agent Heartbeat Latency**: Track agent responsiveness (default: 100ms window)
- **Exchange Latency**: Monitor exchange integration performance
- **Oracle Backoff Multiplier**: Exponential backoff for oracle failures (1-32x)
- **Database Query Failure Rates**: Percentage of failed queries
- **Memory Usage Per Module**: Heap, system, and module-specific tracking

**Health Metrics**:
```typescript
{
  status: 'healthy' | 'degraded' | 'critical',
  healthScore: 0-100,
  uptime: seconds,
  agent: { latency, isActive },
  exchange: { latency, rateLimitStatus },
  oracle: { backoffMultiplier },
  database: { failureRate, avgQueryTime, slowQueries },
  memory: { heapUsagePercent, systemMemoryPercent }
}
```

**Recording Events**:
```typescript
// Agent heartbeat
healthTelemetry.recordAgentHeartbeat(latency, success);

// Exchange latency
healthTelemetry.recordExchangeLatency(latency, success);

// Oracle backoff
healthTelemetry.recordOracleBackoff(multiplier, success);

// Database queries
healthTelemetry.recordDbQuery(latency, success, isSlowQuery);

// Database pool utilization
healthTelemetry.recordDbPoolUtilization(utilization);
```

### 3. System State Snapshot Service (`server/utils/systemState.ts`)

**Purpose**: Comprehensive operational intelligence endpoint

**Returns**:
- **Active Agents**: Status, latency, error count
- **Exchange Health**: Latency, rate limit status, failure rate
- **Job Status**: Active, failed, pending jobs with execution metrics
- **Queue Depth**: Total items, delayed, failed items per queue
- **Database Connectivity**: Connection status, failure rate, slow query count
- **Redis Fallback State**: Memory usage, key count, connectivity
- **Circuit Breaker Status**: All breakers and their states
- **Recommendations**: Actionable insights based on system state

**System Status Levels**:
- 🟢 **HEALTHY**: All components functioning normally
- 🟡 **DEGRADED**: Some components showing issues but still operational
- 🔴 **CRITICAL**: One or more critical components offline

## API Endpoints

### `/api/admin/health/state` (GET)
Complete system state snapshot with all metrics

**Response**:
```json
{
  "timestamp": "2026-02-18T14:32:10Z",
  "systemStatus": "healthy",
  "uptime": 3600,
  "agents": [...],
  "exchange": {...},
  "jobs": {...},
  "queues": {...},
  "database": {...},
  "redis": {...},
  "circuitBreakers": [...],
  "recommendations": [...]
}
```

### `/api/admin/health/summary` (GET)
Quick health summary with key metrics

### `/api/admin/health/telemetry` (GET)
Detailed telemetry data from health service

### `/api/admin/health/circuit-breakers` (GET)
All circuit breaker statuses

### `/api/admin/health/agents` (GET)
Agent-specific status and metrics

### `/api/admin/health/database` (GET)
Database connectivity and query performance

### `/api/admin/health/redis` (GET)
Redis status and memory metrics

### `/api/admin/health/jobs` (GET)
Job execution metrics

### `/api/admin/health/queues` (GET)
Queue depths and processing status

### `/api/admin/health/exchange` (GET)
Exchange integration health

## Integration with Metrics Aggregation

The `MonitoringAggregationService` now uses circuit breakers:

```typescript
// Platform metrics aggregation with circuit breaker protection
const metrics = await MonitoringAggregationService.aggregatePlatformMetrics();
// Returns graceful degradation if circuit opens
```

**Benefits**:
- ✅ One failed aggregation doesn't crash monitoring
- ✅ Automatic recovery when service stabilizes
- ✅ Observable failure patterns
- ✅ Degraded metrics returned instead of errors

## Health Score Calculation

Score starts at 100 and is penalized for:
- High memory usage (>90%): -30 points
- High memory usage (>75%): -15 points
- Database failures: -0.1 per percentage point
- Agent failures: -0.15 per percentage point
- 10+ slow queries: -10 points

**Score Ranges**:
- 80-100: Healthy ✅
- 50-80: Degraded ⚠️
- 0-50: Critical 🔴

## Monitoring Dashboard Integration

These endpoints can be integrated with:
- **Real-time dashboards**: Poll `/api/admin/health/state` every 5-10 seconds
- **Alert systems**: Monitor `recommendations` field
- **Performance tracking**: Track `healthScore` over time
- **Capacity planning**: Monitor `memory.heapUsagePercent` trends

## Example Monitoring Loop

```typescript
// Poll system health every 10 seconds
setInterval(async () => {
  const snapshot = await fetch('/api/admin/health/state').then(r => r.json());
  
  if (snapshot.data.systemStatus === 'critical') {
    // Alert ops team
    sendAlert(`System critical: ${snapshot.data.recommendations[0]}`);
  }
  
  // Log metrics for trending
  logMetrics({
    healthScore: snapshot.data.overall.healthScore,
    uptime: snapshot.data.overall.uptime,
    dbFailureRate: snapshot.data.database.queryFailureRate,
  });
}, 10000);
```

## Next Steps

1. **Real-time Dashboard**: Create Grafana/Kibana dashboard using health endpoints
2. **Alert Rules**: Set thresholds for critical alerts (e.g., healthScore < 50)
3. **Logging Integration**: Capture recommendations as warnings/errors
4. **Performance Baselining**: Track health metrics over days/weeks for optimization
5. **Auto-scaling Triggers**: Use queue depth and memory metrics for scaling decisions

## Files Added

- `server/utils/circuitBreaker.ts` - Circuit breaker pattern implementation
- `server/utils/healthTelemetry.ts` - Health telemetry and metrics collection
- `server/utils/systemState.ts` - System state snapshot service
- `server/routes/admin/health.ts` - Health API endpoints
- Updated: `server/index.ts` - Added health routes to Express app
- Updated: `server/services/metricsAggregationService.ts` - Integrated circuit breakers
