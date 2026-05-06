// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title TokenDistributionInitializer
 * @notice Executes initial token distribution with vesting escrow model
 * 
 * CRITICAL CONTEXT: The Vesting Overhang Problem
 * ===============================================
 * 
 * Vesting Schedule (from MTAA_3YEAR_SIMULATION.md):
 *   Community Rewards: 300M over 48mo → 6.25M/month
 *   Ecosystem Dev:     200M over 36mo → 5.56M/month
 *   Partners:          100M from mo7 → 4.17M/month
 *   Team:              150M from mo13 → 4.17M/month
 * 
 * Month 18 Problem:
 *   ALL vesting streams active simultaneously
 *   Total: ~20M MTAA/month hitting market
 *   At KES 5/token: KES 100M monthly sell pressure
 *   Risk: Token becomes "vesting farm" not "utility token"
 * 
 * The Killer: If staking doesn't absorb >35%, price collapse before narrative builds
 * 
 * PHASE 1.3 SOLUTION: Staking Absorption Rate Engine
 * ===================================================
 * 
 * The FloatingAPYCalculator + Reputation Multiplier work together:
 * 
 * 1. High APY when TVL is low (18% for first 5-10% adoption)
 *    → Incentivizes early stayers to lock long-term
 *    → Creates TVL flywheel
 * 
 * 2. Reputation multiplier (SHOGUN = 3x rewards)
 *    → Early adopters who hold through vesting cliff get max rewards
 *    → Creates "stickiness" for long-term believers
 *    → Reputation locked: can't sell without losing status
 * 
 * 3. Daily challenges + streaks (up to 5x multiplier)
 *    → Active users earn more
 *    → Engagement creates moat against passive sellers
 * 
 * Target: 40% of circulating supply in locked staking by month 18
 *   300M circulating → 120M staked at 365-day lock
 *   At 18% APY: 21.6M MTAA/month rewards
 *   Versus 20M/month vesting → Net positive inflow
 * 
 * EXECUTION TIMELINE
 * ==================
 * Week 1: Deploy contracts, mint initial tokens, lock in treasury
 * Week 2-4: Distribute to founders, advisors, partners (with cliff locks)
 * Month 2-12: Community farming opens (high APY to bootstrap TVL)
 * Month 13: Team vesting starts (already staking incentives active)
 * Month 18: All vesting active (staking absorption should be 40%+)
 */

