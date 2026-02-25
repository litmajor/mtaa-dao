# Enhanced Feature Tracking System - Complete Reference

## Overview

The Enhanced Feature Tracking System provides comprehensive feature management capabilities including:

- ✅ **Per-User Access Control** - Determine if users can access features
- ✅ **Usage Analytics** - Track feature adoption and usage patterns
- ✅ **A/B Testing** - Rollout features to percentage of users
- ✅ **Beta Access Management** - Time-limited beta programs
- ✅ **Dependency Resolution** - Features can depend on other features
- ✅ **Admin Controls** - Special privileges for administrators
- ✅ **Access Logging** - Audit trail of all feature accesses
- ✅ **Redis Caching** - High-performance distributed caching

## Architecture

### Services

#### `EnhancedFeatureService` (`server/services/enhancedFeatureService.ts`)

Main service implementing all feature management logic:

```typescript
// Check feature access
const { allowed, reason } = await enhancedFeatureService.canUserAccessFeature(
  userId,
  featureKey,
  dependencies // optional
);

// Track usage
await enhancedFeatureService.trackFeatureUsage(userId, featureKey, metadata);

// Grant beta access
await enhancedFeatureService.grantBetaAccess(userId, featureKey, expiresAt);

// Get analytics
const analytics = await enhancedFeatureService.getFeatureAnalytics(featureKey);

// Get user's accessible features
const features = await enhancedFeatureService.getUserAccessibleFeatures(userId);

// Set A/B test rollout
await enhancedFeatureService.setFeatureRollout(featureKey, percentage);
```

### API Routes

#### Feature Access Routes (`server/routes/featureAnalytics.ts`)

**GET** `/api/features/user/accessible`
- Get all features accessible to current user
- Requires authentication
- Returns: Array of feature keys and metadata

**GET** `/api/features/check/:featureKey`
- Check if current user has access to specific feature
- Requires authentication
- Returns: `{ allowed: boolean, reason: string }`

**POST** `/api/features/track/:featureKey`
- Track feature usage
- Requires authentication
- Body: `{ metadata?: Record<string, any> }`

**GET** `/api/features/analytics/:featureKey`
- Get usage analytics for feature
- Returns: Usage statistics, unique users, averages

**POST** `/api/features/beta/grant`
- Grant beta access to user (admin only)
- Body: `{ userId, featureKey, expiresAt? }`

**DELETE** `/api/features/beta/revoke`
- Revoke beta access (admin only)
- Body: `{ userId, featureKey }`

**POST** `/api/features/rollout`
- Set A/B test rollout percentage (admin only)
- Body: `{ featureKey, percentage: 0-100 }`

## Configuration

### Environment Variables

No special environment variables required. System uses existing Redis configuration:
- `REDIS_URL` - Redis connection string (optional, falls back to in-memory)

### Feature Definition Structure

Each feature has:

```typescript
{
  key: string;           // Unique identifier
  name: string;          // Display name
  description: string;   // What it does
  enabled: boolean;      // Is feature active?
  tier?: string;         // 'free' | 'pro' | 'enterprise'
  dependencies?: string[];  // Other features required
  rolloutPercentage?: number; // 0-100 for A/B testing
}
```

## Usage Examples

### 1. Frontend - Check Feature Access

```typescript
// In React component
const [hasAccess, setHasAccess] = useState(false);

useEffect(() => {
  const checkAccess = async () => {
    const response = await fetch('/api/features/check/advanced-analytics', {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    const data = await response.json();
    setHasAccess(data.allowed);
  };

  checkAccess();
}, []);

return hasAccess ? <AdvancedAnalytics /> : <div>Feature not available</div>;
```

### 2. Track Feature Usage

```typescript
// When user interacts with feature
const trackUsage = async (featureKey: string, action: string) => {
  await fetch(`/api/features/track/${featureKey}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({
      metadata: {
        action,
        timestamp: new Date(),
        sessionDuration: 1234, // ms
      },
    }),
  });
};

// Usage
trackUsage('dashboard', 'viewed_overview');
```

### 3. Backend - Access Control in Routes

```typescript
import { enhancedFeatureService } from '../services/enhancedFeatureService';

app.get('/api/advanced-data', authenticate, async (req, res) => {
  const userId = req.user.id;
  const { allowed, reason } = await enhancedFeatureService.canUserAccessFeature(
    userId,
    'advanced-analytics'
  );

  if (!allowed) {
    return res.status(403).json({
      success: false,
      error: reason,
    });
  }

  // Feature is accessible
  // ... serve advanced data
});
```

### 4. Admin - Grant Beta Access

```typescript
// Grant 30-day beta access
const expiresAt = new Date();
expiresAt.setDate(expiresAt.getDate() + 30);

