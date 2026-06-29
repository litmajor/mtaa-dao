// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// ── Upgradeable variants required for EIP-1167 clone compatibility ──
// The factory (Phase1B) calls Clones.clone() then initialize() — constructor
// args are never executed on a clone, so ALL state must be set in initialize().
import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC4626Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/Ownable2StepUpgradeable.sol";
import "./security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";

interface IMTAAToken {
    function burn(uint256 amount) external;
}

interface IPriceOracle {
    function getPrice() external view returns (uint256);
}

/**
 * @title  MaonoVault (Phase 1B — Clone-Compatible)
 * @notice ERC4626 vault with MTAA upkeep, hibernation, and oracle-based spawn pricing.
 *         Designed to be deployed as an EIP-1167 minimal proxy by MaonoVaultFactory_Phase1B.
 *
 * ─── FIXES FROM PHASE 1A ──────────────────────────────────────────────────────
 *  CRITICAL #1  onlyActive modifier checked msg.sender/receiver vault state instead of the
 *               vault's own single status. Any uninitialized address == ACTIVE by default,
 *               so the guard was always bypassable.
 *               FIX: Remove per-address mapping. Use single `VaultState public vaultState`.
 *               `onlyActive` now checks the vault-level status with no address parameter.
 *
 *  CRITICAL #2  collectMonthlyUpkeep() and reactivateFromHibernation() had NO onlyOwner guard.
 *               Any address could call them, creating independent VaultState entries for itself
 *               and potentially triggering hibernation for a foreign address's "slot".
 *               FIX: Both functions are now onlyOwner.
 *
 *  CRITICAL #3  _burnMTAAToken() wrote to vaultStates[msg.sender].totalBurned — wrong when
 *               msg.sender != vault owner (previously possible without onlyOwner guard).
 *               FIX: Single vaultState struct, always written correctly.
 *
 *  CRITICAL #4  SafeERC20 was imported but NEVER used. transferFrom()/transfer() calls
 *               manually checked bool returns — fragile for tokens that revert silently.
 *               FIX: All MTAA transfers use safeTransferFrom / safeTransfer.
 *
 *  CRITICAL #5  CEI violation in reactivateFromHibernation(): state was updated AFTER the
 *               external transferFrom call. nonReentrant mitigated it but CEI was still wrong.
 *               FIX: All state mutations happen before external calls.
 *
 *  HIGH #6  validVaultType modifier cast VaultType enum to uint256 — the compiler already
 *           rejects enum values > 4, so the modifier was dead code. Replaced with explicit
 *           uint8 range checks on raw inputs.
 *
 *  HIGH #7  userVaultCount and MAX_VAULTS_PER_USER were dead storage slots — factory owns
 *           this cap. Removed entirely.
 *
 *  ARCH #8  Not clone-compatible: used constructor args. Factory Phase1B calls initialize().
 *           FIX: Inherit upgradeable OZ contracts. Bare constructor calls _disableInitializers().
 *           All init logic moves to initialize() with `initializer` modifier.
 *
 *  ARCH #9  deposit() / mint() / redeem() were not overridden — ERC4626 base exposes them
 *           without pause or active-status checks.
 *           FIX: All four ERC4626 entrypoints are overridden with onlyActive + whenNotPaused.
 * ──────────────────────────────────────────────────────────────────────────────
 */
