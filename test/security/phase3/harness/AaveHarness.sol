// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;
 
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
 
import "../../../../contracts/interfaces/IAavePool.sol";
import "../../../../contracts/interfaces/IFlashLoanStrategy.sol";
import "../../../../contracts/interfaces/IPoolAddressesProvider.sol";
import "../../../../contracts/interfaces/IFlashLoanReceiver.sol";
 
/// @notice Local Aave V3 pool stand-in: lends the requested amount, invokes the
///         receiver callback, then pulls principal + premium back via allowance.
///         Faithful to the parts of the real pool `FlashLoanExecutor` depends on.
contract MockAavePool is IAavePool {
    uint128 public constant PREMIUM_BPS = 5; // 0.05%, matching Aave V3
 
    error RepaymentFailed();
 
    function FLASHLOAN_PREMIUM_TOTAL() external pure override returns (uint128) {
        return PREMIUM_BPS;
    }
 
    function flashLoan(
        address receiver,
        address[] calldata tokens,
        uint256[] calldata amounts,
        uint256[] calldata modes,
        address onBehalfOf,
        bytes calldata params,
        uint16
    ) external override {
        modes;
        uint256[] memory premiums = new uint256[](amounts.length);
        for (uint256 i = 0; i < amounts.length; ++i) {
            premiums[i] = (amounts[i] * PREMIUM_BPS) / 10_000;
            IERC20(tokens[i]).transfer(receiver, amounts[i]);
        }
 
        IFlashLoanReceiver(receiver).executeOperation(tokens, amounts, premiums, onBehalfOf, params);
 
        for (uint256 i = 0; i < amounts.length; ++i) {
            uint256 owed = amounts[i] + premiums[i];
            if (!IERC20(tokens[i]).transferFrom(receiver, address(this), owed)) revert RepaymentFailed();
        }
    }
}
 
contract MockAddressesProvider is IPoolAddressesProvider {
    address private immutable POOL_ADDRESS;
 
    constructor(address pool) {
        POOL_ADDRESS = pool;
    }
 
    function getPool() external view override returns (address) {
        return POOL_ADDRESS;
    }
}
 
/// @notice Strategy that returns the borrowed amount plus a configured gain,
///         funded from its own pre-seeded balance (a stand-in for arbitrage
///         proceeds).
contract ProfitableStrategy is IFlashLoanStrategy {
    uint256 public gainBps;
    uint256 public reportedProfitOverride;
    bool public reportSuccess = true;
 
    constructor(uint256 _gainBps) {
        gainBps = _gainBps;
    }
 
    function setGainBps(uint256 v) external {
        gainBps = v;
    }
 
    function setReportedProfitOverride(uint256 v) external {
        reportedProfitOverride = v;
    }
 
    function setReportSuccess(bool v) external {
        reportSuccess = v;
    }
 
    function execute(address asset, uint256 amount, bytes calldata)
        external
        override
        returns (bool, uint256)
    {
        uint256 gain = (amount * gainBps) / 10_000;
        IERC20(asset).transfer(msg.sender, amount + gain);
        return (reportSuccess, reportedProfitOverride == 0 ? gain : reportedProfitOverride);
    }
}
 
/// @notice Strategy that fails, returning a configurable share of the principal.
///         In `softFail` mode it returns `(false, 0)` normally, which keeps the
///         partial repayment (the executor's recoverable-failure branch). With
///         `revertHard` it reverts instead, which rolls the repayment back.
contract FailingStrategy is IFlashLoanStrategy {
    uint256 public returnBps;
    bool public revertHard;
 
    constructor(uint256 _returnBps) {
        returnBps = _returnBps;
    }
 
    function setReturnBps(uint256 v) external {
        returnBps = v;
    }
 
    function setRevertHard(bool v) external {
        revertHard = v;
    }
 
    function execute(address asset, uint256 amount, bytes calldata)
        external
        override
        returns (bool, uint256)
    {
        IERC20(asset).transfer(msg.sender, (amount * returnBps) / 10_000);
        if (revertHard) revert("strategy blew up");
        return (false, 0);
    }
}
 
/// @notice Strategy that tries to re-enter the executor while the flash loan is
///         still open.
contract ReentrantStrategy is IFlashLoanStrategy {
    address public immutable EXECUTOR;
    address public immutable TARGET_STRATEGY;
    bytes public lastError;
 
    constructor(address executor, address targetStrategy) {
        EXECUTOR = executor;
        TARGET_STRATEGY = targetStrategy;
    }
 
    function execute(address asset, uint256 amount, bytes calldata)
        external
        override
        returns (bool, uint256)
    {
        (bool ok, bytes memory err) = EXECUTOR.call(
            abi.encodeWithSignature(
                "executeFlashLoan(address,uint256,address,bytes)", asset, amount, TARGET_STRATEGY, bytes("")
            )
        );
        if (!ok) lastError = err;
        IERC20(asset).transfer(msg.sender, amount);
        return (false, 0);
    }
}