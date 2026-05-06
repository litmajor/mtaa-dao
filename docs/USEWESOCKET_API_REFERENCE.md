# useWebSocket Hook - Socket.IO API Reference

**Status**: ✅ Upgraded (Phase 3.1 Complete)  
**File**: `client/src/hooks/useWebSocket.ts`

---

## API Overview

The hook now provides Socket.IO-like API while maintaining backward compatibility with legacy WebSocket code.

### Usage Pattern

```typescript
import { useWebSocket } from '@/hooks/useWebSocket';

export function MyComponent() {
  // Destructure socket object (recommended)
  const { socket, isConnected } = useWebSocket();

  useEffect(() => {
    if (!isConnected) return;

    // Subscribe to events
    socket.on('config:changed', (data) => {
      console.log('Config updated:', data);
    });

    // Cleanup
    return () => {
      socket.off('config:changed');
    };
  }, [socket, isConnected]);

  return <div>{isConnected ? 'Connected' : 'Disconnected'}</div>;
}
```

---

## Core Methods

### `socket.on(eventType, callback)`
Register an event listener for incoming WebSocket events.

```typescript
socket.on('config:changed', (data) => {
  setConfig(data);
});

socket.on('alert:new', (alert) => {
  showAlert(alert.message);
});

socket.on('activity:logged', (activity) => {
  addToActivityFeed(activity);
});
```

**Event Types from Backend**:
- `config:changed` - Configuration updates
- `activity:logged` - User/system activity
- `alert:new` - New alerts (all severities)
- `alert:critical` - Critical alerts only
- `status:changed` - Status updates
- `analytics:updated` - Metrics/analytics updates
- `approval:changed` - Voting/approval events
- `presence:updated` - User presence changes

---

### `socket.off(eventType, [callback])`
Unregister an event listener.

```typescript
// Remove specific listener
socket.off('config:changed', handleConfigChange);

// Remove all listeners for this event
socket.off('config:changed');
```

---

### `socket.emit(eventType, data)`
Send an event to the server.

```typescript
// Subscribe to a room/resource
socket.emit('subscribe', { room: 'config:elders' });

// Request data
socket.emit('request_data', { type: 'vaults' });
```

---

### `socket.connected`
Check connection status (read-only).

```typescript
if (socket.connected) {
  // Send data
  socket.emit('subscribe', { room: 'alerts' });
}
```

---

## Return Value Structure

```typescript
const {
  // Socket object (primary - use this!)
  socket,           // { on, off, emit, connected }

  // Connection state
  isConnected,      // boolean
  isConnecting,     // boolean
  lastError,        // string | null

  // Legacy methods (for backward compatibility)
  send,             // (event: WebSocketEvent) => void
  subscribe,        // (eventType: string) => void
  unsubscribe,      // (eventType: string) => void
  connect,          // () => void
  disconnect,       // () => void

  // Event methods (same as socket.on/off/emit)
  on,               // (event: string, callback) => void
  off,              // (event: string, callback?) => void
  emit,             // (event: string, data?) => void
} = useWebSocket(options);
```

---

## Full Example: Real-Time Dashboard

