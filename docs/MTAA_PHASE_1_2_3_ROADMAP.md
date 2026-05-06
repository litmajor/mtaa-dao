# MtaaDAO Phase 1-3: Implementation Roadmap

## Strategic Overview

**Goal**: Scale from current state (untested, centralized) → production-ready (decentralized, audited, 1000+ communities)

**Timeline**: 12 months (4 months per phase)

**Investment**: ~$50K in development + $25K in audits

---

## PHASE 1: De-Risk (Months 1-4)

### Objective
Eliminate existential risks before accepting real user capital.

### Deliverables

#### 1.1 Multi-Sig Treasury Migration
**Duration**: 3 weeks  
**Risk Level**: 🔴 CRITICAL (affects all future revenue)  
**Steps**:

1. Deploy MultiSigTreasury contract on testnet
   - 5 signers (founder, 2 advisors, 2 community delegates)
   - 3-of-5 required confirmations
   - 48-hour timelock
   
2. Test with mock fees ($100 MTAA test transfers)
   - Confirm 3 signers can approve + execute
   - Verify timelock enforcement
   - Simulate signature revocation

3. Social consensus (2 weeks)
   - Publish transaction flow on Discord
   - Signers publicly commit (tweet, LinkedIn)
   - Community Q&A on governance forum
   - Incorporate feedback

4. Production deployment
   - Deploy MultiSigTreasury on mainnet
   - Transfer owner() authority to treasury DAO
   - Announce publicly (blog post + community call)
   - First test transaction: pay community contributor

**Checkpoint**: Can execute $1K MTAA transfer with 3 signatures + 48h

---

#### 1.2 Reputation Decay + Oracle Consensus
**Duration**: 4 weeks  
**Risk Level**: 🟡 MEDIUM (affects reputation scores only)  
**Steps**:

1. Deploy ReputationEngine contract
   - 7-day voting period for score changes
   - 66% approval threshold
   - Appeal mechanism (30-day appeals available)
   - MTAA-weighted voting

2. Set up oracle network
   - Deploy 5 validator nodes (AWS, run by trusted parties)
   - Each validator submits reputation events
   - Validators must post bond (10K MTAA) to prevent spam
   
3. Automatic reputation events
   - Define event types: LOAN_REPAID, LOAN_DEFAULT, etc.
   - Coding: -500 for default, +200 for repaid, etc.
   - Wire validator endpoints to MtaaToken contract

4. Test appeals process
   - Simulate: Jane defaults → score drops 100K → 20K
   - Jane appeals: "Not my fault, SACCO fraud"
   - 3+ validators vote to restore
   - Score restored, audit trail visible