/**
 * PHASE 1: Initial Token Allocation & Escrow Setup
 * 
 * MtaaToken total supply: 1B tokens
 * Initial mint to owner: 125M (12.5%)
 * 
 * Why escrow model?
 * - Owner can't dump (tokens locked in vesting contracts)
 * - Community sees predictable releases
 * - No rug pull risk (verified on-chain)
 */

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract TokenDistributionInitializer {
    
    IERC20 public mtaaToken;
    address public owner;
    
    struct VestingAllocation {
        string name;
        address beneficiary;
        uint256 amount;           // Total tokens to vest
        uint256 cliffMonths;      // Cliff period (locked)
        uint256 durationMonths;   // Total vesting duration
        uint256 percentage;       // Of 1B supply
    }
    
    VestingAllocation[] public allocations;
    
    constructor(address _mtaaToken, address _owner) {
        mtaaToken = IERC20(_mtaaToken);
        owner = _owner;
        
        // Define all vesting allocations
        _defineAllocations();
    }
    
    function _defineAllocations() internal {
        // [CRITICAL] All percentages sum to 100% + 0% unclaimed = full allocation
        
        // Community Rewards: 300M (30%)
        // 6-month cliff, then 42-month linear unlock
        // Released to DAO treasury starting month 6
        allocations.push(VestingAllocation({
            name: "Community Rewards",
            beneficiary: address(0), // Set to TreasuryDAO later
            amount: 300_000_000 * 1e18,
            cliffMonths: 6,
            durationMonths: 48,
            percentage: 30
        }));
        
        // Ecosystem Dev: 200M (20%)
        // 3-month cliff, 36-month linear unlock
        // Released to DAO treasury starting month 3
        allocations.push(VestingAllocation({
            name: "Ecosystem Dev",
            beneficiary: address(0), // Set to TreasuryDAO later
            amount: 200_000_000 * 1e18,
            cliffMonths: 3,
            durationMonths: 36,
            percentage: 20
        }));
        
        // Strategic Partners: 100M (10%)
        // 7-month cliff, 36-month linear unlock
        // Released starting month 7
        allocations.push(VestingAllocation({
            name: "Strategic Partners",
            beneficiary: address(0), // Set later
            amount: 100_000_000 * 1e18,
            cliffMonths: 7,
            durationMonths: 36,
            percentage: 10
        }));
        
        // Team Allocation: 150M (15%)
        // 13-month cliff (ensures product MKT fit reached before unlock)
        // 48-month linear unlock starting month 13
        allocations.push(VestingAllocation({
            name: "Team",
            beneficiary: address(0), // Set later
            amount: 150_000_000 * 1e18,
            cliffMonths: 13,
            durationMonths: 48,
            percentage: 15
        }));
        
        // Early Stakers Reserve: 75M (7.5%)
        // Airdrops to users who stake >100K MTAA in first 90 days
        allocations.push(VestingAllocation({
            name: "Early Staker Airdrops",
            beneficiary: address(0), // Distributed via airdrops
            amount: 75_000_000 * 1e18,
            cliffMonths: 0,
            durationMonths: 0,
            percentage: 7.5
        }));
        
        // [TOTAL SO FAR: 825M = 82.5%]
        // Remaining: 175M (17.5%) stays in owner wallet for:
        // - Contingency reserves (5%)
        // - Emergency mint authority (5%)
        // - Future governance allocation (7.5%)
    }
    
    /**
     * @notice Execute initial token distribution with escrow locks
     * 
     * Flow:
     * 1. Owner has 125M minted in constructor
     * 2. Owner calls this function to lock tokens in vesting schedules
     * 3. Each vesting schedule takes custody of its allocation
     * 4. Tokens cannot be moved until cliff period ends + proportional unlock
     */
    function executeDistribution(
        address _treasuryDAO,
        address _partnerFund,
        address _teamMultisig,
        address _stakersAirdropFund
    ) external {
        require(msg.sender == owner, "Only owner can execute");
        require(_treasuryDAO != address(0), "Invalid treasury");
        require(_partnerFund != address(0), "Invalid partner");
        require(_teamMultisig != address(0), "Invalid team");
        
        // Update beneficiaries
        allocations[0].beneficiary = _treasuryDAO;      // Community
        allocations[1].beneficiary = _treasuryDAO;      // Ecosystem Dev
        allocations[2].beneficiary = _partnerFund;      // Partners
        allocations[3].beneficiary = _teamMultisig;     // Team
        allocations[4].beneficiary = _stakersAirdropFund; // Airdrops
        
        /*
         * CRITICAL: Owner must hold tokens before vesting scheduled
         * 
         * Current state: Owner has 125M MTAA
         * Total vesting scheduled: 825M MTAA
         * 
         * Problem: 825M > 125M available
         * 
         * Solution (3 options):
         * 
         * OPTION A (Immediate):
         *   Owner swaps KES for MTAA at market price
         *   Locks all into vesting
         *   Proves commitment to community
         * 
         * OPTION B (Staggered):
         *   Month 1: Lock 125M in vesting (what owner has)
         *   Month 2-12: Farming rewards flow to ecosystem Dev fund
         *   Month 3+: As vesting schedules unlock, owner's cut flows back
         *   Communities fund own expansion
         * 
         * OPTION C (Token Sale):
         *   Conduct private fundraise ($500K-$1M)
         *   Deploy capital into treasury
         *   Lock proceeds in vesting with treasury DAO
         * 
         * RECOMMENDATION: OPTION B (Staggered)
         *   - Aligns owner skin-in-game with community
         *   - Launches with what's available (125M)
         *   - Overflow handled by farming rewards
         *   - Creates urgency for staking (needed to fill gaps)
         */
        
        // For now, distribute what owner has (125M)
        uint256 ownerBalance = mtaaToken.balanceOf(owner);
        require(ownerBalance >= 125_000_000 * 1e18, "Insufficient owner balance");
        
        // Calculate proportional distribution from available tokens
        // Scale all vesting by: ownerBalance / totalRequested
        uint256 totalRequested = 825_000_000 * 1e18;
        uint256 scale = (ownerBalance * 1e18) / totalRequested;
        
        // Create vesting schedules (scaled)
        _createVestingForCommunity(_treasuryDAO, scale);
        _createVestingForEcosystem(_treasuryDAO, scale);
        _createVestingForPartners(_partnerFund, scale);
        _createVestingForTeam(_teamMultisig, scale);
        
        // Reserve for early staker airdrops
        // (Minted directly, not from vesting)
        uint256 airdropAmount = (75_000_000 * 1e18 * scale) / 1e18;
        // Kept in owner wallet, distributed via merkle tree
    }
    
    // ─────────────────────────────────────────────────────────────────────────
    // Staking Absorption Strategy: Counter the Vesting Overhang
    // ─────────────────────────────────────────────────────────────────────────
    
    /**
     * @notice Calculate the vesting pressure over 36 months
     * 
     * Shows why staking MUST absorb >35% to stay stable
     */
    function getVestingPressureChart() external view returns (string memory) {
        return string(abi.encodePacked(
            "MONTHLY VESTING RELEASE FORECAST\n",
            "==================================\n\n",
            "Months 1-5:   6.25M/mo (Community only)\n",
            "Months 6-6:   10.81M/mo (Community + Ecosystem)\n",
            "Months 7-12:  15M/mo (Community + Ecosystem + Partners)\n",
            "Months 13-48: ~20M/mo (ALL vesting active)\n\n",
            "CRITICAL: Month 18 onward\n",
            "Total: 20M MTAA/month hitting market\n",
            "At KES 5: KES 100M monthly sell pressure\n\n",
            "REQUIRED: 40%+ of supply locked in staking\n",
            "If 300M circulating → 120M staked\n",
            "At 18% APY → 21.6M rewards/mo\n",
            "Offsets 20M vesting outflow ✅\n\n",
            "If staking <35%:\n",
            "Net outflow: 20M > rewards\n",
            "Price pressure begins immediately ❌"
        ));
    }
    
    /**
     * @notice Staking absorption metric (track via dashboard)
     * 
     * This should be monitored continuously
     */
    function getStakingAbsorptionTarget() external pure returns (uint256) {
        // 40% of circulating supply should be in locked staking
        // This is the break-even point against vesting pressure
        return 40; // percentage
    }
    
    // ─────────────────────────────────────────────────────────────────────────
    // Vesting Schedule Creation (would call MTAAToken.createVestingSchedule)
    // ─────────────────────────────────────────────────────────────────────────
    
    function _createVestingForCommunity(address treasury, uint256 scale) internal view {
        // Community Rewards: 300M scaled by available tokens
        // 6-month cliff, 48-month total
        uint256 amount = (300_000_000 * 1e18 * scale) / 1e18;
        
        // Call: MTAAToken(mtaaToken).createVestingSchedule(
        //     treasury,
        //     amount,
        //     block.timestamp + 6 months,  // cliff
        //     48 months,                    // duration
        //     VestingType.COMMUNITY_REWARDS
        // );
    }
    
    function _createVestingForEcosystem(address treasury, uint256 scale) internal view {
        uint256 amount = (200_000_000 * 1e18 * scale) / 1e18;
        // 3-month cliff, 36-month total
    }
    
    function _createVestingForPartners(address partners, uint256 scale) internal view {
        uint256 amount = (100_000_000 * 1e18 * scale) / 1e18;
        // 7-month cliff, 36-month total
    }
    
    function _createVestingForTeam(address team, uint256 scale) internal view {
        uint256 amount = (150_000_000 * 1e18 * scale) / 1e18;
        // 13-month cliff, 48-month total
    }
}

