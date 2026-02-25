# Strategy Vaults & MTAA Staking - Complete Implementation

## Overview

**Strategy Vaults** are the capital aggregation layer where non-technical users deposit capital, and curated strategies execute automatically. **MTAA Staking** provides token economics, governance rights, and vault allocation tiers.

## Architecture

```
┌─────────────────────────────────────────────────────┐
│            MTAA TOKEN STAKING                        │
│  ┌────────────────────────────────────────────────┐ │
│  │ Stake MTAA                                     │ │
│  │ ├─ 7/30/90/365 day lockups                     │ │
│  │ ├─ APY boost multipliers (1.5x - 3x)          │ │
│  │ ├─ Governance voting power                     │ │
│  │ └─ Vault allocation tier access                │ │
│  └────────────────────────────────────────────────┘ │
│                      ↓                               │
│  ┌────────────────────────────────────────────────┐ │
│  │ VAULT ALLOCATION TIERS (by stake amount)       │ │
│  │ ├─ Tier 1: 100 MTAA → $10k allocation         │ │
│  │ ├─ Tier 2: 500 MTAA → $50k allocation         │ │
│  │ ├─ Tier 3: 1000 MTAA → $250k allocation       │ │
│  │ └─ Tier 4: 5000 MTAA → $1M allocation         │ │
│  └────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────────┐
│           STRATEGY VAULTS (Curated)                  │
│  ┌────────────────────────────────────────────────┐ │
│  │ Market-Neutral Vault                           │ │
│  │ ├─ Deposits via shares                         │ │
│  │ ├─ Executes hedged strategy                    │ │
│  │ ├─ Current AUM: $2.5M                          │ │
│  │ └─ 30d Return: +3.2%                           │ │
│  └────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────┐ │
│  │ Yield Aggregation Vault                        │ │
│  │ ├─ Auto-rotates farming opportunities          │ │
│  │ ├─ IL protection enabled                       │ │
│  │ ├─ Current AUM: $5.1M                          │ │
│  │ └─ 30d Return: +7.8%                           │ │
│  └────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────┐ │
│  │ Momentum Vault                                 │ │
│  │ ├─ Trend-following execution                   │ │
│  │ ├─ Dynamic leverage (1x - 3x)                  │ │
│  │ ├─ Current AUM: $1.2M                          │ │
│  │ └─ 30d Return: +12.1%                          │ │
│  └────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────┐ │
│  │ Stablecoin Defense Vault                       │ │
│  │ ├─ Preserves capital in downturns              │ │
│  │ ├─ Low volatility, steady yield                │ │
│  │ ├─ Current AUM: $3.8M                          │ │
│  │ └─ 30d Return: +1.2%                           │ │
│  └────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────┘
                      ↓
          Uses Yuki Strategies Automatically
                      ↓
       Executes swaps, bridges, liquidity ops
                      ↓
        Creator gets profit-share (10-30%)
         Vault manager gets performance fee
```

## Vault System

### 1. Vault Types & Categories

**Market-Neutral Vault**
- Delta-neutral strategy
- Hedged long/short positions
- Best for: Risk-averse capital
- Target APY: 3-8%
- Max drawdown: < 5%

**Yield Aggregation Vault**
- Rotates between farming opportunities
- Impermanent loss protection
- Best for: Passive income seekers
- Target APY: 8-20%
- Max drawdown: < 15%

**Momentum Vault**
- Trend-following with dynamic leverage
- Captures market rallies
- Best for: Growth-oriented investors
- Target APY: 15-40%
- Max drawdown: < 25%

**Stablecoin Defense Vault**
- Capital preservation in downturns
- Low volatility
- Best for: Uncertain market conditions
- Target APY: 2-6%
- Max drawdown: < 2%

### 2. Deposit/Withdrawal Flow

```
User Deposit
    ↓
Smart contract verifies:
├─ User stake tier allows allocation
├─ Asset is supported (USDC, DAI, USDT)
├─ Vault not at capacity
└─ User has minimum balance
    ↓
Calculate share price: (AUM / totalShares)
    ↓
Mint shares: depositAmount / sharePrice
    ↓
Update vault AUM
    ↓
Log transaction
    ↓
Vault executes strategy with new capital
```

