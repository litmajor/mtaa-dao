# MTAA DAO: DAO Types, Vault Relationships & Proposal Structures

**Date:** April 27, 2026  
**Purpose:** Map DAO archetypes to vault stacks and governance flows

---

## PART 1: DAO TYPE ARCHITECTURE

### 1.1 Investment Club DAO

**Purpose:** Collective portfolio growth; member capital pooling

**Characteristics:**
- Members: 5-50 individuals
- Capital: $1K-$1M total
- Decision-making: Democratic (one member, one vote)
- Risk tolerance: Medium-High
- Exit strategy: Monthly/Quarterly liquidations

**Vault Stack:**
```
Investment Club DAO
├── Treasury (Operating)
│   ├── 10% working capital (gas, emergencies)
│   └── Multisig: 3-of-5 required
│
├── Portfolio Vault (Investment Strategy)
│   ├── Module Stack: Contribution + Strategy (YUKI) + Distribution + Governance
│   ├── Underlying: Aave, Curve, Uniswap pools
│   ├── Rebalance Frequency: Weekly (triggered by YUKI bot)
│   ├── Withdrawal: Proportional to shares (ERC4626 standard)
│   └── Performance Fee: 2% annually to Treasury
│
└── Reserve Vault (Savings)
    ├── Module Stack: Contribution + Lock + Distribution
    ├── Lock Duration: 30-90 days
    ├── Yield: 0.5% in cUSD (Compound)
    └── Purpose: Emergency buffer
```

**Proposal Types & Governance:**
```
Proposal Type              | Quorum | Approval | Duration | Execution
---------------------------+--------+----------+----------+----------
New member join            | 20%    | 51%      | 3 days   | Immediate
Member expulsion           | 30%    | 66%      | 5 days   | 2 days delay
Rebalance allocation change| 15%    | 51%      | 2 days   | Immediate
Emergency withdrawal (>30%)| 40%    | 75%      | 1 day    | 24h delay
Strategy change            | 25%    | 60%      | 7 days   | 3 days delay
Performance fee change     | 20%    | 70%      | 4 days   | Immediate
Remove member after inactiv| 10%    | 60%      | 3 days   | Immediate
```

**Fund Flow Examples:**

**Scenario A: Member Deposits**
```
Alice (Member)
  └─ Deposits $10K cUSD
     └─ transferred to Portfolio Vault
        ├─ 90% ($9K) allocated to YUKI strategy
        │  ├─> Aave lend: $4.5K @ 3% yield
        │  ├─> Curve LP: $2.7K @ 8% yield
        │  ├─> Uniswap concentrated range: $1.8K (risky)
        └─ 10% ($1K) to Reserve Vault
           └─ Compound deposit @ 0.5%
           
Monthly: $90 + $216 + $180 = $486 yield earned
  ├─ $10 (2%) sent to Treasury
  └─ $476 credited to Alice's account
```

**Scenario B: Proposal Execution - Rebalance**
```
BOT/AI triggers: "Aave yield down to 1%, reallocate"
  ├─ Creates Proposal: "Shift $5K from Aave to Curve"
  ├─ Voting Period: 48 hours
  │  └─ Requires 15% quorum (if 50 members → 7-8 votes)
  │     └─ Requires 51% approval
  │
  ├─ Execution (after 48h):
  │  ├─ Withdraw $5K from Aave
  │  ├─ Approve $5K to Curve
  │  └─ Deposit to Curve pool
  │
  └─ Multisig Locks: 3-of-5 signers confirm execution
```

**Financial Model (12-month projection):**
```
Initial Capital: $100K
Target Returns: 8% annual (conservative blended)

Monthly:
  Entry deposits:      +$5K (new members)
  Yield earned:        +$0.66K (blended 8% on average)
  Performance fees:    -$0.13K (2% cut)
  Withdrawals:         -$2K (members need liquidity)
  
End of Month Treasury: $102.53K
Total Growth: $2.53K (2.5% monthly compounding)
```

**Risks & Mitigations:**

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| Strategy failure (Aave hack) | LOW | 30% loss | Multi-protocol diversification + insurance |
| Governance capture (5 friends vote) | MEDIUM | 100% loss | Supermajority (66%) for large withdrawals |
| Member collusion withdraw all | MEDIUM | 100% loss | Timelock (7 days) + emergency pause |
| Fee extraction during bull market | HIGH | 5% loss | Community vote required if >1% fee |

---

