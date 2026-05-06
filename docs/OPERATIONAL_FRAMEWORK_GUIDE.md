# Operational Framework - Implementation Complete

**Status:** ✅ PRODUCTION READY  
**Date:** February 17, 2026  
**Version:** 1.0.0

---

## Overview

The Operational Framework is a comprehensive real-time system mapping, auditing, and remediation system designed for the MTAA DAO. It provides:

- **Real-time Service Discovery** - Continuously discovers and monitors all system services
- **Immutable Audit Trail** - Cryptographically verified operational change log
- **Secure Vault Management** - No hardcoded secrets; runtime credential injection with rotation
- **Architecture Validation** - Detects gaps, inconsistencies, circular dependencies, privilege violations
- **Automated Remediation** - Non-destructive remediation actions with approval workflows
- **Service Dependency Mapping** - Full topology visualization and privilege matrix

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Express Application                         │
├─────────────────────────────────────────────────────────────────┤
│              Operational Framework Orchestrator                │
├──────────────────────┬────────────────┬──────────────────────────┤
│  Discovery Module    │ Audit Logger   │ Secure Vault Manager    │
│ (port monitoring)    │ (hash chain)   │ (credential injection)  │
├──────────────────────┼────────────────┼──────────────────────────┤
│ Metadata Model       │ Architecture   │ Remediation Executor    │
│ (topology snapshot)  │ Validator      │ (gap remediation)       │
│                      │ (gap detection)│                         │
└──────────────────────┴────────────────┴──────────────────────────┘
         │                    │                    │
         ↓                    ↓                    ↓
    ┌─────────────────────────────────────────────────┐
    │         PostgreSQL Persistent Store             │
    │  - audit_events  - architecture_gaps           │
    │  - system_topology  - remediation_actions      │
    │  - drift_detections - validation_reports       │
    └─────────────────────────────────────────────────┘
```

---

## Components

### 1. SystemDiscovery (`discovery/discovery.ts`)

**Purpose:** Real-time service discovery and health monitoring

**Key Features:**
- Discovers services from configuration
- Performs periodic health checks (default: 30s)
- Tracks response times and status changes
- Emits events on service changes
- Returns service registry snapshot

**Usage:**
```typescript
import { initializeDiscovery, getDiscovery } from './discovery/discovery';

const config = { /* OperationalFrameworkConfig */ };
const discovery = initializeDiscovery(config);
await discovery.start();

const services = discovery.getServices();
const healthyServices = discovery.getServicesByHealth('healthy');
```

### 2. OperationalAuditLogger (`audit/logger.ts`)

**Purpose:** Immutable, cryptographically verified audit trail

**Key Features:**
- Hash chain verification prevents tampering
- All state transitions hashed and chained
- Approval workflow for sensitive operations
- Query by action, actor, time range, resource
- Export to JSON or CSV for compliance

**Usage:**
```typescript
const auditLogger = getAuditLogger();

// Log an event
await auditLogger.logEvent(
  'service_discovered',
  'system',
  'service_id',
  'service_xyz',
  undefined,
  { name: 'API Server' },
  'API Server discovered on localhost:5000'
);

// Query audit trail
const events = auditLogger.queryEvents({
  actor: 'admin_user',
  timeRange: { startTime: yesterday, endTime: now }
});

// Verify integrity
const isValid = auditLogger.verifyChainIntegrity();
```

### 3. SecureVaultManager (`vault/manager.ts`)

**Purpose:** Runtime secret management with no hardcoded values

**Key Features:**
- Credentials stored in-memory only (never persisted)
- Automatic rotation scheduling
- Drift detection for hardcoded secrets
- Access tracking (not secret logging)
- Credential compromise handling

**Usage:**
```typescript
const vault = getVault();

// Register credential
const credential = await vault.registerCredential(
  'postgres_db',
  process.env.DB_PASSWORD,
  'database_password',
  'weekly'
);

