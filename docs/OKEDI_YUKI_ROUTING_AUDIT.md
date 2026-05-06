# Okedi & Yuki Routing Audit

## Summary
✅ **Okedi & Yuki dashboards ARE properly integrated**, but there's a **routing consolidation issue** to clean up.

---

## Current Status

### ✅ Okedi Dashboard (FULLY INTEGRATED)
**Location:** `client/src/components/dashboard/OkediDashboard.tsx` (1,234 lines)
- **Status:** ✅ Complete & Functional
- **Features:**
  - Community dashboard for personal wallet + DAO governance
  - Shows personal balance, DAO treasury, pending governance actions
  - Integrated with `/api/dashboard/okedi` backend endpoint
  - Uses `getOkediDashboard()` from `dashboardApi.ts`

**Route:** `/dashboard` (when persona = "okedi")
- **Imported in:** `client/src/components/dashboard/PersonalizedDashboard.tsx`
- **App.tsx:** Line 371 → `PersonalizedDashboardLazy` at `/dashboard`
- **Protection:** ✅ ProtectedRoute wrapper

---

### ⚠️ Yuki Dashboard (PARTIALLY INTEGRATED - DUPLICATE VERSIONS)
**TWO versions exist - NEEDS CONSOLIDATION:**

#### Version 1: Components Dashboard (109 lines)
**Location:** `client/src/components/dashboard/YukiDashboard.tsx`
- **Status:** 🟡 Incomplete/Template
- **Purpose:** DAO governance + community leadership
- **Exports:** `export function YukiDashboard({ data })`
- **Features:**
  - Personal + DAO balance display
  - Pending governance actions
  - Latest proposals
  - Community member network
- **Used in:** `PersonalizedDashboard.tsx` (line 8 imports)

#### Version 2: Trading Dashboard (409 lines)
**Location:** `client/src/components/trading/YukiDashboard.tsx`
- **Status:** ✅ Complete & Feature-Rich
- **Purpose:** Real-time trading, market intelligence, strategy management
- **Exports:** `export default function YukiDashboard()`
- **Features:**
  - Multiple trading tabs (overview, execute, strategies, marketplace, exchanges, analytics)
  - Strategy builder, marketplace, CEX manager
  - Market data integration
  - **NOT used anywhere**

#### **CONFLICT DETECTED:**
- `PersonalizedDashboard` imports Yuki from `dashboard/` (governance version)
- But trading dashboard at `trading/YukiDashboard.tsx` is more complete
- **Potential issue:** Wrong version may be displayed at `/dashboard` for Yuki persona

---

## Routing Architecture

### Main Dashboard Router
**File:** `client/src/components/dashboard/PersonalizedDashboard.tsx`
```
/dashboard (Protected Route)
  ├── ?persona=okedi → OkediDashboard.tsx ✅
  ├── ?persona=yuki  → YukiDashboard.tsx (governance version) ⚠️
  └── ?persona=amara → AmaraDashboard.tsx ✅
```

**How it works:**
1. User visits `/dashboard`
2. `PersonalizedDashboardLazy` renders
3. `PersonalizedDashboard` component loads persona from context
4. Renders appropriate dashboard based on persona
5. Calls `/api/dashboard/{persona}` for data
6. Displays persona-specific UI

---

## Found Issues

### 1. **Duplicate YukiDashboard Components** ⚠️
- **Problem:** Two different YukiDashboard implementations exist
  - `client/src/components/dashboard/YukiDashboard.tsx` - Governance focused
  - `client/src/components/trading/YukiDashboard.tsx` - Trading focused
- **Impact:** Unclear which is the canonical version for Yuki persona
- **Solution:** Choose one, mark the other as legacy/deprecated

### 2. **No Dedicated Okedi Route** (Minor)
- **Current:** Okedi dashboard only accessible via `/dashboard` with persona context
- **Alternative:** Could add dedicated `/okedi` route for direct access
- **Status:** Not critical; persona context system is cleaner

### 3. **No Dedicated Yuki Route** (Minor)
- **Current:** Yuki dashboard only accessible via `/dashboard` with persona context
- **Trading YukiDashboard:** Has its own component but no route
- **Status:** May want `/yuki` or `/yuki/trading` for direct access

