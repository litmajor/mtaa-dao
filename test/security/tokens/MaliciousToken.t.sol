// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../Base.t.sol";

/// @notice Reenters the vault from inside an ERC20 transfer callback.
contract ReentrantDepositor is IReentrancyHook {
    MaonoVault_Phase1B public vault;
    ReentrantERC20 public token;
    bool public armed;
    bool public reenterAttempted;
    bool public reenterSucceeded;
    bytes public lastRevert;

    constructor(MaonoVault_Phase1B _vault, ReentrantERC20 _token) {
        vault = _vault;
        token = _token;
    }

    function arm() external {
        armed = true;
    }

    function deposit(uint256 amount) external {
        token.approve(address(vault), type(uint256).max);
        vault.deposit(amount, address(this));
    }

    function redeemAll() external {
        vault.redeem(vault.balanceOf(address(this)), address(this), address(this));
    }

    function onTokenTransfer(address, address, uint256) external override {
        if (!armed) return;
        armed = false;
        reenterAttempted = true;
        // Cross-function reentrancy: try to withdraw while a deposit is still
        // in flight (assets already moved, shares not yet minted).
        try vault.withdraw(1, address(this), address(this)) {
            reenterSucceeded = true;
        } catch (bytes memory err) {
            lastRevert = err;
        }
    }
}

