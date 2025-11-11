
# Agent Architecture & Access Control

## Overview

The MtaaDAO platform uses a sophisticated multi-layered AI architecture consisting of **Agents** (analytical/operational) and an **AI Layer** (user-facing intelligence). This document clarifies who accesses what and how information flows through the system.

---

## Architecture Layers

### Layer 1: Agents (Backend Intelligence)
Three core agents operate autonomously in the background:

1. **ANALYZER (ANL-MTAA-001)** - Financial intelligence & threat detection
2. **DEFENDER (DEF-OBSIDIAN-001)** - Security & threat mitigation
3. **SYNCHRONIZER (SYNC-MTAA-001)** - State consistency & conflict resolution

**Access Level:** Super User Only

**Location:** Admin dashboard at `/admin/*` routes

**Purpose:** System-level monitoring, analytics, and security

---

### Layer 2: AI Layer (User Interface)
Three AI components that interact with users:

1. **NURU** - The Mind (reasoning & analytics)
2. **KWETU** - The Body (DAO operations & execution)
3. **MORIO** - The Spirit (conversational interface)

**Access Level:** All users (context-based permissions)

**Location:** Embedded throughout the platform

**Purpose:** User assistance, query handling, task execution

---

## Access Control Matrix

| Component | Super User | Admin | DAO Member | Public User |
|-----------|-----------|-------|------------|-------------|
| **Analyzer Dashboard** | ✅ Full | ❌ No | ❌ No | ❌ No |
| **Defender Monitor** | ✅ Full | ❌ No | ❌ No | ❌ No |
| **Synchronizer Monitor** | ✅ Full | ❌ No | ❌ No | ❌ No |
| **MORIO Chat** | ✅ Full | ✅ Full | ✅ Full | ✅ Limited |
| **NURU Analytics** | ✅ Full | ✅ DAO-scoped | ✅ DAO-scoped | ❌ No |
| **KWETU Operations** | ✅ Full | ✅ DAO-scoped | ✅ Permission-based | ❌ No |

---

## Information Flow

### 1. User Query Flow
```
User → MORIO (chat) → NURU (understand) → KWETU (execute) → Response to User
```

**Example:**
- User: "What's our DAO balance?"
- MORIO receives query
- NURU analyzes intent
- KWETU fetches treasury data
- MORIO formats friendly response

### 2. Threat Detection Flow
```
Transaction → ANALYZER (detect) → DEFENDER (assess) → Action (quarantine/alert) → Notification
```

**Notifications sent to:**
- Super User: All threats (via admin dashboard)
- DAO Admin: DAO-specific threats (via notifications)
- Affected User: Personal threats (via MORIO chat)

### 3. State Synchronization Flow
```
Node Update → SYNCHRONIZER (detect drift) → Resolve conflicts → Broadcast → Update all nodes
```

**Notifications sent to:**
- Super User: All drift events
- System Admins: Critical inconsistencies

---

## Agent Pages & Routes

### Super User Only Routes

#### Analyzer Dashboard
**Route:** `/analyzer-dashboard`

**Access:** `role === 'super_user'`

**Features:**
- Real-time fraud detection metrics
- Treasury health analysis
- Node profiling
- Threat pattern visualization
- System health monitoring

**API Endpoints:**
```
GET  /api/analyzer/status
POST /api/analyzer/analyze/transaction/:id
POST /api/analyzer/analyze/proposal/:id
GET  /api/analyzer/dao/:daoId/comprehensive
GET  /api/analyzer/node/:userId
GET  /api/analyzer/system/monitor
```

#### Defender Monitor
**Route:** `/defender-monitor`

**Access:** `role === 'super_user'`

**Features:**
- Active threat dashboard
- Quarantine management
- Defense action logs
- Trust score tracking
- Ethical review audit

**API Endpoints:**
```
GET  /api/defender/status
POST /api/defender/assess-threat
POST /api/defender/quarantine/:userId
POST /api/defender/release/:userId
GET  /api/defender/quarantined
```

#### Synchronizer Monitor
**Route:** `/synchronizer-monitor`

**Access:** `role === 'super_user'`

**Features:**
- State drift visualization
- Conflict resolution logs
- Checkpoint management
- Vector clock sync status
- Rollback history

**API Endpoints:**
```
GET  /api/synchronizer/status
POST /api/synchronizer/sync
GET  /api/synchronizer/drift
POST /api/synchronizer/rollback/:checkpointId
GET  /api/synchronizer/snapshots
```

---

## User-Facing AI Integration

### MORIO Chat Widget
**Location:** Floating action button (FAB) on all pages

**Access:** All authenticated users

**Capabilities:**
- Natural language queries
- DAO information retrieval
- Guided workflows
- Onboarding assistance
- Multi-language support (English, Swahili)

### NURU Analytics Integration
**Location:** Dashboard analytics panels

