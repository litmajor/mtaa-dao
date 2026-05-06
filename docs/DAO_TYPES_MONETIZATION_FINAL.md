# DAO TYPES & MONETIZATION MAPPING

**Status**: Finalized (After Code Audit)  
**Date**: April 24, 2026  
**Source**: create-dao.tsx + DAO_TYPES_CAPABILITIES_COMPLETE.md + Monetization Strategy  

---

## Executive Summary

**5 DAO Types → 5 Distinct Monetization Profiles**

| DAO Type | Tier | Monthly SaaS | Avg Vaults | Vault Revenue | Total Mo. | Annual Est. |
|----------|------|-------------|-----------|---------|----------|----------|
| **Free** | Free | 0 KES | 0.3 | 0 MTAA | 0 KES | 0 |
| **Short-Term** | Growth | 1,000 KES | 1-2 | 500 MTAA | 1,500 KES | 18K KES |
| **Collective** | Pro | 2,500 KES | 3-5 | 1,500 MTAA | 2,500 KES | 30K KES |
| **Governance** | Pro | 5,000 KES | 1-3 | 1,000 MTAA | 5,000 KES | 60K KES |
| **MetaDAO** | Enterprise | 10,000 KES | 2-5 | 2,000 MTAA | 10,000 KES | 120K KES |

**Revenue Math**: At 100 DAOs (proportional mix):
- Free: 15 DAOs × 0 = 0 KES
- Short-Term: 20 DAOs × 1,000 = 20,000 KES
- Collective: 40 DAOs × 2,500 = 100,000 KES
- Governance: 20 DAOs × 5,000 = 100,000 KES
- MetaDAO: 5 DAOs × 10,000 = 50,000 KES
- **Total**: 270,000 KES/month + vault fees

---

## DAO TYPE #1: FREE DAO

### Current Implementation (from create-dao.tsx)

```typescript
{
  id: 'free',
  label: 'Free Community DAO',
  icon: '🆓',
  duration: '30 days (testing)',
  description: 'Test DAO features with basic limits',
  examples: ['Small group', 'Test project'],
  requiresGovernance: false,
  defaultTreasuryType: 'cusd',
  requiredTier: 'free',
  badge: 'FREE'
}
```

### Capabilities (from documentation)

**What It Can Do** ✅:
- Create proposals (General, Poll)
- Simple voting (1 token = 1 vote)
- Basic treasury (view balance only)
- Invite members (up to 50)
- Delegate votes (optional)
- Comment on proposals
- See transaction history

**Limitations** ❌:
- Max 50 members
- No multi-sig security
- No investment pools
- No rotation/distribution
- No budget categories
- 30-day expiration (testing only)

### Monetization Profile

**SaaS Fee**: 0 KES (Free tier, no revenue)

**Soft Monetization Strategy**:
- Require holding 100 MTAA to create proposals (soft gating)
- Free to use but needs MTAA wallet connection
- Creates token awareness + soft demand

**Why Free Tier Exists**:
- Onboarding funnel (free → growth → pro)
- Testing ground (low commitment)
- Community building (grassroots adoption)
- Reduces friction for first-time users

**Vault Usage**: 0-1 vault (optional, mostly not needed)
- DAO too short-lived for vault operations
- If vault needed: Savings vault (200 MTAA)

**Agent Usage**: None (too small, too temporary)

**Total Monthly Revenue Per DAO**: 0 KES (but drives upgrades)

### Use Cases

1. **Community Book Club** (20-30 people, monthly meetups)
2. **Neighborhood informal group** (polling only)
3. **Student projects** (temporary governance)
4. **Proof of concept** (testing idea before upgrade)

### Growth Path

```
Free (30 days)
    ↓
If successful: Upgrade to Short-Term or Collective
If expired: Can create new Free DAO or upgrade tier
```

---

## DAO TYPE #2: SHORT-TERM DAO

### Current Implementation (from create-dao.tsx)

```typescript
{
  id: 'shortTerm',
  label: 'Short-Term Fund',
  icon: '⏱️',
  duration: '3-6 months',
  description: 'Quick rotating funds, burial support, harambee',
  examples: ['Merry-go-round', 'Burial fund', 'Event contribution'],
  requiresGovernance: false,
  defaultTreasuryType: 'cusd',
  requiredTier: 'growth',
  badge: 'GROWTH+'
}
```

### Capabilities (from documentation)

