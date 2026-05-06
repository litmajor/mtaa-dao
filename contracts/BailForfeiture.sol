// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";

/**
 * @title BailForfeiture
 * @dev Handle forfeited bail when defendant doesn't appear in court
 * @notice Tracks writeoffs and partial recoveries
 */
contract BailForfeiture is Ownable, Pausable {
    
    enum ForfeitureStatus { PENDING_CLAIM, WRITEOFF_EXECUTED, PARTIAL_RECOVERY, FULL_RECOVERY }
    
    struct ForfeitureCase {
        uint256 caseId;
        address defendant;
        uint256 bailAmount;
        uint256 forfeitureDate;
        ForfeitureStatus status;
        uint256 writeoffAmount;     // Amount written off
        uint256 recoveredAmount;    // Amount recovered so far
        string courtOrderHash;      // IPFS hash of court order
        string caseNumber;
        uint256 createdAt;
    }
    
    struct Recovery {
        uint256 recoveryId;
        uint256 caseId;
        uint256 amount;
        string recoveryReason;      // "Apprehended", "Appeal granted", etc
        uint256 timestamp;
    }
    
    // State
    address public oracle;                  // Oracle provides court outcomes
    address public treasury;                // Treasury receives forfeited funds
    
    uint256 public nextCaseId = 1;
    uint256 public nextRecoveryId = 1;
    uint256 public totalForfeitedAmount;
    uint256 public totalWrittenOff;
    uint256 public totalRecovered;
    
    mapping(uint256 => ForfeitureCase) public cases;
    mapping(uint256 => Recovery[]) public recoveryHistory;
    mapping(address => uint256[]) public defendantCases;
    
    // Events
    event ForfeitureRecorded(
        uint256 indexed caseId,
        address indexed defendant,
        uint256 bailAmount,
        string caseNumber
    );
    event WriteoffExecuted(uint256 indexed caseId, uint256 writeoffAmount);
    event RecoveryRecorded(uint256 indexed caseId, uint256 recoveredAmount, string reason);
    event FullRecovery(uint256 indexed caseId);
    event TreasuryReceived(uint256 totalAmount);
    
    // Modifiers
    modifier onlyOracle() {
        require(msg.sender == oracle, "Only oracle can call");
        _;
    }
    
    modifier caseExists(uint256 caseId) {
        require(cases[caseId].caseId != 0, "Case does not exist");
        _;
    }
    
    // Constructor
    constructor(address _oracle, address _treasury) {
        oracle = _oracle;
        treasury = _treasury;
    }
    
    /**
     * @dev Record forfeiture when defendant fails to appear
     */
    function recordForfeiture(
        address defendant,
        uint256 bailAmount,
        string memory caseNumber,
        string memory courtOrderHash
    ) external onlyOracle returns (uint256) {
        require(defendant != address(0), "Invalid defendant");
        require(bailAmount > 0, "Bail amount must be > 0");
        
        uint256 caseId = nextCaseId++;
        
        ForfeitureCase storage forfeiture = cases[caseId];
        forfeiture.caseId = caseId;
        forfeiture.defendant = defendant;
        forfeiture.bailAmount = bailAmount;
        forfeiture.forfeitureDate = block.timestamp;
        forfeiture.status = ForfeitureStatus.PENDING_CLAIM;
        forfeiture.caseNumber = caseNumber;
        forfeiture.courtOrderHash = courtOrderHash;
        forfeiture.createdAt = block.timestamp;
        
        defendantCases[defendant].push(caseId);
        totalForfeitedAmount += bailAmount;
        
        emit ForfeitureRecorded(caseId, defendant, bailAmount, caseNumber);
        
        return caseId;
    }
    
    /**
     * @dev Execute writeoff (remove from bail fund reserves)
     */
    function processWriteoff(uint256 caseId, uint256 amount) external onlyOwner caseExists(caseId) {
        ForfeitureCase storage forfeiture = cases[caseId];
        require(forfeiture.status == ForfeitureStatus.PENDING_CLAIM, "Already processed");
        require(amount <= forfeiture.bailAmount, "Writeoff exceeds bail amount");
        require(amount > 0, "Amount must be > 0");
        
        forfeiture.writeoffAmount = amount;
        forfeiture.status = ForfeitureStatus.WRITEOFF_EXECUTED;
        totalWrittenOff += amount;
        
        emit WriteoffExecuted(caseId, amount);
    }
    
    /**
     * @dev Record recovery (defendant apprehended, appeal granted, etc)
     */
    function recordRecovery(
        uint256 caseId,
        uint256 recoveredAmount,
        string memory recoveryReason
    ) external onlyOracle caseExists(caseId) {
        ForfeitureCase storage forfeiture = cases[caseId];
        require(forfeiture.status != ForfeitureStatus.FULL_RECOVERY, "Already fully recovered");
        require(recoveredAmount > 0, "Recovery amount must be > 0");
        require(
            forfeiture.recoveredAmount + recoveredAmount <= forfeiture.bailAmount,
            "Recovery exceeds bail amount"
        );
        
        Recovery memory recovery = Recovery({
            recoveryId: nextRecoveryId++,
            caseId: caseId,
            amount: recoveredAmount,
            recoveryReason: recoveryReason,
            timestamp: block.timestamp
        });
        
        recoveryHistory[caseId].push(recovery);
        forfeiture.recoveredAmount += recoveredAmount;
        totalRecovered += recoveredAmount;
        
        // Update writeoff if outstanding
        if (forfeiture.writeoffAmount > 0) {
            forfeiture.writeoffAmount = forfeiture.bailAmount > forfeiture.recoveredAmount
                ? forfeiture.bailAmount - forfeiture.recoveredAmount
                : 0;
        }
        
        // Check if fully recovered
        if (forfeiture.recoveredAmount >= forfeiture.bailAmount) {
            forfeiture.status = ForfeitureStatus.FULL_RECOVERY;
            emit FullRecovery(caseId);
        } else if (forfeiture.status == ForfeitureStatus.PENDING_CLAIM) {
            forfeiture.status = ForfeitureStatus.PARTIAL_RECOVERY;
        }
        
        emit RecoveryRecorded(caseId, recoveredAmount, recoveryReason);
    }
    
    /**
     * @dev Get forfeiture case details
     */
    function getForfeiture(uint256 caseId) external view caseExists(caseId) returns (ForfeitureCase memory) {
        return cases[caseId];
    }
    
    /**
     * @dev Get defendant's cases
     */
    function getDefendantCases(address defendant) external view returns (uint256[] memory) {
        return defendantCases[defendant];
    }
    
    /**
     * @dev Get recovery history for case
     */
    function getRecoveryHistory(uint256 caseId) external view returns (Recovery[] memory) {
        return recoveryHistory[caseId];
    }
    
    /**
     * @dev Get outstanding writeoff amount for case
     */
    function getOutstandingWriteoff(uint256 caseId) external view caseExists(caseId) returns (uint256) {
        ForfeitureCase storage forfeiture = cases[caseId];
        return forfeiture.bailAmount > forfeiture.recoveredAmount
            ? forfeiture.bailAmount - forfeiture.recoveredAmount
            : 0;
    }
    
    /**
     * @dev Get bail fund statistics
     */
    function getStatistics() external view returns (
        uint256 totalForfeited,
        uint256 totalWritten,
        uint256 totalRecov,
        uint256 netImpact
    ) {
        totalForfeited = totalForfeitedAmount;
        totalWritten = totalWrittenOff;
        totalRecov = totalRecovered;
        netImpact = totalWrittenOff - totalRecovered;
    }
    
    /**
     * @dev Update oracle address
     */
    function setOracle(address _oracle) external onlyOwner {
        require(_oracle != address(0), "Invalid oracle");
        oracle = _oracle;
    }
    
    /**
     * @dev Update treasury address
     */
    function setTreasury(address _treasury) external onlyOwner {
        require(_treasury != address(0), "Invalid treasury");
        treasury = _treasury;
    }
}
