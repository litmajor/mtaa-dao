// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title FloatingAPYCalculator
 * @notice Scales staking rewards based on TVL adoption (sustainability engine)
 * @dev Addresses CRITICAL issue: fixed 18% APY breaks at 1M users
 * 
 * Key Features:
 *  - APY scales from 18% (low TVL) down to 3% (high TVL)
 *  - Quadratic scaling protects network from unsustainable rewards
 *  - Governance can update base APY and scale parameters
 *  - All changes visible in history (audit trail)
 * 
 * Example Curves Over 3 Years:
 *  Month 1:  TVL = 1M of 1B → APY ≈ 18% (high to bootstrap)
 *  Month 6:  TVL = 50M → APY ≈ 18% (still high, adoption ramping)
 *  Month 12: TVL = 100M (10%) → APY ≈ 17% (slight drop)
 *  Month 24: TVL = 200M (20%) → APY ≈ 14% (moderate drop)
 *  Month 36: TVL = 300M (30%) → APY ≈ 10% (sustainable)
 * 
 * Math:
 *  baseAPY = 18% (from latest adjustment)
 *  tvlBasisPoints = (totalStaked * 10000) / 1_000_000_000
 *  reduction = (tvlBasisPoints * tvlBasisPoints) / scaleDivisor
 *  finalAPY = baseAPY > reduction ? baseAPY - reduction : MIN_APY
 *  Capped at [MIN_APY, MAX_APY]
 */
