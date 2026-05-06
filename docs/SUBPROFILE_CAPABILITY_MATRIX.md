# Subprofile Capability Matrix - FINAL

## 🎤 OKEDI (Community Leader + Personal Banker)

### ✅ Wallet & Personal Banking (PARTIALLY BUILT)
```
✅ BUILT:
├─ Personal Balance Display (wallet page exists)
├─ Receive Funds (address generation)
├─ Transaction History (M-Pesa-like view)
├─ Account Settings (profile/security)
│
❌ MISSING (MUST BUILD):
├─ Send to DAO Members (PRIMARY MTAA FEATURE)
│  ├─ Smart routing to send to DAO treasury
│  ├─ DAO member lookup
│  ├─ Default action "Send to DAO member"
│  └─ Batch send to multiple members
├─ Send to other users / external addresses
├─ Escrow System (CRITICAL FOR CHAMAS)
│  ├─ Create escrow agreements
│  ├─ Escrow as dispute mediator
│  ├─ Release funds on conditions met
│  ├─ Dispute resolution workflow
│  └─ Escrow transaction history
└─ Merry-go-round automation (rotating payments)
```

### ✅ Governance & DAOs (BUILT BUT NEEDS ISOLATION)
```
✅ BUILT (in daos.tsx, create-dao.tsx, proposals.tsx):
├─ DAO Discovery/Browse (daos.tsx line 55)
│  ├─ Search & filter DAOs
│  ├─ Regional/cause tag filtering
│  ├─ Trending DAOs
│  ├─ New this week
│  └─ Visibility: public/regional/private
├─ DAO Creation
├─ Join/Leave DAOs
├─ Proposal Creation & Voting
├─ DAO Settings & Member Management
├─ Treasury Overview (dao_treasury_overview.tsx)
├─ Contributor Reputation (contributor_list.tsx)
│
❌ MISSING (MUST BUILD):
├─ DAO CHAT & COMMUNITY (CRITICAL)
│  ├─ Real-time messaging (dao-chat.tsx EXISTS but needs isolation)
│  ├─ Message reactions with emojis ✅ BUILT
│  ├─ Thread conversations (replies) ✅ BUILT
│  ├─ File/image sharing ✅ BUILT
│  ├─ Message pinning ✅ BUILT
│  └─ Search in chat
├─ Community Engagement Features
│  ├─ Member profiles with karma/reputation
│  ├─ @mention system
│  ├─ Comment threads on proposals ✅ BUILT
│  └─ Social reactions/emojis on proposals ✅ BUILT
├─ DAO ANALYTICS DASHBOARD
│  ├─ Treasury growth forecasting (Kaizen Elder exists!)
│  ├─ Member engagement trends
│  ├─ Voting participation rates
│  ├─ Risk scoring
│  └─ Fraud detection alerts
├─ Member Roles & Permissions
│  ├─ View member list with roles
│  ├─ Assign roles (Elder, Proposer, Member)
│  ├─ Permission management
│  └─ Member activity logs
└─ DAO Subscription/Billing
   ├─ Free tier features
   ├─ Collective tier (₵1500/month)
   └─ MetaDAO tier
```

---

## 🛠️ YUKI (Trader & DeFi Specialist)

