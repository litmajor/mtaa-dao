
# Blockchain Integration

## Celo Network Integration

```rust
/// Celo blockchain configuration
pub struct CeloConfig {
    /// Network details
    chain_id: u64,           // 44787 (Alfajores), 42220 (Mainnet)
    rpc_url: String,         // https://alfajores-forno.celo-testnet.org
    
    /// Native tokens
    native_token: Address,   // CELO
    stable_tokens: Vec<StableToken>,
    
    /// Contract addresses
    contracts: ContractRegistry,
}

pub struct StableToken {
    symbol: String,          // cUSD, cEUR, cREAL
    address: Address,
    decimals: u8,            // 18
    oracle: Address,         // Price feed
}
```

## Web3 Provider Setup

```rust
/// Initialize blockchain connection
pub async fn init_provider() -> Result<Provider> {
    let provider = Provider::<Http>::try_from(
        "https://alfajores-forno.celo-testnet.org"
    )?;
    
    // Verify connection
    let network = provider.get_network().await?;
    ensure!(network.chain_id == 44787, "Wrong network");
    
    // Get latest block
    let block_number = provider.get_block_number().await?;
    info!("Connected to Celo Alfajores at block {}", block_number);
    
    Ok(provider)
}

/// Create wallet from private key
pub fn create_wallet(private_key: &str) -> Result<Wallet> {
    let wallet = private_key
        .parse::<LocalWallet>()?
        .with_chain_id(44787u64);
    
    info!("Wallet address: {}", wallet.address());
    
    Ok(wallet)
}
```

## Contract Interactions

```rust
/// MaonoVault contract interface
#[derive(Debug)]
pub struct MaonoVaultContract {
    address: Address,
    abi: Abi,
    provider: Provider<Http>,
}

impl MaonoVaultContract {
    /// Get vault NAV
    pub async fn get_nav(&self) -> Result<(U256, U256)> {
        let contract = Contract::new(
            self.address,
            self.abi.clone(),
            self.provider.clone(),
        );
        
        let nav: U256 = contract
            .method("navPerShare", ())?
            .call()
            .await?;
        
        let last_update: U256 = contract
            .method("lastNAVUpdate", ())?
            .call()
            .await?;
        
        Ok((nav, last_update))
    }
    
    /// Deposit assets
    pub async fn deposit(
        &self,
        wallet: &Wallet,
        amount: U256,
    ) -> Result<TransactionReceipt> {
        let contract = Contract::new(
            self.address,
            self.abi.clone(),
            SignerMiddleware::new(self.provider.clone(), wallet.clone()),
        );
        
        let tx = contract
            .method("deposit", (amount, wallet.address()))?
            .send()
            .await?
            .await?;
        
        Ok(tx.unwrap())
    }
}
```

## Event Indexing

```rust
/// Index vault events
pub struct EventIndexer {
    contract: MaonoVaultContract,
    from_block: u64,
}

impl EventIndexer {
    /// Listen for Deposit events
    pub async fn index_deposits(&self) -> Result<()> {
        let filter = Filter::new()
            .address(self.contract.address)
            .event("Deposit(address,uint256,uint256)")
            .from_block(self.from_block);
        
        let logs = self.contract.provider
            .get_logs(&filter)
            .await?;
        
        for log in logs {
            let event = parse_deposit_event(log)?;
            
            // Store in database
            db.vault_events.insert({
                event_type: "deposit",
                user: event.user,
                amount: event.assets,
                shares: event.shares,
                block_number: log.block_number,
                tx_hash: log.transaction_hash,
            }).await?;
        }
        
        Ok(())
    }
}

/// Parse deposit event
fn parse_deposit_event(log: Log) -> Result<DepositEvent> {
    let decoded = ethabi::decode(
        &[
            ParamType::Address,  // user
            ParamType::Uint(256), // assets
            ParamType::Uint(256), // shares
        ],
        &log.data,
    )?;
    
    Ok(DepositEvent {
        user: decoded[0].clone().into_address().unwrap(),
        assets: decoded[1].clone().into_uint().unwrap(),
        shares: decoded[2].clone().into_uint().unwrap(),
    })
}
```

