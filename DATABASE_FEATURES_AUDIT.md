# 📊 Complete Database Features Audit

**Database:** PostgreSQL (Drizzle ORM)  
**Total Tables:** 85+  
**Last Updated:** November 20, 2025

---

## 📋 All Database Tables by Feature Category

### 1. AUTHENTICATION & USER MANAGEMENT (8 tables)

```
✅ users
   ├─ id, name, username, email, phone
   ├─ password, emailVerified, phoneVerified
   ├─ walletAddress (Celo wallet)
   ├─ kycStatus, kycDocuments
   └─ Features: Login, signup, KYC, profile

✅ sessions
   ├─ id, userId, sessionToken
   ├─ expiresAt
   └─ Features: Session management, auto-login

✅ userContexts
   ├─ userId, dao_context, member_context
   ├─ treasury_context, governance_context
   └─ Features: User preferences, contextual data

✅ userActivities
   ├─ userId, activity_type, description
   ├─ daoId, timestamp
   └─ Features: Activity tracking, user behavior

✅ userReputation
   ├─ userId, daoId, reputation_score
   ├─ badges, achievements
   └─ Features: Reputation system, gamification

✅ notificationPreferences
   ├─ userId, daoId
   ├─ emailNotifications, pushNotifications, telegram
   └─ Features: Notification settings per user/DAO

✅ auditLogs
   ├─ userId, action, entity, changes
   ├─ timestamp, ipAddress
   └─ Features: Compliance, audit trail

✅ userAnnouncementViews
   ├─ userId, announcementId, viewedAt
   └─ Features: Track announcement views
```

---

### 2. DAO MANAGEMENT (9 tables)

```
✅ daos
   ├─ id, name, description
   ├─ founderWalletAddress, treasuryWalletAddress
   ├─ governanceType, members, status
   ├─ createdAt, updatedAt
   └─ Features: Core DAO creation, configuration

✅ daoMemberships
   ├─ userId, daoId, role
   ├─ joinedAt, permissions
   └─ Features: Member management, roles

✅ daoInvitations
   ├─ daoId, invitedEmail, invitedPhone
   ├─ invitedBy, expiresAt, status
   ├─ inviteType (elder, member, guest)
   └─ Features: Member invitations, role assignment

✅ daoInvites
   ├─ id, daoId, inviteeEmail
   ├─ status, sentAt, expiresAt
   └─ Features: Invitation tracking (duplicate of daoInvitations?)

✅ daoRules
   ├─ daoId, ruleName, ruleDescription
   ├─ ruleType, enforcementType, parameters
   └─ Features: DAO governance rules

✅ daoRotationCycles
   ├─ daoId, cycleNumber, status
   ├─ startDate, endDate
   ├─ currentHolder, rotation_schedule
   └─ Features: Rotating leadership (Mzee system)

✅ ruleAuditLog
   ├─ daoId, ruleId, action (created/updated/enforced)
   ├─ timestamp, userId
   └─ Features: Track rule changes

✅ daoCreationTracker
   ├─ daoId, creatorId, status
   ├─ checklist (KYC, treasury, members, etc.)
   └─ Features: DAO creation progress tracking

✅ daoSocialVerifications
   ├─ daoId, provider (Twitter, Discord, etc.)
   ├─ verificationCode, verifiedAt
   └─ Features: Social media verification
```

---

### 3. PROPOSALS & GOVERNANCE (10 tables)