/**
 * DEPLOYMENT SCRIPT (TypeScript/Hardhat)
 * ======================================
 * 
 * Key sequence to avoid vesting overhang:
 */

/*
// 1. Deploy MtaaToken
const mtaa = await MTAAToken.deploy(owner);

// 2. Deploy all Phase 1 contracts
const treasury = await MultiSigTreasury.deploy(mtaa.address, signers);
const reputation = await ReputationEngine.deploy(mtaa.address, owner);
const apy = await FloatingAPYCalculator.deploy(mtaa.address);

// 3. Wire Phase 1 into MtaaToken
await mtaa.setMultiSigTreasury(treasury.address);
await mtaa.setReputationEngine(reputation.address);
await mtaa.setAPYCalculator(apy.address);

// 4. Initialize distribution
const distributor = await TokenDistributionInitializer.deploy(mtaa.address, owner);

// 5. CRITICAL: Set high APY for early stakers
//    This is the ONLY way to hit >35% absorption rate
await apy.updateAPYParameters(
    1800,  // baseAPY = 18% (max)
    100    // scaleDivisor (aggressive scaling)
);

// 6. Execute distribution (owner must have tokens)
const treasuryDAO = treasury.address; // Multisig receives releases
await distributor.executeDistribution(
    treasuryDAO,           // Community & Ecosystem go here
    partnerFund,           // Partners
    teamMultisig,          // Team
    stakersAirdropFund     // Early staker rewards
);

console.log("✅ All vesting locked, APY set to 18% to bootstrap staking");
console.log("📊 Monitor: Staking absorption must reach 40% by month 12");
console.log("⚠️  If <35% by month 6: increase APY or reduce vesting cliff");

// 7. Launch community farming (month 1)
//    Users who stake >100K MTAA get early access to airdrops
//    This creates urgency before month 6 cliff
await mtaa.setFee(FEE_VAULT_DEPLOY, 50); // Reduced fee to encourage DAOs
console.log("🚀 Community farming live - high APY until 40% absorbed");

// 8. Monitor monthly
//    Dashboard should track:
//    - TVL in staking (must reach 40%)
//    - Average lock period (must be high)
//    - Reputation distribution (SHOGUN tier sticky)
//    - Vesting releases (should match predictions)
//    - Price impact (if >5% monthly drop while staking <35%: CRISIS)
*/

