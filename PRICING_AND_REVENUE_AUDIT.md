# 💰 MtaaDAO Pricing & Revenue Audit

**Date:** November 19, 2025  
**Status:** Comprehensive Audit Complete  
**Objective:** Identify all pricing models and revenue sources for unified implementation

---

## 📋 Executive Summary

The MtaaDAO platform currently has **FRAGMENTED pricing and revenue streams** across multiple service layers:

| Category | Count | Status |
|----------|-------|--------|
| **DAO Subscription Tiers** | 4 | Defined in docs + code (INCONSISTENT) |
| **User Subscription Plans** | 3 | Implemented in code (DIFFERENT MODEL) |
| **Transaction Fee Types** | 5+ | Multiple implementations |
| **Revenue Streams** | 5+ | Partially implemented |
| **Vault-Specific Fees** | 2 | Smart contract level |

**CRITICAL ISSUE:** Two completely different subscription models coexist:
1. **DAO-level subscriptions** (Collective pricing model)
2. **User-level subscriptions** (Individual personal vault model)

These need to be **unified into ONE coherent pricing strategy**.

---

## 🎯 PART 1: DAO SUBSCRIPTION TIERS (Documented in Docs)

### Source
📄 `docs-site/pages/pricing/index.mdx`

### Current DAO Pricing Model

#### 1. **Free Tier DAO** 🆓
```
Cost:           ₭0 forever
Platform Fee:   3.0% per transaction
Member Limit:   10 max
Treasury Cap:   ₭50,000 max
Monthly Volume: Limited (20 tx, 10 proposals)
Support:        Community only
AI Queries:     5/day (basic)
```
**Where Used:**
- Testing/learning
- Friend groups
- Student orgs
- One-time fundraisers

---

#### 2. **Short-Term DAO** ⚡
```
Cost:           ₭500 (30 days) | ₭800 (60 days) | ₭1,000 (90 days)
Cost/Day:       ₭16.67 | ₭13.33 | ₭11.11
Platform Fee:   2.5% per transaction
Duration:       Flexible (30/60/90 days)
Members:        Unlimited
Treasury:       Unlimited
Transactions:   Unlimited
AI Queries:     50/day (advanced)
Support:        Email support
```
**Extensions:**
- +30 days: ₭400
- +60 days: ₭700
- Upgrade to Collective: Pay difference

**Where Used:**
- Harambee fundraisers
- Wedding/funeral funds
- Project-specific groups
- Seasonal farmer coops
- Event organization

---

#### 3. **Collective DAO** 💎
```
Cost:           ₭1,500/month (recurring)
Annual:         ₭15,000/year (save 2 months)
Effective:      ₭1,250/month if paying yearly
Platform Fee:   2.5% per transaction
Members:        Unlimited
Treasury:       Unlimited
Transactions:   Unlimited
Proposals:      Unlimited
AI Queries:     Unlimited
Support:        24-48 hour priority support
Features:       Premium analytics, custom branding, MetaDAO access, API access
```
**Economies of Scale Example:**
- 50-member DAO: ₭30/member/month
- 200-member DAO: ₭7.50/member/month

**Where Used:**
- Chama savings groups
- Burial societies
- Farmer cooperatives
- Business partnerships
- Creative collectives
- Long-term community projects

---

#### 4. **MetaDAO** 🌍
```
Cost:           Custom (₭15,000-₭50,000+/month)
Platform Fee:   2.0% per transaction (lowest)
Duration:       Custom contracts

Starter:        3-5 DAOs, 200-500 members → ₭15,000/month
Growth:         6-15 DAOs, 501-2,000 members → ₭35,000/month
Enterprise:     16+ DAOs, 2,001+ members → Custom pricing

Features:       Multi-DAO coordination, cross-DAO treasury, quadratic voting,
                dedicated account manager, custom integrations, white-label,
                SLA guarantees, on-site training
```
**Where Used:**
- Regional farmer networks
- Creative industry collectives
- Multi-county initiatives
- Supply chain coordination
- Sectoral associations

---

## 👤 PART 2: USER SUBSCRIPTION PLANS (Implemented in Code)

### Source
📄 `server/services/userSubscriptionService.ts`

**⚠️ COMPLETELY DIFFERENT MODEL FROM DAO SUBSCRIPTIONS**

