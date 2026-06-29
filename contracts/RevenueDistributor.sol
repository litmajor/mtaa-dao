// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable2Step.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import "./AgentPaymentGateway.sol";  // For PaymentMethod enum
import "./AgentIds.sol";

/**
 * @title  RevenueDistributor
 * @author MtaaDAO
 * @notice Centralized 4-way revenue split hub.
 *         AgentPaymentGateway delegates split calculations to this contract.
 *
 *         Four-way split per payment:
 *         - Agent:      payout percentage
 *         - Platform:   operational costs
 *         - Treasury:   DAO treasury accumulation
 *         - Community:  community pool / rewards
 *
 *         This contract tracks earnings per category (MTAA/KES),
 *         provides withdrawal APIs, and emits audit events.
 */
contract RevenueDistributor is Ownable2Step {
    using SafeERC20 for IERC20;

    // =========================================================================
    // TYPES & ENUMS
    // =========================================================================

    enum PaymentMethod { MTAA, KES }

    struct SplitConfig {
        uint256 agentPercentage;     // Agent payout (0-100)
        uint256 platformPercentage;  // Platform fee (0-100)
        uint256 treasuryPercentage;  // Treasury accumulation (0-100)
        uint256 communityPercentage; // Community pool (0-100)
        // Sum must be 100 or less; remainder goes to community pool
    }

    struct Distribution {
        uint256 agentAmount;
        uint256 platformAmount;
        uint256 treasuryAmount;
        uint256 communityAmount;
    }

    // =========================================================================
    // STATE
    // =========================================================================

    IERC20  public immutable mtaaToken;
    address public paymentGateway;          // Only AgentPaymentGateway can record distributions
    address public platformTreasury;        // Recipient for platform fees
    address public daoTreasury;             // Recipient for treasury share
    address public communityPoolManager;    // Recipient for community pool (can be a contract)

    // Split configuration per agent (customizable)
    mapping(bytes32 agentId => SplitConfig) public agentSplitConfigs;

    // Earnings ledger (MTAA)
    mapping(address => uint256) public agentMTAAEarnings;
    uint256 public platformMTAAEarnings;
    uint256 public treasuryMTAAEarnings;
    uint256 public communityPoolMTAAEarnings;

    // Earnings ledger (KES — off-chain fiat accounting)
    mapping(address => uint256) public agentKESEarnings;
    uint256 public platformKESEarnings;
    uint256 public treasuryKESEarnings;
    uint256 public communityPoolKESEarnings;

    // Withdrawal history
    mapping(address => uint256) public agentWithdrawalsMTAA;
    mapping(address => uint256) public agentWithdrawalsKES;

    // =========================================================================
    // EVENTS
    // =========================================================================

    event RevenueDistributed(
        bytes32 indexed agentId,
        address indexed payer,
        uint256 totalAmount,
        PaymentMethod method,
        uint256 agentShare,
        uint256 platformShare,
        uint256 treasuryShare,
        uint256 communityShare,
        uint256 timestamp
    );

    event SplitConfigUpdated(
        bytes32 indexed agentId,
        uint256 agentPct,
        uint256 platformPct,
        uint256 treasuryPct,
        uint256 communityPct,
        uint256 timestamp
    );

    event AgentMTAAWithdrawn(address indexed agent, uint256 amount, uint256 timestamp);
    event PlatformMTAAWithdrawn(address indexed treasury, uint256 amount, uint256 timestamp);
    event TreasuryMTAAWithdrawn(address indexed treasury, uint256 amount, uint256 timestamp);
    event CommunityPoolMTAAWithdrawn(address indexed manager, uint256 amount, uint256 timestamp);

    event AgentKESAcknowledged(address indexed agent, uint256 amount, uint256 timestamp);
    event PlatformKESAcknowledged(uint256 amount, uint256 timestamp);
    event TreasuryKESAcknowledged(uint256 amount, uint256 timestamp);
    event CommunityPoolKESAcknowledged(uint256 amount, uint256 timestamp);

    event PaymentGatewaySet(address indexed gateway);
    event PlatformTreasuryUpdated(address indexed oldTreasury, address indexed newTreasury);
    event DAOTreasuryUpdated(address indexed oldTreasury, address indexed newTreasury);
    event CommunityPoolManagerUpdated(address indexed oldManager, address indexed newManager);

    // =========================================================================
    // ERRORS
    // =========================================================================

    error ZeroAddress();
    error InvalidPercentage();
    error PercentageSumTooHigh();
    error OnlyPaymentGateway();
    error NothingToWithdraw();

    // =========================================================================
    // MODIFIERS
    // =========================================================================

    modifier onlyPaymentGateway() {
        if (msg.sender != paymentGateway) revert OnlyPaymentGateway();
        _;
    }

    // =========================================================================
    // CONSTRUCTOR
    // =========================================================================

    constructor(
        address _mtaaToken,
        address _platformTreasury,
        address _daoTreasury,
        address _communityPoolManager
    ) Ownable(msg.sender) {
        if (_mtaaToken == address(0) || _platformTreasury == address(0) ||
            _daoTreasury == address(0) || _communityPoolManager == address(0)) {
            revert ZeroAddress();
        }

        mtaaToken = IERC20(_mtaaToken);
        platformTreasury = _platformTreasury;
        daoTreasury = _daoTreasury;
        communityPoolManager = _communityPoolManager;
    }

    // =========================================================================
    // SETUP & CONFIGURATION
    // =========================================================================

    /**
     * @notice Set the payment gateway address (only gateway can call distributeMTAA/distributeKES)
     */
    function setPaymentGateway(address _gateway) external onlyOwner {
        if (_gateway == address(0)) revert ZeroAddress();
        paymentGateway = _gateway;
        emit PaymentGatewaySet(_gateway);
    }

    /**
     * @notice Update treasury recipients
     */
    function setPlatformTreasury(address _treasury) external onlyOwner {
        if (_treasury == address(0)) revert ZeroAddress();
        address oldTreasury = platformTreasury;
        platformTreasury = _treasury;
        emit PlatformTreasuryUpdated(oldTreasury, _treasury);
    }

    function setDAOTreasury(address _treasury) external onlyOwner {
        if (_treasury == address(0)) revert ZeroAddress();
        address oldTreasury = daoTreasury;
        daoTreasury = _treasury;
        emit DAOTreasuryUpdated(oldTreasury, _treasury);
    }

    function setCommunityPoolManager(address _manager) external onlyOwner {
        if (_manager == address(0)) revert ZeroAddress();
        address oldManager = communityPoolManager;
        communityPoolManager = _manager;
        emit CommunityPoolManagerUpdated(oldManager, _manager);
    }

    /**
     * @notice Configure the 4-way split for an agent
     * @param agentId Agent to configure
     * @param agentPct Agent's take (0-100)
     * @param platformPct Platform's take (0-100)
     * @param treasuryPct Treasury's take (0-100)
     * @param communityPct Community pool's take (0-100)
     *
     * Sum of all must be <= 100 to allow contract to compute remainder.
     * Remainder (if any) goes to community pool.
     */
    function configureSplit(
        bytes32 agentId,
        uint256 agentPct,
        uint256 platformPct,
        uint256 treasuryPct,
        uint256 communityPct
    ) external onlyOwner {
        if (agentPct > 100 || platformPct > 100 || treasuryPct > 100 || communityPct > 100) {
            revert InvalidPercentage();
        }
        uint256 sum = agentPct + platformPct + treasuryPct + communityPct;
        if (sum > 100) revert PercentageSumTooHigh();

        agentSplitConfigs[agentId] = SplitConfig({
            agentPercentage: agentPct,
            platformPercentage: platformPct,
            treasuryPercentage: treasuryPct,
            communityPercentage: communityPct
        });

        emit SplitConfigUpdated(agentId, agentPct, platformPct, treasuryPct, communityPct, block.timestamp);
    }

    // =========================================================================
    // DISTRIBUTION ENTRY POINTS (called by AgentPaymentGateway)
    // =========================================================================

    /**
     * @notice Record and execute a 4-way MTAA revenue split
     * @param agentId Agent being paid
     * @param agentAddress Agent's wallet address (where agent share goes)
     * @param totalAmount Total amount to split
     * @param payer User who made the payment
     *
     * Computes shares based on agentSplitConfigs[agentId], updates ledgers, returns Distribution.
     */
    function distributeMTAA(
        bytes32 agentId,
        address agentAddress,
        uint256 totalAmount,
        address payer
    ) external onlyPaymentGateway returns (Distribution memory dist) {
        SplitConfig memory cfg = agentSplitConfigs[agentId];

        dist.agentAmount     = (totalAmount * cfg.agentPercentage)     / 100;
        dist.platformAmount  = (totalAmount * cfg.platformPercentage)  / 100;
        dist.treasuryAmount  = (totalAmount * cfg.treasuryPercentage)  / 100;
        dist.communityAmount = (totalAmount * cfg.communityPercentage) / 100;

        // Compute remainder and add to community pool
        uint256 allocated = dist.agentAmount + dist.platformAmount + dist.treasuryAmount + dist.communityAmount;
        if (allocated < totalAmount) {
            dist.communityAmount += (totalAmount - allocated);
        }

        // Update ledgers
        agentMTAAEarnings[agentAddress]    += dist.agentAmount;
        platformMTAAEarnings               += dist.platformAmount;
        treasuryMTAAEarnings               += dist.treasuryAmount;
        communityPoolMTAAEarnings          += dist.communityAmount;

        emit RevenueDistributed(
            agentId, payer, totalAmount, PaymentMethod.MTAA,
            dist.agentAmount, dist.platformAmount, dist.treasuryAmount, dist.communityAmount,
            block.timestamp
        );

        return dist;
    }

    /**
     * @notice Record a 4-way KES revenue split (off-chain fiat)
     * Ledger updates only (no token transfer; KES is off-chain).
     */
    function distributeKES(
        bytes32 agentId,
        address agentAddress,
        uint256 totalAmount,
        address payer
    ) external onlyPaymentGateway returns (Distribution memory dist) {
        SplitConfig memory cfg = agentSplitConfigs[agentId];

        dist.agentAmount     = (totalAmount * cfg.agentPercentage)     / 100;
        dist.platformAmount  = (totalAmount * cfg.platformPercentage)  / 100;
        dist.treasuryAmount  = (totalAmount * cfg.treasuryPercentage)  / 100;
        dist.communityAmount = (totalAmount * cfg.communityPercentage) / 100;

        // Compute remainder and add to community pool
        uint256 allocated = dist.agentAmount + dist.platformAmount + dist.treasuryAmount + dist.communityAmount;
        if (allocated < totalAmount) {
            dist.communityAmount += (totalAmount - allocated);
        }

        // Update ledgers (no on-chain token transfer for KES)
        agentKESEarnings[agentAddress]    += dist.agentAmount;
        platformKESEarnings               += dist.platformAmount;
        treasuryKESEarnings               += dist.treasuryAmount;
        communityPoolKESEarnings          += dist.communityAmount;

        emit RevenueDistributed(
            agentId, payer, totalAmount, PaymentMethod.KES,
            dist.agentAmount, dist.platformAmount, dist.treasuryAmount, dist.communityAmount,
            block.timestamp
        );

        return dist;
    }

    // =========================================================================
    // WITHDRAWALS (MTAA only; KES is off-chain accounting)
    // =========================================================================

    /**
     * @notice Agent withdraws accumulated MTAA earnings
     */
    function withdrawAgentMTAA() external {
        uint256 amount = agentMTAAEarnings[msg.sender];
        if (amount == 0) revert NothingToWithdraw();

        agentMTAAEarnings[msg.sender] = 0;
        agentWithdrawalsMTAA[msg.sender] += amount;

        mtaaToken.safeTransfer(msg.sender, amount);
        emit AgentMTAAWithdrawn(msg.sender, amount, block.timestamp);
    }

    /**
     * @notice Owner withdraws platform MTAA earnings
     */
    function withdrawPlatformMTAA() external onlyOwner {
        uint256 amount = platformMTAAEarnings;
        if (amount == 0) revert NothingToWithdraw();

        platformMTAAEarnings = 0;
        mtaaToken.safeTransfer(platformTreasury, amount);
        emit PlatformMTAAWithdrawn(platformTreasury, amount, block.timestamp);
    }

    /**
     * @notice Owner withdraws treasury MTAA earnings
     */
    function withdrawTreasuryMTAA() external onlyOwner {
        uint256 amount = treasuryMTAAEarnings;
        if (amount == 0) revert NothingToWithdraw();

        treasuryMTAAEarnings = 0;
        mtaaToken.safeTransfer(daoTreasury, amount);
        emit TreasuryMTAAWithdrawn(daoTreasury, amount, block.timestamp);
    }

    /**
     * @notice Owner withdraws community pool MTAA earnings
     */
    function withdrawCommunityPoolMTAA() external onlyOwner {
        uint256 amount = communityPoolMTAAEarnings;
        if (amount == 0) revert NothingToWithdraw();

        communityPoolMTAAEarnings = 0;
        mtaaToken.safeTransfer(communityPoolManager, amount);
        emit CommunityPoolMTAAWithdrawn(communityPoolManager, amount, block.timestamp);
    }

    // =========================================================================
    // OFF-CHAIN KES ACCOUNTING (emit events for reconciliation)
    // =========================================================================

    /**
     * @notice Owner marks KES earnings as "known" for off-chain settlement
     */
    function acknowledgeAgentKES(address agent, uint256 amount) external onlyOwner {
        emit AgentKESAcknowledged(agent, amount, block.timestamp);
    }

    function acknowledgePlatformKES(uint256 amount) external onlyOwner {
        emit PlatformKESAcknowledged(amount, block.timestamp);
    }

    function acknowledgeTreasuryKES(uint256 amount) external onlyOwner {
        emit TreasuryKESAcknowledged(amount, block.timestamp);
    }

    function acknowledgeCommunityPoolKES(uint256 amount) external onlyOwner {
        emit CommunityPoolKESAcknowledged(amount, block.timestamp);
    }

    // =========================================================================
    // VIEWS
    // =========================================================================

    /**
     * @notice Get total earnings for an agent (MTAA + KES)
     */
    function getAgentTotalEarnings(address agent)
        external
        view
        returns (uint256 mtaaAmount, uint256 kesAmount)
    {
        mtaaAmount = agentMTAAEarnings[agent];
        // Note: kesAmount is off-chain; not tracked on-chain
        kesAmount = agentKESEarnings[agent];
        return (mtaaAmount, kesAmount);
    }

    /**
     * @notice Get all earnings across all recipients
     */
    function getTotalEarnings()
        external
        view
        returns (
            uint256 totalMTAA,
            uint256 totalKES,
            uint256 platformMTAA,
            uint256 platformKES,
            uint256 treasuryMTAA,
            uint256 treasuryKES,
            uint256 communityMTAA,
            uint256 communityKES
        )
    {
        platformMTAA = platformMTAAEarnings;
        platformKES = platformKESEarnings;
        treasuryMTAA = treasuryMTAAEarnings;
        treasuryKES = treasuryKESEarnings;
        communityMTAA = communityPoolMTAAEarnings;
        communityKES = communityPoolKESEarnings;
        totalMTAA = platformMTAA + treasuryMTAA + communityMTAA;
        totalKES = platformKES + treasuryKES + communityKES;
    }

    /**
     * @notice Get split configuration for an agent
     */
    function getSplitConfig(bytes32 agentId)
        external
        view
        returns (uint256 agentPct, uint256 platformPct, uint256 treasuryPct, uint256 communityPct)
    {
        SplitConfig memory cfg = agentSplitConfigs[agentId];
        return (cfg.agentPercentage, cfg.platformPercentage, cfg.treasuryPercentage, cfg.communityPercentage);
    }
}
