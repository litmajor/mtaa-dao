# Phase 1 Implementation Guide

## Contracts Created ✅

Three production-ready contracts have been upgraded/created in `/contracts/`:

1. **MultiSigTreasury.sol** (Phase 1.1) ✅
   - 3-of-5 signatures required
   - 48-hour timelock
   - All treasury operations need community approval

2. **ReputationEngine.sol** (Phase 1.2) ✅
   - Automatic penalties for defaults (-500 pts)
   - 7-day appeals via governance voting
   - Validator consensus (no single point of failure)

3. **FloatingAPYCalculator.sol** (Phase 1.3) ✅
   - APY scales from 18% → 3% based on TVL
   - Governance-adjustable parameters
   - Prevents unsustainable rewards at scale

---

## Integration Checklist

### Step 1: Deploy Contracts on Testnet (Week 1-2)

```bash
# 1. Deploy MultiSigTreasury
# Constructor params:
#   _mtaaToken: 0x... (existing MTAA token address)
#   _signers: [addr1, addr2, addr3, addr4, addr5] (5 signer addresses)

# 2. Deploy ReputationEngine
# Constructor params:
#   _mtaaToken: 0x... (same MTAA token)
#   _owner: 0x... (current owner address)

# 3. Deploy FloatingAPYCalculator
# Constructor params:
#   _mtaaToken: 0x... (same MTAA token)
```

### Step 2: Connect Contracts (Week 2-3)

**In MtaaToken.sol**, add references to new contracts:

```solidity
// Add to MtaaToken.sol
address public multiSigTreasury;
address public reputationEngine;
address public apyCalculator;

constructor(
    address _multiSigTreasury,
    address _reputationEngine,
    address _apyCalculator
) {
    // ... existing constructor code ...
    multiSigTreasury = _multiSigTreasury;
    reputationEngine = _reputationEngine;
    apyCalculator = _apyCalculator;
}
```

### Step 3: Update Fee Collection (Week 2-3)

**Before (old code in MtaaToken.sol)**:
```solidity
// Sends fees to owner wallet (CENTRALIZED)
function _collectFee(address payer, uint256 fee, bytes32 feeType) internal {
    uint256 burnAmount = fee / 2;
    uint256 treasuryAmount = fee - burnAmount;
    _burn(payer, burnAmount);
    _transfer(payer, owner(), treasuryAmount);  // ❌ Owner gets funds directly
}
```

**After (new code using MultiSigTreasury)**:
```solidity
// Sends fees to MultiSigTreasury (DECENTRALIZED)
function _collectFee(address payer, uint256 fee, bytes32 feeType) internal {
    uint256 burnAmount = fee / 2;
    uint256 treasuryAmount = fee - burnAmount;
    _burn(payer, burnAmount);
    _transfer(payer, multiSigTreasury, treasuryAmount);  // ✅ Goes to multi-sig
}
```

### Step 4: Update Staking Rewards (Week 3)

**Before (old code in MtaaToken.sol)**:
```solidity
// Fixed APY (breaks at scale)
function calculateStakeRewards(address staker, uint256 stakeId) 
    public view returns (uint256) 
{
    StakeInfo memory s = stakes[staker][stakeId];
    uint256 multiplier = lockPeriodMultipliers[s.lockPeriod];  // 800-1800 bp (fixed)
    uint256 annualReward = (s.amount * multiplier) / 10_000;
    // ... continues ...
}
```

**After (new code using FloatingAPY)**:
```solidity
// Floating APY (adapts to adoption)
function calculateStakeRewards(address staker, uint256 stakeId) 
    public view returns (uint256) 
{
    StakeInfo memory s = stakes[staker][stakeId];
    
    // Get current floating APY instead of fixed multiplier
    uint256 apy = FloatingAPYCalculator(apyCalculator).calculateAPY(getTotalStaked());
    uint256 annualReward = (s.amount * apy) / 10_000;
    
    uint256 timeStaked = block.timestamp - s.lastRewardClaim;
    uint256 reward = (annualReward * timeStaked) / 365 days;
    
    // Still apply reputation multiplier
    ReputationTier tier = getReputationTier(staker);
    if (tier == ReputationTier.SHOGUN) reward = (reward * 300) / 100;  // 3x
    
    return reward;
}

function getTotalStaked() public view returns (uint256) {
    return totalStakedAmount;  // Track this as state variable
}
```

### Step 5: Wire Reputation Engine to Loan Defaults (Week 3)

**When a loan defaults** (wherever that logic exists), call:

```solidity
// In your vault or lending contract
function recordDefault(address borrower, uint256 loanAmount) internal {
    // ... your liquidation logic ...
    
    // Record reputation penalty
    ReputationEngine(reputationEngine).recordEvent(
        borrower,
        "LOAN_DEFAULT",
        loanAmount,
        -500  // -500 reputation points for default
    );
}
```

### Step 6: Wire Reputation Engine to Loan Repayment (Week 3)

**When a loan is repaid on-time**:

```solidity
// In your vault or lending contract
function recordRepayment(address borrower, uint256 loanAmount) internal {
    // ... your reward logic ...
    
    // Record reputation gain
    ReputationEngine(reputationEngine).recordEvent(
        borrower,
        "LOAN_REPAID",
        loanAmount,
        200  // +200 reputation points for on-time repayment
    );
}
```

---

