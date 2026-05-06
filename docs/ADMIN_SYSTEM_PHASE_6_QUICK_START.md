# Phase 6: WebSocket Real-Time Integration - Quick Start Guide

## 🚀 Get Real-Time Features Running in 5 Minutes

This guide walks you through implementing real-time notifications and live updates in your admin system.

---

## 📍 What You Get

✅ **Real-time notifications** via toast system
✅ **Live activity feed** showing all changes
✅ **User presence** indicators
✅ **Live metrics** updates
✅ **Configuration change** alerts
✅ **Collaborative** editing awareness

---

## 🔧 Setup (2 minutes)

### 1. Install Dependencies
```bash
npm install socket.io socket.io-client
npm install date-fns
```

### 2. Initialize WebSocket Server
In your main Express server file:

```typescript
import http from 'http';
import express from 'express';
import WebSocketManager from '@/server/websocket/websocket';
import WebSocketEventService from '@/server/websocket/websocket-events';

const app = express();
const httpServer = http.createServer(app);

// Initialize WebSocket
const wsManager = new WebSocketManager(httpServer);
const wsService = new WebSocketEventService(wsManager);

// Make available globally or via dependency injection
app.locals.wsService = wsService;

httpServer.listen(3001, () => {
  console.log('Server with WebSocket running on port 3001');
});
```

### 3. Add WebSocket URL to Environment
```env
NEXT_PUBLIC_WS_URL=http://localhost:3001
```

---

## 💻 Use in Your App (3 minutes)

### Add to Root Layout
```typescript
// app/layout.tsx
import NotificationsToast from '@/components/notifications-toast';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html>
      <body>
        {/* Add real-time notification system */}
        <NotificationsToast />
        
        {children}
      </body>
    </html>
  );
}
```

### Add to Dashboard Page
```typescript
// app/admin/dashboard/page.tsx
import PresenceIndicator from '@/components/presence-indicator';
import ActivityFeed from '@/components/activity-feed';
import LiveMetrics from '@/components/live-metrics';

export default function Dashboard() {
  return (
    <div>
      {/* Show who's online */}
      <PresenceIndicator section="dashboard" />

      {/* Show live metrics */}
      <LiveMetrics />

      {/* Show activity stream */}
      <ActivityFeed maxItems={50} />
    </div>
  );
}
```

### Add to Configuration Editor
```typescript
// app/admin/config/[id]/page.tsx
import ConfigChangeAlert from '@/components/config-change-alert';

export default function ConfigEditor({ params }: { params: { id: string } }) {
  const handleRefresh = () => {
    // Reload configuration from server
    location.reload();
  };

  return (
    <div>
      {/* Alert if someone else modifies config */}
      <ConfigChangeAlert
        entityType="elder"
        entityId={params.id}
        onRefresh={handleRefresh}
      />

      {/* Your configuration editor */}
      {/* ... */}
    </div>
  );
}
```

---

## 🔄 Broadcast Events from Backend

### When Creating/Updating Configuration
```typescript
// In your configuration service
async function updateEldersConfig(entityId: string, newConfig: any) {
  // Save to database
  const result = await db.update(/* ... */);

  // Broadcast change to subscribers
  const wsService = app.locals.wsService;
  wsService.notifyConfigurationChange({
    entityType: 'elder',
    entityId,
    versionNumber: result.version,
    changedFields: ['permissions', 'status'],
    changeReason: 'Admin update',
    configuration: newConfig
  });

  return result;
}
```

### When Creating Activity Log
```typescript
// After any user action
const wsService = app.locals.wsService;
wsService.notifyActivity({
  entityType: 'elder',
  entityId: 'kaizen',
  action: 'permissions_updated',
  details: { oldValue: 'view', newValue: 'admin' },
  severity: 'info'
});
```

### When Alert Should Trigger
```typescript
// When something important happens
const wsService = app.locals.wsService;
wsService.notifyAlert({
  entityType: 'elder',
  entityId: 'kaizen',
  alertType: 'critical_change',
  message: 'Admin permissions were changed',
  severity: 'critical'
});
```

### When Updating Metrics
```typescript
// After calculating new metrics
const wsService = app.locals.wsService;
wsService.notifyAnalyticsUpdate({
  metricType: 'configuration_changes',
  metrics: {
    totalChanges: 2500,
    changesLast24h: 45,
    mostChangedField: 'status'
  },
  period: 'daily'
});
```

---

## 🎣 Use Custom Hooks

### Monitor Configuration Changes
```typescript
'use client';

import { useRealtimeConfig } from '@/hooks/useWebSocket';

export function ConfigMonitor({ entityId }: { entityId: string }) {
  const { configChange, changeTimestamp } = useRealtimeConfig('elder', entityId);

  if (configChange) {
    return (
      <div>
        Configuration changed by {configChange.changedBy}
        at {changeTimestamp?.toLocaleTimeString()}
      </div>
    );
  }

  return null;
}
```

### Track User Activity
```typescript
'use client';

import { useRealtimeActivity } from '@/hooks/useWebSocket';

export function ActivityMonitor() {
  const { activities } = useRealtimeActivity();

  return (
    <div>
      {activities.map((activity, i) => (
        <div key={i}>
          {activity.action} by {activity.user}
          at {new Date(activity.timestamp).toLocaleTimeString()}
        </div>
      ))}
    </div>
  );
}
```