// Retrieve secret
const secret = await vault.getSecret(credential.id, 'api_server');

// Detect hardcoded secrets
const drifts = await vault.detectDrift([
  { location: 'env_file', content: fs.readFileSync('.env', 'utf-8') }
]);
```

### 4. SystemMetadataModel (`validation/metadata.ts`)

**Purpose:** Build and maintain system topology metadata

**Key Features:**
- Generates complete topology snapshots
- Builds dependency graph with circular detection
- Computes privilege matrix
- Detects topology changes via hash comparison
- Identifies risk zones

**Usage:**
```typescript
const model = new SystemMetadataModel(config);
const metadata = await model.generateMetadata();

// Get dependency graph
const graph = model.getDependencyGraph();
const cycles = graph.cycles; // Circular dependencies
const riskZones = graph.riskZones; // High-risk service clusters
```

### 5. ArchitectureValidator (`validation/metadata.ts`)

**Purpose:** Detect gaps, inconsistencies, and architectural issues

**Key Features:**
- Validates service health
- Checks dependency resolution
- Verifies privilege assignments
- Detects circular dependencies
- Validates critical services are healthy
- Generates recommendations

**Usage:**
```typescript
const validator = new ArchitectureValidator(config, model);
const report = await validator.validate();

console.log(`Health Status: ${report.healthStatus}`);
console.log(`Critical Gaps: ${report.gaps.filter(g => g.severity === 'critical').length}`);
console.log(`Recommendations: ${report.recommendations}`);
```

### 6. RemediationExecutor (`remediation/executor.ts`)

**Purpose:** Execute remediation actions for detected gaps

**Key Features:**
- Non-destructive by default
- Approval workflow for destructive operations
- Rate limiting (prevent remediation loops)
- Tracks action history
- Supports rollback

**Usage:**
```typescript
const remediation = getRemediation();

// Create action
const action = await remediation.createRemediationAction(
  gap,
  'restart_service',
  true /* requires approval */
);

// Approve
await remediation.approveAction(action.id, 'admin_user');

// Execute
const result = await remediation.executeAction(action.id, 'system');
```

### 7. OperationalFramework (`index.ts`)

**Purpose:** Main orchestrator coordinating all components

**Usage:**
```typescript
import { initializeOperationalFramework, getOperationalFramework } from './services/operational';

// Initialize once on app startup
const config: OperationalFrameworkConfig = { /* ... */ };
const framework = await initializeOperationalFramework(config);

// Get current state
const state = await framework.getOperationalState();

// Run validation
const report = await framework.validate();

// Shutdown on app close
await framework.shutdown();
```

---

## Integration with Express

### 1. Add Middleware

```typescript
import { setupOperationalAuditLogging } from './server/middleware/operational-audit';
import operationalRoutes from './server/routes/admin/operational-framework';

// Add early in middleware stack
setupOperationalAuditLogging(app);

// Add routes
app.use('/api/admin/operational', operationalRoutes);
```

### 2. Initialize on Startup

```typescript
// In your main.ts or app.ts startup
import { initializeOperationalFramework } from './server/services/operational';

const config: OperationalFrameworkConfig = {
  discovery: {
    enabled: true,
    intervalMs: 30000,
    healthCheckTimeout: 5000,
    retryAttempts: 2,
    expectedServices: [
      { name: 'API Server', type: 'api_server', host: 'localhost', port: 5000, protocol: 'http' },
      { name: 'PostgreSQL', type: 'database', host: 'localhost', port: 5432, protocol: 'tcp' },
      { name: 'Redis', type: 'cache', host: 'localhost', port: 6379, protocol: 'tcp' },
    ],
  },
  audit: {
    enabled: true,
    storageBackend: 'postgresql',
    immutabilityEnabled: true,
    hashChainVerification: true,
  },
  vault: {
    enabled: true,
    rotationEnabled: true,
    rotationIntervalDays: 7,
    driftDetectionEnabled: true,
  },
  validation: {
    enabled: true,
    intervalMs: 300000, // Every 5 minutes
    criticalityThreshold: 'high',
  },
  remediation: {
    enabled: true,
    requiresApprovalForDestructive: true,
    maxAttemptsPerService24h: 3,
    autoRemediateNonDestructive: false,
  },
};

