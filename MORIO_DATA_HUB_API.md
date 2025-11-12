# Morio Data Hub API Documentation

## Overview

The Morio Data Hub is a comprehensive backend data aggregation system that collects and presents real-time data from all MtaaDAO system components:

- **ELD-SCRY** - Security & Threat Detection
- **ELD-KAIZEN** - System Optimization & Performance
- **ELD-LUMEN** - Community Review & Governance
- **Agent Network** - Distributed system agents (Analyzer, Defender, Scout, etc.)
- **Treasury** - Financial management and allocations
- **Governance** - Proposals and voting mechanisms
- **Nutu-Kwetu** - Community engagement metrics

## Architecture

### Data Flow

```
┌─────────────────────────────────────────────────────────┐
│                    Client Dashboard                      │
└────────────────────┬────────────────────────────────────┘
                     │
         ┌───────────┴───────────┐
         │                       │
    REST API              WebSocket (Real-time)
         │                       │
┌────────┴─────────────────┬────┴──────────┐
│  Morio Data Hub Routes   │  WebSocket    │
│  - /api/morio/*          │  Server       │
└────────┬─────────────────┴─────┬─────────┘
         │                       │
    ┌────┴────────────────────────┴────┐
    │   Morio Data Hub Service         │
    │   (Aggregation & Caching)        │
    └────┬──────────────────────────────┘
         │
    ┌────┴───────────────────────────────────────────┐
    │                                                 │
    │  System Data Sources                           │
    │  ├── ELD-SCRY (Security)                      │
    │  ├── ELD-KAIZEN (Performance)                 │
    │  ├── ELD-LUMEN (Community Review)             │
    │  ├── Agent Network (Distributed Systems)      │
    │  ├── Database (Treasury, Governance, etc.)    │
    │  └── Cache Layer (Performance)                │
    └─────────────────────────────────────────────────┘
```

## REST API Endpoints

### Dashboard Endpoints

#### GET `/api/morio/dashboard`

Get complete dashboard data (all 5 sections).

**Query Parameters:**
- `daoId` (optional): Specific DAO to query. Superusers only.

**Response:**
```json
{
  "success": true,
  "sections": {
    "elders": { ... },
    "agents": { ... },
    "community": { ... },
    "treasury": { ... },
    "governance": { ... }
  },
  "timestamp": "2024-01-15T10:30:00Z"
}
```

#### GET `/api/morio/elders/overview`

Get Elder Council monitoring data (ELD-SCRY, ELD-KAIZEN, ELD-LUMEN).

**Response:**
```json
{
  "section": "elders",
  "title": "Elder Council Status",
  "icon": "👑",
  "data": [
    {
      "label": "ELD-SCRY Threats Detected",
      "value": 127,
      "unit": "this week",
      "trend": "down",
      "severity": "success"
    },
    ...
  ],
  "lastUpdated": "2024-01-15T10:30:00Z"
}
```

#### GET `/api/morio/agents/overview`

Get Agent Network status and health metrics.

**Response:**
```json
{
  "section": "agents",
  "title": "Agent Network Status",
  "icon": "⚙️",
  "data": [
    {
      "label": "Active Agents",
      "value": 8,
      "unit": "of 10",
      "trend": "stable",
      "severity": "success"
    },
    ...
  ],
  "lastUpdated": "2024-01-15T10:30:00Z"
}
```

#### GET `/api/morio/nutu-kwetu/overview`

Get Community (Nutu-Kwetu) engagement metrics.

**Response:**
```json
{
  "section": "nutu-kwetu",
  "title": "Community Engagement",
  "icon": "🤝",
  "data": [
    {
      "label": "Active Members",
      "value": 2847,
      "unit": "engaged",
      "trend": "up",
      "severity": "success"
    },
    ...
  ],
  "lastUpdated": "2024-01-15T10:30:00Z"
}
```

#### GET `/api/morio/treasury/overview`

Get Treasury financial metrics and health.

