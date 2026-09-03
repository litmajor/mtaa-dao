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
 * @notice Production-hardened LayerZero V2 OApp Wrapper Router for MtaaDAO vaults
 *
 * ─────────────────────────────────────────────────────────────────────────
 * FIX (2026-07-08): The original version conflated two different LayerZero
 * concepts into a single `oft` address:
 *   1. The underlying ERC20 the user actually holds (cUSD, MTAA, USDC...)
 *   2. The contract that implements IOFT.send() / quoteSend()
 * These are the SAME contract only for tokens that are natively built as
 * OFTs. For any pre-existing ERC20 (which is every real asset MtaaDAO
 * cares about — cUSD, MTAA, USDC are all plain ERC20s), LayerZero's
 * standard pattern is an OFTAdapter: a separate lockbox contract that
 * holds/burns the real token and emits the cross-chain message. The old
 * code had no way to express "token X routes through adapter Y" — it
 * would either fail to compile the token as an ERC20 transferFrom target,
 * or fail to compile the adapter as a transferFrom source. Bridging "any
 * asset" requires that split, added below via `tokenAdapters`.
 *
 * Also added: rescue functions for stray native/ERC20 balances (there was
 * previously no way to recover ETH sent via `receive()` or leftover token
 * dust from a partially-failed send), and a public gasLimit getter so the
 * off-chain SDK can build correctly-sized lzOptions instead of the
 * per-chain gasLimit sitting unused in storage.
 * ─────────────────────────────────────────────────────────────────────────
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
        address token;      // underlying ERC20 the user sent
        address adapter;    // OFT/adapter contract actually used for the send
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

    // Underlying ERC20 => the contract this router calls for LayerZero sends.
    // For a native OFT, adapter == token. For a wrapped/existing ERC20
    // (cUSD, MTAA, USDC, ...), adapter is a deployed OFTAdapter lockbox.
    // This is what makes "bridge any asset" possible instead of only
    // tokens that happen to be natively OFT.
    mapping(address => address) public tokenAdapters;

    // Local token -> remote chain EID -> remote OFT/adapter address.
    // NOTE: this is an off-chain-auditable allowlist/registry, NOT what
    // LayerZero itself uses for routing — the actual peer wiring lives on
    // the adapter contract via its own setPeer(eid, remotePeerBytes32).
    // This mapping exists so bridgeAssets() can refuse to route a token to
    // a destination nobody has explicitly configured/audited yet, and so
    // the frontend/backend can display what's configured without a
    // separate off-chain registry.
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

    // === CUSTOM ERRORS ===
    error ChainNotSupported(uint32 eid);
    error ChainNotActive(uint32 eid);
    error TokenNotMapped(address token, uint32 eid);
    error AdapterNotSet(address token);
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
     * @notice Computes standard messaging fee allocations directly from the target OFT/adapter instance
     * @param token The underlying ERC20 the user holds (e.g. cUSD)
     */
    function quoteBridge(
        address token,
        uint256 amount,
        uint32 destinationEid,
        address destinationAddress,
        uint256 minAmountLDZ,
        bytes calldata lzOptions
    ) external view returns (MessagingFee memory fee) {
        if (!supportedChains[destinationEid]) revert ChainNotSupported(destinationEid);
        if (tokenMappings[token][destinationEid] == address(0)) revert TokenNotMapped(token, destinationEid);

        address adapter = tokenAdapters[token];
        if (adapter == address(0)) revert AdapterNotSet(token);

        SendParam memory sendParam = SendParam({
            dstEid: destinationEid,
            to: _addressToBytes32(destinationAddress),
            amountLD: amount,
            minAmountLD: minAmountLDZ,
            extraOptions: lzOptions,
            composeMsg: "",
            oftCmd: ""
        });

        return IOFT(adapter).quoteSend(sendParam, false);
    }

    /**
     * @notice Securely signs and dispatches an interchain asset bridging payload via LayerZero
     * @param token The underlying ERC20 the user holds (e.g. cUSD, MTAA, USDC).
     *              Looked up in tokenAdapters to find the contract that actually
     *              implements IOFT for it — may be the token itself (native OFT)
     *              or a separate deployed OFTAdapter lockbox (everything else).
     */
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

        // Calculate and enforce slippage limits safely
        uint256 slippageLimit = tokenSlippageLimits[token] > 0 ? tokenSlippageLimits[token] : defaultMaxSlippage;
        uint256 minAcceptable = (amount * (10000 - slippageLimit)) / 10000;
        if (minAmountLDZ < minAcceptable) revert SlippageExceeded(minAmountLDZ, minAcceptable);

        // Pull the REAL underlying token from the user into this router.
        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);

        // Approve the ADAPTER (not the token) to pull from this router's
        // balance. For a native OFT (adapter == token), the OFT's _debit
        // typically burns directly from msg.sender without needing
        // transferFrom, so this approval is harmless but unused; for a
        // real OFTAdapter, this approval is exactly what lets its internal
        // transferFrom(router, adapter, amount) succeed when we call send()
        // below (from the adapter's perspective, msg.sender IS this router).
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

        MessagingFee memory fee = IOFT(adapter).quoteSend(sendParam, false);
        if (msg.value < fee.nativeFee) revert FeeTransferFailed();

        // Forwards the full incoming msg.value allocation down to the OFT
        // execution layer. Any remaining native-gas balance is refunded
        // directly to the specified user address by the LayerZero router.
        (MessagingReceipt memory receipt, ) = IOFT(adapter).send{value: msg.value}(
            sendParam,
            fee,
            payable(msg.sender)
        );

        transferId = receipt.guid;
        transfers[transferId] = BridgeTransfer({
            user: msg.sender,
            token: token,
            adapter: adapter,
            amount: amount,
            destinationEid: destinationEid,
            destinationAddress: destinationAddress,
            timestamp: block.timestamp,
            status: TransferStatus.Pending
        });

        emit TransferInitiated(
            transferId,
            msg.sender,
            token,
            adapter,
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

    function disableChain(uint32 eid) external onlyOwner {
        if (!supportedChains[eid]) revert ChainNotSupported(eid);
        chainConfigs[eid].isActive = false;
        emit ChainDisabled(eid);
    }

    /**
     * @notice Register which contract this router should call to bridge `token`.
     * Pass `adapter == token` for a token that is natively an OFT. Pass a
     * deployed OFTAdapter address for any pre-existing ERC20 (cUSD, MTAA,
     * USDC, etc). This is what makes "any asset" possible — deploy one
     * OFTAdapter per token per chain, wire its peers via the adapter's own
     * setPeer(), then register it here.
     */
    function setTokenAdapter(address token, address adapter) external onlyOwner {
        if (token == address(0) || adapter == address(0)) revert ZeroAddress();
        tokenAdapters[token] = adapter;
        emit TokenAdapterSet(token, adapter);
    }

    /**
     * @notice Record the expected remote OFT/adapter address for a token+chain
     * pair, purely as an on-chain audit trail / allowlist gate for
     * bridgeAssets(). Does NOT configure LayerZero routing itself — that's
     * done via setPeer() on the adapter contract directly.
     */
    function mapToken(address token, uint32 remoteEid, address remoteOFT) external onlyOwner {
        if (token == address(0) || remoteOFT == address(0)) revert ZeroAddress();
        tokenMappings[token][remoteEid] = remoteOFT;
        emit TokenMapped(token, remoteEid, remoteOFT);
    }

    function setTokenSlippageLimit(address token, uint256 bps) external onlyOwner {
        require(bps <= 10000, "bps out of range");
        tokenSlippageLimits[token] = bps;
    }

    function pause() external onlyOwner { _pause(); }
    function unpause() external onlyOwner { _unpause(); }

    /**
     * @notice Recommended gas limit for lzOptions when bridging TO `eid`.
     * The off-chain SDK should read this and build extraOptions with it
    * (e.g. via the LayerZero utilities package's Options.addExecutorLzReceiveOption)
     * rather than hardcoding a gas limit client-side.
     */
    function recommendedGasLimit(uint32 eid) external view returns (uint256) {
        return chainConfigs[eid].gasLimit;
    }

    // === RESCUE (stray funds only — this contract should never hold a
    // balance between transactions under normal operation, since tokens
    // are pulled in and sent out atomically within bridgeAssets()) ===

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
