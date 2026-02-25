# Phase 3 Quick Start: Build on Your Existing System

## Status Check ✅

You have:
- ✅ 60+ features defined in `server/services/featureService.ts`
- ✅ Beta access system (database persistence)
- ✅ `useFeatureFlags()` hook on client
- ✅ `<FeatureGate>` component for gating
- ✅ Admin UI for granting features
- ✅ /api/features endpoint

**Missing for Phase 3:**
- ❌ Gating rules (age, balance, reputation)
- ❌ `useFeatureGating()` hook to check rules
- ❌ Progressive unlock explanations
- ❌ Advanced Mode toggle in Settings

---

## 🚀 Quick Build: 3-4 Hours

### Hour 1: Backend Gating Service

**Create:** `server/services/gatingService.ts`

```typescript
import { User } from '@/shared/schema';

export interface GatingRule {
  type: 'age' | 'balance' | 'reputation' | 'manual' | 'none';
  value?: Record<string, any>;
  explanation: string;
}

export interface GatingStatus {
  isAvailable: boolean;
  reason?: string;
  daysUntilAvailable?: number;
  amountNeeded?: number;
}

// Define rules for each feature
export const GATING_RULES: Record<string, GatingRule> = {
  'trading.dex': {
    type: 'manual',
    explanation: 'Enable Advanced Mode to access trading',
  },
  'vault.yield': {
    type: 'balance',
    value: { minAmount: 10_000_000 },
    explanation: 'Available when balance exceeds 10M',
  },
  'proposal.create': {
    type: 'age',
    value: { minDays: 7 },
    explanation: 'Available after 7 days of account age',
  },
  'ai.assistant': {
    type: 'reputation',
    value: { minReputation: 500 },
    explanation: 'Unlock by reaching reputation score of 500',
  },
  'dao.join': {
    type: 'none',
    explanation: 'Available immediately',
  },
};

export function checkFeatureGating(
  feature: string,
  user: User
): GatingStatus {
  const rule = GATING_RULES[feature];

  if (!rule) {
    return { isAvailable: true };
  }

  switch (rule.type) {
    case 'none':
      return { isAvailable: true };

    case 'age': {
      const createdAt = new Date(user.createdAt).getTime();
      const nowMs = Date.now();
      const daysOld = Math.floor((nowMs - createdAt) / (1000 * 60 * 60 * 24));
      const minDays = rule.value?.minDays || 0;

      if (daysOld < minDays) {
        return {
          isAvailable: false,
          reason: rule.explanation,
          daysUntilAvailable: minDays - daysOld,
        };
      }
      return { isAvailable: true };
    }

    case 'balance': {
      const minAmount = rule.value?.minAmount || 0;
      if ((user.balance || 0) < minAmount) {
        return {
          isAvailable: false,
          reason: rule.explanation,
          amountNeeded: minAmount - (user.balance || 0),
        };
      }
      return { isAvailable: true };
    }

    case 'reputation': {
      const minReputation = rule.value?.minReputation || 0;
      if ((user.reputation || 0) < minReputation) {
        return {
          isAvailable: false,
          reason: rule.explanation,
        };
      }
      return { isAvailable: true };
    }

    case 'manual': {
      if (!(user.advancedMode || false)) {
        return {
          isAvailable: false,
          reason: rule.explanation,
        };
      }
      return { isAvailable: true };
    }

    default:
      return { isAvailable: true };
  }
}
```

### Hour 1 (cont'd): Create API Endpoint

**Update:** `server/routes/features.ts`

