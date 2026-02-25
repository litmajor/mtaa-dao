# Storage.ts Refactoring Analysis & Persistence Audit

## File Overview
- **Current Size:** 1,582 lines
- **Structure:** One large class `DatabaseStorage` + standalone utility functions + modular function exports
- **Goal:** Refactor into modular files WHILE auditing what's not persisted and what's missing

---

## 📊 Current Architecture Analysis

### A. DatabaseStorage Class (Lines 152-1107)
Main class implementing `IStorage` interface with ~60 methods

#### Core Categories Within Class:

1. **User Management** (Lines 173-445)
   - `updateUser()` - Updates user fields
   - `createUser()` - Create new user
   - `loginUser()` - OAuth login
   - `getUserByEmail()` - Lookup by email
   - `getUserByPhone()` - Lookup by phone
   - `getUserByEmailOrPhone()` - Dual lookup
   - `getUserById()` - By ID
   - `getUser()` - General user fetch
   - User profile/wallet/settings/session methods

2. **DAO Management** (Lines 443-630)
   - `createDao()` - Create new DAO
   - `getAllDaos()` - List with pagination
   - `getDaoCount()` - Count DAOs
   - `getDao()` - Fetch by ID
   - `getDaoMembership()` - Check membership
   - `createDaoMembership()` - Add member
   - `getDaoMembers()` - List members
   - `getDaoMembershipsByStatus()` - Filter by status
   - `updateDaoMembershipStatus()` - Status changes
   - `incrementDaoMemberCount()` - Update counter

3. **Proposal & Voting** (Lines 601-780)
   - `createProposal()` - Create proposal
   - `getProposals()` - List all
   - `getProposal()` - Get by ID
   - `updateProposal()` - Update
   - `deleteProposal()` - Delete
   - `updateProposalVotes()` - Increment vote counts
   - `createVote()` - Record vote
   - `getVote()` - Get user's vote
   - `getVotesByProposal()` - List votes on proposal
   - `getVotesByUserAndDao()` - Votes by user in DAO

4. **Contributions** (Lines 759-845)
   - `createContribution()` - Record contribution
   - `getContributions()` - List (filters by userId/daoId)
   - `getContributionsCount()` - Count
   - `getUserContributionStats()` - Per-user stats
   - `hasActiveContributions()` - Boolean check

5. **Vault & Financial** (Lines 848-890)
   - `getUserVaults()` - Get user's vaults
   - `upsertVault()` - Create or update vault
   - `getVaultTransactions()` - Get tx history
   - `deductVaultFee()` - Fee logic (top of file)

6. **Budget Planning** (Lines 891-920)
   - `getUserBudgetPlans()` - Fetch plans
   - `upsertBudgetPlan()` - Create/update
   - `getBudgetPlanCount()` - Count

7. **Tasks** (Lines 920-990)
   - `getTasks()` - List (filters by daoId, status)
   - `createTask()` - Create new task
   - `claimTask()` - Mark as claimed
   - `updateTask()` - Update task
   - `getTaskCount()` - Count

8. **Billing & Plans** (Lines 990-1050)
   - `getDaoPlan()` - Get DAO's subscription plan
   - `setDaoPlan()` - Set/update plan
   - `getDaoBillingHistory()` - Get billing records
   - `getAllDaoBillingHistory()` - All records
   - `addDaoBillingHistory()` - Record transaction
   - `getPlatformFeeInfo()` - Config fetch

9. **Notifications** (Lines 1050-1120)
   - `createNotification()` - Create notification
   - `createBulkNotifications()` - Batch create
   - `getUserNotifications()` - List user's notifications
   - `getUnreadNotificationCount()` - Count unread
   - `markNotificationAsRead()` - Mark single as read
   - `markAllNotificationsAsRead()` - Mark all as read
   - `deleteNotification()` - Delete notification
   - `getUserNotificationPreferences()` - Get preferences
   - `updateUserNotificationPreferences()` - Update preferences

