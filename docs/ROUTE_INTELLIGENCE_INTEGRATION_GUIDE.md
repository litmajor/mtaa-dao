# Route Intelligence Integration Guide

## Overview

The `IntelligentReportGenerator` extends the base `ReportGenerator` with advanced route analysis capabilities, providing:

- **Per-route risk scoring** (0-10 scale)
- **Middleware gap analysis** (expected vs actual)
- **Domain clustering** with aggregate risk metrics
- **Priority queue** for remediation (P0 → P3)
- **Mirror node graph** for visualization systems
- **Entropy-driven audit entropy** grounded in actual middleware data

## Architecture

### Class Hierarchy

```
ReportGenerator (base)
    ↓
IntelligentReportGenerator (extends)
    ├── saveRouteIntelligence(rawRoutes)
    └── saveAuditResultsWithIntelligence(auditResult, routeReport)
```

### Output Files Per Run

When using `IntelligentReportGenerator`, each audit run generates:

```
visibility/runs/run-{ISO-timestamp}/
├── [Base ReportGenerator outputs]
│   ├── audit.json
│   ├── audit.md
│   ├── audit.html
│   ├── audit.csv
│   ├── routes.json
│   ├── metadata.json
│   ├── timeline.json
│   └── metrics.json
│
├── [NEW: IntelligentReportGenerator outputs]
│   ├── route-intelligence.json      ← Full enriched schema (all routes)
│   ├── domain-intelligence.json     ← Domain clusters sorted by risk
│   ├── priority-queue.csv          ← P0/P1/P2/P3 remediation ops queue
│   └── mirror-node-graph.json      ← Node+edge graph for MirrorCore-X
│
└── external-api-calls.json
```

## Usage Patterns

### Pattern 1: Direct Usage (Recommended)

**Best for:** Standalone route analysis, scheduled audits

```typescript
import { IntelligentReportGenerator } from './generators/route-intelligence-enricher';

// Initialize
const generator = new IntelligentReportGenerator(projectRoot);

// Start a timestamped run
const runId = await generator.startRun();

// Get your raw routes (format below)
const rawRoutes = [
  { path: '/api/admin/users', methods: 'GET, POST', methodCount: 2, middlewareCount: 3, domain: 'admin', fullDomain: 'infra.admin' },
  // ...more routes
];

// Enrich and analyze routes
const intelligenceReport = await generator.saveRouteIntelligence(rawRoutes);

// Log key findings
console.log(`Critical routes: ${intelligenceReport.summary.criticalCount}`);
console.log(`Middleware gaps: ${intelligenceReport.summary.totalMiddlewareGap}`);
console.log(`Top risk domains: ${intelligenceReport.summary.topRiskDomains.join(', ')}`);

// Finalize
await generator.finalizeRun({ discoveryTimeMs: 1200 });
```

### Pattern 2: Audit Integration (Current Implementation)

**Best for:** Full audit cycles with audit results enrichment

```typescript
import { IntelligentReportGenerator } from './generators/route-intelligence-enricher';

const generator = new IntelligentReportGenerator(projectRoot);
const runId = await generator.startRun();

// Run your audit phases...
const result: AuditResult = { /* ...audit results... */ };

// Extract raw routes from audit phase
const rawRoutes = auditResult.routeViolations.map(v => ({
  path: v.path,
  methods: v.method || 'UNKNOWN',
  methodCount: 1,
  middlewareCount: v.middlewareCount || 0,
  domain: v.domain || 'unknown',
  fullDomain: v.fullDomain || 'unknown.unknown',
}));

// Generate enriched intelligence
const routeReport = await generator.saveRouteIntelligence(rawRoutes);

// Combine audit results with route intelligence
// (entropy score and recommendations merged)
await generator.saveAuditResultsWithIntelligence(result, routeReport);

// Finalize with metrics
await generator.finalizeRun({
  discoveryTimeMs: elapsedMs,
  modulesScanned: count,
  routeMetrics: {
    totalRoutes: routeReport.summary.totalRoutes,
    criticalRoutes: routeReport.summary.criticalCount,
    middlewareGapTotal: routeReport.summary.totalMiddlewareGap,
  },
});
```

