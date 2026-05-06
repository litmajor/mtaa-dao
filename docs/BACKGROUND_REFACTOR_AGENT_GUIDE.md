# 🤖 Background Refactor Agent — Quick Start Guide

## What It Does

The Background Refactor Agent automatically audits your codebase for quality, consistency, and architectural discipline. It:

✅ **Scans TODOs** — Finds all TODO comments and their context  
✅ **Validates Imports** — Detects broken imports, circular dependencies, duplicates  
✅ **Audits Routes** — Finds duplicate endpoints, shadowed routes, orphaned files  
✅ **Enforces Rules** — Checks architectural discipline against `.shogun-rules.js`  
✅ **Generates Patches** — Creates diff files for fixable issues (never auto-commits)  
✅ **Reports Results** — JSON, Markdown, HTML, CSV formats to `/reports/agent-audits/`

## Architecture

```
┌─────────────────────────────────────────────────┐
│      BackgroundRefactorAgent (Orchestrator)     │
└────────────────┬────────────────────────────────┘
                 │
     ┌───────────┼───────────┬───────────┬───────────┐
     │           │           │           │           │
  TodoScanner   ImportValidator  RouteAuditor  RuleEngine
     │           │           │           │
     ├─────────────────────────────────────
     │
ReportGenerator (JSON/MD/HTML/CSV)
DiffProposer (Patch files in /patches/)
```

## Sub-Agents

### 1. **TodoScanner** (`server/agents/scanners/TodoScanner.ts`)
Extracts TODO comments with:
- Priority (critical, high, medium, low)
- Owner assignment (`// TODO @john: ...`)
- Line number & context

**Output:** `todos` array in audit report

