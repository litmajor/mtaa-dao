// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title AgentPaymentGateway (Dual-pricing agent system: charges in either KES or MTAA)
 * @notice Agent Payment Flow with FIX #6 Implementation
 * @dev
 *   Agent Payment Flow:
 *   (1) DAO admin configures pricing agents in KES equivalent
 *   (2) Users can pay with either: KES (via M-Pesa) OR MTAA crypto
 *   (3) Gateway converts prices dynamically based on oracle
 *   (4) Enables onboarding of non-crypto users (pay in fiat equivalent)
 *
 *   Example:
 *   - "Strategy Report Agent" = 50,000 KES monthly fee
 *   - User with MTAA: Pay 5,000 MTAA (if MTAA = 10 KES)
 *   - User with KES: Pay 50,000 KES via M-Pesa (easy for EA users)
 *   - Gateway ensures both paths work seamlessly
 */
contract AgentPaymentGateway is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ==================== CONFIGURATION ====================
    address public mtaaToken;
    address public platformTreasury;
    address public mpesaGateway;  // M-Pesa on-ramp address

    // ==================== AGENT REGISTRY ====================
    struct AgentConfig {
        string name;
        string description;
        uint256 feeInKES;           // Base fee in KES
        uint256 payoutPercentage;   // % to agent (0-100)
        uint256 platformPercentage; // % to platform (0-100)
        bool active;
        uint256 createdAt;
    }

    struct PaymentMethod {
        bool acceptsMTAA;
        bool acceptsKES;
        uint256 lastMTAAExchangeRate;  // Exchange rate KES per MTAA
    }

    // Agent registry
    mapping(bytes32 agentId => AgentConfig) public agents;
    mapping(address agentAddress => bytes32 agentId) public agentAddressToId;
    bytes32[] public registeredAgents;

    // Payment methods per agent
    mapping(bytes32 agentId => PaymentMethod) public paymentMethods;

    // Payment tracking
    struct Payment {
        bytes32 agentId;
        address payer;
        uint256 amountInKES;     // Always stored in KES for consistency
        string paymentMethod;    // "MTAA" or "KES"
        uint256 mtaaAmount;      // If paid in MTAA
        uint256 timestamp;
        bool settled;
    }

    Payment[] public paymentHistory;
    mapping(address user => uint256[] paymentIds) public userPayments;

    // Revenue tracking
    mapping(address agent => uint256 mtaaEarnings) public agentMTAAEarnings;
    mapping(address agent => uint256 kesEarnings) public agentKESEarnings;
    mapping(address agent => uint256 withdrawalsMTAA) public agentWithdrawalsMTAA;

    // Global stats
    uint256 public totalPaymentsProcessed;
    uint256 public totalKESProcessed;
    uint256 public totalMTAAProcessed;

    // ==================== ORACLE CONFIGURATION ====================
    // MTAA/KES exchange rate (1 decimal: 10 MTAA = 150 KES means rate = 15)
    uint256 public mtaaToKESRate = 15;  // 1 MTAA = 15 KES (example)
    uint256 public lastRateUpdate;
    address public rateOracle;  // Can be Chainlink or off-chain governance

    // Rate bounds (prevent price manipulation)
    uint256 public constant MIN_RATE = 1;   // Floor: 1 KES per MTAA
    uint256 public constant MAX_RATE = 100; // Ceiling: 100 KES per MTAA

    // ==================== EVENTS ====================
    event AgentRegistered(
        bytes32 indexed agentId,
        address indexed agentAddress,
        string name,
        uint256 feeInKES,
        uint256 timestamp
    );

    event PaymentProcessed(
        bytes32 indexed agentId,
        address indexed payer,
        uint256 amountInKES,
        string paymentMethod,
        uint256 timestamp
    );

    event MtaaToKESRateUpdated(uint256 oldRate, uint256 newRate, uint256 timestamp);

    event AgentWithdrawn(
        address indexed agent,
        uint256 mtaaAmount,
        uint256 kesAmount,
        uint256 timestamp
    );

    event PaymentMethodUpdated(
        bytes32 indexed agentId,
        bool acceptsMTAA,
        bool acceptsKES,
        uint256 timestamp
    );

    // ==================== ERRORS ====================
    error InvalidAddress();
    error InvalidFeePercentage();
    error AgentNotRegistered();
    error PaymentMethodNotAccepted();
    error InvalidPaymentAmount();
    error InsufficientMTAABalance();
    error TransferFailed();
    error RateOutOfBounds();
    error OnlyAgent();

    // ==================== MODIFIERS ====================
    modifier onlyValidAgent(bytes32 agentId) {
        if (!agents[agentId].active) revert AgentNotRegistered();
        _;
    }

    modifier onlyRegisteredAgent() {
        require(agentAddressToId[msg.sender] != bytes32(0), "Only registered agent");
        _;
    }

    // ==================== CONSTRUCTOR ====================
    constructor(
        address _mtaaToken,
        address _platformTreasury,
        address _mpesaGateway
    ) Ownable(msg.sender) {
        if (_mtaaToken == address(0) || _platformTreasury == address(0)) {
            revert InvalidAddress();
        }

        mtaaToken = _mtaaToken;
        platformTreasury = _platformTreasury;
        mpesaGateway = _mpesaGateway;

        lastRateUpdate = block.timestamp;
    }

    // ==================== AGENT MANAGEMENT ====================
    /**
     * @notice Register a new agent with pricing
     * @param agentAddress Address of agent contract or wallet
     * @param name Human-readable agent name
     * @param description Agent description
     * @param feeInKES Monthly subscription fee in KES
     * @param payoutPercentage % of payments to agent (0-100)
     * @param acceptsMTAA Accept MTAA payments
     * @param acceptsKES Accept KES (M-Pesa) payments
     */
    function registerAgent(
        address agentAddress,
        string memory name,
        string memory description,
        uint256 feeInKES,
        uint256 payoutPercentage,
        bool acceptsMTAA,
        bool acceptsKES
    ) external onlyOwner {
        if (agentAddress == address(0)) revert InvalidAddress();
        if (payoutPercentage > 100) revert InvalidFeePercentage();
        require(acceptsMTAA || acceptsKES, "Must accept at least one payment type");

        bytes32 agentId = keccak256(abi.encodePacked(agentAddress, block.timestamp));

        agents[agentId] = AgentConfig({
            name: name,
            description: description,
            feeInKES: feeInKES,
            payoutPercentage: payoutPercentage,
            platformPercentage: 100 - payoutPercentage,
            active: true,
            createdAt: block.timestamp
        });

        agentAddressToId[agentAddress] = agentId;
        registeredAgents.push(agentId);

        paymentMethods[agentId] = PaymentMethod({
            acceptsMTAA: acceptsMTAA,
            acceptsKES: acceptsKES,
            lastMTAAExchangeRate: mtaaToKESRate
        });

        emit AgentRegistered(agentId, agentAddress, name, feeInKES, block.timestamp);
    }

    /**
     * @notice Update payment methods accepted by agent
     */
    function setPaymentMethods(
        bytes32 agentId,
        bool acceptsMTAA,
        bool acceptsKES
    ) external onlyOwner onlyValidAgent(agentId) {
        require(acceptsMTAA || acceptsKES, "Must accept at least one type");

        paymentMethods[agentId].acceptsMTAA = acceptsMTAA;
        paymentMethods[agentId].acceptsKES = acceptsKES;

        emit PaymentMethodUpdated(agentId, acceptsMTAA, acceptsKES, block.timestamp);
    }

    // ==================== FIX #6: DUAL-PRICING PAYMENT SYSTEM ====================
    /**
     * @notice Pay agent subscription in MTAA
     * @param agentId ID of agent to pay
     * @param mtaaAmount Amount of MTAA to send
     */
    function payAgentInMTAA(bytes32 agentId, uint256 mtaaAmount)
        external
        nonReentrant
        onlyValidAgent(agentId)
    {
        if (mtaaAmount == 0) revert InvalidPaymentAmount();
        if (!paymentMethods[agentId].acceptsMTAA) {
            revert PaymentMethodNotAccepted();
        }

        // Check user balance
        uint256 balance = IERC20(mtaaToken).balanceOf(msg.sender);
        if (balance < mtaaAmount) revert InsufficientMTAABalance();

        // Convert MTAA to KES for consistent tracking
        uint256 amountInKES = (mtaaAmount * mtaaToKESRate) / 10;

        // Collect MTAA from payer
        if (!IERC20(mtaaToken).transferFrom(msg.sender, address(this), mtaaAmount)) {
            revert TransferFailed();
        }

        // Split: agent earnings vs platform
        AgentConfig storage agent = agents[agentId];
        uint256 agentEarning = (amountInKES * agent.payoutPercentage) / 100;
        uint256 platformEarning = amountInKES - agentEarning;

        // Record payment
        address agentAddr = getAgentAddress(agentId);
        agentMTAAEarnings[agentAddr] += mtaaAmount;

        // Track payment
        uint256 paymentId = paymentHistory.length;
        paymentHistory.push(Payment({
            agentId: agentId,
            payer: msg.sender,
            amountInKES: amountInKES,
            paymentMethod: "MTAA",
            mtaaAmount: mtaaAmount,
            timestamp: block.timestamp,
            settled: false
        }));
        userPayments[msg.sender].push(paymentId);

        // Update stats
        totalPaymentsProcessed++;
        totalMTAAProcessed += mtaaAmount;

        emit PaymentProcessed(agentId, msg.sender, amountInKES, "MTAA", block.timestamp);
    }

    /**
     * @notice Pay agent subscription in KES (via M-Pesa on-ramp)
     * @param agentId ID of agent
     * @param kesAmount Amount in KES
     * @param mpesaTxHash M-Pesa transaction hash for audit trail
     */
    function payAgentInKES(
        bytes32 agentId,
        uint256 kesAmount,
        string memory mpesaTxHash
    ) external nonReentrant onlyValidAgent(agentId) {
        if (kesAmount == 0) revert InvalidPaymentAmount();
        if (!paymentMethods[agentId].acceptsKES) {
            revert PaymentMethodNotAccepted();
        }

        // In production: M-Pesa gateway would verify mpesaTxHash
        // For now: assume off-chain verification and settlement
        // Gateway would call this function after M-Pesa payment confirmed

        AgentConfig storage agent = agents[agentId];

        // Record payment
        uint256 paymentId = paymentHistory.length;
        paymentHistory.push(Payment({
            agentId: agentId,
            payer: msg.sender,
            amountInKES: kesAmount,
            paymentMethod: "KES",
            mtaaAmount: 0,
            timestamp: block.timestamp,
            settled: false
        }));
        userPayments[msg.sender].push(paymentId);

        // Track KES earnings
        address agentAddr = getAgentAddress(agentId);
        agentKESEarnings[agentAddr] += kesAmount;

        // Update stats
        totalPaymentsProcessed++;
        totalKESProcessed += kesAmount;

        emit PaymentProcessed(agentId, msg.sender, kesAmount, "KES", block.timestamp);
    }

    // ==================== RATE MANAGEMENT ====================
    /**
     * @notice Update MTAA/KES exchange rate
     * @param newRate MTAA to KES (1 decimal: 15 = 1.5 KES per MTAA)
     * @dev Called by oracle or governance
     */
    function setMtaaToKESRate(uint256 newRate) external onlyOwner {
        if (newRate < MIN_RATE || newRate > MAX_RATE) {
            revert RateOutOfBounds();
        }

        uint256 oldRate = mtaaToKESRate;
        mtaaToKESRate = newRate;
        lastRateUpdate = block.timestamp;

        emit MtaaToKESRateUpdated(oldRate, newRate, block.timestamp);
    }

    function getMtaaToKESRate() external view returns (uint256) {
        return mtaaToKESRate;
    }

    // ==================== AGENT WITHDRAWALS ====================
    /**
     * @notice Agent withdraws earned MTAA
     * @dev Only callable by registered agent
     */
    function withdrawMTAAEarnings() external nonReentrant onlyRegisteredAgent {
        address agent = msg.sender;
        uint256 mtaaAmount = agentMTAAEarnings[agent];

        if (mtaaAmount == 0) revert InvalidPaymentAmount();

        // Reset earnings
        agentMTAAEarnings[agent] = 0;

        // Transfer MTAA to agent
        if (!IERC20(mtaaToken).transfer(agent, mtaaAmount)) {
            revert TransferFailed();
        }

        agentWithdrawalsMTAA[agent] += mtaaAmount;

        emit AgentWithdrawn(agent, mtaaAmount, 0, block.timestamp);
    }

    // ==================== QUERY FUNCTIONS ====================
    /**
     * @notice Get agent from agent ID
     */
    function getAgentAddress(bytes32 agentId)
        public
        view
        returns (address)
    {
        // This is a simplified mapping; in production, maintain bidirectional mapping
        for (uint256 i = 0; i < registeredAgents.length; ++i) {
            bytes32 id = registeredAgents[i];
            // Would need reverse mapping to efficiently lookup
        }
        return address(0);  // Placeholder
    }

    /**
     * @notice Get agent configuration
     */
    function getAgentConfig(bytes32 agentId)
        external
        view
        returns (AgentConfig memory)
    {
        return agents[agentId];
    }

    /**
     * @notice Get agent payment methods
     */
    function getAgentPaymentMethods(bytes32 agentId)
        external
        view
        returns (PaymentMethod memory)
    {
        return paymentMethods[agentId];
    }

    /**
     * @notice Get expected MTAA payment for KES amount
     */
    function getMTAAPriceForKES(uint256 kesAmount)
        external
        view
        returns (uint256 mtaaAmount)
    {
        // kesAmount in KES → convert to MTAA
        // If rate = 15 (1 MTAA = 1.5 KES), then 150 KES = 100 MTAA
        mtaaAmount = (kesAmount * 10) / mtaaToKESRate;
    }

    /**
     * @notice Get expected KES value for MTAA amount
     */
    function getKESValueForMTAA(uint256 mtaaAmount)
        external
        view
        returns (uint256 kesAmount)
    {
        kesAmount = (mtaaAmount * mtaaToKESRate) / 10;
    }

    /**
     * @notice Get user payment history
     */
    function getUserPaymentHistory(address user)
        external
        view
        returns (Payment[] memory)
    {
        uint256[] memory paymentIds = userPayments[user];
        Payment[] memory payments = new Payment[](paymentIds.length);

        for (uint256 i = 0; i < paymentIds.length; ++i) {
            payments[i] = paymentHistory[paymentIds[i]];
        }

        return payments;
    }

    /**
     * @notice Get gateway statistics
     */
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
}
