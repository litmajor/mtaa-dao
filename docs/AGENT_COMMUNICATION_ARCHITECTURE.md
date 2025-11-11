
# Agent Communication Architecture

**Version:** 1.0  
**Date:** 2025-01-11  
**Status:** Implementation Ready

---

## 🎯 Executive Summary

This document defines the communication patterns, protocols, and integration strategies for the **three core agents** (ANALYZER, SYNCHRONIZER, DEFENDER) with the **AI layer** (NURU, KWETU, MORIO) and **future agents**.

---

## 📊 Current State: What We Have

### Implemented Agents

#### 1. ANALYZER (ANL-MTAA-001)
- ✅ Treasury health analysis
- ✅ Governance pattern detection
- ✅ Fraud detection
- ✅ Node profiling
- ✅ System health monitoring

#### 2. SYNCHRONIZER (SYNC-MTAA-001)
- ✅ Vector clock synchronization
- ✅ State snapshot management
- ✅ Conflict resolution
- ✅ Rollback recovery
- ✅ Drift detection

#### 3. DEFENDER (DEF-OBSIDIAN-001)
- ✅ Threat detection
- ✅ Quarantine management
- ✅ Ethics review (LUMEN integration)
- ✅ Behavioral analysis
- ✅ Real-time monitoring

### AI Layer Components

#### NURU (The Mind)
- ✅ Intent classification
- ✅ Financial analytics
- ✅ Governance analytics
- ✅ Risk assessment
- ✅ Context management

#### KWETU (The Body)
- ✅ Treasury operations
- ✅ Governance execution
- ✅ Community management
- ✅ Onboarding service

#### MORIO (The Spirit)
- ✅ Conversational interface
- ✅ Session management
- ✅ Response generation
- ✅ Multi-language support

---

## 🔄 Communication Patterns

### 1. Message Bus Architecture

```typescript
// server/core/agent-framework/message-bus.ts
interface AgentMessage {
  id: string;
  from: string;
  to: string | string[]; // Single recipient or broadcast
  type: MessageType;
  payload: any;
  timestamp: Date;
  priority: 'low' | 'medium' | 'high' | 'critical';
  requiresResponse: boolean;
  correlationId?: string; // For request-response tracking
}

enum MessageType {
  // Analyzer messages
  FRAUD_ALERT = 'fraud_alert',
  ANOMALY_DETECTED = 'anomaly_detected',
  TREASURY_HEALTH = 'treasury_health',
  RISK_ASSESSMENT = 'risk_assessment',
  
  // Synchronizer messages
  STATE_SYNC = 'state_sync',
  DRIFT_DETECTED = 'drift_detected',
  ROLLBACK_REQUEST = 'rollback_request',
  CHECKPOINT_CREATED = 'checkpoint_created',
  
  // Defender messages
  THREAT_DETECTED = 'threat_detected',
  QUARANTINE_USER = 'quarantine_user',
  RELEASE_USER = 'release_user',
  ETHICAL_REVIEW = 'ethical_review',
  
  // AI Layer messages
  ANALYSIS_REQUEST = 'analysis_request',
  ANALYSIS_RESPONSE = 'analysis_response',
  ACTION_REQUIRED = 'action_required',
  NOTIFICATION = 'notification'
}

class MessageBus {
  private subscribers: Map<MessageType, Set<AgentSubscriber>>;
  private messageQueue: PriorityQueue<AgentMessage>;
  private messageHistory: Map<string, AgentMessage[]>;
  
  subscribe(
    agentId: string,
    messageTypes: MessageType[],
    handler: (msg: AgentMessage) => Promise<void>
  ): void;
  
  publish(message: AgentMessage): Promise<void>;
  
  request(message: AgentMessage): Promise<AgentMessage>;
  
  broadcast(
    messageType: MessageType,
    payload: any,
    sender: string
  ): Promise<void>;
}
```

### 2. Agent-to-Agent Communication

