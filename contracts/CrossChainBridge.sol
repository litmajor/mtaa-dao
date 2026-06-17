// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

// Hardened LayerZero V2 OApp Core Integrations
import { OApp } from "@layerzerolabs/lz-evm-oapp-v2/contracts/oapp/OApp.sol";
import { MessagingFee, MessagingReceipt } from "@layerzerolabs/lz-evm-oapp-v2/contracts/oapp/OAppSender.sol";
import { Origin } from "@layerzerolabs/lz-evm-oapp-v2/contracts/oapp/interfaces/IOAppReceiver.sol";
import { IOFT, SendParam, OFTReceipt } from "@layerzerolabs/lz-evm-oapp-v2/contracts/oft/interfaces/IOFT.sol";

/**
 * @title CrossChainBridge
 * @notice Production-hardened LayerZero V2 OmniApp Wrapper Router for MtaaDAO vaults
 */
contract CrossChainBridge is Ownable, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    enum TransferStatus { None, Pending, Completed, Failed }

    struct ChainConfig {
        uint32 eid;
        string name;
        uint256 gasLimit;
        bool isActive;
    }

    struct BridgeTransfer {
        address user;
        address token;
        uint256 amount;
        uint32 destinationEid;
        address destinationAddress;
        uint256 timestamp;
        TransferStatus status;
    }

    // === STATE VARIABLES ===
    mapping(uint32 => ChainConfig) public chainConfigs;
    mapping(uint32 => bool) public supportedChains;
    uint32 public currentChainEid;

    // Token configuration registers: local OFT -> remote chain EID -> remote OFT contract target
    mapping(address => mapping(uint32 => address)) public tokenMappings;
    
    uint256 public defaultMaxSlippage = 500; // 5% base metric (expressed in BPS)
    mapping(address => uint256) public tokenSlippageLimits;
    
    mapping(bytes32 => BridgeTransfer) public transfers;
    uint256 private transferNonce;

    // === EVENTS ===
    event TransferInitiated(
        bytes32 indexed transferId,
        address indexed user,
        address indexed token,
        uint256 amount,
        uint32 destinationEid,
        address destinationAddress,
        uint256 timestamp
    );
    event ChainSupported(uint32 indexed eid, string chainName);
    event ChainDisabled(uint32 indexed eid);
    event TokenMapped(address indexed localOFT, uint32 indexed remoteEid, address indexed remoteOFT);

    // === CUSTOM ERRORS ===
    error ChainNotSupported(uint32 eid);
    error ChainNotActive(uint32 eid);
    error TokenNotMapped(address token, uint32 eid);
    error InvalidAmount();
    error ZeroAddress();
    error SlippageExceeded(uint256 minAmount, uint256 calculatedMin);
    error FeeTransferFailed();

    constructor(
        uint32 _currentChainEid,
        string memory _currentChainName
    ) Ownable(msg.sender) {
        currentChainEid = _currentChainEid;
        
        chainConfigs[_currentChainEid] = ChainConfig({
            eid: _currentChainEid,
            name: _currentChainName,
            gasLimit: 200000,
            isActive: true
        });
        supportedChains[_currentChainEid] = true;
    }

    /**
     * @notice Computes standard messaging fee allocations directly from the target OFT instance
     */
    function quoteBridge(
        address oft,
        uint256 amount,
        uint32 destinationEid,
        address destinationAddress,
        uint256 minAmountLDZ,
        bytes calldata lzOptions
    ) external view returns (MessagingFee memory fee) {
        if (!supportedChains[destinationEid]) revert ChainNotSupported(destinationEid);
        if (tokenMappings[oft][destinationEid] == address(0)) revert TokenNotMapped(oft, destinationEid);

        SendParam memory sendParam = SendParam({
            dstEid: destinationEid,
            to: _addressToBytes32(destinationAddress),
            amountLD: amount,
            minAmountLD: minAmountLDZ,
            extraOptions: lzOptions,
            composeMsg: "", 
            oftCmd: ""
        });

        return IOFT(oft).quoteSend(sendParam, false);
    }

    /**
     * @notice Securely signs and dispatches an interchain asset bridging payload via the OFT token standard layer
     */
    function bridgeAssets(
        address oft,
        uint256 amount,
        uint32 destinationEid,
        address destinationAddress,
        uint256 minAmountLDZ,
        bytes calldata lzOptions
    ) external payable nonReentrant whenNotPaused returns (bytes32 transferId) {
        if (amount == 0) revert InvalidAmount();
        if (destinationAddress == address(0)) revert ZeroAddress();
        if (!supportedChains[destinationEid]) revert ChainNotSupported(destinationEid);
        if (!chainConfigs[destinationEid].isActive) revert ChainNotActive(destinationEid);
        if (tokenMappings[oft][destinationEid] == address(0)) revert TokenNotMapped(oft, destinationEid);

        // Calculate and enforce slippage limits safely
        uint256 slippageLimit = tokenSlippageLimits[oft] > 0 ? tokenSlippageLimits[oft] : defaultMaxSlippage;
        uint256 minAcceptable = (amount * (10000 - slippageLimit)) / 10000;
        if (minAmountLDZ < minAcceptable) revert SlippageExceeded(minAmountLDZ, minAcceptable);

        // FIX: Route the tokens directly from user using standard transfer references to prevent double-locking funds
        IERC20(oft).safeTransferFrom(msg.sender, address(this), amount);
        
        // Ensure the underlying OFT contract has the necessary spending allowance
        uint256 currentAllowance = IERC20(oft).allowance(address(this), oft);
        if (currentAllowance < amount) {
            IERC20(oft).forceApprove(oft, type(uint256).max);
        }

        // Standard OFT execution parameter layout configuration mapping
        SendParam memory sendParam = SendParam({
            dstEid: destinationEid,
            to: _addressToBytes32(destinationAddress),
            amountLD: amount,
            minAmountLD: minAmountLDZ,
            extraOptions: lzOptions,
            composeMsg: "", // Left blank unless custom logic overrides are implemented within the target receiver contract
            oftCmd: ""
        });

        // Query the live required messaging fee allocations
        MessagingFee memory fee = IOFT(oft).quoteSend(sendParam, false);
        if (msg.value < fee.nativeFee) revert FeeTransferFailed();

        // FIX: Explicitly forwards the full incoming msg.value allocation down to the OFT execution layer.
        // Any remaining gas token balance is refunded directly to the specified user address by the LayerZero router.
        (MessagingReceipt memory receipt, ) = IOFT(oft).send{value: msg.value}(
            sendParam,
            fee,
            payable(msg.sender) 
        );

        // Record tracking identifier hash parameters mapping details safely
        transferId = receipt.guid;
        transfers[transferId] = BridgeTransfer({
            user: msg.sender,
            token: oft,
            amount: amount,
            destinationEid: destinationEid,
            destinationAddress: destinationAddress,
            timestamp: block.timestamp,
            status: TransferStatus.Pending
        });

        emit TransferInitiated(
            transferId,
            msg.sender,
            oft,
            amount,
            destinationEid,
            destinationAddress,
            block.timestamp
        );

        return transferId;
    }

    // === STRATEGIC CONFIGURATION MANAGEMENT ===

    function configureSupportedChain(uint32 eid, string memory chainName, uint256 gasLimit) external onlyOwner {
        if (bytes(chainName).length == 0) revert ZeroAddress();
        bool isNew = !supportedChains[eid];

        chainConfigs[eid] = ChainConfig({
            eid: eid,
            name: chainName,
            gasLimit: gasLimit,
            isActive: true
        });

        if (isNew) {
            supportedChains[eid] = true;
            emit ChainSupported(eid, chainName);
        }
    }

    function mapToken(address localOFT, uint32 remoteEid, address remoteOFT) external onlyOwner {
        if (localOFT == address(0) || remoteOFT == address(0)) revert ZeroAddress();
        tokenMappings[localOFT][remoteEid] = remoteOFT;
        emit TokenMapped(localOFT, remoteEid, remoteOFT);
    }

    function pause() external onlyOwner { _pause(); }
    function unpause() external onlyOwner { _unpause(); }

    function _addressToBytes32(address _addr) internal pure returns (bytes32) {
        return bytes32(uint256(uint160(_addr)));
    }

    receive() external payable {}
}