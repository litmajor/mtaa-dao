# YUKI Strategy Ecosystem - User Journey & Deployment Model

## Overview

The YUKI platform enables strategy creators to publish trading strategies that users and DAOs can subscribe to. When subscribed, strategies deploy to multiple execution targets: DeFi vaults (on-chain) and exchange trading accounts (CEX via CCXT). This document maps the complete user journey and the relationships between all participants.

---

## 1. STRATEGY DEPLOYMENT ARCHITECTURE

### Where Strategies Execute

Strategies deploy to **two parallel execution environments**:

#### A. DeFi Vaults (On-Chain)
- **Purpose**: Rebalancing and token portfolio management across multiple chains
- **Targets**: Ethereum, Polygon, Arbitrum, Optimism, BSC, Celo
- **Mechanism**: 
  - Followers' capital allocated via `strategyAllocations` table
  - Rebalancing triggered by `strategyRebalancesTable` records
  - Smart contract execution via `dexRoutingExecution` service
- **Execution Flow**: 
  ```
  Strategy → dexRoutingExecution.executeRebalance()
         → Multi-asset swaps across DEXs
         → Portfolio rebalanced to target allocations
  ```

#### B. Exchange Accounts (CEX)
- **Purpose**: Margin trading, spot trading, futures via CEX APIs
- **Exchanges**: CCXT-supported (Binance, Kraken, FTX, etc.)
- **Mechanism**:
  - Followers connect exchange accounts (multi-account support)
  - Strategy sends trading signals
  - `ccxtService` executes orders on follower's accounts
- **Execution Flow**:
  ```
  Strategy → ccxtService.executeOrder()
         → Order routed to connected exchange account(s)
         → Smart routing via SmartRouter (best venue selection)
         → Order executed on follower's behalf
  ```

#### C. Backtesting Engine
- **Purpose**: Validate strategy performance before live deployment
- **Process**:
  - User backtests strategy via YUKI dashboard or API
  - `strategyNativeBacktestIntegration` (native TypeScript) or
  - `strategyFreqtradeIntegration` (Freqtrade subprocess) runs historical simulation
  - Results stored in `backtestJobsTable`
  - Backtest metrics inform follower decision-making

---

## 2. USER JOURNEY - STRATEGY CREATOR

### Phase 1: Create & Test Strategy

```
Creator Action: Define Strategy
├─ Set target allocations ({"ETH": 40%, "USDC": 30%, ...})
├─ Choose rebalance frequency (daily/weekly/monthly/manual)
├─ Set risk level (low/medium/high)
├─ Upload Freqtrade code (optional) or use native engine
└─ Store in strategiesTable with creatorId = creator.id

Creator Action: Backtest Strategy
├─ POST /api/yuki/strategies/:id/backtest
├─ → jobQueueService.queueJob('strategy-backtest')
├─ → strategyJobWorker processes job asynchronously
├─ → Results stored: returns sharpeRatio, maxDrawdown, winRate, totalTrades
├─ → strategyNativeBacktestIntegration or strategyFreqtradeIntegration
└─ → Results inform parameter tuning

Creator Action: Publish Strategy
├─ Set isPublic = true in strategiesTable
├─ Configure deployment settings (deploymentConfig)
├─ Set performance fees (managementFee, performanceFee)
└─ Strategy appears in marketplace for discovery
```

**Key Table**: `strategiesTable`
- `creatorId`: Creator's user ID
- `isPublic`: Whether listed in marketplace
- `backtestResults`: Performance metrics from backtesting
- `totalValueLocked`: Sum of follower allocations

---

## 3. USER JOURNEY - STRATEGY FOLLOWER

### Phase 1: Discover & Subscribe

