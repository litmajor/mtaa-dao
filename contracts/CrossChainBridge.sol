
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title CrossChainBridge
 * @notice Enables cross-chain asset transfers for MtaaDAO vaults
 * @dev Uses LayerZero/Axelar for message passing
 */
contract CrossChainBridge is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // Supported chains
    mapping(uint16 => bool) public supportedChains;
    
    // Chain ID to bridge address mapping
    mapping(uint16 => address) public bridgeAddresses;
    
    // Token mapping: local token => remote chain => remote token
    mapping(address => mapping(uint16 => address)) public tokenMappings;
    
    // Pending transfers
    struct BridgeTransfer {
        address user;
        address token;
        uint256 amount;
        uint16 destinationChain;
        address destinationAddress;
        uint256 nonce;
        bool completed;
    }
    
    mapping(bytes32 => BridgeTransfer) public transfers;
    uint256 public transferNonce;
    
    // Events
    event TransferInitiated(
        bytes32 indexed transferId,
        address indexed user,
        address token,
        uint256 amount,
        uint16 destinationChain,
        address destinationAddress
    );
    
    event TransferCompleted(
        bytes32 indexed transferId,
        address indexed recipient,
        address token,
        uint256 amount
    );
    
    event ChainSupported(uint16 chainId, address bridgeAddress);
    event TokenMapped(address localToken, uint16 remoteChain, address remoteToken);

    constructor() Ownable(msg.sender) {}

    /**
     * @notice Initialize cross-chain transfer
     * @param token Token to bridge
     * @param amount Amount to transfer
     * @param destinationChain Target chain ID
     * @param destinationAddress Recipient address on destination chain
     */
    function bridgeAssets(
        address token,
        uint256 amount,
        uint16 destinationChain,
        address destinationAddress
    ) external nonReentrant returns (bytes32) {
        require(supportedChains[destinationChain], "Chain not supported");
        require(tokenMappings[token][destinationChain] != address(0), "Token not mapped");
        
        // Lock tokens
        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
        
        // Create transfer record
        bytes32 transferId = keccak256(
            abi.encodePacked(msg.sender, token, amount, destinationChain, transferNonce++)
        );
        
        transfers[transferId] = BridgeTransfer({
            user: msg.sender,
            token: token,
            amount: amount,
            destinationChain: destinationChain,
            destinationAddress: destinationAddress,
            nonce: transferNonce,
            completed: false
        });
        
        emit TransferInitiated(
            transferId,
            msg.sender,
            token,
            amount,
            destinationChain,
            destinationAddress
        );
        
        return transferId;
    }

    /**
     * @notice Complete cross-chain transfer (called by relayer)
     * @param transferId Transfer identifier
     * @param recipient Recipient address
     */
    function completeTransfer(
        bytes32 transferId,
        address recipient
    ) external onlyOwner {
        BridgeTransfer storage transfer = transfers[transferId];
        require(!transfer.completed, "Transfer already completed");
        
        transfer.completed = true;
        
        // Release tokens
        IERC20(transfer.token).safeTransfer(recipient, transfer.amount);
        
        emit TransferCompleted(transferId, recipient, transfer.token, transfer.amount);
    }

    /**
     * @notice Add supported chain
     */
    function addSupportedChain(uint16 chainId, address bridgeAddress) external onlyOwner {
        supportedChains[chainId] = true;
        bridgeAddresses[chainId] = bridgeAddress;
        emit ChainSupported(chainId, bridgeAddress);
    }

    /**
     * @notice Map token across chains
     */
    function mapToken(
        address localToken,
        uint16 remoteChain,
        address remoteToken
    ) external onlyOwner {
        tokenMappings[localToken][remoteChain] = remoteToken;
        emit TokenMapped(localToken, remoteChain, remoteToken);
    }

    /**
     * @notice Emergency withdrawal
     */
    function emergencyWithdraw(address token, uint256 amount) external onlyOwner {
        IERC20(token).safeTransfer(owner(), amount);
    }
}
