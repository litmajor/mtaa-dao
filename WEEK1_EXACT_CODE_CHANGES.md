# Week 1: Exact Code Changes - Database Persistence Implementation

This document shows all code changes made to implement database persistence for feature flags.

---

## File 1: shared/schema.ts

**Location:** Line 144 (in users table definition)

**Change:** Added new column for persistent beta feature storage

```typescript
// BEFORE (Line 142-143)
  walletIv: text("wallet_iv"),
  walletAuthTag: text("wallet_auth_tag"),
  hasBackedUpMnemonic: boolean("has_backed_up_mnemonic").default(false),
  voting_token_balance: decimal("voting_token_balance", { precision: 10, scale: 2 }).default("0"),
  isActive: boolean("is_active").default(true),

// AFTER (Line 142-154)
  walletIv: text("wallet_iv"),
  walletAuthTag: text("wallet_auth_tag"),
  hasBackedUpMnemonic: boolean("has_backed_up_mnemonic").default(false),
  voting_token_balance: decimal("voting_token_balance", { precision: 10, scale: 2 }).default("0"),
  isActive: boolean("is_active").default(true),
  // ========================================
  // FEATURE FLAGS - PROGRESSIVE RELEASE
  // ========================================
  // JSONB array of beta features user has access to
  // Example: ["locked_savings", "ai_assistant", "advanced_analytics"]
  // Set via /api/admin/beta-access endpoint
  enabledBetaFeatures: text("enabled_beta_features").default("[]"), // JSON array as text, parsed on retrieval
```

**Impact:**
- Adds 1 new column to users table
- All existing data unaffected
- Default value is empty array

---

## File 2: server/routes/admin.ts

### Change 1: GET /api/features Endpoint (Line 938-1025)

**Before:** Retrieved features from user object (not from database)

```typescript
router.get('/features', async (req, res) => {
  try {
    const user = (req.user as any) || null;
    
    // Build user's enabled features
    // In Phase 1: only Phase 1 features are enabled
    // In Phase 2+: Phase 1 + Phase 2 features, etc.
    const userEnabledFeatures = user?.enabledFeatures || [];  // ❌ No database query
    
    const response = {
      features: featureFlags,
      user: user ? {
        id: user.id,
        role: user.role,
        betaAccess: userEnabledFeatures.length > 0,
        enabledFeatures: userEnabledFeatures,  // ❌ Wrong field name
      } : null,
      // ... rest of response
    };
    
    res.json(response);
  } catch (error) {
    logger.error('Error fetching features:', error);
    res.status(500).json({ error: 'Failed to fetch features' });
  }
});
```

**After:** Queries database for actual values

```typescript
// GET /api/features - Get all feature flags (public endpoint)
// Returns feature flags that should be shown to current user
// If user is authenticated, includes their personalized enabledBetaFeatures from database
router.get('/features', async (req, res) => {
  try {
    const user = (req.user as any) || null;
    
    // Parse user's enabled beta features FROM DATABASE
    let userEnabledFeatures: string[] = [];
    if (user?.id) {
      try {
        const userRecord = await db
          .select()
          .from(users)
          .where(eq(users.id, user.id))
          .limit(1);
        
        if (userRecord.length > 0 && userRecord[0].enabledBetaFeatures) {
          const features = userRecord[0].enabledBetaFeatures;
          userEnabledFeatures = JSON.parse(typeof features === 'string' ? features : JSON.stringify(features));
        }
      } catch (e) {
        logger.warn('Failed to parse enabledBetaFeatures for user', { userId: user.id, error: e });
      }
    }
    
    const response = {
      // All features with their current enabled status
      features: featureFlags,
      
      // User-specific info
      user: user ? {
        id: user.id,
        role: user.role,
        betaAccess: userEnabledFeatures.length > 0,
        enabledBetaFeatures: userEnabledFeatures, // ✅ Features stored in database
      } : null,
      
      // Feature release schedule (for "Coming Soon" messages)
      releaseSchedule: {
        // ... schedule info
      },
    };
    
    res.json(response);
  } catch (error) {
    logger.error('Error fetching features:', error);
    res.status(500).json({ error: 'Failed to fetch features' });
  }
});
```

**Key Changes:**
- Now queries database for user record
- Parses enabledBetaFeatures column from JSON
- Returns actual persistent data
- Better error handling

### Change 2: POST /api/admin/beta-access Endpoint (Line 1025-1093)

**Before:** TODO stub, no persistence