### Current User Pricing Model (Personal Vaults)

#### 1. **Free Plan** 🆓
```
Cost:           ₭0
Vault Limit:    1 personal vault
Analytics:      Weekly (standard)
Features:       Basic wallet, transaction history, community support
Withdrawals:    Standard speed
```

#### 2. **Premium Plan** 💎
```
Cost:
  - Daily:      ₭20/day
  - Weekly:     ₭100/week
  - Monthly:    ₭500/month
  - Yearly:     ₭5,000/year (savings available)

Vault Limit:    5 personal vaults
Analytics:      Daily (advanced)
Features:       Everything in Free + instant withdrawals, priority support,
                custom strategies, ad-free, export reports
```

#### 3. **Power Plan** ⚡
```
Cost:
  - Daily:      ₭50/day
  - Weekly:     ₭250/week
  - Monthly:    ₭1,500/month
  - Yearly:     ₭15,000/year

Vault Limit:    20 personal vaults
Analytics:      AI-powered
Features:       Everything in Premium + auto-rebalancing, API access,
                white-label options, dedicated account manager,
                custom integrations
```

**Billing Cycles Supported:**
- Daily
- Weekly
- Monthly
- Yearly (with discount)

---

## 💳 PART 3: TRANSACTION FEES (Code Implementation)

### Source
📄 `server/services/revenueService.ts`

### Type 1: Platform Transaction Fees (by DAO tier)

| DAO Tier | Deposit Fee | Withdrawal Fee | Network |
|----------|-------------|----------------|---------|
| Free | 3.0% | 3.0% | Platform |
| Short-Term | 2.5% | 2.5% | Platform |
| Collective | 2.5% | 2.5% | Platform |
| MetaDAO | 2.0% | 2.0% | Platform |

---

### Type 2: Transaction Type Fees (On/Off-Ramp)

```typescript
On-Ramp Fee:    1.0% (fiat → crypto)
Off-Ramp Fee:   1.0% (crypto → fiat)
Swap Fee:       0.3% (token-to-token)
Minimum Fee:    $0.10 USD
```

**Where Implemented:**
- `calculateTransactionFee()` in RevenueService
- Applied to M-Pesa, bank transfers, crypto conversions

---

### Type 3: Payment Method Fees (Pass-Through)

#### M-Pesa
```
Contributions:  Standard M-Pesa charges (~₭10-₭100 depending on amount)
Withdrawals:    Standard M-Pesa B2C charges
MtaaDAO Add:    NO extra fees on top
```

#### Bank Transfer
```
Pesalink:       Usually free
EFT:            ₭50-₭100 (bank charges)
RTGS:           ₭200-₭500 (for large amounts)
MtaaDAO Add:    NO extra fees on top
```

#### Crypto Wallet (Gas Fees - Pass-Through)
```
Celo:           ~₭5-₭15 per transaction
Polygon:        ~₭1-₭5 per transaction
Ethereum L2:    ~₭10-₭30 per transaction
MtaaDAO Add:    NO extra fees on top
```

---

### Type 4: Vault Management Fees (Smart Contract)

#### Management Fee (Annual)
```
Default:        2% of Assets Under Management (AUM)
Calculated:     Annual fee ÷ 365 days
Trigger:        Daily accrual in smart contract
Distribution:   Split between Platform (configurable) and DAO
```

#### Performance Fee (On Profit)
```
Default:        10% of profits (above high-water mark)
Trigger:        Only when vault profit exceeds previous high
Distribution:   Split between Platform and DAO treasury
Example:        If vault grows 25%, profit = 25% of shares
                Performance fee = 10% of that profit
```

**Where Implemented:**
📄 `contracts/MaonoVault.sol` (lines 375-410)

---

## 💰 PART 4: REVENUE STREAMS (Documented & Planned)

### Source
📄 `docs/USER_JOURNEY_COMPLETE.md`  
📄 `server/services/revenueService.ts` (partial)

### Implemented Revenue Streams

