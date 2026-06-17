// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title MultiSigTreasury
 * @notice 3-of-5 multisig treasury with 48-hour timelock
 * @dev Addresses CRITICAL centralization issue: replaces single owner wallet
 * 
 * Key Features:
 *  - 3 of 5 signatures required for any transaction
 *  - 48-hour timelock between approval and execution (community reaction window)
 *  - All transactions permanently recorded on-chain
 *  - Signers: founder, 2 advisors, 2 community delegates (rotated annually)
 * 
 * Example Flow:
 *  Week 1 Monday: Signer 1 proposes "Pay 50K MTAA to dev"
 *  Week 1 Tuesday: Signers 2, 3 confirm
 *  Week 1 Wednesday: 48 hours elapsed, Signer 1 executes
 *  → 50K MTAA transferred to developer
 *  → Community verified on Etherscan (full transparency)
 */
contract MultiSigTreasury is ReentrancyGuard {
    
    // ─────────────────────────────────────────────────────
    // Constants
    // ─────────────────────────────────────────────────────
    
    uint256 public constant REQUIRED_CONFIRMATIONS = 3;
    uint256 public constant NUM_SIGNERS = 5;
    uint256 public constant TIMELOCK = 48 hours;
    
    // ─────────────────────────────────────────────────────
    // State
    // ─────────────────────────────────────────────────────
    
    IERC20 public mtaaToken;
    address[NUM_SIGNERS] public signers;
    
    struct Transaction {
        address target;         // Where to send tokens or call
        uint256 value;          // MTAA amount (if targeting token)
        bytes data;             // Function call data (if any)
        uint256 confirmations;  // Number of signatures so far
        bool executed;
        uint256 scheduledFor;   // Unix timestamp when executable
        
        mapping(address => bool) confirmedBy;  // Who has signed
    }
    
    uint256 public transactionCount;
    mapping(uint256 => Transaction) public transactions;
    
    // ─────────────────────────────────────────────────────
    // Events
    // ─────────────────────────────────────────────────────
    
    event DepositReceived(address indexed from, uint256 amount);
    event TransactionSubmitted(uint256 indexed txnId, address target, uint256 value);
    event TransactionConfirmed(uint256 indexed txnId, address confirmedBy, uint256 totalConfirmations);
    event TransactionExecuted(uint256 indexed txnId);
    event TransactionRevoked(uint256 indexed txnId, address revokedBy);
    
    // ─────────────────────────────────────────────────────
    // Constructor
    // ─────────────────────────────────────────────────────
    
    constructor(
        address _mtaaToken,
        address[5] memory _signers
    ) {
        mtaaToken = IERC20(_mtaaToken);
        signers = _signers;
        
        // Validate signers are unique
        for (uint i = 0; i < NUM_SIGNERS; i++) {
            require(signers[i] != address(0), "Invalid signer");
            for (uint j = i + 1; j < NUM_SIGNERS; j++) {
                require(signers[i] != signers[j], "Duplicate signer");
            }
        }
    }
    
    
    // ─────────────────────────────────────────────────────
    // Core Functions
    // ─────────────────────────────────────────────────────
    
    modifier onlySigner() {
        bool isSigner = false;
        for (uint i = 0; i < NUM_SIGNERS; i++) {
            if (signers[i] == msg.sender) {
                isSigner = true;
                break;
            }
        }
        require(isSigner, "Only signer can call");
        _;
    }
    
    /**
     * @notice Submit a transaction (spending MTAA from treasury)
     * @param target Address of MTAA token (or contract to call)
     * @param data Encoded function call (e.g., transfer(recipient, amount))
     */
    function submitTransaction(
        address target,
        uint256 value,
        bytes calldata data
    ) external onlySigner {
        require(target != address(0), "Invalid target");
        
        uint256 txnId = transactionCount++;
        
        Transaction storage txn = transactions[txnId];
        txn.target = target;
        txn.value = value;
        txn.data = data;
        txn.scheduledFor = block.timestamp + TIMELOCK;
        
        emit TransactionSubmitted(txnId, target, value);
    }
    
    /**
     * @notice Approve a transaction (add a signature)
     */
    function confirmTransaction(uint256 txnId) external onlySigner {
        Transaction storage txn = transactions[txnId];
        
        require(!txn.executed, "Already executed");
        require(!txn.confirmedBy[msg.sender], "Already confirmed by you");
        require(txn.scheduledFor > 0, "Transaction not found");
        
        txn.confirmedBy[msg.sender] = true;
        txn.confirmations++;
        
        emit TransactionConfirmed(txnId, msg.sender, txn.confirmations);
    }
    
    /**
     * @notice Revoke confirmation (remove a signature)
     */
    function revokeConfirmation(uint256 txnId) external onlySigner {
        Transaction storage txn = transactions[txnId];
        
        require(!txn.executed, "Already executed");
        require(txn.confirmedBy[msg.sender], "Not confirmed by you");
        
        txn.confirmedBy[msg.sender] = false;
        txn.confirmations--;
        
        emit TransactionRevoked(txnId, msg.sender);
    }
    
    /**
     * @notice Execute transaction (after timelock expires + 3 confirmations)
     */
    function executeTransaction(uint256 txnId) external nonReentrant {
        Transaction storage txn = transactions[txnId];
        
        require(!txn.executed, "Already executed");
        require(txn.confirmations >= REQUIRED_CONFIRMATIONS, "Need 3+ confirmations");
        require(block.timestamp >= txn.scheduledFor, "Timelock not expired (48 hours required)");
        
        txn.executed = true;

        // Restrict allowed targets to MTAA token calls or internal contract management
        require(
            txn.target == address(mtaaToken) || txn.target == address(this),
            "Target not allowed"
        );

        // Execute the call (token transfer or internal management)
        (bool success, ) = txn.target.call(txn.data);
        require(success, "Transaction failed");
        
        emit TransactionExecuted(txnId);
    }
    
    // ─────────────────────────────────────────────────────
    // View Functions
    // ─────────────────────────────────────────────────────
    
    function getTreasuryBalance() external view returns (uint256) {
        return mtaaToken.balanceOf(address(this));
    }
    
    function getTransactionStatus(uint256 txnId)
        external
        view
        returns (
            address target,
            uint256 value,
            uint256 confirmations,
            bool executed,
            uint256 scheduledFor
        )
    {
        Transaction storage txn = transactions[txnId];
        return (txn.target, txn.value, txn.confirmations, txn.executed, txn.scheduledFor);
    }

    /**
     * @notice Replace an existing signer with a new address.
     * @dev This must be called through the multisig itself (submitTransaction targeting this contract).
     */
    function replaceSigner(address oldSigner, address newSigner) external {
        require(msg.sender == address(this), "Must go through multisig");
        require(newSigner != address(0), "Invalid new signer");

        for (uint i = 0; i < NUM_SIGNERS; i++) {
            if (signers[i] == oldSigner) {
                // Ensure newSigner is not already present
                for (uint j = 0; j < NUM_SIGNERS; j++) {
                    require(signers[j] != newSigner, "New signer already present");
                }
                signers[i] = newSigner;
                break;
            }
        }
    }
    
    function hasConfirmed(uint256 txnId, address signer) external view returns (bool) {
        return transactions[txnId].confirmedBy[signer];
    }
    
    function getSigners() external view returns (address[5] memory) {
        return signers;
    }
}