```
Follower Action: Browse Marketplace
├─ GET /api/strategies (isPublic = true)
├─ Filter by: riskLevel, tags, performance metrics
├─ View creator's track record
└─ Review backtest results and historical performance

Follower Action: Subscribe to Strategy
├─ POST /api/strategies/:id/follow
├─ Input: investedAmountUsd (capital allocation)
├─ System creates strategyFollowersTable record:
│  ├─ followerId = follower.id
│  ├─ strategyId = strategy.id
│  ├─ investedAmountUsd = follower's allocation
│  └─ autoRebalance = true/false
├─ Platform fee charged (20% of performance gains typical)
└─ Follower capital now deployed to strategy
```

**Key Table**: `strategyFollowersTable`
- `followerId`: Subscriber's user ID
- `strategyId`: Creator's strategy ID
- `investedAmountUsd`: Capital allocated
- `autoRebalance`: Auto-execute or manual approval per rebalance

### Phase 2: Active Management

```
Follower's Capital Flow: Deployment
├─ Capital allocated to vault or exchange account
├─ Strategy generates trading signals
├─ rebalancingService creates `strategyRebalancesTable` record
├─ dexRoutingExecution or ccxtService executes orders
└─ Positions tracked in real-time

Follower's Capital Flow: Rebalancing Triggers
├─ Manual: Follower requests rebalance via API
├─ Automatic: Strategy-defined frequency (daily/weekly/monthly)
├─ Drift-based: When allocation drifts >threshold from target
├─ Time-based: Next rebalance scheduled at nextRebalanceAt

Follower Monitoring:
├─ GET /api/strategies/:id/performance
├─ Real-time metrics:
│  ├─ returnUsd: Profit/loss in USD
│  ├─ returnPercent: Percentage return
│  ├─ currentValueUsd: Current portfolio value
│  └─ Sharpe ratio, max drawdown, volatility
└─ Historical tracking via strategyPerformanceTable (daily snapshots)

Follower Action: Unsubscribe
├─ DELETE /api/strategies/:id/follow
├─ Positions liquidated gradually (to avoid slippage)
├─ Capital returned to follower wallet
└─ strategyFollowersTable record marked inactive
```

**Key Tables**:
- `strategyRebalancesTable`: Each rebalancing action logged
- `strategyPerformanceTable`: Daily performance snapshots
- `strategyAllocationsTable`: Current asset allocations

---

## 4. USER JOURNEY - DAO SUBSCRIBER

### Special Consideration: Multi-Account & DAO Treasury

```
DAO Action: Connect Treasury to Strategy
├─ Treasury selects strategy (same as individual follower)
├─ DAO allocates portion of treasury capital
├─ Multiple exchange accounts supported:
│  └─ Account 1 (Trading): Freqtrade signals
│  └─ Account 2 (Yield): Alternative strategies
│  └─ Account 3 (Hedging): Risk management
├─ daoId linked to strategyFollowersTable
└─ DAO governance may require approval per rebalance

DAO Treasury Integration:
├─ All follower relationships tracked in strategyFollowersTable
├─ DAO can connect via:
│  ├─ Investment Pools (vaults)
│  ├─ Treasury Vaults (isolated sub-funds)
│  └─ Multi-account exchange trading
├─ Performance fee splits:
│  ├─ Creator gets: 80% (or custom split)
│  ├─ Platform gets: 20% (or custom split)
│  └─ DAO governance may negotiate rates
└─ All rebalancing approved by DAO-level risk gates
```

**Key Relationships**:
- DAO owns multiple `investmentPools` or `vaults`
- Each pool/vault can follow multiple strategies
- Exchange accounts linked to DAO context (not individual user)

---

## 5. RELATIONSHIP MAP

### Entity Relationships

