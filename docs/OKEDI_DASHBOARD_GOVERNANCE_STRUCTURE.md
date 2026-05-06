# 🎯 OKEDI DASHBOARD: GOVERNANCE STRUCTURE

**Date**: February 2, 2026  
**Purpose**: Show current governance/DAO sections and integration points for new components

---

## 📱 CURRENT OKEDI DASHBOARD LAYOUT

```
┌─────────────────────────────────────────────────────────────┐
│ OKEDI DASHBOARD (Desktop/Mobile Responsive)                 │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│ 1️⃣ BALANCE HEADER (Full Width)                              │
│    ├─ 💳 Personal Balance: 1,234.56 cUSD / $1,500 USD       │
│    ├─ Trust Score: 85 (Excellent)                           │
│    ├─ Governance Score: 320 points                          │
│    └─ Member Stats: Votes: 12 | DAOs: 3 | Since: Jan 2024   │
│                                                              │
│ 2️⃣ KYC BANNER (Full Width)                                  │
│    ├─ Status: ✅ KYC Verified                               │
│    ├─ Daily Limit: $5,000 | Monthly: $50,000                │
│    └─ [Complete KYC] button                                 │
│                                                              │
│ 3️⃣ QUICK ACTIONS (Horizontal Scrollable on Mobile)          │
│    ├─ Send Money                                            │
│    ├─ Request Money                                         │
│    ├─ Receive                                               │
│    ├─ Pay Link                                              │
│    ├─ Batch Transfer                                        │
│    ├─ Vote 🔗 → /governance                                 │
│    └─ ... More actions                                      │
│                                                              │
│ 4️⃣ ANALYTICS PANEL (Right Side)                             │
│    ├─ Total Volume: $5,432.10                               │
│    ├─ Avg Tx: $182.40                                       │
│    ├─ Growth (7d): +23.4%                                   │
│    └─ Activity Sparkline Chart                              │
│                                                              │
│ 5️⃣ MY DAOs + GOVERNANCE STATS (3-Column Grid)               │
│    ├─ LEFT (2 cols): My DAOs Section                        │
│    │  ├─ 🔍 [Discover DAOs] button                          │
│    │  ├─ ➕ [Create DAO] button                             │
│    │  ├─ DAO Card 1: Mama Savings                           │
│    │  │  ├─ Name & members: 12/50                           │
│    │  │  ├─ Treasury: $2,345                                │
│    │  │  ├─ Your Role: Member                               │
│    │  │  └─ [Vote] [Send] [Manage]                          │
│    │  ├─ DAO Card 2: Coffee Coop                            │
│    │  └─ DAO Card 3: Health Center                          │
│    │  └─ [View All DAOs (8)] → /daos                        │
│    │                                                        │
│    └─ RIGHT (1 col): Governance Stats                       │
│       ├─ Total Votes Cast: 42                               │
│       ├─ Governance Power: 8.3%                             │
│       ├─ DAO Member In: 3                                   │
│       ├─ Influence Rank: #47 of 1,234 users                 │
│       │                                                     │
│       └─ 🗳️ Recent Votes (Last 3):                          │
│          ├─ "Increase treasury funding" (Active)            │
│          ├─ "Change voting threshold" (Passed)              │
│          └─ "New budget category" (Voting)                  │
│                                                              │
│ 6️⃣ ACTIVE PROPOSALS (Full Width)                            │
│    ├─ 🗳️ Active Proposals (5)                               │
│    │                                                        │
│    ├─ Proposal Card 1: "Increase quarterly spending"        │
│    │  ├─ DAO: Mama Savings                                 │
│    │  ├─ Type: Budget                                       │
│    │  ├─ Status: ✅ Active                                  │
│    │  ├─ Progress: 65/100 votes needed                      │
│    │  ├─ Time Left: 3 days                                  │
│    │  ├─ Your Vote: ✅ For                                  │
│    │  └─ [Vote Now] [Details]                              │
│    │                                                        │
│    ├─ Proposal Card 2: "Add new member"                    │
│    │  └─ ... Similar structure                              │
│    │                                                        │
│    └─ [View All Proposals (12)] → /governance               │
│                                                              │
│ 7️⃣ ACTIVE ESCROWS (Left Column of 2)                        │
│    ├─ 🔒 Active Escrows (2)                                 │
│    │                                                        │
│    ├─ Escrow Card 1: $500 cUSD                             │
│    │  ├─ Description: "Payment for solar installation"      │
│    │  ├─ With: Jane Korir                                   │
│    │  ├─ Status: ✅ active                                  │
│    │  ├─ Days Left: 7                                       │
│    │  └─ [Details] [Complete] [Dispute]                    │
│    │                                                        │
│    └─ [View All Escrows (5)] → /escrows                     │
│                                                              │
│ 8️⃣ RECENT TRANSACTIONS (Right Column of 2)                 │
│    ├─ 💸 Transaction History                                │
│    └─ ... (Similar cards with amounts, dates, status)       │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## 🔗 CURRENT GOVERNANCE INTEGRATION POINTS

### 1. **Quick Actions Section** (Line ~866)
```typescript
{
  id: 'vote',
  label: 'Vote',
  icon: <CheckCircle className="h-5 w-5" />,
  onClick: () => {
    trackQuickActionClick('vote', 'Vote');
    window.location.href = '/governance';  // ← Links to /governance page
  },
  color: 'bg-amber-600',
  description: 'Vote now'
}
```

**Current State**: Quick "Vote" action links to `/governance` page  
**New Opportunity**: Add "Create Proposal" action here

---

### 2. **My DAOs Section** (Line ~1044-1083)
```typescript
// Shows: 4 preview DAOs max
// Has buttons: "Discover DAOs", "Create DAO"
// Shows DAO Cards with:
//   - DAO name & member count
//   - Treasury balance
//   - User's role (Member/Elder/Admin)
//   - Action buttons: [Vote], [Send], [Manage]

