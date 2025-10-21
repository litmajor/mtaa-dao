// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./MtaaToken.sol";
import "./MaonoVault.sol";
import "./MaonoVaultFactory.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title MTAARewardsManager
 * @notice Manages MTAA token rewards for vault interactions and ecosystem participation
 */
contract MTAARewardsManager is Ownable, ReentrancyGuard {
    MTAAToken public immutable mtaaToken;
    MaonoVaultFactory public immutable vaultFactory;
    address public daoTreasury;
    mapping(address => uint256) public lastChallengeTimestamp;
    
    // Reward rates (MTAA tokens)
    uint256 public constant VAULT_CREATION_REWARD = 2000 * 1e18;
    uint256 public constant FIRST_DEPOSIT_REWARD = 100 * 1e18;
    uint256 public constant TASK_COMPLETION_BASE_REWARD = 100 * 1e18;
    uint256 public constant PROPOSAL_APPROVAL_REWARD = 1000 * 1e18;
    uint256 public constant VOTING_REWARD = 10 * 1e18;
    
    // Milestone rewards
    mapping(uint256 => uint256) public milestoneRewards; // amount => reward
    mapping(address => mapping(uint256 => bool)) public claimedMilestones;
    
    // Task system
    mapping(bytes32 => TaskInfo) public tasks;
    mapping(address => mapping(bytes32 => bool)) public completedTasks;
    mapping(address => uint256) public userTaskCount;
    
    // Vault performance tracking
    mapping(address => VaultPerformance) public vaultPerformances;
    mapping(address => bool) public firstDepositClaimed;
    
    struct TaskInfo {
        uint256 reward;
        uint256 deadline;
        TaskDifficulty difficulty;
        bool isActive;
        string description;
    }
    
    struct VaultPerformance {
        uint256 totalDeposits;
        uint256 totalWithdrawals;
        uint256 highWaterMark;
        uint256 lastRewardTime;
        bool isTopPerformer;
        int256 netProfit;
        int256 roi;
    }
    
    enum TaskDifficulty {
        EASY,    // 100-500 MTAA
        MEDIUM,  // 500-2000 MTAA  
        HARD,    // 2000-10000 MTAA
        EXPERT   // 10000+ MTAA
    }

    enum ChallengeType {
        VOTE_PROPOSAL,
        COMPLETE_TASK,
        INVITE_MEMBER,
        COMMENT_PROPOSAL,
        ATTEND_MEETING,
        OTHER
    }

    // Events
    event RewardDistributed(address indexed user, uint256 amount, string reason);
    event TaskCreated(bytes32 indexed taskId, TaskDifficulty difficulty, uint256 reward);
    event TaskCompleted(address indexed user, bytes32 indexed taskId, uint256 reward);
    event MilestoneReached(address indexed user, uint256 milestone, uint256 reward);
    event VaultPerformanceUpdated(address indexed vault, bool isTopPerformer);
    event MilestoneRewardSet(uint256 milestone, uint256 reward);
    event TaskDeactivated(bytes32 indexed taskId);

    // Errors
    error TaskNotActive();
    error TaskAlreadyCompleted();
    error TaskExpired();
    error MilestoneAlreadyClaimed();
    error InsufficientMTAABalance();
    error InvalidVault();
    error InvalidChallengeType();
    error ChallengeAlreadyClaimedToday();
    error NotMinter();

    constructor(address _mtaaToken, address _vaultFactory) Ownable(msg.sender) {
        mtaaToken = MTAAToken(_mtaaToken);
        vaultFactory = MaonoVaultFactory(_vaultFactory);
        daoTreasury = owner();
        
        // Initialize milestone rewards
        milestoneRewards[1000 * 1e18] = 200 * 1e18;    // $1K milestone: 200 MTAA
        milestoneRewards[10000 * 1e18] = 1000 * 1e18;  // $10K milestone: 1000 MTAA
        milestoneRewards[100000 * 1e18] = 5000 * 1e18; // $100K milestone: 5000 MTAA
    }

    // === VAULT REWARDS ===

    /**
     * @notice Reward for creating a vault (called by factory)
     * @param creator The creator address
     * @param vault The vault address
     */
    function rewardVaultCreation(address creator, address vault) external {
        require(msg.sender == address(vaultFactory), "Only factory can reward");
        
        _distributeReward(creator, VAULT_CREATION_REWARD, "Vault Creation");
        
        // Initialize vault performance tracking
        vaultPerformances[vault] = VaultPerformance({
            totalDeposits: 0,
            totalWithdrawals: 0,
            highWaterMark: 0,
            lastRewardTime: block.timestamp,
            isTopPerformer: false,
            netProfit: 0,
            roi: 0
        });
    }

    /**
     * @notice Reward for first deposit
     * @param depositor The depositor address
     * @param vault The vault address
     * @param amount Deposit amount
     */
    function rewardFirstDeposit(address depositor, address vault, uint256 amount) external {
        if (!_isValidVault(vault)) revert InvalidVault();
        if (firstDepositClaimed[depositor]) revert("First deposit already claimed");
        
        firstDepositClaimed[depositor] = true;
        _distributeReward(depositor, FIRST_DEPOSIT_REWARD, "First Deposit");
        
        // Check for milestone rewards
        _checkMilestoneRewards(depositor, amount);
        
        // Update vault performance
        _updateVaultPerformance(vault, amount, true);
    }

    /**
     * @notice Reward for deposit
     * @param depositor The depositor address
     * @param vault The vault address
     * @param amount Deposit amount
     */
    function rewardDeposit(address depositor, address vault, uint256 amount) external {
        if (!_isValidVault(vault)) revert InvalidVault();
        
        // Check for milestone rewards
        _checkMilestoneRewards(depositor, amount);
        
        // Monthly holding bonus (1% of deposit in MTAA)
        uint256 monthlyBonus = amount / 100;
        _distributeReward(depositor, monthlyBonus, "Monthly Holding Bonus");
        
        // Update vault performance
        _updateVaultPerformance(vault, amount, true);
    }

    function _checkMilestoneRewards(address user, uint256 amount) internal {
        // Unrolled loop for fixed milestones
        _checkSingleMilestone(user, amount, 1000 * 1e18, milestoneRewards[1000 * 1e18]);
        _checkSingleMilestone(user, amount, 10000 * 1e18, milestoneRewards[10000 * 1e18]);
        _checkSingleMilestone(user, amount, 100000 * 1e18, milestoneRewards[100000 * 1e18]);
    }

    function _checkSingleMilestone(address user, uint256 amount, uint256 milestone, uint256 reward) internal {
        if (amount >= milestone && !claimedMilestones[user][milestone]) {
            claimedMilestones[user][milestone] = true;
            _distributeReward(user, reward, "Milestone Reached");
            emit MilestoneReached(user, milestone, reward);
        }
    }

    function _updateVaultPerformance(address vault, uint256 amount, bool isDeposit) internal {
        VaultPerformance storage perf = vaultPerformances[vault];
        if (isDeposit) {
            unchecked { perf.totalDeposits += amount; }
            if (perf.totalDeposits > perf.highWaterMark) {
                perf.highWaterMark = perf.totalDeposits;
            }
            perf.netProfit += int256(amount);
        } else {
            unchecked { perf.totalWithdrawals += amount; }
            perf.netProfit -= int256(amount);
        }
        // ROI = netProfit / totalDeposits (scaled by 1e18)
        if (perf.totalDeposits > 0) {
            perf.roi = (perf.netProfit * 1e18) / int256(perf.totalDeposits);
        }
    }

    // === TASK SYSTEM ===

    /**
     * @notice Create a new task
     * @param taskId Task ID
     * @param difficulty Task difficulty
     * @param customReward Custom reward (0 for default)
     * @param deadline Task deadline
     * @param description Task description
     */
    function createTask(
        bytes32 taskId,
        TaskDifficulty difficulty,
        uint256 customReward,
        uint256 deadline,
        string calldata description
    ) external onlyOwner {
        uint256 reward = customReward;
        
        // Set default rewards based on difficulty if not specified
        if (reward == 0) {
            if (difficulty == TaskDifficulty.EASY) reward = 250 * 1e18;
            else if (difficulty == TaskDifficulty.MEDIUM) reward = 1250 * 1e18;
            else if (difficulty == TaskDifficulty.HARD) reward = 6000 * 1e18;
            else reward = 25000 * 1e18; // EXPERT
        }
        
        tasks[taskId] = TaskInfo({
            reward: reward,
            deadline: deadline == 0 ? block.timestamp + 30 days : deadline,
            difficulty: difficulty,
            isActive: true,
            description: description
        });
        
        emit TaskCreated(taskId, difficulty, reward);
    }

    /**
     * @notice Complete a task for a user
     * @param taskId Task ID
     * @param user User address
     */
    function completeTask(bytes32 taskId, address user) external onlyOwner {
        TaskInfo memory task = tasks[taskId];
        
        if (!task.isActive) revert TaskNotActive();
        if (block.timestamp > task.deadline) revert TaskExpired();
        if (completedTasks[user][taskId]) revert TaskAlreadyCompleted();
        
        completedTasks[user][taskId] = true;
        unchecked { userTaskCount[user]++; }
        
        // Apply reputation multiplier
        uint256 finalReward = _applyReputationMultiplier(user, task.reward);
        
        _distributeReward(user, finalReward, "Task Completion");
        
        // Update reputation score
        uint256 reputationGain = _getReputationGain(task.difficulty);
        _updateUserReputation(user, reputationGain);
        
        emit TaskCompleted(user, taskId, finalReward);
    }

    function _getReputationGain(TaskDifficulty difficulty) internal pure returns (uint256) {
        if (difficulty == TaskDifficulty.EASY) return 25;
        if (difficulty == TaskDifficulty.MEDIUM) return 50;
        if (difficulty == TaskDifficulty.HARD) return 100;
        return 200; // EXPERT
    }

    function _applyReputationMultiplier(address user, uint256 baseReward) internal view returns (uint256) {
        MTAAToken.ReputationTier tier = mtaaToken.getReputationTier(user);
        
        if (tier == MTAAToken.ReputationTier.CONTRIBUTOR) return (baseReward * 125) / 100;
        if (tier == MTAAToken.ReputationTier.ELDER) return (baseReward * 150) / 100;
        if (tier == MTAAToken.ReputationTier.ARCHITECT) return (baseReward * 200) / 100;
        
        return baseReward;
    }

    function _updateUserReputation(address user, uint256 gain) internal {
        uint256 currentScore = mtaaToken.reputationScores(user);
        mtaaToken.updateReputation(user, currentScore + gain);
    }

    // === GOVERNANCE REWARDS ===

    function rewardVoting(address voter) external onlyOwner {
        _distributeReward(voter, VOTING_REWARD, "Governance Voting");
        
        // Early voter bonus
        _distributeReward(voter, 5 * 1e18, "Early Voter Bonus");
    }

    function rewardProposalApproval(address proposer) external onlyOwner {
        _distributeReward(proposer, PROPOSAL_APPROVAL_REWARD, "Proposal Approval");
        
        // Update reputation
        _updateUserReputation(proposer, 500);
    }

    // === PERFORMANCE REWARDS ===

    function setTopPerformingVault(address vault, bool isTop) external onlyOwner {
        VaultPerformance storage perf = vaultPerformances[vault];
        perf.isTopPerformer = isTop;
        
        if (isTop) {
            // Reward vault creator/manager
            address vaultOwner = Ownable(vault).owner();
            _distributeReward(vaultOwner, 5000 * 1e18, "Top Performing Vault");
        }
        
        emit VaultPerformanceUpdated(vault, isTop);
    }

    // === LIQUIDITY REWARDS ===

    /**
     * @notice Reward liquidity provider
     * @param provider Provider address
     * @param lpTokens LP tokens amount
     * @param poolName Pool name
     */
    function rewardLiquidityProvider(address provider, uint256 lpTokens, string calldata poolName) 
        external 
        onlyOwner 
    {
        uint256 monthlyReward;
        bytes32 poolHash = keccak256(abi.encodePacked(poolName));
        if (poolHash == keccak256(abi.encodePacked("MTAA/cUSD"))) {
            monthlyReward = 20000 * 1e18; // 20k MTAA/month
        } else if (poolHash == keccak256(abi.encodePacked("MTAA/CELO"))) {
            monthlyReward = 15000 * 1e18; // 15k MTAA/month
        } else if (poolHash == keccak256(abi.encodePacked("MTAA/cEUR"))) {
            monthlyReward = 10000 * 1e18; // 10k MTAA/month
        } else {
            monthlyReward = 5000 * 1e18;  // 5k MTAA/month for other pools
        }
        // Pro-rate based on LP share (requires totalLPTokens from pool)
        uint256 totalLPTokens = _getTotalLPTokens(poolName); // Implement dynamic fetch
        if (totalLPTokens == 0) totalLPTokens = 1; // Prevent div0
        uint256 actualReward = (monthlyReward * lpTokens) / totalLPTokens;
        _distributeReward(provider, actualReward, string.concat("Liquidity ", poolName));
    }

    function _getTotalLPTokens(string calldata poolName) internal view returns (uint256) {
        // TODO: Map poolName to LP contract and call totalSupply()
        // e.g., address lp = poolAddresses[keccak256(abi.encodePacked(poolName))];
        // return IERC20(lp).totalSupply();
        return 1; // Placeholder; implement properly
    }

    // === DAILY CHALLENGES ===

    function completeDailyChallenge(address user, ChallengeType challengeType) external onlyOwner {
        if (block.timestamp <= lastChallengeTimestamp[user] + 1 days) revert ChallengeAlreadyClaimedToday();
        lastChallengeTimestamp[user] = block.timestamp;
        uint256 baseReward;
        if (challengeType == ChallengeType.VOTE_PROPOSAL) baseReward = 50 * 1e18;
        else if (challengeType == ChallengeType.COMPLETE_TASK) baseReward = 100 * 1e18;
        else if (challengeType == ChallengeType.INVITE_MEMBER) baseReward = 200 * 1e18;
        else if (challengeType == ChallengeType.COMMENT_PROPOSAL) baseReward = 25 * 1e18;
        else if (challengeType == ChallengeType.ATTEND_MEETING) baseReward = 75 * 1e18;
        else if (challengeType == ChallengeType.OTHER) baseReward = 50 * 1e18;
        else revert InvalidChallengeType();
        mtaaToken.completeDailyChallenge(user, _challengeTypeToString(challengeType), baseReward);
    }

    function _challengeTypeToString(ChallengeType challengeType) internal pure returns (string memory) {
        if (challengeType == ChallengeType.VOTE_PROPOSAL) return "VOTE_PROPOSAL";
        if (challengeType == ChallengeType.COMPLETE_TASK) return "COMPLETE_TASK";
        if (challengeType == ChallengeType.INVITE_MEMBER) return "INVITE_MEMBER";
        if (challengeType == ChallengeType.COMMENT_PROPOSAL) return "COMMENT_PROPOSAL";
        if (challengeType == ChallengeType.ATTEND_MEETING) return "ATTEND_MEETING";
        return "OTHER";
    }

    // === UTILITY FUNCTIONS ===

    function _distributeReward(address user, uint256 amount, string memory reason) internal {
        if (amount == 0) return;
        emit RewardDistributed(user, amount, reason);
        // Check if minter first to avoid try-catch gas
        // Assume isMinter flag or check mtaaToken.minters(address(this))
        if (mtaaToken.balanceOf(address(this)) < amount) {
            mtaaToken.mint(user, amount); // Revert if not minter
        } else {
            mtaaToken.transfer(user, amount);
        }
    }

    function _isValidVault(address vault) internal view returns (bool) {
        MaonoVaultFactory.VaultInfo memory info = vaultFactory.vaultInfo(vault);
        return info.isActive;
    }

    // === ADMIN FUNCTIONS ===

    function setMilestoneReward(uint256 milestone, uint256 reward) external onlyOwner {
        milestoneRewards[milestone] = reward;
        emit MilestoneRewardSet(milestone, reward);
    }

    function deactivateTask(bytes32 taskId) external onlyOwner {
        tasks[taskId].isActive = false;
        emit TaskDeactivated(taskId);
    }

    function emergencyWithdraw(uint256 amount) external onlyOwner {
        mtaaToken.transfer(owner(), amount);
    }

    function fundRewards(uint256 amount) external {
        mtaaToken.transferFrom(msg.sender, address(this), amount);
    }

    // === VIEW FUNCTIONS ===

    function getTaskInfo(bytes32 taskId) external view returns (TaskInfo memory) {
        return tasks[taskId];
    }

    function getUserTaskCount(address user) external view returns (uint256) {
        return userTaskCount[user];
    }

    function getVaultPerformance(address vault) external view returns (VaultPerformance memory) {
        return vaultPerformances[vault];
    }

    function hasCompletedTask(address user, bytes32 taskId) external view returns (bool) {
        return completedTasks[user][taskId];
    }

    function getMilestoneReward(uint256 milestone) external view returns (uint256) {
        return milestoneRewards[milestone];
    }

    function hasClaimedMilestone(address user, uint256 milestone) external view returns (bool) {
        return claimedMilestones[user][milestone];
    }
}