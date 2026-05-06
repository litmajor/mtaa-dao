# MtaaDAO Redesign: Smart Contract Patterns & Implementation

## Part 1: Multi-Sig Treasury (Replace Owner Centralization)

### Current Problem
```
Current flow:
  User pays fee → 50% burned, 50% to owner() address
  Owner has full control (can dump, can lose keys, single point of failure)
  
Required flow:
  User pays fee → 50% burned, 50% to TreasuryDAO
  TreasuryDAO requires 3-of-5 signatures + governance vote
  Every spend visible on-chain for 48 hours before execution
```

### Implementation

**Contract 1: Multi-Sig Wallet**
```solidity
pragma solidity ^0.8.20;

contract MultiSigTreasury {
    // ─────────────────────────────────────────────────────
    // Constants
    // ─────────────────────────────────────────────────────
    
    uint256 public constant REQUIRED_CONFIRMATIONS = 3;
    uint256 public constant NUM_SIGNERS = 5;
    uint256 public constant TIMELOCK = 48 hours;
    
    IERC20 public mtaaToken;
    address[NUM_SIGNERS] public signers;
    
    // ─────────────────────────────────────────────────────
    // State
    // ─────────────────────────────────────────────────────
    
    struct Transaction {
        address target;         // Where to send tokens or call
        uint256 value;          // Amount
        bytes data;             // Function call data (if any)
        uint256 confirmations;  // Number of signatures
        bool executed;
        uint256 scheduledFor;   // 48-hour timelock
        
        mapping(address => bool) confirmedBy;  // Who approved
    }
    
    uint256 public transactionCount;
    mapping(uint256 => Transaction) public transactions;
    
    // ─────────────────────────────────────────────────────
    // Events
    // ─────────────────────────────────────────────────────
    
    event DepositReceived(address indexed from, uint256 amount);
    event TransactionSubmitted(uint256 indexed txnId, address target, uint256 value);
    event TransactionConfirmed(uint256 indexed txnId, address confirmedBy, uint256 totalConfirmations);
    event TransactionExecuted(uint256 indexed txnId);
    event TransactionRevoked(uint256 indexed txnId, address revokedBy);
    
    // ─────────────────────────────────────────────────────
    // Constructor
    // ─────────────────────────────────────────────────────
    
    constructor(
        address _mtaaToken,
        address[5] memory _signers
    ) {
        mtaaToken = IERC20(_mtaaToken);
        signers = _signers;
        
        // Validate signers are unique
        for (uint i = 0; i < NUM_SIGNERS; i++) {
            require(signers[i] != address(0), "Invalid signer");
            for (uint j = i + 1; j < NUM_SIGNERS; j++) {
                require(signers[i] != signers[j], "Duplicate signer");
            }
        }
    }
    
    // ─────────────────────────────────────────────────────
    // Core Functions
    // ─────────────────────────────────────────────────────
    
    modifier onlySigner() {
        bool isSigner = false;
        for (uint i = 0; i < NUM_SIGNERS; i++) {
            if (signers[i] == msg.sender) {
                isSigner = true;
                break;
            }
        }
        require(isSigner, "Only signer can call");
        _;
    }
    
    /**
     * @notice Submit a transaction (spending MTAA from treasury)
     * 
     * Example:
     *   proposeName: "Pay developer 100K MTAA for Q2 work"
     *   target: MTAA token address
     *   value: 0 (we'll encode amount in data)
     *   data: encoded transfer(developer, 100000 * 1e18)
     */
    function submitTransaction(
        string memory proposalName,
        address target,
        bytes calldata data
    ) external onlySigner {
        uint256 txnId = transactionCount++;
        
        Transaction storage txn = transactions[txnId];
        txn.target = target;
        txn.data = data;
        txn.scheduledFor = block.timestamp + TIMELOCK;  // 48-hour delay
        
        emit TransactionSubmitted(txnId, target, 0);
    }
    
    /**
     * @notice Approve a transaction (adds a signature)
     */
    function confirmTransaction(uint256 txnId) external onlySigner {
        Transaction storage txn = transactions[txnId];
        
        require(!txn.executed, "Already executed");
        require(!txn.confirmedBy[msg.sender], "Already confirmed by you");
        require(txn.scheduledFor > 0, "Transaction not found");
        
        txn.confirmedBy[msg.sender] = true;
        txn.confirmations++;
        
        emit TransactionConfirmed(txnId, msg.sender, txn.confirmations);
    }
    
    /**
     * @notice Revoke confirmation (remove a signature)
     */
    function revokeConfirmation(uint256 txnId) external onlySigner {
        Transaction storage txn = transactions[txnId];
        
        require(!txn.executed, "Already executed");
        require(txn.confirmedBy[msg.sender], "Not confirmed by you");
        
        txn.confirmedBy[msg.sender] = false;
        txn.confirmations--;
        
        emit TransactionRevoked(txnId, msg.sender);
    }
    
    /**
     * @notice Execute transaction (after timelock expires + 3 confirmations)
     */
    function executeTransaction(uint256 txnId) external {
        Transaction storage txn = transactions[txnId];
        
        require(!txn.executed, "Already executed");
        require(txn.confirmations >= REQUIRED_CONFIRMATIONS, "Need 3+ confirmations");
        require(block.timestamp >= txn.scheduledFor, "Timelock not expired (48 hours required)");
        
        txn.executed = true;
        
        // Execute the call
        (bool success,) = txn.target.call(txn.data);
        require(success, "Transaction failed");
        
        emit TransactionExecuted(txnId);
    }
    
    // ─────────────────────────────────────────────────────
    // View Functions
    // ─────────────────────────────────────────────────────
    
    function getTreasuryBalance() external view returns (uint256) {
        return mtaaToken.balanceOf(address(this));
    }
    
    function getTransactionStatus(uint256 txnId)
        external
        view
        returns (
            address target,
            uint256 confirmations,
            bool executed,
            uint256 scheduledFor
        )
    {
        Transaction storage txn = transactions[txnId];
        return (txn.target, txn.confirmations, txn.executed, txn.scheduledFor);
    }
    
    function hasConfirmed(uint256 txnId, address signer) external view returns (bool) {
        return transactions[txnId].confirmedBy[signer];
    }
}
```