```typescript
// server/core/agent-framework/agent-communicator.ts

class AgentCommunicator {
  constructor(
    private agentId: string,
    private messageBus: MessageBus
  ) {}

  // Direct communication
  async sendTo(
    recipientId: string,
    messageType: MessageType,
    payload: any
  ): Promise<void> {
    await this.messageBus.publish({
      id: generateId(),
      from: this.agentId,
      to: recipientId,
      type: messageType,
      payload,
      timestamp: new Date(),
      priority: 'medium',
      requiresResponse: false
    });
  }

  // Request-response pattern
  async requestFrom(
    recipientId: string,
    messageType: MessageType,
    payload: any,
    timeout: number = 5000
  ): Promise<any> {
    const correlationId = generateId();
    
    const responsePromise = this.waitForResponse(correlationId, timeout);
    
    await this.messageBus.publish({
      id: generateId(),
      from: this.agentId,
      to: recipientId,
      type: messageType,
      payload,
      timestamp: new Date(),
      priority: 'high',
      requiresResponse: true,
      correlationId
    });
    
    return await responsePromise;
  }

  // Broadcast to all agents
  async broadcast(
    messageType: MessageType,
    payload: any
  ): Promise<void> {
    await this.messageBus.broadcast(messageType, payload, this.agentId);
  }
}
```

---

## 🔗 Integration Patterns

### Pattern 1: Analyzer → Defender → NURU → MORIO

**Use Case:** Fraud detected, user quarantined, admin notified

```typescript
// 1. ANALYZER detects fraud
const fraudAlert = await analyzer.detectFraud(daoId);

if (fraudAlert.threatLevel >= ThreatLevel.HIGH) {
  // 2. ANALYZER notifies DEFENDER
  await messageBus.publish({
    from: 'ANL-MTAA-001',
    to: 'DEF-OBSIDIAN-001',
    type: MessageType.FRAUD_ALERT,
    payload: fraudAlert,
    priority: 'critical'
  });
}

// 3. DEFENDER receives and acts
defender.subscribe([MessageType.FRAUD_ALERT], async (msg) => {
  const alert = msg.payload;
  
  // Quarantine user
  await defender.quarantineUser(alert.userId, alert.reason);
  
  // 4. DEFENDER notifies NURU for analysis
  await messageBus.publish({
    from: 'DEF-OBSIDIAN-001',
    to: 'NURU',
    type: MessageType.ACTION_REQUIRED,
    payload: {
      action: 'user_quarantined',
      userId: alert.userId,
      reason: alert.reason
    }
  });
});

// 5. NURU processes and notifies MORIO
nuru.subscribe([MessageType.ACTION_REQUIRED], async (msg) => {
  // Generate user-friendly explanation
  const explanation = await nuru.explain(msg.payload);
  
  // 6. MORIO notifies admin
  await morio.notify({
    userId: 'admin',
    type: 'security_alert',
    message: explanation
  });
});
```

### Pattern 2: Synchronizer → Analyzer → KWETU

**Use Case:** State drift detected, rollback required, treasury updated

```typescript
// 1. SYNCHRONIZER detects drift
if (synchronizer.detectDrift()) {
  // 2. Request ANALYZER to assess impact
  const impact = await messageBus.request({
    from: 'SYNC-MTAA-001',
    to: 'ANL-MTAA-001',
    type: MessageType.ANALYSIS_REQUEST,
    payload: {
      type: 'drift_impact',
      snapshots: synchronizer.getStateSnapshots()
    }
  });
  
  // 3. If safe, perform rollback
  if (impact.safe) {
    const checkpoint = await synchronizer.rollbackToCheckpoint(impact.checkpointId);
    
    // 4. Notify KWETU to update treasury
    await messageBus.publish({
      from: 'SYNC-MTAA-001',
      to: 'KWETU',
      type: MessageType.STATE_SYNC,
      payload: {
        action: 'update_treasury',
        state: checkpoint.data
      }
    });
  }
}
```

### Pattern 3: MORIO → NURU → Analyzer/Defender

**Use Case:** User asks about account security, agents collaborate to respond

```typescript
// 1. User asks MORIO
const userMessage = "Has my account been compromised?";

// 2. MORIO asks NURU to understand
const understanding = await nuru.understand(userMessage, userContext);

// 3. NURU requests analysis from ANALYZER
const nodeProfile = await messageBus.request({
  from: 'NURU',
  to: 'ANL-MTAA-001',
  type: MessageType.ANALYSIS_REQUEST,
  payload: {
    type: 'node_profile',
    userId: userContext.userId
  }
});

// 4. NURU requests threat status from DEFENDER
const threatStatus = await messageBus.request({
  from: 'NURU',
  to: 'DEF-OBSIDIAN-001',
  type: MessageType.ANALYSIS_REQUEST,
  payload: {
    type: 'threat_status',
    userId: userContext.userId
  }
});

// 5. NURU synthesizes response
const response = await nuru.synthesize({
  nodeProfile,
  threatStatus,
  userContext
});

// 6. MORIO delivers to user
await morio.respond(userMessage, response);
```