### 1.2 ROSC (Rotating Savings & Credit) DAO

**Purpose:** Cyclical money pooling + microfinance; serves next-economy

**Characteristics:**
- Members: 10-30 (typically)
- Cycle: 10-30 months (e.g., "30 members × 1 cycle = 30 months to complete")
- Member contribution: Fixed amount, paid monthly
- Payout: Rotates by predetermined order (monthly to one member)
- Alternative name: "Chama" (Kenya), "Tanda" (mobile), "Sou" (Haiti)

**Vault Stack:**
```
ROSC DAO (Traditional 20-member ROSC)
├── Treasury (Contribution Collector)
│   ├── Module: Contribution (fixed monthly)
│   ├── Requirement: Each member contributes exactly $500/month
│   ├── Frequency: 1st of each month
│   ├── Penalty for non-payment: 5% fee + loss of next month payout
│   └── Multisig: 2-of-3 collection enforcers
│
├── Rotation Vault (Main Payout)
│   ├── Module Stack: Contribution + Rotation + Distribution + Governance
│   ├── Monthly Pool: $500 × 20 members = $10,000
│   ├── Current Month Recipient: Member #4 (Alice)
│   ├── Rotation Order: Locked at cycle start; Alice → Bob → Carol → ...
│   ├── Withdrawal: Alice can withdraw $10K immediately (no conditions)
│   └── Rotation Advance: Member can volunteer to defer payout (get 2% interest)
│
├── Emergency Buffer (Savings)
│   ├── Funded by: $50 initiation fee from each member ($1K total)
│   ├── Purpose: Cover defaults; no member withdrawals
│   └── Yield: Celo cUSD savings account (0.5%)
│
└── Micro-Loan Facility (Optional)
    ├── Module: Escrow + Governance + Emergency
    ├── Funded by: Annual 10% surplus (interest from buffer)
    ├── Loan terms: 6-month duration, 5% interest
    ├── Recipients: Members only, for personal emergencies
    └── Approval: 2 guarantors + elder council consent
```

**Proposal Types & Governance:**

```
Proposal Type                  | Quorum | Approval | Duration | Execution
--------------------------------+--------+----------+----------+----------
Skip/defer my payout (→ next mo)| 0%     | Self     | Immedia  | Immedia
Expel member (non-payment >2mo) | 50%    | 75%      | 3 days   | Immedia
Adjust contribution amount      | 60%    | 80%      | 7 days   | Next cycle
Micro-loan to member            | 33%    | 60%      | 2 days   | Immedia
Adjust rotation order (swap)    | 100%   | Unanimous 1 day     | Immedia
Migrate to next version (v2)    | 75%    | 66%      | 14 days  | 7 day delay
Change penalty for non-payment  | 50%    | 70%      | 3 days   | Next month
```

**Fund Flow Example: Month 5 Rotation**

```
Timeline: ROSC Cycle Month 5 (Alice's payout month)

T=0:  Collection phase begins
      Bob: Contributes $500 ✓
      Carol: Contributes $500 ✓
      Dave: Contributes $500 ✓
      ... (17 more members contribute)
      Alice: Contributes $500 ✓
      Emergency backup fund: $50 (yields 0.5% = $0.25)
      
T=3d: Collection phase ends
      Total collected: $10,000
      
T=5d: Rotation Vault payout released
      Alice: Receives $10,000
      Alice's lifetime payout so far: $10,000 (1 cycle out of 20)
      
T+30d: Next month (Month 6)
      Rotation recipient: Bob
      Bob: Eligible to receive $10,000 on 1st of next month
```

**Financial Lifecycle (20-member, 20-month cycle example):**

```
Initiation:
  Monthly contribution: $500/member
  Total pool/month: $10,000
  Initiation fees: $50 × 20 = $1,000 (emergency buffer)

End of 20 months (cycle complete):
  Total contributed by Alice: $500 × 20 = $10,000
  Total distributed to Alice: $10,000 (month 5 payout)
  "Profit"/loss: $0 (breakeven by design)
  *Interest from emergency buffer seed: +$0.25 (negligible)
  
For comparison, banking system:
  Alice: Would earn $0.25 in 20 months at bank (0.15% APY)
  Alice ROSC: Same member, now HAS $10K immediately (month 5)
              → Can use $10K for wedding, school, business inventory
              → Interest saved vs. loan: $500+ over 20 months
      
VALUE: Cycle members get lump sum capital EARLY (access to liquidity)
```