**What It Can Do** ✅:
- Time-limited fundraising (counting down timer)
- Automatic weekly rotation distribution
- Fast-track voting (2 days, not 3)
- Emergency proposals (50% approval, not 60%)
- Extension proposals (max 2x extension → 90 days total)
- Member invitations
- Treasury progress tracking
- Recipient payment history

**Limitations** ❌:
- Max 100 members (per doc, but can be flexible)
- Must have defined rotation cycle
- Cannot operate beyond 90 days (even with extensions)
- No complex budget categories
- No multi-sig (optional, not required)

### Monetization Profile

**SaaS Fee**: 1,000 KES/month

**Why This Price**:
- Lower than Collective (simpler, time-limited)
- Captures event organizers, emergency funds, group savings
- 3-6 month commitment = ~3-6K KES revenue ✓

**Vault Usage**: 1-2 vaults per DAO
- Escrow vault (300 MTAA) for rotating recipient trust
- Savings vault (200 MTAA) if tracking additional funds

**Vault Spawn Cost**: 2 vaults × 300-500 MTAA = 600-1,000 MTAA (~$600-$1,000 at $1)

**Vault Upkeep**: 2 vaults × 30-50 MTAA/month = 60-100 MTAA (~$60-$100/month)

**Agent Usage**: 
- Treasurer agent (50 MTAA/week) = 200 MTAA/month for fund tracking
- Total agents: ~200 MTAA/month

**Total Monthly Revenue Per DAO**: 
- SaaS: 1,000 KES
- Vaults (upkeep): 60-100 MTAA (~$60-$100)
- Agents: 200 MTAA (~$200)
- **Total**: 1,000 KES + 260-300 MTAA (~$1,300-$1,400/month potential)

### Use Cases

1. **Merry-Go-Round (ROSCA)** — 4-10 people, monthly payouts
   ```
   Example: "Mama Pesa Group - March"
   Duration: 30 days
   Cycle: Weekly rotation
   Amount: 25,000 KES × 4 members = 100,000 total
   Each member: Gets 100,000 KES once during cycle
   → Uses Escrow vault for security
   → Uses Treasurer agent for tracking
   ```

2. **Burial Support Fund** — Community emergency response
   ```
   Example: "Kibera Bereavement Fund"
   Duration: 60 days (extendable)
   Goal: Raise 500,000 KES for affected families
   Distribution: Weekly to different families
   → Uses Escrow vault for fund security
   → Can extend if donations exceed goal
   ```

3. **Event Fundraiser** — Specific time-bound campaign
   ```
   Example: "Nairobi Marathon 2026"
   Duration: 30 days fundraising
   Goal: 50,000 KES for prize pool
   Rotation: Weekly payout (not needed) or lump sum
   → Simpler (no rotation needed)
   → Uses Savings vault for funds
   ```

4. **School Supplies Drive** — Parents coordinating
   ```
   Example: "St. Mary's Uniform Fund"
   Duration: 45 days
   Rotation: Monthly distribution to 3 families
   → Each week collects contributions
   → Distributes to needy families in order
   ```

### Growth Path

```
Short-Term (30-90 days)
    ↓
After Success: Upgrade to Collective (recurring)
OR
Restart New Short-Term (annual event)
```

---

## DAO TYPE #3: COLLECTIVE DAO

### Current Implementation (from create-dao.tsx)

```typescript
{
  id: 'collective',
  label: 'Collective / Savings Group',
  icon: '🤝',
  duration: 'Ongoing',
  description: 'Regular savings, investment clubs, cooperatives',
  examples: ['Savings group', 'Table banking', 'Traders coop'],
  requiresGovernance: true,
  defaultTreasuryType: 'cusd',
  requiredTier: 'professional',
  badge: 'PRO+'
}
```

### Capabilities (from documentation)

**What It Can Do** ✅:
- Unlimited members
- Ongoing operation (no expiration)
- Complex treasury management
- Budget categories (Operations, Payouts, Equipment, Marketing, Reserve)
- Multi-sig security (3-of-5 required signers, 48hr timelock)
- Advanced voting (Standard, Quadratic, Weighted)
- Proposal comments with discussion
- Member roles (Member, Proposer, Elder, Admin, Treasurer)
- Automatic recurring distributions (configurable)
- Investment pools (emerging feature)
- DAO-to-DAO coordination (setup)

