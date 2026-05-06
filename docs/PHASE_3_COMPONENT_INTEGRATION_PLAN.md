# Phase 3: Frontend Component Integration - WebSocket Real-Time Updates

**Status**: ✅ Ready to Execute  
**Scope**: Wire 6 frontend components to consume 10 backend WebSocket event streams  
**Timeline**: Aggressive (this week target)  
**Backend Status**: ✅ Complete - All 10 services emitting WebSocket events

---

## 📋 Overview

Phase 3 transforms frontend components from polling-based to real-time WebSocket-driven updates by:
1. Upgrading `useWebSocket` hook to Socket.IO (matching server implementation)
2. Creating typed event listeners for each dashboard component
3. Removing polling intervals and replacing with event subscriptions
4. Implementing optimistic UI updates and error recovery

---

## 🔄 Key Architecture Change

### Before (Polling Pattern)
```typescript
// AdminCeFiMonitoring.tsx - Current approach
setInterval(() => {
  authClient.get('/api/admin/cefi/exchanges')
    .then(data => setExchanges(data))
}, 60000); // Polls every 60 seconds
```

### After (WebSocket Pattern)
```typescript
// AdminCeFiMonitoring.tsx - Phase 3 approach
const { on } = useWebSocket();
useEffect(() => {
  on('config:changed', (data) => {
    if (data.entityType === 'exchange') {
      setExchanges(prev => updateExchangeData(prev, data));
    }
  });
}, [on]);
```

---

## 🎯 Phase 3 Component Integration Tasks

### Task 1: Upgrade useWebSocket Hook to Socket.IO
**File**: `client/src/hooks/useWebSocket.ts`  
**Current State**: Uses native WebSocket with manual message parsing  
**Target State**: Socket.IO client matching server  

**Changes**:
```typescript
// Current: WebSocket event structure
{ type: 'SUBSCRIBE', data: { eventType } }

// New: Socket.IO event pattern
socket.on('config:changed', (payload) => { ... })
socket.emit('subscribe', { eventType: 'config' })
```

**Benefits**:
- ✅ Automatic reconnection with exponential backoff
- ✅ Binary frame support for efficiency
- ✅ Server-side room management (no need to manually track subscriptions)
- ✅ Namespacing support for event organization
- ✅ Heartbeat/ping-pong built-in

---

## 🎨 6 Target Components for Phase 3

### Component 1: Admin Dashboard (`pages/admin/AdminDashboard.tsx`)
**Current Behavior**: Polling config/status data every 30-60s  
**WebSocket Events to Consume**:
- `config:changed` → Real-time configuration updates
- `status:changed` → System health/status changes
- `activity:logged` → Activity feed updates

**Update Pattern**:
```typescript
const { socket, isConnected } = useWebSocket();

useEffect(() => {
  if (!isConnected) return;
  
  socket.on('config:changed', (data) => {
    setDashboardConfig(data);
  });
  
  socket.on('status:changed', (data) => {
    setSystemStatus(data);
  });
  
  return () => {
    socket.off('config:changed');
    socket.off('status:changed');
  };
}, [socket, isConnected]);
```

---

### Component 2: Payment Monitor (`components/wallet/PendingPaymentsWidget.tsx`)
**Current Behavior**: Hard-coded or basic polling for payment status  
**WebSocket Events to Consume**:
- `activity:logged` (type: 'payment') → Payment initiated/completed
- `alert:new` (alertType: 'payment_*') → Payment failures/alerts
- `status:changed` (entityType: 'payment') → Payment state transitions

**Update Pattern**:
```typescript
socket.on('activity:logged', (data) => {
  if (data.entityType === 'payment') {
    updatePaymentList(data);
  }
});

socket.on('alert:new', (data) => {
  if (data.alertType?.includes('payment')) {
    showPaymentAlert(data);
  }
});
```

---

### Component 3: Vault Dashboard (`components/wallet/VaultDashboard.tsx`)
**Current Behavior**: Initial load only, no updates  
**WebSocket Events to Consume**:
- `activity:logged` (entityType: 'vault') → Vault deposits/withdrawals
- `status:changed` (entityType: 'vault') → Vault status changes
- `alert:new` (metadata.entityType: 'vault') → Vault-related alerts

