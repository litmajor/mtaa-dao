# Quick Reference: The New Persona Model

## The Three Modes (All features, different dashboard focus)

### 🎤 MTAA Community (Okedi)
- **Dashboard focus:** Governance, DAOs, proposals, reputation
- **Primary widgets:** DAO overview, governance activity, proposal drafts
- **Hidden but accessible:** Trading, yield farming, leverage
- **Best for:** Community leaders, DAO creators, governors
- **Unlock path:** Day 0 (voting) → Day 7 (proposals) → Anytime (DAO)

### 🛠️ MTAA Trader (Yuki)
- **Dashboard focus:** Trading, positions, yield, markets
- **Primary widgets:** Open positions, market alerts, yield farms
- **Hidden but accessible:** DAOs, governance, community
- **Best for:** Active traders, yield optimizers, technicians
- **Unlock path:** Day 0 (basic trading) → Day 7 (leverage) → Advanced Mode

### 💰 MTAA Investor (Amara)
- **Dashboard focus:** Passive income, DAOs, wealth growth
- **Primary widgets:** Wealth overview, DAO investments, yield ranking
- **Hidden but accessible:** Trading (simplified), governance
- **Best for:** Passive wealth builders, DAO investors, long-term hodlers
- **Unlock path:** Day 0 (yield deposits) → Day 7 (DAO creation) → Passive income

---

## Feature Access by Mode (All modes have access to all)

| Feature | Community | Trader | Investor | Gate Type |
|---------|-----------|--------|----------|-----------|
| DAOs (view/join) | Primary | Secondary | Primary | Age 0+ |
| DAOs (create) | ✅ Yes | ✅ Yes | ✅ Yes | Age 7+ |
| Governance (vote) | Primary | Secondary | Primary | Age 0+ |
| Proposals (create) | ✅ Yes | ✅ Yes | ✅ Yes | Age 7+ |
| Trading (basic) | Hidden | Primary | Hidden | Age 0+ |
| Trading (leverage) | Advanced Mode | Advanced Mode | ❌ Not allowed | Mode+Age |
| Yield vaults | Hidden | Primary | Primary | Age 0+ |
| Investment pools | Hidden | Primary | Primary | Age 0+ |
| Smart contracts | Advanced Mode | Advanced Mode | ❌ Not allowed | Mode+Age |
| NFT minting | ✅ Yes | ✅ Yes | ✅ Yes | Rep 5+ |

**Key:** 
- ✅ = Accessible and appropriate
- Primary = Shown first in dashboard
- Secondary = Available in "More Options"
- Hidden = Accessible via menu/direct nav
- Advanced Mode = Requires toggle + 7 days old
- ❌ = Not available for this mode

---

## No More Amount Gates 🚀

| Old Gate | New Gate | Reason |
|----------|----------|--------|
| vault.yield: 100K min | None - anyone can start | Lower barrier to entry |
| maonovault: 10K min | None - anyone can join | Explore without commitment |
| trading.dex: balance-based | None - start with 1 KES | Learn at your pace |

---

## Gating Strategy (What Actually Blocks Features)

### 1. Time Gates (Prevent Spam)
```
proposal.create: 7 days old
dao.create.cooldown: 5 days between DAOs
nft.minting: Rep 5+ (engagement-based)
```

### 2. Mode Gates (Protect Advanced Features)
```
leverage.trading: Advanced Mode + 7 days old
smart.contracts: Advanced Mode + 30 days old
beta.features: Advanced Mode toggle
```

### 3. Role Gates (DAO-specific)
```
dao.createProposal: DAO member only
dao.withdraw: DAO admin/treasurer only
dao.governance: DAO members only
```

### 4. NO Amount Gates (REMOVED)
```
vault.yield: anyone, any amount
investment.pools: anyone, any amount
trading.dex: anyone, any amount
```

---

## User Flow Examples

### Scenario 1: Okedi becomes a Trader
```
Day 0: User selects Okedi (Community)
  └─ Dashboard shows: DAOs, governance, voting
  └─ But can access trading via menu

Day 5: User says "I want to trade"
  └─ Goes to Settings → Active Mode
  └─ Switches to Yuki (Trader)
  └─ Dashboard reorganizes to show trading first
  └─ Still can create proposals in Okedi-created DAOs

Day 7: Okedi now enabled for leverage
  └─ Enables Advanced Mode toggle
  └─ Can use leverage trading
  └─ Still can vote and create proposals
```

### Scenario 2: Yuki wants to invest in DAOs
```
Day 0: User selects Yuki (Trader)
  └─ Dashboard shows: Trading, positions, yield
  └─ DAOs are in "More Options"

Day 10: User says "I want to invest in DAOs"
  └─ Clicks on DAO in "More Options"
  └─ Can join any DAO immediately
  └─ Can vote on DAOs they're in
  └─ Can switch to Amara (Investor) mode to reorder dashboard

Day 30: Yuki is both trader AND DAO investor
  └─ Trading in Yuki mode (active mode)
  └─ Or switch to Amara mode to focus on DAO returns
  └─ All features accessible from either mode
```