**Limitations** ❌:
- Requires governance setup (admin burden)
- Multi-sig setup required for security
- Complex treasury management (learning curve)
- Higher gas/operational costs

### Monetization Profile

**SaaS Fee**: 2,500 KES/month

**Why This Price**:
- Most valuable tier (unlimited members, ongoing)
- Established groups (stable, committed)
- Complex features = higher support burden
- Table banking, cooperatives, investment clubs pay this

**Vault Usage**: 3-5 vaults per DAO (HIGH)
- Business vault (500 MTAA) for operational funds
- Investing vault (800 MTAA) for investment pool management
- Escrow vault (300 MTAA) for member loans
- Savings vault (200 MTAA) for reserve
- Custom vault (1,200 MTAA) for complex strategies (optional)

**Vault Spawn Cost**: 
- Base 3 vaults × 400 MTAA avg = 1,200 MTAA
- If premium vaults added: +2,000 MTAA
- **Total**: 1,200-3,200 MTAA

**Vault Upkeep**: 
- 4 vaults × 50 MTAA avg/month = 200 MTAA/month

**Agent Usage** (HIGH):
- Scorekeeper (10 MTAA/day) = 300 MTAA/month (reputation tracking)
- Treasurer (50 MTAA/week) = 200 MTAA/month (fund health checks)
- Strategist (100 MTAA/week) = 400 MTAA/month (investment analysis, if investing)
- **Total**: 900 MTAA/month regular + 200 MTAA occasional

**Premium Features** (Optional upsell):
- Quadratic voting (unlock 2,000 MTAA holding)
- Custom vault templates (100 MTAA each)
- Rebalancing bot (25 MTAA/month)
- Risk alerts (unlock 1,000 MTAA holding)

**Total Monthly Revenue Per DAO**:
- SaaS: 2,500 KES
- Vaults (upkeep): 200 MTAA (~$200)
- Agents (agents): 900 MTAA (~$900)
- Premium features: 100-200 MTAA (~$100-$200) if adopted
- **Total**: 2,500 KES + 1,200-1,300 MTAA (~$3,700-$3,800/month potential)

### Use Cases

1. **Table Banking** — Most common in EA
   ```
   Example: "Nairobi Traders Cooperative"
   Members: 15-30 traders
   Monthly Cycle:
   ├─ Week 1: Members deposit 10,000 KES each
   ├─ Week 2: Collect interest, distribute to 1-2 members
   ├─ Week 3-4: Remaining activities
   ├─ Month: Repeat cycle
   
   Treasury (Monthly):
   ├─ Operational Reserve: 50K
   ├─ Member Payouts: 150K
   ├─ Investment Pool: 100K
   ├─ Emergency Fund: 50K
   └─ Total: 350K KES
   
   Vaults:
   ├─ Business vault: Operations fund
   ├─ Investing vault: Investment pool
   ├─ Escrow vault: Member loans
   └─ Savings vault: Emergency reserve
   
   Revenue:
   ├─ SaaS: 2,500 KES
   ├─ Vault upkeep: 200 MTAA (~$200)
   ├─ Agents (Treasurer + Scorekeeper): 500 MTAA
   └─ Total: $1,200/month to MtaaDAO
   ```

2. **Savings Group (Chama)**
   ```
   Example: "Mama Risers Chama"
   Members: 8 women
   Monthly contribution: 5,000 KES each
   Total: 40,000 KES/month
   
   Distribution: Rotating (each member gets turn)
   Cycle: 8 months (one per member)
   
   Additional: Loans at 10% interest
   
   Uses: Vaults for interest tracking, voting for loan approvals
   ```

3. **Investment Club**
   ```
   Example: "Tech Investors Network"
   Members: 20 tech professionals
   Monthly contribution: 50,000 KES
   Total: 1,000,000 KES/month
   
   Strategy: Co-invest in startups
   Governance: Approve investments quarterly
   
   Treasury: Multi-sig, complex budgets
   Vaults: Investing vaults for different strategies
   Agents: Strategist agent for market analysis
   ```

4. **Cooperative**
   ```
   Example: "Kiambu Coffee Farmers Cooperative"
   Members: 100+ farmers
   Monthly: Collective sales, shared equipment
   
   Budget: Operations, equipment, member purchases, reserves
   Multi-sig: 5 senior members approve withdrawals
   Voting: Weighted by contribution
   
   Complex: Investment in shared mill, vehicle
   Revenue: Very high ($2,500 KES monthly + premium agents)
   ```

