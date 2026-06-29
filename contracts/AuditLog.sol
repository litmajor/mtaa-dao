// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "./utils/Counters.sol";
import "./AgentIds.sol";

/**
 * @title AuditLog
 * @notice Immutable on-chain audit trail for all DAO governance, treasury, and agent actions
 * @dev Addresses auditability gap from Phase 2 security audit
 */
contract AuditLog is AccessControl {
    using Counters for Counters.Counter;
    
    bytes32 public constant LOGGER_ROLE = keccak256("LOGGER_ROLE");
    
    enum ActionType {
        // DAO & Governance
        TransactionProposed,
        TransactionApproved,
        TransactionExecuted,
        TransactionRejected,
        RecipientAdded,
        RecipientRemoved,
        SettingsChanged,
        VotingSnapshotCreated,
        ProposalCreated,
        VoteRecorded,
        MemberPromoted,
        MemberDemoted,
        MemberRemoved,
        GovernanceParameterChanged,
        
        // Agent Events
        AgentRegistered,
        AgentDeactivated,
        AgentReactivated,
        AgentConfigUpdated,
        AgentCapabilityAdded,
        AgentCapabilityRemoved,
        AgentFeeUpdated,
        AgentPayoutPercentageUpdated,
        
        // Subscription Events
        SubscriptionCreated,
        SubscriptionRenewed,
        SubscriptionCancelled,
        SubscriptionExpired,
        SubscriptionTierUpgraded,
        SubscriptionTierDowngraded,
        
        // Payment Events
        PaymentProcessed,
        PaymentSettled,
        PaymentRefunded,
        
        // Revenue Events
        RevenueDistributed,
        EarningsWithdrawn,
        TreasuryWithdrawal,
        CommunityPoolWithdrawal
    }
    
    struct AuditEntry {
        uint256 id;
        string daoId;
        address actor;
        ActionType actionType;
        string description;
        bytes data;
        uint256 timestamp;
        uint256 blockNumber;
        string ipfsHash;
    }
    
    mapping(uint256 => AuditEntry) public entries;
    mapping(string => uint256[]) public daoEntries;
    mapping(address => uint256[]) public actorEntries;
    mapping(string => mapping(ActionType => uint256)) public actionTypeCounts;
    
    Counters.Counter private entryCounter;
    
    event AuditEntryCreated(
        uint256 indexed entryId,
        string indexed daoId,
        address indexed actor,
        ActionType actionType,
        uint256 timestamp,
        uint256 blockNumber
    );
    
    event AuditLogPurposed(
        string indexed daoId,
        uint256 entriesCount,
        uint256 indexed fromBlock,
        uint256 indexed toBlock
    );
    
    // ==== CONSTRUCTOR ====
    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }
    
    // ==== LOGGING ====
    /**
     * @notice Record an action in the immutable audit log
     * @param daoId DAO identifier
     * @param actor Address of actor performing action
     * @param actionType Type of action (from enum)
     * @param description Human-readable description
     * @param data Additional encoded data for complex actions
     * @param ipfsHash Optional IPFS hash for detailed logs
     * @return entryId ID of created audit entry
     */
    function log(
        string memory daoId,
        address actor,
        ActionType actionType,
        string memory description,
        bytes memory data,
        string memory ipfsHash
    ) external onlyRole(LOGGER_ROLE) returns (uint256) {
        require(bytes(daoId).length > 0, "DAO ID required");
        require(actor != address(0), "Actor required");
        require(bytes(description).length > 0, "Description required");
        
        uint256 entryId = entryCounter.current();
        entryCounter.increment();
        
        AuditEntry storage entry = entries[entryId];
        entry.id = entryId;
        entry.daoId = daoId;
        entry.actor = actor;
        entry.actionType = actionType;
        entry.description = description;
        entry.data = data;
        entry.timestamp = block.timestamp;
        entry.blockNumber = block.number;
        entry.ipfsHash = ipfsHash;
        
        // Index by DAO
        daoEntries[daoId].push(entryId);
        
        // Index by actor
        actorEntries[actor].push(entryId);
        
        // Count action types
        actionTypeCounts[daoId][actionType]++;
        
        emit AuditEntryCreated(
            entryId,
            daoId,
            actor,
            actionType,
            block.timestamp,
            block.number
        );
        
        return entryId;
    }
    
    // ==== QUERIES ====
    /**
     * @notice Get a single audit entry
     * @param entryId ID of audit entry
     * @return AuditEntry structure
     */
    function getEntry(uint256 entryId) 
        external 
        view 
        returns (AuditEntry memory) 
    {
        return entries[entryId];
    }
    
    /**
     * @notice Get all audit entries for a DAO
     * @param daoId DAO identifier
     * @return Array of audit entry IDs
     */
    function getDaoEntries(string memory daoId) 
        external 
        view 
        returns (uint256[] memory) 
    {
        return daoEntries[daoId];
    }
    
    /**
     * @notice Get count of audit entries for a DAO
     * @param daoId DAO identifier
     * @return Number of entries
     */
    function getDaoEntryCount(string memory daoId) 
        external 
        view 
        returns (uint256) 
    {
        return daoEntries[daoId].length;
    }
    
    /**
     * @notice Get all audit entries for an actor
     * @param actor Address of actor
     * @return Array of audit entry IDs
     */
    function getActorEntries(address actor) 
        external 
        view 
        returns (uint256[] memory) 
    {
        return actorEntries[actor];
    }
    
    /**
     * @notice Get count of audit entries for an actor
     * @param actor Address of actor
     * @return Number of entries
     */
    function getActorEntryCount(address actor) 
        external 
        view 
        returns (uint256) 
    {
        return actorEntries[actor].length;
    }
    
    /**
     * @notice Get total number of audit entries
     * @return Total count
     */
    function getTotalEntries() external view returns (uint256) {
        return entryCounter.current();
    }
    
    /**
     * @notice Get count of specific action type in a DAO
     * @param daoId DAO identifier
     * @param actionType Type of action
     * @return Count
     */
    function getActionTypeCount(string memory daoId, ActionType actionType) 
        external 
        view 
        returns (uint256) 
    {
        return actionTypeCounts[daoId][actionType];
    }
    
    /**
     * @notice Get paginated DAO entries
     * @param daoId DAO identifier
     * @param offset Starting index
     * @param limit Number of entries to return
     * @return Array of limited audit entry IDs
     */
    function getDaoEntriesPaginated(
        string memory daoId,
        uint256 offset,
        uint256 limit
    ) external view returns (uint256[] memory) {
        uint256[] memory allEntries = daoEntries[daoId];
        require(offset < allEntries.length, "Offset out of range");
        
        uint256 endIdx = offset + limit;
        if (endIdx > allEntries.length) {
            endIdx = allEntries.length;
        }
        
        uint256[] memory result = new uint256[](endIdx - offset);
        for (uint256 i = 0; i < result.length; i++) {
            result[i] = allEntries[offset + i];
        }
        
        return result;
    }
    
    /**
     * @notice Verify integrity of audit entry (hash-based)
     * @param entryId Entry ID to verify
     * @return Hash of entry data for verification
     */
    function getEntryHash(uint256 entryId) 
        external 
        view 
        returns (bytes32) 
    {
        AuditEntry storage entry = entries[entryId];
        return keccak256(abi.encodePacked(
            entry.id,
            entry.daoId,
            entry.actor,
            entry.actionType,
            entry.description,
            entry.data,
            entry.timestamp,
            entry.blockNumber
        ));
    }
    
    // ==== GRANT LOGGER ROLE ====
    function grantLoggerRole(address account) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _grantRole(LOGGER_ROLE, account);
    }
    
    function revokeLoggerRole(address account) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _revokeRole(LOGGER_ROLE, account);
    }
}
