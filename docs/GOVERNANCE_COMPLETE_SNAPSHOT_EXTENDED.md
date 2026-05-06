# 🔥 EXTENDED GOVERNANCE FEATURES: DAO DISCOVERY, ACTIONS & INVESTMENT POOLS

## 🌍 DAO DISCOVERY & BROWSING

### DAO Discovery Page (`/daos`)

The platform provides a comprehensive DAO browsing experience with multiple views:

#### **Views Available**

```
1. "Joined" Tab (My DAOs)
   ├─ DAOs user is member of
   ├─ Shows: Member count, treasury, role, recent activity
   ├─ Actions: View, Manage, Leave, Delegate
   └─ Sorting: Recent, Popular, Active

2. "Discover" Tab (Available DAOs)
   ├─ Public DAOs user hasn't joined
   ├─ Shows: Description, members, growth rate, featured status
   ├─ Filters: Type, Duration, Treasury Size, Region, Cause Tags
   ├─ Actions: Preview, Join, View Details
   └─ Sorting: Trending, New, Active, Growth

3. "Featured" Tab (Curated by Platform)
   ├─ Top DAOs selected by platform/community
   ├─ Higher visibility & discoverability
   ├─ isFeatured=true, ordered by featureOrder
   └─ Actions: Join, Learn More

4. "My Invites" Tab (Pending Invitations)
   ├─ Invitations from other members
   ├─ Shows: Inviter, DAO, Role, Expires In
   ├─ Status: pending, accepted, rejected, expired
   └─ Actions: Accept, Decline, View DAO
```

### DAO Information Display

Each DAO card shows:

```typescript
{
  // Identity
  name: "Mama Savings Circle",
  description: "Weekly savings group for community members",
  imageUrl: "/dao-avatars/mama-savings.png",
  bannerUrl: "/dao-banners/mama-savings.jpg",
  
  // Metrics
  memberCount: 47,
  treasuryBalance: 45000,  // KES
  recentActivity: "5 proposals voted, 3 distributions made this month",
  growthRate: 12.5,  // % monthly
  
  // Classification
  daoType: "collective",
  access: "public" | "private",
  primaryCause: "Community savings",
  causeTags: ["savings", "community", "education"],
  
  // Engagement
  isFeatured: true,
  trending: true,
  supportCount: 234,  // Social reactions
  enableSocialReactions: true,
  
  // User-specific
  role: "elder" | "proposer" | "member" | null,
  isJoined: false,
  status: "approved" | "pending" | "banned"
}
```

### Filtering & Search

```typescript
// Available Filters
{
  daoType: ["free", "short_term", "collective", "meta"],
  access: ["public", "private"],
  minMembers: 5,
  maxMembers: 1000,
  minTreasury: 0,
  maxTreasury: 1000000,
  causeTags: ["savings", "education", "healthcare", "agriculture", "business"],
  region: ["East Africa", "West Africa", "Southern Africa", "Diaspora"],
  sortBy: ["trending", "recent", "growth", "active", "popular"],
  searchQuery: "search by name or description"
}
```

---

## 🎬 DAO ACTIONS & MEMBER CAPABILITIES

### DAO Actions Available

Based on **DAO type** and **user role**, different actions are available:

#### **Free DAO - Member Actions**

```
✅ View DAO profile
✅ Vote on proposals
✅ View treasury
✅ See member list
✅ Participate in chat
❌ Create proposals
❌ Withdraw funds
❌ Manage treasury
❌ Edit DAO settings
```

#### **Free DAO - Elder Actions**

```
✅ All Member actions
✅ Create proposals
✅ Vote (with extra weight)
✅ See detailed analytics
❌ Execute proposals (requires admin)
❌ Edit treasury parameters
❌ Manage members
```

#### **Collective DAO - Admin Actions**

```
✅ All Elder actions
✅ Execute proposals
✅ Manage treasury (multi-sig)
✅ Add/remove members
✅ Edit DAO parameters
✅ Configure voting rules
✅ Set up rotation cycles
✅ Manage budget allocations
✅ Configure multi-sig signers
✅ Execute emergency actions
```

#### **Short-term DAO - Creator Actions (Limited Duration)**

