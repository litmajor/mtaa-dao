
# Tokenomics

## Token Distribution

```rust
/// MTAA total supply: 1 billion tokens
pub struct TokenDistribution {
    total_supply: 1_000_000_000e18,
    
    allocations: {
        community_rewards: 400_000_000e18,   // 40%
        dao_treasury: 200_000_000e18,        // 20%
        team_advisors: 150_000_000e18,       // 15%
        ecosystem_dev: 100_000_000e18,       // 10%
        liquidity: 75_000_000e18,            // 7.5%
        public_sale: 50_000_000e18,          // 5%
        strategic_partners: 25_000_000e18,   // 2.5%
    }
}
```

## Vesting Schedules

### Team & Advisors (150M MTAA)

```rust
/// Team vesting: 3 years, 1-year cliff
pub struct TeamVesting {
    total_amount: 150_000_000e18,
    duration: 3 years,
    cliff: 1 year,
    schedule: VestingType::Linear,
}

impl TeamVesting {
    pub fn calculate_vested(&self, elapsed: Duration) -> u256 {
        if elapsed < self.cliff {
            return 0;
        }
        
        let vesting_time = elapsed - self.cliff;
        let vesting_duration = self.duration - self.cliff;
        
        (self.total_amount * vesting_time) / vesting_duration
    }
}
```

### Community Rewards (400M MTAA)

```rust
/// Community distribution: 4 years linear
pub struct CommunityRewards {
    yearly_allocation: [
        100_000_000e18, // Year 1
        100_000_000e18, // Year 2
        100_000_000e18, // Year 3
        100_000_000e18, // Year 4
    ],
    
    breakdown: {
        daily_challenges: 2_000_000e18,     // per year
        task_bounties: 50_000_000e18,
        governance_participation: 20_000_000e18,
        staking_rewards: 30_000_000e18,
        achievement_unlocks: 10_000_000e18,
        referral_program: 5_000_000e18,
        content_creation: 8_000_000e18,
    }
}
```

## Earning Mechanisms

### Daily Challenges

```rust
/// Daily challenge rewards
pub struct DailyChallenge {
    /// Base rewards
    vote_on_proposal: 50e18,
    complete_task: 100e18,
    invite_member: 200e18,
    comment_proposal: 25e18,
    attend_meeting: 75e18,
    
    /// Streak multipliers
    fn apply_streak_multiplier(&self, base_reward: u256, streak: u32) -> u256 {
        let multiplier = match streak {
            7.. => 150,   // 1.5x for 7-day streak
            30.. => 200,  // 2x for 30-day streak
            90.. => 300,  // 3x for 90-day streak
            365.. => 500, // 5x for 365-day streak
            _ => 100,
        };
        
        (base_reward * multiplier) / 100
    }
}
```

### Task Bounties

```rust
/// Task difficulty rewards
pub enum TaskDifficulty {
    Easy {
        time_estimate: 1..2 hours,
        reward_range: 100..500e18,
    },
    Medium {
        time_estimate: 1..3 days,
        reward_range: 500..2000e18,
    },
    Hard {
        time_estimate: 1..2 weeks,
        reward_range: 2000..10000e18,
    },
    Expert {
        time_estimate: 1+ months,
        reward_range: 10000+e18,
    },
}

/// Specialized bounties
pub struct SpecializedBounty {
    smart_contract_audit: 50_000e18,
    ui_ux_design: 5_000..20_000e18,
    content_creation: 1_000..5_000e18,
    bug_reporting: 500..5_000e18,
    community_moderation: 2_000e18, // per month
}
```

### Reputation-Based Multipliers

```rust
/// Reputation tiers and multipliers
pub enum ReputationTier {
    Member {        // 0-999 points
        multiplier: 100,  // 1x
    },
    Contributor {   // 1,000-4,999 points
        multiplier: 125,  // 1.25x
    },
    Elder {         // 5,000-9,999 points
        multiplier: 150,  // 1.5x
    },
    Architect {     // 10,000+ points
        multiplier: 200,  // 2x
    },
}
```

