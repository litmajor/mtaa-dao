# Phase 2 Governance System - Integration Guide

## ✅ Completed Components

### 1. **Frontend Components** (Ready to integrate)
- ✅ `RoleProgressModal.tsx` - Full activity history + role progression UI (600 lines)
- ✅ `VoteProposalModal.tsx` - Voting interface with real-time tracking (450 lines)
- ✅ `ProposalResultsCard.tsx` - Proposal outcomes display (400+ lines)

### 2. **Backend Services** (Production-ready)
- ✅ `ActivityService` - Activity logging, stats, leaderboard (service layer)
- ✅ `PromotionService` - Role progression, promotion eligibility (service layer)
- ✅ `governance-activity.ts` - API routes for all activity/promotion endpoints

### 3. **Database** (Migration ready)
- ✅ `003_governance_activity_tracking.sql` - Complete schema with 3 tables, views, triggers

---

## 🔌 Integration Steps

### **Step 1: Database Setup**

```bash
# Run the migration
psql -U your_user -d your_db -f server/migrations/003_governance_activity_tracking.sql

# Verify tables were created
\dt governance_*
```

**Tables Created:**
- `governance_activity_log` - Activity records with points
- `governance_promotion_history` - Promotion history
- `governance_promotion_requests` - Pending promotions
- `governance_activity_types` - Activity type reference
- `governance_role_requirements` - Role thresholds

**Views Created:**
- `vw_user_activity_stats` - User activity statistics
- `vw_promotion_eligibility` - Eligibility check results

---

### **Step 2: Register API Routes**

Add to your main server file (e.g., `server/index.ts` or `server/app.ts`):

```typescript
import governanceActivityRoutes from '@/server/routes/governance-activity';

// Register routes
app.use('/api/governance', governanceActivityRoutes);
```

**Available Endpoints:**
```
Activity Endpoints:
POST   /api/governance/:daoId/activity/award
GET    /api/governance/:daoId/activity/history
GET    /api/governance/:daoId/activity/stats
GET    /api/governance/:daoId/leaderboard

Promotion Endpoints:
GET    /api/governance/:daoId/promotion/eligibility
POST   /api/governance/:daoId/promotion/request
GET    /api/governance/:daoId/promotion/history
POST   /api/governance/:daoId/promotion/accept (admin)
POST   /api/governance/:daoId/promotion/reject (admin)
```

---

### **Step 3: Integrate RoleProgressModal into Dashboard**

Update `OkediDashboard.tsx`:

```typescript
// Add imports
import { RoleProgressModal } from '@/components/governance/RoleProgressModal';

// Add state
const [showRoleProgressModal, setShowRoleProgressModal] = useState(false);
const [selectedUserForRole, setSelectedUserForRole] = useState<string | null>(null);

// Add to render
<RoleProgressModal
  isOpen={showRoleProgressModal}
  onOpenChange={setShowRoleProgressModal}
  userId={selectedUserForRole || userId}
  daoId={selectedDAO?.id || ''}
/>

// Add button to trigger
<Button 
  onClick={() => setShowRoleProgressModal(true)}
  variant="outline"
>
  View Activity
</Button>
```

---

### **Step 4: Integrate VoteProposalModal**

Add to `ProposalCard.tsx` or `ProposalDetailsPage.tsx`:

```typescript
// Add imports
import { VoteProposalModal } from '@/components/governance/VoteProposalModal';

// Add state
const [showVoteModal, setShowVoteModal] = useState(false);
const [selectedProposal, setSelectedProposal] = useState<ProposalDetails | null>(null);

// Add to render
<VoteProposalModal
  isOpen={showVoteModal}
  onOpenChange={setShowVoteModal}
  proposal={selectedProposal || proposal}
  onVoteSuccess={() => {
    // Refresh proposal data
    queryClient.invalidateQueries({
      queryKey: ['proposal', proposal.id]
    });
  }}
/>

// Add button to trigger
<Button 
  onClick={() => {
    setSelectedProposal(proposal);
    setShowVoteModal(true);
  }}
>
  Vote on Proposal
</Button>
```

---

### **Step 5: Display ProposalResultsCard**

Add to proposal listings or proposal details:

```typescript
// Add imports
import { ProposalResultsCard } from '@/components/governance/ProposalResultsCard';

// Use in render
<ProposalResultsCard
  proposal={proposal}
  compact={true}  // Set false for full view
  onViewProposal={() => navigate(`/proposal/${proposal.id}`)}
  onExecute={async () => {
    // Execute passed proposal
  }}
/>
```

---

### **Step 6: Award Activity Points**

Trigger activity awards from various actions:

```typescript
// When user votes
await fetch(`/api/governance/${daoId}/activity/award`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    userId: currentUserId,
    type: 'vote',
    description: 'Voted on proposal: ' + proposal.title,
    metadata: { proposalId: proposal.id, vote: 'for' }
  })
});

// When user creates proposal
await fetch(`/api/governance/${daoId}/activity/award`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    userId: currentUserId,
    type: 'proposal',
    description: 'Created proposal: ' + proposal.title,
    metadata: { proposalId: proposal.id }
  })
});

// When user comments
await fetch(`/api/governance/${daoId}/activity/award`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    userId: currentUserId,
    type: 'comment',
    description: 'Commented on proposal discussion',
    metadata: { proposalId: proposal.id }
  })
});
```

