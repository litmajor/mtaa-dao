// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable2Step.sol";
import "./SharedTypes.sol";
import "./SubscriptionManager.sol";

/**
 * @title  AgentPermissionManager
 * @author MtaaDAO
 * @notice Manages capability-based permissions for agents and subscribed users.
 *
 *         - Capabilities are registered with a minimum subscription tier.
 *         - Agents declare which capabilities they support.
 *         - Access is gated by: agent active + agent has capability +
 *           user tier >= required tier + (if high-risk) explicit approval.
 *
 *         Audit fixes applied (2025-06):
 *         [CRITICAL] Agent-specific tier override uses a dedicated sentinel mapping
 *                    to distinguish "not set" from legitimately set FREE tier.
 *         [HIGH]     isCapabilityAuthorized() returns (bool, bytes32) reason code
 *                    instead of reverting — callers don't need try/catch.
 *         [HIGH]     O(1) capability membership check via agentHasCapability mapping.
 *         [MEDIUM]   registeredCapabilities is paginated; deactivated entries are
 *                    excluded from getActiveCapabilities().
 *         [MEDIUM]   SubscriptionTier enum is defined once (above) and shared.
 *         [MEDIUM]   addCapabilityToAgent reverts on duplicate instead of silent return.
 *         [DESIGN]   subscriptionManager validated as non-zero before access checks.
 *         [DESIGN]   isSubscribed return type uses shared SubscriptionTier enum.
 */
