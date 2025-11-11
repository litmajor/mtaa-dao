
# Agent Communication: Past, Present, Future

**TL;DR:** We have 3 solid agents + AI layer. Now we're wiring them together with a message bus, then scaling to future agents.

---

## 📍 Where We Are (PAST)

### Agents Built ✅
- **ANALYZER**: Detects fraud, analyzes treasury, profiles nodes
- **SYNCHRONIZER**: Syncs state, resolves conflicts, handles rollbacks  
- **DEFENDER**: Quarantines threats, reviews ethics, monitors behavior

### AI Layer Built ✅
- **NURU**: Intent classification, analytics, risk assessment
- **KWETU**: Treasury ops, governance, community management
- **MORIO**: Chat interface, sessions, multi-language

### Problem ❌
**Agents don't talk to each other yet.** They're isolated services.

---

## 🎯 What We Can Do Now (PRESENT)

### Immediate Implementation

**1. Message Bus (Week 1-2)**
```typescript
// Central communication hub
const messageBus = new MessageBus();

// Any agent can publish
await messageBus.publish({
  from: 'ANALYZER',
  to: 'DEFENDER',
  type: 'FRAUD_ALERT',
  payload: { userId: '123', reason: 'suspicious pattern' }
});

// Any agent can subscribe
messageBus.subscribe('DEFENDER', ['FRAUD_ALERT'], async (msg) => {
  await defender.quarantineUser(msg.payload.userId);
});
```

**2. Agent Communicator (Week 1-2)**
```typescript
// Simplified API for agents
class AnalyzerAgent extends BaseAgent {
  private comm = new AgentCommunicator('ANALYZER');
  
  async detectFraud() {
    const fraud = await this.analyze();
    
    // Easy notification
    await this.comm.reportThreat({
      type: 'fraud',
      severity: 'high',
      details: fraud
    });
  }
}
```

**3. Quick Wins**
- ANALYZER → DEFENDER: Fraud alerts trigger quarantine
- DEFENDER → MORIO: Security alerts notify users  
- SYNCHRONIZER → KWETU: State sync updates treasury
- MORIO → NURU → ANALYZER: User queries get real analysis

---

## 🔮 What We Ought to Do (FUTURE)

### Phase 1: Basic Integration (2 weeks)
✅ Message bus foundation  
✅ Connect existing 3 agents  
✅ Wire AI layer (NURU/KWETU/MORIO)  
✅ Basic pub/sub patterns

### Phase 2: Advanced Patterns (2 weeks)
- Request/response (ask and wait for answer)
- Broadcast (notify everyone at once)
- Priority queues (critical messages first)
- Circuit breakers (prevent cascade failures)

### Phase 3: Future Agents (4 weeks)
**Easy to add new agents:**
```typescript
class WatcherAgent extends BaseAgent {
  private comm = new AgentCommunicator('WATCHER');
  
  async initialize() {
    // Auto-subscribe to relevant events
    this.comm.subscribe([
      MessageType.TRANSACTION_EVENT,
      MessageType.PROPOSAL_CREATED
    ], this.handleEvent);
    
    // Announce presence
    await this.comm.broadcast(
      MessageType.AGENT_ONLINE,
      { capabilities: [...] }
    );
  }
}
```

**Upcoming Agents:**
- WATCHER (pattern recognition)
- RELAY (cross-chain comms)
- GATEWAY (API bridge)
- SCOUT (intelligence)
- INFILTRATOR (security testing)

### Phase 4: Production Hardening (2 weeks)
- Event sourcing (replay messages)
- Dead letter queue (failed messages)
- Monitoring dashboard
- Performance optimization

---

## 🚀 Action Plan

**Week 1-2: Foundation**
```bash
# Create core infrastructure
server/core/agent-framework/
├── message-bus.ts        # ← START HERE
├── agent-communicator.ts # ← THEN THIS
└── message-types.ts
```

**Week 3-4: Integration**
```typescript
// Update existing agents
analyzer.communicator.reportThreat(...)
defender.communicator.notifyAI('MORIO', ...)
synchronizer.communicator.requestAnalysis(...)
```

**Week 5-6: Testing**
- E2E: User asks MORIO → triggers ANALYZER → alerts DEFENDER
- Performance: 1000 messages/second
- Resilience: Agents restart without losing messages

**Week 7-8: Future-Proofing**
- Template for new agents
- Documentation for agent developers
- Monitoring & debugging tools

---

## 💡 Key Insights

### What Makes This Work

**1. Loose Coupling**
- Agents don't import each other
- Message bus is the only shared dependency
- Easy to add/remove agents

**2. Clear Contracts**
```typescript
enum MessageType {
  FRAUD_ALERT = 'fraud_alert',
  THREAT_DETECTED = 'threat_detected',
  // etc.
}
```

**3. Async First**
- No blocking calls
- Agents stay responsive
- Natural scaling

**4. Fail-Safe**
- Circuit breakers prevent cascades
- Dead letter queue catches failures
- Retry logic with backoff

### What Could Go Wrong

❌ **Message explosion** → Solution: Priority queues + batching  
❌ **Lost messages** → Solution: Redis persistence + event sourcing  
❌ **Circular dependencies** → Solution: Message type rules  
❌ **Debugging nightmares** → Solution: Message history + tracing

---

## 📊 Success Metrics

**Technical:**
- Message latency < 10ms (p95)
- Delivery success > 99.9%
- Agent uptime > 99%
- Zero lost messages

**Business:**
- Fraud detected in < 1 second
- State synced in < 5 seconds  
- User queries answered in < 200ms
- New agents onboarded in < 1 day

---

## 🎓 Learning from Architecture

**From Elders/Agents Code:**
- MALTA shows command patterns
- LUMEN shows ethics integration
- FORGE shows self-modification

**Applied to MtaaDAO:**
- Message bus = MALTA's command queue
- Ethics module = LUMEN's review process
- Agent framework = FORGE's extensibility

---

**Status:** Ready to implement  
**Timeline:** 8 weeks to full system  
**Risk:** Low (additive, doesn't break existing)  
**Impact:** High (unlocks collaboration)

---

**Next Step:** Create `message-bus.ts` and wire up first integration (ANALYZER → DEFENDER fraud alerts)