```typescript
import { useEffect, useState } from 'react';
import { useWebSocket } from '@/hooks/useWebSocket';

export function RealtimeDashboard() {
  const { socket, isConnected } = useWebSocket();
  
  const [config, setConfig] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [activity, setActivity] = useState([]);

  useEffect(() => {
    if (!isConnected) return;

    // Listen for config changes
    const handleConfigChange = (data) => {
      setConfig(data);
    };

    // Listen for alerts
    const handleAlert = (alert) => {
      setAlerts(prev => [alert, ...prev].slice(0, 50));
    };

    // Listen for activity
    const handleActivity = (act) => {
      setActivity(prev => [act, ...prev].slice(0, 100));
    };

    socket.on('config:changed', handleConfigChange);
    socket.on('alert:new', handleAlert);
    socket.on('activity:logged', handleActivity);

    // Cleanup
    return () => {
      socket.off('config:changed', handleConfigChange);
      socket.off('alert:new', handleAlert);
      socket.off('activity:logged', handleActivity);
    };
  }, [socket, isConnected]);

  if (!isConnected) {
    return <div>Connecting...</div>;
  }

  return (
    <div>
      <h2>Current Config: {config?.version}</h2>
      <h3>Recent Alerts ({alerts.length})</h3>
      <ul>
        {alerts.map((a, i) => (
          <li key={i}>{a.message}</li>
        ))}
      </ul>
      <h3>Activity Feed ({activity.length})</h3>
      <ul>
        {activity.map((a, i) => (
          <li key={i}>{a.action}</li>
        ))}
      </ul>
    </div>
  );
}
```

---

## Migration Guide: Polling → WebSocket

### Before (Polling)
```typescript
useEffect(() => {
  const fetchData = async () => {
    const data = await api.getConfig();
    setConfig(data);
  };

  fetchData();
  const interval = setInterval(fetchData, 30000); // Poll every 30s
  return () => clearInterval(interval);
}, []);
```

### After (WebSocket)
```typescript
useEffect(() => {
  if (!socket.connected) return;

  socket.on('config:changed', (data) => {
    setConfig(data);
  });

  return () => {
    socket.off('config:changed');
  };
}, [socket]);
```

**Benefits**:
- ✅ Real-time updates (no 30s delay)
- ✅ Reduced server load (no polling)
- ✅ Reduced bandwidth
- ✅ Better UX (instant feedback)
- ✅ Automatic reconnection

---

## Connection Lifecycle

**Manual for advanced control**:

```typescript
const { socket, connect, disconnect, isConnecting } = useWebSocket({
  autoConnect: false // Disable auto-connect
});

// Manually connect when ready
useEffect(() => {
  const handleReady = async () => {
    await checkAuth();
    connect(); // Now connect
  };
  handleReady();
}, []);

// Disconnect on logout
const handleLogout = () => {
  disconnect();
};
```

---

## Error Handling

```typescript
const { socket, isConnected, lastError } = useWebSocket();

useEffect(() => {
  if (lastError) {
    console.error('WebSocket error:', lastError);
    // Show error toast, attempt recovery, etc.
  }
}, [lastError]);

// Wrap event handlers in try/catch
socket.on('config:changed', (data) => {
  try {
    processConfig(data);
  } catch (err) {
    console.error('Error processing config:', err);
  }
});
```

---

## Options

```typescript
const { socket } = useWebSocket({
  autoConnect: true,           // Auto-connect on mount
  reconnectInterval: 3000,     // Initial reconnect delay (ms)
  maxReconnectAttempts: 10,    // Max reconnection attempts
  onConnect: () => {           // Callback when connected
    console.log('Connected');
  },
  onDisconnect: () => {        // Callback when disconnected
    console.log('Disconnected');
  },
  onError: (error) => {        // Callback on error
    console.error('WebSocket error:', error);
  },
  onMessage: (event) => {      // Legacy callback (avoid)
    console.log('Message:', event);
  }
});
```

---

## Best Practices

### ✅ DO
- Use `socket.on()` / `socket.off()` in useEffect cleanup
- Check `isConnected` before emitting
- Handle errors in event callbacks
- Clean up listeners on component unmount
- Use typed event handlers

### ❌ DON'T
- Call `socket.on()` directly in render
- Forget to unsubscribe listeners
- Ignore connection state
- Send data without checking `isConnected`
- Use legacy `onMessage` callback (use `socket.on()` instead)

---

## Next Steps

**Phase 3.2**: Wire AdminDashboard component  
**Phase 3.3**: Wire Payment components  
**Phase 3.4**: Wire Vault dashboard  

All components follow the same pattern shown above.
