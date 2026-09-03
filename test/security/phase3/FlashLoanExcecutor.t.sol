// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;
 
import "forge-std/Test.sol";
 
import "../harness/Mocks.sol";
import "./harness/AaveHarness.sol";
import "../../../contracts/core/FlashLoanExecutor.sol";
 
/// @notice Phase 3B — `FlashLoanExecutor` authorization and profit accounting.
///
/// The executor is owner-driven: an unprivileged actor cannot borrow through it.
/// These tests pin that boundary down and then probe the one place where the
/// contract's own bookkeeping can drift from the tokens it actually holds.
contract FlashLoanExecutorTest is Test {
    MockERC20 internal asset;
    MockAavePool internal pool;
    MockAddressesProvider internal provider;
    FlashLoanExecutor internal executor;
    ProfitableStrategy internal goodStrategy;
    FailingStrategy internal badStrategy;
 
    address internal owner = address(this);
    address internal attacker = address(0xBAD);
 
    uint256 internal constant LOAN = 1_000_000e18;
 
    function setUp() public {
        asset = new MockERC20("USD Coin", "USDC", 18);
        pool = new MockAavePool();
        provider = new MockAddressesProvider(address(pool));
        executor = new FlashLoanExecutor(address(provider));
 
        goodStrategy = new ProfitableStrategy(100); // +1%
        badStrategy = new FailingStrategy(9_995); // returns 99.95% of principal
 
        executor.configureStrategy(address(goodStrategy), true, 10_000_000e18);
        executor.configureStrategy(address(badStrategy), true, 10_000_000e18);
 
        asset.mint(address(pool), 10_000_000e18);
        asset.mint(address(goodStrategy), 1_000_000e18); // arbitrage proceeds
    }
 
    /// @dev The executor credits `delta - premium`; a strategy must report that
    ///      net figure or be rejected (see `test_GrossProfitReportingAlwaysReverts`).
    function _netProfit(uint256 loan, uint256 gainBps) internal pure returns (uint256) {
        return (loan * gainBps) / 10_000 - (loan * 5) / 10_000;
    }
 
    function _reportNet(uint256 loan, uint256 gainBps) internal {
        goodStrategy.setReportedProfitOverride(_netProfit(loan, gainBps));
    }
 
    // ------------------------------------------------------------------
    // A. Unauthorized initiation
    // ------------------------------------------------------------------
 
    /// @notice NEGATIVE RESULT: borrowing through the executor is owner-only, so
    ///         no unprivileged actor can point protocol capital at a strategy.
    function test_UnauthorizedActorCannotInitiate() public {
        vm.prank(attacker);
        vm.expectRevert(FlashLoanExecutor.Unauthorized.selector);
        executor.executeFlashLoan(address(asset), LOAN, address(goodStrategy), "");
    }
 
    /// @notice NEGATIVE RESULT: even the owner cannot route to an unconfigured
    ///         strategy, or exceed its configured ceiling.
    function test_StrategyAllowlistAndCeilingAreEnforced() public {
        ProfitableStrategy rogue = new ProfitableStrategy(100);
 
        vm.expectRevert(FlashLoanExecutor.StrategyNotAuthorized.selector);
        executor.executeFlashLoan(address(asset), LOAN, address(rogue), "");
 
        executor.configureStrategy(address(goodStrategy), true, LOAN - 1);
        vm.expectRevert(FlashLoanExecutor.AmountExceedsLimit.selector);
        executor.executeFlashLoan(address(asset), LOAN, address(goodStrategy), "");
    }
 
    // ------------------------------------------------------------------
    // B. Direct callback
    // ------------------------------------------------------------------
 
    /// @notice NEGATIVE RESULT: the callback is triple-guarded. Outside a live
    ///         flash loan the sentinel rejects it first, so a spoofed callback
    ///         cannot make the executor hand tokens to an attacker's "strategy".
    function test_DirectCallbackOutsideFlashLoanReverts() public {
        address[] memory assets = new address[](1);
        uint256[] memory amounts = new uint256[](1);
        uint256[] memory premiums = new uint256[](1);
        assets[0] = address(asset);
        amounts[0] = LOAN;
        premiums[0] = 0;
        bytes memory params = abi.encode(bytes32(0), address(asset), LOAN, address(goodStrategy), bytes(""));
 
        vm.prank(attacker);
        vm.expectRevert(FlashLoanExecutor.NotInFlashLoan.selector);
        executor.executeOperation(assets, amounts, premiums, address(executor), params);
 
        // Same from the real pool address: the sentinel is checked before the caller.
        vm.prank(address(pool));
        vm.expectRevert(FlashLoanExecutor.NotInFlashLoan.selector);
        executor.executeOperation(assets, amounts, premiums, address(executor), params);
    }
 
    /// @notice NEGATIVE RESULT: re-entering `executeFlashLoan` from inside a live
    ///         flash loan hits the reentrancy guard, so the callback context
    ///         cannot be stacked.
    function test_ReentrantInitiationIsBlocked() public {
        ReentrantStrategy reentrant = new ReentrantStrategy(address(executor), address(goodStrategy));
        executor.configureStrategy(address(reentrant), true, 10_000_000e18);
        asset.mint(address(reentrant), 1_000e18);
 
        // The inner call fails; the outer one then fails to repay, so the whole
        // transaction reverts. Either way no loan is nested.
        vm.expectRevert();
        executor.executeFlashLoan(address(asset), LOAN, address(reentrant), "");
    }
 
    // ------------------------------------------------------------------
    // C. Profit accounting
    // ------------------------------------------------------------------
 
    /// @notice CONFIRMED DESIGN RISK: `ArbitrageStrategy.execute` reports
    ///         `finalBalance - amount` — profit *gross* of the Aave premium —
    ///         while the executor compares that figure against `delta - premium`.
    ///         The reported value therefore exceeds the measured one on every
    ///         profitable run, and the pairing reverts no matter how good the
    ///         arbitrage is. Only losing runs can complete.
    function test_GrossProfitReportingAlwaysReverts() public {
        goodStrategy.setGainBps(500); // a healthy 5%, far above the 0.5% floor
        vm.expectRevert(
            abi.encodeWithSelector(
                FlashLoanExecutor.ReportedProfitExceedsActual.selector,
                (LOAN * 500) / 10_000,
                _netProfit(LOAN, 500)
            )
        );
        executor.executeFlashLoan(address(asset), LOAN, address(goodStrategy), "");
    }
 
    /// @notice Baseline: a genuinely profitable execution credits exactly the
    ///         net gain, and the credited amount is really held.
    function test_ProfitCreditMatchesHeldBalanceOnSuccess() public {
        _reportNet(LOAN, 100);
        executor.executeFlashLoan(address(asset), LOAN, address(goodStrategy), "");
 
        uint256 credited = executor.getAvailableProfit(address(asset));
        uint256 held = asset.balanceOf(address(executor));
 
        uint256 premium = (LOAN * 5) / 10_000;
        assertEq(credited, (LOAN * 100) / 10_000 - premium, "1% gain less the 5 bps premium");
        assertEq(held, credited, "credited profit is fully backed");
    }
 
    /// @notice NEGATIVE RESULT: a strategy that under-delivers cannot be booked
    ///         as a win — the executor measures its own balance delta rather
    ///         than trusting the strategy's return value.
    function test_ThinProfitIsRejectedRatherThanBooked() public {
        goodStrategy.setGainBps(10); // 0.1%, below the 0.5% MIN_PROFIT_BPS floor
        vm.expectRevert(FlashLoanExecutor.InsufficientProfit.selector);
        executor.executeFlashLoan(address(asset), LOAN, address(goodStrategy), "");
    }
 
    /// @notice NEGATIVE RESULT: a strategy that overstates its profit is caught
    ///         by the cross-check against the measured delta.
    function test_OverstatedProfitIsRejected() public {
        goodStrategy.setReportedProfitOverride(LOAN); // claim the whole principal as profit
        vm.expectRevert();
        executor.executeFlashLoan(address(asset), LOAN, address(goodStrategy), "");
    }
 
    /// @notice CONFIRMED DESIGN RISK: the recoverable-failure branch tolerates a
    ///         loss of up to `MAX_LOSS_BPS` and records the failure, but never
    ///         debits `profitBalances`. The loss is silently absorbed by whatever
    ///         the executor already held, so recorded profit drifts above the
    ///         balance actually available to withdraw.
    function test_ToleratedLossIsNotDebitedFromRecordedProfit() public {
        // Bank a real profit first.
        _reportNet(LOAN, 100);
        executor.executeFlashLoan(address(asset), LOAN, address(goodStrategy), "");
        uint256 creditedBefore = executor.getAvailableProfit(address(asset));
        uint256 heldBefore = asset.balanceOf(address(executor));
        assertEq(creditedBefore, heldBefore, "book and balance start in sync");
 
        // A strategy failure inside the tolerated loss band.
        uint256 smallLoan = 100_000e18;
        executor.executeFlashLoan(address(asset), smallLoan, address(badStrategy), "");
 
        uint256 creditedAfter = executor.getAvailableProfit(address(asset));
        uint256 heldAfter = asset.balanceOf(address(executor));
 
        emit log_named_decimal_uint("recorded profit", creditedAfter, 18);
        emit log_named_decimal_uint("actual balance ", heldAfter, 18);
 
        assertEq(creditedAfter, creditedBefore, "the loss never touches the profit ledger");
        assertLt(heldAfter, creditedAfter, "recorded profit now exceeds tokens held");
 
        // The divergence is not silently exploitable: withdrawing the recorded
        // amount simply reverts once the balance is short.
        vm.expectRevert();
        executor.withdrawProfit(address(asset), creditedAfter);
    }
 
    /// @notice NEGATIVE RESULT: a loss beyond the tolerance band reverts the whole
    ///         execution, so the drift above is bounded by MAX_LOSS_BPS per run.
    function test_ExcessiveLossRevertsTheExecution() public {
        badStrategy.setReturnBps(9_000); // lose 10%
        asset.mint(address(executor), 200_000e18); // enough to still repay Aave
        vm.expectRevert(FlashLoanExecutor.ExcessiveLoss.selector);
        executor.executeFlashLoan(address(asset), 100_000e18, address(badStrategy), "");
    }
 
    /// @notice A strategy that *reverts* rolls back its own repayment, so the
    ///         executor is left having transferred the whole principal out. That
    ///         is always beyond MAX_LOSS_BPS, so the entire transaction reverts:
    ///         the recoverable branch is reachable only via a strategy that
    ///         returns `false` without reverting.
    function test_RevertingStrategyLosesTheWholePrincipalAndAborts() public {
        badStrategy.setRevertHard(true);
        asset.mint(address(executor), 200_000e18);
 
        vm.expectRevert();
        executor.executeFlashLoan(address(asset), 100_000e18, address(badStrategy), "");
 
        assertEq(asset.balanceOf(address(executor)), 200_000e18, "no state survives the abort");
    }
 
    /// @notice NEGATIVE RESULT: profit withdrawal is owner-only, so the drift
    ///         above cannot be turned into an unprivileged extraction.
    function test_ProfitWithdrawalIsOwnerOnly() public {
        _reportNet(LOAN, 100);
        executor.executeFlashLoan(address(asset), LOAN, address(goodStrategy), "");
 
        vm.prank(attacker);
        vm.expectRevert(FlashLoanExecutor.Unauthorized.selector);
        executor.withdrawProfit(address(asset), 0);
    }
 
    /// @notice Fuzzed: for any tolerated-loss sequence, the gap between recorded
    ///         profit and held balance never exceeds the sum of the tolerated
    ///         losses, i.e. MAX_LOSS_BPS per execution.
    function testFuzz_AccountingDriftIsBoundedByToleratedLoss(uint256 loanSize, uint8 rounds) public {
        loanSize = bound(loanSize, 10_000e18, 500_000e18);
        rounds = uint8(bound(rounds, 1, 5));
 
        _reportNet(LOAN, 100);
        executor.executeFlashLoan(address(asset), LOAN, address(goodStrategy), "");
 
        uint256 maxDrift;
        for (uint256 i = 0; i < rounds; ++i) {
            executor.executeFlashLoan(address(asset), loanSize, address(badStrategy), "");
            maxDrift += (loanSize * 10) / 10_000 + 1; // MAX_LOSS_BPS, plus flooring slack
        }
 
        uint256 credited = executor.getAvailableProfit(address(asset));
        uint256 held = asset.balanceOf(address(executor));
        assertLe(credited - held, maxDrift, "drift bounded by the tolerated loss band");
    }
}