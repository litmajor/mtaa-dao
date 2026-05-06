# Phase 5 UI Implementation Plan

## Status Overview

**Backend Deployment**: Ready ✅
- Schema: Complete
- Services: 50+ functions implemented
- APIs: 40+ endpoints created
- Tests: 40+ test cases passing
- Migrations: Prepared (Phase 5 governance tables)

**Frontend**: To Be Implemented

**Current Blockers**:
- ⚠️ TypeScript compilation errors in `advancedFeaturesSchema.ts` (varchar syntax)
- These need to be fixed before `npm run check` passes
- Then can run `npm run db:push` to deploy migrations

---

## UI Architecture

### Pages & Components Structure

```
app/
├── pages/
│   ├── governance/
│   │   ├── daos/
│   │   │   ├── [id]/
│   │   │   │   ├── page.tsx (DAO detail view)
│   │   │   │   ├── members.tsx (Member management)
│   │   │   │   ├── treasury.tsx (Treasury overview)
│   │   │   │   ├── proposals.tsx (Proposal list & voting)
│   │   │   │   └── budget.tsx (Budget & expenses)
│   │   │   ├── create.tsx (New DAO creation)
│   │   │   └── page.tsx (DAOs list)
│   ├── dashboard/
│   │   ├── page.tsx (Main dashboard)
│   │   ├── analytics.tsx (Governance analytics)
│   │   └── reports.tsx (Reports & metrics)
│   └── settings/
│       └── governance.tsx (Governance parameters)
├── components/
│   ├── dao/
│   │   ├── DAOCard.tsx
│   │   ├── DAOHeader.tsx
│   │   ├── MemberList.tsx
│   │   └── MemberAddModal.tsx
│   ├── governance/
│   │   ├── ProposalCard.tsx
│   │   ├── ProposalVoting.tsx
│   │   ├── VoteDisplay.tsx
│   │   └── DelegationWidget.tsx
│   ├── treasury/
│   │   ├── TreasuryOverview.tsx
│   │   ├── AssetAllocation.tsx
│   │   ├── TransactionHistory.tsx
│   │   └── MultiSigApproval.tsx
│   ├── budget/
│   │   ├── BudgetCategory.tsx
│   │   ├── ExpenseRequest.tsx
│   │   ├── ExpenseApproval.tsx
│   │   └── BudgetChart.tsx
│   └── shared/
│       ├── DataTable.tsx
│       ├── Chart.tsx
│       ├── Modal.tsx
│       └── StatusBadge.tsx
```

---

## Key Pages to Implement

### 1. **DAOs List & Discovery** (`/governance/daos`)
**Purpose**: Browse and manage all DAOs
**Components**:
- DAO card grid with key metrics
- Search & filter (by type, size, activity)
- Sort options (newest, most active, largest treasury)
- Create DAO button

**Data Displayed**:
- DAO name, description, avatar
- Member count
- Treasury balance (USD)
- Proposal count
- Governance health score
- Last activity

**Actions**:
- View DAO details
- Join DAO
- Create new DAO
- Filter by DAO type

---

### 2. **DAO Detail Dashboard** (`/governance/daos/[id]`)
**Purpose**: Central hub for a specific DAO
**Tabs**:
- **Overview**: Key stats, health score, recent activity
- **Members**: Member list, roles, voting power
- **Proposals**: Active & past proposals
- **Treasury**: Assets, transactions, allocation
- **Budget**: Spending categories, expenses
- **Settings**: Governance parameters

**Key Metrics Displayed**:
- Total members & participation rate
- Treasury value & allocation
- Active proposals & voting period
- Budget utilization
- Governance health score
- Recent governance events

---

### 3. **Proposals & Voting** (`/governance/daos/[id]/proposals`)
**Purpose**: Create and vote on proposals
**Components**:

**ProposalList**:
- Proposal cards showing:
  - Title, description preview
  - Type badge (parameter_change, treasury_transfer, etc.)
  - Status (pending, voting, approved, rejected, executed)
  - Vote progress bar (for/against/abstain)
  - Voting time remaining
  - Participation count

**CreateProposal**:
- Form with fields:
  - Title (500 chars)
  - Description (text editor with markdown)
  - Proposal type dropdown
  - Type-specific parameters
  - IPFS hash (optional)
- Preview before submission

**ProposalDetail**:
- Full description
- Voting results (animated pie chart)
- Vote breakdown (for/against/abstain)
- Individual voter list
- Cast vote button/widget
- Delegation option
- Execution button (if approved)

**VotingWidget**:
- Vote choices (For/Against/Abstain)
- Voting power display
- Vote reason text field
- Submit button with gas estimate

---

### 4. **Treasury Management** (`/governance/daos/[id]/treasury`)
**Purpose**: Manage DAO treasury and assets
**Components**:

**TreasuryOverview**:
- Total value (USD)
- Asset allocation pie chart
- Monthly burn rate
- Runway calculation

**AssetList**:
- Table with:
  - Asset name & symbol
  - Quantity
  - Unit price
  - Total value
  - % of allocation
  - Unrealized gain/loss

**TransactionHistory**:
- Filterable table:
  - Type (deposit, withdrawal, transfer, etc.)
  - Amount & USD value
  - From/To addresses
  - Transaction hash (linked to explorer)
  - Related proposal (if any)
  - Status & timestamp

**MultiSigApproval** (if enabled):
- Pending signatures display
- Approval/rejection buttons
- Signer list with status

---

### 5. **Budget & Expenses** (`/governance/daos/[id]/budget`)
**Purpose**: Track spending and approve expenses
**Components**:

**BudgetOverview**:
- Monthly/Quarterly/Annual budget vs spent
- Progress bars for each category
- Budget utilization %

**CategoryList**:
- Categories with:
  - Monthly/Quarterly/Annual limits
  - Spent to date
  - Progress bar
  - % utilization

**ExpenseRequests**:
- Table with:
  - Expense name & description
  - Amount & category
  - Submitted by & date
  - Status (pending, approved, rejected, paid)
  - Actions (view, approve, reject)

**SubmitExpense** (Form):
- Fields:
  - Expense name
  - Category dropdown
  - Amount (USD)
  - Description
  - Due date
  - Receipt/document upload (IPFS)
- Submit & track

**ExpenseApproval**:
- Detail view
- Approval/rejection form
- Reason/notes field
- Approval history

---

### 6. **Governance Analytics** (`/dashboard/analytics`)
**Purpose**: View governance metrics and health scores
**Displays**:
- **Governance Health Score**: 0-100
  - Components: Participation rate, proposal success rate, member diversity, activity consistency
  - Visual: Large gauge chart

- **Participation Metrics**:
  - Active members count
  - Average voting participation %
  - Vote power concentration
  - New members (period)

- **Proposal Analytics**:
  - Total proposals created
  - Approval rate %
  - Average voting duration
  - Proposal types breakdown

- **Treasury Metrics**:
  - Total inflows/outflows
  - Average transaction size
  - Top assets by allocation
  - Treasury runway (months)

- **Member Activity**:
  - Member ranking by activity points
  - Activity heatmap (day of week)
  - Top contributors

---

### 7. **Member Management** (`/governance/daos/[id]/members`)
**Purpose**: Manage DAO members and voting power
**Components**:

**MemberList** (Table):
- Member avatar & address
- Role badge
- Voting power (tokens & %)
- Activity score
- Vote delegation status
- Joined date
- Actions (update role, update voting power, remove)

**AddMember** (Modal):
- Wallet address input
- Role selector (founder, core, contributor, member)
- Initial voting power
- Send invitation or direct add

**UpdateVotingPower** (Modal):
- Current power display
- New power input
- Reason/notes
- Transaction preview

**DelegationStatus**:
- Show if user has delegated votes
- Show to whom & power amount
- Revoke delegation button

---

### 8. **Governance Parameters** (`/settings/governance`)
**Purpose**: Configure DAO governance rules
**Editable Parameters**:
- Voting period (days)
- Quorum percentage
- Approval percentage
- Execution delay (hours)
- Min/Max delegation percentage
- Token delegation enabled (Y/N)
- Multi-sig required (Y/N)
- Multi-sig signers count
- Emergency pause enabled (Y/N)

**Display**:
- Table with parameter name, current value, unit, change history
- Edit buttons
- Change history/audit trail

---

## UI Components to Build

### Shared/Common Components
```typescript
// Data Display
DataTable<T>(columns, data, onRow, pagination)
StatusBadge(status, variant)
ChartCard(title, chart, metric)
MetricCard(label, value, change, icon)
Activity Timeline(events)

// Forms
TextField(name, label, value, onChange)
SelectField(name, options)
TextArea(name, label)
DatePicker(name, label)
CurrencyInput(name, label)
TokenInput(name, label)

// Modals & Dialogs
Modal(isOpen, onClose, title, children)
ConfirmDialog(title, message, onConfirm)
FormModal(title, fields, onSubmit)

// Status Indicators
VotingProgress(for, against, abstain)
TreasuryHealthIndicator(score)
GovernanceStatus(status)

// Navigation
TabNav(tabs, activeTab, onChange)
Breadcrumbs(path)
SideNav(items, active)
```