**Response:**
```json
{
  "section": "treasury",
  "title": "Treasury Overview",
  "icon": "💰",
  "data": [
    {
      "label": "Total Treasury",
      "value": 4.2,
      "unit": "M MTAA",
      "trend": "up",
      "severity": "success"
    },
    ...
  ],
  "lastUpdated": "2024-01-15T10:30:00Z"
}
```

#### GET `/api/morio/governance/overview`

Get Governance and voting metrics.

**Response:**
```json
{
  "section": "governance",
  "title": "Governance Activity",
  "icon": "⚖️",
  "data": [
    {
      "label": "Active Proposals",
      "value": 12,
      "unit": "open",
      "trend": "stable",
      "severity": "info"
    },
    ...
  ],
  "lastUpdated": "2024-01-15T10:30:00Z"
}
```

#### GET `/api/morio/health`

Health check for all Morio services.

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00Z",
  "services": {
    "elders": { "status": "online", "lastCheck": "2024-01-15T10:30:00Z" },
    "agents": { "status": "online", "lastCheck": "2024-01-15T10:30:00Z" },
    "database": { "status": "online", "lastCheck": "2024-01-15T10:30:00Z" }
  }
}
```

## WebSocket Real-Time Updates

### Connection

Connect to WebSocket with authentication token:

```javascript
const socket = io(window.location.origin, {
  auth: {
    token: localStorage.getItem('auth_token')
  }
});
```

### Subscribe Events

#### Subscribe to Dashboard Updates
```javascript
socket.emit('subscribe:dashboard', daoId);
// Receives: 'data:system-status', 'update:elders', 'update:agents', etc.
```

#### Subscribe to Alerts
```javascript
socket.emit('subscribe:alerts', daoId);
// Receives: 'data:alerts', 'new:alert'
```

#### Subscribe to Performance Metrics
```javascript
socket.emit('subscribe:performance');
// Receives: 'data:performance'
```

#### Subscribe to Specific Section
```javascript
socket.emit('subscribe:section', 'elders', daoId);
// Receives: 'update:elders'
```

### Unsubscribe Events

```javascript
socket.emit('unsubscribe:dashboard', daoId);
socket.emit('unsubscribe:alerts', daoId);
```

### Received Events

#### System Status Update
```javascript
socket.on('data:system-status', (data) => {
  // {
  //   overall: 'healthy',
  //   components: { ... },
  //   lastCheck: '...'
  // }
});
```

#### Alerts Update
```javascript
socket.on('data:alerts', (data) => {
  // {
  //   alerts: [ ... ],
  //   lastUpdate: '...'
  // }
});
```

#### New Alert
```javascript
socket.on('new:alert', (alert) => {
  // {
  //   id: 'ALERT-001',
  //   severity: 'warning',
  //   title: '...',
  //   description: '...',
  //   timestamp: '...'
  // }
});
```

#### Performance Metrics
```javascript
socket.on('data:performance', (data) => {
  // {
  //   uptime: 99.98,
  //   responseTime: { p50, p95, p99 },
  //   requestsPerSecond: 2847,
  //   errorRate: 0.02,
  //   lastUpdate: '...'
  // }
});
```

## React Hooks

### `useMorioDashboard(daoId?, enabled?)`

Fetch complete dashboard data:

```typescript
const { data, isLoading, error } = useMorioDashboard('dao-123');

if (isLoading) return <div>Loading...</div>;
if (error) return <div>Error: {error.message}</div>;

return (
  <div>
    {data?.sections.elders && <EldersCard data={data.sections.elders} />}
    {data?.sections.agents && <AgentsCard data={data.sections.agents} />}
    {/* ... */}
  </div>
);
```

### `useMorioSection(section, daoId?, enabled?)`

Fetch individual section data:

```typescript
const { data, isLoading } = useMorioSection('elders', 'dao-123');
```

### `useMorioRealTime(daoId?)`

Subscribe to real-time updates via WebSocket:

```typescript
const { 
  systemStatus, 
  alerts, 
  performance, 
  isConnected,
  subscribe,
  unsubscribe 
} = useMorioRealTime('dao-123');

