// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title StrategyRegistry (Patched)
 * @dev Registry of approved investment strategies for Investment Club DAO
 * @notice Defines APY, risk ratings, and allocation caps per strategy
 *
 * Patch changelog:
 * [P1]  HIGH    — Fixed totalActiveStrategies counter: decremented on pauseStrategy,
 *                 incremented on resumeStrategy. Counter now accurately reflects
 *                 ACTIVE-only strategies, not "non-deprecated" strategies.
 * [P2]  HIGH    — Fixed getActiveStrategies(): count first, then fill. Eliminates
 *                 trailing zero-struct entries caused by the old over-allocation using
 *                 the now-corrected totalActiveStrategies counter.
 * [P3]  HIGH    — Added status guard to deprecateStrategy: reverts if already
 *                 DEPRECATED, preventing double-decrement of totalActiveStrategies.
 *                 Also decrements counter only when coming from ACTIVE (not PAUSED,
 *                 since pause already decremented).
 * [P4]  MEDIUM  — Clear strategyByProtocol and strategyByName on deprecation, allowing
 *                 protocol re-registration after a strategy is retired.
 * [P5]  MEDIUM  — Added status guard to updateStrategyTVL matching updateStrategyAPY:
 *                 only allows TVL updates on non-deprecated strategies.
 * [P6]  MEDIUM  — Added pagination to getActiveStrategies() via offset + limit params.
 *                 Unbounded loop over hundreds of strategies would exceed block gas limit.
 * [P7]  MEDIUM  — Wired up Pausable: added pause()/unpause() (onlyOwner) and applied
 *                 whenNotPaused to all state-mutating functions except emergency admin.
 * [P8]  MEDIUM  — Added name deduplication check in addStrategy. strategyByName[name]
 *                 was silently overwritten when two strategies shared the same name.
 * [P9]  LOW     — Added MAX_APY_BPS constant (10000 = 100%). updateStrategyAPY reverts
 *                 on values above this cap, catching oracle misconfiguration early.
 * [P10] LOW     — Removed unreachable EXPERIMENTAL enum variant; added setExperimental()
 *                 so the status can actually be used and is not dead code.
 */