### ✅ Trading (SUBSTANTIALLY BUILT)
```
✅ BUILT (in exchanges.ts, ExchangeMarkets.tsx):
├─ DEX Trading
│  ├─ Real-time market data ✅
│  ├─ OHLCV candle charts ✅
│  ├─ Technical indicators ✅
│  ├─ Order book analysis ✅
│  ├─ Execute orders (basic)
│  └─ Trade history ✅
├─ CEX Integration (Binance, Coinbase, Kraken)
│  ├─ Symbol lookup across exchanges ✅
│  ├─ Cross-exchange comparison ✅
│  ├─ Exchange-specific data ✅
│  └─ Mirror trades to CEX (needs build)
├─ Flash Loans (needs dedicated UI)
├─ Swaps & Bridges (infrastructure exists)
│
❌ MISSING (MUST BUILD):
├─ BOT & STRATEGY BUILDER (CRITICAL)
│  ├─ Visual bot creation interface (no-code)
│  ├─ Strategy builder with conditions
│  ├─ Risk parameter configuration
│  ├─ Deploy/manage active bots
│  ├─ Bot performance monitoring
│  ├─ Strategy backtesting
│  ├─ Pre-built strategy library
│  └─ Community strategy marketplace
├─ MARKET INTELLIGENCE (CRITICAL)
│  ├─ AI trading signals/recommendations
│  ├─ Sentiment analysis
│  ├─ Fear & Greed Index ✅ BUILT
│  ├─ On-chain metrics
│  ├─ Whale watching alerts
│  ├─ Liquidation level warnings
│  └─ Market cycle indicators
├─ RISK & ANALYTICS
│  ├─ Position sizing calculator
│  ├─ Risk-to-reward ratio analysis
│  ├─ Portfolio heat mapping
│  ├─ Drawdown tracking
│  ├─ Sharpe/Sortino ratio ✅ BUILT
│  └─ Win rate analytics
├─ TRADING JOURNAL (missing)
│  ├─ Trade entry/exit logging
│  ├─ Trade analysis & notes
│  ├─ Performance by strategy
│  ├─ Win/loss patterns
│  └─ Learning insights
├─ ECONOMIC CALENDAR (missing)
│  ├─ Upcoming economic events
│  ├─ Event impact notifications
│  ├─ Historical event data
│  └─ Calendar import
└─ AUTOMATION & COPY TRADING (missing)
   ├─ Follow other traders
   ├─ Copy trades automatically
   ├─ Leaderboards
   └─ Performance-based ranking
```

---

## 💰 AMARA (Investor & Wealth Manager)

### ✅ Wealth & Portfolio (PARTIALLY BUILT)
```
✅ BUILT:
├─ Wealth Dashboard (needs rebuild for Amara focus)
├─ Asset allocation view (basic)
├─ Performance metrics (Sharpe, Sortino, Drawdown) ✅
├─ Treasury overview ✅
│
❌ MISSING:
├─ Personal Wallet (for deposits only)
├─ Net worth tracking & trends
├─ Tax-aware accounting (cost basis, gains)
├─ Financial goals & milestones
└─ Rebalancing suggestions/automation
```

### ✅ DAO Investments (PARTIALLY BUILT)
```
✅ BUILT:
├─ DAO Discovery (daos.tsx)
├─ DAO browsing/search
│
❌ MISSING:
├─ DAO Investment Interface
│  ├─ Buy DAO shares/tokens
│  ├─ View my DAO holdings
│  ├─ Dividend tracking & claiming
│  ├─ Sell DAO shares
│  └─ Historical investment performance
├─ DAO Comparison
│  ├─ Side-by-side DAO metrics
│  ├─ Risk assessment
│  ├─ Growth trends
│  └─ Community health scores
└─ Investor Dashboard
   ├─ DAO portfolio composition
   ├─ Dividend income tracking
   └─ Allocation recommendations
```

### ✅ Mono Vault (SUBSTANTIALLY BUILT)
```
✅ BUILT (vault.tsx, vault performance):
├─ Vault discovery & browsing ✅
├─ View vault strategies ✅
├─ APY display ✅
├─ TVL & composition ✅
├─ Performance charts (24h, 7d, 30d) ✅
├─ Deposit to vaults ✅
│
❌ MISSING:
├─ Auto-compound tracking
├─ Withdrawal management (UI)
├─ Yield earned history
├─ APY comparison tools
├─ Risk scoring & impact analysis
└─ Tax reporting (yield earned per vault)
```

### ✅ Investment Pools (SUBSTANTIALLY BUILT)
```
✅ BUILT (investment-pools phase 2):
├─ Pool discovery & browsing ✅
├─ Pool composition view ✅
├─ Performance chart (30+ days) ✅
├─ Share price tracking ✅
├─ NAV (Net Asset Value) ✅
├─ Deposit/withdraw UI ✅
├─ Performance metrics ✅
│
❌ MISSING:
├─ Investor Statement/reports (monthly/quarterly)
├─ Tax reporting (gains, cost basis)
├─ Advanced analytics dashboard
├─ Pool manager contact/communication
├─ Risk metrics (Sharpe, max drawdown, Sortino)
└─ Fee transparency (breakdown: management + performance)
```

