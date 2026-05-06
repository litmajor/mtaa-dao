# Architecture Decision: Mode-Based vs Amount-Based Gating

## The Core Issue

**Current Assumption (WRONG):**
```
User selects Okedi (Community) at signup
  ↓
System locks them out of: trading.dex, vault.yield, leverage
  ↓
User is permanently "Community" not "Trader"
  ↓
Amount gates prevent small users: "Need 100K to yield farm"
  ↓
Result: Friction, low engagement, artificial restrictions
```

**Better Model (CORRECT):**
```
User selects Okedi (Community) = UX mode preference
  ↓
Dashboard prioritizes: governance, DAOs, proposals
  ↓
But user can STILL access trading, yield, leverage
  ↓
No amount gates: Start yield with $1 if you want
  ↓
User can switch modes anytime (Community ↔ Trader ↔ Investor)
  ↓
Result: Flexibility, user choice, no artificial blocks
```

---

## Why This Matters

### Problem: The Exclusion Loop
```
User says: "I'm a Community builder"
System says: "Great! You can't trade, yield farm, or leverage"
User says: "Wait, I want to try trading too"
System says: "Sorry, you selected Community"
User: 😤 "This platform doesn't let me do what I want"
```

### Solution: The Empowerment Loop
```
User says: "I'm primarily a Community builder"
System says: "Cool! Your dashboard shows governance first"
User later says: "I want to try some trading"
System says: "Switch to Trader mode anytime (Settings)"
User: ✅ "I can do everything, just organized my way"
```

---

## The Gating Strategy

### What Should Block Features?

**TIER 1: Time/Engagement Gates (Good)**
```
Reason: Prevent spam/abuse
├─ proposal.create: 7 days old (prevent spam proposals)
├─ dao.create.cooldown: 5 days between DAOs (prevent spam DAOs)
└─ nft.minting: Rep 5+ (require engagement history)
```

**TIER 2: Mode Gates (Good)**
```
Reason: Protect from dangerous features
├─ leverage.trading: Advanced Mode toggle + 7 days old
├─ smart.contracts: Advanced Mode + 30 days old
└─ beta.features: Advanced Mode toggle
```

**TIER 3: NO Amount Gates (Remove)**
```
OLD (BAD):
  ├─ vault.yield: 100K KES minimum
  ├─ maonovault.access: 10K KES minimum
  └─ investment.pools: Balance required
  
NEW (GOOD):
  ├─ vault.yield: ANYONE (min 1 KES)
  ├─ maonovault.access: ANYONE (view free, join with any amount)
  └─ investment.pools: ANYONE (min 1 KES)
```

**TIER 4: Role Gates (For DAOs)**
```
Reason: DAO-specific permissions
├─ DAO.createProposal: Only members (set by DAO creator)
├─ DAO.withdraw: Only authorized (set by DAO rules)
├─ DAO.setInvestmentStrategy: Only admins (set by DAO creator)
└─ DAO.voting: Members (can be restricted by DAO)
```

---

## Personas: From Restrictions to Preferences

### The Shift

```
OLD MENTAL MODEL:
├─ Community = "Governance only"
├─ Trader = "Trading/Yield only"
└─ Investor = "Yield/Dividend only"

NEW MENTAL MODEL:
├─ Community = "Governance-focused dashboard"
├─ Trader = "Trading-focused dashboard"
└─ Investor = "Passive income-focused dashboard"
```

### The Key Difference

| Question | Old Model | New Model |
|----------|-----------|-----------|
| Can Community user trade? | No (blocked) | Yes (hidden in UI) |
| Can Trader user vote? | No (blocked) | Yes (secondary option) |
| Can user switch personas? | No (locked) | Yes (anytime) |
| Can user do all 3 roles? | No | Yes (choose active UI) |

---

## Proposed Data Structures

### User Model (New Fields)

```typescript
interface User {
  // ... existing fields
  
  // Persona system
  primaryPersona: 'okedi' | 'yuki' | 'amara' | null;
  activeMode: 'okedi' | 'yuki' | 'amara' | null;  // Can differ from primary
  
  // Gating
  advancedMode: boolean;  // For leverage, smart contracts, beta
  createdAt: Date;  // For time-based gates
  reputation: number;  // For reputation-based gates
  
  // Removed amount-based gates:
  // balance: number;  // Don't gate by this anymore
}
```

### Persona Model (Updated)

```typescript
interface Persona {
  id: 'okedi' | 'yuki' | 'amara';
  name: 'MTAA Community' | 'MTAA Trader' | 'MTAA Investor';
  displayName: 'Okedi' | 'Yuki' | 'Amara';
  icon: string;
  color: string;
  
  // Dashboard configuration
  dashboardLayout: {
    primary: string[];      // Featured widgets
    secondary: string[];    // Available but less featured
    hidden: string[];       // Accessible via menu, not default
  };
  
  // Feature priorities
  focusAreas: string[];
  unlockPriorities: string[];
}
```

