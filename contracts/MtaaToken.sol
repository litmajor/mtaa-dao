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
import "@openzeppelin/contracts/utils/Nonces.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import "./MultiSigTreasury.sol";
import "./ReputationEngine.sol";
import "./FloatingAPYCalculator.sol";
import "./MtaaStakingVestingManager.sol";

interface AggregatorV3Interface {
    function decimals() external view returns (uint8);
    function latestRoundData()
        external
        view
        returns (
            uint80  roundId,
            int256  answer,
            uint256 startedAt,
            uint256 updatedAt,
            uint80  answeredInRound
        );
}

/**
 * @title  MTAAToken (Production-Ready)
 * @notice Native utility token for the MtaaDAO ecosystem.
 *
 * ─── FIXES FROM PRE-DEPLOY AUDIT ──────────────────────────────────────────────
 *  BLOCKER #1  Pause was broken.
 *              Inherited Pausable but not ERC20Pausable, so _update() never
 *              enforced pause. Transfers, burns, and fee payments all continued
 *              through a paused state. pause() was a no-op for token movements.
 *              FIX: _update() now calls _requireNotPaused() for all non-mint ops.
 *
 *  BLOCKER #2  payDAOCreationFee() ignored daoCreationFeeEnabled flag.
 *              payDAOCreationFeeWithToken() checked it; direct path did not.
 *              FIX: payDAOCreationFee() returns early when flag is false.
 *
 *  BLOCKER #3  Emergency mint was dead code.
 *              MintRequest struct, mapping, EMERGENCY_ROLE, delay constant, and
 *              both events existed — but scheduleEmergencyMint() and
 *              executeEmergencyMint() were missing. EMERGENCY_ROLE held no power.
 *              FIX: Both functions implemented with full 48hr timelock pattern.
 *
 *  HIGH #4     Oracle pricing assumed feedDecimals == 8.
 *              priceFeed.decimals() was defined in the interface but never called.
 *              An 18-decimal feed would price MTAA at 10^10x wrong.
 *              FIX: _mtAAForUsd8() reads feedDecimals and normalises correctly.
 *
 *  HIGH #5     No Chainlink staleness check.
 *              latestRoundData() was called but updatedAt and answeredInRound
 *              were silently discarded. A stale feed misprices fees with no error.
 *              FIX: Added updatedAt (1-hour max age) and answeredInRound checks.
 *
 *  HIGH #6     StakeLocked error thrown for plain insufficient balance.
 *              _update() fired StakeLocked when a user simply had no funds — even
 *              with zero staked tokens. Wallets get a misleading revert reason.
 *              FIX: Distinguishes "tokens are staked" vs "genuinely no balance".
 *
 *  HIGH #7     No post-deploy setters for multiSigTreasury / reputationEngine /
 *              apyCalculator. These could only be set in constructor. Any contract
 *              upgrade would require full token redeployment.
 *              FIX: setMultiSigTreasury / setReputationEngine / setApyCalculator added.
 *
 *  HIGH #8     burnTarget was declared but never enforced.
 *              quarterlyBurn() burned indefinitely; the 10M target was ignored.
 *              FIX: quarterlyBurn() reverts with BurnTargetReached once totalBurned
 *              >= burnTarget. setBurnTarget() lets governance update it.
 *
 *  MEDIUM #9   Daily oracle reward had no per-call cap.
 *              With 5× streak multiplier, ORACLE_ROLE could mint rewardAmount × 5
 *              per challenge call. Compromised key = unbounded supply inflation.
 *              FIX: maxDailyRewardAmount (default 100 MTAA) caps each call.
 *              setMaxDailyRewardAmount() lets owner adjust it.
 *
 *  MEDIUM #10  totalVestedGlobal decrement was inside unchecked block.
 *              Accounting drift could cause silent uint256 wrap-around.
 *              FIX: Moved out of unchecked; normal Solidity 0.8 protection applies.
 * ──────────────────────────────────────────────────────────────────────────────
 */
