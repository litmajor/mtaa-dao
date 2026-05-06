# Phase 6 Event Broadcasting Examples

## Quick Reference: How to Broadcast Real-Time Events

This document provides copy-paste examples for adding real-time event broadcasting to your services.

---

## 1. Configuration Change Notification

When a user updates configuration (Elder, Agent, etc.):

```typescript
// In your service or route handler
import { Request, Response } from 'express';

export async function updateEldersConfiguration(req: Request, res: Response) {
  try {
    const { entityId } = req.params;
    const { config } = req.body;
    
    // 1. Save to database
    const result = await db.update(/* ... */);
    
    // 2. Get WebSocket service
    const wsService = req.app.locals.wsService;
    
    // 3. Broadcast the change
    wsService.notifyConfigurationChange({
      entityType: 'elder',
      entityId,
      versionNumber: result.version || 1,
      changedFields: Object.keys(config), // ['permissions', 'status']
      changeReason: 'Configuration updated via API',
      configuration: result
    });
    
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
```

---

## 2. Activity Log Notification

After any significant user action:

```typescript
// In your activity logging middleware or service
export async function logActivity(
  entityType: string,
  entityId: string,
  action: string,
  details: any,
  severity: 'info' | 'warning' | 'error' = 'info'
) {
  // 1. Save to activity log
  const activity = await db.insert(activityTable).values({
    entityType,
    entityId,
    action,
    details,
    severity,
    timestamp: new Date(),
    userId: getCurrentUserId() // from context
  });
  
  // 2. Get WebSocket service
  const wsService = getWebSocketService(); // from global or DI
  
  // 3. Broadcast the activity
  wsService.notifyActivity({
    entityType,
    entityId,
    action,
    details,
    severity,
    user: getCurrentUser(),
    timestamp: activity.timestamp
  });
  
  return activity;
}
```

Usage in a route:
```typescript
router.post('/elder/:id/update', async (req, res) => {
  // Do update logic...
  
  // Log the activity
  await logActivity('elder', req.params.id, 'configuration_updated', {
    oldValue: oldConfig,
    newValue: newConfig
  }, 'info');
  
  res.json({ success: true });
});
```

---

## 3. Alert Notification

When something critical happens:

```typescript
// When alert conditions are met
export async function triggerAlert(
  entityType: string,
  entityId: string,
  alertType: string,
  message: string,
  severity: 'critical' | 'high' | 'medium' | 'low'
) {
  // 1. Save alert to database
  const alert = await db.insert(alertsTable).values({
    entityType,
    entityId,
    alertType,
    message,
    severity,
    timestamp: new Date(),
    resolved: false
  });
  
  // 2. Get WebSocket service
  const wsService = req.app.locals.wsService;
  
  // 3. Broadcast to all connected clients
  wsService.notifyAlert({
    entityType,
    entityId,
    alertType,
    message,
    severity,
    timestamp: alert.timestamp
  });
  
  return alert;
}

// Example usage:
export async function processPayment(paymentId: string) {
  try {
    const result = await blockchainService.process(paymentId);
    
    // Notify success
    await triggerAlert(
      'payment',
      paymentId,
      'payment_success',
      `Payment of $${result.amount} completed successfully`,
      'low'
    );
  } catch (error) {
    // Notify failure
    await triggerAlert(
      'payment',
      paymentId,
      'payment_failed',
      `Payment failed: ${error.message}`,
      'critical'
    );
  }
}
```

---

## 4. Activity Feed Notification (Same as Activity Log)

```typescript
// Use the same notifyActivity call for activity feed updates
wsService.notifyActivity({
  entityType: 'elder',
  entityId: 'kaizen',
  action: 'permissions_updated',
  details: { from: 'view', to: 'admin' },
  severity: 'info',
  user: currentUser,
  timestamp: new Date()
});
```

---

## 5. Presence Update Notification

When a user joins/leaves a section:

```typescript
// In your authentication or page navigation
export function updateUserPresence(
  userId: string,
  section: string,
  action: 'viewing' | 'editing' | 'searching'
) {
  const wsService = req.app.locals.wsService;
  
  wsService.notifyPresence({
    userId,
    section,
    action,
    email: currentUser.email,
    timestamp: new Date()
  });
}

// Usage in API:
router.post('/user/presence', (req, res) => {
  const { section, action } = req.body;
  const userId = getCurrentUserId();
  
  updateUserPresence(userId, section, action);
  
  res.json({ success: true });
});
```

---

## 6. Search Results Notification