**Update Pattern**:
```typescript
socket.on('activity:logged', (data) => {
  if (data.entityType === 'vault' && data.vaultId === selectedVaultId) {
    setVaultBalance(prev => ({
      ...prev,
      balance: data.newBalance,
      lastTransaction: data
    }));
  }
});
```

---

### Component 4: Activity Feed (`components/dashboard/RealtimeActivityFeed.tsx`)
**Current Behavior**: Exists but may not be fully populated or live  
**WebSocket Events to Consume**:
- `activity:new` → All activity events (config, vault, payment, governance)
- `activity:logged` → Detailed activity logs from services
- All event types → Stream to activity feed

**Update Pattern**:
```typescript
socket.on('activity:new', (data) => {
  setActivityFeed(prev => [data, ...prev].slice(0, 100)); // Keep last 100
});

socket.on('activity:logged', (data) => {
  setActivityFeed(prev => [...prev, data].slice(0, 100));
});
```

---

### Component 5: Alert/Notification System (`components/notifications/ToastManager.tsx`)
**Current Behavior**: May not exist or be basic  
**WebSocket Events to Consume**:
- `alert:new` → All alerts (severity: low/medium/high/critical)
- `alert:critical` → Critical alerts only

**Update Pattern**:
```typescript
socket.on('alert:new', (data) => {
  showToast({
    type: data.severity === 'critical' ? 'error' : 'warning',
    message: data.message,
    duration: data.severity === 'critical' ? 0 : 5000
  });
});

socket.on('alert:critical', (data) => {
  showCriticalAlert(data); // Persistent until dismissed
});
```

---

### Component 6: Presence Indicators (`components/dashboard/PresenceIndicators.tsx`)
**Current Behavior**: Doesn't exist or static  
**WebSocket Events to Consume**:
- `presence:updated` → User online/offline status
- `approval:changed` → Watch who's currently reviewing/approving

**Update Pattern**:
```typescript
socket.on('presence:updated', (data) => {
  setOnlineUsers(data.users);
  setUserStatuses(data.statuses);
});
```

---

## 📊 Event Stream Mapping

| Event Type | Origin Service | Components | Frequency |
|-----------|---|---|---|
| `config:changed` | Config Services | Admin Dashboard, Activity Feed | On demand |
| `activity:logged` | All services | Activity Feed, Vault Dashboard, Payment Monitor | Real-time |
| `alert:new` | All services | Alert System, Toast Manager | Real-time |
| `status:changed` | System Health, Vaults | Admin Dashboard, Alert System | Real-time |
| `approval:changed` | Governance | Admin Dashboard, Presence Indicators | On demand |
| `analytics:updated` | Metrics Service | Admin Dashboard | Every 30s |
| `presence:updated` | WebSocket Manager | Presence Indicators | On connection/disconnect |

---

## 🔧 Implementation Sequence

### Phase 3.1: Upgrade WebSocket Infrastructure (1-2 hours)
1. Update `useWebSocket.ts` to use Socket.IO client
2. Add room subscription logic
3. Implement typed event handlers
4. Add connection state management

### Phase 3.2: Wire Admin Dashboard (1-2 hours)
1. Replace polling with WebSocket subscriptions
2. Implement config:changed handler
3. Implement status:changed handler
4. Add error recovery

### Phase 3.3: Wire Payment Components (1.5-2 hours)
1. Update PendingPaymentsWidget
2. Update RecurringPaymentsManager
3. Add payment status tracking
4. Implement alert handling

### Phase 3.4: Wire Vault Dashboard (1-2 hours)
1. Real-time balance updates
2. Transaction streaming
3. Alert handling for vault operations

### Phase 3.5: Wire Activity Feed (1 hour)
1. Stream all activity events
2. Implement pagination/windowing
3. Add filtering options

### Phase 3.6: Wire Alert System (1.5 hours)
1. Create ToastManager component
2. Implement severity-based styling
3. Auto-dismiss logic
4. Critical alert persistence

### Phase 3.7: Wire Presence Indicators (1 hour)
1. Track connected users
2. Show online status
3. Activity timestamps

