# Current Feature System - Exact File Locations

## Backend Feature Service

### 📄 File: `server/services/featureService.ts`
**Lines:** ~1,100  
**Contains:** Feature definitions, APIs, utility functions

Key exports:
```typescript
export const DEFAULT_FEATURES: Record<string, FeatureConfig> = {
  // 60+ features defined here with:
  // - name, enabled, releaseDate, phase, description, category
}

export function getAllFeatures()
export function getEnabledFeatures()
export function isFeatureEnabled(key: string)
export function getFeaturesByPhase(phase: number)
export function getFeaturesByCategory(category: string)
export function releasePhase(phase: number)
export function enableFeature(key: string)
export function disableFeature(key: string)
```

---

## Backend API Routes

### 📄 File: `server/routes/features.ts`
**Lines:** ~150  
**Endpoints:**
- `GET /api/features` - All features + user beta access
- `GET /api/features/enabled` - Only enabled features
- `GET /api/features/:key` - Single feature
- `POST /api/features/:key/enable` - Admin only
- `POST /api/features/:key/disable` - Admin only

### 📄 File: `server/routes/admin.ts` (Beta Access Section)
**Lines:** ~200 (beta access related)  
**Endpoints:**
- `POST /api/admin/beta-access` - Grant features
- `DELETE /api/admin/beta-access/:userId` - Revoke all
- `DELETE /api/admin/beta-access/:userId/:feature` - Revoke specific
- `GET /api/admin/beta-access` - List beta users

---

## Database Schema

### 📄 File: `shared/schema.ts`
**Table:** `betaAccess`

```typescript
export const betaAccess = pgTable("beta_access", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  featureName: varchar("feature_name").notNull(),
  grantedAt: timestamp("granted_at").defaultNow(),
  revokedAt: timestamp("revoked_at"),
  grantedBy: varchar("granted_by").references(() => users.id),
});
```

---

## Frontend Hook

### 📄 File: `client/src/hooks/useFeatureFlags.ts`
**Lines:** ~250

Returns:
```typescript
{
  // Phase 1 Features
  isDaosEnabled: boolean,
  isGovernanceEnabled: boolean,
  isTreasuryEnabled: boolean,
  isWalletEnabled: boolean,
  isMembersEnabled: boolean,
  isProposalsEnabled: boolean,
  isVotingEnabled: boolean,
  
  // Phase 2 Features
  isLockedSavingsEnabled: boolean,
  isInvestmentPoolsEnabled: boolean,
  isVaultYieldEnabled: boolean,
  isTasksEnabled: boolean,
  
  // Phase 3+ Features
  isAiAssistantEnabled: boolean,
  isAnalyticsEnabled: boolean,
  isPredictionsEnabled: boolean,
  
  // Trading & Advanced
  isDexEnabled: boolean,
  isBridgeEnabled: boolean,
  isCrossChainEnabled: boolean,
  
  // Admin Features
  isAdminEnabled: boolean,
  isAdminUserMgmtEnabled: boolean,
  isAdminModerationEnabled: boolean,
  isAdminBetaAccessEnabled: boolean,
  
  // User Beta Features
  userBetaFeatures: string[],
  hasBetaAccess(feature: string): boolean,
  
  // Release Info
  releaseSchedule: Record<string, ReleasePhase>,
  
  // Loading
  isLoading: boolean,
  error: Error | null,
}
```

---

## Frontend Gating Component

### 📄 File: `client/src/components/FeatureGate.tsx`
**Lines:** ~120

Usage examples:
```typescript
// Simple - render nothing if disabled
<FeatureGate feature="isLockedSavingsEnabled">
  <LockedSavings />
</FeatureGate>

// With fallback
<FeatureGate 
  feature="isDexEnabled"
  fallback={<ComingSoon />}
>
  <DexInterface />
</FeatureGate>

// With coming soon message
<FeatureGate 
  feature="isAiAssistantEnabled"
  showComingSoon="January 15, 2026"
>
  <AiAssistant />
</FeatureGate>
```

---

## Admin UI for Feature Management

### 📄 File: `client/src/pages/admin/BetaAccessPage.tsx`
**Lines:** ~300

UI allows admins to:
- Search users
- Select multiple users
- Choose features to grant
- Batch grant features
- View grant history
- Revoke features

---

## Types & Interfaces

