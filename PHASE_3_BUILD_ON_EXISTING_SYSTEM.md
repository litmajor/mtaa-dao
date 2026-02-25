# Phase 3 Enhancement: Building on Existing Feature System

## Current Feature System Status ✅

You already have **three layers of feature gating**:

### Layer 1: Backend Feature Service
**File:** `server/services/featureService.ts`
- ✅ 60+ feature flags defined with metadata
- ✅ Phase-based release system (Phase 1-7)
- ✅ Categories (admin, special, defi, governance, etc.)
- ✅ Environment variable support (FEATURE_*)
- ✅ Release scheduling with dates

**Functions:**
```typescript
// Check features
isFeatureEnabled(featureKey)
getFeature(featureKey)

// Manage releases
getFeaturesByPhase(phase)
getFeaturesByCategory(category)
releasePhase(phase)
enableFeature(featureKey)
disableFeature(featureKey)
```

### Layer 2: Database Beta Access
**Table:** `betaAccess` in database
- ✅ Per-user feature access tracking
- ✅ Grant/revoke at user level
- ✅ Persisted in database
- ✅ Admin-controlled (`BetaAccessPage`)

**Structure:**
```typescript
interface BetaAccessUser {
  userId: string;
  features: string[];        // Array of feature names
  grantedAt: string;
  grantedBy: string;         // Admin who granted
}
```

### Layer 3: Frontend Gating
**Files:** 
- `client/src/hooks/useFeatureFlags.ts` - Fetches flags + user beta access
- `client/src/components/FeatureGate.tsx` - Component wrapper

**Hook Returns:**
```typescript
{
  // Global flags (from server)
  isDaosEnabled: boolean,
  isGovernanceEnabled: boolean,
  // ... 30+ feature flags
  
  // User beta features (from database)
  userBetaFeatures: string[],
  hasBetaAccess(feature: string): boolean,
  
  // Release info
  releaseSchedule: Record<string, ReleasePhase>,
}
```

---

## What's Missing for Phase 3

Your current system handles **feature availability** (enabled/disabled).

Phase 3 needs **feature tiers** (progressive disclosure based on user readiness):

### Current Model
```
Feature Flag: ON/OFF
User Beta Access: HAS/DOESN'T HAVE
```

### Phase 3 Model (Add This)
```
Feature Flag: ON/OFF
+ User Tier/Account Age/Balance → Determines when feature becomes available
+ Progressive unlock with explanations
+ Advanced mode toggle for early access
```

---

## Recommended Enhancement: Task 3.1 Build Plan

### Step 1: Add Gating Rules to Feature Service
```typescript
// server/services/featureService.ts - ADD THIS

interface GatingRule {
  type: 'age' | 'balance' | 'reputation' | 'manual' | 'none';
  value?: any;      // e.g., { days: 7 } for age gating
  explanation?: string;
}

const GATING_RULES: Record<string, GatingRule> = {
  'trading.dex': {
    type: 'manual',
    explanation: 'Requires opt-in in Advanced Settings'
  },
  'vault.yield': {
    type: 'balance',
    value: { minAmount: 10000000 },
    explanation: 'Available when balance > 10M'
  },
  'proposal.create': {
    type: 'age',
    value: { minDays: 7 },
    explanation: 'Available after 7 days'
  },
  'dao.join': {
    type: 'none',
    explanation: 'Available immediately'
  }
};
```

### Step 2: Create useFeatureGating Hook (New)
```typescript
// client/src/hooks/useFeatureGating.ts - NEW

export interface FeatureGatingStatus {
  isAvailable: boolean;
  isGated: boolean;
  reason?: string;
  daysUntilAvailable?: number;
  balanceNeeded?: number;
}

export function useFeatureGating(featureKey: string): FeatureGatingStatus {
  const { user } = useAuth();
  const { data: rules } = useQuery({
    queryKey: ['gating-rules'],
    queryFn: async () => {
      const res = await fetch('/api/gating-rules');
      return res.json();
    }
  });
  
  // Check if feature exists + is enabled
  const rule = rules?.[featureKey];
  
  if (!rule) {
    return { isAvailable: true, isGated: false };
  }
  
  // Check gating rules
  switch (rule.type) {
    case 'age':
      const createdAt = new Date(user.createdAt);
      const daysOld = Math.floor((Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24));
      if (daysOld < rule.value.minDays) {
        return {
          isAvailable: false,
          isGated: true,
          reason: `Available in ${rule.value.minDays - daysOld} days`,
          daysUntilAvailable: rule.value.minDays - daysOld,
        };
      }
      break;
      
    case 'balance':
      if (user.balance < rule.value.minAmount) {
        return {
          isAvailable: false,
          isGated: true,
          reason: `Deposit ${rule.value.minAmount - user.balance} more`,
          balanceNeeded: rule.value.minAmount - user.balance,
        };
      }
      break;
      
    case 'manual':
      if (!user.advancedMode) {
        return {
          isAvailable: false,
          isGated: true,
          reason: 'Enable Advanced Mode in Settings',
        };
      }
      break;
  }
  
  return { isAvailable: true, isGated: false };
}
```