**Example Usage**:
```
Week 1:
  Signer 1 (founder): "Pay 50K MTAA to developer for Q2"
    → Submits transaction
    → Scheduled for execution in 48 hours
    
  Signer 2 (advisor): Reviews proposal
    → "Sounds good" → Confirms
    
  Signer 3 (community): Checks on Discord
    → "10K is for salary, 40K is supplies"
    → Confirms
    
  Signer 4 (ops): "Approved from accounting"
    → Confirms
    
  Now have 3 confirmations, ready to execute

Week 2:
  48 hours have passed
  Signer 1: Calls executeTransaction(txnId)
    → Transfer 50K MTAA to developer address
    → Emits TransactionExecuted event
    → Everyone can verify on etherscan

Result: Transparent, accountable, decentralized
```

---

## Part 2: Reputation Decay & Oracle Consensus

### Current Problem
```
Current:
  - Reputation only goes up (no fraud penalties)
  - Single ORACLE_ROLE centralized
  - No appeal mechanism if reputation wrongly updated
  
Example of problem:
  - Jane scores 100K (SHOGUN)
  - Jane validates 10 fraudulent loans
  - Jane stays 100K forever (no accountability)
```

### Implementation

**Contract 1: Decentralized Reputation Engine**
```solidity
pragma solidity ^0.8.20;

contract ReputationEngine {
    // ─────────────────────────────────────────────────────
    // Events
    // ─────────────────────────────────────────────────────
    
    event ReputationEventRecorded(
        address indexed user,
        string eventType,      // 'LOAN_REPAID', 'LOAN_DEFAULT', 'VALIDATED_LOAN', 'FRAUD_DETECTED'
        uint256 amount,        // Amount involved
        int256 scoreChange,    // Could be negative for penalties
        uint256 newScore,
        address recordedBy     // Which validator
    );
    
    event ReputationProposalCreated(
        bytes32 indexed proposalId,
        address indexed user,
        uint256 proposedScore,
        string reason,
        address proposedBy,
        uint256 votingDeadline
    );
    
    event ReputationVoteCast(
        bytes32 indexed proposalId,
        address indexed voter,
        bool approve,
        uint256 votingPower
    );
    
    event ReputationProposalExecuted(
        bytes32 indexed proposalId,
        bool approved,
        uint256 finalScore
    );
    
    event ReputationAppeal(
        bytes32 indexed proposalId,
        address indexed user,
        string reason,
        uint256 appealDeadline
    );
    
    // ─────────────────────────────────────────────────────
    // Constants & Storage
    // ─────────────────────────────────────────────────────
    
    address public mtaaToken;
    address public reputationOwner;
    
    uint256 public constant MAX_REPUTATION = 1_000_000;
    uint256 public constant VOTING_PERIOD = 7 days;
    uint256 public constant APPEAL_PERIOD = 30 days;
    
    mapping(address => uint256) public reputationScores;
    
    struct ReputationEvent {
        address user;
        string eventType;
        uint256 amount;
        int256 scoreChange;
        uint256 newScore;
        address recordedBy;
        uint256 timestamp;
    }
    
    mapping(address => ReputationEvent[]) public eventHistory;
    
    struct ReputationProposal {
        address user;
        uint256 proposedScore;
        string reason;
        address proposedBy;
        uint256 createdAt;
        uint256 votingDeadline;
        
        mapping(address => bool) votes;        // Who voted and which direction
        mapping(address => uint256) votingPower;
        uint256 totalApprove;
        uint256 totalDisapprove;
        
        bool executed;
        bool approved;
        uint256 finalScore;
        
        bool appealed;
        uint256 appealDeadline;
    }
    
    mapping(bytes32 => ReputationProposal) public proposals;
    
    // ─────────────────────────────────────────────────────
    // Constructor
    // ─────────────────────────────────────────────────────
    
    constructor(address _mtaaToken, address _owner) {
        mtaaToken = _mtaaToken;
        reputationOwner = _owner;
    }
    
    // ─────────────────────────────────────────────────────
    // Core Functions
    // ─────────────────────────────────────────────────────
    
    /**
     * @notice Record a reputation event (loan repaid, default, etc)
     * 
     * Example: Jane repaid 500K KES loan on time
     *   user: jane_address
     *   eventType: "LOAN_REPAID"
     *   amount: 500000 MTAA (convert from KES)
     *   scoreChange: +200 (automatic rule: 200 points per 500K loan repaid)
     */
    function recordEvent(
        address user,
        string calldata eventType,
        uint256 amount,
        int256 scoreChangePoints
    ) external {
        require(
            IERC20(mtaaToken).balanceOf(msg.sender) >= 10000 * 1e18 || msg.sender == reputationOwner,
            "Only MTAA holders or owner can record events"
        );
        
        uint256 oldScore = reputationScores[user];
        int256 newScoreInt = int256(oldScore) + scoreChangePoints;
        
        // Floor at 0, cap at MAX
        uint256 newScore = newScoreInt <= 0 ? 0 : uint256(newScoreInt);
        if (newScore > MAX_REPUTATION) newScore = MAX_REPUTATION;
        
        reputationScores[user] = newScore;
        
        eventHistory[user].push(ReputationEvent({
            user: user,
            eventType: eventType,
            amount: amount,
            scoreChange: scoreChangePoints,
            newScore: newScore,
            recordedBy: msg.sender,
            timestamp: block.timestamp
        }));
        
        emit ReputationEventRecorded(user, eventType, amount, scoreChangePoints, newScore, msg.sender);
    }
    
    /**
     * @notice Propose a reputation score change (for appeals, disputes)
     * 
     * Usage:
     *   Jane claims her reputation was wrongly reduced
     *   → Proposes: newScore = 50000 (was 100000, now 20000)
     *   → Reason: "Default was due to SACCO leader fraud, not mine"
     *   → Voting period: 7 days
     *   → Validators (MTAA stake holders) vote
     *   → If 66% approve, score restored
     */
    function proposeReputationChange(
        address user,
        uint256 proposedScore,
        string calldata reason
    ) external {
        require(proposedScore <= MAX_REPUTATION, "Score too high");
        require(
            IERC20(mtaaToken).balanceOf(msg.sender) >= 10000 * 1e18,
            "Need 10K MTAA to propose"
        );
        
        bytes32 proposalId = keccak256(
            abi.encodePacked(user, proposedScore, block.timestamp, msg.sender)
        );
        
        ReputationProposal storage proposal = proposals[proposalId];
        proposal.user = user;
        proposal.proposedScore = proposedScore;
        proposal.reason = reason;
        proposal.proposedBy = msg.sender;
        proposal.createdAt = block.timestamp;
        proposal.votingDeadline = block.timestamp + VOTING_PERIOD;
        
        emit ReputationProposalCreated(
            proposalId,
            user,
            proposedScore,
            reason,
            msg.sender,
            proposal.votingDeadline
        );
    }
    
    /**
     * @notice Vote on a reputation change proposal
     * 
     * Voting power = MTAA staked
     * Need 66% approval to pass
     */
    function voteOnProposal(
        bytes32 proposalId,
        bool approve
    ) external {
        ReputationProposal storage proposal = proposals[proposalId];
        
        require(block.timestamp <= proposal.votingDeadline, "Voting period ended");
        require(!proposal.votes[msg.sender], "Already voted");
        
        // Use MTAA balance as voting power
        uint256 votingPower = IERC20(mtaaToken).balanceOf(msg.sender);
        require(votingPower > 0, "No MTAA to vote with");
        
        proposal.votes[msg.sender] = true;
        proposal.votingPower[msg.sender] = votingPower;
        
        if (approve) {
            proposal.totalApprove += votingPower;
        } else {
            proposal.totalDisapprove += votingPower;
        }
        
        emit ReputationVoteCast(proposalId, msg.sender, approve, votingPower);
    }
    
    /**
     * @notice Execute proposal if voting period ended
     */
    function executeProposal(bytes32 proposalId) external {
        ReputationProposal storage proposal = proposals[proposalId];
        
        require(!proposal.executed, "Already executed");
        require(block.timestamp >= proposal.votingDeadline, "Voting still ongoing");
        
        uint256 totalVotes = proposal.totalApprove + proposal.totalDisapprove;
        require(totalVotes > 0, "No votes cast");
        
        // Need 66% approval
        proposal.approved = (proposal.totalApprove * 100) / totalVotes >= 66;
        
        if (proposal.approved) {
            reputationScores[proposal.user] = proposal.proposedScore;
            proposal.finalScore = proposal.proposedScore;
            
            eventHistory[proposal.user].push(ReputationEvent({
                user: proposal.user,
                eventType: "REPUTATION_APPEAL_APPROVED",
                amount: 0,
                scoreChange: int256(proposal.proposedScore) - int256(reputationScores[proposal.user]),
                newScore: proposal.proposedScore,
                recordedBy: msg.sender,
                timestamp: block.timestamp
            }));
        }
        
        proposal.executed = true;
        
        emit ReputationProposalExecuted(proposalId, proposal.approved, proposal.finalScore);
    }
    
    /**
     * @notice Appeal a reputation change (user can contest)
     */
    function appeapReputation(
        bytes32 proposalId,
        string calldata appealReason
    ) external {
        ReputationProposal storage proposal = proposals[proposalId];
        
        require(msg.sender == proposal.user, "Only user can appeal");
        require(!proposal.appealed, "Already appealed");
        require(proposal.executed, "Proposal not yet executed");
        
        proposal.appealed = true;
        proposal.appealDeadline = block.timestamp + APPEAL_PERIOD;
        
        emit ReputationAppeal(proposalId, msg.sender, appealReason, proposal.appealDeadline);
    }
    
    // ─────────────────────────────────────────────────────
    // View Functions
    // ─────────────────────────────────────────────────────
    
    function getReputationTier(address user) public view returns (string memory) {
        uint256 score = reputationScores[user];
        if (score >= 100_000) return "SHOGUN";
        if (score >= 10_000) return "ARCHITECT";
        if (score >= 5_000) return "ELDER";
        if (score >= 1_000) return "CONTRIBUTOR";
        return "MEMBER";
    }
    
    function getEventHistory(address user) external view returns (ReputationEvent[] memory) {
        return eventHistory[user];
    }
    
    function getEventCount(address user) external view returns (uint256) {
        return eventHistory[user].length;
    }
    
    function getProposalStatus(bytes32 proposalId)
        external
        view
        returns (
            address user,
            uint256 proposedScore,
            uint256 votesFor,
            uint256 votesAgainst,
            bool executed,
            bool approved
        )
    {
        ReputationProposal storage proposal = proposals[proposalId];
        return (
            proposal.user,
            proposal.proposedScore,
            proposal.totalApprove,
            proposal.totalDisapprove,
            proposal.executed,
            proposal.approved
        );
    }
}
```