### Feature Gate (Simplified)

```typescript
interface FeatureGate {
  feature: string;
  gateType: 'none' | 'age' | 'reputation' | 'mode' | 'role';
  
  // For 'age' gate
  minDaysOld?: number;
  
  // For 'reputation' gate
  minReputation?: number;
  
  // For 'mode' gate
  requiresAdvancedMode?: boolean;
  
  // For 'role' gate (DAO-specific)
  roleRequired?: string;  // 'dao_member' | 'dao_admin' | 'dao_creator'
  
  // NO amount-based gates!
  minBalance?: null;
}
```

---

## Dashboard Data by Mode

### Mode: MTAA Community (Okedi)

**Primary Widgets (Shown First)**
```typescript
const communityDashboard = {
  widgets: [
    {
      type: 'dao-overview',
      title: 'Your DAOs',
      data: {
        created: number,
        joined: number,
        membersTotal: number
      }
    },
    {
      type: 'governance-activity',
      title: 'Recent Votes',
      data: {
        pendingVotes: Proposal[],
        votedRecently: Vote[]
      }
    },
    {
      type: 'proposal-drafts',
      title: 'My Proposals',
      data: {
        drafts: Proposal[],
        published: Proposal[]
      }
    },
    {
      type: 'reputation-progress',
      title: 'Community Score',
      data: {
        currentRep: number,
        nextLevel: number,
        progressPercent: number
      }
    }
  ]
}
```

**Secondary Widgets (Available but not featured)**
```typescript
  trading?: {
    recentTrades: Trade[],
    portfolioValue: number
  },
  yield?: {
    activeVaults: Vault[],
    dailyReturn: number
  }
```

**Hidden Widgets (Accessible via menu)**
```typescript
  advancedTrading?: null,  // Not shown but accessible
  nftMinting?: null        // Not shown but accessible
```

---

### Mode: MTAA Trader (Yuki)

**Primary Widgets**
```typescript
const traderDashboard = {
  widgets: [
    {
      type: 'trading-overview',
      title: 'Trading Stats',
      data: {
        totalTrades: number,
        winRate: number,
        totalPnL: number,
        monthlyReturn: number
      }
    },
    {
      type: 'open-positions',
      title: 'Active Positions',
      data: {
        positions: Position[],
        totalLeverage: number,
        liquidationRisk: number
      }
    },
    {
      type: 'yield-farms',
      title: 'Yielding Assets',
      data: {
        activeVaults: Vault[],
        dailyReturn: number,
        totalApy: number
      }
    },
    {
      type: 'market-alerts',
      title: 'Opportunities',
      data: {
        alerts: MarketAlert[]
      }
    }
  ]
}
```

**Secondary Widgets**
```typescript
  governance?: {
    voterIn: DAO[],
    pendingVotes: Proposal[]
  },
  portfolioHealth?: {
    diversification: number
  }
```

---

### Mode: MTAA Investor (Amara)

**Primary Widgets**
```typescript
const investorDashboard = {
  widgets: [
    {
      type: 'wealth-overview',
      title: 'Total Assets',
      data: {
        totalValue: number,
        monthlyIncome: number,
        annualReturn: number,
        growthPercent: number
      }
    },
    {
      type: 'dao-investments',
      title: 'DAO Portfolio',
      data: {
        daoInvestments: {
          daoId: string,
          myShare: number,
          monthlyReturn: number
        }[]
      }
    },
    {
      type: 'yield-ranking',
      title: 'Top Yield Pools',
      data: {
        pools: {
          name: string,
          apy: number,
          myInvestment: number,
          monthlyReturn: number
        }[]
      }
    },
    {
      type: 'passive-income',
      title: 'Income Streams',
      data: {
        sources: {
          type: 'vault' | 'dao' | 'pool',
          monthlyReturn: number
        }[]
      }
    }
  ]
}
```

**Secondary Widgets**
```typescript
  governance?: {
    daoMemberships: DAO[],
    canVote: Proposal[]
  }
```

---

## Feature Access Matrix (New)

| Feature | Community | Trader | Investor | Gate Type |
|---------|-----------|--------|----------|-----------|
| Create DAO | ✅ Yes | ✅ Yes | ✅ Yes | Age 7+ |
| Create Proposal | ✅ Yes (1st) | ✅ Yes (2nd) | ✅ Yes (3rd) | Age 7+ |
| Vote on Proposal | ✅ Yes | ✅ Yes | ✅ Yes | None |
| DEX Trading | ✅ Yes (UI hidden) | ✅ Yes (UI 1st) | ⚠️ Limited | None |
| Leverage Trading | ⚠️ Advanced Mode | ✅ Yes | ❌ No | Advanced+Age |
| Vault Yield | ✅ Yes (UI hidden) | ✅ Yes (UI 2nd) | ✅ Yes (UI 1st) | None |
| Investment Pools | ✅ Yes (UI hidden) | ✅ Yes (UI 2nd) | ✅ Yes (UI 1st) | None |
| Maono Vault | ✅ Yes (UI hidden) | ✅ Yes (UI 2nd) | ✅ Yes (UI 1st) | None |
| NFT Minting | ✅ Yes | ✅ Yes | ✅ Yes | Rep 5+ |
| Smart Contracts | ⚠️ Advanced | ✅ Yes | ❌ No | Advanced+Age |

