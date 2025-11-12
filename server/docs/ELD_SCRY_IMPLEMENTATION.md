# ELD-SCRY Implementation Guide

## Overview

**ELD-SCRY** (The Watcher Elder) is the intelligence and threat detection system for MtaaDAO. It provides continuous surveillance, threat pattern detection, and predictive health forecasting.

### Strategic Role
- **Threat Detection**: Identifies suspicious patterns and attack vectors
- **Predictive Intelligence**: Forecasts DAO health issues before they become critical
- **Adaptive Learning**: Learns from detected threats to improve future detection
- **Early Warning**: Generates alerts for governance, treasury, and community threats

---

## Architecture

### Three Core Components

#### 1. **Surveillance Engine** (`surveillance-engine.ts`)
Continuous monitoring of DAO activities with pattern recognition.

```
Activities → Pattern Matching → Threat Detection → Learning
     ↓              ↓                  ↓               ↓
 Transfer      Treasury Drain    Pattern Alert    Update Traits
 Proposal      Governance Attack  Risk Score      Improve Detection
 Vote          Sybil Attack       Confidence      Build Knowledge
```

**Key Features:**
- Registers 7 known threat patterns (Treasury Drain, Governance Takeover, Sybil Attack, etc.)
- Detects temporal clustering (multiple suspicious activities in short timeframe)
- Calculates risk scores for each activity
- Maintains learned threat traits for predictive suspicion scoring

**Threat Patterns:**
- Treasury Drain: Multiple large transfers in short timeframe
- Governance Takeover: Coordinated voting to seize control
- Sybil Attack: Many fake accounts voting identically
- Flash Loan Attack: Sudden large balance changes
- Insider Trading: Trades before announcements
- Member Exodus: Unusual mass departures
- Proposal Spam: Excessive low-quality proposals

#### 2. **Threat Predictor** (`threat-predictor.ts`)
AI-based forecasting of potential DAO health issues.

```
Historical Data → Trend Analysis → Risk Identification → Early Warnings
       ↓                ↓                   ↓                  ↓
   7-day history    Calculate slope    High burn rate    Treasury depletion
   Volatility       Identify patterns  Low participation   Governance crisis
   Stability        Project forward    Member exodus      Community collapse
```

**Forecasting Methods:**
- Linear regression for trend projection
- Volatility analysis for stability assessment
- Risk factor identification (treasury, governance, community, system)
- Confidence scoring based on data quality

**Risk Factors Detected:**
- Treasury: Depletion, volatility, mismanagement
- Governance: Declining participation, low success rates
- Community: Member exodus, engagement collapse
- System: Instability, operational failures

#### 3. **ELD-SCRY Elder** (`index.ts`)
Main coordination and messaging interface.

```
Lifecycle:
  start() → Performance Analysis Loop → broadcastAnalysis() → stop()
  
Message Types:
  - HEALTH_CHECK: Respond with status
  - ANALYSIS_REQUEST: Generate specific DAO analysis
  - THREAT_ALERT: Broadcast threats to coordinator
```

---

## Data Flow

### Threat Detection Flow

```
1. ACTIVITY COLLECTION
   └─ DAO transactions, proposals, votes collected
   
2. SURVEILLANCE
   └─ SurveillanceEngine.monitorDAO(daoId, activities)
   
3. PATTERN MATCHING
   ├─ Check against 7 known patterns
   ├─ Calculate risk scores
   └─ Identify affected entities
   
4. TEMPORAL CLUSTERING
   └─ Group activities within 1-hour windows
   
5. THREAT GENERATION
   ├─ Create DetectedPattern for matches
   ├─ Calculate confidence score
   └─ Store in threat history
   
6. LEARNING
   ├─ Record threat signatures
   ├─ Update threat trait scores
   └─ Improve future detection sensitivity
   
7. FORECASTING
   ├─ Project health metrics 24 hours ahead
   ├─ Identify risk factors
   └─ Generate early warnings
   
8. REPORTING
   ├─ Communicate threats to coordinator
   └─ Alert DAO members via dashboard
```

