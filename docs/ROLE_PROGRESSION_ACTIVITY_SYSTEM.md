# 🎖️ DAO ROLE PROGRESSION SYSTEM

**Focus**: How members advance from Member → Proposer → Elder → Admin  
**Driver**: Activity tracking + reputation system  
**Date**: February 2, 2026

---

## 🏗️ ROLE STRUCTURE (Simplified)

### Current System
```
Member (no proposal rights)
  ↓ (Promote by elder/admin)
Proposer/Elder (can propose)
  ↓ (Promote by admin)
Admin (full control)
```

### Issue with Current System
- "Proposer" role is separate from Elder but does same thing
- Creates confusion (why both?)
- Not merit-based for promotion
- No activity/reputation tracking

---

## ✨ PROPOSED NEW SYSTEM: ACTIVITY-BASED PROMOTION

### Simplified Role Hierarchy

```
┌─────────────────────────────────────────┐
│ MEMBER (Start here)                     │
├─────────────────────────────────────────┤
│ • Vote on proposals                     │
│ • Delegate votes                        │
│ • Earn activity points                  │
│ • Can't create proposals                │
└──────────────┬──────────────────────────┘
               │ (Auto-promote or Elder/Admin promote)
               │ After: 50+ activity points OR manual request
               ↓
┌─────────────────────────────────────────┐
│ ELDER (Earned or appointed)             │
├─────────────────────────────────────────┤
│ • All Member privileges                 │
│ • CREATE proposals (general & budget)   │
│ • 2x voting weight                      │
│ • Emergency proposals (fast-track)      │
│ • Can't manage treasury                 │
│ • Can't change DAO settings             │
└──────────────┬──────────────────────────┘
               │ (Admin promotes)
               ↓
┌─────────────────────────────────────────┐
│ ADMIN (Full control)                    │
├─────────────────────────────────────────┤
│ • All Elder privileges                  │
│ • Execute proposals                     │
│ • Manage treasury (multi-sig)           │
│ • Add/remove members                    │
│ • Change DAO settings                   │
│ • Configure governance rules            │
└─────────────────────────────────────────┘
```

### Key Changes
1. **Removed "Proposer" role** - Now just Elder
2. **Activity-based advancement** - Auto-promote if active
3. **Simpler structure** - 3 roles instead of 4
4. **Transparent criteria** - Members see path to promotion

---

## 📊 ACTIVITY POINT SYSTEM

### How Members Earn Points

```typescript
activityPointsRewards = {
  // Voting
  vote_cast: 5,                    // Cast any vote
  vote_cast_early: 2,              // Vote in first 24 hours (bonus)
  vote_delegated: 8,               // Delegate votes to another
  delegation_received: 5,          // Someone delegates to you
  
  // Proposals
  proposal_created: 15,            // Create proposal (as Elder)
  proposal_passed: 30,             // Your proposal passed
  proposal_passed_high_approval: 50, // Passed with >75% approval
  
  // Comments & Engagement
  proposal_comment: 3,             // Comment on proposal
  comment_liked: 2,                // Someone likes your comment
  comment_helpful: 5,              // Marked as helpful
  
  // Participation
  meeting_attended: 10,            // Virtual or physical meeting
  task_completed: 20,              // Complete DAO task/bounty
  contribution_logged: 15,         // Log contribution
  
  // Governance
  voted_against_majority: 2,       // Voted differently (shows thinking)
  proposed_emergency: 25,          // Emergency proposal created
  treasury_signer: 10,             // Serve as multi-sig signer
  
  // Community
  member_invited_joined: 10,       // Someone you invited joined
  referral_bonus: 5                // Monthly referral bonus
};

// Decay (prevent one-time spam)
pointDecay = {
  monthly: 0.9,  // Points decay 10% each month (keep engaged)
  yearly: 0.5    // Points reset partially each year
};
```

### Activity Score Examples