**Governance Edge Cases:**

**Case 1: Member Default (Carol misses payment)**
```
Month 8: Carol owes $500; only contributed $200
  
Proposal: "Penalize Carol: Remove from payout + 5% fee ($25)"
  ├─ Quorum: 50% (10/20 members must vote)
  ├─ Approval: 75% (7.5 of 10 must say YES)
  ├─ Duration: 3 days voting
  ├─ Execution: Immediate
  
If passed:
  ├─ Carol loses future payout rights for 3 months
  ├─ Carol pays $25 penalty (taken from emergency buffer repayment)
  └─ Next eligible recipient: Dave (skips Carol, goes to Dave)

If rejected:
  ├─ Carol gets to keep payout rights despite non-payment
  └─ But emergency buffer covers shortfall ($500 - $200 = $300)
```

**Case 2: Member Wants to Swap Positions**
```
Month 2: Alice (currently Month 5 recipient) AND Bob (currently Month 6 recipient)
         both want to exchange positions
         
Proposal: "Swap Alice ↔ Bob payout months (5 ↔ 6)"
  ├─ Quorum: 100% must agree (canonical swap)
  ├─ Approval: Unanimous (all 20 must vote YES, or single dissent blocks)
  ├─ Duration: 1 day voting
  ├─ Execution: Immediate (reassign rotation order)
  
After swap:
  ├─ Alice now gets payout in Month 6 instead of Month 5
  ├─ Bob now gets payout in Month 5 instead of Month 6
  └─ Rotation order list: [Carol, Dave, ..., Bob (was Alice), Alice (was Bob), ...]
```

**Risks & Mitigations:**

| Risk | Example | Impact | Mitigation |
|------|---------|--------|-----------|
| Member disappears before rotation | Bob emigrates, month 15 arrives | $500 × 20 lost ($10K) | Micro-loan as replacement; emergency buffer covers |
| Contribution inflation (new demand) | 20 members want to be 30 | 50% inflation | Requires unanimous vote to change size |
| Cycle interruption (DAO hacked) | Attacker withdraws $50K | Total capital lost | Guardian pause + 7-day recovery window |
| Governance capture (5 friends rule) | 5 members collude to expel others | Exclusion of 15 members | Supermajority (75%) required for expulsion |

---

### 1.3 Women's Group DAO

**Purpose:** Community wealth building; savings + collective lending

**Characteristics:**
- Members: 15-100+ women
- Capital: $10K-$100K+ pooled
- Primary Goal: Emergency fund + education/health spending
- Secondary Goal: Collective business (e.g., farm, shop)
- Decision: Elder-led (respected elders) + community ratification

**Vault Stack:**
```
Women's Group DAO
├── Community Savings Vault
│   ├── Module: Contribution + Lock + Distribution + Governance
│   ├── Contribution: Flexible, $10-100/month per member
│   ├── Lock: 30 days (can't withdraw more than 1x/month)
│   ├── Yield: Celo savings 0.5% + Group interest (5%/year)
│   ├── Withdrawal: For approved use cases (healthcare, education, emergency)
│   └── Governance: Proposal required for any withdrawal >$500
│
├── Emergency Lending Pool
│   ├── Module: Escrow + Governance + Emergency
│   ├── Loan limit: Max $5K per member
│   ├── Terms: 6-month maturity, 0-5% interest (community decides)
│   ├── Collateral: Social proof (2 guarantors from same DAO)
│   ├── Approval: Elder council + community vote (>50%)
│   └── Defaulted loans: Loss absorbed by emergency buffer
│
├── Business Fund (Collective Enterprise)
│   ├── Module: Contribution + Strategy (YUKI for yield)
│   ├── Capital: $20K+ for women's-owned business (farm, shop, salon)
│   ├── Dividend: Distribution proportional to ownership shares
│   ├── Management: Elected committee of 3-5 trusted members
│   └── Annual audit: Community vote to approve/reject committee
│
└── Charitable Fund (10% of surplus)
    ├── Module: Contribution + Distribution
    ├── Purpose: Widows, orphaned children, healthcare emergencies
    ├── Recipient: Approved by elder consensus
    └── Transparency: Monthly report to members
```

**Proposal Types & Governance:**