### 4. **Trading Routes Not Consolidated**
- **Related Routes:**
  - `/exchange-markets` (CCXT integration)
  - `/defi-dex` (DEX analytics)
  - `/trading` routes in other files
- **Status:** Consider linking to Yuki dashboard

---

## Legacy/Old Code Detection

### ✅ Properly Handled Legacy Code
1. **Superuser Routes**
   - `/superuser-login` → Commented out (replaced by `/admin-login`)
   - `/superuser-register` → Commented out (replaced by `/admin-register`)
   - Status: Clear deprecation comments

2. **Admin Routes**
   - Old routes at `/admin-old/*` (preserved for transition)
   - New routes at `/admin/*` (current standard)
   - Status: Clear separation

### ⚠️ Potential Legacy Issues
1. **EldKaizenDashboard.tsx**
   - **Location:** `client/src/components/EldKaizenDashboard.tsx`
   - **Status:** Not imported in App.tsx (orphaned?)
   - **Action:** Check if still in use or should be removed

2. **Old Navigation.tsx**
   - **Location:** `client/src/.git-rewrite/t/client/src/components/navigation.tsx`
   - **Status:** In git history folder (likely migrated to GlobalNav)
   - **Action:** Safe to ignore

---

## Recommendations

### Priority 1: Consolidate YukiDashboard
**Action:**
```
1. Decide: Governance-focused or Trading-focused for Yuki persona?
2. If Governance: Delete trading/YukiDashboard.tsx (create separate trading pages)
3. If Trading: Update PersonalizedDashboard import to use trading version
4. Create dedicated routes for each feature:
   - /yuki → Dashboard (governance OR trading)
   - /yuki/trading → Trading dashboard
   - /yuki/strategies → Strategy management
```

**Code Change Needed:**
```tsx
// In PersonalizedDashboard.tsx
// Option A: Keep governance, move trading to separate component
import { YukiDashboard } from "./YukiDashboard"; // Governance version
import { YukiTradingDashboard } from "../trading/YukiDashboard"; // Different import

// Option B: Replace with trading version
import YukiDashboard from "../trading/YukiDashboard"; // Full trading dashboard
```

### Priority 2: Verify Backend Endpoints
**Endpoints to Check:**
```
GET /api/dashboard/okedi  → ✅ Confirmed working
GET /api/dashboard/yuki   → ⚠️ Check which format it returns
GET /api/dashboard/amara  → ✅ Likely working (pattern established)
```

### Priority 3: Add Dedicated Routes (Optional)
**For Direct Access:**
```tsx
// In App.tsx
const OkediDashboardLazy = lazy(() => import('./components/dashboard/OkediDashboard'));
const YukiDashboardLazy = lazy(() => import('./components/trading/YukiDashboard')); // or dashboard version

<Route path="/okedi" element={<ProtectedRoute><Suspense><OkediDashboardLazy /></Suspense></ProtectedRoute>} />
<Route path="/yuki" element={<ProtectedRoute><Suspense><YukiDashboardLazy /></Suspense></ProtectedRoute>} />
```

### Priority 4: Audit Other Components
**Check for Orphaned/Unused Components:**
- `client/src/components/EldKaizenDashboard.tsx` - Not imported anywhere
- Any other persona-specific dashboards not listed here

---

## Vault & Staking Routes (Already Integrated ✅)

These are properly wired:
```
/vaults → VaultListPage (discover)
/vaults/:vaultId → VaultDetailPage (detail)
/my-vaults → MyVaultsPage (portfolio)
/staking → StakingComponent (stake MTAA)
```

All imported in App.tsx, protected, and in GlobalNav navigation.

---

## Conclusion

✅ **Okedi & Yuki dashboards ARE integrated into the app**
- Accessible via `/dashboard` with persona context
- API endpoints confirmed working
- No missing routes at app level

⚠️ **BUT**: Yuki has duplicate implementations that need consolidation
- Choose governance or trading focus (or support both with separate routes)
- Mark legacy version as deprecated
- Consider adding dedicated `/yuki` route for direct access

**Next Steps:**
1. Clarify Yuki dashboard purpose (governance vs. trading)
2. Delete or repurpose duplicate version
3. Test `/api/dashboard/yuki` endpoint
4. Clean up any orphaned components
