// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./AgentIds.sol";
import "./SharedTypes.sol";

/**
 * @title SubscriptionManager
 * @notice Manages agent subscriptions with universal verification
 * @dev Supports FREE, BASIC, PREMIUM, and ENTERPRISE tiers
 */
contract SubscriptionManager is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;
    
    // ============================================================
    // ENUMS & TYPES
    // ============================================================
    
    // SubscriptionTier enum is shared via SharedTypes.sol
    
    // ============================================================
    // STRUCTURES
    // ============================================================
    
    struct Subscription {
        bytes32 subscriptionId;
        bytes32 agentId;
        address subscriber;
        SubscriptionTier tier;
        uint256 monthlyFeeInKES;
        uint256 mtaaEquivalent;
        uint256 startDate;
        uint256 renewalDate;
        bool active;
        bytes32 paymentMethodId;
    }
    
    struct TierDefinition {
        SubscriptionTier tier;
        uint256 monthlyFeeInKES;
        uint256 monthlyFeeInUSD;
        uint256 maxSubscribers;
        string[] includedFeatures;
        bool requiresGovernance;
        bool hasTreasuryAccess;
    }
    
    // ============================================================
    // STATE VARIABLES
    // ============================================================
    
    address public mtaaToken;
    address public agentRegistry;
    address public paymentGateway;
    address public permissionManager;  // AgentPermissionManager for capability gating
    address public auditLog;           // AuditLog for tracking subscription events
    
    // Subscription data
    mapping(bytes32 subscriptionId => Subscription) public subscriptions;
    mapping(address user => bytes32[] subscriptionIds) public userSubscriptions;
    mapping(bytes32 agentId => bytes32[] subscriptionIds) public agentSubscriptions;
    mapping(address user => mapping(bytes32 agentId => bool)) public isSubscribedTo;
    
    // Tier configuration
    mapping(SubscriptionTier tier => TierDefinition) public tierDefinitions;
    mapping(SubscriptionTier tier => uint256 feeInKES) public tierPricing;
    mapping(SubscriptionTier tier => uint256) public tierPricingUSD;
    mapping(SubscriptionTier tier => uint256) public tierDurationSeconds;
    
    // Exchange rate
    uint256 public mtaaToKESRate = 15;  // 1 MTAA = 15 KES
    uint256 public lastRateUpdate;
    
    // Global stats
    uint256 public totalSubscriptions;
    uint256 public totalActiveSubscriptions;
    
    // ============================================================
    // EVENTS
    // ============================================================
    
    event SubscriptionCreated(
        bytes32 indexed subscriptionId,
        bytes32 indexed agentId,
        address indexed user,
        SubscriptionTier tier,
        uint256 timestamp
    );
    
    event SubscriptionRenewed(
        bytes32 indexed subscriptionId,
        uint256 newRenewalDate,
        uint256 timestamp
    );
    
    event SubscriptionCancelled(
        bytes32 indexed subscriptionId,
        uint256 timestamp
    );
    
    event TierUpdated(
        SubscriptionTier tier,
        uint256 monthlyFeeInKES,
        uint256 timestamp
    );
    
    event ExchangeRateUpdated(
        uint256 oldRate,
        uint256 newRate,
        uint256 timestamp
    );
    
    // ============================================================
    // ERRORS
    // ============================================================
    
    error InvalidAddress();
    error InvalidTier();
    error InvalidAmount();
    error SubscriptionNotFound();
    error AlreadySubscribed();
    error NotSubscribed();
    error SubscriptionExpired();
    error MaxSubscribersReached();
    error UnauthorizedCaller();
    
    // ============================================================
    // MODIFIERS
    // ============================================================
    
    modifier onlyValidSubscription(bytes32 subscriptionId) {
        require(subscriptions[subscriptionId].active, "Invalid subscription");
        _;
    }
    
    modifier onlyValidAgent(bytes32 agentId) {
        require(agentRegistry != address(0), "Registry not set");
        _;
    }
    
    // ============================================================
    // CONSTRUCTOR
    // ============================================================
    
    constructor(
        address _mtaaToken,
        address _agentRegistry,
        address _paymentGateway
    ) Ownable(msg.sender) {
        if (_mtaaToken == address(0) || _agentRegistry == address(0)) {
            revert InvalidAddress();
        }
        
        mtaaToken = _mtaaToken;
        agentRegistry = _agentRegistry;
        paymentGateway = _paymentGateway;
        lastRateUpdate = block.timestamp;
        
        // Note: avoid hardcoding business rules — tier pricing and durations are
        // configurable by the owner via `updateTierPrice`/`updateTierPriceUSD`
        // and `updateTierDuration`. Keep FREE = 0 by default.
        tierPricing[SubscriptionTier.FREE] = 0;
        tierDurationSeconds[SubscriptionTier.FREE] = 0;
        tierDurationSeconds[SubscriptionTier.BASIC] = 30 days;      // default, owner may change
        tierDurationSeconds[SubscriptionTier.PREMIUM] = 30 days;    // default, owner may change
        tierDurationSeconds[SubscriptionTier.ENTERPRISE] = 30 days; // default, owner may change
    }

    // ============================================================
    // SETUP & INTEGRATION
    // ============================================================

    /**
     * @notice Wire the permission manager for capability gating
     */
    function setPermissionManager(address _manager) external onlyOwner {
        if (_manager == address(0)) revert InvalidAddress();
        permissionManager = _manager;
    }

    /**
     * @notice Wire the audit log contract
     */
    function setAuditLog(address _auditLog) external onlyOwner {
        if (_auditLog == address(0)) revert InvalidAddress();
        auditLog = _auditLog;
    }
    
    // ============================================================
    // SUBSCRIPTION MANAGEMENT
    // ============================================================
    
    /**
     * @notice Subscribe user to an agent
     * @param agentId ID of agent to subscribe to
     * @param tier Subscription tier
     */
    function subscribe(bytes32 agentId, SubscriptionTier tier)
        external
        nonReentrant
        onlyValidAgent(agentId)
        returns (bytes32 subscriptionId)
    {
        require(tier != SubscriptionTier.FREE, "Use auto-subscribe for FREE");
        require(!isSubscribedTo[msg.sender][agentId], "Already subscribed");
        
        uint256 monthlyFee = tierPricing[tier];
        require(monthlyFee > 0, "Invalid tier");
        
        // Check subscriber limit
        uint256 currentCount = agentSubscriptions[agentId].length;
        uint256 maxSubscribers = tierDefinitions[tier].maxSubscribers;
        require(maxSubscribers == 0 || currentCount < maxSubscribers, "Max reached");
        
        // Create subscription
        subscriptionId = keccak256(abi.encodePacked(
            msg.sender, agentId, block.timestamp
        ));
        
        uint256 mtaaAmount = (monthlyFee * 10) / mtaaToKESRate;
        uint256 duration = tierDurationSeconds[tier];
        if (duration == 0) {
            duration = 30 days; // fallback default
        }
        uint256 renewalDate = block.timestamp + duration;
        
        subscriptions[subscriptionId] = Subscription({
            subscriptionId: subscriptionId,
            agentId: agentId,
            subscriber: msg.sender,
            tier: tier,
            monthlyFeeInKES: monthlyFee,
            mtaaEquivalent: mtaaAmount,
            startDate: block.timestamp,
            renewalDate: renewalDate,
            active: true,
            paymentMethodId: keccak256(abi.encodePacked("PENDING"))
        });
        
        // Track subscriptions
        userSubscriptions[msg.sender].push(subscriptionId);
        agentSubscriptions[agentId].push(subscriptionId);
        isSubscribedTo[msg.sender][agentId] = true;
        
        totalSubscriptions++;
        totalActiveSubscriptions++;
        
        emit SubscriptionCreated(
            subscriptionId,
            agentId,
            msg.sender,
            tier,
            block.timestamp
        );
        
        // Transfer payment to gateway
        IERC20(mtaaToken).safeTransferFrom(
            msg.sender,
            paymentGateway,
            mtaaAmount
        );
        
        return subscriptionId;
    }
    
    /**
     * @notice Auto-subscribe to FREE tier
     */
    function autoSubscribeFree(bytes32 agentId)
        external
        onlyValidAgent(agentId)
        returns (bytes32 subscriptionId)
    {
        require(!isSubscribedTo[msg.sender][agentId], "Already subscribed");
        
        subscriptionId = keccak256(abi.encodePacked(
            msg.sender, agentId, "FREE", block.timestamp
        ));
        
        subscriptions[subscriptionId] = Subscription({
            subscriptionId: subscriptionId,
            agentId: agentId,
            subscriber: msg.sender,
            tier: SubscriptionTier.FREE,
            monthlyFeeInKES: 0,
            mtaaEquivalent: 0,
            startDate: block.timestamp,
            renewalDate: type(uint256).max,  // Never expires
            active: true,
            paymentMethodId: keccak256(abi.encodePacked("FREE"))
        });
        
        userSubscriptions[msg.sender].push(subscriptionId);
        agentSubscriptions[agentId].push(subscriptionId);
        isSubscribedTo[msg.sender][agentId] = true;
        
        totalSubscriptions++;
        totalActiveSubscriptions++;
        
        emit SubscriptionCreated(
            subscriptionId,
            agentId,
            msg.sender,
            SubscriptionTier.FREE,
            block.timestamp
        );
        
        return subscriptionId;
    }
    
    /**
     * @notice Renew a subscription
     */
    function renewSubscription(bytes32 subscriptionId)
        external
        nonReentrant
        onlyValidSubscription(subscriptionId)
    {
        Subscription storage sub = subscriptions[subscriptionId];
        require(sub.subscriber == msg.sender, "Not subscriber");
        require(sub.tier != SubscriptionTier.FREE, "FREE never expires");
        
        // Calculate new renewal date using configured tier duration (fallback 30 days)
        uint256 duration = tierDurationSeconds[sub.tier];
        if (duration == 0) duration = 30 days;
        uint256 newRenewalDate = block.timestamp + duration;
        sub.renewalDate = newRenewalDate;
        
        // Transfer payment
        if (sub.mtaaEquivalent > 0) {
            IERC20(mtaaToken).safeTransferFrom(
                msg.sender,
                paymentGateway,
                sub.mtaaEquivalent
            );
        }
        
        emit SubscriptionRenewed(subscriptionId, newRenewalDate, block.timestamp);
    }
    
    /**
     * @notice Cancel a subscription
     */
    function cancelSubscription(bytes32 subscriptionId)
        external
        nonReentrant
        onlyValidSubscription(subscriptionId)
    {
        Subscription storage sub = subscriptions[subscriptionId];
        require(sub.subscriber == msg.sender, "Not subscriber");
        
        sub.active = false;
        isSubscribedTo[sub.subscriber][sub.agentId] = false;
        totalActiveSubscriptions--;
        
        emit SubscriptionCancelled(subscriptionId, block.timestamp);
    }
    
    // ============================================================
    // SUBSCRIPTION VERIFICATION
    // ============================================================
    
    /**
     * @notice Check if user is subscribed to agent (UNIVERSAL FUNCTION)
     * @param agentId ID of agent
     * @param user User address
     * @return subscribed True if subscribed and active
     * @return tier Current subscription tier
     */
    function isSubscribed(bytes32 agentId, address user)
        external
        view
        returns (bool subscribed, uint256 tier)
    {
        bytes32[] memory userSubs = userSubscriptions[user];
        
        for (uint256 i = 0; i < userSubs.length; i++) {
            Subscription memory sub = subscriptions[userSubs[i]];
            
            if (sub.agentId == agentId && 
                sub.active && 
                sub.renewalDate > block.timestamp) {
                return (true, uint256(sub.tier));
            }
        }
        
        // Check if agent is FREE
        if (isAgentFree(agentId)) {
            return (true, uint256(SubscriptionTier.FREE));
        }
        
        return (false, 0);
    }
    
    /**
     * @notice Check if user has capability
     */
    function hasCapability(address user, bytes32 /*capabilityId*/)
        external
        view
        returns (bool)
    {
        bytes32[] memory userSubs = userSubscriptions[user];
        
        // Get capability tier requirement (simplified)
        // In production, would query AgentRegistry
        
        for (uint256 i = 0; i < userSubs.length; i++) {
            Subscription memory sub = subscriptions[userSubs[i]];
            if (sub.active && sub.renewalDate > block.timestamp) {
                // Enterprise has all capabilities
                if (sub.tier == SubscriptionTier.ENTERPRISE) {
                    return true;
                }
                // Premium has most capabilities
                if (sub.tier == SubscriptionTier.PREMIUM) {
                    return true;
                }
            }
        }
        
        return false;
    }
    
    /**
     * @notice Get user's active subscriptions
     */
    function getUserSubscriptions(address user)
        external
        view
        returns (Subscription[] memory)
    {
        bytes32[] memory subIds = userSubscriptions[user];
        Subscription[] memory activeSubs = new Subscription[](subIds.length);
        
        uint256 count = 0;
        for (uint256 i = 0; i < subIds.length; i++) {
            if (subscriptions[subIds[i]].active &&
                subscriptions[subIds[i]].renewalDate > block.timestamp) {
                activeSubs[count] = subscriptions[subIds[i]];
                count++;
            }
        }
        
        // Resize array
        Subscription[] memory result = new Subscription[](count);
        for (uint256 i = 0; i < count; i++) {
            result[i] = activeSubs[i];
        }
        
        return result;
    }
    
    /**
     * @notice Get agent subscriptions
     */
    function getAgentSubscriptions(bytes32 agentId)
        external
        view
        returns (uint256 activeCount, uint256 totalCount)
    {
        bytes32[] memory subIds = agentSubscriptions[agentId];
        totalCount = subIds.length;
        
        for (uint256 i = 0; i < subIds.length; i++) {
            if (subscriptions[subIds[i]].active &&
                subscriptions[subIds[i]].renewalDate > block.timestamp) {
                activeCount++;
            }
        }
    }
    
    // ============================================================
    // ADMIN FUNCTIONS
    // ============================================================
    
    /**
     * @notice Update tier pricing
     */
    function updateTierPrice(SubscriptionTier tier, uint256 newPrice)
        external
        onlyOwner
    {
        require(newPrice > 0 || tier == SubscriptionTier.FREE, "Invalid price");
        tierPricing[tier] = newPrice;
        emit TierUpdated(tier, newPrice, block.timestamp);
    }

    /**
     * @notice Update tier price in USD (owner configurable)
     */
    function updateTierPriceUSD(SubscriptionTier tier, uint256 newPriceUSD)
        external
        onlyOwner
    {
        require(newPriceUSD > 0 || tier == SubscriptionTier.FREE, "Invalid price");
        tierPricingUSD[tier] = newPriceUSD;
        // Reuse TierUpdated event for KES; optionally emit separate USD event if desired
        emit TierUpdated(tier, tierPricing[tier], block.timestamp);
    }

    /**
     * @notice Update subscription duration for a tier (seconds)
     */
    function updateTierDuration(SubscriptionTier tier, uint256 durationSeconds)
        external
        onlyOwner
    {
        require(durationSeconds > 0 || tier == SubscriptionTier.FREE, "Invalid duration");
        tierDurationSeconds[tier] = durationSeconds;
    }
    
    /**
     * @notice Update exchange rate
     */
    function updateExchangeRate(uint256 newRate)
        external
        onlyOwner
    {
        require(newRate > 0, "Invalid rate");
        uint256 oldRate = mtaaToKESRate;
        mtaaToKESRate = newRate;
        lastRateUpdate = block.timestamp;
        emit ExchangeRateUpdated(oldRate, newRate, block.timestamp);
    }
    
    // ============================================================
    // INTERNAL FUNCTIONS
    // ============================================================
    
    /**
     * @notice Check if agent is FREE tier
     */
    function isAgentFree(bytes32 /*agentId*/)
        internal
        pure
        returns (bool)
    {
        // In production, would query AgentRegistry
        // For now, assume only orchestration agents are free
        return false;
    }

    // ============================================================
    // Gateway Integration
    // ============================================================
    modifier onlyPaymentGateway() {
        require(msg.sender == paymentGateway, "Only payment gateway");
        _;
    }

    /**
     * @notice Called by AgentPaymentGateway after a successful payment.
     *         Creates a new subscription or extends an existing one.
     */
    function externalActivate(
        bytes32 agentId,
        address user,
        uint8   tierValue,
        uint256 durationSeconds
    ) external onlyPaymentGateway returns (bytes32 subscriptionId) {
        SubscriptionTier tier = SubscriptionTier(tierValue);

        // Try to extend existing subscription first
        bytes32[] storage userSubs = userSubscriptions[user];
        for (uint256 i = 0; i < userSubs.length; ++i) {
            Subscription storage sub = subscriptions[userSubs[i]];
            if (sub.agentId == agentId) {
                uint256 base = sub.renewalDate > block.timestamp
                    ? sub.renewalDate : block.timestamp;
                sub.renewalDate = base + durationSeconds;
                sub.active = true;
                isSubscribedTo[user][agentId] = true;
                emit SubscriptionRenewed(userSubs[i], sub.renewalDate, block.timestamp);
                return userSubs[i];
            }
        }

        // No existing subscription — create one
        subscriptionId = keccak256(
            abi.encodePacked(user, agentId, "GATEWAY", block.timestamp)
        );
        subscriptions[subscriptionId] = Subscription({
            subscriptionId:  subscriptionId,
            agentId:         agentId,
            subscriber:      user,
            tier:            tier,
            monthlyFeeInKES: tierPricing[tier],
            mtaaEquivalent:  0,
            startDate:       block.timestamp,
            renewalDate:     block.timestamp + durationSeconds,
            active:          true,
            paymentMethodId: keccak256(abi.encodePacked("GATEWAY"))
        });
        userSubscriptions[user].push(subscriptionId);
        agentSubscriptions[agentId].push(subscriptionId);
        isSubscribedTo[user][agentId] = true;
        totalSubscriptions++;
        totalActiveSubscriptions++;
        emit SubscriptionCreated(subscriptionId, agentId, user, tier, block.timestamp);
        return subscriptionId;
    }
}
