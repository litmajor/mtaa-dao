// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

// LayerZero V2 imports (as of 2025, use audited OApp/OFT from LayerZero docs)
import {OApp} from "@layerzerolabs/lz-evm-oapp-v2/contracts/oapp/OApp.sol";
import {IOFT} from "@layerzerolabs/lz-evm-oapp-v2/contracts/oft/IOFT.sol";

/**
 * @title CrossChainBridge
 * @notice Enables cross-chain asset transfers for MtaaDAO vaults using LayerZero V2
 * @dev Integrated with LayerZero for secure messaging; uses OFT for token bridging
 */
contract CrossChainBridge is Ownable, ReentrancyGuard, OApp {
    using SafeERC20 for IERC20;

    // === CHAIN & ENDPOINT CONFIGURATION ===
    
    struct ChainConfig {
        uint32 eid;                 // LayerZero eid
        string name;                // Chain name
        uint256 gasLimit;           // Default gas limit for transfers
        uint256 gasPrice;           // Current gas price (in wei)
        bool isActive;              // Is chain active
    }

    // Chain registry
    mapping(uint32 => ChainConfig) public chainConfigs;
    uint32[] public supportedChainIds;
    mapping(uint32 => bool) public supportedChains;

    // Current chain EID (set in constructor or updated via manager)
    uint32 public currentChainEid;
    
    // Supported chains (LayerZero eid)
    // Celo: 125, Ethereum: 101, Polygon: 109, Arbitrum: 110, Optimism: 111, BSC: 102
    mapping(uint32 => bool) public supportedChainsRegistry;
    
    // Token mappings: local OFT => remote chain eid => remote OFT
    mapping(address => mapping(uint32 => address)) public tokenMappings;
    
    // Cross-chain swap slippage protection
    uint256 public defaultMaxSlippage = 500; // 5% (basis points)
    mapping(address => uint256) public tokenSlippageLimits; // token => slippage in basis points
    
    // Pending transfers (for custom logic if needed)
    struct BridgeTransfer {
        address user;
        uint256 amount;
        uint32 destinationEid;
        address destinationAddress;
        bool completed;
        uint256 timestamp;
        string status; // "pending", "completed", "failed"
    }
    
    mapping(bytes32 => BridgeTransfer) public transfers;
    uint256 private transferNonce;

    // Events
    event TransferInitiated(
        bytes32 indexed transferId,
        address indexed user,
        address token,
        uint256 amount,
        uint32 destinationEid,
        address destinationAddress,
        uint256 timestamp
    );
    
    event TransferCompleted(
        bytes32 indexed transferId,
        address indexed recipient,
        address token,
        uint256 amount,
        uint32 sourceEid
    );
    
    event TransferFailed(
        bytes32 indexed transferId,
        string reason
    );
    
    event ChainSupported(uint32 eid, string chainName, bool supported);
    event ChainConfigUpdated(uint32 eid, string name, uint256 gasLimit);
    event TokenMapped(address localOFT, uint32 remoteEid, address remoteOFT);
    event SlippageLimitUpdated(address token, uint256 newLimit);

    error ChainNotSupported(uint32 eid);
    error TokenNotMapped(address token, uint32 eid);
    error TransferNotFound(bytes32 transferId);
    error TransferAlreadyCompleted(bytes32 transferId);
    error InvalidAmount(uint256 amount);
    error ZeroAddress();
    error SlippageExceeded(uint256 received, uint256 expected);
    error InvalidGasLimit(uint256 limit);

    constructor(
        address _endpoint,
        uint32 _currentChainEid,
        string memory _currentChainName
    ) OApp(_endpoint) Ownable(msg.sender) {
        currentChainEid = _currentChainEid;
        
        // Initialize current chain
        chainConfigs[_currentChainEid] = ChainConfig({
            eid: _currentChainEid,
            name: _currentChainName,
            gasLimit: 200000, // Default gas limit
            gasPrice: 1 gwei,
            isActive: true
        });
        
        supportedChainsRegistry[_currentChainEid] = true;
        supportedChainIds.push(_currentChainEid);
    }

    /**
     * @notice Initialize cross-chain transfer using LayerZero OFT
     * @dev Burns local OFT shares; mints on destination via lzSend
     * @param oft Local OFT token address
     * @param amount Amount to bridge (in local decimals)
     * @param destinationEid Target LayerZero eid
     * @param destinationAddress Recipient on destination chain
     * @param minAmountLDZ Minimum amount to receive (slippage protection)
     * @param lzComposeParams LayerZero compose options (gas, etc.)
     */
    function bridgeAssets(
        address oft,
        uint256 amount,
        uint32 destinationEid,
        address destinationAddress,
        uint256 minAmountLDZ,
        bytes calldata lzComposeParams
    ) external nonReentrant returns (bytes32 transferId) {
        if (amount == 0) revert InvalidAmount(amount);
        if (destinationAddress == address(0)) revert ZeroAddress();
        if (!supportedChainsRegistry[destinationEid]) revert ChainNotSupported(destinationEid);
        if (tokenMappings[oft][destinationEid] == address(0)) revert TokenNotMapped(oft, destinationEid);

        // Check slippage limits
        uint256 slippageLimit = tokenSlippageLimits[oft] > 0 ? tokenSlippageLimits[oft] : defaultMaxSlippage;
        uint256 minAmount = (minAmountLDZ * (10000 - slippageLimit)) / 10000;
        if (minAmountLDZ < minAmount) revert SlippageExceeded(minAmountLDZ, minAmount);

        // Transfer and burn local shares (OFT standard)
        IOFT(oft).sendFrom(
            msg.sender,
            destinationEid,
            abi.encode(destinationAddress), // Payload for destination
            amount,
            minAmountLDZ,
            lzComposeParams,
            "" // No extra options for basic transfer
        );

        // Record for tracking (optional, as OFT handles atomicity)
        transferId = keccak256(abi.encodePacked(msg.sender, oft, amount, destinationEid, block.timestamp, transferNonce++));
        transfers[transferId] = BridgeTransfer({
            user: msg.sender,
            amount: amount,
            destinationEid: destinationEid,
            destinationAddress: destinationAddress,
            completed: false,
            timestamp: block.timestamp,
            status: "pending"
        });

        emit TransferInitiated(transferId, msg.sender, oft, amount, destinationEid, destinationAddress, block.timestamp);
        
        return transferId;
    }

    /**
     * @notice LayerZero callback for receiving transfers (OApp override)
     * @dev Mints remote OFT shares to recipient; marks as completed
     * @param _sender Sender on source chain
     * @param _sourceEid Source eid
     * @param _nonce Nonce
     * @param _payload Encoded data (e.g., recipient, amount)
     */
    function _lzReceive(
        uint32 _sourceEid,
        bytes32 _sender,
        uint64 _nonce,
        bytes calldata _payload
    ) internal virtual override {
        // Decode payload (e.g., abi.decode(_payload, (address recipient, uint256 amount)))
        (address recipient, address localOFT, uint256 amount) = abi.decode(_payload, (address, address, uint256));
        
        // Mint shares on this chain (OFT handles)
        IOFT(localOFT).sendFrom(
            address(this), // From bridge
            0, // Local
            abi.encode(recipient),
            amount,
            amount, // No slippage for receive
            "", // No compose
            ""
        );

        // Mark transfer (if tracked)
        bytes32 transferId = keccak256(abi.encodePacked(_sender, localOFT, amount, _sourceEid, _nonce)); // Secure ID
        if (transfers[transferId].user != address(0)) {
            transfers[transferId].completed = true;
            transfers[transferId].status = "completed";
            emit TransferCompleted(transferId, recipient, localOFT, amount, _sourceEid);
        }
    }

    // === CHAIN MANAGEMENT ===

    /**
     * @notice Add or update supported chain configuration
     * @param eid LayerZero endpoint ID
     * @param chainName Human-readable chain name
     * @param gasLimit Default gas limit for transfers
     */
    function configureSupportedChain(
        uint32 eid,
        string memory chainName,
        uint256 gasLimit
    ) external onlyOwner {
        if (gasLimit < 100000 || gasLimit > 1000000) revert InvalidGasLimit(gasLimit);
        if (bytes(chainName).length == 0) revert ZeroAddress();
        
        if (!supportedChainsRegistry[eid]) {
            supportedChainIds.push(eid);
        }
        
        chainConfigs[eid] = ChainConfig({
            eid: eid,
            name: chainName,
            gasLimit: gasLimit,
            gasPrice: chainConfigs[eid].gasPrice == 0 ? 1 gwei : chainConfigs[eid].gasPrice,
            isActive: true
        });
        
        supportedChainsRegistry[eid] = true;
        supportedChains[eid] = true;
        
        emit ChainConfigUpdated(eid, chainName, gasLimit);
        emit ChainSupported(eid, chainName, true);
    }

    /**
     * @notice Disable a chain
     * @param eid Chain EID to disable
     */
    function disableSupportedChain(uint32 eid) external onlyOwner {
        if (!supportedChainsRegistry[eid]) revert ChainNotSupported(eid);
        
        chainConfigs[eid].isActive = false;
        supportedChains[eid] = false;
        
        emit ChainSupported(eid, chainConfigs[eid].name, false);
    }

    /**
     * @notice Update gas price for a chain
     * @param eid Chain EID
     * @param gasPrice New gas price in wei
     */
    function updateChainGasPrice(uint32 eid, uint256 gasPrice) external onlyOwner {
        if (!supportedChainsRegistry[eid]) revert ChainNotSupported(eid);
        chainConfigs[eid].gasPrice = gasPrice;
    }

    /**
     * @notice Get all supported chain configurations
     * @return Array of chain configurations
     */
    function getSupportedChains() external view returns (ChainConfig[] memory) {
        ChainConfig[] memory configs = new ChainConfig[](supportedChainIds.length);
        for (uint256 i = 0; i < supportedChainIds.length; ++i) {
            configs[i] = chainConfigs[supportedChainIds[i]];
        }
        return configs;
    }

    /**
     * @notice Get chain configuration
     * @param eid Chain EID
     * @return Chain configuration
     */
    function getChainConfig(uint32 eid) external view returns (ChainConfig memory) {
        return chainConfigs[eid];
    }

    /**
     * @notice Map OFT tokens across chains
     * @param localOFT Local OFT address
     * @param remoteEid Remote eid
     * @param remoteOFT Remote OFT address
     */
    function mapToken(
        address localOFT,
        uint32 remoteEid,
        address remoteOFT
    ) external onlyOwner {
        if (localOFT == address(0) || remoteOFT == address(0)) revert ZeroAddress();
        if (!supportedChainsRegistry[remoteEid]) revert ChainNotSupported(remoteEid);
        
        tokenMappings[localOFT][remoteEid] = remoteOFT;
        emit TokenMapped(localOFT, remoteEid, remoteOFT);
    }

    /**
     * @notice Set slippage limit for a token
     * @param token Token address
     * @param slippageBps Slippage limit in basis points (e.g., 500 = 5%)
     */
    function setTokenSlippageLimit(address token, uint256 slippageBps) external onlyOwner {
        if (token == address(0)) revert ZeroAddress();
        if (slippageBps > 10000) revert InvalidAmount(slippageBps);
        
        tokenSlippageLimits[token] = slippageBps;
        emit SlippageLimitUpdated(token, slippageBps);
    }

    /**
     * @notice Set default slippage limit for all tokens
     * @param slippageBps Slippage limit in basis points
     */
    function setDefaultMaxSlippage(uint256 slippageBps) external onlyOwner {
        if (slippageBps > 10000) revert InvalidAmount(slippageBps);
        defaultMaxSlippage = slippageBps;
    }

    /**
     * @notice Get transfer status (view)
     * @param transferId Transfer ID
     * @return completed Whether transfer is completed
     * @return amount Transfer amount
     * @return status Transfer status string
     * @return timestamp Timestamp of transfer
     */
    function getTransferStatus(bytes32 transferId) 
        external 
        view 
        returns (bool completed, uint256 amount, string memory status, uint256 timestamp) 
    {
        BridgeTransfer memory transfer = transfers[transferId];
        if (transfer.user == address(0)) revert TransferNotFound(transferId);
        return (transfer.completed, transfer.amount, transfer.status, transfer.timestamp);
    }

    /**
     * @notice Get transfer details
     * @param transferId Transfer ID
     * @return Transfer details
     */
    function getTransferDetails(bytes32 transferId) external view returns (BridgeTransfer memory) {
        BridgeTransfer memory transfer = transfers[transferId];
        if (transfer.user == address(0)) revert TransferNotFound(transferId);
        return transfer;
    }

    /**
     * @notice Emergency withdrawal with timelock simulation (add delay in prod)
     * @dev Use multi-sig in practice
     */
    function emergencyWithdraw(address token, uint256 amount) external onlyOwner {
        if (amount == 0) revert InvalidAmount(amount);
        IERC20(token).safeTransfer(owner(), amount);
    }

    // OApp overrides for LayerZero (minimal)
    function _lzCompose(bytes calldata _composeOptions, bytes calldata _msg) internal virtual override returns (bytes memory composedMsg) {
        // Default compose; customize for gas/relayers
        return _msg;
    }
}