/// @title  Malicious / non-standard ERC20 behaviour at Mtaa's trust boundary
/// @notice The vault's underlying asset is chosen by the factory owner
///         (`addSupportedAsset`), so a hostile asset is a *privileged*
///         misconfiguration, not an unprivileged attack. These tests measure
///         what such a misconfiguration would cost depositors.
contract MaliciousTokenTest is MaonoVaultBaseTest {
    // ------------------------------------------------------------------
    // Fee-on-transfer asset: the vault credits `assets` requested, not
    // `assets` received.
    // ------------------------------------------------------------------
    function test_FeeOnTransferToken_BreaksShareAccounting() public {
        FeeOnTransferERC20 fot = new FeeOnTransferERC20(100); // 1%
        _deployVaultWithAsset(address(fot), 0);

        fot.mint(victim, 1_000e18);
        vm.startPrank(victim);
        fot.approve(address(vault), type(uint256).max);
        uint256 shares = vault.deposit(1_000e18, victim);
        vm.stopPrank();

        uint256 received = fot.balanceOf(address(vault));
        console2.log("  assets requested :", uint256(1_000e18));
        console2.log("  assets received  :", received);
        console2.log("  shares minted    :", shares);
        console2.log("  redeemable       :", vault.previewRedeem(shares));

        // Accounting != economic reality: shares were minted for value the
        // vault never received.
        assertEq(received, 990e18);
        assertGt(vault.convertToAssets(shares) + 1, received, "shares over-issued vs assets held");

        // Second depositor now subsidises the first one's shortfall.
        fot.mint(bob, 1_000e18);
        vm.startPrank(bob);
        fot.approve(address(vault), type(uint256).max);
        vault.deposit(1_000e18, bob);
        vm.stopPrank();

        uint256 victimShares = vault.balanceOf(victim);
        vm.prank(victim);
        uint256 out = vault.redeem(victimShares, victim, victim);
        console2.log("  first depositor exit value:", out);
        uint256 bobClaim = vault.previewRedeem(vault.balanceOf(bob));
        console2.log("  second depositor claim    :", bobClaim);
        // Neither depositor can be made whole: every participant silently pays
        // the transfer fee twice (in and out) and the shortfall is socialised.
        assertLt(out, 1_000e18, "first depositor exits below principal");
        assertLt(bobClaim, 1_000e18, "second depositor claim below principal");
        assertEq(vault.totalAssets(), fot.balanceOf(address(vault)));
    }

    // ------------------------------------------------------------------
    // Rebasing asset: totalAssets tracks balanceOf, so a negative rebase
    // silently reduces every depositor's claim.
    // ------------------------------------------------------------------
    function test_RebasingToken_NegativeRebaseSocialisesLoss() public {
        RebasingERC20 rb = new RebasingERC20();
        _deployVaultWithAsset(address(rb), 0);

        rb.mint(victim, 1_000e18);
        vm.startPrank(victim);
        rb.approve(address(vault), type(uint256).max);
        uint256 shares = vault.deposit(1_000e18, victim);
        vm.stopPrank();

        assertApproxEqAbs(vault.previewRedeem(shares), 1_000e18, 2);
        rb.setScaleBps(5_000); // -50% rebase
        console2.log("  claim after -50% rebase:", vault.previewRedeem(shares));
        assertApproxEqAbs(vault.previewRedeem(shares), 500e18, 2);

        // Positive rebase is likewise credited pro-rata, so no user can front
        // run it for free: the share price simply moves.
        rb.setScaleBps(20_000);
        assertGt(vault.previewRedeem(shares), 1_000e18);
    }

    // ------------------------------------------------------------------
    // Silent-failure ERC20 (returns false, never reverts).
    // ------------------------------------------------------------------
    function test_SilentFailureToken_IsRejectedBySafeERC20() public {
        WeirdReturnERC20 weird = new WeirdReturnERC20();
        _deployVaultWithAsset(address(weird), 0);

        weird.mint(victim, 1_000e18);
        vm.prank(victim);
        weird.approve(address(vault), type(uint256).max);

        weird.setReturnFalse(true);
        vm.prank(victim);
        vm.expectRevert(); // SafeERC20FailedOperation
        vault.deposit(1_000e18, victim);
        assertEq(vault.totalSupply(), 0, "no shares minted on a failed transfer");
    }

    // ------------------------------------------------------------------
    // USDT-style token returning no data must still work.
    // ------------------------------------------------------------------
    function test_NoReturnDataToken_Works() public {
        WeirdReturnERC20 weird = new WeirdReturnERC20();
        _deployVaultWithAsset(address(weird), 0);
        weird.setReturnNothing(true);

        weird.mint(victim, 1_000e18);
        vm.startPrank(victim);
        weird.approve(address(vault), type(uint256).max);
        uint256 shares = vault.deposit(1_000e18, victim);
        vm.stopPrank();
        assertGt(shares, 0);
        assertEq(weird.balanceOf(address(vault)), 1_000e18);
    }

    // ------------------------------------------------------------------
    // ERC777-style reentrancy through the asset's transfer hook.
    // ------------------------------------------------------------------
    function test_ReentrantToken_CannotReenterDeposit() public {
        ReentrantERC20 rnt = new ReentrantERC20();
        _deployVaultWithAsset(address(rnt), 0);

        // Seed liquidity so a reentrant withdraw would actually have funds.
        rnt.mint(bob, 1_000e18);
        vm.startPrank(bob);
        rnt.approve(address(vault), type(uint256).max);
        vault.deposit(1_000e18, bob);
        vm.stopPrank();

        ReentrantDepositor evil = new ReentrantDepositor(vault, rnt);
        rnt.mint(address(evil), 100e18);
        rnt.setHook(address(evil));
        evil.arm();

        evil.deposit(100e18);

        assertTrue(evil.reenterAttempted(), "hook must have fired");
        assertFalse(evil.reenterSucceeded(), "nonReentrant must block cross-function reentrancy");
        assertEq(
            keccak256(evil.lastRevert()),
            keccak256(abi.encodeWithSignature("Error(string)", "ReentrancyGuard: reentrant call")),
            "reentry must be rejected by the guard"
        );
        // The deposit itself completes normally and the accounting is exact.
        assertEq(vault.totalAssets(), 1_100e18);
        assertEq(vault.previewRedeem(vault.balanceOf(address(evil))), 100e18);
    }

    // ------------------------------------------------------------------
    // Forced transfer of the underlying directly to the vault (no hook,
    // no approval): the vault must not break, only re-price.
    // ------------------------------------------------------------------
    function test_ForcedUnderlyingTransfer_OnlyRepricesShares() public {
        _fund(bob, 1_000e18);
        uint256 shares = _deposit(bob, 1_000e18);

        address stranger = address(0xF04CED);
        asset.mint(stranger, 500e18);
        vm.prank(stranger);
        asset.transfer(address(vault), 500e18);

        assertEq(vault.balanceOf(stranger), 0);
        assertApproxEqAbs(vault.previewRedeem(shares), 1_500e18, 2);
        assertEq(vault.totalAssets(), asset.balanceOf(address(vault)));
    }

    // ------------------------------------------------------------------
    // Malicious MTAA token: burn() reverting must not brick upkeep silently.
    // ------------------------------------------------------------------
    function test_RevertingBurnMTAA_MakesUpkeepUncollectable() public {
        asset = new MockERC20("cUSD", "cUSD", 18);
        RevertingBurnMTAA badMtaa = new RevertingBurnMTAA();
        oracle = new MockPriceOracle(500);
        implementation = new MaonoVault_Phase1B();
        vault = MaonoVault_Phase1B(Clones.clone(address(implementation)));
        vault.initialize(
            address(asset), "v", "v", vaultOwner, 0, treasury, address(badMtaa), address(oracle)
        );

        badMtaa.mint(vaultOwner, 1_000e18);
        vm.prank(vaultOwner);
        badMtaa.approve(address(vault), type(uint256).max);
        vm.warp(block.timestamp + 31 days);

        vm.prank(vaultOwner);
        vm.expectRevert(MaonoVault_Phase1B.BurnFailed.selector);
        vault.collectMonthlyUpkeep();

        // Depositor funds are unaffected: upkeep failure is isolated.
        _fund(bob, 100e18);
        _deposit(bob, 100e18);
        assertEq(vault.totalAssets(), 100e18);
    }
}
