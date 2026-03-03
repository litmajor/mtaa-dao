# Route Intelligence Implementation - Quick Reference

## TL;DR: 3 Ways to Use Route Intelligence

### 1️⃣ Automatic (Recommended)
Just run the background audit. It automatically uses `IntelligentReportGenerator`:
```bash
npm run audit
```
✅ Generates all intelligence files automatically

### 2️⃣ Standalone Route Analysis
Create your own logic:
```typescript
import { IntelligentReportGenerator } from './generators/route-intelligence-enricher';

const gen = new IntelligentReportGenerator(projectRoot);
await gen.startRun();
const report = await gen.saveRouteIntelligence(rawRoutes);
await gen.finalizeRun();
```

### 3️⃣ Custom Integration
Extend the class and override methods as needed.

---

## Raw Route Format (What You Feed In)

```typescript
[
  {
    path: "/api/admin/users",
    methods: "GET, POST",
    methodCount: 2,
    middlewareCount: 3,
    domain: "admin",
    fullDomain: "infra.admin"
  }
]
```

**Getting this from Express:**
```typescript
const routes = app._router.stack
  .filter(r => r.route)
  .map(r => ({
    path: r.route.path,
    methods: Object.keys(r.route.methods).join(', ').toUpperCase(),
    methodCount: Object.keys(r.route.methods).length,
    middlewareCount: r.route.stack.length,
    domain: extractDomain(r.route.path),
    fullDomain: `${category}.${domain}`,
  }));
```

---

## Output Files (What You Get Back)

| File | Content | Use Case |
|------|---------|----------|
| `route-intelligence.json` | All 974 routes enriched with risk scoring | Full analysis, trending |
| `domain-intelligence.json` | 130 domains clustered by risk | Security hotspots, audit focus |
| `priority-queue.csv` | P0/P1/P2/P3 remediation ops | Actionable task list |
| `mirror-node-graph.json` | Nodes + edges for visualization | Dashboard, MirrorCore-X |

---

## Key Metrics in Summary

```typescript
summary: {
  totalRoutes: 974,
  totalDomains: 130,
  
  // Risk distribution
  criticalCount: 5,
  highCount: 23,
  mediumCount: 67,
  lowCount: 879,
  
  // Gaps
  totalMiddlewareGap: 143,      // Missing 143 middleware layers total
  
  // Red flags
  financialRoutes: 89,
  unauthenticatedFinancialRoutes: 3,  // ⚠️ Critical!
  
  // Entropy (audit input)
  overallEntropyScore: 42,
  overallRiskLevel: 'medium'
}
```

---

## Per-Route Risk Scoring (Example)

```typescript
{
  path: "/api/wallet/withdraw",
  riskScore: 9.2,        // 0-10
  riskLevel: "critical",
  category: "financial.wallet",
  
  // Why critical?
  middlewareGap: 2,      // Expected 3, has 1
  middlewareFlags: ["missing_auth", "missing_rate_limit"],
  deletesData: true,
  financiallyImpactful: true,
  
  auditPriority: "P0",   // Fix first!
  notes: [
    "🔴 Financial route with insufficient middleware",
    "🔴 DELETE detected without ownership check"
  ]
}
```

---

## Category Base Risk (Reference)

```
financial.vault:              8/10 ← Highest
financial.wallet:             7/10
governance.multisig:          7/10
infra.admin:                  7/10
    ⋯
trading.market:               2/10
public:                       1/10 ← Lowest
```

**+ Modifiers:**
- Middleware gap: +0.8 per layer
- DELETE operation: +0.8
- Unverified webhook: +1.0
- Multi-method (3+ verbs): +0.3 per extra

---

## Priority Queue (At a Glance)

| Level | Criteria | SLA |
|-------|----------|-----|
| **P0** | score >= 9 AND gap > 0 | Immediate |
| **P1** | score >= 7 AND (gap OR mutates) | This sprint |
| **P2** | score >= 5 | Next sprint |
| **P3** | score < 5 | Backlog |

---

## Integration Points (Updated Files)

### `ReportGenerator.ts`
- ✅ Header updated to document new intelligence files

### `BackgroundRefactorAgent.ts`
```typescript
// OLD
private reportGenerator: ReportGenerator;

// NEW
private reportGenerator: IntelligentReportGenerator;

// In runFullAudit():
const routeReport = await this.reportGenerator.saveRouteIntelligence(routes);
await this.reportGenerator.saveAuditResultsWithIntelligence(result, routeReport);
```

### `route-intelligence-enricher.ts`
- ✅ No changes needed (already complete)

---

## Entropy Score (New Calculation)

Instead of abstract heuristics, entropy is now:

```
entropy = min(100, round(
  avgRiskScore * 5 +              // 0-50
  (gapDensity) * 20 +             // 0-20
  criticalCount * 2 +             // 0-100+
  highCount * 0.5                 // 0-50+
))
```

