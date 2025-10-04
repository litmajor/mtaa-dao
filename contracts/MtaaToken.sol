// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Votes.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title MTAAToken
 * @notice The native utility token for MtaaDAO ecosystem
 * @dev ERC20 token with vesting, staking, and governance features
 */
contract MTAAToken is ERC20, ERC20Burnable, ERC20Permit, Ownable, Pausable, ReentrancyGuard {
    // Total supply: 1 billion MTAA
    uint256 public constant MAX_SUPPLY = 1_000_000_000 * 1e18;
    
    // Vesting schedules
    mapping(address => VestingSchedule[]) public vestingSchedules;
    mapping(address => uint256) public totalVested;
    mapping(address => uint256) public totalClaimed;
    
    // Staking system
    mapping(address => StakeInfo) public stakes;
    mapping(address => uint256) public reputationScores;
    mapping(uint256 => uint256) public lockPeriodMultipliers; // days => multiplier (basis points)
    
    // Governance handled by ERC20Votes
    
    // Daily challenges and rewards
    mapping(address => uint256) public lastDailyAction;
    mapping(address => uint256) public streakDays;
    mapping(address => mapping(string => bool)) public completedChallenges;
    
    // Fee system
    uint256 public constant DAO_CREATION_FEE = 1000 * 1e18;
    uint256 public constant VAULT_DEPLOYMENT_FEE = 500 * 1e18;
    uint256 public constant PREMIUM_PROPOSAL_FEE = 100 * 1e18;
    uint256 public constant ANALYTICS_MONTHLY_FEE = 50 * 1e18;
    
    // Burn tracking
    uint256 public totalBurned;
    uint256 public burnTarget = 10_000_000 * 1e18; // Year 1 target
    
    struct VestingSchedule {
        uint256 totalAmount;
        uint256 startTime;
        uint256 duration;
        uint256 cliffPeriod;
        VestingType vestingType;
    }
    
    struct StakeInfo {
        uint256 amount;
        uint256 lockPeriod; // in days
        uint256 stakeTime;
        uint256 lastRewardClaim;
        bool isActive;
    }
    
    enum VestingType {
        COMMUNITY_REWARDS,
        TEAM_ADVISORS,
        ECOSYSTEM_DEV,
        STRATEGIC_PARTNERS
    }
    
    enum ReputationTier {
        MEMBER,      // 0-999
        CONTRIBUTOR, // 1000-4999
        ELDER,       // 5000-9999
        ARCHITECT    // 10000+
    }

    // Events
    event VestingScheduleCreated(address indexed beneficiary, uint256 amount, VestingType vestingType);
    event TokensVested(address indexed beneficiary, uint256 amount);
    event Staked(address indexed user, uint256 amount, uint256 lockPeriod);
    event Unstaked(address indexed user, uint256 amount, uint256 reward);
    event StakeRewardsClaimed(address indexed user, uint256 reward);
    event DailyChallengeCompleted(address indexed user, string challenge, uint256 reward);
    event ReputationUpdated(address indexed user, uint256 newScore, ReputationTier tier);
    event FeeCollected(address indexed payer, uint256 amount, string feeType);

    // Errors
    error MaxSupplyExceeded();
    error InvalidVestingSchedule();
    error NothingToVest();
    error StakeNotFound();
    error StakeLocked();
    error InsufficientBalance();
    error InvalidLockPeriod();
    error ChallengeAlreadyCompleted();
    error InsufficientFee();
    error StakeAmountTooLow();
    error AlreadyStaked();
    error NoRewardsToClaim();

    constructor(address _owner)
        ERC20("MtaaDAO Token", "MTAA")
        ERC20Burnable()
        ERC20Permit("MtaaDAO Token")
        Ownable()
        Pausable()
        ReentrancyGuard()
    {
        transferOwnership(_owner);
        // Initialize lock period multipliers (basis points: 100 = 1%)
        // Fixed values to match APY comments (e.g., 800 = 8%)
        lockPeriodMultipliers[30] = 800;   // 8% APY for 30 days
        lockPeriodMultipliers[90] = 1000;  // 10% APY for 90 days
        lockPeriodMultipliers[180] = 1200; // 12% APY for 180 days
        lockPeriodMultipliers[365] = 1500; // 15% APY for 365 days
        // Mint initial liquidity (7.5% of total supply)
        _mint(_owner, 75_000_000 * 1e18);
        // Mint public sale tokens (5% of total supply)
        _mint(_owner, 50_000_000 * 1e18);
    }

    // === VESTING SYSTEM ===

    /**
     * @notice Creates a new vesting schedule for a beneficiary
     * @param beneficiary Address to receive vested tokens
     * @param amount Total amount to vest
     * @param startTime Vesting start timestamp (0 for now)
     * @param duration Total vesting duration in seconds
     * @param cliffPeriod Cliff period in seconds
     * @param vestingType Type of vesting
     */
    function createVestingSchedule(
        address beneficiary,
        uint256 amount,
        uint256 startTime,
        uint256 duration,
        uint256 cliffPeriod,
        VestingType vestingType
    ) external onlyOwner {
        if (totalSupply() + amount > MAX_SUPPLY) revert MaxSupplyExceeded();
        if (amount == 0 || duration == 0) revert InvalidVestingSchedule();
        
        vestingSchedules[beneficiary].push(VestingSchedule({
            totalAmount: amount,
            startTime: startTime == 0 ? block.timestamp : startTime,
            duration: duration,
            cliffPeriod: cliffPeriod,
            vestingType: vestingType
        }));
        
        totalVested[beneficiary] += amount;
        
        emit VestingScheduleCreated(beneficiary, amount, vestingType);
    }

    /**
     * @notice Claims all vestable tokens for the caller
     */
    function vestTokens() external nonReentrant {
        uint256 totalVestable = getVestableAmount(msg.sender);
        if (totalVestable == 0) revert NothingToVest();
        if (totalSupply() + totalVestable > MAX_SUPPLY) revert MaxSupplyExceeded();
        totalClaimed[msg.sender] += totalVestable;
        _mint(msg.sender, totalVestable);
        emit TokensVested(msg.sender, totalVestable);
    }

    /**
     * @notice Calculates the current vestable amount for a beneficiary
     * @param beneficiary Address to check
     * @return uint256 Vestable amount
     */
    function getVestableAmount(address beneficiary) public view returns (uint256) {
        VestingSchedule[] memory schedules = vestingSchedules[beneficiary];
        uint256 totalVestable = 0;
        
        for (uint i = 0; i < schedules.length; i++) {
            VestingSchedule memory schedule = schedules[i];
            
            if (block.timestamp < schedule.startTime + schedule.cliffPeriod) {
                continue;
            }
            
            uint256 elapsed = block.timestamp - schedule.startTime;
            if (elapsed >= schedule.duration) {
                totalVestable += schedule.totalAmount;
            } else {
                totalVestable += (schedule.totalAmount * elapsed) / schedule.duration;
            }
        }
        
        return totalVestable - totalClaimed[beneficiary];
    }

    // === STAKING SYSTEM ===

    /**
     * @notice Stakes tokens for rewards (burns tokens to reduce supply)
     * @param amount Amount to stake (min 1000 MTAA)
     * @param lockPeriodDays Lock period in days (30,90,180,365)
     */
    function stake(uint256 amount, uint256 lockPeriodDays) external nonReentrant whenNotPaused {
        if (amount < 1000 * 1e18) revert StakeAmountTooLow();
        if (lockPeriodMultipliers[lockPeriodDays] == 0) revert InvalidLockPeriod();
        if (stakes[msg.sender].isActive) revert AlreadyStaked();
        
        _burn(msg.sender, amount);
        
        stakes[msg.sender] = StakeInfo({
            amount: amount,
            lockPeriod: lockPeriodDays,
            stakeTime: block.timestamp,
            lastRewardClaim: block.timestamp,
            isActive: true
        });
        
        emit Staked(msg.sender, amount, lockPeriodDays);
    }

    /**
     * @notice Claims pending stake rewards without unstaking
     */
    function claimStakeRewards() external nonReentrant {
        StakeInfo storage stakeInfo = stakes[msg.sender];
        if (!stakeInfo.isActive) revert StakeNotFound();
        
        uint256 rewards = calculateStakeRewards(msg.sender);
        if (rewards == 0) revert NoRewardsToClaim();
        
        stakeInfo.lastRewardClaim = block.timestamp;
        _mint(msg.sender, rewards);
        
        emit StakeRewardsClaimed(msg.sender, rewards);
    }

    /**
     * @notice Unstakes and claims all rewards
     */
    function unstake() external nonReentrant {
        StakeInfo storage stakeInfo = stakes[msg.sender];
        if (!stakeInfo.isActive) revert StakeNotFound();
        if (block.timestamp < stakeInfo.stakeTime + (stakeInfo.lockPeriod * 1 days)) {
            revert StakeLocked();
        }
        
        uint256 stakedAmount = stakeInfo.amount;
        uint256 rewards = calculateStakeRewards(msg.sender);
        
        stakeInfo.isActive = false;
        stakeInfo.amount = 0;
        
        _mint(msg.sender, stakedAmount + rewards);
        
        emit Unstaked(msg.sender, stakedAmount, rewards);
    }

    /**
     * @notice Calculates pending stake rewards
     * @param staker Address to check
     * @return uint256 Pending rewards
     */
    function calculateStakeRewards(address staker) public view returns (uint256) {
        StakeInfo memory stakeInfo = stakes[staker];
        if (!stakeInfo.isActive) return 0;
        
        uint256 timeStaked = block.timestamp - stakeInfo.lastRewardClaim;
        uint256 annualReward = (stakeInfo.amount * lockPeriodMultipliers[stakeInfo.lockPeriod]) / 10000;
        uint256 reward = (annualReward * timeStaked) / (365 days);
        
        // Apply reputation multiplier
        ReputationTier tier = getReputationTier(staker);
        if (tier == ReputationTier.CONTRIBUTOR) reward = (reward * 125) / 100;
        else if (tier == ReputationTier.ELDER) reward = (reward * 150) / 100;
        else if (tier == ReputationTier.ARCHITECT) reward = (reward * 200) / 100;
        
        return reward;
    }

    // === GOVERNANCE SYSTEM ===

    /**
     * @notice Gets current voting power (delegated votes)
     * @param account Address to check
     * @return uint256 Voting power
     */
    function getVotingPower(address account) external view returns (uint256) {
        return getVotes(account);
    }

    // === DAILY CHALLENGES & REWARDS ===

    /**
     * @notice Completes a daily challenge and rewards the user (called by owner/oracle)
     * @param user User address
     * @param challengeType Challenge identifier
     * @param rewardAmount Base reward amount
     */
    function completeDailyChallenge(address user, string calldata challengeType, uint256 rewardAmount) 
        external 
        onlyOwner 
    {
        string memory todayKey = string(abi.encodePacked(challengeType, "_", _toString(block.timestamp / 86400)));
        
        if (completedChallenges[user][todayKey]) revert ChallengeAlreadyCompleted();
        
        completedChallenges[user][todayKey] = true;
        
        // Update streak
        if (lastDailyAction[user] == (block.timestamp / 86400) - 1) {
            streakDays[user]++;
        } else if (lastDailyAction[user] != block.timestamp / 86400) {
            streakDays[user] = 1;
        }
        lastDailyAction[user] = block.timestamp / 86400;
        
        // Apply streak multiplier
        uint256 finalReward = _applyStreakMultiplier(rewardAmount, streakDays[user]);
        
        _mint(user, finalReward);
        
        emit DailyChallengeCompleted(user, challengeType, finalReward);
    }

    function _applyStreakMultiplier(uint256 baseReward, uint256 streak) internal pure returns (uint256) {
        if (streak >= 365) return (baseReward * 500) / 100; // 5x
        if (streak >= 90) return (baseReward * 300) / 100;  // 3x
        if (streak >= 30) return (baseReward * 200) / 100;  // 2x
        if (streak >= 7) return (baseReward * 150) / 100;   // 1.5x
        return baseReward;
    }

    // === REPUTATION SYSTEM ===

    /**
     * @notice Updates user's reputation score (called by owner/oracle)
     * @param user User address
     * @param newScore New reputation score
     */
    function updateReputation(address user, uint256 newScore) external onlyOwner {
        reputationScores[user] = newScore;
        
        ReputationTier newTier = getReputationTier(user);
        emit ReputationUpdated(user, newScore, newTier);
    }

    /**
     * @notice Gets reputation tier for a user
     * @param user User address
     * @return ReputationTier Current tier
     */
    function getReputationTier(address user) public view returns (ReputationTier) {
        uint256 score = reputationScores[user];
        if (score >= 10000) return ReputationTier.ARCHITECT;
        if (score >= 5000) return ReputationTier.ELDER;
        if (score >= 1000) return ReputationTier.CONTRIBUTOR;
        return ReputationTier.MEMBER;
    }

    // === FEE SYSTEM ===

    /**
     * @notice Pays DAO creation fee (50% burn, 50% to treasury)
     */
    function payDAOCreationFee() external {
        if (balanceOf(msg.sender) < DAO_CREATION_FEE) revert InsufficientFee();
        
        uint256 burnAmount = DAO_CREATION_FEE / 2;
        uint256 treasuryAmount = DAO_CREATION_FEE - burnAmount;
        
        _burn(msg.sender, burnAmount);
        _transfer(msg.sender, owner(), treasuryAmount);
        
        totalBurned += burnAmount;
        
        emit FeeCollected(msg.sender, DAO_CREATION_FEE, "DAO_CREATION");
    }

    /**
     * @notice Pays vault deployment fee (50% burn, 50% to treasury)
     */
    function payVaultDeploymentFee() external {
        if (balanceOf(msg.sender) < VAULT_DEPLOYMENT_FEE) revert InsufficientFee();
        
        uint256 burnAmount = VAULT_DEPLOYMENT_FEE / 2;
        uint256 treasuryAmount = VAULT_DEPLOYMENT_FEE - burnAmount;
        
        _burn(msg.sender, burnAmount);
        _transfer(msg.sender, owner(), treasuryAmount);
        
        totalBurned += burnAmount;
        
        emit FeeCollected(msg.sender, VAULT_DEPLOYMENT_FEE, "VAULT_DEPLOYMENT");
    }

    // === BURN SYSTEM ===

    /**
     * @notice Performs quarterly burn from treasury (max 2.5% of supply)
     */
    function quarterlyBurn() external onlyOwner {
        uint256 burnAmount = (totalSupply() * 250) / 10000; // 2.5% quarterly
        if (burnAmount > balanceOf(owner())) {
            burnAmount = balanceOf(owner());
        }
        
        _burn(owner(), burnAmount);
        totalBurned += burnAmount;
    }

    // === UTILITY FUNCTIONS ===

    function _toString(uint256 value) internal pure returns (string memory) {
        if (value == 0) return "0";
        uint256 temp = value;
        uint256 digits;
        while (temp != 0) {
            digits++;
            temp /= 10;
        }
        bytes memory buffer = new bytes(digits);
        while (value != 0) {
            digits -= 1;
            buffer[digits] = bytes1(uint8(48 + uint256(value % 10)));
            value /= 10;
        }
        return string(buffer);
    }

    // === ADMIN FUNCTIONS ===

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    function setLockPeriodMultiplier(uint256 days_, uint256 multiplier) external onlyOwner {
        lockPeriodMultipliers[days_] = multiplier;
    }

    function emergencyMint(address to, uint256 amount) external onlyOwner {
        if (totalSupply() + amount > MAX_SUPPLY) revert MaxSupplyExceeded();
        _mint(to, amount);
    }

    // === VIEW FUNCTIONS ===

    function getStakeInfo(address staker) external view returns (StakeInfo memory) {
        return stakes[staker];
    }

    function getVestingSchedules(address beneficiary) external view returns (VestingSchedule[] memory) {
        return vestingSchedules[beneficiary];
    }

    function getUserStreak(address user) external view returns (uint256) {
        if (lastDailyAction[user] == block.timestamp / 86400 || 
            lastDailyAction[user] == (block.timestamp / 86400) - 1) {
            return streakDays[user];
        }
        return 0;
    }

    function getBurnProgress() external view returns (uint256 burned, uint256 target, uint256 percentage) {
        return (totalBurned, burnTarget, (totalBurned * 100) / burnTarget);
    // Remove ERC20Votes overrides since ERC20Votes is not inherited
    // Remove ERC20Votes overrides since ERC20Votes is not inherited
    function _mint(address to, uint256 amount)
        internal override(ERC20)
    {
        super._mint(to, amount);
    }

    function _burn(address account, uint256 amount)
        internal override(ERC20)
    {
        super._burn(account, amount);
    }
}