```
Proposal Type                    | Quorum | Approval | Duration | Notes
---------------------------------+--------+----------+----------+----------
Member emergency loan ($0-5K)    | 20%    | 50%      | 24 hours | Expedited
Community savings withdrawal     | 30%    | 50%      | 3 days   | For approved need
Business expansion (capital call)| 40%    | 60%      | 7 days   | Requires commitment
Loan interest rate change        | 30%    | 70%      | 5 days   | Affects all loans
Remove member                    | 50%    | 75%      | 5 days   | Requires cause
Committee election (annual)      | 60%    | 60%      | 14 days  | Held yearly
Large charitable grant (>$1K)    | 50%    | 60%      | 3 days   | Elder consensus priority
Merge with another group         | 80%    | 80%      | 30 days  | Major governance change
```

**Fund Flow Example: Emergency Loan**

```
Jane's Scenario (real-world precedent):
  ├─ Jane's daughter has malaria; needs $200 for treatment
  ├─ Jane has only $50 in personal savings
  │
  ├─ Jane contacts group elder (Ruth)
  ├─ Ruth verifies: medical emergency, Jane good member (12-month payment history)
  │
  ├─ Proposal created: "Emergency loan to Jane: $200, 0% interest, 6-month repayment"
  │  ├─ Quorum: 20% (need 3/15 members to vote; high urgency)
  │  ├─ Approval threshold: 50% (need 2/3 votes YES)
  │  ├─ Duration: 24 hours (expedited)
  │  └─ Voting: Ruth text-broadcasts to members; 12/15 vote within 6 hours
  │            ├─ YES: 11 votes
  │            ├─ NO: 1 vote (Margaret wants collateral)
  │            └─ PASS (11/12 = 92% > 50%)
  │
  └─ Execution:
    ├─ Jane receives $200 immediately (from Emergency Lending Pool)
    ├─ Daughter gets treatment ✓
    ├─ Jane commits to repay $200 over 6 months ($33.33/month)
    ├─ If Jane defaults: Elder council uses $200 from charitable buffer
    └─ Jane remains good standing (no penalties for medical default)
```

**Financial Model (20-member group):**

```
Monthly Contributions:
  Average: $30/member × 20 = $600/month
  Variance: $10-100 range (based on income)

Annual Flow:
  Collected: $600 × 12 = $7,200
  Interest earned (0.5% cUSD): $36
  Group emergency lending interest (opt-in 3% on taken): +$180
  Business dividend (year 1 modest): +$400
  
  Total annual: $7,816
  
Withdrawals:
  Emergency loans (assumed 5 members, avg $300): -$1,500
  Community withdrawals (savings); avg $50/member: -$1,000
  Business capital calls (reinvestment): -$2,000
  Charitable fund (10% surplus): -$232
  
Net annual: $7,816 - $4,732 = $3,084 retained
Retained per member: $3,084 / 20 = $154.20

Next year: $7,200 + $3,084 (previous surplus) = Total capital now $10,284
  → Can now offer larger loans ($10K instead of $5K)
  → Can fund bigger business expansion
```

**Governance Safeguards (Corruption Prevention):**

```
Safeguard 1: Rotation of Treasurers
  ├─ Every 24-month cycle, new treasurer elected
  ├─ All funds audited before handoff
  └─ Previous treasurer must be present for verification

Safeguard 2: No Unauthorized Withdrawals  
  ├─ Loan threshold: $100 (can approve with single elder)
  ├─ Loan threshold: $500 (requires 2 elders + 1 community vote)
  ├─ Loan threshold: >$500 (requires all 3 elders + community vote 50%+)
  └─ Withdrawal>$1K (requires 75%+ community vote)

Safeguard 3: Transparent Ledger
  ├─ Every transaction posted in communal space
  ├─ Monthly physical meeting: Elder reads all transactions aloud
  ├─ Blockchain: All large tx verified on celo.org explorer
  └─ Audit: Quarterly, by independent woman from sister group
```

---

### 1.4 Bail Fund DAO

**Purpose:** Criminal justice reform; post-bail loanfunding

**Characteristics:**
- Members: Activists, wealthy donors, legal aid orgs
- Capital: $100K-$10M (depends on ambition)
- Goal: Free people from jail pre-trial (bail is rights violation)
- Mechanism: Post bail, then release when person appears in court
- Exit: Bail refunded once verdict reached (process 90-180 days)