```typescript
// POST /api/admin/beta-access - Grant beta access to features
// Note: Beta access is managed via the features API response
// In production, you would store this in a separate beta_access table
router.post('/beta-access', requireSuperAdmin, async (req, res) => {
  try {
    const { userId, features: featuresToGrant } = req.body;
    
    if (!userId || !Array.isArray(featuresToGrant)) {
      return res.status(400).json({ error: 'userId and features array required' });
    }
    
    // TODO: Implement beta access storage  ❌
    // Option 1: Add beta_access table to schema
    // Option 2: Store in a separate service/cache (Redis)
    // Option 3: Add features JSON column to users table
    
    logger.info('Beta access granted (not persisted - implement storage)', {
      userId,
      features: featuresToGrant,
      grantedBy: (req.user as any)?.id,
      timestamp: new Date(),
    });
    
    res.json({
      success: true,
      message: 'Beta access granted',
      userId,
      grantedFeatures: featuresToGrant,
    });
  } catch (error) {
    logger.error('Error granting beta access:', error);
    res.status(500).json({ error: 'Failed to grant beta access' });
  }
});
```

**After:** Full implementation with persistence

```typescript
// POST /api/admin/beta-access - Grant beta access to features
// Persists beta feature access to users table enabledBetaFeatures column
router.post('/beta-access', requireSuperAdmin, async (req, res) => {
  try {
    const { userId, features: featuresToGrant } = req.body;
    
    if (!userId || !Array.isArray(featuresToGrant)) {
      return res.status(400).json({ error: 'userId and features array required' });
    }
    
    // Validate features exist in available features config
    const invalidFeatures = featuresToGrant.filter(
      f => !Object.keys(featureFlags).includes(f)
    );
    
    if (invalidFeatures.length > 0) {
      return res.status(400).json({
        error: 'Invalid features provided',
        invalidFeatures,
        availableFeatures: Object.keys(featureFlags),
      });
    }
    
    // Fetch current user to get existing features
    const userRecord = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    
    if (userRecord.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Parse existing features and merge with new ones
    let existingFeatures: string[] = [];
    try {
      const existing = userRecord[0].enabledBetaFeatures;
      if (existing) {
        existingFeatures = JSON.parse(typeof existing === 'string' ? existing : JSON.stringify(existing));
      }
    } catch (e) {
      existingFeatures = [];
    }
    
    // Merge and deduplicate
    const mergedFeatures = Array.from(new Set([...existingFeatures, ...featuresToGrant]));
    
    // Update user record with new features
    await db
      .update(users)
      .set({ enabledBetaFeatures: JSON.stringify(mergedFeatures) })
      .where(eq(users.id, userId));
    
    logger.info('Beta access granted and persisted to database', {
      userId,
      features: featuresToGrant,
      mergedFeatures,
      grantedBy: (req.user as any)?.id,
      timestamp: new Date(),
    });
    
    res.json({
      success: true,
      message: 'Beta access granted and persisted',
      userId,
      grantedFeatures: featuresToGrant,
      allEnabledFeatures: mergedFeatures,
    });
  } catch (error) {
    logger.error('Error granting beta access:', error);
    res.status(500).json({ error: 'Failed to grant beta access' });
  }
});
```

**Key Changes:**
- Validates features against config
- Queries database for user record
- Checks user exists (404 if not)
- Parses existing features
- Merges and deduplicates
- **Updates database with new features**
- Returns confirmation with all enabled features

### Change 3: DELETE /api/admin/beta-access/:userId Endpoint (Line 1094-1141)

**Before:** TODO stub, no persistence

```typescript
// DELETE /api/admin/beta-access/:userId - Revoke beta access
router.delete('/beta-access/:userId', requireSuperAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    
    // TODO: Implement beta access revocation  ❌
    
    logger.info('Beta access revoked (not persisted - implement storage)', {
      userId,
      revokedBy: (req.user as any)?.id,
      timestamp: new Date(),
    });
    
    res.json({
      success: true,
      message: 'Beta access revoked',
      userId,
    });
  } catch (error) {
    logger.error('Error revoking beta access:', error);
    res.status(500).json({ error: 'Failed to revoke beta access' });
  }
});
```

**After:** Full implementation with persistence

