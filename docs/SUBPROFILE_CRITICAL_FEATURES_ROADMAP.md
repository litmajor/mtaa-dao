# Subprofile Critical Features Roadmap

## Summary: What's Missing (Prioritized)

### 🎤 OKEDI - Missing 3 Major Features

**Priority 1: Send to DAO Members** (MTAA Core Feature)
- **Impact**: HIGH - This is what Okedi users NEED
- **Complexity**: Medium
- **Work**: 
  - Modify `Send` component to detect DAO context
  - Add DAO member lookup/autocomplete
  - Create "Send to DAO" flow as primary option
  - Store DAO member contacts

**Priority 2: Escrow System** (CHAMA Essential)
- **Impact**: HIGH - Enables trust-based transactions
- **Complexity**: High (multi-step process)
- **Work**:
  - Create Escrow data model
  - Escrow creation UI
  - Mediator interface
  - Dispute resolution workflow
  - Status tracking

**Priority 3: DAO Chat Isolation** (Community Building)
- **Impact**: HIGH - Community requires communication
- **Complexity**: Low (already built in dao-chat.tsx)
- **Work**:
  - Move dao-chat.tsx into Okedi dashboard only
  - Remove from other subprofiles
  - Add pinned announcements for DAO updates
  - Member directory in chat sidebar

---

### 🛠️ YUKI - Missing 4 Major Features

**Priority 1: Bot Builder Interface** (Traders Need This)
- **Impact**: CRITICAL - This is YUKI's unique value
- **Complexity**: Very High (complex UI + backend)
- **Work**:
  - Visual node-based builder (or form-based)
  - Define entry conditions (price, indicators, on-chain)
  - Define exit conditions (TP/SL, time-based)
  - Risk parameters (max loss, position size)
  - Deploy bots as scheduled jobs
  - Monitor active bots dashboard
  - Performance tracking per bot

**Priority 2: Market Intelligence** (Trading Signals)
- **Impact**: CRITICAL - "We give them intelligence"
- **Complexity**: High (AI/ML based)
- **Work**:
  - AI signal generation (buy/sell/hold)
  - Sentiment analysis integration
  - Fear & Greed Index (already built! ✅)
  - Whale watching alerts
  - Liquidation level warnings
  - On-chain metric alerts
  - Technical breakout detection

**Priority 3: Trading Journal** (Trader Development)
- **Impact**: Medium - Helps traders improve
- **Complexity**: Medium
- **Work**:
  - Log trade entry/exit automatically or manually
  - Trade analysis notes & lessons learned
  - Strategy tag/categorization
  - Win rate by strategy
  - Average R:R ratio
  - Monthly/quarterly reports

**Priority 4: Copy Trading** (Engagement & Revenue)
- **Impact**: Medium - Social + monetization
- **Complexity**: High
- **Work**:
  - Trader leaderboards
  - Copy trade execution
  - Risk scaling per investor
  - Fee distribution (platform cut)
  - Investor statements

---

### 💰 AMARA - Missing 2 Major Features

**Priority 1: Decentralized Hedge Fund System** (Unique Value)
- **Impact**: CRITICAL - Differentiates Amara
- **Complexity**: Very High (complex financial instruments)
- **Work**:
  - Hedge fund creation interface
  - Fund manager dashboard
  - Investor onboarding/KYC
  - NAV calculation engine
  - Performance attribution
  - Fee calculation & distribution
  - Compliance/audit trails
  - Investor statements/reporting

**Priority 2: Passive Income Dashboard** (Wealth Building)
- **Impact**: High - Core to Amara's mission
- **Complexity**: Medium
- **Work**:
  - Aggregate all passive income sources
  - Monthly/annual projections
  - Goal tracking (reach $X/month)
  - DCA automation setup
  - Auto-reinvest configuration
  - Tax reporting integration
  - Income vs expense tracking

**Bonus Priority 3: Investor Governance** (Secondary)
- **Impact**: Medium - Amara votes in DAOs she invests in
- **Complexity**: Low
- **Work**:
  - Show governance alerts for invested DAOs
  - Voting interface (can vote as stakeholder)
  - Voting power based on holdings
  - Track voting participation

---

## Feature Dependency Map

```
OKEDI FOUNDATION:
  Send to DAO Members
    ↓
  Escrow System (depends on transfers working)
    ↓
  DAO Chat (no dependencies, can be parallel)

YUKI FOUNDATION:
  Bot Builder
    ↓
  Market Intelligence (signals inform bot decisions)
    ↓
  Trading Journal (logs bot performance)
    ↓
  Copy Trading (investors copy bot strategies)

AMARA FOUNDATION:
  Hedge Fund System (core value prop)
    ↓
  Passive Income Dashboard (aggregates all income)
    ↓
  Investor Governance (secondary benefit)
```

---

## Implementation Phases

### PHASE 1: Core Isolation (Weeks 1-2)
**Goal**: Make dashboards completely isolated

Tasks:
- [ ] Split PersonalizedDashboard.tsx into three separate components
  - OkediDashboard.tsx (governance focus)
  - YukiDashboard.tsx (trading focus)
  - AmaraDashboard.tsx (wealth focus)
- [ ] Move DAO Chat to Okedi only
- [ ] Hide irrelevant features in each dashboard
- [ ] Create separate data endpoints per subprofile

**Files to modify**:
- client/src/components/dashboard/PersonalizedDashboard.tsx (split into 3)
- server/routes/dashboard.ts (create /api/dashboard/okedi, /yuki, /amara)
- gatingService.ts (enforce feature visibility per subprofile)