### 3. Real-time Position Tracking

Each vault tracks:
- Current holdings (asset, amount, value)
- Unrealized P&L
- Entry prices and dates
- Strategy block execution history
- Fee accruals (manager + creator)

### 4. Performance Metrics

**Available periods**: 1d, 7d, 30d, 90d, 1y, all

Metrics calculated:
- Return: (Current Value - Deposited Amount) / Deposited Amount
- Sharpe Ratio: Excess return / Volatility
- Max Drawdown: Largest peak-to-trough decline
- Volatility: Standard deviation of daily returns
- Win Rate: % of profitable days
- Trades: Total number of executions

## MTAA Staking System

### 1. Staking Configuration

```
Minimum Stake: 1 MTAA
Maximum Stake: 100,000 MTAA

Lockup Periods:
├─ 7 days   → 1.5x APY multiplier
├─ 30 days  → 2.0x APY multiplier
├─ 90 days  → 2.5x APY multiplier
└─ 365 days → 3.0x APY multiplier

Base APY: 12% (on MTAA held in staking)
Monthly distribution: Automatic claim available
Governance voting: 1 wei voting power per MTAA staked
```

### 2. Vault Allocation Tiers

| Tier | Min Stake | Max Allocation | Features |
|------|-----------|-----------------|----------|
| 1 | 100 MTAA | $10,000 | Access all vaults |
| 2 | 500 MTAA | $50,000 | Early access to new vaults |
| 3 | 1,000 MTAA | $250,000 | Custom allocation + support |
| 4 | 5,000 MTAA | $1,000,000 | Vault creation rights + governance |

### 3. Reward Distribution

**Monthly Rewards Pool**: 1M MTAA (~$2.5M)

Distribution:
- 60% to stakers (APY calculations)
- 20% to vault managers (performance fees)
- 10% to protocol incentives
- 10% to governance treasury

**Claim Process**:
- Automatic monthly, or manual anytime
- Rewards vest over 30 days
- Early claim with 10% penalty available

### 4. Governance System

**Voting Power**: 1 wei = 1 MTAA staked

**Proposal Types**:
- Parameter changes (vault fees, APY rates)
- New vault listings
- Protocol upgrades
- Treasury allocations

**Voting Requirements**:
- Min 100 MTAA to propose
- Min 500 MTAA to vote
- 50%+ quorum required
- 66% majority to pass
- 7-day voting period

## API Endpoints

### Vault Endpoints

**Discovery**
- `GET /api/vaults` - List all vaults with filters
- `GET /api/vaults/:id` - Get vault details + positions
- `GET /api/vaults/:id/performance` - Performance metrics

**Operations (Authenticated)**
- `POST /api/vaults/:id/deposit` - Deposit capital
- `POST /api/vaults/:id/withdraw` - Withdraw shares
- `GET /api/vaults/:id/balance` - User's vault balance

**Management (Creator/Manager)**
- `POST /api/vaults` - Create new vault
- `PUT /api/vaults/:id` - Update vault settings
- `POST /api/vaults/:id/pause` - Pause operations
- `POST /api/vaults/:id/resume` - Resume operations

**Data**
- `GET /api/vaults/:id/positions` - Current holdings
- `GET /api/vaults/:id/history` - Transaction history

### Staking Endpoints

**Configuration**
- `GET /api/staking/config` - APY rates, tiers, config

**Operations (Authenticated)**
- `POST /api/staking/stake` - Stake MTAA tokens
- `POST /api/staking/unstake` - Unstake (after lockup)
- `GET /api/staking/stakes` - User's stakes
- `GET /api/staking/balance` - Total balance + tier
- `POST /api/staking/claim-rewards` - Claim earned rewards

**Leaderboard & Stats**
- `GET /api/staking/leaderboard` - Top stakers
- `GET /api/staking/rewards-pool` - Pool status

**Governance (Authenticated)**
- `GET /api/staking/proposals` - List proposals
- `POST /api/staking/vote` - Vote on proposal
- `POST /api/staking/propose` - Create proposal

## Client-Side Implementation

### 1. Component Structure

