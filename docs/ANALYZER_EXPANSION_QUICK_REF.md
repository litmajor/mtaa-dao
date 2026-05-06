# ANALYZER Expansion - Quick Reference

## What Changed

### Problem
The ANALYZER system was incomplete - it left out:
- ❌ Vault analytics (performance, APY, composition)
- ❌ Contribution tracking (member engagement, tiers)
- ❌ Proportional selection (was non-functional TODO)

### Solution
Expanded ANALYZER with two new specialized analyzers:

---

## New Analyzers

### 1. VaultAnalyzer
**What:** Track vault performance and asset allocation  
**Methods:** `analyze()`, `analyzeVaultPerformance()`, `analyzePortfolioComposition()`, `analyzeFeeImpact()`  
**Output:** TVL, APY, diversification, health scores  
**Use:** "Are my vaults performing well?"

### 2. ContributionAnalyzer  
**What:** Track member contributions and engagement  
**Methods:** `analyze()`, `getMemberContributionProfile()`, `getTopContributors()`, `getContributionWeights()`  
**Output:** Member tiers, engagement scores, fairness metrics  
**Use:** "Who should get rewarded? How engaged are members?"

---

## Key Enhancement: selectProportional

### Before
```typescript
// ❌ TODO: Calculate contribution amounts from payment history
const randomIndex = Math.floor(Math.random() * members.length);
return members[randomIndex];
```

### After
```typescript
// ✅ Uses ContributionAnalyzer to weight members by contributions
const weights = await analyzer.getContributionWeights(daoId, memberIds, '90d');
// Weighted random selection
let random = Math.random() * totalWeight;
for (const member of members) {
  random -= weights[member.id];
  if (random <= 0) return member;  // Selected!
}
```

**Result:** Fair proportional selection based on actual member contributions!

---

## How to Use

### Check Vault Health
```typescript
import { VaultAnalyzer } from '@/server/core/nuru/analytics/vault_analyzer';

const analyzer = new VaultAnalyzer();
const analysis = await analyzer.analyze('dao-123', '30d');
console.log(`Vault Health: ${analysis.metrics.vaultHealth}/100`);
```

### Check Member Contributions
```typescript
import { ContributionAnalyzer } from '@/server/core/nuru/analytics/contribution_analyzer';

const analyzer = new ContributionAnalyzer();
const profile = await analyzer.getMemberContributionProfile('user-456', 'dao-123');
console.log(`Member Tier: ${profile.contributionTier}`);
console.log(`Engagement: ${profile.engagementScore}/100`);
```

### Get Top Contributors
```typescript
const topContributors = await analyzer.getTopContributors('dao-123', 10, 'total');
topContributors.forEach((contributor, rank) => {
  console.log(`#${rank}: $${contributor.totalAmount}`);
});
```

### Use Proportional Selection
```typescript
import { selectProportional } from '@/server/api/rotation_service';

const winner = await selectProportional('dao-123', daoMembers);
console.log(`Selected: ${winner.name} based on ${winner.totalContribution} in contributions`);
```

---

## Files Modified/Created

| File | Type | Change |
|------|------|--------|
| `vault_analyzer.ts` | NEW | 450+ lines, vault performance |
| `contribution_analyzer.ts` | NEW | 600+ lines, member engagement |
| `rotation_service.ts` | MODIFIED | selectProportional now functional |
| `ANALYZER_EXPANSION_PLAN.md` | NEW | Strategic roadmap |
| `ANALYZER_EXPANSION_IMPLEMENTATION.md` | NEW | Technical guide |

---

## Metrics Available

### Per Vault
- TVL (Total Value Locked)
- APY (Annual Percentage Yield)
- Asset composition
- Rebalancing frequency
- Fee drag
- Risk profile
- Health score

### Per Member
- Total contributions
- Engagement score (0-100)
- Consistency score (0-100)
- Contribution tier (bronze/silver/gold/platinum)
- Growth trend
- Last contribution date
- Average contribution size

### Per DAO (Aggregated)
- Total active contributors
- Total contribution volume
- Average contribution size
- Top contributor share
- Gini coefficient (inequality)
- Engagement rate
- Overall health score

---

## Integration Points

### 1. Rotation Service
`selectProportional()` now uses real contribution data instead of random selection

### 2. PerformanceTracker
Add vault and contribution metrics to overall DAO performance scoring

### 3. Dashboard
Display vault analytics and contribution tracking tabs

### 4. API Routes
Expose new `/api/analyzer/:daoId/vault-analytics` and `/api/analyzer/:daoId/contribution-analytics` endpoints

### 5. Feature Flags
```env
FEATURE_ANALYZER_VAULTS=true
FEATURE_ANALYZER_CONTRIBUTIONS=true
FEATURE_PROPORTIONAL_SELECTION=true
```

---

## API Endpoints (To Add)

```
GET /api/analyzer/:daoId/vault-analytics
GET /api/analyzer/:daoId/vault/:vaultId/performance
GET /api/analyzer/:daoId/contribution-analytics
GET /api/analyzer/:daoId/member/:userId/contributions
GET /api/analyzer/:daoId/top-contributors
GET /api/analyzer/:daoId/contribution-distribution
GET /api/analyzer/:daoId/contribution-patterns
```

---

## Testing Strategy

### Unit Tests
- Gini coefficient calculation
- Tier assignment logic
- Consistency scoring
- Growth trend detection

### Integration Tests
- selectProportional with real contribution data
- PerformanceTracker metric collection
- API endpoint responses
- Dashboard component rendering

### E2E Tests
- Full rotation workflow with proportional selection
- Member earning rewards based on contributions
- Dashboard analytics updating in real-time

---

## Success Indicators

✅ selectProportional now uses real contribution data  
✅ Member tiers automatically assigned based on engagement  
✅ Vault performance tracked over time  
✅ Top contributors identified and ranked  
✅ DAOs can measure member engagement accurately  
✅ Fair reward distribution based on contributions  

---

## What's Next

### Immediate
- Add ProposalAnalyzer (voting patterns, success factors)
- Create API routes for new endpoints
- Add feature flags

### Short-term
- Dashboard integration
- Real-time metric updates
- Performance optimizations

### Medium-term
- ComplianceAnalyzer (risk, regulatory)
- ComparativeAnalyzer (peer benchmarking)
- Predictive analytics

### Long-term
- Advanced ML models
- Custom metric definitions
- Multi-DAO analytics

---

## Questions?

**What's Gini coefficient?**
Measures inequality in distribution. 0 = perfect equality, 1 = all concentration. Target <0.4.

**How does proportional selection work?**
Uses 90-day contribution history as weights. Higher contributors = higher selection probability.

**Why new analyzers?**
Vault and Contribution analytics are complex, high-value. Separating them allows focused improvements.

**When are metrics updated?**
Real-time on events, hourly batch for aggregates. Configurable via `ANALYZER_UPDATE_INTERVAL`.

**Can I customize timeframes?**
Yes. All methods accept optional timeframe: '7d', '30d', '90d', '1m', '6m', '1y'.

---

## Key Takeaway

Your ANALYZER system now provides **360-degree DAO visibility**:
- How healthy are your vaults? → VaultAnalyzer
- How engaged are your members? → ContributionAnalyzer
- Who should get rewarded? → selectProportional
- What's your overall health? → PerformanceTracker

**Result:** Better decisions, fairer rewards, healthier DAOs! 🎉
