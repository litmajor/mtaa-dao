// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

interface IDAOGovernance {
    function isDAOAdmin(address dao, address account) external view returns (bool);
}

/**
 * @title MicroLoanFacility
 * @notice Micro-lending smart contract for Women's Group DAOs
 * @dev Enables emergency lending with social collateral (2 guarantors)
 * 
 * Use Case:
 *   - Jane's daughter has malaria; needs $200 emergency funds
 *   - Elder council approves 24-hour emergency vote
 *   - Jane borrows $200 at 0% interest
 *   - 2 guarantors (Ruth, Margaret) pledge social collateral
 *   - If Jane defaults, guarantors face reputation hit or cover difference
 *   - Jane repays $33/month over 6 months
 */
contract MicroLoanFacility is Ownable, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    // ==================== TYPES ====================
    enum LoanStatus { PENDING, APPROVED, ACTIVE, REPAYING, COMPLETED, DEFAULTED, CANCELLED }
    enum RepaymentStatus { PENDING, PARTIAL, COMPLETED, OVERDUE, FORGIVEN }

    struct Loan {
        uint256 loanId;
        address borrower;
        address daoAddress;
        uint256 principal;           // Original borrowed amount
        uint256 outstandingBalance;  // Amount still owed
        uint256 interestRate;        // Basis points (e.g., 500 = 5%)
        uint256 interestAccrued;
        LoanStatus status;
        uint256 disbursedAt;
        uint256 maturityDate;
        uint256 frequencyMonths;     // 1 = monthly, 3 = quarterly
        uint256 nextDueDate;
        uint256 totalRepaid;
        address[] guarantors;        // Social collateral (2+ guarantors)
        RepaymentStatus repaymentStatus;
        string loanPurpose;          // "Healthcare", "Education", "Emergency"
    }

    struct LoanPayment {
        uint256 paymentId;
        uint256 loanId;
        uint256 principalPaid;
        uint256 interestPaid;
        uint256 totalPaid;
        uint256 paidAt;
        string note;
    }

    struct Guarantor {
        address guarantorAddress;
        uint256 loanId;
        bool hasCovered;             // True if guarantor covered loan default
        uint256 coverageAmount;
        string commitmentNote;
    }

    // ==================== STATE ====================
    mapping(uint256 loanId => Loan) public loans;
    mapping(uint256 loanId => LoanPayment[]) public paymentHistory;
    mapping(uint256 loanId => Guarantor[]) public guarantors;
    
    mapping(address borrower => uint256[]) public borrowerLoans;
    mapping(address daoAddress => uint256[]) public daoLoans;
    mapping(address guarantor => uint256[]) public guarantorCommitments;

    uint256 public nextLoanId = 1;
    uint256 public nextPaymentId = 1;

    // DAO config per DAO
    mapping(address daoAddress => uint256) public maxLoanAmountPerMember;  // e.g., $5000
    mapping(address daoAddress => uint256) public minGuarantors;            // e.g., 2
    mapping(address daoAddress => uint256) public defaultInterestRate;     // e.g., 500 bp = 5%
    mapping(address daoAddress => IERC20) public daoLoanToken;             // Token used for loans

    // DAO admin tracking (PRODUCTION FIX: replaces "in production" comment)
    mapping(address daoAddress => address) public daoGovernance;            // Governance contract for DAO
    mapping(address daoAddress => mapping(address => bool)) public daoAdmins; // DAO -> admin address -> is admin

    // Emergency buffer for loan defaults
    mapping(address daoAddress => uint256) public emergencyBuffer;

    // ==================== EVENTS ====================
    event LoanCreated(
        uint256 indexed loanId,
        address indexed borrower,
        address indexed dao,
        uint256 principal,
        uint256 maturityDate,
        string purpose
    );

    event LoanApproved(
        uint256 indexed loanId,
        address indexed approver,
        uint256 principal
    );

    event LoanDisbursed(
        uint256 indexed loanId,
        address indexed borrower,
        uint256 amount
    );

    event GuarantorAdded(
        uint256 indexed loanId,
        address indexed guarantor,
        string commitment
    );

    event PaymentMade(
        uint256 indexed loanId,
        uint256 indexed paymentId,
        address indexed borrower,
        uint256 principal,
        uint256 interest,
        uint256 totalPaid
    );

    event LoanCompleted(
        uint256 indexed loanId,
        address indexed borrower,
        uint256 totalRepaid
    );

    event LoanDefaulted(
        uint256 indexed loanId,
        address indexed borrower,
        uint256 amountDue
    );

    event GuarantorCovered(
        uint256 indexed loanId,
        address indexed guarantor,
        uint256 amount
    );

    event DAOConfigured(
        address indexed dao,
        uint256 maxAmount,
        uint256 minGuarantors,
        address token
    );

    event EmergencyBufferFunded(
        address indexed dao,
        uint256 amount
    );

    // ==================== ERRORS ====================
    error LoanNotFound();
    error UnauthorizedBorrower();
    error InvalidLoanAmount();
    error InsufficientFunds();
    error LoanNotApproved();
    error InvalidGuarantor();
    error NotEnoughGuarantors();
    error LoanAlreadyActive();
    error PaymentFailed();
    error InvalidRepaymentAmount();
    error LoanNotActive();
    error OnlyBorrowerOrGuarantor();

    // ==================== MODIFIERS ====================
    modifier validLoan(uint256 loanId) {
        if (loanId >= nextLoanId) revert LoanNotFound();
        _;
    }

    modifier onlyBorrower(uint256 loanId) {
        if (msg.sender != loans[loanId].borrower) revert UnauthorizedBorrower();
        _;
    }

    modifier onlyDAOAdmin(address daoAddress) {
        // PRODUCTION FIX: Verify caller is DAO admin via governance contract or direct mapping
        bool isAdmin = daoAdmins[daoAddress][msg.sender];  // Direct mapping check
        
        // Also check through governance contract if registered
        if (!isAdmin && daoGovernance[daoAddress] != address(0)) {
            isAdmin = IDAOGovernance(daoGovernance[daoAddress]).isDAOAdmin(daoAddress, msg.sender);
        }
        
        // Fallback: contract owner is always admin
        if (!isAdmin && msg.sender != owner()) revert OnlyBorrowerOrGuarantor();
        _;
    }

    // ==================== DAO CONFIGURATION ====================

    /**
     * @notice Configure lending parameters for a DAO
     */
    function configureDAO(
        address daoAddress,
        uint256 maxLoanAmount,
        uint256 minGuarantorsRequired,
        IERC20 loanToken
    ) external onlyOwner {
        if (maxLoanAmount == 0) revert InvalidLoanAmount();

        maxLoanAmountPerMember[daoAddress] = maxLoanAmount;
        minGuarantors[daoAddress] = minGuarantorsRequired;
        defaultInterestRate[daoAddress] = 500;  // 5% default
        daoLoanToken[daoAddress] = loanToken;

        emit DAOConfigured(daoAddress, maxLoanAmount, minGuarantorsRequired, address(loanToken));
    }

    /**
     * @notice Register a DAO governance contract for admin verification (PRODUCTION FIX)
     * @dev Allows DAOs to use their own governance for admin checks
     */
    function registerDAOGovernance(address daoAddress, address governanceContract) external onlyDAOAdmin(daoAddress) {
        daoGovernance[daoAddress] = governanceContract;
    }

    /**
     * @notice Directly register a DAO admin (PRODUCTION FIX)
     * @dev Allows adding admins before full governance is set up
     */
    function registerDAOAdmin(address daoAddress, address admin) external onlyDAOAdmin(daoAddress) {
        daoAdmins[daoAddress][admin] = true;
    }

    /**
     * @notice Remove a DAO admin
     */
    function removeDAOAdmin(address daoAddress, address admin) external onlyDAOAdmin(daoAddress) {
        daoAdmins[daoAddress][admin] = false;
    }

    /**
     * @notice Deposit emergency buffer funds for loan defaults
     */
    function fundEmergencyBuffer(address daoAddress, uint256 amount) external {
        IERC20 token = daoLoanToken[daoAddress];
        token.safeTransferFrom(msg.sender, address(this), amount);
        emergencyBuffer[daoAddress] += amount;

        emit EmergencyBufferFunded(daoAddress, amount);
    }

    // ==================== LOAN ORIGINATION ====================

    /**
     * @notice Create a new loan request
     * @param daoAddress DAO address
     * @param principal Amount to borrow
     * @param maturityMonths Loan term in months
     * @param loanPurpose Purpose (healthcare, education, emergency)
     */
    function requestLoan(
        address daoAddress,
        uint256 principal,
        uint256 maturityMonths,
        string memory loanPurpose
    ) external returns (uint256) {
        if (principal == 0 || principal > maxLoanAmountPerMember[daoAddress]) {
            revert InvalidLoanAmount();
        }
        if (maturityMonths == 0 || maturityMonths > 36) {
            revert InvalidLoanAmount();
        }

        uint256 loanId = nextLoanId++;
        uint256 maturityDate = block.timestamp + (maturityMonths * 30 days);

        loans[loanId] = Loan({
            loanId: loanId,
            borrower: msg.sender,
            daoAddress: daoAddress,
            principal: principal,
            outstandingBalance: principal,
            interestRate: defaultInterestRate[daoAddress],
            interestAccrued: 0,
            status: LoanStatus.PENDING,
            disbursedAt: 0,
            maturityDate: maturityDate,
            frequencyMonths: 1,  // Monthly repayment
            nextDueDate: 0,
            totalRepaid: 0,
            guarantors: new address[](0),
            repaymentStatus: RepaymentStatus.PENDING,
            loanPurpose: loanPurpose
        });

        borrowerLoans[msg.sender].push(loanId);
        daoLoans[daoAddress].push(loanId);

        emit LoanCreated(loanId, msg.sender, daoAddress, principal, maturityDate, loanPurpose);
        return loanId;
    }

    /**
     * @notice Add guarantor to loan (social collateral)
     * @param loanId Loan ID
     * @param guarantorAddress Address of guarantor
     * @param commitment Description of commitment
     */
    function addGuarantor(
        uint256 loanId,
        address guarantorAddress,
        string memory commitment
    ) external validLoan(loanId) onlyBorrower(loanId) {
        Loan storage loan = loans[loanId];

        if (guarantorAddress == msg.sender) revert InvalidGuarantor();
        if (loan.status != LoanStatus.PENDING) revert LoanNotApproved();

        // Check for duplicate
        for (uint256 i = 0; i < loan.guarantors.length; i++) {
            if (loan.guarantors[i] == guarantorAddress) revert InvalidGuarantor();
        }

        loan.guarantors.push(guarantorAddress);
        guarantors[loanId].push(Guarantor({
            guarantorAddress: guarantorAddress,
            loanId: loanId,
            hasCovered: false,
            coverageAmount: 0,
            commitmentNote: commitment
        }));

        guarantorCommitments[guarantorAddress].push(loanId);

        emit GuarantorAdded(loanId, guarantorAddress, commitment);
    }

    /**
     * @notice DAO admin approves the loan (after guarantors secured)
     */
    function approveLoan(uint256 loanId) external onlyDAOAdmin(loans[loanId].daoAddress) validLoan(loanId) {
        Loan storage loan = loans[loanId];

        if (loan.status != LoanStatus.PENDING) revert LoanAlreadyActive();
        if (loan.guarantors.length < minGuarantors[loan.daoAddress]) {
            revert NotEnoughGuarantors();
        }

        loan.status = LoanStatus.APPROVED;
        emit LoanApproved(loanId, msg.sender, loan.principal);
    }

    /**
     * @notice Disburse funds to borrower
     */
    function disburseLoan(uint256 loanId) external onlyDAOAdmin(loans[loanId].daoAddress) validLoan(loanId) nonReentrant {
        Loan storage loan = loans[loanId];

        if (loan.status != LoanStatus.APPROVED) revert LoanNotApproved();

        IERC20 token = daoLoanToken[loan.daoAddress];
        if (token.balanceOf(address(this)) < loan.principal) {
            revert InsufficientFunds();
        }

        loan.status = LoanStatus.ACTIVE;
        loan.disbursedAt = block.timestamp;
        loan.nextDueDate = block.timestamp + (loan.frequencyMonths * 30 days);

        token.safeTransfer(loan.borrower, loan.principal);

        emit LoanDisbursed(loanId, loan.borrower, loan.principal);
    }

    // ==================== REPAYMENT ====================

    /**
     * @notice Make loan repayment
     * @param loanId Loan ID
     * @param amount Amount to repay
     */
    function makePayment(uint256 loanId, uint256 amount) external validLoan(loanId) onlyBorrower(loanId) nonReentrant {
        Loan storage loan = loans[loanId];

        if (loan.status != LoanStatus.ACTIVE) revert LoanNotActive();
        if (amount > loan.outstandingBalance) revert InvalidRepaymentAmount();
        if (amount == 0) revert InvalidRepaymentAmount();

        // Calculate interest accrual (simple interest per month)
        uint256 monthsElapsed = (block.timestamp - loan.disbursedAt) / (30 days);
        uint256 monthlyInterest = (loan.principal * loan.interestRate) / 10000 / 12;
        uint256 totalMonthlyInterest = monthlyInterest * monthsElapsed;
        loan.interestAccrued = totalMonthlyInterest;

        // Split payment between principal and interest
        uint256 interestToPay = loan.interestAccrued > amount ? amount : loan.interestAccrued;
        uint256 principalToPay = amount - interestToPay;

        IERC20 token = daoLoanToken[loan.daoAddress];
        token.safeTransferFrom(msg.sender, address(this), amount);

        loan.outstandingBalance -= principalToPay;
        loan.interestAccrued -= interestToPay;
        loan.totalRepaid += amount;

        // Update next due date
        if (loan.outstandingBalance == 0) {
            loan.status = LoanStatus.COMPLETED;
            loan.repaymentStatus = RepaymentStatus.COMPLETED;
            emit LoanCompleted(loanId, loan.borrower, loan.totalRepaid);
        }

        uint256 paymentId = nextPaymentId++;
        paymentHistory[loanId].push(LoanPayment({
            paymentId: paymentId,
            loanId: loanId,
            principalPaid: principalToPay,
            interestPaid: interestToPay,
            totalPaid: amount,
            paidAt: block.timestamp,
            note: ""
        }));

        emit PaymentMade(loanId, paymentId, msg.sender, principalToPay, interestToPay, amount);
    }

    /**
     * @notice Mark loan as defaulted if overdue
     */
    function markLoanDefaulted(uint256 loanId) external onlyDAOAdmin(loans[loanId].daoAddress) validLoan(loanId) {
        Loan storage loan = loans[loanId];

        if (loan.status != LoanStatus.ACTIVE) revert LoanNotActive();
        if (block.timestamp < loan.maturityDate) revert InvalidRepaymentAmount();

        loan.status = LoanStatus.DEFAULTED;
        loan.repaymentStatus = RepaymentStatus.OVERDUE;

        emit LoanDefaulted(loanId, loan.borrower, loan.outstandingBalance);
    }

    /**
     * @notice Guarantor covers loan default
     */
    function coverLoanDefault(uint256 loanId) external validLoan(loanId) nonReentrant {
        Loan storage loan = loans[loanId];

        // Verify caller is a guarantor
        bool isGuarantor = false;
        for (uint256 i = 0; i < loan.guarantors.length; i++) {
            if (loan.guarantors[i] == msg.sender) {
                isGuarantor = true;
                break;
            }
        }
        if (!isGuarantor) revert OnlyBorrowerOrGuarantor();

        if (loan.status != LoanStatus.DEFAULTED) revert LoanNotActive();

        uint256 amountToCover = loan.outstandingBalance;
        IERC20 token = daoLoanToken[loan.daoAddress];

        token.safeTransferFrom(msg.sender, address(this), amountToCover);

        loan.outstandingBalance = 0;
        loan.status = LoanStatus.COMPLETED;

        // Track that this guarantor covered the default
        for (uint256 i = 0; i < guarantors[loanId].length; i++) {
            if (guarantors[loanId][i].guarantorAddress == msg.sender) {
                guarantors[loanId][i].hasCovered = true;
                guarantors[loanId][i].coverageAmount = amountToCover;
            }
        }

        emit GuarantorCovered(loanId, msg.sender, amountToCover);
        emit LoanCompleted(loanId, loan.borrower, loan.totalRepaid + amountToCover);
    }

    // ==================== QUERIES ====================

    /**
     * @notice Get loan details
     */
    function getLoan(uint256 loanId) external view validLoan(loanId) returns (Loan memory) {
        return loans[loanId];
    }

    /**
     * @notice Get payment history for a loan
     */
    function getPaymentHistory(uint256 loanId) external view returns (LoanPayment[] memory) {
        return paymentHistory[loanId];
    }

    /**
     * @notice Get guarantors for a loan
     */
    function getGuarantors(uint256 loanId) external view returns (address[] memory) {
        return loans[loanId].guarantors;
    }

    /**
     * @notice Get all loans for a borrower
     */
    function getBorrowerLoans(address borrower) external view returns (uint256[] memory) {
        return borrowerLoans[borrower];
    }

    /**
     * @notice Get all loans for a DAO
     */
    function getDAOLoans(address daoAddress) external view returns (uint256[] memory) {
        return daoLoans[daoAddress];
    }

    /**
     * @notice Calculate monthly payment amount
     */
    function calculateMonthlyPayment(uint256 loanId) external view validLoan(loanId) returns (uint256) {
        Loan storage loan = loans[loanId];
        uint256 monthlyPrincipal = loan.principal / ((loan.maturityDate - loan.disbursedAt) / (30 days));
        uint256 monthlyInterest = (loan.principal * loan.interestRate) / 10000 / 12;
        return monthlyPrincipal + monthlyInterest;
    }
}