```
✅ proposals
   ├─ id, daoId, creatorId, title, description
   ├─ type (payment, governance, investment, etc.)
   ├─ status (draft, published, voting, approved, rejected, executed)
   ├─ startTime, endTime, executedAt
   ├─ requiredQuorum, votesRequired
   └─ Features: Full proposal lifecycle

✅ proposalTemplates
   ├─ id, daoId, name, description
   ├─ proposalType, defaultFields
   └─ Features: Reusable proposal templates

✅ votes
   ├─ id, proposalId, userId, choice (yes/no/abstain)
   ├─ power (voting power multiplier)
   ├─ timestamp
   └─ Features: Vote casting, voting power

✅ voteDelegations
   ├─ daoId, delegatorId, delegateeId
   ├─ delegationPower, startDate, endDate
   └─ Features: Vote delegation

✅ proposalExecutionQueue
   ├─ id, proposalId, executionType
   ├─ parameters, scheduledTime, executedTime
   ├─ status (pending, executing, completed, failed)
   └─ Features: Automatic proposal execution

✅ quorumHistory
   ├─ daoId, proposalId, requiredQuorum
   ├─ actualParticipation, timestamp
   └─ Features: Track quorum over time

✅ proposalComments
   ├─ id, proposalId, userId, content
   ├─ likes, timestamp
   └─ Features: Proposal discussion

✅ proposalLikes
   ├─ proposalId, userId
   └─ Features: Like proposals

✅ commentLikes
   ├─ commentId, userId
   └─ Features: Like comments

✅ poolProposals (Investment Pool Governance)
   ├─ id, poolId, proposalType, status
   ├─ createdBy, votesRequired
   └─ Features: Pool-specific proposals
```

---

### 4. TREASURY & FINANCIAL MANAGEMENT (15 tables)

```
✅ vaults
   ├─ id, daoId, name, balance
   ├─ type (treasury, savings, investment, contingency)
   ├─ createdBy, status
   ├─ managementFee, performanceFee
   └─ Features: Treasury management, multi-vault support

✅ walletTransactions
   ├─ id, fromWallet, toWallet, amount
   ├─ currency (CELO, cUSD, cEUR, cREAL, MTAA)
   ├─ type (transfer, deposit, withdrawal, swap)
   ├─ hash, blockNumber, timestamp
   └─ Features: Wallet transaction history

✅ paymentTransactions
   ├─ id, daoId, amount, currency
   ├─ fromId, toId, type (subscription, refund, etc.)
   ├─ status (pending, completed, failed)
   ├─ stripeId, metadata
   └─ Features: Payment processing tracking

✅ paymentReceipts
   ├─ id, transactionId, receiptUrl
   ├─ downloadedAt
   └─ Features: Receipt generation

✅ paymentRequests
   ├─ id, daoId, requestedBy, amount
   ├─ currency, description
   ├─ status (pending, approved, paid, rejected)
   ├─ deadline, approvedBy
   └─ Features: Payment request workflow

✅ treasuryMultisigTransactions
   ├─ id, treasuryId, transactionData
   ├─ requiredSignatures, currentSignatures
   ├─ status (pending, approved, executed)
   ├─ createdAt, executedAt
   └─ Features: Multi-sig treasury management

✅ treasuryBudgetAllocations
   ├─ id, treasuryId, category, amount
   ├─ allocatedBy, allocatedAt
   ├─ spent, remaining
   └─ Features: Budget planning & tracking

✅ treasuryAuditLog
   ├─ id, treasuryId, action
   ├─ userId, amount, timestamp
   └─ Features: Complete audit trail

✅ vaultTokenHoldings
   ├─ vaultId, tokenAddress, balance
   ├─ currentValue, timestamp
   └─ Features: Track vault asset holdings

✅ vaultPerformance
   ├─ vaultId, startBalance, endBalance
   ├─ returns, roi, timestamp
   └─ Features: Vault performance analytics

✅ vaultTransactions
   ├─ id, vaultId, type
   ├─ fromAsset, toAsset, amount
   ├─ price, slippage, timestamp
   └─ Features: Yield farming transactions

✅ vaultRiskAssessments
   ├─ vaultId, riskScore, factors
   ├─ recommendations, timestamp
   └─ Features: AI risk assessment

✅ vaultGovernanceProposals
   ├─ vaultId, proposalId
   ├─ status, votingPower
   └─ Features: Vault-specific governance

✅ vaultStrategyAllocations
   ├─ vaultId, strategyId, percentage
   ├─ rebalancedAt
   └─ Features: DeFi strategy allocation

✅ billingHistory
   ├─ id, daoId, amount, currency
   ├─ billingDate, dueDate, status
   ├─ invoiceUrl
   └─ Features: Subscription billing
```

---

### 5. PAYMENTS & REVENUE (6 tables)