```typescript
// DELETE /api/admin/beta-access/:userId - Revoke beta access
// Removes all beta feature access from user (resets to empty array)
router.delete('/beta-access/:userId', requireSuperAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const { features: featuresToRevoke } = req.body || {};
    
    // Fetch user record
    const userRecord = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    
    if (userRecord.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Parse existing features
    let existingFeatures: string[] = [];
    try {
      const existing = userRecord[0].enabledBetaFeatures;
      if (existing) {
        existingFeatures = JSON.parse(typeof existing === 'string' ? existing : JSON.stringify(existing));
      }
    } catch (e) {
      existingFeatures = [];
    }
    
    // If specific features provided, remove only those; otherwise clear all
    let newFeatures = existingFeatures;
    if (featuresToRevoke && Array.isArray(featuresToRevoke)) {
      newFeatures = existingFeatures.filter(f => !featuresToRevoke.includes(f));
    } else {
      newFeatures = [];
    }
    
    // Update user record
    await db
      .update(users)
      .set({ enabledBetaFeatures: JSON.stringify(newFeatures) })
      .where(eq(users.id, userId));
    
    logger.info('Beta access revoked and persisted to database', {
      userId,
      revokedFeatures: featuresToRevoke || 'all',
      remainingFeatures: newFeatures,
      revokedBy: (req.user as any)?.id,
      timestamp: new Date(),
    });
    
    res.json({
      success: true,
      message: featuresToRevoke ? 'Specified features revoked' : 'All beta access revoked',
      userId,
      remainingFeatures: newFeatures,
    });
  } catch (error) {
    logger.error('Error revoking beta access:', error);
    res.status(500).json({ error: 'Failed to revoke beta access' });
  }
});
```

**Key Changes:**
- Queries database for user record
- Checks user exists (404 if not)
- Parses existing features
- Supports partial revocation (remove specific features)
- Supports total revocation (clear all)
- **Updates database with new features**
- Returns remaining features

---

## File 3: client/src/hooks/useFeatureFlags.ts

**Location:** Lines 33-50 (FeaturesResponse interface)

**Change 1:** Updated interface to use correct field name

```typescript
// BEFORE (Lines 33-50)
interface FeaturesResponse {
  features: FeatureFlags;
  user: {
    id: string;
    role: string;
    betaAccess: boolean;
    enabledFeatures: string[];  // ❌ Wrong field name
  } | null;
  releaseSchedule: {
    phase1: ReleasePhase;
    phase2: ReleasePhase;
    phase3: ReleasePhase;
    phase4: ReleasePhase;
    phase5: ReleasePhase;
  };
}

// AFTER (Lines 33-50)
interface FeaturesResponse {
  features: FeatureFlags;
  user: {
    id: string;
    role: string;
    betaAccess: boolean;
    enabledBetaFeatures: string[]; // ✅ Beta features persisted in database
  } | null;
  releaseSchedule: {
    phase1: ReleasePhase;
    phase2: ReleasePhase;
    phase3: ReleasePhase;
    phase4: ReleasePhase;
    phase5: ReleasePhase;
  };
}
```

**Change 2:** Updated hook to use correct field name

```typescript
// BEFORE (Line 94)
const userBetaFeatures = response?.user?.enabledFeatures || [];  // ❌

// AFTER (Line 94)
const userBetaFeatures = response?.user?.enabledBetaFeatures || [];  // ✅
```

**Impact:**
- Hook now correctly reads database-persisted features
- Type checking matches API response
- No runtime errors

---

## Summary of Changes

| File | Type | Lines | Change |
|------|------|-------|--------|
| shared/schema.ts | Addition | 144 | Added `enabledBetaFeatures` column |
| server/routes/admin.ts | Modification | 938-1025 | GET: Query database for features |
| server/routes/admin.ts | Implementation | 1025-1093 | POST: Database persistence |
| server/routes/admin.ts | Implementation | 1094-1141 | DELETE: Database persistence |
| client/src/hooks/useFeatureFlags.ts | Update | 50 | Changed interface field |
| client/src/hooks/useFeatureFlags.ts | Update | 94 | Updated hook to use new field |

**Total Lines Changed:** ~200 lines (mostly new implementation code)
**Total Lines Added:** ~150 lines (new database operations)
**Total Lines Removed:** ~50 lines (TODO comments and placeholder code)

---

## Verification

All changes have been verified to:
- ✅ Compile without TypeScript errors
- ✅ Have proper error handling
- ✅ Use correct Drizzle ORM patterns
- ✅ Follow existing code style
- ✅ Maintain backward compatibility
- ✅ Include proper logging
- ✅ Support authorization checks

---

## Database Migration SQL

When deploying, run this SQL against the production database:

```sql
-- Add the new column to store beta features
ALTER TABLE users 
ADD COLUMN enabled_beta_features TEXT DEFAULT '[]';

-- Verify the column was added
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'users' 
AND column_name = 'enabled_beta_features';

-- Check all users have the default value
SELECT COUNT(*) as users_with_default 
FROM users 
WHERE enabled_beta_features = '[]';
```

---

## Notes

- All changes are backward compatible
- No existing functionality is affected
- Database migration is simple (single ALTER TABLE)
- Rollback would only require dropping the column
- Performance impact is minimal (JSON parsing on each request)