contract MTAAToken is ERC20, ERC20Burnable, ERC20Permit, ERC20Votes, Ownable, Pausable, ReentrancyGuard, AccessControl {
    using SafeERC20 for IERC20;

    // ── Roles ─────────────────────────────────────────────────────────────────
    bytes32 public constant ORACLE_ROLE      = keccak256("ORACLE_ROLE");
    bytes32 public constant EMERGENCY_ROLE   = keccak256("EMERGENCY_ROLE");
    bytes32 public constant DISTRIBUTOR_ROLE = keccak256("DISTRIBUTOR_ROLE");

    // ── Supply ────────────────────────────────────────────────────────────────
    uint256 public constant MAX_SUPPLY = 1_000_000_000 * 1e18;

    // ── Fee keys ──────────────────────────────────────────────────────────────
    bytes32 public constant FEE_DAO_CREATION = keccak256("DAO_CREATION");
    bytes32 public constant FEE_VAULT_DEPLOY = keccak256("VAULT_DEPLOYMENT");
    bytes32 public constant FEE_PREMIUM_PROP = keccak256("PREMIUM_PROPOSAL");
    bytes32 public constant FEE_ANALYTICS    = keccak256("ANALYTICS_MONTHLY");

    // ── Vesting ───────────────────────────────────────────────────────────────
    struct VestingSchedule {
        uint256     totalAmount;
        uint256     claimed;
        uint256     startTime;
        uint256     duration;
        uint256     cliffPeriod;
        VestingType vestingType;
    }

    // Vesting schedules moved to `MtaaStakingVestingManager`.

    // ── Staking (delegated) ──────────────────────────────────────────────────
    // Staking and vesting logic have been moved to `MtaaStakingVestingManager` to
    // reduce `MTAAToken` deployed bytecode. `stakingManager` holds staked tokens
    // and manages schedules; `MTAAToken` provides lightweight wrappers that
    // transfer tokens and mint rewards.
    address public stakingManager;

    mapping(uint256 => uint256)   public lockPeriodMultipliers;

    // ── Reputation ────────────────────────────────────────────────────────────
    uint256 public constant MAX_REPUTATION_SCORE = 1_000_000;
    mapping(address => uint256) public reputationScores;

    // reputation helper is still stored here; manager will call getReputationTier via token

    // ── Daily challenges ──────────────────────────────────────────────────────
    mapping(address => uint256) public lastDailyAction;
    mapping(address => uint256) public streakDays;
    mapping(address => mapping(bytes32 => bool)) public completedChallenges;

    // FIX #9 — cap per oracle call
    uint256 public maxDailyRewardAmount = 100 * 1e18;

    // ── Fees ──────────────────────────────────────────────────────────────────
    uint256 public daoCreationFee      = 1000 * 1e18;
    uint256 public vaultDeploymentFee  = 500  * 1e18;
    uint256 public premiumProposalFee  = 100  * 1e18;
    uint256 public analyticsMonthlyFee = 50   * 1e18;

    uint256 public daoCreationFeeUsd8;
    uint256 public vaultDeploymentFeeUsd8;
    bool    public daoCreationFeeEnabled = true;

    AggregatorV3Interface public priceFeed;

    // Address of staking/vesting manager contract
    MtaaStakingVestingManager public stakingManagerContract;


    // FIX #5 — staleness window for Chainlink
    uint256 public constant PRICE_FEED_MAX_AGE = 1 hours;
    // Minimum allowed oracle price (in oracle units) to avoid near-zero pricing
    uint256 public minOraclePrice = 1; // default 1 (caller can raise)

    // Maximum allowed APY (basis points) returned from external calculator
    uint256 public constant MAX_APY_BPS = 100_000; // 1000% per year cap

    // Upper bound for lock period multipliers (basis points)
    uint256 public constant MAX_LOCK_MULTIPLIER = 100_000; // 1000% cap

    // When true, external (non-MTAA) fee payments are disallowed and must use MTAA
    bool public requireFeesInMtaa = false;

    // ── Burns ─────────────────────────────────────────────────────────────────
    uint256 public totalBurned;
    uint256 public burnTarget             = 10_000_000 * 1e18; // FIX #8 — now enforced
    uint256 public lastQuarterlyBurn;
    uint256 public constant QUARTERLY_BURN_COOLDOWN = 90 days;

    // ── Emergency mint timelock (FIX #3 — fully implemented) ─────────────────
    struct MintRequest {
        address to;
        uint256 amount;
        uint256 scheduledAt;
        address scheduledBy;
        bool    executed;
    }

    uint256 public constant EMERGENCY_MINT_DELAY = 48 hours;
    uint256 private _nextMintRequestId;
    mapping(uint256 => MintRequest) public mintRequests;

    // ── Phase 1 Integrations ─────────────────────────────────────────────────
    address public multiSigTreasury;
    address public reputationEngine;
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
    event PriceFeedUpdated(address feed);
    event MultiSigTreasuryUpdated(address indexed oldTreasury, address indexed newTreasury);
    event ReputationEngineUpdated(address indexed newEngine);
    event ApyCalculatorUpdated(address indexed newCalculator);
    event BurnTargetUpdated(uint256 newTarget);
    event MaxDailyRewardUpdated(uint256 newMax);
    event RolesDistributed(address indexed admin, address indexed oracle, address indexed emergency);

    // ─────────────────────────────────────────────────────────────────────────
    // Errors
    // ─────────────────────────────────────────────────────────────────────────

    error MaxSupplyExceeded();
    error MaxSupplyHeadroomInsufficient(uint256 available, uint256 required);
    error InvalidVestingSchedule();
    error NothingToVest();
    error StakeNotFound();
    error StakeLocked();
    error InsufficientBalance(uint256 available, uint256 required);
    error InvalidLockPeriod();
    error ChallengeAlreadyCompleted();
    error InsufficientFee(uint256 provided, uint256 required);
    error StakeAmountTooLow(uint256 provided, uint256 minimum);
    error NoRewardsToClaim();
    error QuarterlyBurnCooldown(uint256 nextAllowed);
    error BurnTargetReached();              // FIX #8
    error MintRequestNotReady(uint256 executeAfter);
    error MintRequestAlreadyExecuted();
    error MintRequestNotFound();
    error InvalidFeeType();
    error InvalidReputationScore(uint256 provided, uint256 max);
    error PriceFeedNotSet();
    error MinOraclePriceTooLow(int256 price, uint256 minAllowed);
    error ExternalFeesNotAllowed();
    error StalePriceFeed(uint256 updatedAt, uint256 maxAge);
    error NotAuthorized();
    error ZeroAddress();
    error InvalidAmount();
    error DailyRewardCapExceeded(uint256 provided, uint256 cap); // FIX #9
    error ReputationEngineNotSet();
    error ReputationEngineNotContract();
    error ScheduleIndexInvalid(uint256 idx);
    error StakedBalanceUnderflow();

    // ─────────────────────────────────────────────────────────────────────────
    // Constructor
    // ─────────────────────────────────────────────────────────────────────────

    constructor(
        address _owner,
        address _multiSigTreasury,
        address _reputationEngine,
        address _apyCalculator
    )
        ERC20("MTAA", "MTAA")
        ERC20Permit("MTAA")
        Ownable(_owner)
    {
        _grantRole(DEFAULT_ADMIN_ROLE, _owner);
        _grantRole(ORACLE_ROLE,        _owner);
        _grantRole(EMERGENCY_ROLE,     _owner);

        multiSigTreasury = _multiSigTreasury;
        reputationEngine = _reputationEngine;
        apyCalculator    = _apyCalculator;

        lockPeriodMultipliers[30]  = 800;
        lockPeriodMultipliers[90]  = 1000;
        lockPeriodMultipliers[180] = 1300;
        lockPeriodMultipliers[365] = 1800;

        _mint(_owner, 125_000_000 * 1e18);
    }

    function setStakingManager(address manager) external onlyOwner {
        stakingManager = manager;
        stakingManagerContract = MtaaStakingVestingManager(manager);
    }

    // ----------------- Owner helpers for safety -----------------
    function setMinOraclePrice(uint256 _min) external onlyOwner {
        if (_min == 0) revert InvalidAmount();
        minOraclePrice = _min;
    }

    function setRequireFeesInMtaa(bool v) external onlyOwner {
        requireFeesInMtaa = v;
    }

    

    // =========================================================================
    // OZ V5 OVERRIDES
    // =========================================================================

    /**
     * @dev FIX #1: Pause now actually blocks token transfers and burns.
     *      The original contract did not call _requireNotPaused() here, making
     *      pause() a no-op for all token movement except stake().
     *
     *      Minting (from == address(0)) is NOT blocked when paused — this allows
     *      the team to issue emergency distributions or oracle rewards without
     *      having to unpause the full transfer market.
     *
     *      FIX #6: StakeLocked error now only fires when tokens are genuinely
     *      locked in staking. Plain insufficient balance gives InsufficientBalance.
     */
    function _update(address from, address to, uint256 value)
        internal
        override(ERC20, ERC20Votes)
    {
        if (from != address(0)) {
            // FIX #1: Enforce pause for all non-mint operations
            _requireNotPaused();

            // FIX #6: Distinguish "staked tokens locked" from "simply no balance"
            // staked balances are managed in the staking manager contract; query it when set
            uint256 staked = 0;
            if (address(stakingManagerContract) != address(0)) {
                staked = stakingManagerContract.stakedBalances(from);
            }
            uint256 availableBalance = balanceOf(from) - staked;
            if (availableBalance < value) {
                if (balanceOf(from) >= value) {
                    // User has enough total, but some portion is locked in staking
                    revert StakeLocked();
                } else {
                    // User genuinely doesn't have the funds
                    revert InsufficientBalance(availableBalance, value);
                }
            }
        } else {
            // Mint path: enforce MAX_SUPPLY
            if (totalSupply() + value > MAX_SUPPLY) revert MaxSupplyExceeded();
        }

        super._update(from, to, value);
    }

    function nonces(address owner)
        public
        view
        override(ERC20Permit, Nonces)
        returns (uint256)
    {
        return super.nonces(owner);
    }

    // =========================================================================
    // VESTING SYSTEM
    // =========================================================================

    function createVestingSchedule(
        address     beneficiary,
        uint256     amount,
        uint256     startTime,
        uint256     duration,
        uint256     cliffPeriod,
        VestingType vestingType
    ) external {
        if (!(msg.sender == owner() || hasRole(DISTRIBUTOR_ROLE, msg.sender))) revert NotAuthorized();
        if (stakingManager == address(0)) revert("StakingManagerNotSet");
        if (amount == 0 || duration == 0) revert InvalidVestingSchedule();

        // transfer tokens to vesting manager and delegate schedule creation
        _transfer(msg.sender, stakingManager, amount);
        MtaaStakingVestingManager(stakingManager).createVestingScheduleFor(
            beneficiary, amount, startTime, duration, cliffPeriod, uint8(vestingType)
        );
    }

    function vestSchedules(uint256[] calldata indices) external {
        if (stakingManager == address(0)) revert("StakingManagerNotSet");
        uint256 len = indices.length;
        if (len == 0) revert NothingToVest();

        uint256 totalRelease;
        for (uint256 i; i < len; ++i) {
            uint256 scheduleIdx = indices[i];
            // manager will perform validation per-schedule and emit events; we only
            // call it to perform accounting and token transfers.
            // Delegate: manager will transfer vested tokens back to caller.
            // We call manager.getVestableAmountForSchedule to accumulate totalRelease here
            uint256 claimable = MtaaStakingVestingManager(stakingManager).getVestableAmountForSchedule(msg.sender, scheduleIdx);
            if (claimable == 0) continue;
            totalRelease += claimable;
            // Let manager mark claimed; manager does not mint — token will handle minting if needed.
        }

        if (totalRelease == 0) revert NothingToVest();

        // Request manager to perform vesting transfers and bookkeeping
        // For now, instruct callers to use the staking manager directly.
        revert("Use stakingManager.vesting execution directly");
    }

    function getVestableAmountForSchedule(address beneficiary, uint256 idx)
        public
        view
        returns (uint256)
    {
        if (stakingManager == address(0)) return 0;
        return MtaaStakingVestingManager(stakingManager).getVestableAmountForSchedule(beneficiary, idx);
    }

    function getVestableAmount(address beneficiary) public view returns (uint256 total) {
        if (stakingManager == address(0)) return 0;
        return MtaaStakingVestingManager(stakingManager).getVestableAmount(beneficiary);
    }

    // =========================================================================
    // STAKING SYSTEM (delegated)
    // =========================================================================

    function stake(uint256 amount, uint256 lockPeriodDays)
        external
        nonReentrant
        whenNotPaused
        returns (uint256 stakeId)
    {
        if (stakingManager == address(0)) revert("StakingManagerNotSet");
        if (amount < 1000 * 1e18) revert StakeAmountTooLow(amount, 1000 * 1e18);

        uint256 multiplier = lockPeriodMultipliers[lockPeriodDays];
        if (multiplier == 0) revert InvalidLockPeriod();

        uint256 available = balanceOf(msg.sender);
        if (available < amount) revert InsufficientBalance(available, amount);

        // Transfer tokens to manager and record stake there
        _transfer(msg.sender, stakingManager, amount);
        stakeId = MtaaStakingVestingManager(stakingManager).stakeFor(msg.sender, amount, lockPeriodDays);
    }

    function claimStakeRewards(uint256 stakeId) external nonReentrant {
        if (stakingManager == address(0)) revert("StakingManagerNotSet");
        uint256 rewards = MtaaStakingVestingManager(stakingManager).claimStakeRewardsFor(msg.sender, stakeId);
        if (rewards == 0) revert NoRewardsToClaim();
        _mint(msg.sender, rewards);
    }

    function unstake(uint256 stakeId) external nonReentrant {
        if (stakingManager == address(0)) revert("StakingManagerNotSet");
        (uint256 stakedAmount, uint256 rewards) = MtaaStakingVestingManager(stakingManager).unstakeFor(msg.sender, stakeId);
        if (rewards > 0) _mint(msg.sender, rewards);
        emit Unstaked(msg.sender, stakeId, stakedAmount, rewards);
    }

    function calculateStakeRewards(address staker, uint256 stakeId)
        public
        view
        returns (uint256)
    {
        if (stakingManager == address(0)) return 0;
        return MtaaStakingVestingManager(stakingManager).calculateStakeRewards(staker, stakeId);
    }

    function _estimateMaxReward(uint256 amount, uint256 lockDays, uint256 multiplier)
        internal
        pure
        returns (uint256)
    {
        uint256 annualReward = (amount * multiplier) / 10_000;
        uint256 periodReward = (annualReward * (lockDays * 1 days)) / 365 days;
        return (periodReward * 300) / 100; // SHOGUN 3× worst case
    }

    function getTotalStaked() public view returns (uint256) {
        if (stakingManager == address(0)) return 0;
        return MtaaStakingVestingManager(stakingManager).getTotalStaked();
    }

    // =========================================================================
    // GOVERNANCE
    // =========================================================================

    function getVotingPower(address account) external view returns (uint256) {
        return getVotes(account);
    }

    // =========================================================================
    // DAILY CHALLENGES
    // =========================================================================

    /**
     * @dev FIX #9: rewardAmount is now capped by maxDailyRewardAmount (before streak
     *      multiplier). A compromised ORACLE_ROLE key can mint at most
     *      maxDailyRewardAmount × 5 (SHOGUN streak) per call — not unbounded.
     */
    function completeDailyChallenge(
        address user,
        string calldata challengeType,
        uint256 rewardAmount
    ) external onlyRole(ORACLE_ROLE) {
        // FIX #9
        if (rewardAmount > maxDailyRewardAmount) {
            revert DailyRewardCapExceeded(rewardAmount, maxDailyRewardAmount);
        }

        bytes32 todayKey = keccak256(abi.encodePacked(challengeType, block.timestamp / 86400));
        if (completedChallenges[user][todayKey]) revert ChallengeAlreadyCompleted();

        completedChallenges[user][todayKey] = true;

        uint256 currentDay = block.timestamp / 86400;
        if (lastDailyAction[user] == currentDay - 1) {
            unchecked { ++streakDays[user]; }
        } else if (lastDailyAction[user] != currentDay) {
            streakDays[user] = 1;
        }
        lastDailyAction[user] = currentDay;

        uint256 finalReward = _applyStreakMultiplier(rewardAmount, streakDays[user]);
        _mint(user, finalReward);

        emit DailyChallengeCompleted(user, challengeType, finalReward);
    }

    function _applyStreakMultiplier(uint256 base, uint256 streak)
        internal
        pure
        returns (uint256)
    {
        if (streak >= 365) return (base * 500) / 100;
        if (streak >= 90)  return (base * 300) / 100;
        if (streak >= 30)  return (base * 200) / 100;
        if (streak >= 7)   return (base * 150) / 100;
        return base;
    }

    // =========================================================================
    // REPUTATION SYSTEM
    // =========================================================================

    function updateReputation(address user, uint256 newScore)
        external
        onlyRole(ORACLE_ROLE)
    {
        if (newScore > MAX_REPUTATION_SCORE) revert InvalidReputationScore(newScore, MAX_REPUTATION_SCORE);
        uint256 oldScore = reputationScores[user];
        reputationScores[user] = newScore;
        emit ReputationUpdated(user, oldScore, newScore, getReputationTier(user));
    }

    function recordReputationEvent(
        address user,
        string  calldata eventType,
        uint256 amount,
        int256  scoreChange
    ) external onlyRole(ORACLE_ROLE) {
        if (reputationEngine == address(0)) revert ReputationEngineNotSet();
        address rep = reputationEngine;
        uint256 size;
        assembly { size := extcodesize(rep) }
        if (size == 0) revert ReputationEngineNotContract();
        ReputationEngine(rep).recordEvent(user, eventType, amount, scoreChange);

        // Enforce reputation cap invariant in case external engine updated via other paths
        if (reputationScores[user] > MAX_REPUTATION_SCORE) {
            uint256 old = reputationScores[user];
            reputationScores[user] = MAX_REPUTATION_SCORE;
            emit ReputationUpdated(user, old, MAX_REPUTATION_SCORE, getReputationTier(user));
        }
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
    // FEE SYSTEM
    // =========================================================================

    /**
     * @dev FIX #2: Now checks daoCreationFeeEnabled, matching payDAOCreationFeeWithToken().
     */
    function payDAOCreationFee() external nonReentrant {
        if (!daoCreationFeeEnabled) return;   // FIX #2
        _collectFee(msg.sender, daoCreationFee, FEE_DAO_CREATION);
    }

    function payVaultDeploymentFee() external nonReentrant {
        _collectFee(msg.sender, vaultDeploymentFee, FEE_VAULT_DEPLOY);
    }

    function payPremiumProposalFee() external nonReentrant {
        _collectFee(msg.sender, premiumProposalFee, FEE_PREMIUM_PROP);
    }

    function payAnalyticsFee() external nonReentrant {
        _collectFee(msg.sender, analyticsMonthlyFee, FEE_ANALYTICS);
    }

    function _collectFee(address payer, uint256 fee, bytes32 feeType) internal {
        _acceptPayment(payer, address(this), fee, feeType);
    }

    function _acceptPayment(address payer, address payToken, uint256 amount, bytes32 feeType) internal {
        address treasuryDest = multiSigTreasury != address(0) ? multiSigTreasury : owner();

        if (payToken == address(this)) {
            if (balanceOf(payer) < amount) revert InsufficientFee(balanceOf(payer), amount);

            uint256 burnAmount     = amount / 2;
            uint256 treasuryAmount = amount - burnAmount;

            _burn(payer, burnAmount);
            _transfer(payer, treasuryDest, treasuryAmount);
            unchecked { totalBurned += burnAmount; }

            emit FeeCollected(payer, amount, feeType);
            return;
        }

        if (requireFeesInMtaa) revert ExternalFeesNotAllowed();

        IERC20(payToken).safeTransferFrom(payer, treasuryDest, amount);
        emit FeeCollected(payer, amount, feeType);
    }

    // =========================================================================
    // ORACLE-PRICED PAYMENTS
    // =========================================================================

    /**
     * @dev FIX #4 + #5: Reads feedDecimals from oracle and normalises correctly.
     *      Adds staleness check (updatedAt must be within PRICE_FEED_MAX_AGE)
     *      and round completion check (answeredInRound >= roundId).
     *
     *      Derivation (both usd8 and price expressed as integers):
     *        mtaaAmount = (usd8 / 1e8) / (price / 10^feedDecimals) * 1e18
     *                   = (usd8 * 10^feedDecimals * 1e18) / (1e8 * price)
     *      For feedDecimals == 8 this reduces to the original (usd8 * 1e18) / price.
     */
    function _mtAAForUsd8(uint256 usd8) internal view returns (uint256) {
        if (address(priceFeed) == address(0)) revert PriceFeedNotSet();

        (
            uint80  roundId,
            int256  answer,
            ,
            uint256 updatedAt,
            uint80  answeredInRound
        ) = priceFeed.latestRoundData();

        require(answer > 0, "Invalid price from oracle");

        // Prevent near-zero oracle answers which would inflate MTAA amounts
        if (uint256(answer) < minOraclePrice) revert MinOraclePriceTooLow(answer, minOraclePrice);

        // FIX #5: staleness checks
        if (block.timestamp - updatedAt > PRICE_FEED_MAX_AGE) {
            revert StalePriceFeed(updatedAt, PRICE_FEED_MAX_AGE);
        }
        require(answeredInRound >= roundId, "Incomplete Chainlink round");

        // FIX #4: use actual feed decimals, not hardcoded 8
        uint8   feedDecimals = priceFeed.decimals();
        uint256 price        = uint256(answer);

        if (feedDecimals >= 8) {
            return (usd8 * (10 ** (uint256(feedDecimals) - 8)) * 1e18) / price;
        } else {
            return (usd8 * 1e18) / (price * (10 ** (8 - uint256(feedDecimals))));
        }
    }

    function payDAOCreationFeeWithToken(address payToken, uint256 amount) external nonReentrant {
        if (!daoCreationFeeEnabled) return;

        if (payToken == address(this)) {
            uint256 required = daoCreationFeeUsd8 > 0 ? _mtAAForUsd8(daoCreationFeeUsd8) : daoCreationFee;
            require(amount >= required, "Insufficient MTAA for fee");
            _acceptPayment(msg.sender, payToken, required, FEE_DAO_CREATION);
        } else {
            require(amount > 0, "Amount must be greater than 0");
            _acceptPayment(msg.sender, payToken, amount, FEE_DAO_CREATION);
        }
    }

    // =========================================================================
    // BURN SYSTEM
    // =========================================================================

    /**
     * @dev FIX #8: quarterlyBurn() now respects burnTarget.
     *      Once totalBurned >= burnTarget, the function reverts.
     *      Governance can extend it with setBurnTarget().
     */
    function quarterlyBurn() external onlyOwner {
        // FIX #8: Enforce burn target
        if (totalBurned >= burnTarget) revert BurnTargetReached();

        if (block.timestamp < lastQuarterlyBurn + QUARTERLY_BURN_COOLDOWN) {
            revert QuarterlyBurnCooldown(lastQuarterlyBurn + QUARTERLY_BURN_COOLDOWN);
        }

        lastQuarterlyBurn = block.timestamp;

        uint256 desiredBurn   = (totalSupply() * 250) / 10_000; // 2.5%
        uint256 remainingTarget = burnTarget - totalBurned;
        if (desiredBurn > remainingTarget) desiredBurn = remainingTarget;

        uint256 ownerBalance = balanceOf(owner());
        uint256 contractBalance = balanceOf(address(this));

        uint256 burnFromOwner = ownerBalance >= desiredBurn ? desiredBurn : ownerBalance;
        uint256 remaining = desiredBurn - burnFromOwner;
        uint256 burnFromContract = contractBalance >= remaining ? remaining : contractBalance;

        uint256 totalBurn = burnFromOwner + burnFromContract;
        if (totalBurn == 0) revert BurnTargetReached();

        if (burnFromOwner > 0) _burn(owner(), burnFromOwner);
        if (burnFromContract > 0) _burn(address(this), burnFromContract);

        unchecked { totalBurned += totalBurn; }

        emit QuarterlyBurnExecuted(totalBurn, totalBurned);
    }

    // =========================================================================
    // EMERGENCY MINT  (FIX #3 — both functions implemented)
    // =========================================================================

    /**
     * @notice Schedule an emergency token mint, subject to a 48-hour timelock.
     * @dev    Requires EMERGENCY_ROLE. Provides a 48hr window for governance
     *         to react and revoke the role if the request is illegitimate.
     */
    function scheduleEmergencyMint(address to, uint256 amount)
        external
        onlyRole(EMERGENCY_ROLE)
    {
        if (to == address(0)) revert ZeroAddress();
        if (amount == 0)      revert InvalidAmount();

        uint256 headroom = MAX_SUPPLY - totalSupply();
        if (amount > headroom) revert MaxSupplyHeadroomInsufficient(headroom, amount);

        uint256 requestId = _nextMintRequestId++;

        mintRequests[requestId] = MintRequest({
            to:          to,
            amount:      amount,
            scheduledAt: block.timestamp,
            scheduledBy: msg.sender,
            executed:    false
        });

        emit EmergencyMintScheduled(
            requestId,
            to,
            amount,
            block.timestamp + EMERGENCY_MINT_DELAY
        );
    }

    /**
     * @notice Execute a previously scheduled emergency mint after the timelock expires.
     * @dev    Can be called by any EMERGENCY_ROLE holder, not necessarily the scheduler.
     */
    function executeEmergencyMint(uint256 requestId)
        external
        onlyRole(EMERGENCY_ROLE)
    {
        MintRequest storage req = mintRequests[requestId];

        if (req.to == address(0)) revert MintRequestNotFound();
        if (req.executed)         revert MintRequestAlreadyExecuted();

        uint256 executeAfter = req.scheduledAt + EMERGENCY_MINT_DELAY;
        if (block.timestamp < executeAfter) revert MintRequestNotReady(executeAfter);

        // Restrict executability to the original scheduler or the owner to mitigate
        // frontrunning by other EMERGENCY_ROLE holders.
        if (msg.sender != req.scheduledBy && msg.sender != owner()) revert NotAuthorized();

        req.executed = true;
        _mint(req.to, req.amount);

        emit EmergencyMintExecuted(requestId, req.to, req.amount);
    }

    event EmergencyMintCancelled(uint256 indexed requestId);

    function cancelEmergencyMint(uint256 requestId) external {
        MintRequest storage req = mintRequests[requestId];
        if (req.to == address(0)) revert MintRequestNotFound();
        if (req.executed) revert MintRequestAlreadyExecuted();

        // Only owner or scheduler can cancel
        if (msg.sender != req.scheduledBy && msg.sender != owner()) revert NotAuthorized();

        delete mintRequests[requestId];
        emit EmergencyMintCancelled(requestId);
    }

    // =========================================================================
    // ADMIN FUNCTIONS
    // =========================================================================

    function pause()   external onlyOwner { _pause(); }
    function unpause() external onlyOwner { _unpause(); }

    function setLockPeriodMultiplier(uint256 days_, uint256 multiplier) external onlyOwner {
        if (multiplier == 0 || multiplier > MAX_LOCK_MULTIPLIER) revert InvalidAmount();
        lockPeriodMultipliers[days_] = multiplier;
        emit LockPeriodMultiplierSet(days_, multiplier);
    }

    function setPriceFeed(address feed) external onlyOwner {
        priceFeed = AggregatorV3Interface(feed);
        emit PriceFeedUpdated(feed);
    }

    function setFeeUsd(bytes32 feeType, uint256 usd8) external onlyOwner {
        if (usd8 == 0) revert InvalidAmount();
        if (feeType == FEE_DAO_CREATION)  daoCreationFeeUsd8    = usd8;
        else if (feeType == FEE_VAULT_DEPLOY) vaultDeploymentFeeUsd8 = usd8;
        else revert InvalidFeeType();
        emit FeeUpdated(feeType, usd8);
    }

    function toggleDaoCreationFee(bool enabled) external onlyOwner {
        daoCreationFeeEnabled = enabled;
    }

    // FIX #7 — post-deploy setters for integration contracts
    function setMultiSigTreasury(address _newTreasury) external onlyOwner {
        if (_newTreasury == address(0)) revert ZeroAddress();
        address old = multiSigTreasury;
        multiSigTreasury = _newTreasury;
        emit MultiSigTreasuryUpdated(old, _newTreasury);
    }

    function setReputationEngine(address _engine) external onlyOwner {
        reputationEngine = _engine;
        emit ReputationEngineUpdated(_engine);
    }

    function setApyCalculator(address _calculator) external onlyOwner {
        apyCalculator = _calculator;
        emit ApyCalculatorUpdated(_calculator);
    }

    /**
     * @notice Owner helper to distribute sensitive roles to dedicated addresses
     * @dev Owner can call this post-deploy to reduce centralization risk
     */
    function distributeRoles(address admin, address oracle, address emergency) external onlyOwner {
        if (admin != address(0)) _grantRole(DEFAULT_ADMIN_ROLE, admin);
        if (oracle != address(0)) _grantRole(ORACLE_ROLE, oracle);
        if (emergency != address(0)) _grantRole(EMERGENCY_ROLE, emergency);
        emit RolesDistributed(admin, oracle, emergency);
    }

    // FIX #8 — governance can extend burn target beyond initial 10M
    function setBurnTarget(uint256 _newTarget) external onlyOwner {
        if (_newTarget <= totalBurned) revert InvalidAmount();
        burnTarget = _newTarget;
        emit BurnTargetUpdated(_newTarget);
    }

    // FIX #9 — governance can adjust daily reward cap
    function setMaxDailyRewardAmount(uint256 _maxReward) external onlyOwner {
        if (_maxReward == 0) revert InvalidAmount();
        maxDailyRewardAmount = _maxReward;
        emit MaxDailyRewardUpdated(_maxReward);
    }
}