```
✅ platformRevenue
   ├─ id, daoId, revenueType
   ├─ amount, currency
   ├─ sourceFeature (locked_savings, investment_pools, etc.)
   ├─ timestamp
   └─ Features: Track all platform revenue

✅ subscriptions
   ├─ daoId, tier (free, team, collective, enterprise)
   ├─ startDate, renewalDate, expiresAt
   ├─ amount, currency, status
   ├─ autoRenew, canceledAt
   └─ Features: Subscription billing/renewal management

✅ billingHistory ⚠️
   ├─ id, daoId, amount, currency, status
   ├─ description, createdAt
   └─ Features: Subscription billing history (NOT member contributions)
   └─ NOTE: Use 'contributions' table for member contributions

✅ crossChainTransfers
   ├─ id, fromChain, toChain, amount
   ├─ status, hash, timestamp
   └─ Features: Multi-chain payments

✅ poolSwapTransactions
   ├─ id, poolId, tokenIn, tokenOut
   ├─ amountIn, amountOut, slippage
   ├─ timestamp
   └─ Features: Investment pool trades

✅ paymentTransactions ⚠️
   ├─ id, userId, reference, type, amount
   ├─ currency, provider (Stripe, M-Pesa), status
   ├─ metadata
   └─ Features: Payment method processing (NOT on-chain tracking)
   └─ NOTE: See walletTransactions for on-chain tracking
```

---

### 6. CAPITAL MANAGEMENT (15 tables)

```
✅ lockedSavings
   ├─ id, userId, daoId, amount
   ├─ lockPeriod (3/6/12 months), interestRate
   ├─ status (active, withdrawn, expired)
   ├─ lockedAt, maturityDate, withdrawnAt
   ├─ earlyWithdrawalPenalty
   └─ Features: Locked savings product

✅ savingsGoals
   ├─ userId, daoId, goalName, targetAmount
   ├─ currentAmount, deadline
   ├─ status (active, achieved, abandoned)
   └─ Features: Savings goal tracking

✅ investmentPools
   ├─ id, daoId, name, description
   ├─ targetAmount, currentAmount, status
   ├─ createdBy, approvalRequired
   ├─ startDate, endDate
   ├─ expectedReturn, riskLevel
   └─ Features: Create & manage investment pools

✅ poolInvestments
   ├─ id, poolId, investorId, amount
   ├─ investedAt, status
   ├─ currentValue, returns
   └─ Features: Track individual investments

✅ poolWithdrawals
   ├─ id, poolId, investorId, amount
   ├─ requestedAt, approvedAt, completedAt
   ├─ status (pending, approved, completed)
   ├─ penaltyApplied
   └─ Features: Withdrawal requests & penalties

✅ poolAssets
   ├─ id, poolId, assetType (token, defi, etc.)
   ├─ allocation (%), currentValue
   └─ Features: Track assets in pools

✅ poolPerformance
   ├─ poolId, startValue, endValue
   ├─ returns, roi, timestamp
   └─ Features: Pool performance tracking

✅ poolRebalances
   ├─ id, poolId, reason
   ├─ previousAllocations, newAllocations
   ├─ executedAt
   └─ Features: Track rebalancing actions

✅ portfolioTemplates
   ├─ id, name, description
   ├─ allocation (%), riskLevel
   └─ Features: Pre-defined investment templates

✅ templateAssetAllocations
   ├─ templateId, assetType, percentage
   └─ Features: Template asset distribution

✅ rebalancingSettings
   ├─ poolId, threshold, frequency
   ├─ rebalancingRules
   └─ Features: Automated rebalancing config

✅ assetPriceHistory
   ├─ assetId, price, timestamp
   └─ Features: Asset price tracking

✅ poolGovernanceSettings
   ├─ poolId, votingType, quorumRequired
   ├─ parameters
   └─ Features: Pool-specific governance

✅ poolVotes
   ├─ poolId, proposalId, userId, vote
   ├─ votingPower, timestamp
   └─ Features: Pool-specific voting

✅ poolVoteDelegations
   ├─ poolId, delegatorId, delegateeId
   └─ Features: Delegate pool voting power
```

---

### 7. CONTRIBUTIONS & TASKS (5 tables)

