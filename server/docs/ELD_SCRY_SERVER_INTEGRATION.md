# ELD-SCRY Server Integration Guide

## Integration Steps

### Step 1: Import ELD-SCRY

In your main server file (e.g., `server/src/index.ts`):

```typescript
import { eldScry } from './core/elders/scry';
```

### Step 2: Initialize on Server Startup

Add to your server initialization sequence (after database connection):

```typescript
// Start elder systems
console.log('Starting elder systems...');
await eldScry.start();
console.log('✓ ELD-SCRY surveillance active');
```

### Step 3: Ensure Routes are Registered

The SCRY routes are already in `routes/elders.ts`. Verify they're registered:

```typescript
import elderRoutes from './routes/elders';

app.use('/api/elders', elderRoutes);
```

### Step 4: Graceful Shutdown

Add to your shutdown sequence:

```typescript
process.on('SIGTERM', async () => {
  console.log('Shutdown signal received: closing gracefully');
  await eldScry.stop();
  // ... other shutdown procedures
  process.exit(0);
});
```

---

## Complete Server Integration Example

```typescript
import express from 'express';
import { eldScry } from './core/elders/scry';
import { eldKaizen } from './core/elders/kaizen';
import elderRoutes from './routes/elders';

const app = express();

// Middleware setup
app.use(express.json());
app.use(authenticateToken);

// Register elder routes
app.use('/api/elders', elderRoutes);

// Start server
const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, async () => {
  console.log(`🚀 Server running on port ${PORT}`);
  
  // Initialize elders after database is ready
  try {
    console.log('Starting elder systems...');
    await eldScry.start();
    console.log('✓ ELD-SCRY monitoring active');
    
    await eldKaizen.start();
    console.log('✓ ELD-KAIZEN optimization active');
  } catch (error) {
    console.error('Failed to start elders:', error);
    process.exit(1);
  }
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('Shutdown signal received');
  await eldScry.stop();
  await eldKaizen.stop();
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});
```

---

## API Access Patterns

### For Superusers (Global Threat Overview)

```typescript
// Get all threats across all DAOs
async function getGlobalThreats(token: string) {
  const response = await fetch('/api/elders/scry/dashboard', {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  return response.json();
}

// Sample response:
// {
//   "threatStats": { "totalThreatsDetected": 42, "criticalThreats": 3 },
//   "daos": [ { "daoId": "...", "threats": 5, "riskLevel": "high" } ]
// }
```

### For DAO Members (DAO-Specific Threats)

```typescript
// Get threats for their DAO
async function getDAOThreats(daoId: string, token: string) {
  const response = await fetch(`/api/elders/scry/dao/${daoId}/threats`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  return response.json();
}

// Get 24-hour forecast
async function getDAOForecast(daoId: string, token: string) {
  const response = await fetch(`/api/elders/scry/dao/${daoId}/forecast`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  return response.json();
}

// Check user suspicion score
async function getUserSuspicion(daoId: string, userId: string, token: string) {
  const response = await fetch(
    `/api/elders/scry/dao/${daoId}/suspicion/${userId}`,
    { headers: { 'Authorization': `Bearer ${token}` } }
  );
  return response.json();
}
```

---

## Monitoring ELD-SCRY Health

### Health Check Endpoint

```bash
curl http://localhost:5000/api/elders/scry/health
```

**Response:**
```json
{
  "success": true,
  "elderName": "ELD-SCRY",
  "status": "monitoring",
  "active": true,
  "monitoredDAOs": 10,
  "threatsDetected": 42,
  "lastAnalysis": "2025-11-12T10:30:00Z"
}
```

### Server Logs

```bash
# Monitor ELD-SCRY activity
journalctl -u mtaa-dao | grep "ELD-SCRY"

# Watch for critical threats
journalctl -u mtaa-dao | grep "critical"

# Follow real-time logs
journalctl -u mtaa-dao -f
```

---

## Database Integration

### Activity Recording

Ensure activities are being recorded to trigger surveillance:

```typescript
// When recording a transaction
await recordActivity({
  daoId: 'dao-abc',
  userId: 'user-123',
  type: 'transfer',
  amount: 500000,
  timestamp: new Date()
});

// ELD-SCRY will automatically pick this up in next analysis cycle
```

### Query Historical Threats

```typescript
import { db } from './db';

// Get threats from last 24 hours
const threats = await db.query(`
  SELECT * FROM threat_events 
  WHERE timestamp > NOW() - INTERVAL 1 DAY 
  ORDER BY timestamp DESC
`);
```

---

## Performance Tuning

### Adjust Analysis Interval

```typescript
// Faster analysis (30 minutes)
const eldScry = new EldScryElder({
  updateInterval: 1800000,  // 30 minutes
  autoReportThreats: true
});

// Slower analysis (2 hours) for lower resource usage
const eldScry = new EldScryElder({
  updateInterval: 7200000,  // 2 hours
  autoReportThreats: true
});
```

### Resource Monitoring

```typescript
// Monitor memory usage
console.log(`ELD-SCRY Status:`, eldScry.getStatus());
// Shows: status, threat counts, monitored DAOs, memory footprint

// Prune old data manually
await eldScry.pruneOldData(7);  // Keep last 7 days
```