```
Alice (Active Member):
├─ Cast 10 votes (50 pts)
├─ Delegate votes to Bob (8 pts)
├─ Comment 5 times (15 pts)
├─ Attend 2 meetings (20 pts)
├─ Comment marked helpful (5 pts)
└─ TOTAL: 98 points → AUTO-PROMOTED TO ELDER ✅

Bob (Moderate Member):
├─ Cast 5 votes (25 pts)
├─ Attend 1 meeting (10 pts)
├─ Comment 2 times (6 pts)
└─ TOTAL: 41 points → Still Member (need 50)

Carol (Quiet Member):
├─ Cast 2 votes (10 pts)
└─ TOTAL: 10 points → Minimal engagement
```

---

## 🚀 PROMOTION PATHWAYS

### Pathway 1: AUTO-PROMOTION (Merit-based)

```
Criteria:
- Completed: 50+ activity points in 30 days
- AND: Member for 7+ days
- AND: Not banned or flagged

Process:
1. System tracks activity
2. At 50 points → Notification: "You're eligible to become Elder!"
3. User can accept or decline
4. If accept → Role updated to Elder
5. Notification sent to admins (for transparency)

Example Timeline:
├─ Day 1: Join DAO (0 pts)
├─ Day 3: Cast first vote (5 pts)
├─ Day 5: Comment on proposal (3 pts)
├─ Day 8: Vote again (5 pts), comment (3 pts) → Total: 16 pts
├─ Day 15: Invited friend who joined (10 pts), 3 votes (15 pts) → Total: 41 pts
├─ Day 20: Attend meeting (10 pts), vote (5 pts), comment (3 pts) → Total: 59 pts ✅
├─ Day 21: SYSTEM NOTIFICATION: "You're eligible for Elder!"
├─ Day 22: User accepts promotion
└─ PROMOTED TO ELDER 🎉
```

### Pathway 2: ELDER/ADMIN PROMOTION (Discretionary)

```
Criteria:
- Admin or Elder can promote any Member
- Suggested: Member should have 25+ activity points (shows some interest)
- No point requirement (allows discretionary promotion)

Process:
1. Elder/Admin selects member to promote
2. Reviews their activity history
3. Promotion approved
4. Member notified: "You've been promoted to Elder!"
5. Member can decline if they want (optional)

Reasons for Discretionary Promotion:
├─ New member but shows strong understanding
├─ Quiet but consistently votes wisely
├─ Takes on leadership role without asking
├─ Outside contributions matter (e.g., real-world leader)
├─ Specific DAO need (e.g., need more Elders for decisions)
└─ Building leadership team
```

### Pathway 3: REQUEST PROMOTION

```
Option Available to Members:
"Feel ready to lead? Request Elder status"

Process:
1. Member clicks "Request Elder Status"
2. Explains why (text field, optional)
3. Sent to admins for review
4. Admin can approve/reject with reason
5. Member gets notification

Example Request:
- Member statement: "I've been voting carefully for 2 months. 
  I have business experience and want to help with budget proposals."
- Admin sees: 45 activity points, good voting history
- Admin approves: "Great, you're now Elder. Help us decide on Q2 budget!"

Auto-Reject If:
├─ < 25 activity points (too new/quiet)
├─ Recently joined (< 14 days)
├─ Flagged for bad behavior
└─ Already promoted in last 30 days
```

---

## 📱 OKEDI DASHBOARD: ROLE & PROGRESS

### Member View

```
┌──────────────────────────────────────────┐
│ YOUR ROLE IN "MAMA SAVINGS"              │
├──────────────────────────────────────────┤
│                                          │
│ Current: 👤 Member                       │
│                                          │
│ Activity Score: 35/50 points             │
│ ███████░░░░░░░░░░░░░░░░░░░░░░ 70%       │
│                                          │
│ 15 more points to unlock Elder status   │
│                                          │
│ How to earn points:                      │
│ ✅ Cast a vote (5 pts)                   │
│ ✅ Comment on proposals (3 pts each)     │
│ ✅ Attend meetings (10 pts)              │
│ ✅ Invite a friend (10 pts if they join) │
│                                          │
│ [View Activity History]                  │
│                                          │
│ 💡 Ready to lead?                        │
│ [Request Elder Status]                   │
│                                          │
└──────────────────────────────────────────┘
```

