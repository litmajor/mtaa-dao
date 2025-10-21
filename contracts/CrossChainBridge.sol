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

    // LayerZero endpoint (set in constructor or via lzCompose)
    uint32 public constant LZ_ENDPOINT_ID = 400; // Example for Ethereum; configure per chain

    // Supported chains (LayerZero eid)
    mapping(uint32 => bool) public supportedChains;
    
    // Token mappings: local OFT => remote chain eid => remote OFT
    mapping(address => mapping(uint32 => address)) public tokenMappings;
    
    // Pending transfers (for custom logic if needed)
    struct BridgeTransfer {
        address user;
        uint256 amount;
        uint32 destinationEid;
        address destinationAddress;
        bool completed;
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
        address destinationAddress
    );
    
    event TransferCompleted(
        bytes32 indexed transferId,
        address indexed recipient,
        address token,
        uint256 amount
    );
    
    event ChainSupported(uint32 eid, bool supported);
    event TokenMapped(address localOFT, uint32 remoteEid, address remoteOFT);

    error ChainNotSupported(uint32 eid);
    error TokenNotMapped(address token, uint32 eid);
    error TransferNotFound(bytes32 transferId);
    error TransferAlreadyCompleted(bytes32 transferId);
    error InvalidAmount(uint256 amount);
    error ZeroAddress();

    constructor(address _endpoint) OApp(_endpoint) Ownable(msg.sender) {}

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
        if (!supportedChains[destinationEid]) revert ChainNotSupported(destinationEid);
        if (tokenMappings[oft][destinationEid] == address(0)) revert TokenNotMapped(oft, destinationEid);

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
            completed: false
        });

        emit TransferInitiated(transferId, msg.sender, oft, amount, destinationEid, destinationAddress);
        
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
            emit TransferCompleted(transferId, recipient, localOFT, amount);
        }
    }

    /**
     * @notice Add supported chain (LayerZero eid)
     * @param eid Chain eid
     * @param supported Whether supported
     */
    function setSupportedChain(uint32 eid, bool supported) external onlyOwner {
        supportedChains[eid] = supported;
        emit ChainSupported(eid, supported);
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
        tokenMappings[localOFT][remoteEid] = remoteOFT;
        emit TokenMapped(localOFT, remoteEid, remoteOFT);
    }

    /**
     * @notice Get transfer status (view)
     * @param transferId Transfer ID
     * @return status Completed or not
     */
    function getTransferStatus(bytes32 transferId) external view returns (bool completed, uint256 amount, address token) {
        BridgeTransfer memory transfer = transfers[transferId];
        if (transfer.user == address(0)) revert TransferNotFound(transferId);
        return (transfer.completed, transfer.amount, address(0)); // Token not stored; adjust if needed
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