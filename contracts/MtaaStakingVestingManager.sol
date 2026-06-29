// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

interface IFloatingAPYCalculator {
    function calculateAPY(uint256 totalStaked) external view returns (uint256);
}

interface ITokenView {
    function apyCalculator() external view returns (address);
    function getReputationTier(address user) external view returns (uint8);
    function MAX_APY_BPS() external view returns (uint256);
    function lockPeriodMultipliers(uint256 days_) external view returns (uint256);
    function totalSupply() external view returns (uint256);
}

contract MtaaStakingVestingManager is Ownable {
    using SafeERC20 for IERC20;

    IERC20 public token; // MTAA token instance (holds staked tokens)
    address public tokenContract; // authorized caller (the token contract)

    uint256 private _nextStakeId;

    struct StakeInfo {
        uint256 amount;
        uint256 lockPeriod;
        uint256 stakeTime;
        uint256 lastRewardClaim;
        bool isActive;
    }

    mapping(address => mapping(uint256 => StakeInfo)) public stakes;
    mapping(address => uint256[]) public userStakeIds;
    mapping(address => uint256) public stakedBalances;
    uint256 public totalStakedAmount;

    // Vesting
    struct VestingSchedule {
        uint256 totalAmount;
        uint256 claimed;
        uint256 startTime;
        uint256 duration;
        uint256 cliffPeriod;
        uint8   vestingType;
    }

    mapping(address => VestingSchedule[]) public vestingSchedules;

    event Staked(address indexed user, uint256 indexed stakeId, uint256 amount, uint256 lockPeriod);
    event Unstaked(address indexed user, uint256 indexed stakeId, uint256 amount, uint256 reward);
    event StakeRewardsClaimed(address indexed user, uint256 indexed stakeId, uint256 reward);
    event VestingScheduleCreated(address indexed beneficiary, uint256 scheduleIndex, uint256 amount, uint8 vestingType);
    event VestingReleased(address indexed beneficiary, uint256 amount);

    modifier onlyToken() {
        if (msg.sender != tokenContract) revert("Unauthorized");
        _;
    }

    constructor(address _token) Ownable(msg.sender) {
        if (_token == address(0)) revert("Zero token");
        token = IERC20(_token);
        // owner can later set tokenContract to the token address
    }

    function setTokenContract(address _tokenContract) external onlyOwner {
        tokenContract = _tokenContract;
    }

    // Called by token contract after transferring tokens to this contract
    function stakeFor(address staker, uint256 amount, uint256 lockPeriodDays) external onlyToken returns (uint256) {
        uint256 multiplier = ITokenView(tokenContract).lockPeriodMultipliers(lockPeriodDays);
        if (multiplier == 0) revert("Invalid lock period");

        uint256 stakeId = _nextStakeId++;

        stakes[staker][stakeId] = StakeInfo({
            amount: amount,
            lockPeriod: lockPeriodDays,
            stakeTime: block.timestamp,
            lastRewardClaim: block.timestamp,
            isActive: true
        });

        userStakeIds[staker].push(stakeId);
        stakedBalances[staker] += amount;
        totalStakedAmount += amount;

        emit Staked(staker, stakeId, amount, lockPeriodDays);
        return stakeId;
    }

    function claimStakeRewardsFor(address staker, uint256 stakeId) external onlyToken returns (uint256) {
        StakeInfo storage s = stakes[staker][stakeId];
        if (!s.isActive) revert("Stake not found");

        uint256 rewards = calculateStakeRewards(staker, stakeId);
        if (rewards == 0) revert("No rewards");

        s.lastRewardClaim = block.timestamp;
        emit StakeRewardsClaimed(staker, stakeId, rewards);
        return rewards;
    }

    function unstakeFor(address staker, uint256 stakeId) external onlyToken returns (uint256 stakedAmount, uint256 rewards) {
        StakeInfo storage s = stakes[staker][stakeId];
        if (!s.isActive) revert("Stake not found");
        if (block.timestamp < s.stakeTime + (s.lockPeriod * 1 days)) revert("Stake locked");

        stakedAmount = s.amount;
        rewards = calculateStakeRewards(staker, stakeId);

        s.isActive = false;
        s.amount = 0;
        s.lastRewardClaim = block.timestamp;

        if (stakedBalances[staker] < stakedAmount) revert("Underflow");
        unchecked { stakedBalances[staker] -= stakedAmount; totalStakedAmount -= stakedAmount; }

        // transfer staked tokens back to staker
        token.safeTransfer(staker, stakedAmount);

        if (rewards > 0) {
            // token contract will mint rewards after calling this function
        }

        emit Unstaked(staker, stakeId, stakedAmount, rewards);
        return (stakedAmount, rewards);
    }

    function calculateStakeRewards(address staker, uint256 stakeId) public view returns (uint256) {
        StakeInfo memory s = stakes[staker][stakeId];
        if (!s.isActive) return 0;

        uint256 timeStaked = block.timestamp - s.lastRewardClaim;

        address apyCalc = ITokenView(tokenContract).apyCalculator();
        uint256 apy = apyCalc != address(0)
            ? IFloatingAPYCalculator(apyCalc).calculateAPY(totalStakedAmount)
            : ITokenView(tokenContract).lockPeriodMultipliers(s.lockPeriod);

        uint256 maxApy = ITokenView(tokenContract).MAX_APY_BPS();
        if (apy > maxApy) apy = maxApy;

        uint256 annualReward = (s.amount * apy) / 10_000;
        uint256 reward = (annualReward * timeStaked) / 365 days;

        uint8 tier = ITokenView(tokenContract).getReputationTier(staker);
        if (tier == 4) reward = (reward * 300) / 100; // SHOGUN
        else if (tier == 3) reward = (reward * 200) / 100; // ARCHITECT
        else if (tier == 2) reward = (reward * 150) / 100; // ELDER
        else if (tier == 1) reward = (reward * 125) / 100; // CONTRIBUTOR

        return reward;
    }

    function getTotalStaked() external view returns (uint256) {
        return totalStakedAmount;
    }

    // Vesting
    function createVestingScheduleFor(address beneficiary, uint256 amount, uint256 startTime, uint256 duration, uint256 cliffPeriod, uint8 vestingType) external onlyToken {
        uint256 idx = vestingSchedules[beneficiary].length;
        vestingSchedules[beneficiary].push(VestingSchedule({
            totalAmount: amount,
            claimed: 0,
            startTime: startTime == 0 ? block.timestamp : startTime,
            duration: duration,
            cliffPeriod: cliffPeriod,
            vestingType: vestingType
        }));
        emit VestingScheduleCreated(beneficiary, idx, amount, vestingType);
    }

    function getVestableAmountForSchedule(address beneficiary, uint256 idx) external view returns (uint256) {
        VestingSchedule memory s = vestingSchedules[beneficiary][idx];
        uint256 currentTime = block.timestamp;
        if (currentTime < s.startTime + s.cliffPeriod) return 0;

        uint256 elapsed = currentTime - s.startTime;
        uint256 unlocked = elapsed >= s.duration ? s.totalAmount : (s.totalAmount * elapsed) / s.duration;
        return unlocked - s.claimed;
    }

    function getVestableAmount(address beneficiary) external view returns (uint256 total) {
        uint256 len = vestingSchedules[beneficiary].length;
        for (uint256 i; i < len; ++i) {
            total += this.getVestableAmountForSchedule(beneficiary, i);
        }
    }

    /**
     * @notice Vest (release) accumulated vested tokens for `beneficiary`.
     * @dev Callable only by the token contract (see `onlyToken` modifier).
     */
    function vestSchedulesFor(address beneficiary, uint256[] calldata indices) external onlyToken returns (uint256 totalVested) {
        uint256 len = indices.length;
        if (len == 0) revert("Nothing to vest");

        for (uint256 i = 0; i < len; ++i) {
            uint256 idx = indices[i];
            VestingSchedule storage s = vestingSchedules[beneficiary][idx];
            if (s.totalAmount == 0) continue; // skip non-existent schedule

            uint256 currentTime = block.timestamp;
            if (currentTime < s.startTime + s.cliffPeriod) continue;

            uint256 elapsed = currentTime - s.startTime;
            uint256 unlocked = elapsed >= s.duration ? s.totalAmount : (s.totalAmount * elapsed) / s.duration;
            uint256 claimable = unlocked - s.claimed;
            if (claimable == 0) continue;

            s.claimed += claimable;
            totalVested += claimable;

            // transfer vested tokens out to beneficiary
            token.safeTransfer(beneficiary, claimable);
        }

        if (totalVested == 0) revert("Nothing to vest");
        emit VestingReleased(beneficiary, totalVested);
        return totalVested;
    }
}