5. Gradual rollout
   - Week 1-2: Reputation updates for historical events (backfill)
   - Week 3: Turn on automatic penalties for new defaults
   - Week 4: Open appeals (Jane's scenario above)

**Checkpoint**: 10 defaults recorded with automatic penalties, 5+ appeals processed

---

#### 1.3 Floating APY Deployment
**Duration**: 2 weeks  
**Risk Level**: 🟡 MEDIUM (affects staking rewards)  
**Steps**:

1. Deploy FloatingAPYCalculator contract
   - Base APY: 18% (unchanged)
   - Scale divisor: 100 (calibrated for 10-20% TVL range)
   - Min: 3%, Max: 18%

2. Calibration math (spreadsheet exercise)
   - Current TVL estimate: 10M MTAA (1% of supply)
   - Expected Year 1 end: 100M MTAA (10%)
   - Desired Year 1 end APY: 12-14%
   - Tune scaleDivisor to hit target

3. Run simulations
   - Scenario: TVL grows 10M → 50M (month 6)
   - APY path: 18% → 17.5% → 16% (smooth)
   - Users notified: "APY will decline as adoption grows"

4. Deploy with sunset clause
   - FloatingAPY active for 6 months only
   - Communities vote on permanent APY policy at Month 6
   - Option A: Continue floating (DAO voted)
   - Option B: Fixed minimum (DAO voted)
   - Option C: Hybrid (DAO voted)

5. Communication
   - Blog post: "Why Floating APY Protects MTAA"
   - Calculator tool on website (show: if you stake X now, APY curve)
   - Discord FAQ addressing concerns

**Checkpoint**: APY calculation matches projections, users understand the policy

---

#### 1.4 Security Audit
**Duration**: 2-3 weeks (outsourced)  
**Cost**: $15-20K  
**Steps**:

1. Hire auditor (OpenZeppelin, Trail of Bits, or Spearbit)
   - Scope: MultiSigTreasury, ReputationEngine, FloatingAPYCalculator
   - Current MtaaToken.sol code review
   - Integration testing

2. Fix audit findings
   - Critical: Fix immediately
   - High: Fix before mainnet
   - Medium: Roadmap for Phase 2
   - Low: Nice-to-have

3. Public audit report (transparency)
   - Publish on website & GitHub
   - Detail all fixes applied
   - Third-party stamp of approval

**Checkpoint**: Audit complete, all critical/high findings fixed

---

### Phase 1 Success Criteria

✅ MultiSigTreasury executed first real transaction (community payment)  
✅ ReputationEngine processed 10+ loan defaults with automated penalties  
✅ FloatingAPY active, APY adjusted within expected range  
✅ Security audit completed, all findings addressed  
✅ Community confidence increased (Discord sentiment, blog comments)  
✅ No critical bugs in productions  

---

## PHASE 2: Extend Governance (Months 5-8)

### Objective
Build the DAO infrastructure for 100+ communities.

### Deliverables

#### 2.1 Treasury DAO (Governance Voting)
**Duration**: 3 weeks  
**Connected to**: MultiSigTreasury (spending authority)  
**Steps**:

1. Deploy TreasuryDAO contract
   - Token-weighted voting (MTAA stake = voting power)
   - Proposal types:
     - Spending proposals ($X to Y)
     - Fee changes (e.g., vault deployment: 500 MTAA → 250 MTAA)
     - Feature toggles (enable/disable reputation decay)
     - Emergency pause (if contract bug detected)
   
2. Governance flow
   - Proposer: "Pay 50K MTAA to developer for Q3 work"
   - Voting: 7 days, need 50% quorum + 66% approval
   - Execution: Sends to MultiSigTreasury with proposal ID
   - MultiSig signers execute (already approved by DAO)

3. Initial treasury allocation
   - Start with 100M MTAA in treasury (from initial allocation)
   - Budget categories: Development (40%), Community (30%), Reserve (20%), Operations (10%)
   - Allocate per quarter based on DAO votes

4. Community engagement
   - Monthly DAO calls (first Tuesday, 2 PM UTC)
   - Proposals posted 2 weeks before voting
   - Discord voting thread for sentiment gauge (non-binding)

**Checkpoint**: First budget allocation voted by DAO (Q5 budget), funds distributed

---

#### 2.2 Fee Governance
**Duration**: 2 weeks  
**Connected to**: MtaaToken.sol fee collection  
**Steps**:

1. Identify current fee structure (from audit)
   - DAO creation: 1K MTAA
   - Vault deployment: 500 MTAA
   - Premium proposal: 100 MTAA
   - Analytics: 50 MTAA
   - Total Year 1 est.: 50K MTAA / quarter

2. Fee governance parameters
   - DAO can vote to change fees (up to 2x or down to 50%)
   - Bi-weekly voting windows
   - Changes take effect after 7-day notice period

3. Fee allocation feedback
   - Current: 50% burned, 50% to owner → TreasuryDAO
   - New options:
     - 60% burned, 40% treasury (more deflationary)
     - 40% burned, 40% treasury, 20% to validators (incentivize oracle)
     - Vote on allocation quarterly

**Checkpoint**: First fee changed via DAO vote (e.g., vault fee 500 → 250)

---

#### 2.3 Validator Incentives
**Duration**: 2 weeks  
**Connected to**: ReputationEngine oracle  
**Steps**:

1. Validator economics
   - Create V500 validator tier (500M max reputation score validated)
   - Monthly reward: 10K MTAA to each of 5 validators
   - Conditions: 99% uptime, < 1 hour response time
   - Penalty: -1K MTAA per false validation

2. Rotating leadership
   - Each month, different validator chairs the group
   - Chair votes on disputes (if 2 validators disagree)
   - Validator term: 6 months (then community votes on replacement)

3. Validator handbook
   - What counts as loan default? (30+ days, $1K+ principal unpaid)
   - What counts as merry-go-round default? (missed 2+ rounds, still owes)
   - Fraud detection rules (multiple defaults = blocks from DAO creation)

**Checkpoint**: Validators receiving monthly payments, 0 disputes in month 1

---

#### 2.4 Dynamic Fee Collection
**Duration**: 1 week  
**Connected to**: MtaaToken.sol + FloatingAPYCalculator  
**Steps**:

1. Fee tier system (optional)
   - If APY > 15%: High utilization, fees normal (100 MTAA)
   - If APY 10-15%: Medium utilization, fees -10% (90 MTAA)
   - If APY < 10%: Low utilization, fees -20% (80 MTAA)
   - Goal: Counteract APY decline, keep protocol revenue flat

2. Implement dynamic fee lookup
   ```solidity
   function getCurrentFee(bytes32 feeType) public view returns (uint256) {
       uint256 apy = FloatingAPYCalculator(apyCalculator).calculateAPY(getTotalStaked());
       uint256 baseFeee = FEE_AMOUNTS[feeType];
       
       if (apy > 1500) return baseFeee;      // 15%+ use: normal
       if (apy < 1000) return (baseFee * 80) / 100;  // <10% use: -20%
       return (baseFee * 90) / 100;          // 10-15% use: -10%
   }
   ```

3. Test with 3-month simulation
   - Verify revenue stays within -10% to +5% range
   - Adjust tier boundaries if needed

**Checkpoint**: Dynamic fees active, revenue variance < 10% over month

---

### Phase 2 Success Criteria

✅ TreasuryDAO processed first budget allocation (50K+ MTAA spent via vote)  
✅ Fee governance changed fees 2+ times via DAO vote  
✅ 5 validators active, receiving monthly payments  
✅ Dispute resolution process tested (at least 1 dispute resolved)  
✅ Community attendance at DAO calls (50+ participants)  
✅ No critical bugs in governance  

---

## PHASE 3: Vaults & Scaling (Months 9-12)

### Objective
Enable on-chain lending, merry-go-rounds, cooperative purchasing.

### Deliverables

#### 3.1 Vault Architecture
**Duration**: 4 weeks  
**Depends on**: MultiSigTreasury (custodian), ReputationEngine (tier checks)  
**Steps**:

1. Vault base contracts
   - VaultFactory: Creates new vault instances
   - BaseVault: Escrow logic, fund locking, dispute resolution
   - Inheritors: MerryGoRoundVault, LoanEscrowVault, CoopPurchaseVault

2. MerryGoRound vault
   - 10 women, KES 5K each = KES 50K round
   - Each member gets up to KES 50K when turn comes
   - If member defaults: Group votes (3/5+ confirm default)
   - Penalty: Default → Reputation -500, blocked from round 2
   - Escrow: MTAA locked until group completes (auto-release)

3. Loan escrow vault
   - Lender deposits MTAA (converts to KES via oracle)
   - Borrower pledges collateral (MTAA at 2x loan amount)
   - Auto-liquidation if collateral drops below 150%
   - Default triggers SACCOs reputation penalty (-500) + liquidation

4. Coop purchase vault
   - 100 farmers pool MTAA to buy bulk seeds/fertilizer
   - Supplier receives payment on delivery proof
   - Revenue split: Members get goods, system takes 1% fee

**Checkpoint**: All 3 vault types deployed on testnet, can create instances

---

#### 3.2 Collateral Management
**Duration**: 2 weeks  
**Connected to**: Price oracles, liquidation engine  
**Steps**:

1. Collateral engine
   - MTAA collateral: $0.50 per MTAA (from market price 3-day MA)
   - KES collateral: 1 KES = 0.00087 USD (fixed rate)
   - Pricing: On-chain oracle from Pyth or Chainlink

2. Liquidation triggers
   - Monitor collateral every hour
   - If collateral < 150% of debt: 24-hour warning
   - If collateral < 125% of debt: Auto-liquidate
   - Liquidation fee: 5% to liquidators (incentivizes participation)

3. Slashing for loan defaults
   - Borrower defaults → Collateral transferred to vault
   - Vault splits: 80% to treasury DAO, 20% to reputation penalty burn

**Checkpoint**: Created 10 vaults on testnet, liquidated 2 positions (simulated)

---

#### 3.3 Dispute Resolution
**Duration**: 2 weeks  
**Connected to**: TreasuryDAO (final authority)  
**Steps**:

1. Dispute types
   - Member claims default was unjust (app error, not malice)
   - Validator claims another validator bribed (false default)
   - Borrower claims lender stole collateral (unlikely but possible)

2. Dispute flow (3 phases)
   - **Phase A (24 hours)**: Accuser submits evidence, accused responds
   - **Phase B (7 days)**: TreasuryDAO community arbitration (vote: 66% threshold)
   - **Phase C (appeal)**: If 50+ MTA holders dispute result, full DAO recount

3. Remedies
   - Overturn default: Reputation restored, collateral returned
   - Confirm default: Collateral liquidated, fee wasted
   - Split decision: 50% to each party (rare)

**Checkpoint**: Processed 3 disputes, 100% resolved within 2 weeks

---

#### 3.4 Integration Testing
**Duration**: 2 weeks  
**Steps**:

1. End-to-end scenarios
   - Jane creates 5K KES merry-go-round (2 MTAA fee)
   - Recruits 10 women (5 confirmations needed before vault active)
   - First round pays out all 10 women sequentially
   - Default on round 3: Woman 5 doesn't pay
   - Automatic: Her reputation -500, blocked from vault 2
   - Group votes: Proceed without her? Vote yes (7/10)
   - Vault concludes: 9 fulfilled, 1 defaulted, vault emits completion event

2. Loan scenario
   - Kofi seeks KES 100K for inventory
   - Lender deposits 25M MTAA ($12.5K, 2x collateral)
   - Kofi pledges 50M MTAA (locked in vault)
   - 30-day period: Kofi repays 25M MTAA + 1.2M MTAA interest
   - Treasury receives 1.2M, network rewards lender 50K MTAA from staking APY
   - MTAA collateral returned to Kofi

3. Stress test
   - 100 vaults created simultaneously
   - 500 transactions processed in 1 block
   - Liquidation engine processes 50 liquidations
   - No single point of failure

2. Load test for mobile
   - Test via SMS (USSD gateway)
   - Simulate 100 concurrent M-Pesa transactions
   - Latency < 5 seconds for each action

**Checkpoint**: All scenarios complete, no critical bugs, TPS = 50+/sec

---

#### 3.5 Mobile Integration (SMS/USSD)
**Duration**: 2 weeks  
**Connected to**: Vault contracts + Twilio/Nexmo  
**Steps**:

1. USSD menu structure
   ```
   *000# → MTAA menu
   1. Check balance
   2. Join merry-go-round
   3. View reputation
   4. Propose loan
   5. Settings
   
   2 (join group)
   → "Enter group ID: _ _ _ _"
   → "5K KES, confirm? (1=yes, 2=no)"
   → "✓ Joined group #1234. Your turn in 2 weeks"
   ```

2. SMS notifications
   - "Jane: Your merry-go-round turn is NOW. Pay 5K KES to: 0722123456"
   - "Jane: You've earned 2,450 MTAA this month (estimated)"
   - "Jane: ALERT - Reputation -500 for missed payment. Appeal? SMS APPEAL"

3. Integration with wallet
   - SMS wallet software (Simpliwire or similar)
   - Send MTAA via: "SEND 5000 MTAA to 0722999999" → SMS confirmation
   - No UI needed (95% of market is feature phones)

**Checkpoint**: 100 test users on SMS, can check balance + join vault via text

---

### Phase 3 Success Criteria

✅ All 3 vault types deployed on testnet, 50+ test vaults created  
✅ 5 defaults processed with reputation penalties + dispute resolution  
✅ Liquidation engine tested, 10+ positions liquidated  
✅ SMS/USSD integration working, 100 users can interact via text  
✅ End-to-end scenario: Create vault → Pay → Complete at 100% on-time  
✅ No reentrancy or overflow vulnerabilities (audit spot-check)  
✅ Ready for production (mainnet deployment approved)  

---

## Deployment Checklist

| Phase | Component | Testnet | Audit | Mainnet | Go Live |
|-------|-----------|---------|-------|---------|---------|
| 1 | MultiSigTreasury | ✅ | ✅ | ✅ | Week 2 |
| 1 | ReputationEngine | ✅ | ✅ | ✅ | Week 3 |
| 1 | FloatingAPY | ✅ | ✅ | ✅ | Week 4 |
| 1 | Full audit | - | ✅ | - | Week 4 |
| 2 | TreasuryDAO | ✅ | ✅ | ✅ | Week 8 |
| 2 | Fee governance | ✅ | - | ✅ | Week 9 |
| 2 | Validator net | ✅ | - | ✅ | Week 10 |
| 2 | Dynamic fees | ✅ | - | ✅ | Week 11 |
| 3 | MerryGoRound vault | ✅ | ✅ | ✅ | Week 14 |
| 3 | Loan vault | ✅ | ✅ | ✅ | Week 15 |
| 3 | Coop vault | ✅ | ✅ | ✅ | Week 16 |
| 3 | SMS/USSD | ✅ | - | ✅ | Week 16 |

---

## Budget & Resource Allocation

```
PHASE 1 (Months 1-4):
  Developer: 1 FTE senior engineer @ $5K/mo = $20K
  Auditor: Third-party firm = $15K
  Operations: Testing, infrastructure, DevOps = $5K
  Total: $40K

PHASE 2 (Months 5-8):
  Developers: 2 engineers (core + integration) = $10K
  Governance tooling (Snapshot, multi-sig UI) = $5K
  Community management + DAO calls = $3K
  Total: $18K

PHASE 3 (Months 9-12):
  Developers: 2 engineers = $10K
  Vault audit (separate firm): $10K
  SMS/USSD integration (Twilio, Nexmo): $3K
  Mobile testing + DevOps = $2K
  Total: $25K

GRAND TOTAL: $83K over 12 months
```

---

## Risks & Mitigations

| Risk | Severity | Mitigation |
|------|----------|-----------|
| **Timeline slip** | 🟡 Medium | Assign 2nd engineer by month 4 |
| **Audit finds critical bug** | 🔴 Critical | Maintain 2-week buffer for fixes |
| **Community rejects DAO** | 🟡 Medium | Run voting simulations in month 2 |
| **Validator node goes down** | 🟠 High | Recruit 7 validators (not 5) for redundancy |
| **Oracle price manipulation** | 🔴 Critical | Use Pyth + Chainlink (require both agree) |
| **Default rate > 5%** | 🟡 Medium | Pause new vaults, review underwriting |
| **SMS gateway failure** | 🟡 Medium | Contract with 2 gateway providers |
| **Mainnet exploit** | 🔴 Critical | Keep emergency pause authority for 6 months |

---

## Success Metrics

**Month 4 (End Phase 1)**:
- MultiSigTreasury: 10+ transactions executed
- ReputationEngine: 50+ defaults recorded, 10+ appeals processed
- Audit: ✅ complete, 0 critical findings
- Community: 200+ Discord members, 50 in weekly calls

**Month 8 (End Phase 2)**:
- TreasuryDAO: $100K+ spent via community votes
- Fee governance: 4+ changes voted through
- Validators: 5 active, $2K/mo revenue each
- Community: 1,000+ Discord members, 200 in DAO calls

**Month 12 (End Phase 3)**:
- Vaults: 500+ created, $5M+ locked
- Defaults: < 2% (vs 5% historical)
- SMS users: 10,000+ can transact via text
- Market cap: $50M+ (MTAA price = $0.05+)
- Communities: 100+ using MtaaDAO
- Team expansion: 5 engineers, 2 community reps

---

## Post-Launch (Year 2+)

**Quarterly Goals**:
- Q5: Expand to 500 communities, $500M TVL
- Q6: Launch DAO staking (users earn governance rewards)
- Q7: Cross-chain bridge (Polygon, Solana)
- Q8: Mobile app (iOS/Android with in-app USSD)

**Revenue model becomes self-sustaining**:
- Fees cover development ($5K/mo)
- Treasury DAO covers community management ($2K/mo)
- Validator bonding incentivizes participation
- MTAA value appreciation rewards early users

---

**Document Version**: 1.0  
**Last Updated**: April 23, 2026  
**Status**: Ready for leadership review