**Legend:**
- ✅ Yes = Fully accessible
- ⚠️ Limited = Accessible but with restrictions
- ❌ No = Not accessible for this mode
- UI = Whether prominently shown in dashboard

---

## The Unlock Journey by Mode

### Community (Okedi) Progression
```
Day 0: Join platform
  ✅ Access: DAOs, vote, governance
  ⏳ Can't: Create proposal (need 7 days)
  
Day 1: Learn governance (Morio helps)
  ✅ Can: Vote on DAOs I joined
  💡 Morio: "Want to create a proposal? Come back in 6 days!"
  
Day 7: First proposal
  ✅ Can: Create proposals now
  ✅ Can: Still access trading/yield (if wanted)
  💡 Morio: "You unlocked proposals! Want to learn trading?"
  
Day 30: Rep Level 2
  ✅ Can: NFT minting (Rep 5 needed, so later)
  ✅ Can: Create DAOs (immediate, had this at Day 0)
  
Day 150: Rep Level 5
  ✅ Can: NFT minting unlocked
```

### Trader (Yuki) Progression
```
Day 0: Join platform
  ✅ Access: DEX trading, vaults, markets
  ⏳ Can't: Leverage (need Advanced Mode + 7 days)
  
Day 1: First trade
  ✅ Can: Trade any pair, any size
  💡 Morio: "Interested in passive yield? Check vaults"
  
Day 7: Leverage trading unlocked
  ⏳ Can: Leverage (if Advanced Mode enabled)
  
Day 30: Advanced features
  ✅ Can: Smart contracts, advanced orders
  💡 Morio: "Ready for bot trading? Coming soon"
```

### Investor (Amara) Progression
```
Day 0: Join platform
  ✅ Access: Yield vaults, investment pools
  ⏳ Can't: Create DAO proposals (not in any DAO)
  
Day 1: First yield deposit
  ✅ Can: Start earning passive income
  💡 Morio: "Want to invest in a DAO? Join one here"
  
Day 7: Can create DAOs
  ✅ Can: Start/join investment DAOs
  ✅ Can: Vote in DAO governance (if member)
  
Day 30: Passive income flowing
  ✅ Earning from: Vaults + DAOs + Pools
  💡 Morio: "Your portfolio reached 5M, explore new opportunities"
```

---

## Migration Plan: From Current to New

### Phase 1: Remove Amount Gates (Week 1)
```typescript
// gatingService.ts changes
OLD:
  'vault.yield': { type: 'balance', minAmount: 100_000 }
  'maonovault.access': { type: 'balance', minAmount: 10_000 }

NEW:
  'vault.yield': { type: 'none' }
  'maonovault.access': { type: 'none' }
```

### Phase 2: Make Personas Switchable (Week 2)
```typescript
// User can change activeMode anytime in Settings
// Dashboard re-renders based on activeMode
// All features remain accessible (just UI reorganized)
```

### Phase 3: Add Dashboard Layouts (Week 3)
```typescript
// Each persona gets custom dashboard
// Community: DAO-focused layout
// Trader: Trading-focused layout
// Investor: Wealth-focused layout
```

### Phase 4: Update Morio Context (Week 4)
```typescript
// Morio knows which mode user is in
// Gives persona-specific advice
// "As a Trader, you might be interested in..."
// "As an Investor, this pool has good passive returns..."
```

---

## Summary: The Decision

**You said:** "I want to get it right"

**Here's what's right:**
1. ✅ All users have access to all core features
2. ✅ Personas are UX preferences, not restrictions
3. ✅ Gates prevent spam/abuse, not opportunity
4. ✅ Users can wear multiple hats (switch modes)
5. ✅ Amount doesn't gate access (anyone can start small)
6. ✅ DAOs are investment + governance vehicles
7. ✅ Trader = active wealth, Investor = passive wealth

**What to avoid:**
1. ❌ Locking users into one persona forever
2. ❌ Amount-based gates (creates barriers)
3. ❌ "You chose Community, can't trade" logic
4. ❌ Different features for different personas (same features, different UI)

**The mindset:**
- Not "How do I restrict users?" → "How do I organize their experience?"
- Not "This costs money, so gate it" → "Anyone can start with any amount"
- Not "Community users can't trade" → "Community users see governance first, but can switch to trading mode"