### Elder View

```
┌──────────────────────────────────────────┐
│ YOUR ROLE IN "MAMA SAVINGS"              │
├──────────────────────────────────────────┤
│                                          │
│ Current: 👥 Elder (Leadership)           │
│                                          │
│ You can:                                 │
│ ✅ Create proposals                      │
│ ✅ Vote with 2x weight                   │
│ ✅ Create emergency proposals            │
│ ✅ Suggest members for promotion         │
│                                          │
│ Activity Score: 120 points (High!)       │
│ ███████████████████████░░░░░░░ 89%      │
│                                          │
│ [View Your Proposals]                    │
│ [View Voting Influence]                  │
│ [Suggest Member for Promotion]           │
│                                          │
└──────────────────────────────────────────┘
```

---

## 🔧 BACKEND IMPLEMENTATION

### Database Schema

```typescript
// Users table (add these fields)
users {
  id: uuid
  activeSubprofile: "okedi" | "yuki" | "amara"
  
  // New fields for activity tracking
  activityPoints: integer DEFAULT 0
  monthlyActivityPoints: integer DEFAULT 0  // Resets monthly
  lastActivityUpdate: timestamp
  pointDecayMultiplier: decimal DEFAULT 1.0  // For monthly decay
}

// DAO Memberships (simplify roles)
daoMemberships {
  id: uuid
  userId: varchar
  daoId: uuid
  role: "member" | "elder" | "admin"  // Remove "proposer"
  status: "active" | "pending" | "banned"
  joinedAt: timestamp
  promotedAt: timestamp
  promotedBy: varchar  // Who promoted (admin ID or "auto")
  isElder: boolean  // Keep for backwards compat
  isAdmin: boolean
  
  // Activity fields
  activityPointsInDAO: integer DEFAULT 0
  promotionEligibleAt: timestamp  // When eligible for Elder
  declinedEldership: boolean  // If user declined promotion
}

// Activity Log (track all activities)
activityLog {
  id: uuid
  userId: varchar
  daoId: uuid
  activityType: varchar  // "vote_cast", "proposal_created", etc
  pointsAwarded: integer
  activityDate: timestamp
  metadata: jsonb  // Extra info (proposalId, etc)
}

// Promotion History (audit trail)
promotionHistory {
  id: uuid
  userId: varchar
  daoId: uuid
  fromRole: "member" | "elder"
  toRole: "elder" | "admin"
  promotionType: "auto" | "admin" | "request"
  promotedBy: varchar  // Admin who promoted (or "system" if auto)
  reason: text  // Admin reason or member request text
  createdAt: timestamp
  acceptedAt: timestamp  // When user accepted
  declinedAt: timestamp  // If declined
}
```

### Activity Calculation Function

```typescript
// server/services/activity-service.ts

export async function calculateActivityPoints(
  userId: string,
  daoId: string,
  timeframe: 'month' | 'all' = 'month'
): Promise<number> {
  const query = {
    userId,
    daoId,
    ...(timeframe === 'month' && {
      activityDate: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
    })
  };

  const activities = await activityLog.find(query);
  const points = activities.reduce((sum, activity) => sum + activity.pointsAwarded, 0);

  // Apply decay if all-time
  if (timeframe === 'all') {
    const membershipMonths = calculateMonthsSinceMembership(userId, daoId);
    const decayMultiplier = Math.pow(0.9, membershipMonths); // 10% decay per month
    return Math.round(points * decayMultiplier);
  }

  return points;
}

// Check and auto-promote
export async function checkAutoPromotion(userId: string, daoId: string): Promise<boolean> {
  const monthlyPoints = await calculateActivityPoints(userId, daoId, 'month');
  const membership = await daoMemberships.findOne({ userId, daoId });

  // Criteria for auto-promotion
  if (
    monthlyPoints >= 50 &&
    membership.role === 'member' &&
    membership.joinedAt < new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) && // 7+ days
    !membership.declinedEldership
  ) {
    // Send notification to user
    await notificationService.send(userId, {
      title: 'You qualify for Elder status!',
      message: `You've earned ${monthlyPoints} activity points. Accept Elder status to start creating proposals.`,
      action: 'ACCEPT_ELDER',
      daoId
    });

    // Set promotion eligible
    await daoMemberships.updateOne(
      { userId, daoId },
      { promotionEligibleAt: new Date() }
    );

    return true;
  }

  return false;
}

