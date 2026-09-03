
# Message Bus System - Implementation Checklist

**Status**: Ready for Integration  
**Created**: 2026-08-13  

## ✅ Completed Components

- [x] **Enhanced Message Bus** - Full production-ready implementation
  - Priority queues (critical > high > medium > low)
  - TTL enforcement with automatic expiration
  - Dead Letter Queue for failed messages
  - Request-response with correlation IDs
  - Broadcast patterns
  - In-process delivery with Promise.allSettled safety

- [x] **Redis Persistence Layer**
  - Automatic message persistence
  - TTL-based key expiration
  - Cross-process pub/sub for distributed deployments
  - Undelivered message recovery on restart

- [x] **Prometheus Metrics Exporter**
  - Message count metrics (published, delivered, failed, expired, dlq)
  - Response tracking and timeout counts
  - Delivery time histograms
  - Message age histograms
  - Per-type message distribution
  - Subscriber count tracking
  - Queue depth monitoring
  - Redis connection status

- [x] **HTTP Observability Endpoints** (`/api/bus`)
  - `/health` - Overall health status
  - `/stats` - Detailed statistics
  - `/history` - Message history with filtering
  - `/dlq` - Dead letter queue contents
  - `/dlq/:id/retry` - Retry failed messages
  - `/message/:id` - Specific message details
  - `/message-types` - All message types and activity
  - `/subscribers` - Subscriber information
  - `/alerts` - Current alerts based on metrics
  - `/metrics` - Prometheus format metrics

- [x] **Message Bus Bridge**
  - Unified bus that bridges three subsystems
  - Coordinator adapter with topic mapping
  - Gateway adapter with type mapping
  - Transparent message format conversion
  - Full bidirectional bridging

- [x] **Documentation**
  - Enhanced agent communication guide
  - Integration examples
  - Troubleshooting guide
  - All message types documented
  - Configuration options

---

## 🚀 Integration Steps

### Step 1: Add Message Bus Initialization (in server/index.ts)

**Location**: After Express app creation, before route registration (in async startup IIFE)

```typescript
// Add import at top
import { initializeMessageBusSystem } from './core/agent-framework/message-bus-init';

// In async startup, after Redis and DB are ready
const {
  messageBus,
  metricsExporter,
  bridge,
  coordinatorBridge,
  gatewayBridge,
} = await initializeMessageBusSystem(app);

// Make available globally for other services
app.locals.messageBus = messageBus;
app.locals.messageBusMetrics = metricsExporter;
app.locals.messageBusBridge = bridge;
```

### Step 2: Update Agent Initialization

**For each agent** (analyzer, defender, synchronizer):

```typescript
import { getGlobalMessageBus, MessageType } from '@/core/agent-framework/enhanced-message-bus';

// In agent initialization
export class MyAgent {
  private bus = getGlobalMessageBus();
  
  async initialize() {
    // Subscribe to relevant message types
    this.bus.subscribe(
      'my-agent-id',
      [MessageType.PRICE_UPDATE, MessageType.HEALTH_CHECK],
      this.handleMessage.bind(this)
    );
  }
  
  async handleMessage(message: AgentMessage) {
    switch (message.type) {
      case MessageType.PRICE_UPDATE:
        await this.onPriceUpdate(message.payload);
        break;
    }
  }
  
  async publishAnalysis(risk: any) {
    await this.bus.publish({
      id: generateId(),
      from: 'analyzer',
      to: 'broadcast',
      type: MessageType.RISK_ASSESSMENT,
      payload: risk,
      timestamp: new Date(),
      priority: 'high',
    });
  }
}
```

### Step 3: Bridge Coordinator Messages

**In coordinator initialization** (or in elders/coordinator setup):

```typescript
import { app } from '@/server';  // Or pass bridge as injection

const bridge = app.locals.messageBusBridge;
const coordinatorBridge = bridge.getCoordinatorBridge();

// When coordinator publishes messages, bridge them
coordinatorBridge.bridgeMessage({
  id: message.id,
  topic: 'scry:threat-detected',
  from: 'SCRY',
  to: 'ALL',
  data: message.payload,
  priority: 'critical',
  timestamp: new Date(),
});
```

### Step 4: Bridge Gateway Messages

**In gateway service**:

```typescript
const bridge = app.locals.messageBusBridge;
const gatewayBridge = bridge.getGatewayBridge();

// When gateway publishes messages
gatewayBridge.bridgeMessage({
  id: message.id,
  type: 'gateway:price_update',
  from: 'gateway',
  payload: { price, symbol },
  timestamp: new Date(),
});
```

### Step 5: Environment Configuration

**Add to .env**:

```bash
# Redis (for persistence and cross-process messaging)
ENABLE_MESSAGE_BUS_PERSISTENCE=true
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_DB=0
REDIS_PASSWORD=   # optional

# Observability
ENABLE_BUS_METRICS=true
MESSAGE_BUS_OBSERVABILITY_PATH=/api/bus

# Distributed mode (multi-replica deployments)
ENABLE_DISTRIBUTED_BUS=false
```

---

## 📊 Verification Checklist

After integration, verify:

- [ ] Message bus initializes without errors on startup
- [ ] Redis connection established (if enabled)
- [ ] `/api/bus/health` returns healthy status
- [ ] `/api/bus/stats` shows metrics
- [ ] Agents are able to publish messages
- [ ] Messages appear in `/api/bus/history`
- [ ] Prometheus metrics available at `/api/bus/metrics`
- [ ] Dead letter queue empty or minimal
- [ ] No "no-subscribers" warnings in logs for valid message types
- [ ] Request-response pattern works with correlation IDs
- [ ] Coordinator messages successfully bridge
- [ ] Gateway messages successfully bridge

