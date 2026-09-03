
# Enhanced Agent Communication System - Complete Guide

**Version:** 2.0  
**Date:** 2026-08-13  
**Status:** Production Ready

---

## 🎯 Executive Summary

The Enhanced Agent Communication System unifies all message-based communication across MtaaDAO through a single, production-ready message bus with:

- **Unified Messaging**: Single bus bridges main agent framework, coordinator subsystem, and gateway subsystem
- **Persistence & Durability**: Redis-backed message persistence with automatic recovery on restart
- **Priority & TTL Enforcement**: Priority-based delivery queues with automatic expiration
- **Dead Letter Queue**: Automatic handling of undeliverable messages
- **Comprehensive Observability**: Prometheus metrics + HTTP endpoints for monitoring
- **Cross-Process Support**: Redis pub/sub for distributed deployments

---

## 🏗️ Architecture Overview

### Three Message Bus Subsystems (Now Unified)

```
┌─────────────────────────────────────────────────────────────┐
│        Enhanced Unified Message Bus (Redis-backed)          │
│  server/core/agent-framework/enhanced-message-bus.ts        │
└──────┬─────────────────────────────┬─────────────────────────┘
       │                             │
   ┌───┴────────────────────┐   ┌────┴──────────────────────┐
   │   Main Agent Framework │   │   Bridged Subsystems     │
   │  (analyzer, defender,  │   │ ┌──────────┐  ┌────────┐ │
   │   synchronizer, etc.)  │   │ │Coordinator│  │Gateway │ │
   │                        │   │ │  (elders) │  │        │ │
   │ ✓ Priority Queues      │   │ └──────────┘  └────────┘ │
   │ ✓ TTL Enforcement      │   │  Via Adapters            │
   │ ✓ Correlation IDs      │   │ ✓ Topic Mapping          │
   │ ✓ Request-Response     │   │ ✓ Type Conversion        │
   │ ✓ Broadcast Patterns   │   │ ✓ Transparent Bridging   │
   └────────────────────────┘   └──────────────────────────┘
```

### Key Components

```
server/core/agent-framework/
├── enhanced-message-bus.ts          # Core bus with priority/TTL
├── message-bus-metrics.ts           # Prometheus metrics exporter
├── message-bus-observability.ts     # HTTP observability endpoints
├── message-bus-bridge.ts            # Bridging adapters
├── message-bus-init.ts              # Easy initialization
└── MESSAGE_BUS_INTEGRATION_GUIDE.ts # Complete integration guide
```

---

## 🚀 Quick Start Integration

### Add to server/index.ts

```typescript
import { initializeMessageBusSystem } from './core/agent-framework/message-bus-init';

// Early in async startup (after Express app, before routes)
const {
  messageBus,
  metricsExporter,
  bridge,
  coordinatorBridge,
  gatewayBridge,
} = await initializeMessageBusSystem(app);

// Make available globally
app.locals.messageBus = messageBus;
app.locals.messageBusMetrics = metricsExporter;
```

### Environment Variables

```bash
# Redis persistence
ENABLE_MESSAGE_BUS_PERSISTENCE=true
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_DB=0

# Observability
ENABLE_BUS_METRICS=true
MESSAGE_BUS_OBSERVABILITY_PATH=/api/bus

# Distributed mode (cross-process messaging via Redis)
ENABLE_DISTRIBUTED_BUS=false  # Enable if running multiple replicas
```

---

## 📨 Publishing Messages

### Basic Publish

```typescript
import { getGlobalMessageBus, MessageType } from '@/core/agent-framework/enhanced-message-bus';

const bus = getGlobalMessageBus();

await bus.publish({
  id: 'msg-123',
  from: 'my-agent',
  to: 'broadcast',  // or specific agent ID
  type: MessageType.RISK_ASSESSMENT,
  payload: { riskLevel: 'high', details: {...} },
  timestamp: new Date(),
  priority: 'high',  // 'low' | 'medium' | 'high' | 'critical'
  requiresResponse: false,
  ttl: 300000,  // 5 minutes
  subsystem: 'agent-framework',
});
```

### Request-Response Pattern

```typescript
const bus = getGlobalMessageBus();

// Sender
try {
  const response = await bus.request(
    {
      from: 'analyzer',
      to: 'nuru-ai',
      type: MessageType.ANALYSIS_REQUEST,
      payload: { data: 'analyze this' },
      requiresResponse: true,
      priority: 'high',
      ttl: 10000,
    },
    5000  // 5 second timeout
  );
  console.log('Got response:', response);
} catch (error) {
  console.error('Request failed or timed out:', error);
}

// Responder
bus.subscribe('nuru-ai', [MessageType.ANALYSIS_REQUEST], async (message) => {
  // Process request
  const result = await analyze(message.payload);
  
  // Send response
  await bus.respond(message.correlationId!, result);
});
```

