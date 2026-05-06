# MTAA DAO - Complete User Value Flow Map

## 🌊 Flow Overview

This document maps all user flows for money/asset movement through the MTAA DAO ecosystem, from fiat on-ramps to DeFi strategies and earnings.

---

## 📊 Core User Flows

### **Flow 1: FIAT DEPOSIT (On-Ramp) → STABLECOIN**

**Entry Point**: Off-ramp deposit from 6 African payment providers

```
User (Fiat) 
    ↓
[Deposit via Payment Providers]
├─ Flutterwave (3.2% local, 4.8% intl, 2.9% mobile)
├─ Paystack (2.9% local, 3.8% intl, 1.5% mobile)
├─ Paychant (~1-2% per ramp)
├─ Kotani (~1% interchange)
├─ M-Pesa (Native Kenya rate)
└─ Airtel Money (Variable by country)
    ↓
[Webhook Callback → Status Update]
    ↓
User Account Credited (USDC/USDT)
    ↓
[Available in Wallet]
```

**Endpoints**:
- `POST /api/wallet/deposits/initiate` - Start deposit
- `POST /api/wallet/deposits/complete` - Complete deposit (webhook)
- `GET /api/wallet/deposits/methods` - List providers
- `GET /api/wallet/deposits/user/:userId` - View deposit history

**Fees**: Transaction-based only ($0 setup)
- Local cards: 2.9-3.2%
- International: 3.8-4.8%
- Mobile money: 1.5-2.9%

---

### **Flow 2: STABLECOIN → MULTI-ASSET SWAP**

**Entry Point**: DEX swapping from stablecoins to crypto assets

```
User Wallet (USDC/USDT)
    ↓
[Initialize DEX Swap]
    POST /api/transactions/swaps
    {
      "fromToken": "USDC",
      "toToken": "BTC/SOL/ETH/...",
      "amount": "100.00",
      "slippage": "0.5"
    }
    ↓
[Get Route Options]
├─ Direct swap (1Inch, Uniswap, etc.)
├─ Multi-hop route (optimal pricing)
└─ Price impact calculation
    ↓
[User Approves Swap]
    POST /api/transactions/swaps/:swapId/execute
    {
      "transactionId": "0x...",
      "toAmountActual": "0.0025",
      "priceImpactPercent": "0.3"
    }
    ↓
[On-Chain Execution]
    ↓
User Wallet Updated (New Asset)
    ↓
[Transaction Recorded]
    GET /api/transactions/swaps/:walletId
```

**Supported Assets**:
- Stablecoins: USDC, USDT, cUSD
- Bitcoin: BTC
- Solana: SOL
- Ethereum: ETH
- Layer 2: Optimism, Arbitrum
- Other DEX tokens

**Fees**:
- DEX swap fees: 0.01-0.5% (protocol dependent)
- Gas fees: Variable by chain
- MTAA protocol fee: 0% (promotion)

---

### **Flow 3: ASSET ALLOCATION → VAULT DEPOSIT**

**Entry Point**: Move crypto to managed vaults for yield

```
User Wallet (Crypto Assets)
    ↓
[Select Vault Strategy]
├─ Conservative (Stablecoin focused)
├─ Balanced (60% stablecoin, 40% growth)
├─ Growth (Majority altcoins)
└─ Custom (User allocation)
    ↓
[Approve Token Spending]
    POST /api/vault/approve
    {
      "tokenAddress": "0x...",
      "spender": "0x...",
      "amount": "100.00"
    }
    ↓
[Deposit to Vault]
    POST /api/vault/deposit
    {
      "amount": "100.00",
      "currency": "ETH",
      "vaultAddress": "0x..."
    }
    ↓
[Receive Vault Shares]
    └─ 1 vault share ≈ proportional asset allocation
    ↓
[Vault Auto-Compounds Yield]
    └─ Rebalances quarterly
    └─ Harvests protocol rewards
    └─ Reinvests yield
    ↓
User Vault Shares Increase
    ↓
[Track Performance]
    GET /api/vault/performance
    {
      "totalValueUSD": "$1,230",
      "yieldEarned": "$50",
      "yieldPercent": "4.2%"
    }
```