```
✅ contributions
   ├─ id, userId, daoId, type
   ├─ amount, description
   ├─ status (pending, approved, rejected)
   ├─ timestamp
   └─ Features: Member contributions tracking

✅ tasks
   ├─ id, daoId, creatorId, title, description
   ├─ reward (in MTAA or currency)
   ├─ status (open, claimed, submitted, completed, disputed)
   ├─ claimerId, deadline
   ├─ requiresVerification, proofUrl
   ├─ difficulty (easy/medium/hard)
   └─ Features: Task bounty system

✅ taskTemplates
   ├─ id, title, description, category
   ├─ difficulty, estimatedHours
   ├─ bountyAmount, deliverables
   ├─ acceptanceCriteria
   ├─ createdBy
   └─ Features: Reusable task templates

✅ taskHistory
   ├─ taskId, userId, action (claimed/submitted/completed)
   ├─ timestamp
   └─ Features: Track task lifecycle

✅ dailyChallenges
   ├─ id, daoId, challengeName, description
   ├─ reward, difficulty
   ├─ date, status
   └─ Features: Daily challenges for engagement
```

---

### 8. REFERRALS & REWARDS (3 tables)

```
✅ referralRewards
   ├─ id, referrerId, referredUserId, daoId
   ├─ rewardAmount, rewardType (signup, contribution, milestone)
   ├─ status (pending, awarded, claimed)
   ├─ vestingSchedule (25% per tranche)
   ├─ claimedAt, awardedAt
   └─ Features: Referral tracking & vesting

✅ userChallenges
   ├─ userId, challengeId, status
   ├─ completedAt
   └─ Features: Track user challenge completion

✅ supportTickets (Related to support/reputation)
   ├─ id, userId, title, description
   ├─ status, priority
   ├─ createdAt, resolvedAt
   └─ Features: Support ticket system
```

---

### 9. MESSAGING & COMMUNICATION (4 tables)

```
✅ daoMessages
   ├─ id, daoId, userId, content
   ├─ messageType (text, proposal_update, alert)
   ├─ timestamp, updatedAt
   ├─ fileAttachments
   └─ Features: In-app messaging, chat history

✅ messageReactions
   ├─ id, messageId, userId, emoji
   ├─ timestamp
   └─ Features: React to messages (Slack-like)

✅ messageAttachments
   ├─ id, messageId, fileUrl, fileType
   ├─ uploadedAt
   └─ Features: File sharing in messages

✅ notificationHistory
   ├─ id, userId, type, content
   ├─ daoId, sentAt, readAt
   └─ Features: Notification tracking
```

---

### 10. INFORMATION & CONTENT (4 tables)

```
✅ platformAnnouncements
   ├─ id, title, content, importance
   ├─ publishedAt, expiresAt
   ├─ targetAudience
   └─ Features: Platform-wide announcements

✅ successStories
   ├─ id, daoId, title, story, author
   ├─ createdAt, updatedAt
   └─ Features: Showcase DAO success stories

✅ daoIdentityNfts
   ├─ id, daoId, nftContract, tokenId
   ├─ issuedAt
   └─ Features: NFT membership cards

✅ vouchers
   ├─ id, daoId, code, description
   ├─ discountType, discountValue
   ├─ expiresAt, usedCount
   └─ Features: Discount codes & promotions
```

---

### 11. BLOCKCHAIN & INFRASTRUCTURE (4 tables)

```
✅ chains
   ├─ id, chainId, chainName (Celo, Polygon, Base)
   ├─ networkStatus
   └─ Features: Supported blockchain networks

✅ chainInfo
   ├─ chainId, name, rpcUrl, blockExplorer
   ├─ gasPrice, blockTime
   └─ Features: Blockchain metadata

✅ crossChainProposals
   ├─ id, proposalId, targetChain
   ├─ status, hash, timestamp
   └─ Features: Cross-chain governance

✅ config
   ├─ id, key, value, type
   └─ Features: System configuration
```

---

### 12. LOGGING & MONITORING (3 tables)

```
✅ logs
   ├─ id, level (info, warn, error), message
   ├─ context, timestamp
   └─ Features: Application logging

✅ systemLogs
   ├─ id, eventType, details
   ├─ timestamp
   └─ Features: System-level event logging

✅ notifications
   ├─ id, userId, type, title, message
   ├─ daoId, timestamp, readAt
   └─ Features: User notifications (separate from notificationHistory)
```

