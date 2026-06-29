# Hisa (MtaaDAO) — Monetization Strategy & Next Steps

**Status:** Working Document  
**Date:** June 2026  
**Scope:** Pricing model, MTAA token rollout, contract implementation priorities, and execution roadmap grounded in MSC/Mastercard Foundation IFS research (Kenya, Ghana, Togo — October 2023)

---

## 1. Market Reality: What the Research Tells Us

### The chama landscape (Kenya baseline)

- 300,000+ chamas control assets worth ~USD 3 billion
- 7.6 million Kenyan adults use informal financial groups
- 1 in 3 Kenyans is a chama member
- 37.4% of Kenyan women use informal groups vs 22.5% of men — this is Okedi's world

### Real economics of a typical group

| Group maturity | Weekly contribution/member | Monthly flow through group | Loan size |
|---|---|---|---|
| Beginner ("invisible") | KES 200–1,000 | KES 8,000–20,000 | KES 2,000–5,000 |
| Intermediate | KES 1,000–5,000 | KES 20,000–80,000 | KES 5,000–10,000 |
| Veteran | KES 5,000+ | KES 80,000–200,000 | KES 10,000–50,000 |

These are the actual flows you are charging against. All pricing decisions should be stress-tested against the beginner tier — if it breaks a beginner chama in a bad month, it's too expensive.

### The critical constraint from demand-side findings

Chamas prefer borrowing from chamas over banks because they access cash the same day, with no paperwork, no harassment, no collateral. The moment Hisa feels like a fee-extracting institution it loses this positioning.

Chamas also operate on the principle of "no fees" to the user — costs are hidden in interest spreads and treasurer time. Your fees must be framed as savings, not charges.

**The reframe:** What you pay Hisa is less than what fraud, manual recordkeeping errors, and shylock interest currently cost the group. A chama paying 0.40% on a KES 10,000 loan (= KES 40) vs. the 3–5% monthly shylock rate (= KES 300–500) is saving KES 260–460 on a single loan.

### The loan facility gap

The research is explicit: Susus are primarily designed for savings and do not provide credit facilities. MSEs that seek credit turn to moneylenders or "shylocks" for financial assistance.

Your `LoanFacility` contract fills this gap directly. This is not speculative — it is a documented unmet need across Kenya, Ghana, and Togo.

---

## 2. Pricing Model: Three-Phase Rollout

### The core problem with dual-rail on Day 1

If MTAA has zero market value at launch and you offer "1,000 KES OR 80 MTAA" for a spawn fee, every user chooses MTAA. Token supply drains for zero revenue. Infrastructure goes unpaid.

**Solution: Fiat-First, Token-Earned.** MTAA is not sold at launch — it is earned through platform activity and used to reduce fees.

---

### Phase 1 — Fiat Only, MTAA as Loyalty Credit (Months 0–4)

**Revenue model:** KES only via M-Pesa. No token payments accepted.

**MTAA role:** Loyalty credit distributed automatically on platform activity. Reduces real KES fees. Cannot be sold or traded.

#### Spawn fees (one-time, KES)

| DAO Type | Spawn Fee (KES) | Rationale |
|---|---|---|
| harambee | 500 | Below government chama registration (KES 1,000) — feels free |
| shortTerm | 800 | Registration-equivalent, familiar concept |
| savings | 1,000 | Matches government registration fee exactly |
| merryGoRound | 1,200 | Slightly above registration — signals more infrastructure |
| community | 2,000 | SACCO joining fee equivalent |
| investment | 3,000 | Institutional tier, professional groups |

#### Activity fees (per transaction, collected by contracts)

| Transaction type | Fee % | KES example (KES 20,000 flow) |
|---|---|---|
| Deposit into vault | 0.15% | KES 30 |
| Rotation payout | 0.20% | KES 40 |
| Loan origination | 0.40% | KES 40 on KES 10,000 loan |
| Loan repayment on time | 0% | Incentive for repayment discipline |
| Withdrawal | 0.20% | KES 40 |
| Yield claim | 5% of yield | Only applies when yield activated |

These feel like M-Pesa transaction costs. A chama moving KES 40,000/month through the system pays approximately KES 60–120 in total fees — roughly 0.15–0.30% of total flow.

#### MTAA rewards earned in Phase 1

| Action | MTAA earned | Purpose |
|---|---|---|
| Spawn vault | 100 MTAA | Welcome reward, seeds the discount tier |
| First deposit | 10 MTAA | Activation incentive |
| Each rotation completed | 5 MTAA | Rewards consistent use |
| Loan repaid on time | 20 MTAA | Rewards repayment discipline |
| Monthly upkeep paid | 15 MTAA | Retention reward |
| Refer another chama | 50 MTAA | Growth mechanic |