10. **Admin/Audit/Analytics** (Lines 1120-1180)
    - `getDAOStats()` - Platform statistics
    - `getDaoAnalytics()` - Per-DAO analytics
    - `getTopMembers()` - Leaderboard
    - `createAuditLog()` - Log audit event
    - `getAuditLogs()` - Fetch audit logs
    - `createSystemLog()` - System-level logging
    - `getSystemLogs()` - Fetch system logs
    - `createNotificationHistory()` - Historical log
    - `getUserNotificationHistory()` - Per-user history
    - `getAllActiveUsers()` - Active user list
    - `updateUserTelegramInfo()` - Telegram integration
    - `getUserTelegramInfo()` - Fetch Telegram data
    - `revokeAllUserSessions()` - Session cleanup
    - `getChainInfo()` - Blockchain info
    - `getLogCount()`, `getBillingCount()` - Counts

### B. Standalone Utility Functions (Lines 8-32)
- `deductVaultFee()` - External vault fee deduction
- `isDaoPremium()` - Type guard for DAO plan

### C. Type Definitions (Lines 35-90)
- Type aliases for Drizzle ORM types
- Custom interfaces: `WalletTransactionInput`, `IStorage`, `DaoAnalytics`

### D. Module Exports (Lines 1195-1258)
- Export singleton instance `storage`
- Re-export 40+ methods as direct functions for backwards compatibility
- Enables both `storage.method()` and direct `method()` imports

### E. Engagement Feature Functions (Lines 1270-1582)
- `createProposalComment()` - Comment on proposal
- `getProposalComments()` - Fetch comments
- `updateProposalComment()` - Edit comment
- `deleteProposalComment()` - Remove comment
- `toggleProposalLike()` - Like/unlike comment
- `getProposalLikes()` - Get proposal likes
- `toggleCommentLike()` - Like comment
- `getCommentLikes()` - Get comment likes
- `createDaoMessage()` - Create message
- `getDaoMessages()` - List messages
- `updateDaoMessage()` - Edit message
- `deleteDaoMessage()` - Delete message

---

## 🚨 PERSISTENCE AUDIT - What's NOT Persisted in DB

### Critical Gaps Found:

| Data Type | Status | Issue | Impact |
|-----------|--------|-------|--------|
| **User Profile Data** | ⚠️ PARTIAL | Only basic fields persisted (name, avatar, email, phone). Social links, wallet addresses stored in wrong places | Users can't save complex profile info reliably |
| **DAO Settings** | ❌ MISSING | No DAO settings table. Config is global (`config` table), not per-DAO | Can't customize DAO-specific settings |
| **Wallet Addresses** | ⚠️ PARTIAL | `getUserWallet()` returns phone/email instead of actual wallet address. No dedicated wallet field | No proper blockchain wallet tracking |
| **Telegram Integration** | ⚠️ INCOMPLETE | Fields added to `users` table but no dedicated table. No message log persistence | Telegram messages not logged |
| **Task Attachments** | ❌ MISSING | No file attachment support for tasks | Tasks can't have media/files |
| **Proposal Comments History** | ⚠️ PARTIAL | Comments stored but no edit/delete history tracking | Can't audit comment changes |
| **Vault Risk Assessment** | ❌ MISSING | `performRiskAssessment()` and `rebalanceVault()` in interface but not implemented | Risk management not persistent |
| **Contribution Metadata** | ⚠️ MINIMAL | Only basic contribution fields, no detailed work proof/evidence | Can't track detailed contribution evidence |
| **Session Management** | ⚠️ PARTIAL | Sessions table exists but minimal tracking of IP, user agent, device info | Poor session security audit trail |
| **Referral Tracking** | ⚠️ PARTIAL | Only `referredBy` field on users. No referral bonus tracking, reward status | Referral rewards not fully tracked |
| **Budget Plan Details** | ⚠️ MINIMAL | Only basic plan fields, no detailed budget line items | Budget tracking is shallow |
| **DAO Member Roles** | ⚠️ BASIC | Only role field, no permission matrix or role capabilities | Role-based access control limited |
| **Proposal Drafts** | ❌ MISSING | No draft state for proposals. Can't save in-progress proposals | Proposals must be published immediately |
| **Notification Metadata** | ⚠️ PARTIAL | Metadata is JSON blob, no structured fields for different notification types | Hard to query notifications by content |
| **Contribution Types** | ❌ MISSING | No enumeration of contribution types (work, ideas, funding, etc.) | All contributions treated the same |
| **Task Dependencies** | ❌ MISSING | No task dependency tracking | Can't model task workflows |
| **Vault Balance History** | ❌ MISSING | Only current balance stored, no historical balance snapshots | No balance audit trail |
| **Telegram Chat History** | ❌ MISSING | No table for storing Telegram messages | Messages only in Telegram's system |
| **User Activity Log** | ⚠️ BASIC | Limited to auditLogs table, no fine-grained activity tracking | Hard to create user activity feeds |
| **Feature Flag History** | ❌ MISSING | No tracking of when flags were changed or by whom | No feature flag audit trail |