## Staking System

### Staking Tiers

```rust
/// Staking with lock periods
pub struct StakingTier {
    lock_30_days: {
        apy: 8%,
        min_stake: 1_000e18,
    },
    lock_90_days: {
        apy: 10%,
        min_stake: 1_000e18,
    },
    lock_180_days: {
        apy: 12%,
        min_stake: 1_000e18,
    },
    lock_365_days: {
        apy: 15%,
        min_stake: 1_000e18,
    },
}

/// Calculate staking rewards
pub fn calculate_stake_reward(
    amount: u256,
    lock_period: u32, // days
    elapsed: Duration,
) -> u256 {
    let apy = match lock_period {
        30 => 800,   // 8% (basis points)
        90 => 1000,  // 10%
        180 => 1200, // 12%
        365 => 1500, // 15%
        _ => revert!("Invalid lock period"),
    };
    
    let annual_reward = (amount * apy) / 10000;
    (annual_reward * elapsed.as_secs()) / (365 days).as_secs()
}
```

## Fee Structure

### Platform Fees

```rust
/// Platform service fees
pub struct PlatformFees {
    dao_creation: 1_000e18,
    vault_deployment: 500e18,
    premium_proposal: 100e18,
    analytics_monthly: 50e18,
    custom_branding: 200e18,
    
    /// Fee distribution
    fn distribute_fee(&self, fee: u256) {
        let burn_amount = fee / 2;     // 50% burn
        let treasury_amount = fee - burn_amount; // 50% treasury
        
        mtaa_token.burn(burn_amount);
        mtaa_token.transfer(dao_treasury, treasury_amount);
    }
}
```

### Vault Fees

```rust
/// MaonoVault fee structure
pub struct VaultFees {
    performance_fee: 1500, // 15% (basis points)
    management_fee: 200,   // 2% annual
    
    /// Fee limits
    max_performance_fee: 2000, // 20%
    max_management_fee: 500,   // 5% annual
    
    /// Calculate management fee
    fn calculate_management_fee(
        vault_tvl: u256,
        time_elapsed: Duration,
    ) -> u256 {
        let annual_fee = (vault_tvl * management_fee) / 10000;
        (annual_fee * time_elapsed.as_secs()) / (365 days).as_secs()
    }
}
```

## Deflationary Mechanisms

### Token Burns

```rust
/// Quarterly burn schedule
pub struct BurnSchedule {
    year_1: 10_000_000e18,  // 1% of supply
    year_2: 15_000_000e18,  // 1.5% of supply
    year_3: 20_000_000e18,  // 2% annually thereafter
    
    /// Burn sources
    sources: {
        platform_fees: 50%, // 50% of fees burned
        failed_proposals: 100%, // Malicious proposals
        inactive_stakes: 1%, // After 2 years
    }
}

/// Execute quarterly burn
pub fn execute_quarterly_burn() {
    let burn_amount = (total_supply * 250) / 10000; // 2.5% quarterly
    let treasury_balance = mtaa_token.balance_of(dao_treasury);
    
    let actual_burn = min(burn_amount, treasury_balance);
    mtaa_token.burn_from(dao_treasury, actual_burn);
    
    emit QuarterlyBurn(actual_burn, block.timestamp);
}
```

## Economic Security

### Inflation Control

```rust
/// Emission controls
pub struct EmissionControl {
    max_daily_issuance: total_supply * 0.001, // 0.1% per day
    
    /// Emission reduction schedule
    fn get_emission_rate(year: u32) -> u256 {
        match year {
            1..=3 => 100, // 100% base rate
            4.. => max(10, 100 - ((year - 3) * 10)), // 10% reduction per year
        }
    }
}
```

---

_Next: [Roadmap](./roadmap.md)_
