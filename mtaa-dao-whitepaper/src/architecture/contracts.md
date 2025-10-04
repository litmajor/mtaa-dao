
# Smart Contracts

## Core Contracts

### MaonoVault (ERC4626)

```solidity
/// @title MaonoVault - Community Asset Management Vault
/// @notice ERC4626 compliant vault for transparent asset management
contract MaonoVault is ERC4626, Ownable {
    /// State variables
    uint256 public navPerShare;
    uint256 public totalAssets;
    mapping(address => bool) public supportedTokens;
    
    /// Supported assets
    address public constant CUSD = 0x874069Fa1Eb16D44d622F2e0Ca25eeA172369bC1;
    address public constant CELO = 0xF194afDf50B03e69Bd7D057c1Aa9e10c9954E4C9;
    
    /// Events
    event Deposit(address indexed user, uint256 assets, uint256 shares);
    event Withdraw(address indexed user, uint256 assets, uint256 shares);
    event NAVUpdated(uint256 oldNav, uint256 newNav);
}
```

### Key Functions

```rust
/// Deposit assets into vault
pub fn deposit(assets: u256, receiver: Address) -> u256 {
    // 1. Transfer tokens from user
    require!(token.transferFrom(msg.sender, vault, assets));
    
    // 2. Calculate shares to mint
    let shares = if total_supply == 0 {
        assets
    } else {
        assets * total_supply / total_assets
    };
    
    // 3. Mint shares to user
    _mint(receiver, shares);
    
    // 4. Update total assets
    total_assets += assets;
    
    shares
}

/// Withdraw assets from vault
pub fn withdraw(
    assets: u256,
    receiver: Address,
    owner: Address
) -> u256 {
    // 1. Calculate shares needed
    let shares = assets * total_supply / total_assets;
    
    // 2. Burn user's shares
    _burn(owner, shares);
    
    // 3. Transfer assets to receiver
    require!(token.transfer(receiver, assets));
    
    // 4. Update total assets
    total_assets -= assets;
    
    shares
}
```

## MtaaGovernance

```rust
/// DAO governance contract
pub struct Proposal {
    id: u256,
    proposer: Address,
    description: String,
    start_block: u256,
    end_block: u256,
    
    /// Voting state
    for_votes: u256,
    against_votes: u256,
    abstain_votes: u256,
    
    /// Execution
    targets: Vec<Address>,
    values: Vec<u256>,
    calldatas: Vec<Bytes>,
    
    /// Status
    executed: bool,
    canceled: bool,
}

/// Vote on proposal
pub fn cast_vote(
    proposal_id: u256,
    support: u8,  // 0=against, 1=for, 2=abstain
) {
    let proposal = proposals[proposal_id];
    require!(block.number >= proposal.start_block);
    require!(block.number <= proposal.end_block);
    
    let weight = get_votes(msg.sender);
    
    match support {
        0 => proposal.against_votes += weight,
        1 => proposal.for_votes += weight,
        2 => proposal.abstain_votes += weight,
        _ => revert!("Invalid vote type"),
    }
    
    emit VoteCast(msg.sender, proposal_id, support, weight);
}
```

## MtaaToken (ERC20)

```rust
/// Governance & utility token
pub struct MtaaToken {
    name: "MtaaDAO Token",
    symbol: "MTAA",
    decimals: 18,
    total_supply: 1_000_000_000e18, // 1 billion
    
    /// Distribution
    community_rewards: 400_000_000e18,  // 40%
    dao_treasury: 200_000_000e18,       // 20%
    team: 150_000_000e18,               // 15%
    ecosystem: 100_000_000e18,          // 10%
    liquidity: 75_000_000e18,           // 7.5%
    public_sale: 50_000_000e18,         // 5%
    partners: 25_000_000e18,            // 2.5%
}

/// Staking mechanism
pub fn stake(amount: u256, lock_period: Duration) {
    require!(balanceOf(msg.sender) >= amount);
    
    let apy = match lock_period {
        30 days => 8,   // 8% APY
        90 days => 10,  // 10% APY
        180 days => 12, // 12% APY
        365 days => 15, // 15% APY
        _ => revert!("Invalid lock period"),
    };
    
    stakes[msg.sender] = Stake {
        amount,
        lock_until: block.timestamp + lock_period,
        apy,
    };
    
    _transfer(msg.sender, address(this), amount);
}
```

## Security Features

```rust
/// Multi-sig treasury
pub struct MultiSigTreasury {
    required_confirmations: u8,  // 3 of 5
    owners: Vec<Address>,
    
    /// Execute after confirmations
    fn execute_transaction(tx_id: u256) {
        require!(confirmations[tx_id] >= required_confirmations);
        // Execute transaction
    }
}

/// Time-lock for critical operations
pub struct TimeLock {
    delay: Duration,  // 48 hours for governance changes
    
    fn queue_transaction(target: Address, data: Bytes) {
        let eta = block.timestamp + delay;
        queue[tx_id] = QueuedTx { target, data, eta };
    }
}
```

## Gas Optimization

```rust
/// Example: Batch operations
pub fn batch_transfer(
    recipients: Vec<Address>,
    amounts: Vec<u256>
) {
    require!(recipients.len() == amounts.len());
    
    for (i, recipient) in recipients.iter().enumerate() {
        _transfer(msg.sender, recipient, amounts[i]);
    }
    
    // Single event for all transfers
    emit BatchTransfer(msg.sender, recipients, amounts);
}
```

---

_Next: [Vault System](./vaults.md)_
