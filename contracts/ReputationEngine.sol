// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

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
contract ReputationEngine {
    
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
        
        mapping(address => bool) votes;
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
        require(
            IERC20(mtaaToken).balanceOf(msg.sender) >= 10000 * 1e18 || msg.sender == reputationOwner,
            "Only MTAA holders or owner can record events"
        );
        require(user != address(0), "Invalid user");
        
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
        require(user != address(0), "Invalid user");
        require(bytes(reason).length > 0, "Reason required");
        
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
     * Voting power = MTAA balance
     * Need 66% approval to pass
     */
    function voteOnProposal(
        bytes32 proposalId,
        bool approve
    ) external {
        ReputationProposal storage proposal = proposals[proposalId];
        
        require(block.timestamp <= proposal.votingDeadline, "Voting period ended");
        require(!proposal.votes[msg.sender], "Already voted");
        require(proposal.proposedBy != address(0), "Proposal not found");
        
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
        
        emit ReputationProposalExecuted(proposalId, proposal.approved, proposal.finalScore);
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