```
✅ All Collective actions
✅ Configure extension (max 2x)
✅ View countdown to expiry
✅ Manage rotation cycles
✅ Finalize & wind down DAO
```

#### **Meta DAO - Protocol Admin Actions**

```
✅ Adjust governance parameters across DAOs
✅ Emergency pause functionality
✅ Multi-DAO treasury coordination
✅ Protocol fee management
✅ DAO type transitions
✅ Feature rollout controls
```

### User Action Flow

```
1. JOIN DAO
   ├─ From Discover page
   ├─ Via invite link
   └─ Send join request (if invite_only=true)

2. PARTICIPATE
   ├─ Vote on active proposals
   ├─ Create proposals (if elder+)
   ├─ Delegate voting power
   ├─ Comment on proposals
   └─ React to posts

3. CONTRIBUTE
   ├─ Invest in DAO (if investment pool enabled)
   ├─ Contribute funds to treasury
   ├─ Complete DAO tasks (if tasks exist)
   └─ Earn reputation

4. MANAGE (Admin/Elder only)
   ├─ Create proposals
   ├─ Execute approved proposals
   ├─ Manage members (add/ban)
   ├─ Configure DAO settings
   └─ Monitor treasury

5. LEAVE
   ├─ Withdraw from DAO
   ├─ Withdraw investment (if applicable)
   ├─ Claim accrued rewards
   └─ Remove delegation
```

---

## 💰 INVESTMENT POOLS SYSTEM

### Overview

Investment Pools allow DAOs and users to pool capital for collective investment strategies, with shared governance and profit distribution.

### Investment Pool Database Schema

```typescript
investmentPools {
  id: uuid
  daoId: uuid                    // Optional - can be DAO-specific or platform-wide
  name: varchar                  // "Growth Portfolio", "Stablecoin Fund"
  symbol: varchar                // "GPT", "SCF"
  description: text
  
  // Contract & Financial
  contractAddress: varchar       // Smart contract address
  totalValueLocked: decimal      // TVL in USD
  shareTokenSupply: decimal      // Total shares issued
  sharePrice: decimal            // Current price per share (TVL / shares)
  minimumInvestment: decimal     // Min investment amount
  
  // Fees & Performance
  performanceFee: integer        // Basis points (e.g., 200 = 2%)
  managementFee: integer         // Annual fee %
  
  // Status
  isActive: boolean
  createdBy: varchar             // Pool creator (user ID)
  createdAt: timestamp
}

poolAssets {
  id: uuid
  poolId: uuid
  assetSymbol: varchar           // "CELO", "cUSD", "BTC"
  assetName: varchar
  tokenAddress: varchar
  network: varchar               // "celo", "ethereum", "polygon"
  targetAllocation: integer      // Basis points (e.g., 5000 = 50%)
  currentBalance: decimal
  currentValueUsd: decimal
  lastPriceUsd: decimal
  isActive: boolean
}
```

### Types of Investment Pools

| Pool Type | Purpose | Min Investment | Fee | Target Return | Risk Level |
|-----------|---------|-----------------|-----|----------------|-----------|
| **Growth Portfolio** | Long-term capital appreciation | $100 | 2%/20% | 12-15% APY | Medium |
| **Income Fund** | Stable yield generation | $50 | 1%/15% | 6-8% APY | Low |
| **Stablecoin Vault** | Capital preservation + yield | $10 | 0.5%/10% | 3-4% APY | Very Low |
| **Emerging Markets** | High-growth opportunities | $1000 | 2%/25% | 25-50% APY | High |
| **DAO Treasury Pool** | DAO-specific investment strategy | Varies | Custom | Varies | Varies |

### Investment Operations

```typescript
poolInvestments {
  id: uuid
  poolId: uuid
  userId: varchar
  investmentAmountUsd: decimal      // Amount invested
  sharesMinted: decimal             // Shares received
  sharePriceAtInvestment: decimal   // Price when invested
  paymentToken: varchar             // "cUSD", "MTAA", etc.
  transactionHash: varchar
  status: "pending" | "completed" | "failed"
  investedAt: timestamp
}

poolWithdrawals {
  id: uuid
  poolId: uuid
  userId: varchar
  sharesBurned: decimal             // Shares redeemed
  withdrawalValueUsd: decimal       // USD value at withdrawal
  sharePriceAtWithdrawal: decimal   // Price when withdrawn
  feeCharged: decimal               // Performance fee if applicable
  netAmount: decimal                // Amount after fees
  status: "pending" | "completed" | "failed"
  withdrawnAt: timestamp
}
```