### Growth Path

```
Collective (Ongoing)
    ↓
Can expand features:
├─ Add investment pools
├─ Enable DAO-to-DAO coordination
├─ Deploy strategies (Yuki)
└─ Multi-chain expansion
```

---

## DAO TYPE #4: GOVERNANCE DAO

### Current Implementation (from create-dao.tsx)

```typescript
{
  id: 'governance',
  label: 'Governance DAO',
  icon: '🏛️',
  duration: 'Ongoing',
  description: 'Community leadership, major decisions',
  examples: ['Community council', 'District leadership'],
  requiresGovernance: true,
  defaultTreasuryType: 'dual',
  requiredTier: 'professional',
  badge: 'PRO+'
}
```

### Capabilities (from documentation)

**What It Can Do** ✅:
- Unlimited members
- Dual treasury (stable + growth)
- Advanced governance mechanisms
- Quadratic voting (by default)
- Weighted voting (by default)
- Multi-proposal types (General, Constitutional, Emergency)
- Full multi-sig security
- DAO coordination protocol
- Complex proposal discussion
- Vetted elder councils
- Constitutional amendments

**Special Feature**: Quadratic voting built-in
- Voting power = sqrt(tokens)
- Prevents whale capture
- More egalitarian than standard

**Limitations** ❌:
- Region/community dependent
- Requires active elder council
- Higher expectations = higher support burden
- Constitutional changes hard to make

### Monetization Profile

**SaaS Fee**: 5,000 KES/month

**Why This Price**:
- Governance DAOs = institutional tier
- Large communities (100-1,000 members)
- High support needs
- Community impact = premium price justified
- Similar to "Pro" tier for SaaS platforms

**Vault Usage**: 2-4 vaults per DAO (MEDIUM)
- Business vault (500 MTAA) for operational funds
- Escrow vault (300 MTAA) for contested decisions
- Custom vault (1,200 MTAA) for complex governance (optional)

**Vault Spawn Cost**: 2-3 vaults × 400 MTAA avg = 1,000-1,500 MTAA

**Vault Upkeep**: 3 vaults × 50 MTAA avg = 150 MTAA/month

**Agent Usage** (HIGHEST):
- Scorekeeper (10 MTAA/day) = 300 MTAA/month (reputation for governance)
- Treasurer (50 MTAA/week) = 200 MTAA/month (fund oversight)
- Elder Council (200 MTAA/month) = 200 MTAA/month (governance health checks)
- Defender (500 MTAA on-demand) = ~100 MTAA/month average
- **Total**: 800 MTAA/month minimum

**Premium Features**:
- Constitutional framework (unlock)
- Quadratic voting (included)
- Weighted voting (included)
- Elder council tooling (unlock 5,000 MTAA)

**Total Monthly Revenue Per DAO**:
- SaaS: 5,000 KES
- Vaults (upkeep): 150 MTAA (~$150)
- Agents: 800 MTAA (~$800)
- Premium features: 100-200 MTAA if adopted
- **Total**: 5,000 KES + 1,050-1,150 MTAA (~$6,050-$6,150/month potential)

### Use Cases

1. **Community Council**
   ```
   Example: "Nairobi Ward Council"
   Scope: 100,000 residents (represented by 50 members)
   
   Decisions:
   ├─ Budget allocation (education, health, roads)
   ├─ Conflict resolution
   ├─ Community development projects
   ├─ Emergency response
   └─ Leadership term limits
   
   Treasury (Dual): Stable for operations, Growth for initiatives
   Governance: Quadratic voting (prevent chief's dominance)
   
   Agents:
   ├─ Scorekeeper: Track elder reputation
   ├─ Treasurer: Monthly fund health
   ├─ Elder Council agent: Governance health checks
   └─ Defender: Audit security
   
   Revenue: $5,000/month SaaS + agents + vaults
   ```

2. **District Development Association**
   ```
   Example: "Makueni District Leadership"
   Members: 30 ward representatives + chief
   
   Responsibilities:
   ├─ District-wide planning
   ├─ Inter-ward coordination
   ├─ County partnership
   └─ Development project oversight
   
   Complex governance:
   ├─ Constitutional rules (weighted voting for chiefs)
   ├─ Proposal types (routine, major, emergency)
   ├─ Amendment process (requires 80% approval)
   └─ Term limits enforcement
   
   Multi-sig: 5 members (chief + 4 elected)
   DAO assets: 2,000,000 KES
   
   High revenue potential + transformative impact
   ```