| # | Stream | Implementation | Status | Estimated Revenue |
|---|--------|-----------------|--------|-------------------|
| **1** | DAO Subscriptions | subscriptionService.ts | ✅ Partial | High |
| **2** | User Subscriptions | userSubscriptionService.ts | ✅ Partial | Medium |
| **3** | Platform Transaction Fees | revenueService.ts | ✅ Partial | High |
| **4** | On/Off-Ramp Fees | revenueService.ts | ✅ Partial | Medium |
| **5** | Vault Performance Fees | MaonoVault.sol | ✅ Implemented | Medium |
| **6** | Vault Management Fees | MaonoVault.sol | ✅ Implemented | Low-Medium |

---

### Planned Revenue Streams (Not Yet Implemented)

| # | Stream | Implementation | Status | Priority |
|---|--------|-----------------|--------|----------|
| **7** | Affiliate Yield Fees | calculateAffiliateYield() | 🚧 Stub | Medium |
| **8** | MTAA Marketplace Revenue | getMTAAMarketplaceRevenue() | 🚧 Stub | Medium |
| **9** | API Premium Access | None yet | ❌ Not Started | Low |
| **10** | White-Label Licensing | None yet | ❌ Not Started | Low |
| **11** | Premium AI Reports | None yet | ❌ Not Started | Low |
| **12** | Cross-Chain Swaps | swapFee: 0.3% | 🚧 Partial | Medium |

---

## 🚨 PART 5: PRICING INCONSISTENCIES & CONFLICTS

### CRITICAL ISSUE #1: Two Subscription Models

**Problem:** DAOs and Users have completely different pricing structures:

```
DAO Subscriptions (docs):
  ├─ Free Tier (₭0)
  ├─ Short-Term (₭500-₭1,000 one-time)
  ├─ Collective (₭1,500/month)
  └─ MetaDAO (₭15,000-₭50,000/month)

User Subscriptions (code):
  ├─ Free (₭0)
  ├─ Premium (₭500-₭5,000/month)
  └─ Power (₭1,500-₭15,000/month)
```

**Result:** Platform is confusing and hard to monetize

---

### CRITICAL ISSUE #2: Fee Structure Conflicts

**In Documentation:**
```
DAO Tier          Platform Fee
─────────────────────────────
Free              3.0%
Short-Term        2.5%
Collective        2.5%
MetaDAO           2.0%
```

**In Code (revenueService):**
```
On-Ramp:          1.0%
Off-Ramp:         1.0%
Swap:             0.3%
```

**Unclear:** Which applies when? How do they combine?

---

### CRITICAL ISSUE #3: Vault vs DAO Fees

```
Vault Level (Smart Contract):
  ├─ Management: 2% annual
  └─ Performance: 10% on profit

DAO Level (Platform):
  └─ Transaction: 2.0-3.0% per transaction
```

**Conflict:** When a user deposits to a vault in a DAO:
- Which fees apply?
- In what order?
- How is it split?

---

### CRITICAL ISSUE #4: Missing Integration

```
userSubscriptionService.ts
  ├─ Billings: user_subscriptions table
  └─ Payments: stripe integration

subscriptionService.ts
  ├─ Billings: billingHistory table
  └─ Payments: split methods (vault, stripe, split_equal, etc)

revenueService.ts
  ├─ Billings: platform_revenue table
  └─ Payments: NONE - only calculation logic
```

**Result:** Revenue isn't properly tracked or reconciled

---

## 📊 PART 6: DATABASE SCHEMA AUDIT

### Tables That Track Pricing/Revenue

```
shared/schema.ts:
  ✅ subscriptions (DAO subscriptions)
  ✅ user_subscriptions (User subscriptions - EXISTS but not fully used)
  ✅ billingHistory (Payment records)
  ✅ paymentTransactions (Payment tracking)
  ✅ paymentReceipts (Receipt records)
  ✅ platformRevenue (Revenue tracking)
  
shared/financialEnhancedSchema.ts:
  ✅ transactionFees (Fee tracking)
  ✅ referralPayouts (Referral rewards)
  ✅ recurringPayments (Subscription tracking)
  ✅ vaultTransactions (Fee capture point)
```

**Issue:** Multiple tables, no unified schema for pricing/billing

---

## 🏗️ PART 7: PROPOSED UNIFIED PRICING MODEL

### Option A: Tier-Based Model (RECOMMENDED)

**SINGLE Unified Tier System:**

