# Treasury System Quick Reference

## DAO Type Treasury Configurations at a Glance

### 🆓 Free / Test DAO

**Best for:** Testing, experimentation, small events  
**Duration:** Ephemeral or short-term

```typescript
{
  daoType: 'free',
  defaultChains: ['CELO'],
  supportedAssets: ['cUSD', 'CELO'],
  multisigRequired: false,
  minSigners: 1,      // Optional
  votingWeightSource: ['deposit', 'equal'],
  features: {
    membersCanDeposit: true,
    customTokenAllowed: false,
    emergencyWithdrawAllowed: false,
    multiChainSupport: false
  }
}
```

**Key Rules:**
- ✅ No quorum required
- ✅ Voting period: 24 hours (optional)
- ✅ Members can deposit anytime
- ❌ No custom tokens allowed
- ❌ Single chain only (CELO)

**Example Use Case:**
```
A group of 5 friends testing the DAO platform
- Can deposit/withdraw easily
- Quick voting (next day)
- No multisig approval needed
- Can add up to 5 members in 1 hour
```

---

### ⏱️ Short-Term DAO

**Best for:** Month-long campaigns, rotating savings, harambees  
**Duration:** 30–90 days (fixed)

```typescript
{
  daoType: 'shortTerm',
  defaultChains: ['CELO'],
  supportedAssets: ['cUSD', 'CELO'],
  multisigRequired: false,
  minSigners: 2,      // Optional but recommended
  votingWeightSource: ['deposit'],
  features: {
    membersCanDeposit: true,
    customTokenAllowed: false,
    emergencyWithdrawAllowed: false,
    multiChainSupport: false
  }
}
```

**Key Rules:**
- ✅ 20% quorum required for voting
- ✅ Voting period: 3 days
- ✅ Fund expiration enforced
- ✅ Members locked in until term ends
- ❌ No custom tokens
- ❌ Single chain only (CELO)

**Example Use Case:**
```
A 60-day rotating savings group (merry-go-round)
- Create on Monday, ends 60 days later
- 10 members, each gets KES 10,000 when their turn comes
- Voting on special withdrawals: 20% must agree
- Multisig optional but recommended for security
- Automatically closes after 60 days
```

---

### 🤝 Collective / Core DAO

**Best for:** Savings groups, cooperatives, table banking, long-term  
**Duration:** Unlimited

```typescript
{
  daoType: 'collective',
  defaultChains: ['CELO', 'ETH'],
  supportedAssets: [
    { symbol: 'CELO', chain: 'CELO', ... },
    { symbol: 'cUSD', chain: 'CELO', ... },
    { symbol: 'USDC', chain: 'ETH', ... },
    { symbol: 'DAI', chain: 'ETH', ... }
  ],
  multisigRequired: true,
  minSigners: 2,
  maxSigners: 5,
  votingWeightSource: ['tokenHolding', 'deposit'],
  features: {
    membersCanDeposit: true,
    customTokenAllowed: true,      // ⭐ Can add custom ERC-20
    emergencyWithdrawAllowed: false,
    multiChainSupport: true         // ⭐ Multi-chain
  }
}
```

**Key Rules:**
- ✅ 20% quorum required
- ✅ Voting period: 7 days
- ✅ Members can deposit/withdraw anytime
- ✅ Peer invite tracking for accountability
- ✅ Multisig required (3-5 signers)
- ✅ Custom tokens allowed (DAO admin can add)
- ✅ Multi-chain support (CELO + Ethereum)

**Example Use Case:**
```
A Savings & Investment Club (SACCO)
- 30 members, long-term focus
- Treasurer, Secretary, Chair are 3 signers (multisig required)
- Can hold multiple currencies: cUSD, CELO, USDC on Ethereum
- 10% dividend voting requires 20% quorum
- Peer invite tracking: each member's referrals tracked
- Admin can add custom token if needed
```

---

### 🏛️ Governance DAO

**Best for:** Community councils, region-wide decisions, major initiatives  
**Duration:** Unlimited

```typescript
{
  daoType: 'governance',
  defaultChains: ['CELO', 'ETH'],
  supportedAssets: [ /* all stablecoins */ ],
  multisigRequired: true,
  minSigners: 3,      // Stricter than collective
  maxSigners: 7,
  votingWeightSource: ['equal', 'tokenHolding'],
  features: {
    membersCanDeposit: true,
    customTokenAllowed: true,
    emergencyWithdrawAllowed: false,
    multiChainSupport: true
  }
}
```

**Key Rules:**
- ✅ 30% quorum required (higher than Collective)
- ✅ Voting period: 14 days
- ✅ Multisig required (3-7 signers)
- ✅ Equal + weighted voting options
- ✅ Custom tokens supported
- ✅ Multi-chain assets

**Example Use Case:**
```
A Regional Health Initiative Fund
- 100+ members across a region
- 5 council members (multisig signers)
- Major decisions need 30% community vote
- 2-week voting period (time for discussion)
- Can hold donations in multiple currencies
- Governance decisions: project selection, budget allocation
```

---

### 🌐 Meta DAO (Network Coordinator)

**Best for:** Multi-DAO coordination, regional networks, federations  
**Duration:** Continuous

```typescript
{
  daoType: 'meta',
  defaultChains: ['CELO', 'ETH', 'BSC', 'POLYGON', 'ARBITRUM'],
  supportedAssets: [ /* all assets across all chains */ ],
  multisigRequired: true,
  minSigners: 3,
  maxSigners: 15,     // ⭐ Maximum flexibility
  votingWeightSource: ['tokenHolding', 'equal'],
  features: {
    membersCanDeposit: true,
    customTokenAllowed: true,
    emergencyWithdrawAllowed: false,
    multiChainSupport: true           // ⭐ All chains
  }
}
```

