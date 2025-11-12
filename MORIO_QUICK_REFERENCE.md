# Morio Data Hub - Quick Reference Guide

## 🚀 Quick Start (5 Minutes)

### Step 1: Install Dependencies
```bash
npm install socket.io node-cache
npm install --save-dev @types/node-cache
```

### Step 2: Add to Your Server
```typescript
// In your main server file (e.g., server.ts)
import { setupMorioDataHub } from './core/morio/setup';

const { httpServer, wsServer } = await setupMorioDataHub(app, 3000);
```

### Step 3: Use in React
```typescript
import { useMorioDashboard, useMorioRealTime } from '@/hooks/useMorioDataHub';

export function Dashboard() {
  const { data } = useMorioDashboard();
  const { systemStatus, alerts, isConnected } = useMorioRealTime();
  
  return (
    <div>
      {/* Use data here */}
    </div>
  );
}
```

### Step 4: Add Environment Variables
```env
MORIO_CACHE_TTL=300
MORIO_HEALTH_CHECK_INTERVAL=60000
MORIO_WEBSOCKET_ENABLED=true
FRONTEND_URL=http://localhost:5173
```

Done! 🎉

---

## 📡 REST API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/morio/dashboard` | GET | All 5 dashboard sections |
| `/api/morio/elders/overview` | GET | Elder Council metrics |
| `/api/morio/agents/overview` | GET | Agent network status |
| `/api/morio/nutu-kwetu/overview` | GET | Community metrics |
| `/api/morio/treasury/overview` | GET | Financial metrics |
| `/api/morio/governance/overview` | GET | Governance metrics |
| `/api/morio/health` | GET | System health check |

**Example:**
```bash
curl -H "Authorization: Bearer <token>" \
  http://localhost:3000/api/morio/dashboard
```

---

## 🔌 WebSocket Events

### Subscribe
```javascript
// Subscribe to dashboard updates
socket.emit('subscribe:dashboard', 'dao-123');

// Subscribe to alerts
socket.emit('subscribe:alerts', 'dao-123');

// Subscribe to performance metrics
socket.emit('subscribe:performance');
```

### Listen
```javascript
socket.on('data:system-status', (data) => {
  console.log('System status updated:', data);
});

socket.on('new:alert', (alert) => {
  console.log('New alert:', alert);
});

socket.on('data:performance', (metrics) => {
  console.log('Performance metrics:', metrics);
});
```

---

## 🪝 React Hooks

### Get Dashboard Data
```typescript
const { data, isLoading, error } = useMorioDashboard('dao-123');
```

### Get Specific Section
```typescript
const { data: section } = useMorioSection('elders', 'dao-123');
```

### Real-Time Updates
```typescript
const { 
  systemStatus, 
  alerts, 
  performance, 
  isConnected 
} = useMorioRealTime('dao-123');
```

### System Health
```typescript
const { data: health } = useMorioHealth();
```

---

## 💾 Database Tables

### agents
```sql
CREATE TABLE agents (
  id VARCHAR(255) PRIMARY KEY,
  name VARCHAR(255),
  status ENUM('online', 'offline'),
  last_heartbeat TIMESTAMP,
  messages_processed INT
);
```

### dao_members
```sql
CREATE TABLE dao_members (
  id VARCHAR(255) PRIMARY KEY,
  dao_id VARCHAR(255),
  user_id VARCHAR(255),
  last_active TIMESTAMP
);
```

### dao_treasury
```sql
CREATE TABLE dao_treasury (
  id VARCHAR(255) PRIMARY KEY,
  dao_id VARCHAR(255),
  balance DECIMAL(20, 8),
  monthly_burn_rate DECIMAL(20, 8)
);
```

### proposals
```sql
CREATE TABLE proposals (
  id VARCHAR(255) PRIMARY KEY,
  dao_id VARCHAR(255),
  title VARCHAR(255),
  status ENUM('active', 'passed', 'failed')
);
```

---

## 🎨 Response Format

### Dashboard Section
```json
{
  "section": "elders",
  "title": "Elder Council Status",
  "icon": "👑",
  "data": [
    {
      "label": "ELD-SCRY Threats",
      "value": 127,
      "unit": "this week",
      "trend": "down",
      "severity": "success"
    }
  ],
  "lastUpdated": "2024-01-15T10:30:00Z"
}
```

### Alert Format
```json
{
  "id": "ALERT-001",
  "severity": "warning",
  "title": "Security Threat Detected",
  "description": "3 anomalies detected",
  "timestamp": "2024-01-15T10:30:00Z"
}
```

---

## 🔐 Authentication

### Add Token to Request
```typescript
const response = await fetch('/api/morio/dashboard', {
  headers: {
    Authorization: `Bearer ${localStorage.getItem('auth_token')}`
  }
});
```