```
┌─────────────────────────────────────────────────────────────┐
│                    STRATEGY CREATOR                         │
│                   (creator.id, creatorId)                   │
└──────────────┬────────────────────────────────────────────────┘
               │ owns & manages
               ↓
┌─────────────────────────────────────────────────────────────┐
│         STRATEGY (strategiesTable)                          │
│  ├─ creatorId: Who created it                              │
│  ├─ totalValueLocked: Sum of all follower allocations      │
│  ├─ totalFollowers: Count of subscribers                   │
│  ├─ backtestResults: Historical performance                │
│  └─ deploymentConfig: Target allocations & rebalance rules │
└──────┬──────────────┬────────────────┬──────────────────────┘
       │              │                │
   subscribed     deployed to       backtested via
   by many        multiple targets   (can monitor)
       │              │                │
       ↓              ↓                ↓
  ┌──────────┐  ┌──────────┐    ┌────────────────┐
  │ FOLLOWERS│  │ DeFi     │    │ Backtest Job   │
  │ (users & │  │ Vaults   │    │ (async         │
  │ DAOs)    │  │ + CEX    │    │  queue)        │
  │          │  │ Accounts │    │                │
  └──────────┘  └──────────┘    └────────────────┘
```

### Financial Relationships

```
FOLLOWER INVESTS (strategyFollowersTable.investedAmountUsd)
         ↓
    PLATFORM EXECUTES STRATEGY
         ↓
    RETURNS GENERATED
         ├─→ Creator Fee: 80% (managementFee + performanceFee)
         ├─→ Platform Fee: 20% (platform cut)
         └─→ Follower Keeps: Returns after fees
```

---

## 6. FEE STRUCTURE

### Revenue Model (from codebase)

```
Investment Pool Model (extends to strategies):
├─ Management Fee: Charged on AUM (assets under management)
│  └─ Typical: 0.5% - 2% annually, deducted monthly
│
├─ Performance Fee: Charged only on profits
│  └─ Typical: 20% of gains (split: 80% creator, 20% platform)
│
└─ Platform Fee: Platform's cut on performance
   └─ Fixed at: 20% of performance fees
```

### Examples

**Example 1: Strategy with 10% Annual Return**
```
Initial Investment (Follower): $10,000
Year 1 Return: +$1,000 (10%)
Management Fee (1% annually): -$100
Performance Fee (20% of gains, 80% to creator): 
  Creator receives: $900 * 0.8 = $720
  Platform receives: $900 * 0.2 = $180
Follower's Net Gain: $1,000 - $100 - $900 = $0 (before performance fee)
Actually:
  Follower's gains: $1,000 - $100 = $900
  Creator's share: -$180 (20% performance fee goes to platform)
  Platform's take: $180
  Follower keeps: $900 - $180 = $720
```

---

## 7. EXECUTION FLOW - FROM BACKTEST TO LIVE

### Complete User Journey: Week 1