**Key Rules:**
- ✅ 40% quorum required (strictest)
- ✅ Voting period: 21 days (longest)
- ✅ Multisig required (3-15 signers)
- ✅ All chains supported (CELO, ETH, BSC, Polygon, Arbitrum)
- ✅ All assets supported
- ✅ Maximum flexibility

**Example Use Case:**
```
A National Chama Federation
- Coordinates 50+ local DAOs across Kenya
- 10 regional coordinators (multisig)
- Votes affect entire network: fee changes, protocol updates
- Members vote on which smaller DAOs get network grants
- Assets held on multiple chains for liquidity
- 40% supermajority needed for major decisions
```

---

## Quick Decision Tree

```
What type of DAO are you creating?

├─ Testing/Temporary Event?
│  └─ → FREE DAO ✅
│
├─ 1-3 Month Campaign (e.g., harambee, rotation)?
│  └─ → SHORT-TERM DAO ✅
│
├─ Long-term Savings Group / Cooperative?
│  ├─ Up to 50 members?
│  ├─ Mostly stable assets (cUSD, CELO)?
│  └─ → COLLECTIVE DAO ✅
│
├─ Community Fund / Leadership Council?
│  ├─ 50+ members?
│  ├─ Need equal voting or special roles?
│  └─ → GOVERNANCE DAO ✅
│
└─ Coordinating Multiple DAOs?
   └─ → META DAO ✅
```

---

## Multisig Signer Setup Examples

### Free DAO (Optional Multisig)

```typescript
// Pattern: Single signer (no multisig)
multisigSigners: [],
multisigRequired: false,
minSigners: 1
```

### Collective DAO (Required Multisig)

```typescript
// Pattern: 3 of 3 signers
multisigSigners: [
  'founder_address',      // Founder/President
  'treasurer_address',    // Treasurer
  'secretary_address'     // Secretary
],
multisigRequired: true,
minSigners: 3,
requiredSignatures: 2    // 2 of 3 must agree
```

### Governance DAO (Required Multisig)

```typescript
// Pattern: 5 of 7 signers (more flexible)
multisigSigners: [
  'elder1', 'elder2', 'elder3',      // Core council
  'elder4', 'elder5',                // Secondary council
  'secretary', 'treasurer'           // Administrative
],
multisigRequired: true,
minSigners: 5,
requiredSignatures: 3    // 3 of 5 must agree
```

### Meta DAO (Maximum Flexibility)

```typescript
// Pattern: 9 of 15 signers (distributed governance)
multisigSigners: [
  'region1_rep', 'region1_backup',
  'region2_rep', 'region2_backup',
  'region3_rep', 'region3_backup',
  // ... more regions
],
multisigRequired: true,
minSigners: 9,
requiredSignatures: 5    // 5 of 9 must agree
```

---

## Voting Weight Examples

### Equal Voting (1 Person = 1 Vote)

```typescript
// Used by: Funeral funds, community projects
votingWeightMapping: 'equal'
Result: Each member = 1 vote (regardless of deposit)

Example:
- Alice deposits 10,000 cUSD
- Bob deposits 1,000 cUSD
- In voting: Alice = 1 vote, Bob = 1 vote ✅
```

### Deposit-Based Voting

```typescript
// Used by: Short-term savings, rotating groups
votingWeightMapping: 'deposit'
Result: Each member's vote strength = their deposit

Example:
- Alice deposits 10,000 cUSD → 10,000 voting power
- Bob deposits 1,000 cUSD → 1,000 voting power
- Total voting power: 11,000
- Alice's influence: 91%, Bob's: 9%
```

### Token-Holding Voting

```typescript
// Used by: Investment clubs with governance token
votingWeightMapping: 'tokenHolding'
Result: Vote strength = token/asset balance

Example:
- Alice holds 1,000 DAO tokens
- Bob holds 100 DAO tokens
- Alice can pass vote with 91% support alone
```

---

## Supported Assets by Chain

### CELO Chain
- `CELO` (Native)
- `cUSD` (Stablecoin)

### Ethereum
- `USDC` (Stablecoin)
- `DAI` (Stablecoin)

### Binance Smart Chain
- `USDC` (Stablecoin)

### Custom ERC-20 (if allowed)
- Any token with valid contract address
- Requires DAO type to have `customTokenAllowed: true`

---

## Checklists

### Before Creating a Free DAO
- [ ] DAO name is clear and memorable
- [ ] You have at least 1 member to add
- [ ] You're okay with public visibility
- [ ] No multisig needed (understanding single-signer risk)

### Before Creating a Collective DAO
- [ ] Identified 2-5 trusted elders/signers
- [ ] All signers have wallet addresses
- [ ] Chosen voting period (recommend 7 days)
- [ ] Decided on deposit requirements
- [ ] Agreed on quorum (20% suggested)

### Before Creating a Governance DAO
- [ ] Have 3-7 council members identified
- [ ] Clear governance model chosen
- [ ] Voting period set (recommend 14 days)
- [ ] Emergency withdrawal limits understood
- [ ] Multi-chain balance needs addressed

### Before Creating a Meta DAO
- [ ] Have 3-15 regional representatives
- [ ] Clear federated structure defined
- [ ] Supermajority (40%) understood
- [ ] Multiple chains decision made
- [ ] DAO member DAOs identified

---

## Support Resources

- **Full Documentation**: `TREASURY_SYSTEM_DOCUMENTATION.md`
- **Type Definitions**: `client/src/types/treasury.ts`
- **Configuration Matrix**: `client/src/config/treasury.config.ts`
- **Business Logic**: `client/src/utils/treasury.service.ts`
- **React Hook**: `client/src/hooks/useTreasury.ts`
