# DAO Creation Analysis & Customization Plan

## Current State Assessment

### ✅ What's Good
1. **Categories/DAO Types**: Good foundational set (savings, chama, investment, social, governance, funeral, education, youth, women, other)
2. **Treasury Selection**: Supports cUSD, CELO, dual, and custom stablecoins (USDT, DAI)
3. **Governance Models**: 3 options (1-person-1-vote, weighted-stake, delegated)
4. **Regional Tags**: Supports Kenya regions (Nairobi, Mombasa, Kisumu, Nakuru, Eldoret)
5. **Visibility Options**: Public, Regional, Private
6. **Member Roles**: Member, Moderator, Treasurer, Governor
7. **Peer Invite System**: Members can create peer invite links

### ❌ Issues Found

#### 1. **Not Fully User-Friendly**
- Governance step (Step 2) always shows for ALL DAO types
- No conditional logic for different DAO needs
- Same configuration for savings groups and investment clubs (inappropriate)
- No customization per DAO type
- Treasury multisig setup happens AFTER DAO creation (not configurable during creation)

#### 2. **Doesn't Reflect Project Scope**
- Categories missing for Mtaa's focus areas:
  - ✗ Emergency Relief Funds
  - ✗ Burial/Bereavement Support (implied but not distinct)
  - ✗ Communal Labor Groups
  - ✗ Market Vendors Cooperative
  - ✗ Agricultural Cooperatives
  - ✗ Microfinance Circles
- Limited to Kenyan regions (what about other East Africa?)
- No support for income-generating DAOs (business)

#### 3. **Treasury Selection NOT Properly Structured**
- No link to DAO type (all types can choose treasury independently)
- Savings groups should default to cUSD (stable)
- Investment clubs should allow CELO (growth)
- No tier-based treasury limits per DAO type
- Missing: Daily/Monthly spending limits per DAO type

#### 4. **Short-Term DAOs Don't Support Governance**
- Currently: ALL DAOs get governance controls
- Should be: Short-term DAOs (chamas, burial funds) should SKIP governance
- Database fields exist (`originalDuration`, `currentExtensionDuration`) but not used in UI
- Need: Different flow for time-limited DAOs

#### 5. **Multisig Setup Location**
- ✗ Setup happens in `/api/wallet/multisig/create` AFTER DAO creation
- ✗ Uses mock multisig (not real)
- ✗ No integration with DAO creation flow
- ✓ `treasuryMultisigService` exists and handles:
  - Multi-sig transaction proposals
  - Signer management
  - Daily/monthly limits
  - Audit logging
- ✗ But it's disconnected from initial DAO setup

### 📊 Current Database Schema Fields Used
```typescript
// Used in DAO creation:
- name, description
- creatorId, founderId
- category, visibility
- treasuryBalance, treasuryType (stored as text, not structured)
- quorumPercentage, votingPeriod
- governanceModel (from frontend, not stored)
- members (not stored in creation, added after)

// Available but NOT used in creation:
- plan (free, premium, short_term, collective)
- daoType (free, short_term, collective, meta)
- originalDuration, currentExtensionDuration
- treasuryMultisigEnabled ← Should be set here!
- treasuryRequiredSignatures
- treasurySigners
- treasuryWithdrawalThreshold
- treasuryDailyLimit
- treasuryMonthlyBudget
```

## ✨ Customization Plan

### Phase 1: Add DAO Type Configuration

#### 1A. Define DAO Type Profiles
```typescript
const daoTypeProfiles = {
  shortTerm: {
    label: 'Short-Term Fund',
    icon: '⏱️',
    duration: '30-90 days',
    requiresGovernance: false,
    defaultTreasuryType: 'cUSD',
    allowedTreasuryTypes: ['cUSD'],
    maxMembers: 50,
    requiresMultisig: false,
    examples: ['Chama', 'Burial Fund', 'Event Fund', 'Harvest Pool']
  },
  collective: {
    label: 'Collective / Permanent Group',
    icon: '🤝',
    duration: 'Ongoing',
    requiresGovernance: true,
    defaultTreasuryType: 'cUSD',
    allowedTreasuryTypes: ['cUSD', 'dual'],
    maxMembers: 500,
    requiresMultisig: true,
    examples: ['Savings Group', 'Cooperative', 'Investment Club']
  },
  governance: {
    label: 'Governance DAO',
    icon: '🏛️',
    duration: 'Ongoing',
    requiresGovernance: true,
    defaultTreasuryType: 'dual',
    allowedTreasuryTypes: ['cUSD', 'dual', 'custom'],
    maxMembers: 'Unlimited',
    requiresMultisig: true,
    examples: ['Community Leadership', 'District Council']
  }
};
```