**Access:** Context-based (user sees only their DAO data)

**Capabilities:**
- Treasury insights
- Governance analytics
- Community metrics
- Risk assessments

### KWETU Operation Execution
**Location:** Background (triggered by user actions)

**Access:** Permission-based

**Capabilities:**
- Create proposals
- Execute votes
- Manage treasury
- Process transactions

---

## Notification Flow

### Critical Alerts (Super User)
**Trigger:** High/Critical threats detected

**Delivery:**
1. Admin dashboard notification center
2. Email alert
3. System logs

**Examples:**
- Fraud pattern detected
- Security breach attempt
- State synchronization failure
- Critical system error

### DAO-Specific Alerts (Admins)
**Trigger:** DAO-scoped events

**Delivery:**
1. In-app notifications
2. Email (configurable)
3. MORIO chat message

**Examples:**
- Suspicious proposal activity
- Large treasury withdrawal
- Governance anomaly
- Low vault balance

### User Alerts (Members)
**Trigger:** Personal or DAO events

**Delivery:**
1. MORIO chat notification
2. In-app notification bell
3. Email (opt-in)

**Examples:**
- Proposal requires your vote
- Transaction completed
- You've been mentioned
- Achievement unlocked

---

## Agent-to-Agent Communication

Agents communicate via **Message Bus** (event-driven architecture):

```typescript
// ANALYZER detects fraud
await analyzerComm.reportThreat({
  type: 'fraud',
  severity: 0.9,
  userId: 'user-123'
});

// DEFENDER receives and acts
// (automatic via message subscription)

// MORIO notified to alert user
// (automatic via message subscription)
```

**Message Types:**
- `FRAUD_ALERT`
- `ANOMALY_DETECTED`
- `THREAT_DETECTED`
- `STATE_SYNC`
- `DRIFT_DETECTED`
- `QUARANTINE_USER`
- `ANALYSIS_REQUEST`
- `NOTIFICATION`

---

## Decision Logging

All agent decisions are logged and accessible:

### Super User Access
**View all decisions:** `/admin/ai-layer-monitoring`

**Includes:**
- Timestamp
- Agent ID
- Decision type
- Confidence score
- Affected entities
- Action taken
- Reasoning

### Contextual User Access
Users see decisions affecting them:

**Via MORIO chat:** "Show me recent security alerts"

**Via notifications:** Real-time alerts for relevant events

**Via audit logs:** Personal activity history

---

## Implementation Example

### Super User Checking ANALYZER

```typescript
// /admin/analyzer-dashboard
const { data } = useQuery({
  queryKey: ['analyzer-comprehensive', daoId],
  queryFn: () => 
    fetch(`/api/analyzer/dao/${daoId}/comprehensive`)
      .then(r => r.json())
});

// Shows:
// - Treasury health: MEDIUM threat
// - Governance: LOW threat  
// - Fraud detection: 2 suspicious users
// - Recommendations: [...]
```

### Regular User Interacting with MORIO

```typescript
// Chat widget anywhere on platform
User: "Is my DAO treasury safe?"

// MORIO → NURU → ANALYZER → Response
MORIO: "I've analyzed your DAO's treasury. 
Everything looks good! Balance is healthy at 
15,000 cUSD with normal transaction patterns 
over the last 30 days. No suspicious activity 
detected. 🎉"
```

---

## Security & Privacy

### Data Access Rules
1. **Agents see everything** (system-level access)
2. **AI Layer filters by context** (user permissions)
3. **Super User sees all agent data** (admin privilege)
4. **Regular users see only their context** (DAO membership, personal data)

### Sensitive Information Handling
- PII is encrypted in agent analysis
- Financial data is aggregated for analytics
- User queries are not logged verbatim
- Agent decisions are anonymized in public views

---

## Future Enhancements

### Planned Features
1. **Elder Integration** - 7 specialized elders for advanced tasks
2. **Agent Marketplace** - Custom agent plugins
3. **Predictive Analytics** - ML-based forecasting
4. **Cross-DAO Intelligence** - Network effect analysis
5. **Voice Interface** - MORIO voice chat

### Upcoming Access Levels
- **DAO Moderator:** Limited agent monitoring for their DAO
- **Community Leader:** Analytics dashboard access
- **Developer:** Agent API access for integrations

---

## Summary

**Who sees agent pages?**
- Only Super Users

**How do regular users benefit?**
- Via AI Layer (MORIO, NURU, KWETU)

**How is information filtered?**
- Context-based permissions
- DAO membership
- Role-based access control

**How are decisions communicated?**
- Super User: Admin dashboard + all notifications
- Admins: DAO-scoped notifications
- Users: Personal notifications via MORIO

**How do agents coordinate?**
- Message Bus (pub/sub pattern)
- Request/Response (synchronous)
- Broadcast (system-wide alerts)