// Award activity points
export async function awardActivityPoints(
  userId: string,
  daoId: string,
  activityType: string,
  metadata?: any
) {
  const pointRewards: Record<string, number> = {
    vote_cast: 5,
    vote_cast_early: 2,
    proposal_created: 15,
    proposal_comment: 3,
    meeting_attended: 10,
    task_completed: 20,
    member_invited_joined: 10
    // ... more
  };

  const points = pointRewards[activityType] || 0;

  // Record activity
  await activityLog.create({
    userId,
    daoId,
    activityType,
    pointsAwarded: points,
    metadata,
    activityDate: new Date()
  });

  // Check for auto-promotion
  await checkAutoPromotion(userId, daoId);
}
```

### API Endpoints

```typescript
// GET /api/governance/:daoId/members/:userId/activity
// Returns activity score and promotion eligibility
{
  monthlyPoints: 45,
  allTimePoints: 120,
  promotionEligible: false,
  nextMilestone: 50,
  lastActivities: [
    { type: 'vote_cast', date: '2026-02-01', points: 5 },
    // ...
  ]
}

// POST /api/governance/:daoId/request-elder
// Member requests Elder status
{
  reason: "I have 2 years experience and want to help"
}
// Response: { status: "pending" } or { error: "Not eligible yet" }

// POST /api/governance/:daoId/members/:userId/promote
// Admin promotes member
{
  toRole: "elder",
  reason: "Strong contributor"
}

// POST /api/governance/:daoId/accept-promotion
// User accepts promotion offer
{
  proposedRole: "elder"
}
```

---

## 📊 OKEDI UI: ROLE PROGRESSION

### Quick Actions Enhancement

```typescript
// In OkediDashboard.tsx Quick Actions

<QuickActionButton
  icon={<Trophy />}
  label="Activity & Roles"
  badge={userActivityPoints < 50 ? `${userActivityPoints}/50` : "Ready!"}
  onClick={() => setShowRoleProgress(true)}
/>

<RoleProgressModal
  isOpen={showRoleProgress}
  onClose={() => setShowRoleProgress(false)}
  userId={currentUser.id}
  daoId={selectedDAO.id}
  currentRole={userRole}
  activityPoints={userActivityPoints}
  promotionEligible={promotionEligible}
  onRequestPromotion={handleRequestPromotion}
  onAcceptPromotion={handleAcceptPromotion}