### Scenario 3: Amara discovers she wants to trade
```
Day 0: User selects Amara (Investor)
  └─ Dashboard shows: Wealth, DAO returns, passive income
  └─ Trading hidden in UI

Day 15: Amara interested in learning trading
  └─ Trading is still blocked (not a Trader mode feature)
  └─ Goes to Settings → Change mode to Yuki
  └─ Switches to Yuki (Trader)
  └─ Can now see and do basic trading

BUT: Amara cannot use leverage/advanced features
  └─ Those are Advanced Mode only
  └─ She could enable Advanced Mode if she wants
  └─ But leverage is really trader-focused
```

---

## Technical Details

### Data Stored
```
User table:
  - primaryPersona: 'okedi' | 'yuki' | 'amara'
  - activePersona: 'okedi' | 'yuki' | 'amara'
  - advancedMode: boolean
  - createdAt: Date (for time gates)
  - reputation: number (for rep gates)
  
REMOVED:
  - minVaultBalance
  - minPoolBalance
  - minTradingAmount
```

### localStorage
```
activePersona: saved for quick access
advancedMode: saved for toggling
```

### API Endpoints
```
GET /api/personas/current → Get primary persona
POST /api/personas/select → Set primary persona (signup)
GET /api/personas/active-mode → Get active mode
POST /api/personas/active-mode → Switch active mode
GET /api/personas/dashboard-config → Get dashboard layout
```

---

## Dashboard Widgets by Mode

### Community Mode Widgets
```
Primary:
  - DAO Overview (created, joined, members)
  - Governance Activity (pending votes, recent)
  - Reputation Progress (current level, next level)
  - Proposal Drafts (my proposals)

Secondary:
  - Trading Overview (if interested)
  - Yield Farms (if interested)
  - Market Alerts (if interested)
```

### Trader Mode Widgets
```
Primary:
  - Trading Overview (stats, P&L, win rate)
  - Open Positions (active trades, leverage)
  - Market Alerts (opportunities)
  - Yield Farms (earning)

Secondary:
  - Governance Activity (in DAOs)
  - Portfolio Health (diversification)
```

### Investor Mode Widgets
```
Primary:
  - Wealth Overview (total assets, income, growth)
  - DAO Investments (my shares, returns)
  - Yield Ranking (top pools by APY)
  - Passive Income (by source)

Secondary:
  - Governance Activity (in DAOs)
  - Portfolio Diversification
```

---

## Morio Context (What Morio Knows)

```typescript
interface MorioContext {
  userId: string;
  activePersona: 'okedi' | 'yuki' | 'amara';
  isAdvancedMode: boolean;
  daysOld: number;
  reputation: number;
  recentActivity: string[];  // What user was just doing
}

Morio responses change based on:
  - "You're a Trader, leverage trading is available in Advanced Mode"
  - "As an Investor, this DAO offers 12% annual returns"
  - "Community leaders can create proposals after 7 days"
```

---

## Switching Modes (UX Flow)

### Settings Page
```
┌─────────────────────────────────────┐
│         Account Settings             │
├─────────────────────────────────────┤
│                                     │
│  Current Mode: Okedi (Community)   │
│                                     │
│  [ Okedi ] [ Yuki ] [ Amara ]      │ ← Click to switch
│   Active   Dashboard reorganizes    │
│                                     │
│  Advanced Mode: [Toggle]           │
│    Enable for leverage/contracts    │
│                                     │
└─────────────────────────────────────┘
```

**What happens when you switch:**
1. activePersona updates in database
2. Dashboard fetches new layout
3. Widgets re-render in new order
4. Morio context updates
5. All features remain accessible

---

## Key Principles

1. **No Restrictions, Just Organization**
   - Users can do everything, just in different UI layouts

2. **Choose Your Focus**
   - Community: Governance-focused
   - Trader: Execution-focused
   - Investor: Passive income-focused

3. **Switch Anytime**
   - Mode is not permanent
   - Change in Settings → Active Mode
   - All data persists

4. **All Features, Any Mode**
   - Community can trade (just not highlighted)
   - Trader can create DAOs (just not highlighted)
   - Investor can use leverage (if Advanced Mode)

5. **Real Gates Only**
   - Time (prevent spam)
   - Reputation (require engagement)
   - Advanced Mode (dangerous features)
   - DAO roles (set by DAO creator)

6. **No Amount Gates**
   - Anyone can start with 1 KES
   - No minimum balances
   - Lower barrier to entry

---

## Success = This Works

- User: "I'm a Community builder but want to try trading"
- System: "Sure! Switch to Trader mode or access it from menu"
- User: "Can I use leverage?"
- System: "If you enable Advanced Mode, yes!"
- User: "What if I want both?"
- System: "You already have both, pick which dashboard you want"
- User: ✅ "Perfect!"