When search is completed:

```typescript
export async function performSearch(
  query: string,
  filters: any
) {
  // 1. Run search
  const results = await searchService.search(query, filters);
  
  // 2. Get WebSocket service
  const wsService = req.app.locals.wsService;
  
  // 3. Broadcast results
  wsService.notifySearchResults({
    query,
    filters,
    results: results.items,
    total: results.count,
    timestamp: new Date()
  });
  
  return results;
}
```

---

## 7. Analytics/Metrics Update

Send live metrics to dashboard:

```typescript
export async function updateAnalyticsMetrics() {
  // 1. Calculate metrics
  const metrics = {
    totalConfigurations: await getConfigCount(),
    configurationsChanged24h: await getRecentChanges(),
    activeUsers: await getActiveUserCount(),
    averageLatency: await getAverageLatency(),
    systemHealth: await getSystemHealth()
  };
  
  // 2. Get WebSocket service
  const wsService = app.locals.wsService;
  
  // 3. Broadcast metrics
  wsService.notifyAnalyticsUpdate({
    metricType: 'system_dashboard',
    metrics,
    period: 'real-time',
    timestamp: new Date()
  });
  
  return metrics;
}
```

Usage in a scheduled job:
```typescript
// In a cron job or scheduled task
setInterval(async () => {
  await updateAnalyticsMetrics();
}, 5000); // Every 5 seconds
```

---

## 8. Status Change Notification

When entity status changes:

```typescript
export async function changeEntityStatus(
  entityType: string,
  entityId: string,
  newStatus: string
) {
  // 1. Update database
  const result = await db.update(/* ... */).set({ status: newStatus });
  
  // 2. Get WebSocket service
  const wsService = req.app.locals.wsService;
  
  // 3. Broadcast change
  wsService.notifyStatusChange({
    entityType,
    entityId,
    status: newStatus,
    timestamp: new Date()
  });
  
  return result;
}
```

---

## 9. Approval Request Notification

When approval is needed:

```typescript
export async function requestApproval(
  entityType: string,
  entityId: string,
  requestType: string
) {
  // 1. Create approval request
  const approval = await db.insert(approvalsTable).values({
    entityType,
    entityId,
    requestType,
    status: 'pending',
    createdAt: new Date()
  });
  
  // 2. Get WebSocket service
  const wsService = req.app.locals.wsService;
  
  // 3. Broadcast request
  wsService.notifyApprovalRequest({
    entityType,
    entityId,
    requestType,
    requiredApprovals: 2,
    currentApprovals: 0,
    timestamp: approval.createdAt
  });
  
  return approval;
}
```

---

## 10. Bulk Operation Notification

When bulk operations complete:

```typescript
export async function bulkUpdateConfigurations(updates: any[]) {
  const wsService = req.app.locals.wsService;
  
  let successful = 0;
  let failed = 0;
  
  for (const update of updates) {
    try {
      await db.update(/* ... */).set(update);
      successful++;
    } catch (error) {
      failed++;
      
      // Broadcast failure
      wsService.notifyBulkOperation({
        operationType: 'bulk_update',
        total: updates.length,
        successful,
        failed,
        status: 'in_progress',
        timestamp: new Date()
      });
    }
  }
  
  // Broadcast completion
  wsService.notifyBulkOperation({
    operationType: 'bulk_update',
    total: updates.length,
    successful,
    failed,
    status: 'completed',
    timestamp: new Date()
  });
}
```

---

## Complete Example: Configuration Update Endpoint

```typescript
// routes/admin/configuration.ts
import express from 'express';
import { authenticate } from '@/middleware/auth';

const router = express.Router();

router.put('/elder/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { config } = req.body;
    
    // 1. Validate
    if (!id || !config) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    // 2. Get old config for comparison
    const oldConfig = await getEldersConfig(id);
    
    // 3. Update in database
    const result = await db
      .update(eldersTable)
      .set({ config })
      .where(eq(eldersTable.id, id));
    
    // 4. Get WebSocket service
    const wsService = req.app.locals.wsService;
    
    // 5. Find what changed
    const changedFields = Object.keys(config).filter(
      key => JSON.stringify(config[key]) !== JSON.stringify(oldConfig[key])
    );
    
    // 6. Broadcast configuration change
    wsService.notifyConfigurationChange({
      entityType: 'elder',
      entityId: id,
      versionNumber: 1,
      changedFields,
      changeReason: `Updated by ${req.user?.email}`,
      configuration: config
    });
    
    // 7. Log activity
    await logActivity(
      'elder',
      id,
      'configuration_updated',
      {
        changedFields,
        oldConfig: oldConfig,
        newConfig: config
      },
      'info'
    );
    
    // 8. Return success
    res.json({
      success: true,
      message: `Elder '${id}' configuration updated`,
      data: result
    });
    
  } catch (error) {
    console.error('Error updating configuration:', error);
    res.status(500).json({
      error: error.message || 'Internal server error'
    });
  }
});

export default router;
```

