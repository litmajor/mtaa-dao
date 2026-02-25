# MTAA Platform - Complete Feature Matrix

## User Journey: From Staking to Vault Deposits

### Path 1: New User (No MTAA)
```
User arrives at platform
    ↓
View vault opportunities (read-only)
    ↓
See vault performance + strategy details
    ↓
Want to participate? 
    ├─ Option A: Buy MTAA on exchange
    │   ├─ Stake minimum 100 MTAA
    │   ├─ Get Tier 1 access ($10k allocation)
    │   └─ Deposit to vault (up to $10k)
    │
    └─ Option B: Earn MTAA through trading
        ├─ Create strategy in Yuki
        ├─ If popular → get curated to vault
        ├─ Earn creator rewards (10-30% of vault gains)
        └─ Can reinvest rewards → more staking
```

### Path 2: Active Trader (Creating Strategies)
```
Create trading strategy in Yuki
    ├─ Drag-drop blocks (conditions, actions)
    ├─ Backtest against historical data
    └─ Deploy to Yuki marketplace
        ↓
    Marketplace visibility
    ├─ Other users copy strategy
    ├─ User pays copy fee (goes to creator)
    └─ Track P&L from copied instances
        ↓
    If strategy performs well:
    ├─ Gets featured in marketplace
    ├─ Recommended to vault managers
    └─ Curated into vault
        ↓
    Vault execution:
    ├─ Vault deposits capital to your strategy
    ├─ You earn creator profit-share (10-30% of gains)
    ├─ Scales with vault AUM
    └─ Monthly rewards deposited
```

### Path 3: Passive Investor (Growing Capital)
```
Have $50,000 to invest
    ↓
Buy 500 MTAA on market
    ↓
Stake 500 MTAA (30-day lockup)
    ├─ Get 2.0x APY multiplier
    ├─ Earn ~20% APY on 500 MTAA (~$2,500 over 1 year)
    └─ Unlock $50,000 vault allocation (Tier 2)
        ↓
    Browse curated vaults
    ├─ Yield Agg Vault: $5.1M AUM, 7.8% APY
    ├─ Momentum Vault: $1.2M AUM, 12.1% APY
    └─ Market-Neutral: $2.5M AUM, 3.2% APY
        ↓
    Deposit $50,000 to Yield Agg
    ├─ Share price: $15.625/share
    ├─ Get 3,200 shares
    ├─ Vault automatically executes yields strategy
    └─ Track daily P&L
        ↓
    Monthly results
    ├─ Vault earned $35,000 (7% monthly)
    ├─ Manager fee: $700 (2% of gains)
    ├─ Creator share: $5,250 (15% of gains)
    ├─ Your gain: $29,050 (before withdrawal fee)
    └─ Can compound or withdraw
```

## Feature Comparison Table

### Yuki Trading Platform
| Feature | Status | Who Uses | Purpose |
|---------|--------|----------|---------|
| Strategy Builder | ✅ Complete | Traders | Create visual strategies |
| Multi-Exchange | ✅ Complete | Traders | Access Binance, Coinbase, Kraken |
| DEX Integration | ✅ Complete | Traders | Uniswap, Sushiswap, Curve swaps |
| Smart Routing | ✅ Complete | Traders | Optimal execution across venues |
| Strategy Marketplace | ✅ Complete | Traders/Users | Discover and copy strategies |
| Flash Loans | ✅ Complete | Advanced | Aave atomic operations |
| Cross-Chain Bridges | ✅ Complete | Traders | Move assets cross-chain |
| Backtesting | Planned | Traders | Historical performance testing |
| Signal Generation | Planned | Traders | Trade signal webhooks |
| Social Trading | Planned | Users | Follow top traders |

### Vault System
| Feature | Status | Who Uses | Purpose |
|---------|--------|----------|---------|
| Market-Neutral Vault | ✅ Complete | Passive | Conservative, hedged strategy |
| Yield Vault | ✅ Complete | Passive | Liquidity farming auto-rotation |
| Momentum Vault | ✅ Complete | Growth | Trend-following with leverage |
| Stablecoin Defense | ✅ Complete | Conservative | Capital preservation downturns |
| Deposit/Withdraw | ✅ Complete | Users | Capital in/out of vaults |
| Performance Tracking | ✅ Complete | Users | Real-time P&L monitoring |
| Creator Rewards | ✅ Complete | Creators | 10-30% profit-share |
| Manager Fees | ✅ Complete | Managers | 0.5-2% AUM fee |
| Rebalancing | Planned | Auto | Maintain hedge ratios |
| IL Protection | Planned | Passive | Impermanent loss hedging |

### Staking System
| Feature | Status | Who Uses | Purpose |
|---------|--------|----------|---------|
| MTAA Staking | ✅ Complete | All | Lock tokens, earn APY |
| Vault Tiers | ✅ Complete | All | Allocation limits by stake |
| Governance Voting | ✅ Complete | Voters | Vote on proposals |
| Proposal Creation | ✅ Complete | DAO | Create governance proposals |
| Leaderboard | ✅ Complete | All | See top stakers |
| Rewards Distribution | ✅ Complete | Stakers | Monthly APY claims |
| Lock Multipliers | ✅ Complete | Stakers | 1.5x-3x for longer locks |
| Delegation | Planned | Stakers | Vote delegation |
| Slashing | Planned | Governance | Penalty for bad votes |

## Revenue Model