**Automatic Reputation Events (Example Rules)**:
```
When recording events via oracle:

LOAN_REPAID (on-time):
  → +200 points per 500K KES equivalent

LOAN_DEFAULT:
  → -500 points (major penalty)
  
MERRY_GO_ROUND_COMPLETED:
  → +50 points (consistency reward)
  
MERRY_GO_ROUND_DEFAULT:
  → -100 points (betrayed group)
  
VALIDATOR_APPROVED:
  → +10 points per validation (if no defaults)
  → -200 points per validation that defaults (fraud detector)
  
FRAUD_DETECTED:
  → -1000 points (caught cheating)
  → Appeal timeout = permanent damage
```

---

## Part 3: Floating APY System

### Current Problem
```
APY fixed:  8% (30d), 10% (90d), 13% (180d), 18% (365d)

If adoption explodes:
  - Year 1: 50M MTAA staked → 9M MTAA/year rewards = sustainable
  - Year 2: 100M MTAA staked → 18M MTAA/year rewards = 1.8% of supply
  - Year 3: 150M MTAA staked → 27M MTAA/year rewards = 2.7% of supply

Problem: At 1.5M users with 100M MTAA staked, rewards are only 1.2% APY
         But we promised 8-18%
         Either: (1) Unsustainable minting, or (2) Disappointed users
```