#### MTAA fee discount tiers (Phase 1)

MTAA held in vault reduces KES activity fees via a smooth curve (no hard cliffs):

```
discount% = min(50, floor(sqrt(MTAA_held) × 2.5))
```

| MTAA held | Discount | Effective deposit fee | Effective loan fee |
|---|---|---|---|
| 0 | 0% | 0.15% | 0.40% |
| 16 | 10% | 0.135% | 0.36% |
| 100 | 25% | 0.1125% | 0.30% |
| 400 | 50% | 0.075% | 0.20% |
| 500+ | 50% (capped) | 0.075% | 0.20% |

A chama that earns their spawn reward (100 MTAA) immediately gets 25% off all future fees. This has immediate, quantifiable value even with zero market price.

#### Phase 1 unit economics

At 75 active chamas, average intermediate tier:

| Revenue line | Calculation | Monthly KES |
|---|---|---|
| Spawn fees (one-time) | 75 × avg 1,200 KES | 90,000 (one-time) |
| Activity fees | 75 chamas × avg 40,000 flow × 0.20% | ~6,000 |
| Loan origination | 75 chamas × avg 2 loans/month × 10,000 × 0.40% | ~6,000 |
| **Total monthly recurring** | | **~12,000 KES/month** |

This covers basic Celo RPC costs (~$30–50/month) and light infrastructure. The goal of Phase 1 is not profit — it is proving the activity loop and collecting the protocol fee reserve for Phase 2.

---

### Phase 2 — Liquidity Manufacturing (Months 4–8)

**Trigger conditions (all three must be met):**
- Total active DAOs ≥ 75
- ChamaTreasury protocol fee balance ≥ 50,000 KES equivalent
- At least 60 days since Phase 1 launch

**Protocol fee pool allocation:**

```
Collected KES fees
    ├── 40% → Operations (infrastructure, development)
    ├── 30% → AMM liquidity seeding (MTAA/cKES pool on Ubeswap)
    ├── 20% → Development reserve
    └── 10% → Referral and reward reserve
```

The 30% AMM seeding creates a public floor price for MTAA backed by actual platform revenue. If 15,000 KES worth of cKES is paired with 1,000 MTAA in the pool, MTAA has a literal on-chain floor price of 15 KES.

**The windfall moment:** Phase 1 chamas holding 100–500 MTAA discover their loyalty credits are now worth KES 1,500–7,500. This is not a surprise airdrop — the frontend should surface it proactively: "Your group has earned X MTAA through activity. Since launch, this is now worth approximately Y KES based on the protocol liquidity pool."

Frame it as earned value from participation, not speculation.

---

### Phase 3 — Dual Rail Active (Month 8+)

Once MTAA has an oracle price, the `AgentPaymentGateway` calculates payments dynamically:

```
spawn_fee_KES = 1,000 (for savings DAO)
mtaa_price = oracle.getPrice()          // e.g. 15 KES per MTAA
mtaa_equivalent = 1,000 / 15 = 66 MTAA
discounted_mtaa = 66 × 0.75 = 50 MTAA  // 25% token discount
```

Users see: "Pay 1,000 KES — or pay 50 MTAA and save 25%."

The discount drives MTAA demand without forcing anyone onto crypto.

---

## 3. Pricing Per DAO Type — Full Matrix

### Revenue per DAO type (Phase 1, monthly recurring)

| DAO Type | Avg monthly flow | Activity fee | Avg loans/month | Loan fee | Total monthly |
|---|---|---|---|---|---|
| harambee | 20,000 (one cycle) | KES 40 | 0 | 0 | ~KES 40 |
| shortTerm | 40,000 | KES 80 | 1 × 8,000 | KES 32 | ~KES 112 |
| savings | 40,000 | KES 60 | 2 × 8,000 | KES 64 | ~KES 124 |
| merryGoRound | 40,000 | KES 80 | 1 × 5,000 | KES 20 | ~KES 100 |
| community | 80,000 | KES 120 | 3 × 10,000 | KES 120 | ~KES 240 |
| investment | 150,000 | KES 225 | 2 × 20,000 | KES 160 | ~KES 385 |

These numbers are honest — they are small at launch. At 100 active chamas with a realistic distribution the monthly recurring is approximately KES 15,000–18,000. That is the floor, not the ceiling.

The ceiling is the loan interest income routing through the vault. At 10% annualised on KES 10,000 loans across 100 chamas with 3 loans each, the interest generated (which flows back to members) is ~KES 2.5 million per year in member benefit. Your origination fee captures KES 120,000 of that. The rest stays with the chama — which is the value proposition.

---

## 4. Contract Implementation Priorities

These map directly to the revenue model. Build in this order:

### Priority 1 — M-Pesa Gateway (Weeks 1–4)