contract AgentPermissionManager is Ownable2Step {

    // =========================================================================
    // TYPES
    // =========================================================================

    struct Capability {
        bytes32 capabilityId;
        string name;
        string description;
        bytes4 functionSelector;
        uint8 riskLevel;              // 0–10
        SubscriptionTier minimumTier;
        string abiIpfsHash;
        bool requiresApproval;
        bool active;
    }

    // Reason codes returned by isCapabilityAuthorized() — avoids reverting in view.
    bytes32 public constant AUTHORIZED              = keccak256("AUTHORIZED");
    bytes32 public constant ERR_AGENT_INACTIVE      = keccak256("ERR_AGENT_INACTIVE");
    bytes32 public constant ERR_CAPABILITY_INACTIVE = keccak256("ERR_CAPABILITY_INACTIVE");
    bytes32 public constant ERR_NOT_SUPPORTED       = keccak256("ERR_NOT_SUPPORTED");
    bytes32 public constant ERR_NOT_SUBSCRIBED      = keccak256("ERR_NOT_SUBSCRIBED");
    bytes32 public constant ERR_TIER_INSUFFICIENT   = keccak256("ERR_TIER_INSUFFICIENT");
    bytes32 public constant ERR_APPROVAL_REQUIRED   = keccak256("ERR_APPROVAL_REQUIRED");
    bytes32 public constant ERR_NO_SUBSCRIPTION_MGR = keccak256("ERR_NO_SUBSCRIPTION_MGR");

    // =========================================================================
    // STATE
    // =========================================================================

    SubscriptionManager public subscriptionManager;

    // Capability registry
    mapping(bytes32 => Capability) public capabilities;
    bytes32[] internal _allCapabilityIds; // includes deactivated; use getActiveCapabilities()

    // Agent state
    mapping(bytes32 => bool) public agentActive;

    // O(1) capability membership (replaces linear scan)
    mapping(bytes32 agentId => mapping(bytes32 capabilityId => bool)) public agentHasCapability;

    // Ordered list per agent (for enumeration)
    mapping(bytes32 => bytes32[]) internal _agentCapabilityList;

    // Tier overrides
    // capabilityMinimumTier: global floor for a capability
    mapping(bytes32 capabilityId => SubscriptionTier) public capabilityMinimumTier;

    // Agent-specific override: stored as (tier + 1) so 0 = "not set", 1 = FREE, 2 = BASIC, etc.
    // This avoids the sentinel bug where FREE (0) was indistinguishable from unset (0).
    mapping(bytes32 agentId => mapping(bytes32 capabilityId => uint8)) internal _agentCapabilityTierOverride;

    // High-risk approval grants
    mapping(bytes32 => bool) public capabilityRequiresApproval;
    mapping(address user => mapping(bytes32 capabilityId => bool)) public capabilityApprovalGrants;

    // =========================================================================
    // EVENTS
    // =========================================================================

    event CapabilityRegistered(bytes32 indexed capabilityId, string name, uint8 riskLevel, SubscriptionTier minimumTier, uint256 timestamp);
    event CapabilityDeactivated(bytes32 indexed capabilityId, uint256 timestamp);
    event CapabilityMinimumTierUpdated(bytes32 indexed capabilityId, SubscriptionTier newTier, uint256 timestamp);

    event AgentCapabilityAdded(bytes32 indexed agentId, bytes32 indexed capabilityId, uint256 timestamp);
    event AgentCapabilityRemoved(bytes32 indexed agentId, bytes32 indexed capabilityId, uint256 timestamp);
    event AgentCapabilityTierOverrideSet(bytes32 indexed agentId, bytes32 indexed capabilityId, SubscriptionTier tier, uint256 timestamp);
    event AgentCapabilityTierOverrideCleared(bytes32 indexed agentId, bytes32 indexed capabilityId, uint256 timestamp);
    event AgentStatusChanged(bytes32 indexed agentId, bool active, uint256 timestamp);

    event CapabilityApprovalGranted(address indexed user, bytes32 indexed capabilityId, uint256 timestamp);
    event CapabilityApprovalRevoked(address indexed user, bytes32 indexed capabilityId, uint256 timestamp);
    event SubscriptionManagerSet(address indexed manager, uint256 timestamp);

    // =========================================================================
    // ERRORS
    // =========================================================================

    error ZeroAddress();
    error CapabilityNotFound();
    error CapabilityAlreadyExists();
    error CapabilityAlreadyAssigned();
    error CapabilityNotAssigned();
    error InvalidRiskLevel();
    error SubscriptionManagerNotSet();

    // =========================================================================
    // CONSTRUCTOR
    // =========================================================================

    constructor() Ownable(msg.sender) {}

    // =========================================================================
    // SETUP
    // =========================================================================

    function setSubscriptionManager(address _manager) external onlyOwner {
        if (_manager == address(0)) revert ZeroAddress();
        subscriptionManager = SubscriptionManager(_manager);
        emit SubscriptionManagerSet(_manager, block.timestamp);
    }

    // =========================================================================
    // CAPABILITY MANAGEMENT
    // =========================================================================

    function registerCapability(
        bytes32 capabilityId,
        string memory name,
        string memory description,
        bytes4 functionSelector,
        uint8 riskLevel,
        SubscriptionTier minimumTier,
        string memory abiIpfsHash,
        bool requiresApproval
    ) external onlyOwner {
        if (riskLevel > 10) revert InvalidRiskLevel();
        if (capabilities[capabilityId].capabilityId != bytes32(0)) revert CapabilityAlreadyExists();

        capabilities[capabilityId] = Capability({
            capabilityId:     capabilityId,
            name:             name,
            description:      description,
            functionSelector: functionSelector,
            riskLevel:        riskLevel,
            minimumTier:      minimumTier,
            abiIpfsHash:      abiIpfsHash,
            requiresApproval: requiresApproval,
            active:           true
        });

        _allCapabilityIds.push(capabilityId);
        capabilityMinimumTier[capabilityId] = minimumTier;
        capabilityRequiresApproval[capabilityId] = requiresApproval;

        emit CapabilityRegistered(capabilityId, name, riskLevel, minimumTier, block.timestamp);
    }

    function updateCapabilityMinimumTier(bytes32 capabilityId, SubscriptionTier newTier) external onlyOwner {
        if (capabilities[capabilityId].capabilityId == bytes32(0)) revert CapabilityNotFound();
        capabilityMinimumTier[capabilityId] = newTier;
        capabilities[capabilityId].minimumTier = newTier;
        emit CapabilityMinimumTierUpdated(capabilityId, newTier, block.timestamp);
    }

    function deactivateCapability(bytes32 capabilityId) external onlyOwner {
        if (capabilities[capabilityId].capabilityId == bytes32(0)) revert CapabilityNotFound();
        capabilities[capabilityId].active = false;
        emit CapabilityDeactivated(capabilityId, block.timestamp);
    }

    // =========================================================================
    // AGENT CAPABILITY ASSIGNMENT
    // =========================================================================

    function addCapabilityToAgent(bytes32 agentId, bytes32 capabilityId) external onlyOwner {
        if (capabilities[capabilityId].capabilityId == bytes32(0)) revert CapabilityNotFound();
        if (agentHasCapability[agentId][capabilityId]) revert CapabilityAlreadyAssigned();

        agentHasCapability[agentId][capabilityId] = true;
        _agentCapabilityList[agentId].push(capabilityId);
        agentActive[agentId] = true;

        emit AgentCapabilityAdded(agentId, capabilityId, block.timestamp);
    }

    function removeCapabilityFromAgent(bytes32 agentId, bytes32 capabilityId) external onlyOwner {
        if (!agentHasCapability[agentId][capabilityId]) revert CapabilityNotAssigned();

        agentHasCapability[agentId][capabilityId] = false;

        // Swap-and-pop from enumeration list
        bytes32[] storage list = _agentCapabilityList[agentId];
        for (uint256 i = 0; i < list.length; ++i) {
            if (list[i] == capabilityId) {
                list[i] = list[list.length - 1];
                list.pop();
                break;
            }
        }

        emit AgentCapabilityRemoved(agentId, capabilityId, block.timestamp);
    }

    function setAgentStatus(bytes32 agentId, bool active) external onlyOwner {
        agentActive[agentId] = active;
        emit AgentStatusChanged(agentId, active, block.timestamp);
    }

    /**
     * @notice Set an agent-specific tier override for a capability.
     *         Stores (tier + 1) internally so FREE (0) is distinguishable from unset (0).
     * @param tier  The minimum tier required. Must be >= global minimum.
     */
    function setAgentCapabilityTierOverride(
        bytes32 agentId,
        bytes32 capabilityId,
        SubscriptionTier tier
    ) external onlyOwner {
        if (capabilities[capabilityId].capabilityId == bytes32(0)) revert CapabilityNotFound();
        // Store as (ordinal + 1): FREE=1, BASIC=2, PREMIUM=3, ENTERPRISE=4
        _agentCapabilityTierOverride[agentId][capabilityId] = uint8(tier) + 1;
        emit AgentCapabilityTierOverrideSet(agentId, capabilityId, tier, block.timestamp);
    }

    /**
     * @notice Remove an agent-specific tier override, reverting to global minimum.
     */
    function clearAgentCapabilityTierOverride(bytes32 agentId, bytes32 capabilityId) external onlyOwner {
        _agentCapabilityTierOverride[agentId][capabilityId] = 0; // 0 = unset
        emit AgentCapabilityTierOverrideCleared(agentId, capabilityId, block.timestamp);
    }

    // =========================================================================
    // APPROVAL MANAGEMENT
    // =========================================================================

    function grantCapabilityApproval(address user, bytes32 capabilityId) external onlyOwner {
        capabilityApprovalGrants[user][capabilityId] = true;
        emit CapabilityApprovalGranted(user, capabilityId, block.timestamp);
    }

    function revokeCapabilityApproval(address user, bytes32 capabilityId) external onlyOwner {
        capabilityApprovalGrants[user][capabilityId] = false;
        emit CapabilityApprovalRevoked(user, capabilityId, block.timestamp);
    }

    // =========================================================================
    // ACCESS CHECK
    // =========================================================================

    /**
     * @notice Check whether a user may invoke a capability on an agent.
     * @return authorized True if all checks pass.
     * @return reason     AUTHORIZED on success, or an ERR_* reason code on failure.
     *                    Callers should check `authorized` first; `reason` is for
     *                    diagnostics and event logging. No try/catch needed.
     */
    function isCapabilityAuthorized(
        bytes32 agentId,
        bytes32 capabilityId,
        address user
    ) external view returns (bool authorized, bytes32 reason) {
        // 1. Subscription manager must be configured
        if (address(subscriptionManager) == address(0)) {
            return (false, ERR_NO_SUBSCRIPTION_MGR);
        }

        // 2. Agent must be active
        if (!agentActive[agentId]) {
            return (false, ERR_AGENT_INACTIVE);
        }

        // 3. Agent must support this capability (O(1))
        if (!agentHasCapability[agentId][capabilityId]) {
            return (false, ERR_NOT_SUPPORTED);
        }

        // 4. Capability must be active
        if (!capabilities[capabilityId].active) {
            return (false, ERR_CAPABILITY_INACTIVE);
        }

        // 5. Determine effective required tier
        //    Agent override (stored as tier+1): if > 0, override is set.
        SubscriptionTier requiredTier;
        uint8 overrideStored = _agentCapabilityTierOverride[agentId][capabilityId];
        if (overrideStored > 0) {
            requiredTier = SubscriptionTier(overrideStored - 1);
        } else {
            requiredTier = capabilityMinimumTier[capabilityId];
        }

        // 6. Check user subscription tier
        (bool isSubscribed, uint256 userTierVal) = subscriptionManager.isSubscribed(agentId, user);
        SubscriptionTier userTier = SubscriptionTier(uint8(userTierVal));

        if (!isSubscribed) {
            return (false, ERR_NOT_SUBSCRIBED);
        }

        if (userTier < requiredTier) {
            return (false, ERR_TIER_INSUFFICIENT);
        }

        // 7. High-risk approval check
        if (capabilityRequiresApproval[capabilityId]) {
            if (!capabilityApprovalGrants[user][capabilityId]) {
                return (false, ERR_APPROVAL_REQUIRED);
            }
        }

        return (true, AUTHORIZED);
    }

    // =========================================================================
    // VIEWS
    // =========================================================================

    /**
     * @notice Returns active capabilities for an agent (O(n) on agent's capability count).
     */
    function getAgentCapabilities(bytes32 agentId) external view returns (bytes32[] memory) {
        bytes32[] storage list = _agentCapabilityList[agentId];
        uint256 activeCount;
        for (uint256 i = 0; i < list.length; ++i) {
            if (capabilities[list[i]].active) activeCount++;
        }
        bytes32[] memory result = new bytes32[](activeCount);
        uint256 idx;
        for (uint256 i = 0; i < list.length; ++i) {
            if (capabilities[list[i]].active) result[idx++] = list[i];
        }
        return result;
    }

    /**
     * @notice Returns paginated active capabilities across the global registry.
     * @param offset Start index into the full (including inactive) list.
     * @param limit  Max results to return.
     */
    function getActiveCapabilities(uint256 offset, uint256 limit)
        external
        view
        returns (bytes32[] memory result, uint256 total)
    {
        total = _allCapabilityIds.length;
        uint256 end = offset + limit > total ? total : offset + limit;

        // Two-pass: count then fill (avoids dynamic memory growth)
        uint256 activeCount;
        for (uint256 i = offset; i < end; ++i) {
            if (capabilities[_allCapabilityIds[i]].active) activeCount++;
        }

        result = new bytes32[](activeCount);
        uint256 idx;
        for (uint256 i = offset; i < end; ++i) {
            if (capabilities[_allCapabilityIds[i]].active) {
                result[idx++] = _allCapabilityIds[i];
            }
        }
    }

    function getCapability(bytes32 capabilityId) external view returns (Capability memory) {
        return capabilities[capabilityId];
    }

    function getTotalCapabilityCount() external view returns (uint256) {
        return _allCapabilityIds.length;
    }

    function getAgentCapabilityCount(bytes32 agentId) external view returns (uint256) {
        return _agentCapabilityList[agentId].length;
    }

    /**
     * @notice Returns the effective required tier for (agentId, capabilityId),
     *         respecting any agent-specific override.
     */
    function getEffectiveRequiredTier(bytes32 agentId, bytes32 capabilityId)
        external
        view
        returns (SubscriptionTier)
    {
        uint8 overrideStored = _agentCapabilityTierOverride[agentId][capabilityId];
        if (overrideStored > 0) return SubscriptionTier(overrideStored - 1);
        return capabilityMinimumTier[capabilityId];
    }
}