---

## 🚀 Implementation Roadmap

### Phase 1: Foundation (Week 1-2) ✅ CURRENT

**What We Have:**
- ✅ Base agent framework (`BaseAgent`)
- ✅ Individual agent implementations
- ✅ NURU/KWETU/MORIO core functionality

**What We Need:**
- [ ] Message Bus implementation
- [ ] Agent Communicator service
- [ ] Message type definitions
- [ ] Basic pub/sub system

### Phase 2: Core Integration (Week 3-4)

**Objective:** Connect existing agents with AI layer

**Tasks:**
1. **Message Bus Setup**
   - Implement `MessageBus` class
   - Add Redis for message persistence
   - Create priority queue system
   - Add message history tracking

2. **Agent Communication Layer**
   - Add `AgentCommunicator` to each agent
   - Implement subscription handlers
   - Add request/response patterns
   - Create broadcast mechanisms

3. **AI Layer Integration**
   - Connect ANALYZER → NURU (analysis requests)
   - Connect DEFENDER → MORIO (notifications)
   - Connect SYNCHRONIZER → KWETU (state sync)

4. **Testing**
   - Unit tests for message routing
   - Integration tests for agent collaboration
   - End-to-end scenarios

### Phase 3: Advanced Patterns (Week 5-6)

**Objective:** Implement complex workflows and orchestration

**Tasks:**
1. **Workflow Engine**
   - Multi-step agent coordination
   - Conditional routing
   - Error handling and retries
   - Transaction management

2. **Event Sourcing**
   - Persistent event log
   - Replay capability
   - Audit trail
   - Debugging support

3. **Performance Optimization**
   - Message batching
   - Async processing
   - Connection pooling
   - Caching layer

### Phase 4: Future Agent Integration (Week 7-8)

**Objective:** Prepare for upcoming agents (WATCHER, RELAY, etc.)

**Pattern for New Agents:**
```typescript
class NewAgent extends BaseAgent {
  private communicator: AgentCommunicator;
  
  constructor(agentId: string) {
    super({...});
    this.communicator = new AgentCommunicator(agentId, messageBus);
    
    // Subscribe to relevant messages
    this.setupSubscriptions();
  }
  
  private setupSubscriptions(): void {
    this.communicator.subscribe([
      MessageType.RELEVANT_TYPE_1,
      MessageType.RELEVANT_TYPE_2
    ], this.handleMessage.bind(this));
  }
  
  private async handleMessage(msg: AgentMessage): Promise<void> {
    // Process message
    // Respond if needed
  }
  
  async collaborateWith(agentId: string, task: any): Promise<any> {
    return await this.communicator.requestFrom(
      agentId,
      MessageType.COLLABORATION_REQUEST,
      task
    );
  }
}
```

---

## 📋 Communication Matrix

### Who Talks to Whom

| From ↓ / To → | ANALYZER | SYNCHRONIZER | DEFENDER | NURU | KWETU | MORIO |
|---------------|----------|--------------|----------|------|-------|-------|
| **ANALYZER** | - | ✅ State | ✅ Threats | ✅ Insights | ✅ Data | ❌ |
| **SYNCHRONIZER** | ✅ Validate | - | ❌ | ✅ Context | ✅ Sync | ❌ |
| **DEFENDER** | ✅ Reports | ❌ | - | ✅ Ethics | ✅ Actions | ✅ Alerts |
| **NURU** | ✅ Requests | ✅ Requests | ✅ Requests | - | ✅ Execute | ✅ Respond |
| **KWETU** | ✅ Events | ✅ State | ❌ | ✅ Data | - | ❌ |
| **MORIO** | ❌ | ❌ | ❌ | ✅ Questions | ✅ Actions | - |

### Message Flow Examples

**Fraud Detection Flow:**
```
ANALYZER → DEFENDER (fraud_alert)
DEFENDER → NURU (action_required)
NURU → MORIO (notification)
MORIO → User (alert)
```

**State Sync Flow:**
```
SYNCHRONIZER → ANALYZER (analysis_request)
ANALYZER → SYNCHRONIZER (analysis_response)
SYNCHRONIZER → KWETU (state_sync)
KWETU → SYNCHRONIZER (sync_confirmed)
```

**User Query Flow:**
```
User → MORIO (question)
MORIO → NURU (understanding_request)
NURU → ANALYZER (data_request)
ANALYZER → NURU (analysis_response)
NURU → MORIO (response)
MORIO → User (answer)
```

---