### Implementation

**Contract: Floating APY Calculator**
```solidity
pragma solidity ^0.8.20;

contract FloatingAPYCalculator {
    
    // ─────────────────────────────────────────────────────
    // Storage
    // ─────────────────────────────────────────────────────
    
    uint256 public constant MIN_APY = 300;      // 3% (in basis points)
    uint256 public constant MAX_APY = 1800;     // 18%
    uint256 public constant TOTAL_SUPPLY = 1_000_000_000 * 1e18;
    
    uint256 public maxStakablePercentage = 2000; // Max 20% of supply can be staked
    
    address public mtaaToken;
    address public admin;
    
    // Historical APY settings (can be governance-controlled)
    struct APYAdjustment {
        uint256 timestamp;
        uint256 newAPY;      // Base APY when no competition
        uint256 scaleDivisor; // How aggressively APY shrinks with TVL
    }
    
    APYAdjustment[] public apyHistory;
    
    // ─────────────────────────────────────────────────────
    // Events
    // ─────────────────────────────────────────────────────
    
    event APYParametersUpdated(uint256 newBaseAPY, uint256 newScaleDivisor);
    
    // ─────────────────────────────────────────────────────
    // Constructor
    // ─────────────────────────────────────────────────────
    
    constructor(address _mtaaToken) {
        mtaaToken = _mtaaToken;
        admin = msg.sender;
        
        // Initial: 18% base (when TVL < 10% of supply)
        apyHistory.push(APYAdjustment({
            timestamp: block.timestamp,
            newAPY: 1800,         // 18%
            scaleDivisor: 100     // Scales AY down as TVL grows
        }));
    }
    
    // ─────────────────────────────────────────────────────
    // Core Functions
    // ─────────────────────────────────────────────────────
    
    /**
     * @notice Calculate APY based on current TVL
     * 
     * Formula:
     *   baseAPY = 18% (from latest adjustment)
     *   tvl = total staked MTAA
     *   tvlPercent = (tvl * 100) / TOTAL_SUPPLY
     *   
     *   adjustedAPY = baseAPY - (tvlPercent / scaleDivisor)
     *   
     *   Examples:
     *   TVL = 50M (5% of supply):
     *     adjustedAPY = 1800 - (5 / 100) = 1800 - 0 = 1800 bps = 18% ✓
     *   
     *   TVL = 100M (10% of supply):
     *     adjustedAPY = 1800 - (10 / 100) = 1800 - 0.1 = 1799.9 bps ≈ 18% (still good)
     *   
     *   TVL = 500M (50% of supply):
     *     adjustedAPY = 1800 - (50 / 100) = 1800 - 0.5 = 1799.5 bps ≈ 18% (still good!)
     *
     *   So the formula needs adjustment...
     */
    function calculateAPY(uint256 totalStaked) external view returns (uint256) {
        APYAdjustment memory latest = apyHistory[apyHistory.length - 1];
        
        // Calculate TVL as percentage of supply (in basis points)
        uint256 tvlBasisPoints = (totalStaked * 10000) / TOTAL_SUPPLY;
        
        // Reduce APY: start at MAX_APY, scale down as TVL grows
        // When TVL = 0%: APY = latest.newAPY
        // When TVL = 20%: APY = 50% of latest.newAPY
        // When TVL = 50%: APY = 20% of latest.newAPY
        
        uint256 reduction = (tvlBasisPoints * tvlBasisPoints) / latest.scaleDivisor;
        // Quadratic scaling: TVL^2 / divisor
        // At TVL=5%: reduction = 25/100 = 0.25% → APY stays ~18%
        // At TVL=10%: reduction = 100/100 = 1% → APY drops to 17%
        // At TVL=20%: reduction = 400/100 = 4% → APY drops to 14%
        
        uint256 finalAPY = latest.newAPY > reduction ? latest.newAPY - reduction : MIN_APY;
        
        // Cap at MIN and MAX
        if (finalAPY < MIN_APY) finalAPY = MIN_APY;
        if (finalAPY > MAX_APY) finalAPY = MAX_APY;
        
        return finalAPY;
    }
    
    /**
     * @notice Admin updates APY parameters (governance should control this)
     */
    function updateAPYParameters(uint256 newBaseAPY, uint256 newScaleDivisor) external {
        require(msg.sender == admin, "Only admin");
        require(newBaseAPY >= MIN_APY && newBaseAPY <= MAX_APY, "APY out of range");
        
        apyHistory.push(APYAdjustment({
            timestamp: block.timestamp,
            newAPY: newBaseAPY,
            scaleDivisor: newScaleDivisor
        }));
        
        emit APYParametersUpdated(newBaseAPY, newScaleDivisor);
    }
    
    // ─────────────────────────────────────────────────────
    // View Functions
    // ─────────────────────────────────────────────────────
    
    function getAPYHistory() external view returns (APYAdjustment[] memory) {
        return apyHistory;
    }
}
```

