# 🧭 Mtaa DAO Assistant Architecture

**Codename:** Morio System  
**Version:** v1.0  
**Author:** Brent / LitMajor  
**Date:** 2025  
**Status:** Production-Ready Architecture

---

## 📑 Table of Contents

1. [Executive Summary](#executive-summary)
2. [System Overview](#system-overview)
3. [Architecture Layers](#architecture-layers)
   - [NURU - The Mind](#nuru-the-mind)
   - [KWETU - The Body](#kwetu-the-body)
   - [MORIO - The Spirit](#morio-the-spirit)
4. [Technical Implementation](#technical-implementation)
5. [Data Flow & Integration](#data-flow--integration)
6. [Security Architecture](#security-architecture)
7. [API Specifications](#api-specifications)
8. [Deployment Architecture](#deployment-architecture)
9. [Monetization Strategy](#monetization-strategy)
10. [Development Roadmap](#development-roadmap)
11. [Appendices](#appendices)

---

## 🎯 Executive Summary

### Vision

The Mtaa DAO Assistant System is a multi-layered cognitive and operational AI framework designed to democratize decentralized governance and financial inclusion across Africa. It combines artificial intelligence, blockchain technology, and local payment infrastructure to create a culturally-aware, community-driven autonomous organization platform.

### Problem Statement

Traditional DAO tooling is:
- Built for Western markets with high technical literacy
- Disconnected from African payment infrastructure (M-Pesa, mobile money)
- Lacks cultural context and local language support
- Too complex for grassroots community organizations
- Expensive to deploy and maintain

### Solution

A three-layer AI-powered assistant system that:
- **Speaks the language** of local communities (Swahili, pidgin English, local idioms)
- **Integrates natively** with African fintech (M-Pesa, Paystack, KotaniPay)
- **Simplifies DAO operations** through conversational AI
- **Empowers communities** with transparent, auditable governance
- **Scales sustainably** with a clear revenue model

### Key Metrics (Target - Year 1)

| Metric | Target | Notes |
|--------|--------|-------|
| DAOs Created | 500+ | Focus on Kenya, Nigeria, Ghana |
| Active Users | 10,000+ | Community members across DAOs |
| Transaction Volume | $5M+ | Deposits, withdrawals, grants |
| Assistant Interactions | 100K+/month | Queries handled by Morio |
| Uptime | 99.5%+ | Critical for financial operations |
| Response Time | <2s | Average assistant response |

---

## 🌐 System Overview

### Conceptual Architecture

The Morio System follows a three-layer consciousness model inspired by human cognition:

```
┌─────────────────────────────────────────────────────────┐
│                    USER LAYER                           │
│  Web App | Mobile App | Telegram | WhatsApp | USSD     │
└───────────────────────┬─────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────┐
│              MORIO - The Spirit (Interface)             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐    │
│  │   Chat UI   │  │   Webhook   │  │   Session   │    │
│  │   Engine    │  │   Handler   │  │   Manager   │    │
│  └─────────────┘  └─────────────┘  └─────────────┘    │
└───────────────────────┬─────────────────────────────────┘
                        │
        ┌───────────────┼───────────────┐
        ▼               ▼               ▼
┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│    NURU      │ │    KWETU     │ │    CACHE     │
│  (The Mind)  │◄┤  (The Body)  │ │   (Redis)    │
│              │ │              │ │              │
│  • Reasoning │ │  • Wallets   │ │  • Sessions  │
│  • Context   │ │  • Vaults    │ │  • State     │
│  • Analytics │ │  • Proposals │ │  • Temp Data │
│  • Ethics    │ │  • Payments  │ │              │
└──────┬───────┘ └──────┬───────┘ └──────────────┘
       │                │
       ▼                ▼
┌──────────────┐ ┌──────────────┐
│  Vector DB   │ │  Blockchain  │
│  (Memory)    │ │  (State)     │
│              │ │              │
│  • Pinecone  │ │  • Base      │
│  • Weaviate  │ │  • Polygon   │
│  • Chroma    │ │  • Celo      │
└──────────────┘ └──────────────┘
```

### Design Principles

| Principle | Description | Implementation |
|-----------|-------------|----------------|
| **Localization First** | Built around African economic models, languages, and payment rails | Swahili naming, M-Pesa integration, USSD support |
| **Transparency** | All DAO actions traceable, verifiable, and ethical | On-chain governance, audit logs, open-source core |
| **Sustainability** | Designed for community ownership and long-term scaling | Clear revenue model, low operational costs |
| **AI Augmentation** | AI enhances decision-making, doesn't replace it | Human approval for critical actions, explainable AI |
| **Interoperability** | Compatible with EVM and emerging African fintech APIs | Multi-chain support, standard interfaces |
| **Offline-First** | Works in low-connectivity environments | USSD fallback, PWA caching, SMS receipts |

---

## 🧠 NURU - The Mind (Cognitive Core)

### Purpose

Nuru (Swahili: "Light") is the intelligent reasoning engine that powers decision-making, contextual understanding, and analytical capabilities. It acts as the invisible brain behind Morio's personality.

### Core Functions

#### 1. Natural Language Understanding (NLU)

**Capabilities:**
- Intent classification (40+ intent types)
- Entity extraction (amounts, dates, addresses, names)
- Sentiment analysis
- Language detection (English, Swahili, Sheng, Pidgin)
- Context preservation across conversations

**Example Intents:**
```json
{
  "withdraw": "I want to withdraw 5000 KES",
  "check_balance": "How much is in the community vault?",
  "submit_proposal": "I want to propose we buy a water pump",
  "vote": "I support the education grant proposal",
  "onboard": "How do I join this DAO?"
}
```

#### 2. Contextual Reasoning

**Features:**
- User role awareness (member, admin, guest)
- DAO-specific context (treasury size, active proposals)
- Historical interaction memory
- Cultural context adaptation
- Multi-step task planning

**Context Structure:**
```typescript
interface UserContext {
  userId: string;
  daoId: string;
  role: 'guest' | 'member' | 'admin' | 'founder';
  walletAddress?: string;
  contributionScore: number;
  recentActions: Action[];
  preferences: {
    language: string;
    notifications: boolean;
    theme: 'light' | 'dark';
  };
  sessionData: {
    activeTask?: Task;
    conversationHistory: Message[];
    lastInteraction: Date;
  };
}
```

#### 3. Analytical Intelligence

**Modules:**

**a) Financial Analytics**
- Treasury health scoring
- Cash flow projections
- Expense pattern analysis
- Risk assessment
- Proposal cost-benefit analysis

**b) Governance Analytics**
- Voting participation rates
- Proposal success patterns
- Member engagement scoring
- Delegation network analysis
- Quorum prediction

**c) Community Analytics**
- Growth metrics
- Contribution distribution
- Retention analysis
- Network effects
- Community sentiment

#### 4. Ethical Governance

**Guardrails:**
- Proposal risk flagging
- Budget constraint enforcement
- Conflict of interest detection
- Fair voting verification
- Anti-manipulation checks

**Ethics Framework:**
```typescript
interface EthicsCheck {
  proposalId: string;
  checks: {
    budgetCompliance: boolean;
    conflictOfInterest: boolean;
    communityBenefit: number; // 0-1 score
    riskLevel: 'low' | 'medium' | 'high';
    fairnessScore: number; // 0-1 score
  };
  recommendations: string[];
  requiredActions: string[];
}
```

### Technical Architecture

#### Module Structure

```
/core/nuru/
├── index.ts                    # Main orchestrator
├── config/
│   ├── model_config.json       # LLM settings
│   └── intent_schema.json      # Intent definitions
├── nlu/
│   ├── intent_classifier.ts
│   ├── entity_extractor.ts
│   ├── language_detector.ts
│   └── sentiment_analyzer.ts
├── reasoning/
│   ├── context_manager.ts
│   ├── task_planner.ts
│   ├── decision_engine.ts
│   └── explainability.ts
├── analytics/
│   ├── financial_analyzer.ts
│   ├── governance_analyzer.ts
│   ├── community_analyzer.ts
│   └── predictive_models.ts
├── ethics/
│   ├── risk_assessor.ts
│   ├── fairness_checker.ts
│   ├── compliance_validator.ts
│   └── bias_monitor.ts
├── memory/
│   ├── vector_store.ts
│   ├── conversation_history.ts
│   └── knowledge_base.ts
└── training/
    ├── fine_tuning/
    │   ├── dataset_builder.ts
    │   └── model_trainer.ts
    ├── embeddings/
    │   └── embedding_generator.ts
    └── feedback_loop/
        └── correction_handler.ts
```

#### LLM Integration

**Primary Model:** GPT-4 / Claude 3.5 Sonnet (Production)  
**Fallback Models:** GPT-3.5-turbo, Llama 3, Mistral  
**Fine-tuning:** Custom LoRA adapters for Swahili and DAO domain

**Model Configuration:**
```typescript
const nuruConfig = {
  model: 'gpt-4-turbo-preview',
  temperature: 0.7,
  maxTokens: 1500,
  topP: 0.9,
  frequencyPenalty: 0.3,
  presencePenalty: 0.3,
  systemPrompt: `You are Nuru, the reasoning core of Morio AI...`,
  tools: [
    'analyze_treasury',
    'assess_proposal',
    'predict_outcome',
    'explain_decision'
  ]
};
```

#### Vector Database (Memory)

**Purpose:** Long-term memory, semantic search, RAG (Retrieval Augmented Generation)

**Options:**
- **Pinecone** (Managed, scalable)
- **Weaviate** (Self-hosted, GraphQL)
- **Chroma** (Embedded, lightweight)

**Schema:**
```typescript
interface VectorDocument {
  id: string;
  daoId: string;
  type: 'proposal' | 'discussion' | 'decision' | 'policy';
  content: string;
  embedding: number[]; // 1536-dim for OpenAI
  metadata: {
    timestamp: Date;
    author: string;
    tags: string[];
    sentiment: number;
  };
}
```

### API Interface

#### Internal Endpoints (Nuru ↔ Morio)

```typescript
// POST /nuru/understand
interface UnderstandRequest {
  message: string;
  userId: string;
  daoId: string;
  context?: UserContext;
}

interface UnderstandResponse {
  intent: string;
  entities: Record<string, any>;
  confidence: number;
  language: string;
  sentiment: number;
  nextAction?: string;
}

// POST /nuru/reason
interface ReasonRequest {
  query: string;
  context: UserContext;
  daoData: DAOSnapshot;
}

interface ReasonResponse {
  reasoning: string;
  recommendation: string;
  confidence: number;
  sources: string[];
  alternatives?: string[];
}

// POST /nuru/analyze
interface AnalyzeRequest {
  type: 'treasury' | 'governance' | 'community';
  daoId: string;
  timeframe?: string;
}

interface AnalyzeResponse {
  summary: string;
  metrics: Record<string, number>;
  insights: string[];
  risks: Risk[];
  recommendations: string[];
}
```

---

## 🏗️ KWETU - The Body (Community & Economy Layer)

### Purpose

Kwetu (Swahili: "Our Home") is the operational backbone that connects blockchain infrastructure, financial services, and DAO management into a unified system.

### Core Components

#### 1. Wallet Management Service

**Features:**
- Wallet creation (EOA and smart contract wallets)
- Multi-sig wallet support
- Social recovery
- Gasless transactions (meta-transactions)
- Cross-chain compatibility

**Wallet Types:**
```typescript
enum WalletType {
  EOA = 'externally_owned_account',      // MetaMask, WalletConnect
  SMART_WALLET = 'smart_contract_wallet', // Account Abstraction
  CUSTODIAL = 'custodial',               // For onboarding ease
  MULTI_SIG = 'multi_signature'          // Governance wallets
}

interface Wallet {
  id: string;
  userId: string;
  daoId: string;
  type: WalletType;
  address: string;
  chain: string;
  balance: {
    native: string;
    tokens: TokenBalance[];
  };
  permissions: Permission[];
  createdAt: Date;
}
```

**Operations:**
```typescript
class WalletService {
  // Create new wallet
  async createWallet(
    userId: string,
    type: WalletType,
    options?: WalletOptions
  ): Promise<Wallet>;

  // Link existing wallet
  async linkWallet(
    userId: string,
    address: string,
    signature: string
  ): Promise<Wallet>;

  // Get balance
  async getBalance(
    walletId: string,
    includeTokens?: boolean
  ): Promise<Balance>;

  // Transfer funds
  async transfer(
    fromWalletId: string,
    toAddress: string,
    amount: string,
    token?: string
  ): Promise<Transaction>;

  // Social recovery
  async initiateRecovery(
    walletId: string,
    guardians: string[]
  ): Promise<RecoveryRequest>;
}
```

#### 2. Vault Management System

**Purpose:** Secure, transparent community treasury management

**Vault Types:**
- **General Fund** - Main community treasury
- **Project Vault** - Specific initiative funding
- **Savings Vault** - Long-term community savings
- **Emergency Fund** - Crisis response reserves

**Vault Structure:**
```typescript
interface Vault {
  id: string;
  daoId: string;
  name: string;
  type: VaultType;
  address: string; // Smart contract address
  chain: string;
  balance: {
    current: string;
    allocated: string;
    available: string;
  };
  rules: {
    minApprovalThreshold: number; // e.g., 60%
    minQuorum: number;            // e.g., 30%
    spendingLimits: {
      daily: string;
      monthly: string;
      perProposal: string;
    };
    allowedSpenders: string[];
    requiresMultiSig: boolean;
  };
  transactions: VaultTransaction[];
  createdAt: Date;
  updatedAt: Date;
}

interface VaultTransaction {
  id: string;
  vaultId: string;
  type: 'deposit' | 'withdrawal' | 'allocation' | 'return';
  amount: string;
  from: string;
  to: string;
  proposalId?: string;
  status: 'pending' | 'approved' | 'executed' | 'rejected';
  approvals: Approval[];
  txHash?: string;
  timestamp: Date;
}
```

**Vault Service:**
```typescript
class VaultService {
  // Create new vault
  async createVault(
    daoId: string,
    config: VaultConfig
  ): Promise<Vault>;

  // Deposit funds
  async deposit(
    vaultId: string,
    amount: string,
    from: string,
    source: 'member' | 'grant' | 'revenue'
  ): Promise<VaultTransaction>;

  // Request withdrawal
  async requestWithdrawal(
    vaultId: string,
    amount: string,
    to: string,
    reason: string,
    proposalId?: string
  ): Promise<VaultTransaction>;

  // Approve transaction
  async approveTransaction(
    transactionId: string,
    approverId: string,
    signature: string
  ): Promise<Approval>;

  // Execute approved transaction
  async executeTransaction(
    transactionId: string
  ): Promise<TransactionReceipt>;

  // Get vault analytics
  async getAnalytics(
    vaultId: string,
    period: string
  ): Promise<VaultAnalytics>;
}
```

#### 3. Proposal Management System

**Proposal Lifecycle:**
```
Create → Submit → Discussion → Vote → Execute → Report
```

**Proposal Types:**
```typescript
enum ProposalType {
  GRANT = 'grant_request',           // Request funds
  POLICY = 'policy_change',          // Change DAO rules
  MEMBERSHIP = 'membership_decision', // Add/remove members
  TREASURY = 'treasury_allocation',  // Budget allocation
  PARTNERSHIP = 'partnership',       // External collaboration
  GENERAL = 'general_decision'       // Community vote
}

interface Proposal {
  id: string;
  daoId: string;
  type: ProposalType;
  title: string;
  description: string;
  proposer: {
    userId: string;
    address: string;
    reputation: number;
  };
  budget?: {
    requested: string;
    allocated: string;
    vaultId: string;
  };
  timeline: {
    submitted: Date;
    discussionEnds: Date;
    votingStarts: Date;
    votingEnds: Date;
    executionDeadline?: Date;
  };
  voting: {
    strategy: 'token-weighted' | 'one-person-one-vote' | 'quadratic';
    quorum: number;
    threshold: number;
    votes: Vote[];
    result?: VoteResult;
  };
  status: ProposalStatus;
  attachments: Attachment[];
  comments: Comment[];
  tags: string[];
}

enum ProposalStatus {
  DRAFT = 'draft',
  SUBMITTED = 'submitted',
  IN_DISCUSSION = 'in_discussion',
  IN_VOTING = 'in_voting',
  PASSED = 'passed',
  REJECTED = 'rejected',
  EXECUTED = 'executed',
  EXPIRED = 'expired'
}
```

**Proposal Service:**
```typescript
class ProposalService {
  // Create proposal
  async createProposal(
    daoId: string,
    proposalData: ProposalInput
  ): Promise<Proposal>;

  // Submit for voting
  async submitProposal(
    proposalId: string,
    userId: string
  ): Promise<Proposal>;

  // Cast vote
  async vote(
    proposalId: string,
    userId: string,
    choice: 'for' | 'against' | 'abstain',
    votingPower?: string,
    reason?: string
  ): Promise<Vote>;

  // Execute passed proposal
  async executeProposal(
    proposalId: string,
    executorId: string
  ): Promise<ExecutionResult>;

  // Get proposal analytics
  async getProposalMetrics(
    daoId: string,
    timeframe?: string
  ): Promise<ProposalMetrics>;
}
```

#### 4. Payment Integration Layer

**Supported Payment Rails:**

**a) M-Pesa (Kenya, Tanzania, etc.)**
```typescript
class MPesaService {
  // Deposit via M-Pesa
  async initiateDeposit(
    phoneNumber: string,
    amount: string,
    daoId: string,
    userId: string
  ): Promise<MPesaTransaction>;

  // Withdraw to M-Pesa
  async initiateWithdrawal(
    phoneNumber: string,
    amount: string,
    reason: string
  ): Promise<MPesaTransaction>;

  // Check transaction status
  async checkStatus(
    transactionId: string
  ): Promise<TransactionStatus>;

  // Webhook handler
  async handleCallback(
    payload: MPesaCallback
  ): Promise<void>;
}
```

**b) Paystack (Nigeria, Ghana, South Africa)**
```typescript
class PaystackService {
  // Initialize payment
  async initializePayment(
    email: string,
    amount: string,
    metadata: PaymentMetadata
  ): Promise<PaymentSession>;

  // Verify payment
  async verifyPayment(
    reference: string
  ): Promise<PaymentVerification>;

  // Create transfer recipient
  async createRecipient(
    accountNumber: string,
    bankCode: string,
    name: string
  ): Promise<Recipient>;

  // Initiate transfer
  async transfer(
    recipientCode: string,
    amount: string,
    reason: string
  ): Promise<Transfer>;
}
```

**c) KotaniPay (Multi-country blockchain ↔ mobile money)**
```typescript
class KotaniPayService {
  // On-ramp (mobile money → crypto)
  async onramp(
    phoneNumber: string,
    amount: string,
    currency: string,
    cryptoAddress: string
  ): Promise<OnrampTransaction>;

  // Off-ramp (crypto → mobile money)
  async offramp(
    cryptoAddress: string,
    amount: string,
    currency: string,
    phoneNumber: string
  ): Promise<OfframpTransaction>;

  // Get exchange rate
  async getRate(
    fromCurrency: string,
    toCurrency: string
  ): Promise<ExchangeRate>;
}
```

**Payment Orchestrator:**
```typescript
class PaymentOrchestrator {
  private providers: Map<string, PaymentProvider>;

  // Route payment to best provider
  async routePayment(
    country: string,
    method: 'mobile_money' | 'bank' | 'card',
    amount: string
  ): Promise<PaymentProvider>;

  // Process deposit
  async processDeposit(
    userId: string,
    daoId: string,
    amount: string,
    source: PaymentSource
  ): Promise<DepositResult>;

  // Process withdrawal
  async processWithdrawal(
    userId: string,
    daoId: string,
    amount: string,
    destination: PaymentDestination
  ): Promise<WithdrawalResult>;

  // Handle webhook
  async handleWebhook(
    provider: string,
    payload: any,
    signature: string
  ): Promise<void>;
}
```

#### 5. Smart Contract Interface

**Contract Architecture:**
```
DAOFactory.sol       → Creates new DAOs
DAOGovernance.sol    → Voting and proposals
VaultManager.sol     → Treasury management
MemberRegistry.sol   → Member roles and permissions
ReputationToken.sol  → Contribution tracking
```

**Blockchain Service:**
```typescript
class BlockchainService {
  private providers: Map<string, ethers.Provider>;
  private contracts: Map<string, ethers.Contract>;

  // Deploy DAO contracts
  async deployDAO(
    config: DAOConfig
  ): Promise<DAOContracts>;

  // Create proposal on-chain
  async createProposal(
    daoAddress: string,
    proposalData: string
  ): Promise<TransactionReceipt>;

  // Execute vote
  async castVote(
    daoAddress: string,
    proposalId: string,
    vote: number,
    signature: string
  ): Promise<TransactionReceipt>;

  // Transfer from vault
  async executeTransfer(
    vaultAddress: string,
    to: string,
    amount: string,
    approvalSignatures: string[]
  ): Promise<TransactionReceipt>;

  // Listen to events
  async subscribeToEvents(
    contractAddress: string,
    eventName: string,
    callback: EventCallback
  ): Promise<void>;

  // Gas estimation
  async estimateGas(
    transaction: Transaction
  ): Promise<GasEstimate>;
}
```

#### 6. Transaction Engine

**Features:**
- Transaction batching
- Gas optimization
- Nonce management
- Retry logic
- Transaction monitoring

```typescript
class TransactionEngine {
  // Queue transaction
  async queueTransaction(
    transaction: PendingTransaction
  ): Promise<string>;

  // Process queue
  async processQueue(): Promise<ProcessedTransactions>;

  // Batch transactions
  async batchTransactions(
    transactions: Transaction[]
  ): Promise<BatchedTransaction>;

  // Monitor status
  async monitorTransaction(
    txHash: string
  ): Promise<TransactionStatus>;

  // Handle failure
  async handleFailure(
    txHash: string,
    error: Error
  ): Promise<RetryResult>;
}
```

### Database Schema (PostgreSQL)

```sql
-- DAOs
CREATE TABLE daos (
  id UUID PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  chain VARCHAR(50),
  contract_address VARCHAR(42),
  treasury_address VARCHAR(42),
  member_count INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Users
CREATE TABLE users (
  id UUID PRIMARY KEY,
  phone_number VARCHAR(20) UNIQUE,
  email VARCHAR(255) UNIQUE,
  username VARCHAR(50) UNIQUE,
  profile_data JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

-- DAO Memberships
CREATE TABLE dao_members (
  id UUID PRIMARY KEY,
  dao_id UUID REFERENCES daos(id),
  user_id UUID REFERENCES users(id),
  role VARCHAR(50),
  reputation_score INT DEFAULT 0,
  joined_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(dao_id, user_id)
);

-- Wallets
CREATE TABLE wallets (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  dao_id UUID REFERENCES daos(id),
  address VARCHAR(42) NOT NULL,
  wallet_type VARCHAR(50),
  chain VARCHAR(50),
  is_primary BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Vaults
CREATE TABLE vaults (
  id UUID PRIMARY KEY,
  dao_id UUID REFERENCES daos(id),
  name VARCHAR(255),
  vault_type VARCHAR(50),
  address VARCHAR(42),
  chain VARCHAR(50),
  balance DECIMAL(36, 18),
  rules JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Proposals
CREATE TABLE proposals (
  id UUID PRIMARY KEY,
  dao_id UUID REFERENCES daos(id),
  proposer_id UUID REFERENCES users(id),
  proposal_type VARCHAR(50),
  title VARCHAR(255),
  description TEXT,
  budget_requested DECIMAL(36, 18),
  voting_config JSONB,
  status VARCHAR(50),
  created_at TIMESTAMP DEFAULT NOW(),
  voting_starts_at TIMESTAMP,
  voting_ends_at TIMESTAMP
);

-- Votes
CREATE TABLE votes (
  id UUID PRIMARY KEY,
  proposal_id UUID REFERENCES proposals(id),
  voter_id UUID REFERENCES users(id),
  choice VARCHAR(20),
  voting_power DECIMAL(36, 18),
  reason TEXT,
  voted_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(proposal_id, voter_id)
);

-- Transactions
CREATE TABLE transactions (
  id UUID PRIMARY KEY,
  dao_id UUID REFERENCES daos(id),
  from_address VARCHAR(42),
  to_address VARCHAR(42),
  amount DECIMAL(36, 18),
  token VARCHAR(42),
  tx_type VARCHAR(50),
  status VARCHAR(50),
  tx_hash VARCHAR(66),
  proposal_id UUID REFERENCES proposals(id),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Payment Transactions
CREATE TABLE payment_transactions (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  dao_id UUID REFERENCES daos(id),
  provider VARCHAR(50),
  transaction_type VARCHAR(50),
  amount DECIMAL(36, 18),
  currency VARCHAR(10),
  phone_number VARCHAR(20),
  status VARCHAR(50),
  provider_reference VARCHAR(255),
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_dao_members_dao ON dao_members(dao_id);
CREATE INDEX idx_proposals_dao ON proposals(dao_id);
CREATE INDEX idx_proposals_status ON proposals(status);
CREATE INDEX idx_votes_proposal ON votes(proposal_id);
CREATE INDEX idx_transactions_dao ON transactions(dao_id);
CREATE INDEX idx_payment_transactions_user ON payment_transactions(user_id);
```

### Module Structure

```
/core/kwetu/
├── index.ts
├── config/
│   ├── chains.json
│   ├── contracts.json
│   └── payment_providers.json
├── wallet/
│   ├── wallet_service.ts
│   ├── wallet_factory.ts
│   ├── social_recovery.ts
│   └── meta_transactions.ts
├── vault/
│   ├── vault_service.ts
│   ├── vault_manager.ts
│   ├── approval_engine.ts
│   └── analytics.ts
├── dao/
│   ├── dao_service.ts
│   ├── dao_factory.ts
│   ├── member_manager.ts
│   └── reputation_system.ts
├── proposal/
│   ├── proposal_service.ts
│   ├── voting_engine.ts
│   ├── execution_engine.ts
│   └── proposal_templates.ts
├── blockchain/
│   ├── blockchain_service.ts
│   ├── contract_interface.ts
│   ├── transaction_engine.ts
│   ├── event_listener.ts
│   └── gas_optimizer.ts
├── payments/
│   ├── payment_orchestrator.ts
│   ├── providers/
│   │   ├── mpesa.ts
│   │   ├── paystack.ts
│   │   ├── kotanipay.ts
│   │   └── flutterwave.ts
│   ├── webhook_handler.ts
│   └── reconciliation.ts
├── integrations/
│   ├── safeguard_api.ts
│   ├── theograph_api.ts
│   └── chainlink_oracle.ts
└── analytics/
    ├── treasury_analytics.ts
    ├── governance_analytics.ts
    ├── member_analytics.ts
    └── performance_metrics.ts
```

---

## 💬 MORIO - The Spirit (Conversational Interface)

### Purpose

Morio is the personality layer and user-facing interface of the system. Named after a Swahili word suggesting "spirit" or "essence," Morio embodies the soul of the DAO—making complex operations feel natural, approachable, and culturally relevant.

### Core Characteristics

#### Personality Traits

```json
{
  "name": "Morio",
  "role": "Community DAO Assistant",
  "traits": {
    "warmth": 0.9,
    "professionalism": 0.7,
    "humor": 0.5,
    "empathy": 0.9,
    "proactivity": 0.7,
    "formality": 0.3
  },
  "communication_style": {
    "tone": "friendly_professional",
    "language_mixing": {
      "swahili_frequency": 0.2,
      "local_idioms": true,
      "code_switching": "natural"
    },
    "emoji_use": "moderate",
    "greeting_style": "warm_contextual",
    "response_length": "concise_informative"
  },
  "cultural_awareness": {
    "respects_hierarchy": true,
    "community_first": true,
    "time_flexible": true,
    "celebration_aware": true
  }
}
```

#### Sample Interactions

**Onboarding:**
```
User: "Hi"

Morio: "Karibu! 👋 I'm Morio, your DAO assistant. 

I help communities like yours manage money, make decisions together, and grow stronger. 

Are you:
• New here and want to join?
• Already a member checking on something?
• Just exploring how we work?"
```

**Balance Check:**
```
User: "How much money do we have?"

Morio: "Let me check our community vault... 💰

Main Vault: 245,000 KES
├─ Available: 180,000 KES
├─ Allocated to projects: 50,000 KES
└─ Emergency fund: 15,000 KES

We're in good shape! The water pump project is using 35K and the school supplies grant took 15K.

Want to see where the money went this month?"
```

**Proposal Creation:**
```
User: "I want to propose we buy solar panels for the community center"

Morio: "Great idea! 🌞 Let's set up your proposal.

I need a few details:
1. How much will the solar panels cost?
2. Which supplier or shop?
3. Who will install them?
4. When would this happen?

Take your time - I'll help you write it in a way the community will understand clearly."
```

**Cultural Context:**
```
User: "Can we vote on Sundays?"

Morio: "Ahh, I understand - many of our members are at church on Sunday mornings. 🙏

How about we:
• Start voting Saturday evening
• Keep it open through Monday
• Send a reminder after church hours

This way everyone gets a fair chance. Sound good?"
```

### Interface Channels

#### 1. Web Application (React)

**Tech Stack:**
- **Framework:** React 18 + TypeScript
- **Styling:** Tailwind CSS
- **State:** Zustand / Redux Toolkit
- **Web3:** wagmi + viem
- **Forms:** React Hook Form
- **Charts:** Recharts

**Key Components:**

```typescript
// Chat Interface
const ChatInterface: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const { user, dao } = useContext(AppContext);

  const sendMessage = async (text: string) => {
    // Add user message
    setMessages(prev => [...prev, { 
      role: 'user', 
      content: text 
    }]);

    // Call Morio API
    const response = await fetch('/api/morio/chat', {
      method: 'POST',
      body: JSON.stringify({
        message: text,
        userId: user.id,
        daoId: dao.id,
        context: {
          walletConnected: !!user.wallet,
          memberRole: user.role
        }
      })
    });

    const data = await response.json();
    
    // Add Morio response
    setMessages(prev => [...prev, {
      role: 'assistant',
      content: data.message,
      actions: data.suggestedActions
    }]);
  };

  return (
    <div className="chat-container">
      <MessageList messages={messages} />
      <ChatInput onSend={sendMessage} />
      <QuickActions actions={suggestedActions} />
    </div>
  );
};

// Wallet Modal
const WalletModal: React.FC<WalletModalProps> = ({ isOpen, onClose }) => {
  const { connect, connectors } = useConnect();
  
  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <h2>Connect Your Wallet</h2>
      <div className="connector-list">
        {connectors.map(connector => (
          <button 
            key={connector.id}
            onClick={() => connect({ connector })}
          >
            {connector.name}
          </button>
        ))}
      </div>
      <div className="or-divider">OR</div>
      <button onClick={createNewWallet}>
        Create New Wallet with Morio
      </button>
    </Modal>
  );
};

// Proposal Card
const ProposalCard: React.FC<ProposalCardProps> = ({ proposal }) => {
  const [voting, setVoting] = useState(false);

  const handleVote = async (choice: 'for' | 'against' | 'abstain') => {
    setVoting(true);
    await voteOnProposal(proposal.id, choice);
    setVoting(false);
  };

  return (
    <div className="proposal-card">
      <div className="proposal-header">
        <h3>{proposal.title}</h3>
        <ProposalStatus status={proposal.status} />
      </div>
      
      <p>{proposal.description}</p>
      
      {proposal.budget && (
        <div className="budget-info">
          💰 Requesting: {formatCurrency(proposal.budget.requested)}
        </div>
      )}

      <VotingProgress proposal={proposal} />

      {proposal.status === 'in_voting' && (
        <div className="voting-actions">
          <button onClick={() => handleVote('for')} disabled={voting}>
            ✓ Support
          </button>
          <button onClick={() => handleVote('against')} disabled={voting}>
            ✗ Oppose
          </button>
          <button onClick={() => handleVote('abstain')} disabled={voting}>
            − Abstain
          </button>
        </div>
      )}
    </div>
  );
};

// Dashboard
const DAODashboard: React.FC = () => {
  const { dao } = useDAOContext();
  const { data: analytics } = useQuery(['dao-analytics', dao.id], 
    () => fetchDAOAnalytics(dao.id)
  );

  return (
    <div className="dashboard">
      <DashboardHeader dao={dao} />
      
      <div className="stats-grid">
        <StatCard 
          title="Treasury Balance"
          value={formatCurrency(analytics.treasuryBalance)}
          trend={analytics.treasuryTrend}
        />
        <StatCard 
          title="Active Members"
          value={analytics.memberCount}
          trend={analytics.memberTrend}
        />
        <StatCard 
          title="Active Proposals"
          value={analytics.activeProposals}
        />
        <StatCard 
          title="Total Funded"
          value={formatCurrency(analytics.totalFunded)}
        />
      </div>

      <div className="dashboard-grid">
        <TreasuryChart data={analytics.treasuryHistory} />
        <RecentActivity activities={analytics.recentActivities} />
        <ActiveProposals proposals={analytics.proposals} />
        <MemberContributions contributions={analytics.topContributors} />
      </div>

      <ChatWidget />
    </div>
  );
};
```

**Component Structure:**
```
/agents/morio/ui/
├── components/
│   ├── chat/
│   │   ├── ChatInterface.tsx
│   │   ├── MessageList.tsx
│   │   ├── MessageBubble.tsx
│   │   ├── ChatInput.tsx
│   │   ├── QuickActions.tsx
│   │   └── TypingIndicator.tsx
│   ├── wallet/
│   │   ├── WalletModal.tsx
│   │   ├── WalletConnect.tsx
│   │   ├── BalanceDisplay.tsx
│   │   └── TransactionHistory.tsx
│   ├── dao/
│   │   ├── DAODashboard.tsx
│   │   ├── DAOSettings.tsx
│   │   ├── MemberList.tsx
│   │   └── InviteMember.tsx
│   ├── proposals/
│   │   ├── ProposalList.tsx
│   │   ├── ProposalCard.tsx
│   │   ├── ProposalDetail.tsx
│   │   ├── CreateProposal.tsx
│   │   └── VotingInterface.tsx
│   ├── vault/
│   │   ├── VaultOverview.tsx
│   │   ├── DepositModal.tsx
│   │   ├── WithdrawModal.tsx
│   │   └── TransactionList.tsx
│   └── analytics/
│       ├── TreasuryChart.tsx
│       ├── ActivityFeed.tsx
│       ├── MemberMetrics.tsx
│       └── GovernanceStats.tsx
├── hooks/
│   ├── useChat.ts
│   ├── useDAO.ts
│   ├── useWallet.ts
│   ├── useProposals.ts
│   └── useVault.ts
├── contexts/
│   ├── AppContext.tsx
│   ├── DAOContext.tsx
│   └── Web3Context.tsx
├── utils/
│   ├── formatting.ts
│   ├── validation.ts
│   └── constants.ts
└── styles/
    ├── globals.css
    └── theme.ts
```

#### 2. Telegram Bot

**Features:**
- Natural language commands
- Inline keyboards for actions
- Transaction notifications
- Voting reminders
- Group chat integration

**Implementation:**
```typescript
import { Bot, InlineKeyboard } from 'grammy';

class MorioTelegramBot {
  private bot: Bot;
  private morioAPI: MorioAPIClient;

  constructor(token: string) {
    this.bot = new Bot(token);
    this.setupHandlers();
  }

  private setupHandlers() {
    // Start command
    this.bot.command('start', async (ctx) => {
      const keyboard = new InlineKeyboard()
        .text('Join DAO', 'join_dao')
        .text('Check Balance', 'check_balance').row()
        .text('View Proposals', 'view_proposals')
        .text('Help', 'help');

      await ctx.reply(
        'Karibu! 👋 I\'m Morio, your DAO assistant.\n\n' +
        'What would you like to do?',
        { reply_markup: keyboard }
      );
    });

    // Natural language messages
    this.bot.on('message:text', async (ctx) => {
      const userId = ctx.from.id.toString();
      const message = ctx.message.text;

      // Send typing indicator
      await ctx.replyWithChatAction('typing');

      // Process with Morio
      const response = await this.morioAPI.chat({
        message,
        userId,
        platform: 'telegram',
        context: {
          chatId: ctx.chat.id,
          username: ctx.from.username
        }
      });

      // Send response
      await ctx.reply(response.message, {
        reply_markup: response.keyboard,
        parse_mode: 'Markdown'
      });
    });

    // Callback queries (button clicks)
    this.bot.on('callback_query:data', async (ctx) => {
      const action = ctx.callbackQuery.data;
      
      switch(action) {
        case 'check_balance':
          await this.handleBalanceCheck(ctx);
          break;
        case 'view_proposals':
          await this.handleViewProposals(ctx);
          break;
        case 'join_dao':
          await this.handleJoinDAO(ctx);
          break;
      }

      await ctx.answerCallbackQuery();
    });
  }

  private async handleBalanceCheck(ctx: any) {
    const userId = ctx.from.id.toString();
    const balance = await this.morioAPI.getBalance(userId);

    const message = 
      `💰 *Your Balance*\n\n` +
      `Main Wallet: ${balance.wallet} KES\n` +
      `DAO Share: ${balance.daoShare} KES\n` +
      `Pending: ${balance.pending} KES`;

    await ctx.editMessageText(message, {
      parse_mode: 'Markdown'
    });
  }

  private async handleViewProposals(ctx: any) {
    const userId = ctx.from.id.toString();
    const proposals = await this.morioAPI.getProposals(userId);

    const keyboard = new InlineKeyboard();
    proposals.forEach(p => {
      keyboard.text(
        `${p.title} (${p.status})`, 
        `proposal_${p.id}`
      ).row();
    });

    await ctx.editMessageText(
      '📋 *Active Proposals*\n\nSelect a proposal to view details:',
      { 
        parse_mode: 'Markdown',
        reply_markup: keyboard 
      }
    );
  }

  public start() {
    this.bot.start();
    console.log('Morio Telegram Bot started');
  }
}
```

#### 3. WhatsApp Bot (via Twilio/360Dialog)

```typescript
class MorioWhatsAppBot {
  private client: WhatsAppClient;

  async handleIncomingMessage(message: IncomingMessage) {
    const userId = message.from;
    const text = message.body;

    // Process with Morio
    const response = await this.morioAPI.chat({
      message: text,
      userId,
      platform: 'whatsapp'
    });

    // Send response
    if (response.media) {
      await this.client.sendMedia(userId, response.media);
    }

    await this.client.sendMessage(userId, response.message);

    // Send interactive buttons if available
    if (response.actions) {
      await this.client.sendInteractiveButtons(
        userId,
        response.actions
      );
    }
  }

  async sendNotification(userId: string, notification: Notification) {
    const message = this.formatNotification(notification);
    await this.client.sendMessage(userId, message);
  }
}
```

#### 4. USSD Interface (for feature phones)

```typescript
class MorioUSSDService {
  async handleUSSDRequest(req: USSDRequest): Promise<USSDResponse> {
    const { sessionId, phoneNumber, text } = req;

    // Parse USSD input
    const input = text.split('*');
    const level = input.length;

    switch(level) {
      case 1: // Main menu
        return {
          message: 
            'CON Karibu Mtaa DAO\n' +
            '1. Check Balance\n' +
            '2. Deposit Money\n' +
            '3. Vote on Proposal\n' +
            '4. View Activity',
          continueSession: true
        };

      case 2: // Second level
        const choice = input[1];
        
        if (choice === '1') {
          const balance = await this.getBalance(phoneNumber);
          return {
            message: `END Your balance: ${balance} KES`,
            continueSession: false
          };
        }
        
        if (choice === '2') {
          return {
            message: 'CON Enter amount to deposit:',
            continueSession: true
          };
        }

        // ... more options

      case 3: // Third level
        // Handle specific actions
        break;
    }
  }
}
```

### Conversation Management

#### Session Management

```typescript
interface ConversationSession {
  sessionId: string;
  userId: string;
  daoId?: string;
  platform: 'web' | 'telegram' | 'whatsapp' | 'ussd';
  context: {
    currentTask?: Task;
    variables: Record<string, any>;
    history: Message[];
  };
  startedAt: Date;
  lastActivity: Date;
  expiresAt: Date;
}

class SessionManager {
  private sessions: Map<string, ConversationSession>;
  private redis: RedisClient;

  async getOrCreateSession(
    userId: string,
    platform: string
  ): Promise<ConversationSession> {
    const sessionId = this.generateSessionId(userId, platform);
    
    // Check Redis first
    let session = await this.redis.get(`session:${sessionId}`);
    
    if (!session) {
      session = {
        sessionId,
        userId,
        platform,
        context: {
          variables: {},
          history: []
        },
        startedAt: new Date(),
        lastActivity: new Date(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
      };
      
      await this.redis.set(
        `session:${sessionId}`,
        JSON.stringify(session),
        'EX',
        86400 // 24 hours
      );
    }
    
    return session;
  }

  async updateSession(
    sessionId: string,
    updates: Partial<ConversationSession>
  ): Promise<void> {
    const session = await this.getSession(sessionId);
    const updated = { ...session, ...updates, lastActivity: new Date() };
    
    await this.redis.set(
      `session:${sessionId}`,
      JSON.stringify(updated),
      'EX',
      86400
    );
  }

  async addToHistory(
    sessionId: string,
    message: Message
  ): Promise<void> {
    const session = await this.getSession(sessionId);
    session.context.history.push(message);
    
    // Keep only last 20 messages
    if (session.context.history.length > 20) {
      session.context.history = session.context.history.slice(-20);
    }
    
    await this.updateSession(sessionId, session);
  }
}
```

#### Intent Router

```typescript
class IntentRouter {
  private nuru: NuruClient;
  private kwetu: KwetuClient;

  async route(
    message: string,
    session: ConversationSession
  ): Promise<Response> {
    // Get intent from Nuru
    const understanding = await this.nuru.understand({
      message,
      userId: session.userId,
      daoId: session.daoId,
      context: session.context
    });

    const { intent, entities, confidence } = understanding;

    // Route to appropriate handler
    switch(intent) {
      case 'check_balance':
        return await this.handleCheckBalance(session, entities);
      
      case 'deposit':
        return await this.handleDeposit(session, entities);
      
      case 'withdraw':
        return await this.handleWithdraw(session, entities);
      
      case 'create_proposal':
        return await this.handleCreateProposal(session, entities);
      
      case 'vote':
        return await this.handleVote(session, entities);
      
      case 'check_proposals':
        return await this.handleCheckProposals(session, entities);
      
      case 'join_dao':
        return await this.handleJoinDAO(session, entities);
      
      case 'help':
        return await this.handleHelp(session, entities);
      
      default:
        return await this.handleUnknownIntent(message, session);
    }
  }

  private async handleCheckBalance(
    session: ConversationSession,
    entities: Entities
  ): Promise<Response> {
    const balance = await this.kwetu.getBalance({
      userId: session.userId,
      daoId: session.daoId
    });

    return {
      message: 
        `💰 Here's your balance breakdown:\n\n` +
        `Wallet: ${this.format(balance.wallet)} KES\n` +
        `DAO Share: ${this.format(balance.daoShare)} KES\n` +
        `Available to withdraw: ${this.format(balance.available)} KES`,
      actions: [
        { label: 'Deposit', action: 'deposit' },
        { label: 'Withdraw', action: 'withdraw' }
      ]
    };
  }

  private async handleDeposit(
    session: ConversationSession,
    entities: Entities
  ): Promise<Response> {
    // Check if amount is provided
    if (!entities.amount) {
      session.context.currentTask = {
        type: 'deposit',
        step: 'amount',
        data: {}
      };
      
      return {
        message: 'How much would you like to deposit? (in KES)',
        expectsInput: true
      };
    }

    // Initiate deposit
    const deposit = await this.kwetu.initiateDeposit({
      userId: session.userId,
      daoId: session.daoId,
      amount: entities.amount,
      method: entities.method || 'mpesa'
    });

    return {
      message: 
        `Great! I'm setting up a deposit of ${entities.amount} KES.\n\n` +
        `You'll receive an M-Pesa prompt on your phone shortly. ` +
        `Enter your PIN to complete the deposit.\n\n` +
        `Reference: ${deposit.reference}`,
      actions: [
        { label: 'Check Status', action: `check_deposit_${deposit.id}` }
      ]
    };
  }

  private async handleCreateProposal(
    session: ConversationSession,
    entities: Entities
  ): Promise<Response> {
    // Multi-step conversation for proposal creation
    const task = session.context.currentTask;
    
    if (!task || task.type !== 'create_proposal') {
      // Start proposal creation flow
      session.context.currentTask = {
        type: 'create_proposal',
        step: 'title',
        data: {}
      };
      
      return {
        message: 
          'Let\'s create your proposal! 📝\n\n' +
          'First, give it a clear title that explains what you want to do.',
        expectsInput: true
      };
    }

    // Handle each step
    switch(task.step) {
      case 'title':
        task.data.title = entities.text;
        task.step = 'description';
        return {
          message: 
            `Good title! Now describe your proposal in detail:\n\n` +
            `• What problem does it solve?\n` +
            `• How will it benefit the community?\n` +
            `• What are the key details?`,
          expectsInput: true
        };

      case 'description':
        task.data.description = entities.text;
        task.step = 'budget';
        return {
          message: 
            'Does this proposal need money from the DAO treasury?\n\n' +
            'If yes, how much? If no, just say "no budget needed"',
          expectsInput: true
        };

      case 'budget':
        if (entities.amount) {
          task.data.budget = entities.amount;
        }
        task.step = 'confirm';
        
        return {
          message: this.formatProposalSummary(task.data),
          actions: [
            { label: 'Submit Proposal', action: 'confirm_proposal' },
            { label: 'Edit', action: 'edit_proposal' },
            { label: 'Cancel', action: 'cancel_proposal' }
          ]
        };

      case 'confirm':
        // Create proposal
        const proposal = await this.kwetu.createProposal({
          daoId: session.daoId,
          proposerId: session.userId,
          ...task.data
        });
        
        session.context.currentTask = undefined;
        
        return {
          message: 
            `🎉 Your proposal has been submitted!\n\n` +
            `Title: ${proposal.title}\n` +
            `ID: ${proposal.id}\n\n` +
            `It will enter the discussion phase for 3 days, ` +
            `then voting will begin. I'll notify you when voting starts!`,
          actions: [
            { label: 'View Proposal', action: `view_proposal_${proposal.id}` }
          ]
        };
    }
  }
}
```

### Module Structure

```
/agents/morio/
├── index.ts
├── config/
│   ├── personality.json
│   ├── responses.json
│   └── intents.json
├── api/
│   ├── chat_handler.ts
│   ├── webhook_handler.ts
│   └── notification_service.ts
├── platforms/
│   ├── web/
│   │   ├── api_routes.ts
│   │   └── websocket_handler.ts
│   ├── telegram/
│   │   ├── bot.ts
│   │   └── handlers.ts
│   ├── whatsapp/
│   │   ├── bot.ts
│   │   └── templates.ts
│   └── ussd/
│       ├── menu_builder.ts
│       └── session_handler.ts
├── conversation/
│   ├── session_manager.ts
│   ├── intent_router.ts
│   ├── response_generator.ts
│   └── context_tracker.ts
├── tasks/
│   ├── onboarding_flow.ts
│   ├── deposit_flow.ts
│   ├── withdrawal_flow.ts
│   ├── proposal_flow.ts
│   └── voting_flow.ts
└── utils/
    ├── formatting.ts
    ├── validation.ts
    └── localization.ts
```

---

## 🔗 Data Flow & Integration

### Request Flow Diagram

```
┌──────────┐
│   User   │
└────┬─────┘
     │
     │ 1. Message/Action
     ▼
┌─────────────────────┐
│  MORIO Interface    │
│  • Receives input   │
│  • Loads session    │
└────┬────────────────┘
     │
     │ 2. Process Request
     ▼
┌─────────────────────┐
│  Session Manager    │
│  • Get/Create session│
│  • Load context     │
└────┬────────────────┘
     │
     │ 3. Understand Intent
     ▼
┌─────────────────────┐
│  NURU (NLU)         │
│  • Classify intent  │
│  • Extract entities │
│  • Get context      │
└────┬────────────────┘
     │
     │ 4. Route to Handler
     ▼
┌─────────────────────┐
│  Intent Router      │
│  • Map to action    │
│  • Validate request │
└────┬────────────────┘
     │
     │ 5. Execute Action
     ▼
┌─────────────────────┐
│  KWETU Services     │
│  • Wallet ops       │
│  • DAO ops          │
│  • Blockchain tx    │
└────┬────────────────┘
     │
     │ 6. Get Analysis
     ▼
┌─────────────────────┐
│  NURU (Analytics)   │
│  • Analyze result   │
│  • Generate insights│
└────┬────────────────┘
     │
     │ 7. Format Response
     ▼
┌─────────────────────┐
│  Response Generator │
│  • Apply personality│
│  • Localize text    │
│  • Add actions      │
└────┬────────────────┘
     │
     │ 8. Send Response
     ▼
┌─────────────────────┐
│  MORIO Interface    │
│  • Deliver to user  │
│  • Update session   │
└────┬────────────────┘
     │
     ▼
┌──────────┐
│   User   │
└──────────┘
```

### Integration Patterns

#### 1. Synchronous Operations

**Use Case:** Real-time queries (balance check, proposal status)

```typescript
// User requests balance
async function handleBalanceCheck(userId: string, daoId: string) {
  // 1. Morio receives request
  const session = await sessionManager.getSession(userId);
  
  // 2. Nuru validates context
  const context = await nuru.getContext(userId, daoId);
  
  // 3. Kwetu fetches data
  const balance = await kwetu.getBalance(userId, daoId);
  const analytics = await nuru.analyzeBalance(balance, context);
  
  // 4. Nuru generates insights
  const insights = await nuru.generateInsights(balance, analytics);
  
  // 5. Morio formats response
  const response = await morio.formatResponse({
    data: balance,
    insights,
    personality: 'friendly'
  });
  
  // 6. Return to user
  return response;
}
```

#### 2. Asynchronous Operations

**Use Case:** Blockchain transactions, payment processing

```typescript
// User initiates deposit
async function handleDeposit(userId: string, amount: string) {
  // 1. Initiate process
  const depositId = await kwetu.initiateDeposit({
    userId,
    amount,
    method: 'mpesa'
  });
  
  // 2. Send immediate response
  await morio.sendMessage(userId, {
    message: 'Processing your deposit...',
    reference: depositId
  });
  
  // 3. Process asynchronously
  processDepositAsync(depositId, userId);
  
  return { status: 'pending', depositId };
}

async function processDepositAsync(depositId: string, userId: string) {
  try {
    // Wait for payment confirmation
    const payment = await paymentProvider.waitForConfirmation(depositId);
    
    // Execute blockchain transaction
    const tx = await kwetu.executeDeposit(depositId, payment);
    
    // Wait for confirmation
    await tx.wait();
    
    // Notify user
    await morio.sendNotification(userId, {
      type: 'deposit_complete',
      amount: payment.amount,
      txHash: tx.hash
    });
    
  }