**Vault Stack:**
```
Bail Fund DAO
├── Active Bail Pool (Escrow Vault)
│   ├── Module: Escrow (conditional release) + Governance + Emergency
│   ├── Capital locked: $50K-$500K at any moment
│   ├── Individual bail amount: $500-$50K per defendant
│   ├── Escrow condition: "Court confirms defendant appeared at final hearing"
│   ├── Release trigger: Oracle from court system (date certain + defendant ID)
│   ├── Hold period: Average 90 days; some 180+ days
│   ├── Failure scenario: Defendant flees; bail is forfeit (20-30% of pool/year)
│   └── No yield: Funds cannot be used while in escrow (locked for justice)
│
├── Reserve Fund (Emergency Buffer)
│   ├── Module: Distribution (governance-controlled disbursement)
│   ├── Size: 30% of Active Pool
│   ├─ Purpose: Cover forfeited bail (defendant fled)
│   └─ Replenishment: Requires donor campaign once drawn
│
├── Operations Fund (Operational)
│   ├── Module: Contribution (donations) + Distribution
│   ├─ Purpose: Legal staff, court filing fees, tech infrastructure
│   ├─ Annual budget: 5-10% of total capital
│   └─ Approval: Annual operations vote
│
└── Donor Contribution Tracking (Accounting)
    ├── Module: Distribution (recognition) + Governance
    ├── Purpose: Track who donated, honor major donors
    ├── Tax document: Generate Form 990 for nonprofit reporting
    └── Allocation: Can request that donation go to specific cause
```

**Proposal Types & Governance:**

```
Proposal Type                        | Quorum | Approval | Duration | Notes
-------------------------------------+--------+----------+----------+----------
Post bail for new defendant ($X)     | 30%    | 50%      | 24 hours | Expedited
Authorize defendant release (condition)| 10%  | Judicial |Immedia   | Auto-trigger
Write off forfeited bail             | 40%    | 60%      | 3 days   | Bookkeeping
Increase operations budget           | 50%    | 60%      | 7 days   | Annual review
Accept major donor ($10K+)           | Donor  | self     | Immedia  | Just thank you
Emergency bail for high-needle case  | 50%    | 75%      | 24 hours | Crisis mode
Partner with new legal org           | 60%    | 70%      | 14 days  | Vetting period
Appeal forfeiture in court           | 100%   | Consensus| Variable | Rare; highest stakes
```

**Fund Flow Example: Posting Bail**

```
Scenario: James arrested on drug charge; bail set at $5,000

T=0:  James in jail, cannot pay $5K
      ├─ Public defender refers: "Bailey's Fund will pay bail"
      └─ Legal coordinator files form with DAO

T=1h: DAO receives bail request via governance portal
      ├─ Details: James, 45y, charged with simple possession
      ├─ Judge: "Bail $5,000, appear in court July 15"
      ├─ Flight risk: Low (has family in area)
      ├─ Bail Bond Co would take 15% ($750) + court fees
      │  → James/family would lose $750 forever
      │  → Under DAO: $5K fully returnable
      │
      └─ Governance proposal: "Post $5K bail for James"

T=2h: Voting begins (need 30% quorum = 15/50 members online)
      ├─ Legal team vouches: Low flight risk ✓
      ├─ Financial check: $5K < 10% of Active Pool ✓
      ├─ Votes: 22/50 vote YES (44% > 30% quorum, >50% approval)
      └─ Decision: APPROVED

T=4h: Execution
      ├─ DAO sends $5K to court clerk
      ├─ Court releases James from custody
      └─ James: "Use your freedom to prepare defense"

T=90d: Court date arrives
       ├─ July 15: James appears in court ✓
       ├─ Judge: "Bail forfeited for $0; payment refunded to DAO"
       └─ DAO receives $5K back

T=92d: Funds returned to Active Pool; can bail next defendant
```

**Failure Case: Defendant Flees**

```
Scenario: Marcus posted on $3K bail; fails to appear

T=90d: Court date; Marcus absent
       ├─ Judge: "Bail forfeit; court keeps $3K"
       └─ DAO receives notice: bail lost

T=91d: Governance decides
       ├─ Proposal: "Write off $3K bail forfeit; draw from reserve"
       ├─ Vote: Members understand risk (90% voted yes)
       └─ $3K deducted from Reserve Fund ($15K → $12K)

T=92d: Operations resume
       ├─ Active Pool still has: $47K (Marcus's $3K removed)
       ├─ Reserve now: $12K (down from $15K)
       ├─ Operations continue; new bail cases accepted
       │
       └─ Future: "We lost 1/100 of our defendants; acceptable risk"

If this repeats 5x/year:
  ├─ Historical forfeit rate: 20-30% (normal in bail funds)
  ├─ DAO expects: ~$5K-$15K in annual writeoffs
  └─ Operational sustainability model balances this
```

