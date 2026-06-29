// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Permit.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/* ========== INTERFACES ========== */

/**
 * @notice Mento SortedOracles interface.
 * @dev medianRate returns (uint256 median, uint256 denominator) as a Fixidity fraction.
 *      If the actual KES/USD rate is 130, median = 130 * 10^24 and denominator = 10^24.
 */
interface ISortedOracles {
    function medianRate(address rateFeedId) external view returns (uint256, uint256);
    function medianTimestamp(address rateFeedId) external view returns (uint256);
    function numRates(address rateFeedId) external view returns (uint256);
}

interface IChamaTreasuryForSub {
    /// @notice Pull subscription payment from treasury in cUSD (18 decimals)
    function paySubscription(uint256 amount) external;

    /// @notice Returns true if the account is a DAO admin/elder
    function isAdmin(address account) external view returns (bool);
}

/* ========== CONTRACT ========== */

/**
 * @title  DAOSubscriptionManager
 * @notice Production-grade, upgradeable Layer-3 subscription manager.
 * @dev    Uses Mento SortedOracles for KES→cUSD conversion.
 *         Deploy behind an ERC-1967 proxy (UUPS).
 */
contract DAOSubscriptionManager is
    Initializable,
    OwnableUpgradeable,
    ReentrancyGuardUpgradeable,
    PausableUpgradeable,
    UUPSUpgradeable
{
    using SafeERC20 for IERC20;

    /* ---------- structs ---------- */

    struct Tier {
        uint256 priceKES;      // Monthly price in KES (18 decimal precision)
        uint256 durationDays;    // Length of one billing period
        bool isActive;
    }

    struct Subscription {
        uint256 tierId;
        uint256 nextPaymentDue;
        uint256 expiryDate;
        bool isActive;
        uint8 failureCount;
    }

    struct OracleConfig {
        ISortedOracles sortedOracles;
        address rateFeedId;
        uint256 staleThreshold;
        uint256 minReports;
    }

    /* ---------- constants ---------- */

    uint256 public constant MAX_DURATION_MONTHS = 12;
    uint256 public constant KES_DECIMALS = 18;

    /* ---------- state ---------- */

    IERC20 public cUSD;
    IERC20Permit public cUSDPermit;

    address public feeRecipient;           // Where direct permit payments go

    OracleConfig public primaryOracle;
    OracleConfig public backupOracle;

    uint256 public minOracleRate;          // Min KES/USD rate (e.g. 50)
    uint256 public maxOracleRate;          // Max KES/USD rate (e.g. 500)
    uint256 public gracePeriod;
    uint8 public maxFailures;

    mapping(uint256 => Tier) public tiers;
    mapping(address => Subscription) public daoSubscriptions;
    mapping(address => bool) public registeredDAOs;

    /* ---------- events ---------- */

    event TierConfigured(uint256 indexed tierId, uint256 priceKES, uint256 durationDays);
    event TierDeactivated(uint256 indexed tierId);
    event DAORegistered(address indexed daoTreasury);
    event SubscriptionPurchased(
        address indexed daoTreasury,
        uint256 indexed tierId,
        uint256 durationMonths,
        uint256 amountKES,
        uint256 amountCUSD
    );
    event SubscriptionRenewed(
        address indexed daoTreasury,
        uint256 indexed tierId,
        uint256 amountKES,
        uint256 amountCUSD
    );
    event SubscriptionCancelled(address indexed daoTreasury, string reason);
    event PaymentFailed(address indexed daoTreasury, uint8 failureCount, string reason);
    event OracleConfigUpdated(bool isBackup);
    event RateBoundsUpdated(uint256 minRate, uint256 maxRate);
    event GracePeriodUpdated(uint256 newGracePeriod);
    event MaxFailuresUpdated(uint8 newMaxFailures);
    event FeeRecipientUpdated(address indexed newFeeRecipient);

    /* ---------- errors ---------- */

    error ZeroAddress();
    error InvalidTier(uint256 tierId);
    error TierInactive(uint256 tierId);
    error MaxDurationExceeded(uint256 requested, uint256 max);
    error NotDAOAdmin(address caller);
    error DAONotRegistered(address daoTreasury);
    error SubscriptionNotActive(address daoTreasury);
    error PaymentNotDue(address daoTreasury, uint256 nextDue);
    error OracleStale(uint256 timestamp);
    error OracleInsufficientReports(uint256 reports, uint256 required);
    error InvalidOracleRate(uint256 rate);
    error OracleUnavailable();
    error SlippageExceeded(uint256 amountCUSD, uint256 maxAcceptable);
    error PermitFailed();

    /* ---------- modifiers ---------- */

    modifier onlyDAOAdmin(address daoTreasury) {
        if (!IChamaTreasuryForSub(daoTreasury).isAdmin(msg.sender)) {
            revert NotDAOAdmin(msg.sender);
        }
        _;
    }

    modifier onlyRegisteredDAO(address daoTreasury) {
        if (!registeredDAOs[daoTreasury]) revert DAONotRegistered(daoTreasury);
        _;
    }

    /* ---------- initializer (replaces constructor) ---------- */

    function initialize(
        address _cUSD,
        address _feeRecipient,
        address _sortedOracles,
        address _rateFeedId,
        uint256 _staleThreshold,
        uint256 _minReports
    ) external initializer {
        if (_cUSD == address(0) || _sortedOracles == address(0) || _rateFeedId == address(0)) {
            revert ZeroAddress();
        }

        __Ownable_init(msg.sender);
        __ReentrancyGuard_init();
        __Pausable_init();
        __UUPSUpgradeable_init();

        cUSD = IERC20(_cUSD);
        cUSDPermit = IERC20Permit(_cUSD);

        feeRecipient = _feeRecipient == address(0) ? msg.sender : _feeRecipient;

        primaryOracle = OracleConfig({
            sortedOracles: ISortedOracles(_sortedOracles),
            rateFeedId: _rateFeedId,
            staleThreshold: _staleThreshold,
            minReports: _minReports
        });

        // Sensible defaults for KES/USD (approx 100–200 KES per USD)
        minOracleRate = 50;
        maxOracleRate = 500;
        gracePeriod = 3 days;
        maxFailures = 3;
    }

    /* ---------- upgrade authorization ---------- */

    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}

    /* ---------- admin ---------- */

    function setTier(
        uint256 tierId,
        uint256 priceKES,
        uint256 durationDays
    ) external onlyOwner {
        if (priceKES == 0 || durationDays == 0) revert InvalidTier(tierId);
        tiers[tierId] = Tier(priceKES, durationDays, true);
        emit TierConfigured(tierId, priceKES, durationDays);
    }

    function deactivateTier(uint256 tierId) external onlyOwner {
        if (!tiers[tierId].isActive) revert InvalidTier(tierId);
        tiers[tierId].isActive = false;
        emit TierDeactivated(tierId);
    }

    function registerDAO(address daoTreasury) external onlyOwner {
        if (daoTreasury == address(0)) revert ZeroAddress();
        registeredDAOs[daoTreasury] = true;
        emit DAORegistered(daoTreasury);
    }

    function setOracleConfig(
        address _sortedOracles,
        address _rateFeedId,
        uint256 _staleThreshold,
        uint256 _minReports,
        bool isBackup
    ) external onlyOwner {
        if (_sortedOracles == address(0) || _rateFeedId == address(0)) revert ZeroAddress();

        OracleConfig memory cfg = OracleConfig({
            sortedOracles: ISortedOracles(_sortedOracles),
            rateFeedId: _rateFeedId,
            staleThreshold: _staleThreshold,
            minReports: _minReports
        });

        if (isBackup) {
            backupOracle = cfg;
        } else {
            primaryOracle = cfg;
        }
        emit OracleConfigUpdated(isBackup);
    }

    function setRateBounds(uint256 _min, uint256 _max) external onlyOwner {
        minOracleRate = _min;
        maxOracleRate = _max;
        emit RateBoundsUpdated(_min, _max);
    }

    function setGracePeriod(uint256 _gracePeriod) external onlyOwner {
        gracePeriod = _gracePeriod;
        emit GracePeriodUpdated(_gracePeriod);
    }

    function setMaxFailures(uint8 _maxFailures) external onlyOwner {
        maxFailures = _maxFailures;
        emit MaxFailuresUpdated(_maxFailures);
    }

    function setFeeRecipient(address _feeRecipient) external onlyOwner {
        if (_feeRecipient == address(0)) revert ZeroAddress();
        feeRecipient = _feeRecipient;
        emit FeeRecipientUpdated(_feeRecipient);
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    function rescueTokens(address token, address to, uint256 amount) external onlyOwner {
        if (to == address(0)) revert ZeroAddress();
        IERC20(token).safeTransfer(to, amount);
    }

    /* ---------- oracle ---------- */

    /**
     * @notice Query Mento SortedOracles for KES/USD rate.
     * @return rate       The median rate (KES per USD) scaled by denominator
     * @return denominator The fixidity denominator (typically 1e24)
     */
    function getOraclePrice()
        public
        view
        returns (uint256 rate, uint256 denominator)
    {
        (rate, denominator, bool success) = _tryOracle(primaryOracle);
        if (success) return (rate, denominator);

        if (address(backupOracle.sortedOracles) != address(0)) {
            (rate, denominator, success) = _tryOracle(backupOracle);
            if (success) return (rate, denominator);
        }

        revert OracleUnavailable();
    }

    /**
     * @notice Convert KES (18 decimals) to cUSD (18 decimals) using live Mento oracle.
     * @dev cUSD = (kesAmount * denominator) / medianRate
     */
    function calculateCUSDAmount(uint256 amountKES) public view returns (uint256 amountCUSD) {
        (uint256 rate, uint256 denominator) = getOraclePrice();
        // rate = KES per USD * denominator. To get USD from KES: USD = KES * denominator / rate
        amountCUSD = (amountKES * denominator) / rate;
        if (amountCUSD == 0) revert InvalidOracleRate(rate);
    }

    /* ---------- views ---------- */

    function getTier(uint256 tierId) external view returns (Tier memory) {
        return tiers[tierId];
    }

    function getTierPriceCUSD(uint256 tierId) external view returns (uint256) {
        return calculateCUSDAmount(tiers[tierId].priceKES);
    }

    function getSubscription(address daoTreasury) external view returns (Subscription memory) {
        return daoSubscriptions[daoTreasury];
    }

    function isSubscriptionValid(address daoTreasury) external view returns (bool) {
        Subscription memory sub = daoSubscriptions[daoTreasury];
        return sub.isActive && block.timestamp < sub.expiryDate;
    }

    /* ---------- core: treasury payment (original architecture) ---------- */

    /**
     * @notice Purchase/upgrade via treasury payment. Treasury must have cUSD and
     *         its own internal logic to pay (e.g., via paySubscription).
     * @param maxAcceptableCUSD Max cUSD willing to pay (slippage guard).
     */
    function subscribe(
        address daoTreasury,
        uint256 tierId,
        uint256 durationMonths,
        uint256 maxAcceptableCUSD
    )
        external
        nonReentrant
        whenNotPaused
        onlyRegisteredDAO(daoTreasury)
        onlyDAOAdmin(daoTreasury)
    {
        Tier memory tier = tiers[tierId];
        if (!tier.isActive) revert TierInactive(tierId);
        if (durationMonths == 0 || durationMonths > MAX_DURATION_MONTHS) {
            revert MaxDurationExceeded(durationMonths, MAX_DURATION_MONTHS);
        }

        uint256 totalKES = tier.priceKES * durationMonths;
        uint256 totalCUSD = calculateCUSDAmount(totalKES);

        if (totalCUSD > maxAcceptableCUSD) revert SlippageExceeded(totalCUSD, maxAcceptableCUSD);

        // Treasury handles its own cUSD transfer internally
        IChamaTreasuryForSub(daoTreasury).paySubscription(totalCUSD);

        _recordSubscription(daoTreasury, tierId, tier, durationMonths, totalKES, totalCUSD);
    }

    /* ---------- core: permit payment (one-tx subscribe) ---------- */

    /**
     * @notice Purchase/upgrade via direct cUSD payment with EIP-2612 permit.
     * @dev The DAO admin signs a permit so no separate approve tx is needed.
     */
    function subscribeWithPermit(
        address daoTreasury,
        uint256 tierId,
        uint256 durationMonths,
        uint256 maxAcceptableCUSD,
        uint256 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    )
        external
        nonReentrant
        whenNotPaused
        onlyRegisteredDAO(daoTreasury)
        onlyDAOAdmin(daoTreasury)
    {
        Tier memory tier = tiers[tierId];
        if (!tier.isActive) revert TierInactive(tierId);
        if (durationMonths == 0 || durationMonths > MAX_DURATION_MONTHS) {
            revert MaxDurationExceeded(durationMonths, MAX_DURATION_MONTHS);
        }

        uint256 totalKES = tier.priceKES * durationMonths;
        uint256 totalCUSD = calculateCUSDAmount(totalKES);

        if (totalCUSD > maxAcceptableCUSD) revert SlippageExceeded(totalCUSD, maxAcceptableCUSD);

        // Use permit to approve this contract in one tx
        try cUSDPermit.permit(msg.sender, address(this), totalCUSD, deadline, v, r, s) {
            cUSD.safeTransferFrom(msg.sender, feeRecipient, totalCUSD);
        } catch {
            revert PermitFailed();
        }

        _recordSubscription(daoTreasury, tierId, tier, durationMonths, totalKES, totalCUSD);
    }

    /* ---------- core: automated renewal ---------- */

    /**
     * @notice Process automated periodic payment. Callable by anyone (keeper).
     * @dev If oracle fails, emits event and returns without reverting (protects keeper gas).
     */
    function processPayment(address daoTreasury)
        external
        nonReentrant
        whenNotPaused
        onlyRegisteredDAO(daoTreasury)
    {
        Subscription storage sub = daoSubscriptions[daoTreasury];
        if (!sub.isActive) revert SubscriptionNotActive(daoTreasury);
        if (block.timestamp < sub.nextPaymentDue) {
            revert PaymentNotDue(daoTreasury, sub.nextPaymentDue);
        }

        Tier memory tier = tiers[sub.tierId];
        if (!tier.isActive) {
            _cancelSubscription(daoTreasury, "Tier deactivated by admin");
            return;
        }

        uint256 priceCUSD;
        try this.calculateCUSDAmount(tier.priceKES) returns (uint256 amount) {
            priceCUSD = amount;
        } catch {
            emit PaymentFailed(daoTreasury, sub.failureCount + 1, "Oracle failure or invalid price");
            return;
        }

        try IChamaTreasuryForSub(daoTreasury).paySubscription(priceCUSD) {
            sub.nextPaymentDue += tier.durationDays * 1 days;
            sub.expiryDate = sub.nextPaymentDue + gracePeriod;
            sub.failureCount = 0;
            emit SubscriptionRenewed(daoTreasury, sub.tierId, tier.priceKES, priceCUSD);
        } catch {
            sub.failureCount++;
            emit PaymentFailed(daoTreasury, sub.failureCount, "Treasury payment rejected");

            if (sub.failureCount >= maxFailures) {
                _cancelSubscription(daoTreasury, "Max payment failures reached");
            } else {
                sub.nextPaymentDue += (tier.durationDays * 1 days) / 2; // retry backoff
            }
        }
    }

    /* ---------- core: cancellation & cleanup ---------- */

    function cancelSubscription(address daoTreasury, string calldata reason) external {
        if (msg.sender != owner()) {
            if (!IChamaTreasuryForSub(daoTreasury).isAdmin(msg.sender)) {
                revert NotDAOAdmin(msg.sender);
            }
        }
        _cancelSubscription(daoTreasury, reason);
    }

    /**
     * @notice Anyone can clean up an expired subscription (gas abstraction / keeper reward hook).
     */
    function cleanupExpiredSubscription(address daoTreasury) external {
        Subscription memory sub = daoSubscriptions[daoTreasury];
        if (sub.isActive && block.timestamp > sub.expiryDate) {
            _cancelSubscription(daoTreasury, "Subscription expired");
        }
    }

    /* ---------- internal ---------- */

    function _tryOracle(OracleConfig memory cfg)
        internal
        view
        returns (uint256 rate, uint256 denominator, bool success)
    {
        try cfg.sortedOracles.medianRate(cfg.rateFeedId) returns (uint256 _rate, uint256 _denominator) {
            if (_rate == 0 || _denominator == 0) return (0, 0, false);

            uint256 timestamp = cfg.sortedOracles.medianTimestamp(cfg.rateFeedId);
            if (block.timestamp - timestamp > cfg.staleThreshold) return (0, 0, false);

            uint256 reports = cfg.sortedOracles.numRates(cfg.rateFeedId);
            if (reports < cfg.minReports) return (0, 0, false);

            // Bounds check: _rate is actual_rate * denominator
            if (_rate < minOracleRate * _denominator || _rate > maxOracleRate * _denominator) {
                return (0, 0, false);
            }

            return (_rate, _denominator, true);
        } catch {
            return (0, 0, false);
        }
    }

    function _recordSubscription(
        address daoTreasury,
        uint256 tierId,
        Tier memory tier,
        uint256 durationMonths,
        uint256 totalKES,
        uint256 totalCUSD
    ) internal {
        Subscription storage sub = daoSubscriptions[daoTreasury];
        sub.tierId = tierId;
        sub.isActive = true;
        sub.failureCount = 0;

        uint256 addedDuration = tier.durationDays * durationMonths * 1 days;

        if (sub.nextPaymentDue > block.timestamp) {
            sub.nextPaymentDue += addedDuration;
        } else {
            sub.nextPaymentDue = block.timestamp + addedDuration;
        }
        sub.expiryDate = sub.nextPaymentDue + gracePeriod;

        emit SubscriptionPurchased(daoTreasury, tierId, durationMonths, totalKES, totalCUSD);
    }

    function _cancelSubscription(address daoTreasury, string memory reason) internal {
        Subscription storage sub = daoSubscriptions[daoTreasury];
        sub.isActive = false;
        sub.failureCount = 0;
        emit SubscriptionCancelled(daoTreasury, reason);
    }
}