### For Platform (MTAA Token)
```
Monthly Revenue Streams:
├─ Vault Management Fees (0.5-2% of AUM)
│   └─ 12M+ AUM × 1.5% avg = $180k/month
├─ Withdrawal Fees (0.1% of withdrawals)
│   └─ $2M monthly volume × 0.1% = $2k/month
├─ Staking Rewards (12% APY distributed)
│   └─ 8.5M MTAA × 12% / 12 = 850k MTAA = $2.1M/month
└─ Protocol Treasury (10% of all fees)
    └─ All fees aggregate

Total Platform Revenue: $2.3M/month → treasury
├─ Used for: Development, marketing, vault incentives
└─ Governed by: MTAA holders via voting
```

### For Strategy Creators
```
Revenue Sources:
├─ Strategy Copy Fees
│   └─ $100 per copy → $10k/month if 100 copies
├─ Vault Profit-Share (10-30% of gains)
│   └─ $50k vault gain × 20% = $10k/month
├─ Affiliate Rewards
│   └─ Get $10 per depositor you refer
└─ Governance Incentives
    └─ Bonus tokens for top-performing strategies

Total Creator Revenue: $20-50k/month
(for top 10% of creators)
```

### For Vault Managers
```
Revenue Sources:
├─ Management Fee (0.5-2% AUM annually)
│   └─ $5M vault × 1% = $50k/month
├─ Performance Fee (10-30% of gains)
│   └─ $40k monthly gain × 20% = $8k/month
└─ Token Incentives
    └─ Protocol rewards top managers

Total Manager Revenue: $60-100k/month
(for active vault managers)
```

### For MTAA Stakers
```
Revenue Sources:
├─ Staking APY (12% base, up to 36% with multipliers)
│   └─ 10,000 MTAA × 24% APY / 12 = $20k/month
├─ Vault Deposits (if user has allocation)
│   └─ $50k deposit × 8% APY / 12 = $333/month
└─ Governance Rewards
    └─ Tokens for voting participation

Total Staker Return: 8-12% monthly
(varies by activity and tier)
```

## Onboarding Flows

### Trader Onboarding (5 steps, <10 min)
```
1. Connect wallet (MetaMask)
   └─ Sign message to verify ownership
2. View trading dashboard
   └─ See markets, prices, opportunities
3. Create first strategy
   └─ Drag-drop 2-3 blocks
   └─ Test with $100 swap
4. Deploy strategy
   └─ Choose network (Ethereum/Polygon/Celo)
   └─ Confirm gas
5. Share in marketplace
   └─ Add description + tags
   └─ See others copying your strategy
```

### Staker Onboarding (3 steps, <5 min)
```
1. Buy MTAA (on DEX or exchange)
   └─ Can use credit card onramp
2. Stake MTAA
   └─ Choose lockup: 7/30/90/365 days
   └─ See APY calculation
3. Unlock vault access
   └─ See allocation limit
   └─ Browse available vaults
```

### Vault Investor Onboarding (4 steps, <5 min)
```
1. Browse vaults
   └─ See APY, AUM, creator info
   └─ Read strategy description
2. Understand risks
   └─ View max drawdown
   └─ See top holdings
   └─ Read fee breakdown
3. Deposit capital
   └─ Amount input (respects tier limit)
   └─ See shares you'll receive
   └─ Confirm transaction
4. Monitor investment
   └─ Dashboard shows daily P&L
   └─ Get monthly performance report
   └─ Withdraw anytime (minus 0.1% fee)
```

## Metrics & KPIs

### Growth Metrics
```
Week 1 Goals:
├─ TVL: $1M+ across vaults
├─ Staked MTAA: 500k+
├─ Active users: 1000+
├─ Strategies deployed: 50+
└─ Vaults at capacity: 0 (growth phase)

Month 1 Goals:
├─ TVL: $12M+ across vaults
├─ Staked MTAA: 8.5M+
├─ Active users: 2500+
├─ Strategies deployed: 500+
└─ Creator earnings: $200k+

Year 1 Goals:
├─ TVL: $500M+ across vaults
├─ Staked MTAA: 20M+
├─ Active users: 50k+
├─ Strategies deployed: 10k+
└─ Creator earnings: $50M+
```

### Revenue Metrics
```
Month 1:
├─ Platform fees collected: $150k
├─ Distributed to creators: $80k
├─ Distributed to managers: $30k
└─ Treasury accumulated: $40k

Month 12:
├─ Platform fees collected: $5M
├─ Distributed to creators: $2.5M
├─ Distributed to managers: $1M
└─ Treasury accumulated: $1.5M
```

## Competitive Advantages

```
vs Yearn Finance
├─ ✅ Better UX (visual builder)
├─ ✅ Creator-friendly (higher profit-share)
└─ ✅ Multi-strategy (not just yield)

vs Dydx Trading
├─ ✅ Automated execution (no manual trading)
├─ ✅ Social features (see other traders)
└─ ✅ Vault scaling (capital aggregation)

vs Traditional Trading
├─ ✅ 24/7 execution (not market hours)
├─ ✅ Lower fees (1-2% vs 10-20%)
└─ ✅ Transparent strategy (full auditability)

vs Trading Signals/Bots
├─ ✅ Actual capital deployment
├─ ✅ Creator incentives (skin in game)
└─ ✅ Vault democratization (everyone can invest)
```

---

**Status**: 🟢 Ready for Launch  
**API Routes**: `/api/yuki`, `/api/vaults`, `/api/staking`  
**Total Endpoints**: 50+  
**User Types**: Traders, Creators, Managers, Stakers, Investors  
**Platform TVL Target**: $500M Year 1
