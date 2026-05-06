# Dashboard Visual Guide - Unified Tree View

## Overview
The new dashboard uses a tree-view hierarchical structure to organize DAOs, balances, and assets in an intuitive, expandable/collapsible interface.

---

## Desktop Layout (1440px+)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          MTAA DAO UNIFIED DASHBOARD                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  🔄 Refresh    ⏸ Pause Updates (30s)    🔌 Connected    ⚙️ Settings       │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  📊 PLATFORM OVERVIEW                                              │   │
│  ├─────────────────────────────────────────────────────────────────────┤   │
│  │                                                                     │   │
│  │  Total TVL: $125.4M  │  Active DAOs: 847  │   24h Volume: $45.2M   │   │
│  │  ↑ 12.5% (24h)      │  New Members: 234  │  ↑ 8.3% (24h)         │   │
│  │                                                                     │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌────────────────────────────────┐  ┌────────────────────────────────┐   │
│  │ 💰 DAO TREE HIERARCHY          │  │ 👤 YOUR BALANCES              │   │
│  ├────────────────────────────────┤  ├────────────────────────────────┤   │
│  │                                │  │                                │   │
│  │ 📁 My DAOs (2)                 │  │ Total Net Worth:              │   │
│  │  ├─ 🏗️ TechDAO                │  │ $245,800                      │   │
│  │  │  ├─ Treasury: $450K         │  │ ↑ 3.2% (30d)                 │   │
│  │  │  ├─ Members: 234            │  │                                │   │
│  │  │  ├─ Proposals: 12 active    │  │ Staking: $145,000            │   │
│  │  │  └─ TVL: $450K              │  │ Pools: $65,000               │   │
│  │  │                              │  │ Vaults: $35,800              │   │
│  │  └─ 💰 FinanceDAO              │  └────────────────────────────────┘   │
│  │     ├─ Treasury: $300K         │                                        │
│  │     ├─ Members: 100            │  ┌────────────────────────────────┐   │
│  │     ├─ Proposals: 5 active     │  │ 📈 ASSET PORTFOLIO             │   │
│  │     └─ TVL: $300K              │  ├────────────────────────────────┤   │
│  │                                │  │                                │   │
│  │ 📁 Discovery (3)               │  │ USDC:      $150,000  (61%)    │   │
│  │  ├─ 🎨 CreativeDAO             │  │ CELO:      $65,000   (26%)    │   │
│  │  ├─ ♻️  GreenFuture             │  │ ETH:       $30,800   (13%)    │   │
│  │  └─ 🌐 WebDAO                  │  │                                │   │
│  │                                │  └────────────────────────────────┘   │
│  └────────────────────────────────┘                                        │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌────────────────────────────────────────────────────────────────────┐   │
│  │ 📊 ASSET DETAILS TABLE                                            │   │
│  ├────────────────────────────────────────────────────────────────────┤   │
│  │                                                                    │   │
│  │ Asset    │ DAO          │ Amount    │ Value      │ 24h Change    │   │
│  ├──────────┼──────────────┼───────────┼────────────┼───────────────┤   │
│  │ USDC     │ TechDAO      │ 100,000   │ $100,000   │ +0.2%         │   │
│  │ CELO     │ FinanceDAO   │ 1,500     │ $65,000    │ +2.1%         │   │
│  │ ETH      │ Personal     │ 0.5       │ $30,800    │ +1.8%         │   │
│  │ stcUSD   │ Savings      │ 50,000    │ $50,000    │ +0.3%         │   │
│  │                                                                    │   │
│  └────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌────────────────────────────────────────────────────────────────────┐   │
│  │ 🔔 REAL-TIME ACTIVITY FEED                                        │   │
│  ├────────────────────────────────────────────────────────────────────┤   │
│  │                                                                    │   │
│  │ 2 mins ago  📈 New Opportunity - DeFi Index Fund (15.2% APY)     │   │
│  │             Est. Returns: $2,400/month                            │   │
│  │                                                                    │   │
│  │ 15 mins ago 💰 Staking Reward - TechDAO                          │   │
│  │             +$125 USDC earned                                     │   │
│  │                                                                    │   │
│  │ 1 hour ago  🗳️  New Proposal - TechDAO Treasury Allocation       │   │
│  │             Vote: Tech Innovation Fund (78% approved)             │   │
│  │                                                                    │   │
│  │ 2 hours ago 📊 Portfolio Update                                  │   │
│  │             Net Worth: +$4,200 (↑ 1.7%)                          │   │
│  │                                                                    │   │
│  └────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Tablet Layout (768px - 1024px)

