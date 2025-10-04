
# System Overview

## High-Level Architecture

```rust
/// MtaaDAO Platform Architecture
pub struct MtaaPlatform {
    /// Blockchain layer - Celo network integration
    pub blockchain: BlockchainLayer,
    
    /// Smart contract system
    pub contracts: ContractLayer,
    
    /// Backend services
    pub services: ServiceLayer,
    
    /// Frontend applications
    pub client: ClientLayer,
    
    /// External integrations
    pub integrations: IntegrationLayer,
}

/// Blockchain Layer Configuration
pub struct BlockchainLayer {
    network: CeloNetwork,
    rpc_endpoint: String,
    contracts: Vec<DeployedContract>,
}

impl BlockchainLayer {
    /// Network: Celo Mainnet & Alfajores Testnet
    /// RPC: https://alfajores-forno.celo-testnet.org
    /// Chain ID: 44787 (testnet), 42220 (mainnet)
}
```

## System Components

### 1. Smart Contracts

```rust
/// Core smart contract system
pub mod contracts {
    /// ERC4626 vault for asset management
    pub struct MaonoVault {
        total_assets: u256,
        shares_issued: u256,
        nav_per_share: u256,
        supported_tokens: Vec<Address>, // cUSD, CELO, USDT
    }
    
    /// DAO governance contract
    pub struct MtaaGovernance {
        voting_period: Duration,
        quorum_threshold: u8,  // Percentage required
        proposal_threshold: u256, // Minimum tokens to propose
    }
    
    /// Utility token
    pub struct MtaaToken {
        total_supply: u256, // 1,000,000,000 MTAA
        decimals: u8,       // 18
    }
}
```

### 2. Backend Services

```rust
/// Server-side architecture
pub mod services {
    use express::Router;
    use drizzle::Database;
    
    /// API server configuration
    pub struct ApiServer {
        port: u16,              // 5000
        database: PostgresDB,   // Neon serverless
        blockchain: EthersProvider,
    }
    
    /// Key services
    pub enum ServiceModule {
        VaultAutomation,        // NAV updates, fee collection
        ProposalExecution,      // Automated proposal execution
        NotificationService,    // Real-time alerts
        ReputationSystem,       // Merit tracking
        PaymentGateway,         // Mpesa, Stripe, Crypto
    }
}
```

### 3. Frontend Application

```rust
/// Client-side stack
pub mod client {
    /// React SPA with TypeScript
    pub struct WebApp {
        framework: "React 18",
        router: "Wouter",
        state: "TanStack Query",
        ui: "Tailwind + Shadcn",
    }
    
    /// Key features
    pub enum Feature {
        WalletIntegration,      // MiniPay, MetaMask
        DaoManagement,          // Create, manage DAOs
        VaultDashboard,         // Deposits, withdrawals
        Governance,             // Proposals, voting
        Analytics,              // Real-time insights
    }
}
```

## Data Flow

```rust
/// Example: User deposits to vault
async fn deposit_flow(user: User, amount: Decimal) -> Result<Transaction> {
    // 1. Frontend: User initiates deposit
    let wallet = user.connect_wallet()?;
    
    // 2. Smart Contract: Approve token transfer
    let token = ERC20::at(cusd_address);
    token.approve(vault_address, amount).await?;
    
    // 3. Vault Contract: Process deposit
    let vault = MaonoVault::at(vault_address);
    let shares = vault.deposit(amount, user.address).await?;
    
    // 4. Backend: Index event & update DB
    db.vaults.update({
        user_id: user.id,
        shares: shares,
        timestamp: Utc::now(),
    }).await?;
    
    // 5. Notification: Alert user
    notify(user.id, "Deposit successful: {} shares", shares)?;
    
    Ok(tx)
}
```

## Technology Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Blockchain** | Celo | L1 network, mobile-first |
| **Smart Contracts** | Solidity 0.8+ | Vault, governance, tokens |
| **Backend** | Node.js + Express | RESTful API server |
| **Database** | PostgreSQL (Neon) | Serverless, scalable |
| **Frontend** | React + TypeScript | Modern SPA |
| **State** | TanStack Query | Server state management |
| **Blockchain SDK** | Ethers.js | Contract interactions |
| **Payments** | Mpesa, Stripe | Fiat on/off ramps |

---

_Next: [Smart Contracts](./contracts.md)_