**Endpoints**:
- `POST /api/vault/deposit` - Deposit to vault
- `POST /api/vault/withdraw` - Withdraw from vault
- `GET /api/vault/balance-usd` - Get USD value
- `GET /api/vault/performance` - Get performance metrics
- `POST /api/vault/approve` - Approve token spending

**Available Vaults**:
1. **Stablecoin Vault** - cUSD + USDC + USDT (3-5% APY)
2. **Growth Vault** - ETH + SOL + BTC (8-15% APY)
3. **Mixed Vault** - 60/40 balanced (5-8% APY)
4. **Yield Farming Vault** - LP tokens (12-30% APY, higher risk)

---

### **Flow 4: VAULT PARTICIPATION → POOL STAKING**

**Entry Point**: Deeper yield farming through liquidity pools

```
User Vault Shares
    ↓
[Decide: Deeper Yield vs Lower Risk]
    ↓
[Opt Into Pool Staking]
    POST /api/pools/stake
    {
      "poolId": "usdc-eth-lp",
      "amount": "50.00",
      "lockPeriod": "30-days|90-days|180-days"
    }
    ↓
[Lock Period Options]
├─ 30-day lock: 3x base yield
├─ 90-day lock: 5x base yield
└─ 180-day lock: 8x base yield
    ↓
[LP Tokens Staked]
    └─ User receives: Stake NFT certificate
    └─ Tracks: Pool share, lock expiry, yield accumulated
    ↓
[Yield Accrual]
    Per Block:
    └─ Pool fees: 0.01-0.05% of volume
    └─ Protocol rewards: MTAA tokens
    └─ Incentives: Protocol partnerships
    ↓
[View Earnings]
    GET /api/pools/:poolId/earnings
    {
      "totalEarned": "$125.50",
      "dailyRate": "$1.20",
      "lockExpiry": "2026-02-20",
      "harvestedRewards": "$50",
      "pendingRewards": "$75.50"
    }
    ↓
[Options at Lock Expiry]
├─ Withdraw all (principal + earnings)
├─ Re-lock for continued yield
└─ Partial withdrawal + re-lock remaining
```

**Pool Types**:
- **Stablecoin Pools**: cUSD-USDC-USDT (3-5% APY)
- **Crypto Pools**: ETH-SOL, SOL-BTC (8-20% APY)
- **Governance Pools**: MTAA-USDC (15-40% APY)
- **Exotic Pools**: cUSD-Pepe, SOL-Memecoin (50%+ APY)

**Endpoints**:
- `POST /api/pools/stake` - Stake in pool
- `GET /api/pools/:poolId/earnings` - View earnings
- `POST /api/pools/:poolId/harvest` - Claim rewards
- `POST /api/pools/:poolId/unstake` - Withdraw (after lock)
- `GET /api/pools` - List all pools

---

### **Flow 5: ASSET REBALANCING → TRADING ACCOUNT**

**Entry Point**: Move funds to trading for active strategies

```
User Vault/Pool Assets
    ↓
[Rebalance Decision]
    POST /api/wallet/transfers/internal
    {
      "fromAccountId": "vault-account",
      "toAccountId": "trading-account",
      "amount": "500.00",
      "reason": "trading"
    }
    ↓
[Internal Transfer Executed]
    └─ No fees
    └─ Instant settlement (database transaction)
    └─ No blockchain delay
    ↓
Trading Account Funded
    ↓
[Available for Trading Strategies]
    GET /api/wallet/accounts
    {
      "vault": { "balance": "$500" },
      "trading": { "balance": "$500" },
      "savings": { "balance": "$0" }
    }
```

**Account Types**:
1. **Vault Account** - Long-term yield farming
2. **Trading Account** - Active strategies
3. **Savings Account** - Emergency fund (1-2% APY)
4. **Profit Lock Account** - Lock in gains

---

### **Flow 6: TRADING STRATEGIES → ACTIVE WEALTH GENERATION**