**Governance Safeguards (Anti-Corruption):**

```
Safeguard 1: Defendant Validation
  ├─ All bail postings verified by legal counsel
  ├─ No private deals (e.g., DAO member posting bail for friend)
  ├─ Uniform rules regardless of donor relationship
  └─ Audit: Random sample of 10% of cases reviewed annually

Safeguard 2: Forfeiture Transparency
  ├─ Every forfeited bail case documented publicly
  ├─ Reason for loss: Defendant fled / Miscalculation / Error
  ├─ Learning: "What should we do differently?"
  └─ Pattern analysis: Track which judges/prosecutors cause high loss

Safeguard 3: Restricted Withdrawals
  ├─ No member can request "contribution refund"
  ├─ No special access for donors
  ├─ All money in Active Pool is "community property"
  └─ Only exit: DAO closure (requires 90%+ vote)
```

---

### 1.5 Meta DAO

**Purpose:**DAO of DAOs; federated governance

**Characteristics:**
- Members: Other DAOs (not individuals)
- Capital: Pooled from child DAO treasuries
- Decision-making: DAO delegates + parent governance
- Use case: Multi-brand organizations (e.g., Fuse Network DAOs)

**Vault Stack:**
```
Parent Meta DAO (e.g., "East Africa Network of DAOs")
├── Child DAO Deposits (Treasury Layer 1)
│   ├── Investment Club DAO subtreasury: $100K
│   ├── Women's Group DAO subtreasury: $50K
│   ├── ROSC DAO subtreasury: $25K
│   └── Total in Meta: $175K
│
├── Meta Governance Vault (Treasury Layer 2)
│   ├── Module: Contribution (from child DAO % allocations) + Governance
│   ├─ Each child DAO allocates 10% of surplus to Meta
│   ├─ Purpose: Shared infrastructure (legal, tech, marketing)
│   ├─ Annual budget: $5K-$20K from Meta allocations
│   └─ Spending: Only approved by cross-DAO representatives
│
├── Growth Fund (Optional)
│   ├── Module: Strategy (YUKI for growth investing) + Distribution
│   ├─ Purpose: Fund new DAO spinoffs
│   ├─ Example: Support new Women's Group DAO in new region
│   ├─ Allocation: $10K per spinoff (equity stake)
│   └─ Return: Dividends once child DAO profitable
│
└── Conflict Resolution Escrow
    ├── Module: Escrow (disputes between child DAOs)
    ├─ Example: Two DAOs sharing physical space; rent payment dispute
    ├─ Escrow holds payment until both sign off
    └─ Meta governance resolves as needed
```

**Proposal Types & Governance:**

```
Proposal Type                        | Quorum | Approval | Duration | Notes
-------------------------------------+--------+----------+----------+----------
New child DAO joins Meta             | 50%    | 60%      | 14 days  | Each child votes
Technology upgrade (shared platform) | 40%    | 60%      | 7 days   | Tech committee leads
Allocate to Growth Fund              | 60%    | 70%      | 14 days  | New spinoff funding
Resolve dispute between 2 child DAOs | 40%    | 60%      | 5 days   | Neutral arbiters
Child DAO withdrawal (leave network) | 100%   | Consensus| 30 days  | Must agree to exit
Annual budget approval               | 50%    | 60%      | 30 days  | Fiscal yearly
Marketing campaign (shared brand)    | 50%    | 50%      | 7 days   | All DAOs benefit
```

**Fund Flow Example: Spinoff Funding**

