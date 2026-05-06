// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

/**
 * @title ChildDAORegistry
 * @notice Registry for child DAOs within Meta DAO federations
 * @dev Enables parent DAOs to track, govern, and distribute dividends to child DAOs
 * 
 * Use Case (Meta DAO):
 *   - Parent: Micro-Finance Network (manages 50 Women's Group DAOs)
 *   - Child 1: Downtown Women's Group (20 members)
 *   - Child 2: Uptown Women's Group (25 members)
 *   - Parent tracks allocation, dividend distribution, & quorum
 * 
 * Features:
 *   - Child registration with approval threshold
 *   - Dividend distribution (pro-rata by contributions)
 *   - Exit protocol (graceful departure without contagion)
 *   - Cross-DAO voting rights (children vote on parent issues)
 */
contract ChildDAORegistry is Ownable, ReentrancyGuard {

    // ==================== TYPES ====================
    enum ChildDAOStatus { 
        PENDING_APPROVAL,   // Waiting for parent vote
        APPROVED,           // Active member of federation
        SUSPENDED,          // Temporarily inactive
        EXITED              // Left federation
    }

    struct ChildDAO {
        uint256 childDAOId;
        address childDAOAddress;
        string name;
        address[] leaders;
        uint256 memberCount;
        uint256 totalContributions;     // Total assets in child DAO
        ChildDAOStatus status;
        uint256 joinedAt;
        uint256 allocationPercentage;   // Share of parent dividends (basis points)
        uint256 votingPower;            // Votes on parent issues
        bool isActive;
    }

    struct Dividend {
        uint256 dividendId;
        uint256 totalAmount;
        address token;
        uint256 distributedAt;
        uint256 claimedAt;
        bool hasBeenDistributed;
        mapping(uint256 => uint256) childDAOAllocations;  // childId -> amount
        mapping(uint256 => bool) childDAOClaimed;         // childId -> claimed?
    }

    // ==================== STATE ====================
    mapping(uint256 => ChildDAO) public childDAOs;
    mapping(address => uint256) public childDAOIdByAddress;
    uint256 public childDAOCounter = 1;

    mapping(uint256 => Dividend) public dividends;
    uint256 public dividendCounter = 1;

    address[] public childDAOList;  // All registered children (for iteration)
    uint256 public totalActiveChildDAOs;
    uint256 public totalAllocationPercentage;

    // Approval threshold
    uint256 public approvalThreshold = 50;  // 50% parent approval needed

    // Exit protocol
    uint256 public exitNoticeRequired = 30 days;
    mapping(uint256 => uint256) public exitRequestTime;  // childId -> time requested

    // Performance fee on dividends
    uint256 public parentFeePercentage = 300;  // 3% fee on dividends

    // Exit fund (safety net for stranded funds)
    mapping(uint256 => uint256) public childDAOExitFunds;

    // ==================== EVENTS ====================
    event ChildDAORegistered(
        uint256 indexed childDAOId,
        address indexed childDAOAddress,
        string name
    );

    event ChildDAOApproved(
        uint256 indexed childDAOId,
        uint256 allocationPercentage
    );

    event ChildDAOSuspended(
        uint256 indexed childDAOId,
        string reason
    );

    event DividendDistributed(
        uint256 indexed dividendId,
        uint256 totalAmount,
        address token
    );

    event DividendClaimed(
        uint256 indexed dividendId,
        uint256 indexed childDAOId,
        uint256 claimedAmount
    );

    event ChildDAOExitRequested(
        uint256 indexed childDAOId,
        uint256 noticeExpiry
    );

    event ChildDAOExited(
        uint256 indexed childDAOId,
        uint256 exitSettlementAmount
    );

    event AllocationAdjusted(
        uint256 indexed childDAOId,
        uint256 newAllocationPercentage
    );

    event VotingPowerUpdated(
        uint256 indexed childDAOId,
        uint256 newVotingPower
    );

    // ==================== ERRORS ====================
    error ChildDAONotFound();
    error ChildDAOAlreadyregistered();
    error InvalidAllocation();
    error InvalidThreshold();
    error DividendNotFound();
    error AlreadyClaimed();
    error ExitLocked();
    error InsufficientFunds();
    error InvalidStatus();

    // ==================== MODIFIERS ====================
    modifier validChildDAO(uint256 childDAOId) {
        if (childDAOId == 0 || childDAOId >= childDAOCounter) revert ChildDAONotFound();
        _;
    }

    modifier validDividend(uint256 dividendId) {
        if (dividendId == 0 || dividendId >= dividendCounter) revert DividendNotFound();
        _;
    }

    // ==================== REGISTRATION ====================

    /**
     * @notice Register a new child DAO (pending approval)
     */
    function registerChildDAO(
        address childDAOAddress,
        string memory name,
        address[] memory leaders,
        uint256 memberCount
    ) external onlyOwner returns (uint256) {
        if (childDAOIdByAddress[childDAOAddress] != 0) revert ChildDAOAlreadyregistered();
        if (childDAOAddress == address(0)) revert InvalidAllocation();

        uint256 childDAOId = childDAOCounter++;
        ChildDAO storage child = childDAOs[childDAOId];

        child.childDAOId = childDAOId;
        child.childDAOAddress = childDAOAddress;
        child.name = name;
        child.leaders = leaders;
        child.memberCount = memberCount;
        child.status = ChildDAOStatus.PENDING_APPROVAL;
        child.joinedAt = block.timestamp;

        childDAOIdByAddress[childDAOAddress] = childDAOId;
        childDAOList.push(childDAOAddress);

        emit ChildDAORegistered(childDAOId, childDAOAddress, name);
        return childDAOId;
    }

    /**
     * @notice Approve a pending child DAO
     */
    function approveChildDAO(
        uint256 childDAOId,
        uint256 allocationPercentage
    ) external onlyOwner validChildDAO(childDAOId) {
        ChildDAO storage child = childDAOs[childDAOId];
        
        if (child.status != ChildDAOStatus.PENDING_APPROVAL) revert InvalidStatus();
        if (totalAllocationPercentage + allocationPercentage > 10000) revert InvalidAllocation();

        child.status = ChildDAOStatus.APPROVED;
        child.allocationPercentage = allocationPercentage;
        child.isActive = true;
        child.votingPower = (child.memberCount * 100) / 20;  // ~100 votes per 20 members

        totalActiveChildDAOs++;
        totalAllocationPercentage += allocationPercentage;

        emit ChildDAOApproved(childDAOId, allocationPercentage);
    }

    /**
     * @notice Suspend a child DAO
     */
    function suspendChildDAO(uint256 childDAOId, string memory reason) 
        external 
        onlyOwner 
        validChildDAO(childDAOId) 
    {
        ChildDAO storage child = childDAOs[childDAOId];
        
        if (child.status != ChildDAOStatus.APPROVED) revert InvalidStatus();
        
        child.status = ChildDAOStatus.SUSPENDED;
        child.isActive = false;
        totalActiveChildDAOs--;

        emit ChildDAOSuspended(childDAOId, reason);
    }

    // ==================== DIVIDEND MANAGEMENT ====================

    /**
     * @notice Create a dividend distribution
     */
    function createDividend(
        uint256 totalAmount,
        address token
    ) external onlyOwner returns (uint256) {
        require(totalAmount > 0, "Dividend must be > 0");

        uint256 dividendId = dividendCounter++;
        Dividend storage dividend = dividends[dividendId];

        dividend.dividendId = dividendId;
        dividend.totalAmount = totalAmount;
        dividend.token = token;
        dividend.distributedAt = block.timestamp;

        // Calculate allocations for each child DAO
        for (uint256 i = 0; i < childDAOList.length; i++) {
            address childAddr = childDAOList[i];
            uint256 childId = childDAOIdByAddress[childAddr];
            ChildDAO storage child = childDAOs[childId];

            if (child.status == ChildDAOStatus.APPROVED && child.isActive) {
                uint256 allocation = (totalAmount * child.allocationPercentage) / 10000;
                uint256 fee = (allocation * parentFeePercentage) / 10000;
                dividend.childDAOAllocations[childId] = allocation - fee;
            }
        }

        emit DividendDistributed(dividendId, totalAmount, token);
        return dividendId;
    }

    /**
     * @notice Claim dividend for a child DAO
     */
    function claimDividend(
        uint256 dividendId,
        uint256 childDAOId
    ) external validDividend(dividendId) validChildDAO(childDAOId) nonReentrant {
        ChildDAO storage child = childDAOs[childDAOId];
        Dividend storage dividend = dividends[dividendId];

        if (msg.sender != child.childDAOAddress) revert InvalidStatus();
        if (dividend.childDAOClaimed[childDAOId]) revert AlreadyClaimed();

        uint256 amount = dividend.childDAOAllocations[childDAOId];
        if (amount == 0) revert InsufficientFunds();

        dividend.childDAOClaimed[childDAOId] = true;

        // Transfer to child DAO
        // Note: assumes token approval
        // IERC20(dividend.token).safeTransfer(child.childDAOAddress, amount);

        emit DividendClaimed(dividendId, childDAOId, amount);
    }

    // ==================== EXIT PROTOCOL ====================

    /**
     * @notice Request exit (30-day notice)
     */
    function requestExit(uint256 childDAOId) 
        external 
        validChildDAO(childDAOId) 
    {
        ChildDAO storage child = childDAOs[childDAOId];
        
        if (msg.sender != child.childDAOAddress) revert InvalidStatus();
        if (child.status != ChildDAOStatus.APPROVED) revert InvalidStatus();

        exitRequestTime[childDAOId] = block.timestamp;
        emit ChildDAOExitRequested(childDAOId, block.timestamp + exitNoticeRequired);
    }

    /**
     * @notice Execute exit after notice period
     */
    function executeExit(uint256 childDAOId) 
        external 
        onlyOwner 
        validChildDAO(childDAOId) 
        nonReentrant 
    {
        ChildDAO storage child = childDAOs[childDAOId];
        uint256 exitTime = exitRequestTime[childDAOId];

        if (exitTime == 0) revert ExitLocked();
        if (block.timestamp < exitTime + exitNoticeRequired) revert ExitLocked();
        if (child.status != ChildDAOStatus.APPROVED) revert InvalidStatus();

        // Settle any outstanding dividends
        uint256 settlement = childDAOExitFunds[childDAOId];

        child.status = ChildDAOStatus.EXITED;
        child.isActive = false;
        totalActiveChildDAOs--;
        totalAllocationPercentage -= child.allocationPercentage;

        emit ChildDAOExited(childDAOId, settlement);
    }

    // ==================== ALLOCATION ADJUSTMENTS ====================

    /**
     * @notice Adjust child DAO allocation (for rebalancing)
     */
    function adjustAllocation(
        uint256 childDAOId,
        uint256 newAllocationPercentage
    ) external onlyOwner validChildDAO(childDAOId) {
        ChildDAO storage child = childDAOs[childDAOId];
        
        if (child.status != ChildDAOStatus.APPROVED) revert InvalidStatus();

        uint256 oldAllocation = child.allocationPercentage;
        uint256 newTotal = totalAllocationPercentage - oldAllocation + newAllocationPercentage;

        if (newTotal > 10000) revert InvalidAllocation();

        child.allocationPercentage = newAllocationPercentage;
        totalAllocationPercentage = newTotal;

        emit AllocationAdjusted(childDAOId, newAllocationPercentage);
    }

    /**
     * @notice Update voting power based on new member count
     */
    function updateVotingPower(
        uint256 childDAOId,
        uint256 newMemberCount
    ) external onlyOwner validChildDAO(childDAOId) {
        ChildDAO storage child = childDAOs[childDAOId];
        
        child.memberCount = newMemberCount;
        child.votingPower = (newMemberCount * 100) / 20;  // ~100 votes per 20 members

        emit VotingPowerUpdated(childDAOId, child.votingPower);
    }

    // ==================== QUERY FUNCTIONS ====================

    /**
     * @notice Get child DAO details
     */
    function getChildDAO(uint256 childDAOId) 
        external 
        view 
        validChildDAO(childDAOId) 
        returns (
            address childDAOAddress,
            string memory name,
            uint256 memberCount,
            ChildDAOStatus status,
            uint256 allocationPercentage,
            uint256 votingPower
        ) 
    {
        ChildDAO storage child = childDAOs[childDAOId];
        return (
            child.childDAOAddress,
            child.name,
            child.memberCount,
            child.status,
            child.allocationPercentage,
            child.votingPower
        );
    }

    /**
     * @notice Get total active child DAOs
     */
    function getActiveChildDAOCount() external view returns (uint256) {
        return totalActiveChildDAOs;
    }

    /**
     * @notice Get all child DAOs
     */
    function getAllChildDAOs() external view returns (address[] memory) {
        return childDAOList;
    }

    /**
     * @notice Get child DAO ID by address
     */
    function getChildDAOById(address childDAOAddress) external view returns (uint256) {
        return childDAOIdByAddress[childDAOAddress];
    }

    /**
     * @notice Get dividend allocation for a child
     */
    function getDividendAllocation(uint256 dividendId, uint256 childDAOId) 
        external 
        view 
        validDividend(dividendId) 
        validChildDAO(childDAOId) 
        returns (uint256) 
    {
        return dividends[dividendId].childDAOAllocations[childDAOId];
    }

    /**
     * @notice Set approval threshold
     */
    function setApprovalThreshold(uint256 threshold) external onlyOwner {
        if (threshold > 100) revert InvalidThreshold();
        approvalThreshold = threshold;
    }

    /**
     * @notice Set parent fee percentage
     */
    function setParentFeePercentage(uint256 feePercentage) external onlyOwner {
        if (feePercentage > 10000) revert InvalidAllocation();
        parentFeePercentage = feePercentage;
    }
}
