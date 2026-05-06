# MTAA Platform Architecture - Complete Stack

## The Three-Layer Economy

```
┌──────────────────────────────────────────────────────────────────────┐
│ LAYER 3: CAPITAL AGGREGATION (Vaults)                               │
│                                                                      │
│  Strategy Vaults                                                     │
│  ├─ Market-Neutral        ├─ Yield Aggregation                      │
│  ├─ Momentum              └─ Stablecoin Defense                     │
│                                                                      │
│  Users deposit capital → Vaults execute strategies automatically    │
│  Monthly: Calculate P&L, distribute fees, track creator earnings   │
│                                                                      │
│  TVL: $12M+ across all vaults                                       │
│  Avg APY: 6-15% depending on strategy                               │
└──────────────────────────────────────────────────────────────────────┘
                              ↑
                    (Uses strategies from)
                              ↑
┌──────────────────────────────────────────────────────────────────────┐
│ LAYER 2: STRATEGY CREATION & EXECUTION (Yuki)                       │
│                                                                      │
│  Visual Strategy Builder                                            │
│  └─ Drag-drop blocks (conditions, actions, risk controls)          │
│                                                                      │
│  Strategy Deployment                                                │
│  └─ Deploy → Strategy Execution Service watches conditions          │
│                                                                      │
│  Smart Routing                                                      │
│  ├─ Multi-exchange optimization (Binance, Coinbase, Kraken)        │
│  ├─ DEX routing (Uniswap, Sushiswap, Curve, Ubeswap)               │
│  ├─ Cross-chain bridges (Stargate, LayerZero)                      │
│  └─ Flash loans (Aave)                                              │
│                                                                      │
│  Marketplace                                                        │
│  └─ Top performers get curated into vaults                         │
│      Creator earns 10-30% profit-share from vault gains            │
└──────────────────────────────────────────────────────────────────────┘
                              ↑
                 (Unlocked by staking MTAA for)
                              ↑
┌──────────────────────────────────────────────────────────────────────┐
│ LAYER 1: TOKEN ECONOMICS & GOVERNANCE (MTAA)                        │
│                                                                      │
│  Staking                                                            │
│  ├─ Lock MTAA for 7/30/90/365 days                                 │
│  ├─ Earn 12% APY (up to 3x multiplier for longer locks)            │
│  └─ Gain voting power (1 wei per MTAA)                             │
│                                                                      │
│  Vault Allocation Tiers                                             │
│  ├─ Tier 1: 100 MTAA → $10k allocation                             │
│  ├─ Tier 2: 500 MTAA → $50k allocation                             │
│  ├─ Tier 3: 1000 MTAA → $250k allocation                           │
│  └─ Tier 4: 5000 MTAA → $1M allocation                             │
│                                                                      │
│  Governance                                                         │
│  ├─ Vote on vault listings                                         │
│  ├─ Vote on protocol parameters (fees, APY targets)                │
│  ├─ Treasury allocation decisions                                  │
│  └─ Requires minimum 500 MTAA                                      │
└──────────────────────────────────────────────────────────────────────┘
```

## Data Flow Diagram

```
User Action → API Call → Database → Event Emission → UI Update

Example: Deposit to Yield Vault
1. User clicks "Deposit $10,000 USDC"
   ↓
2. POST /api/vaults/yield-vault-1/deposit { amount: "10000", asset: "USDC" }
   ↓
3. Backend validates:
   - User stake tier allows $10k (Tier 2 = $50k limit)
   - Vault not at capacity
   - User has USDC balance
   ↓
4. Smart contract:
   - Transfer USDC from user → vault
   - Calculate share price: $12.5M AUM / 800k shares = $15.625/share
   - Mint shares: $10,000 / $15.625 = 640 shares
   - Update vault AUM: $12.51M
   ↓
5. Database updates:
   - user_vault_positions { userId, vaultId, shares: 640, depositedAmount: 10000 }
   - vault_aum_history { vaultId, totalAUM: 12510000, timestamp }
   - transaction_logs { type: 'vault_deposit', ... }
   ↓
6. Event emitted: DepositComplete { depositId, shares, txHash }
   ↓
7. UI updates:
   - Show confirmation
   - Update user balance
   - Update vault positions
   - Add to transaction history
   ↓
8. Vault execution:
   - Vault manager strategy checks for conditions
   - If condition met, routes and executes trade
   - Updates vault positions
   - Tracks P&L
```

## System Connections

### Staking → Vaults
```
User stakes 1000 MTAA (Tier 3)
    ↓
Gets $250,000 allocation limit
    ↓
Can now deposit up to $250k across all vaults
    ↓
Deposit limits enforced by smart contract
```

### Yuki → Vaults
```
Creator builds strategy in Yuki
    ↓
Deploy strategy
    ↓
Strategy enters marketplace
    ↓
Top performers selected for vault curation
    ↓
Vault executes strategy automatically
    ↓
Creator gets 10-30% profit-share from vault gains
```

### Vaults → Staking Rewards
```
Vault generates $100,000 profit in month
    ↓
Deduct management fees (1% = $1,000 to manager)
    ↓
Deduct performance fees (20% = $20,000 to creator)
    ↓
Remaining gains: $79,000 distributed to depositors
    ↓
Separately: Staking rewards drawn from protocol treasury
    ↓
Monthly: Distribute rewards to stakers + vault managers
```

## API Endpoint Tree