### Investment Example

```
Scenario: "Growth Portfolio" Pool with $100K TVL

Initial State:
├─ Total Value Locked: $100,000
├─ Shares Issued: 10,000
├─ Share Price: $10
└─ Composition: 60% CELO, 30% cUSD, 10% BTC

Alice Invests $1,000:
├─ Shares Minted: 100 (1000 / 10)
├─ Share Record: { userId: alice, shares: 100, price: $10 }
└─ Pool TVL: $101,000

After 1 Year (12% growth):
├─ New TVL: $112,000 (from $101,000)
├─ New Share Price: $11.20
├─ Alice's Holdings: 100 shares × $11.20 = $1,120
├─ Profit: $120
├─ Performance Fee (20% of gains): $24
└─ Alice Keeps: $96 profit

Alice Withdraws 50 Shares:
├─ Withdrawal Value: 50 × $11.20 = $560
├─ Shares Burned: 50
└─ Pool TVL: $110,440
```

### Pool Governance

Larger pools have governance for:

```typescript
poolGovernanceSettings {
  poolId: uuid
  defaultQuorum: decimal           // 30% default
  defaultApprovalThreshold: decimal // 51%
  votingPeriodDays: integer        // 3 days
  minSharesToPropose: decimal      // Min shares to create proposal
  proposalCooldownHours: integer   // Prevent spam
  timelockHours: integer           // Delay before execution
  governanceEnabled: boolean
}

poolProposals {
  id: uuid
  poolId: uuid
  title: varchar
  proposalType: varchar            // "strategy_change", "fee_change", "rebalance", "allocation_change"
  details: jsonb
  totalVotingPower: decimal        // Total shares eligible to vote
  votesFor/Against/Abstain: decimal
  status: "active" | "passed" | "failed" | "executed"
  createdBy: varchar               // User who proposed
  votingEndsAt: timestamp
}
```

### Pool Performance Tracking

```typescript
poolPerformance {
  poolId: uuid
  tvl: decimal                     // Total Value Locked
  sharePrice: decimal              // Current price per share
  totalReturnPercentage: decimal   // Since inception
  volatility: decimal              // Price volatility
  sharpeRatio: decimal             // Risk-adjusted return
  snapshot_at: timestamp           // When metrics recorded
}
```

---

## 🎭 AMARA PERSONA INTEGRATION

### Amara Profile Definition

**Amara** is the **Wealth & Investment Profile** - for users focused on capital growth, investing, and portfolio management.

```typescript
users {
  activeSubprofile: "okedi" | "yuki" | "amara"  // Switch between profiles
}
```

### Amara-Specific Features

| Feature | Description | Visibility |
|---------|-------------|-----------|
| **Investment Pools** | Browse & invest in pooled strategies | Primary |
| **Portfolio Dashboard** | Track investments, returns, allocations | Primary |
| **Yield Strategies** | Allocate capital to yield-bearing vaults | Primary |
| **Asset Allocation** | Diversified portfolio management | Primary |
| **Performance Tracking** | Returns, Sharpe ratio, volatility | Primary |
| **DAO Treasury Pools** | Invest in DAO-specific funds | Secondary |
| **Governance (Pools)** | Vote on pool strategy changes | Secondary |
| **Wealth Analytics** | Net worth, allocation changes, projections | Primary |

### Switching to Amara Profile

```typescript
// User clicks "AMARA" profile button in header
// PersonaContext updates:
{
  activeSubprofile: "amara",
  preferences: {
    riskLevel: "medium",
    investmentStrategy: "growth",
    autoRebalance: true,
    includePoolGovernance: false,
    rebalanceFrequency: "monthly",
    targetAllocation: {
      stocks: 40,
      bonds: 30,
      crypto: 20,
      cash: 10
    }
  }
}

// Dashboard changes to show:
// 1. Investment Pools grid
// 2. Portfolio allocation pie chart
// 3. Recent investments & withdrawals
// 4. Performance metrics (returns, Sharpe ratio)
// 5. Recommended pools (AI-powered)
// 6. Linked DAO treasuries investing
```