### Pattern 3: BackgroundRefactorAgent (Automatic)

**Status:** ✅ Already integrated

The `BackgroundRefactorAgent` automatically uses `IntelligentReportGenerator`:

```typescript
// BackgroundRefactorAgent.ts now:
// - Imports IntelligentReportGenerator instead of ReportGenerator
// - Calls saveRouteIntelligence() during audit
// - Uses saveAuditResultsWithIntelligence() for merged reports
// - Includes route metrics in finalizeRun()
```

**Trigger the automatic integration:**
```typescript
import { runBackgroundRefactorAgent } from './agents/BackgroundRefactorAgent';

const result = await runBackgroundRefactorAgent(projectRoot);
// Automatically generates all intelligence files + audit reports
```

## Data Structures

### Raw Route Format (Input)

```typescript
interface RawRoute {
  path: string;              // "/api/admin/users/:id"
  methods: string;           // "GET, POST, DELETE"
  methodCount: number;       // 3
  middlewareCount: number;   // 2 (from middleware array length)
  domain: string;            // "admin" (extracted from first path segment)
  fullDomain: string;        // "infra.admin" (category.domain)
}
```

### EnrichedRoute Output

```typescript
interface EnrichedRoute {
  // Original fields
  path: string;
  methods: string;
  methodCount: number;
  middlewareCount: number;
  domain: string;
  fullDomain: string;

  // Computed intelligence
  riskScore: number;                // 0–10 (higher = riskier)
  riskLevel: RiskLevel;            // 'critical' | 'high' | 'medium' | 'low' | 'info'
  category: RouteCategory;         // 'financial.vault' | 'governance.dao' | etc.
  mutates: boolean;                // POST/PUT/PATCH/DELETE present
  deletesData: boolean;            // DELETE present
  financiallyImpactful: boolean;   // financial.* or governance.* category
  requiresOwnership: boolean;      // Path param + financial/governance
  expectedMinMiddleware: number;   // Tier-based expectation (1-3)
  middlewareGap: number;           // Max(0, expectedMin - actual)
  middlewareFlags: MiddlewareGap[]; // Specific missing layers
  isWebhook: boolean;              // Path contains 'webhook' or 'callback'
  isPublic: boolean;               // Public route (no auth required)
  hasPathParam: boolean;           // Path contains /:id patterns
  mirrorNodeTag: string;           // "category/slug.path.severity"
  auditPriority: 'P0'|'P1'|'P2'|'P3'; // Remediation priority
  notes: string[];                 // Human-readable analysis notes
}
```

### RouteIntelligenceReport Summary

```typescript
interface RouteIntelligenceReport {
  generatedAt: string;
  runId: string;
  
  summary: {
    totalRoutes: number;
    totalDomains: number;
    criticalCount: number;          // Risk >= 9
    highCount: number;              // Risk 7-8.9
    mediumCount: number;            // Risk 5-6.9
    lowCount: number;               // Risk < 5
    avgRiskScore: number;           // Mean risk (0-10)
    totalMiddlewareGap: number;     // Sum of all gaps
    topRiskDomains: string[];       // Top 10 by cluster risk
    financialRoutes: number;        // financially.* category count
    unauthenticatedFinancialRoutes: number; // Auth <= 1
    overallEntropyScore: number;    // 0-100 (audit entropy input)
    overallRiskLevel: RiskLevel;    // Aggregate classification
  };
  
  domains: DomainIntelligence[];    // Per-domain analysis
  routes: EnrichedRoute[];           // All 974+ enriched routes
  priorityQueue: {
    P0: EnrichedRoute[];            // Immediate (> critical)
    P1: EnrichedRoute[];            // Sprint (high + gaps)
    P2: EnrichedRoute[];            // Soon (medium + gaps)
    P3: EnrichedRoute[];            // Backlog (low + gaps)
  };
}
```

## Integration Points

### 1. ReportGenerator (Updated Header)

**File:** `server/agents/generators/ReportGenerator.ts`

- Updated JSDoc to reference `IntelligentReportGenerator` as preferred
- Documents the extension files added to output directory structure
- Base class remains unchanged, no breaking changes

### 2. BackgroundRefactorAgent (Fully Integrated)