### 2. **ImportValidator** (`server/agents/scanners/ImportValidator.ts`)
Checks for:
- Broken imports (file doesn't exist)
- Circular dependencies (A → B → A)
- Duplicate imports (same thing imported twice)
- External package availability

**Output:** `importIssues` array

### 3. **RouteAuditor** (`server/agents/scanners/RouteAuditor.ts`)
Finds:
- Duplicate routes (same method + path deployed twice)
- Shadowed routes (specific path defined after general pattern)
- Inconsistent HTTP methods
- Orphaned route files

**Output:** `routeViolations` array

### 4. **RuleEngine** (`server/agents/engines/RuleEngine.ts`)
Enforces rules from `.shogun-rules.js`:
- API isolation (services can't directly import each other)
- Polling constraints (min 1000ms intervals)
- Naming standards (camelCase functions, UPPER_CASE constants)
- Security patterns (no eval, dynamic require)
- Type safety (discourage `any`)

**Output:** `ruleBreaches` array

### 5. **ReportGenerator** (`server/agents/generators/ReportGenerator.ts`)
Formats results into:
- **JSON** — Machine-readable
- **Markdown** — Human-readable with tables
- **HTML** — Web viewable dashboard
- **CSV** — Spreadsheet import

**Output:** 4 files in `/reports/agent-audits/`

### 6. **DiffProposer** (`server/agents/proposers/DiffProposer.ts`)
Creates patch files for fixable issues:
- Remove unused imports
- Fix naming violations
- Replace `any` types

**Output:** `/patches/fix-*.diff` files (review before applying)

## Usage

### Run Full Audit
```typescript
import BackgroundRefactorAgent from '~/server/agents/BackgroundRefactorAgent';

const agent = new BackgroundRefactorAgent(process.env.PROJECT_ROOT);
const result = await agent.runFullAudit();

console.log(`Entropy Score: ${result.entropy.score}/100`);
console.log(`Recommendations:`, result.recommendations);
```

### Run Quick Scan (Critical Issues Only)
```typescript
const quickResult = await agent.runQuickScan();
console.log(`Critical issues: ${quickResult.routeViolations?.length || 0}`);
```

### Analyze Single File
```typescript
const fileAnalysis = await agent.analyzeFile('server/services/myService.ts');
console.log(`TODOs in file: ${fileAnalysis.todos.length}`);
```

## Entropy Score

Formula: `(todos×5 + importIssues×10 + routeViolations×15 + ruleBreaches×20) / 10`

| Score | Severity | Action |
|-------|----------|--------|
| 0-39 | 🟢 Low | Excellent — maintain |
| 40-59 | 🟡 Medium | Address on next release |
| 60-79 | 🟠 High | Schedule fix sprint |
| 80-100 | 🔴 Critical | Urgent refactoring needed |

## Output Structure

```
project-root/
├── reports/
│   └── agent-audits/
│       ├── audit-scan-1704067200000-a1b2c3d4.json      (full results)
│       ├── audit-scan-1704067200000-a1b2c3d4.md        (human-readable)
│       ├── audit-scan-1704067200000-a1b2c3d4.html      (dashboard)
│       └── audit-scan-1704067200000-a1b2c3d4.csv       (spreadsheet)
└── patches/
    ├── scan-1704067200000-a1b2c3d4-1-remove-import-service.ts-18.diff
    ├── scan-1704067200000-a1b2c3d4-2-rename-function-config.ts-42.diff
    └── ...
```

## Customizing Rules

Edit `.shogun-rules.js` in project root:

```javascript
module.exports = {
  rules: [
    {
      id: 'my-rule-1',
      name: 'My Custom Rule',
      type: 'custom',
      enabled: true,
      match: /your regex pattern/,
      violation: 'Why this is a problem',
      severity: 'error' // or 'warning'
    }
    // Add more...
  ]
};
```

**Built-in Rule IDs:**
- `api-isolation-services` — Services must use facade patterns
- `polling-minimum-interval` — Min 1000ms between external API calls
- `naming-constants-upper` — Config constants in UPPER_CASE
- `security-no-eval` — Forbid eval()
- `type-safety-no-any` — Discourage `any` type
- See `.shogun-rules.js` for complete list

## Philosophy

The agent operates under **Shogun discipline**:

✅ **Propose** — Generate diffs and reports  
✅ **Review** — Human examines recommendations  
✅ **Approve** — Developer decides what to fix  
✅ **Execute** — Apply patches after confirmation  

❌ **Never** auto-modify code  
❌ **Never** auto-commit changes  
❌ **Never** override human judgment  

## Integration Points

### Background Job (Every 6 hours)
```typescript
// In index.ts
import { runBackgroundRefactorAgent } from '~/server/agents/BackgroundRefactorAgent';

// Every 6 hours
setInterval(async () => {
  await runBackgroundRefactorAgent(process.env.PROJECT_ROOT);
}, 6 * 60 * 60 * 1000);
```

### Git Pre-Commit Hook
```bash
#!/bin/bash
# .git/hooks/pre-commit
npm run audit:quick
```

### Slack Notification
```typescript
const result = await agent.runFullAudit();
if (result.entropy.score > 60) {
  await notifySlack(`⚠️ Code entropy high: ${result.entropy.score}/100`);
}
```

### REST API Endpoint
```typescript
app.get('/api/agents/audit', async (req, res) => {
  const agent = new BackgroundRefactorAgent(process.env.PROJECT_ROOT);
  const result = await agent.runFullAudit();
  res.json(result);
});
```

## Troubleshooting

**Agent runs but finds no TODOs**
- TODOs must match: `// TODO: text` or `// TODO (priority): text` or `// TODO @owner: text`
- Priority: critical, high, medium, low
- Check file has proper comment syntax

**Import validation fails**
- Ensure all dependencies are installed
- Check file path accuracy
- Node module resolution works in require.resolve

**Routes not detected**
- Routes must match: `router.get('/path', ...)` or `app.post('/', ...)`
- Supported: GET, POST, PUT, DELETE, PATCH, HEAD
- File must be in `/server/routes/` directory

**No patches generated**
- Only "unused imports" and "naming" violations generate patches
- Other issues require manual fixing
- See `/reports/agent-audits/*.md` for recommendations

## Next Steps

1. **Configure rules** — Edit `.shogun-rules.js` for your standards
2. **Schedule runs** — Add to background job system
3. **Monitor reports** — Check `/reports/agent-audits/` after each run
4. **Review patches** — Before applying any diffs
5. **Iterate** — Adjust rules based on team workflow

---

**Questions?** The agent generates detailed reports in multiple formats. Start with the HTML report at `/reports/agent-audits/`.