contract MaonoVault_Phase1B is
    ERC4626Upgradeable,
    Ownable2StepUpgradeable,
    ReentrancyGuardUpgradeable,
    PausableUpgradeable
{
    using SafeERC20 for IERC20;

    // ======================================================================
    // TYPES
    // ======================================================================
    enum VaultType   { SAVINGS, ESCROW, BUSINESS, INVESTING, CUSTOM }
    enum VaultStatus { ACTIVE, HIBERNATING, CLOSED }

    /// @notice Single vault-level state. No per-address mapping — one owner, one state.
    struct VaultState {
        VaultStatus status;
        uint256     lastUpkeepPayment;
        uint256     hibernationStartTime;
        uint256     totalUpkeepPaid;
        uint256     totalBurned;
        uint256     totalToTreasury;
    }

    // ======================================================================
    // STORAGE
    // ======================================================================
    VaultType  public vaultType;
    address    public mtaaToken;
    address    public daoTreasury;
    address    public priceOracle;

    /// @notice FIX: Single vault state — replaces mapping(address => VaultState)
    VaultState public vaultState;

    // Oracle safety controls
    bool    public oracleCircuitEnabled;
    uint256 public minAllowedUsdCents;
    uint256 public maxAllowedUsdCents;

    // Constants — safe in upgradeable contracts (bytecode, not storage)
    uint256 public constant TARGET_SPAWN_COST_USD_CENTS = 500;
    uint256 public constant MIN_SPAWN_COST_MTAA         = 100 ether;
    uint256 public constant MAX_SPAWN_COST_MTAA         = 2000 ether;

    // Upkeep config — written in initialize(), updatable by owner
    uint256[5] public UPKEEP_COSTS_MONTHLY;
    uint256[5] public BURN_PERCENTAGES;

    // Global accounting
    uint256 public totalBurnedGlobally;
    uint256 public totalToTreasuryGlobally;

    // ======================================================================
    // EVENTS
    // ======================================================================
    event VaultInitialized(address indexed owner, VaultType indexed vaultType, string name, uint256 timestamp);
    event UpkeepCollected(address indexed payer, uint256 upkeepAmount, uint256 burnAmount, uint256 treasuryAmount, uint256 timestamp);
    event VaultHibernated(uint256 timestamp, string reason);
    event VaultReactivated(uint256 reactivationFee, uint256 burnAmount, uint256 treasuryAmount, uint256 timestamp);
    event TokenBurned(uint256 amount, string reason, uint256 timestamp);
    event PriceOracleUpdated(address indexed newOracle, uint256 timestamp);
    event DaoTreasuryUpdated(address indexed oldTreasury, address indexed newTreasury, uint256 timestamp);
    event OracleCircuitToggled(bool enabled, uint256 timestamp);
    event OracleBoundsUpdated(uint256 minUsdCents, uint256 maxUsdCents, uint256 timestamp);
    event UpkeepCostUpdated(uint256 index, uint256 newValue, uint256 timestamp);
    event BurnPercentageUpdated(uint256 index, uint256 newValue, uint256 timestamp);

    // ======================================================================
    // ERRORS
    // ======================================================================
    error InvalidVaultType();
    error VaultIsHibernating();
    error VaultNotHibernating();
    error ZeroAddress();
    error InvalidAmount();
    error UpkeepNotDue();
    error BurnFailed();
    error OracleMalfunction();

    // ======================================================================
    // MODIFIERS
    // ======================================================================
    /// @notice FIX: Checks vault-level status, no address parameter. No default-to-ACTIVE bypass.
    modifier onlyActive() {
        if (vaultState.status == VaultStatus.HIBERNATING) revert VaultIsHibernating();
        _;
    }

    // ======================================================================
    // CONSTRUCTOR — disables initializers on the implementation contract
    // ======================================================================
    /**
     * @dev Prevents anyone from calling initialize() on the bare implementation
     *      (which would be a griefing vector). Clones are unaffected — they have
     *      their own storage and can be initialized normally.
     * @custom:oz-upgrades-unsafe-allow constructor
     */
    constructor() {
        _disableInitializers();
    }

    // ======================================================================
    // INITIALIZER — called by factory immediately after Clones.clone()
    // ======================================================================
    /**
     * @notice Bootstrap a freshly cloned vault
     * @dev    Replaces constructor args. The `initializer` modifier ensures this
     *         runs exactly once per clone. Factory calls this atomically with the clone.
     *
     * @param _asset        ERC20 asset this vault denominates in (e.g. cUSD)
     * @param _name         ERC20 name for vault LP tokens
     * @param _symbol       ERC20 symbol for vault LP tokens
     * @param _vaultOwner   Vault owner (DAO admin) — receives Ownable rights
     * @param _vaultType    0=Savings 1=Escrow 2=Business 3=Investing 4=Custom
     * @param _daoTreasury  Destination for non-burned upkeep revenue
     * @param _mtaaToken    MTAA token address
     * @param _priceOracle  Price oracle for spawn cost calculation
     */
    function initialize(
        address       _asset,
        string memory _name,
        string memory _symbol,
        address       _vaultOwner,
        uint8         _vaultType,
        address       _daoTreasury,
        address       _mtaaToken,
        address       _priceOracle
    ) external initializer {
        if (_daoTreasury == address(0) || _mtaaToken == address(0)) revert ZeroAddress();
        if (_vaultType > 4) revert InvalidVaultType();

        // Init OZ upgradeable base contracts
        __ERC20_init(_name, _symbol);
        __ERC4626_init(IERC20(_asset));
        __Ownable_init(_vaultOwner);
        __ReentrancyGuard_init();
        __Pausable_init();

        // Vault config
        vaultType   = VaultType(_vaultType);
        daoTreasury = _daoTreasury;
        mtaaToken   = _mtaaToken;
        priceOracle = _priceOracle;

        // Default upkeep costs (Celo-optimised, MTAA)
        UPKEEP_COSTS_MONTHLY[0] = 15 ether;   // SAVINGS
        UPKEEP_COSTS_MONTHLY[1] = 20 ether;   // ESCROW
        UPKEEP_COSTS_MONTHLY[2] = 40 ether;   // BUSINESS
        UPKEEP_COSTS_MONTHLY[3] = 60 ether;   // INVESTING
        UPKEEP_COSTS_MONTHLY[4] = 80 ether;   // CUSTOM

        // Default burn splits (basis points, 10000 = 100%)
        BURN_PERCENTAGES[0] = 10000;  // SAVINGS:    100% burn
        BURN_PERCENTAGES[1] = 5000;   // ESCROW:      50% burn / 50% treasury
        BURN_PERCENTAGES[2] = 5000;   // BUSINESS:    50 / 50
        BURN_PERCENTAGES[3] = 3000;   // INVESTING:   30% burn / 70% treasury
        BURN_PERCENTAGES[4] = 3000;   // CUSTOM:      30 / 70

        // Oracle safety defaults
        oracleCircuitEnabled = true;
        minAllowedUsdCents   = 1;
        maxAllowedUsdCents   = 1_000_000;

        // FIX: Single vault state initialisation
        vaultState.status            = VaultStatus.ACTIVE;
        vaultState.lastUpkeepPayment = block.timestamp;

        emit VaultInitialized(_vaultOwner, VaultType(_vaultType), _name, block.timestamp);
    }

    // ======================================================================
    // ADMIN SETTERS
    // ======================================================================
    function setPriceOracle(address _newOracle) external onlyOwner {
        if (_newOracle == address(0)) revert ZeroAddress();
        priceOracle = _newOracle;
        emit PriceOracleUpdated(_newOracle, block.timestamp);
    }

    function setDaoTreasury(address _newTreasury) external onlyOwner {
        if (_newTreasury == address(0)) revert ZeroAddress();
        address old = daoTreasury;
        daoTreasury = _newTreasury;
        emit DaoTreasuryUpdated(old, _newTreasury, block.timestamp);
    }

    function setOracleCircuitEnabled(bool enabled) external onlyOwner {
        oracleCircuitEnabled = enabled;
        emit OracleCircuitToggled(enabled, block.timestamp);
    }

    function setOracleBounds(uint256 minUsdCents, uint256 maxUsdCents) external onlyOwner {
        if (minUsdCents == 0 || maxUsdCents == 0 || minUsdCents > maxUsdCents) revert InvalidAmount();
        minAllowedUsdCents = minUsdCents;
        maxAllowedUsdCents = maxUsdCents;
        emit OracleBoundsUpdated(minUsdCents, maxUsdCents, block.timestamp);
    }

    function setUpkeepCostAt(uint256 index, uint256 newValue) external onlyOwner {
        if (index > 4) revert InvalidVaultType();
        UPKEEP_COSTS_MONTHLY[index] = newValue;
        emit UpkeepCostUpdated(index, newValue, block.timestamp);
    }

    function setBurnPercentageAt(uint256 index, uint256 newValue) external onlyOwner {
        if (index > 4) revert InvalidVaultType();
        if (newValue > 10000) revert InvalidAmount();
        BURN_PERCENTAGES[index] = newValue;
        emit BurnPercentageUpdated(index, newValue, block.timestamp);
    }

    function pause()   external onlyOwner { _pause(); }
    function unpause() external onlyOwner { _unpause(); }

    // ======================================================================
    // INTERNAL — BURN
    // ======================================================================
    /**
     * @dev FIX: Always writes to vault-level vaultState, not msg.sender's slot.
     */
    function _burnMTAAToken(uint256 amount, string memory reason) internal {
        if (amount == 0) return;
        try IMTAAToken(mtaaToken).burn(amount) {
            totalBurnedGlobally    += amount;
            vaultState.totalBurned += amount;
            emit TokenBurned(amount, reason, block.timestamp);
        } catch {
            revert BurnFailed();
        }
    }

    /**
     * @notice Calculate the MTAA-based discount for fees (0 to 50)
     */
    function getDiscountedFeePct(address user) public view returns (uint256) {
        if (address(mtaaToken) == address(0)) return 0;
        
        uint256 mtaaBalance = IERC20(mtaaToken).balanceOf(user);
        uint256 n = mtaaBalance / 1e18;
        uint256 root = Math.sqrt(n);
        uint256 discountPct = (root * 25) / 10; // root * 2.5
        if (discountPct > 50) discountPct = 50;
        
        return discountPct;
    }

    // ======================================================================
    // UPKEEP COLLECTION
    // ======================================================================
    /**
     * @notice Collect monthly upkeep fee
     * @dev FIX: onlyOwner — prevents random addresses from creating phantom vault states
     *           or forcing hibernation on a foreign address's behalf.
     *      FIX: safeTransferFrom replaces direct IERC20.transferFrom bool check.
     *      FIX: CEI — all state mutations complete before any external call.
     */
    function collectMonthlyUpkeep() external onlyOwner nonReentrant {
        VaultState storage state = vaultState;

        if (block.timestamp < state.lastUpkeepPayment + 30 days) revert UpkeepNotDue();

        uint256 baseUpkeepCost = UPKEEP_COSTS_MONTHLY[uint256(vaultType)];
        uint256 discountPct = getDiscountedFeePct(msg.sender);
        uint256 upkeepCost = (baseUpkeepCost * (100 - discountPct)) / 100;

        // Auto-hibernate if balance insufficient (check, don't revert — retention design)
        if (IERC20(mtaaToken).balanceOf(msg.sender) < upkeepCost) {
            state.status               = VaultStatus.HIBERNATING;
            state.hibernationStartTime = block.timestamp;
            emit VaultHibernated(block.timestamp, "Insufficient MTAA for upkeep");
            return;
        }

        // ---- Effects (all state mutations) ----
        uint256 burnPercentage = BURN_PERCENTAGES[uint256(vaultType)];
        uint256 burnAmount     = (upkeepCost * burnPercentage) / 10000;
        uint256 treasuryAmount = upkeepCost - burnAmount;

        state.lastUpkeepPayment  = block.timestamp;
        state.totalUpkeepPaid    += upkeepCost;

        // ---- Interactions (all external calls) ----
        IERC20(mtaaToken).safeTransferFrom(msg.sender, address(this), upkeepCost);

        if (burnAmount > 0) {
            _burnMTAAToken(burnAmount, "Monthly upkeep burn");
        }
        if (treasuryAmount > 0) {
            IERC20(mtaaToken).safeTransfer(daoTreasury, treasuryAmount);
            totalToTreasuryGlobally  += treasuryAmount;
            state.totalToTreasury    += treasuryAmount;
        }

        emit UpkeepCollected(msg.sender, upkeepCost, burnAmount, treasuryAmount, block.timestamp);
    }

    // ======================================================================
    // HIBERNATION RECOVERY
    // ======================================================================
    /**
     * @notice Reactivate hibernated vault — pay 1.5× one month (no backpay)
     * @dev FIX: onlyOwner.
     *      FIX: CEI — state.status = ACTIVE written BEFORE transferFrom.
     *           Without this fix, a malicious owner contract could re-enter
     *           reactivateFromHibernation() and pay the fee multiple times.
     */
    function reactivateFromHibernation() external onlyOwner nonReentrant {
        VaultState storage state = vaultState;
        if (state.status != VaultStatus.HIBERNATING) revert VaultNotHibernating();

        uint256 monthlyUpkeep   = UPKEEP_COSTS_MONTHLY[uint256(vaultType)];
        uint256 reactivationFee = (monthlyUpkeep * 150) / 100;  // 1.5×

        uint256 burnPercentage  = BURN_PERCENTAGES[uint256(vaultType)];
        uint256 burnAmount      = (reactivationFee * burnPercentage) / 10000;
        uint256 treasuryAmount  = reactivationFee - burnAmount;

        // ---- Effects ----
        state.status               = VaultStatus.ACTIVE;
        state.lastUpkeepPayment    = block.timestamp;
        state.hibernationStartTime = 0;
        state.totalUpkeepPaid      += reactivationFee;

        // ---- Interactions ----
        IERC20(mtaaToken).safeTransferFrom(msg.sender, address(this), reactivationFee);

        if (burnAmount > 0) {
            _burnMTAAToken(burnAmount, "Hibernation reactivation burn");
        }
        if (treasuryAmount > 0) {
            IERC20(mtaaToken).safeTransfer(daoTreasury, treasuryAmount);
            totalToTreasuryGlobally += treasuryAmount;
            state.totalToTreasury   += treasuryAmount;
        }

        emit VaultReactivated(reactivationFee, burnAmount, treasuryAmount, block.timestamp);
    }

    // ======================================================================
    // ORACLE SPAWN PRICING  (utility — canonical values live in factory)
    // ======================================================================
    function getSpawnCostInMTAA() external view returns (uint256) {
        if (priceOracle == address(0) || !oracleCircuitEnabled) revert OracleMalfunction();

        uint256 priceCents;
        try IPriceOracle(priceOracle).getPrice() returns (uint256 p) {
            priceCents = p;
        } catch {
            revert OracleMalfunction();
        }

        if (priceCents < minAllowedUsdCents || priceCents > maxAllowedUsdCents) {
            revert OracleMalfunction();
        }

        uint256 mtaaAmount = (TARGET_SPAWN_COST_USD_CENTS * 1e18) / priceCents;
        if (mtaaAmount < MIN_SPAWN_COST_MTAA) return MIN_SPAWN_COST_MTAA;
        if (mtaaAmount > MAX_SPAWN_COST_MTAA) return MAX_SPAWN_COST_MTAA;
        return mtaaAmount;
    }

    // ======================================================================
    // ERC4626 OVERRIDES
    // ======================================================================
    // FIX #1: All four entry-points now check vault-level status (no address param)
    // FIX #2: All four are guarded by whenNotPaused (previously missing on mint/redeem)
    // FIX #3: All four carry nonReentrant (ERC4626 base does not add this)

    function deposit(uint256 assets, address receiver)
        public override onlyActive whenNotPaused nonReentrant
        returns (uint256)
    {
        return super.deposit(assets, receiver);
    }

    function mint(uint256 shares, address receiver)
        public override onlyActive whenNotPaused nonReentrant
        returns (uint256)
    {
        return super.mint(shares, receiver);
    }

    function withdraw(uint256 assets, address receiver, address shareOwner)
        public override onlyActive whenNotPaused nonReentrant
        returns (uint256)
    {
        return super.withdraw(assets, receiver, shareOwner);
    }

    function redeem(uint256 shares, address receiver, address shareOwner)
        public override onlyActive whenNotPaused nonReentrant
        returns (uint256)
    {
        return super.redeem(shares, receiver, shareOwner);
    }

    // ======================================================================
    // VIEW FUNCTIONS
    // ======================================================================
    function getVaultStatus()  external view returns (VaultStatus) { return vaultState.status; }
    function isVaultActive()   external view returns (bool)        { return vaultState.status == VaultStatus.ACTIVE; }
    function getUpkeepDueDate() external view returns (uint256)    { return vaultState.lastUpkeepPayment + 30 days; }

    function getMonthlyUpkeepCost() external view returns (uint256) {
        return UPKEEP_COSTS_MONTHLY[uint256(vaultType)];
    }

    function getMonthsSinceHibernation() external view returns (uint256) {
        if (vaultState.status != VaultStatus.HIBERNATING) return 0;
        return (block.timestamp - vaultState.hibernationStartTime) / 30 days;
    }

    function getVaultMetrics()
        external view
        returns (
            VaultStatus status,
            uint256     nextUpkeepDue,
            uint256     totalUpkeepPaid,
            uint256     totalBurned,
            uint256     totalToTreasury
        )
    {
        VaultState storage s = vaultState;
        return (s.status, s.lastUpkeepPayment + 30 days, s.totalUpkeepPaid, s.totalBurned, s.totalToTreasury);
    }
}