---

## Helper Function: Get WebSocket Service

Instead of repeating `req.app.locals.wsService`, create a helper:

```typescript
// utils/websocket.ts
import { Request } from 'express';

export function getWebSocketService(req: Request) {
  const wsService = req.app.locals.wsService;
  if (!wsService) {
    throw new Error('WebSocket service not initialized');
  }
  return wsService;
}

// Usage in your service:
const wsService = getWebSocketService(req);
wsService.notifyAlert({ /* ... */ });
```

---

## Broadcasting Strategy

### Rule 1: Broadcast After Success
```typescript
// ❌ Wrong: Broadcast before saving
wsService.notifyAlert({ /* ... */ });
await db.insert(/* ... */);

// ✅ Correct: Broadcast after saving
await db.insert(/* ... */);
wsService.notifyAlert({ /* ... */ });
```

### Rule 2: Use Correct Room
```typescript
// ❌ Wrong: Broadcast to everyone
wsService.broadcastToAll({ /* ... */ });

// ✅ Correct: Broadcast to specific room
wsService.notifyConfigurationChange({ /* ... */ });
// Clients listen via useRealtimeConfig('elder', 'kaizen')
```

### Rule 3: Include Enough Context
```typescript
// ❌ Wrong: Too vague
wsService.notifyActivity({
  action: 'updated'
});

// ✅ Correct: Include full context
wsService.notifyActivity({
  entityType: 'elder',
  entityId: 'kaizen',
  action: 'permissions_updated',
  details: { from: 'view', to: 'admin' },
  severity: 'info',
  user: currentUser,
  timestamp: new Date()
});
```

### Rule 4: Avoid Duplicate Broadcasts
```typescript
// ❌ Wrong: Broadcasting same event twice
wsService.notifyActivity({ /* ... */ });
wsService.notifyConfigurationChange({ /* ... */ }); // Same event

// ✅ Correct: Choose the right notification type
wsService.notifyConfigurationChange({ /* ... */ }); // More specific
```

---

## Testing Your Broadcasts

### Test in Browser Console
```javascript
// Open DevTools on admin page
// Network tab should show socket.io messages

// Trigger an alert from console:
socket.emit('alert', {
  severity: 'critical',
  message: 'Test alert',
  timestamp: new Date().toISOString()
});

// Should see toast notification appear
```

### Test via API Call
```bash
# Make an API call that triggers a broadcast
curl -X PUT http://localhost:3001/api/admin/elder/kaizen \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"config": {"status": "active"}}'

# Watch admin dashboard for real-time update
```

---

## Common Mistakes

1. **Forgetting to broadcast**
   - After update, always call wsService.notify*()

2. **Wrong entity ID**
   - Make sure entityId matches the actual ID

3. **Not using 'use client' in components**
   - Components using hooks must have 'use client' directive

4. **Broadcasting before saving**
   - Always broadcast after database update succeeds

5. **Broadcasting to wrong room**
   - Each notification type has specific room naming

---

## Performance Tips

1. **Batch events**: Don't broadcast too frequently
   ```typescript
   // ❌ Not ideal: Every single change
   items.forEach(item => wsService.notifyActivity({ /* ... */ }));
   
   // ✅ Better: Aggregate updates
   wsService.notifyBulkOperation({
     total: items.length,
     successful: items.filter(i => i.success).length
   });
   ```

2. **Limit detail**: Send only necessary information
   ```typescript
   // ❌ Too much data
   wsService.notifyActivity({
     ...entireDatabaseRecord
   });
   
   // ✅ Just what changed
   wsService.notifyActivity({
     entityType, entityId, action, details, severity
   });
   ```

3. **Use appropriate frequency**: Don't overwhelm clients
   ```typescript
   // Update metrics every 5 seconds, not every second
   setInterval(() => updateMetrics(), 5000);
   ```

---

This guide should cover 95% of your real-time broadcasting needs. For advanced scenarios, see the comprehensive Phase 6 documentation.

Good luck! 🚀