**Entry Point**: Execute various trading strategies in trading account

```
Trading Account Balance (e.g., $500 USDC)
    ↓
[SELECT STRATEGY]
    ↓
┌─ STRATEGY 1: Grid Trading
│  POST /api/strategies/grid/initiate
│  {
│    "asset": "BTC",
│    "gridLevels": 5,
│    "gridSpacing": "2%",
│    "gridInvestment": "$500"
│  }
│  ├─ Buys at: -2%, -4%, -6%, -8%, -10% below current price
│  ├─ Sells at: +2%, +4%, +6%, +8%, +10% above current price
│  ├─ Expected APY: 20-50% (high volatility)
│  └─ Duration: Continuous until stopped
│
├─ STRATEGY 2: DCA (Dollar-Cost Averaging)
│  POST /api/strategies/dca/initiate
│  {
│    "asset": "SOL",
│    "investmentPerWeek": "$50",
│    "duration": "52-weeks"
│  }
│  ├─ Executes: 1 swap per week
│  ├─ Total deployed: $2,600 over year
│  ├─ Expected APY: 15-30% (reduces timing risk)
│  └─ Next execution: [Date/Time]
│
├─ STRATEGY 3: Arbitrage (CEX-DEX)
│  POST /api/strategies/arbitrage/initiate
│  {
│    "tradingPair": "BTC-USDC",
│    "priceThreshold": "0.5%",
│    "maxTradeSize": "$100"
│  }
│  ├─ Monitors: CEX prices vs DEX prices
│  ├─ Executes when spread > threshold
│  ├─ Captures: 0.3-1.5% per trade
│  ├─ Expected APY: 30-100% (continuous arbitrage)
│  └─ Risk: Medium (slippage, gas fees)
│
├─ STRATEGY 4: Momentum Trading
│  POST /api/strategies/momentum/initiate
│  {
│    "asset": "ETH",
│    "signalType": "RSI",
│    "rsiThreshold": { "oversold": 30, "overbought": 70 },
│    "tradeSize": "$50"
│  }
│  ├─ Buys: When RSI < 30 (oversold)
│  ├─ Sells: When RSI > 70 (overbought)
│  ├─ Expected APY: 25-60%
│  └─ Risk: Medium-High (technical analysis uncertainty)
│
├─ STRATEGY 5: Yield Farming Rotation
│  POST /api/strategies/yield-rotation/initiate
│  {
│    "baseAsset": "USDC",
│    "rotationFrequency": "weekly",
│    "maxSlippage": "0.5%"
│  }
│  ├─ Monitors: Aave, Compound, Curve rates
│  ├─ Rotates funds to: Best yields weekly
│  ├─ Harvests & Compounds: Weekly rewards
│  ├─ Expected APY: 8-15%
│  └─ Risk: Low-Medium (smart contract risk)
│
├─ STRATEGY 6: Covered Call (Options)
│  POST /api/strategies/covered-call/initiate
│  {
│    "asset": "BTC",
│    "strikePrice": "42000",
│    "expiryDays": 7,
│    "amountToSell": "0.1"
│  }
│  ├─ Sells: BTC call options weekly
│  ├─ Receives: Option premium (~2-5%)
│  ├─ Risk: Must sell BTC at strike if in-the-money
│  ├─ Expected APY: 40-100% (if called every week)
│  └─ Best for: Sideways/bearish markets
│
└─ STRATEGY 7: LP Token Hedging
   POST /api/strategies/lp-hedge/initiate
   {
     "lpTokens": "usdc-eth-lp",
     "hedgeRatio": "50%",
     "hedgeType": "delta-neutral"
   }
   ├─ LP tokens → Earns 10-20% yield
   ├─ Hedges 50% downside risk
   ├─ Short position in: ETH:USDC ratio
   ├─ Expected APY: 15-25%
   └─ Risk: Low-Medium (delta hedging reduces IL)
    ↓
[Strategy Monitoring]
    GET /api/strategies/:strategyId/performance
    {
      "dailyPnL": "+$12.50",
      "monthlyPnL": "+$180.00",
      "weeklyReturn": "2.4%",
      "monthlyReturn": "7.2%",
      "annualizedAPY": "28.8%",
      "currentDrawdown": "-2.5%",
      "maxDrawdown": "-8.3%",
      "tradeCount": 15,
      "winRate": "73.3%",
      "avgWinSize": "$15.20",
      "avgLossSize": "-$5.10"
    }
    ↓
[Daily Execution Loop]
    └─ Bot checks conditions every 5 minutes
    └─ Executes trades when signals trigger
    └─ Logs all transactions
    └─ Updates P&L in real-time
    ↓
[Profit Locking]
    POST /api/wallet/transfers/internal
    {
      "fromAccountId": "trading-account",
      "toAccountId": "profit-lock-account",
      "amount": "$100",
      "reason": "profit_lock"
    }
    ↓
Profits Secured (Not risked again)
```