**File:** `server/agents/BackgroundRefactorAgent.ts`

**Changes:**
- Import: Uses `IntelligentReportGenerator` instead of `ReportGenerator`
- Constructor: Instantiates `IntelligentReportGenerator`
- `runFullAudit()`: 
  - Extracts routes from audit violations
  - Calls `saveRouteIntelligence()` with formatted route data
  - Uses `saveAuditResultsWithIntelligence()` to merge reports
  - Includes `routeMetrics` in finalizeRun() call

**Output Advantage:** All background audits now include intelligence files

### 3. Route Intelligence Enricher (Extension)

**File:** `server/agents/generators/route-intelligence-enricher.ts`

**Key Classes:**
- `RouteIntelligenceEnricher`: Static methods for per-route analysis
- `DomainAggregator`: Clusters routes by domain, computes aggregate risk
- `IntelligentReportGenerator`: Extends ReportGenerator with two new methods

**Methods on IntelligentReportGenerator:**

```typescript
async saveRouteIntelligence(rawRoutes: any[]): Promise<RouteIntelligenceReport>
// Enriches routes, aggregates domains, writes all 4 intelligence files

async saveAuditResultsWithIntelligence(
  result: AuditResult,
  routeReport: RouteIntelligenceReport
): Promise<void>
// Merges intelligence recommendations into audit result,
// calls saveAuditResults() with enriched entropy
```

## Risk Scoring Algorithm

### Base Risk (per category)
```
financial.vault:               8
financial.wallet:              7
financial.payments:            7
governance.multisig:           7
identity.auth, identity.kyc:   6
infra.admin:                   7
trading.orders:                5
...others 1-5
```

### Modifiers (cumulative)
- Middleware gap: +0.8 per missing layer
- Mutation (POST/PUT/PATCH): +0.5
- Data deletion (DELETE): +0.8
- Financial impact: +0.5
- Multi-method (>1): +0.3 per extra method
- Unverified webhook: +1.0

### Final Score
```
Capped at 0-10: score = min(10, max(0, base + modifiers))
```

### Risk Levels
```
score >= 9:  'critical'
score 7-8:   'high'
score 5-6:   'medium'
score 3-4:   'low'
score < 3:   'info'
```

## Entropy Scoring

The overall entropy score (0-100) is computed as:

```typescript
overallEntropyScore = min(100, round(
  avgRiskScore * 5 +                  // Average route risk weighted
  (totalMiddlewareGap / routes.length) * 20 +  // Middleware coverage gap density
  criticalCount * 2 +                 // Critical routes multiplier
  highCount * 0.5                     // High routes lighter impact
))
```

This replaces the old entropy calculation and is **grounded in actual middleware data** rather than heuristics.

## Priority Queue (P0-P3)

Routes are automatically stratified:

| Priority | Criteria | Target SLA |
|----------|----------|------------|
| **P0** | riskScore >= 9 && middlewareGap > 0 | Immediate |
| **P1** | riskScore >= 7 && (gap > 0 OR mutates) | This sprint |
| **P2** | riskScore >= 5 | Next sprint |
| **P3** | riskScore < 5 or info level | Backlog |

## Mirror Node Graph Format

For integration with visualization systems (e.g., MirrorCore-X):

```json
{
  "nodes": [
    {
      "id": "financial/vault/setup.critical",
      "category": "financial.vault",
      "risk": "critical",
      "path": "/api/vault/setup",
      "metrics": { "gap": 2, "score": 9.2 }
    }
  ],
  "edges": [
    {
      "source": "admin.critical",
      "target": "vault.high",
      "relationship": "depends_on"
    }
  ]
}
```

## CSV Priority Queue Format

File: `priority-queue.csv`

```csv
Priority,Path,Methods,Domain,Category,RiskScore,MiddlewareGap,Flags,Notes
P0,"/api/vault/setup","POST",vault,financial.vault,9.2,2,"missing_auth | missing_rate_limit","🔴 Auth gap + financial impact | DELETE operation"
P1,"/api/admin/users/:id","DELETE",admin,infra.admin,7.8,1,"missing_ownership_check","⚠️ Insufficient ownership verification"
```

## Common Usage Examples

### Example 1: Audit Command in package.json

