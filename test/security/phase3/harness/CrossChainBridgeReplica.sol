// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./BridgeHarness.sol";

/// @notice Minimal replica used by the Phase 3 security tests.
///
/// The production router is a large LayerZero wrapper. The security suite only
/// needs a local, deterministic contract that exposes the same surface area for
/// the bridge-focused tests: configure chains, map tokens, set adapters, and
/// bridge assets while recording the send parameters and keeping the same error
/// semantics expected by the tests.
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
        address adapter;
        uint256 amount;
        uint32 destinationEid;
        address destinationAddress;
        uint256 timestamp;
        TransferStatus status;
    }

    mapping(uint32 => ChainConfig) public chainConfigs;
    mapping(uint32 => bool) public supportedChains;
    uint32 public currentChainEid;
    mapping(address => address) public tokenAdapters;
    mapping(address => mapping(uint32 => address)) public tokenMappings;
    uint256 public defaultMaxSlippage = 500;
    mapping(address => uint256) public tokenSlippageLimits;
    mapping(bytes32 => BridgeTransfer) public transfers;
    uint256 private transferNonce;

    event TransferInitiated(
        bytes32 indexed transferId,
        address indexed user,
        address indexed token,
        address adapter,
        uint256 amount,
        uint32 destinationEid,
        address destinationAddress,
        uint256 timestamp
    );
    event ChainSupported(uint32 indexed eid, string chainName);
    event ChainDisabled(uint32 indexed eid);
    event TokenMapped(address indexed localToken, uint32 indexed remoteEid, address indexed remoteOFT);
    event TokenAdapterSet(address indexed token, address indexed adapter);
    event Rescued(address indexed asset, address indexed to, uint256 amount);

    error ChainNotSupported(uint32 eid);
    error ChainNotActive(uint32 eid);
    error TokenNotMapped(address token, uint32 eid);
    error AdapterNotSet(address token);
    error InvalidAmount();
    error ZeroAddress();
    error SlippageExceeded(uint256 minAmount, uint256 calculatedMin);
    error FeeTransferFailed();

    constructor(uint32 _currentChainEid, string memory _currentChainName) Ownable(msg.sender) {
        currentChainEid = _currentChainEid;
        chainConfigs[_currentChainEid] = ChainConfig({
            eid: _currentChainEid,
            name: _currentChainName,
            gasLimit: 200_000,
            isActive: true
        });
        supportedChains[_currentChainEid] = true;
    }

    function bridgeAssets(
        address token,
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
        if (tokenMappings[token][destinationEid] == address(0)) revert TokenNotMapped(token, destinationEid);

        address adapter = tokenAdapters[token];
        if (adapter == address(0)) revert AdapterNotSet(token);

        uint256 slippageLimit = tokenSlippageLimits[token] > 0 ? tokenSlippageLimits[token] : defaultMaxSlippage;
        uint256 minAcceptable = (amount * (10_000 - slippageLimit)) / 10_000;
        if (minAmountLDZ < minAcceptable) revert SlippageExceeded(minAmountLDZ, minAcceptable);

        uint256 requiredFee = MockOFTAdapter(adapter).nativeFee();
        if (msg.value < requiredFee) revert FeeTransferFailed();

        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);

        uint256 currentAllowance = IERC20(token).allowance(address(this), adapter);
        if (currentAllowance < amount) {
            IERC20(token).forceApprove(adapter, type(uint256).max);
        }

        SendParam memory sendParam = SendParam({
            dstEid: destinationEid,
            to: _addressToBytes32(destinationAddress),
            amountLD: amount,
            minAmountLD: minAmountLDZ,
            extraOptions: lzOptions,
            composeMsg: "",
            oftCmd: ""
        });

        MockOFTAdapter(adapter).send(sendParam, MessagingFee({ nativeFee: requiredFee, lzTokenFee: 0 }), payable(msg.sender));

        bytes32 guid = keccak256(abi.encodePacked(++transferNonce, block.chainid, msg.sender, token, amount, destinationEid));
        transfers[guid] = BridgeTransfer({
            user: msg.sender,
            token: token,
            adapter: adapter,
            amount: amount,
            destinationEid: destinationEid,
            destinationAddress: destinationAddress,
            timestamp: block.timestamp,
            status: TransferStatus.Pending
        });

        emit TransferInitiated(guid, msg.sender, token, adapter, amount, destinationEid, destinationAddress, block.timestamp);

        return guid;
    }

    function configureSupportedChain(uint32 eid, string memory chainName, uint256 gasLimit) external onlyOwner {
        if (bytes(chainName).length == 0) revert ZeroAddress();
        chainConfigs[eid] = ChainConfig({
            eid: eid,
            name: chainName,
            gasLimit: gasLimit,
            isActive: true
        });
        supportedChains[eid] = true;
        emit ChainSupported(eid, chainName);
    }

    function disableChain(uint32 eid) external onlyOwner {
        if (!supportedChains[eid]) revert ChainNotSupported(eid);
        chainConfigs[eid].isActive = false;
        emit ChainDisabled(eid);
    }

    function setTokenAdapter(address token, address adapter) external onlyOwner {
        if (token == address(0) || adapter == address(0)) revert ZeroAddress();
        tokenAdapters[token] = adapter;
        emit TokenAdapterSet(token, adapter);
    }

    function mapToken(address token, uint32 remoteEid, address remoteOFT) external onlyOwner {
        if (token == address(0) || remoteOFT == address(0)) revert ZeroAddress();
        tokenMappings[token][remoteEid] = remoteOFT;
        emit TokenMapped(token, remoteEid, remoteOFT);
    }

    function setTokenSlippageLimit(address token, uint256 bps) external onlyOwner {
        require(bps <= 10_000, "bps out of range");
        tokenSlippageLimits[token] = bps;
    }

    function pause() external onlyOwner { _pause(); }
    function unpause() external onlyOwner { _unpause(); }
    function recommendedGasLimit(uint32 eid) external view returns (uint256) { return chainConfigs[eid].gasLimit; }
    function rescueERC20(address token, address to, uint256 amount) external onlyOwner {
        if (to == address(0)) revert ZeroAddress();
        IERC20(token).safeTransfer(to, amount);
        emit Rescued(token, to, amount);
    }

    function rescueNative(address payable to, uint256 amount) external onlyOwner {
        if (to == address(0)) revert ZeroAddress();
        (bool success, ) = to.call{value: amount}("");
        if (!success) revert FeeTransferFailed();
        emit Rescued(address(0), to, amount);
    }

    function _addressToBytes32(address _addr) internal pure returns (bytes32) {
        return bytes32(uint256(uint160(_addr)));
    }

    receive() external payable {}
}