**Strategy Performance Tiers**:
| Strategy | APY | Risk | Complexity |
|----------|-----|------|-----------|
| DCA | 15-30% | Low | Low |
| Grid Trading | 20-50% | Medium | Medium |
| Yield Rotation | 8-15% | Low | Low |
| Arbitrage | 30-100% | Medium | High |
| Momentum | 25-60% | Medium-High | Medium |
| Covered Calls | 40-100% | Medium | High |
| Hedged LP | 15-25% | Low-Medium | High |

**Endpoints**:
- `POST /api/strategies/:type/initiate` - Start strategy
- `GET /api/strategies/:strategyId/performance` - Get performance
- `POST /api/strategies/:strategyId/stop` - Stop strategy
- `POST /api/strategies/:strategyId/pause` - Pause strategy
- `POST /api/strategies/:strategyId/adjust` - Adjust parameters

---

### **Flow 7: PROFIT REALIZATION → FIAT WITHDRAWAL**

**Entry Point**: Convert profits back to fiat

```
Profit Lock Account ($250 profit)
    ↓
[Decide: Keep Crypto vs Cash Out]
    ↓
[Option A: Partial Withdrawal (Suggested)]
    POST /api/wallet/withdrawals/initiate
    {
      "fromAccountId": "profit-lock-account",
      "destination": "offramp_flutterwave",
      "amount": "100.00",
      "currency": "USDC"
    }
    ↓
[Withdrawal Processing]
    ├─ Webhook received from payment provider
    ├─ Validates amount available
    ├─ Initiates blockchain transaction (swap USDC → stablecoin)
    └─ Transfers to payment provider
    ↓
[Payment Provider Callback]
    POST /api/webhooks/flutterwave
    {
      "transaction_id": "...",
      "status": "successful",
      "amount": 100.00,
      "recipient": "user@email.com"
    }
    ↓
[Withdrawal Status Updated]
    GET /api/wallet/withdrawals/:withdrawalId
    {
      "status": "completed",
      "amount": "100.00",
      "feeAmount": "3.20",
      "amountReceived": "96.80",
      "completedAt": "2026-01-21T14:32:00Z"
    }
    ↓
[Funds in Bank Account]
    └─ Next 1-3 business days (per provider)
    └─ Usually next day for local cards
    ↓
[Tax Reporting]
    GET /api/tax/transactions
    {
      "capitalGain": "$100",
      "taxableAmount": "$95", // After fee
      "suggestedTaxReserve": "$19", // At 20% tax rate
    }
```

**Withdrawal Providers** (Same as deposit):
- Flutterwave: 3.2% fee (1-3 days)
- Paystack: 2.9% fee (1-2 days)
- Paychant: ~1-2% fee (<5 min)
- Kotani: ~1% fee (variable)
- M-Pesa: Native rate (instant)
- Airtel: Variable fee (variable time)

**Endpoints**:
- `POST /api/wallet/withdrawals/initiate` - Start withdrawal
- `POST /api/wallet/withdrawals/complete` - Complete withdrawal (webhook)
- `GET /api/wallet/withdrawals/:withdrawalId` - Check status
- `POST /api/wallet/withdrawals/estimate-fees` - Calculate fees

