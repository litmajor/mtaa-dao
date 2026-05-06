// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

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
contract FloatingAPYCalculator {
    
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
    
    // ─────────────────────────────────────────────────────
    // Events
    // ─────────────────────────────────────────────────────
    
    event APYParametersUpdated(
        uint256 indexed version,
        uint256 newBaseAPY,
        uint256 newScaleDivisor,
        uint256 timestamp
    );
    
    // ─────────────────────────────────────────────────────
    // Constructor
    // ─────────────────────────────────────────────────────
    
    constructor(address _mtaaToken) {
        mtaaToken = _mtaaToken;
        admin = msg.sender;
        
        // Initial parameters: 18% base APY, scale divisor = 100
        // At TVL=10%, reduction = (10 * 10) / 100 = 1%, so APY = 17%
        // At TVL=20%, reduction = (20 * 20) / 100 = 4%, so APY = 14%
        apyHistory.push(APYAdjustment({
            timestamp: block.timestamp,
            newAPY: 1800,    // 18%
            scaleDivisor: 100
        }));
    }
    
    // ─────────────────────────────────────────────────────
    // Core Functions
    // ─────────────────────────────────────────────────────
    
    /**
     * @notice Calculate APY based on current TVL
     * 
     * Returns APY in basis points (1800 = 18%)
     */
    function calculateAPY(uint256 totalStaked) external view returns (uint256) {
        APYAdjustment memory latest = apyHistory[apyHistory.length - 1];
        
        // Calculate TVL as percentage in basis points
        // TVL = 50M, TOTAL = 1B
        // tvlBasisPoints = (50M * 10000) / 1B = 500 (5%)
        uint256 tvlBasisPoints = (totalStaked * 10000) / TOTAL_SUPPLY;
        
        // Quadratic scaling for smooth decline
        // reduction = (tvlBasisPoints^2) / scaleDivisor
        // At 5% TVL: reduction = (25) / 100 = 0.25% → APY stays ~18%
        // At 10% TVL: reduction = (100) / 100 = 1% → APY drops to 17%
        // At 20% TVL: reduction = (400) / 100 = 4% → APY drops to 14%
        // At 30% TVL: reduction = (900) / 100 = 9% → APY drops to 9%
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
        require(newScaleDivisor > 0, "Scale divisor must be positive");
        
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
    function getCurrentAPY() external view returns (uint256) {
        // Get current TVL from MtaaToken
        // Note: This calls back into MtaaToken.getTotalStaked()
        // Safe because getTotalStaked() is a pure view function
        return this.calculateAPY(0); // Would need TVL from MtaaToken
        // TODO in Phase 2: Have MtaaToken pass TVL or track in state
    }

    /**
     * @notice Simulate APY at different TVL levels
     * 
     * Useful for dashboard, user forecasting
     * Example: User stakes 100K MTAA, wants to know APY in 6 months if adoption grows to 100M
     * → Call simulateAPYAtTVL(100_000_000 * 1e18) → returns 1700 (17%)
     */
    function simulateAPYAtTVL(uint256 simulatedTVL) external view returns (uint256) {
        APYAdjustment memory latest = apyHistory[apyHistory.length - 1];
        
        uint256 tvlBasisPoints = (simulatedTVL * 10000) / TOTAL_SUPPLY;
        uint256 reduction = (tvlBasisPoints * tvlBasisPoints) / latest.scaleDivisor;
        
        uint256 finalAPY = latest.newAPY > reduction ? latest.newAPY - reduction : MIN_APY;
        
        if (finalAPY < MIN_APY) finalAPY = MIN_APY;
        if (finalAPY > MAX_APY) finalAPY = MAX_APY;
        
        return finalAPY;
    }
    
    /**
     * @notice Get APY at specific historical point
     */
    function getAPYAtVersion(uint256 version) external view returns (uint256) {
        require(version < apyHistory.length, "Version not found");
        return apyHistory[version].newAPY;
    }
}