const framework = await initializeOperationalFramework(config);

// On shutdown
process.on('SIGTERM', async () => {
  await framework.shutdown();
});
```

### 3. Extend Database Schema

Add the schema extensions from `server/services/operational/schema.ts` to your main `shared/schema.ts`:

```typescript
import {
  auditEvents,
  systemTopology,
  architectureGaps,
  remediationActions,
  driftDetections,
  operationalStateSnapshots,
  validationReports,
} from './server/services/operational/schema';

// Include in your drizzle schema export
export const allTables = {
  // ... existing tables ...
  auditEvents,
  systemTopology,
  architectureGaps,
  remediationActions,
  driftDetections,
  operationalStateSnapshots,
  validationReports,
};
```

Run migrations:
```bash
npm run db:push
```

---

## API Endpoints

### Discovery & Registry

- `GET /api/admin/operational/registry` - List all discovered services
- `GET /api/admin/operational/services/:id` - Get service details
- `GET /api/admin/operational/services?type=api_server&health=healthy` - Filter services
- `GET /api/admin/operational/health` - Overall system health

### Audit Trail

- `GET /api/admin/operational/audit?hours=24&action=service_discovered` - Query audit logs
- `GET /api/admin/operational/audit/verify` - Verify audit chain integrity
- `GET /api/admin/operational/audit/export?format=json` - Export audit trail

### Vault & Secrets

- `GET /api/admin/operational/vault/status` - Vault statistics
- `GET /api/admin/operational/vault/drift` - Detect hardcoded secrets
- `POST /api/admin/operational/vault/drift/:id/resolve` - Mark drift resolved

### Validation

- `GET /api/admin/operational/validate` - Run architecture validation
- `GET /api/admin/operational/state` - Get current operational state
- `GET /api/admin/operational/state/export` - Export full state

### Remediation

- `GET /api/admin/operational/remediation` - List remediation actions
- `POST /api/admin/operational/remediation/:id/approve` - Approve action
- `POST /api/admin/operational/remediation/:id/execute` - Execute action

### Admin

- `POST /api/admin/operational/initialize` - Initialize framework (idempotent)

---

## CLI Tools

### Inspect Services

```bash
npx ts-node cli/inspect-services.ts --format table
```

Output:
```
Service Name              Type               Host:Port            Status       Last Check
API Server              api_server         localhost:5000       HEALTHY      14:32:10
PostgreSQL              database           localhost:5432       HEALTHY      14:32:08
Redis                   cache              localhost:6379       HEALTHY      14:32:09

✓ Total services: 3
  Healthy: 3 | Degraded: 0 | Offline: 0
```

### Audit Trail

```bash
npx ts-node cli/audit-trail.ts --action service_discovered --hours 24 --format json
```

Output:
```json
[
  {
    "timestamp": "2026-02-17T14:32:10.000Z",
    "action": "service_discovered",
    "actor": "system",
    "targetResource": "api_server",
    "eventHash": "a1b2c3d4...",
    "approvedBy": null
  }
]
```

---

## Security Considerations

### No Hardcoded Secrets

**Rule:** All secrets must be registered with `SecureVaultManager`

**Enforcement:**
- `vault.detectDrift()` scans for hardcoded patterns
- Audit trail logs all secret access (not the values)
- Credentials are in-memory only, never serialized

**Example:**
```typescript
// ❌ WRONG
const dbPassword = process.env.DB_PASSWORD;

