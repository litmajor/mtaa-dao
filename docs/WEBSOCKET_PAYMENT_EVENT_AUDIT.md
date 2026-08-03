# WebSocket Payment Event Flow Audit

**Date:** 2026-07-14  
**Status:** In-Progress Investigation  
**Focus:** Real-time payment update path from backend emitters to frontend listeners

---

## Executive Summary

Payment UI components subscribe to WebSocket events for real-time updates. The audit traces backend payment execution → WebSocket event emission → frontend listener subscriptions to validate end-to-end event delivery.

**Key Finding:** Two independent WebSocket transports exist:
1. **Socket.IO namespace** (`/ws/notifications`) — event emitter, admin broadcasts
2. **Raw WebSocket** (`/ws/realtime`) — subscription-based, DAO/user presence tracking

Wallet payment components use **generic `useWebSocket` hook** that connects to raw ws, but listen for Socket.IO-style event names. This is a **mismatch requiring investigation**.

---

## Frontend Payment UI Components

### 1. FiatOnRamp.tsx
**Purpose:** Deposit fiat → crypto conversion  
**Canonical Endpoint:** `POST /api/payments/deposit`  
**Verification Endpoint:** `GET /api/payments/verify/{provider}/{reference}`  
**authClient Usage:** ✅ Correct

```typescript
// File: client/src/components/wallet/FiatOnRamp.tsx, lines 174-190
const data = await authClient.post<{...}>('/api/payments/deposit', {
  provider, amount, currency, method,
  metadata: { phone, email, name },
  idempotencyKey  // Prevents duplicate charges
});

// Polls for status
const data = await authClient.get<{ status: string }>(
  `/api/payments/verify/${provider}/${reference}`
);
```

**WebSocket Integration:** None directly. Relies on HTTP polling.

---

### 2. PaymentRequestModal.tsx
**Purpose:** Create payment link + optional email send  
**Canonical Endpoint:** `POST /api/v1/wallets/payment-links`  
**Email Send:** `POST /api/v1/wallets/payment-links/{linkId}/send-email`  
**authClient Usage:** ✅ Correct

```typescript
// File: client/src/components/wallet/PaymentRequestModal.tsx, lines 42-79
const res = await actions.createPaymentLink({
  amount, currency, description, expiresAt, metadata
});

if (recipientEmail && linkId) {
  await authClient.post(
    `/api/v1/wallets/payment-links/${linkId}/send-email`,
    { recipientEmail }
  );
}
```

**WebSocket Integration:** None directly.

---

### 3. PendingPaymentsWidget.tsx
**Purpose:** Display pending payments with real-time refresh  
**WebSocket Hook:** `useWebSocket()`  
**Event Subscriptions:** (lines 67-100)

```typescript
const handleActivityLog = (data: any) => {
  if (data.entityType === 'payment' || data.action?.includes('payment')) {
    fetchPendingPayments();  // Refresh on any payment activity
  }
};

const handleAlert = (data: any) => {
  if (data.message?.toLowerCase().includes('payment') || 
      data.entityType === 'payment') {
    fetchPendingPayments();
  }
};

const handleStatusChange = (data: any) => {
  if (data.entityType === 'payment' || data.status?.includes('payment')) {
    fetchPendingPayments();
  }
};

socket.on('activity:logged', handleActivityLog);
socket.on('alert:new', handleAlert);
socket.on('status:changed', handleStatusChange);
```

**Issue:** Listens for **Socket.IO event names** but uses generic **raw WebSocket** (`useWebSocket()`).

---

### 4. RecurringPayments.tsx & RecurringPaymentsManager.tsx
**Purpose:** Recurring payment management  
**WebSocket Hook:** `useWebSocket()`  
**Event Subscriptions:** Same pattern as PendingPaymentsWidget

```typescript
socket.on('activity:logged', handleActivityLog);
socket.on('alert:new', handleAlert);
socket.on('status:changed', handleStatusChange);
```

---

## Backend Payment Execution & Event Emission

### Payment Execution Routes
**File:** `server/routes/paymentExecutionRoutes.ts`

**Deposit Flow (lines 28-70):**
```typescript
const action = await depositHandler.execute({ userId, simulation, amount, ... });

try {
  const wsEmitter = getEventEmitter();
  wsEmitter.emitActivity('payment', action.id, userId, 'deposit_executed', {
    amount, currency, paymentMethod, exchangeRate, status: action.status,
    gracePeriodDeadline, approvalRequired
  });
} catch (wsError) {
  console.warn('Failed to emit WebSocket event for deposit execution', wsError);
}
```

