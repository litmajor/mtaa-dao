// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./Phase2Base.sol";

/// @title  Composition of individually valid operations (Phase 2 core question)
/// @notice Each test runs a sequence in which every single step is permitted by
///         the contract's own authorization rules, then reconciles the vault's
///         accounting against an independently maintained ledger and prints the
///         per-actor economics. The question is not "does a call revert" but
///         "can the sum of legal operations create or destroy value".
contract EconomicCompositionTest is Phase2Base {
    function setUp() public override {
        super.setUp();
        _fund(attacker, 1_000_000e18);
        _fund(victim, 1_000_000e18);
        _fund(bob, 1_000_000e18);
        _fund(carol, 1_000_000e18);
        _resetLedger();
    }

    function _holders() internal view returns (address[] memory hs) {
        hs = new address[](4);
        hs[0] = attacker;
        hs[1] = victim;
        hs[2] = bob;
        hs[3] = carol;
    }

    // ==================================================================
    // Scenario A — deposit -> donation -> deposit -> withdraw -> withdraw
    // ==================================================================
    function test_ScenarioA_DonationBetweenDeposits() public {
        uint256 attackerStart = asset.balanceOf(attacker);
        uint256 victimStart = asset.balanceOf(victim);

        _depositTracked(attacker, 1_000e18);
        _donateTracked(attacker, 5_000e18);
        _depositTracked(victim, 10_000e18);
        _assertConservation("A: after deposits");

        uint256 attackerOut = _redeemAllTracked(attacker);
        uint256 victimOut = _redeemAllTracked(victim);

        _logLedger("A");
        _logPnl("attacker", attackerStart, asset.balanceOf(attacker));
        _logPnl("victim", victimStart, asset.balanceOf(victim));
        _assertConservation("A: after exits");

        // The donation is captured by whoever holds shares when it lands, and
        // the attacker only holds ~1/7 of the pool at that moment: donating is
        // a transfer of value *to* the later depositor, never from them.
        assertLt(asset.balanceOf(attacker), attackerStart, "attacker must lose the donation");
        assertGe(asset.balanceOf(victim), victimStart, "victim never loses principal");
        assertLe(attackerOut, 1_000e18 + 5_000e18, "attacker cannot recover more than it put in");
        assertGe(victimOut, 10_000e18, "victim redeems at least its principal");
    }

    /// @notice Same shape, fuzzed: no ordering of donation and second deposit
    ///         makes the donor profitable.
    function testFuzz_ScenarioA_DonationIsNeverProfitable(uint96 first, uint96 donation, uint96 second) public {
        uint256 a = bound(uint256(first), 1e6, 100_000e18);
        uint256 d = bound(uint256(donation), 0, 100_000e18);
        uint256 v = bound(uint256(second), 1e6, 100_000e18);

        uint256 attackerStart = asset.balanceOf(attacker);
        uint256 victimStart = asset.balanceOf(victim);

        _depositTracked(attacker, a);
        _donateTracked(attacker, d);
        if (vault.previewDeposit(v) == 0) {
            // P2-3: the victim is refused instead of being absorbed, so the donation
            // attack has no target at all.
            vm.prank(victim);
            vm.expectRevert(MaonoVault_Phase1B.ZeroShares.selector);
            vault.deposit(v, victim);
            assertEq(asset.balanceOf(victim), victimStart, "victim keeps its capital");
        } else {
            _depositTracked(victim, v);
        }
        _redeemAllTracked(attacker);
        _redeemAllTracked(victim);

        _assertConservation("A fuzz");
        assertLe(asset.balanceOf(attacker), attackerStart, "donor profited");
        // The victim can lose at most the deposit that rounded down to zero
        // shares (see test_ZeroShareDepositIsSilentlyAbsorbed) plus dust, and
        // the donation always costs the attacker strictly more than that.
        uint256 victimLoss = victimStart - asset.balanceOf(victim);
        uint256 attackerLoss = attackerStart - asset.balanceOf(attacker);
        assertLe(victimLoss, v, "victim lost more than it deposited");
        if (victimLoss > 2) {
            assertGt(attackerLoss, victimLoss, "attack must cost more than it takes");
        }
    }

    // ==================================================================
    // Scenario B — deposit -> donation -> upkeep -> withdrawal
    // ==================================================================
    /// @notice Upkeep is denominated in MTAA and pulled from the owner's own
    ///         balance, so it cannot re-allocate a donation. The donation goes
    ///         entirely to shareholders; the protocol and the fee recipient
    ///         receive nothing from it.
    function test_ScenarioB_UpkeepDoesNotTouchDonations() public {
        _depositTracked(bob, 10_000e18);
        _donateTracked(carol, 1_000e18);

        uint256 treasuryAssetBefore = asset.balanceOf(treasury);
        uint256 pricePerShareBefore = vault.convertToAssets(1e21);

        _fundOwnerWithMtaa(1_000e18);
        _upkeep();

        assertEq(asset.balanceOf(treasury), treasuryAssetBefore, "treasury received asset from a donation");
        assertEq(vault.convertToAssets(1e21), pricePerShareBefore, "upkeep repriced shares");
        _assertConservation("B: after upkeep");

        uint256 out = _redeemAllTracked(bob);
        assertApproxEqAbs(out, 11_000e18, 1, "sole depositor receives principal + full donation");
        _logLedger("B");

        // The upkeep really was charged — in MTAA, from the owner.
        (,, uint256 paid, uint256 burned, uint256 toTreasury) = vault.getVaultMetrics();
        assertGt(paid, 0);
        assertEq(paid, burned + toTreasury, "MTAA conserved: paid == burned + treasury");
    }

    // ==================================================================
    // Scenario C — deposit -> fee accrual -> deposit -> redeem -> redeem
    // ==================================================================
    /// @notice The canonical vault has no asset-denominated fee of any kind
    ///         (no entry, exit, management or performance fee), so "fee accrual"
    ///         cannot dilute the second depositor. Twelve upkeep cycles change
    ///         nothing about the share price.
    function test_ScenarioC_NoAssetFeeAccrualBetweenDeposits() public {
        _fundOwnerWithMtaa(100_000e18);

        _depositTracked(bob, 10_000e18);
        uint256 priceAfterFirst = vault.convertToAssets(1e21);

        for (uint256 i = 0; i < 12; ++i) {
            _upkeep();
        }
        assertEq(vault.convertToAssets(1e21), priceAfterFirst, "a year of upkeep repriced shares");

        _depositTracked(carol, 10_000e18);
        uint256 bobOut = _redeemAllTracked(bob);
        uint256 carolOut = _redeemAllTracked(carol);

        _logLedger("C");
        _assertConservation("C");
        assertEq(bobOut, 10_000e18);
        assertEq(carolOut, 10_000e18);
    }

    // ==================================================================
    // Scenario E — hibernation: can a depositor be permanently trapped?
    // ==================================================================
    /// @notice P2-2 regression. Depositors used to be trapped for exactly as long as
    ///         the owner chose: reactivation is `onlyOwner` and needs MTAA depositors
    ///         cannot supply, with no self-service exit, no timeout and no guardian.
    ///         The trap is now bounded by EXIT_GRACE_PERIOD, after which redemptions
    ///         work regardless of the owner. Reactivation stays owner-only.
    function test_ScenarioE_HibernationTrapIsOwnerReleasedOnly() public {
        _depositTracked(bob, 50_000e18);
        _hibernate();

        // A depositor holding plenty of MTAA still cannot buy its own way out.
        mtaa.mint(bob, 1_000_000e18);
        vm.prank(bob);
        mtaa.approve(address(vault), type(uint256).max);
        vm.prank(bob);
        vm.expectRevert(abi.encodeWithSignature("OwnableUnauthorizedAccount(address)", bob));
        vault.reactivateFromHibernation();

        // The freeze bites immediately...
        uint256 bobShares = vault.balanceOf(bob);
        vm.prank(bob);
        vm.expectRevert(MaonoVault_Phase1B.VaultIsHibernating.selector);
        vault.redeem(bobShares, bob, bob);
        assertEq(vault.maxRedeem(bob), 0, "max* agrees while the freeze holds");

        // ...but P2-2: it expires. After EXIT_GRACE_PERIOD the depositor leaves
        // without needing the owner's cooperation at all.
        vm.warp(block.timestamp + vault.EXIT_GRACE_PERIOD());
        assertTrue(vault.exitsOpen(), "exits reopen once the freeze has run its course");
        assertEq(vault.maxRedeem(bob), bobShares);

        console2.log("  frozen assets      :", vault.totalAssets());
        console2.log("  months hibernating :", vault.getMonthsSinceHibernation());

        // Value is preserved throughout: this is a liveness failure, not theft.
        _assertConservation("E: frozen");
        assertApproxEqAbs(_redeemAllTracked(bob), 50_000e18, 1, "principal intact and self-recoverable");
        assertEq(_status(), 1, "the vault is still hibernating; only the exit reopened");
    }

    // ==================================================================
    // Scenario F — pause: exactly which operations survive
    // ==================================================================
    function test_ScenarioF_PauseMatrix() public {
        uint256 shares = _depositTracked(bob, 10_000e18);

        vm.prank(vaultOwner);
        vault.pause();

        vm.prank(bob);
        vm.expectRevert(abi.encodeWithSignature("EnforcedPause()"));
        vault.withdraw(1e18, bob, bob);
        vm.prank(bob);
        vm.expectRevert(abi.encodeWithSignature("EnforcedPause()"));
        vault.redeem(shares, bob, bob);

        // Share transfers and approvals stay live while paused: a depositor can
        // still sell the claim, and previews keep answering.
        vm.prank(bob);
        vault.transfer(carol, shares / 2);
        assertEq(vault.previewRedeem(shares / 2), 5_000e18, "previews still quote a paused vault");

        vm.prank(vaultOwner);
        vault.unpause();

        uint256 bobOut = _redeemAllTracked(bob);
        uint256 carolOut = _redeemAllTracked(carol);
        assertEq(bobOut + carolOut, 10_000e18, "no value lost across the pause window");
        _assertConservation("F");
    }

    // ==================================================================
    // Scenario G — is there any privileged asset-exfiltration path at all?
    // ==================================================================
    /// @notice The canonical vault has no `emergencyWithdraw`, `sweep` or
    ///         `rescueTokens`. This exhausts every owner-only entry point in the
    ///         ABI and asserts that none of them can move the underlying asset.
    function test_ScenarioG_NoOwnerPathMovesTheUnderlyingAsset() public {
        _depositTracked(bob, 10_000e18);
        uint256 assetsBefore = vault.totalAssets();
        uint256 ownerAssetsBefore = asset.balanceOf(vaultOwner);

        bytes[] memory calls = new bytes[](11);
        calls[0] = abi.encodeWithSignature("emergencyWithdraw(uint256)", assetsBefore);
        calls[1] = abi.encodeWithSignature("sweep(address,uint256)", address(asset), assetsBefore);
        calls[2] = abi.encodeWithSignature("rescueTokens(address,uint256)", address(asset), assetsBefore);
        calls[3] = abi.encodeWithSignature("skim(address)", vaultOwner);
        calls[4] = abi.encodeWithSignature("setDaoTreasury(address)", vaultOwner);
        calls[5] = abi.encodeWithSignature("setPriceOracle(address)", vaultOwner);
        calls[6] = abi.encodeWithSignature("setUpkeepCostAt(uint256,uint256)", uint256(0), uint256(0));
        calls[7] = abi.encodeWithSignature("setBurnPercentageAt(uint256,uint256)", uint256(0), uint256(0));
        calls[8] = abi.encodeWithSignature("setOracleBounds(uint256,uint256)", uint256(1), uint256(2));
        calls[9] = abi.encodeWithSignature("setOracleCircuitEnabled(bool)", false);
        calls[10] = abi.encodeWithSignature("pause()");

        vm.startPrank(vaultOwner);
        for (uint256 i = 0; i < calls.length; ++i) {
            (bool ok,) = address(vault).call(calls[i]);
            ok; // some selectors do not exist; what matters is the balance below
        }
        vm.stopPrank();

        assertEq(vault.totalAssets(), assetsBefore, "an owner call moved depositor assets");
        assertEq(asset.balanceOf(vaultOwner), ownerAssetsBefore, "owner extracted assets");

        vm.prank(vaultOwner);
        vault.unpause();
        assertEq(_redeemAllTracked(bob), 10_000e18, "depositor still whole");
    }

    // ==================================================================
    // Scenario H — share transfers composed with donations
    // ==================================================================
    /// @notice Share transfers carry the economic claim with them: value follows
    ///         the shares, not the original depositor, and a donation that lands
    ///         after a transfer accrues to the new holder.
    function test_ScenarioH_TransferThenDonation() public {
        uint256 aliceShares = _depositTracked(victim, 10_000e18);

        vm.prank(victim);
        vault.transfer(bob, aliceShares);

        _donateTracked(carol, 2_000e18);

        assertEq(vault.balanceOf(victim), 0);
        assertEq(vault.previewRedeem(0), 0);

        uint256 bobOut = _redeemAllTracked(bob);
        assertApproxEqAbs(bobOut, 12_000e18, 1, "donation follows the shares");
        _assertConservation("H");
    }

    /// @notice Partial transfers split the donation pro rata with no leakage.
    function test_ScenarioH_PartialTransferSplitsDonationProRata() public {
        uint256 shares = _depositTracked(victim, 9_000e18);
        vm.prank(victim);
        vault.transfer(bob, shares / 3);
        _donateTracked(carol, 900e18);

        uint256 victimOut = _redeemAllTracked(victim);
        uint256 bobOut = _redeemAllTracked(bob);

        assertApproxEqAbs(bobOut, 3_300e18, 2, "1/3 of principal + 1/3 of donation");
        assertApproxEqAbs(victimOut, 6_600e18, 2, "2/3 of principal + 2/3 of donation");
        assertLe(victimOut + bobOut, 9_900e18, "no value created");
        _assertConservation("H partial");
    }

    // ==================================================================
    // Scenario I — many depositors, extreme amount spread, arbitrary exits
    // ==================================================================
    function test_ScenarioI_MixedMagnitudeDepositsAndArbitraryExitOrder() public {
        uint256[6] memory amounts = [uint256(1), uint256(2), uint256(10), uint256(1_000), uint256(1e6), uint256(1e18)];
        address[] memory actors = new address[](6);
        uint256[] memory starts = new uint256[](6);

        for (uint256 i = 0; i < 6; ++i) {
            actors[i] = address(uint160(uint256(keccak256(abi.encode("depositor", i)))));
            _fund(actors[i], 1e24);
            starts[i] = asset.balanceOf(actors[i]);
        }

        // Interleaved deposits, ascending.
        for (uint256 i = 0; i < 6; ++i) {
            _depositTracked(actors[i], amounts[i]);
        }
        _assertConservation("I: after deposits");

        // Exits in an unrelated (reverse) order.
        for (uint256 i = 6; i > 0; --i) {
            uint256 idx = i - 1;
            uint256 out = _redeemAllTracked(actors[idx]);
            assertLe(out, amounts[idx], "a depositor extracted more than it deposited");
            console2.log("  deposited / redeemed:", amounts[idx], out);
        }

        _assertConservation("I: after exits");
        // Every unit of value that was not returned is rounding dust retained by
        // the vault; nothing was created.
        assertLe(vault.totalAssets(), 6, "more than dust stranded");
        assertEq(vault.totalSupply(), 0);
    }

    // ==================================================================
    // Scenario I (cont.) — deposits that round down to zero shares
    // ==================================================================
    /// @notice FINDING (L, user-self-harm / griefing): once the share price
    ///         exceeds the deposit, `deposit()` mints zero shares and keeps the
    ///         assets. The legacy vault had a `minDeposit` guard; the canonical
    ///         vault dropped it and ERC-4626's virtual-share offset only shifts
    ///         the threshold, it does not remove it. The attacker cannot profit
    ///         (seeding the price costs more than the theft), so this is a loss
    ///         users inflict on themselves in a high-priced vault.
    /// @notice P2-3 regression (was: test_ZeroShareDepositIsSilentlyAbsorbed).
    ///         A deposit that mints nothing used to succeed, handing the assets to the
    ///         incumbent holders. It reverts now, and nothing moves.
    function test_ZeroShareDepositIsRejected() public {
        _depositTracked(bob, 1e18);
        _donateTracked(bob, 900_000e18); // share price now ~900 wei of asset per share

        uint256 victimStart = asset.balanceOf(victim);
        uint256 assetsBefore = vault.totalAssets();

        vm.prank(victim);
        vm.expectRevert(MaonoVault_Phase1B.ZeroShares.selector);
        vault.deposit(500, victim);

        assertEq(asset.balanceOf(victim), victimStart, "no assets taken");
        assertEq(vault.balanceOf(victim), 0, "no shares minted");
        assertEq(vault.totalAssets(), assetsBefore, "incumbents gained nothing");
        _assertConservation("zero-share deposit rejected");

        uint256 bobOut = _redeemAllTracked(bob);
        assertApproxEqAbs(bobOut, assetsBefore, 1e6, "incumbent redeems only its own deposit and donation");
    }

    /// @notice `previewDeposit` and `deposit` agree: what the preview says is worthless
    ///         the vault refuses to accept.
    function test_ZeroShareDepositIsPredictableOffChain() public {
        _depositTracked(bob, 1e18);
        _donateTracked(bob, 900_000e18);
        assertEq(vault.previewDeposit(500), 0, "preview warns before the loss");
        assertGt(vault.maxDeposit(victim), 0, "the vault is open for economically real deposits");

        vm.prank(victim);
        vm.expectRevert(MaonoVault_Phase1B.ZeroShares.selector);
        vault.deposit(500, victim);
    }

    /// @notice Dust deposits cannot be laundered into value by repeating them.
    function test_ScenarioI_RepeatedDustCyclesNeverCreateValue() public {
        _depositTracked(bob, 1_000e18); // establish a non-trivial share price
        _donateTracked(carol, 500e18);

        uint256 start = asset.balanceOf(attacker);
        for (uint256 i = 0; i < 250; ++i) {
            _depositTracked(attacker, 3);
            _redeemAllTracked(attacker);
        }
        _logPnl("dust cycler", start, asset.balanceOf(attacker));
        assertLe(asset.balanceOf(attacker), start, "dust cycling created value");
        _assertConservation("I dust");
        _assertClaimsAreBacked(_holders(), "I dust");
    }
}