### Forecast Flow

```
Historical Metrics
      ↓
  Trend Analysis
  ├─ Calculate slope (improving/declining)
  ├─ Measure volatility (stability)
  └─ Project next 24 hours
      ↓
  Risk Factor Identification
  ├─ Treasury risks (depletion, volatility)
  ├─ Governance risks (participation, attacks)
  ├─ Community risks (exodus, engagement)
  └─ System risks (instability)
      ↓
  Early Warnings
  ├─ Critical issues requiring immediate action
  ├─ High-impact alerts
  └─ Recommended interventions
      ↓
  Confidence Scoring
  └─ Based on data age, stability, and completeness
```

---

## API Endpoints

### Superuser Endpoints

#### `GET /api/elders/scry/health`
**Description:** Public health status of ELD-SCRY

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

#### `GET /api/elders/scry/dashboard`
**Description:** System-wide threat overview for all DAOs (superuser only)

**Auth Required:** `isSuperUser`

**Response:**
```json
{
  "success": true,
  "elderName": "ELD-SCRY",
  "status": "monitoring",
  "threatStats": {
    "totalThreatsDetected": 42,
    "criticalThreats": 3,
    "activeMonitoredDAOs": 10,
    "analysisCount": 24
  },
  "daos": [
    {
      "daoId": "dao-abc",
      "threats": 5,
      "riskLevel": "high",
      "healthTrend": "declining",
      "latestPatterns": [...]
    }
  ]
}
```

#### `GET /api/elders/scry/threat-signatures`
**Description:** All learned threat signatures (superuser only)

**Auth Required:** `isSuperUser`

**Response:**
```json
{
  "success": true,
  "totalSignatures": 156,
  "signatures": [
    {
      "threatLevel": "critical",
      "firstSeen": "2025-11-10T15:00:00Z",
      "lastSeen": "2025-11-12T09:45:00Z",
      "occurrenceCount": 8,
      "traitCount": 12
    }
  ]
}
```

### DAO Member Endpoints

#### `GET /api/elders/scry/dao/:daoId/threats`
**Description:** Detected threats for a specific DAO (member access)

**Auth Required:** `isDaoMember` + member of DAO

**Path Parameters:**
- `daoId`: The DAO ID to query

**Response:**
```json
{
  "success": true,
  "daoId": "dao-abc",
  "threatCount": 5,
  "criticalCount": 1,
  "highCount": 2,
  "threats": [
    {
      "patternId": "treasury-drain",
      "type": "Treasury Drain Attack",
      "severity": "critical",
      "confidence": 0.85,
      "affectedEntities": ["user-123", "user-456"],
      "timestamp": "2025-11-12T10:15:00Z"
    }
  ]
}
```

#### `GET /api/elders/scry/dao/:daoId/forecast`
**Description:** 24-hour health forecast for a DAO

**Auth Required:** `isDaoMember` + member of DAO

**Path Parameters:**
- `daoId`: The DAO ID to query

**Response:**
```json
{
  "success": true,
  "daoId": "dao-abc",
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
        "description": "High treasury volatility detected"
      }
    ],
    "earlyWarnings": [
      {
        "id": "warning_1",
        "severity": "critical",
        "message": "Treasury depletion risk within 24 hours",
        "targetScore": 30,
        "timeToEvent": 12,
        "requiredAction": "Emergency governance vote to authorize new funding"
      }
    ],
    "interventionRecommendations": [...]
  },
  "timestamp": "2025-11-12T10:30:00Z"
}
```

#### `GET /api/elders/scry/dao/:daoId/suspicion/:userId`
**Description:** Suspicion score for a user in a DAO

**Auth Required:** `isDaoMember` + member of DAO