3. **Religious Institution**
   ```
   Example: "Nairobi Cathedral Leadership"
   Members: 50 clergy + elected laypeople
   
   Governance:
   ├─ Budget (operations, charity, infrastructure)
   ├─ Community programs
   ├─ Clergy assignments
   ├─ Dispute resolution
   └─ Annual planning
   
   Unique: Transparency in religious institution (novel)
   Impact: Trust, accountability, member engagement
   
   Agents: Elder Council agent tracks "elder wisdom reputation"
   ```

### Growth Path

```
Governance DAO (Ongoing)
    ↓
Can expand:
├─ Cross-DAO coordination (MetaDAO features)
├─ Regional networks (emerge)
├─ Constitutional evolution (complex governance)
└─ Sub-DAOs (wards create their own governance DAOs)
```

---

## DAO TYPE #5: METADAO (Network)

### Current Implementation (from create-dao.tsx)

```typescript
{
  id: 'meta',
  label: 'MetaDAO Network',
  icon: '🌐',
  duration: 'Continuous',
  description: 'Multi-DAO coordination and regional networks',
  examples: ['Regional alliance', 'DAO federation'],
  requiresGovernance: true,
  defaultTreasuryType: 'dual',
  requiredTier: 'enterprise',
  badge: 'ENTERPRISE'
}
```

### Capabilities (from documentation - Inferred)

**What It Can Do** ✅:
- Coordinate multiple sub-DAOs
- Cross-DAO voting (DAOs vote as units)
- Federated treasury management
- Regional network protocols
- Inter-DAO communication
- Shared resource pools
- Collective bargaining power
- Network governance
- Sub-DAO oversight

**Special**: Not created by regular users (admin-only likely)

**Limitations** ❌:
- Regional scope currently (not cross-chain)
- Complex governance (high barrier)
- Limited to admin creation
- Enterprise-only access

### Monetization Profile

**SaaS Fee**: 10,000 KES/month

**Why This Price**:
- Enterprise tier
- Network operator role (high value)
- Complex coordination = high support
- Creates ecosystem value

**Vault Usage**: 3-5 vaults per network
- Business vault (500 MTAA) for coordination
- Investing vault (800 MTAA) for shared investments
- Custom vaults (1,200 MTAA each) for regional strategies

**Vault Spawn Cost**: 3-4 vaults × 650 MTAA avg = 2,000-2,600 MTAA

**Vault Upkeep**: 4 vaults × 60 MTAA avg = 240 MTAA/month

**Agent Usage** (HIGHEST):
- Scorekeeper (300 MTAA/month) - Cross-DAO reputation
- Treasurer (200 MTAA/month) - Network fund oversight
- Elder Council (200 MTAA/month) - Meta-governance checks
- Defender (500 MTAA on-demand) - Network security audits
- Strategist (200 MTAA/month) - Inter-DAO strategy
- **Total**: 1,400 MTAA/month

**Premium Features** (All included at this tier):
- Cross-DAO voting
- Federated treasury
- Network governance
- Sub-DAO oversight
- API access for integration

**Total Monthly Revenue Per MetaDAO**:
- SaaS: 10,000 KES
- Vaults (upkeep): 240 MTAA (~$240)
- Agents: 1,400 MTAA (~$1,400)
- Premium features: Included
- **Total**: 10,000 KES + 1,640 MTAA (~$11,640/month potential)

### Use Cases

1. **Regional Network**
   ```
   Example: "Nairobi Region DAO Network"
   Sub-DAOs: 10 ward councils + 5 community organizations
   
   Coordination:
   ├─ Regional development strategy
   ├─ Resource sharing (equipment, funds)
   ├─ Conflict resolution between wards
   ├─ County-level advocacy
   └─ Cross-community initiatives
   
   Governance:
   ├─ Each sub-DAO = 1 vote (regardless of size)
   ├─ Quorum: 8/15 sub-DAOs
   ├─ Major decisions: 80% approval
   └─ Constitutional amendments: 70% + referendum
   
   Treasury (Dual):
   ├─ Stable: Day-to-day operations (500K)
   ├─ Growth: Regional projects (1M)
   └─ Total: 1.5M KES
   
   Revenue to MtaaDAO: $11,640/month + referrals
   ```