### Broadcast Message

```typescript
const bus = getGlobalMessageBus();

await bus.broadcast(
  MessageType.HEALTH_CHECK,
  { status: 'healthy', timestamp: new Date() },
  'health-monitor',
  'high'  // priority
);
```

---

## 🔌 Subscribing to Messages

### Basic Subscription

```typescript
const bus = getGlobalMessageBus();

bus.subscribe(
  'my-agent-id',
  [
    MessageType.RISK_ASSESSMENT,
    MessageType.THREAT_DETECTED,
    MessageType.PRICE_UPDATE,
  ],
  async (message) => {
    console.log(`Received ${message.type} from ${message.from}`);
    
    // Process message
    switch (message.type) {
      case MessageType.RISK_ASSESSMENT:
        await handleRiskAssessment(message.payload);
        break;
      case MessageType.THREAT_DETECTED:
        await handleThreat(message.payload);
        break;
    }
  }
);
```

### Unsubscribe

```typescript
// From specific message types
bus.unsubscribe('my-agent-id', [MessageType.RISK_ASSESSMENT]);

// From all subscriptions
bus.unsubscribe('my-agent-id');
```

---

## 🌉 Bridging Coordinator Messages

The coordinator subsystem messages are automatically bridged into the unified bus. To bridge a coordinator message:

```typescript
import { getGlobalMessageBus } from '@/core/agent-framework/enhanced-message-bus';
import { MessageBusBridge } from '@/core/agent-framework/message-bus-bridge';

const bus = getGlobalMessageBus();
const bridge = new MessageBusBridge(bus);
const coordinatorBridge = bridge.getCoordinatorBridge();

// Bridge a coordinator message to main bus
await coordinatorBridge.bridgeMessage({
  id: 'coord-123',
  topic: 'scry:threat-detected',  // Automatically maps to MessageType
  from: 'SCRY',
  to: 'ALL',
  data: { threatLevel: 'critical' },
  priority: 'critical',
  timestamp: new Date(),
});

// Subscribe to coordinator messages (will receive in main bus format)
coordinatorBridge.subscribe('scry:threat-detected', async (message) => {
  console.log('Threat from SCRY:', message.data);
});
```

### Coordinator Message Types Mapped

| Topic | Maps to MessageType |
|-------|-------------------|
| `scry:threat-detected` | `SCRY_THREAT_DETECTED` |
| `scry:forecast-updated` | `SCRY_FORECAST_UPDATED` |
| `scry:analysis-complete` | `SCRY_ANALYSIS_COMPLETE` |
| `kaizen:recommendation-generated` | `KAIZEN_RECOMMENDATION_GENERATED` |
| `kaizen:optimization-applied` | `KAIZEN_OPTIMIZATION_APPLIED` |
| `lumen:review-complete` | `LUMEN_REVIEW_COMPLETE` |
| `coordinator:consensus-request` | `COORDINATOR_CONSENSUS_REQUEST` |

---

## 🌐 Bridging Gateway Messages

Gateway subsystem messages are also automatically bridged:

```typescript
const gatewayBridge = bridge.getGatewayBridge();

// Bridge a gateway message
await gatewayBridge.bridgeMessage({
  id: 'gw-123',
  type: 'gateway:price_update',
  from: 'gateway',
  payload: { symbol: 'USDC', price: 1.001 },
  timestamp: new Date(),
});

// Subscribe to gateway messages
gatewayBridge.subscribe('gateway:price_update', async (message) => {
  console.log('Price updated:', message.payload);
});
```

### Gateway Message Types Mapped

| Type | Maps to MessageType |
|------|-------------------|
| `gateway:price_request` | `GATEWAY_PRICE_REQUEST` |
| `gateway:price_update` | `GATEWAY_PRICE_UPDATE` |
| `gateway:liquidity_request` | `GATEWAY_LIQUIDITY_REQUEST` |
| `gateway:liquidity_update` | `GATEWAY_LIQUIDITY_UPDATE` |
| `gateway:execution_request` | `GATEWAY_EXECUTION_REQUEST` |
| `gateway:execution_response` | `GATEWAY_EXECUTION_RESPONSE` |

---

## 📊 Monitoring & Observability

### HTTP Endpoints

Once initialized, the following endpoints are available at `/api/bus`:

#### Health Check
```
GET /api/bus/health

Response:
{
  "status": "healthy",
  "uptime": 1234.5,
  "bus": {
    "connected": true,
    "redisConnected": true,
    "subscriberCount": 12,
    "pendingResponses": 2
  },
  "metrics": {
    "totalPublished": 5234,
    "totalDelivered": 5200,
    "totalFailed": 3,
    "failureRate": 0.06
  }
}
```

