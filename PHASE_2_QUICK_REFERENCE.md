# Phase 2 Quick Reference Card

## 🚀 Quick Start (5 Minutes)

### 1. Run Migration
```bash
psql -U your_user -d your_db -f server/migrations/003_governance_activity_tracking.sql
```

### 2. Register Routes
```typescript
// server/index.ts
import governanceActivityRoutes from '@/server/routes/governance-activity';
app.use('/api/governance', governanceActivityRoutes);
```

### 3. Use Components
```typescript
// In your dashboard/proposal pages
import { RoleProgressModal } from '@/components/governance/RoleProgressModal';
import { VoteProposalModal } from '@/components/governance/VoteProposalModal';
import { ProposalResultsCard } from '@/components/governance/ProposalResultsCard';
```

---

## 📊 Components at a Glance

| Component | Size | Purpose | Mode |
|-----------|------|---------|------|
| RoleProgressModal | 600 lines | Activity history + progression | Full page |
| VoteProposalModal | 450 lines | Voting interface | Modal dialog |
| ProposalResultsCard | 400 lines | Proposal outcomes | Compact/Full card |

---

## 🎯 Activity Points Quick Table

| Type | Points | When | Icon |
|------|--------|------|------|
| VOTE | 5 | User votes on proposal | 👍 |
| COMMENT | 3 | User posts comment | 💬 |
| PROPOSAL | 15 | User creates proposal | 📝 |
| MEETING | 10 | User attends meeting | 📅 |
| TASK | 20 | User completes task | ✅ |
| INVITE | 10 | Invitee joins DAO | 🔗 |
| PROMOTION | 50/100 | Role upgrade | 🚀 |

---

## 🎪 Role Progression Checklist

### MEMBER → ELDER
- [ ] Reach 50 points in 30 days
- [ ] Member for 7+ days
- Bonus: +50 points, 2x vote power? ❌ (still 1x)

### ELDER → ADMIN
- [ ] Reach 200 points in 90 days
- [ ] Member for 30+ days
- Bonus: +100 points, 2x vote power ✅

---

## 🔗 API Endpoints Reference

### Activity Endpoints
```
POST /api/governance/:daoId/activity/award
GET  /api/governance/:daoId/activity/history?limit=50&offset=0
GET  /api/governance/:daoId/activity/stats
GET  /api/governance/:daoId/leaderboard?limit=10
```

### Promotion Endpoints
```
GET  /api/governance/:daoId/promotion/eligibility
POST /api/governance/:daoId/promotion/request
GET  /api/governance/:daoId/promotion/history
POST /api/governance/:daoId/promotion/accept (admin)
POST /api/governance/:daoId/promotion/reject (admin)
```

---

## 💾 Database Quick Lookup

### Tables
- `governance_activity_log` - Activity records (indexed: user_dao, dao_type, expires)
- `governance_promotion_history` - Role changes
- `governance_promotion_requests` - Pending approvals
- `governance_activity_types` - Type definitions (ref data)
- `governance_role_requirements` - Role thresholds (ref data)

### Views
- `vw_user_activity_stats` - User stats aggregation
- `vw_promotion_eligibility` - Real-time eligibility

---

## ⚡ Common Code Snippets

### Award Points
```typescript
await fetch(`/api/governance/${daoId}/activity/award`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    userId: currentUserId,
    type: 'vote',
    description: 'Voted on: ' + proposalTitle,
    metadata: { proposalId: proposal.id, vote: 'for' }
  })
});
```

### Check Eligibility
```typescript
const res = await fetch(`/api/governance/${daoId}/promotion/eligibility`);
const { eligibility } = await res.json();
if (eligibility.isEligible) showPromotionNotification();
```

### Get Leaderboard
```typescript
const res = await fetch(`/api/governance/${daoId}/leaderboard?limit=10`);
const { leaderboard } = await res.json();
```

### Open Role Modal
```typescript
const [open, setOpen] = useState(false);

<RoleProgressModal
  isOpen={open}
  onOpenChange={setOpen}
  userId={userId}
  daoId={daoId}
/>

<Button onClick={() => setOpen(true)}>View Activity</Button>
```

### Open Vote Modal
```typescript
const [open, setOpen] = useState(false);
const [proposal, setProposal] = useState<ProposalDetails>();

<VoteProposalModal
  isOpen={open}
  onOpenChange={setOpen}
  proposal={proposal}
/>

<Button onClick={() => {
  setProposal(proposal);
  setOpen(true);
}}>
  Vote
</Button>
```

### Show Results
```typescript
<ProposalResultsCard
  proposal={result}
  compact={true}
  onViewProposal={() => navigate(`/proposal/${result.id}`)}
  onExecute={async () => { /* execute */ }}
/>
```

---

## 🧪 Testing Quick Checklist

- [ ] Migration creates all 5 tables
- [ ] API endpoints respond with 200 status
- [ ] Can award activity points
- [ ] Activity history loads
- [ ] Stats calculations are correct
- [ ] Leaderboard shows top 10
- [ ] Eligibility check works
- [ ] Can request promotion
- [ ] Can vote on proposals
- [ ] Proposal results display correctly
- [ ] Point decay works (manual time travel test)

---

## 🆘 Troubleshooting

### Migration fails
→ Check PostgreSQL permissions & schema exists

### API returns 401
→ Missing auth middleware - verify authenticateToken is applied

### Component won't render
→ Check required props are passed & data types match interfaces

### Points not awarded
→ Check user exists in dao_members & dao_id is valid

### Eligibility always false
→ Check activity_log records exist & created_at is recent

### Vote won't submit
→ Check proposal.votingEndsAt is in future & user hasn't voted

---

## 📚 Documentation Files

1. **PHASE_2_INTEGRATION_GUIDE.md** - Complete setup guide
2. **PHASE_2_COMPLETION_SUMMARY.md** - Overview & statistics
3. **This file** - Quick reference

---

## 🎯 Next Phase Roadmap

- [ ] Leaderboard page with rankings
- [ ] Activity feed with real-time updates
- [ ] Notification system for promotions
- [ ] Contribution badges & achievements
- [ ] Governance analytics dashboard
- [ ] Member management admin tools
- [ ] Activity timeline visualization
- [ ] Role revocation & demotion

---

## 💡 Pro Tips

1. **Batch Operations**: Use bulk award when processing multiple activities
2. **Caching**: Cache leaderboard & stats for high-traffic DAOs
3. **Decay**: Only calculate decay on-demand to save compute
4. **Notifications**: Notify users when promotion eligible
5. **History**: Use promotion_history for audit trails
6. **Indexing**: All queries already optimized - don't add more indexes without testing

---

**Quick Links**:
- 📖 Full Integration Guide: [PHASE_2_INTEGRATION_GUIDE.md](PHASE_2_INTEGRATION_GUIDE.md)
- 📊 Completion Summary: [PHASE_2_COMPLETION_SUMMARY.md](PHASE_2_COMPLETION_SUMMARY.md)
- 📁 Components: `client/src/components/governance/`
- 📡 Services: `server/services/`
- 🔌 Routes: `server/routes/governance-activity.ts`
- 🗄️ Schema: `server/migrations/003_governance_activity_tracking.sql`

---

**Print this card and keep it handy! 📌**