```
DAY 1: CREATOR BACKTESTS
├─ POST /api/yuki/strategies/eth-yield-01/backtest
│  ├─ dateFrom: 2023-01-01, dateTo: 2023-12-31
│  ├─ pair: ETH/USDT, timeframe: 1h
│  └─ Returns 202 Accepted with jobId
├─ Job queued: jobQueueService.queueJob('strategy-backtest')
├─ Worker processes: strategyJobWorker picks up job
├─ Engine selection:
│  └─ engine='freqtrade' → Uses Freqtrade subprocess
│  └─ engine='native' → Uses strategyNativeBacktestIntegration
├─ Results: {return: 127.5%, sharpeRatio: 1.85, maxDrawdown: -8.5%, trades: 45}
└─ Creator saves results in strategiesTable.backtestResults

DAY 2: CREATOR PUBLISHES
├─ Set isPublic = true
├─ Set managementFee: 1% annually
├─ Set performanceFee: 20% (split: 80/20 creator/platform)
├─ Strategy now appears in marketplace
└─ Marketplace shows backtest metrics

DAY 3-5: FOLLOWERS SUBSCRIBE
├─ Follower 1 allocates $10,000
├─ Follower 2 allocates $50,000
├─ DAO allocates $500,000
├─ strategyFollowersTable grows:
│  ├─ Row 1: followerId=user1, investedAmountUsd=10000
│  ├─ Row 2: followerId=user2, investedAmountUsd=50000
│  └─ Row 3: followerId=dao1, investedAmountUsd=500000
├─ strategiesTable updated: totalValueLocked = $560,000
└─ All three follower accounts connect their exchanges

DAY 6: FIRST REBALANCE TRIGGER
├─ Strategy rebalance frequency = 'weekly'
├─ nextRebalanceAt reached
├─ Creator or bot calls: POST /api/strategies/eth-yield-01/rebalance
├─ For EACH follower investment:
│  ├─ strategyRebalancesTable record created
│  ├─ Rebalance plan generated (buy/sell orders)
│  ├─ dexRoutingExecution.executeRebalance() called
│  ├─ CEX orders routed via ccxtService or SmartRouter
│  └─ All 3 follower positions updated according to strategy
├─ Rebalancing costs:
│  ├─ Gas fees (on-chain vaults)
│  ├─ Trading fees (DEX, CEX)
│  └─ Slippage impact
└─ strategyPerformanceTable records daily snapshot

WEEK 2-4: MONITORING & RETURNS
├─ Each follower can:
│  ├─ GET /api/strategies/eth-yield-01/performance
│  ├─ See: returns, Sharpe ratio, current AUM
│  └─ Verify strategy is following allocations
├─ strategyPerformanceTable grows with daily snapshots
├─ If strategy generates profit:
│  ├─ Platform calculates performance fee
│  ├─ Creator receives 80% of fee
│  ├─ Platform keeps 20%
│  └─ Follower gets returns after all fees
└─ If strategy underperforms:
   ├─ Follower can unsubscribe
   ├─ Positions liquidated gradually
   └─ Capital returned
```

---

## 8. DATA MODEL OVERVIEW

### Core Tables

| Table | Purpose | Creator Role | Follower Role | Platform Role |
|-------|---------|--------------|---------------|---------------|
| `strategiesTable` | Strategy definition | Creates with `creatorId` | Reads (view available) | Indexes & monetizes |
| `strategyFollowersTable` | Subscription records | Views metrics | Created when subscribes | Tracks for fee calc |
| `strategyAllocationsTable` | Current allocations | Sets targets | Tracks exposure | Executes on-chain |
| `strategyRebalancesTable` | Execution history | Logs all actions | Tracks costs | Audits compliance |
| `backtestJobsTable` | Backtest results | Creates job | Uses to decide | Provides compute |
| `strategyPerformanceTable` | Daily snapshots | Uses to optimize | Uses to monitor | Uses for reporting |
| `userWalletsTable` | Exchange connections | N/A | Connects accounts | Routes orders |

### Key Relationships

```
Creator → Creates → Strategy (strategiesTable.creatorId)
Follower → Subscribes → Strategy (strategyFollowersTable entry)
Strategy → Targets → DeFi Vaults + CEX Accounts
Rebalance → Executes → Multiple trades (strategyRebalancesTable.transactions)
Backtest → Validates → Strategy before deployment (backtestJobsTable)
Performance → Tracked → Daily via strategyPerformanceTable
```

---

## 9. SECURITY & AUTHORIZATION

### Ownership Checks

```
Strategy Creator:
├─ Can create strategy: Any authenticated user
├─ Can modify strategy: Only creatorId user
├─ Can view backtest: Public (unless marked private)
├─ Can collect fees: Only creatorId

Strategy Follower:
├─ Can subscribe: Any authenticated user with capital
├─ Can rebalance: If autoRebalance=true OR follower-initiated
├─ Can view returns: Only for own investment
├─ Can unsubscribe: Self-service

Platform:
├─ Can take performance fees: All strategies (20%)
├─ Can execute rebalances: On follower accounts (delegated)
├─ Can monitor: All strategies (compliance, risk gates)
└─ Can block: High-risk strategies (swapRiskGate)
```