2. **DAO Federation Alliance**
   ```
   Example: "East Africa DAO Alliance"
   Members: 50+ cooperatives from Kenya, Uganda, Tanzania
   
   Scope:
   ├─ Cross-border trade facilitation
   ├─ Regional market coordination
   ├─ Collective bulk purchasing
   ├─ Training network
   └─ Emergency mutual aid
   
   Governance: Democratic, with large/small DAO equity
   Agents: High-value (security audits, strategic analysis)
   
   Impact: Transforms regional commerce
   Revenue: Highest tier + network effects
   ```

### Growth Path

```
MetaDAO (Continuous network operation)
    ↓
Can expand:
├─ Add more regions (new MetaDAOs)
├─ Cross-regional coordination (meta-meta-DAO?)
├─ Institutional partnerships
└─ Become backbone of East African economy
```

---

## MONETIZATION SUMMARY BY DAO TYPE

### Revenue Per DAO Type (Monthly)

```
DAO Type       | SaaS Fee  | Vault Upkeep | Agents    | Premium | Total
               |           |              |           |         |
Free           | 0 KES     | 0 MTAA       | 0 MTAA    | 0 MTAA  | ~$0
Short-Term     | 1,000 KES | 80 MTAA      | 200 MTAA  | 20 MTAA | ~$300
Collective     | 2,500 KES | 200 MTAA     | 900 MTAA  | 100 MTAA| ~$1,200
Governance     | 5,000 KES | 150 MTAA     | 800 MTAA  | 150 MTAA| ~$1,100
MetaDAO        | 10,000 KES| 240 MTAA     |1,400 MTAA | 200 MTAA| ~$1,840
```

### Revenue Distribution (By Type)

**Assuming 100 DAOs with realistic mix**:

```
Distribution:
├─ Free: 15 DAOs (onboarding funnel)
├─ Short-Term: 25 DAOs (event/emergency)
├─ Collective: 40 DAOs (core offering, table banking)
├─ Governance: 15 DAOs (district/institution)
└─ MetaDAO: 5 DAOs (enterprise/network)

Monthly Revenue:
├─ Free:        0 DAOs × $0        = $0
├─ Short-Term:  25 DAOs × $300     = $7,500
├─ Collective:  40 DAOs × $1,200   = $48,000
├─ Governance:  15 DAOs × $1,100   = $16,500
└─ MetaDAO:     5 DAOs × $1,840    = $9,200
                                      
Subtotal SaaS:                        ~$81,200
+ Referral bonuses:                   ~$5,000
+ Trading fees (if MTAA):             ~$3,000
                                      
TOTAL:                                ~$89,200/month
                                      
Annual:                               ~$1,070,400
```

### Vault Usage by DAO Type

```
DAO Type       | Avg Vaults | Spawn Cost | Monthly Upkeep | Annual Revenue
               | Per DAO    | Per DAO    | Per DAO        | (All vaults)
               |            |            |                |
Free           | 0.3        | 60 MTAA    | 0 MTAA         | ~$220
Short-Term     | 1.5        | 600 MTAA   | 75 MTAA        | ~$2,250
Collective     | 4          | 1,600 MTAA | 200 MTAA       | ~$7,200
Governance     | 3          | 1,200 MTAA | 150 MTAA       | ~$4,500
MetaDAO        | 4          | 2,000 MTAA | 240 MTAA       | ~$7,200
```

### Example: Full Lifecycle (One DAO)

**"Mama Traders Cooperative"** (Collective DAO)

```
Week 1-2: Creation
├─ Pay 2,500 KES one-time (SaaS setup)
├─ Spawn 4 vaults:
│  ├─ Business: 500 MTAA (operations)
│  ├─ Investing: 800 MTAA (investment pool)
│  ├─ Escrow: 300 MTAA (loans)
│  └─ Savings: 200 MTAA (reserve)
├─ Total spawn: 1,800 MTAA (~$1,800)
└─ Multisig setup with 5 elders

Week 3+: Monthly Operations
├─ Recurring SaaS: 2,500 KES
├─ Vault upkeep: 150 MTAA (~$150)
├─ Agents:
│  ├─ Scorekeeper: 10 MTAA/day × 30 = 300 MTAA
│  ├─ Treasurer: 50 MTAA/week × 4 = 200 MTAA
│  └─ Strategist (optional): 100 MTAA/week × 4 = 400 MTAA (if investing)
├─ Total agents: 500-900 MTAA (~$500-$900)
├─ Premium features (optional): 50-100 MTAA
└─ Total monthly: 2,500 KES + 700-1,150 MTAA (~$3,200-$3,650)

Month 6:
├─ DAO is established, members trust system
├─ Trading volume increases (uses vaults for yield)
├─ Premium features adopted (analytics)
├─ More agents: Elder Council (reputation)
└─ Total monthly: 2,500 KES + 1,200+ MTAA (~$4,200+)

Year 1 Total (Mama Traders):
├─ SaaS: 2,500 KES × 12 = 30,000 KES
├─ Vault upkeep: 150 MTAA × 12 = 1,800 MTAA
├─ Agents (base): 600 MTAA × 12 = 7,200 MTAA
├─ Premium features: 500 MTAA
├─ Spawn (one-time): 1,800 MTAA
└─ Total Year 1: 30,000 KES + 11,800 MTAA (~$16,800)
```