```
Scenario: New Women's Group DAO wants to launch in rural Kisumu

T=0:  New WG DAO founders (5 women) submit proposal to Meta
      ├─ Funding needed: $10K (legal, website, initial operating budget)
      ├─ Repayment: 2% annual dividend once WG reaches $100K AUM
      └─ Timeline: 36-month repayment (if successful)

T=1w: Voting begins across Meta (parents vote)
      ├─ Investment Club DAO: "YES - diversification" ✓
      ├─ Original Women's Group: "YES - support sister group" ✓
      ├─ ROSC DAO: "YES - we benefit from more pool diversity" ✓
      ├─ Vote: 3/3 = 100% approval (supermajority met)
      └─ Decision: APPROVED

T=2w: Growth Fund releases $10K
      ├─ New WG DAO receives funds
      ├─ Legal papers registered (nonprofit status)
      ├─ Website launched with Meta branding
      └─ First members enrolled

T=12m: New WG DAO reaches $100K AUM
       ├─ 2% dividend = $2K/year
       ├─ First payment: Meta receives $2K
       ├─ All 3 parent DAOs share proportionally
       │  ├─ Investment Club: $1K (40%)
       │  ├─ Women's Group: $0.7K (35%)
       │  └─ ROSC DAO: $0.3K (15%, smaller stake)
       └─ Growth Fund now: $0 → +$2K (recovering)

T+36m: Full repayment
       ├─ Growth Fund collects: $2K × 3 = $6K total
       ├─ Loan repaid to Growth Fund = $6K
       └─ Growth Fund available for next spinoff
```

---

### 1.6 Short-Term Project DAO

**Purpose:** Time-boxed fundraising; milestone-based payout

**Characteristics:**
- Duration: 3-24 months (defined end date)
- Goal: Build something specific (school renovation, medical equipment)
- Capital: Crowdfunded or member-driven
- Governance: Lightweight during project; stricter for fund control

**Vault Stack:**
```
School Renovation Project DAO (18-month project)
├── Fundraising Vault (Contribution)
│   ├─ Target: $50,000 USD (renovation cost)
│   ├─ Duration: Months 1-3 (fundraising phase)
│   ├─ Contributors: 50 community members (small donors) + 5 sponsors (large)
│   ├─ Match program: "For every $1000 raised, sponsor adds $2,000"
│   └─ Lock: After Month 3, no more contributions allowed
│
├── Project Escrow Vault (Escrow with milestones)
│   ├─ Module: Escrow (conditional release on milestones)
│   ├─ Milestone 1 (Month 4-6): Foundation + walls built → Release 30%
│   ├─ Milestone 2 (Month 7-10): Roof + electrical → Release 40%
│   ├─ Milestone 3 (Month 11-18): Finishing + inspection → Release 30%
│   ├─ Validation: Architect verifies each milestone complete
│   └─ Recipient: Construction contractor (paid upon verification)
│
├── Contingency Reserve
│   ├─ Amount: 10% of total ($5K)
│   ├─ Purpose: Cost overruns (inflation, weather delays)
│   ├─ Release: Requires DAO vote for each usage
│   └─ Unused: Returnable to donors if project finishes under budget
│
└── Operating Budget (small)
    ├─ Amount: 2% of total ($1K)
    ├─ Purpose: Project manager salary, permits, inspections
    └─ Approval: Monthly spend-through vote
```

**Proposal Types & Governance:**

```
Proposal Type                      | Quorum | Approval | Duration | Notes
-----------------------------------+--------+----------+----------+----------
Approve project plan & architect   | 40%    | 60%      | 7 days   | Baseline
Release Milestone X funds          | 50%    | 60%      | 3 days   | On verification
Approve scope change (addition)    | 60%    | 70%      | 5 days   | Feature request
Use contingency reserve for Y      | 40%    | 60%      | 2 days   | Expedited
Extend project timeline            | 60%    | 75%      | 7 days   | Delays bad
Return unused funds to donors      | 50%    | 60%      | 30 days  | Project end
Audit & project close              | 20%    | 50%      | 3 days   | Final step
```

**Fund Flow Example: Milestone Release**

```
School Renovation Project - Milestone 1 Verification

T=Month 6, Week 1: Contractor reports "Walls complete"
  ├─ Contractor submits: Photos, architect sign-off, invoice for $15K
  ├─ DAO receives milestone claim
  └─ Governance triggered: "Release 30% of funds ($15K)?"

T=Week 2: DAO votes
  ├─ Community votes based on evidence
  ├─ Architect confirms: "Foundation and walls meet spec"
  ├─ Photos show: Work is complete (not just architect lying)
  ├─ Vote: 25/45 members vote (55% > 50% quorum)
  │        ├─ YES: 21 votes (84% > 60% approval)
  │        └─ APPROVED
  │
  └─ Decision: RELEASE $15K to contractor

T=Week 3: Payment
  ├─ Escrow vault releases $15K to contractor wallet
  ├─ Contractor: "Building continues to Milestone 2"
  ├─ Remaining vault: $35K (for Milestone 2 + 3)
  │   ├─ Allocated to Milestone 2: $20K (40%)
  │   ├─ Allocated to Milestone 3: $15K (30%)
  │   └─ Contingency reserve: $5K
  │
  └─ Timeline confirmed: "On track for Month 18 completion"
```