### Step 3: Update FeatureGate Component
```typescript
// client/src/components/FeatureGate.tsx - ENHANCE

interface FeatureGateProps {
  feature: string;
  fallback?: React.ReactNode;
  showGatingReason?: boolean;  // NEW
  children: React.ReactNode;
}

export function FeatureGate({ 
  feature, 
  fallback, 
  showGatingReason = true,
  children 
}: FeatureGateProps) {
  const flags = useFeatureFlags();
  const gating = useFeatureGating(feature);  // NEW
  
  // Check if feature is enabled globally
  const isEnabled = flags[`is${feature.charAt(0).toUpperCase()}${feature.slice(1)}Enabled`];
  
  if (!isEnabled) {
    return fallback ? <>{fallback}</> : null;
  }
  
  // NEW: Check gating rules
  if (!gating.isAvailable) {
    if (showGatingReason) {
      return (
        <div className="p-4 border border-yellow-300 bg-yellow-50 rounded">
          <p className="font-semibold">🔒 {gating.reason}</p>
          <p className="text-sm text-gray-600 mt-1">
            {gating.daysUntilAvailable && `Available in ${gating.daysUntilAvailable} days`}
            {gating.balanceNeeded && `Deposit ${gating.balanceNeeded} more`}
          </p>
        </div>
      );
    }
    return fallback ? <>{fallback}</> : null;
  }
  
  return <>{children}</>;
}
```

### Step 4: Add Advanced Mode Toggle to Settings
```typescript
// frontend/components/Settings/sections/PreferencesSettings.tsx - ADD THIS

<SettingsCard 
  title="Advanced Mode"
  icon="⚡"
  variant="warning"
  action={
    <label className={styles.toggle}>
      <input
        type="checkbox"
        checked={preferences.advancedMode}
        onChange={() => handleToggle('advancedMode')}
      />
      <span className={styles.toggleSlider}></span>
    </label>
  }
>
  <p>Unlock all features including advanced trading, governance, and developer tools.</p>
  <p className="text-red-600 mt-2">⚠️ Advanced Mode is for experienced users only.</p>
</SettingsCard>
```

### Step 5: Add Gating Rules API Endpoint
```typescript
// server/routes/features.ts - ADD ENDPOINT

router.get('/api/gating-rules', (req, res) => {
  // Return gating rules for client
  // Can be customized per user if needed
  res.json({
    'trading.dex': {
      type: 'manual',
      explanation: 'Requires opt-in'
    },
    'vault.yield': {
      type: 'balance',
      minAmount: 10000000
    },
    'proposal.create': {
      type: 'age',
      minDays: 7
    },
    // ... more rules
  });
});
```

---

## Implementation Timeline for Phase 3

### Hour 1-2: Backend Setup
- [ ] Add `GATING_RULES` to featureService.ts
- [ ] Create `/api/gating-rules` endpoint
- [ ] Add `advancedMode` to user schema (if not exists)

### Hour 3-4: Frontend Hooks
- [ ] Create `useFeatureGating.ts` hook
- [ ] Test gating logic with mock data
- [ ] Wire up to useAuth user data

### Hour 5-6: Component Enhancement
- [ ] Update `FeatureGate.tsx` to use new hook
- [ ] Add explanatory messages for gated features
- [ ] Test on mobile (responsive gating messages)

### Hour 7-8: Settings Integration
- [ ] Add `advancedMode` toggle to PreferencesSettings
- [ ] Add warning modal before enabling
- [ ] Test persistence

### Hour 9-10: Testing & Documentation
- [ ] Manual test all gating rules
- [ ] Verify age-based gating (use fake timestamps)
- [ ] Verify balance-based gating (use test balances)
- [ ] Verify manual opt-in (advanced mode toggle)
- [ ] Document gating rule syntax

---

## Key Differences: Current vs Phase 3

| Aspect | Current | Phase 3 |
|--------|---------|---------|
| **Availability** | Feature ON/OFF | Feature ON/OFF + Gating Rules |
| **User Beta Access** | Admin grants manually | Admin + automatic (age/balance) |
| **Explanation** | None | "Why" for each gate + countdown/amount |
| **User Control** | Admin only | Admin + Advanced Mode toggle |
| **Progressive** | Binary (yes/no) | Progressive (time-based, amount-based) |

---

## Integration with Existing Settings

Your unified Settings component will get **2 new features**:

1. **Advanced Mode Toggle** (in Preferences section)
   - Unlocks all gated features
   - Warning modal before enable
   - Persists in `user.advancedMode`

2. **Feature Unlock Status** (optional, in new section)
   - Show which features are locked and why
   - Countdown if age-gated
   - Amount needed if balance-gated
   - Manual opt-in if available

---

## Ready to Build?

**Option A: Build Just the Core (2-3 hours)**
- useFeatureGating hook
- Update FeatureGate component
- Advanced mode toggle
- API endpoint

**Option B: Build with Explanations (3-4 hours)**
- Everything in Option A
- +  Detailed gating explanation UI
- + "Why?" help links
- + Unlock progress tracking

**Option C: Full Phase 3 (4-5 hours)**
- Everything in Option B
- + Onboarding path selection
- + Path-specific feature gating
- + Tutorial system

Which would you like to tackle first?