// Use data in components
if (alerts.length > 0) {
  return <AlertsList alerts={alerts} />;
}
```

### `useMorioHealth()`

Check Morio system health:

```typescript
const { data: health, isLoading } = useMorioHealth();
```

## Caching Strategy

The Morio Data Hub implements a multi-tier caching strategy:

| Data Type | TTL | Use Case |
|-----------|-----|----------|
| Real-time metrics | 60s | Performance, system status |
| Standard metrics | 5m | Dashboard data, section overviews |
| Aggregated data | 1h | Historical trends, reports |
| Health checks | 1m | Service health |

**Cache Management:**

```typescript
// Clear specific cache
POST /api/morio/cache/clear
body: { key: 'elders:overview' }

// Clear all caches
POST /api/morio/cache/clear-all

// Get cache stats
GET /api/morio/cache/stats
```

## Access Control

All endpoints require authentication. Superusers have access to all data. Regular members can only access their own DAO's data.

### Authentication

Include JWT token in Authorization header:

```
Authorization: Bearer <token>
```

### Role-Based Access

- **Superusers**: All data, all DAOs
- **DAO Administrators**: Their DAO's data, management functions
- **DAO Members**: Their DAO's public data only
- **Public**: Health checks only (no authentication required)

## Error Handling

All endpoints return consistent error responses:

```json
{
  "error": "Failed to fetch elders overview",
  "message": "Connection timeout",
  "timestamp": "2024-01-15T10:30:00Z"
}
```

### Common Status Codes

- `200 OK` - Successful request
- `400 Bad Request` - Invalid parameters
- `401 Unauthorized` - Missing or invalid token
- `403 Forbidden` - Insufficient permissions
- `404 Not Found` - Resource not found
- `500 Internal Server Error` - Server error

## Performance Considerations

### Rate Limiting

- Dashboard refresh: 30s minimum
- Real-time updates: 15s standard, 5s minimum
- Health checks: 60s standard

### Optimization Tips

1. **Use real-time updates** for frequently changing metrics
2. **Cache dashboard data** on the client side
3. **Subscribe to specific sections** instead of full dashboard
4. **Implement debouncing** for user actions
5. **Use pagination** for large datasets

## Integration Examples

### Complete Dashboard Implementation

```typescript
function MorioDashboard() {
  const { data: dashboard, isLoading } = useMorioDashboard();
  const { systemStatus, alerts, isConnected } = useMorioRealTime();

  if (isLoading) return <LoadingSpinner />;

  return (
    <div className="morio-dashboard">
      <SystemStatusBar status={systemStatus} isConnected={isConnected} />
      <AlertsPanel alerts={alerts} />
      
      <div className="dashboard-grid">
        {dashboard?.sections.map((section) => (
          <SectionCard key={section.section} section={section} />
        ))}
      </div>
    </div>
  );
}
```

### Alert Listener

```typescript
function AlertsListener() {
  const { alerts } = useMorioRealTime();

  useEffect(() => {
    alerts.forEach(alert => {
      if (!alert.read) {
        // Show notification
        toast.show(alert.title, { 
          severity: alert.severity,
          description: alert.description 
        });
      }
    });
  }, [alerts]);

  return null;
}
```

## Monitoring & Debugging

### Enable Debug Logging

```typescript
// In browser console
localStorage.setItem('MORIO_DEBUG', 'true');
```

### WebSocket Debug Events

```javascript
socket.onAny((event, ...args) => {
  console.log('WebSocket event:', event, args);
});
```

## Support & Troubleshooting

### Common Issues

1. **WebSocket connection fails**
   - Check authentication token
   - Verify CORS settings
   - Check firewall/proxy settings

2. **Data not updating**
   - Verify real-time subscriptions are active
   - Check network connection
   - Review console for errors

3. **Slow dashboard load**
   - Enable caching
   - Reduce refresh interval
   - Check database performance

## Version History

- **v1.0** (2024-01-15) - Initial release
  - Dashboard aggregation
  - Real-time WebSocket updates
  - Caching system
  - Role-based access control