### ❌ DECENTRALIZED HEDGE FUNDS (NOT BUILT - HIGH PRIORITY)
```
COMPLETELY MISSING - Need full implementation:
├─ Hedge Fund Creation Interface (For managers)
│  ├─ Define fund strategy (long/short, pairs, macro, etc.)
│  ├─ Set risk parameters & limits
│  ├─ Fee structure (management % + performance %)
│  ├─ Fund size limits
│  └─ Launch fund on-chain
├─ Hedge Fund Management (For fund managers)
│  ├─ Fund dashboard & real-time NAV
│  ├─ Create/execute trading strategies
│  ├─ Portfolio rebalancing
│  ├─ Risk monitoring
│  ├─ Investor communication
│  └─ Profit distribution & fee calculation
├─ Hedge Fund Investing (For investors)
│  ├─ Browse available hedge funds
│  ├─ View fund performance & track record
│  ├─ View current holdings
│  ├─ Deposit capital
│  ├─ Claim returns/withdraw
│  └─ Monthly/quarterly statements
├─ Hedge Fund Analytics
│  ├─ Fund NAV calculation
│  ├─ Performance metrics (Sharpe, Sortino, Max DD)
│  ├─ Investor returns vs benchmarks
│  ├─ Fee impact analysis
│  ├─ Risk scoring
│  └─ Compliance reporting
└─ Hedge Fund Registry
   ├─ Approved fund managers
   ├─ Fund verification status
   ├─ AUM (Assets Under Management) tracking
   └─ Historical performance database
```

### ✅ Passive Income Automation (PARTIALLY BUILT)
```
✅ BUILT:
├─ Vault auto-compounding ✅
├─ Recurring deposits (infrastructure)
│
❌ MISSING:
├─ Dollar-Cost Averaging (DCA)
│  ├─ Set up DCA schedules
│  ├─ Select investment targets
│  ├─ Track DCA execution
│  └─ Modify/pause DCA
├─ Auto-Invest
│  ├─ Automatic rebalancing
│  ├─ Reinvest dividends
│  ├─ Auto-compound yields
│  └─ Threshold-based investing
├─ Income Scheduling
│  ├─ Schedule withdrawals
│  ├─ Recurring payments
│  ├─ Income aggregation
│  └─ Tax-loss harvesting
└─ Passive Income Tracking
   ├─ Total passive income earned
   ├─ Income by source (DAOs, vaults, pools)
   ├─ Monthly/annual projections
   └─ Goal tracking (reach $X/month income)
```

### ❌ GOVERNANCE (AMARA CAN VOTE AS INVESTOR)
```
NEEDS TO BE ADDED (secondary for Amara):
├─ Vote in DAOs she invests in
├─ View DAO proposals affecting her investments
├─ Governance alerts (important votes)
└─ Voting power based on holdings
```

---

## QUICK REFERENCE: What Each Subprofile Sees

| Feature | Okedi | Yuki | Amara |
|---------|-------|------|-------|
| Personal Wallet | ✅ Primary | ❌ | ✅ Secondary |
| Send Funds | ✅ Primary | ❌ | ❌ |
| Escrow | ✅ Only | ❌ | ❌ |
| Governance/DAOs | ✅ Primary | ❌ | ❌ |
| DEX Trading | ❌ | ✅ Only | ❌ |
| CEX Trading | ❌ | ✅ Only | ❌ |
| Flash Loans | ❌ | ✅ Only | ❌ |
| Bots/Strategies | ❌ | ✅ Only | ❌ |
| Trading Signals | ❌ | ✅ Only | ❌ |
| DAO Investments | ❌ | ❌ | ✅ Only |
| Mono Vault | ❌ | ❌ | ✅ Only |
| Investment Pools | ❌ | ❌ | ✅ Only |
| Hedge Funds | ❌ | ❌ | ✅ Only |
| Passive Income | ❌ | ❌ | ✅ Only |

---

## Switching Behavior

**Users can switch between subprofiles anytime in Settings:**
- Switching is instant
- Dashboard reorganizes
- Each subprofile has its own balance (if applicable)
- Historical data preserved across all modes

---

## Data Model

Each user has THREE separate balances/accounts:

```typescript
User {
  id: string;
  activeSubprofile: 'okedi' | 'yuki' | 'amara';
  
  // Okedi account
  okediWallet: {
    balance: number;
    currency: 'KES' | 'USDC' | etc;
    escrowHeld: number;
  };
  
  // Yuki account
  yukiTradingAccount: {
    balance: number;
    currency: crypto;
    openPositions: [];
    leverage?: number;
  };
  
  // Amara account
  amaraInvestmentAccount: {
    portfolioValue: number;
    daoHoldings: [];
    vaultDeposits: [];
    poolShares: [];
    hedgeFunds: [];
  };
}
```

