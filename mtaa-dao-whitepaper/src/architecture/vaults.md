
# Vault System

## Vault Architecture

```rust
/// Multi-asset vault types
pub enum VaultType {
    /// Individual savings vault
    Personal {
        owner: Address,
        auto_compound: bool,
        withdraw_lock: Option<Duration>,
    },
    
    /// Community pooled vault
    Community {
        dao_id: Uuid,
        members: Vec<Address>,
        governance: GovernanceRules,
        disbursement_schedule: Option<Schedule>,
    },
    
    /// Yield-generating strategy vault
    Strategy {
        protocol: LendingProtocol,  // Moola, Ubeswap
        risk_level: RiskLevel,
        auto_rebalance: bool,
    },
}

/// Vault state
pub struct VaultState {
    total_deposits: Decimal,
    total_shares: Decimal,
    nav_per_share: Decimal,
    
    /// Performance metrics
    apy: Decimal,
    total_yield: Decimal,
    fees_collected: Decimal,
}
```

## Deposit Flow

```rust
/// User deposits cUSD into vault
pub async fn deposit_cusd(
    user_id: Uuid,
    amount: Decimal,
    vault_type: VaultType,
) -> Result<VaultReceipt> {
    // 1. Validate user balance
    let balance = get_token_balance(user_id, TokenType::CUSD).await?;
    require!(balance >= amount, "Insufficient balance");
    
    // 2. Calculate shares to issue
    let vault = Vault::get(vault_type).await?;
    let shares = if vault.total_shares == 0 {
        amount  // First deposit: 1:1 ratio
    } else {
        amount * vault.total_shares / vault.total_assets
    };
    
    // 3. Transfer tokens to vault contract
    let tx = vault_contract
        .deposit(amount, user_address)
        .send()
        .await?;
    
    // 4. Update database
    db.vault_positions.insert({
        user_id,
        vault_id: vault.id,
        shares,
        deposited_at: Utc::now(),
    }).await?;
    
    // 5. Issue receipt
    Ok(VaultReceipt {
        tx_hash: tx.hash,
        shares_issued: shares,
        nav_per_share: vault.nav_per_share,
        total_value: amount,
    })
}
```

## Withdrawal Flow

```rust
/// User withdraws from vault
pub async fn withdraw(
    user_id: Uuid,
    shares: Decimal,
    vault_id: Uuid,
) -> Result<Transaction> {
    // 1. Check withdrawal eligibility
    let position = db.vault_positions
        .find({ user_id, vault_id })
        .await?;
    
    require!(position.shares >= shares, "Insufficient shares");
    
    // 2. Check lock period
    if let Some(lock_until) = position.lock_until {
        require!(Utc::now() > lock_until, "Funds locked");
    }
    
    // 3. Calculate assets to return
    let vault = Vault::get(vault_id).await?;
    let assets = shares * vault.nav_per_share;
    
    // 4. Apply fees (if any)
    let fee = calculate_withdrawal_fee(assets, position.deposited_at)?;
    let net_assets = assets - fee;
    
    // 5. Execute withdrawal
    let tx = vault_contract
        .withdraw(net_assets, user_address, user_address)
        .send()
        .await?;
    
    // 6. Update position
    db.vault_positions.update({
        user_id,
        vault_id,
        shares: position.shares - shares,
    }).await?;
    
    Ok(tx)
}
```

## NAV Calculation

```rust
/// Calculate Net Asset Value per share
pub fn calculate_nav(vault: &Vault) -> Decimal {
    // 1. Sum all vault assets
    let total_assets = vault.holdings.iter()
        .map(|h| {
            let price = get_token_price(h.token)?;
            h.amount * price
        })
        .sum::<Result<Decimal>>()?;
    
    // 2. Add accrued yield
    let yield_earned = calculate_yield(vault)?;
    let total_value = total_assets + yield_earned;
    
    // 3. Divide by total shares
    let nav_per_share = if vault.total_shares > 0 {
        total_value / vault.total_shares
    } else {
        Decimal::ONE
    };
    
    // 4. Update vault state
    vault.update_nav(nav_per_share)?;
    
    Ok(nav_per_share)
}
```

## Yield Strategies

```rust
/// Lending protocol integration
pub enum YieldStrategy {
    /// Deposit to Moola Market
    MoolaLending {
        asset: Address,
        apy: Decimal,  // ~5-8% on cUSD
    },
    
    /// Liquidity provision on Ubeswap
    UbeswapLP {
        pair: (Address, Address),
        apy: Decimal,  // ~10-15%
    },
    
    /// Staking CELO
    CeloStaking {
        validator: Address,
        apy: Decimal,  // ~5%
    },
}

impl YieldStrategy {
    /// Deploy funds to strategy
    pub async fn deploy(&self, amount: Decimal) -> Result<()> {
        match self {
            MoolaLending { asset, .. } => {
                moola_market.supply(*asset, amount).await?;
            },
            UbeswapLP { pair, .. } => {
                ubeswap_router.add_liquidity(pair.0, pair.1, amount).await?;
            },
            CeloStaking { validator, .. } => {
                election.vote(*validator, amount).await?;
            },
        }
        Ok(())
    }
}
```

## Fee Structure

```rust
/// Vault fee configuration
pub struct FeeStructure {
    /// Management fee (annual)
    management_fee: Decimal,  // 0.5% per year
    
    /// Performance fee
    performance_fee: Decimal,  // 10% of profits
    
    /// Withdrawal fee (early withdrawal)
    early_withdrawal_fee: Decimal,  // 0.5% if < 30 days
    
    /// Deposit fee
    deposit_fee: Decimal,  // 0.1%
}

/// Calculate fees
pub fn calculate_fees(
    vault: &Vault,
    period: Duration,
) -> FeeBreakdown {
    let mgmt_fee = vault.total_assets 
        * vault.fees.management_fee 
        * (period.num_days() as f64 / 365.0);
    
    let profit = vault.total_yield - vault.initial_value;
    let perf_fee = if profit > 0 {
        profit * vault.fees.performance_fee
    } else {
        Decimal::ZERO
    };
    
    FeeBreakdown {
        management: mgmt_fee,
        performance: perf_fee,
        total: mgmt_fee + perf_fee,
    }
}
```

## Automated Operations

```rust
/// Vault automation service
pub struct VaultAutomation {
    update_interval: Duration,  // 30 seconds
    
    /// Scheduled tasks
    tasks: Vec<AutomatedTask>,
}

pub enum AutomatedTask {
    /// Update NAV every 30s
    UpdateNAV { vault_id: Uuid },
    
    /// Collect fees daily
    CollectFees { vault_id: Uuid },
    
    /// Rebalance portfolio
    Rebalance { strategy: YieldStrategy },
    
    /// Execute scheduled disbursements
    Disburse { proposal_id: Uuid },
}

impl VaultAutomation {
    pub async fn run(&self) {
        loop {
            for task in &self.tasks {
                match task {
                    UpdateNAV { vault_id } => {
                        let vault = Vault::get(*vault_id).await?;
                        calculate_nav(&vault)?;
                    },
                    CollectFees { vault_id } => {
                        collect_vault_fees(*vault_id).await?;
                    },
                    // ... other tasks
                }
            }
            
            sleep(self.update_interval).await;
        }
    }
}
```

---

_Next: [Blockchain Integration](./blockchain.md)_