**Events Emitted:**
- `emitActivity('payment', ...)` → Socket.IO room: `activity:payment:{id}` + broadcast to `activity:feed`
- **Event Name (Server → Client):** `'activity:logged'`

**Withdrawal Flow (lines 93-115):**
```typescript
wsEmitter.emitActivity('payment', action.id, userId, 'withdrawal_executed', {...});
```

**P2P Transfer Flow (lines 143-175):**
```typescript
wsEmitter.emitActivity('payment', action.id, userId, 'transfer_p2p_executed', {...});
```

---

### Recurring Payment Service
**File:** `server/services/recurringPaymentService.ts`

**Success Notification (lines 170-190):**
```typescript
const wsEmitter = getEventEmitter();
wsEmitter.emitActivity('payment', payment.id, payment.userId, 'recurring_completed', {
  recurring: true, toAddress, amount, currency, frequency, sagaId, nextPayment, status
});
```

**Failure Alert (lines 298-312):**
```typescript
wsEmitter.emitAlert('payment_recurring_failed', 'high', 
  `Recurring payment failed: ${error.message}`, payment.userId, {
  paymentId, toAddress, amount, currency, error, consecutiveFailures
});
// Event Name (Server → Client): 'alert:new'
```

**Status Change (lines 410-420):**
```typescript
wsEmitter.emitStatusChange('payment', payment.id, 'completed', payment.userId, {
  recurring: true, toAddress, amount, currency, transactionHash, nextPayment
});
// Event Name (Server → Client): 'status:changed'
```

---

### Payment Gateway Routes
**File:** `server/payments.ts` (consolidated deposit/withdrawal/verify endpoints)

**Deposit Activity Emit (lines 205-215):**
```typescript
if (isPaymentResponse(result) ? (result.success || result.status === 'pending') : false) {
  const wsEmitter = getEventEmitter();
  const txId = isPaymentResponse(result) ? result.transactionId : `deposit_${Date.now()}`;
  wsEmitter.emitActivity('payment', txId, userId, 'initiated', {
    type: 'deposit', provider, amount, currency, method, status,
    transactionId, traceId
  });
}
```

---

## WebSocket Event Emitter Architecture

**File:** `server/middleware/websocket-event-emitter.ts`

### emitActivity()
```typescript
public emitActivity(
  entityType: string,    // 'payment', 'vault', etc.
  entityId: string,      // action.id, payment.id
  userId: string,
  action: string,        // 'deposit_executed', 'recurring_completed'
  details: Record<string, any> = {},
  userEmail?: string
): void {
  const basePayload = { entityType, entityId, action, details };
  
  // Emit to specific activity room
  this.emit('activity:logged', `activity:${entityType}:${entityId}`, userId, basePayload);
  
  // Also emit to general activity feed
  this.emit('activity:new', 'activity:feed', userId, { entityType, entityId, action });
}
```

**Result:** Socket.IO event `'activity:logged'` broadcast to room `activity:payment:{id}`

### emitAlert()
```typescript
public emitAlert(
  alertType: string,
  severity: 'low' | 'medium' | 'high' | 'critical',
  message: string,
  userId: string,
  metadata: Record<string, any> = {},
  userEmail?: string
): void {
  const basePayload = { alertType, severity, message, ...metadata, id: `alert-${Date.now()}` };
  
  // Emit to general alerts room
  this.emit('alert:new', 'alerts', userId, basePayload);
  
  // Emit to critical room if severity is critical
  if (severity === 'critical') {
    this.emit('alert:critical', 'alerts:critical', userId, basePayload);
  }
  
  // Emit to entity-specific room if entityId provided
  if (metadata.entityId) {
    this.emit('alert:new', `alerts:${metadata.entityType || 'system'}:${metadata.entityId}`, userId, basePayload);
  }
}
```

**Result:** Socket.IO event `'alert:new'` broadcast to room `alerts`

### emitStatusChange()
```typescript
public emitStatusChange(
  entityType: string,
  entityId: string,
  newStatus: string,
  userId: string,
  additionalData: Record<string, any> = {},
  userEmail?: string
): void {
  const basePayload = { entityType, entityId, newStatus, ...additionalData };
  
  this.emit('status:changed', `status:${entityType}:${entityId}`, userId, basePayload);
  
  // Also emit to general status room for monitoring
  this.emit('system:event', 'status:updates', userId, { type: 'status-change', ...basePayload });
}
```

