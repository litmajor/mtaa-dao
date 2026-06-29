// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./SharedTypes.sol";

/**
 * @title AgentRegistry
 * @notice Central registry for all DAO agents with subscription and permission management
 * @dev Implements hierarchical agent architecture with category-based organization
 */
contract AgentRegistry is Ownable, ReentrancyGuard {
    
    // ============================================================
    // ENUMS & TYPES
    // ============================================================
    
    enum AgentCategory {
        ORCHESTRATION,        // 0: Morio, Nuru, Coordinators
        ELDER_COUNCIL,        // 1: Scry, Kaizen, Lumen
        DeFi_TRADING,         // 2: Traders, Synchronizers
        SECURITY,             // 3: Scout, Defender, Repair
        INTELLIGENCE,         // 4: Gateway, Relay, Hasher
        COMPLIANCE,           // 5: Compliance, Analytics
        COMMUNITY,            // 6: Community, Chama
        SPECIALIZED           // 7: Okedi, MirrorCore, AOE
    }
    
    enum AutonomyLevel {
        FULLY_AUTONOMOUS,
        SEMI_AUTONOMOUS,
        USER_CONTROLLED,
        DISABLED
    }
    
    // SubscriptionTier is defined in SharedTypes.sol
    
    // ============================================================
    // STRUCTURES
    // ============================================================
    
    struct AgentConfig {
        bytes32 agentId;
        string name;
        string description;
        AgentCategory category;
        address agentAddress;
        AutonomyLevel autonomyLevel;
        bool requiresPaymentVerification;
        bool requiresOnChainRegistration;
        bool requiresTreasuryAccess;
        bool requiresGovernancePermissions;
        bool requiresAgentCommunication;
        uint256 createdAt;
        bool isActive;
    }
    
    struct AgentCapability {
        bytes32 capabilityId;
        string name;
        string description;
        bytes4 functionSelector;
        uint8 riskLevel;
        bool requiresApproval;
        string abiIpfsHash; // Off-chain ABI stored on IPFS
    }
    
    struct TierDefinition {
        SubscriptionTier tier;
        uint256 monthlyFeeInKES;
        uint256 maxSubscribers;
        bool requiresGovernance;
        bool hasTreasuryAccess;
        uint256 createdAt;
    }
    
    // ============================================================
    // STATE VARIABLES
    // ============================================================
    
    // Agent Registry
    mapping(bytes32 agentId => AgentConfig) public agents;
    mapping(address agentAddress => bytes32 agentId) public agentAddressToId;
    mapping(bytes32 agentId => address agentAddress) public agentIdToAddress;
    bytes32[] public registeredAgentIds;
    
    // Agent categorization
    mapping(AgentCategory category => bytes32[] agentIds) public agentsByCategory;
    mapping(bytes32 agentId => AgentCapability[]) public agentCapabilities;
    
    // Tier management
    mapping(SubscriptionTier tier => TierDefinition) public tierDefinitions;
    mapping(SubscriptionTier tier => uint256 monthlyFeeInKES) public tierPricing;
    
    // Global stats
    uint256 public totalAgentsRegistered;
    uint256 public totalActiveAgents;
    
    // ============================================================
    // EVENTS
    // ============================================================
    
    event AgentRegistered(
        bytes32 indexed agentId,
        address indexed agentAddress,
        string name,
        AgentCategory category,
        uint256 timestamp
    );
    
    event AgentStatusChanged(
        bytes32 indexed agentId,
        bool isActive,
        uint256 timestamp
    );
    
    event CapabilityAdded(
        bytes32 indexed agentId,
        bytes32 indexed capabilityId,
        string name,
        uint256 timestamp
    );
    
    event TierCreated(
        SubscriptionTier tier,
        uint256 monthlyFeeInKES,
        uint256 timestamp
    );
    
    // ============================================================
    // ERRORS
    // ============================================================
    
    error AgentAlreadyRegistered();
    error AgentNotFound();
    error InvalidAgentAddress();
    error UnauthorizedCaller();
    error InvalidTier();
    error AgentNotActive();
    
    // ============================================================
    // MODIFIERS
    // ============================================================
    
    modifier onlyValidAgent(bytes32 agentId) {
        if (!agents[agentId].isActive) revert AgentNotActive();
        _;
    }
    
    modifier onlyRegisteredAgent() {
        bytes32 agentId = agentAddressToId[msg.sender];
        if (agents[agentId].agentAddress != msg.sender) revert UnauthorizedCaller();
        _;
    }
    
    // ============================================================
    // CONSTRUCTOR
    // ============================================================
    
    constructor() Ownable(msg.sender) {
        // Initialize tier pricing
        tierPricing[SubscriptionTier.FREE] = 0;
        tierPricing[SubscriptionTier.BASIC] = 30000;      // 30,000 KES
        tierPricing[SubscriptionTier.PREMIUM] = 150000;   // 150,000 KES
        tierPricing[SubscriptionTier.ENTERPRISE] = 750000; // 750,000 KES
    }
    
    // ============================================================
    // AGENT REGISTRATION
    // ============================================================
    
    /**
     * @notice Register a new agent in the ecosystem
     * @param agentAddress Address of agent contract or wallet
     * @param name Human-readable agent name
     * @param description Agent description
     * @param category Agent category
     * @param autonomyLevel Autonomy level
     */
    function registerAgent(
        address agentAddress,
        string memory name,
        string memory description,
        AgentCategory category,
        AutonomyLevel autonomyLevel
    ) external onlyOwner returns (bytes32 agentId) {
        if (agentAddress == address(0)) revert InvalidAgentAddress();
        if (agentAddressToId[agentAddress] != bytes32(0)) revert AgentAlreadyRegistered();
        
        agentId = keccak256(abi.encodePacked(agentAddress, block.timestamp));
        
        agents[agentId] = AgentConfig({
            agentId: agentId,
            name: name,
            description: description,
            category: category,
            agentAddress: agentAddress,
            autonomyLevel: autonomyLevel,
            requiresPaymentVerification: true,
            requiresOnChainRegistration: true,
            requiresTreasuryAccess: category == AgentCategory.DeFi_TRADING || 
                                   category == AgentCategory.COMPLIANCE ||
                                   category == AgentCategory.COMMUNITY,
            requiresGovernancePermissions: category == AgentCategory.ELDER_COUNCIL ||
                                          category == AgentCategory.SECURITY,
            requiresAgentCommunication: true,
            createdAt: block.timestamp,
            isActive: true
        });
        
        agentAddressToId[agentAddress] = agentId;
        agentIdToAddress[agentId] = agentAddress;
        registeredAgentIds.push(agentId);
        agentsByCategory[category].push(agentId);
        
        totalAgentsRegistered++;
        totalActiveAgents++;
        
        emit AgentRegistered(agentId, agentAddress, name, category, block.timestamp);
        
        return agentId;
    }
    
    /**
     * @notice Add a capability to an agent
     */
    function addCapability(
        bytes32 agentId,
        string memory capabilityName,
        string memory description,
        bytes4 functionSelector,
        uint8 riskLevel
    ) external onlyOwner onlyValidAgent(agentId) returns (bytes32 capabilityId) {
        require(riskLevel <= 10, "Invalid risk level");
        
        capabilityId = keccak256(abi.encodePacked(agentId, capabilityName));
        
        agentCapabilities[agentId].push(AgentCapability({
            capabilityId: capabilityId,
            name: capabilityName,
            description: description,
            functionSelector: functionSelector,
            riskLevel: riskLevel,
            requiresApproval: riskLevel >= 7,
            abiIpfsHash: ""
        }));
        
        emit CapabilityAdded(agentId, capabilityId, capabilityName, block.timestamp);
        
        return capabilityId;
    }
    
    /**
     * @notice Deactivate an agent
     */
    function deactivateAgent(bytes32 agentId) external onlyOwner onlyValidAgent(agentId) {
        agents[agentId].isActive = false;
        totalActiveAgents--;
        emit AgentStatusChanged(agentId, false, block.timestamp);
    }
    
    /**
     * @notice Reactivate an agent
     */
    function reactivateAgent(bytes32 agentId) external onlyOwner {
        require(!agents[agentId].isActive, "Agent already active");
        agents[agentId].isActive = true;
        totalActiveAgents++;
        emit AgentStatusChanged(agentId, true, block.timestamp);
    }
    
    // ============================================================
    // QUERY FUNCTIONS
    // ============================================================
    
    /**
     * @notice Get agent configuration
     */
    function getAgent(bytes32 agentId)
        external
        view
        returns (AgentConfig memory)
    {
        return agents[agentId];
    }
    
    /**
     * @notice Get all agents by category
     */
    function getAgentsByCategory(AgentCategory category)
        external
        view
        returns (bytes32[] memory)
    {
        return agentsByCategory[category];
    }
    
    /**
     * @notice Get agent capabilities
     */
    function getCapabilities(bytes32 agentId)
        external
        view
        returns (AgentCapability[] memory)
    {
        return agentCapabilities[agentId];
    }
    
    /**
     * @notice Get all registered agents
     */
    function getAllAgents()
        external
        view
        returns (bytes32[] memory)
    {
        return registeredAgentIds;
    }
    
    /**
     * @notice Get all active agents
     */
    function getActiveAgents()
        external
        view
        returns (bytes32[] memory)
    {
        bytes32[] memory active = new bytes32[](totalActiveAgents);
        uint256 count = 0;
        
        for (uint256 i = 0; i < registeredAgentIds.length; i++) {
            if (agents[registeredAgentIds[i]].isActive) {
                active[count] = registeredAgentIds[i];
                count++;
            }
        }
        
        return active;
    }
    
    /**
     * @notice Get total agents
     */
    function getTotalAgents()
        external
        view
        returns (uint256 total, uint256 active)
    {
        return (totalAgentsRegistered, totalActiveAgents);
    }
    
    /**
     * @notice Verify agent is registered and active
     */
    function isAgentRegistered(bytes32 agentId)
        external
        view
        returns (bool)
    {
        return agents[agentId].isActive;
    }
    
    /**
     * @notice Verify agent is in category
     */
    function isAgentInCategory(bytes32 agentId, AgentCategory category)
        external
        view
        returns (bool)
    {
        return agents[agentId].category == category && agents[agentId].isActive;
    }
}