---

## PART 2: DAO TYPE COMPARISON MATRIX

| Feature | Investment Club | ROSC | Women's Group | Bail Fund | Meta DAO | Short-Term |
|---------|-----------------|------|---------------|-----------|----------|-----------|
| **Size** | 5-50 | 10-30 | 15-100+ | 20-500+ | 3-10 (DAOs) | Varies |
| **Capital** | $1K-$1M | $10K-$200K | $10K-$100K | $100K-$10M | $100K-$10M | $10K-$1M |
| **Duration** | Perpetual | 10-30 months | Perpetual | Perpetual | Perpetual | 3-24 months |
| **Primary Vault** | Strategy | Rotation | Savings+Lending | Escrow | Composite | Escrow |
| **Withdrawal** | Proportional | Rotation order | Needs-based | N/A (bail) | N/A | Milestone |
| **Yield Focus** | HIGH (8%+) | LOW (0%) | MEDIUM (2-3%) | NONE | MEDIUM | N/A |
| **Governance Model** | Democratic | Elder+community | Elder-driven | Activist | Federated | Top-down |
| **Exit Path** | Liquidate shares | Complete cycle | Withdraw savings | Forfeiture | Child leaves | Project ends |
| **Risk Level** | MEDIUM-HIGH | LOW | LOW | MEDIUM | MEDIUM | LOW |
| **Community Type** | Investors | Neighbors | Women | Activists | Orgs | Citizens |

---

## PART 3: VAULT MODULE COMBINATIONS (Reference)

### Preset Templates:

**Chama Vault** (ROSC)
```smart
├─ Contribution Module (fixed monthly)
├─ Rotation Module (sequential payout order)
├─ Lock Module (30-day withdrawal window)
└─ Governance Module (member voting on rotation changes)
```

**Savings Vault** (Women's Group)
```
├─ Contribution Module (flexible, $10-100+)
├─ Strategy Module (cUSD yield, 0.5%)
├─ Lock Module (30-day lock to encourage holding)
└─ Distribution Module (withdrawals for approved needs)
```

**Escrow Vault** (Bail Fund, Project)
```
├─ Escrow Module (conditional release on external event)
├─ Governance Module (DAO votes on release conditions)
└─ Emergency Module (override in extreme cases)
```

**Investment Vault** (Investment Club)
```
├─ Contribution Module (capital injections)
├─ Strategy Module (YUKI with Aave, Curve, Uniswap)
├─ Distribution Module (proportional dividend sharing)
└─ Governance Module (rebalance votes)
```

---

## PART 4: DEPLOYMENT DECISION TREE

**Should you create a new DAO? Answer:**

**Q: Is there a fixed end date?**
- YES → "Short-Term Project DAO"
- NO → Continue...

**Q: Is the money rotated cyclically to members?**
- YES → "ROSC DAO"
- NO → Continue...

**Q: Is the primary goal to free people from jail?**
- YES → "Bail Fund DAO"
- NO → Continue...

**Q: Are all members the same demographic (e.g., all women)?**
- YES → "Women's Group DAO" (or identity-specific variant)
- NO → Continue...

**Q: Is this organizing other DAOs?**
- YES → "Meta DAO"
- NO → Continue...

**Q: Do you want investment returns (8%+ target)?**
- YES → "Investment Club DAO"
- NO → "Generic Community DAO" (savings-focused)

---

## PART 5: PROPOSAL EXECUTION SAFEGUARDS

### Timelock Requirements:

```
Funds at Risk | Minimum Delay | Community Vote | Emergency Override
$0-1K         | 0 hours       | 20% quorum     | No
$1K-10K       | 24 hours      | 30% quorum     | Guardian pause (7 days)
$10K-100K     | 7 days        | 50% quorum     | Guardian pause (14 days)
$100K+        | 14 days       | 75% quorum     | Guardian pause (30 days)
Governance    | 3 days        | 60% quorum     | Cannot override
```

### Cross-DAO Safety (Meta DAO):

```
- Child DAOs cannot vote to withdraw >50% of holdings without parent approval
- Parent cannot force fund return from child (only incentivize)
- Dispute resolution: Escrow both amounts until arbitration complete
- Child exit: 30-day notice, 60-day transition period
```

---

**End of Document**