---

## 🎯 Feature-to-Table Mapping

### CORE FEATURES

```
DAO CREATION
├─ daos ✅
├─ daoCreationTracker ✅
├─ daoSocialVerifications ✅
└─ daoIdentityNfts ✅

MEMBER MANAGEMENT
├─ daoMemberships ✅
├─ daoInvitations ✅
├─ daoInvites ✅ (duplicate?)
├─ userReputation ✅
└─ notifications ✅

GOVERNANCE & VOTING
├─ proposals ✅
├─ proposalTemplates ✅
├─ votes ✅
├─ voteDelegations ✅
├─ quorumHistory ✅
├─ proposalExecutionQueue ✅
├─ proposalComments ✅
├─ proposalLikes ✅
└─ commentLikes ✅

TREASURY MANAGEMENT
├─ vaults ✅
├─ walletTransactions ✅
├─ vaultTransactions ✅
├─ vaultTokenHoldings ✅
├─ vaultPerformance ✅
├─ vaultStrategyAllocations ✅
├─ vaultRiskAssessments ✅
├─ vaultGovernanceProposals ✅
├─ treasuryMultisigTransactions ✅
├─ treasuryBudgetAllocations ✅
└─ treasuryAuditLog ✅

PAYMENTS & SUBSCRIPTIONS
├─ paymentTransactions ✅
├─ paymentReceipts ✅
├─ paymentRequests ✅
├─ subscriptions ✅
├─ billingHistory ✅
└─ platformRevenue ✅

LOCKED SAVINGS (Capital Feature)
├─ lockedSavings ✅
└─ savingsGoals ✅

INVESTMENT POOLS (Capital Feature)
├─ investmentPools ✅
├─ poolInvestments ✅
├─ poolWithdrawals ✅
├─ poolAssets ✅
├─ poolPerformance ✅
├─ poolRebalances ✅
├─ poolSwapTransactions ✅
├─ portfolioTemplates ✅
├─ templateAssetAllocations ✅
├─ rebalancingSettings ✅
├─ assetPriceHistory ✅
├─ poolProposals ✅
├─ poolVotes ✅
├─ poolGovernanceSettings ✅
└─ poolVoteDelegations ✅

TASKS & BOUNTIES
├─ tasks ✅
├─ taskTemplates ✅
├─ taskHistory ✅
└─ contributions ✅

REFERRALS
├─ referralRewards ✅
└─ userChallenges ✅

MESSAGING
├─ daoMessages ✅
├─ messageReactions ✅
├─ messageAttachments ✅
└─ notificationHistory ✅

AI & ANALYTICS
├─ userActivities ✅ (behavior data)
├─ vaultRiskAssessments ✅ (AI risk scoring)
├─ treasuryAuditLog ✅ (historical data for forecasting)
└─ platformRevenue ✅ (financial metrics)

AUTHENTICATION & SECURITY
├─ users ✅
├─ sessions ✅
├─ auditLogs ✅
├─ userContexts ✅
└─ notificationPreferences ✅

MULTI-CHAIN
├─ chains ✅
├─ chainInfo ✅
├─ crossChainTransfers ✅
└─ crossChainProposals ✅
```

---

## ⚠️ Critical Tables for Launch (Phase 1)

```
MUST EXIST & WORK:
├─ users (authentication)
├─ daos (DAO creation)
├─ daoMemberships (member management)
├─ proposals (governance)
├─ votes (voting)
├─ vaults (treasury)
├─ walletTransactions (payment tracking)
├─ sessions (auth/session management)
└─ auditLogs (compliance)

NICE TO HAVE IN PHASE 1:
├─ tasks (engagement)
├─ referralRewards (growth)
├─ notifications (engagement)
└─ platformRevenue (metrics)

NOT NEEDED IN PHASE 1:
├─ investmentPools (Phase 2)
├─ lockedSavings (Phase 2)
├─ poolSwapTransactions (Phase 2)
├─ dailyChallenges (Phase 3)
├─ crossChainTransfers (Phase 5)
└─ All advanced governance (later phases)
```

---

## 🔄 Table Dependencies (Migration Order)

