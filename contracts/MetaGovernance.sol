// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title MetaGovernance
 * @dev Cross-DAO federated voting for parent + child DAOs
 * @notice Parent votes directly; child votes aggregated by DAO weight
 */
contract MetaGovernance is Ownable, Pausable {
    
    enum ProposalType { FEE_CHANGE, DIVIDEND_DISTRIBUTION, POLICY_UPDATE, MEMBER_SUSPENSION, EXIT_REQUEST }
    enum ExecutionStatus { PENDING, PASSED, FAILED, EXECUTED, CANCELLED }
    
    struct CrossDAOProposal {
        uint256 proposalId;
        uint256 parentDAOId;
        ProposalType proposalType;
        string description;
        uint256 parentVotesFor;
        uint256 parentVotesAgainst;
        uint256 parentTotalVoters;
        uint256[] affectedChildDAOIds;
        mapping(uint256 => uint256) childVotesFor;      // childDAOId => votes
        mapping(uint256 => uint256) childVotesAgainst;
        mapping(uint256 => uint256) childTotalVoters;
        uint256 childVotesAggregated;                   // Total child votes counted
        ExecutionStatus status;
        uint256 createdAt;
        uint256 votingDeadline;
        uint256 executedAt;
        string executionTx;                            // IPFS hash of execution proof
    }
    
    struct DAOWeight {
        uint256 daoId;
        string name;
        uint256 weight;                                // Voting power (1-100 basis)
        uint256 memberCount;
        bool isActive;
    }
    
    // State
    address public federationAdmin;
    uint256 public nextProposalId = 1;
    
    uint256 public parentDAOId;
    uint256 public totalChildDAOs;
    uint256 public votingPeriod = 7 days;              // Default 1 week
    uint256 public quorumThreshold = 1;                 // Minimum votes required per child DAO aggregation
    
    mapping(uint256 => CrossDAOProposal) public proposals;
    mapping(uint256 => DAOWeight) public daoWeights;
    mapping(uint256 => bool) public isChildDAO;
    mapping(uint256 => mapping(address => bool)) public hasVoted; // proposalId => member => voted
    mapping(uint256 => address[]) public daoMembers;
    
    // Events
    event ProposalCreated(
        uint256 indexed proposalId,
        uint256 parentDAOId,
        ProposalType proposalType,
        uint256[] affectedChildren,
        uint256 votingDeadline
    );
    event ParentVoteCasted(uint256 indexed proposalId, address indexed voter, bool support);
    event ChildVoteCasted(uint256 indexed proposalId, uint256 childDAOId, address indexed voter, bool support);
    event ChildVotesAggregated(uint256 indexed proposalId, uint256 childDAOId, uint256 votesFor, uint256 votesAgainst);
    event ProposalPassed(uint256 indexed proposalId);
    event ProposalFailed(uint256 indexed proposalId);
    event ProposalExecuted(uint256 indexed proposalId, string executionTx);
    event DAORegistered(uint256 indexed daoId, string name, uint256 weight);
    event VotingPeriodUpdated(uint256 newPeriod);
    
    // Modifiers
    modifier onlyAdmin() {
        require(msg.sender == federationAdmin || msg.sender == owner(), "Only admin");
        _;
    }
    
    modifier proposalExists(uint256 proposalId) {
        require(proposals[proposalId].proposalId != 0, "Proposal does not exist");
        _;
    }
    
    // Constructor
    constructor(uint256 _parentDAOId, address _federationAdmin) Ownable(msg.sender) {
        parentDAOId = _parentDAOId;
        federationAdmin = _federationAdmin;
    }
    
    /**
     * @dev Register a child DAO in the federation
     */
    function registerChildDAO(
        uint256 daoId,
        string memory name,
        uint256 weight,
        uint256 memberCount
    ) external onlyAdmin {
        require(weight > 0 && weight <= 100, "Weight must be 1-100");
        require(!isChildDAO[daoId], "DAO already registered");
        
        isChildDAO[daoId] = true;
        daoWeights[daoId] = DAOWeight({
            daoId: daoId,
            name: name,
            weight: weight,
            memberCount: memberCount,
            isActive: true
        });
        totalChildDAOs++;
        
        emit DAORegistered(daoId, name, weight);
    }
    
    /**
     * @dev Propose cross-DAO governance action
     */
    function proposeAction(
        ProposalType proposalType,
        string memory description,
        uint256[] memory affectedChildDAOIds
    ) external onlyAdmin returns (uint256) {
        require(affectedChildDAOIds.length > 0, "Must affect at least one child DAO");
        
        // Validate all affected DAOs are registered
        for (uint256 i = 0; i < affectedChildDAOIds.length; i++) {
            require(isChildDAO[affectedChildDAOIds[i]], "Child DAO not registered");
        }
        
        uint256 proposalId = nextProposalId++;
        uint256 deadline = block.timestamp + votingPeriod;
        
        CrossDAOProposal storage proposal = proposals[proposalId];
        proposal.proposalId = proposalId;
        proposal.parentDAOId = parentDAOId;
        proposal.proposalType = proposalType;
        proposal.description = description;
        proposal.affectedChildDAOIds = affectedChildDAOIds;
        proposal.status = ExecutionStatus.PENDING;
        proposal.createdAt = block.timestamp;
        proposal.votingDeadline = deadline;
        
        emit ProposalCreated(proposalId, parentDAOId, proposalType, affectedChildDAOIds, deadline);
        
        return proposalId;
    }
    
    /**
     * @dev Cast vote from parent DAO
     */
    function voteAsParent(uint256 proposalId, bool support) external proposalExists(proposalId) {
        CrossDAOProposal storage proposal = proposals[proposalId];
        require(block.timestamp <= proposal.votingDeadline, "Voting closed");
        require(proposal.status == ExecutionStatus.PENDING, "Proposal not pending");
        require(!hasVoted[proposalId][msg.sender], "Already voted");
        
        hasVoted[proposalId][msg.sender] = true;
        
        if (support) {
            proposal.parentVotesFor++;
        } else {
            proposal.parentVotesAgainst++;
        }
        proposal.parentTotalVoters++;
        
        emit ParentVoteCasted(proposalId, msg.sender, support);
    }
    
    /**
     * @dev Cast vote from child DAO
     */
    function voteAsChild(uint256 proposalId, uint256 childDAOId, bool support) 
        external 
        proposalExists(proposalId) 
    {
        CrossDAOProposal storage proposal = proposals[proposalId];
        require(block.timestamp <= proposal.votingDeadline, "Voting closed");
        require(proposal.status == ExecutionStatus.PENDING, "Proposal not pending");
        require(isChildDAO[childDAOId], "Not a registered child DAO");
        require(!hasVoted[proposalId][msg.sender], "Already voted");
        
        // Verify member belongs to child DAO
        bool isMember = false;
        for (uint256 i = 0; i < daoMembers[childDAOId].length; i++) {
            if (daoMembers[childDAOId][i] == msg.sender) {
                isMember = true;
                break;
            }
        }
        require(isMember, "Not a member of this DAO");
        
        hasVoted[proposalId][msg.sender] = true;
        
        if (support) {
            proposal.childVotesFor[childDAOId]++;
        } else {
            proposal.childVotesAgainst[childDAOId]++;
        }
        proposal.childTotalVoters[childDAOId]++;
        
        emit ChildVoteCasted(proposalId, childDAOId, msg.sender, support);
    }
    
    /**
     * @dev Aggregate votes from a specific child DAO (weighted)
     */
    function aggregateChildDAOVotes(uint256 proposalId, uint256 childDAOId) 
        external 
        proposalExists(proposalId) 
        returns (uint256 aggregatedVotes)
    {
        CrossDAOProposal storage proposal = proposals[proposalId];
        require(block.timestamp > proposal.votingDeadline, "Voting not closed");
        require(isChildDAO[childDAOId], "Not a registered child DAO");
        
        DAOWeight memory weight = daoWeights[childDAOId];
        require(weight.isActive, "DAO not active");
        
        uint256 votesFor = proposal.childVotesFor[childDAOId];
        uint256 votesAgainst = proposal.childVotesAgainst[childDAOId];
        uint256 totalVotes = votesFor + votesAgainst;
        require(totalVotes >= quorumThreshold, "Quorum not met");
        
        // Weight the votes by DAO weight
        if (votesFor > votesAgainst) {
            aggregatedVotes = (weight.weight);
            proposal.parentVotesFor += aggregatedVotes;
        } else if (votesAgainst > votesFor) {
            aggregatedVotes = (weight.weight);
            proposal.parentVotesAgainst += aggregatedVotes;
        }
        
        proposal.childVotesAggregated++;
        
        emit ChildVotesAggregated(proposalId, childDAOId, votesFor, votesAgainst);
        
        return aggregatedVotes;
    }
    
    /**
     * @dev Execute proposal if it passed
     */
    function executeProposal(uint256 proposalId, string memory executionTx) 
        external 
        onlyAdmin 
        proposalExists(proposalId) 
    {
        CrossDAOProposal storage proposal = proposals[proposalId];
        require(block.timestamp > proposal.votingDeadline, "Voting not closed");
        require(proposal.status == ExecutionStatus.PENDING, "Proposal not pending");
        
        // Determine if proposal passed (simple majority)
        bool passed = proposal.parentVotesFor > proposal.parentVotesAgainst;
        
        if (passed) {
            proposal.status = ExecutionStatus.EXECUTED;
            emit ProposalPassed(proposalId);
        } else {
            proposal.status = ExecutionStatus.FAILED;
            emit ProposalFailed(proposalId);
            return;
        }
        
        proposal.executedAt = block.timestamp;
        proposal.executionTx = executionTx;
        
        emit ProposalExecuted(proposalId, executionTx);
    }
    
    /**
     * @dev Get proposal details
     */
    function getProposal(uint256 proposalId) 
        external 
        view 
        proposalExists(proposalId) 
        returns (
            uint256 id,
            ProposalType pType,
            string memory desc,
            uint256 parentFor,
            uint256 parentAgainst,
            ExecutionStatus status,
            uint256 deadline
        )
    {
        CrossDAOProposal storage proposal = proposals[proposalId];
        return (
            proposal.proposalId,
            proposal.proposalType,
            proposal.description,
            proposal.parentVotesFor,
            proposal.parentVotesAgainst,
            proposal.status,
            proposal.votingDeadline
        );
    }
    
    /**
     * @dev Get affected child DAOs for proposal
     */
    function getAffectedChildDAOs(uint256 proposalId) 
        external 
        view 
        proposalExists(proposalId) 
        returns (uint256[] memory)
    {
        return proposals[proposalId].affectedChildDAOIds;
    }
    
    /**
     * @dev Update voting period
     */
    function setVotingPeriod(uint256 newPeriod) external onlyAdmin {
        require(newPeriod > 0, "Period must be > 0");
        votingPeriod = newPeriod;
        emit VotingPeriodUpdated(newPeriod);
    }
    
    /**
     * @dev Update DAO weight (voting power)
     */
    function updateDAOWeight(uint256 daoId, uint256 newWeight) external onlyAdmin {
        require(isChildDAO[daoId], "DAO not registered");
        require(newWeight > 0 && newWeight <= 100, "Weight must be 1-100");
        daoWeights[daoId].weight = newWeight;
    }
    
    /**
     * @dev Add member to DAO (for voting)
     */
    function addDAOMember(uint256 daoId, address member) external onlyAdmin {
        require(isChildDAO[daoId], "DAO not registered");
        daoMembers[daoId].push(member);
    }
    
    /**
     * @dev Get DAO weight info
     */
    function getDAOWeight(uint256 daoId) external view returns (DAOWeight memory) {
        return daoWeights[daoId];
    }
}