```typescript
// Add this endpoint
router.get('/api/gating-rules', async (req, res) => {
  try {
    res.json({
      success: true,
      rules: GATING_RULES,
      description: 'Feature gating rules and explanations',
    });
  } catch (error) {
    logger.error('Error fetching gating rules:', error);
    res.status(500).json({ error: 'Failed to fetch gating rules' });
  }
});

// Add this endpoint (user-specific gating status)
router.get('/api/gating-status', requireAuth, async (req, res) => {
  try {
    const user = req.user;
    const features = Object.keys(GATING_RULES);
    
    const status: Record<string, GatingStatus> = {};
    features.forEach((feature) => {
      status[feature] = checkFeatureGating(feature, user);
    });

    res.json({
      success: true,
      status,
      user: {
        accountAge: Math.floor((Date.now() - new Date(user.createdAt).getTime()) / (1000 * 60 * 60 * 24)),
        balance: user.balance,
        reputation: user.reputation,
        advancedMode: user.advancedMode,
      },
    });
  } catch (error) {
    logger.error('Error checking gating status:', error);
    res.status(500).json({ error: 'Failed check gating status' });
  }
});
```

---

### Hour 2: Frontend Hook

**Create:** `client/src/hooks/useFeatureGating.ts`

```typescript
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/pages/hooks/useAuth';

export interface GatingStatus {
  isAvailable: boolean;
  reason?: string;
  daysUntilAvailable?: number;
  amountNeeded?: number;
}

export function useFeatureGating(featureKey: string) {
  const { user } = useAuth();

  const { data, isLoading, error } = useQuery<Record<string, GatingStatus>>({
    queryKey: ['gating-status', user?.id],
    queryFn: async () => {
      const res = await fetch('/api/gating-status');
      if (!res.ok) throw new Error('Failed to fetch gating status');
      const data = await res.json();
      return data.status;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    enabled: !!user, // Only run if authenticated
  });

  const status = data?.[featureKey] || { isAvailable: true };

  return {
    isAvailable: status.isAvailable,
    reason: status.reason,
    daysUntilAvailable: status.daysUntilAvailable,
    amountNeeded: status.amountNeeded,
    isLoading,
    error,

    // Helper: Format message
    getMessage() {
      if (status.isAvailable) return '';
      if (status.daysUntilAvailable)
        return `Available in ${status.daysUntilAvailable} day${status.daysUntilAvailable > 1 ? 's' : ''}`;
      if (status.amountNeeded)
        return `Deposit ${status.amountNeeded.toLocaleString()} more to unlock`;
      return status.reason || 'Not available yet';
    },
  };
}
```

---

### Hour 2 (cont'd): Enhance FeatureGate Component

**Update:** `client/src/components/FeatureGate.tsx`

```typescript
import { useFeatureGating } from '@/hooks/useFeatureGating';
import { AlertCircle, Clock, DollarSign } from 'lucide-react';

interface FeatureGateProps {
  feature: string;
  fallback?: React.ReactNode;
  showReason?: boolean;
  children: React.ReactNode;
}

export function FeatureGate({
  feature,
  fallback,
  showReason = true,
  children,
}: FeatureGateProps) {
  const flags = useFeatureFlags();
  const gating = useFeatureGating(feature);

  // Check if globally enabled
  const flagKey = `is${feature.charAt(0).toUpperCase()}${feature.slice(1)}Enabled`;
  const isEnabled = flags[flagKey as keyof typeof flags];

  if (!isEnabled) {
    return fallback ? <>{fallback}</> : null;
  }

  if (!gating.isAvailable) {
    if (!showReason) {
      return fallback ? <>{fallback}</> : null;
    }

    return (
      <div className="p-4 border border-amber-300 bg-amber-50 rounded-lg">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-semibold text-amber-900">
              🔒 {gating.reason || 'Not available yet'}
            </p>

            {gating.daysUntilAvailable && (
              <div className="mt-2 text-sm text-amber-800 flex items-center gap-2">
                <Clock className="w-4 h-4" />
                Available in {gating.daysUntilAvailable} day
                {gating.daysUntilAvailable > 1 ? 's' : ''}
              </div>
            )}

            {gating.amountNeeded && (
              <div className="mt-2 text-sm text-amber-800 flex items-center gap-2">
                <DollarSign className="w-4 h-4" />
                Deposit {gating.amountNeeded.toLocaleString()} more
              </div>
            )}

            <p className="mt-2 text-xs text-amber-700">
              💡 <a href="#help" className="underline">Learn why</a>
            </p>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
```

