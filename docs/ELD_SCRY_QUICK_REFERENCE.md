# ELD-SCRY Quick Reference Guide

## At a Glance

**ELD-SCRY** is the threat detection and forecasting elder for MtaaDAO. It runs continuous surveillance on DAO activities and predicts health issues before they become critical.

---

## Core Capabilities

| Capability | What It Does | Endpoint |
|-----------|-------------|----------|
| **Threat Detection** | Detects 7 known attack patterns in real-time | GET /scry/dao/:daoId/threats |
| **Health Forecasting** | Predicts DAO health 24 hours ahead | GET /scry/dao/:daoId/forecast |
| **Risk Scoring** | Calculates individual user threat levels | GET /scry/dao/:daoId/suspicion/:userId |
| **Early Warnings** | Generates actionable alerts for critical risks | In forecast response |
| **System Overview** | Global threat dashboard for admins | GET /scry/dashboard |

---

## Getting Started

### 1. Server Integration

```typescript
// In your server/src/index.ts
import { eldScry } from './core/elders/scry';

// Start on server launch
await eldScry.start();
console.log('✓ ELD-SCRY active');

// Stop on shutdown
eldScry.stop();
```

### 2. Access the API

```bash
# Check health (public)
curl http://localhost:5000/api/elders/scry/health

# Get threats (requires auth)
curl -H "Authorization: Bearer {token}" \
  http://localhost:5000/api/elders/scry/dao/dao-id/threats

# Get forecast
curl -H "Authorization: Bearer {token}" \
  http://localhost:5000/api/elders/scry/dao/dao-id/forecast
```

### 3. Build Frontend Dashboard

See `ELD_SCRY_FRONTEND_IMPLEMENTATION.md` for complete component examples:
- `ScryDashboard.tsx` - Main router
- `SuperuserThreatDashboard.tsx` - System-wide view
- `DAOMemberThreatDashboard.tsx` - DAO-specific view

---

## File Structure

```
core/elders/scry/
├── surveillance-engine.ts  (Activity monitoring + pattern matching)
├── threat-predictor.ts     (Health forecasting + risk analysis)
└── index.ts                (Main elder class + lifecycle)

routes/elders.ts            (API endpoints)
tests/
├── unit/surveillance-engine.test.ts
├── unit/threat-predictor.test.ts
└── e2e/threat-detection.e2e.ts
```

---

## API Quick Reference

### Public Endpoint

```http
GET /api/elders/scry/health
```

Returns: `{ status, active, threatsDetected, lastAnalysis }`

### Superuser Endpoints

```http
GET /api/elders/scry/dashboard
GET /api/elders/scry/threat-signatures
```

### DAO Member Endpoints

```http
GET /api/elders/scry/dao/{daoId}/threats
GET /api/elders/scry/dao/{daoId}/forecast
GET /api/elders/scry/dao/{daoId}/suspicion/{userId}
```

---

## Key Concepts

### Threat Patterns (7 Total)

1. **Treasury Drain**: Multiple large transfers
2. **Governance Takeover**: Coordinated voting attacks
3. **Sybil Attack**: Fake account voting blocs
4. **Flash Loan Attack**: Sudden balance exploitation
5. **Insider Trading**: Pre-announcement trades
6. **Member Exodus**: Mass membership departures
7. **Proposal Spam**: Low-quality proposal flooding

### Risk Levels

- **Critical** (0.75-1.0): Immediate intervention needed
- **High** (0.5-0.75): Close monitoring required
- **Medium** (0.25-0.5): Warning alerts
- **Low** (0.0-0.25): Normal activity

### Health Metrics

- **Treasury**: Fund management and depletion risk
- **Governance**: Participation and control concentration
- **Community**: Member engagement and retention
- **System**: Operational stability
- **Overall**: Weighted combination (0-100)

---

## Common Tasks

### Monitor a DAO

```typescript
const activities = await getDAOActivities('dao-id', lastHour);
const metrics = await eldScry.monitorDAO('dao-id', activities);

if (metrics.riskLevel === 'critical') {
  alertDAO('dao-id', 'Critical threats detected');
}
```

### Get Threat Summary

```typescript
const response = await fetch('/api/elders/scry/dao/dao-id/threats', {
  headers: { 'Authorization': `Bearer ${token}` }
});

const { threatCount, criticalCount, threats } = await response.json();
console.log(`${criticalCount}/${threatCount} critical threats`);
```

### Get Health Forecast

```typescript
const response = await fetch('/api/elders/scry/dao/dao-id/forecast', {
  headers: { 'Authorization': `Bearer ${token}` }
});

const { forecast } = await response.json();
console.log(`Health in 24h: ${forecast.predictedScore}`);
forecast.earlyWarnings.forEach(w => console.log(w.requiredAction));
```

### Check User Suspicion

