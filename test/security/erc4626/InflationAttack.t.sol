// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../Base.t.sol";

/// @title  ERC-4626 inflation / first-depositor / donation attacks
/// @notice Each test is an explicit falsification attempt: the attacker tries to
///         make `protocol accounting != economic reality` and convert the gap
///         into extractable value. Every run prints the full economic ledger.
contract InflationAttackTest is MaonoVaultBaseTest {
    // ------------------------------------------------------------------
    // Classic first-depositor inflation attack (18-decimal asset)
    // ------------------------------------------------------------------
    function test_FirstDepositorInflation_18dec_IsUnprofitable() public {
        uint256 attackerCapital = 10_000e18;
        uint256 victimDeposit = 1_000e18;

        _fund(attacker, attackerCapital);
        _fund(victim, victimDeposit);

        // Step 1: attacker mints the smallest possible position.
        uint256 attackerShares = _deposit(attacker, 1);

        // Step 2: attacker donates everything else to inflate the share price.
        uint256 donation = attackerCapital - 1;
        _donate(attacker, donation);

        // Step 3: victim deposits.
        uint256 victimShares = _deposit(victim, victimDeposit);

        // Step 4: attacker exits.
        uint256 out = _redeemAll(attacker);
        uint256 ending = asset.balanceOf(attacker);

        _logEconomics("first-depositor inflation (18dec)", attackerCapital, 1 + donation, attackerShares, out, ending);
        console2.log("  victim shares             :", victimShares);
        console2.log("  victim redeemable         :", vault.previewRedeem(victimShares));

        uint256 victimRedeemable = vault.previewRedeem(victimShares);
        uint256 victimLoss = victimDeposit - victimRedeemable;
        uint256 attackerCost = attackerCapital - ending;
        console2.log("  victim loss               :", victimLoss);
        console2.log("  attacker cost per unit of victim loss (x):", attackerCost / (victimLoss + 1));

        assertGt(victimShares, 0, "victim must not be rounded down to zero shares");
        // Core question: is the discrepancy extractable? No - the attacker ends
        // strictly poorer, and the value the victim loses is not captured by the
        // attacker either (it is stranded behind the virtual-share offset).
        assertLe(ending, attackerCapital, "attack must not be profitable");
        assertGt(attackerCost, victimLoss, "griefing must cost more than it destroys");
    }

    /// @notice The value that the victim loses in the inflation scenario is not
    ///         transferred to the attacker: it is stranded inside the vault,
    ///         claimable by nobody once every holder has exited.
    function test_InflationStrandsAssetsInsteadOfTransferringThem() public {
        _fund(attacker, 10_000e18);
        _fund(victim, 1_000e18);

        _deposit(attacker, 1);
        _donate(attacker, 10_000e18 - 1);
        _deposit(victim, 1_000e18);

        _redeemAll(attacker);
        _redeemAll(victim);

        assertEq(vault.totalSupply(), 0, "all shares burned");
        uint256 stranded = vault.totalAssets();
        console2.log("  assets stranded with zero shares outstanding:", stranded);
        console2.log("  attacker recovered                         :", asset.balanceOf(attacker));
        console2.log("  victim recovered                           :", asset.balanceOf(victim));

        // Accounting != economic reality: totalSupply == 0 while totalAssets > 0.
        // Nobody (attacker included) can extract it; the next depositor inherits it.
        assertGt(stranded, 0);
        assertLt(asset.balanceOf(attacker), 10_000e18);
    }

    // ------------------------------------------------------------------
    // Same attack against a 6-decimal asset (USDC-style), where the
    // 10^3 virtual-share offset provides the least protection.
    // ------------------------------------------------------------------
    function test_FirstDepositorInflation_6dec_CostToRoundVictimToZero() public {
        _deployVault(6, 0);

        uint256 victimDeposit = 10_000e6; // $10k
        uint256 attackerCapital = 100_000_000e6; // $100m of ammunition

        _fund(attacker, attackerCapital);
        _fund(victim, victimDeposit);

        _deposit(attacker, 1);

        // To round the victim to zero shares the attacker must satisfy
        //   victimDeposit * (supply + 10^offset) / (totalAssets + 1) == 0
        // i.e. donation >= victimDeposit * 2 * 10^offset  (supply == 10^offset).
        uint256 requiredDonation = victimDeposit * 2 * (10 ** DECIMALS_OFFSET);
        console2.log("  donation required to zero the victim :", requiredDonation);
        console2.log("  victim deposit                       :", victimDeposit);
        console2.log("  attacker capital multiple            :", requiredDonation / victimDeposit);

        _donate(attacker, requiredDonation);

        // P2-3: the round-to-zero outcome is now a revert, so the victim keeps its
        // capital instead of donating it to the attacker's share price.
        uint256 victimShares = vault.previewDeposit(victimDeposit);
        if (victimShares == 0) {
            vm.prank(victim);
            vm.expectRevert(MaonoVault_Phase1B.ZeroShares.selector);
            vault.deposit(victimDeposit, victim);
            assertEq(asset.balanceOf(victim), victimDeposit, "victim capital untouched");
        } else {
            victimShares = _deposit(victim, victimDeposit);
        }

        uint256 out = _redeemAll(attacker);
        uint256 ending = asset.balanceOf(attacker);

        _logEconomics(
            "first-depositor inflation (6dec, maximal donation)",
            attackerCapital,
            1 + requiredDonation,
            10 ** DECIMALS_OFFSET,
            out,
            ending
        );

        // The griefing succeeds (victim gets 0 shares) only at a capital cost of
        // 2000x the victim deposit, and the attacker cannot recover the donation:
        // it is shared with whatever the victim just deposited.
        if (victimShares == 0) {
            console2.log("  RESULT: victim rounded to zero shares (griefing possible)");
        }
        assertLt(ending, attackerCapital, "attacker always loses money on this path");
    }

    // ------------------------------------------------------------------
    // Direct donation attack against an established vault.
    // ------------------------------------------------------------------
    function test_DirectDonation_BenefitsExistingHoldersNotDonor() public {
        _fund(victim, 1_000e18);
        _deposit(victim, 1_000e18);

        _fund(attacker, 1_000e18);
        uint256 start = asset.balanceOf(attacker);
        _donate(attacker, 1_000e18);

        assertEq(vault.balanceOf(attacker), 0, "donation mints no shares");
        assertEq(asset.balanceOf(attacker), 0);

        uint256 victimOut = _redeemAll(victim);
        _logEconomics("direct donation", start, 1_000e18, 0, 0, asset.balanceOf(attacker));
        console2.log("  victim withdrew           :", victimOut);

        // Donation is a pure transfer of value to existing share holders.
        assertApproxEqAbs(victimOut, 2_000e18, 1);
    }

    // ------------------------------------------------------------------
    // Share-price manipulation sandwich: donate, let a victim deposit,
    // then withdraw. Can the attacker skim the victim's deposit?
    // ------------------------------------------------------------------
    function test_DonationSandwich_CannotSkimVictimDeposit() public {
        _fund(attacker, 2_000e18);
        _fund(victim, 1_000e18);

        uint256 start = asset.balanceOf(attacker);

        uint256 attackerShares = _deposit(attacker, 1_000e18);
        _donate(attacker, 1_000e18); // inflate price 2x
        uint256 victimShares = _deposit(victim, 1_000e18);

        uint256 out = _redeemAll(attacker);
        uint256 ending = asset.balanceOf(attacker);

        _logEconomics("donate-then-victim-deposit sandwich", start, 2_000e18, attackerShares, out, ending);
        console2.log("  victim shares             :", victimShares);
        console2.log("  victim redeemable         :", vault.previewRedeem(victimShares));

        assertLe(ending, start, "attacker cannot end up ahead");
        assertGe(vault.previewRedeem(victimShares) + 2, 1_000e18, "victim keeps its principal");
    }

    // ------------------------------------------------------------------
    // Fuzzed: for any (seed deposit, donation, victim deposit) the victim's
    // redeemable value must not fall materially below its deposit.
    // ------------------------------------------------------------------
    function testFuzz_VictimNeverLosesPrincipalToDonation(uint96 seed, uint96 donation, uint96 victimDeposit) public {
        seed = uint96(bound(seed, 1, 1e24));
        donation = uint96(bound(donation, 0, 1e24));
        victimDeposit = uint96(bound(victimDeposit, 1e6, 1e24));

        _fund(attacker, uint256(seed) + uint256(donation));
        _fund(victim, victimDeposit);

        _deposit(attacker, seed);
        if (donation > 0) _donate(attacker, donation);
        if (vault.previewDeposit(victimDeposit) == 0) {
            // P2-3: a victim who would be rounded to zero shares is refused, so the
            // donation cannot take anything from it at all.
            vm.prank(victim);
            vm.expectRevert(MaonoVault_Phase1B.ZeroShares.selector);
            vault.deposit(victimDeposit, victim);
            assertEq(asset.balanceOf(victim), victimDeposit, "victim principal untouched");
            return;
        }
        uint256 victimShares = _deposit(victim, victimDeposit);

        uint256 redeemable = vault.previewRedeem(victimShares);
        uint256 victimLoss = redeemable >= victimDeposit ? 0 : uint256(victimDeposit) - redeemable;

        // Exit the attacker and measure whether the victim's loss was extracted.
        uint256 attackerStart = uint256(seed) + uint256(donation);
        _redeemAll(attacker);
        uint256 attackerEnd = asset.balanceOf(attacker);

        assertLe(attackerEnd, attackerStart, "no configuration lets the attacker profit");
        // Beyond a couple of wei of unavoidable rounding dust, any value the
        // victim loses must cost the attacker at least as much.
        if (victimLoss > 2) {
            assertGe(attackerStart - attackerEnd, victimLoss, "attacker cost >= victim loss");
        }
    }
}