---

## ✅ Success Criteria for Phase 3

- [ ] **Real-Time Updates**: All dashboard updates occur <100ms after backend event
- [ ] **No Polling**: Zero setInterval/setTimeout for data fetching
- [ ] **Connection Resilience**: Auto-reconnect with exponential backoff
- [ ] **Type Safety**: All events fully typed with TypeScript interfaces
- [ ] **Performance**: Dashboard rendering optimized to prevent lag
- [ ] **User Feedback**: Clear loading/error states during WebSocket transitions
- [ ] **Zero Breaking Changes**: Phase 2 REST API remains fully functional
- [ ] **E2E Testing**: Automated tests for all event subscriptions

---

## 🚀 Technical Deep Dive

### useWebSocket Hook Upgrade Example
```typescript
// Before: Native WebSocket
const ws = new WebSocket(wsUrl);
ws.send(JSON.stringify({ type: 'SUBSCRIBE', data: { eventType } }));

// After: Socket.IO
import { io } from 'socket.io-client';
const socket = io(API_CONFIG.WS_URL, {
  auth: { token: authToken }, // Cookies auto-included
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  reconnectionAttempts: 10
});

socket.on('config:changed', (data) => { /* ... */ });
socket.emit('subscribe', { room: 'config:elders' });
```

### Component Integration Pattern
```typescript
// Standard pattern for all components
const MyComponent = () => {
  const { socket, isConnected } = useWebSocket();
  const [data, setData] = useState(initialState);

  useEffect(() => {
    if (!isConnected) return;

    // Subscribe to relevant events
    socket.on('event:type', handleEventType);
    socket.on('event:other', handleOtherEvent);

    // Cleanup
    return () => {
      socket.off('event:type');
      socket.off('event:other');
    };
  }, [socket, isConnected]);

  return <div>{/* Render data */}</div>;
};
```

---

## 📈 Performance Targets

| Metric | Target | Method |
|--------|--------|--------|
| Event Latency | <100ms | WebSocket direct delivery |
| UI Update Latency | <200ms | Optimized React rendering |
| Memory Usage | <50MB per component | Event windowing + cleanup |
| CPU Usage | <5% idle | Socket.IO efficiency |
| Connection Setup | <1s | Socket.IO auto-optimization |
| Reconnection Time | <3s | Exponential backoff |

---

## 🔐 Security Considerations

- ✅ All WebSocket connections use httpOnly cookies (no token exposure)
- ✅ JWT validation on Socket.IO handshake (same as REST API)
- ✅ Room-based filtering (users only receive their own events)
- ✅ Rate limiting per user/socket
- ✅ No sensitive data in client-side logs
- ✅ WebSocket CSP headers properly configured

---

## 🎓 Key Implementation Files

**Files to Create/Modify**:
1. `client/src/hooks/useWebSocket.ts` — Upgrade to Socket.IO
2. `client/src/pages/admin/AdminDashboard.tsx` — WebSocket integration
3. `client/src/components/wallet/PaymentMonitor.tsx` — Create if needed
4. `client/src/components/wallet/VaultDashboard.tsx` — WebSocket integration
5. `client/src/components/dashboard/RealtimeActivityFeed.tsx` — Event streaming
6. `client/src/components/notifications/ToastManager.tsx` — Alert system
7. `client/src/components/dashboard/PresenceIndicators.tsx` — User tracking

---

## ⏭️ Phase 4 (Future)

After Phase 3 completion:
- **Phase 4A**: Database event pipeline (capture all mutations)
- **Phase 4B**: Persisted event replay (audit trail)
- **Phase 4C**: Analytics event tracking (user behavior)
- **Phase 4D**: Load testing & performance optimization

---

## 📝 Rollback Plan

If issues arise:
1. All REST endpoints remain functional (no breaking changes)
2. Components can revert to polling temporarily
3. WebSocket can be disabled via environment variable
4. Server-side WebSocket can be toggled off independently

---

**Status**: Ready to begin Phase 3.1 - WebSocket Hook Upgrade  
**Next Action**: Start with `useWebSocket.ts` upgrade to Socket.IO