```typescript
const response = await fetch(
  '/api/elders/scry/dao/dao-id/suspicion/user-id',
  { headers: { 'Authorization': `Bearer ${token}` } }
);

const { suspicionScore, riskLevel } = await response.json();
if (riskLevel === 'high') {
  flagUserForReview('user-id');
}
```

---

## Configuration Options

### Update Interval

```typescript
// Default: 1 hour (3600000ms)
const scry = new EldScryElder({
  updateInterval: 1800000  // 30 minutes
});
```

### Auto-Reporting

```typescript
// Default: true (auto-reports critical threats)
const scry = new EldScryElder({
  autoReportThreats: true
});
```

### Data Retention

```typescript
// Keep last 30 days
await eldScry.pruneOldData(30);

// Keep last 365 days
await eldScry.pruneOldData(365);
```

---

## Monitoring & Debugging

### Check Status

```typescript
const status = eldScry.getStatus();
console.log(status);
// {
//   status: 'monitoring',
//   lastAnalysis: Date,
//   daoMetrics: Map,
//   threatStats: { totalThreatsDetected, criticalThreats, ... }
// }
```

### Enable Logging

```bash
export DEBUG=scry:*
npm start
```

### Test Threat Detection

```bash
npm test -- tests/e2e/threat-detection.e2e.ts
```

### Check Performance

```bash
npm test -- tests/performance/scry-load.test.ts
```

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| No threats detected | Check activities are recorded; run `eldScry.monitorDAO(daoId, activities)` manually |
| Low forecast confidence | Need more historical data; wait 24+ hours for accuracy |
| High memory usage | Reduce `updateInterval` or call `pruneOldData()` |
| API returns 401 | Check JWT token valid; verify DAO membership in user.daos array |
| Slow analysis | Increase `updateInterval` or reduce monitored DAOs |

---

## Response Examples

### Threat Response

```json
{
  "success": true,
  "daoId": "dao-abc",
  "threatCount": 3,
  "threats": [
    {
      "patternId": "treasury-drain",
      "type": "Treasury Drain Attack",
      "severity": "critical",
      "confidence": 0.85,
      "affectedEntities": ["user-123"],
      "timestamp": "2025-11-12T10:15:00Z"
    }
  ]
}
```

### Forecast Response

```json
{
  "success": true,
  "forecast": {
    "timeframeHours": 24,
    "predictedScore": 65,
    "confidence": 0.82,
    "riskFactors": [
      {
        "category": "treasury",
        "riskLevel": "high",
        "probability": 0.75,
        "impact": 70,
        "description": "High volatility detected"
      }
    ],
    "earlyWarnings": [
      {
        "severity": "critical",
        "message": "Treasury depletion risk",
        "timeToEvent": 12,
        "requiredAction": "Emergency funding vote"
      }
    ]
  }
}
```

---

## Integration with Other Elders

### ELD-KAIZEN (Optimization)

- SCRY detects risks
- KAIZEN proposes optimizations
- Coordinator synthesizes both

### ELD-LUMEN (Ethics)

- SCRY flags suspicious behavior
- LUMEN evaluates compliance
- Combined governance view

### Message Types

- `HEALTH_CHECK`: Alive signal
- `ANALYSIS_REQUEST`: Request metrics
- `THREAT_ALERT`: Broadcast critical threats

---

## Performance Benchmarks

| Metric | Value |
|--------|-------|
| Analysis per DAO | ~100ms |
| 100 DAOs total | ~1s |
| Memory per 1000 threats | ~50MB |
| Max history retained | 10,000 activities/threat patterns |
| Forecast horizon | 24 hours |
| Confidence range | 30% - 95% |

---

## Documentation Reference

- **Full Implementation**: `ELD_SCRY_IMPLEMENTATION.md`
- **Server Integration**: `ELD_SCRY_SERVER_INTEGRATION.md`
- **Frontend Implementation**: `ELD_SCRY_FRONTEND_IMPLEMENTATION.md`
- **Testing Guide**: `ELD_SCRY_TESTING_GUIDE.md`
- **API Reference**: See `/api/elders` endpoint docs
- **Code Examples**: `core/elders/scry/`

---

## Support & Contact

For issues or questions:
1. Check relevant documentation above
2. Review test files for examples
3. Check logs: `journalctl -u mtaa-dao | grep ELD-SCRY`
4. Contact security team with threat details

---

## Version Info

- **ELD-SCRY Version**: 1.0.0
- **Elder System Version**: 1.0.0
- **Compatible With**: ELD-KAIZEN 1.0+, ElderCouncil architecture
- **Last Updated**: 2025-11-12

---

## Quick Links

- [Implementation Guide](./ELD_SCRY_IMPLEMENTATION.md)
- [Server Integration](./ELD_SCRY_SERVER_INTEGRATION.md)
- [Frontend Implementation](./ELD_SCRY_FRONTEND_IMPLEMENTATION.md)
- [Testing Guide](./ELD_SCRY_TESTING_GUIDE.md)
- [Source Code](../core/elders/scry/)
- [API Routes](../routes/elders.ts)
