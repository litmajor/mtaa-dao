// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title GovernanceSnapshot
 * @notice Voting power snapshots to prevent flash loan attacks on governance
 * @dev Addresses voting power manipulation from Phase 2 security audit
 */
contract GovernanceSnapshot is AccessControl {
    
    bytes32 public constant GOVERNANCE_ROLE = keccak256("GOVERNANCE_ROLE");
    
    struct ProposalSnapshot {
        uint256 proposalId;
        string daoId;
        uint256 snapshotBlock;
        uint256 snapshotTimestamp;
        address tokenAddress;
        uint256 totalVotingPower;
        uint256 quorumRequired;
        bool isActive;
    }
    
    struct MemberSnapshot {
        address member;
        uint256 votingPower;
        bool hasVoted;
        bytes32 voteChoice; // keccak256("for"), keccak256("against"), keccak256("abstain")
        uint256 votedAt;
    }
    
    mapping(uint256 => ProposalSnapshot) public proposals;
    mapping(uint256 => mapping(address => MemberSnapshot)) public memberVotes;
    mapping(string => uint256[]) public daoProposals;
    mapping(uint256 => uint256) public voteTotals; // totalVotesFor[proposalId]
    mapping(uint256 => uint256) public voteAgainstTotals; // totalVotesAgainst[proposalId]
    mapping(uint256 => uint256) public voteAbstainTotals; // totalVotesAbstain[proposalId]
    
    event SnapshotCreated(
        uint256 indexed proposalId,
        string indexed daoId,
        uint256 snapshotBlock,
        uint256 totalVotingPower,
        uint256 quorumRequired
    );
    
    event VoteRecorded(
        uint256 indexed proposalId,
        address indexed voter,
        uint256 votingPower,
        bytes32 choice,
        uint256 votedAt
    );
    
    event SnapshotClosed(
        uint256 indexed proposalId,
        uint256 totalVotesFor,
        uint256 totalVotesAgainst,
        uint256 totalVotesAbstain,
        bool quorumMet
    );
    
    // ==== CONSTRUCTOR ====
    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }
    
    // ==== SNAPSHOT CREATION ====
    /**
     * @notice Create a voting snapshot for a proposal
     * @param proposalId Unique proposal identifier
     * @param daoId DAO identifier
     * @param tokenAddress Governance token address
     * @param totalVotingPower Total voting power at snapshot block
     * @param quorumRequired Quorum percentage required (e.g., 20 for 20%)
     */
    function createSnapshot(
        uint256 proposalId,
        string memory daoId,
        address tokenAddress,
        uint256 totalVotingPower,
        uint256 quorumRequired
    ) external onlyRole(GOVERNANCE_ROLE) {
        require(bytes(daoId).length > 0, "DAO ID required");
        require(tokenAddress != address(0), "Token address required");
        require(totalVotingPower > 0, "Total voting power required");
        require(quorumRequired > 0 && quorumRequired <= 100, "Invalid quorum percentage");
        require(proposals[proposalId].snapshotBlock == 0, "Snapshot already exists");
        
        ProposalSnapshot storage snapshot = proposals[proposalId];
        snapshot.proposalId = proposalId;
        snapshot.daoId = daoId;
        snapshot.snapshotBlock = block.number;
        snapshot.snapshotTimestamp = block.timestamp;
        snapshot.tokenAddress = tokenAddress;
        snapshot.totalVotingPower = totalVotingPower;
        snapshot.quorumRequired = quorumRequired;
        snapshot.isActive = true;
        
        daoProposals[daoId].push(proposalId);
        
        emit SnapshotCreated(
            proposalId,
            daoId,
            block.number,
            totalVotingPower,
            quorumRequired
        );
    }
    
    // ==== VOTING ====
    /**
     * @notice Record a vote for a proposal
     * @param proposalId Proposal to vote on
     * @param voter Address of voter
     * @param votingPower Voting power at snapshot block
     * @param choice Vote choice (for/against/abstain)
     */
    function recordVote(
        uint256 proposalId,
        address voter,
        uint256 votingPower,
        bytes32 choice
    ) external onlyRole(GOVERNANCE_ROLE) {
        ProposalSnapshot storage snapshot = proposals[proposalId];
        require(snapshot.snapshotBlock > 0, "Snapshot does not exist");
        require(snapshot.isActive, "Snapshot is closed");
        
        MemberSnapshot storage vote = memberVotes[proposalId][voter];
        require(!vote.hasVoted, "Already voted");
        require(votingPower > 0, "Invalid voting power");
        
        // Validate vote choice
        bytes32 forChoice = keccak256("for");
        bytes32 againstChoice = keccak256("against");
        bytes32 abstainChoice = keccak256("abstain");
        require(
            choice == forChoice || choice == againstChoice || choice == abstainChoice,
            "Invalid vote choice"
        );
        
        vote.member = voter;
        vote.votingPower = votingPower;
        vote.hasVoted = true;
        vote.voteChoice = choice;
        vote.votedAt = block.timestamp;
        
        // Update totals
        if (choice == forChoice) {
            voteTotals[proposalId] += votingPower;
        } else if (choice == againstChoice) {
            voteAgainstTotals[proposalId] += votingPower;
        } else {
            voteAbstainTotals[proposalId] += votingPower;
        }
        
        emit VoteRecorded(proposalId, voter, votingPower, choice, block.timestamp);
    }
    
    // ==== SNAPSHOT CLOSURE ====
    /**
     * @notice Close voting on a proposal and finalize results
     * @param proposalId Proposal to close
     */
    function closeSnapshot(uint256 proposalId) 
        external 
        onlyRole(GOVERNANCE_ROLE) 
        returns (bool quorumMet) 
    {
        ProposalSnapshot storage snapshot = proposals[proposalId];
        require(snapshot.snapshotBlock > 0, "Snapshot does not exist");
        require(snapshot.isActive, "Snapshot already closed");
        
        snapshot.isActive = false;
        
        // Check quorum
        uint256 totalVotes = voteTotals[proposalId] + 
                             voteAgainstTotals[proposalId] + 
                             voteAbstainTotals[proposalId];
        
        uint256 quorumPercentage = (totalVotes * 100) / snapshot.totalVotingPower;
        quorumMet = quorumPercentage >= snapshot.quorumRequired;
        
        emit SnapshotClosed(
            proposalId,
            voteTotals[proposalId],
            voteAgainstTotals[proposalId],
            voteAbstainTotals[proposalId],
            quorumMet
        );
        
        return quorumMet;
    }
    
    // ==== GETTERS ====
    /**
     * @notice Get proposal snapshot
     * @param proposalId Proposal ID
     * @return ProposalSnapshot structure
     */
    function getSnapshot(uint256 proposalId) 
        external 
        view 
        returns (ProposalSnapshot memory) 
    {
        return proposals[proposalId];
    }
    
    /**
     * @notice Get vote for a member
     * @param proposalId Proposal ID
     * @param voter Voter address
     * @return MemberSnapshot structure
     */
    function getVote(uint256 proposalId, address voter) 
        external 
        view 
        returns (MemberSnapshot memory) 
    {
        return memberVotes[proposalId][voter];
    }
    
    /**
     * @notice Get total voting power for proposal
     * @param proposalId Proposal ID
     * @return Total voting power at snapshot
     */
    function getProposalVotingPower(uint256 proposalId) 
        external 
        view 
        returns (uint256) 
    {
        return proposals[proposalId].totalVotingPower;
    }
    
    /**
     * @notice Get vote results for proposal
     * @param proposalId Proposal ID
     * @return votesFor Total votes for
     * @return votesAgainst Total votes against
     * @return votesAbstain Total votes abstaining
     */
    function getVoteResults(uint256 proposalId) 
        external 
        view 
        returns (uint256 votesFor, uint256 votesAgainst, uint256 votesAbstain) 
    {
        votesFor = voteTotals[proposalId];
        votesAgainst = voteAgainstTotals[proposalId];
        votesAbstain = voteAbstainTotals[proposalId];
    }
    
    /**
     * @notice Check if proposal has met quorum
     * @param proposalId Proposal ID
     * @return True if quorum met
     */
    function hasQuorum(uint256 proposalId) external view returns (bool) {
        ProposalSnapshot storage snapshot = proposals[proposalId];
        if (snapshot.snapshotBlock == 0) return false;
        
        uint256 totalVotes = voteTotals[proposalId] + 
                             voteAgainstTotals[proposalId] + 
                             voteAbstainTotals[proposalId];
        
        uint256 quorumPercentage = (totalVotes * 100) / snapshot.totalVotingPower;
        return quorumPercentage >= snapshot.quorumRequired;
    }
    
    /**
     * @notice Check if proposal passed (more votes for than against)
     * @param proposalId Proposal ID
     * @return True if proposal passed
     */
    function hasProposalPassed(uint256 proposalId) external view returns (bool) {
        return voteTotals[proposalId] > voteAgainstTotals[proposalId];
    }
    
    /**
     * @notice Get voting block number for proposal
     * @param proposalId Proposal ID
     * @return Block number of snapshot
     */
    function getSnapshotBlock(uint256 proposalId) 
        external 
        view 
        returns (uint256) 
    {
        return proposals[proposalId].snapshotBlock;
    }
    
    /**
     * @notice Get all proposals for DAO
     * @param daoId DAO identifier
     * @return Array of proposal IDs
     */
    function getDaoProposals(string memory daoId) 
        external 
        view 
        returns (uint256[] memory) 
    {
        return daoProposals[daoId];
    }
    
    /**
     * @notice Get proposal count for DAO
     * @param daoId DAO identifier
     * @return Count of proposals
     */
    function getDaoProposalCount(string memory daoId) 
        external 
        view 
        returns (uint256) 
    {
        return daoProposals[daoId].length;
    }
    
    // ==== GOVERNANCE ROLE MANAGEMENT ====
    function grantGovernanceRole(address account) 
        external 
        onlyRole(DEFAULT_ADMIN_ROLE) 
    {
        _grantRole(GOVERNANCE_ROLE, account);
    }
    
    function revokeGovernanceRole(address account) 
        external 
        onlyRole(DEFAULT_ADMIN_ROLE) 
    {
        _revokeRole(GOVERNANCE_ROLE, account);
    }
}