### Show Active Users
```typescript
'use client';

import { useRealtimePresence } from '@/hooks/useWebSocket';

export function ActiveUsers() {
  const { presentUsers, updatePresence } = useRealtimePresence('configuration');

  // Notify when user is editing
  const handleEdit = () => {
    updatePresence('editing');
    // ... do editing ...
  };

  return (
    <div>
      <p>Active users: {presentUsers.length}</p>
      {presentUsers.map(user => (
        <div key={user.userId}>
          {user.email} ({user.action})
        </div>
      ))}
      <button onClick={handleEdit}>Edit</button>
    </div>
  );
}
```

---

## 📊 View Live Data

### See Who's Online
The **PresenceIndicator** component automatically shows:
- User avatars with initials
- What each person is doing (viewing/editing/searching)
- Total online count
- "More users" indicator if many people

### Monitor All Activity
The **ActivityFeed** component shows:
- Real-time activity as it happens
- User who made the change
- Timestamp for each action
- Click to expand and see details
- Color-coded by severity

### Track Metrics
The **LiveMetrics** component displays:
- Key numbers updating in real-time
- Change animations
- Last update timestamp
- Responsive grid layout

### Get Alerts
The **NotificationsToast** component pops up when:
- Configuration changes
- Alerts are triggered
- System events occur
- Auto-closes after 5 seconds

---

## ⚡ Common Patterns

### Pattern 1: Refresh on Change
```typescript
// Refresh data when someone else modifies it
<ConfigChangeAlert
  entityType="elder"
  entityId="kaizen"
  onRefresh={() => {
    // Reload configuration
    fetchConfig('kaizen');
  }}
/>
```

### Pattern 2: Warn Before Editing
```typescript
// Show warning if someone else is editing
const { presentUsers } = useRealtimePresence('configuration');

const isBeingEdited = presentUsers.some(u => u.action === 'editing');

if (isBeingEdited) {
  <div>Warning: Someone is currently editing this</div>
}
```

### Pattern 3: Live Updates During Search
```typescript
// Show search results as they arrive
const { searchResults, isSearching } = useRealtimeSearch();

return (
  <div>
    {isSearching && <p>🔄 Searching...</p>}
    {searchResults && <p>Found {searchResults.count} results</p>}
  </div>
);
```

### Pattern 4: Dashboard Live Feed
```typescript
// Show everything happening right now
<div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
  <PresenceIndicator section="dashboard" />
  <LiveMetrics />
  <ActivityFeed />
  <NotificationsToast />
</div>
```

---

## 🎯 Feature Checklist

After setup, you should have:

- [ ] Toast notifications appearing for alerts
- [ ] Activity feed showing real-time changes
- [ ] Presence indicator showing active users
- [ ] Live metrics updating
- [ ] Configuration change alerts
- [ ] Auto-refresh when changes detected

---

## 🔧 Customization

### Change Toast Auto-Close Time
In `client/components/notifications-toast.tsx`:
```typescript
// Auto-close after 8 seconds instead of 5
const timer = setTimeout(() => {
  closeToast(toast.id);
}, 8000); // Change this
```

### Customize Presence Section
```typescript
// Show presence for different sections
<PresenceIndicator section="configuration" />
<PresenceIndicator section="analytics" />
<PresenceIndicator section="dashboard" />
```

### Limit Activity Feed Items
```typescript
// Show only last 20 items
<ActivityFeed maxItems={20} />
```

### Filter Metrics
```typescript
// Show only analytics metrics
<LiveMetrics metricType="analytics" />
```

---

## 🐛 Troubleshooting

### Notifications Not Showing?
1. Check NEXT_PUBLIC_WS_URL is set in `.env.local`
2. Verify WebSocket server is running
3. Check browser console for errors
4. Ensure token is in localStorage
5. Try refreshing the page

### Activity Not Appearing?
1. Verify events are being broadcast from backend
2. Check room subscription is correct
3. Look in browser Network tab for WebSocket
4. Monitor server logs for event service

### Presence Not Updating?
1. Verify `updatePresence()` is being called
2. Check section name matches
3. Ensure multiple connections working
4. Test on different browser/device

### Performance Issues?
1. Reduce `maxItems` on ActivityFeed
2. Increase `refreshInterval` on LiveMetrics
3. Use `metricType` filter to narrow scope
4. Close inactive tabs/connections

---

## 📱 Mobile Considerations

All components are mobile-responsive:
- Toasts stack vertically
- Activity feed scrolls smoothly
- Presence indicators adapt to space
- Metrics grid collapses to single column
- Touch-friendly buttons

Test on mobile by:
1. Using Chrome DevTools device emulation
2. Testing on actual phone
3. Checking landscape orientation
4. Testing with slow 3G network

---

## 🔐 Security Notes

- **Token required**: WebSocket connections must have valid token
- **Permission-based**: Users can only see data they have access to
- **No sensitive data**: Don't send passwords or secrets over WebSocket
- **HTTPS only**: Always use WSS (secure WebSocket) in production

---

## 📈 Monitoring

Check these metrics:
- Connected users count (in console)
- Event frequency
- Room sizes
- Message latency
- Memory usage

Via browser DevTools:
1. Open Network tab
2. Filter by WebSocket (WS)
3. Watch messages being sent/received
4. Check message size and frequency

---

## 🎓 Next Steps

1. **Run the setup** (5 minutes)
2. **Add components** to your pages
3. **Broadcast events** from backend
4. **Test** in multiple windows
5. **Customize** colors and behavior
6. **Deploy** to production

---

**That's it! You now have a complete real-time system! 🎉**

For detailed documentation, see: [Phase 6 Complete Guide](ADMIN_SYSTEM_PHASE_6_WEBSOCKET_INTEGRATION.md)

Last Updated: 2024-01-25
Version: 1.0
