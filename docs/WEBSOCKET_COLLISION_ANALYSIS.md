# Critical Socket.IO Path Collision Found

## The Problem

Two Socket.IO servers are created on the same HTTP server with **conflicting paths**:

### 1. Notifications Instance (server/index.ts:190)
```typescript
const io = new SocketIOServer(server, {
  path: WS_PATHS.NOTIFICATIONS,  // '/ws/notifications'
  cors: {...},
  allowEIO3: true,
});

// Line 432: Connection handler
io.on('connection', (socket: any) => {
  // User rooms for notifications
});

// Line 454: Notification broadcasts
notificationService.on('notification_created', (data) => {
  io.to(NotificationsWS.Rooms.user(data.userId))
    .emit(NotificationsWS.ServerEvents.NEW_NOTIFICATION, data);
});
```

**Path:** `/ws/notifications`  
**Purpose:** User notifications, direct messaging  
**Used By:** AlertToastManager (useSharedSocket), notificationService  

---

### 2. WebSocketManager Instance (server/websocket/websocket.ts:71)
```typescript
class WebSocketManager {
  constructor(httpServer: HTTPServer) {
    this.io = new Server(httpServer, {
      cors: { origin: process.env.CLIENT_URL || 'http://localhost:5000', ... }
      // ⚠️ NO `path` option specified!
    });
  }
}

// Line 116: Broadcast methods
public emitToRoom(room: string, event: string, data: Record<string, unknown>) {
  this.io.to(room).emit(event, data);  // ← Emits to WHICH path?
}
```

**Path:** `/socket.io/` (Socket.IO default when no path specified)  
**Purpose:** Payment events, admin features, activity logging  
**Used By:** Payment execution routes via `getEventEmitter().emitActivity()`  

---

## The Collision

When Socket.IO servers are created without explicit `path` settings, they default to `/socket.io/`. With multiple servers on the same HTTP port:

| Server | Path | Initialization | Status |
|--------|------|---|--------|
| Notifications (index.ts) | `/ws/notifications` | ✅ Explicit path set | Working |
| WebSocketManager (websocket.ts) | `/socket.io/` (default) | ⚠️ No path set | **COLLISION** |
| SocketIOWebSocketService | Not checked | TBD | Unknown |

**Result:** Payment events go to `/socket.io/` but wallet frontend tries to connect to `/ws/notifications`.

---

## Proof from Architecture Documentation

File: `server/websocket/websocket-events.ts` (lines 22-30)

```typescript
// IMPORTANT — ACTION REQUIRED ON THE SERVER SIDE:
// WebSocketManager, GatewayWebSocketServer, and CoordinatorWebSocketHandler
// each do `new SocketIOServer(httpServer, {...})` with no `path` set. If
// more than one of these attaches to the same underlying HTTP server, they
// will collide on Socket.IO's default `/socket.io/` path. Use the
// `WS_PATHS` constants below as the `path` option on each server's
// constructor to keep them isolated.
```

**The documentation explicitly warns about this but the fix was NOT applied.**

---

## Payment Event Flow is BROKEN

```
1. Frontend: authClient.post('/api/payments/deposit', {...})
2. Backend: wsEmitter.emitActivity('payment', ...) 
   ↓
3. WebSocketEventEmitter calls wsManager.emitToRoom()
   ↓
4. WebSocketManager.emitToRoom() calls this.io.to(room).emit()
   ↓
5. Emits to `/socket.io/` (default path, NOT `/ws/notifications`)
   ↓
6. Frontend listening on `/ws/notifications` (via useSharedSocket)
   ↓
7. ❌ NO EVENT RECEIVED - Payment update fails silently
```

---

## Affected Components

All payment-related real-time updates:
- PendingPaymentsWidget
- RecurringPayments  
- RecurringPaymentsManager
- Transaction status updates
- Payment alerts & failures

---

## Solution

Add `path: WS_PATHS.ADMIN` (or create new WS_PATHS.PAYMENT) to WebSocketManager constructor:

```typescript
// server/websocket/websocket.ts, line 71
constructor(httpServer: HTTPServer) {
  this.io = new Server(httpServer, {
    path: WS_PATHS.ADMIN,  // ← FIX: Explicit path to avoid collision
    cors: {
      origin: process.env.CLIENT_URL || 'http://localhost:5000',
      methods: ['GET', 'POST'],
      credentials: true
    }
  });
  // ...
}
```

**CRITICAL:** All three WebSocket servers (WebSocketManager, GatewayWebSocketServer, CoordinatorWebSocketHandler) need explicit path settings to avoid collisions.

---

## Status

This explains why wallet payment real-time updates are not working:
- ✅ Backend is emitting events correctly
- ✅ Frontend is listening correctly
- ❌ Events are on wrong Socket.IO namespace
- ❌ Frontend never receives them
- ✅ HTTP polling fallback (if any) keeps UX functional but sluggish

**This is a blocking issue that requires immediate fix.**