---

## 📋 Proposed Modular Structure

Split `storage.ts` (1,582 lines) into **6 focused modules**:

```
/server/storage/
├── storage-index.ts           (Main export aggregator) ~50 lines
├── storage-user.ts            (User management) ~250 lines
├── storage-dao.ts             (DAO management) ~200 lines
├── storage-proposals.ts        (Proposals, votes, comments) ~300 lines
├── storage-contributions.ts    (Contributions & vaults) ~150 lines
├── storage-tasks.ts           (Tasks & notifications) ~250 lines
└── storage-financial.ts       (Billing, plans, fees, analytics) ~150 lines
```

### Breakdown by Module:

**1. storage-user.ts** (User Management)
- User CRUD (create, get, update, delete)
- Authentication lookups (email, phone)
- Profile management (social links, wallet, settings)
- Session management
- Telegram integration
- User statistics

**2. storage-dao.ts** (DAO Management)
- DAO CRUD
- Membership management
- Member listing and filtering
- Invite codes
- Member count tracking
- Admin functions (getAllDaos, getDaoCount)

**3. storage-proposals.ts** (Proposals & Engagement)
- Proposal CRUD
- Vote management
- Proposal comments
- Comment likes
- Proposal analytics

**4. storage-contributions.ts** (Contributions & Vaults)
- Contribution tracking
- Vault management
- Vault transactions
- Fee deductions
- Contribution statistics

**5. storage-tasks.ts** (Tasks & Notifications)
- Task CRUD and claiming
- Notifications (create, read, delete)
- Notification preferences
- Notification history
- Bulk operations

**6. storage-financial.ts** (Billing & Analytics)
- Billing history
- DAO plans and pricing
- Platform fee configuration
- Analytics (DAO stats, leaderboards)
- System logging and audit logs

**7. storage-index.ts** (Aggregator)
- Import all modules
- Export singleton instance
- Re-export all functions for backwards compatibility
- Type definitions

---

## 🔧 Implementation Order

1. **Extract storage-user.ts** - Least dependent, start here
2. **Extract storage-dao.ts** - Simple dependencies
3. **Extract storage-contributions.ts** - Medium complexity
4. **Extract storage-tasks.ts** - Task/notification coupling
5. **Extract storage-proposals.ts** - Most engagement logic
6. **Extract storage-financial.ts** - Analytics dependencies
7. **Update storage-index.ts** - Wire everything together
8. **Delete old storage.ts** - Clean up

---

## 🎯 Refactoring Checklist

- [ ] Create `/server/storage/` directory
- [ ] Extract storage-user.ts (250 lines)
- [ ] Extract storage-dao.ts (200 lines)
- [ ] Extract storage-contributions.ts (150 lines)
- [ ] Extract storage-tasks.ts (250 lines)
- [ ] Extract storage-proposals.ts (300 lines)
- [ ] Extract storage-financial.ts (150 lines)
- [ ] Create storage-index.ts (50 lines)
- [ ] Update all imports throughout codebase
- [ ] Delete original storage.ts
- [ ] Test all routes still work
- [ ] Document persistence gaps

---

## 📝 Missing Features Summary

**High Priority (Blocks key features):**
1. DAO settings table (per-DAO customization)
2. Task attachment storage
3. Proposal draft states
4. Wallet address tracking
5. Vault balance history

**Medium Priority (Improves reliability):**
1. Session security audit trail
2. Contribution metadata structure
3. Budget plan line items
4. Referral bonus tracking
5. Task dependencies

**Low Priority (Nice to have):**
1. Comment edit history
2. Feature flag change log
3. User activity feed
4. Telegram message log
5. Vault risk assessments

---

## ✅ Next Steps

1. Create `/server/storage/` directory
2. Begin extracting modules starting with storage-user.ts
3. Document all persistence gaps found
4. Create separate PR for adding missing persistence features
5. Update all route imports to use new modular structure