## Testing Checklist (Week 4)

### MultiSigTreasury Tests

- [ ] Submit transaction with 1 signer
- [ ] Confirm with 2nd signer
- [ ] Cannot execute before 48 hours
- [ ] Confirm with 3rd signer (should now be executable)
- [ ] Execute transaction (48 hours later)
- [ ] 50K MTAA received by recipient
- [ ] Revoke confirmation by 2nd signer (should reduce count)
- [ ] Multiple transactions in parallel (different txn IDs)

### ReputationEngine Tests

- [ ] Record LOAN_DEFAULT event (-500 points)
- [ ] Score updates visible in eventHistory
- [ ] Propose reputation appeal (restore score)
- [ ] Vote on proposal (need 66% approval)
- [ ] Execute proposal after 7 days
- [ ] Score restored (if >66% voted yes)
- [ ] Cannot execute proposal before voting ends
- [ ] getReputationTier() returns correct tier

### FloatingAPYCalculator Tests

- [ ] Calculate APY at TVL = 1M (should be ~1800 or 18%)
- [ ] Calculate APY at TVL = 50M (should still be ~18%)
- [ ] Calculate APY at TVL = 100M (should drop to ~17%)
- [ ] Calculate APY at TVL = 500M (should drop to ~12%)
- [ ] Simulate different TVLs via simulateAPYAtTVL()
- [ ] Update APY parameters (increase base to 1500)
- [ ] New adjustment visible in apyHistory

### Integration Tests

- [ ] User stakes 100 MTAA, receives floating APY rewards
- [ ] DAO creates loan (1K MTAA fee)
- [ ] Fee goes to MultiSigTreasury (not owner)
- [ ] 3 signers confirm fee transfer
- [ ] Wait 48 hours, execute transfer
- [ ] Borrower repays loan on-time
- [ ] Reputation +200 recorded
- [ ] Default triggers -500 reputation penalty
- [ ] Governance can update APY via proposing adjustment

---

## Deployment Order (Mainnet Launch)

**Week 1 (April 28 - May 4)**
- Monday: Deploy MultiSigTreasury → testnet
- Tuesday: Deploy ReputationEngine → testnet
- Wednesday: Deploy FloatingAPYCalculator → testnet
- Thursday: Wire together + test
- Friday: Run full integration test suite

**Week 2 (May 5 - May 11)**
- Monday-Wednesday: Audit prep + documentation
- Thursday-Friday: Security audit begins

**Week 3-4 (May 12 - May 25)**
- Audit completion + bug fixes
- Address audit findings

**Week 5 (May 26 - June 1)**
- Phase 1.1 (MultiSigTreasury) → Mainnet
- First community transaction (pay contributor)

**Week 6 (June 2 - June 8)**
- Phase 1.2 (ReputationEngine) → Mainnet
- Set up validator network, record first events

**Week 7 (June 9 - June 15)**
- Phase 1.3 (FloatingAPY) → Mainnet
- Update MtaaToken to use floating APY

**Week 8 (June 16 - June 22)**
- Full Phase 1 live on mainnet
- Monitor 1-2 weeks for stability

---

## Key Numbers to Track

**Month 4 (Phase 1 Complete)**
- MultiSigTreasury: 10+ transactions executed
- ReputationEngine: 50+ defaults recorded, 10+ appeals processed
- FloatingAPY: APY adjusted 3+ times, <5% variance from forecast
- Audit: ✅ complete, 0 critical findings

**Success Criteria**
✅ No critical bugs in production
✅ Community confidence increased (Discord sentiment)
✅ Governance functioning (multi-sig + appeals working)
✅ Ready for Phase 2 (DAO governance layer)

---

## Support Resources

**For Phase 1.1 (MultiSigTreasury)**
- See: MTAA_REDESIGN_PATTERNS.md → Part 1
- Test: e2e_test_multisig.ts (to be created)

**For Phase 1.2 (ReputationEngine)**
- See: MTAA_REDESIGN_PATTERNS.md → Part 2
- Test: e2e_test_reputation.ts (to be created)

**For Phase 1.3 (FloatingAPY)**
- See: MTAA_REDESIGN_PATTERNS.md → Part 3
- Test: e2e_test_floating_apy.ts (to be created)

**Integration Guidelines**
- See: MTAA_PHASE_1_2_3_ROADMAP.md → Phase 1
- Timeline: 4 weeks (development) + 4 weeks (audit)

---

## Git Workflow

```bash
# Feature branch for Phase 1 integration
git checkout -b feature/phase-1-trinity

# Commits
git add contracts/MultiSigTreasury.sol
git commit -m "feat: Phase 1.1 MultiSigTreasury (3-of-5, 48h timelock)"

git add contracts/ReputationEngine.sol
git commit -m "feat: Phase 1.2 ReputationEngine (decay, appeals, voting)"

git add contracts/FloatingAPYCalculator.sol
git commit -m "feat: Phase 1.3 FloatingAPYCalculator (adaptive rewards)"

git add src/types/phase1.ts
git add tests/phase1/
git commit -m "test: Add Phase 1 integration tests"

# Push & create PR
git push origin feature/phase-1-trinity
```

---

**Status**: Phase 1.1-1.3 contracts created and ready for testnet deployment  
**Next Milestone**: Wire into MtaaToken.sol + begin testing  
**Target Date**: Testnet live by end of week 2
