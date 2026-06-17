// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title DisputeResolution
 * @notice On-chain arbitration for contested governance decisions
 * @dev Enables DAOs members to challenge proposals and votes through arbitration
 * 
 * Use Case (Governance Disputes):
 *   - Members challenge vote counting (suspected fraud)
 *   - Members appeal DAO suspension (wrongful expulsion)
 *   - Members contest proposal execution (unauthorized spending)
 *   - Arbitrators (elders/guardians) review and resolve
 */
contract DisputeResolution is Ownable, ReentrancyGuard {

    // ==================== TYPES ====================
    enum DisputeType {
        VOTE_FRAUD,              // Disputed vote tally
        UNAUTHORIZED_PROPOSAL,   // Proposal shouldn't have passed
        WRONGFUL_SUSPENSION,     // Member wrongly suspended
        UNAUTHORIZED_SPENDING,   // Treasury spent without approval
        POLICY_VIOLATION,        // DAO violated own rules
        OTHER                    // Custom dispute
    }

    enum DisputeStatus {
        FILED,                   // Submitted by member
        UNDER_REVIEW,            // Arbitrator assigned
        EVIDENCE_GATHERING,      // Collecting evidence
        ARBITRATION_HEARING,     // Formal hearing
        RESOLVED,                // Decision made
        APPEALED,                // Losing party appealed
        FINAL                    // Appeal resolved
    }

    enum ResolutionOutcome {
        DISMISSED,               // Dispute invalid
        UPHELD,                  // Dispute valid
        PARTIALLY_UPHELD,        // Partial remedy
        REVOTE_REQUIRED,         // Redo the vote
        PROPOSAL_CANCELLED,      // Reverse proposal
        CUSTOM_REMEDY            // Arbitrator-determined remedy
    }

    struct Dispute {
        uint256 disputeId;
        address filer;           // Member filing dispute
        address targetDAO;       // DAO being disputed
        DisputeType disputeType;
        string description;
        string evidenceIPFSHash; // Link to dispute evidence
        uint256 filedAt;
        DisputeStatus status;
        address[] arbitrators;   // 3-member panel
        mapping(address => ResolutionOutcome) arbitratorVotes;
        ResolutionOutcome finalOutcome;
        string remedyDescription;
        uint256 resolvedAt;
        bool appealed;
        uint256 appealDeadline;
    }

    struct ArbitratorProfile {
        address arbitrator;
        uint256 casesHandled;
        uint256 casesUpheld;      // % of disputes upheld
        uint256 casesDismissed;
        bool isActive;
        uint256 reputation;
    }

    // ==================== STATE ====================
    mapping(uint256 => Dispute) public disputes;
    uint256 public disputeCounter = 1;

    mapping(address => ArbitratorProfile) public arbitrators;
    address[] public activeArbitrators;

    mapping(address => uint256[]) public memberDisputes;
    mapping(address => uint256[]) public daoDisputes;

    // Dispute fees
    uint256 public disputeFilingFee = 1 ether;  // Anti-spam fee
    address public feeRecipient;

    // Arbitration rules
    uint256 public constant ARBITRATOR_PANEL_SIZE = 3;
    uint256 public constant UNANIMOUS_THRESHOLD = 3;  // 3/3 or 2/3
    uint256 public constant APPEAL_DEADLINE = 7 days;
    uint256 public constant EVIDENCE_WINDOW = 14 days;

    // ==================== EVENTS ====================
    event DisputeFiled(
        uint256 indexed disputeId,
        address indexed filer,
        address indexed targetDAO,
        DisputeType disputeType
    );

    event ArbitratorsAssigned(
        uint256 indexed disputeId,
        address[3] arbitrators
    );

    event ArbitratorVoted(
        uint256 indexed disputeId,
        address indexed arbitrator,
        ResolutionOutcome vote
    );

    event DisputeResolved(
        uint256 indexed disputeId,
        ResolutionOutcome outcome,
        string remedy
    );

    event DisputeAppealed(
        uint256 indexed disputeId,
        address indexed appellant
    );

    event AppealResolved(
        uint256 indexed disputeId,
        ResolutionOutcome finalOutcome
    );

    event ArbitratorRegistered(
        address indexed arbitrator,
        string qualifications
    );

    event ArbitratorRemoved(
        address indexed arbitrator
    );

    // ==================== ERRORS ====================
    error DisputeNotFound();
    error InvalidDispute();
    error AlreadyVoted();
    error NotArbitrator();
    error AppealDeadlinePassed();
    error InsufficientFee();
    error InvalidOutcome();

    // ==================== MODIFIERS ====================
    modifier validDispute(uint256 disputeId) {
        if (disputeId == 0 || disputeId >= disputeCounter) revert DisputeNotFound();
        _;
    }

    modifier onlyArbitrator(uint256 disputeId) {
        Dispute storage dispute = disputes[disputeId];
        bool isArbitrator = false;
        
        for (uint256 i = 0; i < dispute.arbitrators.length; i++) {
            if (dispute.arbitrators[i] == msg.sender) {
                isArbitrator = true;
                break;
            }
        }
        
        if (!isArbitrator) revert NotArbitrator();
        _;
    }

    // ==================== INITIALIZATION ====================

    constructor(address _feeRecipient) Ownable(msg.sender) {
        feeRecipient = _feeRecipient;
    }

    // ==================== DISPUTE FILING ====================

    /**
     * @notice File a dispute
     * @param targetDAO Address of DAO being disputed
     * @param disputeType Type of dispute
     * @param description Detailed description
     * @param evidenceIPFSHash IPFS hash of evidence documents
     */
    function fileDispute(
        address targetDAO,
        DisputeType disputeType,
        string memory description,
        string memory evidenceIPFSHash
    ) external payable nonReentrant returns (uint256) {
        if (msg.value < disputeFilingFee) revert InsufficientFee();
        if (targetDAO == address(0)) revert InvalidDispute();

        uint256 disputeId = disputeCounter++;
        Dispute storage dispute = disputes[disputeId];

        dispute.disputeId = disputeId;
        dispute.filer = msg.sender;
        dispute.targetDAO = targetDAO;
        dispute.disputeType = disputeType;
        dispute.description = description;
        dispute.evidenceIPFSHash = evidenceIPFSHash;
        dispute.filedAt = block.timestamp;
        dispute.status = DisputeStatus.FILED;
        dispute.appealDeadline = block.timestamp + APPEAL_DEADLINE;

        memberDisputes[msg.sender].push(disputeId);
        daoDisputes[targetDAO].push(disputeId);

        // Transfer fee
        if (msg.value > 0) {
            payable(feeRecipient).transfer(msg.value);
        }

        emit DisputeFiled(disputeId, msg.sender, targetDAO, disputeType);
        return disputeId;
    }

    // ==================== ARBITRATOR APPOINTMENT ====================

    /**
     * @notice Register as arbitrator
     * @dev Requires approval by contract owner (governance)
     */
    function registerArbitrator(address arbitrator, string memory qualifications) 
        external 
        onlyOwner 
    {
        if (arbitrators[arbitrator].arbitrator != address(0)) {
            revert InvalidDispute();  // Already registered
        }

        arbitrators[arbitrator] = ArbitratorProfile({
            arbitrator: arbitrator,
            casesHandled: 0,
            casesUpheld: 0,
            casesDismissed: 0,
            isActive: true,
            reputation: 100  // Start at 100
        });

        activeArbitrators.push(arbitrator);
        emit ArbitratorRegistered(arbitrator, qualifications);
    }

    /**
     * @notice Assign arbitrators to a dispute
     * @dev Called by contract owner after dispute is filed
     */
    function assignArbitrators(
        uint256 disputeId,
        address[3] memory panel
    ) external onlyOwner validDispute(disputeId) {
        Dispute storage dispute = disputes[disputeId];
        
        if (dispute.status != DisputeStatus.FILED) revert InvalidDispute();

        for (uint256 i = 0; i < ARBITRATOR_PANEL_SIZE; i++) {
            if (!arbitrators[panel[i]].isActive) revert InvalidDispute();
            dispute.arbitrators.push(panel[i]);
        }

        dispute.status = DisputeStatus.UNDER_REVIEW;
        emit ArbitratorsAssigned(disputeId, panel);
    }

    // ==================== ARBITRATION HEARING ====================

    /**
     * @notice Arbitrator votes on dispute resolution
     */
    function voteOnDispute(
        uint256 disputeId,
        ResolutionOutcome outcome
    ) external onlyArbitrator(disputeId) validDispute(disputeId) {
        Dispute storage dispute = disputes[disputeId];
        
        if (dispute.status != DisputeStatus.UNDER_REVIEW && 
            dispute.status != DisputeStatus.EVIDENCE_GATHERING &&
            dispute.status != DisputeStatus.ARBITRATION_HEARING) {
            revert InvalidDispute();
        }

        // Check if already voted
        bool alreadyVoted = dispute.arbitratorVotes[msg.sender] != ResolutionOutcome(0);
        if (alreadyVoted) revert AlreadyVoted();

        dispute.arbitratorVotes[msg.sender] = outcome;
        dispute.status = DisputeStatus.ARBITRATION_HEARING;

        emit ArbitratorVoted(disputeId, msg.sender, outcome);

        // Check if all arbitrators have voted
        _checkDisputeResolution(disputeId);
    }

    /**
     * @notice Internal: Check if dispute is resolved
     */
    function _checkDisputeResolution(uint256 disputeId) internal {
        Dispute storage dispute = disputes[disputeId];

        uint256 votedCount = 0;
        for (uint256 i = 0; i < dispute.arbitrators.length; i++) {
            if (dispute.arbitratorVotes[dispute.arbitrators[i]] != ResolutionOutcome(0)) {
                votedCount++;
            }
        }

        // All arbitrators voted - determine outcome
        if (votedCount == dispute.arbitrators.length) {
            _finalizeDispute(disputeId);
        }
    }

    /**
     * @notice Internal: Finalize dispute with arbitrator consensus
     */
    function _finalizeDispute(uint256 disputeId) internal {
        Dispute storage dispute = disputes[disputeId];

        // Count votes using simple counters (mappings cannot be declared in function scope)
        uint256 upheldCount = 0;
        uint256 dismissedCount = 0;
        uint256 otherCount = 0;
        for (uint256 i = 0; i < dispute.arbitrators.length; i++) {
            ResolutionOutcome vote = dispute.arbitratorVotes[dispute.arbitrators[i]];
            if (vote == ResolutionOutcome.UPHELD) {
                upheldCount++;
            } else if (vote == ResolutionOutcome.DISMISSED) {
                dismissedCount++;
            } else {
                otherCount++;
            }
        }

        // Determine final outcome by majority
        if (upheldCount >= dismissedCount && upheldCount >= otherCount) {
            dispute.finalOutcome = ResolutionOutcome.UPHELD;
        } else if (dismissedCount >= upheldCount && dismissedCount >= otherCount) {
            dispute.finalOutcome = ResolutionOutcome.DISMISSED;
        } else {
            dispute.finalOutcome = ResolutionOutcome.CUSTOM_REMEDY;
        }

        dispute.status = DisputeStatus.RESOLVED;
        dispute.resolvedAt = block.timestamp;

        // Update arbitrator stats
        for (uint256 i = 0; i < dispute.arbitrators.length; i++) {
            arbitrators[dispute.arbitrators[i]].casesHandled++;
            if (dispute.finalOutcome == ResolutionOutcome.UPHELD) {
                arbitrators[dispute.arbitrators[i]].casesUpheld++;
            } else {
                arbitrators[dispute.arbitrators[i]].casesDismissed++;
            }
        }

        emit DisputeResolved(disputeId, dispute.finalOutcome, dispute.remedyDescription);
    }

    // ==================== APPEALS ====================

    /**
     * @notice Appeal a resolved dispute
     */
    function appealDispute(uint256 disputeId, string memory grounds) 
        external 
        payable 
        validDispute(disputeId) 
        nonReentrant 
    {
        Dispute storage dispute = disputes[disputeId];
        
        if (dispute.status != DisputeStatus.RESOLVED) revert InvalidDispute();
        if (block.timestamp > dispute.appealDeadline) revert AppealDeadlinePassed();
        if (msg.sender != dispute.filer) revert InvalidDispute();
        if (msg.value < disputeFilingFee) revert InsufficientFee();

        dispute.appealed = true;
        dispute.status = DisputeStatus.APPEALED;

        payable(feeRecipient).transfer(msg.value);

        emit DisputeAppealed(disputeId, msg.sender);
    }

    /**
     * @notice Resolve appeal (by contract owner/guardian)
     */
    function resolveAppeal(
        uint256 disputeId,
        ResolutionOutcome finalOutcome,
        string memory reasoning
    ) external onlyOwner validDispute(disputeId) {
        Dispute storage dispute = disputes[disputeId];
        
        if (dispute.status != DisputeStatus.APPEALED) revert InvalidDispute();

        dispute.status = DisputeStatus.FINAL;
        dispute.finalOutcome = finalOutcome;
        dispute.remedyDescription = reasoning;

        emit AppealResolved(disputeId, finalOutcome);
    }

    // ==================== QUERY FUNCTIONS ====================

    /**
     * @notice Get dispute details
     */
    function getDispute(uint256 disputeId) 
        external 
        view 
        validDispute(disputeId) 
        returns (
            address filer,
            address targetDAO,
            DisputeType disputeType,
            DisputeStatus status,
            ResolutionOutcome finalOutcome
        ) 
    {
        Dispute storage dispute = disputes[disputeId];
        return (
            dispute.filer,
            dispute.targetDAO,
            dispute.disputeType,
            dispute.status,
            dispute.finalOutcome
        );
    }

    /**
     * @notice Get member's disputes
     */
    function getMemberDisputes(address member) external view returns (uint256[] memory) {
        return memberDisputes[member];
    }

    /**
     * @notice Get DAO's disputes
     */
    function getDAODisputes(address daoAddress) external view returns (uint256[] memory) {
        return daoDisputes[daoAddress];
    }

    /**
     * @notice Remove arbitrator (e.g., for misconduct)
     */
    function removeArbitrator(address arbitrator) external onlyOwner {
        arbitrators[arbitrator].isActive = false;
        emit ArbitratorRemoved(arbitrator);
    }
}
