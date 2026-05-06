// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

/**
 * @title EscrowOracle
 * @notice Oracle for bail fund case management and court integration
 * @dev Enables users to post bail and tracks court outcomes
 * 
 * Use Case (Bail Fund):
 *   - Alice charged with theft, bail set at $5,000
 *   - Bail Fund DAO posts $5,000 as bail
 *   - EscrowOracle holds funds in escrow
 *   - Court confirms: Alice appeared → funds returned to DAO + interest
 *   - OR Court confirms: Alice fled → funds forfeited to court/DAO
 * 
 * Actors:
 *   - Defendant: Person charged with crime
 *   - Bail Fund: DAO posting bail
 *   - Court Oracle: Off-chain service providing court outcomes
 *   - Guardian: Authorized to withdraw forfeited bail
 */
contract EscrowOracle is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ==================== TYPES ====================
    enum CaseStatus { 
        BAIL_POSTED,        // Bail posted, awaiting court hearing
        ACTIVE,             // Defendant released on bail
        RESOLVED_APPEARED,  // Defendant appeared, bail returned
        RESOLVED_FORFEITED, // Defendant fled, bail forfeited
        CANCELLED           // Case dismissed/withdrawn
    }

    struct BailCase {
        uint256 caseId;
        address defendant;
        address bailPoster;              // DAO that posted bail
        string caseNumber;              // "2024-CR-12345"
        uint256 bailAmount;             // In USDC or other token
        IERC20 bailToken;
        uint256 postedAt;
        uint256 courtHearingDate;       // When defendant must appear
        CaseStatus status;
        uint256 courtResolutionTime;    // When judge resolved
        bool defendantAppeared;
        string caseOutcome;             // "Guilty", "Acquitted", "Dismissed"
        uint256 forwardingAddress;      // If bail needs to be returned somewhere
    }

    struct BailCaseEvidence {
        uint256 caseId;
        string evidenceType;            // "courtDocument", "notarizedArrival", "flightWarrant"
        string ipfsHash;                // Link to evidence on IPFS
        uint256 submittedAt;
        address submitter;
    }

    // ==================== STATE ====================
    mapping(uint256 => BailCase) public cases;
    mapping(uint256 => BailCaseEvidence[]) public caseEvidence;
    
    mapping(address => uint256[]) public bailPosterCases;  // DAO -> case IDs
    mapping(address => uint256[]) public defendantCases;   // Defendant -> case IDs
    
    uint256 public caseCounter = 1;
    
    // Oracle configuration
    address public courtOracleProvider;  // Off-chain service verifying court outcomes
    mapping(address => bool) public authorizedOracles;
    
    // Performance fee (e.g., 5% of returned bail)
    uint256 public performanceFeeBPs = 500;  // 5%
    address public feeRecipient;
    
    // Forfeiture tracking
    mapping(uint256 => uint256) public forturedFunds;  // caseId -> forfeited amount

    // ==================== EVENTS ====================
    event BailPosted(
        uint256 indexed caseId,
        address indexed defendant,
        address indexed bailPoster,
        uint256 bailAmount,
        uint256 hearingDate
    );

    event CourtOutcomeSubmitted(
        uint256 indexed caseId,
        bool defendantAppeared,
        string outcome
    );

    event BailReturned(
        uint256 indexed caseId,
        address indexed ballPoster,
        uint256 amount,
        uint256 performanceFee
    );

    event BailForfeited(
        uint256 indexed caseId,
        address indexed bailPoster,
        uint256 forfeituAmount
    );

    event EvidenceSubmitted(
        uint256 indexed caseId,
        string evidenceType,
        string ipfsHash
    );

    event OracleAuthorized(address indexed oracle);
    event OracleRevoked(address indexed oracle);

    // ==================== ERRORS ====================
    error CaseNotFound();
    error UnauthorizedOracle();
    error InvalidBailAmount();
    error InvalidCaseStatus();
    error InvalidOutcome();
    error NoFundsToReturn();
    error OutcomeAlreadySubmitted();
    error InsufficientFunds();

    // ==================== MODIFIERS ====================
    modifier validCase(uint256 caseId) {
        if (caseId == 0 || caseId >= caseCounter) revert CaseNotFound();
        _;
    }

    modifier onlyAuthorizedOracle() {
        if (!authorizedOracles[msg.sender] && msg.sender != owner()) {
            revert UnauthorizedOracle();
        }
        _;
    }

    // ==================== INITIALIZATION ====================

    constructor(address _courtOracleProvider) {
        courtOracleProvider = _courtOracleProvider;
        authorizedOracles[_courtOracleProvider] = true;
        feeRecipient = msg.sender;
    }

    // ==================== ORACLE MANAGEMENT ====================

    /**
     * @notice Authorize an oracle service to submit court outcomes
     */
    function authorizeOracle(address oracle) external onlyOwner {
        authorizedOracles[oracle] = true;
        emit OracleAuthorized(oracle);
    }

    /**
     * @notice Revoke oracle authorization
     */
    function revokeOracle(address oracle) external onlyOwner {
        authorizedOracles[oracle] = false;
        emit OracleRevoked(oracle);
    }

    // ==================== BAIL POSTING ====================

    /**
     * @notice Post bail for a defendant
     * @param defendant Address of defendant
     * @param caseNumber Case number (e.g., "2024-CR-12345")
     * @param bailAmount Amount to post as bail
     * @param bailToken Token to use for bail
     * @param courtHearingDate UNIX timestamp of court hearing
     */
    function postBail(
        address defendant,
        string memory caseNumber,
        uint256 bailAmount,
        IERC20 bailToken,
        uint256 courtHearingDate
    ) external nonReentrant returns (uint256) {
        if (bailAmount == 0) revert InvalidBailAmount();
        if (courtHearingDate <= block.timestamp) revert InvalidBailAmount();

        // Transfer bail from poster to this contract
        bailToken.safeTransferFrom(msg.sender, address(this), bailAmount);

        uint256 caseId = caseCounter++;
        BailCase storage bailCase = cases[caseId];
        
        bailCase.caseId = caseId;
        bailCase.defendant = defendant;
        bailCase.bailPoster = msg.sender;
        bailCase.caseNumber = caseNumber;
        bailCase.bailAmount = bailAmount;
        bailCase.bailToken = bailToken;
        bailCase.postedAt = block.timestamp;
        bailCase.courtHearingDate = courtHearingDate;
        bailCase.status = CaseStatus.BAIL_POSTED;

        bailPosterCases[msg.sender].push(caseId);
        defendantCases[defendant].push(caseId);

        emit BailPosted(caseId, defendant, msg.sender, bailAmount, courtHearingDate);
        return caseId;
    }

    // ==================== COURT OUTCOME SUBMISSION ====================

    /**
     * @notice Submit court outcome (oracle only)
     * @param caseId Case ID
     * @param defendantAppeared True if defendant appeared in court
     * @param outcome "Guilty", "Acquitted", "Dismissed", "Escaped"
     */
    function submitCourtOutcome(
        uint256 caseId,
        bool defendantAppeared,
        string memory outcome
    ) external onlyAuthorizedOracle validCase(caseId) nonReentrant {
        BailCase storage bailCase = cases[caseId];
        
        if (bailCase.status != CaseStatus.BAIL_POSTED && bailCase.status != CaseStatus.ACTIVE) {
            revert InvalidCaseStatus();
        }
        if (bailCase.courtResolutionTime != 0) revert OutcomeAlreadySubmitted();

        bailCase.defendantAppeared = defendantAppeared;
        bailCase.caseOutcome = outcome;
        bailCase.courtResolutionTime = block.timestamp;

        if (defendantAppeared) {
            bailCase.status = CaseStatus.RESOLVED_APPEARED;
            _returnBail(caseId);
        } else {
            bailCase.status = CaseStatus.RESOLVED_FORFEITED;
            forturedFunds[caseId] = bailCase.bailAmount;
            emit BailForfeited(caseId, bailCase.bailPoster, bailCase.bailAmount);
        }

        emit CourtOutcomeSubmitted(caseId, defendantAppeared, outcome);
    }

    // ==================== BAIL RETURN LOGIC ====================

    /**
     * @notice Internal function to return bail when defendant appears
     */
    function _returnBail(uint256 caseId) internal {
        BailCase storage bailCase = cases[caseId];
        
        if (bailCase.bailAmount == 0) revert NoFundsToReturn();

        uint256 performanceFee = (bailCase.bailAmount * performanceFeeBPs) / 10000;
        uint256 returnAmount = bailCase.bailAmount - performanceFee;

        // Return to bail poster
        bailCase.bailToken.safeTransfer(bailCase.bailPoster, returnAmount);

        // Collect performance fee
        if (performanceFee > 0) {
            bailCase.bailToken.safeTransfer(feeRecipient, performanceFee);
        }

        emit BailReturned(caseId, bailCase.bailPoster, returnAmount, performanceFee);
    }

    /**
     * @notice Withdraw forfeited bail (only by authorized guardian)
     */
    function withdrawForfeited(uint256 caseId) external onlyOwner validCase(caseId) nonReentrant {
        BailCase storage bailCase = cases[caseId];
        
        if (bailCase.status != CaseStatus.RESOLVED_FORFEITED) revert InvalidCaseStatus();
        if (forturedFunds[caseId] == 0) revert NoFundsToReturn();

        uint256 amount = forturedFunds[caseId];
        forturedFunds[caseId] = 0;

        bailCase.bailToken.safeTransfer(owner(), amount);
    }

    // ==================== EVIDENCE MANAGEMENT ====================

    /**
     * @notice Submit evidence for a case (IPFS hash)
     */
    function submitEvidence(
        uint256 caseId,
        string memory evidenceType,
        string memory ipfsHash
    ) external validCase(caseId) {
        BailCase storage bailCase = cases[caseId];
        
        // Only defendant or bail poster can submit evidence
        if (msg.sender != bailCase.defendant && msg.sender != bailCase.bailPoster) {
            revert UnauthorizedOracle();
        }

        caseEvidence[caseId].push(BailCaseEvidence({
            caseId: caseId,
            evidenceType: evidenceType,
            ipfsHash: ipfsHash,
            submittedAt: block.timestamp,
            submitter: msg.sender
        }));

        emit EvidenceSubmitted(caseId, evidenceType, ipfsHash);
    }

    // ==================== QUERY FUNCTIONS ====================

    /**
     * @notice Get case details
     */
    function getCase(uint256 caseId) 
        external 
        view 
        validCase(caseId) 
        returns (
            address defendant,
            address bailPoster,
            uint256 bailAmount,
            CaseStatus status,
            bool defendantAppeared,
            string memory outcome
        ) 
    {
        BailCase storage bailCase = cases[caseId];
        return (
            bailCase.defendant,
            bailCase.bailPoster,
            bailCase.bailAmount,
            bailCase.status,
            bailCase.defendantAppeared,
            bailCase.caseOutcome
        );
    }

    /**
     * @notice Get all cases for a defendant
     */
    function getDefendantCases(address defendant) external view returns (uint256[] memory) {
        return defendantCases[defendant];
    }

    /**
     * @notice Get all cases posted by a bail DAO
     */
    function getBailPosterCases(address bailPoster) external view returns (uint256[] memory) {
        return bailPosterCases[bailPoster];
    }

    /**
     * @notice Get case evidence
     */
    function getCaseEvidence(uint256 caseId) 
        external 
        view 
        validCase(caseId) 
        returns (BailCaseEvidence[] memory) 
    {
        return caseEvidence[caseId];
    }

    /**
     * @notice Set performance fee (basis points)
     */
    function setPerformanceFee(uint256 feeBPs) external onlyOwner {
        if (feeBPs > 10000) revert InvalidBailAmount();  // Max 100%
        performanceFeeBPs = feeBPs;
    }

    /**
     * @notice Set fee recipient
     */
    function setFeeRecipient(address recipient) external onlyOwner {
        feeRecipient = recipient;
    }
}