**Result:** Socket.IO event `'status:changed'` broadcast to room `status:payment:{id}`

---

## WebSocket Manager (Socket.IO Broadcaster)

**File:** `server/websocket/websocket.ts`

### Core Broadcast Methods
```typescript
public emitToRoom(room: string, event: string, data: Record<string, unknown>) {
  this.io.to(room).emit(event, data);
}

public emitToUser(userId: string, event: string, data: Record<string, unknown>) {
  const sockets = this.userSockets.get(userId);
  if (sockets) {
    sockets.forEach(socketId => {
      this.io.to(socketId).emit(event, data);
    });
  }
}

public broadcastToAll(event: string, data: Record<string, unknown>) {
  this.io.emit(event, data);
}
```

### Authentication & Room Joining
```typescript
private setupConnections() {
  this.io.on('connection', (socket: AuthenticatedSocket) => {
    const user = socket.data.user;

    socket.on('subscribe:room', (data: { room: string }) => {
      this.handleRoomSubscription(socket, data.room);
    });

    socket.on('unsubscribe:room', (data: { room: string }) => {
      this.handleRoomUnsubscription(socket, data.room);
    });
  });
}
```

---

## Frontend WebSocket Hooks

### useWebSocket() — Raw WebSocket
**File:** `client/src/hooks/useWebSocket.ts` (lines 18-260)

**Connection Target:**
```typescript
const wsUrl =
  API_CONFIG.WS_URL ||
  (typeof window !== 'undefined'
    ? `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}`
    : 'ws://localhost:5000');

ws.current = new WebSocket(wsUrl);
```

**Event Listener Pattern:**
```typescript
const on = useCallback((event: string, callback: EventCallback) => {
  if (!eventListeners.current.has(event)) {
    eventListeners.current.set(event, new Set());
  }
  eventListeners.current.get(event)?.add(callback);
}, []);

socket: Socket = {
  on,
  off,
  emit,
  connected: isConnected,
};
```

**Returns Socket.IO-like API but uses raw WebSocket transport.**

### useSharedSocket() — Socket.IO
**File:** `client/src/hooks/useSharedSocket.ts` (lines 1-60)

**Connection Target:**
```typescript
const socket = io(socketUrl, {
  path: WS_PATHS.NOTIFICATIONS,  // '/ws/notifications'
  withCredentials: true,
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  reconnectionAttempts: 5,
});
```

**Status:** Used by AlertToastManager but NOT by wallet payment components.

---

## Critical Issue: Transport Mismatch

### Wallet Components Use Raw WebSocket
```typescript
// PendingPaymentsWidget.tsx, RecurringPayments.tsx, RecurringPaymentsManager.tsx
const { socket, isConnected } = useWebSocket();  // ← Raw WebSocket (/ws)
socket.on('activity:logged', handleActivityLog);
socket.on('alert:new', handleAlert);
socket.on('status:changed', handleStatusChange);
```

### Backend Emits via Socket.IO
```typescript
// server/middleware/websocket-event-emitter.ts
this.emit('activity:logged', `activity:${entityType}:${entityId}`, userId, basePayload);
// ↓ calls WebSocketManager.emitToRoom()
// ↓ which calls this.io.to(room).emit(event, data)
// ↓ Socket.IO /ws/notifications namespace
```

### Transport Path Disconnect
- **Backend:** Socket.IO server at `/ws/notifications` (port 5000)
- **Frontend (Payment UI):** Raw WebSocket at `ws://localhost:5000` (root path)
- **Frontend (Notifications):** Socket.IO at `/ws/notifications` (via useSharedSocket)

**Result:** Wallet components listening on raw WS may NOT receive Socket.IO events broadcast to `/ws/notifications`.

---

## WebSocket Services & Initialization

### Three WebSocket Services
1. **SocketIOWebSocketService** (`server/services/SocketIOWebSocketService.ts`)
   - Singleton Socket.IO instance
   - Initialized in `server/index.ts:359`
   - Public API: `sendToUser()`, `broadcastToSubscription()`

2. **WebSocketService** (`server/services/WebSocketService.ts`)
   - Raw WebSocket server
   - Path: `/ws/realtime`
   - Used by: TransactionMonitor, RecurringPaymentService
   - Purpose: DAO/user presence tracking, typing indicators

