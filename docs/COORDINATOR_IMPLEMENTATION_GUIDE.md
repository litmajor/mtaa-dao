# Elder Coordinator System - Complete Implementation Guide

## 📋 Overview

The **Elder Coordinator** is the central hub for inter-elder communication and consensus decision-making. It orchestrates communication between:

- **ELD-SCRY** (Security/Threat Detection)
- **ELD-KAIZEN** (Performance/Optimization)
- **ELD-LUMEN** (Ethics/Compliance)

The coordinator synthesizes inputs from all three elders into unified governance decisions.

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Frontend (React)                        │
│         CoordinatorDashboard Component                      │
│  ─────────────────────────────────────────────────────────  │
│  • Real-time WebSocket connection                           │
│  • Visualizes elder consensus decisions                     │
│  • Shows message bus activity                               │
│  • Displays coordinator status                              │
└──────────────────────┬──────────────────────────────────────┘
                       │
        ┌──────────────┴──────────────┐
        │                             │
    WebSocket                      REST API
   (Real-time)               (/api/coordinator/*)
        │                             │
┌───────▼─────────────────────────────▼──────────┐
│         Backend Coordinator Layer               │
├────────────────────────────────────────────────┤
│                                                │
│  ┌─────────────────────────────────────────┐  │
│  │   ElderCoordinator (Main Orchestrator)   │  │
│  │  • Collects elder assessments           │  │
│  │  • Synthesizes consensus                │  │
│  │  • Emits coordination events            │  │
│  └─────────────────────────────────────────┘  │
│                                                │
│  ┌─────────────────────────────────────────┐  │
│  │   CoordinatorMessageBus (Pub/Sub)        │  │
│  │  • Publishes messages between elders    │  │
│  │  • Maintains message history            │  │
│  │  • Manages subscriptions                │  │
│  └─────────────────────────────────────────┘  │
│                                                │
│  ┌─────────────────────────────────────────┐  │
│  │   CoordinatorWebSocketHandler            │  │
│  │  • Real-time event broadcasting         │  │
│  │  • Client subscription management       │  │
│  │  • Live decision updates                │  │
│  └─────────────────────────────────────────┘  │
└────────────┬─────────────────┬────────────────┘
             │                 │
     ┌───────▼───────┐ ┌──────▼────────┐
     │               │ │               │
 ┌───▼──┐   ┌───┐  ┌─▼───┐  ┌────┐  ┌─▼───┐
 │ SCRY │   │ │ │  │KAIZEN│  │    │  │LUMEN│
 │(Info)│   │ │ │  │(Opt) │  │    │  │(Eth)│
 └──────┘   └─┘ │  └──────┘  │    │  └─────┘
             └──┘
```

---

## 🔌 Core Components

### 1. **ElderCoordinator** (`coordinator/index.ts`)

Main orchestrator class that manages inter-elder communication.

#### Key Methods:

```typescript
// Get consensus on a proposal from all three elders
async getElderConsensus(daoId: string, proposal: any): Promise<ElderConsensus>

// Get coordinator status and health
getStatus(): CoordinatorStatus

// Get all decisions for a DAO
getDaoDecisions(daoId: string): CoordinatedDecision[]

// Update heartbeat for health monitoring
heartbeat(): void
```

#### Events Emitted:

- `coordinator:ready` - Coordinator initialized
- `coordinator:consensus` - New consensus generated
- `coordinator:scry:alert` - SCRY alert received
- `coordinator:kaizen:recommendation` - KAIZEN recommendation received
- `coordinator:lumen:review` - LUMEN review received
- `coordinator:shutdown` - Coordinator shutting down

### 2. **CoordinatorMessageBus** (`coordinator/message-bus.ts`)

Publish/subscribe message passing system for elder communication.

#### Key Methods:

```typescript
// Subscribe to messages
subscribe(topic: MessageTopic, handler: MessageHandler): string

// Publish to message bus
async publishMessage(message: CoordinatorMessage): Promise<void>

// Broadcast to all subscribers
async broadcast(topic: MessageTopic, data: any, from: ElderType, ...): Promise<void>

// Send point-to-point message
async sendMessage(topic: MessageTopic, from: ElderType, to: ElderType, data: any): Promise<void>

// Send critical alert
async sendCriticalAlert(topic: MessageTopic, from: ElderType, data: any): Promise<void>

// Get message history
getHistory(topic?: MessageTopic, limit?: number): CoordinatorMessage[]

// Get DAO message history
getDaoHistory(daoId: string, limit?: number): CoordinatorMessage[]
```

#### Message Topics:

- `scry:threat-detected`
- `scry:forecast-updated`
- `scry:analysis-complete`
- `kaizen:recommendation-generated`
- `kaizen:optimization-applied`
- `kaizen:metrics-updated`
- `lumen:review-complete`
- `lumen:ethics-violation-detected`
- `lumen:compliance-status-updated`
- `coordinator:consensus-request`
- `coordinator:decision-made`
- `coordinator:alert-escalated`

### 3. **CoordinatorWebSocketHandler** (`websocket/coordinator-websocket.ts`)

Real-time event broadcasting to frontend clients.

#### Features:

- Authenticated WebSocket connections
- Topic-based subscriptions
- Real-time consensus updates
- Message bus event broadcasting
- Client subscription tracking

#### Events:

**Server → Client:**
- `coordinator:connected` - Initial connection confirmation
- `coordinator:status` - Coordinator status updates
- `coordinator:consensus` - Consensus decisions
- `coordinator:consensus-response` - Response to consensus request
- `message-bus:message-published` - Message bus updates
- `coordinator:error` - Error notifications

**Client → Server:**
- `coordinator:subscribe` - Subscribe to topic
- `coordinator:unsubscribe` - Unsubscribe from topic
- `coordinator:request-consensus` - Request consensus evaluation
- `coordinator:ping` - Health check

---

## 📡 REST API Endpoints

### **GET /api/coordinator/status**
Get current coordinator status
```bash
curl -H "Authorization: Bearer {token}" \
  http://localhost:5000/api/coordinator/status
```

### **GET /api/coordinator/consensus**
Get elder consensus on a proposal
```bash
curl -H "Authorization: Bearer {token}" \
  "http://localhost:5000/api/coordinator/consensus?daoId=dao-123&proposalId=prop-456"
```

### **GET /api/coordinator/message-bus/stats**
Get message bus statistics (superuser only)
```bash
curl -H "Authorization: Bearer {token}" \
  http://localhost:5000/api/coordinator/message-bus/stats
```

### **GET /api/coordinator/message-bus/history**
Get message history (superuser only)
```bash
curl -H "Authorization: Bearer {token}" \
  "http://localhost:5000/api/coordinator/message-bus/history?limit=100"
```

### **POST /api/coordinator/message**
Publish message to bus (superuser only)
```bash
curl -X POST -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{
    "topic": "scry:threat-detected",
    "from": "SCRY",
    "data": { "threatLevel": "high" },
    "daoId": "dao-123"
  }' \
  http://localhost:5000/api/coordinator/message
```

### **POST /api/coordinator/critical-alert**
Send critical alert (superuser only)
```bash
curl -X POST -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{
    "from": "SCRY",
    "data": { "threatLevel": "critical" },
    "daoId": "dao-123"
  }' \
  http://localhost:5000/api/coordinator/critical-alert
```

### **GET /api/coordinator/health**
Health check (public)
```bash
curl http://localhost:5000/api/coordinator/health
```

---

## 🎨 Frontend Integration

### Using the CoordinatorDashboard Component

```typescript
import { CoordinatorDashboard } from '@/components/coordinator/CoordinatorDashboard';

export default function CoordinatorPage() {
  return <CoordinatorDashboard />;
}
```

### Features:

- ✅ Real-time WebSocket connection
- ✅ Coordinator status display
- ✅ Decision statistics (approved/rejected)
- ✅ Recent consensus decisions with detailed breakdown
- ✅ Message bus activity feed
- ✅ Detailed consensus view with all elder assessments
- ✅ Automatic reconnection on disconnect
- ✅ Topic-based message filtering

---

## 🔄 How Consensus Works

### Step 1: Request Consensus

Frontend requests consensus on a proposal:

```typescript
const consensus = await coordinatorService.getConsensus(daoId, proposalId);
```

### Step 2: Coordinator Collects Assessments

```
Coordinator
├─ Requests SCRY: Is it safe?
├─ Requests KAIZEN: Is it beneficial?
└─ Requests LUMEN: Is it ethical?
```

### Step 3: Elder Assessments

**SCRY Response:**
```json
{
  "isSafe": true,
  "threatLevel": "low",
  "confidence": 0.85,
  "concerns": []
}
```

**KAIZEN Response:**
```json
{
  "isBeneficial": true,
  "improvementPotential": 0.75,
  "confidence": 0.80
}
```

**LUMEN Response:**
```json
{
  "isEthical": true,
  "ethicalScore": 0.82,
  "confidence": 0.78
}
```

### Step 4: Synthesis

Coordinator synthesizes into unified decision:

```json
{
  "canApprove": true,           // All three approve
  "overallConfidence": 0.81,    // Average confidence
  "requiresReview": false,
  "reasoning": {
    "scryPoint": "Security assessment passed",
    "kaizenPoint": "High optimization potential",
    "lumenPoint": "Ethical standards met"
  }
}
```

---

## 📊 Message Bus Communication Pattern

### Example: SCRY Sends Threat Alert

```typescript
// 1. SCRY detects threat
const threat = { level: 'high', type: 'anomaly' };

// 2. Publishes to bus
await coordinatorMessageBus.sendCriticalAlert(
  'scry:threat-detected',
  'SCRY',
  threat,
  daoId
);

// 3. All subscribers receive (KAIZEN, LUMEN, COORDINATOR)
coordinatorMessageBus.subscribe('scry:threat-detected', (msg) => {
  console.log('Alert from SCRY:', msg.data);
  // Take appropriate action
});
```

---

## 🔐 Security

### Authentication

All endpoints require JWT token (except `/health`):

```bash
Authorization: Bearer {jwt_token}
```

### Authorization

- **Public endpoints**: `/health`
- **Authenticated (any user)**: `/status`, `/consensus` (own DAO only)
- **Superuser only**: Message bus endpoints, critical alerts

### Data Isolation

- Users can only request consensus for DAOs they belong to
- Message history scoped by DAO
- Superusers have full visibility

---

## 🔄 WebSocket Real-Time Updates

### Client Connection Example

```typescript
import io from 'socket.io-client';

const socket = io('http://localhost:5000', {
  auth: {
    token: localStorage.getItem('token')
  }
});

socket.on('coordinator:consensus', (event) => {
  console.log('New consensus:', event.data);
  // Update UI with new decision
});

socket.on('message-bus:message-published', (event) => {
  console.log('Message published:', event.data);
});

// Subscribe to specific topics
socket.emit('coordinator:subscribe', { topic: 'coordinator:consensus' });

// Request consensus
socket.emit('coordinator:request-consensus', {
  daoId: 'dao-123',
  proposalId: 'prop-456'
});
```

---

## 🚀 Setup & Integration

### 1. Install Dependencies

```bash
npm install socket.io socket.io-client eventemitter3
```

### 2. Import in Server

```typescript
// server.ts
import { elderCoordinator } from './core/elders/coordinator';
import { coordinatorMessageBus } from './core/elders/coordinator/message-bus';
import { createCoordinatorWebSocketHandler } from './websocket/coordinator-websocket';
import coordinatorRoutes from './routes/coordinator';

// Mount routes
app.use('/api/coordinator', coordinatorRoutes);

// Setup WebSocket (after creating HTTP server)
const httpServer = createServer(app);
createCoordinatorWebSocketHandler(httpServer);

// Start elders and coordinator
await eldScry.start();
await eldKaizen.start();
await eldLumen.start();
```

### 3. Mount in Router

```typescript
// server/routes/index.ts
import coordinatorRoutes from './coordinator';

router.use('/coordinator', coordinatorRoutes);
```

---

## 📈 Monitoring & Debugging

### Get Coordinator Stats

```bash
curl -H "Authorization: Bearer {token}" \
  http://localhost:5000/api/coordinator/status
```

Response:
```json
{
  "status": "online",
  "coordinatorHealth": {
    "eldersConnected": 3,
    "messageQueueSize": 0,
    "uptime": 3600000
  },
  "recentDecisions": {
    "total": 42,
    "approved": 35,
    "rejected": 7
  }
}
```

### View Message History

```bash
curl -H "Authorization: Bearer {token}" \
  "http://localhost:5000/api/coordinator/message-bus/history?limit=50"
```

### Monitor WebSocket Connections

```typescript
const wsHandler = getCoordinatorWebSocketHandler();
const stats = wsHandler.getSubscriptionStats();
console.log(`Connected clients: ${stats.totalClients}`);
console.log(`Subscriptions by topic:`, stats.byTopic);
```

---

## 🧪 Testing the Coordinator

### Test Consensus Request

```typescript
import { elderCoordinator } from './core/elders/coordinator';

// Request consensus on a proposal
const consensus = await elderCoordinator.getElderConsensus(
  'dao-test-123',
  { proposalId: 'prop-456', amount: 1000 }
);

console.log('Consensus result:', consensus);
console.log('Can approve:', consensus.consensusDecision.canApprove);
```

### Test Message Bus

```typescript
import { coordinatorMessageBus } from './core/elders/coordinator/message-bus';

// Subscribe
const subId = coordinatorMessageBus.subscribe(
  'scry:threat-detected',
  async (msg) => {
    console.log('Threat alert:', msg.data);
  }
);

// Publish
await coordinatorMessageBus.broadcast(
  'scry:threat-detected',
  { threatLevel: 'high', type: 'anomaly' },
  'COORDINATOR'
);
```

---

## 🏃 Performance Considerations

### Message Bus Optimization

- **Max history**: 10,000 messages (configurable)
- **Delivery attempts**: 3 with exponential backoff for critical messages
- **Topics**: Filtered subscriptions for efficient routing

### WebSocket Optimization

- **Auto-reconnection**: 5 attempts with 1-5 second delays
- **Room-based messaging**: Only subscribers to a topic receive messages
- **Subscription tracking**: Efficient client-side state management

### Consensus Evaluation

- **Parallel assessment**: All three elders evaluated concurrently
- **Caching**: Elder status cached to avoid repeated queries
- **Confidence scoring**: Weighted average for reliable decisions

---

## 🔗 Integration with Elders

### Receiving Elder Updates

Coordinator automatically listens to elder events:

```typescript
elderCoordinator.on('coordinator:scry:alert', (data) => {
  // Handle SCRY alert
});

elderCoordinator.on('coordinator:kaizen:recommendation', (data) => {
  // Handle KAIZEN recommendation
});

elderCoordinator.on('coordinator:lumen:review', (data) => {
  // Handle LUMEN review
});
```

### Broadcasting to Elders

Publish messages for elders to consume:

```typescript
await coordinatorMessageBus.broadcast(
  'coordinator:consensus-request',
  {
    daoId: 'dao-123',
    proposal: { /* details */ }
  },
  'COORDINATOR'
);
```

---

## 📚 Files Created

```
server/
├── core/elders/coordinator/
│   ├── index.ts                    # ElderCoordinator main class
│   └── message-bus.ts              # CoordinatorMessageBus class
├── routes/
│   └── coordinator.ts              # API routes
└── websocket/
    └── coordinator-websocket.ts    # WebSocket handler

client/
└── src/components/coordinator/
    └── CoordinatorDashboard.tsx    # Frontend dashboard
```

---

## 🎯 Next Steps

1. ✅ **Coordinator Framework** - Implemented
2. ✅ **Message Bus** - Implemented
3. ✅ **API Routes** - Implemented
4. ✅ **WebSocket Handler** - Implemented
5. ✅ **Dashboard Component** - Implemented
6. **Deploy to production**
7. **Monitor consensus decisions**
8. **Optimize based on usage patterns**
9. **Add analytics dashboard**
10. **Implement coordinator metrics**

---

## 📞 Support

For issues or questions:
- Check coordinator status: `/api/coordinator/status`
- Review message history: `/api/coordinator/message-bus/history`
- Check WebSocket stats via admin dashboard
- Monitor elder health through individual elder endpoints

---

**Status**: ✅ Elder Coordinator System Ready for Production