---

### **Flow 8: RECURRING INCOME → PASSIVE EARNINGS**

**Entry Point**: Earn from DAO participation without active trading

```
User (MTAA Token Holder)
    ↓
[Governance Participation]
    POST /api/governance/vote
    {
      "proposalId": "prop_123",
      "choice": "for|against|abstain",
      "votingPower": "1000"
    }
    ↓
[Earn Governance Rewards]
    └─ Per proposal: 0.1-1% of MTAA pools
    └─ Monthly: 2-5% of participation
    ↓
[Referral Earnings]
    GET /api/referral/status
    {
      "referredUsers": 15,
      "totalReferred": "$2,500",
      "commissionRate": "3-10%",
      "monthlyEarnings": "$75"
    }
    ↓
[Contribution Rewards]
    POST /api/contributions/submit
    {
      "type": "article|bug-report|feature-request|community-help",
      "description": "..."
    }
    ↓
    Earn: MTAA tokens + reputation
    ↓
[Pool Fees]
    └─ Share of trading pool fees
    └─ Distributed: Weekly
    └─ Rate: 0.01-0.05% of pool volume
    ↓
[Reinvestment Auto-Compound]
    └─ All rewards auto-invested
    └─ Monthly compounding
    └─ Effective APY: +2-3% boost
    ↓
Monthly Passive Income Statement
    ├─ Governance: $50
    ├─ Referrals: $75
    ├─ Contributions: $120
    ├─ Pool fees: $30
    └─ Total: $275/month
```

**Passive Income Sources**:
- **Governance**: Vote on proposals, earn rewards
- **Referrals**: Refer users, earn 3-10% commission
- **Contributions**: Help community, earn MTAA
- **Pool Fees**: Share of trading volumes
- **Staking Rewards**: MTAA token staking

**Endpoints**:
- `POST /api/governance/vote` - Vote on proposals
- `GET /api/referral/status` - Check referral earnings
- `POST /api/contributions/submit` - Submit contributions
- `GET /api/economy/earn` - View all earning opportunities

---

### **Flow 9: EMERGENCY ACCESS → SAVINGS ACCOUNT**

**Entry Point**: Emergency liquidity from savings

```
User Emergency Situation
    ↓
[Access Savings Account]
    GET /api/wallet/accounts/savings
    {
      "balance": "$1,000",
      "apy": "2%",
      "withdrawalFee": "0%",
      "withdrawalTime": "instant"
    }
    ↓
[Withdraw for Emergency]
    POST /api/wallet/withdrawals/initiate
    {
      "fromAccountId": "savings-account",
      "destination": "external_wallet|bank_transfer",
      "amount": "$500"
    }
    ↓
[Emergency Funds Available]
    └─ No lock-in period
    └─ No penalties
    └─ Instant access
    ↓
[Optional: Rebuild Savings Later]
    POST /api/wallet/transfers/internal
    {
      "fromAccountId": "trading-account",
      "toAccountId": "savings-account",
      "amount": "$500",
      "reason": "savings"
    }
```

---

## 🔄 Complete End-to-End Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                       MTAA DAO USER JOURNEY                         │
└─────────────────────────────────────────────────────────────────────┘

1. ENTRY
   ↓
   Fiat (KES/USD in Bank)
   ↓
   [Deposit via 6 Payment Providers]
   ↓
   USDC/USDT in Wallet (-3-5% fee)

2. DIVERSIFICATION
   ↓
   [DEX Swap: USDC → BTC/SOL/ETH]
   ↓
   Multi-Asset Portfolio (-0.01-0.5% fee)

3. LONG-TERM GROWTH
   ↓
   [Deposit to Vault]
   ↓
   Vault Shares (4-15% APY)
   ├─ Auto-compounds quarterly
   ├─ Rebalances automatically
   └─ Generates passive income

4. ENHANCED YIELD
   ↓
   [Stake in Liquidity Pools]
   ↓
   LP Stake + Lock-in (3-40% APY)
   ├─ 30-day lock: 3x yield
   ├─ 90-day lock: 5x yield
   └─ 180-day lock: 8x yield