3. **WebSocketManager** (`server/websocket/websocket.ts`)
   - Socket.IO manager for admin features
   - Path: derived from Socket.IO config, then WS_PATHS (not explicitly set)
   - Initialized by `initializeWebSocketManager(server)` at `server/index.ts:366`

### Initialization Order (server/index.ts)
```typescript
// Line 190-206: Create raw Socket.IO instance for notifications
const io = new SocketIOServer(server, {
  path: WS_PATHS.NOTIFICATIONS,  // '/ws/notifications'
  cors: {...},
  allowEIO3: true,
});

// Line 358: Get SocketIOWebSocketService singleton
const socketIOService = getSocketIOService(server);

// Line 361-362: Initialize market/opportunity streams (raw ws)
opportunityStream.initialize(server);
marketStreamService.initialize(server);

// Line 366: Initialize WebSocketManager (admin features)
const wsManager = initializeWebSocketManager(server);

// Line 368: Initialize global event emitter
initializeEventEmitter(wsManager);
```

---

## Event Flow Summary

### Payment Deposit → Frontend Real-Time Update

```
1. Frontend: authClient.post('/api/payments/deposit', {...})
   ↓
2. Backend: server/payments.ts POST /api/payments/deposit
   ↓
3. Execute: paymentGatewayService.initiateDeposit()
   ↓
4. Emit: wsEmitter.emitActivity('payment', txId, userId, 'initiated', {...})
   ↓
5. WebSocketManager: this.io.to('activity:payment:{id}').emit('activity:logged', payload)
   ↓
6. Socket.IO Namespace (/ws/notifications): broadcast event
   ↓
7. Frontend: socket.on('activity:logged', handleActivityLog)
   └─ ISSUE: Frontend uses raw WebSocket, not Socket.IO namespace!
   ↓
8. Fallback: HTTP polling (if WebSocket fails)
```

---

## Known WebSocket Paths & Namespaces

| Path | Transport | Purpose | Status |
|------|-----------|---------|--------|
| `/ws/notifications` | Socket.IO | Payment events, alerts, status | **Used by backend** |
| `/ws/realtime` | Raw WS | DAO presence, typing, real-time feeds | **Initialized but unclear usage** |
| `/ws/admin` | Socket.IO | Admin dashboard | WS_PATHS.ADMIN |
| `/ws/gateway` | Socket.IO | Gateway price/liquidity updates | WS_PATHS.GATEWAY |
| `/ws/coordinator` | Socket.IO | DAO consensus, proposals | WS_PATHS.COORDINATOR |
| `/ws/morio` | Socket.IO | Morio data hub, elder insights | WS_PATHS.MORIO |
| `/ws/prices` | Raw WS | Price stream (PriceStreamServer) | WS_PATHS.PRICE_STREAM |

---

## Unresolved Questions

1. **Transport Mismatch:** Why do wallet components use raw `useWebSocket()` when backend emits to Socket.IO `/ws/notifications`?
   - Are events being duplicated to raw WS?
   - Is there a proxy layer?
   - Is frontend expected to use `useSharedSocket()`?

2. **WebSocket Service Used:** Which WebSocket service actually sends payment events?
   - SocketIOWebSocketService (Socket.IO at /ws/notifications)
   - WebSocketService (raw ws at /ws/realtime)
   - Direct io.to(room).emit() from WebSocketManager?

3. **Event Listener Chain:** How do raw WebSocket messages contain Socket.IO event names (`activity:logged`, `alert:new`)?
   - Are they JSON-encoded?
   - Is there a message type discriminator?

4. **Frontend HTTP Fallback:** If WebSocket fails, do payment UIs fall back to polling?
   - PendingPaymentsWidget has `fetchPendingPayments()` but no explicit polling timeout
   - RecurringPayments also has no polling fallback

---

## Recommendations for Resolution

1. **Verify Transport Match:**
   - Trace `useWebSocket()` hook to confirm it connects to the same namespace as backend emissions
   - Confirm Socket.IO events can be received on raw WebSocket connection

2. **Add Explicit Connection Debug:**
   - Log WebSocket connection target in frontend console
   - Log Socket.IO broadcast details in backend logs

3. **Add Test Coverage:**
   - End-to-end payment emission → frontend listener test
   - Verify event payload structure matches between emit and listener

4. **Document Event Schema:**
   - Finalize event payload schemas for `activity:logged`, `alert:new`, `status:changed`
   - Add TypeScript interfaces for type safety

---

**Next Step:** Continue diving to locate raw WebSocket message handler or proxy layer that bridges Socket.IO → raw WS events.