#### 1B. Update Categories by Type
```typescript
shortTermCategories: [
  { value: 'chama', label: 'Chama', emoji: '🤝', desc: 'Rotating savings group' },
  { value: 'burial', label: 'Burial/Bereavement', emoji: '🕊️', desc: 'Support members in loss' },
  { value: 'event', label: 'Event/Harambee', emoji: '🎉', desc: 'Raise funds for occasion' },
  { value: 'emergency', label: 'Emergency Relief', emoji: '🆘', desc: 'Quick response fund' },
  { value: 'harvest', label: 'Harvest Pool', emoji: '🌾', desc: 'Agricultural sharing' }
];

collectiveCategories: [
  { value: 'savings', label: 'Savings Group', emoji: '💰', desc: 'Regular deposits & growth' },
  { value: 'investment', label: 'Investment Club', emoji: '📈', desc: 'Pool for investments' },
  { value: 'cooperative', label: 'Cooperative', emoji: '🏪', desc: 'Market vendors, traders' },
  { value: 'agriculture', label: 'Agricultural Co-op', emoji: '🌾', desc: 'Farming collective' },
  { value: 'microfinance', label: 'Microfinance Circle', emoji: '💳', desc: 'Small loans & lending' },
  { value: 'labor', label: 'Labor/Community Work', emoji: '👷', desc: 'Communal labor group' }
];

governanceCategories: [
  { value: 'governance', label: 'Community Governance', emoji: '🏛️', desc: 'Decision making' },
  { value: 'social', label: 'Social Impact', emoji: '🌍', desc: 'Community welfare' },
  { value: 'education', label: 'Education Fund', emoji: '🎓', desc: 'Scholarships & learning' },
  { value: 'health', label: 'Health Initiative', emoji: '🏥', desc: 'Community health' }
];
```

### Phase 2: Conditional Form Flow

#### 2A. Choose DAO Type First (NEW STEP 1)
```
Step 1: DAO Type Selection
├─ Short-Term (3-6 months)
├─ Collective (Ongoing)
└─ Governance DAO (Community-wide)

Then redirect to appropriate flow
```

#### 2B. Type-Specific Flows
```
SHORT-TERM FLOW:
Step 1: DAO Type → Short-Term
Step 2: Basic Info (name, desc, category from shortTermCategories)
Step 3: Treasury (cUSD only, no governance)
Step 4: Members (no roles beyond member)
Step 5: Preview

COLLECTIVE FLOW:
Step 1: DAO Type → Collective
Step 2: Basic Info (name, desc, category from collectiveCategories)
Step 3: Governance (limited: 1-person-1-vote OR weighted-stake)
Step 4: Treasury (cUSD or dual, WITH multisig config)
Step 5: Members
Step 6: Preview

GOVERNANCE FLOW:
Step 1: DAO Type → Governance
Step 2: Basic Info (governance-focused categories)
Step 3: Governance (all 3 models, advanced options)
Step 4: Treasury (all types, multisig REQUIRED)
Step 5: Members
Step 6: Advanced Settings (budget, policies)
Step 7: Preview
```

### Phase 3: Treasury Structure Integration

#### 3A. Link Treasury to DAO Type
```typescript
// In daoDeployHandler (server/api/dao_deploy.ts)

const treasuryConfig = {
  shortTerm: {
    currency: 'cUSD',
    multisigEnabled: false,
    dailyLimit: '1000',
    monthlyBudget: null,  // No budget for short-term
    requiredSignatures: 1
  },
  collective: {
    currency: daoData.treasuryType || 'cUSD',
    multisigEnabled: true,
    dailyLimit: '5000',
    monthlyBudget: '50000',
    requiredSignatures: 3
  },
  governance: {
    currency: daoData.treasuryType || 'dual',
    multisigEnabled: true,
    dailyLimit: '10000',
    monthlyBudget: null,
    requiredSignatures: 5
  }
};
```

#### 3B. Create Treasury with Multisig Settings
```typescript
// In dao_deploy.ts - DURING DAO creation

const vaultRecord = await db.insert(vaults).values({
  daoId: createdDao.id,
  address: daoData.founderWallet,
  currency: treasuryConfig[daoType].currency,
  vaultType: 'dao_treasury'
});

// SET multisig settings ON THE DAO immediately
await db.update(daos).set({
  treasuryMultisigEnabled: treasuryConfig[daoType].multisigEnabled,
  treasuryRequiredSignatures: treasuryConfig[daoType].requiredSignatures,
  treasuryDailyLimit: treasuryConfig[daoType].dailyLimit,
  treasuryMonthlyBudget: treasuryConfig[daoType].monthlyBudget,
  treasurySigners: [userId]  // Founder is first signer
}).where(eq(daos.id, createdDao.id));
```

### Phase 4: Advanced Customization

#### 4A. Short-Term DAO Specifics
```typescript
// For short-term DAOs, add these fields to form:
- Duration: 30, 60, or 90 days
- Extension allowed: Yes/No
- Auto-resolve: When time expires, disburse equally to members
- Lock period: Days before members can withdraw
```

#### 4B. Governance DAO Specifics
```typescript
// For governance DAOs, add:
- Budget policies (annual budget, quarterly review)
- Decision types (simple majority, supermajority)
- Proposal templates (hiring, spending, policy)
- Voting methods (one-time, recurring motions)
```

### Phase 5: Mtaa-Specific Customization

