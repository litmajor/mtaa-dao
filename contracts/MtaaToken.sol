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
contract MTAAToken is ERC20, ERC20Burnable, ERC20Permit, ERC20Votes, Ownable, Pausable, ReentrancyGuard {
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
    mapping(address => mapping(bytes32 => bool)) public completedChallenges; // Use hash for key
    
    // Fee system
    uint256 public daoCreationFee = 1000 * 1e18;
    uint256 public vaultDeploymentFee = 500 * 1e18;
    uint256 public premiumProposalFee = 100 * 1e18;
    uint256 public analyticsMonthlyFee = 50 * 1e18;
    
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
    event FeeUpdated(string feeType, uint256 newFee);
    event LockPeriodMultiplierSet(uint256 days_, uint256 multiplier);

    // Errors
    error MaxSupplyExceeded();
    error InvalidVestingSchedule();
    error NothingToVest();
    error StakeNotFound();
    error StakeLocked();
    error InsufficientBalance(uint256 provided, uint256 required);
    error InvalidLockPeriod();
    error ChallengeAlreadyCompleted();
    error InsufficientFee(uint256 provided, uint256 required);
    error StakeAmountTooLow(uint256 provided, uint256 minimum);
    error AlreadyStaked();
    error NoRewardsToClaim();

    constructor(address _owner)
        ERC20("MtaaDAO Token", "MTAA")
        ERC20Permit("MtaaDAO Token")
        Ownable(_owner)
    {
        // Initialize lock period multipliers (basis points: 100 = 1%)
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
        if (amount == 0 || duration == 0) revert InvalidVestingSchedule();
        
        vestingSchedules[beneficiary].push(VestingSchedule({
            totalAmount: amount,
            startTime: startTime == 0 ? block.timestamp : startTime,
            duration: duration,
            cliffPeriod: cliffPeriod,
            vestingType: vestingType
        }));
        
        unchecked { totalVested[beneficiary] += amount; }
        
        emit VestingScheduleCreated(beneficiary, amount, vestingType);
    }

    /**
     * @notice Claims all vestable tokens for the caller
     */
    function vestTokens() external nonReentrant {
        uint256 totalVestable = getVestableAmount(msg.sender);
        if (totalVestable == 0) revert NothingToVest();
        
        unchecked { totalClaimed[msg.sender] += totalVestable; }
        _mint(msg.sender, totalVestable);
        
        emit TokensVested(msg.sender, totalVestable);
    }

    /**
     * @notice Calculates the current vestable amount for a beneficiary
     * @param beneficiary Address to check
     * @return uint256 Vestable amount
     */
    function getVestableAmount(address beneficiary) public view returns (uint256) {
        VestingSchedule[] storage schedules = vestingSchedules[beneficiary];
        uint256 totalVestable = 0;
        uint256 currentTime = block.timestamp;
        
        for (uint256 i = 0; i < schedules.length; ++i) {
            VestingSchedule storage schedule = schedules[i];
            
            if (currentTime < schedule.startTime + schedule.cliffPeriod) continue;
            
            uint256 elapsed;
            unchecked { elapsed = currentTime - schedule.startTime; }
            uint256 vestable = (elapsed >= schedule.duration) 
                ? schedule.totalAmount 
                : (schedule.totalAmount * elapsed) / schedule.duration;
            
            unchecked { totalVestable += vestable; }
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
        if (amount < 1000 * 1e18) revert StakeAmountTooLow(amount, 1000 * 1e18);
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
        if (block.timestamp < stakeInfo.stakeTime + (stakeInfo.lockPeriod * 1 days)) revert StakeLocked();
        
        uint256 stakedAmount = stakeInfo.amount;
        uint256 rewards = calculateStakeRewards(msg.sender);
        
        stakeInfo.isActive = false;
        stakeInfo.amount = 0;
        stakeInfo.lastRewardClaim = block.timestamp;
        
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
        
        uint256 timeStaked;
        unchecked { timeStaked = block.timestamp - stakeInfo.lastRewardClaim; }
        
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
        bytes32 todayKey = keccak256(abi.encodePacked(challengeType, block.timestamp / 86400));
        
        if (completedChallenges[user][todayKey]) revert ChallengeAlreadyCompleted();
        
        completedChallenges[user][todayKey] = true;
        
        // Update streak
        uint256 currentDay = block.timestamp / 86400;
        if (lastDailyAction[user] == currentDay - 1) {
            unchecked { streakDays[user]++; }
        } else if (lastDailyAction[user] != currentDay) {
            streakDays[user] = 1;
        }
        lastDailyAction[user] = currentDay;
        
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
        uint256 fee = daoCreationFee;
        if (balanceOf(msg.sender) < fee) revert InsufficientFee(balanceOf(msg.sender), fee);
        
        uint256 burnAmount = fee / 2;
        uint256 treasuryAmount = fee - burnAmount;
        
        _burn(msg.sender, burnAmount);
        _transfer(msg.sender, owner(), treasuryAmount);
        
        unchecked { totalBurned += burnAmount; }
        
        emit FeeCollected(msg.sender, fee, "DAO_CREATION");
    }

    /**
     * @notice Pays vault deployment fee (50% burn, 50% to treasury)
     */
    function payVaultDeploymentFee() external {
        uint256 fee = vaultDeploymentFee;
        if (balanceOf(msg.sender) < fee) revert InsufficientFee(balanceOf(msg.sender), fee);
        
        uint256 burnAmount = fee / 2;
        uint256 treasuryAmount = fee - burnAmount;
        
        _burn(msg.sender, burnAmount);
        _transfer(msg.sender, owner(), treasuryAmount);
        
        unchecked { totalBurned += burnAmount; }
        
        emit FeeCollected(msg.sender, fee, "VAULT_DEPLOYMENT");
    }

    // === BURN SYSTEM ===

    /**
     * @notice Performs quarterly burn from treasury (max 2.5% of supply)
     */
    function quarterlyBurn() external onlyOwner {
        uint256 burnAmount = (totalSupply() * 250) / 10000; // 2.5% quarterly
        uint256 treasuryBalance = balanceOf(owner());
        if (burnAmount > treasuryBalance) burnAmount = treasuryBalance;
        
        _burn(owner(), burnAmount);
        unchecked { totalBurned += burnAmount; }
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
        emit LockPeriodMultiplierSet(days_, multiplier);
    }

    function setFee(string calldata feeType, uint256 newFee) external onlyOwner {
        bytes32 typeHash = keccak256(abi.encodePacked(feeType));
        if (typeHash == keccak256(abi.encodePacked("DAO_CREATION"))) daoCreationFee = newFee;
        else if (typeHash == keccak256(abi.encodePacked("VAULT_DEPLOYMENT"))) vaultDeploymentFee = newFee;
        else if (typeHash == keccak256(abi.encodePacked("PREMIUM_PROPOSAL"))) premiumProposalFee = newFee;
        else if (typeHash == keccak256(abi.encodePacked("ANALYTICS_MONTHLY"))) analyticsMonthlyFee = newFee;
        else revert("Invalid fee type");
        
        emit FeeUpdated(feeType, newFee);
    }

    function emergencyMint(address to, uint256 amount) external onlyOwner {
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
        uint256 currentDay = block.timestamp / 86400;
        if (lastDailyAction[user] == currentDay || lastDailyAction[user] == currentDay - 1) {
            return streakDays[user];
        }
        return 0;
    }

    function getBurnProgress() external view returns (uint256 burned, uint256 target, uint256 percentage) {
        return (totalBurned, burnTarget, (totalBurned * 100) / burnTarget);
    }

    // === Overrides for ERC20Votes ===
    function _mint(address to, uint256 amount) internal override(ERC20, ERC20Votes) {
        if (totalSupply() + amount > MAX_SUPPLY) revert MaxSupplyExceeded();
        super._mint(to, amount);
    }

    function _burn(address account, uint256 amount) internal override(ERC20, ERC20Votes) {
        super._burn(account, amount);
    }

    function _afterTokenTransfer(address from, address to, uint256 amount) internal override(ERC20, ERC20Votes) {
        super._afterTokenTransfer(from, to, amount);
    }

    function nonces(address owner) public view override(ERC20Permit, Nonces) returns (uint256) {
        return super.nonces(owner);
    }
}