<div className="lg:col-span-2">
  <div className="bg-slate-800 rounded-xl p-4 md:p-6 border border-slate-700">
    <h3 className="text-lg font-bold text-white flex items-center gap-2">
      <Users className="h-5 w-5 text-purple-400" />
      📌 My DAOs
    </h3>
    
    {/* Discover & Create buttons */}
    <Link to="/daos/discover">
      <Button size="sm" variant="ghost">🔍 Discover</Button>
    </Link>
    <Link to="/daos/create">
      <Button size="sm" variant="ghost">➕ Create</Button>
    </Link>
    
    {/* Show 4 DAO cards */}
    {data?.myDAOs?.slice(0, PREVIEW_LIMITS.DAOS).map((dao: DAOInfo) => (
      <DAOCard dao={dao} onVote={handleVote} onSend={handleSend} onManage={handleManage} />
    ))}
    
    {/* Link to view all */}
    {data?.myDAOs?.length > PREVIEW_LIMITS.DAOS && (
      <Link to="/daos">View All DAOs ({data.myDAOs.length}) →</Link>
    )}
  </div>
</div>
```

**Current State**: Shows DAOs user is member of, with basic role display  
**New Opportunity**: 
- Show user's activity points here
- Add role progress indicator per DAO
- Add "Create Proposal" button in each DAO card

---

### 3. **Governance Stats Section** (Line ~1090-1130)
```typescript
// Shows:
//   - Total Votes Cast: 42
//   - Governance Power: 8.3%
//   - DAO Member In: 3
//   - Influence Rank: #47 of 1,234 users
//   - Recent Votes (last 3 proposals)

<div className="bg-slate-800 rounded-xl p-4 md:p-6 border border-slate-700">
  <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
    📊 Governance Stats
  </h3>
  <div className="space-y-3">
    <div className="bg-slate-700 rounded-lg p-3">
      <p className="text-sm text-slate-300">Total Votes Cast</p>
      <p className="text-2xl font-bold text-white">{data?.governanceStats?.votesCast || 0}</p>
    </div>
    
    <div className="bg-slate-700 rounded-lg p-3">
      <p className="text-sm text-slate-300">Governance Power</p>
      <p className="text-2xl font-bold text-white">{data?.governanceStats?.governancePower || 0}%</p>
    </div>
    
    {/* Recent votes preview */}
    {data?.activeProposals?.length > 0 && (
      <div className="mt-4 border-t border-slate-600 pt-4">
        <h4 className="text-sm font-bold text-white mb-2">🗳️ Recent Votes</h4>
        {data.activeProposals.slice(0, PREVIEW_LIMITS.RECENT_VOTES).map((proposal: any) => (
          <div key={proposal.id} className="bg-slate-700 rounded p-2">
            <p className="text-xs text-white font-medium line-clamp-1">{proposal.title}</p>
            <p className="text-xs text-slate-400">
              ✅ Active • {proposal.currentVotes}/{proposal.votesRequired}
            </p>
          </div>
        ))}
      </div>
    )}
  </div>
</div>
```

**Current State**: Shows high-level governance stats  
**New Opportunity**: 
- Add "Your Activity Score" card here
- Add role progression bar per DAO
- Add "Request Promotion" button if eligible
- Show promotion history

---

### 4. **Active Proposals Section** (Line ~1135-1160)
```typescript
// Shows: 3 preview proposals max
// Each proposal shows:
//   - Title & DAO name
//   - Type, status, progress
//   - Your vote status
//   - Action buttons