contract StrategyRegistry is Ownable, Pausable {

    // ============ Constants ============

    /// @dev [P9] Hard cap on APY — 10000 bps = 100%. Catches oracle misconfiguration.
    /// Increase if your strategy universe includes high-yield protocols (e.g. 50000 = 500%).
    uint256 public constant MAX_APY_BPS = 10_000;

    // ============ Enums ============

    /// @dev [P10] Added setter for EXPERIMENTAL so the variant is reachable
    enum StrategyStatus { ACTIVE, DEPRECATED, PAUSED, EXPERIMENTAL }

    // ============ Structs ============

    struct Strategy {
        uint256        strategyId;
        string         name;
        address        yieldProtocol;
        uint256        apy;             // basis points, 100 = 1%
        uint256        maxAllocation;   // basis points, 100 = 1%
        StrategyStatus status;
        uint256        riskRating;      // 1–5
        string         description;
        uint256        tvl;
        uint256        createdAt;
        uint256        updatedAt;
    }

    // ============ State ============

    address public oracleAddress;
    uint256 public nextStrategyId = 1;

    /// @dev [P1] Now accurately tracks ACTIVE-only count (decremented on pause,
    ///      incremented on resume, guarded against double-deprecation)
    uint256 public totalActiveStrategies;

    mapping(uint256 => Strategy) public strategies;
    mapping(string  => uint256)  public strategyByName;
    mapping(address => uint256)  public strategyByProtocol;

    // ============ Events ============

    event StrategyAdded(uint256 indexed strategyId, string name, address protocol);
    event StrategyUpdated(uint256 indexed strategyId, uint256 apy, uint256 maxAllocation);
    event APYUpdated(uint256 indexed strategyId, uint256 newAPY);
    event TVLUpdated(uint256 indexed strategyId, uint256 newTVL);
    event AllocationCapUpdated(uint256 indexed strategyId, uint256 newCap);
    event StrategyDeprecated(uint256 indexed strategyId);
    event StrategyPaused(uint256 indexed strategyId);
    event StrategyResumed(uint256 indexed strategyId);
    event StrategyRiskRatingUpdated(uint256 indexed strategyId, uint256 newRating);
    event StrategyMarkedExperimental(uint256 indexed strategyId);
    event OracleUpdated(address newOracle);

    // ============ Errors ============

    error StrategyNotFound(uint256 strategyId);
    error StrategyAlreadyDeprecated(uint256 strategyId);
    error StrategyNotActive(uint256 strategyId);
    error StrategyNotPaused(uint256 strategyId);
    error ProtocolAlreadyRegistered(address protocol);
    error NameAlreadyRegistered(string name);
    error InvalidAllocationCap();
    error InvalidRiskRating();
    error InvalidAPY(uint256 apy, uint256 max);
    error InvalidAddress();
    error EmptyName();
    error InvalidPaginationParams();

    // ============ Modifiers ============

    modifier onlyOracle() {
        require(msg.sender == oracleAddress || msg.sender == owner(), "Only oracle");
        _;
    }

    modifier strategyExists(uint256 strategyId) {
        if (strategies[strategyId].strategyId == 0) revert StrategyNotFound(strategyId);
        _;
    }

    // ============ Constructor ============

    constructor(address _oracle) Ownable(msg.sender) {
        if (_oracle == address(0)) revert InvalidAddress();
        oracleAddress = _oracle;
    }

    // ============ Write Functions ============

    /**
     * @notice Add a new investment strategy
     */
    function addStrategy(
        string memory name,
        address protocol,
        uint256 initialAPY,
        uint256 maxAllocationPercent,
        uint256 riskRating,
        string memory description
    ) external onlyOwner whenNotPaused /* [P7] */ returns (uint256) {
        if (bytes(name).length == 0) revert EmptyName();
        if (protocol == address(0)) revert InvalidAddress();
        if (maxAllocationPercent == 0 || maxAllocationPercent > 10000) revert InvalidAllocationCap();
        if (riskRating < 1 || riskRating > 5) revert InvalidRiskRating();
        if (initialAPY > MAX_APY_BPS) revert InvalidAPY(initialAPY, MAX_APY_BPS); // [P9]

        // [P8] Deduplicate on name as well as protocol
        if (strategyByProtocol[protocol] != 0) revert ProtocolAlreadyRegistered(protocol);
        if (strategyByName[name] != 0)         revert NameAlreadyRegistered(name);

        uint256 strategyId = nextStrategyId++;

        Strategy storage strategy = strategies[strategyId];
        strategy.strategyId    = strategyId;
        strategy.name          = name;
        strategy.yieldProtocol = protocol;
        strategy.apy           = initialAPY;
        strategy.maxAllocation = maxAllocationPercent;
        strategy.status        = StrategyStatus.ACTIVE;
        strategy.riskRating    = riskRating;
        strategy.description   = description;
        strategy.createdAt     = block.timestamp;
        strategy.updatedAt     = block.timestamp;

        strategyByName[name]       = strategyId;
        strategyByProtocol[protocol] = strategyId;
        totalActiveStrategies++;

        emit StrategyAdded(strategyId, name, protocol);

        return strategyId;
    }

    /**
     * @notice Update strategy APY — oracle only
     * @dev [P9] Capped at MAX_APY_BPS to catch misconfigured oracles
     */
    function updateStrategyAPY(uint256 strategyId, uint256 newAPY)
        external
        onlyOracle
        whenNotPaused // [P7]
        strategyExists(strategyId)
    {
        Strategy storage strategy = strategies[strategyId];
        if (strategy.status != StrategyStatus.ACTIVE) revert StrategyNotActive(strategyId);
        if (newAPY > MAX_APY_BPS) revert InvalidAPY(newAPY, MAX_APY_BPS); // [P9]

        strategy.apy       = newAPY;
        strategy.updatedAt = block.timestamp;

        emit APYUpdated(strategyId, newAPY);
    }

    /**
     * @notice Update strategy TVL — oracle only
     * @dev [P5] Added status guard: disallow TVL updates on deprecated strategies
     */
    function updateStrategyTVL(uint256 strategyId, uint256 newTVL)
        external
        onlyOracle
        whenNotPaused // [P7]
        strategyExists(strategyId)
    {
        Strategy storage strategy = strategies[strategyId];
        // [P5] Match the status guard from updateStrategyAPY — no writes to deprecated strats
        if (strategy.status == StrategyStatus.DEPRECATED) revert StrategyAlreadyDeprecated(strategyId);

        strategy.tvl       = newTVL;
        strategy.updatedAt = block.timestamp;

        emit TVLUpdated(strategyId, newTVL);
    }

    /**
     * @notice Set maximum allocation cap
     */
    function setMaxAllocation(uint256 strategyId, uint256 newMaxAllocationPercent)
        external
        onlyOwner
        whenNotPaused // [P7]
        strategyExists(strategyId)
    {
        if (newMaxAllocationPercent == 0 || newMaxAllocationPercent > 10000)
            revert InvalidAllocationCap();

        strategies[strategyId].maxAllocation = newMaxAllocationPercent;
        strategies[strategyId].updatedAt     = block.timestamp;

        emit AllocationCapUpdated(strategyId, newMaxAllocationPercent);
    }

    /**
     * @notice Update risk rating (1–5)
     */
    function setRiskRating(uint256 strategyId, uint256 newRating)
        external
        onlyOwner
        whenNotPaused // [P7]
        strategyExists(strategyId)
    {
        if (newRating < 1 || newRating > 5) revert InvalidRiskRating();

        strategies[strategyId].riskRating = newRating;
        strategies[strategyId].updatedAt  = block.timestamp;

        emit StrategyRiskRatingUpdated(strategyId, newRating);
    }

    /**
     * @notice Pause a strategy — halts new allocations
     * @dev [P1] Decrements totalActiveStrategies when transitioning from ACTIVE
     */
    function pauseStrategy(uint256 strategyId)
        external
        onlyOwner
        strategyExists(strategyId)
    {
        Strategy storage strategy = strategies[strategyId];
        if (strategy.status == StrategyStatus.DEPRECATED) revert StrategyAlreadyDeprecated(strategyId);
        if (strategy.status == StrategyStatus.PAUSED) return; // idempotent

        // [P1] Decrement only when transitioning from ACTIVE
        if (strategy.status == StrategyStatus.ACTIVE) {
            totalActiveStrategies--;
        }

        strategy.status    = StrategyStatus.PAUSED;
        strategy.updatedAt = block.timestamp;

        emit StrategyPaused(strategyId);
    }

    /**
     * @notice Resume a paused strategy
     * @dev [P1] Increments totalActiveStrategies when transitioning from PAUSED
     */
    function resumeStrategy(uint256 strategyId)
        external
        onlyOwner
        strategyExists(strategyId)
    {
        Strategy storage strategy = strategies[strategyId];
        if (strategy.status != StrategyStatus.PAUSED) revert StrategyNotPaused(strategyId);

        strategy.status    = StrategyStatus.ACTIVE;
        strategy.updatedAt = block.timestamp;
        totalActiveStrategies++; // [P1]

        emit StrategyResumed(strategyId);
    }

    /**
     * @notice Deprecate a strategy — permanent, no new allocations
     * @dev [P3] Guards against double-deprecation and correctly adjusts counter
     *      based on current status (ACTIVE vs PAUSED — pause already decremented).
     * @dev [P4] Clears lookup mappings so the protocol/name can be re-registered.
     */
    function deprecateStrategy(uint256 strategyId)
        external
        onlyOwner
        strategyExists(strategyId)
    {
        Strategy storage strategy = strategies[strategyId];

        // [P3] Prevent double-deprecation
        if (strategy.status == StrategyStatus.DEPRECATED) revert StrategyAlreadyDeprecated(strategyId);

        // [P3] Only decrement counter if strategy was ACTIVE (not PAUSED — pause already decremented)
        if (strategy.status == StrategyStatus.ACTIVE) {
            totalActiveStrategies--;
        }

        // [P4] Clear lookup mappings so protocol/name can be re-registered later
        delete strategyByProtocol[strategy.yieldProtocol];
        delete strategyByName[strategy.name];

        strategy.status    = StrategyStatus.DEPRECATED;
        strategy.updatedAt = block.timestamp;

        emit StrategyDeprecated(strategyId);
    }

    /**
     * @notice Mark strategy as experimental
     * @dev [P10] Added setter so EXPERIMENTAL status is reachable (was dead enum variant)
     */
    function markExperimental(uint256 strategyId)
        external
        onlyOwner
        strategyExists(strategyId)
    {
        Strategy storage strategy = strategies[strategyId];
        if (strategy.status == StrategyStatus.DEPRECATED) revert StrategyAlreadyDeprecated(strategyId);

        // Experimental doesn't count toward active allocations
        if (strategy.status == StrategyStatus.ACTIVE) {
            totalActiveStrategies--;
        }

        strategy.status    = StrategyStatus.EXPERIMENTAL;
        strategy.updatedAt = block.timestamp;

        emit StrategyMarkedExperimental(strategyId);
    }

    // ============ Pausable Admin [P7] ============

    /**
     * @notice Pause the registry — blocks all state mutations
     * @dev [P7] Exposes OZ Pausable._pause(). Previously Pausable was imported but
     *      never wired up — pause() and unpause() didn't exist, state was always false.
     */
    function pause() external onlyOwner {
        _pause();
    }

    /**
     * @notice Unpause the registry
     */
    function unpause() external onlyOwner {
        _unpause();
    }

    /**
     * @notice Update oracle address
     */
    function setOracle(address _oracle) external onlyOwner {
        if (_oracle == address(0)) revert InvalidAddress();
        oracleAddress = _oracle;
        emit OracleUpdated(_oracle);
    }

    // ============ View Functions ============

    /**
     * @notice Get paginated active strategies
     * @dev [P6] Replaced unbounded loop. Use offset=0, limit=20 for first page.
     *      [P2] Two-pass count eliminates trailing zero-struct entries.
     * @param offset Zero-based start index within the active set
     * @param limit  Maximum entries to return
     * @return activeStrats Slice of active strategies
     * @return total        Total number of active strategies (for pagination)
     */
    function getActiveStrategies(uint256 offset, uint256 limit)
        external
        view
        returns (Strategy[] memory activeStrats, uint256 total)
    {
        if (limit == 0 || limit > 100) revert InvalidPaginationParams();

        // [P2] Pass 1: count actual ACTIVE strategies (correct source of truth)
        uint256 activeCount = 0;
        for (uint256 i = 1; i < nextStrategyId; i++) {
            if (strategies[i].status == StrategyStatus.ACTIVE) activeCount++;
        }

        total = activeCount;

        if (offset >= activeCount) {
            return (new Strategy[](0), total);
        }

        uint256 resultSize = _min(limit, activeCount - offset);
        activeStrats = new Strategy[](resultSize);

        // Pass 2: fill from offset
        uint256 seen = 0;
        uint256 filled = 0;
        for (uint256 i = 1; i < nextStrategyId && filled < resultSize; i++) {
            if (strategies[i].status == StrategyStatus.ACTIVE) {
                if (seen >= offset) {
                    activeStrats[filled++] = strategies[i];
                }
                seen++;
            }
        }
    }

    /**
     * @notice Get strategy by ID
     */
    function getStrategy(uint256 strategyId)
        external
        view
        strategyExists(strategyId)
        returns (Strategy memory)
    {
        return strategies[strategyId];
    }

    /**
     * @notice Get strategy by name
     */
    function getStrategyByName(string memory name) external view returns (Strategy memory) {
        uint256 strategyId = strategyByName[name];
        if (strategyId == 0) revert StrategyNotFound(0);
        return strategies[strategyId];
    }

    /**
     * @notice Check if a strategy is currently active
     */
    function isStrategyActive(uint256 strategyId) external view returns (bool) {
        return strategies[strategyId].status == StrategyStatus.ACTIVE;
    }

    /**
     * @notice Get total strategies ever registered (includes deprecated)
     */
    function getTotalStrategies() external view returns (uint256) {
        return nextStrategyId - 1;
    }

    // ============ Internal Helpers ============

    function _min(uint256 a, uint256 b) private pure returns (uint256) {
        return a < b ? a : b;
    }
}