```
┌────────────────────────────────────────────────────────┐
│  MTAA DAO DASHBOARD                   🔄 ⏸ 🔌 ⚙️    │
├────────────────────────────────────────────────────────┤
│                                                        │
│  ┌──────────────────────────────────────────────────┐ │
│  │  📊 PLATFORM OVERVIEW                           │ │
│  │  TVL: $125.4M ↑12.5%  │  DAOs: 847  │  Vol: $45M  │ │
│  └──────────────────────────────────────────────────┘ │
│                                                        │
│  ┌──────────────────────────────────────────────────┐ │
│  │ 💰 DAO TREE                                      │ │
│  │                                                  │ │
│  │ 📁 My DAOs (2)                                   │ │
│  │  ├─ 🏗️  TechDAO  [Treasury: $450K]              │ │
│  │  └─ 💰 FinanceDAO [Treasury: $300K]             │ │
│  │                                                  │ │
│  │ 📁 Discovery (3)                                 │ │
│  │  ├─ 🎨 CreativeDAO                              │ │
│  │  ├─ ♻️  GreenFuture                              │ │
│  │  └─ 🌐 WebDAO                                    │ │
│  └──────────────────────────────────────────────────┘ │
│                                                        │
│  ┌──────────────────────────────────────────────────┐ │
│  │ 👤 YOUR BALANCES                                │ │
│  │ Net Worth: $245,800  ↑3.2%                      │ │
│  │                                                  │ │
│  │ Staking:  $145,000                              │ │
│  │ Pools:    $65,000                               │ │
│  │ Vaults:   $35,800                               │ │
│  └──────────────────────────────────────────────────┘ │
│                                                        │
│  ┌──────────────────────────────────────────────────┐ │
│  │ 📈 ASSETS                                        │ │
│  │ USDC:  $150K (61%)  ▰▰▰▰▰▰▱▱▱▱                   │ │
│  │ CELO:  $65K  (26%)  ▰▰▰▱▱▱▱▱▱▱                   │ │
│  │ ETH:   $31K  (13%)  ▰▱▱▱▱▱▱▱▱▱                   │ │
│  └──────────────────────────────────────────────────┘ │
│                                                        │
│  ┌──────────────────────────────────────────────────┐ │
│  │ 🔔 RECENT ACTIVITY                              │ │
│  │ • New Opportunity - DeFi Index Fund (+15.2%)   │ │
│  │ • Staking Reward - TechDAO (+$125 USDC)        │ │
│  │ • New Proposal - Treasury Allocation (78%)     │ │
│  └──────────────────────────────────────────────────┘ │
│                                                        │
└────────────────────────────────────────────────────────┘
```

---

## Mobile Layout (320px - 767px)

```
┌──────────────────────────────┐
│ MTAA DAO DASHBOARD           │
│ 🔄 ⏸ 🔌 ⚙️                  │
├──────────────────────────────┤
│                              │
│  📊 PLATFORM OVERVIEW        │
│  ┌────────────────────────┐  │
│  │ TVL: $125.4M ↑12.5%   │  │
│  │ Active DAOs: 847       │  │
│  │ 24h Volume: $45.2M     │  │
│  └────────────────────────┘  │
│                              │
│  💰 DAO TREE                 │
│  ┌────────────────────────┐  │
│  │ 📁 My DAOs             │  │
│  │  🏗️ TechDAO            │  │
│  │    $450K Treasury      │  │
│  │  💰 FinanceDAO         │  │
│  │    $300K Treasury      │  │
│  │                        │  │
│  │ 📁 Discovery           │  │
│  │  🎨 CreativeDAO        │  │
│  │  ♻️ GreenFuture         │  │
│  │  🌐 WebDAO             │  │
│  └────────────────────────┘  │
│                              │
│  👤 YOUR BALANCES            │
│  ┌────────────────────────┐  │
│  │ Net Worth:             │  │
│  │ $245,800 ↑3.2%         │  │
│  │                        │  │
│  │ Staking: $145,000      │  │
│  │ Pools:   $65,000       │  │
│  │ Vaults:  $35,800       │  │
│  └────────────────────────┘  │
│                              │
│  📈 ASSET BREAKDOWN          │
│  ┌────────────────────────┐  │
│  │ USDC $150K (61%)       │  │
│  │ ▰▰▰▰▰▰▱▱▱▱             │  │
│  │                        │  │
│  │ CELO $65K (26%)        │  │
│  │ ▰▰▰▱▱▱▱▱▱▱             │  │
│  │                        │  │
│  │ ETH $31K (13%)         │  │
│  │ ▰▱▱▱▱▱▱▱▱▱             │  │
│  └────────────────────────┘  │
│                              │
│  🔔 ACTIVITY                 │
│  ┌────────────────────────┐  │
│  │ • New Opportunity      │  │
│  │   DeFi Index +15.2%    │  │
│  │                        │  │
│  │ • Staking Reward       │  │
│  │   TechDAO +$125        │  │
│  │                        │  │
│  │ • New Proposal         │  │
│  │   Treasury (78%)       │  │
│  └────────────────────────┘  │
│                              │
└──────────────────────────────┘
```

