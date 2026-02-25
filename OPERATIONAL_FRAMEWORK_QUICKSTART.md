# Operational Framework - Quick Start

**Get up and running in 5 minutes**

---

## 1️⃣ Database Setup

```bash
cd /path/to/project

# Add schema extensions to drizzle
npm run db:push
```

Verify tables created:
```bash
psql $DATABASE_URL -c "\dt audit_events system_topology architecture_gaps remediation_actions drift_detections operational_state_snapshots validation_reports"
```

---

## 2️⃣ Express Integration

**File:** `src/main.ts` or your app entry point

```typescript
import setupOperationalAuditLogging from './server/middleware/operational-audit';
import operationalRoutes from './server/routes/admin/operational-framework';
import { initializeOperationalFramework } from './server/services/operational';

// ... your existing setup ...

// 1. Add middleware EARLY in stack
setupOperationalAuditLogging(app);

// 2. Add routes
app.use('/api/admin/operational', operationalRoutes);

// 3. Initialize framework on startup
const operationalConfig = {
  discovery: {
    enabled: true,
    intervalMs: 30000,
    healthCheckTimeout: 5000,
    retryAttempts: 2,
    expectedServices: [
      { name: 'API Server', type: 'api_server', host: 'localhost', port: process.env.PORT || 5000, protocol: 'http' },
      { name: 'PostgreSQL', type: 'database', host: process.env.DB_HOST || 'localhost', port: 5432, protocol: 'tcp' },
      { name: 'Redis', type: 'cache', host: process.env.REDIS_HOST || 'localhost', port: 6379, protocol: 'tcp' },
    ],
  },
  audit: { enabled: true, storageBackend: 'postgresql', immutabilityEnabled: true, hashChainVerification: true },
  vault: { enabled: true, rotationEnabled: true, rotationIntervalDays: 7, driftDetectionEnabled: true },
  validation: { enabled: true, intervalMs: 300000, criticalityThreshold: 'high' },
  remediation: { enabled: true, requiresApprovalForDestructive: true, maxAttemptsPerService24h: 3, autoRemediateNonDestructive: false },
};

const framework = await initializeOperationalFramework(operationalConfig);

// 4. Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('Shutting down...');
  await framework.shutdown();
  process.exit(0);
});
```

---

## 3️⃣ Test Discovery

```bash
curl http://localhost:5000/api/admin/operational/health
```

Expected response:
```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "timestamp": "2026-02-17T...",
    "services": {
      "total": 3,
      "healthy": 3,
      "degraded": 0,
      "offline": 0
    }
  }
}
```

---

## 4️⃣ Use CLI Tools

### List Services
```bash
npx ts-node cli/inspect-services.ts
```

### View Audit Trail
```bash
npx ts-node cli/audit-trail.ts --hours 24 --format table
```

---

## 5️⃣ Key Endpoints (Bookmark These)

| Purpose | Endpoint |
|---------|----------|
| System Status | `GET /api/admin/operational/health` |
| Service Registry | `GET /api/admin/operational/registry` |
| Audit Events | `GET /api/admin/operational/audit` |
| Run Validation | `GET /api/admin/operational/validate` |
| Export State | `GET /api/admin/operational/state/export` |
| Vault Status | `GET /api/admin/operational/vault/status` |

---

## 🎯 Common Tasks

### Monitor System Health

```typescript
// In your monitoring code
const response = await fetch('http://localhost:5000/api/admin/operational/health');
const health = await response.json();

if (health.data.status === 'critical') {
  // Alert
}
```

### Register a Credential

```typescript
import { getVault } from './server/services/operational/vault/manager';

const vault = getVault();
const credential = await vault.registerCredential(
  'my_service',
  process.env.MY_SECRET,
  'api_key',
  'weekly' // rotation policy
);
```

### Use Registered Credential

```typescript
const secret = await vault.getSecret(credential.id, 'consumer_service');
// Use secret safely - never logged
```

### Query Audit Trail

```typescript
import { getAuditLogger } from './server/services/operational/audit/logger';

const logger = getAuditLogger();
const events = logger.queryEvents({
  actor: 'admin_user',
  timeRange: {
    startTime: new Date(Date.now() - 24 * 60 * 60 * 1000),
    endTime: new Date(),
  },
});
```

### Run Validation

```typescript
import { getOperationalFramework } from './server/services/operational';

const framework = getOperationalFramework();
const report = await framework.validate();

console.log(`Health: ${report.healthStatus}`);
console.log(`Gaps: ${report.gaps.length}`);
```

---

## 🐛 Troubleshooting

### Services Not Discovered

**Check:**
1. Are services actually running?
2. Are ports correct?
3. Is network connectivity OK?

**Debug:**
```bash
# Test manually
curl http://localhost:5000/health
curl http://localhost:6379 # Will fail but shows connectivity
```

### Permission Denied on Database

**Fix:**
```bash
# Verify DB user has CREATE TABLE permission
psql $DATABASE_URL -c "GRANT CREATE ON SCHEMA public TO $DB_USER;"
npm run db:push
```

### Framework Not Initialized

**Fix:**
Ensure `initializeOperationalFramework()` is called BEFORE app.listen()

```typescript
// ❌ WRONG
app.listen(5000);
await initializeOperationalFramework(config);

// ✅ CORRECT
await initializeOperationalFramework(config);
app.listen(5000);
```

---

## 📋 Deployment Checklist

- [ ] Database tables created: `npm run db:push`
- [ ] Middleware added to Express
- [ ] Routes mounted at `/api/admin/operational`
- [ ] Framework initialized on startup
- [ ] Expected services configured
- [ ] `/api/admin/operational/health` returns 200
- [ ] Audit trail visible at `/api/admin/operational/audit`
- [ ] Vault enabled for sensitive services
- [ ] Test with CLI tools

---

## 📖 Learn More

- **Full Guide:** `OPERATIONAL_FRAMEWORK_GUIDE.md`
- **Technical Details:** `OPERATIONAL_FRAMEWORK_IMPLEMENTATION.md`
- **Code:** `server/services/operational/`
- **Routes:** `server/routes/admin/operational-framework.ts`

---

## 🆘 Need Help?

1. Check logs for errors
2. Run `/api/admin/operational/state` to see current state
3. Export diagnostics: `/api/admin/operational/state/export`
4. Verify audit chain: `/api/admin/operational/audit/verify`

---

**Ready to go!** 🚀

Your system monitoring is now operational with:
- ✅ Real-time service discovery
- ✅ Immutable audit trail
- ✅ Secure secrets management
- ✅ Architecture validation
- ✅ Automated remediation

Next: Add monitoring alerts and configure your dashboard.