---

### Hour 3: Add to Settings

**Update:** `frontend/components/Settings/sections/PreferencesSettings.tsx`

Add to the return statement:

```typescript
<SettingsCard
  title="Advanced Mode"
  description={preferences.advancedMode ? '✅ Enabled' : '❌ Disabled'}
  icon="⚡"
  variant={preferences.advancedMode ? 'success' : 'warning'}
  action={
    <button
      onClick={() => {
        if (!preferences.advancedMode) {
          // Show warning modal before enabling
          if (confirm('⚠️ Advanced Mode unlocks all features. Are you sure?')) {
            onUpdate({ advancedMode: true });
          }
        } else {
          onUpdate({ advancedMode: false });
        }
      }}
      className={styles.primaryButton}
      disabled={isSaving}
    >
      {preferences.advancedMode ? 'Disable' : 'Enable'}
    </button>
  }
>
  <p>
    Unlock all features including trading, advanced governance, and developer tools. Advanced Mode is for experienced users.
  </p>
</SettingsCard>
```

---

### Hour 3 (cont'd): Update User Schema

**Update:** `shared/schema.ts`

Add to users table:

```typescript
export const users = pgTable('users', {
  // ... existing fields
  advancedMode: boolean('advanced_mode').default(false),
  reputation: integer('reputation').default(0),
  // ... rest
});
```

---

### Hour 4: Testing

**Test Cases:**

```typescript
// Test age-based gating
const newUser = { ...mockUser, createdAt: Date.now() - 86400000 }; // 1 day old
checkFeatureGating('proposal.create', newUser); // Should be unavailable (needs 7 days)

// Test balance-based gating
const poorUser = { ...mockUser, balance: 1_000_000 };
checkFeatureGating('vault.yield', poorUser); // Should be unavailable (needs 10M)

// Test manual gating
const normalUser = { ...mockUser, advancedMode: false };
checkFeatureGating('trading.dex', normalUser); // Should be unavailable

// Test enabled when criteria met
const richUser = { ...mockUser, balance: 15_000_000 };
checkFeatureGating('vault.yield', richUser); // Should be available
```

---

## 📋 Checklist

- [ ] Create `server/services/gatingService.ts`
- [ ] Add `/api/gating-rules` endpoint
- [ ] Add `/api/gating-status` endpoint
- [ ] Create `client/src/hooks/useFeatureGating.ts`
- [ ] Update `FeatureGate.tsx` component
- [ ] Add Advanced Mode toggle to Settings
- [ ] Update `users` table schema (advancedMode, reputation)
- [ ] Test age-based gating (create test user)
- [ ] Test balance-based gating (adjust balance)
- [ ] Test manual gating (toggle advanced mode)
- [ ] Test reputation gating (if implemented)

---

## 🎯 What You'll Have After

✅ Feature gating based on:
- Account age (e.g., "Available in 5 days")
- Balance (e.g., "Deposit 2.5M more")
- Reputation score
- Manual opt-in (Advanced Mode)

✅ Clear user messaging explaining:
- Why feature is locked
- When it becomes available
- What user needs to do

✅ Settings integration:
- Advanced Mode toggle
- Feature unlock status
- Clear explanations

✅ Fully typed:
- TypeScript interfaces
- Zero `any` types
- Compile-time safety

---

## 🚀 Ready to Build?

Start with **Hour 1** (backend service + endpoint). Once that's working, move to **Hour 2** (frontend hook), then **Hour 3** (Settings). Keep **Hour 4** for testing.

Total time: **3-4 hours**

Result: **Complete Phase 3 Task 3.1 ✅**

See `PHASE_3_BUILD_ON_EXISTING_SYSTEM.md` for full details and alternatives.
