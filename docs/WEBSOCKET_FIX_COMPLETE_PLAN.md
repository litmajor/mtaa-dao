# WebSocket Path Collision - Complete Fix Plan

## Executive Summary

**Problem:** Payment events are emitted to `/ws/admin` but wallet components listen on `/ws/notifications`, causing real-time payment updates to fail silently.

**Root Cause:** Three Socket.IO servers create on same HTTP server with path collisions:
- WebSocketManager creates server at `/socket.io/` (default, conflicting!)
- GatewayWebSocketServer creates server at `/socket.io/` (default, conflicting!) 
- Notifications io creates server at `/ws/notifications` (correct)

**Solution:** Route payment events through existing notificationService → `/ws/notifications` architecture instead of through WebSocketManager → `/ws/admin`.

---

## Current Architecture Issues

### Issue 1: Path Collision (FIXED)
✅ **Status:** FIXED in this session
- WebSocketManager: now uses `/ws/admin` instead of `/socket.io/`
- GatewayWebSocketServer: now uses `/ws/gateway` instead of `/socket.io/`
- CoordinatorWebSocketHandler: already correct at `/ws/coordinator`

### Issue 2: Event Flow Mismatch (REQUIRES FIX)
❌ **Status:** BLOCKING real-time payment updates

**Current Flow (BROKEN):**
```
Payment Route (paymentExecutionRoutes.ts)
  → getEventEmitter().emitActivity('payment', ...)
  → WebSocketManager.emitToRoom()
  → this.io.to(room).emit()  [at /ws/admin path]
  → Frontend listening on /ws/notifications never receives it
```

**Required Flow (CORRECT):**
```
Payment Route (paymentExecutionRoutes.ts)
  → notificationService.createNotification()
  → notificationService.emit('notification_created')
  → server/index.ts:454 listens and broadcasts to io (/ws/notifications)
  → Frontend listening on /ws/notifications receives it
```

---

## Fix Implementation

### Step 1: Update Payment Execution Routes

**File:** `server/routes/paymentExecutionRoutes.ts`

**Current Code (lines 55-61):**
```typescript
const wsEmitter = getEventEmitter();
wsEmitter.emitActivity('payment', action.id, userId, 'deposit_executed', {
  amount, currency, paymentMethod, exchangeRate, status: action.status,
  gracePeriodDeadline: gracePeriodInfo.deadline,
  approvalRequired: action.confirmationRequirement?.type === 'MULTI_SIG',
});
```

**Replace With:**
```typescript
// Emit via notificationService to reach /ws/notifications
await notificationService.createNotification({
  userId,
  type: 'payment_deposit_executed',
  title: 'Deposit Processed',
  message: `Deposit of ${amount} ${currency} has been processed`,
  priority: 'high',
  metadata: {
    entityType: 'payment',
    entityId: action.id,
    amount,
    currency,
    paymentMethod,
    exchangeRate,
    status: action.status,
    gracePeriodDeadline: gracePeriodInfo.deadline,
    approvalRequired: action.confirmationRequirement?.type === 'MULTI_SIG',
  },
  persist: true,
});
```

**Why:** notificationService events are already wired to broadcast via Socket.IO at `/ws/notifications` (see server/index.ts:454).

---

### Step 2: Update Recurring Payment Service

**File:** `server/services/recurringPaymentService.ts`

**Current Code (lines 316+ where events are emitted):**
```typescript
emitActivity('payment', payment.id, userId, 'recurring_completed', {...})
emitAlert('payment_insufficient_balance', 'high', ...)
emitStatusChange('payment', payment.id, 'completed', userId, {...})
```

**Replace With:**
```typescript
// For successful payment
await notificationService.createNotification({
  userId,
  type: 'payment_recurring_completed',
  title: 'Recurring Payment Processed',
  message: `Recurring payment of ${payment.amount} ${payment.currency} completed`,
  priority: 'normal',
  metadata: {
    entityType: 'payment',
    entityId: payment.id,
    paymentType: 'recurring',
    ...paymentDetails
  },
  persist: true,
});

// For insufficient balance
await notificationService.createNotification({
  userId,
  type: 'payment_insufficient_balance',
  title: 'Insufficient Balance',
  message: `Cannot process recurring payment: insufficient balance`,
  priority: 'high',
  metadata: {
    entityType: 'payment',
    entityId: payment.id,
    error: 'insufficient_balance'
  },
  persist: true,
});
```

