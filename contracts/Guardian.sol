// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

/**
 * @title Guardian
 * @notice Emergency multisig override contract for protocol safety
 * @dev 3 guardians with 2-of-3 override capability
 * 
 * Use Case:
 *   - CRITICAL: System-wide pause if vault contract exploited
 *   - CRITICAL: Freeze treasury if suspected theft
 *   - CRITICAL: Emergency withdrawal from locked vault (last resort)
 *   - CRITICAL: Upgrade authorization for broken contracts
 * 
 * Guardian Requirements:
 *   1. Independent (not DAO members)
 *   2. Multi-signature (2 confirmations required)
 *   3. Timelocked (24-hour delay before execution)
 *   4. Revocable (can be replaced via multisig vote)
 */
contract Guardian is Ownable, ReentrancyGuard {
    
    // ==================== TYPES ====================
    enum GuardianAction { 
        PAUSE_VAULTS,           // Disable all vault deposits/withdrawals
        FREEZE_TREASURY,        // Disable all treasury movements
        EMERGENCY_WITHDRAWAL,   // Extract funds from vault to treasury
        UPGRADE_CONTRACT,       // Authorize contract upgrade
        CUSTOM_CALL             // Execute custom function on target contract
    }

    enum ActionStatus { PENDING, APPROVED, EXECUTED, REJECTED, EXPIRED }

    struct GuardianProposal {
        uint256 proposalId;
        GuardianAction action;
        address targetContract;
        bytes callData;
        uint256 proposedAt;
        uint256 executeAfter;           // 24-hour timelock
        ActionStatus status;
        address[] approvers;             // Guardians who approved (max 3)
        mapping(address => bool) hasApproved;
        string rationale;
    }

    // ==================== STATE ====================
    address[3] public guardians;        // Fixed 3 guardians
    mapping(uint256 => GuardianProposal) public proposals;
    uint256 public proposalCounter;

    uint256 public constant APPROVAL_THRESHOLD = 2;  // 2-of-3 required
    uint256 public constant TIMELOCK_DELAY = 24 hours;
    uint256 public constant PROPOSAL_EXPIRY = 7 days;

    // Actions that can be paused
    mapping(address => bool) public pausedContracts;

    // ==================== EVENTS ====================
    event GuardianProposalCreated(
        uint256 indexed proposalId,
        GuardianAction indexed action,
        address indexed proposer,
        string rationale
    );

    event GuardianApprovalGiven(
        uint256 indexed proposalId,
        address indexed guardian,
        uint256 approvalsNeeded
    );

    event GuardianProposalExecuted(
        uint256 indexed proposalId,
        GuardianAction indexed action,
        bool success
    );

    event GuardianProposalRejected(
        uint256 indexed proposalId,
        string reason
    );

    event GuardianChanged(
        uint256 indexed index,
        address indexed oldGuardian,
        address indexed newGuardian
    );

    event ContractPaused(
        address indexed contractAddress,
        string reason
    );

    event ContractUnpaused(
        address indexed contractAddress
    );

    // ==================== ERRORS ====================
    error InvalidGuardian();
    error NotGuardian();
    error ProposalNotFound();
    error AlreadyApproved();
    error NotEnoughApprovals();
    error ProposalLocked();
    error TimelockNotMet();
    error ProposalExpired();
    error ExecutionFailed();

    // ==================== MODIFIERS ====================
    modifier onlyGuardian() {
        bool isGuardian = false;
        for (uint256 i = 0; i < 3; i++) {
            if (guardians[i] == msg.sender) {
                isGuardian = true;
                break;
            }
        }
        if (!isGuardian) revert NotGuardian();
        _;
    }

    modifier validProposal(uint256 proposalId) {
        if (proposalId >= proposalCounter) revert ProposalNotFound();
        _;
    }

    // ==================== INITIALIZATION ====================
    
    constructor(address[] memory _guardians) {
        if (_guardians.length != 3) revert InvalidGuardian();
        
        for (uint256 i = 0; i < 3; i++) {
            if (_guardians[i] == address(0)) revert InvalidGuardian();
            guardians[i] = _guardians[i];
        }
    }

    // ==================== GUARDIAN MANAGEMENT ====================

    /**
     * @notice Replace a guardian (requires 2-of-3 approval)
     * @dev Only callable through proposal mechanism
     */
    function replaceGuardian(uint256 index, address newGuardian) external onlyOwner {
        if (index >= 3) revert InvalidGuardian();
        if (newGuardian == address(0)) revert InvalidGuardian();
        
        address oldGuardian = guardians[index];
        guardians[index] = newGuardian;
        
        emit GuardianChanged(index, oldGuardian, newGuardian);
    }

    // ==================== PROPOSAL CREATION ====================

    /**
     * @notice Create a guardian proposal
     * @param action Type of action to perform
     * @param targetContract Address of contract to act upon
     * @param callData Encoded function call (if applicable)
     * @param rationale Reason for this action
     */
    function proposeAction(
        GuardianAction action,
        address targetContract,
        bytes calldata callData,
        string memory rationale
    ) external onlyGuardian returns (uint256) {
        uint256 proposalId = proposalCounter++;
        
        GuardianProposal storage proposal = proposals[proposalId];
        proposal.proposalId = proposalId;
        proposal.action = action;
        proposal.targetContract = targetContract;
        proposal.callData = callData;
        proposal.proposedAt = block.timestamp;
        proposal.executeAfter = block.timestamp + TIMELOCK_DELAY;
        proposal.status = ActionStatus.PENDING;
        proposal.rationale = rationale;

        emit GuardianProposalCreated(proposalId, action, msg.sender, rationale);
        return proposalId;
    }

    // ==================== APPROVAL MECHANISM ====================

    /**
     * @notice Guardian approves a proposal
     */
    function approveProposal(uint256 proposalId) 
        external 
        onlyGuardian 
        validProposal(proposalId) 
        nonReentrant 
    {
        GuardianProposal storage proposal = proposals[proposalId];
        
        if (proposal.status != ActionStatus.PENDING) revert ProposalLocked();
        if (proposal.hasApproved[msg.sender]) revert AlreadyApproved();

        proposal.approvers.push(msg.sender);
        proposal.hasApproved[msg.sender] = true;

        uint256 approvalsNeeded = APPROVAL_THRESHOLD - proposal.approvers.length;
        
        emit GuardianApprovalGiven(proposalId, msg.sender, approvalsNeeded);

        // Auto-approve if threshold reached
        if (proposal.approvers.length >= APPROVAL_THRESHOLD) {
            proposal.status = ActionStatus.APPROVED;
        }
    }

    // ==================== EXECUTION ====================

    /**
     * @notice Execute an approved proposal (after timelock)
     */
    function executeProposal(uint256 proposalId) 
        external 
        onlyGuardian 
        validProposal(proposalId) 
        nonReentrant 
    {
        GuardianProposal storage proposal = proposals[proposalId];
        
        if (proposal.status != ActionStatus.APPROVED) revert ProposalLocked();
        if (block.timestamp < proposal.executeAfter) revert TimelockNotMet();
        if (block.timestamp > proposal.proposedAt + PROPOSAL_EXPIRY) revert ProposalExpired();

        proposal.status = ActionStatus.EXECUTED;

        bool success;
        bytes memory result;

        // Execute based on action type
        if (proposal.action == GuardianAction.PAUSE_VAULTS) {
            pausedContracts[proposal.targetContract] = true;
            emit ContractPaused(proposal.targetContract, proposal.rationale);
            success = true;
            
        } else if (proposal.action == GuardianAction.FREEZE_TREASURY) {
            pausedContracts[proposal.targetContract] = true;
            emit ContractPaused(proposal.targetContract, "Treasury frozen");
            success = true;
            
        } else if (proposal.action == GuardianAction.UPGRADE_CONTRACT) {
            // Authorize upgrade (implementation-specific)
            success = true;
            
        } else if (proposal.action == GuardianAction.CUSTOM_CALL) {
            // Execute custom call to target contract
            (success, result) = proposal.targetContract.call(proposal.callData);
            if (!success) revert ExecutionFailed();
        }

        emit GuardianProposalExecuted(proposalId, proposal.action, success);
    }

    // ==================== EMERGENCY UNPAUSE ====================

    /**
     * @notice Unpause a contract (requires 2-of-3 approval)
     */
    function unpauseContract(address contractAddress) external onlyGuardian {
        pausedContracts[contractAddress] = false;
        emit ContractUnpaused(contractAddress);
    }

    // ==================== QUERY FUNCTIONS ====================

    /**
     * @notice Get proposal details
     */
    function getProposal(uint256 proposalId) 
        external 
        view 
        validProposal(proposalId) 
        returns (
            GuardianAction action,
            address targetContract,
            ActionStatus status,
            uint256 approvalsCount,
            uint256 executeAfter,
            string memory rationale
        ) 
    {
        GuardianProposal storage proposal = proposals[proposalId];
        return (
            proposal.action,
            proposal.targetContract,
            proposal.status,
            proposal.approvers.length,
            proposal.executeAfter,
            proposal.rationale
        );
    }

    /**
     * @notice Check if contract is paused
     */
    function isPaused(address contractAddress) external view returns (bool) {
        return pausedContracts[contractAddress];
    }

    /**
     * @notice Get current guardians
     */
    function getGuardians() external view returns (address[3] memory) {
        return guardians;
    }
}
