# Architecture Brainstorm: Personas, Gating & Dashboards

## Current State

### Three Personas (Rebranded)
1. **Okedi** → **MTAA Community** (🎤 #8B5CF6) - Community Leader & Governor
2. **Yuki** → **MTAA Trader** (🛠️ #06B6D4) - Advanced Trader & Developer  
3. **Amara** → **MTAA Investor** (💰 #EC4899) - Wealth Builder & Investor

### Current Gating Rules (12 Features)
```
Gating Type: age (time-based)
  • proposal.create: 7 days old
  • dao.create.cooldown: 5 days between DAOs

Gating Type: balance (amount-based)
  • vault.yield: 100K KES min
  • maonovault.access: 10K KES min

Gating Type: reputation (engagement-based)
  • ai.assistant: Rep 1+ (basically all users)
  • nft.minting: Rep 5+

Gating Type: manual (opt-in)
  • trading.dex: Requires "Advanced Mode" toggle
  • beta.features: Requires "Advanced Mode" toggle

Gating Type: none (always accessible)
  • dao.join: Immediately
  • governance.vote: Immediately
  • dao.create: Immediately
```

---

## The Problem You're Identifying ✅

You're right - the current approach has issues:

### ❌ What's Wrong

1. **Amount-based gating (`vault.yield: 100K KES`)**
   - Excludes users based on wallet balance
   - Doesn't align with persona intent
   - Community members might want to try yielding
   - Traders shouldn't need 100K to learn trading

2. **Persona doesn't drive feature access**
   - Selecting "MTAA Trader" doesn't unlock trading features
   - Selecting "MTAA Community" doesn't prioritize governance
   - Personas are cosmetic, not functional

3. **No mode/mode switching concept**
   - Users are locked into one persona
   - Okedi (Community) can't become Yuki (Trader)
   - Real users wear multiple hats

4. **DAOs unclear**
   - Are they investments or governance tools?
   - What separates DAO creation from investment pool creation?
   - Why can anyone create a DAO but need balance for vault?

---

## The Right Mental Model

### Core Insight: Personas as USER MODES, Not Restrictions

Instead of:
```
User selects Okedi
  ↓
Okedi persona locks them out of trading features
```

Think:
```
User can be in ANY persona mode
  ↓
Persona changes which features are prioritized/suggested in their dashboard
  ↓
But they can still access other modes (with appropriate feature guards)
```

---

## Rethinking: Features vs. Modes

### What Should Actually Gate Features?

**YES Gate (Real Reasons):**
- `proposal.create`: Age 7+ (prevents spam)
- `dao.create.cooldown`: 5 days between DAOs (prevents spam)
- `nft.minting`: Rep 5+ (requires engagement history)

**NO Gate (Should be Free):**
- `trading.dex`: Don't gate - let Trader mode users explore
- `vault.yield`: Don't gate by amount - let users practice with small amounts
- `maonovault.access`: Don't gate by amount - let users explore
- `investment.pools`: Don't gate - let users learn

**Gate by Mode (New Concept):**
- "Advanced Leverage Trading": Only in Advanced Mode
- "Multi-chain Swaps": Advanced Mode
- "Custom Smart Contract Calls": Advanced Mode

---

## Three Personas Redefined as MODES

### Mode 1: MTAA Community (Okedi) 🎤 #8B5CF6
**Who:** "I want to lead, govern, build community"  
**Dashboard shows:**
- DAOs I've created/joined
- Proposals to vote on
- Community health metrics
- Reputation progress
- Discussion board

**Available features:**
- ✅ Create DAOs
- ✅ Create proposals (after 7 days)
- ✅ Vote on governance
- ✅ Join DAOs
- ✅ View treasury
- ⚠️ Can't see trading/yield features (hidden)

**Unlock path:**
1. Join a DAO (immediate)
2. Vote on a proposal (after 7 days account)
3. Create a proposal (after 7 days)
4. Create your own DAO (immediate, but 5-day cooldown)

---

### Mode 2: MTAA Trader (Yuki) 🛠️ #06B6D4
**Who:** "I want to execute trades, optimize yields, create wealth"  
**Dashboard shows:**
- Trading pairs & charts
- Vault yield opportunities
- Portfolio performance
- Open positions
- Trade history
- Advanced analytics

**Available features:**
- ✅ DEX trading (all amounts)
- ✅ Vault yield (all amounts)
- ✅ Investment pools (view/join)
- ✅ Multi-chain swaps
- ✅ Leverage trading (Advanced Mode)
- ⚠️ DAOs visible but secondary focus
- ⚠️ Governance not emphasized

**Unlock path:**
1. First trade (immediate, any amount)
2. First yield vault deposit (immediate, any amount)
3. Advanced leverage (toggle Advanced Mode)
4. Can still vote in DAOs/governance (but not primary flow)

---

### Mode 3: MTAA Investor (Amara) 💰 #EC4899
**Who:** "I want to grow wealth, explore yield, invest in DAOs"  
**Dashboard shows:**
- Investment portfolio
- DAO investments (if in DAO treasury)
- Yield opportunities ranked by APY
- Wealth accumulation graph
- Dividend/rewards tracking
- Smart alerts ("This pool reached 20% APY")

**Available features:**
- ✅ Vault yield (all amounts)
- ✅ Investment pools (all amounts)
- ✅ DAO treasury access (if member)
- ✅ Governance voting (in DAOs they're in)
- ✅ Maono Vault (all amounts)
- ⚠️ Trading tools (simplified, no leverage)
- ❌ Can't create proposals in their own DAO

**Unlock path:**
1. First yield vault deposit (immediate)
2. First investment pool investment (immediate)
3. Join a DAO as investor (immediate)
4. Vote in DAO governance (if in DAO)

---

## Key Distinction: What Actually Separates These Modes?

### MTAA Community vs Others
- **Focus:** Governance, not wealth
- **Unique:** Can create proposals, create DAOs
- **Trade-off:** Complex DAO management (multiple members, voting)

### MTAA Trader vs Investor
- **Trader:** Active wealth creation (trading, timing markets, leverage)
- **Investor:** Passive wealth creation (set-and-forget yield, DAOs)
- **Key difference:**
  ```
  Trader = "I execute, I take risk, I optimize"
  Investor = "I allocate, I diversify, I wait for returns"
  ```

### DAO Types & Investments
This is critical - let me think through this:

**Option A: DAOs as Governance + Investment Bucket**
```
User creates DAO
  ├── Add members
  ├── Governance: Members vote on proposals
  └── Investment: DAO holds portfolio of:
      ├── Vault yields
      ├── Investment pools
      ├── Other DAOs? (inception)
      └── Treasury assets

Investor mode user joins DAO
  ├── Can invest money → DAO treasury
  ├── Can vote (if DAO allows)
  └── Earns share of DAO returns
```

**Option B: DAO Types (Governance vs Investment)**
```
Type 1: Governance DAO
  • Focus: Decision-making
  • Treasury: Shared community funds
  • Members: Vote on proposals
  • Example: "African Startups Fund"

Type 2: Investment DAO  
  • Focus: Capital allocation
  • Treasury: Investment vehicle
  • Members: Limited voting (or fractional)
  • Example: "DeFi Yield Fund"

Type 3: Protocol DAO
  • Focus: Protocol governance
  • Treasury: Protocol revenue
  • Members: Token holders
  • Example: "MTAA Governance"
```

---

## Dashboard Rendering by Mode

### MTAA Community Mode Dashboard
```
┌─────────────────────────────────────────────┐
│  MTAA Community (Okedi) - Leadership Mode   │
├─────────────────────────────────────────────┤
│                                             │
│  📊 GOVERNANCE OVERVIEW                     │
│  ├─ Active DAOs: 3                         │
│  ├─ Pending Votes: 2 proposals             │
│  └─ Reputation: Level 4                    │
│                                             │
│  🎯 DAOs I Created                         │
│  ├─ [DAO 1] "Kenya Tech Fund"             │
│  │   └─ Members: 12, Treasury: 500K KES   │
│  ├─ [DAO 2] "Community Treasury"          │
│  │   └─ Members: 45, Treasury: 2M KES    │
│  └─ + Create new DAO [Button]             │
│                                             │
│  📜 Recent Proposals                        │
│  ├─ Vote on "Increase yield allocation"   │
│  ├─ Vote on "Add new investment pool"     │
│  └─ Create new proposal [Button]          │
│                                             │
│  👥 Community Activity                      │
│  ├─ New members this week: 3              │
│  ├─ Proposals created: 5                  │
│  └─ Average vote participation: 78%       │
│                                             │
│  💡 Next milestone: Reach Rep Level 5     │
│                                             │
└─────────────────────────────────────────────┘
```

### MTAA Trader Mode Dashboard
```
┌─────────────────────────────────────────────┐
│  MTAA Trader (Yuki) - Trading Mode          │
├─────────────────────────────────────────────┤
│                                             │
│  💹 TRADING OVERVIEW                        │
│  ├─ Portfolio Value: 1,250,000 KES        │
│  ├─ 24h P&L: +12,500 KES (+1.0%)          │
│  └─ Win Rate: 62% (last 30 trades)        │
│                                             │
│  🎯 OPEN POSITIONS                         │
│  ├─ USDT/KES Long: 100K USDT (2.5x)      │
│  ├─ BTC/USDT Long: 0.5 BTC (1x)          │
│  └─ [View All] → Advanced Dashboard       │
│                                             │
│  💰 YIELD VAULTS (Earning)                │
│  ├─ KES Stable: 500K (12% APY) → +6K/mo  │
│  ├─ BTC: 1 BTC (4% APY) → +0.04 BTC/mo   │
│  └─ + Add to vaults [Button]              │
│                                             │
│  📊 MARKET OPPORTUNITIES                    │
│  ├─ AAPL/USDT: 3.2% above support         │
│  ├─ USDC Vault: 15% APY (new pool)        │
│  └─ Multi-chain: ETH → BTC (0.3% fee)    │
│                                             │
│  ⚡ ADVANCED TRADING                        │
│  ├─ Leverage Trading: Enabled [Toggle]    │
│  ├─ Smart Contracts: View templates       │
│  └─ Bot Trading: Coming soon               │
│                                             │
└─────────────────────────────────────────────┘
```

### MTAA Investor Mode Dashboard
```
┌─────────────────────────────────────────────┐
│  MTAA Investor (Amara) - Wealth Mode        │
├─────────────────────────────────────────────┤
│                                             │
│  🎯 WEALTH OVERVIEW                         │
│  ├─ Total Assets: 5,000,000 KES           │
│  ├─ Monthly Passive Income: 125,000 KES   │
│  ├─ Annual Return: 30% (on 5M)            │
│  └─ Net Worth Growth: +15% YTD            │
│                                             │
│  🏆 DAO INVESTMENTS                        │
│  ├─ "Kenya Tech Fund" DAO                 │
│  │   └─ My share: 500K KES (5%) → +3.5K/mo
│  ├─ "Yield Collective" DAO                │
│  │   └─ My share: 750K KES (2%) → +7.5K/mo
│  └─ + Discover more DAOs [Button]        │
│                                             │
│  💵 YIELD OPPORTUNITIES (Ranked by APY)   │
│  ├─ 🥇 USDC Vault: 18% APY                │
│  │   └─ Invested: 1,000K KES             │
│  ├─ 🥈 ETH Vault: 12% APY                │
│  │   └─ Invested: 500K KES               │
│  ├─ 🥉 KES Stable: 10% APY               │
│  │   └─ Invested: 2,000K KES             │
│  └─ + Explore more pools [Button]        │
│                                             │
│  📈 WEALTH ACCUMULATION CHART              │
│  ├─ 3-month projection: 5.3M KES         │
│  ├─ 12-month projection: 6.5M KES        │
│  └─ Goals tracker: On track! 📊          │
│                                             │
│  🔔 ALERTS                                 │
│  ├─ ✅ "USDC pool hit 18% APY"           │
│  ├─ ✅ "ETH yield available"             │
│  └─ ✅ "DAO dividend received"           │
│                                             │
└─────────────────────────────────────────────┘
```

---

## Multi-Persona Model: "Okedi who also trades"

### Current Problem
User selects Okedi (Community), then is blocked from trading

### Solution: Persona Switching
```
User profile: Okedi
  └─ But can switch to "Yuki mode" temporarily
     └─ Dashboard changes to trading view
     └─ All trading features unlocked
     └─ But loses DAO governance focus

Or: User can have sub-profiles?
  ├─ Primary: Okedi (Community)
  ├─ Can switch context to: Yuki (Trading)
  └─ And: Amara (Investing)
```

### Better: Roles vs Personas
```
Actual permissions:
├─ governance.vote: ✅ Everyone
├─ dao.create: ✅ Everyone (7 days old)
├─ proposal.create: ✅ Everyone (7 days old)
├─ trading.dex: ✅ Everyone (no gate)
├─ vault.yield: ✅ Everyone (no gate)
└─ leverage.trading: ⚠️ Advanced Mode only

Persona = Dashboard focus/UX
├─ Community mode: Highlights governance
├─ Trader mode: Highlights trading/yield
└─ Investor mode: Highlights passive yield/DAO investing

So Okedi can:
  ✅ Be in Community mode (sees governance first)
  ✅ Switch to Trader mode (sees trading first)
  ✅ Still can create proposals in Community
  ✅ Still can trade in Trader mode
```

---

## Proposed Changes

### ✅ KEEP (Working Well)
- Time-based gating (`proposal.create`, `dao.create.cooldown`)
- Reputation-based gating (`nft.minting`, `ai.assistant`)
- Manual gating for advanced features (`Advanced Mode` toggle)
- Three persona definitions

### 🔄 CHANGE (The Big Rethink)

**1. Remove Amount-Based Gating**
```
OLD:
  vault.yield: requires 100K KES balance
  maonovault.access: requires 10K KES balance

NEW:
  vault.yield: No gate - anyone can deposit $1
  maonovault.access: No gate - anyone can see/join pools
```

**2. Make Personas Switchable (Not Locked)**
```
OLD:
  User selects → Okedi
  → Locked into Community mode forever

NEW:
  User selects preferred → Okedi
  → Can change anytime in Settings
  → Or have "active mode" they toggle
```

**3. Gate by Behavior, Not Balance**
```
OLD:
  trading.dex: Manual gate (Advanced Mode)
  
NEW:
  basic.trading: Everyone (limit: 10 trades/day)
  advanced.trading: Manual gate
  leverage.trading: Manual gate + Advanced Mode
```

**4. Clarify DAO Types**
```
What's a DAO?
  = A smart contract with members + voting + treasury
  = Can be used for:
    ├─ Governance (vote on decisions)
    ├─ Investment (pool capital + distribute returns)
    ├─ Community (organize members)
    └─ Protocol (run a protocol)

So:
  DAO.create = Anyone (after 7 days)
  DAO.type = User chooses: Governance/Investment/Community
  DAO.invite = Creator decides
```

---

## Summary Table: What Separates Personas?

| Aspect | Community | Trader | Investor |
|--------|-----------|--------|----------|
| **Primary Goal** | Lead & govern | Execute & optimize | Grow & diversify |
| **UI Focus** | DAOs, proposals, voting | Charts, trading, yield | Passive income, DAO returns |
| **Key Action** | Create/vote proposals | Execute trades | Set-and-forget yield |
| **Feature Priority** | governance → DAO → voting → yield | trading → yield → contracts → leverage | yield → DAO → governance → passive |
| **Can Create DAOs?** | ✅ Yes | ✅ Yes | ✅ Yes |
| **Can Trade?** | ✅ Yes (but hidden UI) | ✅ Yes (primary UI) | ✅ Limited/simplified |
| **Can Vote?** | ✅ Yes (primary) | ✅ Yes (secondary) | ✅ Yes (in DAOs) |
| **Can Earn Yield?** | ✅ Yes | ✅ Yes (primary) | ✅ Yes (primary) |
| **Gates on Amount?** | ❌ No | ❌ No | ❌ No |

---

## Next Steps

1. **Clarify DAO types** - Governance vs Investment vs Community
2. **Remove amount-based gating** - Let users start with any amount
3. **Make personas switchable** - User can toggle active mode
4. **Redesign dashboards** - Show persona-specific data
5. **Create unlock paths** - What features unlock and in what order per persona
6. **Update Morio** - Context-aware advice per persona + mode

---

## Questions to Answer

1. **Can Okedi also be Yuki?** → Yes, via mode switching
2. **What if Yuki joins a DAO they lead?** → They get both roles in that DAO
3. **Do DAOs need types?** → Yes (Governance/Investment/Community)
4. **Should DAO returns go to Treasury or Members?** → Depends on DAO type
5. **What makes someone a "Trader" vs "Investor"?** → Activity patterns + mode selection