---

### Step 3: Ensure Frontend Listens Correctly

**File:** `client/src/components/wallet/PendingPaymentsWidget.tsx`

**Current:**
```typescript
const { socket } = useWebSocket();  // Raw WebSocket ❌
socket.on('activity:logged', handleActivityLog);
socket.on('alert:new', handleAlert);
socket.on('status:changed', handleStatusChange);
```

**Should Be:**
```typescript
const { socket } = useSharedSocket();  // Socket.IO to /ws/notifications ✅
socket.on('notification_created', (notification: NotificationsWS.NotificationPayload) => {
  if (notification.metadata?.entityType === 'payment') {
    fetchPendingPayments();
  }
});
```

**Why:** useSharedSocket() connects to `/ws/notifications` where notificationService events are broadcast.

---

### Step 4: Update Payment Alert Service

**File:** `server/services/paymentErrorAlertService.ts`

Any places where `emitAlert()` is called should be replaced with `notificationService.createNotification()` with appropriate type and metadata.

---

## Event Name Mapping

### Old System (WebSocketManager → /ws/admin):
```
emitActivity('payment', ...) → 'activity:logged' event
emitAlert(...) → 'alert:new' event
emitStatusChange(...) → 'status:changed' event
```

### New System (notificationService → /ws/notifications):
```
notificationService.createNotification({
  type: 'payment_deposit_executed' → 'notification_created' event
  type: 'payment_insufficient_balance' → 'notification_created' event  
  type: 'payment_recurring_completed' → 'notification_created' event
})

Frontend checks: notification.metadata.entityType === 'payment'
```

---

## Affected Components

### Backend Files to Update:
- ✅ `server/websocket/websocket.ts` (path collision fixed)
- ✅ `server/websocket/gateway-websocket.ts` (path collision fixed)
- 🔄 `server/routes/paymentExecutionRoutes.ts` (emitActivity → notificationService)
- 🔄 `server/services/recurringPaymentService.ts` (all emissions)
- 🔄 `server/services/paymentErrorAlertService.ts` (all emissions)
- 🔄 Any other payment-related service using getEventEmitter()

### Frontend Files to Update:
- 🔄 `client/src/components/wallet/PendingPaymentsWidget.tsx` (useWebSocket → useSharedSocket)
- 🔄 `client/src/components/wallet/RecurringPayments.tsx` (useWebSocket → useSharedSocket)
- 🔄 `client/src/components/wallet/RecurringPaymentsManager.tsx` (useWebSocket → useSharedSocket)
- 🔄 Any payment status component

---

## Verification Checklist

After applying fixes:

- [ ] Payment deposit executed → real-time update on PendingPaymentsWidget
- [ ] Recurring payment completed → real-time refresh
- [ ] Payment alert (insufficient balance) → notification appears
- [ ] All payment updates arrive without polling
- [ ] No "WebSocket path collision" errors in server logs
- [ ] Frontend connected to `/ws/notifications` shows green status indicator

---

## Benefits of This Approach

1. **Single Event Bus:** All real-time events (payments, alerts, notifications) use same path `/ws/notifications`
2. **No Path Collisions:** Each Socket.IO server has explicit path
3. **Consistent Architecture:** Payment events follow same pattern as notification system
4. **Frontend Clarity:** Components use `useSharedSocket()` uniformly
5. **Easier Debugging:** Single place to trace event flow (notificationService → index.ts → frontend)

---

## Timeline Estimate

- Path collision fixes: ✅ **DONE** (2 files)
- Payment routes update: ~30 minutes
- Recurring payment service: ~20 minutes
- Frontend component updates: ~30 minutes
- Testing & verification: ~30 minutes

**Total: ~1.5-2 hours**

---

## Files Already Fixed This Session

1. ✅ `server/websocket/websocket.ts`
   - Added `path: WS_PATHS.ADMIN` to WebSocketManager constructor
   - Added `import { WS_PATHS }`

2. ✅ `server/websocket/gateway-websocket.ts`
   - Added `path: WS_PATHS.GATEWAY` to GatewayWebSocketServer constructor
   - Added `import { WS_PATHS }`

---

## Next Actions

1. Update payment execution routes to use notificationService
2. Update recurring payment service to use notificationService
3. Update frontend components to use useSharedSocket()
4. Test end-to-end payment event flow
5. Verify no real-time update delays