5. ACTIVE TRADING (OPTIONAL)
   ↓
   [Rebalance to Trading Account]
   ↓
   [Execute Strategies]
   ├─ Grid Trading: 20-50% APY
   ├─ DCA: 15-30% APY
   ├─ Arbitrage: 30-100% APY
   ├─ Momentum: 25-60% APY
   ├─ Yield Rotation: 8-15% APY
   ├─ Covered Calls: 40-100% APY
   └─ LP Hedging: 15-25% APY
   ↓
   Active Income (+$50-1000/month)

6. PASSIVE INCOME
   ↓
   [Governance, Referrals, Contributions]
   ↓
   Monthly Passive: +$200-500

7. PROFIT LOCK
   ↓
   [Move profits to Profit Lock Account]
   ↓
   Secured Gains (Not re-risked)

8. EXIT / REINVEST
   ↓
   [Option A: Withdraw to Fiat]
   └─ Withdraw to Bank (-2-5% fee)
   └─ Pay taxes on gains
   ↓
   [Option B: Reinvest]
   └─ Return to step 2
   └─ Compound growth

9. EMERGENCY FUND
   ↓
   [Maintain Savings Account]
   ↓
   Emergency access anytime (0% fee)


COMPLETE CYCLE EXAMPLE:
  
  Deposit: $1,000 KES → $95 USDC (5% fee)
  ↓
  Swap: $95 USDC → 0.0023 BTC + 15 SOL + 1 ETH
  ↓
  Vault: $95 in vault earning 10% APY ($9.50/year)
  ↓
  Pools: $40 in pools earning 20% APY ($8/year)
  ↓
  Trading: $30 grid trading earning 30% APY ($9/year)
  ↓
  Passive: $25 governance/referrals earning $10/month
  ↓
  Year 1 Total Earnings: $9.50 + $8 + $9 + $120 = $146.50
  ↓
  Year 1 Return: 154% on initial $1,000
  ↓
  Withdrawal: $1,146.50 back to bank (-4% fee) = $1,101
  ↓
  Net Profit: $101 (10.1% in 1 year)
```

---

## 💰 Real-World Earning Scenarios

### **Scenario 1: Conservative User ($500)**
```
Deposit: $500
├─ 60% in Vault ($300) → 5% APY = $15
├─ 30% in Pools ($150) → 10% APY = $15
└─ 10% Savings ($50) → 2% APY = $1
Year 1 Earnings: $31 (6.2% APY)
Risk Level: Low
Time Required: <1 hour setup, 5 mins/month monitoring
```

### **Scenario 2: Balanced User ($5,000)**
```
Deposit: $5,000
├─ 40% Vault ($2,000) → 10% APY = $200
├─ 40% Pools ($2,000) → 20% APY = $400
├─ 15% Trading ($750) → 30% APY = $225
├─ 5% Passive ($250) → 40% APY = $100
└─ Savings ($0) → Emergency covered by trading
Year 1 Earnings: $925 (18.5% APY)
Risk Level: Medium
Time Required: 2-3 hours setup, 30 mins/day active trading
```

### **Scenario 3: Aggressive User ($10,000)**
```
Deposit: $10,000
├─ 20% Vault ($2,000) → 15% APY = $300
├─ 30% Pools ($3,000) → 25% APY = $750
├─ 40% Trading ($4,000) → 50% APY = $2,000
├─ 10% Passive ($1,000) → 50% APY = $500
├─ Profit Lock ($0) → Continuously locked gains
└─ Savings ($0) → Fast access via trading account
Year 1 Earnings: $3,550 (35.5% APY)
Risk Level: High
Time Required: 3-4 hours setup, 1-2 hours/day active trading
```

---

## 🛡️ Risk Management

### **Account Separation**
- **Vault**: Protected, auto-managed (low risk)
- **Pools**: Medium-term locked (medium risk)
- **Trading**: Active, flexible (high risk)
- **Savings**: Emergency fund (no risk)
- **Profit Lock**: Secured gains (no re-risk)

### **Drawdown Protection**
```
If Account Drops >20%:
├─ Alert: Notification sent
├─ Pause: Automated strategies pause
└─ Review: Force review of portfolio