// ✅ CORRECT
const vault = getVault();
const credential = await vault.registerCredential(
  'postgres',
  process.env.DB_PASSWORD,
  'database_password',
  'weekly'
);
const password = await vault.getSecret(credential.id, 'api_server');
```

### Privilege Boundaries

**Enforced:**
- `ROOT` privilege only for database services
- Services cannot access higher privilege services
- Admin operations require approval
- Privilege escalation paths detected and flagged

### Audit Trail Integrity

**Guarantees:**
- Hash chain prevents retroactive modification
- Each event includes previousEventHash linking to prior event
- Verification API detects tampering
- Export-ready for forensic analysis

### Secure Configuration

**All configuration is declarative:**
- No implicit assumptions about service locations
- All dependencies are explicit
- Trust levels are explicit (TRUSTED vs UNTRUSTED vs CONDITIONAL)
- Privilege assignments are auditable

---

## Deployment Checklist

- [ ] Add schema tables to database via `npm run db:push`
- [ ] Import middleware in Express app
- [ ] Mount operational routes at `/api/admin/operational`
- [ ] Call `initializeOperationalFramework()` on app startup
- [ ] Set expected services in configuration
- [ ] Verify initial service discovery in logs
- [ ] Test `/api/admin/operational/health` endpoint
- [ ] Review audit trail at `/api/admin/operational/audit`
- [ ] Run validation: `/api/admin/operational/validate`
- [ ] Monitor for gaps and remediation opportunities

---

## Monitoring & Alerts

### Key Metrics

- **Service Health Status** - Real-time health per service
- **Audit Trail Integrity** - Hash chain validation
- **Credential Rotation Due** - Countdown to rotation
- **Architecture Gaps** - Critical issues detected
- **Remediation Success Rate** - Action execution success

### Alert Conditions

- 🔴 **CRITICAL**
  - Any critical service offline
  - Compromised credentials detected
  - Audit chain integrity violation
  - Privilege escalation path detected

- 🟡 **WARNING**
  - Service degraded (non-critical)
  - Credentials due for rotation soon
  - Broken dependencies
  - Circular dependencies

- 🔵 **INFO**
  - Service discovered
  - Configuration changed
  - Remediation executed
  - Drift resolved

---

## Troubleshooting

### Discovery not finding services

**Check:**
1. Services are actually running on configured ports
2. Health check URLs are correct
3. Network connectivity (firewall, DNS)
4. Health check timeout not too aggressive

**Debug:**
```bash
curl http://localhost:5000/health
curl http://localhost:9090/-/healthy
```

### Audit chain integrity failure

**This indicates tampering. Immediate actions:**
1. Alert security team
2. Export audit trail for forensics
3. Review access logs for who modified records
4. Restore from backup if available

```bash
GET /api/admin/operational/audit/verify  # Check integrity
GET /api/admin/operational/audit/export   # Export for analysis
```

### Credentials not rotating

**Check:**
1. Vault is initialized and enabled
2. Rotation policy is not NEVER
3. Check vault statistics: `/api/admin/operational/vault/status`
4. Remediation executor is enabled

### High remediation failure rate

**Check:**
1. Rate limiting not preventing necessary actions
2. Service is actually reachable
3. Remediation type is appropriate for service
4. Approval workflow not blocking execution

---

## Future Enhancements

- [ ] Kubernetes integration (CRD for services)
- [ ] Multi-region support with consistency protocols
- [ ] Machine learning for anomaly detection
- [ ] Automated remediation policies (safe sets)
- [ ] Integration with incident management systems
- [ ] Real-time audit log streaming
- [ ] GraphQL federation discovery
- [ ] OpenTelemetry distributed tracing integration

---

## Support & Questions

For issues or questions:
1. Check this documentation
2. Review CLI tools for system inspection
3. Export operational state: `/api/admin/operational/state/export`
4. Check audit trail: `/api/admin/operational/audit`
5. Run validation: `/api/admin/operational/validate`

---

**Version:** 1.0.0  
**Last Updated:** February 17, 2026  
**Status:** Production Ready ✅