### 📄 File: `client/src/types/admin.ts`
**Contains:**
```typescript
export interface BetaAccessUser {
  userId: string;
  username: string;
  email: string;
  email_verified: boolean;
  features: string[];
  grantedAt: string;
  grantedBy: string;
}

interface SystemConfig {
  featureFlags: {
    betaFeatures: boolean;
  };
}
```

---

## Configuration & Env Variables

### 📄 Environment Variables Pattern
```bash
FEATURE_DAOS=true
FEATURE_GOVERNANCE=true
FEATURE_TREASURY=false
FEATURE_TRADING_DEX=false
FEATURE_ADMIN_BETA=true
# ... 60+ more
```

Each feature can be:
- Enabled via env variable
- Enabled via code (default)
- Granted to users via database
- Checked client-side via hook
- Gated via component

---

## Documentation Files

### 📄 Related Docs
- `MASTER_FEATURE_VISIBILITY_CONTROL.md` - Full feature list
- `PROGRESSIVE_RELEASE_IMPLEMENTATION.md` - Architecture
- `WEEK1_DATABASE_PERSISTENCE_COMPLETE.md` - Database implementation
- `WEEK1_FINAL_CHECKLIST.md` - Validation checklist

---

## Architecture Flow

```
1. BACKEND STARTUP
   ↓
   server/services/featureService.ts loads:
   - DEFAULT_FEATURES object (from code)
   - Environment variables (FEATURE_*)
   - Release phases and metadata

2. ADMIN GRANTS BETA ACCESS
   ↓
   POST /api/admin/beta-access
   ↓
   Database: Insert into betaAccess table
   ↓
   User now has "feature_name" granted

3. CLIENT LOADS PAGE
   ↓
   useFeatureFlags() hook calls:
   GET /api/features
   ↓
   Server returns:
   {
     features: { isLockedSavingsEnabled: true, ... },
     user: { enabledBetaFeatures: ["locked_savings"] },
     releaseSchedule: { ... }
   }
   ↓
   Client caches 5 minutes

4. COMPONENT CHECKS FEATURE
   ↓
   <FeatureGate feature="isLockedSavingsEnabled">
   ↓
   Hook returns: true
   ↓
   Component renders!

5. ADMIN REVOKES BETA ACCESS
   ↓
   DELETE /api/admin/beta-access/:userId/:feature
   ↓
   Database: Delete from betaAccess
   ↓
   Next request: Hook returns updated list
   ↓
   Component hides or shows fallback
```

---

## Summary Statistics

| Metric | Count | Status |
|--------|-------|--------|
| Features Defined | 60+ | ✅ Complete |
| API Endpoints | 8 | ✅ Complete |
| Database Tables | 1 (betaAccess) | ✅ Complete |
| Frontend Hooks | 1 (useFeatureFlags) | ✅ Complete |
| Components | 1 (FeatureGate) | ✅ Complete |
| Admin Pages | 1 (BetaAccessPage) | ✅ Complete |
| Total Lines | ~2,000 | ✅ Complete |

---

## Phase 3 Enhancement (What to Add)

**New Files Needed:**
1. `client/src/hooks/useFeatureGating.ts` (~80 lines)
   - Checks gating rules (age, balance, reputation, manual)
   - Returns: isAvailable, reason, countdowns

2. `server/services/gatingService.ts` (~80 lines)
   - Define gating rules for each feature
   - Check if user meets criteria
   - Calculate "time until available"

3. `server/routes/gating.ts` (~30 lines)
   - GET /api/gating-rules
   - GET /api/gating-status (per user)

4. Enhanced `FeatureGate.tsx` (~30 lines)
   - Show gating reason
   - Show countdown
   - Show action needed

5. Settings component additions (~30 lines)
   - Advanced Mode toggle
   - Feature unlock status

**Total: ~250 lines of new code**
**Build time: 3-4 hours**

---

## Ready to Build Phase 3?

See these files for full details:
- `PHASE_3_BUILD_ON_EXISTING_SYSTEM.md` - Complete build plan
- `FEATURE_SYSTEM_EXISTING_SUMMARY.md` - Architecture overview
- `UIUX_IMPLEMENTATION_DETAILED_CHECKLIST.md` - Full Phase 3 checklist (Task 3.1)

Your foundation is rock-solid. Phase 3 is just adding the "WHY" and "WHEN" layers on top.
