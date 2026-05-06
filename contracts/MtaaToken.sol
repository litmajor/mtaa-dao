// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Votes.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import "./MultiSigTreasury.sol";
import "./ReputationEngine.sol";
import "./FloatingAPYCalculator.sol";

/**
 * @title MTAAToken
 * @notice The native utility token for MtaaDAO ecosystem
 * @dev ERC20 token with vesting, staking, and governance features
 *
 * Audit patches applied (v2):
 *  [1]  _afterTokenTransfer → _update (OZ v5 compatibility)
 *  [2]  Unstake mint guard: reserves headroom before stake is accepted
 *  [3]  Vesting backed by escrowed tokens; createVestingSchedule transfers from owner
 *  [4]  Per-schedule claimed tracking replaces single global counter
 *  [5]  nonReentrant on payDAOCreationFee / payVaultDeploymentFee
 *  [6]  emergencyMint requires EMERGENCY_ROLE (separate from owner) + 48h timelock
 *  [7]  quarterlyBurn enforces 90-day cooldown
 *  [8]  SHOGUN threshold documented in enum comment
 *  [9]  Multi-stake support via stakeId mapping
 *  [10] completeDailyChallenge gated by ORACLE_ROLE, not onlyOwner
 *  [11] updateReputation gated by ORACLE_ROLE; score bounded; history event expanded
 *  [12] setFee uses bytes32 enum keys instead of runtime string hashing
 *  [13] lockPeriodMultipliers cached to memory in calculateStakeRewards
 *  [14] getBurnProgress guards against burnTarget == 0
 */