**Path Parameters:**
- `daoId`: The DAO ID
- `userId`: The user ID to evaluate

**Response:**
```json
{
  "success": true,
  "daoId": "dao-abc",
  "userId": "user-123",
  "suspicionScore": 0.72,
  "riskLevel": "high",
  "timestamp": "2025-11-12T10:30:00Z"
}
```

---

## Usage Examples

### Starting ELD-SCRY

```typescript
import { eldScry } from './core/elders/scry';

// Start surveillance
await eldScry.start();
// Output: ✓ ELD-SCRY monitoring active (interval: 3600s)

// Monitor a DAO
const activities = [
  {
    activityId: "activity-1",
    daoId: "dao-abc",
    userId: "user-123",
    type: "transfer",
    timestamp: new Date(),
    details: { amount: 500000, count: 5, timeframeHours: 2 }
  }
];

const metrics = await eldScry.monitorDAO("dao-abc", activities);
// Returns: ScryDAOMetrics with detected patterns and forecast

// Get status
const status = eldScry.getStatus();
console.log(`Threats detected: ${status.threatStats.totalThreatsDetected}`);
console.log(`Critical threats: ${status.threatStats.criticalThreats}`);

// Stop surveillance
await eldScry.stop();
```

### Handling Threats

```typescript
// Get detected threats
const threats = eldScry.getDAOThreats("dao-abc");
threats.forEach(threat => {
  console.log(`${threat.type}: ${threat.severity}`);
  console.log(`Affected: ${threat.affectedEntities.join(', ')}`);
});

// Get forecast
const forecast = eldScry.getDAOForecast("dao-abc");
forecast.earlyWarnings.forEach(warning => {
  if (warning.severity === 'critical') {
    console.log(`⚠️  ${warning.message}`);
    console.log(`Action: ${warning.requiredAction}`);
  }
});

// Check user suspicion
const suspicion = eldScry.getSuspicionScore("user-123");
if (suspicion > 0.7) {
  console.log(`🚨 High-risk user detected: ${suspicion}`);
}
```

---

## Threat Pattern Details

### 1. Treasury Drain Attack
**Indicators:**
- Multiple transfers out of treasury
- Large amounts per transfer
- Concentrated in short timeframe
- Suspicious recipients

**Severity:** Critical (0.85 confidence)

**Mitigation:**
- Require multi-sig authorization for large transfers
- Implement spending limits
- Daily treasury audit

### 2. Governance Takeover
**Indicators:**
- Sudden voting surge
- Coordinated delegates
- Voting bloc formation
- Proposal spam

**Severity:** Critical (0.80 confidence)

**Mitigation:**
- Vote delegation limits
- Voting power distribution checks
- Proposal quality standards

### 3. Sybil Attack
**Indicators:**
- Similar voting behavior across accounts
- Identical timestamps
- Similar profile characteristics
- Coordinated actions

**Severity:** High (0.75 confidence)

**Mitigation:**
- Account age requirements
- Reputation systems
- Voting weight normalization

### 4. Flash Loan Attack
**Indicators:**
- Sudden balance spike
- Immediate transfer
- Same block execution
- Voting with borrowed funds

**Severity:** High (0.70 confidence)

**Mitigation:**
- Block-based voting delays
- Voting power snapshots
- Flash loan detection

### 5. Insider Trading
**Indicators:**
- Trades before announcements
- Abnormal trading volumes
- Suspicious timing
- Information asymmetry

**Severity:** Medium (0.65 confidence)

**Mitigation:**
- Announcement delays
- Trading windows
- Insider rules

### 6. Member Exodus
**Indicators:**
- Sudden mass exits
- Low engagement before exit
- Delegate changes
- Delegation removals

**Severity:** Medium (0.60 confidence)

**Mitigation:**
- Member retention programs
- Governance participation incentives
- Community engagement

### 7. Proposal Spam
**Indicators:**
- Proposal volume spike
- Low quality proposals
- Rapid submission
- High rejection rate