```json
{
  "scripts": {
    "audit": "ts-node -r tsconfig-paths/register scripts/runAudit.ts",
    "audit:full": "npm run audit -- --full",
    "audit:routes": "npm run audit -- --routes-only"
  }
}
```

**Script content:**
```typescript
import { runBackgroundRefactorAgent } from './server/agents/BackgroundRefactorAgent';

const result = await runBackgroundRefactorAgent(process.cwd());
console.table(result.statistics);
```

### Example 2: Scheduled Audit (Cron)

```typescript
// In your background job scheduler
import { IntelligentReportGenerator } from './generators/route-intelligence-enricher';

async function scheduledAudit() {
  const generator = new IntelligentReportGenerator(projectRoot);
  await generator.startRun();
  
  const routes = await extractRoutesFromApp(expressApp);
  const report = await generator.saveRouteIntelligence(routes);
  
  // Send alerts if critical routes found
  if (report.summary.criticalCount > 0) {
    await sendSlackNotification({
      channel: '#security',
      text: `⚠️ ${report.summary.criticalCount} critical routes detected`,
      blocks: buildRouteReport(report.priorityQueue.P0),
    });
  }
  
  await generator.finalizeRun({ scheduledRun: true });
}
```

### Example 3: Dashboard Integration

```typescript
// API endpoint for dashboard
app.get('/api/visibility/latest-intelligence', (req, res) => {
  const latestRun = readJSON('visibility/latest.json');
  const intelligence = readJSON(`visibility/runs/${latestRun.runId}/route-intelligence.json`);
  
  res.json({
    summary: intelligence.summary,
    priorityQueue: intelligence.priorityQueue,
    topRiskDomains: intelligence.domains.slice(0, 10),
  });
});
```

## Migration Checklist

If you previously used `ReportGenerator` directly:

- [ ] Update imports: `ReportGenerator` → `IntelligentReportGenerator`
- [ ] Ensure raw routes are available (format as shown above)
- [ ] Call `saveRouteIntelligence(routes)` after `startRun()`
- [ ] Replace `saveAuditResults(result)` with `saveAuditResultsWithIntelligence(result, routeReport)`
- [ ] Verify new files in `visibility/runs/{runId}/`
- [ ] Test JSON structure matches expected types
- [ ] Update monitoring/alerting to consume new output files

**Backward Compatibility:** ✅ `IntelligentReportGenerator` extends `ReportGenerator`, so all base methods work identically. The new methods are purely additive.

## Troubleshooting

### Issue: "Missing route data"

**Cause:** Raw routes not properly formatted
**Fix:** Ensure each route has: `path`, `methods`, `methodCount`, `middlewareCount`, `domain`, `fullDomain`

### Issue: "entropy ignored in HTML report"

**Cause:** Using `saveAuditResults()` instead of `saveAuditResultsWithIntelligence()`
**Fix:** Always use `saveAuditResultsWithIntelligence()` if you want entropy from route intelligence

### Issue: "Mirror node graph is empty"

**Cause:** Routes not classified into expected categories
**Fix:** Check `DOMAIN_CATEGORY_MAP` in enricher, ensure domain strings match keys

### Issue: "Very high/low entropy score"

**Cause:** Entropy calculation is now grounded in middleware gaps
**Fix:** This is expected if you had insufficient middleware validation. Review P0/P1 routes.

## Files Modified/Created

| File | Type | Change |
|------|------|--------|
| `ReportGenerator.ts` | Modified | Updated header JSDoc |
| `BackgroundRefactorAgent.ts` | Modified | Import + integrate intelligence |
| `route-intelligence-enricher.ts` | Existing | (Already created, fully functional) |
| (This file) | New | Integration guide |

## Next Steps

1. ✅ Review the priority queue (P0 routes first)
2. ✅ Audit financialRoutes + unauthenticatedFinancialRoutes
3. ✅ Investigate middleware gaps in high-risk domains
4. ✅ Integrate into CI/CD: Fail on P0 count > 0
5. ✅ Dashboard: Display priority queue with trend over time

## Questions?

Refer to `route-intelligence-enricher.ts` for implementation details, or review the generated `route-intelligence.json` and `domain-intelligence.json` files for data structure examples.