### Amara Quick Actions

```
1. Explore Pools
   ├─ Browse all investment pools
   ├─ Filter by risk level & return target
   └─ Compare performance metrics

2. Invest
   ├─ Select pool
   ├─ Choose amount & token
   ├─ Confirm & invest
   └─ Receive shares

3. Withdraw
   ├─ Select pool
   ├─ Choose # of shares
   ├─ Review withdrawal value & fees
   └─ Confirm withdrawal

4. Rebalance
   ├─ View current allocation vs target
   ├─ Auto-rebalance (if enabled)
   ├─ Manual rebalance (drag-and-drop)
   └─ Execute trades

5. Vote on Strategy
   ├─ View pool proposals
   ├─ Vote on fee changes, allocation changes
   └─ Track proposal results
```

### Amara Dashboard Layout

```
┌─────────────────────────────────────────────────┐
│ AMARA - Wealth & Investing                   💰  │
├─────────────────────────────────────────────────┤
│                                                 │
│  Net Worth: $45,230  ↑ 12.3% YTD              │
│  ├─ Investments: $35,000                       │
│  ├─ Vaults: $8,000                             │
│  └─ Cash: $2,230                               │
│                                                 │
├─────────────────────────────────────────────────┤
│                                                 │
│  Portfolio Allocation                          │
│  ┌──────────────────────┐                      │
│  │  [Growth: 40%]       │  Target: [====]      │
│  │  [Income: 30%]       │  Current: [======]   │
│  │  [Crypto: 20%]       │  Drift: 5%           │
│  │  [Cash: 10%]         │  [Rebalance]         │
│  └──────────────────────┘                      │
│                                                 │
├─────────────────────────────────────────────────┤
│  INVESTMENT POOLS                               │
│                                                 │
│  [Growth Portfolio]  [Income Fund]  [More...]  │
│  APY: 12.5%          APY: 6.5%                 │
│  Your Stake: $10K    Your Stake: $8K           │
│  ↑ 3.2% this month   ↑ 1.8% this month        │
│                                                 │
├─────────────────────────────────────────────────┤
│  RECENT ACTIVITY                                │
│                                                 │
│  ✓ Invested $5K in Growth Portfolio             │
│  ✓ Withdrew $2K from Income Fund                │
│  ✓ Voted on strategy rebalance (Growth Pool)    │
│                                                 │
└─────────────────────────────────────────────────┘
```

### Amara Mode Gating

Features unlock at different wealth levels:

```
Balance < 10K KES
├─ View all pools ✅
├─ Invest (min $10 blocks) ✅
└─ Governance votes ❌ (hidden)

Balance 10K-100K KES
├─ All above ✅
├─ Vote on pool governance ✅
└─ Advanced analytics ✅

Balance > 100K KES
├─ All above ✅
├─ Create custom pools ✅
├─ Access private pools ✅
└─ Portfolio advisory ✅
```

---

## 🔗 DAO-TO-AMARA INVESTMENT FLOW

### Use Case: DAO Invests Treasury

```
1. DAO Admin Views Amara
   ├─ Switches profile to "AMARA" (as primary wallet of DAO)
   └─ Can access DAO treasury address

2. DAO Explores Pools
   ├─ Filters by risk level & alignment
   ├─ Reviews pool composition & track record
   └─ Checks governance participation requirements

3. DAO Treasury Invests
   ├─ Creates proposal: "Invest $50K in Growth Portfolio"
   ├─ DAO members vote
   ├─ Upon approval, auto-invest treasury funds
   └─ Receive pool shares (DAO owns them)

4. DAO Earns Returns
   ├─ Pool generates 12% APY
   ├─ DAO's share: ($50K × 12%) / 365 = ~$16.44/day
   ├─ Accrues in DAO treasury
   └─ Proposers can create distribution proposals

5. DAO Can Vote on Pool Changes
   ├─ Pool proposes fee change
   ├─ DAO members vote on behalf of treasury
   ├─ Results aggregated with other investors
   └─ Pool executes if approved
```