---

## 📊 Activity Point System

### Point Values (Customizable)
```
VOTE:     5 points
PROPOSAL: 15 points
COMMENT:  3 points
MEETING:  10 points
TASK:     20 points
INVITE:   10 points (when they join)
PROMO:    50 points (Elder), 100 points (Admin)
```

### Point Decay
- **Monthly**: 0.9x multiplier (10% decay)
- **Yearly**: 0.5x multiplier (50% decay)
- **Expiration**: 90 days (soft delete via `expires_at`)

---

## 🎯 Role Progression Thresholds

### MEMBER → ELDER
- **Points Required**: 50+ in last 30 days
- **Minimum Member Days**: 7 days
- **Voting Power**: 1x (standard)
- **Abilities**: Vote, Comment, Attend meetings

### ELDER → ADMIN
- **Points Required**: 200+ in last 90 days
- **Minimum Member Days**: 30 days
- **Voting Power**: 2x (double weight)
- **Abilities**: Create proposals, Create emergency proposals, Manage members

### Bonus Points
- **Elder Promotion**: +50 points
- **Admin Promotion**: +100 points

---

## 🔄 Query Examples

### Get User Activity History
```typescript
const response = await fetch(`/api/governance/${daoId}/activity/history`);
const { history } = await response.json();
```

### Check Promotion Eligibility
```typescript
const response = await fetch(`/api/governance/${daoId}/promotion/eligibility`);
const { eligibility } = await response.json();

if (eligibility.isEligible) {
  // Show "Ready for promotion!" message
}
```

### Get User Stats
```typescript
const response = await fetch(`/api/governance/${daoId}/activity/stats`);
const { stats } = await response.json();
// Returns: totalPoints, daysActive, lastActivityDate, activityBreakdown
```

### Get Leaderboard
```typescript
const response = await fetch(`/api/governance/${daoId}/leaderboard?limit=10`);
const { leaderboard } = await response.json();
```

---

## 📱 Component Props Reference

### RoleProgressModal
```typescript
interface RoleProgressModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  daoId: string;
}
```

### VoteProposalModal
```typescript
interface VoteProposalModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  proposal: ProposalDetails;
  onVoteSuccess?: () => void;
  onClose?: () => void;
}

interface ProposalDetails {
  id: string;
  title: string;
  description: string;
  type: 'general' | 'budget' | 'poll' | 'emergency';
  status: 'voting' | 'passed' | 'failed' | 'executed';
  daoId: string;
  daoName: string;
  createdBy: string;
  createdAt: Date;
  votingEndsAt: Date;
  currentVotes: { for: number; against: number; abstain: number };
  votesRequired: number;
  yourVote?: 'for' | 'against' | 'abstain';
  userVotingPower: number;
  votingDetails: {
    totalVoters: number;
    participationRate: number;
    quorumRequired: number;
  };
}
```

### ProposalResultsCard
```typescript
interface ProposalResultsCardProps {
  proposal: ProposalResult;
  onViewDetails?: () => void;
  onExecute?: () => void;
  onViewProposal?: () => void;
  compact?: boolean;
}

interface ProposalResult {
  id: string;
  title: string;
  daoName: string;
  status: 'voting' | 'passed' | 'failed' | 'executed';
  type: 'general' | 'budget' | 'poll' | 'emergency';
  votes: { for: number; against: number; abstain: number };
  votesRequired: number;
  participationRate: number;
  quorumRequired: number;
  outcome?: {
    passedAt?: Date;
    failedAt?: Date;
    executedAt?: Date;
    margin: number;
  };
}
```

---

## 🧪 Testing Checklist

- [ ] Database migration runs without errors
- [ ] API endpoints respond with correct data
- [ ] RoleProgressModal shows accurate activity history
- [ ] VoteProposalModal allows voting and updates counts
- [ ] ProposalResultsCard displays results correctly
- [ ] Auto-promotion triggers when user reaches threshold
- [ ] Point decay calculation works correctly
- [ ] Leaderboard displays top users
- [ ] Activity awards are recorded
- [ ] Promotion history is tracked

---

## 🚀 Next Steps

1. **Leaderboard Page** - Display top contributors per DAO
2. **Activity Feed** - Show activity stream with filters
3. **Promotion Notifications** - Alert users when eligible
4. **Activity Timeline** - Visual representation of progress over time
5. **Analytics Dashboard** - DAO governance analytics
6. **Contribution Badges** - Award badges for milestones
7. **Voting Power Display** - Show voting weight in proposals

---

## 📝 Notes

- All services are fully typed with TypeScript
- API routes include authentication checks via middleware
- Database uses PostgreSQL with proper indexing
- Point decay is applied on-demand (not stored)
- Promotion eligibility is calculated in real-time
- Activity records can be marked as expired (soft delete)
- All timestamps are in UTC

---

## ⚡ Performance Optimizations

- **Indexed Queries**: All common queries have proper indexes
- **Batch Operations**: Bulk activity awards supported
- **View Materialization**: Consider materializing views for high-traffic DAOs
- **Caching**: Response caching recommended for leaderboard + stats
- **Point Decay**: Lazy calculation (on-demand) to avoid recalc overhead

---

Generated as part of **Phase 2: Governance Modals & Backend Implementation**