## Transaction Management

```rust
/// Send transaction with retry logic
pub async fn send_transaction_with_retry(
    wallet: &Wallet,
    tx: TransactionRequest,
    max_retries: u8,
) -> Result<TransactionReceipt> {
    let mut retries = 0;
    
    loop {
        match wallet.send_transaction(tx.clone(), None).await {
            Ok(pending_tx) => {
                return pending_tx.await?.ok_or(anyhow!("No receipt"));
            },
            Err(e) if retries < max_retries => {
                warn!("Transaction failed, retrying... ({}/{})", retries + 1, max_retries);
                retries += 1;
                sleep(Duration::from_secs(2u64.pow(retries as u32))).await;
            },
            Err(e) => return Err(e.into()),
        }
    }
}

/// Estimate gas for transaction
pub async fn estimate_gas(
    provider: &Provider<Http>,
    tx: &TransactionRequest,
) -> Result<GasEstimate> {
    let gas_limit = provider.estimate_gas(tx, None).await?;
    let gas_price = provider.get_gas_price().await?;
    
    Ok(GasEstimate {
        limit: gas_limit,
        price: gas_price,
        total_cost: gas_limit * gas_price,
        total_cost_celo: format_units(gas_limit * gas_price, 18)?,
    })
}
```

## Token Operations

```rust
/// ERC20 token interface
pub struct ERC20Token {
    address: Address,
    provider: Provider<Http>,
}

impl ERC20Token {
    /// Get balance
    pub async fn balance_of(&self, account: Address) -> Result<U256> {
        let contract = Contract::new(
            self.address,
            ERC20_ABI.clone(),
            self.provider.clone(),
        );
        
        let balance: U256 = contract
            .method("balanceOf", account)?
            .call()
            .await?;
        
        Ok(balance)
    }
    
    /// Approve spending
    pub async fn approve(
        &self,
        wallet: &Wallet,
        spender: Address,
        amount: U256,
    ) -> Result<TransactionReceipt> {
        let contract = Contract::new(
            self.address,
            ERC20_ABI.clone(),
            SignerMiddleware::new(self.provider.clone(), wallet.clone()),
        );
        
        let tx = contract
            .method("approve", (spender, amount))?
            .send()
            .await?
            .await?;
        
        Ok(tx.unwrap())
    }
}
```

## Multi-Token Support

```rust
/// Supported tokens on Celo
pub struct TokenRegistry {
    tokens: HashMap<String, TokenInfo>,
}

pub struct TokenInfo {
    symbol: String,
    name: String,
    address: Address,
    decimals: u8,
    is_stable: bool,
    oracle: Option<Address>,
}

impl TokenRegistry {
    pub fn celo_tokens() -> Self {
        let mut tokens = HashMap::new();
        
        // Native CELO
        tokens.insert("CELO".to_string(), TokenInfo {
            symbol: "CELO".to_string(),
            name: "Celo Native Asset".to_string(),
            address: "0xF194afDf50B03e69Bd7D057c1Aa9e10c9954E4C9".parse().unwrap(),
            decimals: 18,
            is_stable: false,
            oracle: Some("0x...".parse().unwrap()),
        });
        
        // cUSD stablecoin
        tokens.insert("cUSD".to_string(), TokenInfo {
            symbol: "cUSD".to_string(),
            name: "Celo Dollar".to_string(),
            address: "0x874069Fa1Eb16D44d622F2e0Ca25eeA172369bC1".parse().unwrap(),
            decimals: 18,
            is_stable: true,
            oracle: Some("0x...".parse().unwrap()),
        });
        
        Self { tokens }
    }
}
```

---

_Next: [Governance Model](../governance/model.md)_