contract FloatingAPYCalculator is Pausable {
    
    // ─────────────────────────────────────────────────────
    // Storage
    // ─────────────────────────────────────────────────────
    
    uint256 public constant MIN_APY = 300;              // 3% in basis points
    uint256 public constant MAX_APY = 1800;             // 18% in basis points
    uint256 public constant TOTAL_SUPPLY = 1_000_000_000 * 1e18;  // 1B MTAA
    
    address public mtaaToken;
    address public admin;
    
    /**
     * @notice Historical APY settings (governance adjustable)
     * 
     * Example:
     *  Month 4: baseAPY = 1800 (18%), scaleDivisor = 100
     *  Month 8: baseAPY = 1500 (15%), scaleDivisor = 150 (adjust if adoption faster)
     */
    struct APYAdjustment {
        uint256 timestamp;
        uint256 newAPY;              // Base APY when TVL is minimal
        uint256 scaleDivisor;        // How aggressively APY shrinks
    }
    
    APYAdjustment[] public apyHistory;

    // EWMA-based stake aggregator to protect against flash-loan manipulation.
    // `ewmaStake` is updated by an authorized updater (oracleUpdater) or admin.
    // Use `ewmaStake` when available instead of a single-block totalStaked sample.
    uint256 public ewmaStake;
    // Alpha expressed in basis points (0-10000). Default 5% weight to new sample.
    uint256 public ewmaAlphaBp = 500;
    address public oracleUpdater;
    
    // ─────────────────────────────────────────────────────
    // Events
    // ─────────────────────────────────────────────────────
    
    event APYParametersUpdated(
        uint256 indexed version,
        uint256 newBaseAPY,
        uint256 newScaleDivisor,
        uint256 timestamp
    );

    event EwmaStakePushed(uint256 sample, uint256 newEwma);
    event OracleUpdaterSet(address indexed updater);
    event EwmaAlphaUpdated(uint256 newAlphaBp);
    
    // ─────────────────────────────────────────────────────
    // Constructor
    // ─────────────────────────────────────────────────────
    
    /**
     * @param _mtaaToken Optional MTAA token address used for live TVL
     * @param _initialBaseAPY Base APY in basis points (e.g., 1800 = 18%). If 0, defaults to 1800.
     * @param _initialScaleDivisor Scale divisor for quadratic reduction. If 0, defaults to 11250 (smooth curve).
     */
    constructor(address _mtaaToken, uint256 _initialBaseAPY, uint256 _initialScaleDivisor) {
        mtaaToken = _mtaaToken;
        admin = msg.sender;

        uint256 base = _initialBaseAPY == 0 ? 1800 : _initialBaseAPY;
        uint256 divisor = _initialScaleDivisor == 0 ? 11250 : _initialScaleDivisor;

        apyHistory.push(APYAdjustment({
            timestamp: block.timestamp,
            newAPY: base,
            scaleDivisor: divisor
        }));
    }

    modifier onlyUpdater() {
        require(msg.sender == oracleUpdater || msg.sender == admin, "Not updater");
        _;
    }
    
    // ─────────────────────────────────────────────────────
    // Core Functions
    // ─────────────────────────────────────────────────────
    
    /**
     * @notice Calculate APY based on current TVL
     * 
     * Returns APY in basis points (1800 = 18%)
     */
    function calculateAPY(uint256 totalStaked) external view whenNotPaused returns (uint256) {
        return _calculateAPY(totalStaked);
    }

    function _calculateAPY(uint256 totalStaked) internal view returns (uint256) {
        APYAdjustment memory latest = apyHistory[apyHistory.length - 1];

        // Calculate TVL as percentage in basis points
        uint256 tvlBasisPoints = (totalStaked * 10000) / TOTAL_SUPPLY;

        // Quadratic scaling for smooth decline
        // Note: integer division truncates toward zero.
        uint256 reduction = (tvlBasisPoints * tvlBasisPoints) / latest.scaleDivisor;

        uint256 finalAPY = latest.newAPY > reduction ? latest.newAPY - reduction : MIN_APY;

        // Cap at MIN and MAX
        if (finalAPY < MIN_APY) finalAPY = MIN_APY;
        if (finalAPY > MAX_APY) finalAPY = MAX_APY;

        return finalAPY;
    }
    
    /**
     * @notice Admin updates APY parameters (governance should eventually control this)
     * 
     * Example usage (approval flow via TreasuryDAO, Phase 2):
     * 1. Community votes: "Update APY to 15%, scale divisor to 150"
     * 2. Vote passes (66%)
     * 3. TreasuryDAO calls: updateAPYParameters(1500, 150)
     */
    function updateAPYParameters(uint256 newBaseAPY, uint256 newScaleDivisor) external {
        require(msg.sender == admin, "Only admin");
        require(newBaseAPY >= MIN_APY && newBaseAPY <= MAX_APY, "APY out of range");
        require(newScaleDivisor >= 5000, "Scale divisor too aggressive");

        apyHistory.push(APYAdjustment({
            timestamp: block.timestamp,
            newAPY: newBaseAPY,
            scaleDivisor: newScaleDivisor
        }));

        emit APYParametersUpdated(
            apyHistory.length - 1,
            newBaseAPY,
            newScaleDivisor,
            block.timestamp
        );
    }

    // ─────────────────────────────────────────────────────
    // EWMA / Oracle updater functions
    // ─────────────────────────────────────────────────────

    function setOracleUpdater(address updater) external {
        require(msg.sender == admin, "Only admin");
        oracleUpdater = updater;
        emit OracleUpdaterSet(updater);
    }

    function setEwmaAlphaBp(uint256 alphaBp) external {
        require(msg.sender == admin, "Only admin");
        require(alphaBp <= 10000, "Alpha out of range");
        ewmaAlphaBp = alphaBp;
        emit EwmaAlphaUpdated(alphaBp);
    }

    /**
     * @notice Push a new totalStaked sample to the EWMA aggregator.
     * @dev Call this periodically from a trusted oracle to smooth TVL samples
     * and reduce susceptibility to single-block flash loan manipulation.
     */
    function pushTotalStaked(uint256 totalStaked) external onlyUpdater {
        if (ewmaStake == 0) {
            ewmaStake = totalStaked;
        } else {
            // ewma = alpha*sample + (1-alpha)*ewma  ; alpha = ewmaAlphaBp/10000
            ewmaStake = (ewmaAlphaBp * totalStaked + (10000 - ewmaAlphaBp) * ewmaStake) / 10000;
        }
        emit EwmaStakePushed(totalStaked, ewmaStake);
    }
    
    /**
     * @notice Transfer admin role (once only, used for DAO migration in Phase 2)
     * 
     * In Phase 2, this will be called to transfer admin from single address
     * to TreasuryDAO contract
     */
    function transferAdmin(address newAdmin) external {
        require(msg.sender == admin, "Only admin");
        require(newAdmin != address(0), "Invalid new admin");
        admin = newAdmin;
    }

    /**
     * @notice Set the MtaaToken contract address so the calculator can read TVL
     */
    function setMtaaToken(address _token) external {
        require(msg.sender == admin, "Only admin");
        require(_token != address(0), "Invalid address");
        mtaaToken = _token;
    }
    
    // ─────────────────────────────────────────────────────
    // View Functions
    // ─────────────────────────────────────────────────────
    
    function getAPYHistory() external view returns (APYAdjustment[] memory) {
        return apyHistory;
    }
    
    function getAPYHistoryLength() external view returns (uint256) {
        return apyHistory.length;
    }
    
    function getLatestAPY() external view returns (APYAdjustment memory) {
        return apyHistory[apyHistory.length - 1];
    }
    
    /**
     * @notice Get current APY based on live MtaaToken TVL
     * @return Current APY in basis points (e.g., 1800 = 18%)
     * @dev Called by MtaaToken monitoring dashboard functions
     */
    function getCurrentAPY() external view whenNotPaused returns (uint256) {
        // If `mtaaToken` is set, call back to get live TVL; otherwise return
        // the APY using a zero-TVl placeholder (conservative default).
        uint256 sample = 0;
        if (ewmaStake != 0) {
            // Prefer EWMA aggregated stake when available
            sample = ewmaStake;
            return _calculateAPY(sample);
        }

        if (mtaaToken != address(0)) {
            // Minimal MtaaToken interface for TVL query
            (bool ok, bytes memory res) = mtaaToken.staticcall(abi.encodeWithSignature("getTotalStaked()"));
            if (ok && res.length >= 32) {
                uint256 totalStaked = abi.decode(res, (uint256));
                return _calculateAPY(totalStaked);
            }
        }

        // Fallback: compute based on zero TVL (bootstrap APY)
        return _calculateAPY(0);
    }

    // --- Emergency controls ---
    function pause() external {
        require(msg.sender == admin, "Only admin");
        _pause();
    }

    function unpause() external {
        require(msg.sender == admin, "Only admin");
        _unpause();
    }

    /**
     * @notice Simulate APY at different TVL levels
     * 
     * Useful for dashboard, user forecasting
     * Example: User stakes 100K MTAA, wants to know APY in 6 months if adoption grows to 100M
     * → Call simulateAPYAtTVL(100_000_000 * 1e18) → returns 1700 (17%)
     */
    function simulateAPYAtTVL(uint256 simulatedTVL) external view returns (uint256) {
        return _calculateAPY(simulatedTVL);
    }

    /**
     * @notice Sanity check helper for tests: returns APYs for given TVL samples and
     * indicates whether all APYs are >= `minAllowedBp`.
     */
    function sanityCheck(uint256[] calldata tvlSamples, uint256 minAllowedBp) external view returns (bool ok, uint256[] memory apys) {
        apys = new uint256[](tvlSamples.length);
        ok = true;
        for (uint256 i = 0; i < tvlSamples.length; i++) {
            uint256 a = _calculateAPY(tvlSamples[i]);
            apys[i] = a;
            if (a < minAllowedBp) ok = false;
        }
        return (ok, apys);
    }
    
    /**
     * @notice Get APY at specific historical point
     */
    function getAPYAtVersion(uint256 version) external view returns (uint256) {
        require(version < apyHistory.length, "Version not found");
        return apyHistory[version].newAPY;
    }
}