**Severity:** Low (0.55 confidence)

**Mitigation:**
- Proposal quality gates
- Rate limiting
- Deposit requirements

---

## Configuration

### ELD-SCRY Constructor Options

```typescript
const eldScry = new EldScryElder({
  updateInterval: 3600000,    // Analysis interval in ms (1 hour)
  autoReportThreats: true     // Automatically broadcast threats
});
```

### Surveillance Engine

```typescript
// Maximum history size
const maxHistorySize = 10000;

// Temporal clustering window
const timeWindow = 3600000; // 1 hour

// Risk score thresholds
const riskThreshold = 0.6;
```

### Threat Predictor

```typescript
// Maximum history size
const maxHistorySize = 8760; // 1 year of hourly data

// Forecast horizon
const defaultHorizonHours = 24;

// Confidence thresholds
const minConfidence = 0.3;
const maxConfidence = 0.95;
```

---

## Integration with Other Elders

### With ELD-KAIZEN (Optimization)
- **KAIZEN** uses metrics that **SCRY** detects as risks
- SCRY identifies problems → KAIZEN proposes optimizations
- Bidirectional feedback loop

### With ELD-LUMEN (Ethics)
- **SCRY** detects suspicious behavior
- **LUMEN** evaluates ethical compliance
- Combined for comprehensive governance

### With Coordinator
- **SCRY** broadcasts threat alerts to coordinator
- Coordinator synthesizes input from all elders
- Final decisions respect all elder recommendations

---

## Performance Considerations

### Data Storage
- Activity history: 10,000 max per DAO
- Threat signatures: Unlimited (pruned after 30 days)
- Forecasts: Cached per DAO
- Total memory: ~50MB for 100 DAOs

### Analysis Time
- Per-DAO analysis: ~100ms (activity matching + forecasting)
- Full system (10 DAOs): ~1s
- Runs hourly by default

### Scaling
- Linear with number of DAOs
- Constant with number of activities (max history size)
- Can process 1000+ DAOs at 1-hour intervals

---

## Testing & Monitoring

### Health Checks
```bash
curl http://localhost:5000/api/elders/scry/health
```

### Dashboard Monitoring
```bash
curl -H "Authorization: Bearer {token}" \
  http://localhost:5000/api/elders/scry/dashboard
```

### Member Dashboard
```bash
curl -H "Authorization: Bearer {token}" \
  http://localhost:5000/api/elders/scry/dao/dao-abc/threats
```

---

## Future Enhancements

1. **Machine Learning Models**
   - Neural networks for threat prediction
   - Anomaly detection improvements
   - Pattern learning acceleration

2. **Real-time Streaming**
   - WebSocket updates for alerts
   - Live threat visualization
   - Instant member notifications

3. **Cross-DAO Analytics**
   - Pattern sharing between DAOs
   - Collective threat intelligence
   - Industry trend analysis

4. **Integration with External Services**
   - On-chain threat intelligence feeds
   - Blockchain forensics APIs
   - Security provider integrations

5. **Advanced Forecasting**
   - ARIMA models for time series
   - Ensemble methods
   - Confidence intervals

---

## Troubleshooting

### No Threats Detected
- Check if activities are being recorded
- Verify pattern indicators match activity data
- Ensure DAO is being monitored

### Low Forecast Confidence
- Need more historical data (minimum 2 data points)
- Wait 24+ hours for initial accuracy
- Check data stability and volatility

### High False Positives
- Adjust risk score thresholds
- Review pattern indicators
- Fine-tune temporal clustering window

### Performance Issues
- Reduce update interval
- Limit history size
- Archive old data

---

## Support

For issues or questions:
1. Check logs: `journalctl -u mtaa-dao-scry`
2. Review API responses for error details
3. Run health check: `GET /api/elders/scry/health`
4. Contact security team with threat details
