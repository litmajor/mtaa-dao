// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

// Minimal interface for token with vote snapshots (ERC20Votes)
interface ITokenVotes {
    function getPastVotes(address account, uint256 blockNumber) external view returns (uint256);
}

/**
 * @title ReputationEngine
 * @notice Decentralized reputation system with decay, appeals, and validator consensus
 * @dev Addresses CRITICAL issues: single oracle, no reputation decay, no appeals
 * 
 * Key Features:
 *  - Automatic penalties for defaults (-500 points)
 *  - Reputation appeals via DAO voting (66% approval to overturn)
 *  - 7-day voting period for appeals
 *  - Validator consensus (no single point of failure)
 *  - Event log for complete audit trail
 * 
 * Example Flow (Reputation Recovery):
 *  Day 1: Jane defaults on 500K loan (auto penalty: -500 points)
 *  Day 2: Jane proposes appeal ("Default was due to SACCO fraud, not mine")
 *  Days 3-9: Token holders vote (66% approval needed)
 *  Day 10: Vote passes, reputation restored, Jane's score = restored
 */
contract ReputationEngine is ReentrancyGuard {
    using SafeERC20 for IERC20;
    
    // ─────────────────────────────────────────────────────
    // Events
    // ─────────────────────────────────────────────────────
    
    event ReputationEventRecorded(
        address indexed user,
        string eventType,
        uint256 amount,
        int256 scoreChange,
        uint256 newScore,
        address recordedBy,
        uint256 timestamp
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

    // Authorized callers that can record events (server oracle, validators, trusted contracts)
    mapping(address => bool) public authorizedRecorders;

    // Last activity timestamp for decay calculations
    mapping(address => uint256) public lastActivityTimestamp;
    
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
        uint256 snapshotBlock; // block number used for voting power snapshot
        
        mapping(address => bool) votes;
        mapping(address => uint256) votingPower;
        address[] voters;
        uint256 totalApprove;
        uint256 totalDisapprove;
        uint256 remainingVotes;
        uint256 distributed;
        uint256 executedAt;
        
        bool executed;
        bool approved;
        uint256 finalScore;
        
        bool appealed;
        uint256 appealDeadline;
    }
    
    mapping(bytes32 => ReputationProposal) public proposals;
    // Good-faith deposit required to create an appeal proposal (in MTAA tokens)
    uint256 public proposalBondAmount = 1000 * 1e18;
    mapping(bytes32 => uint256) public proposalBond;
    // Claim window for pull-claims (seconds). After this window owner may sweep unclaimed funds.
    uint256 public claimWindow = 30 days;
    
    // ─────────────────────────────────────────────────────
    // Constructor
    // ─────────────────────────────────────────────────────
    
    constructor(address _mtaaToken, address _owner) {
        mtaaToken = _mtaaToken;
        reputationOwner = _owner;
    }

    /**
     * @notice Set the proposal bond amount (MTAA tokens).
     */
    function setProposalBondAmount(uint256 amount) external {
        require(msg.sender == reputationOwner, "Only owner");
        proposalBondAmount = amount;
    }

    modifier onlyAuthorized() {
        require(authorizedRecorders[msg.sender] || msg.sender == reputationOwner, "Not authorized");
        _;
    }
    
    // ─────────────────────────────────────────────────────
    // Core Functions
    // ─────────────────────────────────────────────────────
    
    /**
     * @notice Record a reputation event (loan repaid, default, fraud, etc)
     * 
     * Example: Jane repaid 500K KES loan on time
     *   user: jane_address
     *   eventType: "LOAN_REPAID"
     *   amount: 500000 * 1e18 (in MTAA equivalent)
     *   scoreChangePoints: +200 (automatic rule: 200 points per 500K loan repaid)
     * 
     * Example: Jane defaulted on loan
     *   user: jane_address
     *   eventType: "LOAN_DEFAULT"
     *   amount: 100000 * 1e18
     *   scoreChangePoints: -500 (major penalty for default)
     */
    function recordEvent(
        address user,
        string calldata eventType,
        uint256 amount,
        int256 scoreChangePoints
    ) external {
        require(msg.sender == reputationOwner || authorizedRecorders[msg.sender], "Not authorized to record events");
        require(user != address(0), "Invalid user");
        
        uint256 oldScore = reputationScores[user];
        int256 newScoreInt = int256(oldScore) + scoreChangePoints;
        
        // Floor at 0, cap at MAX
        uint256 newScore = newScoreInt <= 0 ? 0 : uint256(newScoreInt);
        if (newScore > MAX_REPUTATION) newScore = MAX_REPUTATION;
        
        reputationScores[user] = newScore;
        lastActivityTimestamp[user] = block.timestamp;
        
        eventHistory[user].push(ReputationEvent({
            user: user,
            eventType: eventType,
            amount: amount,
            scoreChange: scoreChangePoints,
            newScore: newScore,
            recordedBy: msg.sender,
            timestamp: block.timestamp
        }));
        
        emit ReputationEventRecorded(
            user,
            eventType,
            amount,
            scoreChangePoints,
            newScore,
            msg.sender,
            block.timestamp
        );
    }

    /**
     * @notice Set an authorized recorder address (server oracle, validator, trusted contract)
     */
    function setAuthorizedRecorder(address recorder, bool status) external {
        require(msg.sender == reputationOwner, "Only owner");
        authorizedRecorders[recorder] = status;
    }

    /**
     * @notice Compute decayed reputation based on inactivity.
     * 2% decay per month inactive, max 50%.
     */
    function getDecayedScore(address user) public view returns (uint256) {
        uint256 score = reputationScores[user];
        uint256 lastActivity = lastActivityTimestamp[user];
        if (lastActivity == 0) return score;
        uint256 monthsInactive = (block.timestamp - lastActivity) / 30 days;
        uint256 decayPercent = monthsInactive * 2;
        if (decayPercent > 50) decayPercent = 50;
        return (score * (100 - decayPercent)) / 100;
    }

    /**
     * @notice Settle and persist decayed reputation for a user.
     * Useful when scores are used in on-chain flows and should be settled once.
     */
    function settleDecay(address user) external onlyAuthorized returns (uint256) {
        uint256 decayed = getDecayedScore(user);
        reputationScores[user] = decayed;
        lastActivityTimestamp[user] = block.timestamp;
        return decayed;
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
        // Allow only those with stake or reputationOwner to propose. Use current balance threshold.
        require(
            IERC20(mtaaToken).balanceOf(msg.sender) >= 10000 * 1e18 || msg.sender == reputationOwner,
            "Need 10K MTAA to propose"
        );
        require(user != address(0), "Invalid user");
        require(bytes(reason).length > 0, "Reason required");

        // Require proposer to deposit a good-faith bond in MTAA tokens
        bytes32 proposalId = keccak256(
            abi.encodePacked(user, proposedScore, block.timestamp, msg.sender)
        );

        if (proposalBondAmount > 0) {
            IERC20(mtaaToken).safeTransferFrom(msg.sender, address(this), proposalBondAmount);
            proposalBond[proposalId] = proposalBondAmount;
        }
        
        ReputationProposal storage proposal = proposals[proposalId];
        proposal.user = user;
        proposal.proposedScore = proposedScore;
        proposal.reason = reason;
        proposal.proposedBy = msg.sender;
        proposal.createdAt = block.timestamp;
        proposal.votingDeadline = block.timestamp + VOTING_PERIOD;
        // Record snapshot block for voting power (use previous block)
        proposal.snapshotBlock = block.number > 0 ? block.number - 1 : block.number;
        
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
     * Voting power = MTAA balance
     * Need 66% approval to pass
     */
    function voteOnProposal(
        bytes32 proposalId,
        bool approve
    ) external nonReentrant {
        ReputationProposal storage proposal = proposals[proposalId];
        
        require(block.timestamp <= proposal.votingDeadline, "Voting period ended");
        require(!proposal.votes[msg.sender], "Already voted");
        require(proposal.proposedBy != address(0), "Proposal not found");
        
        // Use snapshot voting power at proposal.snapshotBlock if token supports ERC20Votes
        uint256 votingPower = 0;
        if (proposal.snapshotBlock > 0) {
            try ITokenVotes(mtaaToken).getPastVotes(msg.sender, proposal.snapshotBlock) returns (uint256 vp) {
                votingPower = vp;
            } catch {
                votingPower = IERC20(mtaaToken).balanceOf(msg.sender);
            }
        } else {
            votingPower = IERC20(mtaaToken).balanceOf(msg.sender);
        }
        require(votingPower > 0, "No MTAA to vote with");

        proposal.votes[msg.sender] = true;
        proposal.votingPower[msg.sender] = votingPower;
        proposal.voters.push(msg.sender);
        
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
    function executeProposal(bytes32 proposalId) external nonReentrant {
        ReputationProposal storage proposal = proposals[proposalId];

        require(!proposal.executed, "Already executed");
        require(block.timestamp >= proposal.votingDeadline, "Voting still ongoing");
        require(proposal.proposedBy != address(0), "Proposal not found");

        uint256 totalVotes = proposal.totalApprove + proposal.totalDisapprove;
        require(totalVotes > 0, "No votes cast");

        // Need 66% approval
        proposal.approved = (proposal.totalApprove * 100) / totalVotes >= 66;

        if (proposal.approved) {
            uint256 oldScore = reputationScores[proposal.user];
            reputationScores[proposal.user] = proposal.proposedScore;
            proposal.finalScore = proposal.proposedScore;

            eventHistory[proposal.user].push(ReputationEvent({
                user: proposal.user,
                eventType: "REPUTATION_APPEAL_APPROVED",
                amount: 0,
                scoreChange: int256(proposal.proposedScore) - int256(oldScore),
                newScore: proposal.proposedScore,
                recordedBy: msg.sender,
                timestamp: block.timestamp
            }));
        } else {
            proposal.finalScore = reputationScores[proposal.user];
        }

        proposal.executed = true;
        proposal.executedAt = block.timestamp;

        // Handle bond: refund if approved. If rejected, enable pull-claim by voters.
        uint256 bond = proposalBond[proposalId];
        if (bond > 0) {
            if (proposal.approved) {
                IERC20(mtaaToken).safeTransfer(proposal.proposedBy, bond);
                proposalBond[proposalId] = 0;
            } else {
                // Initialize pull-claim state: voters can claim proportionally later.
                proposal.remainingVotes = totalVotes;
                proposal.distributed = 0;
                // Note: bond remains stored in proposalBond until fully claimed.
            }
        }

        emit ReputationProposalExecuted(proposalId, proposal.approved, proposal.finalScore);
    }

    /**
     * @notice Set the claim window after which owner may sweep unclaimed rewards.
     */
    function setClaimWindow(uint256 secondsWindow) external {
        require(msg.sender == reputationOwner, "Only owner");
        claimWindow = secondsWindow;
    }

    event UnclaimedSwept(bytes32 indexed proposalId, uint256 amount);

    /**
     * @notice Owner may sweep unclaimed bond shares after the claim window has passed.
     */
    function sweepUnclaimed(bytes32 proposalId) external nonReentrant {
        require(msg.sender == reputationOwner, "Only owner");
        ReputationProposal storage proposal = proposals[proposalId];
        require(proposal.executed, "Proposal not executed");
        require(!proposal.approved, "Nothing to sweep for approved proposals");
        require(proposal.executedAt + claimWindow <= block.timestamp, "Claim window still open");

        uint256 bond = proposalBond[proposalId];
        require(bond > 0, "No bond to sweep");

        uint256 remaining = bond - proposal.distributed;
        if (remaining > 0) {
            IERC20(mtaaToken).safeTransfer(reputationOwner, remaining);
            proposal.distributed += remaining;
        }

        // Clear bond and remainingVotes to mark complete
        proposalBond[proposalId] = 0;
        proposal.remainingVotes = 0;

        emit UnclaimedSwept(proposalId, remaining);
    }
    
    /**
     * @notice Appeal a reputation change (user can contest)
     */
    function appealReputation(
        bytes32 proposalId,
        string calldata appealReason
    ) external {
        ReputationProposal storage proposal = proposals[proposalId];
        
        require(msg.sender == proposal.user, "Only user can appeal");
        require(!proposal.appealed, "Already appealed");
        require(proposal.executed, "Proposal not yet executed");
        require(bytes(appealReason).length > 0, "Appeal reason required");
        
        proposal.appealed = true;
        proposal.appealDeadline = block.timestamp + APPEAL_PERIOD;
        
        emit ReputationAppeal(proposalId, msg.sender, appealReason, proposal.appealDeadline);
    }

    /**
     * @notice Claim slashed bond share for a rejected proposal.
     */
    event RewardClaimed(bytes32 indexed proposalId, address indexed claimant, uint256 amount);

    function claimReward(bytes32 proposalId) external nonReentrant {
        ReputationProposal storage proposal = proposals[proposalId];
        require(proposal.executed, "Proposal not executed");
        require(!proposal.approved, "No rewards for approved proposals");

        uint256 vp = proposal.votingPower[msg.sender];
        require(vp > 0, "No claimable share");

        uint256 bond = proposalBond[proposalId];
        require(bond > 0, "No bond available");

        uint256 totalVotes = proposal.totalApprove + proposal.totalDisapprove;
        require(totalVotes > 0, "Invalid total votes");

        uint256 share = (bond * vp) / totalVotes;
        require(share > 0, "Dust or no share");

        // Zero out voting power to prevent double claims
        proposal.votingPower[msg.sender] = 0;
        proposal.distributed += share;
        if (proposal.remainingVotes >= vp) {
            proposal.remainingVotes -= vp;
        } else {
            proposal.remainingVotes = 0;
        }

        IERC20(mtaaToken).safeTransfer(msg.sender, share);
        emit RewardClaimed(proposalId, msg.sender, share);

        // If this was the last claimant, transfer any remainder to reputationOwner
        if (proposal.remainingVotes == 0) {
            uint256 remainder = bond - proposal.distributed;
            if (remainder > 0) {
                IERC20(mtaaToken).safeTransfer(reputationOwner, remainder);
            }
            proposalBond[proposalId] = 0;
        }
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
    
    function hasVoted(bytes32 proposalId, address voter) external view returns (bool) {
        return proposals[proposalId].votes[voter];
    }
    
    function getReputationScore(address user) external view returns (uint256) {
        return reputationScores[user];
    }
}