If Account Drops >50%:
├─ Auto-Halt: All strategies stop
├─ Lock: Cannot add new positions
└─ Notify: Urgent notification + email + SMS
```

### **Position Sizing**
- Max per strategy: 10% of account
- Max leverage: 2x (optional)
- Max correlated assets: 30%
- Daily loss limit: 5%
- Weekly loss limit: 15%

---

## 📱 Mobile-Optimized Flows

### **Quick Actions**
```
Home Screen:
├─ [Deposit] → 3 taps to deposit via M-Pesa
├─ [Withdraw] → 3 taps to withdraw to bank
├─ [Swap] → Quick swap UI (BTC ↔ SOL)
├─ [View Earnings] → Today/Week/Month tabs
└─ [Emergency Access] → 1-tap withdraw from savings
```

### **Notifications**
```
Real-time alerts for:
├─ Deposit received: "✅ $100 USDC received!"
├─ Strategy signal: "📊 Grid buy at $42,500!"
├─ Profit milestone: "🎉 +$500 profit! Lock it in?"
├─ Drawdown alert: "⚠️ Account down 15%, review portfolio"
└─ Earning milestone: "💰 $100 passive earned this month!"
```

---

## 🔧 API Reference Summary

### **Wallet Management**
```
POST   /api/wallet/deposits/initiate
POST   /api/wallet/deposits/complete
GET    /api/wallet/deposits/methods
GET    /api/wallet/deposits/user/:userId
POST   /api/wallet/withdrawals/initiate
GET    /api/wallet/withdrawals/:withdrawalId
POST   /api/wallet/transfers/internal
GET    /api/wallet/accounts
GET    /api/wallet/balance
```

### **Trading & Swaps**
```
POST   /api/transactions/swaps
POST   /api/transactions/swaps/:swapId/execute
GET    /api/transactions/swaps/:walletId
GET    /api/dex/quote
POST   /api/dex/swap
```

### **Vault & Pools**
```
POST   /api/vault/deposit
POST   /api/vault/withdraw
GET    /api/vault/balance-usd
GET    /api/vault/performance
POST   /api/pools/stake
GET    /api/pools/:poolId/earnings
POST   /api/pools/:poolId/harvest
POST   /api/pools/:poolId/unstake
```

### **Strategies**
```
POST   /api/strategies/:type/initiate
GET    /api/strategies/:strategyId/performance
POST   /api/strategies/:strategyId/stop
POST   /api/strategies/:strategyId/pause
POST   /api/strategies/:strategyId/adjust
```

### **Earnings**
```
GET    /api/governance/proposals
POST   /api/governance/vote
GET    /api/referral/status
POST   /api/contributions/submit
GET    /api/economy/earn
GET    /api/economy/gdp
```

---

## 📊 Complete System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                   MTAA DAO VALUE FLOW SYSTEM                    │
└─────────────────────────────────────────────────────────────────┘

ENTRY LAYER
┌─────────────────────────────────────────────────────────────────┐
│ Payment Providers (6)                                           │
│ Flutterwave | Paystack | Paychant | Kotani | M-Pesa | Airtel   │
│ $0 setup, transaction fees only                                │
└─────────────┬───────────────────────────────────────────────────┘
              │
STABLECOIN LAYER
┌─────────────▼───────────────────────────────────────────────────┐
│ Wallet (USDC/USDT/cUSD)                                         │
│ ├─ Core account (liquid)                                       │
│ ├─ 0% fees for internal transfers                              │
│ └─ Swift settlement (instant)                                  │
└─────────────┬───────────────────────────────────────────────────┘
              │
ASSET DIVERSIFICATION LAYER
┌─────────────▼───────────────────────────────────────────────────┐
│ DEX Swap Engine                                                 │
│ ├─ Multi-chain support (Ethereum, Solana, Optimism, Arbitrum)  │
│ ├─ Route optimization (1Inch, Uniswap, Curve)                  │
│ ├─ Slippage protection (0-1%)                                  │
│ └─ Gas optimization                                            │
└─────────────┬───────────────────────────────────────────────────┘
              │
YIELD GENERATION LAYER
      ┌───────┴────────┐
      │                │
   VAULT          POOLS & STAKING
   ├─ Conservative  ├─ Liquidity Mining
   ├─ Balanced      ├─ Governance
   ├─ Growth        ├─ Partnerships
   └─ Custom        └─ Yield Farming
      │                │
      └────────┬───────┘
               │
ACTIVE TRADING LAYER
┌──────────────▼──────────────────────────────────────────────────┐
│ Strategy Engine (7 automated strategies)                        │
│ ├─ Grid Trading (20-50% APY)                                   │
│ ├─ DCA (15-30% APY)                                            │
│ ├─ Arbitrage (30-100% APY)                                     │
│ ├─ Momentum (25-60% APY)                                       │
│ ├─ Yield Rotation (8-15% APY)                                  │
│ ├─ Covered Calls (40-100% APY)                                 │
│ └─ LP Hedging (15-25% APY)                                     │
└──────────────┬───────────────────────────────────────────────────┘
               │
PASSIVE INCOME LAYER
┌──────────────▼───────────────────────────────────────────────────┐
│ Earnings Engine                                                 │
│ ├─ Governance ($50-500/month)                                  │
│ ├─ Referrals ($50-500/month)                                   │
│ ├─ Contributions ($50-500/month)                               │
│ ├─ Pool Fees ($20-100/month)                                   │
│ └─ MTAA Staking ($100-1000+/month)                             │
└──────────────┬───────────────────────────────────────────────────┘
               │
EXIT LAYER
┌──────────────▼───────────────────────────────────────────────────┐
│ Withdrawal/Profit Realization                                   │
│ ├─ Fiat withdrawal (3-5% fee, 1-3 days)                        │
│ ├─ Profit lock (0% fee, secured)                               │
│ ├─ Reinvestment (0% fee, auto-compound)                        │
│ └─ Emergency access (0% fee, instant)                          │
└───────────────────────────────────────────────────────────────────┘
```

