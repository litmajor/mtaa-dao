// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./MtaaToken.sol";
import "./MaonoVault.sol";
import "./MaonoVaultFactory.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title MTAARewardsManager
 * @notice Manages MTAA token rewards for vault interactions and ecosystem participation
 * @dev Handles reward distribution, task completion, milestones, and liquidity incentives
 */
contract MTAARewardsManager is Ownable, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    // === TYPE DEFINITIONS ===

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

    enum RewardType {
        VAULT_CREATION,
        FIRST_DEPOSIT,
        TASK_COMPLETION,
        PROPOSAL_APPROVAL,
        VOTING,
        MILESTONE,
        LIQUIDITY,
        DAILY_CHALLENGE,
        MONTHLY_BONUS,
        TOP_PERFORMER
    }

    // === STRUCTS ===

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

    struct UserRewards {
        uint256 totalEarned;
        uint256 totalClaimed;
        uint256 lastRewardTime;
    }

    // === STATE VARIABLES ===

    MTAAToken public immutable mtaaToken;
    MaonoVaultFactory_Phase1B public vaultFactory;
    address public daoTreasury;

    // Reward rates (MTAA tokens) - mutable for flexibility
    uint256 public vaultCreationReward = 2000 * 1e18;
    uint256 public firstDepositReward = 100 * 1e18;
    uint256 public taskCompletionBaseReward = 100 * 1e18;
    uint256 public proposalApprovalReward = 1000 * 1e18;
    uint256 public votingReward = 10 * 1e18;

    // Fixed-point scale used across ROI calculations
    uint256 public constant SCALE = 1e18;

    // Batch distribution limits to protect against gas exhaustion
    uint256 public maxBatchSize = 200;

    // Milestone rewards: cumulative deposit amount => reward
    mapping(uint256 => uint256) public milestoneRewards;
    mapping(address => mapping(uint256 => bool)) public claimedMilestones;
    mapping(address => uint256) public userTotalDeposits; // Track cumulative deposits
    // List of milestone keys for iteration and governance updates
    uint256[] public milestonesList;

    // Task system
    mapping(bytes32 => TaskInfo) public tasks;
    mapping(address => mapping(bytes32 => bool)) public completedTasks;
    mapping(address => uint256) public userTaskCount;
    bytes32[] public activeTaskIds;
    mapping(bytes32 => uint256) public taskIdToIndex;

    // Vault performance tracking
    mapping(address => VaultPerformance) public vaultPerformances;
    mapping(address => bool) public firstDepositClaimed;

    // User reward tracking
    mapping(address => UserRewards) public userRewards;
    uint256 public totalRewardsDistributed;

    // Daily challenges
    mapping(address => uint256) public lastChallengeTimestamp;
    mapping(address => uint256) public dailyChallengeStreak;

    // Monthly bonus cooldown tracking
    mapping(address => uint256) private _lastMonthlyBonusAt;

    // Pool registry for LP token tracking
    mapping(bytes32 => address) public poolAddresses;

    // Authorized reward distributors (multi-sig or delegated addresses)
    mapping(address => bool) public authorizedDistributors;

    // === EVENTS ===

    event RewardDistributed(
        address indexed user,
        uint256 amount,
        RewardType indexed rewardType,
        string reason,
        uint256 timestamp
    );
    event RewardClaimed(address indexed user, uint256 amount);
    event TaskCreated(bytes32 indexed taskId, TaskDifficulty difficulty, uint256 reward, uint256 deadline);
    event TaskCompleted(address indexed user, bytes32 indexed taskId, uint256 reward);
    event TaskDeactivated(bytes32 indexed taskId);
    event TaskExpired(bytes32 indexed taskId);
    event MilestoneReached(address indexed user, uint256 milestone, uint256 reward);
    event MilestoneRewardSet(uint256 milestone, uint256 reward);
    event MilestoneAdded(uint256 milestone, uint256 reward);
    event BatchDistributed(address indexed operator, uint256 totalAmount, uint256 count);
    event VaultPerformanceUpdated(address indexed vault, bool isTopPerformer);
    event WithdrawalTracked(address indexed withdrawer, address indexed vault, uint256 amount);
    event PoolRegistered(string indexed poolName, address lpToken);
    event PoolUnregistered(string indexed poolName);
    event DailyChallengeCompleted(
        address indexed user,
        ChallengeType challengeType,
        uint256 reward,
        uint256 streak
    );
    event DistributorAuthorized(address indexed distributor, bool authorized);
    event RewardRatesUpdated(
        uint256 vaultCreation,
        uint256 firstDeposit,
        uint256 taskBase,
        uint256 proposalApproval,
        uint256 voting
    );
    event EmergencyWithdrawal(address indexed token, uint256 amount);
    event ReputationUpdateSkipped(address indexed user, uint256 oldScore, uint256 attemptedNewScore);

    // === CUSTOM ERRORS ===

    error TaskNotActive();
    error TaskAlreadyCompleted();
    error TaskExpiredError();
    error MilestoneAlreadyClaimed();
    error InsufficientRewardBalance(uint256 requested, uint256 available);
    error InvalidVault();
    error InvalidChallengeType();
    error ChallengeAlreadyClaimedToday();
    error UnauthorizedDistributor();
    error PoolNotRegistered();
    error InvalidAmount();
    error InvalidDeadline();
    error InvalidRewardRate();
    error TransferFailed();
    error NotFactory();
    error ZeroAddress();
    
    error TaskAlreadyExists();


    // === MODIFIERS ===

    modifier onlyDistributor() {
        if (!authorizedDistributors[msg.sender] && msg.sender != owner()) {
            revert UnauthorizedDistributor();
        }
        _;
    }

    // === CONSTRUCTOR ===

    constructor(address _mtaaToken, address _vaultFactory) Ownable(msg.sender) {
        if (_mtaaToken == address(0) || _vaultFactory == address(0)) revert ZeroAddress();

        mtaaToken = MTAAToken(_mtaaToken);
        vaultFactory = MaonoVaultFactory_Phase1B(_vaultFactory);
        daoTreasury = msg.sender;

        // Initialize milestone rewards and list
        milestoneRewards[1000 * 1e18] = 200 * 1e18;    // $1K milestone: 200 MTAA
        milestonesList.push(1000 * 1e18);
        milestoneRewards[10000 * 1e18] = 1000 * 1e18;  // $10K milestone: 1000 MTAA
        milestonesList.push(10000 * 1e18);
        milestoneRewards[100000 * 1e18] = 5000 * 1e18; // $100K milestone: 5000 MTAA
        milestonesList.push(100000 * 1e18);

        // Authorize owner as distributor by default
        authorizedDistributors[msg.sender] = true;
    }

    // --- Integration helpers ---

    event AuthorizationRequested(address indexed token, address indexed requester);

    /**
     * @notice Check whether this contract has the ORACLE_ROLE on the token
     */
    function hasOracleRoleOnToken() external view returns (bool) {
        bytes32 role = mtaaToken.ORACLE_ROLE();
        return mtaaToken.hasRole(role, address(this));
    }

    /**
     * @notice Emit an authorization request event to signal off-chain operator to grant ORACLE_ROLE
     */
    function requestOracleAuthorization() external onlyOwner {
        emit AuthorizationRequested(address(mtaaToken), address(this));
    }

    /**
     * @notice Pull MTAA tokens from an approved address (e.g., DAO multisig) into this contract.
     *         Useful when the treasury approves this contract to pull initial funding.
     */
    function pullRewardsFrom(address from, uint256 amount) external onlyOwner nonReentrant {
        if (from == address(0)) revert ZeroAddress();
        if (amount == 0) revert InvalidAmount();
        IERC20(address(mtaaToken)).safeTransferFrom(from, address(this), amount);
    }

    /**
     * @notice Update the vault factory address (some deployments need late binding)
     */
    function setVaultFactory(address _vaultFactory) external onlyOwner {
        if (_vaultFactory == address(0)) revert ZeroAddress();
        vaultFactory = MaonoVaultFactory_Phase1B(_vaultFactory);
    }

    // === REWARD DISTRIBUTION CORE ===

    /**
     * @notice Internal function to distribute rewards safely
     * @param user Recipient address
     * @param amount Reward amount
     * @param rewardType Type of reward for tracking
     * @param reason Human-readable reason
     */
    function _distributeReward(
        address user,
        uint256 amount,
        RewardType rewardType,
        string memory reason
    ) internal {
        if (amount == 0) return;
        if (user == address(0)) revert ZeroAddress();

        uint256 contractBalance = mtaaToken.balanceOf(address(this));
        if (contractBalance < amount) {
            revert InsufficientRewardBalance(amount, contractBalance);
        }

        // Update tracking before external call (checks-effects-interactions)
        userRewards[user].totalEarned += amount;
        userRewards[user].lastRewardTime = block.timestamp;
        totalRewardsDistributed += amount;

        // Safe transfer using SafeERC20
        IERC20(address(mtaaToken)).safeTransfer(user, amount);

        emit RewardDistributed(user, amount, rewardType, reason, block.timestamp);
    }

    /**
     * @notice Fund the rewards pool
     * @param amount Amount of MTAA to deposit
     */
    function fundRewards(uint256 amount) external nonReentrant {
        if (amount == 0) revert InvalidAmount();

        IERC20(address(mtaaToken)).safeTransferFrom(msg.sender, address(this), amount);
    }

    // === VAULT REWARDS ===

    /**
     * @notice Reward for creating a vault (called by factory only)
     * @param creator The creator address
     * @param vault The vault address
     */
    function rewardVaultCreation(address creator, address vault) external onlyDistributor whenNotPaused {
        if (!_isValidVault(vault)) revert InvalidVault();
        if (creator == address(0)) revert ZeroAddress();

        _distributeReward(creator, vaultCreationReward, RewardType.VAULT_CREATION, "Vault Creation");

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
    function rewardFirstDeposit(
        address depositor,
        address vault,
        uint256 amount
    ) external onlyDistributor whenNotPaused {
        if (!_isValidVault(vault)) revert InvalidVault();
        if (firstDepositClaimed[depositor]) revert TaskAlreadyCompleted();

        firstDepositClaimed[depositor] = true;
        _distributeReward(depositor, firstDepositReward, RewardType.FIRST_DEPOSIT, "First Deposit");

        // Track cumulative deposits for milestones
        userTotalDeposits[depositor] += amount;
        _checkMilestoneRewards(depositor);
        _updateVaultPerformance(vault, amount, true);
    }

    /**
     * @notice Reward for subsequent deposits
     * @param depositor The depositor address
     * @param vault The vault address
     * @param amount Deposit amount
     */
    function rewardDeposit(
        address depositor,
        address vault,
        uint256 amount
    ) external onlyDistributor whenNotPaused {
        if (!_isValidVault(vault)) revert InvalidVault();
        if (amount == 0) revert InvalidAmount();

        // Track cumulative deposits
        userTotalDeposits[depositor] += amount;

        // Check milestone rewards based on cumulative total
        _checkMilestoneRewards(depositor);

        // Monthly holding bonus (1% of deposit in MTAA), capped at 1000 MTAA
        uint256 last = _lastMonthlyBonusAt[depositor];
        if (block.timestamp < last + 30 days) revert InvalidAmount();

        uint256 monthlyBonus = amount / 100;
        if (monthlyBonus > 1000 * 1e18) monthlyBonus = 1000 * 1e18;
        if (monthlyBonus > 0) {
            _lastMonthlyBonusAt[depositor] = block.timestamp;
            _distributeReward(depositor, monthlyBonus, RewardType.MONTHLY_BONUS, "Monthly Holding Bonus");
        }

        _updateVaultPerformance(vault, amount, true);
    }

    /**
    * @notice Reward for withdrawal (updates performance tracking)
    * @param withdrawer The withdrawer address
    * @param vault The vault address
    * @param amount Withdrawal amount
     */
    function rewardWithdrawal(
        address withdrawer,
        address vault,
        uint256 amount
    ) external onlyDistributor whenNotPaused {
        if (!_isValidVault(vault)) revert InvalidVault();
        _updateVaultPerformance(vault, amount, false);
        emit WithdrawalTracked(withdrawer, vault, amount);
        // Note: No direct reward for withdrawal, just tracking
    }

    // === MILESTONE REWARDS ===

    /**
     * @notice Check and distribute milestone rewards based on cumulative deposits
     * @param user User address to check
     */
    function _checkMilestoneRewards(address user) internal {
        uint256 cumulative = userTotalDeposits[user];

        // Iterate configured milestones (allows governance to add/update milestones)
        for (uint256 i = 0; i < milestonesList.length; i++) {
            _checkSingleMilestone(user, cumulative, milestonesList[i]);
        }
    }

    function _checkSingleMilestone(
        address user,
        uint256 cumulativeAmount,
        uint256 milestone
    ) internal {
        if (cumulativeAmount >= milestone && !claimedMilestones[user][milestone]) {
            uint256 reward = milestoneRewards[milestone];
            if (reward > 0) {
                claimedMilestones[user][milestone] = true;
                _distributeReward(user, reward, RewardType.MILESTONE, "Milestone Reached");
                emit MilestoneReached(user, milestone, reward);
            }
        }
    }

    // === TASK SYSTEM ===

    /**
     * @notice Create a new task
     * @param taskId Unique task ID
     * @param difficulty Task difficulty level
     * @param customReward Custom reward amount (0 for default based on difficulty)
     * @param deadline Task deadline timestamp
     * @param description Task description
     */
    function createTask(
        bytes32 taskId,
        TaskDifficulty difficulty,
        uint256 customReward,
        uint256 deadline,
        string calldata description
    ) external onlyOwner {
        if (tasks[taskId].isActive) revert TaskAlreadyExists(); // Task ID already exists
        if (deadline <= block.timestamp) revert InvalidDeadline();

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
            deadline: deadline,
            difficulty: difficulty,
            isActive: true,
            description: description
        });

        // Add to active tasks array
        taskIdToIndex[taskId] = activeTaskIds.length;
        activeTaskIds.push(taskId);

        emit TaskCreated(taskId, difficulty, reward, deadline);
    }

    /**
     * @notice Complete a task for a user
     * @param taskId Task ID
     * @param user User address
     */
    function completeTask(bytes32 taskId, address user) external onlyDistributor whenNotPaused {
        TaskInfo storage task = tasks[taskId];

        if (!task.isActive) revert TaskNotActive();
        if (block.timestamp > task.deadline) {
            task.isActive = false;
            _removeActiveTask(taskId);
            emit TaskExpired(taskId);
            revert TaskExpiredError();
        }
        if (completedTasks[user][taskId]) revert TaskAlreadyCompleted();

        completedTasks[user][taskId] = true;
        unchecked { userTaskCount[user]++; }

        // Apply reputation multiplier
        uint256 finalReward = _applyReputationMultiplier(user, task.reward);

        _distributeReward(user, finalReward, RewardType.TASK_COMPLETION, "Task Completion");

        // Update reputation score
        uint256 reputationGain = _getReputationGain(task.difficulty);
        _updateUserReputation(user, reputationGain);

        emit TaskCompleted(user, taskId, finalReward);
    }

    /**
     * @notice Deactivate a task
     * @param taskId Task ID to deactivate
     */
    function deactivateTask(bytes32 taskId) external onlyOwner {
        tasks[taskId].isActive = false;
        _removeActiveTask(taskId);
        emit TaskDeactivated(taskId);
    }

    function _removeActiveTask(bytes32 taskId) internal {
        uint256 index = taskIdToIndex[taskId];
        if (index < activeTaskIds.length && activeTaskIds[index] == taskId) {
            uint256 lastIndex = activeTaskIds.length - 1;
            if (index != lastIndex) {
                bytes32 lastTaskId = activeTaskIds[lastIndex];
                activeTaskIds[index] = lastTaskId;
                taskIdToIndex[lastTaskId] = index;
            }
            activeTaskIds.pop();
            delete taskIdToIndex[taskId];
        }
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
        bytes32 oracleRole = mtaaToken.ORACLE_ROLE();
        // Only call into token if this contract has the ORACLE_ROLE on the token
        if (mtaaToken.hasRole(oracleRole, address(this))) {
            mtaaToken.updateReputation(user, currentScore + gain);
        } else {
            emit ReputationUpdateSkipped(user, currentScore, currentScore + gain);
        }
    }

    // === GOVERNANCE REWARDS ===

    /**
     * @notice Backwards-compatible voting reward (no per-proposal deduplication).
     * @param voter Voter address
     */
    function rewardVoting(address voter) external onlyDistributor whenNotPaused {
        if (voter == address(0)) revert ZeroAddress();
        // Lightweight distribution for legacy callers — short reason to reduce bytecode size
        _distributeReward(voter, votingReward, RewardType.VOTING, "vote");
    }

    // New: reward voting per-proposal with deduplication
    mapping(bytes32 => mapping(address => bool)) private _voterClaimed;

    function rewardVotingForProposal(address voter, bytes32 proposalId) external onlyDistributor whenNotPaused {
        if (voter == address(0)) revert ZeroAddress();
        if (proposalId == bytes32(0)) revert InvalidAmount();
        if (_voterClaimed[proposalId][voter]) revert InvalidAmount();

        _voterClaimed[proposalId][voter] = true;

        _distributeReward(voter, votingReward, RewardType.VOTING, "Governance Voting");
        // Early voter bonus
        _distributeReward(voter, 5 * 1e18, RewardType.VOTING, "Early Voter Bonus");
    }

    /**
     * @notice Reward for proposal approval
     * @param proposer Proposer address
     */
    function rewardProposalApproval(address proposer) external onlyDistributor whenNotPaused {
        _distributeReward(proposer, proposalApprovalReward, RewardType.PROPOSAL_APPROVAL, "Proposal Approval");

        // Update reputation
        _updateUserReputation(proposer, 500);
    }

    // === PERFORMANCE REWARDS ===

    /**
     * @notice Set top performing vault status
     * @param vault Vault address
     * @param isTop Whether vault is top performer
     */
    function setTopPerformingVault(address vault, bool isTop) external onlyOwner {
        if (!_isValidVault(vault)) revert InvalidVault();
        VaultPerformance storage perf = vaultPerformances[vault];
        perf.isTopPerformer = isTop;

        if (isTop) {
            address vaultOwner = Ownable(vault).owner();
            _distributeReward(vaultOwner, 5000 * 1e18, RewardType.TOP_PERFORMER, "Top Performing Vault");
        }

        emit VaultPerformanceUpdated(vault, isTop);
    }

    // === LIQUIDITY REWARDS ===

    /**
     * @notice Reward liquidity provider
     * @param provider Provider address
     * @param lpTokens LP tokens amount held
     * @param poolName Pool name
     */
    function rewardLiquidityProvider(
        address provider,
        uint256 lpTokens,
        string calldata poolName
    ) external onlyDistributor whenNotPaused {
        if (provider == address(0)) revert ZeroAddress();
        if (lpTokens == 0) revert InvalidAmount();

        bytes32 poolKey = keccak256(abi.encodePacked(poolName));
        address lpToken = poolAddresses[poolKey];
        if (lpToken == address(0)) revert PoolNotRegistered();

        uint256 monthlyReward = _getPoolMonthlyReward(poolName);
        uint256 totalLPTokens = IERC20(lpToken).totalSupply();
        if (totalLPTokens == 0) revert InvalidAmount();

        uint256 actualReward = (monthlyReward * lpTokens) / totalLPTokens;
        if (actualReward > 0) {
            _distributeReward(provider, actualReward, RewardType.LIQUIDITY, "Liquidity Provision");
        }
    }

    function _getPoolMonthlyReward(string calldata poolName) internal pure returns (uint256) {
        bytes32 poolHash = keccak256(abi.encodePacked(poolName));

        if (poolHash == keccak256(abi.encodePacked("MTAA/cUSD"))) return 20000 * 1e18;
        if (poolHash == keccak256(abi.encodePacked("MTAA/CELO"))) return 15000 * 1e18;
        if (poolHash == keccak256(abi.encodePacked("MTAA/cEUR"))) return 10000 * 1e18;
        return 5000 * 1e18; // Default for other pools
    }

    /**
     * @notice Register a liquidity pool for rewards calculation
     * @param poolName Human-readable pool name
     * @param lpToken Address of the LP token contract
     */
    function registerPool(string calldata poolName, address lpToken) external onlyOwner {
        if (lpToken == address(0)) revert ZeroAddress();
        if (bytes(poolName).length == 0) revert InvalidAmount();

        bytes32 poolKey = keccak256(abi.encodePacked(poolName));
        poolAddresses[poolKey] = lpToken;

        emit PoolRegistered(poolName, lpToken);
    }

    /**
     * @notice Unregister a liquidity pool
     * @param poolName Pool name to unregister
     */
    function unregisterPool(string calldata poolName) external onlyOwner {
        bytes32 poolKey = keccak256(abi.encodePacked(poolName));
        delete poolAddresses[poolKey];

        emit PoolUnregistered(poolName);
    }

    // === DAILY CHALLENGES ===

    /**
     * @notice Complete a daily challenge
     * @param user User address
     * @param challengeType Type of challenge completed
     */
    function completeDailyChallenge(
        address user,
        ChallengeType challengeType
    ) external onlyDistributor whenNotPaused {
        if (block.timestamp < lastChallengeTimestamp[user] + 1 days) {
            revert ChallengeAlreadyClaimedToday();
        }

        // Check streak continuity (missed a day = reset)
        if (block.timestamp > lastChallengeTimestamp[user] + 2 days) {
            dailyChallengeStreak[user] = 0;
        }

        lastChallengeTimestamp[user] = block.timestamp;
        dailyChallengeStreak[user]++;

        uint256 baseReward = _getChallengeBaseReward(challengeType);

        // Streak multiplier: +10% per streak day, max 100% bonus
        uint256 streakBonus = (dailyChallengeStreak[user] > 10) ? 10 : dailyChallengeStreak[user];
        uint256 finalReward = baseReward + ((baseReward * streakBonus * 10) / 100);

        _distributeReward(user, finalReward, RewardType.DAILY_CHALLENGE, "Daily Challenge");

        emit DailyChallengeCompleted(user, challengeType, finalReward, dailyChallengeStreak[user]);
    }

    function _getChallengeBaseReward(ChallengeType challengeType) internal pure returns (uint256) {
        if (challengeType == ChallengeType.VOTE_PROPOSAL) return 50 * 1e18;
        if (challengeType == ChallengeType.COMPLETE_TASK) return 100 * 1e18;
        if (challengeType == ChallengeType.INVITE_MEMBER) return 200 * 1e18;
        if (challengeType == ChallengeType.COMMENT_PROPOSAL) return 25 * 1e18;
        if (challengeType == ChallengeType.ATTEND_MEETING) return 75 * 1e18;
        return 50 * 1e18; // OTHER
    }

    // === ADMIN FUNCTIONS ===

    /**
     * @notice Set/update milestone reward
     * @param milestone Deposit milestone amount
     * @param reward Reward amount
     */
    function setMilestoneReward(uint256 milestone, uint256 reward) external onlyOwner {
        if (milestone == 0) revert InvalidAmount();
        if (milestoneRewards[milestone] == 0) {
            milestonesList.push(milestone);
        }
        milestoneRewards[milestone] = reward;
        emit MilestoneRewardSet(milestone, reward);
    }

    /**
     * @notice Add a new milestone threshold (governance-controlled)
     */
    function addMilestone(uint256 milestone, uint256 reward) external onlyOwner {
        if (milestone == 0) revert InvalidAmount();
        if (milestoneRewards[milestone] == 0) {
            milestonesList.push(milestone);
        }
        milestoneRewards[milestone] = reward;
        emit MilestoneAdded(milestone, reward);
    }

    /**
     * @notice Update an existing milestone's reward
     */
    function updateMilestoneReward(uint256 milestone, uint256 reward) external onlyOwner {
        if (milestone == 0) revert InvalidAmount();
        if (milestoneRewards[milestone] == 0) revert InvalidAmount();
        milestoneRewards[milestone] = reward;
        emit MilestoneRewardSet(milestone, reward);
    }

    function getMilestones() external view returns (uint256[] memory) {
        return milestonesList;
    }

    /**
     * @notice Governance can adjust the max batch size to control gas usage
     */
    function setMaxBatchSize(uint256 _max) external onlyOwner {
        if (_max == 0) revert InvalidAmount();
        maxBatchSize = _max;
    }

    /**
     * @notice Batch distribute rewards to multiple users in a single transaction
     * @dev Keep gas limits in mind; `maxBatchSize` protects against huge arrays.
     */
    function batchDistribute(
        address[] calldata users,
        uint256[] calldata amounts,
        RewardType rewardType,
        string calldata reason
    ) external onlyDistributor nonReentrant whenNotPaused {
        uint256 len = users.length;
        if (len == 0) revert InvalidAmount();
        if (len != amounts.length) revert InvalidAmount();
        if (len > maxBatchSize) revert InvalidAmount();

        uint256 total;
        for (uint256 i = 0; i < len; i++) {
            address user = users[i];
            uint256 amt = amounts[i];
            if (amt == 0) continue;
            total += amt;
            _distributeReward(user, amt, rewardType, reason);
        }

        emit BatchDistributed(msg.sender, total, len);
    }

    /**
     * @notice Update reward rates
     * @param _vaultCreation New vault creation reward
     * @param _firstDeposit New first deposit reward
     * @param _taskBase New task completion base reward
     * @param _proposalApproval New proposal approval reward
     * @param _voting New voting reward
     */
    function setRewardRates(
        uint256 _vaultCreation,
        uint256 _firstDeposit,
        uint256 _taskBase,
        uint256 _proposalApproval,
        uint256 _voting
    ) external onlyOwner {
        vaultCreationReward = _vaultCreation;
        firstDepositReward = _firstDeposit;
        taskCompletionBaseReward = _taskBase;
        proposalApprovalReward = _proposalApproval;
        votingReward = _voting;

        emit RewardRatesUpdated(_vaultCreation, _firstDeposit, _taskBase, _proposalApproval, _voting);
    }

    /**
     * @notice Authorize/unauthorize a reward distributor
     * @param distributor Address to authorize
     * @param authorized Authorization status
     */
    function setDistributor(address distributor, bool authorized) external onlyOwner {
        if (distributor == address(0)) revert ZeroAddress();
        authorizedDistributors[distributor] = authorized;
        emit DistributorAuthorized(distributor, authorized);
    }

    /**
     * @notice Update DAO treasury address
     * @param _daoTreasury New treasury address
     */
    function setDaoTreasury(address _daoTreasury) external onlyOwner {
        if (_daoTreasury == address(0)) revert ZeroAddress();
        daoTreasury = _daoTreasury;
    }

    // === PAUSABILITY ===

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    // === EMERGENCY FUNCTIONS ===

    /**
     * @notice Emergency withdrawal of MTAA tokens (only when paused)
     * @param amount Amount to withdraw
     */
    function emergencyWithdraw(uint256 amount) external onlyOwner whenPaused {
        if (amount == 0) revert InvalidAmount();

        uint256 balance = mtaaToken.balanceOf(address(this));
        if (amount > balance) amount = balance;

        IERC20(address(mtaaToken)).safeTransfer(owner(), amount);
        emit EmergencyWithdrawal(address(mtaaToken), amount);
    }

    /**
     * @notice Emergency withdrawal of other tokens stuck in contract
     * @param token Token address
     * @param amount Amount to withdraw
     */
    function emergencyWithdrawToken(address token, uint256 amount) external onlyOwner whenPaused {
        if (token == address(0)) revert ZeroAddress();
        if (amount == 0) revert InvalidAmount();

        IERC20(token).safeTransfer(owner(), amount);
        emit EmergencyWithdrawal(token, amount);
    }

    // === VIEW FUNCTIONS ===

    function getTaskInfo(bytes32 taskId) external view returns (TaskInfo memory) {
        return tasks[taskId];
    }

    function getActiveTaskIds() external view returns (bytes32[] memory) {
        return activeTaskIds;
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

    function getUserRewards(address user) external view returns (UserRewards memory) {
        return userRewards[user];
    }

    function getTotalRewardsDistributed() external view returns (uint256) {
        return totalRewardsDistributed;
    }

    function getPoolLPToken(string calldata poolName) external view returns (address) {
        bytes32 poolKey = keccak256(abi.encodePacked(poolName));
        return poolAddresses[poolKey];
    }

    function canClaimDailyChallenge(address user) external view returns (bool) {
        return block.timestamp >= lastChallengeTimestamp[user] + 1 days;
    }

    function getDailyChallengeStreak(address user) external view returns (uint256) {
        // Check if streak is still valid
        if (block.timestamp > lastChallengeTimestamp[user] + 2 days) {
            return 0;
        }
        return dailyChallengeStreak[user];
    }

    function getUserTotalDeposits(address user) external view returns (uint256) {
        return userTotalDeposits[user];
    }

    /**
     * @notice Return raw ROI fixed-point value (scaled by `SCALE`)
     */
    function getVaultRoiRaw(address vault) external view returns (int256) {
        return vaultPerformances[vault].roi;
    }

    /**
     * @notice Return ROI as percent with 2 decimals encoded as an integer.
     * Example: returns `1234` => 12.34%
     */
    function getVaultRoiPercentWith2Decimals(address vault) external view returns (int256) {
        int256 raw = vaultPerformances[vault].roi;
        return (raw * 10000) / int256(SCALE);
    }

    // === INTERNAL HELPERS ===

    function _isValidVault(address vault) internal view returns (bool) {
        // Try the typed external call first (Phase1A compatible)
        try vaultFactory.getVaultDetails(vault) returns (MaonoVaultFactory_Phase1B.VaultInfo memory info) {
            return info.isActive;
        } catch {
            // Fallback: attempt low-level staticcall to vaultInfo getter and try to decode
            (bool ok, bytes memory data) = address(vaultFactory).staticcall(abi.encodeWithSignature("vaultInfo(address)", vault));
            if (!ok || data.length == 0) return false;
            // Attempt to decode as 7-field struct first
            // Be conservative: look for boolean '1' at end of data
            if (data.length >= 32) {
                uint256 lastWord;
                assembly { lastWord := mload(add(data, mload(data))) }
                return lastWord != 0;
            }
            return false;
        }
    }

    function _updateVaultPerformance(address vault, uint256 amount, bool isDeposit) internal {
        VaultPerformance storage perf = vaultPerformances[vault];
        if (isDeposit) {
            unchecked { perf.totalDeposits += amount; }
            if (perf.totalDeposits > perf.highWaterMark) {
                perf.highWaterMark = perf.totalDeposits;
            }
            // Deposits increase invested capital (not profit)
            perf.netProfit -= int256(amount);
        } else {
            unchecked { perf.totalWithdrawals += amount; }
            // Withdrawals that exceed deposits represent realized profit
            perf.netProfit += int256(amount);
        }
        if (perf.totalDeposits > 0) {
            // ROI: positive when netProfit > 0
            perf.roi = (perf.netProfit * int256(SCALE)) / int256(perf.totalDeposits);
        }
        perf.lastRewardTime = block.timestamp;
    }
}