Nothing else matters if KES payments don't work reliably. The gateway needs:

- M-Pesa STK push → webhook confirmation → idempotent deployment call
- Retry-safe: same payment confirmation = same vault, never double-deploy
- Status visible to user within 30 seconds
- MTAA reward hook: on confirmed payment → transfer reward from protocol reserve

This is the critical path. Every other feature depends on it.

### Priority 2 — Fee Discount Logic in Contracts (Weeks 2–4)

Add to `LoanFacility` and `MaonoVault` fee calculators:

```solidity
function getDiscountedFeeBps(
    address chamaTreasury,
    uint256 baseFeeBps
) internal view returns (uint256) {
    uint256 mtaaBalance = IERC20(mtaaToken).balanceOf(chamaTreasury);
    uint256 mtaaHeld = mtaaBalance / 1e18; // normalize from wei
    
    // Integer sqrt approximation
    uint256 sqrtHeld = sqrt(mtaaHeld);
    
    uint256 discountPct = sqrtHeld * 250 / 100; // × 2.5
    if (discountPct > 5000) discountPct = 5000;  // cap at 50%
    
    return (baseFeeBps * (10000 - discountPct)) / 10000;
}
```

### Priority 3 — Fix MultiAssetVault invest()/withdraw() (Weeks 3–5)

Currently `invest()` mints shares but never calls `transferFrom`. `withdraw()` burns shares but never transfers assets. These need to be fixed before any chama can use the investment pool:

```solidity
function invest(uint256 usdAmount) external nonReentrant whenNotPaused returns (uint256 sharesMinted) {
    require(usdAmount >= minimumInvestment, "Below minimum");
    require(stablecoin != address(0), "Stablecoin not set");
    
    // Pull stablecoin from investor FIRST (was missing)
    IERC20(stablecoin).safeTransferFrom(msg.sender, address(this), usdAmount);
    
    // Then mint shares
    if (totalSupply() == 0) {
        sharesMinted = usdAmount;
    } else {
        sharesMinted = (usdAmount * totalSupply()) / totalValueLocked;
    }
    
    _mint(msg.sender, sharesMinted);
    totalValueLocked += usdAmount;
    lastDepositTime[msg.sender] = block.timestamp;
    
    emit InvestmentEvent(msg.sender, usdAmount, sharesMinted, getSharePrice());
    return sharesMinted;
}
```

Similarly fix `batchRebalance` to update `asset.balance` after each swap — currently the balance mapping drifts from reality after every rebalance, breaking `calculateTotalAssetValue()`.

### Priority 4 — AgentPaymentGateway (Weeks 4–6)

Build the multi-currency routing contract:

```solidity
contract AgentPaymentGateway {
    IPriceOracle public oracle;
    uint256 public TOKEN_DISCOUNT_BPS = 2500; // 25%
    
    // Phase 1: only KES (via backend), MTAA balance checked for discount
    // Phase 3: MTAA payment rail activated after oracle price established
    
    struct PaymentOption {
        uint256 kesAmount;
        uint256 mtaaAmount;
        uint256 mtaaBurnAmount;    // 40% of mtaaAmount
        uint256 mtaaTreasuryAmount; // 60% of mtaaAmount
    }
    
    function getPaymentOptions(uint256 kesBase) 
        external view returns (PaymentOption memory) { ... }
    
    function payInKES(bytes32 daoId, bytes32 mpesaRef) external { ... }
    
    // Phase 3 only — gated by oracle availability
    function payInMTAA(bytes32 daoId) external { ... }
}
```

### Priority 5 — Protocol Fee Collector in ChamaTreasury (Weeks 5–7)

Route activity fees automatically:

```solidity
// Fee routing on each transaction
uint256 protocolFee = (amount * protocolFeeBps) / 10000;
uint256 netAmount = amount - protocolFee;

// Split: 40% ops, 30% liquidity reserve, 20% dev, 10% referral
uint256 opsShare = (protocolFee * 4000) / 10000;
uint256 liquidityShare = (protocolFee * 3000) / 10000;
// ... route to respective treasury buckets

emit ProtocolFeeCollected(daoId, protocolFee, block.timestamp);
```

### Priority 6 — Phase 2 Trigger + AMM Seeding (Month 3–4)

Automate the Phase 2 activation:

```solidity
function checkPhase2Trigger() external {
    require(!phase2Active, "Already active");
    require(totalActiveDaos >= 75, "Not enough DAOs");
    require(protocolFeeReserve >= PHASE2_RESERVE_THRESHOLD, "Not enough reserve");
    require(block.timestamp >= launchTimestamp + 60 days, "Too early");
    
    phase2Active = true;
    _seedAMMPool(); // route 30% of reserve to Ubeswap MTAA/cKES pool
    
    emit Phase2Activated(block.timestamp, protocolFeeReserve);
}
```