```
TIER 1: STARTER (₭0/month)
├─ Max Members: 10
├─ Platform Fee: 3.0%
├─ Features: Basic wallet, 1 personal vault, community support
└─ Use Case: Friends, testing, student orgs

TIER 2: TEAM (₭500/month)
├─ Max Members: 100
├─ Platform Fee: 2.5%
├─ Features: 5 personal vaults, advanced analytics, email support
└─ Use Case: Small chama (50-100 members)

TIER 3: COLLECTIVE (₭1,500/month)
├─ Max Members: 1,000
├─ Platform Fee: 2.0%
├─ Features: Unlimited vaults, AI analytics, priority support, API access
└─ Use Case: Large chama, farmer coops, burial societies

TIER 4: ENTERPRISE (Custom)
├─ Max Members: Unlimited
├─ Platform Fee: 1.5%
├─ Features: White-label, dedicated support, custom integrations
└─ Use Case: MetaDAO networks, regional initiatives
```

**Key Changes:**
1. ✅ ONE subscription model for both DAOs and Users
2. ✅ Clear progression with economies of scale
3. ✅ Simple fee structure (single platform fee per tier)
4. ✅ Easy to understand and market

---

### Option B: Pay-As-You-Grow Model (ALTERNATIVE)

**Automatically upgrades based on usage:**

```
Threshold 1:  0-50 members OR <₭50k TVL
  └─ Tier: Free (3.0% platform fee)

Threshold 2:  50-250 members OR ₭50k-₭200k TVL
  └─ Tier: Team (₭500/month, 2.5% platform fee)

Threshold 3:  250-1000 members OR ₭200k-₭1M TVL
  └─ Tier: Collective (₭1,500/month, 2.0% platform fee)

Threshold 4:  1000+ members OR >₭1M TVL
  └─ Tier: Enterprise (Custom, 1.5% platform fee)
```

**Implementation:**
- Check thresholds monthly (automated)
- Notify DAO when upgraded
- Bill on next cycle

---

## 💡 PART 8: RECOMMENDED UNIFIED REVENUE MODEL

### Core Revenue Streams (Unified)

```
STREAM 1: SUBSCRIPTION REVENUE
├─ Tier 1: ₭0
├─ Tier 2: ₭500/month × DAOs
├─ Tier 3: ₭1,500/month × DAOs
├─ Tier 4: Custom × DAOs
└─ TOTAL MODEL: Clear, predictable, scalable

STREAM 2: TRANSACTION FEES
├─ Platform Fee: 2.0-3.0% per transaction (by tier)
├─ On/Off-Ramp: 1.0% (applied to new fiat conversions only)
├─ Swaps: 0.3% (applied to token swaps)
└─ TOTAL MODEL: Consistent across all operations

STREAM 3: VAULT FEES (Smart Contract)
├─ Management: 1.0% annual on AUM (reduced from 2%)
├─ Performance: 8% on profits only (reduced from 10%)
├─ Distribution: 60% Platform, 40% DAO Treasury
└─ TOTAL MODEL: Aligned incentives

STREAM 4: AFFILIATE REVENUE (Coming Soon)
├─ DeFi Protocol Yields: 10-20% affiliate fees
├─ Payment Processor Referrals: 0.5-2% of volume
├─ Partner Integrations: Custom %
└─ TOTAL MODEL: No direct user cost

STREAM 5: PREMIUM ADD-ONS (Optional)
├─ White-Label Deployment: ₭50,000+ setup + 10% of revenue
├─ Custom Integrations: ₭10,000+ per integration
├─ API Premium Tier: ₭5,000-₭50,000/month
├─ Training & Support: ₭100-₭500/hour
└─ TOTAL MODEL: Enterprise upsells
```

---

## 🎯 PART 9: IMPLEMENTATION ROADMAP

### Phase 1: Unification (CRITICAL)
**Timeline: 2 weeks**

```
□ Merge userSubscription and daoSubscription into single model
□ Create unified PRICING_CONFIG table
□ Consolidate fee logic into single revenueService
□ Update database schema for consistency
□ Create migration for existing data
```

### Phase 2: Standardization (IMPORTANT)
**Timeline: 3 weeks**

```
□ Implement single pricing tier system
□ Create unified billing service
□ Consolidate payment methods
□ Add revenue reconciliation service
□ Create unified dashboard for revenue tracking
```

