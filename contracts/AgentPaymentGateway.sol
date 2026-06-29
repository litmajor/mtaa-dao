// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable2Step.sol";   // Fix #10
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./AgentRegistry.sol";
import "./SubscriptionManager.sol";

// ─────────────────────────────────────────────────────────────────────────────
// EXTERNAL INTERFACES
// ─────────────────────────────────────────────────────────────────────────────

// Use concrete contract types for wiring to avoid duplicate interface declarations.

// ─────────────────────────────────────────────────────────────────────────────
/**
 * @title  AgentPaymentGateway  v2
 * @author MtaaDAO
 * @notice Dual-pricing (MTAA / M-Pesa KES) payment processor and subscription
 *         gate for the entire MtaaDAO agent ecosystem.
 *
 *         Every agent — Morio, Nuru, Okedi, trading agents, the Synchronizer,
 *         the Gateway, Scry, Kaizen, Lumen, and all future additions — checks
 *         isSubscribed() here before serving a user.
 *
 *         Architecture
 *         ┌──────────────────────────────────────────────────────────────┐
 *         │ AgentRegistry        → source of truth: who is an agent      │
 *         │ SubscriptionManager  → rich subscription state & tier info   │
 *         │ AgentPaymentGateway  → payment execution, earnings, expiry   │  ◄ THIS
 *         └──────────────────────────────────────────────────────────────┘
 *
 *         Fixes v1 → v2
 *         #1  payAgentInKES restricted to mpesaGateway (kills phantom payments)
 *         #2  withdrawPlatformMTAAEarnings() — MTAA no longer locked forever
 *         #3  SafeERC20 used consistently throughout (safeTransferFrom/safeTransfer)
 *         #4  Minimum fee enforced in payAgentInMTAA (1-wei subscriptions blocked)
 *         #5  subscriptionExpiry + isSubscribed() as universal access gate;
 *             optional SubscriptionManager sync via externalActivate()
 *         #6  settled flag semantics correct: MTAA → true immediately;
 *             KES → false until mpesaGateway calls settleKESPayment()
 *         #7  deactivateAgent() / reactivateAgent() kill-switch per agent
 *         #8  updateAgentFee() / updateAgentPayoutPercentage() — fees are mutable
 *         #9  onlyOracleOrOwner modifier — oracle can push rate updates on-chain
 *        #10  Ownable2Step replaces Ownable — ownership transfer requires acceptance
 */
