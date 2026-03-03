// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/Pausable.sol";

/**
 * @title MultiSigTreasury
 * @notice 2-of-3 multisig vault for DAO treasury with whitelisted recipients and timelocks
 * @dev Addresses CRITICAL security issues from Phase 2 (unilateral access + no audit trail)
 */
contract MultiSigTreasury is ReentrancyGuard, AccessControl, Pausable {
    
    // ==== CONFIGURATION ====
    bytes32 public constant SIGNER_ROLE = keccak256("SIGNER_ROLE");
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    
    uint256 public constant REQUIRED_APPROVALS = 2;
    uint256 public constant TIMELOCK_DELAY = 48 hours;
    uint256 public constant MAX_TRANSFER_PERCENTAGE = 5; // 5% per transaction
    
    address public treasuryAddress;
    uint256 public treasuryBalance;
    uint256 public dailySpentAmount;
    uint256 public dailySpentReset;
    
    // ==== STATE ====
    enum TransactionState { Pending, Approved, Executed, Rejected, Cancelled }
    
    struct Transaction {
        uint256 id;
        address to;
        uint256 amount;
        address token;
        string description;
        uint256 createdAt;
        uint256 approvedAt;
        uint256 executedAt;
        TransactionState state;
        uint256 approvalCount;
        address proposedBy;
    }
    
    struct Whitelist {
        address recipient;
        string category;
        bool isActive;
        uint256 createdAt;
    }
    
    // ==== STORAGE ====
    mapping(uint256 => Transaction) public transactions;
    mapping(uint256 => mapping(address => bool)) public transactionApprovals;
    mapping(address => Whitelist) public whitelistedRecipients;
    mapping(uint256 => address[]) public transactionApprovers;
    
    uint256 public nextTransactionId = 1;
    address[] public signers;
    
    // ==== EVENTS ====
    event TransactionProposed(
        uint256 indexed transactionId,
        address indexed proposedBy,
        address indexed to,
        uint256 amount,
        address token,
        string description
    );
    
    event TransactionApproved(
        uint256 indexed transactionId,
        address indexed approver,
        uint256 approvalCount
    );
    
    event TransactionExecuted(
        uint256 indexed transactionId,
        address indexed executor,
        address indexed to,
        uint256 amount,
        address token
    );
    
    event TransactionRejected(
        uint256 indexed transactionId,
        address indexed rejectedBy,
        string reason
    );
    
    event RecipientWhitelisted(
        address indexed recipient,
        string category,
        uint256 timestamp
    );
    
    event RecipientRemovedFromWhitelist(
        address indexed recipient,
        uint256 timestamp
    );
    
    event TreasuryBalanceUpdated(
        uint256 newBalance,
        uint256 timestamp
    );
    
    // ==== CONSTRUCTOR ====
    constructor(address[] memory initialSigners, address _treasuryAddress) {
        require(initialSigners.length >= 3, "Minimum 3 signers required");
        require(_treasuryAddress != address(0), "Invalid treasury address");
        
        treasuryAddress = _treasuryAddress;
        signers = initialSigners;
        dailySpentReset = block.timestamp;
        
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);
        
        for (uint256 i = 0; i < initialSigners.length; i++) {
            _grantRole(SIGNER_ROLE, initialSigners[i]);
        }
    }
    
    // ==== RECIPIENT WHITELIST ====
    function addWhitelistRecipient(
        address recipient,
        string memory category
    ) external onlyRole(ADMIN_ROLE) {
        require(recipient != address(0), "Invalid recipient address");
        require(bytes(category).length > 0, "Category required");
        
        whitelistedRecipients[recipient] = Whitelist({
            recipient: recipient,
            category: category,
            isActive: true,
            createdAt: block.timestamp
        });
        
        emit RecipientWhitelisted(recipient, category, block.timestamp);
    }
    
    function removeWhitelistRecipient(address recipient) external onlyRole(ADMIN_ROLE) {
        require(whitelistedRecipients[recipient].isActive, "Recipient not whitelisted");
        whitelistedRecipients[recipient].isActive = false;
        emit RecipientRemovedFromWhitelist(recipient, block.timestamp);
    }
    
    function isRecipientWhitelisted(address recipient) public view returns (bool) {
        return whitelistedRecipients[recipient].isActive;
    }
    
    // ==== TRANSACTION PROPOSAL ====
    function proposeTransaction(
        address to,
        uint256 amount,
        address token,
        string memory description
    ) external onlyRole(SIGNER_ROLE) returns (uint256) {
        require(to != address(0), "Invalid recipient");
        require(amount > 0, "Amount must be positive");
        require(isRecipientWhitelisted(to), "Recipient not whitelisted");
        require(bytes(description).length > 0, "Description required");
        
        // Validate amount limits
        _validateAmountLimits(amount);
        
        uint256 txId = nextTransactionId++;
        Transaction storage tx = transactions[txId];
        
        tx.id = txId;
        tx.to = to;
        tx.amount = amount;
        tx.token = token;
        tx.description = description;
        tx.createdAt = block.timestamp;
        tx.state = TransactionState.Pending;
        tx.approvalCount = 0;
        tx.proposedBy = msg.sender;
        
        emit TransactionProposed(txId, msg.sender, to, amount, token, description);
        return txId;
    }
    
    // ==== APPROVAL & EXECUTION ====
    function approveTransaction(uint256 transactionId) 
        external 
        onlyRole(SIGNER_ROLE) 
        returns (bool) 
    {
        Transaction storage tx = transactions[transactionId];
        
        require(tx.id != 0, "Transaction does not exist");
        require(tx.state == TransactionState.Pending, "Transaction not pending");
        require(!transactionApprovals[transactionId][msg.sender], "Already approved");
        require(block.timestamp >= tx.createdAt + TIMELOCK_DELAY, "Timelock not elapsed");
        
        transactionApprovals[transactionId][msg.sender] = true;
        tx.approvalCount++;
        transactionApprovers[transactionId].push(msg.sender);
        
        emit TransactionApproved(transactionId, msg.sender, tx.approvalCount);
        
        if (tx.approvalCount >= REQUIRED_APPROVALS) {
            tx.state = TransactionState.Approved;
            tx.approvedAt = block.timestamp;
            return true;
        }
        
        return false;
    }
    
    function executeTransaction(uint256 transactionId) 
        external 
        onlyRole(SIGNER_ROLE) 
        nonReentrant 
        whenNotPaused 
        returns (bool) 
    {
        Transaction storage tx = transactions[transactionId];
        
        require(tx.state == TransactionState.Approved, "Transaction not approved");
        require(tx.approvalCount >= REQUIRED_APPROVALS, "Insufficient approvals");
        
        tx.state = TransactionState.Executed;
        tx.executedAt = block.timestamp;
        
        // Execute transfer
        _executeTransfer(tx.to, tx.amount, tx.token);
        
        emit TransactionExecuted(transactionId, msg.sender, tx.to, tx.amount, tx.token);
        return true;
    }
    
    // ==== INTERNAL HELPERS ====
    function _validateAmountLimits(uint256 amount) internal {
        uint256 maxAmount = (treasuryBalance * MAX_TRANSFER_PERCENTAGE) / 100;
        require(amount <= maxAmount, "Amount exceeds single transaction limit");
        
        // Reset daily limit if day has passed
        if (block.timestamp > dailySpentReset + 1 days) {
            dailySpentAmount = 0;
            dailySpentReset = block.timestamp;
        }
        
        // Check daily limit (5% of treasury per day)
        uint256 dailyLimit = (treasuryBalance * 5) / 100;
        require(dailySpentAmount + amount <= dailyLimit, "Daily spending limit exceeded");
    }
    
    function _executeTransfer(
        address to,
        uint256 amount,
        address token
    ) internal {
        require(to != address(0), "Invalid recipient");
        
        if (token == address(0)) {
            // Native token transfer
            (bool success, ) = payable(to).call{value: amount}("");
            require(success, "Native transfer failed");
        } else {
            // ERC20 token transfer
            require(
                IERC20(token).transfer(to, amount),
                "Token transfer failed"
            );
        }
        
        treasuryBalance -= amount;
        dailySpentAmount += amount;
        
        emit TreasuryBalanceUpdated(treasuryBalance, block.timestamp);
    }
    
    // ==== GETTERS ====
    function getTransaction(uint256 transactionId) 
        external 
        view 
        returns (
            address to,
            uint256 amount,
            address token,
            string memory description,
            TransactionState state,
            uint256 approvalCount,
            uint256 createdAt,
            address proposedBy
        ) 
    {
        Transaction storage tx = transactions[transactionId];
        return (
            tx.to,
            tx.amount,
            tx.token,
            tx.description,
            tx.state,
            tx.approvalCount,
            tx.createdAt,
            tx.proposedBy
        );
    }
    
    function getTransactionApprovers(uint256 transactionId) 
        external 
        view 
        returns (address[] memory) 
    {
        return transactionApprovers[transactionId];
    }
    
    function getSigners() external view returns (address[] memory) {
        return signers;
    }
    
    function hasApproved(uint256 transactionId, address signer) 
        external 
        view 
        returns (bool) 
    {
        return transactionApprovals[transactionId][signer];
    }
    
    function getWhitelistedRecipient(address recipient) 
        external 
        view 
        returns (Whitelist memory) 
    {
        return whitelistedRecipients[recipient];
    }
    
    // ==== PAUSE & EMERGENCY ====
    function pause() external onlyRole(ADMIN_ROLE) {
        _pause();
    }
    
    function unpause() external onlyRole(ADMIN_ROLE) {
        _unpause();
    }
    
    // ==== RECEIVE NATIVE TOKEN ====
    receive() external payable {
        treasuryBalance += msg.value;
        emit TreasuryBalanceUpdated(treasuryBalance, block.timestamp);
    }
}