---

## Testing ELD-SCRY

### Unit Test Example

```typescript
import { EldScryElder } from '../core/elders/scry';

describe('ELD-SCRY', () => {
  it('should detect treasury drain attacks', async () => {
    const scry = new EldScryElder({ autoReportThreats: false });
    
    const activities = [
      {
        activityId: '1',
        daoId: 'test-dao',
        userId: 'attacker',
        type: 'transfer',
        timestamp: new Date(),
        details: { amount: 100000 }
      },
      {
        activityId: '2',
        daoId: 'test-dao',
        userId: 'attacker',
        type: 'transfer',
        timestamp: new Date(Date.now() + 600000),
        details: { amount: 100000 }
      }
    ];
    
    const metrics = await scry.monitorDAO('test-dao', activities);
    expect(metrics.detectedThreats.length).toBeGreaterThan(0);
    expect(metrics.riskLevel).toBe('high');
  });
});
```

### Integration Test Example

```typescript
import axios from 'axios';

describe('ELD-SCRY API', () => {
  it('should return threats for DAO member', async () => {
    const response = await axios.get(
      'http://localhost:5000/api/elders/scry/dao/dao-abc/threats',
      {
        headers: {
          'Authorization': `Bearer ${validToken}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    expect(response.status).toBe(200);
    expect(response.data.success).toBe(true);
    expect(Array.isArray(response.data.threats)).toBe(true);
  });
});
```

---

## Troubleshooting Integration Issues

### ELD-SCRY Not Starting

**Problem:** "ELD-SCRY failed to start"

**Solution:**
1. Check database connection
2. Verify MessageBus is initialized
3. Check logs for specific errors
4. Ensure `core/elders/scry/index.ts` is properly exported

### No Threats Being Detected

**Problem:** Dashboard shows zero threats

**Solution:**
1. Verify activities are being recorded
2. Check activity data format matches expected structure
3. Run manual test: `eldScry.monitorDAO('dao-id', testActivities)`
4. Check surveillance engine patterns are initialized

### High Memory Usage

**Problem:** Server memory increases over time

**Solution:**
1. Reduce `updateInterval` to run less frequently
2. Call `eldScry.pruneOldData(days)` to clear old data
3. Monitor with `eldScry.getStatus()` to see data size
4. Consider archiving old threat events to database

### API Returns 401 Unauthorized

**Problem:** Can't access DAO endpoints

**Solution:**
1. Verify JWT token is valid
2. Check user role is set correctly
3. Verify DAO membership in user.daos array
4. Ensure `authenticateToken` middleware is applied to routes

---

## Message Bus Integration

### Listening for Threats

```typescript
import { messageBus } from './message-bus';

messageBus.subscribe('THREAT_ALERT', (message) => {
  console.log(`🚨 Threat detected:`, message.data);
  
  // Send notification to DAO
  notifyDAO(message.data.daoId, {
    type: 'security_alert',
    threat: message.data
  });
  
  // Log to security system
  securityLogger.critical(message.data);
});
```

### Health Check Responses

```typescript
messageBus.subscribe('HEALTH_CHECK', (message) => {
  if (message.data.requesterId === 'coordinator') {
    const status = eldScry.getStatus();
    messageBus.publish('HEALTH_CHECK_RESPONSE', {
      senderId: 'scry',
      data: { ...status, alive: true }
    });
  }
});
```

---

## Monitoring Dashboard

### Key Metrics to Track

1. **Total Threats Detected**: Cumulative over time
2. **Critical Threat Count**: Should trigger immediate alerts
3. **Active Monitored DAOs**: Should match DAO registry
4. **Analysis Cycle Time**: Should be < 1 second per DAO
5. **Memory Usage**: Should remain stable
6. **Last Analysis Timestamp**: Should update regularly

### Dashboard Queries

```typescript
// Get threat trends
SELECT DATE(timestamp), COUNT(*) as threats 
FROM threat_events 
GROUP BY DATE(timestamp) 
ORDER BY DATE(timestamp) DESC 
LIMIT 30;

// Get most dangerous DAOs
SELECT dao_id, COUNT(*) as threat_count, MAX(severity) as max_severity
FROM threat_events
GROUP BY dao_id
ORDER BY threat_count DESC
LIMIT 10;

// Get threat patterns
SELECT pattern_type, COUNT(*) as occurrences, AVG(confidence) as avg_confidence
FROM threat_events
GROUP BY pattern_type
ORDER BY occurrences DESC;
```

---

## Next Steps

1. **Deploy to Server**: Add eldScry.start() to server initialization
2. **Frontend Dashboard**: Build React components to visualize threats
3. **Database Schema**: Create threat_events table if not exists
4. **Monitoring Setup**: Configure log aggregation and alerting
5. **Documentation**: Update API docs with threat endpoints
6. **Testing**: Run integration tests in staging environment
7. **Production Rollout**: Deploy with monitoring active

---

## Support

For integration issues:
1. Check `logs/eld-scry.log` for diagnostic information
2. Run `eldScry.getStatus()` to inspect current state
3. Review threat patterns in `surveillance-engine.ts`
4. Check API responses for error details
5. Contact security team if threats are not being detected correctly
