// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";

/**
 * @title LoanFacility
 * @dev Emergency lending for Women's Group DAO with 2-guarantor social collateral
 * @notice Loans can be forgiven (escape clauses) for medical/hardship situations
 */
contract LoanFacility is ReentrancyGuard, Ownable, Pausable {
    
    enum LoanStatus { PENDING_REVIEW, APPROVED, ACTIVE, REPAID, FORGIVEN, DEFAULTED }
    
    struct EmergencyLoan {
        uint256 loanId;
        address borrower;
        string purpose;                 // "Medical", "Housing", "Food", etc
        uint256 principal;
        uint256 interestRate;           // 0-5% (basis points)
        uint256 gracePeriodDays;        // 30-90 days before first payment
        uint256 maturityDate;
        LoanStatus status;
        address guarantor1;
        address guarantor2;             // Two community members vouch
        string escapeClause;            // Conditions for forgiveness
        bool escapeClauseVerified;
        uint256 totalRepaid;
        uint256 createdAt;
    }
    
    struct LoanRepayment {
        uint256 repaymentId;
        uint256 loanId;
        uint256 amount;
        uint256 timestamp;
        bool isLate;
    }
    
    // State variables
    IERC20 public stablecoin;           // USDC or similar
    address public elderCouncil;        // Authority to approve/forgive loans
    
    uint256 public nextLoanId = 1;
    uint256 public nextRepaymentId = 1;
    uint256 public totalLoansIssued;
    uint256 public totalOutstandingDebt;
    uint256 public escapeClauseForgiven;
    
    mapping(uint256 => EmergencyLoan) public loans;
    mapping(uint256 => LoanRepayment[]) public repaymentHistory;
    mapping(address => uint256[]) public memberLoans;
    mapping(address => uint256) public memberOutstandingDebt;
    
    // Events
    event LoanRequested(
        uint256 indexed loanId,
        address indexed borrower,
        uint256 amount,
        string purpose,
        address guarantor1,
        address guarantor2
    );
    event LoanApproved(uint256 indexed loanId, address indexed approvedBy);
    event LoanActivated(uint256 indexed loanId, uint256 maturityDate);
    event PaymentReceived(uint256 indexed loanId, address indexed payer, uint256 amount, bool isLate);
    event LoanRepaid(uint256 indexed loanId, address indexed borrower);
    event LoanForgiven(uint256 indexed loanId, address indexed forgivenBy, string reason);
    event LoanDefaulted(uint256 indexed loanId, address indexed defaulter);
    event EscapeClauseVerified(uint256 indexed loanId, bool verified);
    
    // Modifiers
    modifier onlyElders() {
        require(msg.sender == elderCouncil || msg.sender == owner(), "Only elders can call");
        _;
    }
    
    modifier loanExists(uint256 loanId) {
        require(loans[loanId].loanId != 0, "Loan does not exist");
        _;
    }
    
    // Constructor
    constructor(address _stablecoin, address _elderCouncil) {
        stablecoin = IERC20(_stablecoin);
        elderCouncil = _elderCouncil;
    }
    
    /**
     * @dev Request emergency loan with 2 guarantors
     */
    function requestLoan(
        uint256 amount,
        string memory purpose,
        address guarantor1,
        address guarantor2,
        string memory escapeClause
    ) external returns (uint256) {
        require(amount > 0, "Amount must be > 0");
        require(guarantor1 != address(0) && guarantor2 != address(0), "Invalid guarantors");
        require(guarantor1 != guarantor2, "Guarantors must be different");
        require(guarantor1 != msg.sender && guarantor2 != msg.sender, "Cannot be own guarantor");
        require(bytes(purpose).length > 0, "Purpose required");
        
        uint256 loanId = nextLoanId++;
        
        EmergencyLoan storage loan = loans[loanId];
        loan.loanId = loanId;
        loan.borrower = msg.sender;
        loan.purpose = purpose;
        loan.principal = amount;
        loan.interestRate = 5; // 0.05% (5 basis points)
        loan.gracePeriodDays = 30;
        loan.status = LoanStatus.PENDING_REVIEW;
        loan.guarantor1 = guarantor1;
        loan.guarantor2 = guarantor2;
        loan.escapeClause = escapeClause;
        loan.createdAt = block.timestamp;
        
        memberLoans[msg.sender].push(loanId);
        
        emit LoanRequested(loanId, msg.sender, amount, purpose, guarantor1, guarantor2);
        
        return loanId;
    }
    
    /**
     * @dev Approve loan (elder council only)
     */
    function approveLoan(uint256 loanId) external onlyElders loanExists(loanId) {
        EmergencyLoan storage loan = loans[loanId];
        require(loan.status == LoanStatus.PENDING_REVIEW, "Loan not pending review");
        
        loan.status = LoanStatus.APPROVED;
        
        emit LoanApproved(loanId, msg.sender);
    }
    
    /**
     * @dev Activate approved loan (transfer funds to borrower)
     */
    function activateLoan(uint256 loanId) external onlyElders nonReentrant loanExists(loanId) {
        EmergencyLoan storage loan = loans[loanId];
        require(loan.status == LoanStatus.APPROVED, "Loan not approved");
        
        // Transfer funds from contract to borrower
        require(
            stablecoin.transfer(loan.borrower, loan.principal),
            "Transfer failed"
        );
        
        // Set maturity date (2 years from now)
        loan.maturityDate = block.timestamp + (365.25 days * 2);
        loan.status = LoanStatus.ACTIVE;
        
        totalLoansIssued++;
        totalOutstandingDebt += loan.principal;
        memberOutstandingDebt[loan.borrower] += loan.principal;
        
        emit LoanActivated(loanId, loan.maturityDate);
    }
    
    /**
     * @dev Make loan payment (can be called by borrower, guarantor, or anyone)
     */
    function repayLoan(uint256 loanId, uint256 amount) external nonReentrant loanExists(loanId) {
        EmergencyLoan storage loan = loans[loanId];
        require(loan.status == LoanStatus.ACTIVE, "Loan not active");
        require(amount > 0, "Amount must be > 0");
        
        uint256 outstanding = loan.principal + 
            (loan.principal * loan.interestRate / 10000 / 365) * 
            ((block.timestamp - loan.createdAt) / 1 days) - 
            loan.totalRepaid;
        
        require(amount <= outstanding, "Amount exceeds outstanding debt");
        
        // Transfer from payer to contract
        require(
            stablecoin.transferFrom(msg.sender, address(this), amount),
            "Transfer failed"
        );
        
        bool isLate = block.timestamp > (loan.createdAt + loan.gracePeriodDays * 1 days);
        
        LoanRepayment memory repayment = LoanRepayment({
            repaymentId: nextRepaymentId++,
            loanId: loanId,
            amount: amount,
            timestamp: block.timestamp,
            isLate: isLate
        });
        
        repaymentHistory[loanId].push(repayment);
        loan.totalRepaid += amount;
        totalOutstandingDebt -= amount;
        memberOutstandingDebt[loan.borrower] -= amount;
        
        // Check if fully repaid
        if (loan.totalRepaid >= outstanding) {
            loan.status = LoanStatus.REPAID;
            emit LoanRepaid(loanId, loan.borrower);
        }
        
        emit PaymentReceived(loanId, msg.sender, amount, isLate);
    }
    
    /**
     * @dev Verify and activate escape clause (hardship forgiveness)
     */
    function verifyEscapeClause(uint256 loanId, bool verified) external onlyElders loanExists(loanId) {
        EmergencyLoan storage loan = loans[loanId];
        require(loan.status == LoanStatus.ACTIVE, "Loan not active");
        
        loan.escapeClauseVerified = verified;
        
        emit EscapeClauseVerified(loanId, verified);
    }
    
    /**
     * @dev Forgive loan (elder council - medical emergency, widow, etc)
     */
    function forgiveLoan(uint256 loanId, string memory reason) external onlyElders nonReentrant loanExists(loanId) {
        EmergencyLoan storage loan = loans[loanId];
        require(
            loan.status == LoanStatus.ACTIVE || loan.status == LoanStatus.PENDING_REVIEW,
            "Cannot forgive loan in this state"
        );
        require(loan.escapeClauseVerified, "Escape clause not verified");
        
        uint256 remaining = loan.principal - loan.totalRepaid;
        
        loan.status = LoanStatus.FORGIVEN;
        totalOutstandingDebt -= remaining;
        memberOutstandingDebt[loan.borrower] -= remaining;
        escapeClauseForgiven += remaining;
        
        emit LoanForgiven(loanId, msg.sender, reason);
    }
    
    /**
     * @dev Record default (after maturity date passed with no payment)
     */
    function recordDefault(uint256 loanId) external onlyElders loanExists(loanId) {
        EmergencyLoan storage loan = loans[loanId];
        require(loan.status == LoanStatus.ACTIVE, "Loan not active");
        require(block.timestamp > loan.maturityDate, "Loan not yet matured");
        
        loan.status = LoanStatus.DEFAULTED;
        
        uint256 remaining = loan.principal - loan.totalRepaid;
        totalOutstandingDebt -= remaining;
        memberOutstandingDebt[loan.borrower] -= remaining;
        
        emit LoanDefaulted(loanId, loan.borrower);
    }
    
    /**
     * @dev Get loan details
     */
    function getLoan(uint256 loanId) external view loanExists(loanId) returns (EmergencyLoan memory) {
        return loans[loanId];
    }
    
    /**
     * @dev Get member's loans
     */
    function getMemberLoans(address member) external view returns (uint256[] memory) {
        return memberLoans[member];
    }
    
    /**
     * @dev Get loan's repayment history
     */
    function getRepaymentHistory(uint256 loanId) external view returns (LoanRepayment[] memory) {
        return repaymentHistory[loanId];
    }
    
    /**
     * @dev Get outstanding balance for loan
     */
    function getOutstandingBalance(uint256 loanId) external view loanExists(loanId) returns (uint256) {
        EmergencyLoan storage loan = loans[loanId];
        if (loan.status != LoanStatus.ACTIVE) return 0;
        
        uint256 accrued = (loan.principal * loan.interestRate / 10000 / 365) * 
            ((block.timestamp - loan.createdAt) / 1 days);
        uint256 total = loan.principal + accrued;
        
        return total > loan.totalRepaid ? total - loan.totalRepaid : 0;
    }
    
    /**
     * @dev Emergency withdraw (only after 30 days of inactivity)
     */
    function emergencyWithdraw(uint256 amount) external onlyOwner {
        require(stablecoin.transfer(owner(), amount), "Transfer failed");
    }
}
