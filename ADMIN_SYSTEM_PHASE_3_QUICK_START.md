# Phase 3 Quick Start Guide

## What's New

Phase 3 adds two major features to the admin system:

### 1. Member Management
- View all DAO members
- Filter by role, status, name
- Promote/demote members through role hierarchy
- Remove members with safety checks
- View member statistics

### 2. Voting Configuration
- Configure voting parameters (period, thresholds)
- Choose voting weight type
- Pause/resume voting
- View voting analytics
- Track member participation

---

## Quick Navigation

### Backend Routes

#### Members (`/api/admin/daos/:daoId/members`)
```
GET    /                    → List members
GET    /:memberId          → Get member details
POST   /:memberId/promote  → Promote member
POST   /:memberId/demote   → Demote member
POST   /:memberId/remove   → Remove member
GET    /stats              → Get statistics
```

#### Voting (`/api/admin/daos/:daoId/voting`)
```
GET    /config                    → Get voting settings
PUT    /config                    → Update voting settings
POST   /pause                     → Pause voting
POST   /resume                    → Resume voting
GET    /analytics                 → Get voting analytics
GET    /participation             → Get participation data
```

### Frontend Pages

```
/admin/members  → Member management page
/admin/voting   → Voting configuration page
```

---

## Common Tasks

### List Members
```typescript
// Get all members in a DAO
const response = await fetch('/api/admin/daos/dao_123/members');
const { members } = await response.json();
```

### Promote a Member
```typescript
const response = await fetch(
  '/api/admin/daos/dao_123/members/mem_456/promote',
  {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reason: 'Strong contributor' })
  }
);
```

### Update Voting Settings
```typescript
const response = await fetch(
  '/api/admin/daos/dao_123/voting/config',
  {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      votingPeriodDays: 10,
      approvalThreshold: 0.6,
      minimumParticipation: 0.25,
      votingWeightType: 'stake-based'
    })
  }
);
```

### Pause Voting
```typescript
const response = await fetch(
  '/api/admin/daos/dao_123/voting/pause',
  {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reason: 'Security audit' })
  }
);
```

---

## Permission Model

### Super Admin
- ✓ View members
- ✓ View voting settings
- ✓ View analytics
- ✗ Cannot modify

### DAO Admin
- ✓ View members
- ✓ Manage members (promote/demote/remove)
- ✓ Configure voting
- ✓ Pause/resume voting

---

## Role Hierarchy

```
member → contributor → elder → admin

member:      Can vote only
contributor: Can vote & propose
elder:       Can vote, propose & moderate
admin:       Full DAO management
```

---

## Key Features

### Member Management
- **Search**: Find members by name/email
- **Filter**: By role or status
- **Promote**: Move to next role
- **Demote**: Move to previous role
- **Remove**: Soft delete (prevents removing last admin)
- **Stats**: Real-time member counts

### Voting Configuration
- **Settings**: Control voting mechanics
- **Weight Types**: Equal, stake-based, reputation-based
- **Controls**: Pause/resume voting
- **Analytics**: Pass rates, participation metrics
- **Tracking**: See individual member voting patterns

---

## File Locations

Backend:
- `server/routes/admin/admin-members.ts` - Member routes
- `server/routes/admin/admin-voting.ts` - Voting routes

Frontend:
- `client/pages/admin/members.tsx` - Member page
- `client/pages/admin/voting.tsx` - Voting page
- `client/pages/admin/members.module.css` - Member styles
- `client/pages/admin/voting.module.css` - Voting styles

---

## Testing

### Test in Browser

1. Navigate to `/admin/members`
   - View list of members
   - Search and filter
   - Test promote/demote/remove buttons

2. Navigate to `/admin/voting`
   - View voting settings
   - Click "Edit Settings"
   - Modify parameters and save
   - View analytics

### Test API

```bash
# List members
curl -X GET http://localhost:3000/api/admin/daos/dao_123/members

# Get voting config
curl -X GET http://localhost:3000/api/admin/daos/dao_123/voting/config

# Update voting config
curl -X PUT http://localhost:3000/api/admin/daos/dao_123/voting/config \
  -H "Content-Type: application/json" \
  -d '{"votingPeriodDays":10}'
```

---

## Troubleshooting

**"Access denied" error**
- Check that you're a DAO admin or super admin
- Verify you're accessing the correct DAO

**"Cannot remove last admin"**
- This is expected - system prevents removing all admins
- Promote another member first

**Statistics not updating**
- Stats are calculated in real-time
- Try refreshing the page

---

## Next Steps

Phase 3 is complete! You can now:

1. ✅ Manage DAO members and roles
2. ✅ Configure voting mechanics
3. ✅ Track participation
4. ✅ View analytics

### Potential Phase 4 Features
- Governance proposals workflow
- Treasury management
- Risk assessment framework
- Advanced analytics dashboard

---

## Documentation

For detailed documentation, see:
- `ADMIN_SYSTEM_PHASE_3_COMPLETE.md` - Full specification
- `API_COMPLETE_REFERENCE.md` - API endpoints
- `ADMIN_SYSTEM_COMPLETE.md` - Overall system

---

**Ready to use!** Navigate to `/admin/members` or `/admin/voting` to get started.