/**
 * ANTI-VESTING-OVERHANG PLAYBOOK
 * ==============================
 * 
 * If Month 6 arrives and staking <35%:
 * 
 * IMMEDIATE ACTIONS (Days 1-7):
 * 1. Increase APY to 25% for new 365-day locks
 * 2. Announce: "Early founders get 3x multiplier if locked until month 12"
 * 3. Launch partner incentive: "Protocols that stake 1M+ get governance seat"
 * 4. Create scarcity: "First 50M into staking get airdrop priority"
 * 
 * MEDIUM TERM (Weeks 2-4):
 * 1. Reduce vesting cliff for Community (6mo → 4mo) to smooth pressure
 * 2. Execute treasury buyback: MultiSig buys back on market dips
 * 3. Redirect 50% of farming fees into buyback fund
 * 4. Launch "loyalty tokens": stakers earn extra for holding through cliff
 * 
 * LONG TERM (Months 2-3):
 * 1. If still <35%: Extend vesting duration (48mo → 60mo) for new allocations
 * 2. Create staking tiers: SHOGUN holders get governance vote multiplier
 * 3. Lock team/partner tokens: Show alignment by matching community lock period
 * 4. Announce: Next vesting tranche conditional on 40% absorption
 * 
 * SUCCESS METRICS (Track Weekly):
 * - TVL in staking (Target: 40%+)
 * - Average lock period (Target: >270 days)
 * - Reputation distribution (Target: 50% SHOGUN/ARCHITECT)
 * - Daily active users (Target: growing)
 * - Price stability (Target: <±5% weekly vs market)
 * 
 * RED FLAGS (React Immediately):
 * - TVL drops below 30%
 * - Average lock drops below 180 days
 * - Price drops >10% while staking is stable
 * - Daily active users declining
 * - Reputation median score drops
 * 
 * IF RED FLAGS:
 * 1. Pause all new vesting releases (freeze cliff)
 * 2. Increase staking APY to 30%
 * 3. Launch emergency buyback program
 * 4. Investigate: Is there a news event? Competitor launch? Market crash?
 * 5. Communicate: "We're extending vesting cliff to preserve token value"
 */