{data?.activeProposals && data.activeProposals.length > 0 && (
  <div className="bg-slate-800 rounded-xl p-4 md:p-6 border border-slate-700">
    <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
      🗳️ Active Proposals ({data.activeProposals.length})
    </h3>
    
    {data.activeProposals.slice(0, PREVIEW_LIMITS.PROPOSALS).map((proposal: ProposalInfo) => (
      <ProposalCard proposal={proposal} />
    ))}
    
    {data.activeProposals.length > PREVIEW_LIMITS.PROPOSALS && (
      <Link to="/governance">View All Proposals ({data.activeProposals.length}) →</Link>
    )}
  </div>
)}
```

**Current State**: Shows proposals user can vote on  
**New Opportunity**: 
- Add "Create Proposal" quick action per DAO
- Link to full governance page for proposals by DAO type
- Show proposal type filters

---

## ✨ WHERE TO ADD NEW GOVERNANCE COMPONENTS

### **Integration Point 1: Quick Actions Enhancement** ⭐ BEST
Add "Activity & Roles" or "Create Proposal" action

```typescript
// In QuickActions array (around line 860):

{
  id: 'activity-roles',
  label: 'My Activity',
  icon: <Trophy className="h-5 w-5" />,
  onClick: () => setShowRoleProgressModal(true),
  color: 'bg-blue-600',
  description: 'View points'
},

{
  id: 'create-proposal',
  label: 'Create Proposal',
  icon: <Plus className="h-5 w-5" />,
  onClick: () => setShowCreateProposalModal(true),
  color: 'bg-green-600',
  description: 'New proposal'
}
```

**Pros**: Easy to discover, high visibility, mobile-friendly  
**Cons**: Competes with other actions for space

---

### **Integration Point 2: My DAOs Cards** ⭐⭐ EXCELLENT
Add role progress indicator + "Create Proposal" button per DAO

```typescript
// In DAOCard component (around line 750+):

<div className="bg-slate-700 rounded-lg p-3 mb-3">
  {/* Current Role */}
  <div className="flex items-center justify-between mb-2">
    <p className="text-xs text-slate-400">Your Role</p>
    <p className="text-sm font-bold text-white">{userRole} ({activityPoints}/50)</p>
  </div>
  
  {/* Activity Progress Bar */}
  {userRole === 'member' && (
    <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
      <div
        className="bg-blue-500 h-2 transition-all"
        style={{ width: `${(activityPoints / 50) * 100}%` }}
      />
    </div>
  )}
</div>

{/* Existing action buttons */}
<div className="flex gap-2">
  {userRole !== 'member' && (
    <Button size="sm" onClick={() => setShowCreateProposalModal(true)}>
      ➕ Create Proposal
    </Button>
  )}
  <Button size="sm" onClick={() => handleVote(dao.id)}>
    🗳️ Vote
  </Button>
  <Button size="sm" onClick={() => handleSend(dao.id)}>
    💸 Send
  </Button>
</div>
```

**Pros**: Contextual to each DAO, shows role per DAO, users see progress  
**Cons**: Makes DAO card taller on mobile

---

### **Integration Point 3: Governance Stats Sidebar** ⭐⭐ EXCELLENT
Add activity points summary + role progression summary

```typescript
// Replace or enhance Governance Stats section (around line 1090):

<div className="bg-slate-800 rounded-xl p-4 md:p-6 border border-slate-700">
  <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
    📊 Governance Stats
  </h3>
  
  {/* EXISTING Stats */}
  <div className="space-y-3">
    <div className="bg-slate-700 rounded-lg p-3">
      <p className="text-sm text-slate-300">Total Votes Cast</p>
      <p className="text-2xl font-bold text-white">{data?.governanceStats?.votesCast || 0}</p>
    </div>
    {/* ... existing cards ... */}
  </div>
  
  {/* NEW: Role Progression Summary */}
  <div className="mt-4 border-t border-slate-600 pt-4">
    <h4 className="text-sm font-bold text-white mb-3">🎖️ Your Role Progress</h4>
    
    {/* For each DAO user is in */}
    {userDAOs.map((dao) => (
      <div key={dao.id} className="bg-slate-700 rounded p-2 mb-2">
        <div className="flex justify-between items-center mb-1">
          <p className="text-xs font-semibold text-white line-clamp-1">{dao.name}</p>
          <p className="text-xs font-bold text-white">{dao.userRole}</p>
        </div>
        
        {dao.userRole === 'member' && (
          <>
            <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden mb-1">
              <div
                className="bg-blue-500 h-2"
                style={{ width: `${(dao.activityPoints / 50) * 100}%` }}
              />
            </div>
            <p className="text-xs text-slate-400">
              {dao.activityPoints}/50 points
              {dao.promotionEligible && (
                <span className="text-green-400 font-bold"> ✅ Ready!</span>
              )}
            </p>
          </>
        )}
      </div>
    ))}
    
    <Button
      size="sm"
      variant="ghost"
      className="w-full text-blue-400 text-xs mt-2"
      onClick={() => setShowRoleProgressModal(true)}
    >
      View Full Activity →
    </Button>
  </div>
  
  {/* EXISTING Recent Votes */}
  {data?.activeProposals?.length > 0 && (
    <div className="mt-4 border-t border-slate-600 pt-4">
      <h4 className="text-sm font-bold text-white mb-2">🗳️ Recent Votes</h4>
      {/* ... existing recent votes ... */}
    </div>
  )}