#### 5A. Add Mtaa Categories
```typescript
mtaaCategories: [
  { value: 'merry-go-round', label: 'Merry-Go-Round', emoji: '🎡', desc: 'Rotating savings' },
  { value: 'harambee', label: 'Harambee Fund', emoji: '🙌', desc: 'Community contribution' },
  { value: 'self-help', label: 'Self-Help Group', emoji: '👥', desc: 'Community development' },
  { value: 'table-banking', label: 'Table Banking', emoji: '🏦', desc: 'Microfinance circle' },
  { value: 'women-group', label: "Women's Self Help", emoji: '👩‍🤝‍👩', desc: 'Women empowerment' },
  { value: 'farmers-union', label: 'Farmers Union', emoji: '🚜', desc: 'Agricultural collective' },
  { value: 'trader-coop', label: 'Traders Cooperative', emoji: '🛍️', desc: 'Market vendors' },
  { value: 'youth-group', label: 'Youth Group', emoji: '🎯', desc: 'Youth led initiatives' }
];
```

#### 5B. Add Regional Expansion
```typescript
// Beyond Kenya
expandedRegions: [
  // Kenya
  { country: 'Kenya', regions: ['Nairobi', 'Mombasa', 'Kisumu', 'Nakuru', 'Eldoret', 'Kericho', 'Kisii'] },
  // Tanzania
  { country: 'Tanzania', regions: ['Dar es Salaam', 'Arusha', 'Dodoma'] },
  // Uganda
  { country: 'Uganda', regions: ['Kampala', 'Jinja', 'Mbarara'] },
  // Rwanda
  { country: 'Rwanda', regions: ['Kigali', 'Huye'] }
];
```

## Implementation Roadmap

### ✅ IMMEDIATE (This Week)
1. Add DAO Type selection as Step 1
2. Implement conditional flows (short-term vs collective vs governance)
3. Link treasury options to DAO type (restrict choices)
4. Hide governance section for short-term DAOs
5. Save `daoType` to database during creation

### 📅 SHORT-TERM (Next 1-2 weeks)
1. Update categories to Mtaa-specific options
2. Add multisig configuration during creation (not after)
3. Set treasury limits based on DAO type
4. Add regional expansion
5. Store all treasury settings in DAO record

### 🔄 MEDIUM-TERM (Next 1 month)
1. Add duration selection for short-term DAOs
2. Add budget policies for governance DAOs
3. Create DAO templates (pre-configured options)
4. Add auto-disbursement logic for short-term DAOs
5. Create admin dashboard for multisig management

### 🚀 LONG-TERM (Future)
1. Smart contract deployment per DAO type
2. On-chain treasury verification
3. Automated proposal creation for new DAOs
4. Integration with mobile money (M-Pesa, USSD)
5. Regional DAO federation (meta-DAOs)

## Critical Changes Required

### 1. Frontend (create-dao.tsx)
```typescript
// ADD: New conditional rendering based on daoType
if (daoType === 'shortTerm') {
  // Skip governance step
  renderGovernance = null;
}

// ADD: Dynamic categories
const categoryOptions = daoTypeProfiles[daoType].categories;

// ADD: Dynamic treasury options
const treasuryOptions = daoTypeProfiles[daoType].allowedTreasuryTypes;

// ADD: Duration selector for short-term
if (daoType === 'shortTerm') {
  showDurationSelector = true;
}
```

### 2. Backend (dao_deploy.ts)
```typescript
// ADD: Receive daoType from frontend
const { daoType, duration, ...daoData } = req.body;

// ADD: Apply treasury config based on type
const config = treasuryConfig[daoType];

// ADD: Store multisig settings during creation
await db.update(daos).set({
  daoType: daoType,
  plan: daoType === 'shortTerm' ? 'short_term' : 'collective',
  treasuryMultisigEnabled: config.multisigEnabled,
  treasuryRequiredSignatures: config.requiredSignatures,
  treasuryDailyLimit: config.dailyLimit,
  treasuryMonthlyBudget: config.monthlyBudget,
  originalDuration: duration
});
```

### 3. Database
```sql
-- Already have these fields, just need to populate:
UPDATE daos SET 
  dao_type = 'short_term|collective|governance',
  plan = 'short_term|collective',
  treasury_multisig_enabled = true/false,
  treasury_required_signatures = 1|3|5,
  treasury_daily_limit = AMOUNT,
  treasury_monthly_budget = AMOUNT,
  original_duration = DAYS (for short-term only)
WHERE ...
```

## Summary

### Current Problems
1. ❌ Same flow for all DAO types (not user-friendly)
2. ❌ Governance forced on short-term DAOs (inappropriate)
3. ❌ Multisig setup happens after creation (should be during)
4. ❌ Treasury not linked to DAO type requirements
5. ❌ Limited to Kenya, missing Mtaa project categories

### Your Requirements Met
1. ✅ User-friendly: Different flows per DAO type
2. ✅ Reflects project: Mtaa-specific categories (merry-go-round, harambee, etc.)
3. ✅ Different DAO types: Short-term, Collective, Governance
4. ✅ Treasury customization: Currency, limits, multisig per type
5. ✅ Multisig: Configured during creation, not after
6. ✅ Short-term DAOs: Skip governance if not needed

**Ready to implement?** Let me know which phase to start with!