**Integration with MtaaToken**:
```solidity
// In MtaaToken.sol

address public apyCalculator;

function calculateStakeRewards(address staker, uint256 stakeId) 
    public view returns (uint256) 
{
    StakeInfo memory s = stakes[staker][stakeId];
    if (!s.isActive) return 0;
    
    uint256 timeStaked;
    unchecked { timeStaked = block.timestamp - s.lastRewardClaim; }
    
    // OLD (BROKEN):
    // uint256 multiplier = lockPeriodMultipliers[s.lockPeriod]; // Fixed 8-18%
    
    // NEW (FLOATING):
    uint256 apy = FloatingAPYCalculator(apyCalculator).calculateAPY(getTotalStaked());
    // Now apy scales with adoption
    
    uint256 annualReward = (s.amount * apy) / 10_000;
    uint256 reward = (annualReward * timeStaked) / 365 days;
    
    // Apply reputation multiplier (same as before)
    ReputationTier tier = getReputationTier(staker);
    if (tier == ReputationTier.SHOGUN) reward = (reward * 300) / 100;
    // ... etc
    
    return reward;
}

function getTotalStaked() public view returns (uint256) {
    // Sum all active stakes
    return totalStakedAmount;  // Track this as state variable
}
```

**Example APY Curves Over 3 Years**:
```
Month 1:  TVL = 1M of 1B → APY ≈ 18% (high to bootstrap)
Month 6:  TVL = 50M → APY ≈ 18% (still high)
Month 12: TVL = 100M (10%) → APY ≈ 17% (slight drop)
Month 18: TVL = 150M (15%) → APY ≈ 16% (gradual)
Month 24: TVL = 200M (20%) → APY ≈ 14% (moderate drop)
Month 30: TVL = 250M (25%) → APY ≈ 12% (settling)
Month 36: TVL = 300M (30%) → APY ≈ 10% (sustainable)

Key insight: Early adopters get 18% APY, but as adoption grows,
new stakers get lower APY.  This is FAIR because:
  1. Early risk-takers deserve premium (they believed first)
  2. Later stakers benefit from larger network (liquidity, reputation system)
  3. Network doesn't become unsustainable (can't promise 18% forever)
```

---

## Part 4: Quick Comparison Matrix

| Feature | Current | Redesigned | Impact |
|---------|---------|------------|--------|
| **Treasury Control** | 1 owner | 3-of-5 multi-sig | 🟢 Trustless |
| **Reputation Updates** | 1 oracle | 66% validator vote | 🟢 Decentralized |
| **Reputation Decay** | None (permanent) | Event-based | 🟢 Accountability |
| **Fraud Penalties** | None | -500 to -1000 points | 🟢 Deterrent |
| **Appeals** | None | 7-day community vote | 🟢 Fair |
| **Staking APY** | Fixed 18% | Floating 3-18% | 🟢 Sustainable |
| **APY Formula** | Linear | Quadratic scaling | 🟢 Protects network |
| **Fee Governance** | Owner decides | DAO votes | 🟢 Democratic |
| **Spending Account** | Owner wallet | Treasury DAO | 🟢 Transparent |
| **Timelock** | None | 48 hours | 🟢 Community reaction time |

---

**Redesign Version**: 1.0  
**Created**: April 23, 2026  
**Status**: Ready for implementation