### Use Case: Individual Member Profile Switching

```
OKEDI Profile (Personal Wallet)
├─ View personal balance
├─ Send/receive funds
├─ Join DAOs
└─ Participate in voting

SWITCH TO AMARA →

AMARA Profile (Wealth Management)
├─ View investment portfolio
├─ Invest in pools
├─ Track returns
├─ Vote on pool governance
└─ Manage allocations

SWITCH TO YUKI →

YUKI Profile (Trading)
├─ View trading account
├─ Execute trades
├─ Track P&L
├─ View order history
└─ Access market data

[All synced with same wallet/user]
```

---

## 📊 OTHER FEATURES

### 1. **DAO Search & Filtering**

```
Advanced Search:
├─ Full-text search (name, description, tags)
├─ Filter by size, treasury, age, type
├─ Sort by trending, recent, growth
├─ Geographic filters (by region)
└─ Cause-based filters (healthcare, education, etc.)

Popular Searches:
├─ "Savings groups"
├─ "Investment DAOs"
├─ "Community funds"
└─ "Short-term DAOs"
```

### 2. **DAO Social Engagement**

```
Social Reactions:
├─ Like proposals (❤️ count visible)
├─ Comment on proposals (threaded)
├─ React to comments (emojis)
├─ Support DAO (💪 count)
└─ Share DAOs (social media)

Featured DAOs:
├─ Curated by platform
├─ Highlighted on landing page
├─ Higher visibility in search
├─ "Featured" badge on cards
└─ Ordered by engagement
```

### 3. **DAO Onboarding**

```
New Member Experience:
├─ Welcome tutorial (DaoOnboardingTour component)
├─ Explain DAO roles & permissions
├─ Show how to vote
├─ Guide to treasury info
├─ Introduce governance features
└─ Optional: Complete onboarding tasks for rewards

Onboarding Tasks:
├─ Read DAO charter
├─ View treasury breakdown
├─ Cast first vote
├─ Delegate voting power (optional)
└─ Complete all → Earn badge

New DAO Creator:
├─ Select DAO type (free/short-term/collective)
├─ Configure governance parameters
├─ Set treasury security (multi-sig)
├─ Invite first members
└─ Deploy smart contracts
```

### 4. **DAO Analytics (Admin View)**

```
For DAO Admins:
├─ Member activity heatmap
├─ Proposal voting patterns
├─ Treasury flow visualization
├─ Engagement metrics
├─ Growth tracking
├─ Retention rates
├─ Vote participation trends
└─ Regional breakdowns

Export Options:
├─ CSV (members, votes, treasury)
├─ PDF (reports, charts)
├─ JSON (raw data for analysis)
└─ Scheduled reports (email)
```

### 5. **DAO Invitations & Referrals**

```
Invitation Types:
├─ Direct invite (email/phone)
├─ Public invite link
├─ Role-based invite (elder, member)
├─ Referral bonus (both parties earn)
└─ Peer-to-peer referral

Invitation Tracking:
├─ Status: pending, accepted, rejected, expired
├─ Expiry: 30 days default
├─ Sent notifications: email, SMS, push
├─ Accepted: Automatic join + onboarding
└─ Rejected: Can try again later

Referral Rewards:
├─ Member who refers: $20 MTAA bonus
├─ Member who joins: $10 MTAA bonus
├─ Can reach referral tiers (bronze, silver, gold)
└─ Leaderboard showing top referrers
```

### 6. **DAO Causes & Tagging**

```
Predefined Cause Tags:
├─ 💰 Savings (savings circles, emergency funds)
├─ 🎓 Education (scholarships, training)
├─ 🏥 Healthcare (medical costs, wellness)
├─ 🌱 Agriculture (farming support, equipment)
├─ 💼 Small Business (startup funds, capital)
├─ 🚀 Youth Empowerment (mentorship, jobs)
├─ ⚖️ Justice & Bail (legal support, bail funds)
└─ 🎉 Community (events, celebrations)

Custom Primary Cause:
├─ User-defined string (up to 100 chars)
├─ Appears on DAO profile
├─ Searchable
└─ Helps discovery by mission
```

