# Phase 3 Task 3.1: Feature Gating - Testing Guide

**Status: ✅ IMPLEMENTATION COMPLETE**

All 6 build steps completed:
- ✅ `server/services/gatingService.ts` (backend gating rules)
- ✅ `/api/gating-rules` endpoint (fetch rules)
- ✅ `/api/gating-status` endpoint (check user status)
- ✅ `client/src/hooks/useFeatureGating.ts` (frontend hook)
- ✅ Enhanced `FeatureGate.tsx` component (gating UI)
- ✅ Advanced Mode toggle in Settings + schema update

---

## 📋 Test Checklist

### Backend Tests

#### Test 1: Gating Service - Age-Based
```typescript
// Expected: Feature unavailable until 7 days have passed
const newUser = {
  ...mockUser,
  createdAt: new Date(Date.now() - 86400000) // 1 day old
};
checkFeatureGating('proposal.create', newUser);
// Result: { isAvailable: false, reason: '...', daysUntilAvailable: 6 }
```

**Steps to test:**
1. Create a test user account now
2. Don't wait 7 days (test with mock data)
3. Call `/api/gating-status` for that user
4. Verify `proposal.create` shows `daysUntilAvailable: 7`

#### Test 2: Gating Service - Balance-Based
```typescript
// Expected: Feature unavailable until balance >= 10M
const poorUser = { ...mockUser, balance: 1_000_000 };
checkFeatureGating('vault.yield', poorUser);
// Result: { isAvailable: false, reason: '...', amountNeeded: 9_000_000 }
```

**Steps to test:**
1. Update user balance to 1,000,000
2. Call `/api/gating-status`
3. Verify `vault.yield` shows `amountNeeded: 9000000`

#### Test 3: Gating Service - Manual (Advanced Mode)
```typescript
// Expected: Feature unavailable unless advancedMode = true
const normalUser = { ...mockUser, advancedMode: false };
checkFeatureGating('trading.dex', normalUser);
// Result: { isAvailable: false, reason: 'Enable Advanced Mode...' }
```

**Steps to test:**
1. User with `advancedMode: false`
2. Call `/api/gating-status`
3. Verify `trading.dex` is locked
4. Toggle Advanced Mode in Settings
5. Call `/api/gating-status` again
6. Verify `trading.dex` now shows available

#### Test 4: Gating Service - Reputation-Based
```typescript
// Expected: Feature unavailable until reputation >= 500
const newUserNoRep = { ...mockUser, reputation: 0 };
checkFeatureGating('ai.assistant', newUserNoRep);
// Result: { isAvailable: false, reason: '...' }
```

**Steps to test:**
1. Create user with `reputation: 0`
2. Call `/api/gating-status`
3. Verify `ai.assistant` is locked
4. Update user `reputation: 500+`
5. Call `/api/gating-status` again
6. Verify `ai.assistant` is available

#### Test 5: API Endpoints

**Test 5a: GET /api/gating-rules**
```bash
curl http://localhost:3000/api/gating-rules
```

Expected response:
```json
{
  "success": true,
  "rules": {
    "trading.dex": { "type": "manual", "explanation": "..." },
    "vault.yield": { "type": "balance", "value": { "minAmount": 10000000 }, "explanation": "..." }
    // ... more rules
  }
}
```

**Test 5b: GET /api/gating-status**
```bash
# Requires auth header
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:3000/api/gating-status
```

Expected response:
```json
{
  "success": true,
  "status": {
    "trading.dex": { "isAvailable": false, "reason": "Enable Advanced Mode..." },
    "vault.yield": { "isAvailable": false, "amountNeeded": 9000000 },
    "proposal.create": { "isAvailable": false, "daysUntilAvailable": 6 }
    // ... more features
  },
  "user": {
    "id": "user123",
    "accountAge": 1,
    "balance": 1000000,
    "reputation": 0,
    "advancedMode": false
  }
}
```

---

### Frontend Tests

#### Test 6: useFeatureGating Hook

```typescript
// In a test component
import { useFeatureGating } from '@/hooks/useFeatureGating';

export function TestComponent() {
  const gating = useFeatureGating('vault.yield');
  
  // Expected properties:
  // - isAvailable: boolean
  // - reason?: string
  // - daysUntilAvailable?: number
  // - amountNeeded?: number
  // - isLoading: boolean
  // - error?: string
  // - getMessage(): string
  // - getIcon(): string
  
  return (
    <div>
      <p>Available: {gating.isAvailable ? '✅' : '❌'}</p>
      <p>Icon: {gating.getIcon()}</p>
      <p>Message: {gating.getMessage()}</p>
    </div>
  );
}
```

**Test steps:**
1. Create component with hook
2. Verify hook initializes with loading state
3. Verify hook fetches from `/api/gating-status`
4. Verify hook caches for 5 minutes
5. Verify hook shows correct message based on status

#### Test 7: FeatureGate Component with Gating

