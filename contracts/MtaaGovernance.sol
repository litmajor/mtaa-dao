// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./MTAAToken.sol";
import "./MaonoVault.sol";
import "./MaonoVaultFactory.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
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

    // Events
    event RewardDistributed(address indexed user, uint256 amount, string reason);
    event TaskCreated(bytes32 indexed taskId, TaskDifficulty difficulty, uint256 reward);
    event TaskCompleted(address indexed user, bytes32 indexed taskId, uint256 reward);
    event MilestoneReached(address indexed user, uint256 milestone, uint256 reward);
    event VaultPerformanceUpdated(address indexed vault, bool isTopPerformer);

    // Errors
    error TaskNotActive();
    error TaskAlreadyCompleted();
    error TaskExpired();
    error MilestoneAlreadyClaimed();
    error InsufficientMTAABalance();

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

    function rewardVaultCreation(address creator, address vault) external {
        require(msg.sender == address(vaultFactory), "Only factory can reward");
        
        _distributeReward(creator, VAULT_CREATION_REWARD, "Vault Creation");
        
        // Initialize vault performance tracking
        vaultPerformances[vault] = VaultPerformance({
            totalDeposits: 0,
            totalWithdrawals: 0,
            highWaterMark: 0,
            lastRewardTime: block.timestamp,
            isTopPerformer: false
        });
    }

    function rewardFirstDeposit(address depositor, address vault, uint256 amount) external {
        require(_isValidVault(vault), "Invalid vault");
        require(!firstDepositClaimed[depositor], "First deposit already claimed");
        
        firstDepositClaimed[depositor] = true;
        _distributeReward(depositor, FIRST_DEPOSIT_REWARD, "First Deposit");
        
        // Check for milestone rewards
        _checkMilestoneRewards(depositor, amount);
        
        // Update vault performance
        _updateVaultPerformance(vault, amount, true);
    }

    function rewardDeposit(address depositor, address vault, uint256 amount) external {
        require(_isValidVault(vault), "Invalid vault");
        
        // Check for milestone rewards
        _checkMilestoneRewards(depositor, amount);
        
        // Monthly holding bonus (1% of deposit in MTAA)
        uint256 monthlyBonus = amount / 100;
        _distributeReward(depositor, monthlyBonus, "Monthly Holding Bonus");
        
        // Update vault performance
        _updateVaultPerformance(vault, amount, true);
    }

    function _checkMilestoneRewards(address user, uint256 amount) internal {
        for (uint256 milestone = 1000 * 1e18; milestone <= 100000 * 1e18; milestone *= 10) {
            if (amount >= milestone && !claimedMilestones[user][milestone]) {
                claimedMilestones[user][milestone] = true;
                _distributeReward(user, milestoneRewards[milestone], "Milestone Reached");
                emit MilestoneReached(user, milestone, milestoneRewards[milestone]);
            }
        }
    }

    function _updateVaultPerformance(address vault, uint256 amount, bool isDeposit) internal {
        VaultPerformance storage perf = vaultPerformances[vault];
        if (isDeposit) {
            perf.totalDeposits += amount;
            if (perf.totalDeposits > perf.highWaterMark) {
                perf.highWaterMark = perf.totalDeposits;
            }
            perf.netProfit += int256(amount);
        } else {
            perf.totalWithdrawals += amount;
            perf.netProfit -= int256(amount);
        }
        // ROI = netProfit / totalDeposits (scaled by 1e18)
        if (perf.totalDeposits > 0) {
            perf.roi = (perf.netProfit * 1e18) / int256(perf.totalDeposits);
        }
    }

    // === TASK SYSTEM ===

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
            else if (difficulty == TaskDifficulty.EXPERT) reward = 25000 * 1e18;
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

    function completeTask(bytes32 taskId, address user) external onlyOwner {
        TaskInfo storage task = tasks[taskId];
        
        if (!task.isActive) revert TaskNotActive();
        if (block.timestamp > task.deadline) revert TaskExpired();
        if (completedTasks[user][taskId]) revert TaskAlreadyCompleted();
        
        completedTasks[user][taskId] = true;
        userTaskCount[user]++;
        
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
        if (difficulty == TaskDifficulty.EXPERT) return 200;
        return 25;
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

    function rewardLiquidityProvider(address provider, uint256 lpTokens, string calldata poolName) 
        external 
        onlyOwner 
    {
        uint256 monthlyReward;
        // Different rewards based on pool
        if (_compareStrings(poolName, "MTAA/cUSD")) {
            monthlyReward = 20000 * 1e18; // 20k MTAA/month
        } else if (_compareStrings(poolName, "MTAA/CELO")) {
            monthlyReward = 15000 * 1e18; // 15k MTAA/month
        } else if (_compareStrings(poolName, "MTAA/cEUR")) {
            monthlyReward = 10000 * 1e18; // 10k MTAA/month
        } else {
            monthlyReward = 5000 * 1e18;  // 5k MTAA/month for other pools
        }
        // Pro-rate based on LP share (requires totalLPTokens from pool)
        uint256 totalLPTokens = 1; // TODO: fetch from pool contract
        uint256 actualReward = (monthlyReward * lpTokens) / totalLPTokens;
        _distributeReward(provider, actualReward, string(abi.encodePacked("Liquidity ", poolName)));
    }

    // === DAILY CHALLENGES ===

    function completeDailyChallenge(address user, string calldata challengeType) external onlyOwner {
        require(block.timestamp > lastChallengeTimestamp[user] + 1 days, "Challenge already claimed today");
        lastChallengeTimestamp[user] = block.timestamp;
        uint256 baseReward;
        if (_compareStrings(challengeType, "VOTE_PROPOSAL")) {
            baseReward = 50 * 1e18;
        } else if (_compareStrings(challengeType, "COMPLETE_TASK")) {
            baseReward = 100 * 1e18;
        } else if (_compareStrings(challengeType, "INVITE_MEMBER")) {
            baseReward = 200 * 1e18;
        } else if (_compareStrings(challengeType, "COMMENT_PROPOSAL")) {
            baseReward = 25 * 1e18;
        } else if (_compareStrings(challengeType, "ATTEND_MEETING")) {
            baseReward = 75 * 1e18;
        } else {
            baseReward = 50 * 1e18; // Default reward
        }
        mtaaToken.completeDailyChallenge(user, challengeType, baseReward);
    }

    // === UTILITY FUNCTIONS ===

    function _distributeReward(address user, uint256 amount, string memory reason) internal {
        if (amount == 0) return;
        emit RewardDistributed(user, amount, reason);
        // Mint directly if allowed, else transfer
        if (mtaaToken.balanceOf(address(this)) < amount) {
            // Mint if RewardsManager is minter
            try mtaaToken.mint(user, amount) {
                return;
            } catch {
                revert InsufficientMTAABalance();
            }
        } else {
            mtaaToken.transfer(user, amount);
        }
    }

    function _isValidVault(address vault) internal view returns (bool) {
        try vaultFactory.vaultInfo(vault) returns (MaonoVaultFactory.VaultInfo memory info) {
            return info.isActive;
        } catch {
            return false;
        }
    }

    function _compareStrings(string memory a, string memory b) internal pure returns (bool) {
        return keccak256(abi.encodePacked(a)) == keccak256(abi.encodePacked(b));
    }

    // === ADMIN FUNCTIONS ===

    function setMilestoneReward(uint256 milestone, uint256 reward) external onlyOwner {
        milestoneRewards[milestone] = reward;
    }

    function deactivateTask(bytes32 taskId) external onlyOwner {
        tasks[taskId].isActive = false;
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

/**
 * @title MTAAGovernance
 * @notice Handles governance proposals and voting with MTAA tokens
 */
contract MTAAGovernance is Ownable, ReentrancyGuard {
    MTAAToken public immutable mtaaToken;
    MTAARewardsManager public immutable rewardsManager;
    address public daoTreasury;
    
    struct Proposal {
        uint256 id;
        address proposer;
        string title;
        string description;
        uint256 startTime;
        uint256 endTime;
        uint256 forVotes;
        uint256 againstVotes;
        uint256 abstainVotes;
        bool executed;
        bool canceled;
        ProposalType proposalType;
        mapping(address => bool) hasVoted;
        mapping(address => VoteType) votes;
    }
    
    enum ProposalType {
        STANDARD,    // 100 MTAA + 1000 reputation
        TREASURY,    // 500 MTAA + 5000 reputation
        PROTOCOL,    // 1000 MTAA + 10000 reputation
        EMERGENCY    // 2000 MTAA + Elder status
    }
    
    enum VoteType {
        AGAINST,
        FOR,
        ABSTAIN
    }
    
    uint256 public proposalCount;
    mapping(uint256 => Proposal) public proposals;
    
    uint256 public constant VOTING_PERIOD = 7 days;
    uint256 public constant EXECUTION_DELAY = 2 days;
    uint256 public constant QUORUM_PERCENTAGE = 5; // 5% of total supply
    
    // Proposal requirements
    mapping(ProposalType => uint256) public proposalFees;
    mapping(ProposalType => uint256) public reputationRequirements;

    // Events
    event ProposalCreated(uint256 indexed proposalId, address indexed proposer, string title);
    event VoteCast(address indexed voter, uint256 indexed proposalId, VoteType vote, uint256 weight);
    event ProposalExecuted(uint256 indexed proposalId);
    event ProposalCanceled(uint256 indexed proposalId);

    // Errors
    error InsufficientReputation();
    error InsufficientMTAA();
    error ProposalNotActive();
    error AlreadyVoted();
    error ProposalNotPassed();
    error ProposalAlreadyExecuted();

    constructor(address _mtaaToken, address _rewardsManager) Ownable(msg.sender) {
    mtaaToken = MTAAToken(_mtaaToken);
    rewardsManager = MTAARewardsManager(_rewardsManager);
    daoTreasury = owner();
    proposalFees[ProposalType.STANDARD] = 100 * 1e18;
    proposalFees[ProposalType.TREASURY] = 500 * 1e18;
    proposalFees[ProposalType.PROTOCOL] = 1000 * 1e18;
    proposalFees[ProposalType.EMERGENCY] = 2000 * 1e18;
    reputationRequirements[ProposalType.STANDARD] = 1000;
    reputationRequirements[ProposalType.TREASURY] = 5000;
    reputationRequirements[ProposalType.PROTOCOL] = 10000;
    reputationRequirements[ProposalType.EMERGENCY] = 5000; // Elder+ required
    }

    function createProposal(
        string calldata title,
        string calldata description,
        ProposalType proposalType
    ) external nonReentrant returns (uint256) {
        // Check requirements
        uint256 requiredFee = proposalFees[proposalType];
        uint256 requiredReputation = reputationRequirements[proposalType];
        
        if (mtaaToken.balanceOf(msg.sender) < requiredFee) revert InsufficientMTAA();
        if (mtaaToken.reputationScores(msg.sender) < requiredReputation) revert InsufficientReputation();
        
        // For emergency proposals, check for Elder status
        if (proposalType == ProposalType.EMERGENCY) {
            MTAAToken.ReputationTier tier = mtaaToken.getReputationTier(msg.sender);
            require(
                tier == MTAAToken.ReputationTier.ELDER || tier == MTAAToken.ReputationTier.ARCHITECT,
                "Requires Elder+ status"
            );
        }
        
        // Pay proposal fee
        mtaaToken.transferFrom(msg.sender, address(this), requiredFee);
        
        proposalCount++;
        uint256 proposalId = proposalCount;
        
        Proposal storage proposal = proposals[proposalId];
        proposal.id = proposalId;
        proposal.proposer = msg.sender;
        proposal.title = title;
        proposal.description = description;
        proposal.startTime = block.timestamp;
        proposal.endTime = block.timestamp + VOTING_PERIOD;
        proposal.proposalType = proposalType;
        
        emit ProposalCreated(proposalId, msg.sender, title);
        return proposalId;
    }

    function vote(uint256 proposalId, VoteType voteType) external nonReentrant {
        Proposal storage proposal = proposals[proposalId];
        
        if (block.timestamp < proposal.startTime || block.timestamp > proposal.endTime) {
            revert ProposalNotActive();
        }
        if (proposal.hasVoted[msg.sender]) revert AlreadyVoted();
        
        // Calculate voting power (quadratic voting)
        uint256 votingPower = mtaaToken.getVotingPower(msg.sender);
        
        proposal.hasVoted[msg.sender] = true;
        proposal.votes[msg.sender] = voteType;
        
        if (voteType == VoteType.FOR) {
            proposal.forVotes += votingPower;
        } else if (voteType == VoteType.AGAINST) {
            proposal.againstVotes += votingPower;
        } else {
            proposal.abstainVotes += votingPower;
        }
        
        // Reward voting
        rewardsManager.rewardVoting(msg.sender);
        
        emit VoteCast(msg.sender, proposalId, voteType, votingPower);
    }

    function executeProposal(uint256 proposalId) external nonReentrant {
    Proposal storage proposal = proposals[proposalId];
    if (block.timestamp < proposal.endTime + EXECUTION_DELAY) revert ProposalNotActive();
    if (proposal.executed) revert ProposalAlreadyExecuted();
    // Check if proposal passed
    uint256 totalVotes = proposal.forVotes + proposal.againstVotes + proposal.abstainVotes;
    uint256 quorum = (mtaaToken.totalSupply() * QUORUM_PERCENTAGE) / 100;
    bool passed = totalVotes >= quorum && proposal.forVotes > proposal.againstVotes;
    if (!passed) revert ProposalNotPassed();
    proposal.executed = true;
    // Reward proposer if executed successfully
    rewardsManager.rewardProposalApproval(proposal.proposer);
    // Timelock hook: TODO - queue/execute actions if proposal has on-chain actions
    emit ProposalExecuted(proposalId);
    }

    function cancelProposal(uint256 proposalId) external {
        Proposal storage proposal = proposals[proposalId];
        require(
            msg.sender == proposal.proposer || msg.sender == owner(),
            "Not authorized"
        );
        require(block.timestamp <= proposal.endTime, "Voting ended");
        
        proposal.canceled = true;
        emit ProposalCanceled(proposalId);
    }

    // === VIEW FUNCTIONS ===

    function getProposal(uint256 proposalId) external view returns (
        uint256 id,
        address proposer,
        string memory title,
        string memory description,
        uint256 startTime,
        uint256 endTime,
        uint256 forVotes,
        uint256 againstVotes,
        uint256 abstainVotes,
        bool executed,
        bool canceled
    ) {
        Proposal storage proposal = proposals[proposalId];
        return (
            proposal.id,
            proposal.proposer,
            proposal.title,
            proposal.description,
            proposal.startTime,
            proposal.endTime,
            proposal.forVotes,
            proposal.againstVotes,
            proposal.abstainVotes,
            proposal.executed,
            proposal.canceled
        );
    }

    function hasVoted(uint256 proposalId, address voter) external view returns (bool) {
        return proposals[proposalId].hasVoted[voter];
    }

    function getVote(uint256 proposalId, address voter) external view returns (VoteType) {
        return proposals[proposalId].votes[voter];
    }

    function getProposalState(uint256 proposalId) external view returns (string memory) {
        Proposal storage proposal = proposals[proposalId];
        
        if (proposal.canceled) return "Canceled";
        if (proposal.executed) return "Executed";
        if (block.timestamp < proposal.startTime) return "Pending";
        if (block.timestamp <= proposal.endTime) return "Active";
        
        uint256 totalVotes = proposal.forVotes + proposal.againstVotes + proposal.abstainVotes;
        uint256 quorum = (mtaaToken.totalSupply() * QUORUM_PERCENTAGE) / 100;
        
        if (totalVotes < quorum) return "Failed (No Quorum)";
        if (proposal.forVotes <= proposal.againstVotes) return "Failed";
        
        return "Succeeded";
    }

    // === ADMIN FUNCTIONS ===

    function setProposalFee(ProposalType proposalType, uint256 fee) external onlyOwner {
        proposalFees[proposalType] = fee;
    }

    function setReputationRequirement(ProposalType proposalType, uint256 reputation) external onlyOwner {
        reputationRequirements[proposalType] = reputation;
    }

    function withdrawFees() external onlyOwner {
    uint256 balance = mtaaToken.balanceOf(address(this));
    mtaaToken.transfer(daoTreasury, balance);
    daoTreasury = treasury;
    }
}