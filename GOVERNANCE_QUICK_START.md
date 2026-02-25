# 🎯 GOVERNANCE INTEGRATION - QUICK START GUIDE

**Status**: ✅ Phase 1 Complete - Components Ready to Test

---

## 📁 New Component Files

```
client/src/components/governance/
├─ CreateProposalModal.tsx (343 lines) ✅ EXISTING
├─ RoleProgressCard.tsx (420 lines) ✅ NEW
└─ DAOCard.tsx (250 lines) ✅ NEW
```

---

## 🔄 Integration Summary

### Before (Old OkediDashboard)
```
MyDAOs Section
└─ Inline DAOCard (no role progress, no proposal button)
   └─ Shows: Name, description, members, basic role badge
   └─ No proposal creation capability
```

### After (New OkediDashboard)
```
MyDAOs Section
└─ Enhanced DAOCard Component
   ├─ Shows: Name, description, members, treasury
   ├─ Integrated RoleProgressCard (inline mode)
   │  └─ Shows role + activity points + "Ready!" badge
   ├─ "Create Proposal" button (if Elder/Admin)
   │  └─ Triggers CreateProposalModal
   └─ Hover → Full role info appears
      └─ How to earn points, responsibilities, etc.

CreateProposalModal (renders conditionally)
└─ 4-step wizard:
   1. Proposal type selection
   2. Title input
   3. Description textarea
   4. Review & submit
```

---

## 💻 Code Integration Points

### 1. OkediDashboard State (New)
```typescript
// Governance state
const [showCreateProposalModal, setShowCreateProposalModal] = useState(false);
const [selectedDAOForProposal, setSelectedDAOForProposal] = useState<string | null>(null);
```

### 2. DAOCard Rendering (Updated)
```typescript
<DAOCardComponent
  dao={{...dao, activityPoints, promotionEligible}}
  onVote={handleVote}
  onSend={handleSend}
  onManage={handleManage}
  onCreateProposal={(daoId) => {
    setSelectedDAOForProposal(daoId);
    setShowCreateProposalModal(true);
  }}
  showRoleProgress={true}
/>
```

### 3. CreateProposalModal Rendering (New)
```typescript
{showCreateProposalModal && selectedDAOForProposal && (
  <CreateProposalModal
    daoId={selectedDAOForProposal}
    daoType={dao.type}
    userRole={dao.role}
    isOpen={showCreateProposalModal}
    onClose={() => {
      setShowCreateProposalModal(false);
      setSelectedDAOForProposal(null);
    }}
    onSuccess={(proposalId) => {
      showToast(`Proposal created: ${proposalId}`, 'success');
      // Close & refresh
    }}
  />
)}
```

---

## 🎨 Visual Layout

### Desktop View
```
┌──────────────────────────────────────────────────────────┐
│ OKEDI DASHBOARD                                          │
├──────────────────────────────────────────────────────────┤
│                                                          │
│ 💳 Personal Balance: 1,234.56 cUSD                       │
│                                                          │
│ [Send] [Receive] [Transfer] [Links] [Vote] ...          │
│                                                          │
├──────────────────────────────────────────────────────────┤
│ MY DAOs                                  📊 GOVERNANCE   │
│                                          STATS           │
│ ┌────────────────────┐                  ┌──────────────┐ │
│ │ Mama Savings       │                  │ Votes: 42    │ │
│ │ Member • 35/50 pts │                  │ Power: 8.3%  │ │
│ │ ███████░░░░░░░░░░ │                  │ DAOs: 3      │ │
│ │ 15 pts to Elder    │                  │ Rank: #47    │ │
│ │ Members: 12/50     │                  └──────────────┘ │
│ │ Treasury: $2,345   │                                  │ │
│ │ [View] [Vote] [Send $]   (No [Propose] - member)     │ │
│ └────────────────────┘                                  │ │
│                                                          │ │
│ ┌────────────────────┐                                  │ │
│ │ Coffee Coop        │                                  │ │
│ │ Elder (Leadership) │                                  │ │
│ │ Members: 8/30      │                                  │ │
│ │ Treasury: $450     │                                  │ │
│ │ [View] [➕ Propose] [Vote] [Send $] [⚙️ Admin]       │ │
│ └────────────────────┘                                  │ │
│                                                          │ │
│ [View All DAOs (8)]                                     │ │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

### Mobile View
```
┌──────────────────────┐
│ OKEDI DASHBOARD      │
├──────────────────────┤
│ 💳 1,234.56 cUSD     │
│                      │
│ Quick Actions →      │
│ [Send][Receive][..] │
│                      │
│ MY DAOs              │
├──────────────────────┤
│ Mama Savings         │
│ Member • 35/50       │
│ ███████░░░░░░        │
│ 12 members           │
│ [View][Vote][Send]   │
│                      │
│ Coffee Coop          │
│ Elder (Leadership)   │
│ 8 members            │
│ [View][Propose]      │
│ [Vote][Send][Admin]  │
└──────────────────────┘

[Hover opens role info on desktop]
[Tap "Activity" link on mobile]
```

---

## 🎭 User Scenarios

### Scenario 1: Member Views Their DAOs
```
1. Open OkediDashboard
2. Scroll to "My DAOs"
3. See 4 DAOs displayed
4. For each DAO see:
   - DAO name
   - My role (Member/Elder/Admin)
   - Activity points (if member)
   - Progress bar (if member)
   - Action buttons