```typescript
// Component usage
<FeatureGate
  feature="isVaultYieldEnabled"
  showGatingReason={true}
>
  <VaultYieldUI />
</FeatureGate>
```

**Test steps:**
1. Feature enabled globally + user doesn't meet requirements
2. Should show amber banner with "🔒 Available when balance exceeds 10M"
3. Should show dollar icon with "Deposit 9,000,000 more"
4. Should show "Learn why" link

#### Test 8: Settings - Advanced Mode Toggle

**Test steps:**
1. Go to Settings → Preferences
2. Find "Advanced Mode" card (should show "⚡")
3. Click "Enable" button
4. Should show confirmation dialog
5. Confirm → toggle should change to "✅ Enabled"
6. Click "Disable" → toggle should change to "❌ Disabled"
7. Refresh page → setting should persist

#### Test 9: Advanced Mode Unlocks Trading

```typescript
// After enabling Advanced Mode
<FeatureGate
  feature="isVaultYieldEnabled"
  showGatingReason={true}
>
  <TradingUI />
</FeatureGate>
```

**Test steps:**
1. With `advancedMode: false` and feature enabled
2. Should show "🔒 Enable Advanced Mode to access trading"
3. Go to Settings → Preferences
4. Enable Advanced Mode
5. Return to trading page
6. Feature should be visible (gating removed)

---

## 🧪 Manual Testing Scenario

### Complete User Journey

**User: Fresh Account (Okedi)**

1. **Day 0 - Account Created**
   - Call `/api/gating-status`
   - Expected: `proposal.create` locked (6 daysUntilAvailable)
   - Expected: `vault.yield` locked (9M amountNeeded)
   - Expected: `trading.dex` locked (advancedMode required)
   - Expected: `ai.assistant` locked (500 reputation needed)

2. **Navigate to Settings**
   - Go to Settings → Preferences
   - See "Advanced Mode" showing "❌ Disabled"
   - Click "Enable"
   - Confirm warning dialog
   - Button changes to "Disable"

3. **Check Gating After Advanced Mode**
   - Call `/api/gating-status`
   - Expected: `trading.dex` now available ✅
   - Expected: `proposal.create` still locked
   - Expected: `vault.yield` still locked
   - Expected: `ai.assistant` still locked

4. **Deposit Tokens (Simulator)**
   - Manually update `users.balance = 15_000_000` in DB
   - Call `/api/gating-status`
   - Expected: `vault.yield` now available ✅

5. **Gain Reputation (Simulator)**
   - Manually update `users.reputation = 600` in DB
   - Call `/api/gating-status`
   - Expected: `ai.assistant` now available ✅

6. **Wait 7 Days (Simulate)**
   - Manually update `users.createdAt` to 7 days ago in DB
   - Call `/api/gating-status`
   - Expected: `proposal.create` now available ✅

**Expected Final State:**
```json
{
  "trading.dex": "✅ Available (Advanced Mode enabled)",
  "vault.yield": "✅ Available (15M balance)",
  "proposal.create": "✅ Available (7 days old)",
  "ai.assistant": "✅ Available (600 reputation)",
  "dao.join": "✅ Available (no gating)"
}
```

---

## 🐛 Debugging Commands

### Check Backend
```bash
# Test gating-rules endpoint
curl http://localhost:3000/api/gating-rules | jq .

# Test gating-status endpoint (with auth)
curl -H "Authorization: Bearer {token}" \
  http://localhost:3000/api/gating-status | jq .

# Check user in database
SELECT id, advanced_mode, balance, reputation, created_at 
FROM users WHERE id = 'user123';
```

### Check Frontend
```javascript
// In browser console
fetch('/api/gating-status')
  .then(r => r.json())
  .then(d => console.log(JSON.stringify(d, null, 2)))

// Check useFeatureGating hook state
// (React DevTools → Hooks → useFeatureGating)
```

### Check Network
```bash
# Open DevTools Network tab
# Look for these requests:
# - GET /api/features/gating-status (should cache 5 min)
# - GET /api/features/gating-rules (should not need auth)
```

---

## ✅ Sign-Off Checklist

- [ ] All 6 components created without errors
- [ ] Backend routes respond correctly
- [ ] Age-based gating works
- [ ] Balance-based gating works
- [ ] Reputation-based gating works
- [ ] Manual/Advanced Mode gating works
- [ ] useFeatureGating hook fetches data
- [ ] FeatureGate shows gating reasons
- [ ] Advanced Mode toggle in Settings works
- [ ] Settings persist after refresh
- [ ] All TypeScript compiles (no errors)
- [ ] User journey works end-to-end

---

## Next Steps After Testing

✅ Phase 3 Task 3.1 (Core Gating) COMPLETE

**Next:**
- **Option A Done** → 2-3 hours implementation ✅
- **Remaining Options:**
  - **Option B:** Add detailed explanations (unlock paths, countdown timers)
  - **Option C:** Add onboarding paths (persona-based feature unlocks)

See `PHASE_3_QUICK_BUILD.md` for additional features.