---

## 🔍 Monitoring Commands

### Check Health
```bash
curl http://localhost:3000/api/bus/health
```

### View Recent Messages
```bash
curl http://localhost:3000/api/bus/history?limit=50
```

### View Failed Messages
```bash
curl http://localhost:3000/api/bus/dlq?limit=20
```

### Get Alerts
```bash
curl http://localhost:3000/api/bus/alerts
```

### View Prometheus Metrics
```bash
curl http://localhost:3000/api/bus/metrics | grep mtaa_bus
```

### Check Subscribers by Type
```bash
curl "http://localhost:3000/api/bus/subscribers?type=RISK_ASSESSMENT"
```

### Monitor in Real-time (bash)
```bash
watch -n 2 'curl -s http://localhost:3000/api/bus/stats | jq .metrics'
```

---

## 🚨 Common Issues & Solutions

### Issue: "No subscribers for message type"

**Cause**: Message type is published but no agent is subscribed  
**Solution**:
1. Verify agent subscription: `curl /api/bus/subscribers?type=MESSAGE_TYPE`
2. Check agent initialization logs
3. Ensure agent is calling `bus.subscribe()` during initialization

### Issue: Messages in DLQ

**Cause**: Messages failed delivery after 3 attempts  
**Solution**:
1. Check `/api/bus/dlq` for details
2. Fix subscriber or routing issues
3. Retry with `/api/bus/dlq/:id/retry`
4. Monitor `/api/bus/alerts` for patterns

### Issue: High failure rate

**Cause**: Many messages failing delivery  
**Solution**:
1. Check alert severity at `/api/bus/alerts`
2. Review handler errors in application logs
3. Increase message TTL if handlers are slow
4. Check subscriber availability

### Issue: Redis connection timeout

**Cause**: Redis unavailable or misconfigured  
**Solution**:
1. Verify Redis is running: `redis-cli ping`
2. Check REDIS_HOST and REDIS_PORT
3. Messages will still work in-memory
4. Set ENABLE_MESSAGE_BUS_PERSISTENCE=false to disable Redis

---

## 📈 Performance Tuning

### Tune Priority Processing
```typescript
// In enhanced-message-bus.ts, adjust process frequency
this.processingInterval = setInterval(() => {
  this.processMessageQueue();
}, 100);  // Adjust milliseconds
```

### Tune DLQ Size
```typescript
// In enhanced-message-bus.ts
private readonly MAX_DLQ = 5000;  // Adjust as needed
```

### Tune History Size
```typescript
// In enhanced-message-bus.ts
private readonly MAX_HISTORY = 10000;  // Adjust as needed
```

### Tune Delivery Attempts
```typescript
// Per message
await bus.publish({
  ...message,
  maxDeliveryAttempts: 5,  // Default is 3
});
```

---

## 🔒 Security Considerations

- All messages processed in-process (no external exposure)
- Redis connection recommended to be internal-only
- HTTP endpoints available at `/api/bus` - consider adding auth
- Message payload can contain sensitive data - ensure proper access control
- DLQ may contain failed sensitive messages - implement cleanup job

### Add Authentication to Observability Endpoints

```typescript
app.use('/api/bus', requireRole('admin'), observabilityRouter);
```

---

## 📚 Documentation Files

- **`AGENT_COMMUNICATION_ENHANCED.md`** - Complete user guide
- **`MESSAGE_BUS_INTEGRATION_GUIDE.ts`** - Code examples
- **`message-bus-init.ts`** - Easy initialization
- **`enhanced-message-bus.ts`** - Core implementation
- **`message-bus-metrics.ts`** - Prometheus metrics
- **`message-bus-observability.ts`** - HTTP endpoints
- **`message-bus-bridge.ts`** - Subsystem bridging

---

## 🎯 Next Steps

1. **Integrate into server/index.ts** - Add initialization call
2. **Update agent services** - Add bus subscriptions and publishing
3. **Wire coordinator messages** - Bridge coordinator topics
4. **Wire gateway messages** - Bridge gateway types
5. **Test end-to-end** - Verify all message flows
6. **Monitor in production** - Use `/api/bus/health` and metrics
7. **Set up alerts** - Use Prometheus metrics for alerting
8. **Add security** - Protect observability endpoints as needed

---

## ✨ Key Features Summary

| Feature | Status | Benefit |
|---------|--------|---------|
| Unified Message Bus | ✅ | Single source of truth for all agent communication |
| Priority Queues | ✅ | Deterministic message ordering |
| TTL Enforcement | ✅ | Automatic expiration, no stale messages |
| Dead Letter Queue | ✅ | Visibility into failed messages |
| Redis Persistence | ✅ | Message recovery on restart |
| Cross-Process Support | ✅ | Multi-replica deployments |
| Prometheus Metrics | ✅ | Production monitoring |
| HTTP Endpoints | ✅ | Easy debugging and monitoring |
| Bridging | ✅ | Unified all subsystems |
| Request-Response | ✅ | Async request-reply with correlation |
| No Silent Drops | ✅ | All failures visible |
| Broadcast Patterns | ✅ | Fan-out messaging |

---

**Questions?** Refer to `AGENT_COMMUNICATION_ENHANCED.md` for comprehensive guide.