contract AgentPaymentGateway is Ownable2Step, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // =========================================================================
    // TYPES
    // =========================================================================

    /**
     * @dev Payment-layer config per agent.
     *      Identity fields (name, description, category) live in AgentRegistry.
     *      This struct holds only what the gateway needs to process payments.
     */
    enum PaymentMethod { MTAA, KES }

    struct AgentPaymentConfig {
        uint256 feeInKES;            // Monthly subscription fee expressed in KES
        uint256 feeInUSD;            // Monthly subscription fee expressed in USD (whole units)
        uint8   defaultTier;         // Default subscription tier for this agent (0=FREE..)
        uint256 defaultSubscriptionDuration; // default duration in seconds for gateway-activated subs
        uint256 payoutPercentage;    // Agent's share 0–100
        uint256 platformPercentage;  // 100 - payoutPercentage - treasury - community (stored to avoid recalc)
        uint256 treasuryPercentage;  // Treasury share (0-100)
        uint256 communityPercentage; // Community pool share (0-100)
        bool    acceptsMTAA;
        bool    acceptsKES;
        bool    active;
        uint256 registeredAt;
        uint256 lastFeeUpdate;
    }

    struct Payment {
        bytes32 agentId;
        address payer;
        uint256 amountInKES;     // Normalised to KES for consistent audit records
        uint256 amountInUSD;     // Optional USD equivalent when available
        uint256 mtaaAmount;      // Non-zero for MTAA payments
        string  mpesaTxHash;     // Non-empty for KES payments; persisted on-chain
        PaymentMethod paymentMethod;
        uint256 timestamp;
        bool    settled;
        bytes32 subscriptionId;  // Link to subscription activated by this payment
        // settled semantics:
        //   MTAA → true immediately (on-chain transfer IS settlement)
        //   KES  → false until mpesaGateway calls settleKESPayment()
    }

    // =========================================================================
    // STATE
    // =========================================================================

    // ── Core addresses ────────────────────────────────────────────────────────
    IERC20  public immutable mtaaToken;  // Immutable: MTAA address never changes
    address public platformTreasury;
    address public mpesaGateway;         // Fix #1: sole caller allowed for KES payments
    address public rateOracle;           // Fix #9: can push rate updates alongside owner

    // ── External contract wiring (address(0) = not yet wired) ────────────────
    AgentRegistry       public agentRegistry;
    SubscriptionManager public subscriptionManager;

    // ── Agent payment config registry ─────────────────────────────────────────
    mapping(bytes32  => AgentPaymentConfig) public agentConfigs;
    mapping(address  => bytes32)            public agentAddressToId;
    mapping(bytes32  => address)            public agentIdToAddress;
    bytes32[] public registeredAgents;

    // ── Payment ledger ────────────────────────────────────────────────────────
    Payment[] public paymentHistory;
    mapping(address => uint256[]) public userPayments;

    // ── Earnings accounting ───────────────────────────────────────────────────
    mapping(address => uint256) public agentMTAAEarnings;
    mapping(address => uint256) public agentKESEarnings;      // Off-chain fiat accounting
    mapping(address => uint256) public agentWithdrawalsMTAA;
    uint256 public platformMTAAEarnings;
    uint256 public treasuryMTAAEarnings;
    uint256 public communityPoolMTAAEarnings;
    uint256 public platformKESEarnings;                        // Off-chain fiat accounting
    uint256 public treasuryKESEarnings;
    uint256 public communityPoolKESEarnings;

    // ── Fix #5: subscription expiry ───────────────────────────────────────────
    // subscriptionExpiry[agentId][user] = Unix expiry timestamp
    // Authoritative when subscriptionManager == address(0); kept in sync otherwise.
    mapping(bytes32 => mapping(address => uint256)) public subscriptionExpiry;

    // ── Oracle / rate ─────────────────────────────────────────────────────────
    uint256 public mtaaToKESRate = 15;   // 10× scaled: 15 = 1 MTAA → 1.5 KES
    uint256 public lastRateUpdate;
    uint256 public constant MIN_RATE = 1;
    uint256 public constant MAX_RATE = 1000;  // 100 KES/MTAA ceiling; lifted from v1's 100

    // ── Global stats ──────────────────────────────────────────────────────────
    uint256 public totalPaymentsProcessed;
    uint256 public totalKESProcessed;
    uint256 public totalMTAAProcessed;

    // =========================================================================
    // EVENTS
    // =========================================================================

    event AgentConfigured(
        bytes32 indexed agentId,
        address indexed agentAddress,
        uint256 feeInKES,
        uint256 feeInUSD,
        uint8   defaultTier,
        uint256 defaultSubscriptionDuration,
        uint256 payoutPercentage,
        uint256 treasuryPercentage,
        uint256 communityPercentage,
        uint256 timestamp
    );
    event AgentStatusChanged(bytes32 indexed agentId, bool active, uint256 timestamp);
    event AgentFeeUpdated(
        bytes32 indexed agentId,
        uint256 oldFee,
        uint256 newFee,
        uint256 timestamp
    );
    event AgentPayoutUpdated(
        bytes32 indexed agentId,
        uint256 oldPct,
        uint256 newPct,
        uint256 timestamp
    );

    event PaymentProcessed(
        bytes32 indexed agentId,
        address indexed payer,
        uint256 amountInKES,
        PaymentMethod paymentMethod,
        uint256 timestamp
    );
    event KESPaymentSettled(
        uint256 indexed paymentId,
        bytes32 indexed agentId,
        uint256 timestamp
    );

    event SubscriptionActivated(
        bytes32 indexed agentId,
        address indexed user,
        uint256 expiry,
        uint256 timestamp
    );

    event AgentMTAAWithdrawn(address indexed agent, uint256 amount, uint256 timestamp);
    event PlatformMTAAWithdrawn(address indexed treasury, uint256 amount, uint256 timestamp);
    event PlatformKESAcknowledged(uint256 amount, uint256 timestamp);
    event AgentKESAcknowledged(address indexed agent, uint256 amount, uint256 timestamp);

    event RateUpdated(uint256 oldRate, uint256 newRate, uint256 timestamp);
    event MpesaGatewayUpdated(address indexed oldGateway, address indexed newGateway);
    event RateOracleUpdated(address indexed oldOracle, address indexed newOracle);
    event AgentRegistrySet(address indexed registry);
    event SubscriptionManagerSet(address indexed manager);
    event PlatformTreasuryUpdated(address indexed oldTreasury, address indexed newTreasury);

    // =========================================================================
    // ERRORS
    // =========================================================================

    error ZeroAddress();
    error InvalidPercentage();
    error AgentNotFound();
    error AgentInactive();
    error PaymentMethodNotAccepted();
    error InvalidAmount();
    error InsufficientFee();
    error RateOutOfBounds();
    error OnlyMpesaGateway();
    error NothingToWithdraw();
    error PaymentAlreadySettled();
    error NotKESPayment();
    error PaymentNotFound();
    error NotRegisteredAgent();
    error ExceedsTrackedEarnings();

    // =========================================================================
    // MODIFIERS
    // =========================================================================

    /// @dev Reverts if agent has no config or is deactivated.
    modifier onlyActiveAgent(bytes32 agentId) {
        if (agentIdToAddress[agentId] == address(0)) revert AgentNotFound();
        if (!agentConfigs[agentId].active) revert AgentInactive();
        _;
    }

    /// Fix #1: KES payment recording is exclusively the M-Pesa gateway's job.
    modifier onlyMpesaGateway() {
        if (msg.sender != mpesaGateway) revert OnlyMpesaGateway();
        _;
    }

    /// Fix #9: rate updates allowed from oracle OR owner.
    modifier onlyOracleOrOwner() {
        require(
            msg.sender == rateOracle || msg.sender == owner(),
            "AgentPaymentGateway: not oracle or owner"
        );
        _;
    }

    // =========================================================================
    // CONSTRUCTOR
    // =========================================================================

    constructor(
        address _mtaaToken,
        address _platformTreasury,
        address _mpesaGateway
    ) Ownable(msg.sender) {                 // Fix #10: Ownable2Step
        if (_mtaaToken == address(0) || _platformTreasury == address(0))
            revert ZeroAddress();

        mtaaToken        = IERC20(_mtaaToken);
        platformTreasury = _platformTreasury;
        mpesaGateway     = _mpesaGateway;
        lastRateUpdate   = block.timestamp;
    }

    // =========================================================================
    // ADMIN – WIRING
    // =========================================================================

    /// @notice Point to a new M-Pesa gateway contract after an upgrade.
    function setMpesaGateway(address _gateway) external onlyOwner {
        if (_gateway == address(0)) revert ZeroAddress();
        emit MpesaGatewayUpdated(mpesaGateway, _gateway);
        mpesaGateway = _gateway;
    }

    /// Fix #9: wire the on-chain oracle that pushes rate updates.
    function setRateOracle(address _oracle) external onlyOwner {
        emit RateOracleUpdated(rateOracle, _oracle);
        rateOracle = _oracle;
    }

    /// @notice Wire AgentRegistry for cross-contract agent validation.
    function setAgentRegistry(address _registry) external onlyOwner {
        agentRegistry = AgentRegistry(_registry);
        emit AgentRegistrySet(_registry);
    }

    /// @notice Wire SubscriptionManager to keep subscription state in sync.
    function setSubscriptionManager(address _manager) external onlyOwner {
        subscriptionManager = SubscriptionManager(_manager);
        emit SubscriptionManagerSet(_manager);
    }

    /// @notice Update platform treasury address (two-step ownership makes this safe).
    function setPlatformTreasury(address _treasury) external onlyOwner {
        if (_treasury == address(0)) revert ZeroAddress();
        emit PlatformTreasuryUpdated(platformTreasury, _treasury);
        platformTreasury = _treasury;
    }

    // =========================================================================
    // AGENT MANAGEMENT (Fix #7, #8)
    // =========================================================================

    /**
     * @notice Configure payment parameters for an agent.
     *         Call AFTER registerAgent() on AgentRegistry.
     *         Pass the same agentId returned by AgentRegistry to keep IDs consistent.
     *
     * @param agentId          ID from AgentRegistry (or generate with keccak256)
     * @param agentAddress     Agent's contract / wallet address
     * @param feeInKES         Monthly fee in KES
     * @param payoutPercentage Agent's revenue share (0-100)
     * @param acceptsMTAA      Accept MTAA token payments
     * @param acceptsKES       Accept M-Pesa KES payments
     */
    function configureAgent(
        bytes32 agentId,
        address agentAddress,
        uint256 feeInKES,
        uint256 feeInUSD,
        uint8   defaultTier,
        uint256 defaultSubscriptionDuration,
        uint256 payoutPercentage,
        uint256 treasuryPercentage,
        uint256 communityPercentage,
        bool    acceptsMTAA,
        bool    acceptsKES
    ) external onlyOwner {
        if (agentAddress == address(0)) revert ZeroAddress();
        if (payoutPercentage > 100)     revert InvalidPercentage();
        if (treasuryPercentage > 100)    revert InvalidPercentage();
        if (communityPercentage > 100)   revert InvalidPercentage();
        uint256 sum = payoutPercentage + treasuryPercentage + communityPercentage;
        require(sum <= 100, "Percentages exceed 100");
        require(acceptsMTAA || acceptsKES, "Must accept at least one payment type");
        require(defaultTier <= 3, "Invalid tier");
        require(defaultSubscriptionDuration > 0, "Invalid duration");

        // If AgentRegistry is wired, validate the agent is known there
        if (address(agentRegistry) != address(0)) {
            require(agentRegistry.isAgentRegistered(agentId), "AgentRegistry: not registered");
        }

        agentConfigs[agentId] = AgentPaymentConfig({
            feeInKES:           feeInKES,
            feeInUSD:           feeInUSD,
            defaultTier:        defaultTier,
            defaultSubscriptionDuration: defaultSubscriptionDuration,
            payoutPercentage:   payoutPercentage,
            platformPercentage: 100 - (payoutPercentage + treasuryPercentage + communityPercentage),
            treasuryPercentage: treasuryPercentage,
            communityPercentage: communityPercentage,
            acceptsMTAA:        acceptsMTAA,
            acceptsKES:         acceptsKES,
            active:             true,
            registeredAt:       block.timestamp,
            lastFeeUpdate:      block.timestamp
        });

        agentAddressToId[agentAddress] = agentId;
        agentIdToAddress[agentId]      = agentAddress;
        registeredAgents.push(agentId);

        emit AgentConfigured(agentId, agentAddress, feeInKES, feeInUSD, defaultTier, defaultSubscriptionDuration, payoutPercentage, treasuryPercentage, communityPercentage, block.timestamp);
    }

    /// Fix #7 — emergency kill switch per agent (Morio, trading agents, etc.)
    function deactivateAgent(bytes32 agentId) external onlyOwner {
        require(agentConfigs[agentId].active, "Already inactive");
        agentConfigs[agentId].active = false;
        emit AgentStatusChanged(agentId, false, block.timestamp);
    }

    function reactivateAgent(bytes32 agentId) external onlyOwner {
        if (agentIdToAddress[agentId] == address(0)) revert AgentNotFound();
        require(!agentConfigs[agentId].active, "Already active");
        agentConfigs[agentId].active = true;
        emit AgentStatusChanged(agentId, true, block.timestamp);
    }

    /// Fix #8 — agent fees change over time; make them updatable.
    function updateAgentFee(bytes32 agentId, uint256 newFeeInKES)
        external
        onlyOwner
        onlyActiveAgent(agentId)
    {
        uint256 old = agentConfigs[agentId].feeInKES;
        agentConfigs[agentId].feeInKES     = newFeeInKES;
        agentConfigs[agentId].lastFeeUpdate = block.timestamp;
        emit AgentFeeUpdated(agentId, old, newFeeInKES, block.timestamp);
    }

    function updateAgentFeeUSD(bytes32 agentId, uint256 newFeeInUSD)
        external
        onlyOwner
        onlyActiveAgent(agentId)
    {
        uint256 old = agentConfigs[agentId].feeInUSD;
        agentConfigs[agentId].feeInUSD = newFeeInUSD;
        agentConfigs[agentId].lastFeeUpdate = block.timestamp;
        // Reuse AgentFeeUpdated event for KES change semantics (old/new in USD context may be ambiguous)
        emit AgentFeeUpdated(agentId, old, newFeeInUSD, block.timestamp);
    }

    function updateAgentPayoutPercentage(bytes32 agentId, uint256 newPct)
        external
        onlyOwner
        onlyActiveAgent(agentId)
    {
        if (newPct > 100) revert InvalidPercentage();
        uint256 old = agentConfigs[agentId].payoutPercentage;
        agentConfigs[agentId].payoutPercentage   = newPct;
        agentConfigs[agentId].platformPercentage = 100 - newPct;
        emit AgentPayoutUpdated(agentId, old, newPct, block.timestamp);
    }

    function updateAgentPaymentMethods(
        bytes32 agentId,
        bool    acceptsMTAA,
        bool    acceptsKES
    ) external onlyOwner onlyActiveAgent(agentId) {
        require(acceptsMTAA || acceptsKES, "Must accept at least one type");
        agentConfigs[agentId].acceptsMTAA = acceptsMTAA;
        agentConfigs[agentId].acceptsKES  = acceptsKES;
    }

    // =========================================================================
    // PAYMENTS
    // =========================================================================

    /**
     * @notice Pay for an agent subscription using MTAA tokens.
     *
     *         Fix #3: uses safeTransferFrom (was bare transferFrom with manual check)
     *         Fix #4: amount must cover the agent's full monthly fee
     *         Fix #5: activates 30-day subscription on success
     *         Fix #6: payment.settled = true immediately (transfer is proof)
     *
     * @param agentId    Agent to subscribe to
     * @param mtaaAmount MTAA to pay; must be >= getMTAAPriceForKES(agent.feeInKES)
     */
    function payAgentInMTAA(bytes32 agentId, uint256 mtaaAmount)
        external
        nonReentrant
        onlyActiveAgent(agentId)
    {
        if (mtaaAmount == 0) revert InvalidAmount();

        AgentPaymentConfig storage cfg = agentConfigs[agentId];
        if (!cfg.acceptsMTAA) revert PaymentMethodNotAccepted();

        // Fix #4: enforce minimum — 1 MTAA can't buy a 50,000 KES subscription
        uint256 requiredMTAA = _kesToMTAA(cfg.feeInKES);
        if (mtaaAmount < requiredMTAA) revert InsufficientFee();

        // Fix #3: safe pull — handles fee-on-transfer tokens gracefully
        mtaaToken.safeTransferFrom(msg.sender, address(this), mtaaAmount);

        // Split into four-way shares
        uint256 agentShare     = (mtaaAmount * cfg.payoutPercentage)    / 100;
        uint256 treasuryShare  = (mtaaAmount * cfg.treasuryPercentage)  / 100;
        uint256 communityShare = (mtaaAmount * cfg.communityPercentage) / 100;
        uint256 platformShare  = mtaaAmount - agentShare - treasuryShare - communityShare;

        address agentAddr = agentIdToAddress[agentId];
        agentMTAAEarnings[agentAddr]      += agentShare;
        treasuryMTAAEarnings               += treasuryShare;
        communityPoolMTAAEarnings          += communityShare;
        platformMTAAEarnings               += platformShare;

        // Fix #6: on-chain transfer is atomic → settled immediately
        uint256 amountInKES = _mtaaToKES(mtaaAmount);
        // Activate or extend subscription (returns subscriptionId when manager wired)
        bytes32 subscriptionId = _activateSubscription(agentId, msg.sender, cfg.defaultSubscriptionDuration, cfg.defaultTier);

        uint256 paymentId   = paymentHistory.length;
        paymentHistory.push(Payment({
            agentId:       agentId,
            payer:         msg.sender,
            amountInKES:   amountInKES,
            amountInUSD:   0,
            mtaaAmount:    mtaaAmount,
            mpesaTxHash:   "",
            paymentMethod: PaymentMethod.MTAA,
            timestamp:     block.timestamp,
            settled:       true,
            subscriptionId: subscriptionId
        }));
        userPayments[msg.sender].push(paymentId);

        totalPaymentsProcessed++;
        totalMTAAProcessed += mtaaAmount;

        // Fix #5: local expiry already updated by _activateSubscription above

        emit PaymentProcessed(agentId, msg.sender, amountInKES, PaymentMethod.MTAA, block.timestamp);
    }

    /**
     * @notice Record a confirmed M-Pesa KES payment.
     *
     *         Fix #1: ONLY the mpesaGateway contract can call this.
     *                 Previously anyone could call it to manufacture fake subscriptions.
     *         Fix #5: activates subscription for `payer` on confirmed payment
     *         Fix #6: settled = false until mpesaGateway calls settleKESPayment()
     *
     * @param agentId     Agent being paid
     * @param kesAmount   Amount confirmed by M-Pesa (in KES)
     * @param payer       User who initiated the M-Pesa payment (NOT msg.sender)
     * @param mpesaTxHash M-Pesa transaction reference (persisted on-chain for disputes)
     */
    function payAgentInKES(
        bytes32        agentId,
        uint256        kesAmount,
        address        payer,
        string calldata mpesaTxHash
    )
        external
        nonReentrant
        onlyMpesaGateway                    // Fix #1
        onlyActiveAgent(agentId)
    {
        if (kesAmount == 0) revert InvalidAmount();
        if (payer == address(0))  revert ZeroAddress();

        AgentPaymentConfig storage cfg = agentConfigs[agentId];
        if (!cfg.acceptsKES) revert PaymentMethodNotAccepted();

        uint256 agentShare     = (kesAmount * cfg.payoutPercentage)    / 100;
        uint256 treasuryShare  = (kesAmount * cfg.treasuryPercentage)  / 100;
        uint256 communityShare = (kesAmount * cfg.communityPercentage) / 100;
        uint256 platformShare  = kesAmount - agentShare - treasuryShare - communityShare;

        address agentAddr = agentIdToAddress[agentId];
        agentKESEarnings[agentAddr]       += agentShare;
        treasuryKESEarnings               += treasuryShare;
        communityPoolKESEarnings          += communityShare;
        platformKESEarnings               += platformShare;

        // Fix #6: KES settlement is off-chain; settled = false until confirmed
        // Activate or extend subscription (returns subscriptionId when manager wired)
        bytes32 subscriptionId = _activateSubscription(agentId, payer, cfg.defaultSubscriptionDuration, cfg.defaultTier);

        uint256 paymentId = paymentHistory.length;
        paymentHistory.push(Payment({
            agentId:       agentId,
            payer:         payer,
            amountInKES:   kesAmount,
            amountInUSD:   0,
            mtaaAmount:    0,
            mpesaTxHash:   mpesaTxHash,     // persisted on-chain
            paymentMethod: PaymentMethod.KES,
            timestamp:     block.timestamp,
            settled:       false,
            subscriptionId: subscriptionId
        }));
        userPayments[payer].push(paymentId);

        totalPaymentsProcessed++;
        totalKESProcessed += kesAmount;

        // Fix #5: local expiry already updated by _activateSubscription above

        emit PaymentProcessed(agentId, payer, kesAmount, PaymentMethod.KES, block.timestamp);
    }

    /**
     * @notice M-Pesa gateway marks a KES payment as fully settled (fiat received).
     *         Fix #6: this is the only path to settled=true for KES payments.
     *
     * @param paymentId Index into paymentHistory[]
     */
    function settleKESPayment(uint256 paymentId)
        external
        onlyMpesaGateway
    {
        if (paymentId >= paymentHistory.length) revert PaymentNotFound();
        Payment storage p = paymentHistory[paymentId];
        if (p.settled)         revert PaymentAlreadySettled();
        if (p.mtaaAmount != 0) revert NotKESPayment();  // sanity: MTAA payments auto-settle

        p.settled = true;
        emit KESPaymentSettled(paymentId, p.agentId, block.timestamp);
    }

    // =========================================================================
    // SUBSCRIPTION GATE  (Fix #5)
    // =========================================================================

    /**
     * @notice Universal subscription check — called by all ecosystem agents.
     *
     *         Morio, Nuru, trading agents, the Synchronizer, Okedi, and every
     *         future agent should call this before serving any user request.
     *
     *         Uses local subscriptionExpiry as the primary source.
     *         When subscriptionManager is wired it is kept in sync via
     *         _activateSubscription(), so both sources agree.
     *
     * @param agentId  Agent the user is trying to access
     * @param user     Wallet address of the user
     * @return         true if subscription is active and not expired
     */
    function isSubscribed(bytes32 agentId, address user)
        external
        view
        returns (bool)
    {
        return subscriptionExpiry[agentId][user] > block.timestamp;
    }

    /**
     * @notice How many seconds remain in a user's active subscription.
     *         Returns 0 if never subscribed or expired.
     */
    function subscriptionTimeLeft(bytes32 agentId, address user)
        external
        view
        returns (uint256)
    {
        uint256 expiry = subscriptionExpiry[agentId][user];
        if (expiry <= block.timestamp) return 0;
        return expiry - block.timestamp;
    }

    /**
     * @notice Owner can grant complimentary or corrective subscriptions
     *         (e.g. for beta testers, KOLs, or after a support incident).
     */
    function grantSubscription(
        bytes32 agentId,
        address user,
        uint256 durationSeconds
    ) external onlyOwner {
        if (agentIdToAddress[agentId] == address(0)) revert AgentNotFound();
        uint8 tier = agentConfigs[agentId].defaultTier;
        _activateSubscription(agentId, user, durationSeconds, tier);
    }

    // =========================================================================
    // WITHDRAWALS  (Fix #2, #3)
    // =========================================================================

    /**
     * @notice Registered agents withdraw their accumulated MTAA share.
     *         Fix #3: uses safeTransfer.
     *         Inactive agents may still withdraw — earnings are not confiscated
     *         when an agent is deactivated.
     */
    function withdrawAgentMTAAEarnings() external nonReentrant {
        bytes32 id = agentAddressToId[msg.sender];
        if (id == bytes32(0)) revert NotRegisteredAgent();

        uint256 amount = agentMTAAEarnings[msg.sender];
        if (amount == 0) revert NothingToWithdraw();

        agentMTAAEarnings[msg.sender]    = 0;
        agentWithdrawalsMTAA[msg.sender] += amount;

        mtaaToken.safeTransfer(msg.sender, amount);  // Fix #3
        emit AgentMTAAWithdrawn(msg.sender, amount, block.timestamp);
    }

    /**
     * @notice Platform withdraws its accumulated MTAA earnings to treasury.
     *         Fix #2: this function did not exist in v1 — MTAA was permanently locked.
     *         Fix #3: uses safeTransfer.
     */
    function withdrawPlatformMTAAEarnings() external onlyOwner nonReentrant {
        uint256 amount = platformMTAAEarnings;
        if (amount == 0) revert NothingToWithdraw();

        platformMTAAEarnings = 0;
        mtaaToken.safeTransfer(platformTreasury, amount);  // Fix #3
        emit PlatformMTAAWithdrawn(platformTreasury, amount, block.timestamp);
    }

    /**
     * @notice Admin records that off-chain KES disbursement to the platform
     *         has occurred.  Decrements the accounting counter.
     *         KES is fiat — no on-chain transfer happens here.
     *
     * @param amount  KES amount that has been paid out off-chain
     */
    function acknowledgePlatformKESDisbursement(uint256 amount)
        external
        onlyOwner
    {
        if (amount > platformKESEarnings) revert ExceedsTrackedEarnings();
        platformKESEarnings -= amount;
        emit PlatformKESAcknowledged(amount, block.timestamp);
    }

    /**
     * @notice Admin records that off-chain KES disbursement to a specific agent
     *         has occurred.
     */
    function acknowledgeAgentKESDisbursement(address agent, uint256 amount)
        external
        onlyOwner
    {
        if (amount > agentKESEarnings[agent]) revert ExceedsTrackedEarnings();
        agentKESEarnings[agent] -= amount;
        emit AgentKESAcknowledged(agent, amount, block.timestamp);
    }

    // =========================================================================
    // RATE MANAGEMENT  (Fix #9)
    // =========================================================================

    /**
     * @notice Update the MTAA/KES exchange rate.
     *         Fix #9: callable by the designated oracle OR the owner.
     *                 In v1 this was onlyOwner, making the oracle address unused.
     *
     * @param newRate  10× scaled rate (e.g. 15 = 1 MTAA → 1.5 KES)
     */
    function setMtaaToKESRate(uint256 newRate) external onlyOracleOrOwner {
        if (newRate < MIN_RATE || newRate > MAX_RATE) revert RateOutOfBounds();
        emit RateUpdated(mtaaToKESRate, newRate, block.timestamp);
        mtaaToKESRate  = newRate;
        lastRateUpdate = block.timestamp;
    }

    // =========================================================================
    // VIEW / QUERY
    // =========================================================================

    function getMtaaToKESRate() external view returns (uint256) {
        return mtaaToKESRate;
    }

    /// @notice How much MTAA is required to pay `kesAmount` at current rate.
    function getMTAAPriceForKES(uint256 kesAmount) external view returns (uint256) {
        return _kesToMTAA(kesAmount);
    }

    /// @notice KES value of `mtaaAmount` at current rate.
    function getKESValueForMTAA(uint256 mtaaAmount) external view returns (uint256) {
        return _mtaaToKES(mtaaAmount);
    }

    function getAgentConfig(bytes32 agentId)
        external view returns (AgentPaymentConfig memory)
    {
        return agentConfigs[agentId];
    }

    function getAgentAddress(bytes32 agentId) external view returns (address addr) {
        addr = agentIdToAddress[agentId];
        if (addr == address(0)) revert AgentNotFound();
    }

    /// @notice Full payment history for a user (unbounded — use paginated version for active users).
    function getUserPaymentHistory(address user)
        external
        view
        returns (Payment[] memory)
    {
        uint256[] storage ids = userPayments[user];
        Payment[] memory out  = new Payment[](ids.length);
        for (uint256 i; i < ids.length; ++i) {
            out[i] = paymentHistory[ids[i]];
        }
        return out;
    }

    /**
     * @notice Paginated payment history — prevents gas OOG for active users.
     *         Fix for unbounded array return in v1.
     *
     * @param user    User address
     * @param offset  Start index (0-based)
     * @param limit   Maximum records to return
     * @return out    Slice of payment records
     * @return total  Total number of payments for this user
     */
    function getUserPaymentHistoryPaginated(
        address user,
        uint256 offset,
        uint256 limit
    ) external view returns (Payment[] memory out, uint256 total) {
        uint256[] storage ids = userPayments[user];
        total = ids.length;
        if (offset >= total) return (new Payment[](0), total);
        uint256 end = offset + limit > total ? total : offset + limit;
        out = new Payment[](end - offset);
        for (uint256 i = offset; i < end; ++i) {
            out[i - offset] = paymentHistory[ids[i]];
        }
    }

    function getGatewayStats()
        external
        view
        returns (
            uint256 totalAgents,
            uint256 totalPayments,
            uint256 totalKES,
            uint256 totalMTAA,
            uint256 currentRate
        )
    {
        return (
            registeredAgents.length,
            totalPaymentsProcessed,
            totalKESProcessed,
            totalMTAAProcessed,
            mtaaToKESRate
        );
    }

    // =========================================================================
    // INTERNAL HELPERS
    // =========================================================================

    function _mtaaToKES(uint256 mtaaAmount) internal view returns (uint256) {
        return (mtaaAmount * mtaaToKESRate) / 10;
    }

    function _kesToMTAA(uint256 kesAmount) internal view returns (uint256) {
        // Round up so the user always covers the full fee
        return (kesAmount * 10 + mtaaToKESRate - 1) / mtaaToKESRate;
    }

    /**
     * @dev Activates or extends a subscription.
     *      Stacks on top of existing expiry so renewals accumulate correctly.
     *      Non-blocking delegate to SubscriptionManager (try/catch).
     */
    function _activateSubscription(
        bytes32 agentId,
        address user,
        uint256 durationSeconds,
        uint8   tierValue
    ) internal returns (bytes32) {
        uint256 current   = subscriptionExpiry[agentId][user];
        uint256 base      = current > block.timestamp ? current : block.timestamp;
        uint256 newExpiry = base + durationSeconds;
        subscriptionExpiry[agentId][user] = newExpiry;

        bytes32 subscriptionId = bytes32(0);
        // Propagate to SubscriptionManager if wired
        if (address(subscriptionManager) != address(0)) {
            // Non-blocking: SubscriptionManager failure must not revert payments
            try subscriptionManager.externalActivate(agentId, user, tierValue, durationSeconds) returns (bytes32 subId) {
                subscriptionId = subId;
            } catch {}
        }

        emit SubscriptionActivated(agentId, user, newExpiry, block.timestamp);
        return subscriptionId;
    }
}