---

## MISSING PIECES: WHAT TO BUILD

### 1. ❌ CHAMA VAULT
**Priority**: HIGH (Core EA use case)

Should have 6th vault type + 6th DAO type:

```typescript
// Add to daoTypeOptions in create-dao.tsx
{
  id: 'chama',
  label: 'Chama (Traditional Savings)',
  icon: '👭',
  duration: 'Ongoing',
  description: 'ROSCA (rotating savings), 5-15 members, women-led',
  examples: ['Women savings group', 'Burial contribution'],
  requiresGovernance: false,
  defaultTreasuryType: 'cusd',
  requiredTier: 'growth',
  badge: 'GROWTH+'
}

// Chama Vault: Specialized escrow for ROSCA
// Spawn: 250 MTAA (cheaper than business)
// Upkeep: 25 MTAA/month
// Features:
// ├─ Automatic rotation scheduling
// ├─ Contribution tracking
// ├─ Fair distribution guarantee
// ├─ M-Pesa integration ready
// └─ Dispute resolution
```

### 2. ❌ REFERRAL SYSTEM
**Priority**: HIGH (Organic growth engine)

```
DAO A refers DAO B
→ DAO A treasury gets 10% of DAO B's spawn fees for 6 months
→ DAO B gets 5% discount on first 6 months
→ Creates network effects + organic growth

Example:
DAO B spawn cost: 1,200 MTAA
├─ Referred: Gets 1,140 MTAA cost (5% discount)
└─ DAO A treasury: +60 MTAA/month × 6 = 360 MTAA

At scale: 50 referrals × 360 MTAA = 18,000 MTAA/year to top referrers
```

### 3. ❌ M-PESA ON-RAMP
**Priority**: CRITICAL (KES ↔ MTAA bridge)

```
User can:
1. "Add KES funds" → Triggers M-Pesa prompt
2. Sends via USSD to shortcode
3. Instant conversion to MTAA
4. 1% fee (0.5% burn, 0.5% treasury)

Example: Send 10,000 KES via M-Pesa
├─ Fee: 100 KES
├─ Net: 9,900 KES worth of MTAA
├─ If 1 MTAA = 10 KES: Gets ~990 MTAA
└─ Burned: 50 MTAA (magic sink)
```

### 4. ❌ MULTI-CHAIN EXPANSION
**Priority**: MEDIUM (Quarter 2+)

```
Launch on:
├─ Celo (existing MTAA, cheapest gas)
├─ Base (growing user base, fast)
├─ Ethereum L2 (institutional)
└─ Polygon (already planned)

Each chain: Separate but linked monetization
```

---

## PHASE 0 DECISIONS NEEDED (Before Phase 1)

1. **Chama DAO + Vault**: Approve? (Recommended YES)
2. **Referral system**: Build in Phase 1 or Phase 2? (Recommended Phase 1)
3. **M-Pesa integration**: Partner now or after testnet? (Recommended now)
4. **Chain priority**: Polygon first? (Recommended YES)
5. **Free tier monetization**: Soft MTAA requirement (100 MTAA to create proposals)?

---

## Summary

**Your DAO system is solid.** 5 types cover most Earth Alliance use cases:
- Free = onboarding
- Short-Term = events/emergencies
- Collective = core (table banking)
- Governance = institutional
- MetaDAO = network effects

**Monetization strategy per DAO type is clear**: SaaS + Vaults + Agents = stacked revenue

**Next priority**: Implement Chama DAO + referral system before Phase 1 ships

