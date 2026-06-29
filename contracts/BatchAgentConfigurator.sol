// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./AgentRegistry.sol";
import "./AgentPaymentGateway.sol";
import "./AgentPermissionManager.sol";
import "./AgentIds.sol";
import "./SharedTypes.sol";

/**
 * @title  BatchAgentConfigurator
 * @author MtaaDAO
 * @notice Batch setup of all 36 agents: registration, payment config, capabilities.
 *         Use this in deployment to atomically configure the entire ecosystem.
 *
 *         Workflow:
 *         1. Owner calls batchConfigureAgents() with all 36 configs
 *         2. Each agent is registered (or existing config updated)
 *         3. Payment configs (fees, percentages) are set
 *         4. In a separate call, batchAddCapabilities() registers capabilities per agent
 */
contract BatchAgentConfigurator {

    // =========================================================================
    // TYPES
    // =========================================================================

    struct AgentConfig {
        bytes32 agentId;
        address agentAddress;
        string name;
        string description;
        uint256 feeInKES;            // Monthly subscription fee
        uint256 feeInUSD;            // Monthly subscription fee in USD
        uint8   defaultTier;         // default subscription tier value
        uint256 defaultSubscriptionDuration; // default duration in seconds
        uint256 payoutPercentage;    // Agent's take (0-100)
        uint256 treasuryPercentage;  // Treasury's take (0-100)
        uint256 communityPercentage; // Community pool's take (0-100)
        bool acceptsMTAA;
        bool acceptsKES;
    }

    struct CapabilityConfig {
        bytes32 capabilityId;
        string name;
        string description;
        bytes4 functionSelector;
        uint8 riskLevel;
        uint8 minimumTierValue;      // SubscriptionTier enum value (0-3)
        string abiIpfsHash;
        bool requiresApproval;
    }

    struct AgentCapabilitiesConfig {
        bytes32 agentId;
        CapabilityConfig[] capabilities;
    }

    // =========================================================================
    // STATE
    // =========================================================================

    address public owner;
    AgentRegistry public agentRegistry;
    AgentPaymentGateway public paymentGateway;
    AgentPermissionManager public permissionManager;

    // =========================================================================
    // EVENTS
    // =========================================================================

    event AgentBatchConfigured(uint256 agentCount, uint256 timestamp);
    event CapabilitiesBatchAdded(bytes32 indexed agentId, uint256 capabilityCount, uint256 timestamp);

    // =========================================================================
    // ERRORS
    // =========================================================================

    error OnlyOwner();
    error ZeroAddress();
    error InvalidPercentageSum();

    // =========================================================================
    // MODIFIERS
    // =========================================================================

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner");
        _;
    }

    // =========================================================================
    // CONSTRUCTOR
    // =========================================================================

    constructor(
        address _registry,
        address _gateway,
        address _permissionManager
    ) {
        if (_registry == address(0) || _gateway == address(0) || _permissionManager == address(0)) {
            revert ZeroAddress();
        }
        owner = msg.sender;
        agentRegistry = AgentRegistry(_registry);
        paymentGateway = AgentPaymentGateway(_gateway);
        permissionManager = AgentPermissionManager(_permissionManager);
    }

    // =========================================================================
    // BATCH AGENT CONFIGURATION
    // =========================================================================

    /**
     * @notice Batch configure all 36 agents with their payment configs
     * @param configs Array of 36 AgentConfig structs (should match AgentIds order)
     */
    function batchConfigureAgents(AgentConfig[] calldata configs) external onlyOwner {
        require(configs.length <= 36, "Max 36 agents");

        for (uint256 i = 0; i < configs.length; ++i) {
            AgentConfig calldata cfg = configs[i];

            // Validate percentages sum to 100 or less
            uint256 total = cfg.payoutPercentage + cfg.treasuryPercentage + cfg.communityPercentage;
            require(total <= 100, "Percentages exceed 100");

            // Configure in gateway
            paymentGateway.configureAgent(
                cfg.agentId,
                cfg.agentAddress,
                cfg.feeInKES,
                cfg.feeInUSD,
                cfg.defaultTier,
                cfg.defaultSubscriptionDuration,
                cfg.payoutPercentage,
                cfg.treasuryPercentage,
                cfg.communityPercentage,
                cfg.acceptsMTAA,
                cfg.acceptsKES
            );
        }

        emit AgentBatchConfigured(configs.length, block.timestamp);
    }

    /**
     * @notice Batch add capabilities to an agent
     * @param agentId Agent to configure
     * @param capabilities Array of CapabilityConfig structs
     */
    function batchAddCapabilities(
        bytes32 agentId,
        CapabilityConfig[] calldata capabilities
    ) external onlyOwner {
        for (uint256 i = 0; i < capabilities.length; ++i) {
            CapabilityConfig calldata cap = capabilities[i];

            // Register capability in permission manager
            permissionManager.registerCapability(
                cap.capabilityId,
                cap.name,
                cap.description,
                cap.functionSelector,
                cap.riskLevel,
                SubscriptionTier(cap.minimumTierValue),
                cap.abiIpfsHash,
                cap.requiresApproval
            );

            // Add capability to agent
            permissionManager.addCapabilityToAgent(agentId, cap.capabilityId);
        }

        emit CapabilitiesBatchAdded(agentId, capabilities.length, block.timestamp);
    }

    /**
     * @notice Batch add capabilities for multiple agents
     */
    function batchAddCapabilitiesForAgents(
        AgentCapabilitiesConfig[] calldata agentConfigs
    ) external onlyOwner {
        for (uint256 i = 0; i < agentConfigs.length; ++i) {
            this.batchAddCapabilities(agentConfigs[i].agentId, agentConfigs[i].capabilities);
        }
    }

    // =========================================================================
    // UTILITY VIEW FUNCTIONS
    // =========================================================================

    /**
     * @notice Get all canonical agent IDs (from AgentIds library)
     * For reference during batch configuration
     */
    function getCanonicalAgentIds() external pure returns (bytes32[] memory) {
        bytes32[36] memory fixedIds = AgentIds.all();
        bytes32[] memory out = new bytes32[](fixedIds.length);
        for (uint256 i = 0; i < fixedIds.length; ++i) {
            out[i] = fixedIds[i];
        }
        return out;
    }

    /**
     * @notice Verify a configuration matches a known agent ID
     */
    function isValidAgentId(bytes32 agentId) external pure returns (bool) {
        return AgentIds.isKnown(agentId);
    }
}

// ============================================================================
// INTERFACES
// ============================================================================

// Interfaces removed: use concrete contract types imported above to avoid
// duplicate declarations and keep a single authoritative type per contract.
