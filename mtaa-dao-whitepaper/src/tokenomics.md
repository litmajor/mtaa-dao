# Tokenomics

## MTAA Token (Implemented)

```solidity
/// Token specifications (Deployed on Celo)
contract MTAAToken {
    string public name = "MtaaDAO Token";
    string public symbol = "MTAA";
    uint256 public totalSupply = 1_000_000_000e18; // 1 billion
    uint8 public decimals = 18;

    // Governance features
    mapping(address => uint256) public votingPower;
    mapping(address => address) public delegates;
    Checkpoint[] public checkpoints;
}
```

## Token Distribution (Current)

| Allocation | Percentage | Tokens | Vesting | Status |
|-----------|-----------|--------|---------|--------|
| Community Rewards | 40% | 400M | 4 years | Active |
| DAO Treasuries | 20% | 200M | Governance controlled | Active |
| Team & Advisors | 15% | 150M | 2 years cliff, 4 years vest | Locked |
| Liquidity Pools | 10% | 100M | Immediate | Deployed |
| Staking Rewards | 8% | 80M | 5 years emission | Active |
| Early Supporters | 5% | 50M | 1 year cliff, 2 years vest | Vesting |
| Foundation | 2% | 20M | 6 months cliff, 3 years vest | Locked |

## Token Utility (Live Features)

### 1. Governance Rights
- **Voting Power**: 1 MTAA = 1 vote (with quadratic modifier)
- **Proposal Creation**: 
  - Standard: 100 MTAA
  - Treasury: 500 MTAA
  - Protocol: 1,000 MTAA
- **Vote Delegation**: Transfer voting power to trusted members
- **Quorum Requirements**: Based on circulating supply percentage

### 2. Staking Mechanisms (Operational)

**Vault Staking**
```solidity
struct StakingTier {
    uint256 minStake;
    uint256 lockPeriod;
    uint256 apyRate;
    uint256 governanceMultiplier;
}

// Active tiers
Tier 1: 1,000 MTAA  | 30 days  | 8% APY  | 1.0x voting
Tier 2: 5,000 MTAA  | 90 days  | 10% APY | 1.25x voting
Tier 3: 10,000 MTAA | 180 days | 12% APY | 1.5x voting
Tier 4: 50,000 MTAA | 365 days | 15% APY | 2.0x voting
```

**Liquidity Mining**
- MTAA-cUSD pool: 12% APY
- MTAA-CELO pool: 10% APY
- Weekly reward distribution

### 3. Platform Fee Discounts (Active)

| MTAA Holdings | Fee Discount | Annual Savings (est.) |
|--------------|--------------|----------------------|
| 1,000+ | 10% | $50-$200 |
| 5,000+ | 25% | $150-$500 |
| 10,000+ | 50% | $300-$1,000 |
| 50,000+ | 75% | $1,000-$5,000 |

### 4. Premium Features Access

**DAO Operations**
- Create New DAO: 1,000 MTAA (one-time)
- Deploy Custom Vault: 500 MTAA
- Premium Analytics: 50 MTAA/month
- Priority Support: 100 MTAA/month
- Custom Branding: 200 MTAA/month

**Proposal Enhancements**
- Proposal Highlighting: 25 MTAA
- Extended Voting Period: 50 MTAA
- Priority Queue: 100 MTAA
- Fast-track Execution: 200 MTAA

### 5. Reputation Multipliers

MTAA holdings boost reputation earnings:
```typescript
interface ReputationBoost {
  holdings: number;
  multiplier: number;
}

// Active multipliers
1,000-4,999 MTAA:   1.1x reputation
5,000-9,999 MTAA:   1.25x reputation
10,000-49,999 MTAA: 1.5x reputation
50,000+ MTAA:       2.0x reputation
```

## Reward Distribution (Implemented)

### Community Rewards (Active)

**Activity Rewards**
- DAO Creation: 1,000 MTAA
- First Proposal: 100 MTAA
- First Vote: 50 MTAA
- First Vault Deposit: 200 MTAA
- Proposal Passed: 500 MTAA

**Milestone Rewards**
- 1,000 cUSD deposited: 100 MTAA
- 10,000 cUSD deposited: 1,000 MTAA
- 100,000 cUSD deposited: 10,000 MTAA

**Referral Rewards (Tier System)**
```typescript
// Active referral program
Level 1: 100 MTAA per referral (Bronze)
Level 2: 150 MTAA per referral (Silver - 10+ refs)
Level 3: 200 MTAA per referral (Gold - 50+ refs)
Level 4: 300 MTAA per referral (Platinum - 100+ refs)

// Leaderboard prizes (monthly)
1st place: 10,000 MTAA
2nd place: 5,000 MTAA
3rd place: 2,500 MTAA
Top 10: 1,000 MTAA each
```

### Staking Rewards (Automated)

**Distribution Schedule**
- Daily reward calculation
- Weekly distribution to stakers
- Compound option available
- Emergency unlock (10% penalty)

**Current APY Rates**
- 30-day lock: 8% base + vault performance
- 90-day lock: 10% base + vault performance
- 180-day lock: 12% base + vault performance
- 365-day lock: 15% base + vault performance

### Treasury Rewards (Governance-Controlled)

**DAO Performance Bonuses**
- Top performing DAO: 5,000 MTAA/month
- Highest TVL growth: 3,000 MTAA/month
- Most active governance: 2,000 MTAA/month
- Community impact award: 5,000 MTAA/quarter

## Fee Structure (Operational)

### Vault Fees
- **Management Fee**: 0.5% annually (auto-collected)
- **Performance Fee**: 10% of profits above baseline
- **Withdrawal Fee**: 0.5% if withdrawn within 30 days
- **Deposit Fee**: 0.1% (waived for MTAA holders)

### Platform Fees (Paid in cUSD or MTAA)
- **DAO Creation**: 1,000 MTAA or $100 cUSD
- **Proposal Fee**: 100-1,000 MTAA (refunded if passed)
- **Transaction Fee**: 0.1% (50% discount with MTAA)
- **Premium Features**: Monthly MTAA subscription

### Fee Distribution
- 50% → DAO Treasury (governance-controlled)
- 25% → MTAA Stakers
- 15% → Liquidity Providers
- 10% → Platform Development

## Burn Mechanisms (Active)

**Automatic Burns**
- 25% of all platform fees
- Unclaimed rewards after 90 days
- Failed proposal fees (malicious activity)

**Quarterly Burn Events**
- Community vote on burn amount
- Target: 1-2% of circulating supply annually
- Deflationary pressure on token

## Economic Sustainability

**Revenue Streams (Live)**
1. Vault management fees: ~$50K/month (est.)
2. Platform transaction fees: ~$30K/month (est.)
3. Premium subscriptions: ~$20K/month (est.)
4. DAO creation fees: ~$10K/month (est.)

**Total Platform Revenue**: ~$110K/month (growing)

**Value Accrual to MTAA**
- Fee discounts create buying pressure
- Staking locks reduce circulating supply
- Burns create scarcity
- Governance rights increase utility