const response = await fetch('/api/features/beta/grant', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${adminToken}`,
  },
  body: JSON.stringify({
    userId: 'user-123',
    featureKey: 'ai-recommendations',
    expiresAt: expiresAt.toISOString(),
  }),
});
```

### 5. Admin - A/B Testing

```typescript
// Roll out to 25% of users
const response = await fetch('/api/features/rollout', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${adminToken}`,
  },
  body: JSON.stringify({
    featureKey: 'new-ui',
    percentage: 25, // 25% of users
  }),
});

// Later, increase to 50%
// Later, increase to 100%
// Or rollback to 0%
```

## Feature Gating Decisions

The `canUserAccessFeature()` method returns access based on:

1. **Feature Enabled Check** - Is the feature globally enabled?
2. **Admin Override** - Does user have admin role?
3. **Tier Check** - Does user's tier meet requirement?
4. **Beta Access** - Does user have active beta access?
5. **Rollout Check** - Is user in rollout percentage?
6. **Dependency Check** - Do all dependencies exist?

```
allowed = 
  (featureEnabled OR userIsAdmin) AND
  (featureHasNoTier OR userTierMeetRequirement) AND
  (noBetaAccess OR (betaAccess AND notExpired)) AND
  (rolloutPercentage === 100 OR userHashFallsWithinPercentage) AND
  (noDependencies OR allDependenciesMet)
```

## Analytics Data Collected

For each feature usage:

- **User ID** - Who used the feature
- **Feature Key** - Which feature
- **Timestamp** - When it was used
- **Metadata** - Custom data (action, duration, etc.)
- **Session ID** - Which session

Aggregated metrics:

- Total usage count
- Unique users
- Usage by day
- Usage by user
- Average usage per user
- Peak usage time
- First/last access times

## Performance Considerations

### Redis Caching

When Redis is available:
- Beta access info cached for 1 hour
- Analytics cached for 5 minutes
- A/B test assignments cached for 24 hours
- User accessible features cached for 10 minutes

### In-Memory Fallback

System falls back to in-memory storage if Redis is unavailable:
- All data still tracked
- No distributed persistence
- Perfect for single-instance deployments

### Optimization Tips

1. **Batch feature checks** - Check multiple features in one request
2. **Cache client-side** - Cache feature access for 1-5 minutes in frontend
3. **Use analytics judiciously** - Track key actions, not every action
4. **Limit metadata size** - Keep metadata JSON small (<1KB)

## Dashboard

Admin dashboard available at: (needs route in app)

```tsx
import FeatureManagementDashboard from '../components/FeatureManagementDashboard';

// In admin pages
<FeatureManagementDashboard />
```

Features:

- View all features
- See per-feature analytics
- Grant/revoke beta access
- Adjust rollout percentages
- Monitor feature adoption

## Debugging

### Check Feature Status

```bash
curl -H "Authorization: Bearer TOKEN" \
  http://localhost:5000/api/features/check/feature-key
```

### Get Feature Analytics

```bash
curl http://localhost:5000/api/features/analytics/feature-key
```

### Track Usage

```bash
curl -X POST -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"metadata": {"action": "test"}}' \
  http://localhost:5000/api/features/track/feature-key
```

## Next Steps

1. **Integrate with Auth System** - Map user roles/tiers to feature access
2. **Create Dashboard Route** - Add feature management to admin panel
3. **Update Existing Features** - Add feature checks to sensitive endpoints
4. **Set Up Monitoring** - Alert on unusual usage patterns
5. **Document Feature List** - Maintain list of all 114 features with tiers

## Type Safety

Full TypeScript support with types defined in:
- `server/types/features.ts` - All type definitions

Key types:
- `FeatureDefinition` - Feature configuration
- `UserFeatureAccess` - Per-user access state
- `FeatureAnalytics` - Analytics data
- `FeatureAccessCheckResult` - Access check result
- `BetaAccessGrant` - Beta program entry
- `FeatureUsageEvent` - Analytics event

## Migration from Basic System

The basic feature service (`featureService.ts`) is still available and contains:
- 114 predefined features
- Basic enable/disable functionality
- Tier requirements

The enhanced service (`enhancedFeatureService.ts`) provides:
- All basic features plus...
- Per-user access tracking
- Comprehensive analytics
- A/B testing
- Beta access management
- Dependency resolution

You can run both in parallel during migration:

```typescript
import { featureService } from './services/featureService';
import { enhancedFeatureService } from './services/enhancedFeatureService';

// Use enhanced for new code
// Use basic for backward compatibility
```

## Troubleshooting

**Feature access always denied?**
- Check if feature is enabled globally
- Verify user is not in blacklist
- Check dependency features exist
- Verify rollout percentage > 0

**Analytics not showing?**
- Ensure `/api/features/track` is being called
- Check Redis connection (if using)
- Verify user has tracking permissions

**A/B test not working?**
- Ensure rollout percentage is set
- Check user ID hashing is consistent
- Verify users are in correct percentage

**Performance issues?**
- Enable Redis for distributed caching
- Reduce analytics retention period
- Batch feature checks on frontend
- Consider CDN for feature flag delivery

---

**Last Updated:** 2024
**Version:** 1.0 Enhanced
**Status:** Production Ready