---

### PHASE 2: OKEDI Critical Features (Weeks 3-4)

**Sprint 1: Send to DAO Members**
- [ ] Create SendToDAOMember.tsx component
- [ ] DAO member autocomplete lookup
- [ ] Transaction confirmation modal
- [ ] POST /api/wallet/send-to-dao endpoint

**Sprint 2: Escrow System**
- [ ] Create Escrow data model in schema.ts
- [ ] EscrowForm.tsx component
- [ ] EscrowManager.tsx for mediators
- [ ] POST /api/escrow/create
- [ ] POST /api/escrow/:id/release
- [ ] POST /api/escrow/:id/dispute

**Files to create**:
- client/src/components/SendToDAOMember.tsx
- client/src/components/EscrowForm.tsx
- client/src/components/EscrowManager.tsx
- server/routes/escrow.ts
- shared/schema.ts (escrow table)

---

### PHASE 3: YUKI Critical Features (Weeks 5-8)

**Sprint 1: Bot Builder Interface**
- [ ] Create BotBuilder.tsx (main interface)
- [ ] ConditionBuilder.tsx (entry/exit conditions)
- [ ] RiskParameters.tsx (position sizing, max loss)
- [ ] BotDashboard.tsx (monitor active bots)
- [ ] POST /api/trading/bots/create
- [ ] PUT /api/trading/bots/:id/update
- [ ] GET /api/trading/bots/:id/performance

**Sprint 2: Market Intelligence**
- [ ] AISignalGenerator (service layer)
- [ ] MarketSignals.tsx component
- [ ] SentimentPanel.tsx (Fear & Greed, crypto sentiment)
- [ ] WhaleWatch.tsx (whale transaction alerts)
- [ ] GET /api/trading/signals (AI-generated)
- [ ] GET /api/trading/whales (whale activity)

**Sprint 3: Trading Journal**
- [ ] TradeJournal.tsx (log trades)
- [ ] TradeAnalysis.tsx (analyze trades)
- [ ] TradingStats.tsx (win rate, R:R, etc.)
- [ ] POST /api/trading/journal
- [ ] GET /api/trading/journal/stats

**Files to create**:
- client/src/components/BotBuilder.tsx
- client/src/components/BotDashboard.tsx
- client/src/components/MarketSignals.tsx
- client/src/components/TradeJournal.tsx
- client/src/services/aiSignalGenerator.ts
- server/routes/trading-bots.ts
- server/services/aiSignals.ts

---

### PHASE 4: AMARA Critical Features (Weeks 9-12)

**Sprint 1: Hedge Fund System**
- [ ] Create HedgeFund data model in schema.ts
- [ ] HedgeFundCreator.tsx (for fund managers)
- [ ] HedgeFundInvestor.tsx (for investors)
- [ ] HedgeFundDashboard.tsx (for fund managers)
- [ ] HedgeFundBrowser.tsx (discover funds)
- [ ] NAVCalculator service
- [ ] FeeCalculator service
- [ ] POST /api/hedge-funds/create
- [ ] POST /api/hedge-funds/:id/invest
- [ ] GET /api/hedge-funds/:id/performance

**Sprint 2: Passive Income Dashboard**
- [ ] PassiveIncomeAggregator.tsx (main component)
- [ ] IncomeStreams.tsx (breakdown by source)
- [ ] ProjectionCalculator.tsx (forecast income)
- [ ] DCAScheduler.tsx (set up DCA)
- [ ] TaxReporting.tsx (tax documents)
- [ ] GET /api/passive-income/summary
- [ ] POST /api/passive-income/dca/setup

**Files to create**:
- client/src/components/HedgeFundCreator.tsx
- client/src/components/HedgeFundInvestor.tsx
- client/src/components/HedgeFundDashboard.tsx
- client/src/components/PassiveIncomeAggregator.tsx
- client/src/services/hedgeFundCalculator.ts
- server/routes/hedge-funds.ts
- server/services/hedgeFundEngine.ts
- shared/schema.ts (hedge fund tables)

---

## Estimated Effort

| Feature | Priority | Effort | Timeline |
|---------|----------|--------|----------|
| Dashboard Isolation | P0 | 40h | Weeks 1-2 |
| Send to DAO Member | P1 | 20h | Week 3 |
| Escrow System | P1 | 60h | Weeks 3-4 |
| DAO Chat Isolation | P1 | 10h | Week 4 |
| Bot Builder | P1 | 120h | Weeks 5-7 |
| Market Intelligence | P1 | 80h | Weeks 6-7 |
| Trading Journal | P2 | 40h | Week 8 |
| Hedge Fund System | P1 | 160h | Weeks 9-11 |
| Passive Income Dashboard | P1 | 60h | Weeks 11-12 |

**Total: ~590 hours (~14-15 weeks)**

---

## Success Metrics

### OKEDI
- ✅ Users can send to DAO members as primary action
- ✅ Escrow agreements created and disputes resolved
- ✅ DAO chat is active hub for community
- ✅ Member reputation visible & tracked

### YUKI  
- ✅ 10+ active trading bots created
- ✅ Market signal accuracy > 60%
- ✅ Traders logging all trades in journal
- ✅ Copy trading generating revenue

### AMARA
- ✅ 5+ active hedge funds launched
- ✅ $1M+ AUM in hedge funds
- ✅ Users on DCA/passive income automation
- ✅ $50K+ monthly passive income earned by users