**Grounded in:** Actual middleware gaps + real risk data

---

## Usage in BackgroundRefactorAgent

Current implementation in `runFullAudit()`:

```typescript
// 1. Format routes from audit violations
const rawRoutes = routeViolations.map(v => ({
  path: v.path,
  methods: v.method || 'UNKNOWN',
  methodCount: 1,
  middlewareCount: v.middlewareCount || 0,
  domain: v.domain || 'unknown',
  fullDomain: v.fullDomain || 'unknown.unknown',
}));

// 2. Generate intelligence report
const routeIntelligenceReport = await this.reportGenerator.saveRouteIntelligence(rawRoutes);

// 3. Merge with audit results
await this.reportGenerator.saveAuditResultsWithIntelligence(result, routeIntelligenceReport);

// 4. Finalize with metrics
await this.reportGenerator.finalizeRun({
  discoveryTimeMs: elapsedMs,
  routeMetrics: {
    totalRoutes: routeIntelligenceReport.summary.totalRoutes,
    criticalRoutes: routeIntelligenceReport.summary.criticalCount,
  },
});
```

---

## Dashboard Integration Example

```typescript
// Get latest intelligence
const latest = fs.readJsonSync('visibility/latest.json');
const intel = fs.readJsonSync(`visibility/runs/${latest.runId}/route-intelligence.json`);

// Display dashboard
{
  criticalRoutes: intel.summary.criticalCount,
  highRiskDomains: intel.domains.slice(0, 5),
  priorityOps: {
    P0: intel.priorityQueue.P0.length,
    P1: intel.priorityQueue.P1.length,
  },
  middlewareGaps: intel.summary.totalMiddlewareGap,
}
```

---

## Debugging / Inspection

### Check a specific route's intelligence:
```typescript
const intel = JSON.parse(fs.readFileSync('visibility/runs/.../route-intelligence.json', 'utf-8'));
const route = intel.routes.find(r => r.path === '/api/wallet/withdraw');
console.log({
  risk: route.riskScore,
  level: route.riskLevel,
  flags: route.middlewareFlags,
  notes: route.notes,
});
```

### See all P0 routes:
```bash
cat visibility/runs/run-{latest}/priority-queue.csv | grep '^P0'
```

### Compare entropy over time:
```bash
# Get all runs
ls visibility/runs/ | sort | tail -5 | while read run; do
  echo -n "$run: "
  cat visibility/runs/$run/route-intelligence.json | jq '.summary.overallEntropyScore'
done
```

---

## Types Reference

```typescript
// Risk levels
type RiskLevel = 'critical' | 'high' | 'medium' | 'low' | 'info';

// Route categories (examples)
type RouteCategory =
  | 'financial.vault' | 'financial.wallet'
  | 'governance.dao' | 'governance.multisig'
  | 'identity.auth' | 'identity.kyc'
  | 'infra.admin'
  | 'trading.dex'
  | 'public';

// Middleware gaps detected
type MiddlewareGap =
  | 'missing_auth'
  | 'missing_rate_limit'
  | 'missing_ownership_check'
  | 'missing_role_check'
  | 'missing_2fa'
  | 'webhook_unverified'
  | 'none';

// Audit priority
type AuditPriority = 'P0' | 'P1' | 'P2' | 'P3';
```

---

## Common Commands

```bash
# Run full audit with intelligence
npm run audit

# View latest critical routes
cat visibility/latest.json && \
  jq '.priorityQueue.P0 | length' visibility/runs/run-*/route-intelligence.json | tail -1

# Export priority queue for task tracking
cat visibility/runs/run-{latest}/priority-queue.csv | grep '^P0\|^P1' > /tmp/critical-fixes.csv

# Compare domain risk over time
for f in visibility/runs/run-*/domain-intelligence.json; do
  echo "=== $(dirname $f) ==="
  jq '.domains | sort_by(.clusterRiskScore) | .[0:3] | .[] | {domain, risk: .clusterRiskScore}' "$f"
done
```

---

## Next Steps

1. ✅ Run `npm run audit` to generate first intelligence report
2. ✅ Check `visibility/runs/latest/priority-queue.csv` for P0 routes
3. ✅ Investigate `unauthenticatedFinancialRoutes` in summary
4. ✅ Review middleware gaps in `domain-intelligence.json`
5. ✅ Set up CI/CD: Fail if `criticalCount > 0`

---

## Full Documentation

See [ROUTE_INTELLIGENCE_INTEGRATION_GUIDE.md](./ROUTE_INTELLIGENCE_INTEGRATION_GUIDE.md) for:
- Complete API reference
- Algorithm details
- Custom integration patterns
- Troubleshooting