</div>
```

**Pros**: Vertical space on sidebar, prominent role tracking, contextual  
**Cons**: Sidebar gets taller

---

## 🚀 IMPLEMENTATION ROADMAP

### Phase 1: Component Creation ✅ (DONE)
- [x] CreateProposalModal.tsx
- [x] Role progression system design

### Phase 2: Quick Integration (Week 1)
- [ ] Add "Create Proposal" quick action
- [ ] Add "My Activity" quick action
- [ ] Export & wire up modals in OkediDashboard

### Phase 3: DAO Card Enhancement (Week 2)
- [ ] Add role indicator to DAOCard
- [ ] Add role progress bar per DAO
- [ ] Add "Create Proposal" button if Elder/Admin
- [ ] Link to proposal creation

### Phase 4: Governance Stats Enhancement (Week 2)
- [ ] Add activity score card
- [ ] Add role progression summary
- [ ] Add "Request Promotion" button if eligible
- [ ] Add link to full activity page

### Phase 5: Backend Integration (Week 3)
- [ ] Activity tracking API endpoints
- [ ] Activity points calculation
- [ ] Auto-promotion logic
- [ ] Role history tracking

### Phase 6: Additional Components (Week 4+)
- [ ] RoleProgressModal (full-page activity view)
- [ ] VoteProposalModal (proposal voting)
- [ ] ProposalResultsCard (proposal outcomes)
- [ ] MemberActivityLeaderboard (DAO-wide)

---

## 📊 COMPONENT DEPENDENCIES

```
OkediDashboard
├─ QuickActions section
│  └─ "Create Proposal" action
│     └─ CreateProposalModal ✅ READY
│        └─ RoleProgressCard (embedded)
│        └─ ProposalTypeCard (embedded)
│        └─ PermissionDeniedModal (embedded)
│
├─ My DAOs section
│  └─ DAOCard component (enhanced)
│     ├─ Role indicator
│     ├─ Activity progress bar
│     └─ "Create Proposal" button → CreateProposalModal
│
└─ Governance Stats section
   ├─ RoleProgressCard (embedded)
   ├─ "Request Promotion" button → RoleProgressModal
   └─ Activity summary per DAO
```

---

## ✅ TO-DO FOR INTEGRATION

1. **Build RoleProgressCard component** (reusable)
   - Show current role
   - Show activity points/progress
   - Show promotion buttons
   - Show activity history preview
   - Use in: Governance Stats sidebar + OkediDashboard

2. **Build RoleProgressModal component** (full page)
   - Full activity history
   - Promotion request UI
   - Accept/decline promotion modal
   - Detailed contribution breakdown

3. **Enhance DAOCard component**
   - Add role indicator
   - Add activity progress bar
   - Add "Create Proposal" button logic

4. **Wire up OkediDashboard**
   - Import CreateProposalModal
   - Import RoleProgressCard
   - Import RoleProgressModal
   - Add state management (open modals)
   - Add quick action handlers

5. **Test & Debug**
   - Component rendering
   - Modal workflows
   - Mobile responsiveness
   - Error handling

---

## 🎨 DESIGN NOTES

**Color Scheme for Governance**:
- Member role: Gray (slate-600)
- Elder role: Purple (purple-600)
- Admin role: Red (red-600)
- Activity points: Blue (blue-500)
- Promotion eligible: Green (green-500)

**Icons**:
- Activity: `Trophy` or `Star`
- Role: `Crown` or `Shield`
- Proposal: `FileText` or `Megaphone`
- Vote: `CheckCircle` or `ThumbsUp`

---

**Status**: Ready for integration into OkediDashboard  
**Next Step**: Create RoleProgressCard & RoleProgressModal components