/>
```

### Role Progress Card

```typescript
export function RoleProgressCard({
  currentRole,
  activityPoints,
  promotionEligible,
  onRequestPromotion,
  onAcceptPromotion
}) {
  const targetPoints = 50;
  const progress = (activityPoints / targetPoints) * 100;

  return (
    <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200">
      {/* Current Role */}
      <div className="mb-4">
        <p className="text-sm text-gray-600">Your Role</p>
        <p className="text-lg font-bold text-gray-900">
          {currentRole === 'member' ? '👤 Member' : '👥 Elder'}
        </p>
      </div>

      {/* Progress Bar */}
      {currentRole === 'member' && (
        <>
          <div className="mb-3">
            <div className="flex justify-between mb-2">
              <p className="text-sm font-semibold text-gray-700">Activity Score</p>
              <p className="text-sm font-bold text-gray-900">{activityPoints}/{targetPoints}</p>
            </div>
            <div className="w-full bg-gray-300 rounded-full h-3 overflow-hidden">
              <div
                className="bg-gradient-to-r from-blue-400 to-indigo-500 h-full transition-all"
                style={{ width: `${Math.min(progress, 100)}%` }}
              />
            </div>
          </div>

          {/* Status Message */}
          {promotionEligible ? (
            <div className="p-3 bg-green-50 border border-green-200 rounded mb-4">
              <p className="text-sm font-semibold text-green-700">
                ✅ You're eligible for Elder status!
              </p>
              <p className="text-xs text-green-600 mt-1">
                Accept to unlock proposal creation.
              </p>
            </div>
          ) : (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded mb-4">
              <p className="text-sm text-gray-700">
                <strong>{targetPoints - activityPoints}</strong> more points to unlock Elder
              </p>
              <p className="text-xs text-gray-600 mt-1">
                Vote, comment, and participate to earn points
              </p>
            </div>
          )}

          {/* Actions */}
          {promotionEligible && (
            <div className="space-y-2">
              <button
                onClick={onAcceptPromotion}
                className="w-full bg-green-500 hover:bg-green-600 text-white font-semibold py-2 rounded-lg"
              >
                Accept Elder Status ✓
              </button>
              <button
                onClick={onRequestPromotion}
                className="w-full border-2 border-blue-500 text-blue-500 hover:bg-blue-50 font-semibold py-2 rounded-lg"
              >
                Request Early Promotion
              </button>
            </div>
          )}
        </>
      )}

      {/* Elder View */}
      {currentRole === 'elder' && (
        <div>
          <p className="text-sm text-gray-700 mb-3">
            You have leadership responsibilities. Use your position wisely!
          </p>
          <div className="space-y-2 text-sm text-gray-700">
            <p>✅ Create proposals (general & budget)</p>
            <p>✅ Vote with 2x weight</p>
            <p>✅ Create emergency proposals</p>
          </div>
        </div>
      )}
    </div>
  );
}
```

---

## ✨ BENEFITS OF NEW SYSTEM

```
For Members:
✅ Clear path to leadership (activity → points → Elder)
✅ Merit-based (earn it through participation)
✅ Transparent criteria (see exact points needed)
✅ Can request early promotion (no gatekeeping)
✅ See what earns points (incentivizes engagement)

For Elders/Admins:
✅ Less burden (system auto-promotes)
✅ Can still discretionary promote (when needed)
✅ Can identify quiet but valuable members
✅ Audit trail (see who promoted whom)
✅ Can request promotion from members

For DAOs:
✅ More engaged community (gamified participation)
✅ Distributed leadership (more Elders over time)
✅ Quality proposals (more thoughtful members)
✅ Reduced admin burden (auto-promotion)
✅ Transparency (everyone sees the system)
```

---

## 🚀 IMPLEMENTATION PHASES

### Phase 1: Activity Tracking (Week 1)
- [ ] Add activity logging to database
- [ ] Award points for votes, comments, proposals
- [ ] Calculate current activity scores

### Phase 2: Auto-Promotion (Week 2)
- [ ] Check eligibility for auto-promotion
- [ ] Send notifications to eligible members
- [ ] Implement accept/decline flow
- [ ] Track promotion history

### Phase 3: UI Integration (Week 3)
- [ ] Build RoleProgressCard component
- [ ] Integrate into Okedi dashboard
- [ ] Show activity history
- [ ] Build request promotion flow

### Phase 4: Admin Tools (Week 4)
- [ ] Admin panel for discretionary promotion
- [ ] View all member activity
- [ ] Promotion audit trail
- [ ] Suggest members for promotion

---

**Status**: Role progression system designed & ready for implementation  
**Next**: Build activity-based auto-promotion logic