### Governance-Specific Components
```typescript
// DAOs
DAOCard(dao)
DAOHeader(dao)
DAOStats(dao)

// Proposals
ProposalCard(proposal)
ProposalVote(proposal, userVotingPower)
VotingBreakdown(votes)
ProposalTimeline(proposal)

// Treasury
AssetCard(asset)
TransactionRow(transaction)
MultiSigApprovalList(approvals)
AllocationChart(assets)

// Members & Voting
MemberCard(member, dao)
VotingPowerDisplay(votingPower)
DelegationWidget(delegations)
RepuputationScore(member)

// Budget & Expenses
BudgetProgressBar(spent, limit, period)
ExpenseCard(expense)
ApprovalWorkflow(expense)
CategoryBudget(category)
```

---

## Data Flow & State Management

### State Management Approach
- **Global**: DAOContext (current DAO, members, settings)
- **Page-level**: useState for forms, modals, filters
- **API**: React Query for data fetching & caching

### Key Queries to Implement
```typescript
// DAOs
useDAOs() // List all DAOs
useDAO(daoId) // Single DAO details
useDAOMembers(daoId) // Members list
useDAOProposals(daoId, filters) // Proposals
useDAOTreasury(daoId) // Treasury overview
useDAOBudget(daoId) // Budget data
useGovernanceStatus(daoId) // Complete status

// Member/Voting
useDAOMembershipStats(daoId)
useVotingPower(daoId, walletId)
useVotes(proposalId)
useDelegations(daoId, walletId)

// Analytics
useGovernanceAnalytics(daoId, period)
useGovernanceReport(daoId, period)
useGovernanceEvents(daoId)
useMemberActivity(daoId, memberId)

// Mutations
createDAO(data)
addDAOMember(daoId, data)
createProposal(daoId, data)
castVote(proposalId, data)
recordTreasuryTransaction(treasuryId, data)
submitExpense(budgetCategoryId, data)
```

---

## Implementation Phases

### Phase 1: Core Pages (Week 1-2)
- [ ] DAOs list page
- [ ] DAO detail/overview
- [ ] Member management page
- [ ] Shared components (table, cards, nav)

### Phase 2: Governance (Week 2-3)
- [ ] Proposals list & detail
- [ ] Voting interface
- [ ] Vote delegation UI
- [ ] Proposal creation form

### Phase 3: Treasury (Week 3-4)
- [ ] Treasury overview
- [ ] Asset allocation view
- [ ] Transaction history
- [ ] Multi-sig approval flow

### Phase 4: Budget & Analytics (Week 4-5)
- [ ] Budget categories
- [ ] Expense management
- [ ] Governance analytics dashboard
- [ ] Reports & metrics

### Phase 5: Polish & Testing (Week 5-6)
- [ ] UI refinement
- [ ] Responsive design
- [ ] Accessibility
- [ ] Performance optimization

---

## Tech Stack for Frontend

```json
{
  "dependencies": {
    "react": "^18.2.0",
    "next": "^13.0.0",
    "zustand": "^4.4.0",
    "react-query": "^3.39.0",
    "axios": "^1.4.0",
    "zod": "^3.22.0",
    "recharts": "^2.10.0",
    "date-fns": "^2.30.0",
    "ethers": "^6.7.0",
    "wagmi": "^1.3.0"
  },
  "devDependencies": {
    "typescript": "^5.1.0",
    "tailwindcss": "^3.3.0",
    "autoprefixer": "^10.4.14",
    "postpcss": "^8.4.24",
    "eslint": "^8.44.0",
    "prettier": "^2.8.8"
  }
}
```

---

## Design System

### Colors
- Primary: #6366f1 (Indigo)
- Success: #10b981 (Green)
- Warning: #f59e0b (Amber)
- Error: #ef4444 (Red)
- Info: #3b82f6 (Blue)

### Typography
- Headings: Inter Bold
- Body: Inter Regular
- Monospace: Fira Code

### Spacing
- xs: 4px
- sm: 8px
- md: 16px
- lg: 24px
- xl: 32px
- 2xl: 48px

---

## Next Steps

1. **Fix TypeScript Errors** in advancedFeaturesSchema.ts
2. **Deploy Migrations** with `npm run db:push`
3. **Create Tables** in PostgreSQL
4. **Setup Frontend Repo** (if separate) or create `/app` folder
5. **Implement Core Components** starting with shared utilities
6. **Begin Page Implementation** starting with DAOs list
7. **Integrate with APIs** once backend is deployed

---

## Deployment Strategy

### Backend Deployment
1. Fix TypeScript errors
2. Run migrations: `npm run db:push`
3. Deploy server to hosting (Render, Fly.io, AWS, etc.)

### Frontend Deployment
1. Build: `npm run build:frontend`
2. Deploy to Vercel, Netlify, or similar

### Database
- PostgreSQL hosted on managed service (Railway, Supabase, AWS RDS)
- Migrations run automatically on deployment

