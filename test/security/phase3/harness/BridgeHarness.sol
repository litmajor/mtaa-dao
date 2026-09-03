// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;
 
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { MessagingFee, MessagingReceipt } from "@layerzerolabs/lz-evm-oapp-v2/contracts/oapp/OAppSender.sol";
import { IOFT, SendParam, OFTLimit, OFTFeeDetail, OFTReceipt } from
    "@layerzerolabs/lz-evm-oapp-v2/contracts/oft/interfaces/IOFT.sol";
 
/// @notice Local stand-in for a LayerZero OFTAdapter lockbox: pulls the token
///         from its caller by allowance and records what it was asked to send.
///         Nothing leaves the machine; the destination side is out of scope
///         because the router has no local receiving surface.
contract MockOFTAdapter is IOFT {
    address public immutable UNDERLYING;
    uint256 public nativeFee;
    uint256 public nonce;
 
    /// @dev Amount the adapter actually debits, as a fraction of `amountLD`.
    ///      10_000 == honest. Lower values model an adapter that under-delivers.
    uint256 public debitBps = 10_000;
 
    SendParam public lastSendParam;
    uint256 public lastDebited;
    uint256 public lastValue;
 
    constructor(address underlying, uint256 _nativeFee) {
        UNDERLYING = underlying;
        nativeFee = _nativeFee;
    }
 
    function setDebitBps(uint256 v) external {
        debitBps = v;
    }
 
    function setNativeFee(uint256 v) external {
        nativeFee = v;
    }
 
    function oftVersion() external pure override returns (bytes4, uint64) {
        return (0x02e49c2c, 1);
    }
 
    function token() external view override returns (address) {
        return UNDERLYING;
    }
 
    function approvalRequired() external pure override returns (bool) {
        return true;
    }
 
    function sharedDecimals() external pure override returns (uint8) {
        return 6;
    }
 
    function quoteOFT(SendParam calldata p)
        external
        pure
        override
        returns (OFTLimit memory, OFTFeeDetail[] memory, OFTReceipt memory)
    {
        return (
            OFTLimit({ minAmountLD: 0, maxAmountLD: type(uint256).max }),
            new OFTFeeDetail[](0),
            OFTReceipt({ amountSentLD: p.amountLD, amountReceivedLD: p.amountLD })
        );
    }
 
    function quoteSend(SendParam calldata, bool) external view override returns (MessagingFee memory) {
        return MessagingFee({ nativeFee: nativeFee, lzTokenFee: 0 });
    }
 
    function send(SendParam calldata p, MessagingFee calldata, address)
        external
        payable
        override
        returns (MessagingReceipt memory, OFTReceipt memory)
    {
        uint256 debit = (p.amountLD * debitBps) / 10_000;
        IERC20(UNDERLYING).transferFrom(msg.sender, address(this), debit);
 
        lastSendParam = p;
        lastDebited = debit;
        lastValue = msg.value;
 
        MessagingReceipt memory receipt = MessagingReceipt({
            guid: keccak256(abi.encode(p.dstEid, p.to, p.amountLD, nonce++)),
            nonce: uint64(nonce),
            fee: MessagingFee({ nativeFee: nativeFee, lzTokenFee: 0 })
        });
        return (receipt, OFTReceipt({ amountSentLD: debit, amountReceivedLD: debit }));
    }
 
    /// @notice Exercises the standing allowance the router grants: an adapter can
    ///         pull from the router at any later time, for any amount, up to the
    ///         `type(uint256).max` approval it was given.
    function pullFromRouter(address router, uint256 amount) external {
        IERC20(UNDERLYING).transferFrom(router, address(this), amount);
    }
}