### Phase 3: Optimization (ONGOING)
**Timeline: Monthly**

```
□ Add analytics/reporting on revenue streams
□ A/B test pricing tiers
□ Monitor churn and LTV
□ Optimize fee percentages by tier
□ Implement dynamic pricing if needed
```

---

## 📋 PART 10: PRIORITY ACTION ITEMS

### IMMEDIATE (This Week)
- [ ] **AUDIT COMPLETE** ✅ This document
- [ ] **DECISION**: Choose unified model (Tier-Based or Pay-As-You-Grow)
- [ ] **CREATE**: Unified pricing configuration
- [ ] **NOTIFY**: Engineering team of inconsistencies

### WEEK 2-3 (Next Sprint)
- [ ] **CONSOLIDATE**: Merge subscription services
- [ ] **STANDARDIZE**: Single fee calculation logic
- [ ] **TEST**: Pricing calculations end-to-end
- [ ] **DOCUMENT**: Unified pricing model for team

### WEEK 4-5 (Following Sprint)
- [ ] **IMPLEMENT**: Database migrations
- [ ] **UPDATE**: Frontend pricing pages
- [ ] **MIGRATE**: Existing DAOs to new model
- [ ] **MONITOR**: Revenue tracking accuracy

---

## 📞 Questions for Product Team

1. **Primary Revenue Focus:** Subscriptions or Transaction Fees?
2. **Target Customer:** Individual users or DAO communities?
3. **Pricing Strategy:** Penetration (low price, high volume) or Premium (high price, selected)?
4. **Geographic Strategy:** Kenya-first or Multi-country pricing?
5. **Competitor Positioning:** How do we compare to Stripe, OpenZeppelin, other DAOs?

---

## 🔍 Files to Review/Update

```
AUDIT FINDINGS:

Pricing Defined In:
  ├─ docs-site/pages/pricing/index.mdx (DAO subscriptions)
  ├─ docs-site/pages/dao-types/free-tier.mdx (Free tier details)
  ├─ docs/USER_JOURNEY_COMPLETE.md (Monetization strategy)
  └─ docs-site/pages/features/recurring-payments.mdx (Fee mentions)

Pricing Implemented In:
  ├─ server/services/subscriptionService.ts (DAO subscriptions)
  ├─ server/services/userSubscriptionService.ts (User subscriptions)
  ├─ server/services/revenueService.ts (Transaction fees & calculations)
  ├─ contracts/MaonoVault.sol (Vault fees on-chain)
  ├─ shared/schema.ts (Database tables)
  └─ shared/financialEnhancedSchema.ts (Enhanced financial schema)

Payment Processing:
  ├─ server/payments.ts (Mock payment endpoints)
  ├─ server/services/subscriptionService.ts (Payment methods)
  └─ client/src/pages/SubscriptionManagement.tsx (Payment UI)

RECOMMENDATIONS:
  ├─ Create: unified/pricing.config.ts
  ├─ Create: unified/billingService.ts
  ├─ Create: unified/revenueReconciliation.ts
  ├─ Consolidate: subscriptionService + userSubscriptionService
  └─ Refactor: revenueService to match unified model
```

---

## 📈 Expected Revenue Impact (Unified Model)

### Conservative Estimate (100 DAOs, 1,000 Users)

```
Subscriptions:
  ├─ 50 DAOs × ₭500/month = ₭25,000/month
  ├─ 30 DAOs × ₭1,500/month = ₭45,000/month
  ├─ 5 DAOs × ₭10,000/month = ₭50,000/month
  └─ Subtotal: ₭120,000/month (DAO subscriptions)

  ├─ 500 users × ₭500/month (premium) = ₭250,000/month
  ├─ 200 users × ₭1,500/month (power) = ₭300,000/month
  └─ Subtotal: ₭550,000/month (User subscriptions)

Total Subscriptions: ₭670,000/month

Transaction Fees (2.5% average across ₭100M GMV):
  └─ ₭2,500,000/month

Total Monthly Revenue: ₭3,170,000
Annual Revenue: ₭38,040,000 KES (~$300,000 USD equivalent)
```

---

**NEXT STEP:** Schedule product review meeting to approve unified model and prioritize implementation.
