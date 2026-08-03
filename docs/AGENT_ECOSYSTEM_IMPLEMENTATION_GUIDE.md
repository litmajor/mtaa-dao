# AGENT ECOSYSTEM IMPLEMENTATION GUIDE

**Date**: June 19, 2026  
**Version**: 1.0  
**Status**: Ready for Implementation

---

## TABLE OF CONTENTS

1. [Overview](#overview)
2. [Phase-by-Phase Implementation](#phase-by-phase-implementation)
3. [Contract Deployment](#contract-deployment)
4. [Agent Integration](#agent-integration)
5. [Testing Strategy](#testing-strategy)
6. [Monitoring & Operations](#monitoring--operations)
7. [Rollback Procedures](#rollback-procedures)

---

## OVERVIEW

This guide provides detailed implementation steps for the complete Agent Ecosystem, including:
- Smart contract deployment order
- Agent registration and configuration
- Integration with existing payment system
- User migration strategy
- Launch checklist

### Key Dependencies

```
AgentRegistry.sol
    ↓
SubscriptionManager.sol (depends on AgentRegistry)
    ↓
AgentPaymentGateway.sol (enhanced, depends on both)
    ↓
RevenueDistributor.sol (depends on SubscriptionManager)
    ↓
AgentPermissionManager.sol
    ↓
GovernanceAccessManager.sol (depends on permissions)
```

---

## PHASE-BY-PHASE IMPLEMENTATION

### PHASE 1: Infrastructure (Week 1-2)

#### Week 1: Core Contracts

**Monday: Contract Audit & Preparation**
- [ ] Review all contracts for security vulnerabilities
- [ ] Conduct static analysis with Slither
- [ ] Verify gas optimization
- [ ] Run formal verification on critical paths
- [ ] Get legal review of subscription terms

**Deliverables**:
- Audit report
- Gas optimization report
- Legal review document

**Tuesday-Wednesday: AgentRegistry Deployment**

```bash
# Deploy AgentRegistry
npx hardhat run scripts/deploy/01-AgentRegistry.ts --network testnet

# Verify contract
npx hardhat verify --network testnet <REGISTRY_ADDRESS> \
  --contract contracts/AgentRegistry.sol:AgentRegistry
```

**Deployment Script: `scripts/deploy/01-AgentRegistry.ts`**
```typescript
import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying AgentRegistry with account:", deployer.address);

  // Deploy contract
  const AgentRegistry = await ethers.getContractFactory("AgentRegistry");
  const registry = await AgentRegistry.deploy();
  await registry.deployed();

  console.log("AgentRegistry deployed to:", registry.address);

  // Store address for next step
  console.log(
    JSON.stringify({
      network: "testnet",
      contract: "AgentRegistry",
      address: registry.address,
      deployer: deployer.address,
      timestamp: new Date().toISOString()
    }, null, 2)
  );

  // Wait for confirmations
  await registry.deployTransaction.wait(6);
  console.log("✅ AgentRegistry confirmed on blockchain");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
```

**Verification Steps**:
- [ ] Contract deployed on testnet
- [ ] Contract verified on block explorer
- [ ] Constructor parameters correct
- [ ] Contract callable and functional
- [ ] Events emitting correctly

**Thursday: AuditLog & AgentPaymentGateway**

```bash
# Deploy AuditLog
npx hardhat run scripts/deploy/02-AuditLog.ts --network testnet

# Deploy enhanced AgentPaymentGateway
npx hardhat run scripts/deploy/03-AgentPaymentGateway.ts --network testnet
```

**Friday: Testing & Documentation**
- [ ] Unit tests for all Phase 1 contracts (100% coverage)
- [ ] Integration tests between contracts
- [ ] Gas usage report
- [ ] Update documentation
- [ ] Team training on new contracts

**Deliverables**:
- 3 contracts deployed on testnet
- Test reports (unit + integration)
- Gas optimization report
- Documentation updated

---

#### Week 2: Subscription System

**Monday-Tuesday: SubscriptionManager Deployment**

```bash
# Deploy SubscriptionManager
npx hardhat run scripts/deploy/04-SubscriptionManager.ts --network testnet

# Parameters:
# - _mtaaToken: 0x... (MTAA token address)
# - _agentRegistry: 0x... (AgentRegistry address from Week 1)
# - _paymentGateway: 0x... (AgentPaymentGateway address from Week 1)
```

**Configuration Script: `scripts/setup/01-ConfigureTiers.ts`**
```typescript
import { ethers } from "hardhat";

async function main() {
  const subscriptionManager = await ethers.getContractAt(
    "SubscriptionManager",
    process.env.SUBSCRIPTION_MANAGER_ADDRESS!
  );

  // Tier 0: FREE (already set in constructor)
  // Tier 1: BASIC - 30,000 KES
  // Tier 2: PREMIUM - 150,000 KES
  // Tier 3: ENTERPRISE - 750,000 KES

  const tiers = [
    { name: "BASIC", price: ethers.utils.parseUnits("30000") },
    { name: "PREMIUM", price: ethers.utils.parseUnits("150000") },
    { name: "ENTERPRISE", price: ethers.utils.parseUnits("750000") }
  ];

  for (let i = 0; i < tiers.length; i++) {
    const tx = await subscriptionManager.updateTierPrice(i + 1, tiers[i].price);
    await tx.wait();
    console.log(`✅ Updated ${tiers[i].name} tier price`);
  }

  console.log("✨ All tiers configured");
}

main().catch(console.error);
```

**Wednesday: RevenueDistributor Deployment**

```bash
# Deploy RevenueDistributor
npx hardhat run scripts/deploy/05-RevenueDistributor.ts --network testnet
```

**Thursday-Friday: Integration & Testing**
- [ ] Test subscription creation flow
- [ ] Test payment processing
- [ ] Test revenue distribution
- [ ] Test agent-to-user subscription verification
- [ ] Performance testing (1000+ concurrent subscriptions)
- [ ] Load testing on payment gateway

**Deliverables**:
- SubscriptionManager deployed and configured
- RevenueDistributor operational
- Integration tests passing
- Performance benchmarks recorded

---

### PHASE 2: Agent Registration (Week 3-4)

#### Week 3: Register Core Agents

**Monday: Orchestration Agents**

```typescript
// Script: scripts/setup/02-RegisterCoreAgents.ts

const coreAgents = [
  {
    address: MORIO_ADDRESS,
    name: "Morio",
    description: "Spirit - Conversational UI and user interface layer",
    category: AgentCategory.ORCHESTRATION,
    autonomyLevel: AutonomyLevel.SEMI_AUTONOMOUS
  },
  {
    address: NURU_ADDRESS,
    name: "Nuru",
    description: "Mind - Cognitive core for reasoning and analysis",
    category: AgentCategory.ORCHESTRATION,
    autonomyLevel: AutonomyLevel.FULLY_AUTONOMOUS
  },
  {
    address: COORDINATOR_ADDRESS,
    name: "Coordinator",
    description: "Elder - Orchestration and workflow coordination",
    category: AgentCategory.ELDER_COUNCIL,
    autonomyLevel: AutonomyLevel.FULLY_AUTONOMOUS
  }
];

for (const agent of coreAgents) {
  const tx = await registry.registerAgent(
    agent.address,
    agent.name,
    agent.description,
    agent.category,
    agent.autonomyLevel
  );
  const receipt = await tx.wait();
  const agentId = receipt.events[0].args.agentId;
  console.log(`✅ Registered ${agent.name}: ${agentId}`);
  
  // Save agentId for later reference
  saveAgentId(agent.name, agentId);
}
```

**Tuesday-Wednesday: Register Elder Council Agents**

- [ ] ELD-SCRY (Futures)
- [ ] ELD-KAIZEN (Optimization)
- [ ] ELD-LUMEN (Ethics)

**Thursday: Register Security & Execution Agents**

- [ ] Scout (Monitoring)
- [ ] Defender (Security)
- [ ] Analyzer (Threat Analysis)
- [ ] Repair (Recovery)
- [ ] Trader-DeFi (Trading)
- [ ] Synchronizer (State Sync)

**Friday: Register Remaining Agents**

- [ ] Gateway (Data Integration)
- [ ] Relay (Messaging)
- [ ] Hasher (Cryptography)
- [ ] Infiltrator (Data Ingestion)
- [ ] Exfiltrator (Data Export)
- [ ] Treasury Agent
- [ ] Community Agent
- [ ] Compliance Agent
- [ ] All remaining specialized agents

**Deliverables**:
- All 36+ agents registered in AgentRegistry
- Each agent assigned unique ID
- Agent list validated against specification
- Agent capabilities configured

#### Week 4: Configure Agent Capabilities

**Monday-Tuesday: Define Core Capabilities**

For each agent, define capabilities:

```typescript
// Script: scripts/setup/03-ConfigureCapabilities.ts

const capabilities = {
  MORIO: [
    {
      name: "Chat",
      description: "Natural language conversation",
      riskLevel: 2
    },
    {
      name: "SessionManagement",
      description: "Manage user sessions",
      riskLevel: 5
    },
    {
      name: "DashboardGeneration",
      description: "Generate personalized dashboards",
      riskLevel: 3
    }
  ],
  NURU: [
    {
      name: "IntentClassification",
      description: "Classify user intent",
      riskLevel: 2
    },
    {
      name: "RiskAssessment",
      description: "Assess financial risks",
      riskLevel: 6
    },
    {
      name: "MarketAnalysis",
      description: "Analyze market data",
      riskLevel: 3
    }
  ],
  // ... more agents
};

for (const [agentName, caps] of Object.entries(capabilities)) {
  const agentId = getAgentId(agentName);
  
  for (const cap of caps) {
    const tx = await registry.addCapability(
      agentId,
      cap.name,
      cap.description,
      cap.functionSelector || "0x00000000",
      cap.riskLevel
    );
    await tx.wait();
    console.log(`✅ Added capability ${cap.name} to ${agentName}`);
  }
}
```

**Wednesday-Thursday: Link Agents to Subscription Tiers**

```typescript
// Script: scripts/setup/04-LinkAgentsToTiers.ts

const tierAssignments = {
  FREE: ["MORIO", "NURU"],
  BASIC: ["WALLET_ANALYZER", "COMMUNITY", "CHAMA"],
  PREMIUM: ["TRADERS", "COMPLIANCE", "GOVERNANCE_ANALYTICS"],
  ENTERPRISE: ["ELDERS", "SECURITY", "TREASURY", "ALL_SPECIALIZED"]
};

// Create mapping in SubscriptionManager or separate contract
```

**Friday: Verify All Configurations**
- [ ] All 36+ agents registered
- [ ] All capabilities defined
- [ ] Tier associations correct
- [ ] Permission matrix populated
- [ ] Audit trail clean

**Deliverables**:
- Agent registry complete
- All capabilities configured
- Tier mapping finalized
- Ready for user migration

---

### PHASE 3: User Migration (Week 5-6)

#### Week 5: Prepare Migration

**Monday: Generate Migration Plan**

```typescript
// Script: scripts/migration/01-AnalyzeCurrentUsers.ts

// Analyze current user base
const stats = {
  totalUsers: 0,
  byDAOSize: {},
  byActivityLevel: {},
  likelyTiers: {}
};

// Output: Migration plan with tier recommendations
```

**Tuesday: Create Migration Scripts**

```typescript
// Script: scripts/migration/02-MigrateUsers.ts

// For each existing user:
// 1. Determine appropriate tier based on current activity
// 2. Create subscriptions for agents they use
// 3. Handle grandfathering for early adopters
// 4. Send migration notices

async function migrateUser(userAddress, recommendedTier) {
  // Get current agent usage
  const agentsUsed = await analyzeUserAgentUsage(userAddress);
  
  // Auto-subscribe to recommended tier
  for (const agentId of agentsUsed) {
    await subscriptionManager.subscribe(agentId, recommendedTier);
  }
  
  // Track migration
  saveMigrationRecord(userAddress, recommendedTier, agentsUsed);
}
```

**Wednesday-Thursday: Soft Launch (5% of users)**

- [ ] Migrate 5% of users to new system
- [ ] Monitor for issues
- [ ] Gather feedback
- [ ] Make adjustments if needed
- [ ] Verify all payment flows

**Friday: Testing & Validation**
- [ ] All migrated users can access agents
- [ ] Payments processing correctly
- [ ] Subscription tiers working as intended
- [ ] No data loss
- [ ] Performance acceptable

**Deliverables**:
- Migration scripts ready
- 5% of users migrated successfully
- Monitoring dashboards active
- Feedback collected and analyzed

#### Week 6: Full Migration

**Monday-Tuesday: Migrate Remaining Users**

- [ ] Migrate 50% of users in batches
- [ ] Monitor system performance
- [ ] Address issues in real-time
- [ ] Update documentation as needed

**Wednesday: Complete Migration**

- [ ] Migrate final 45% of users
- [ ] Run final validation
- [ ] Update all user-facing docs
- [ ] Send completion announcement

**Thursday-Friday: Post-Migration**
- [ ] Monitor for migration issues
- [ ] Handle support tickets
- [ ] Document lessons learned
- [ ] Prepare for mainnet launch

**Deliverables**:
- 100% of users migrated
- Zero payment processing failures
- All agents accessible to users
- Complete migration logs

---

### PHASE 4: Governance & Advanced Agents (Week 7-8)

#### Week 7: Governance Setup

**Monday-Tuesday: Deploy Governance Contracts**

```bash
# Deploy GovernanceAccessManager
npx hardhat run scripts/deploy/06-GovernanceAccessManager.ts --network testnet

# Deploy AgentPermissionManager
npx hardhat run scripts/deploy/07-AgentPermissionManager.ts --network testnet
```

**Wednesday: Configure Governance Parameters**

```typescript
// Script: scripts/setup/05-ConfigureGovernance.ts

const governanceConfig = {
  votingDelay: 1,           // 1 block
  votingPeriod: 50400,      // 1 week
  proposalThreshold: 100,   // 100 votes minimum
  quorumPercentage: 40,     // 40% quorum
  timeLocks: {
    TRANSFER: 2 * 24 * 60 * 60,     // 2 days
    POLICY: 3 * 24 * 60 * 60,       // 3 days
    SECURITY: 1 * 24 * 60 * 60      // 1 day
  }
};

// Configure in GovernanceAccessManager
await governanceManager.setGovernanceParameters(governanceConfig);
```

**Thursday-Friday: Test Governance Flows**
- [ ] Create test proposals
- [ ] Test voting mechanisms
- [ ] Verify time locks
- [ ] Test execution flow
- [ ] Verify emergency procedures

**Deliverables**:
- Governance system deployed
- All parameters configured
- Test proposals executed successfully

#### Week 8: Advanced Agents & Launch Prep

**Monday-Tuesday: Deploy Advanced Agents**

- [ ] Okedi Layer Agent
- [ ] MirrorCore Agent
- [ ] AOE Economic Simulator
- [ ] All specialized analyzers

**Wednesday: System Integration Testing**

```typescript
// Script: tests/integration/01-EndToEndFlow.ts

// Complete flow test:
// 1. User subscribes
// 2. Payment processed
// 3. Agent accessible
// 4. Agent performs action
// 5. Revenue distributed
// 6. Audit logged

test("Complete end-to-end subscription flow", async () => {
  // Subscribe user
  const subId = await subscribe(user, agentId, PREMIUM);
  
  // Execute agent action (mock)
  await agent.executeAction(data);
  
  // Verify revenue distribution
  const earnings = await getAgentEarnings(agentId);
  expect(earnings).toBeGreaterThan(0);
  
  // Verify audit log
  const auditEntry = await getAuditEntry(agentId);
  expect(auditEntry).toBeDefined();
});
```

**Thursday-Friday: Final Checklist & Launch Prep**
- [ ] All contracts deployed on testnet
- [ ] All agents registered and configured
- [ ] All users migrated
- [ ] All systems tested end-to-end
- [ ] Documentation complete
- [ ] Team trained
- [ ] Runbooks prepared
- [ ] Incident response plan ready

---

## CONTRACT DEPLOYMENT

### Deployment Checklist

```markdown
## Pre-Deployment Tasks

- [ ] All contracts audited (external audit completed)
- [ ] All tests passing (100% coverage)
- [ ] Gas optimization reviewed
- [ ] Constructor parameters validated
- [ ] Network connectivity verified
- [ ] Testnet funds available
- [ ] Deployment scripts tested on testnet
- [ ] Rollback procedure documented

## Deployment Steps

1. Deploy AgentRegistry
   - [ ] Verify deployment
   - [ ] Set initial parameters
   - [ ] Update address in config

2. Deploy AuditLog
   - [ ] Link to AgentRegistry
   - [ ] Verify logging works

3. Deploy AgentPaymentGateway (Enhanced)
   - [ ] Set MTAA token address
   - [ ] Set exchange rate oracle
   - [ ] Set M-Pesa gateway
   - [ ] Verify payment flows

4. Deploy SubscriptionManager
   - [ ] Link all dependencies
   - [ ] Configure tier pricing
   - [ ] Verify subscription creation

5. Deploy RevenueDistributor
   - [ ] Configure revenue splits
   - [ ] Test distribution logic
   - [ ] Verify tracking

6. Deploy Permission & Governance
   - [ ] Configure access matrix
   - [ ] Set governance thresholds
   - [ ] Test voting

7. Register All Agents
   - [ ] Register core agents
   - [ ] Register specialized agents
   - [ ] Configure capabilities
   - [ ] Set tier assignments

## Post-Deployment Verification

- [ ] Contract addresses recorded
- [ ] All contracts verified on block explorer
- [ ] Parameters logged for audit
- [ ] First transaction successful
- [ ] Monitoring alerts configured
- [ ] Team notified
```

---

## AGENT INTEGRATION

### Integration Steps for Each Agent

1. **Get Agent ID**
   ```solidity
   bytes32 agentId = registry.registerAgent(...);
   ```

2. **Configure Capabilities**
   ```solidity
   registry.addCapability(agentId, ...);
   ```

3. **Add Subscription Check**
   ```solidity
   modifier requiresSubscription() {
     (bool subscribed, uint256 tier) = 
       subscriptionManager.isSubscribed(agentId, msg.sender);
     require(subscribed, "No active subscription");
     _;
   }
   ```

4. **Integrate with Payment Gateway**
   ```solidity
   paymentGateway.payAgentInMTAA(agentId, amount);
   ```

5. **Add Audit Logging**
   ```solidity
   auditLog.logAgentAction(agentId, "ACTION_NAME", data);
   ```

6. **Test Integration**
   - Verify subscription checking
   - Verify payment processing
   - Verify audit logging
   - Verify revenue distribution

---

## TESTING STRATEGY

### Unit Testing

```bash
# Test each contract in isolation
npx hardhat test test/unit/AgentRegistry.test.ts
npx hardhat test test/unit/SubscriptionManager.test.ts
npx hardhat test test/unit/PaymentGateway.test.ts
npx hardhat test test/unit/RevenueDistributor.test.ts
```

### Integration Testing

```bash
# Test contract interactions
npx hardhat test test/integration/SubscriptionFlow.test.ts
npx hardhat test test/integration/PaymentFlow.test.ts
npx hardhat test test/integration/RevenueFlow.test.ts
```

### End-to-End Testing

```bash
# Full system flow
npx hardhat test test/e2e/CompleteFlow.test.ts
```

### Performance Testing

```bash
# Load testing
npx hardhat test test/performance/LoadTest.ts

# Gas profiling
hardhat run scripts/gasprof.ts --network testnet
```

### Security Testing

```bash
# Fuzzing
npx hardhat test test/fuzzing/Fuzzing.test.ts

# Slither analysis
slither . --json report.json

# Mythril analysis
mythril analyze contracts/*.sol
```

---

## MONITORING & OPERATIONS

### Monitoring Dashboards

1. **Agent Health Dashboard**
   - Agent status (active/inactive)
   - Uptime percentage
   - Error rates
   - Message queue depth

2. **Subscription Dashboard**
   - Active subscriptions by tier
   - Subscription churn rate
   - Revenue by agent
   - Payment success rate

3. **Financial Dashboard**
   - Total revenue
   - Revenue by payment method
   - Distribution accuracy
   - Treasury balance

4. **System Dashboard**
   - Contract state
   - Gas usage trends
   - Network latency
   - Alert status

### Alert Setup

```yaml
Alerts:
  - name: PaymentFailure
    condition: "payment_success_rate < 0.95"
    severity: CRITICAL
    
  - name: HighGasUsage
    condition: "avg_gas_per_tx > threshold"
    severity: WARNING
    
  - name: SubscriptionExpiry
    condition: "upcoming_renewal < 7_days"
    severity: INFO
    
  - name: AgentOffline
    condition: "agent_status == OFFLINE"
    severity: CRITICAL
```

### Runbooks

**Runbook: Payment Processing Failure**
1. Check gateway status
2. Verify token balance
3. Check gas prices
4. Analyze transaction logs
5. Alert platform team
6. Retry payment
7. Update user

---

## ROLLBACK PROCEDURES

### Emergency Rollback

If critical issues occur post-launch:

**Step 1: Pause System**
```solidity
// Activate circuit breaker
await contractOwner.pauseAllSubscriptions();
await contractOwner.pauseAllPayments();
```

**Step 2: Notify Users**
- Email all users about incident
- Explain temporary pause
- Provide timeline for resolution

**Step 3: Assess Damage**
- Analyze transaction logs
- Identify affected users
- Calculate refunds needed

**Step 4: Execute Rollback**
```bash
# Deploy previous version
npx hardhat run scripts/deploy/rollback.ts --network mainnet

# Restore state from backup
# Verify all data integrity
# Resume services
```

**Step 5: Compensation**
- Refund affected users
- Provide service credit
- Offer extended free tier access

### Data Recovery

```typescript
// Script: scripts/recovery/RecoverFromBackup.ts

// Restore from backup if corruption detected
const backup = await getLatestBackup();
await restoreSubscriptionData(backup);
await restorePaymentData(backup);
await verifyDataIntegrity();
```

---

## LAUNCH CHECKLIST

### Final Pre-Launch (48 hours before)

- [ ] All contracts on mainnet (not yet enabled)
- [ ] All agents registered
- [ ] All tier pricing configured
- [ ] All users migrated
- [ ] All monitoring active
- [ ] All docs complete
- [ ] Team briefed
- [ ] Support trained
- [ ] Incident response ready
- [ ] Communications prepared

### Launch (Go Live)

**T-1 Hour**
- [ ] Final system check
- [ ] Database backup
- [ ] Monitoring alerts active
- [ ] Team on standby

**T-0 (Launch)**
- [ ] Enable subscriptions
- [ ] Enable payments
- [ ] Launch public API
- [ ] Send launch announcement

**T+1 Hour**
- [ ] Monitor payment success rate
- [ ] Monitor subscription creation
- [ ] Monitor agent operations
- [ ] Review error logs

**T+24 Hours**
- [ ] All systems nominal
- [ ] User feedback positive
- [ ] No critical issues
- [ ] Proceed with Phase 5

### Post-Launch Monitoring (Week 1)

- [ ] Daily check-ins on metrics
- [ ] Daily review of error logs
- [ ] Support ticket monitoring
- [ ] User feedback review
- [ ] Performance optimization
- [ ] Issue resolution

---

## CONCLUSION

This implementation guide provides a structured approach to deploying the complete Agent Ecosystem. Follow the phases sequentially, complete all checklist items, and maintain constant monitoring throughout the process.

**Success Criteria**:
- All 36+ agents registered and operational
- 100% of users successfully migrated
- Zero critical payment failures
- All subscriptions active and verified
- Revenue distribution accurate
- Audit logs complete and accurate

For any issues or questions during implementation, refer to the main specification document or contact the architecture team.