## 🔮 Future Agent Integration

### Planned Agents

Based on the agent/elder files, upcoming agents include:

1. **WATCHER** (Pattern recognition)
2. **RELAY** (Cross-network communication)
3. **GATEWAY** (External API bridge)
4. **SCOUT** (Intelligence gathering)
5. **INFILTRATOR** (Security testing)

### Integration Protocol

**Step 1: Define Agent Capabilities**
```typescript
const WATCHER_CAPABILITIES = {
  name: 'WATCHER',
  subscribes: [
    MessageType.TRANSACTION_EVENT,
    MessageType.PROPOSAL_CREATED,
    MessageType.VOTE_CAST
  ],
  publishes: [
    MessageType.PATTERN_DETECTED,
    MessageType.TREND_ALERT
  ],
  collaboratesWith: ['ANALYZER', 'DEFENDER'],
  priority: 'medium'
};
```

**Step 2: Register with Message Bus**
```typescript
messageBus.registerAgent(WATCHER_CAPABILITIES);
```

**Step 3: Implement Communication**
```typescript
class WatcherAgent extends BaseAgent {
  async initialize(): Promise<void> {
    // Subscribe to relevant events
    this.communicator.subscribe(
      this.capabilities.subscribes,
      this.handleMessage.bind(this)
    );
    
    // Announce presence
    await this.communicator.broadcast(
      MessageType.AGENT_ONLINE,
      { agentId: this.config.id, capabilities: this.capabilities }
    );
  }
}
```

---

## 🛡️ Error Handling & Resilience

### Circuit Breaker Pattern

```typescript
class CircuitBreaker {
  private failures: number = 0;
  private lastFailure?: Date;
  private state: 'closed' | 'open' | 'half-open' = 'closed';
  
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      if (this.shouldAttemptReset()) {
        this.state = 'half-open';
      } else {
        throw new Error('Circuit breaker is open');
      }
    }
    
    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }
  
  private onSuccess(): void {
    this.failures = 0;
    this.state = 'closed';
  }
  
  private onFailure(): void {
    this.failures++;
    this.lastFailure = new Date();
    
    if (this.failures >= 5) {
      this.state = 'open';
    }
  }
}
```

### Dead Letter Queue

```typescript
class DeadLetterQueue {
  async handleFailedMessage(
    message: AgentMessage,
    error: Error,
    attempts: number
  ): Promise<void> {
    if (attempts >= 3) {
      // Move to DLQ
      await db.insert(deadLetterQueue).values({
        messageId: message.id,
        payload: message,
        error: error.message,
        timestamp: new Date()
      });
      
      // Alert admins
      await messageBus.publish({
        from: 'SYSTEM',
        to: 'MORIO',
        type: MessageType.NOTIFICATION,
        payload: {
          type: 'message_failed',
          messageId: message.id
        }
      });
    } else {
      // Retry with exponential backoff
      await this.retryLater(message, attempts);
    }
  }
}
```

---

## 📊 Monitoring & Observability

### Metrics to Track

```typescript
interface AgentMetrics {
  messagesSent: number;
  messagesReceived: number;
  messagesProcessed: number;
  messagesFailed: number;
  averageProcessingTime: number;
  lastActive: Date;
  collaborations: {
    [agentId: string]: number;
  };
}
```

### Health Checks

```typescript
app.get('/api/agents/health', async (req, res) => {
  const health = {
    analyzer: await analyzer.getMetrics(),
    synchronizer: await synchronizer.getMetrics(),
    defender: await defender.getSystemStatus(),
    messageBus: messageBus.getHealth(),
    timestamp: new Date()
  };
  
  res.json(health);
});
```

---

## ✅ Implementation Checklist

### Immediate (Week 1-2)
- [ ] Create `message-bus.ts`
- [ ] Create `agent-communicator.ts`
- [ ] Define message types enum
- [ ] Add communicator to existing agents
- [ ] Write integration tests

### Short-term (Week 3-4)
- [ ] Implement Redis message persistence
- [ ] Add priority queue
- [ ] Create workflow engine
- [ ] Add circuit breakers
- [ ] Implement dead letter queue

### Medium-term (Week 5-8)
- [ ] Event sourcing system
- [ ] Performance optimizations
- [ ] Monitoring dashboard
- [ ] Documentation updates
- [ ] Future agent templates

---

**Status:** Ready for Implementation  
**Next Steps:** Begin Phase 1 - Message Bus Foundation  
**Owner:** Development Team  
**Review Date:** 2025-01-18