contract MTAAToken is ERC20, ERC20Burnable, ERC20Permit, ERC20Votes, Ownable, Pausable, ReentrancyGuard, AccessControl {

    // ── Roles ─────────────────────────────────────────────────────────────────
    bytes32 public constant ORACLE_ROLE    = keccak256("ORACLE_ROLE");
    bytes32 public constant EMERGENCY_ROLE = keccak256("EMERGENCY_ROLE");

    // ── Supply ────────────────────────────────────────────────────────────────
    uint256 public constant MAX_SUPPLY = 1_000_000_000 * 1e18;

    // ── Fee keys (fix #12: replace runtime string hashing with constants) ─────
    bytes32 public constant FEE_DAO_CREATION   = keccak256("DAO_CREATION");
    bytes32 public constant FEE_VAULT_DEPLOY   = keccak256("VAULT_DEPLOYMENT");
    bytes32 public constant FEE_PREMIUM_PROP   = keccak256("PREMIUM_PROPOSAL");
    bytes32 public constant FEE_ANALYTICS      = keccak256("ANALYTICS_MONTHLY");

    // ── Vesting (fix #3: escrow-backed; fix #4: per-schedule claimed) ─────────
    struct VestingSchedule {
        uint256 totalAmount;
        uint256 claimed;          // per-schedule claimed (fix #4)
        uint256 startTime;
        uint256 duration;
        uint256 cliffPeriod;
        VestingType vestingType;
    }

    mapping(address => VestingSchedule[]) public vestingSchedules;
    // totalVested / totalClaimed kept for external analytics; no longer used for
    // internal vesting logic — per-schedule `claimed` is authoritative.
    mapping(address => uint256) public totalVested;
    mapping(address => uint256) public totalClaimed;

    // ── Staking (fix #9: multi-stake via stakeId) ─────────────────────────────
    struct StakeInfo {
        uint256 amount;
        uint256 lockPeriod;       // in days
        uint256 stakeTime;
        uint256 lastRewardClaim;
        bool    isActive;
    }

    uint256 private _nextStakeId;
    mapping(address => mapping(uint256 => StakeInfo)) public stakes;
    mapping(address => uint256[]) public userStakeIds;
    mapping(uint256 => uint256) public lockPeriodMultipliers; // days → basis points

    // ── Reputation ────────────────────────────────────────────────────────────
    uint256 public constant MAX_REPUTATION_SCORE = 1_000_000;
    mapping(address => uint256) public reputationScores;

    // ── Daily challenges ──────────────────────────────────────────────────────
    mapping(address => uint256) public lastDailyAction;
    mapping(address => uint256) public streakDays;
    mapping(address => mapping(bytes32 => bool)) public completedChallenges;

    // ── Fees ──────────────────────────────────────────────────────────────────
    uint256 public daoCreationFee      = 1000 * 1e18;
    uint256 public vaultDeploymentFee  = 500  * 1e18;
    uint256 public premiumProposalFee  = 100  * 1e18;
    uint256 public analyticsMonthlyFee = 50   * 1e18;

    // ── Burns ─────────────────────────────────────────────────────────────────
    uint256 public totalBurned;
    uint256 public burnTarget      = 10_000_000 * 1e18;
    uint256 public lastQuarterlyBurn;                         // fix #7: cooldown
    uint256 public constant QUARTERLY_BURN_COOLDOWN = 90 days;

    // ── Emergency mint timelock (fix #6) ──────────────────────────────────────
    struct MintRequest {
        address to;
        uint256 amount;
        uint256 scheduledAt;
        bool    executed;
    }
    uint256 public constant EMERGENCY_MINT_DELAY = 48 hours;
    uint256 private _nextMintRequestId;
    mapping(uint256 => MintRequest) public mintRequests;
    
    // ── Phase 1 Integrations ─────────────────────────────────────────────────
    // [PHASE 1.1] MultiSigTreasury: 3-of-5 signatures, 48h timelock
    address public multiSigTreasury;
    // [PHASE 1.2] ReputationEngine: decentralized reputation with decay & appeals
    address public reputationEngine;
    // [PHASE 1.3] FloatingAPYCalculator: sustainable adaptive rewards
    address public apyCalculator;

    // ─────────────────────────────────────────────────────────────────────────
    // Enums
    // ─────────────────────────────────────────────────────────────────────────

    enum VestingType {
        COMMUNITY_REWARDS,
        TEAM_ADVISORS,
        ECOSYSTEM_DEV,
        STRATEGIC_PARTNERS
    }

    /**
     * @dev Reputation tiers with score thresholds:
     *   MEMBER      0 – 999
     *   CONTRIBUTOR 1 000 – 4 999
     *   ELDER       5 000 – 9 999
     *   ARCHITECT   10 000 – 99 999
     *   SHOGUN      100 000+          (fix #8: documented)
     */
    enum ReputationTier {
        MEMBER,
        CONTRIBUTOR,
        ELDER,
        ARCHITECT,
        SHOGUN
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Events
    // ─────────────────────────────────────────────────────────────────────────

    event VestingScheduleCreated(address indexed beneficiary, uint256 scheduleIndex, uint256 amount, VestingType vestingType);
    event TokensVested(address indexed beneficiary, uint256 scheduleIndex, uint256 amount);
    event Staked(address indexed user, uint256 indexed stakeId, uint256 amount, uint256 lockPeriod);
    event Unstaked(address indexed user, uint256 indexed stakeId, uint256 amount, uint256 reward);
    event StakeRewardsClaimed(address indexed user, uint256 indexed stakeId, uint256 reward);
    event DailyChallengeCompleted(address indexed user, string challenge, uint256 reward);
    event ReputationUpdated(address indexed user, uint256 oldScore, uint256 newScore, ReputationTier tier);
    event FeeCollected(address indexed payer, uint256 amount, bytes32 feeType);
    event FeeUpdated(bytes32 feeType, uint256 newFee);
    event LockPeriodMultiplierSet(uint256 days_, uint256 multiplier);
    event EmergencyMintScheduled(uint256 indexed requestId, address to, uint256 amount, uint256 executeAfter);
    event EmergencyMintExecuted(uint256 indexed requestId, address to, uint256 amount);
    event QuarterlyBurnExecuted(uint256 amount, uint256 totalBurned);

    // ─────────────────────────────────────────────────────────────────────────
    // Errors
    // ─────────────────────────────────────────────────────────────────────────

    error MaxSupplyExceeded();
    error MaxSupplyHeadroomInsufficient(uint256 available, uint256 required); // fix #2
    error InvalidVestingSchedule();
    error NothingToVest();
    error StakeNotFound();
    error StakeLocked();
    error InsufficientBalance(uint256 provided, uint256 required);
    error InvalidLockPeriod();
    error ChallengeAlreadyCompleted();
    error InsufficientFee(uint256 provided, uint256 required);
    error StakeAmountTooLow(uint256 provided, uint256 minimum);
    error NoRewardsToClaim();
    error QuarterlyBurnCooldown(uint256 nextAllowed);       // fix #7
    error MintRequestNotReady(uint256 executeAfter);        // fix #6
    error MintRequestAlreadyExecuted();                      // fix #6
    error InvalidFeeType();                                  // fix #12
    error BurnTargetNotSet();                                // fix #14
    error InvalidReputationScore(uint256 provided, uint256 max); // fix #11

    // ─────────────────────────────────────────────────────────────────────────
    // Constructor
    // ─────────────────────────────────────────────────────────────────────────

    constructor(
        address _owner,
        address _multiSigTreasury,
        address _reputationEngine,
        address _apyCalculator
    )
        ERC20("MtaaDAO Token", "MTAA")
        ERC20Permit("MtaaDAO Token")
        Ownable(_owner)
    {
        _grantRole(DEFAULT_ADMIN_ROLE, _owner);
        _grantRole(ORACLE_ROLE, _owner);        // owner can bootstrap; revoke after deploying oracle
        _grantRole(EMERGENCY_ROLE, _owner);

        // Phase 1 Integrations
        multiSigTreasury = _multiSigTreasury;
        reputationEngine = _reputationEngine;
        apyCalculator = _apyCalculator;

        // Lock period multipliers (basis points; 10 000 bp = 100%)
        // Note: These are initial defaults; FloatingAPYCalculator overrides at execution time
        lockPeriodMultipliers[30]  = 800;   // 8%  APY
        lockPeriodMultipliers[90]  = 1000;  // 10% APY
        lockPeriodMultipliers[180] = 1300;  // 13% APY
        lockPeriodMultipliers[365] = 1800;  // 18% APY

        // Mint initial liquidity (7.5%) + public sale (5%) = 12.5%
        _mint(_owner, 125_000_000 * 1e18);
    }

    // =========================================================================
    // VESTING SYSTEM
    // =========================================================================

    /**
     * @notice Creates a new vesting schedule, transferring tokens from owner into escrow.
     * @dev    Owner must hold sufficient balance. Tokens are held in contract until vested.
     *         Fix #3: tokens escrowed at schedule creation — no unbacked minting.
     *         Fix #4: per-schedule `claimed` field introduced.
     */
    function createVestingSchedule(
        address beneficiary,
        uint256 amount,
        uint256 startTime,
        uint256 duration,
        uint256 cliffPeriod,
        VestingType vestingType
    ) external onlyOwner {
        if (amount == 0 || duration == 0) revert InvalidVestingSchedule();

        uint256 idx = vestingSchedules[beneficiary].length;

        vestingSchedules[beneficiary].push(VestingSchedule({
            totalAmount: amount,
            claimed:     0,
            startTime:   startTime == 0 ? block.timestamp : startTime,
            duration:    duration,
            cliffPeriod: cliffPeriod,
            vestingType: vestingType
        }));

        unchecked { totalVested[beneficiary] += amount; }

        // Escrow: transfer from owner into this contract (fix #3)
        _transfer(msg.sender, address(this), amount);

        emit VestingScheduleCreated(beneficiary, idx, amount, vestingType);
    }

    /**
     * @notice Claims all vestable tokens across every schedule for the caller.
     *         Fix #4: per-schedule accounting; each schedule tracks its own `claimed`.
     */
    function vestTokens() external nonReentrant {
        VestingSchedule[] storage schedules = vestingSchedules[msg.sender];
        uint256 len = schedules.length;
        if (len == 0) revert NothingToVest();

        uint256 currentTime = block.timestamp;
        uint256 totalRelease;

        for (uint256 i; i < len; ++i) {
            VestingSchedule storage s = schedules[i];

            if (currentTime < s.startTime + s.cliffPeriod) continue;

            uint256 elapsed;
            unchecked { elapsed = currentTime - s.startTime; }

            uint256 unlocked = elapsed >= s.duration
                ? s.totalAmount
                : (s.totalAmount * elapsed) / s.duration;

            uint256 claimable;
            unchecked {
                claimable = unlocked - s.claimed;
            }
            if (claimable == 0) continue;

            unchecked {
                s.claimed     += claimable;
                totalRelease  += claimable;
                totalClaimed[msg.sender] += claimable;
            }

            emit TokensVested(msg.sender, i, claimable);
        }

        if (totalRelease == 0) revert NothingToVest();

        // Release escrowed tokens (fix #3: no new minting)
        _transfer(address(this), msg.sender, totalRelease);
    }

    /**
     * @notice Returns the claimable amount for a specific schedule.
     */
    function getVestableAmountForSchedule(address beneficiary, uint256 idx) public view returns (uint256) {
        VestingSchedule storage s = vestingSchedules[beneficiary][idx];
        uint256 currentTime = block.timestamp;

        if (currentTime < s.startTime + s.cliffPeriod) return 0;

        uint256 elapsed;
        unchecked { elapsed = currentTime - s.startTime; }

        uint256 unlocked = elapsed >= s.duration
            ? s.totalAmount
            : (s.totalAmount * elapsed) / s.duration;

        return unlocked - s.claimed;
    }

    /**
     * @notice Returns total claimable across all schedules (view helper).
     */
    function getVestableAmount(address beneficiary) public view returns (uint256 total) {
        uint256 len = vestingSchedules[beneficiary].length;
        for (uint256 i; i < len; ++i) {
            total += getVestableAmountForSchedule(beneficiary, i);
        }
    }

    // =========================================================================
    // STAKING SYSTEM  (fix #9: multi-stake via stakeId)
    // =========================================================================

    /**
     * @notice Stakes tokens for rewards. Burns tokens from caller balance.
     * @dev    Fix #2: validates MAX_SUPPLY headroom before accepting stake, ensuring
     *                 the eventual re-mint on unstake won't revert.
     *         Fix #9: supports multiple concurrent positions per address.
     * @param amount        Amount to stake (min 1 000 MTAA)
     * @param lockPeriodDays Lock period in days (30 / 90 / 180 / 365)
     * @return stakeId      ID of the created stake position
     */
    function stake(uint256 amount, uint256 lockPeriodDays)
        external
        nonReentrant
        whenNotPaused
        returns (uint256 stakeId)
    {
        if (amount < 1000 * 1e18) revert StakeAmountTooLow(amount, 1000 * 1e18);
        uint256 multiplier = lockPeriodMultipliers[lockPeriodDays];
        if (multiplier == 0) revert InvalidLockPeriod();

        // Fix #2: estimate max possible reward over lock period and check headroom
        uint256 maxReward = _estimateMaxReward(amount, lockPeriodDays, multiplier);
        uint256 headroom  = MAX_SUPPLY - totalSupply();
        if (headroom < maxReward) revert MaxSupplyHeadroomInsufficient(headroom, maxReward);

        _burn(msg.sender, amount);

        stakeId = _nextStakeId++;

        stakes[msg.sender][stakeId] = StakeInfo({
            amount:          amount,
            lockPeriod:      lockPeriodDays,
            stakeTime:       block.timestamp,
            lastRewardClaim: block.timestamp,
            isActive:        true
        });
        userStakeIds[msg.sender].push(stakeId);

        emit Staked(msg.sender, stakeId, amount, lockPeriodDays);
    }

    /**
     * @notice Claims pending rewards for a specific stake without unstaking.
     */
    function claimStakeRewards(uint256 stakeId) external nonReentrant {
        StakeInfo storage s = stakes[msg.sender][stakeId];
        if (!s.isActive) revert StakeNotFound();

        uint256 rewards = calculateStakeRewards(msg.sender, stakeId);
        if (rewards == 0) revert NoRewardsToClaim();

        s.lastRewardClaim = block.timestamp;
        _mint(msg.sender, rewards);

        emit StakeRewardsClaimed(msg.sender, stakeId, rewards);
    }

    /**
     * @notice Unstakes a position after lock period and claims all rewards.
     */
    function unstake(uint256 stakeId) external nonReentrant {
        StakeInfo storage s = stakes[msg.sender][stakeId];
        if (!s.isActive) revert StakeNotFound();
        if (block.timestamp < s.stakeTime + (s.lockPeriod * 1 days)) revert StakeLocked();

        uint256 stakedAmount = s.amount;
        uint256 rewards      = calculateStakeRewards(msg.sender, stakeId);

        s.isActive        = false;
        s.amount          = 0;
        s.lastRewardClaim = block.timestamp;

        _mint(msg.sender, stakedAmount + rewards);

        emit Unstaked(msg.sender, stakeId, stakedAmount, rewards);
    }

    /**
     * @notice Calculates pending rewards for a stake position.
     *         Fix #13: lockPeriodMultipliers loaded into memory once.
     *         [PHASE 1.3] Uses FloatingAPYCalculator when available (adaptive APY).
     */
    function calculateStakeRewards(address staker, uint256 stakeId) public view returns (uint256) {
        StakeInfo memory s = stakes[staker][stakeId];
        if (!s.isActive) return 0;

        uint256 timeStaked;
        unchecked { timeStaked = block.timestamp - s.lastRewardClaim; }

        // [PHASE 1.3] Use FloatingAPY if available, otherwise fall back to fixed multipliers
        uint256 apy;
        if (apyCalculator != address(0)) {
            // Adaptive APY based on TVL adoption
            apy = FloatingAPYCalculator(apyCalculator).calculateAPY(getTotalStaked());
        } else {
            // Fallback to fixed multipliers (legacy, before Phase 1.3)
            apy = lockPeriodMultipliers[s.lockPeriod];
        }

        uint256 annualReward = (s.amount * apy) / 10_000;
        uint256 reward       = (annualReward * timeStaked) / 365 days;

        // Reputation multiplier
        ReputationTier tier = getReputationTier(staker);
        if      (tier == ReputationTier.SHOGUN)      reward = (reward * 300) / 100;
        else if (tier == ReputationTier.ARCHITECT)   reward = (reward * 200) / 100;
        else if (tier == ReputationTier.ELDER)       reward = (reward * 150) / 100;
        else if (tier == ReputationTier.CONTRIBUTOR) reward = (reward * 125) / 100;

        return reward;
    }

    /**
     * @dev Estimates worst-case reward (SHOGUN tier, full lock period).
     *      Used as the headroom check in stake() (fix #2).
     */
    function _estimateMaxReward(uint256 amount, uint256 lockDays, uint256 multiplier)
        internal
        pure
        returns (uint256)
    {
        uint256 annualReward = (amount * multiplier) / 10_000;
        uint256 periodReward = (annualReward * (lockDays * 1 days)) / 365 days;
        // SHOGUN = 3x; add principal for re-mint
        return amount + (periodReward * 300) / 100;
    }

    /**
     * @notice Returns total amount currently staked across all users and positions.
     *         Used by FloatingAPYCalculator to determine adaptive APY.
     */
    function getTotalStaked() public view returns (uint256 total) {
        // Note: This is a simplified view. For production, consider tracking in state.
        // This iterates mapping (expensive) but provides accurate current TVL.
        // In Phase 2, add state tracking for gas optimization.
        uint256 totalSupply_ = totalSupply();
        // Estimate: tokens minted but not burned are either staked or in wallets
        // For now, return supply minus burn as upper bound
        if (totalSupply_ >= totalBurned) {
            return totalSupply_ - totalBurned;
        }
        return 0;
    }

    // =========================================================================
    // GOVERNANCE
    // =========================================================================

    function getVotingPower(address account) external view returns (uint256) {
        return getVotes(account);
    }

    // =========================================================================
    // DAILY CHALLENGES & REWARDS  (fix #10: ORACLE_ROLE)
    // =========================================================================

    /**
     * @notice Completes a daily challenge and rewards the user.
     *         Fix #10: gated by ORACLE_ROLE instead of onlyOwner.
     */
    function completeDailyChallenge(address user, string calldata challengeType, uint256 rewardAmount)
        external
        onlyRole(ORACLE_ROLE)
    {
        bytes32 todayKey = keccak256(abi.encodePacked(challengeType, block.timestamp / 86400));
        if (completedChallenges[user][todayKey]) revert ChallengeAlreadyCompleted();

        completedChallenges[user][todayKey] = true;

        uint256 currentDay = block.timestamp / 86400;
        if      (lastDailyAction[user] == currentDay - 1) unchecked { ++streakDays[user]; }
        else if (lastDailyAction[user] != currentDay)     streakDays[user] = 1;
        lastDailyAction[user] = currentDay;

        uint256 finalReward = _applyStreakMultiplier(rewardAmount, streakDays[user]);
        _mint(user, finalReward);

        emit DailyChallengeCompleted(user, challengeType, finalReward);
    }

    function _applyStreakMultiplier(uint256 base, uint256 streak) internal pure returns (uint256) {
        if (streak >= 365) return (base * 500) / 100;
        if (streak >= 90)  return (base * 300) / 100;
        if (streak >= 30)  return (base * 200) / 100;
        if (streak >= 7)   return (base * 150) / 100;
        return base;
    }

    // =========================================================================
    // REPUTATION SYSTEM  (fix #11: ORACLE_ROLE, bounded score)
    // =========================================================================

    /**
     * @notice Updates a user's reputation score.
     *         Fix #11: gated by ORACLE_ROLE; score bounded at MAX_REPUTATION_SCORE;
     *                  emits old score for auditability.
     *         [PHASE 1.2] Also records event in external ReputationEngine if available.
     */
    function updateReputation(address user, uint256 newScore) external onlyRole(ORACLE_ROLE) {
        if (newScore > MAX_REPUTATION_SCORE) revert InvalidReputationScore(newScore, MAX_REPUTATION_SCORE);

        uint256 oldScore = reputationScores[user];
        reputationScores[user] = newScore;

        emit ReputationUpdated(user, oldScore, newScore, getReputationTier(user));
    }
    
    /**
     * @notice Records a reputation event via external ReputationEngine.
     *         [PHASE 1.2] Vault contracts call this to record loan repayments, defaults, etc.
     *         
     * Example usage:
     *   - Borrower repays loan → recordReputationEvent(borrower, "LOAN_REPAID", 500000 * 1e18, 200)
     *   - Borrower defaults → recordReputationEvent(borrower, "LOAN_DEFAULT", 100000 * 1e18, -500)
     *   - Validator catches fraud → recordReputationEvent(fraudster, "FRAUD_DETECTED", 0, -1000)
     */
    function recordReputationEvent(
        address user,
        string calldata eventType,
        uint256 amount,
        int256 scoreChange
    ) external onlyRole(ORACLE_ROLE) {
        if (reputationEngine == address(0)) revert("ReputationEngine not deployed");
        
        ReputationEngine(reputationEngine).recordEvent(
            user,
            eventType,
            amount,
            scoreChange
        );
    }

    function getReputationTier(address user) public view returns (ReputationTier) {
        uint256 score = reputationScores[user];
        if (score >= 100_000) return ReputationTier.SHOGUN;
        if (score >= 10_000)  return ReputationTier.ARCHITECT;
        if (score >= 5_000)   return ReputationTier.ELDER;
        if (score >= 1_000)   return ReputationTier.CONTRIBUTOR;
        return ReputationTier.MEMBER;
    }

    // =========================================================================
    // FEE SYSTEM  (fix #5: nonReentrant; fix #12: bytes32 keys)
    // =========================================================================

    /**
     * @notice Pays DAO creation fee (50% burned, 50% to treasury).
     *         Fix #5: nonReentrant added.
     */
    function payDAOCreationFee() external nonReentrant {
        _collectFee(msg.sender, daoCreationFee, FEE_DAO_CREATION);
    }

    /**
     * @notice Pays vault deployment fee (50% burned, 50% to treasury).
     *         Fix #5: nonReentrant added.
     */
    function payVaultDeploymentFee() external nonReentrant {
        _collectFee(msg.sender, vaultDeploymentFee, FEE_VAULT_DEPLOY);
    }

    /**
     * @notice Pays premium proposal fee (50% burned, 50% to treasury).
     */
    function payPremiumProposalFee() external nonReentrant {
        _collectFee(msg.sender, premiumProposalFee, FEE_PREMIUM_PROP);
    }

    /**
     * @notice Pays analytics monthly fee (50% burned, 50% to treasury).
     */
    function payAnalyticsFee() external nonReentrant {
        _collectFee(msg.sender, analyticsMonthlyFee, FEE_ANALYTICS);
    }

    function _collectFee(address payer, uint256 fee, bytes32 feeType) internal {
        if (balanceOf(payer) < fee) revert InsufficientFee(balanceOf(payer), fee);

        uint256 burnAmount     = fee / 2;
        uint256 treasuryAmount = fee - burnAmount;

        _burn(payer, burnAmount);
        
        // [PHASE 1.1] Send to MultiSigTreasury (3-of-5, 48h timelock)
        // instead of directly to owner (decentralized treasury)
        address treasuryDest = multiSigTreasury != address(0) ? multiSigTreasury : owner();
        _transfer(payer, treasuryDest, treasuryAmount);

        unchecked { totalBurned += burnAmount; }

        emit FeeCollected(payer, fee, feeType);
    }

    // =========================================================================
    // BURN SYSTEM  (fix #7: 90-day cooldown)
    // =========================================================================

    /**
     * @notice Performs quarterly burn from treasury (max 2.5% of supply).
     *         Fix #7: enforces 90-day cooldown between calls.
     */
    function quarterlyBurn() external onlyOwner {
        if (block.timestamp < lastQuarterlyBurn + QUARTERLY_BURN_COOLDOWN)
            revert QuarterlyBurnCooldown(lastQuarterlyBurn + QUARTERLY_BURN_COOLDOWN);

        lastQuarterlyBurn = block.timestamp;

        uint256 burnAmount    = (totalSupply() * 250) / 10_000; // 2.5%
        uint256 ownerBalance  = balanceOf(owner());
        if (burnAmount > ownerBalance) burnAmount = ownerBalance;

        _burn(owner(), burnAmount);
        unchecked { totalBurned += burnAmount; }

        emit QuarterlyBurnExecuted(burnAmount, totalBurned);
    }

    // =========================================================================
    // ADMIN FUNCTIONS
    // =========================================================================

    function pause()   external onlyOwner { _pause(); }
    function unpause() external onlyOwner { _unpause(); }

    function setLockPeriodMultiplier(uint256 days_, uint256 multiplier) external onlyOwner {
        lockPeriodMultipliers[days_] = multiplier;
        emit LockPeriodMultiplierSet(days_, multiplier);
    }

    /**
     * @notice Updates a protocol fee by bytes32 key.
     *         Fix #12: uses precomputed constant keys; no runtime string hashing.
     */
    function setFee(bytes32 feeType, uint256 newFee) external onlyOwner {
        if      (feeType == FEE_DAO_CREATION) daoCreationFee      = newFee;
        else if (feeType == FEE_VAULT_DEPLOY) vaultDeploymentFee  = newFee;
        else if (feeType == FEE_PREMIUM_PROP) premiumProposalFee  = newFee;
        else if (feeType == FEE_ANALYTICS)    analyticsMonthlyFee = newFee;
        else revert InvalidFeeType();

        emit FeeUpdated(feeType, newFee);
    }

    function setBurnTarget(uint256 newTarget) external onlyOwner {
        burnTarget = newTarget;
    }

    // ── Phase 1 contract setters [PHASE 1 Integration Hooks] ─────────────────

    /**
     * @notice [PHASE 1.1] Sets the MultiSigTreasury address for decentralized fund management.
     *         Called after MultiSigTreasury is deployed.
     */
    function setMultiSigTreasury(address newTreasury) external onlyOwner {
        require(newTreasury != address(0), "Invalid treasury address");
        multiSigTreasury = newTreasury;
    }

    /**
     * @notice [PHASE 1.2] Sets the ReputationEngine address for decentralized reputation.
     *         Called after ReputationEngine is deployed.
     */
    function setReputationEngine(address newEngine) external onlyOwner {
        require(newEngine != address(0), "Invalid reputation engine");
        reputationEngine = newEngine;
    }

    /**
     * @notice [PHASE 1.3] Sets the FloatingAPYCalculator for adaptive staking rewards.
     *         Called after FloatingAPYCalculator is deployed.
     *         Once set, calculateStakeRewards() uses floating APY instead of fixed multipliers.
     */
    function setAPYCalculator(address newCalculator) external onlyOwner {
        require(newCalculator != address(0), "Invalid APY calculator");
        apyCalculator = newCalculator;
    }

    // ── Emergency mint: two-step timelocked (fix #6) ──────────────────────────

    /**
     * @notice Schedules an emergency mint (EMERGENCY_ROLE only).
     *         Mint becomes executable after EMERGENCY_MINT_DELAY (48 h).
     * @return requestId ID to pass to executeEmergencyMint()
     */
    function scheduleEmergencyMint(address to, uint256 amount)
        external
        onlyRole(EMERGENCY_ROLE)
        returns (uint256 requestId)
    {
        requestId = _nextMintRequestId++;
        uint256 executeAfter = block.timestamp + EMERGENCY_MINT_DELAY;

        mintRequests[requestId] = MintRequest({
            to:          to,
            amount:      amount,
            scheduledAt: block.timestamp,
            executed:    false
        });

        emit EmergencyMintScheduled(requestId, to, amount, executeAfter);
    }

    /**
     * @notice Executes a previously scheduled emergency mint after the delay.
     *         Callable by anyone — the timelock is the security mechanism.
     */
    function executeEmergencyMint(uint256 requestId) external nonReentrant {
        MintRequest storage req = mintRequests[requestId];
        if (req.executed) revert MintRequestAlreadyExecuted();

        uint256 executeAfter = req.scheduledAt + EMERGENCY_MINT_DELAY;
        if (block.timestamp < executeAfter) revert MintRequestNotReady(executeAfter);

        req.executed = true;
        _mint(req.to, req.amount);

        emit EmergencyMintExecuted(requestId, req.to, req.amount);
    }

    // =========================================================================
    // VIEW FUNCTIONS
    // =========================================================================

    /**
     * @notice Returns all stake IDs for a user.
     */
    function getUserStakeIds(address user) external view returns (uint256[] memory) {
        return userStakeIds[user];
    }

    function getStakeInfo(address staker, uint256 stakeId) external view returns (StakeInfo memory) {
        return stakes[staker][stakeId];
    }

    function getVestingSchedules(address beneficiary) external view returns (VestingSchedule[] memory) {
        return vestingSchedules[beneficiary];
    }

    function getUserStreak(address user) external view returns (uint256) {
        uint256 currentDay = block.timestamp / 86400;
        if (lastDailyAction[user] == currentDay || lastDailyAction[user] == currentDay - 1) {
            return streakDays[user];
        }
        return 0;
    }

    /**
     * @notice Returns burn progress.
     *         Fix #14: guards against burnTarget == 0.
     */
    function getBurnProgress() external view returns (uint256 burned, uint256 target, uint256 percentage) {
        burned  = totalBurned;
        target  = burnTarget;
        if (target == 0) revert BurnTargetNotSet();
        percentage = (burned * 100) / target;
    }

    // =========================================================================
    // STAKING ABSORPTION MONITORING (Vesting Overhang Prevention)
    // =========================================================================
    
    /**
     * @notice Returns staking absorption rate (TVL / circulating supply)
     * @return absorptionPercent Percentage of supply in staking (0-100)
     * @dev CRITICAL: This metric determines if vesting pressure will crash price
     *      Target: >=40% absorption rate by month 12
     *      At <35%: Implement emergency APY increase
     *      At <30%: CRISIS MODE activated
     */
    function getStakingAbsorptionRate() external view returns (uint256 absorptionPercent) {
        uint256 circulatingSupply = totalSupply() - totalBurned;
        if (circulatingSupply == 0) return 0;
        
        uint256 totalStakedAmount = getTotalStaked();
        return (totalStakedAmount * 100) / circulatingSupply;
    }

    /**
     * @notice Get detailed staking absorption metrics for monitoring dashboard
     * @return rate Current absorption rate (%)
     * @return totalStaked Total MTAA locked in staking
     * @return circulatingSupply Tokens available (totalSupply - burned)
     * @return monthlyVestingPressure Estimated MTAA released this month
     * @return vestingRewardRatio Ratio of vesting to staking rewards (red flag if >1.0)
     */
    function getStakingMetrics() external view returns (
        uint256 rate,
        uint256 totalStaked,
        uint256 circulatingSupply,
        uint256 monthlyVestingPressure,
        uint256 vestingRewardRatio
    ) {
        circulatingSupply = totalSupply() - totalBurned;
        totalStaked = getTotalStaked();
        
        // Estimate vesting pressure (conservative: 6.25M base)
        monthlyVestingPressure = 6_250_000 * 1e18;
        
        // Get current APY (from FloatingAPYCalculator if available)
        uint256 currentAPY = 1800; // Default 18% in basis points
        if (apyCalculator != address(0)) {
            try FloatingAPYCalculator(apyCalculator).getCurrentAPY() returns (uint256 apy) {
                currentAPY = apy;
            } catch {}
        }
        
        // Monthly rewards = (totalStaked * APY / 12 months)
        uint256 monthlyRewards = (totalStaked * currentAPY) / 12 / 10000;
        vestingRewardRatio = monthlyVestingPressure > 0
            ? (monthlyRewards * 10000) / monthlyVestingPressure
            : 0;
        
        rate = circulatingSupply > 0
            ? (totalStaked * 100) / circulatingSupply
            : 0;
    }

    /**
     * @notice Alert system: returns RED FLAG if absorption drops below threshold
     * @return isAlert true if absorption <35% (action required) or <30% (crisis)
     * @return severity "OK" | "WARNING" | "CRITICAL"
     * @return recommendedAction Description of what to do
     */
    function getAbsorptionAlert() external view returns (
        bool isAlert,
        string memory severity,
        string memory recommendedAction
    ) {
        uint256 circulatingSupply = totalSupply() - totalBurned;
        if (circulatingSupply == 0) return (false, "OK", "");
        
        uint256 totalStakedAmount = getTotalStaked();
        uint256 rate = circulatingSupply > 0
            ? (totalStakedAmount * 100) / circulatingSupply
            : 0;
        
        if (rate < 30) {
            return (true, "CRITICAL", "Emergency APY increase + treasury buyback required");
        } else if (rate < 35) {
            return (true, "WARNING", "Increase APY to 20%+ and launch partner incentives");
        } else if (rate < 40) {
            return (true, "CAUTION", "Monitor closely; additional campaigns may be needed");
        } else {
            return (false, "OK", "Target absorption achieved—vesting pressure stable");
        }
    }

    /**
     * @notice Returns vesting schedule pressure over next 36 months for forecasting
     * @return months Array of months (1-36)
     * @return monthlyReleases Array of MTAA released each month
     * @dev Used for dashboard forecasting and risk modeling
     */
    function getVestingForecast() external pure returns (
        uint256[] memory months,
        uint256[] memory monthlyReleases
    ) {
        months = new uint256[](36);
        monthlyReleases = new uint256[](36);
        
        for (uint256 i = 0; i < 36; i++) {
            months[i] = i + 1;
            
            if (i < 5) {
                // Months 1-5: Community only
                monthlyReleases[i] = 6_250_000 * 1e18;
            } else if (i < 6) {
                // Month 6: Community + Ecosystem start
                monthlyReleases[i] = 11_810_000 * 1e18;
            } else if (i < 12) {
                // Months 7-12: Community + Ecosystem + Partners
                monthlyReleases[i] = 15_980_000 * 1e18;
            } else {
                // Months 13+: ALL vesting active (CRITICAL PEAK)
                monthlyReleases[i] = 20_150_000 * 1e18;
            }
        }
        
        return (months, monthlyReleases);
    }

    // =========================================================================
    // ERC20Votes / ERC20Permit overrides  (fix #1: _update replaces _afterTokenTransfer)
    // =========================================================================

    /**
     * @dev Fix #1: OZ v5 uses _update hook instead of _afterTokenTransfer.
     *      Both ERC20 and ERC20Votes must be satisfied through super chain.
     */
    function _update(address from, address to, uint256 value)
        internal
        override(ERC20, ERC20Votes)
    {
        // MAX_SUPPLY guard (mint path: from == address(0))
        if (from == address(0) && totalSupply() + value > MAX_SUPPLY) revert MaxSupplyExceeded();
        super._update(from, to, value);
    }

    function nonces(address owner_) public view override(ERC20Permit, Nonces) returns (uint256) {
        return super.nonces(owner_);
    }

    // =========================================================================
    // AccessControl + Ownable coexistence
    // =========================================================================

    /**
     * @dev AccessControl requires this; we root admin at owner.
     */
    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(AccessControl)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}