### Risk Gates

```
Before Any Rebalance:
├─ assessSwapRisk() called
├─ Checks: slippage, liquidity, price impact
├─ Can reject: Too risky trades
├─ Creator alerted: Manual override or adjust parameters
└─ Follower protected: From adverse conditions
```

---

## 10. KEY WORKFLOWS

### Creator: "How do I deploy a strategy?"

1. Create strategy with target allocations
2. Backtest (via async job queue)
3. Review results
4. Publish (set `isPublic = true`)
5. Wait for followers to subscribe
6. Strategy auto-executes on rebalance schedule
7. Collect performance fees on profits

### Follower: "How do I copy a strategy?"

1. Browse marketplace (GET /api/strategies)
2. Review backtest results and historical performance
3. Connect exchange accounts (optionally)
4. Subscribe with capital (POST /api/strategies/:id/follow)
5. Monitor returns (GET /api/strategies/:id/performance)
6. Option to unsubscribe anytime

### DAO: "How do we integrate treasury into strategies?"

1. DAO identifies strategy (same as individual)
2. DAO governance votes allocation amount
3. DAO connects treasury wallet + exchange accounts
4. Investment pools or vaults deposit capital
5. Strategy rebalances trigger multi-chain execution
6. DAO tracks performance (same as individual follower)
7. Fee splits configured at platform or DAO level

---

## 11. DEPLOYMENT TARGETS MATRIX

| Target | Mechanism | Who Controls | Execution Speed | Risk | Fee Impact |
|--------|-----------|--------------|-----------------|------|------------|
| **DeFi Vault (On-Chain)** | Smart contract rebalancing | Creator (signals) | 1-10 min | Medium (slippage) | Gas fees per rebalance |
| **CEX Account** | CCXT API trading | Follower (owns account) | <1 sec | Low (centralized) | Exchange trading fees |
| **Multi-Account** | Multiple CEX APIs | Follower (multiple accounts) | <1 sec | Low (distributed) | Per-account trading fees |

---

## 12. PERFORMANCE TRACKING

### Real-Time Metrics (for Each Follower)

```
GET /api/strategies/:id/performance
→ {
  returnUsd: -250 (loss in dollars),
  returnPercent: -2.5,
  currentValueUsd: 9750,
  aum: 560000 (total strategy AUM),
  followers: 3,
  sharpeRatio: 1.85,
  maxDrawdown: -8.5,
  volatility: 12.3,
  totalRebalances: 12,
  lastRebalancedAt: "2024-01-15T10:30:00Z"
}
```

### Historical Snapshots

```
strategyPerformanceTable (daily records):
├─ date: 2024-01-15
├─ aum: 560000
├─ followers: 3
├─ returnPercent: 5.2 (since inception)
├─ sharpeRatio: 1.85
├─ maxDrawdownPercent: -8.5
├─ volatilityPercent: 12.3
└─ tradeVolume: 125000 (daily volume)
```

---

## Summary: Complete Picture

1. **Creator** publishes strategy with backtest results (async job queue)
2. **Followers** subscribe by allocating capital to strategy
3. **Platform** deploys capital to DeFi vaults + CEX accounts
4. **Strategy** executes via rebalancing on schedule (weekly/daily/manual)
5. **Followers** receive returns minus fees (management + performance)
6. **Creator** receives 80% of performance fees
7. **Platform** receives 20% of performance fees + infrastructure costs
8. **DAOs** can participate same as individual followers (multi-account supported)

---

**Data Source**: All relationships verified from:
- `server/db/schema/strategies.ts` - Core tables
- `server/routes/strategiesConsolidated.ts` - Strategy endpoints
- `server/routes/v1/yuki/rebalancing.ts` - Execution
- `server/routes/investment-pools.ts` - Fee structure
- `server/services/jobQueueService.ts` - Async backtest queue