```
VaultDiscovery.tsx
├─ List of curated vaults
├─ Filter by category/APY/drawdown
└─ Quick view cards

VaultDetail.tsx
├─ Positions + strategy
├─ Performance charts
├─ Deposit/withdraw forms
└─ Fee breakdown

DepositWithdraw.tsx
├─ Amount input with tier limits
├─ Slippage/fee estimates
├─ Transaction confirmation
└─ Status tracking

StakingDashboard.tsx
├─ Current stakes status
├─ Reward calculations
├─ Claim interface
└─ Tier upgrade path

GovernanceVoting.tsx
├─ Active proposals
├─ Voting interface
├─ Vote power display
└─ Results tracking
```

### 2. Key API Integration Points

```typescript
// Vault discovery
const vaults = await vaultApi.getVaults({ 
  category: 'yield',
  minAUM: 1000000,
  maxFee: 0.02
});

// Deposit to vault
await vaultApi.depositToVault(vaultId, '10000', 'USDC');

// Check staking tier
const balance = await stakingApi.getStakingBalance();
if (balance.vaultAllocationTier === 'Tier 3') {
  // Show premium vault access
}

// Vote on governance
await stakingApi.voteOnProposal(proposalId, true);
```

## Execution Flow

### Vault Execution Loop

```
1. Monitor deployed strategies in vault
2. Check conditions each block (price, time, volume)
3. When condition met:
   ├─ Calculate optimal route
   ├─ Execute (swap/bridge/move)
   ├─ Update positions
   └─ Track P&L
4. Monthly:
   ├─ Calculate performance metrics
   ├─ Accrue management fees
   ├─ Distribute creator rewards (10-30% of gains)
   └─ Update vault NAV
```

### Staking Reward Distribution

```
1. Daily: Calculate APY for each stake
2. Weekly: Accumulate rewards
3. Monthly:
   ├─ Calculate total pool distribution
   ├─ Allocate to each staker
   ├─ Make rewards claimable
   ├─ Emit events
   └─ Update leaderboard
```

## Security & Constraints

### Vault Constraints
- Max withdrawal per user per day: 10% of vault AUM
- Min deposit: $100 (USDC equivalent)
- Max AUM per vault: Configurable (prevent concentration)
- Leverage limits: 1x - 5x based on strategy

### Staking Constraints
- Lockup period enforced: No unstake before expiry
- Min voting power: 500 MTAA
- Proposal cooldown: 1 week after creation
- Voting period: Exactly 7 days

### Vault Execution Constraints
- Max gas per transaction: 500k units
- Slippage tolerance: 0.5% - 2% by vault type
- Hedge rebalancing: Daily if drift > 5%
- Risk limits enforced per strategy

## Token Economics

**MTAA Distribution**:
- Total supply: 100M tokens
- Staking rewards: 12% APY (12M annually)
- Treasury: 20M tokens
- Team: 15M tokens (4-year vesting)
- Community: 53M tokens

**Fee Structure**:
- Vault management fee: 0.5% - 2% annually
- Performance fee: 10% - 30% of gains
- Withdrawal fee: 0.1% (liquidity protection)
- Early unstake penalty: 10% of rewards

## Monitoring & Analytics

**Real-time Dashboards**:
- Total TVL across vaults
- Average APY by category
- Creator earnings tracking
- Staking participation rate
- Governance voting activity

**Alerts**:
- Vault drawdown > threshold
- Withdrawal exceeds daily limit
- Proposal passes/fails
- Reward claim available
- Stake approaching unlock

## Roadmap

### Phase 1 (Current)
✅ Basic vault operations (deposit/withdraw)
✅ Staking infrastructure
✅ Governance voting

### Phase 2
- [ ] Dynamic performance fees (better creators)
- [ ] Insurance fund for vaults
- [ ] Multi-asset support (cross-chain)
- [ ] Vault composability (vaults of vaults)

### Phase 3
- [ ] Advanced hedging strategies
- [ ] Options-based vaults
- [ ] Flash loan integration
- [ ] Vault liquidity pools

### Phase 4
- [ ] Vault NFTs (tradeable positions)
- [ ] Derivatives markets
- [ ] Leverage trading
- [ ] Cross-protocol composability

---

**Status**: 🟢 Complete  
**Last Updated**: January 29, 2026  
**Routes Mounted**: `/api/vaults`, `/api/staking`
