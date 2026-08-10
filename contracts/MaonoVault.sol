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
 *
 * ─── FIXES FROM PHASE 2 ───────────────────────────────────────────────────────
 *  P2-1  The payer administered its own invoice: upkeep cost, burn split and the
 *        treasury destination were all onlyOwner, so the vault owner could price
 *        the fee at zero and/or route it back to itself immediately before paying.
 *        FIX: those parameters are `onlyPlatform` — the address that deployed and
 *        initialized the clone (MaonoVaultFactory_Phase1B, owned by the platform
 *        multi-sig). The vault owner keeps pause/upkeep/reactivation only.
 *
 *  P2-2  Hibernation was an unbounded, flat-priced freeze of depositor capital.
 *        FIX: (a) exits reopen permissionlessly once a freeze — hibernation *or*
 *        pause — has lasted EXIT_GRACE_PERIOD, so depositors can always leave;
 *        (b) reactivation is charged per hibernated month (capped) instead of a
 *        flat 1.5 months, so waiting is no longer cheaper than complying.
 *
 *  P2-3  A deposit could mint zero shares and keep the assets.
 *        FIX: deposit()/mint() revert with ZeroShares().
 *
 *  P2-4  collectMonthlyUpkeep() was callable while HIBERNATING, taking payment
 *        without restoring the vault.
 *        FIX: upkeep reverts while hibernating; reactivateFromHibernation() is
 *        the only paid transition out of that state.
 *
 *  M-1   The MTAA fee discount read an instantaneous balance and was therefore
 *        flash-loanable.
 *        FIX: the discount is computed from MTAA staked in the vault and held
 *        continuously for DISCOUNT_MIN_STAKE_DURATION; any increase restarts the
 *        clock, so borrowed MTAA earns nothing.
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

    /// @notice P2-1: platform-level administrator of the fee schedule, recorded as the
    ///         address that initialized this clone (the factory in production).
    ///         Deliberately immutable after initialization: the payer must never be
    ///         able to acquire pricing rights over its own invoice.
    address public platformAdmin;

    /// @notice P2-2: when the current pause started (0 while unpaused).
    uint256 public pauseStartTime;

    /// @notice M-1: MTAA staked by the owner to earn the upkeep discount, and the
    ///         timestamp of the last stake *increase* (any top-up restarts the clock).
    uint256 public mtaaStaked;
    uint256 public mtaaStakeSince;

    // Remediation constants
    /// @notice P2-2: how long a freeze (hibernation or pause) may block exits.
    uint256 public constant EXIT_GRACE_PERIOD = 90 days;
    /// @notice M-1: how long MTAA must sit staked before it counts towards the discount.
    uint256 public constant DISCOUNT_MIN_STAKE_DURATION = 30 days;
    /// @notice P2-2: upper bound on the reactivation catch-up, so the vault can always be revived.
    uint256 public constant MAX_CATCHUP_MONTHS = 12;

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
    event MtaaStaked(uint256 amount, uint256 totalStaked, uint256 stakedSince);
    event MtaaUnstaked(uint256 amount, uint256 totalStaked);

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
    error NotPlatformAdmin();
    error ZeroShares();
    error AssetTransferMismatch();
    error MtaaCannotBeTheAsset();
    error InsufficientStake();

    // ======================================================================
    // MODIFIERS
    // ======================================================================
    /// @notice FIX: Checks vault-level status, no address parameter. No default-to-ACTIVE bypass.
    modifier onlyActive() {
        if (vaultState.status == VaultStatus.HIBERNATING) revert VaultIsHibernating();
        _;
    }

    /// @notice P2-1: fee economics are administered by the platform, never by the payer.
    modifier onlyPlatform() {
        if (msg.sender != platformAdmin) revert NotPlatformAdmin();
        _;
    }

    /// @notice P2-2: exits are blocked by hibernation and by pause, but only for as
    ///         long as EXIT_GRACE_PERIOD. After that the freeze expires for
    ///         withdrawals and redemptions, so depositor capital can never be held
    ///         indefinitely. Deposits stay blocked — a frozen vault takes no new money.
    modifier whenExitsOpen() {
        VaultStatus status = vaultState.status;
        if (status == VaultStatus.HIBERNATING && block.timestamp < vaultState.hibernationStartTime + EXIT_GRACE_PERIOD)
        {
            revert VaultIsHibernating();
        }
        if (paused() && block.timestamp < pauseStartTime + EXIT_GRACE_PERIOD) {
            revert EnforcedPause();
        }
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
        // M-1: staked MTAA is custodied by the vault, so it must not be the ERC4626
        // underlying — otherwise a stake would inflate totalAssets().
        if (_mtaaToken == _asset) revert MtaaCannotBeTheAsset();

        // Init OZ upgradeable base contracts
        __ERC20_init(_name, _symbol);
        __ERC4626_init(IERC20(_asset));
        __Ownable_init(_vaultOwner);
        __ReentrancyGuard_init();
        __Pausable_init();

        // P2-1: the deployer of the clone (the factory) administers fee economics.
        platformAdmin = msg.sender;

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
    function setPriceOracle(address _newOracle) external onlyPlatform {
        if (_newOracle == address(0)) revert ZeroAddress();
        priceOracle = _newOracle;
        emit PriceOracleUpdated(_newOracle, block.timestamp);
    }

    function setDaoTreasury(address _newTreasury) external onlyPlatform {
        if (_newTreasury == address(0)) revert ZeroAddress();
        address old = daoTreasury;
        daoTreasury = _newTreasury;
        emit DaoTreasuryUpdated(old, _newTreasury, block.timestamp);
    }

    function setOracleCircuitEnabled(bool enabled) external onlyPlatform {
        oracleCircuitEnabled = enabled;
        emit OracleCircuitToggled(enabled, block.timestamp);
    }

    function setOracleBounds(uint256 minUsdCents, uint256 maxUsdCents) external onlyPlatform {
        if (minUsdCents == 0 || maxUsdCents == 0 || minUsdCents > maxUsdCents) revert InvalidAmount();
        minAllowedUsdCents = minUsdCents;
        maxAllowedUsdCents = maxUsdCents;
        emit OracleBoundsUpdated(minUsdCents, maxUsdCents, block.timestamp);
    }

    function setUpkeepCostAt(uint256 index, uint256 newValue) external onlyPlatform {
        if (index > 4) revert InvalidVaultType();
        UPKEEP_COSTS_MONTHLY[index] = newValue;
        emit UpkeepCostUpdated(index, newValue, block.timestamp);
    }

    function setBurnPercentageAt(uint256 index, uint256 newValue) external onlyPlatform {
        if (index > 4) revert InvalidVaultType();
        if (newValue > 10000) revert InvalidAmount();
        BURN_PERCENTAGES[index] = newValue;
        emit BurnPercentageUpdated(index, newValue, block.timestamp);
    }

    /// @dev P2-2: the pause clock is what makes the freeze bounded (see whenExitsOpen).
    function pause() external onlyOwner {
        _pause();
        pauseStartTime = block.timestamp;
    }

    function unpause() external onlyOwner {
        _unpause();
        pauseStartTime = 0;
    }

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

    // ======================================================================
    // MTAA STAKING — the basis of the upkeep discount (M-1)
    // ======================================================================
    /**
     * @notice Stake MTAA to earn the upkeep discount.
     * @dev    M-1: the discount used to read `balanceOf(payer)` inside the fee call,
     *         so it could be bought with MTAA borrowed for a single transaction.
     *         It is now earned by MTAA that has sat in the vault for at least
     *         DISCOUNT_MIN_STAKE_DURATION; every top-up restarts that clock, so no
     *         amount of last-minute acquisition moves the price of the next payment.
     */
    function stakeMtaaForDiscount(uint256 amount) external onlyOwner nonReentrant {
        if (amount == 0) revert InvalidAmount();
        mtaaStaked     += amount;
        mtaaStakeSince = block.timestamp;
        IERC20(mtaaToken).safeTransferFrom(msg.sender, address(this), amount);
        emit MtaaStaked(amount, mtaaStaked, mtaaStakeSince);
    }

    /// @notice Withdraw staked MTAA. Lowering the stake lowers the discount but never
    ///         restarts the holding clock — the remainder has been held at least as long.
    function unstakeMtaa(uint256 amount) external onlyOwner nonReentrant {
        if (amount == 0) revert InvalidAmount();
        if (amount > mtaaStaked) revert InsufficientStake();
        mtaaStaked -= amount;
        IERC20(mtaaToken).safeTransfer(msg.sender, amount);
        emit MtaaUnstaked(amount, mtaaStaked);
    }

    /// @notice MTAA that has been staked long enough to count towards the discount.
    function eligibleStakedMtaa() public view returns (uint256) {
        if (mtaaStaked == 0) return 0;
        if (block.timestamp < mtaaStakeSince + DISCOUNT_MIN_STAKE_DURATION) return 0;
        return mtaaStaked;
    }

    /**
     * @notice The MTAA-based discount applied to upkeep, 0 to 50 percent.
     * @dev    min(50, floor(sqrt(eligibleStake / 1e18)) * 2.5).
     */
    function getUpkeepDiscountPct() public view returns (uint256) {
        if (mtaaToken == address(0)) return 0;
        uint256 n = eligibleStakedMtaa() / 1e18;
        uint256 discountPct = (Math.sqrt(n) * 25) / 10; // root * 2.5
        if (discountPct > 50) discountPct = 50;
        return discountPct;
    }

    /**
     * @notice Discount that `user` would receive on this vault's upkeep.
     * @dev    Kept for ABI compatibility. The discount is a property of the vault's
     *         sustained stake, not of any address's spot balance, so it is non-zero
     *         only for the owner — the account the fee is charged to.
     */
    function getDiscountedFeePct(address user) public view returns (uint256) {
        return user == owner() ? getUpkeepDiscountPct() : 0;
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

        // P2-4: paying while hibernating had no state effect, so the owner could keep
        // the vault frozen while looking current. Reactivation is the only way out.
        if (state.status == VaultStatus.HIBERNATING) revert VaultIsHibernating();
        if (block.timestamp < state.lastUpkeepPayment + 30 days) revert UpkeepNotDue();

        uint256 baseUpkeepCost = UPKEEP_COSTS_MONTHLY[uint256(vaultType)];
        uint256 discountPct = getUpkeepDiscountPct();
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
     * @notice Reactivate a hibernated vault — pay 1.5× one month per hibernated month
     * @dev FIX: onlyOwner.
     *      FIX: CEI — state.status = ACTIVE written BEFORE transferFrom.
     *           Without this fix, a malicious owner contract could re-enter
     *           reactivateFromHibernation() and pay the fee multiple times.
     *      P2-2: the fee used to be a flat 1.5 months however long the vault stayed
     *            frozen, which made hibernating strictly cheaper than complying while
     *            depositors carried the liveness cost. It now scales with the number
     *            of hibernated months, capped at MAX_CATCHUP_MONTHS so that the vault
     *            always remains revivable.
     */
    function reactivateFromHibernation() external onlyOwner nonReentrant {
        VaultState storage state = vaultState;
        if (state.status != VaultStatus.HIBERNATING) revert VaultNotHibernating();

        uint256 monthlyUpkeep   = UPKEEP_COSTS_MONTHLY[uint256(vaultType)];
        uint256 reactivationFee = (monthlyUpkeep * 150) / 100 * hibernationMonthsCharged();  // 1.5× per month

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
    //  Override _decimalsOffset to mitigate the ERC4626 first-depositor
    // inflation / donation attack. With offset=3, the vault uses virtual shares
    // (totalSupply * 10^3) and virtual assets (totalAssets * 10^3) in its
    // share-price calculation. An attacker must donate 10^3 times more assets
    // to steal the same rounding error from subsequent depositors, making the
    // attack economically impractical. This is the OpenZeppelin-recommended fix.
    function _decimalsOffset() internal pure override returns (uint8) {
        return 3;
    }

    // FIX #1: All four entry-points now check vault-level status (no address param)
    // FIX #2: All four are guarded by whenNotPaused (previously missing on mint/redeem)
    // FIX #3: All four carry nonReentrant (ERC4626 base does not add this)

    // FIX #4 (P2-3): a deposit that rounds down to zero shares used to succeed and
    //                keep the assets, donating them to the existing shareholders.
    // FIX #5 (P2-2): exits are subject to a *bounded* freeze, not an indefinite one.

    function deposit(uint256 assets, address receiver)
        public override onlyActive whenNotPaused nonReentrant
        returns (uint256)
    {
        uint256 shares = super.deposit(assets, receiver);
        if (shares == 0) revert ZeroShares();
        return shares;
    }

    function mint(uint256 shares, address receiver)
        public override onlyActive whenNotPaused nonReentrant
        returns (uint256)
    {
        if (shares == 0) revert ZeroShares();
        return super.mint(shares, receiver);
    }

    function withdraw(uint256 assets, address receiver, address shareOwner)
        public override whenExitsOpen nonReentrant
        returns (uint256)
    {
        return super.withdraw(assets, receiver, shareOwner);
    }

    function redeem(uint256 shares, address receiver, address shareOwner)
        public override whenExitsOpen nonReentrant
        returns (uint256)
    {
        return super.redeem(shares, receiver, shareOwner);
    }

    // FIX #6 (M-2): `totalAssets()` is the vault's own balance, so a share issued
    //               against assets that never arrived is unbacked. Any asset whose
    //               transfer credits less than it debits (fee-on-transfer, and any
    //               rebase landing inside the call) is rejected here rather than
    //               silently diluting every holder. Rebasing assets are excluded at
    //               the factory allowlist, which is the only way a vault is created.
    function _deposit(address caller, address receiver, uint256 assets, uint256 shares) internal override {
        IERC20 underlying = IERC20(asset());
        uint256 balanceBefore = underlying.balanceOf(address(this));
        super._deposit(caller, receiver, assets, shares);
        if (underlying.balanceOf(address(this)) - balanceBefore != assets) revert AssetTransferMismatch();
    }

    // ERC-4626 conformance: the max* views report what the guards above allow, so
    // integrators never quote an amount the vault would reject.
    function maxDeposit(address receiver) public view override returns (uint256) {
        if (vaultState.status == VaultStatus.HIBERNATING || paused()) return 0;
        return super.maxDeposit(receiver);
    }

    function maxMint(address receiver) public view override returns (uint256) {
        if (vaultState.status == VaultStatus.HIBERNATING || paused()) return 0;
        return super.maxMint(receiver);
    }

    function maxWithdraw(address shareOwner) public view override returns (uint256) {
        if (!exitsOpen()) return 0;
        return super.maxWithdraw(shareOwner);
    }

    function maxRedeem(address shareOwner) public view override returns (uint256) {
        if (!exitsOpen()) return 0;
        return super.maxRedeem(shareOwner);
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

    /// @notice Hibernated months the reactivation fee is charged for: at least one,
    ///         at most MAX_CATCHUP_MONTHS, rounded up.
    function hibernationMonthsCharged() public view returns (uint256) {
        if (vaultState.status != VaultStatus.HIBERNATING) return 0;
        uint256 elapsed = block.timestamp - vaultState.hibernationStartTime;
        uint256 months  = (elapsed + 30 days - 1) / 30 days;
        if (months == 0) months = 1;
        if (months > MAX_CATCHUP_MONTHS) months = MAX_CATCHUP_MONTHS;
        return months;
    }

    /// @notice The cost of the next reactivation at current parameters (0 while ACTIVE).
    function getReactivationCost() external view returns (uint256) {
        return UPKEEP_COSTS_MONTHLY[uint256(vaultType)] * 150 / 100 * hibernationMonthsCharged();
    }

    /// @notice P2-2: whether withdrawals and redemptions are currently possible.
    function exitsOpen() public view returns (bool) {
        if (
            vaultState.status == VaultStatus.HIBERNATING
                && block.timestamp < vaultState.hibernationStartTime + EXIT_GRACE_PERIOD
        ) return false;
        if (paused() && block.timestamp < pauseStartTime + EXIT_GRACE_PERIOD) return false;
        return true;
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