---

## 5. Execution Roadmap

### Month 1 — Foundation

| Week | Deliverable | Dependency |
|---|---|---|
| 1–2 | M-Pesa STK push integration + webhook | None — start here |
| 2–3 | MTAA reward hook on payment confirmation | M-Pesa gateway |
| 3–4 | Fee discount logic deployed to testnet | Contract changes |
| 4 | MultiAssetVault invest()/withdraw() fix | Audit finding |

**End state:** A chama can pay KES via M-Pesa, a vault deploys, they receive MTAA, and that MTAA immediately reduces their next transaction fee.

### Month 2 — Economic Loop

| Week | Deliverable | Dependency |
|---|---|---|
| 5–6 | AgentPaymentGateway v1 (KES-only) | M-Pesa gateway |
| 6–7 | Protocol fee collector in ChamaTreasury | Contract work |
| 7–8 | batchRebalance asset.balance sync fix | Audit finding |
| 8 | First 10 chamas onboarded to testnet | Full loop working |

**End state:** Full economic loop running. KES in, vault deployed, fees collected, MTAA earned, discount applied.

### Month 3 — Mainnet + Growth

| Week | Deliverable | Dependency |
|---|---|---|
| 9–10 | Celo mainnet deployment | Testnet stable |
| 10–11 | First 25 real chamas | M-Pesa live |
| 11–12 | Referral system (50 MTAA per successful referral) | Registry complete |
| 12 | Phase 2 trigger monitoring active | 75 DAOs target |

### Month 4+ — Phase 2 + Token Value

| Milestone | Target | Action |
|---|---|---|
| 75 active DAOs | Month 4–5 | Check Phase 2 trigger conditions |
| 50,000 KES reserve | Month 4–5 | Seed Ubeswap MTAA/cKES pool |
| Oracle price established | Month 5 | Notify early chamas of MTAA value |
| Phase 3 dual rail | Month 6–8 | Activate MTAA payment option |

---

## 6. What Not to Build Yet

Avoid scope creep on these until Phase 1 is validated:

- MultiAssetVault rebalancing UI (needs MultiAssetVault fixes first)
- Yield routing adapters (Moola/Mento) — Phase 3 feature
- Cross-chain deployment (no market signal yet)
- Agent system (Scorekeeper, Treasurer, Strategist agents) — Phase 2+
- MetaDAO type — admin-only, build after 50+ DAOs exist
- Quadratic voting — governance complexity not needed at launch

---

## 7. Key Risk Flags

### M-Pesa gateway reliability
Single point of failure for all Phase 1 revenue. Needs idempotency, retry logic, status polling, and a manual override for stuck transactions before launch.

### Oracle dependency before Phase 3
The `acquireAssetViaSwap` oracle price comparison has a unit mismatch (stablecoin is 18 decimals, oracle returns 1e8 scaled). Fix this before any swap executes on mainnet or the slippage check will be meaningless.

### Token drain risk
MTAA reward pool needs a cap and a depletion rate monitor. If referral spam or exploit drains the reward reserve before Phase 2 AMM seeding, MTAA has no floor and Phase 2 fails. Implement a per-period reward cap:

```solidity
uint256 public constant MAX_REWARDS_PER_PERIOD = 10_000 ether; // 10,000 MTAA
uint256 public rewardsIssuedThisPeriod;
uint256 public periodStart;

function _issueReward(address recipient, uint256 amount) internal {
    if (block.timestamp > periodStart + 30 days) {
        periodStart = block.timestamp;
        rewardsIssuedThisPeriod = 0;
    }
    require(rewardsIssuedThisPeriod + amount <= MAX_REWARDS_PER_PERIOD, 
            "Period cap reached");
    rewardsIssuedThisPeriod += amount;
    IERC20(mtaaToken).safeTransfer(recipient, amount);
}
```

### Hibernation mid-rotation
If a chama's vault hibernates during an active rotation cycle (missed upkeep), rotation payouts stop. The `RotationModule` needs a grace period or a decoupled payout mechanism that can execute even when the vault is hibernating. Failing a payout mid-rotation is a trust-destroying event.

---

## 8. The Framing That Matters

The research found one consistent theme across Kenya, Ghana, and Togo: informal groups trust each other because the rules are transparent and collectively agreed on. Chamas operate on constitutions their members wrote together.

Hisa's smart contracts are that constitution — immutable, transparent, and enforced automatically. That is the pitch that resonates with Okedi. Not "blockchain" and not "DeFi." The pitch is: "Your chama already has rules. We make sure nobody can break them."

Every pricing decision, every fee disclosure, every onboarding screen should return to that framing. The fee is not a charge — it is what pays for the ledger that no treasurer can falsify.