```
LEVEL 1 (No dependencies - create first):
├─ users
├─ daos
├─ chains
└─ config

LEVEL 2 (Depends on Level 1):
├─ sessions (→ users)
├─ daoMemberships (→ users, daos)
├─ userContexts (→ users)
├─ userActivities (→ users)
├─ notifications (→ users, daos)
├─ vaults (→ daos)
└─ subscriptions (→ daos)

LEVEL 3 (Depends on Level 2):
├─ proposals (→ daos, users)
├─ votes (→ proposals, users)
├─ walletTransactions (→ users, daos)
├─ paymentTransactions (→ daos)
├─ tasks (→ daos, users)
└─ investmentPools (→ daos)

LEVEL 4 (Complex):
├─ vaultTransactions (→ vaults, walletTransactions)
├─ poolInvestments (→ investmentPools, users)
├─ treasuryMultisigTransactions (→ vaults)
└─ proposalExecutionQueue (→ proposals)
```

---

## 📈 Data Volume Expectations

```
Small DAO (100 members):
├─ users: 100
├─ proposals: 5-10/month = 60/year
├─ votes: 5-10 × 60 = 300-600/year
├─ transactions: 100-500/month = 1,200-6,000/year
└─ Total rows needed: <50k rows

Medium DAO (1,000 members):
├─ users: 1,000
├─ proposals: 20-50/month = 240-600/year
├─ votes: 20-50 × 240-600 = 5k-30k/year
├─ transactions: 1k-5k/month = 12k-60k/year
└─ Total rows needed: <200k rows

Large DAO (10,000+ members):
├─ All of above × 10
└─ Total rows needed: <2M rows
```

PostgreSQL can handle millions of rows efficiently with proper indexing.

---

## ✅ Pre-Launch Checklist

```
DATABASE READINESS:
□ All 85 tables created and tested
□ Foreign key relationships verified
□ Indexes created on frequently-queried columns
□ Constraints enforced (unique, not null, etc.)

CRITICAL FEATURES WORKING:
□ User creation & login (users, sessions)
□ DAO creation (daos, daoCreationTracker)
□ Member invitations (daoInvitations, daoMemberships)
□ Proposals & voting (proposals, votes)
□ Treasury access (vaults, walletTransactions)
□ Payment processing (paymentTransactions)

DATA INTEGRITY:
□ No orphaned records (all foreign keys valid)
□ Cascade deletes configured correctly
□ Audit logs capturing all changes

PERFORMANCE:
□ Queries < 200ms (most common operations)
□ Indexes on userId, daoId, proposalId, etc.
□ Connection pooling configured (20-50 connections)

BACKUP & RECOVERY:
□ Daily backups scheduled
□ Point-in-time recovery tested
□ Disaster recovery plan documented
```

---

## 🚨 Tables Needing Extra Attention

```
1. paymentTransactions
   Why: Money involved - any bugs = revenue loss
   Action: 100% test coverage, manual testing

2. vaults & walletTransactions  
   Why: Funds at risk
   Action: External audit recommended

3. proposals & votes
   Why: Governance integrity - core product
   Action: Unit tests, integration tests, beta testing

4. investmentPools & poolInvestments
   Why: Capital safety
   Action: External audit, formal verification if possible

5. auditLogs & treasuryAuditLog
   Why: Compliance & legal
   Action: Ensure immutable, never delete records
```

---

## 📊 Summary Statistics

```
Total Tables:              85+
Total Columns:             ~600+
Total Features:            30+
Total Foreign Keys:        ~80+

By Category:
├─ User & Auth:            8 tables
├─ DAO Management:          9 tables
├─ Governance:             10 tables
├─ Treasury:               15 tables
├─ Payments:                6 tables
├─ Capital (Savings/Pools): 15 tables
├─ Contributions/Tasks:      5 tables
├─ Referrals:               3 tables
├─ Messaging:               4 tables
├─ Content:                 4 tables
├─ Blockchain:              4 tables
└─ Logging:                 3 tables

Database Size (approx): 500MB - 1GB (fully operational)
Backup Size (approx): 100-200MB (compressed)
```

---

**Status:** All tables defined and ready for migrations  
**Next Step:** Run `npm run db:push` to create tables in PostgreSQL  
**Then:** Verify foreign keys and constraints are working correctly