---

## 📱 AMARA SCREENS & FLOWS

### Investment Pool Detail Screen

```
┌─────────────────────────────────────┐
│ Growth Portfolio          [Share]   │
├─────────────────────────────────────┤
│                                     │
│ TVL: $1.2M  | Shares: 100K          │
│ Share Price: $12.00                 │
│ Your Holdings: 833 shares = $9,996  │
│                                     │
│ ┌─────────────────────────────────┐ │
│ │ YTD Return: 12.3% ↑             │ │
│ │ Volatility: 8.2%                │ │
│ │ Sharpe Ratio: 1.5               │ │
│ └─────────────────────────────────┘ │
│                                     │
│ Asset Allocation:                   │
│ ├─ 60% CELO (Target: 60%)          │
│ ├─ 25% cUSD (Target: 25%)          │
│ ├─  8% BTC  (Target: 10%)          │
│ └─  7% ETH  (Target:  5%)          │
│                                     │
│ [Invest More] [Withdraw] [Rebalance]│
│                                     │
│ Performance Chart ↓                 │
│ ┌─────────────────────────────────┐ │
│ │  *                              │ │
│ │    * *                          │ │
│ │      * * *                      │ │
│ │   Uptrend ↑                     │ │
│ └─────────────────────────────────┘ │
│                                     │
│ Your Transactions:                  │
│ ├─ 2 Jun: Invested $5,000 (+100 sh)│
│ ├─ 15 May: Dividend +12 shares     │
│ └─ 8 May: Invested $4,000 (+333 sh)│
│                                     │
│ [Vote on Proposals] [See Governance]│
│                                     │
└─────────────────────────────────────┘
```

### DAO Discovery - Amara View

```
┌─────────────────────────────────────┐
│ Discover DAOs (Invest)          🔍  │
├─────────────────────────────────────┤
│                                     │
│ [Search DAOs...]                    │
│                                     │
│ Filters:  Type ▼ | Region ▼ | More │
│                                     │
│ FEATURED:                           │
│ ┌──────────────┐  ┌──────────────┐ │
│ │ Mama Savings │  │ Youth Fund   │ │
│ │💰 $500K TVL  │  │🚀 $250K TVL  │ │
│ │8% APY        │  │15% APY       │ │
│ │[Invest]      │  │[Invest]      │ │
│ └──────────────┘  └──────────────┘ │
│                                     │
│ TRENDING:                           │
│ [Agricultural Fund] [Education DAO] │
│ [Medical Fund]      [Tech DAO]      │
│                                     │
│ ALL POOLS:                          │
│ ├─ Growth Portfolio   12% APY $1.2M │
│ ├─ Income Fund         6% APY $800K │
│ ├─ Stablecoin Vault    4% APY $2.5M │
│ └─ Emerging Markets   25% APY $100K │
│                                     │
└─────────────────────────────────────┘
```

---

## 🎯 PHASE 1B PRIORITIES FOR DAOs & AMARA

### Quick Wins (Phase 1B)

1. ✅ DAO Discovery page fully functional
2. ✅ Investment pools browsing (no investment yet)
3. ✅ Amara profile switching
4. ✅ Basic pool information display
5. ✅ Featured DAOs on landing page

### Medium Effort (Phase 1B+)

1. 🔄 Investment flow (UI + smart contract calls)
2. 🔄 Withdrawal flow
3. 🔄 Pool performance charts
4. 🔄 Basic pool governance voting
5. 🔄 DAO-to-pool investment (DAO treasury invests)

### Advanced (Phase 1C+)

1. ⚠️ Auto-rebalancing with ML recommendations
2. ⚠️ Advanced portfolio analytics
3. ⚠️ Pool creation UI (create custom pools)
4. ⚠️ Yield farming optimization
5. ⚠️ Cross-chain pool operations

---

**Updated Status**: 85% complete (Governance + Discovery + Investment Foundation)

**Next Steps**: Implement investment UI flows (deposit/withdraw) and Amara dashboard
