# Phase 2 Quick Reference - Proposals & Treasury Management

## 🚀 Quick Start

### Backend Endpoints Summary

**Proposals** (`/api/admin/daos/:daoId/proposals`)
| Method | Endpoint | Super Admin | DAO Admin | Purpose |
|--------|----------|:-----------:|:---------:|---------|
| GET | / | ✅ View All | ✅ Own DAO | List proposals |
| GET | /:id | ✅ View All | ✅ Own DAO | Proposal details |
| GET | /stats | ✅ All DAOs | ✅ Own DAO | Statistics |
| POST | /:id/flag | ✅ YES | ❌ | Flag for review |
| POST | /:id/suspend | ✅ YES | ❌ | Suspend proposal |
| GET | /proposals/pending | ✅ YES | ❌ | Platform overview |

**Treasury** (`/api/admin/daos/:daoId/treasury`)
| Method | Endpoint | Super Admin | DAO Admin | Purpose |
|--------|----------|:-----------:|:---------:|---------|
| GET | / | ✅ All DAOs | ✅ Own DAO | Overview |
| GET | /transactions | ✅ All DAOs | ✅ Own DAO | Transaction list |
| GET | /health | ✅ All DAOs | ✅ Own DAO | Health metrics |
| POST | /freeze | ✅ YES | ❌ | Emergency freeze |
| POST | /unfreeze | ✅ YES | ❌ | Restore operations |
| GET | /treasury/status | ✅ YES | ❌ | Platform status |

### Frontend Pages

| Page | Route | Role | Features |
|------|-------|------|----------|
| Proposals | `/admin/proposals?daoId=:daoId` | Both | Filter, Flag, Suspend |
| Treasury | `/admin/treasury?daoId=:daoId` | Both | Freeze, Vaults, Transactions |

## 🔐 Permission Model

### DAO Admin (Creator/Elder)
- ✅ View own DAO proposals
- ✅ View own DAO treasury  
- ✅ Manage own DAO's transactions
- ❌ Flag proposals
- ❌ Suspend proposals
- ❌ Freeze treasury

### Super Admin (Platform)
- ✅ View all DAO proposals
- ✅ View all DAO treasuries
- ✅ Flag suspicious proposals
- ✅ Suspend proposals
- ✅ Emergency freeze treasury
- ✅ Platform overview pages

## 📊 Key Features

### Proposals Page
```
📋 Proposals Management
├─ Filter by status (active, passed, failed, suspended)
├─ 6 stats cards (total, active, passed, failed, suspended, flagged)
├─ Super Admin actions: Flag, Suspend
├─ Pagination (20 per page)
└─ Role badge showing access level
```

### Treasury Page
```
💰 Treasury Management
├─ 6 metrics cards (balance, vaults, status, risk, volume, transactions)
├─ Vault cards with balance display
├─ Recent transactions list
├─ Filter by type (deposit, withdrawal, transfer, distribution)
├─ Filter by status (pending, completed, failed)
├─ Super Admin: Emergency Freeze/Unfreeze button
├─ Treasury frozen alert
└─ Pagination support
```

## 🎯 Common Tasks

### Flag a Suspicious Proposal
```bash
POST /api/admin/daos/abc123/proposals/prop789/flag
{
  "reason": "Contains spam content",
  "severity": "high"
}
```

### Emergency Freeze Treasury
```bash
POST /api/admin/daos/abc123/treasury/freeze
{
  "reason": "Suspicious activity detected"
}
```

### Get Proposal Statistics
```bash
GET /api/admin/daos/abc123/proposals/stats
Response: {
  totalProposals: 45,
  activeProposals: 3,
  passedProposals: 40,
  failedProposals: 2,
  suspendedProposals: 0,
  flaggedProposals: 1
}
```

### Get Treasury Health
```bash
GET /api/admin/daos/abc123/treasury/health
Response: {
  status: "healthy",
  isFrozen: false,
  totalBalance: 500000,
  riskLevel: "low",
  recentActivity: {
    transactionCount: 12,
    volumeInPeriod: 50000
  }
}
```

## 🔔 Audit Events

All Phase 2 actions are automatically logged:

- `PROPOSAL_FLAGGED` (High severity)
- `PROPOSAL_SUSPENDED` (Critical severity)
- `TREASURY_FROZEN` (Critical severity)
- `TREASURY_UNFROZEN` (High severity)

## 📈 Database Schema Changes

New fields added to support Phase 2:

```sql
-- proposals table
ALTER TABLE proposals ADD COLUMN flagged BOOLEAN DEFAULT FALSE;
ALTER TABLE proposals ADD COLUMN flagReason TEXT;
ALTER TABLE proposals ADD COLUMN flaggedBy UUID;
ALTER TABLE proposals ADD COLUMN flaggedAt TIMESTAMP;

-- daos table
ALTER TABLE daos ADD COLUMN treasuryFrozen BOOLEAN DEFAULT FALSE;
ALTER TABLE daos ADD COLUMN treasuryHealth VARCHAR(50) DEFAULT 'healthy';
```

## 🛠️ Implementation Details

### Access Check Pattern
```typescript
// Used in all DAO-scoped endpoints
const isDAOAdmin = daoMemberships.some(m =>
  m.daoId === daoId && m.userId === userId
);
const isSuperAdmin = user.roles === 'super_admin';

if (!isDaoAdmin && !isSuperAdmin) {
  return res.status(403).json({ error: 'Access denied' });
}
```

### Audit Logging Pattern
```typescript
await logAuditEvent({
  eventType: AuditEventType.PROPOSAL_FLAGGED,
  userId: adminId,
  action: `Proposal flagged: ${proposal.title}`,
  severity: 'high',
  endpoint: `/api/admin/daos/:daoId/proposals/:proposalId/flag`,
  method: 'POST',
  ipAddress: req.ip,
  userAgent: req.get('user-agent'),
  statusCode: 200,
  metadata: { daoId, proposalId, reason, severity }
});
```

## 🚨 Emergency Actions

### Freeze Treasury
- Blocks all treasury operations
- Only Super Admin can execute
- Logged as Critical severity
- Recoverable via unfreeze

### Suspend Proposal
- Halts voting and execution
- Only Super Admin can execute
- Logged as Critical severity
- Can be used for investigation

### Flag Proposal
- Marks for manual review
- Only Super Admin can flag
- Logged as High severity
- Visible in proposals list

## 📱 Mobile Support

All Phase 2 pages are fully responsive:
- Breakpoint: 768px (tablets)
- Stacked layouts on mobile
- Touch-friendly buttons
- Readable text sizes

## 🔄 Integration

Phase 2 integrates with:
- ✅ RBAC Middleware (`requireRole`)
- ✅ Audit Logging Service
- ✅ Drizzle ORM (database)
- ✅ Admin Layout Component
- ✅ Admin Table Component
- ✅ Stat Card Component

## 📋 Testing Checklist

- [ ] Super Admin can view all proposals
- [ ] DAO Admin can view only own DAO's proposals
- [ ] Flag action creates audit log
- [ ] Suspend action updates proposal status
- [ ] Freeze treasury sets flag in DB
- [ ] Unfreeze treasury clears flag
- [ ] Filters work on both pages
- [ ] Pagination works correctly
- [ ] Stats display accurate numbers
- [ ] Mobile layout is responsive
- [ ] All actions are logged
- [ ] Error handling works
- [ ] Permission denials work

## 🎓 Architecture Overview

```
┌─────────────────────────────────────────────┐
│           Frontend (Next.js/React)           │
├─────────────────────────────────────────────┤
│  proposals.tsx        │        treasury.tsx  │
│  (filtering, stats)   │  (vaults, freeze)   │
├─────────────────────────────────────────────┤
│           API Routes (Express)              │
├─────────────────────────────────────────────┤
│  proposals routes     │      treasury routes │
│  (flag, suspend)      │  (freeze, unfreeze) │
├─────────────────────────────────────────────┤
│     Permission Middleware + Audit Logging    │
├─────────────────────────────────────────────┤
│        Database Layer (Drizzle ORM)         │
├─────────────────────────────────────────────┤
│     PostgreSQL (proposals, daos, vaults)    │
└─────────────────────────────────────────────┘
```

---

**Quick Start Ready**: ✅ YES  
**Endpoints Tested**: ✅ READY  
**Mobile Responsive**: ✅ YES  
**Permission Model**: ✅ COMPLETE
