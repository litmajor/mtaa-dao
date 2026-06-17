// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title EscrowWithMilestones
 * @notice Escrow contract for Short-Term Project DAOs with milestone-based fund release
 * @dev Stores funds and releases them upon verified milestone completion
 * 
 * Use Case:
 *   - School renovation DAO raises $50K
 *   - Milestone 1 (30%): Walls built → architect verifies → $15K released
 *   - Milestone 2 (40%): Roof & electrical → $20K released
 *   - Milestone 3 (30%): Final inspection → $15K released
 */
contract EscrowWithMilestones is Ownable, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    // ==================== TYPES ====================
    enum MilestoneStatus { PENDING, SUBMITTED, VERIFIED, RELEASED, REJECTED }

    struct Milestone {
        uint256 milestoneId;
        string description;
        uint256 percentageOfTotal;        // e.g., 30% = 3000 (basis points)
        uint256 amountAllocated;
        uint256 amountReleased;
        MilestoneStatus status;
        uint256 completionDeadline;
        uint256 submittedAt;
        string evidenceHash;              // IPFS hash of submission (photos, docs)
        address verifier;                  // Architect/inspector who verified
        uint256 verifiedAt;
        string rejectionReason;
    }

    struct Project {
        uint256 projectId;
        address daoAddress;
        address fundRecipient;              // Contractor who receives funds
        IERC20 token;                       // Token address (e.g., cUSD)
        uint256 totalFundingGoal;
        uint256 totalFunded;
        uint256 totalReleased;
        uint256 projectStartDate;
        uint256 projectDeadline;
        uint256[] milestoneIds;
        bool isActive;
    }

    // ==================== STATE ====================
    mapping(uint256 projectId => Project) public projects;
    mapping(uint256 projectId => mapping(uint256 milestoneId => Milestone)) public milestones;
    
    mapping(address => uint256[]) public userProjects;
    
    uint256 public nextProjectId = 1;
    uint256 public nextMilestoneId = 1;

    // Authorized verifiers (architects, inspectors) per project
    mapping(uint256 projectId => address[]) public verifiers;
    mapping(uint256 projectId => mapping(address => bool)) public isVerifier;

    // ==================== EVENTS ====================
    event ProjectCreated(
        uint256 indexed projectId,
        address indexed dao,
        address indexed recipient,
        uint256 fundingGoal,
        uint256 deadline
    );

    event MilestoneCreated(
        uint256 indexed projectId,
        uint256 indexed milestoneId,
        string description,
        uint256 percentage,
        uint256 deadline
    );

    event MilestoneSubmitted(
        uint256 indexed projectId,
        uint256 indexed milestoneId,
        address indexed submitter,
        string evidenceHash
    );

    event MilestoneVerified(
        uint256 indexed projectId,
        uint256 indexed milestoneId,
        address indexed verifier,
        uint256 releaseAmount
    );

    event MilestoneRejected(
        uint256 indexed projectId,
        uint256 indexed milestoneId,
        address indexed verifier,
        string reason
    );

    event FundsReleased(
        uint256 indexed projectId,
        uint256 indexed milestoneId,
        address indexed recipient,
        uint256 amount
    );

    event FundsDeposited(
        uint256 indexed projectId,
        address indexed contributor,
        uint256 amount
    );

    event ProjectCompleted(
        uint256 indexed projectId,
        uint256 totalReleased
    );

    event ProjectCancelled(
        uint256 indexed projectId,
        string reason
    );

    event VerifierAdded(uint256 indexed projectId, address indexed verifier);
    event VerifierRemoved(uint256 indexed projectId, address indexed verifier);

    // ==================== ERRORS ====================
    error ProjectNotActive();
    error InvalidPercentage();
    error FundingGoalExceeded();
    error OnlyVerifier();
    error MilestoneNotSubmitted();
    error InvalidDeadline();
    error DeadlinePassed();
    error InsufficientFunds();
    error TransferFailed();
    error ProjectAlreadyCompleted();

    // ==================== MODIFIERS ====================
    modifier onlyVerifier(uint256 projectId) {
        if (!isVerifier[projectId][msg.sender]) {
            revert OnlyVerifier();
        }
        _;
    }

    modifier validProject(uint256 projectId) {
        if (projectId >= nextProjectId || !projects[projectId].isActive) {
            revert ProjectNotActive();
        }
        _;
    }

    // Constructor
    constructor() Ownable(msg.sender) {}

    // ==================== PROJECT MANAGEMENT ====================

    /**
     * @notice Create a new milestone-based escrow project
     * @param daoAddress Address of the DAO creating the project
     * @param recipient Contractor/recipient of funds
     * @param token Token to use for escrow
     * @param fundingGoal Total funding target
     * @param deadline Project completion deadline
     */
    function createProject(
        address daoAddress,
        address recipient,
        IERC20 token,
        uint256 fundingGoal,
        uint256 deadline
    ) external returns (uint256) {
        if (deadline <= block.timestamp) {
            revert InvalidDeadline();
        }
        if (fundingGoal == 0 || recipient == address(0)) {
            revert InvalidPercentage();
        }

        uint256 projectId = nextProjectId++;
        
        projects[projectId] = Project({
            projectId: projectId,
            daoAddress: daoAddress,
            fundRecipient: recipient,
            token: token,
            totalFundingGoal: fundingGoal,
            totalFunded: 0,
            totalReleased: 0,
            projectStartDate: block.timestamp,
            projectDeadline: deadline,
            milestoneIds: new uint256[](0),
            isActive: true
        });

        userProjects[daoAddress].push(projectId);

        emit ProjectCreated(projectId, daoAddress, recipient, fundingGoal, deadline);
        return projectId;
    }

    /**
     * @notice Add a milestone to the project
     * @param projectId Project ID
     * @param description Milestone description
     * @param percentageOfTotal Percentage of total (e.g., 3000 = 30%)
     * @param completionDeadline When this milestone must be complete
     */
    function addMilestone(
        uint256 projectId,
        string memory description,
        uint256 percentageOfTotal,
        uint256 completionDeadline
    ) external onlyOwner validProject(projectId) {
        if (percentageOfTotal == 0 || percentageOfTotal > 10000) {
            revert InvalidPercentage();
        }
        if (completionDeadline <= block.timestamp || completionDeadline > projects[projectId].projectDeadline) {
            revert InvalidDeadline();
        }

        uint256 milestoneId = nextMilestoneId++;
        uint256 amountAllocated = (projects[projectId].totalFundingGoal * percentageOfTotal) / 10000;

        milestones[projectId][milestoneId] = Milestone({
            milestoneId: milestoneId,
            description: description,
            percentageOfTotal: percentageOfTotal,
            amountAllocated: amountAllocated,
            amountReleased: 0,
            status: MilestoneStatus.PENDING,
            completionDeadline: completionDeadline,
            submittedAt: 0,
            evidenceHash: "",
            verifier: address(0),
            verifiedAt: 0,
            rejectionReason: ""
        });

        projects[projectId].milestoneIds.push(milestoneId);

        emit MilestoneCreated(projectId, milestoneId, description, percentageOfTotal, completionDeadline);
    }

    /**
     * @notice Add an authorized verifier (architect, inspector) for this project
     */
    function addVerifier(uint256 projectId, address verifierAddress) external onlyOwner validProject(projectId) {
        if (!isVerifier[projectId][verifierAddress]) {
            isVerifier[projectId][verifierAddress] = true;
            verifiers[projectId].push(verifierAddress);
            emit VerifierAdded(projectId, verifierAddress);
        }
    }

    // ==================== FUNDING ====================

    /**
     * @notice Deposit funds into the escrow
     * @param projectId Project ID
     * @param amount Amount to deposit
     */
    function depositFunds(uint256 projectId, uint256 amount) external validProject(projectId) nonReentrant {
        if (amount == 0) revert InvalidPercentage();
        
        Project storage project = projects[projectId];
        
        if (project.totalFunded + amount > project.totalFundingGoal) {
            revert FundingGoalExceeded();
        }

        project.token.safeTransferFrom(msg.sender, address(this), amount);
        project.totalFunded += amount;

        emit FundsDeposited(projectId, msg.sender, amount);
    }

    // ==================== MILESTONE VERIFICATION ====================

    /**
     * @notice Contractor submits evidence that milestone is complete
     * @param projectId Project ID
     * @param milestoneId Milestone ID
     * @param evidenceHash IPFS hash of evidence (photos, documents)
     */
    function submitMilestoneEvidence(
        uint256 projectId,
        uint256 milestoneId,
        string memory evidenceHash
    ) external validProject(projectId) {
        Project storage project = projects[projectId];
        Milestone storage milestone = milestones[projectId][milestoneId];

        if (msg.sender != project.fundRecipient) {
            revert OnlyVerifier();
        }

        if (milestone.status != MilestoneStatus.PENDING) {
            revert MilestoneNotSubmitted();
        }

        if (block.timestamp > milestone.completionDeadline) {
            revert DeadlinePassed();
        }

        milestone.status = MilestoneStatus.SUBMITTED;
        milestone.submittedAt = block.timestamp;
        milestone.evidenceHash = evidenceHash;

        emit MilestoneSubmitted(projectId, milestoneId, msg.sender, evidenceHash);
    }

    /**
     * @notice Verifier (architect/inspector) approves the milestone and releases funds
     * @param projectId Project ID
     * @param milestoneId Milestone ID
     */
    function verifyAndReleaseMilestone(
        uint256 projectId,
        uint256 milestoneId
    ) external onlyVerifier(projectId) validProject(projectId) nonReentrant {
        Project storage project = projects[projectId];
        Milestone storage milestone = milestones[projectId][milestoneId];

        if (milestone.status != MilestoneStatus.SUBMITTED) {
            revert MilestoneNotSubmitted();
        }

        // Mark as verified
        milestone.status = MilestoneStatus.VERIFIED;
        milestone.verifier = msg.sender;
        milestone.verifiedAt = block.timestamp;

        // Release funds
        uint256 releaseAmount = milestone.amountAllocated;
        
        if (releaseAmount > project.token.balanceOf(address(this))) {
            revert InsufficientFunds();
        }

        milestone.amountReleased = releaseAmount;
        milestone.status = MilestoneStatus.RELEASED;
        project.totalReleased += releaseAmount;

        // Transfer to recipient
        project.token.safeTransfer(project.fundRecipient, releaseAmount);

        emit MilestoneVerified(projectId, milestoneId, msg.sender, releaseAmount);
        emit FundsReleased(projectId, milestoneId, project.fundRecipient, releaseAmount);

        // Check if all milestones completed
        if (allMilestonesReleased(projectId)) {
            project.isActive = false;
            emit ProjectCompleted(projectId, project.totalReleased);
        }
    }

    /**
     * @notice Verifier rejects the milestone submission
     * @param projectId Project ID
     * @param milestoneId Milestone ID
     * @param reason Reason for rejection
     */
    function rejectMilestone(
        uint256 projectId,
        uint256 milestoneId,
        string memory reason
    ) external onlyVerifier(projectId) validProject(projectId) {
        Milestone storage milestone = milestones[projectId][milestoneId];

        if (milestone.status != MilestoneStatus.SUBMITTED) {
            revert MilestoneNotSubmitted();
        }

        milestone.status = MilestoneStatus.REJECTED;
        milestone.rejectionReason = reason;

        // Reset for resubmission
        emit MilestoneRejected(projectId, milestoneId, msg.sender, reason);
    }

    /**
     * @notice Contractor resubmits evidence after rejection
     */
    function resubmitMilestoneEvidence(
        uint256 projectId,
        uint256 milestoneId,
        string memory evidenceHash
    ) external validProject(projectId) {
        Project storage project = projects[projectId];
        Milestone storage milestone = milestones[projectId][milestoneId];

        if (msg.sender != project.fundRecipient) {
            revert OnlyVerifier();
        }

        if (milestone.status != MilestoneStatus.REJECTED) {
            revert MilestoneNotSubmitted();
        }

        milestone.status = MilestoneStatus.SUBMITTED;
        milestone.submittedAt = block.timestamp;
        milestone.evidenceHash = evidenceHash;
        milestone.rejectionReason = "";

        emit MilestoneSubmitted(projectId, milestoneId, msg.sender, evidenceHash);
    }

    // ==================== QUERIES ====================

    /**
     * @notice Check if all milestones have been released
     */
    function allMilestonesReleased(uint256 projectId) public view returns (bool) {
        uint256[] storage milestoneIds = projects[projectId].milestoneIds;
        for (uint256 i = 0; i < milestoneIds.length; i++) {
            if (milestones[projectId][milestoneIds[i]].status != MilestoneStatus.RELEASED) {
                return false;
            }
        }
        return milestoneIds.length > 0;
    }

    /**
     * @notice Get project details
     */
    function getProject(uint256 projectId) external view returns (Project memory) {
        return projects[projectId];
    }

    /**
     * @notice Get milestone details
     */
    function getMilestone(uint256 projectId, uint256 milestoneId) external view returns (Milestone memory) {
        return milestones[projectId][milestoneId];
    }

    /**
     * @notice Get all milestones for a project
     */
    function getProjectMilestones(uint256 projectId) external view returns (Milestone[] memory) {
        Project storage project = projects[projectId];
        Milestone[] memory result = new Milestone[](project.milestoneIds.length);
        
        for (uint256 i = 0; i < project.milestoneIds.length; i++) {
            result[i] = milestones[projectId][project.milestoneIds[i]];
        }
        
        return result;
    }

    /**
     * @notice Get remaining funds available for the project
     */
    function getRemainingFunds(uint256 projectId) external view returns (uint256) {
        Project storage project = projects[projectId];
        return project.token.balanceOf(address(this));
    }
}