5. Hover over DAO (desktop) or click activity link (mobile)
   → See full RoleProgressCard with:
      • How to earn points
      • Request early promotion button
      • What I can do as Elder
6. Member cannot see "Propose" button
7. Cast votes and earn points
```

### Scenario 2: Elder Creates Proposal
```
1. Open OkediDashboard
2. Scroll to "My DAOs"
3. Find DAO where role = "Elder"
4. See "➕ Propose" button (green)
5. Click "➕ Propose"
6. Modal opens with:
   - Step 1: Select proposal type (general, budget, poll)
   - Step 2: Enter title
   - Step 3: Enter description
   - Step 4: Review & confirm
   - Step 5: Success screen
7. Submit proposal
8. See toast: "Proposal created! ID: prop_123"
9. Modal closes
```

### Scenario 3: Admin Manages DAO
```
1. Open OkediDashboard
2. Find DAO where role = "Admin"
3. See ⚙️ Admin button
4. See all action buttons enabled:
   - [View] → DAO details page
   - [Propose] → Create any proposal type
   - [Vote] → Vote with 2x weight
   - [Send $] → Send DAO treasury
   - [Admin] → Admin panel (future)
```

---

## ✅ Testing Commands

### Test Component Rendering
```bash
npm test -- RoleProgressCard.test.tsx
npm test -- DAOCard.test.tsx
npm test -- OkediDashboard.test.tsx
```

### Test Component in Storybook
```bash
npm run storybook
# Find: RoleProgressCard
# Find: DAOCard
# Find: OkediDashboard
```

### Manual Testing
1. Open http://localhost:3000/dashboard
2. Login as test user
3. Verify DAO cards render correctly
4. Click "Create Proposal" button
5. Verify modal opens with correct DAO context
6. Fill form and submit
7. Verify success toast appears

---

## 🔍 Key Props Reference

### RoleProgressCard
```typescript
<RoleProgressCard
  currentRole="member"              // member | elder | admin
  activityPoints={35}               // 0-50+ points
  promotionEligible={false}         // true if >= 50 points
  onAcceptPromotion={handleAccept}  // Called when user accepts
  onRequestPromotion={handleRequest}// Called when user requests
  pointsNeeded={50}                 // Default: 50
  daoName="Mama Savings"            // Optional
  inline={true}                     // Compact mode (for sidebar)
/>
```

### DAOCard
```typescript
<DAOCard
  dao={{
    id: "dao_123",
    name: "Mama Savings",
    description: "Monthly savings circle",
    memberCount: 12,
    role: "elder",
    treasury: 2345,
    activityPoints: 35,
    promotionEligible: false,
    type: "short_term"
  }}
  onVote={(daoId) => {}}           // Called on vote click
  onSend={(daoId) => {}}           // Called on send click
  onManage={(daoId) => {}}         // Called on manage click
  onCreateProposal={(daoId) => {}} // NEW: Called on propose click
  showRoleProgress={true}          // NEW: Show role card
/>
```

### CreateProposalModal
```typescript
<CreateProposalModal
  daoId="dao_123"                    // Which DAO
  daoType="short_term"               // DAO type
  userRole="elder"                   // User's role
  isOpen={true}                      // Show/hide
  onClose={() => {}}                 // Called on close
  onSuccess={(proposalId) => {}}    // Called on success
/>
```

---

## 📊 Component State Flow

```
User clicks "Create Proposal"
        ↓
DAOCard calls onCreateProposal(daoId)
        ↓
OkediDashboard state updates:
  - setShowCreateProposalModal(true)
  - setSelectedDAOForProposal(daoId)
        ↓
CreateProposalModal re-renders (conditional)
        ↓
Modal shows 4-step form
        ↓
User fills form and submits
        ↓
API call to POST /api/governance/{daoId}/proposals
        ↓
On success:
  - Modal calls onSuccess(proposalId)
  - Toast notification shown
  - Modal closes
  - State resets
        ↓
Dashboard refreshes proposal list
```

---

## 🚨 Known Limitations

1. **Activity Points**
   - Currently hardcoded (35 in example)
   - Need backend to track and calculate
   - Need to call activity API on user actions

2. **Auto-Promotion**
   - Not implemented yet
   - Need backend logic to check eligibility
   - Need notification system for promotions

3. **Proposal Submission**
   - API endpoint must exist: `POST /api/governance/{daoId}/proposals`
   - Need to return `{ proposalId: "..." }`
   - Need error handling for failures

4. **Role Detection**
   - Currently from DAO data passed in props
   - Need to verify role from backend
   - Need permission checking before allowing actions

---

## 📝 Next Steps

1. **Test Components**: Run component tests
2. **Backend Integration**: 
   - Verify API endpoints exist
   - Implement activity tracking
   - Implement auto-promotion logic
3. **Activity Tracking**:
   - Award points for votes
   - Award points for comments
   - Award points for proposals
4. **Vote Proposal Component**: Build voting UI
5. **Proposal Results**: Build results display

---

**For detailed documentation, see:**
- `ROLE_PROGRESSION_ACTIVITY_SYSTEM.md` - Role system architecture
- `GOVERNANCE_INTEGRATION_PHASE_1_COMPLETE.md` - Full integration details
- `OKEDI_DASHBOARD_GOVERNANCE_STRUCTURE.md` - Dashboard integration guide

