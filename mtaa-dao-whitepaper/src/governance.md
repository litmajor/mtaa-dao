
# Governance

## Overview

MtaaDAO implements a comprehensive governance system that empowers community members to participate in decision-making through transparent, on-chain voting mechanisms.

## Governance Token: MTAA

```rust
/// MTAA token powers governance
pub struct MTAAToken {
    name: "MtaaDAO Token",
    symbol: "MTAA",
    total_supply: 1_000_000_000e18, // 1 billion
    
    /// Governance features
    voting_power: mapping(Address => u256),
    delegates: mapping(Address => Address),
    checkpoints: mapping(Address => Checkpoint[]),
}

/// Vote delegation
pub fn delegate(delegatee: Address) {
    require!(delegatee != address(0));
    
    let delegator = msg.sender;
    let current_delegate = delegates[delegator];
    
    delegates[delegator] = delegatee;
    
    emit DelegateChanged(delegator, current_delegate, delegatee);
}
```

## Proposal System

```rust
/// Proposal structure
pub struct Proposal {
    id: u256,
    proposer: Address,
    title: String,
    description: String,
    
    /// Voting parameters
    start_block: u256,
    end_block: u256,
    quorum: u256,
    
    /// Vote tallies
    yes_votes: u256,
    no_votes: u256,
    abstain_votes: u256,
    
    /// Execution
    targets: Vec<Address>,
    values: Vec<u256>,
    calldatas: Vec<Bytes>,
    
    status: ProposalStatus,
}

pub enum ProposalStatus {
    Pending,
    Active,
    Succeeded,
    Defeated,
    Executed,
    Canceled,
}
```

## Voting Mechanisms

### Quadratic Voting

```rust
/// Quadratic voting to prevent whale dominance
pub fn calculate_voting_power(
    token_balance: u256,
    reputation_score: u256,
) -> u256 {
    let base_power = token_balance.sqrt();
    let reputation_multiplier = match reputation_score {
        0..999 => 100,      // 1x
        1000..4999 => 125,  // 1.25x
        5000..9999 => 150,  // 1.5x
        10000.. => 200,     // 2x
    };
    
    (base_power * reputation_multiplier) / 100
}

/// Cast vote with quadratic weight
pub fn cast_vote(
    proposal_id: u256,
    support: u8,  // 0=against, 1=for, 2=abstain
) {
    let voter = msg.sender;
    let weight = calculate_voting_power(
        mtaa_token.balance_of(voter),
        reputation.get_score(voter),
    );
    
    // Apply vote weight cap (max 10% of total)
    let capped_weight = min(weight, total_supply / 10);
    
    match support {
        0 => proposal.no_votes += capped_weight,
        1 => proposal.yes_votes += capped_weight,
        2 => proposal.abstain_votes += capped_weight,
        _ => revert!("Invalid vote type"),
    }
    
    emit VoteCast(voter, proposal_id, support, capped_weight);
}
```

## Proposal Types

### Standard Proposal

```rust
/// Standard governance proposal
/// Required: 100 MTAA + 1,000 reputation
pub struct StandardProposal {
    fee: 100e18,
    min_reputation: 1000,
    voting_period: 7 days,
    quorum: 5%, // 5% of circulating supply
}
```

### Treasury Proposal

```rust
/// Treasury spending proposal
/// Required: 500 MTAA + 5,000 reputation
pub struct TreasuryProposal {
    fee: 500e18,
    min_reputation: 5000,
    voting_period: 7 days,
    quorum: 10%,
    max_amount: 1_000_000e18, // 1M MTAA
}
```

### Protocol Change

```rust
/// Critical protocol changes
/// Required: 1,000 MTAA + 10,000 reputation
pub struct ProtocolProposal {
    fee: 1000e18,
    min_reputation: 10000,
    voting_period: 14 days,
    quorum: 20%,
    time_lock: 48 hours, // Execution delay
}
```

## Proposal Lifecycle

```rust
/// 1. Proposal creation
pub fn propose(
    targets: Vec<Address>,
    values: Vec<u256>,
    calldatas: Vec<Bytes>,
    description: String,
) -> u256 {
    // Verify proposer eligibility
    require!(mtaa_token.balance_of(msg.sender) >= min_tokens);
    require!(reputation.get_score(msg.sender) >= min_reputation);
    
    // Charge proposal fee
    mtaa_token.transfer_from(msg.sender, dao_treasury, proposal_fee);
    
    // Create proposal
    let proposal_id = next_proposal_id++;
    proposals[proposal_id] = Proposal {
        proposer: msg.sender,
        start_block: block.number + voting_delay,
        end_block: block.number + voting_delay + voting_period,
        // ... other fields
    };
    
    emit ProposalCreated(proposal_id, msg.sender);
    proposal_id
}

/// 2. Voting period (7-14 days)
pub fn vote(proposal_id: u256, support: u8) {
    let proposal = proposals[proposal_id];
    require!(block.number >= proposal.start_block);
    require!(block.number <= proposal.end_block);
    
    cast_vote(proposal_id, support);
}

/// 3. Proposal execution
pub fn execute(proposal_id: u256) {
    let proposal = proposals[proposal_id];
    
    // Verify proposal passed
    require!(proposal.status == ProposalStatus::Succeeded);
    require!(block.timestamp >= proposal.eta);
    
    // Execute transactions
    for (i, target) in proposal.targets.iter().enumerate() {
        target.call{value: proposal.values[i]}(
            proposal.calldatas[i]
        )?;
    }
    
    proposal.status = ProposalStatus::Executed;
    emit ProposalExecuted(proposal_id);
}
```

## Timelock Security

```rust
/// Timelock for critical operations
pub struct TimeLock {
    delay: Duration, // 48 hours for governance changes
    
    /// Queue transaction
    fn queue_transaction(
        target: Address,
        value: u256,
        data: Bytes,
    ) -> bytes32 {
        let eta = block.timestamp + delay;
        let tx_hash = keccak256(target, value, data, eta);
        
        queued_transactions[tx_hash] = true;
        
        emit TransactionQueued(tx_hash, target, eta);
        tx_hash
    }
    
    /// Execute after timelock
    fn execute_transaction(
        target: Address,
        value: u256,
        data: Bytes,
        eta: u256,
    ) {
        require!(block.timestamp >= eta);
        
        let tx_hash = keccak256(target, value, data, eta);
        require!(queued_transactions[tx_hash]);
        
        target.call{value}(data)?;
        
        delete queued_transactions[tx_hash];
    }
}
```

## Emergency Mechanisms

```rust
/// Emergency pause (multi-sig controlled)
pub struct EmergencyMultiSig {
    required_confirmations: 3, // 3 of 5
    owners: [Address; 5],
    
    /// Pause system in emergency
    fn emergency_pause() {
        require!(confirmations >= required_confirmations);
        
        // Pause all critical contracts
        mtaa_token.pause();
        maono_vault.pause();
        governance.pause();
        
        emit EmergencyPause(block.timestamp);
    }
}
```

---

_Next: [Tokenomics](./tokenomics.md)_