---

## 📈 Expected Annual Returns by Profile

| User Type | Initial | Year 1 | Year 3 | Year 5 | Strategy |
|-----------|---------|--------|--------|--------|----------|
| Conservative | $1,000 | $1,062 | $1,195 | $1,370 | 6% APY (Vault+Savings) |
| Balanced | $5,000 | $5,925 | $8,335 | $11,770 | 18% APY (Mixed) |
| Aggressive | $10,000 | $13,550 | $24,845 | $45,450 | 35% APY (Trading+Pools) |
| Day Trader | $50,000 | $125,000 | $625,000 | $3.1M | 150% APY (Full trading) |

*Note: Past performance not guaranteed. Returns depend on market conditions, strategy execution, and user discipline.*

---

## 🎯 Summary: User Value Flow

**From Entry to Exit**:

1. ✅ **Deposit** - Choose from 6 payment providers (3-5% fee)
2. ✅ **Diversify** - Swap to multiple assets (0-0.5% fee)
3. ✅ **Grow** - Stake in vaults/pools (4-40% APY)
4. ✅ **Trade** - Execute automated strategies (20-150% APY)
5. ✅ **Earn** - Passive income from governance/referrals (10-50% monthly)
6. ✅ **Lock** - Secure profits in separate account
7. ✅ **Exit** - Withdraw to fiat or reinvest
8. ✅ **Repeat** - Compound annual returns

**Key Advantages**:
- 🌍 African payment access ($0 setup)
- 💰 Multiple earning streams (5+ income sources)
- 🛡️ Account separation (risk management)
- 📱 Mobile-first design
- 🤖 Automated strategies (DCA, arbitrage, etc.)
- 🔄 Frictionless rebalancing (0% internal transfer fees)
- 📊 Real-time monitoring & alerts
- 🧮 Tax-ready reporting

**Complete ecosystem for African users to grow wealth through DeFi! 🚀**