### WebSocket Auth
```javascript
const socket = io(window.location.origin, {
  auth: {
    token: localStorage.getItem('auth_token')
  }
});
```

---

## ⚙️ Configuration

### Cache TTLs
- Real-time data: 60s
- Dashboard sections: 5m
- Reports: 1h

### Update Intervals
- System status: 30s
- Performance metrics: 60s
- Alerts: 15s

### Configure Custom TTLs
```typescript
morioService.getCachedOrFresh(
  'custom:key',
  fetchFunction,
  600 // 10 minutes
);
```

---

## 🐛 Troubleshooting

### WebSocket not connecting?
```typescript
// Check token
const token = localStorage.getItem('auth_token');
console.log('Token exists:', !!token);

// Check connection
socket.on('connect_error', (error) => {
  console.log('Connection error:', error);
});
```

### Dashboard not updating?
```typescript
// Check subscriptions
socket.emit('subscribe:dashboard', 'dao-123');

// Check network tab in DevTools
// Look for WebSocket handshake
```

### Slow responses?
```typescript
// Check cache hit rate
GET /api/morio/cache/stats

// Monitor response times
fetch('/api/morio/dashboard').then(r => console.time('dashboard')).then(() => console.timeEnd('dashboard'));
```

---

## 📊 Data Severity Levels

| Severity | Color | Usage |
|----------|-------|-------|
| success | 🟢 Green | All good |
| warning | 🟡 Yellow | Attention needed |
| danger | 🔴 Red | Urgent action |
| info | 🔵 Blue | Informational |

---

## 📈 Dashboard Sections

### 👑 Elders
- ELD-SCRY threats and uptime
- ELD-KAIZEN optimizations
- ELD-LUMEN reviews and approval rate

### ⚙️ Agents
- Active agents count
- System health percentage
- Messages processed
- Threats blocked

### 🤝 Community
- Active members
- Engagement rate
- New members this month
- Community score

### 💰 Treasury
- Total balance (M MTAA)
- Monthly burn rate
- Runway (months)
- Investment pools

### ⚖️ Governance
- Active proposals
- Voting participation
- Passed proposals
- Member delegate rate

---

## 🔄 Common Workflows

### Display Dashboard
```typescript
const { data } = useMorioDashboard();

return data?.sections && (
  <>
    <EldersCard data={data.sections.elders} />
    <AgentsCard data={data.sections.agents} />
    <CommunityCard data={data.sections.community} />
    <TreasuryCard data={data.sections.treasury} />
    <GovernanceCard data={data.sections.governance} />
  </>
);
```

### Show Alerts
```typescript
const { alerts } = useMorioRealTime();

return (
  <div>
    {alerts.map(alert => (
      <AlertBanner key={alert.id} alert={alert} />
    ))}
  </div>
);
```

### Monitor System Health
```typescript
const { systemStatus } = useMorioRealTime();

return (
  <StatusIndicator 
    status={systemStatus?.overall}
    components={systemStatus?.components}
  />
);
```

---

## 📚 Documentation Files

| File | Purpose |
|------|---------|
| `MORIO_DATA_HUB_API.md` | Complete API reference |
| `MORIO_DATA_HUB_README.md` | Implementation guide |
| `MORIO_DATA_HUB_IMPLEMENTATION.md` | This summary |
| `server/core/morio/setup.ts` | Server integration |
| `shared/types/morio.types.ts` | Type definitions |

---

## 🎯 Production Checklist

- [ ] Environment variables set
- [ ] Database tables created
- [ ] Authentication configured
- [ ] WebSocket enabled
- [ ] Caching configured
- [ ] Rate limiting setup
- [ ] Monitoring enabled
- [ ] Error logging setup
- [ ] Load tested
- [ ] Security review done

---

## 💡 Pro Tips

1. **Use real-time updates** for frequently changing data
2. **Cache dashboard** on client side too
3. **Subscribe to specific sections** if you don't need all data
4. **Implement debouncing** for high-frequency updates
5. **Monitor WebSocket connections** in production
6. **Use debug mode** only in development
7. **Set appropriate cache TTLs** based on data freshness needs

---

## 🆘 Get Help

1. **API issues**: See `MORIO_DATA_HUB_API.md`
2. **Setup issues**: See `MORIO_DATA_HUB_README.md`
3. **Integration**: See `server/core/morio/setup.ts`
4. **Types**: See `shared/types/morio.types.ts`

---

## ✅ You're Ready!

You now have:
- ✅ Complete REST API
- ✅ Real-time WebSocket
- ✅ React hooks
- ✅ TypeScript types
- ✅ Full documentation
- ✅ Production setup

Start building! 🚀