#### Statistics
```
GET /api/bus/stats

Shows detailed stats including message distribution, performance metrics, queue depths
```

#### Message History
```
GET /api/bus/history?limit=100&type=RISK_ASSESSMENT

Shows recent messages with optional filtering
```

#### Dead Letter Queue
```
GET /api/bus/dlq?limit=100

Shows messages that failed delivery
```

#### Retry Failed Message
```
POST /api/bus/dlq/:id/retry

Republishes a message from the DLQ
```

#### Message Details
```
GET /api/bus/message/:id

Shows details for a specific message
```

#### Message Types
```
GET /api/bus/message-types

Shows all message types and their activity
```

#### Subscribers
```
GET /api/bus/subscribers?type=RISK_ASSESSMENT

Shows subscriber information
```

#### Alerts
```
GET /api/bus/alerts

Shows current alerts and warnings based on metrics
```

#### Prometheus Metrics
```
GET /api/bus/metrics

Prometheus-format metrics for Grafana/monitoring
```

### Prometheus Metrics Exported

Key metrics available:

- `mtaa_bus_messages_published_total` - Total messages published
- `mtaa_bus_messages_delivered_total` - Successfully delivered
- `mtaa_bus_messages_failed_total` - Delivery failures
- `mtaa_bus_messages_expired_total` - Expired messages
- `mtaa_bus_messages_dlq_total` - Messages in DLQ
- `mtaa_bus_delivery_duration_ms` - Delivery time histogram
- `mtaa_bus_request_timeouts_total` - Request timeouts
- `mtaa_bus_pending_responses` - Pending request-responses
- `mtaa_bus_queue_depth` - Priority queue depth by level
- `mtaa_bus_redis_connected` - Redis connection status

---

## 🎯 Priority Levels

Messages are processed in strict priority order:

1. **critical** - Immediate processing, highest priority
2. **high** - Fast processing, high priority
3. **medium** - Normal processing
4. **low** - Deferred processing, lowest priority

```typescript
await bus.publish({
  // ...
  priority: 'critical',  // Will be processed first
  ttl: 5000,            // But only for 5 seconds
});
```

---

## ⏰ TTL & Expiration

Messages automatically expire based on TTL:

```typescript
await bus.publish({
  // ...
  ttl: 300000,  // 5 minutes in milliseconds
  
  // Bus automatically sets expiresAt = Date.now() + ttl
  // Messages are dropped if expired before delivery
});
```

- Default TTL: 5 minutes (300000ms)
- Messages checked for expiration before delivery
- Expired messages counted in metrics
- Configurable per message

---

## 💾 Persistence & Recovery

With Redis enabled:

- Messages persisted with TTL-based keys
- Automatic recovery on restart
- Undelivered messages reloaded on server restart
- Distributed deployments share message bus via Redis pub/sub
- Set `ENABLE_DISTRIBUTED_BUS=true` for multi-replica deployments

```typescript
// Persisted message
await redis.setex(
  'mtaa:msg:pending:msg-123',
  300,  // TTL in seconds
  JSON.stringify(message)
);
```

---

## 🚨 Dead Letter Queue

Messages that fail delivery are moved to DLQ:

- **Max DLQ Size**: 5,000 messages
- **Retry Limit**: 3 delivery attempts by default
- **Accessible via**: `/api/bus/dlq`
- **Retryable**: Use `/api/bus/dlq/:id/retry` endpoint

```typescript
// Automatically triggered for undeliverable messages
messageBus.on('dlq-message', (event) => {
  logger.error(`Message in DLQ: ${event.reason}`);
  // Send alert, write to database, etc.
});
```

---

## ⚠️ Silent Message Drop Prevention

The enhanced bus prevents silent drops:

- **Alert on no subscribers**: Emits `no-subscribers` event
- **DLQ for undeliverable**: Failed messages visible in DLQ
- **Metrics tracking**: All drops counted and visible
- **HTTP endpoint**: Query history of dropped messages

```typescript
messageBus.on('no-subscribers', (event) => {
  logger.warn(`No subscribers for ${event.messageType}`);
  // Alert ops, add monitoring, etc.
});
```

---

## 🔄 Main Agent Framework Integration

All main agents (Analyzer, Defender, Synchronizer) automatically subscribe to the bus:

```typescript
// In analyzer initialization
messageBus.subscribe(
  'analyzer',
  [
    MessageType.HEALTH_CHECK,
    MessageType.PRICE_UPDATE,
    MessageType.TRANSACTION_EVENT,
  ],
  async (message) => {
    // Process based on type
  }
);

// Publishing risk assessments
await messageBus.publish({
  from: 'analyzer',
  to: 'broadcast',
  type: MessageType.RISK_ASSESSMENT,
  payload: { risk: analysis },
  priority: 'high',
});
```

---

## 📋 Complete Message Types

```typescript
export enum MessageType {
  // Analyzer
  FRAUD_ALERT = 'fraud_alert',
  ANOMALY_DETECTED = 'anomaly_detected',
  TREASURY_HEALTH = 'treasury_health',
  RISK_ASSESSMENT = 'risk_assessment',
  NODE_PROFILE = 'node_profile',
  
  // Synchronizer
  STATE_SYNC = 'state_sync',
  DRIFT_DETECTED = 'drift_detected',
  ROLLBACK_REQUEST = 'rollback_request',
  CHECKPOINT_CREATED = 'checkpoint_created',
  SYNC_BEAT = 'sync_beat',
  
  // Defender
  THREAT_DETECTED = 'threat_detected',
  QUARANTINE_USER = 'quarantine_user',
  RELEASE_USER = 'release_user',
  ETHICAL_REVIEW = 'ethical_review',
  DEFENSE_ACTION = 'defense_action',
  
  // AI Layer
  ANALYSIS_REQUEST = 'analysis_request',
  ANALYSIS_RESPONSE = 'analysis_response',
  ACTION_REQUIRED = 'action_required',
  NOTIFICATION = 'notification',
  USER_QUERY = 'user_query',
  
  // Coordinator (bridged)
  SCRY_THREAT_DETECTED = 'scry:threat-detected',
  KAIZEN_RECOMMENDATION_GENERATED = 'kaizen:recommendation-generated',
  LUMEN_REVIEW_COMPLETE = 'lumen:review-complete',
  COORDINATOR_DECISION_MADE = 'coordinator:decision-made',
  
  // Gateway (bridged)
  GATEWAY_PRICE_REQUEST = 'gateway:price_request',
  GATEWAY_PRICE_UPDATE = 'gateway:price_update',
  GATEWAY_LIQUIDITY_UPDATE = 'gateway:liquidity_update',
  GATEWAY_EXECUTION_REQUEST = 'gateway:execution_request',
  
  // System
  AGENT_ONLINE = 'agent_online',
  AGENT_OFFLINE = 'agent_offline',
  HEALTH_CHECK = 'health_check',
  METRICS_UPDATE = 'metrics_update',
  PRICE_UPDATE = 'price_update',
  LIQUIDITY_UPDATE = 'liquidity_update',
  TRANSACTION_EVENT = 'transaction_event',
}
```

---

## 🛠️ Troubleshooting

### Redis Connection Issues

```
Warning: Failed to connect to Redis - message bus will operate without persistence

Solution:
1. Check REDIS_HOST and REDIS_PORT environment variables
2. Ensure Redis is running: redis-cli ping
3. Verify network connectivity to Redis
4. Messages will still work, but won't persist across restarts
```

### High Failure Rate

```
Alert: Message failure rate is high: 15.2%

Check:
1. GET /api/bus/alerts for specific issues
2. GET /api/bus/dlq to see undeliverable messages
3. GET /api/bus/message-types to see subscriber counts
4. Add message type subscribers if missing
```

### Request Timeouts

```
Warning: Request timeouts detected: 5

Solution:
1. Increase timeout in bus.request() call
2. Check if responder is subscribed
3. Verify responder is calling bus.respond()
4. Check if message is expiring before response sent
```

### DLQ Growing

```
Alert: Dead Letter Queue size is high: 2456

Solution:
1. Review messages in DLQ
2. Fix subscriber or routing issues
3. Use /api/bus/dlq/:id/retry to republish
4. Monitor via /api/bus/alerts
```

---

## 📚 Additional Resources

- **Integration Guide**: `MESSAGE_BUS_INTEGRATION_GUIDE.ts`
- **Example Usage**: Check `server/routes/analyzer.ts`, `server/routes/defender.ts`
- **Source Code**: `server/core/agent-framework/`

---

## Summary

The Enhanced Unified Message Bus provides a production-ready, observable, and durable communication backbone for all MtaaDAO agents and subsystems with:

✅ Single unified bus (no more isolated message buses)  
✅ Redis persistence for recovery  
✅ Priority queues for deterministic ordering  
✅ TTL enforcement for automatic expiration  
✅ Dead letter queue for failed messages  
✅ Comprehensive HTTP observability  
✅ Prometheus metrics for monitoring  
✅ Automatic bridging of coordinator and gateway subsystems  
✅ No silent message drops  
✅ Cross-process support for distributed deployments  