```
/api/staking
├─ GET /config                    ← Staking APY, config
├─ POST /stake                    ← Stake MTAA
├─ POST /unstake                  ← Unstake after lockup
├─ GET /stakes                    ← User's stakes
├─ GET /balance                   ← Total staked + tier
├─ POST /claim-rewards            ← Claim monthly rewards
├─ GET /leaderboard               ← Top stakers
├─ GET /rewards-pool              ← Pool status
├─ GET /proposals                 ← Active governance proposals
├─ POST /vote                     ← Vote on proposal
└─ POST /propose                  ← Create proposal

/api/vaults
├─ GET /                          ← List vaults (filtered)
├─ GET /:id                       ← Vault details + strategy
├─ POST /:id/deposit              ← Deposit capital
├─ POST /:id/withdraw             ← Withdraw shares
├─ GET /:id/balance               ← User's position in vault
├─ GET /:id/positions             ← Current holdings
├─ GET /:id/performance           ← Performance metrics
├─ GET /:id/history               ← Transaction history
├─ POST / (manager)               ← Create vault
├─ PUT /:id (manager)             ← Update settings
├─ POST /:id/pause (manager)      ← Pause operations
└─ POST /:id/resume (manager)     ← Resume operations

/api/yuki
├─ GET /market/prices             ← Real exchange prices
├─ GET /market/opportunities      ← Arbitrage opportunities
├─ GET /market/liquidity/:symbol  ← DEX liquidity
├─ POST /execute/swap/preview     ← Swap route calculation
├─ POST /execute/swap             ← Execute swap
├─ POST /execute/bridge/preview   ← Bridge cost estimate
├─ POST /execute/bridge           ← Execute bridge
├─ GET /strategies                ← User's strategies
├─ POST /strategies/deploy        ← Deploy strategy
├─ GET /marketplace/strategies    ← Public strategies
└─ POST /marketplace/strategies/copy ← Copy strategy
```

## Database Schema Overview

### Core Tables

**users**
- id, wallet, email, tier (based on staking)

**staking**
- id, userId, amount, lockupDays, apy, unlocksAt, rewards

**vaults**
- id, name, category, strategyId, managerAddress, fee, totalAUM, status

**user_vault_positions**
- id, userId, vaultId, shares, depositedAmount, currentValue, gains

**strategies**
- id, name, creator, blocks[], status, deployedAt, performance

**transactions**
- id, userId, type, vaultId, amount, txHash, timestamp

**governance_proposals**
- id, title, description, votesFor, votesAgainst, status, endsAt

**governance_votes**
- id, proposalId, userId, support, votingPower, timestamp

## Real-Time Monitoring

### Dashboard Metrics
```
Overall
├─ Total TVL: $12.3M
├─ Total Staked: $8.5M
├─ Active Users: 2,340
└─ Average Vault APY: 8.7%

By Vault
├─ Market-Neutral: $2.5M TVL, 3.2% APY
├─ Yield Agg: $5.1M TVL, 7.8% APY
├─ Momentum: $1.2M TVL, 12.1% APY
└─ Stablecoin Defense: $3.8M TVL, 1.2% APY

Top Creators (by earnings)
├─ alex_trader: $45,230 (30% of gains)
├─ defi_alpha: $38,920 (25% of gains)
└─ yield_seeker: $21,450 (15% of gains)

Staking
├─ Total Staked: 8.5M MTAA
├─ Tier Distribution: 1200 Tier 1, 850 Tier 2, 420 Tier 3, 85 Tier 4
└─ Monthly Rewards: 1M MTAA distributed
```

## Error Handling & Recovery

### User-Facing Errors
```
Deposit Failures
├─ Insufficient balance → Show wallet balance
├─ Tier limit exceeded → Show remaining allocation
├─ Vault at capacity → Show waitlist option
└─ Network error → Retry button

Withdrawal Failures
├─ Lockup period active → Show unlock date
├─ Daily limit exceeded → Show remaining limit
└─ Insufficient shares → Show actual balance

Staking Errors
├─ Min stake not met → Show required amount
├─ Invalid lockup period → Show valid options
└─ Unstake before unlock → Show unlock date

Governance Errors
├─ Insufficient voting power → Show required stake
├─ Already voted → Show vote receipt
└─ Proposal closed → Show results
```

### Admin Recovery
```
Vault at risk
├─ Pause operations
├─ Calculate emergency liquidation
└─ Distribute to depositors (prioritize recent deposits)

Failed transaction
├─ Retry with same parameters
├─ Check gas prices
└─ Notify user with receipt

Staking discrepancy
├─ Recalculate from blockchain
├─ Update database
└─ Emit reconciliation event
```

## Security Model

### Smart Contract Level
- Reentrancy guards on all state changes
- Checks-effects-interactions pattern
- Pausable pattern for emergencies
- Upgrade proxy for security patches

### API Level
- JWT authentication on all protected endpoints
- Rate limiting (100 req/min per user)
- Input validation on all parameters
- SQL injection prevention (prepared statements)

### Data Level
- Encrypted at rest
- Hashed passwords
- Audit log of all state changes
- Time-lock on sensitive operations

## Performance Targets

**Latency**
- Deposit confirmation: < 30 seconds
- Withdrawal approval: < 60 seconds
- Strategy execution: < 2 blocks (~30 seconds)
- Governance voting: < 5 seconds

**Throughput**
- 1000 concurrent deposits
- 100 simultaneous vaults executing
- 10,000 staking operations per day

**Availability**
- 99.9% uptime SLA
- Graceful degradation
- Multi-region failover

---

**Status**: 🟢 Complete  
**Last Updated**: January 29, 2026  
**Stack**: Node.js + Express + TypeScript + Smart Contracts