---

## Tree View Expansion Examples

### Expanded DAO Node
```
🏗️ TechDAO (Expanded)
├─ 📊 Overview
│  ├─ Status: Active
│  ├─ Members: 234 (↑12.5%)
│  ├─ TVL: $450,000 (↑5.2%)
│  └─ Created: 2024-01-15
├─ 💰 Treasury
│  ├─ Balance: $450,000
│  ├─ Assets
│  │  ├─ USDC: $450,000
│  │  └─ CELO: 0
│  └─ Last Updated: 2 mins ago
├─ 🗳️ Governance
│  ├─ Active Proposals: 12
│  ├─ Voting Power: 100
│  └─ Your Votes: 8
├─ 👥 Members
│  ├─ Core Team (5)
│  ├─ Contributors (45)
│  ├─ Supporters (184)
│  └─ Invite New Member
└─ ⚙️ Settings
   ├─ Edit Profile
   ├─ Configure Treasury
   └─ Manage Governance
```

### Collapsed DAO Node
```
🏗️ TechDAO
└─ $450K TVL | 234 Members | 12 Proposals
```

---

## Data Flow & Real-Time Updates

```
┌─────────────────────┐
│  WebSocket Server   │
│  (Real-time Data)   │
└──────────┬──────────┘
           │
    ┌──────┴──────────┐
    │                 │
    ▼                 ▼
┌─────────────┐  ┌──────────────┐
│  Platform   │  │  Activity    │
│  Metrics    │  │  Stream      │
└────┬────────┘  └──────┬───────┘
     │                  │
     ▼                  ▼
┌────────────────────────────────┐
│   Dashboard State Management   │
│  (React Context + Zustand)     │
└────────────────────────────────┘
     │                  │
     ▼                  ▼
┌──────────────┐  ┌──────────────┐
│   Platform   │  │  Activity    │
│  Overview    │  │  Feed        │
└──────────────┘  └──────────────┘
```

---

## Color Scheme

- **Primary**: Deep Slate (Bg: `#0f172a`, Text: `#f1f5f9`)
- **Accent**: Blue (`#3b82f6`)
- **Success**: Green (`#10b981`)
- **Warning**: Amber (`#f59e0b`)
- **Danger**: Red (`#ef4444`)
- **Cards**: Slate-800 (`#1e293b`)
- **Borders**: Slate-700 (`#334155`)

---

## Interactive Elements

### DAO Tree Interactions
- **Click to Expand/Collapse** - Show/hide DAO details
- **Hover for Quick Stats** - Tooltip with treasury, members, proposals
- **Right-Click Context Menu** - View DAO, Edit, Leave, Report
- **Drag & Drop** - Reorder favorite DAOs

### Balance Section Interactions
- **Click Asset** - View detailed breakdown
- **Hover for Charts** - Show 30-day performance
- **Click "Add Funds"** - Open deposit modal
- **Click "Withdraw"** - Open withdrawal modal

### Activity Feed Interactions
- **Swipe Left/Right** - Archive or snooze activity
- **Click Activity** - View full details
- **Filter by Type** - Opportunities, Rewards, Proposals, Updates
- **Search Activities** - Find past events

---

## Loading & Empty States

### Loading State
```
┌──────────────────────────────┐
│ ⟳ Loading Dashboard...       │
│ Fetching platform metrics... │
└──────────────────────────────┘
```

### Empty State (No DAOs)
```
┌──────────────────────────────┐
│ 📁 No DAOs Yet              │
│                              │
│ Create or join a DAO to      │
│ get started                  │
│                              │
│ [Create DAO] [Browse DAOs]  │
└──────────────────────────────┘
```

---

## Performance Metrics

- **Initial Load**: < 1.5s
- **Real-time Updates**: < 100ms
- **Expandable Sections**: Instant
- **Search/Filter**: < 200ms
- **Mobile Performance**: Optimized with virtual scrolling

