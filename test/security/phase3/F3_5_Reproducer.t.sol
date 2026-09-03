// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./ShareAccounting.t.sol";

/// @notice Comprehensive F3-5 economic analysis: measure fair NAV entitlement
/// vs actual proceeds for each shareholder to determine whether book-value
/// pricing creates economic exploitation vs. availability/accounting risk.
contract F35Reproducer is ShareAccountingTest {
    // reuse `investorB` and `DEPOSIT_USD` from ShareAccountingTest

    // === SCENARIO A: Loss → First Redemption ===
    
    /// @notice Two equal shareholders; portfolio loses value; first redemption succeeds.
    /// Quantify: does the first redeemer extract more than their fair NAV share?
    function test_ScenarioA_LossFirstRedemptionEconomicTransfer() public {
        // Setup: both invest equally
        uint256 sharesA = _invest(investor, DEPOSIT_USD);
        uint256 sharesB = _invest(investorB, DEPOSIT_USD);
        
        emit log_named_uint("sharesA (1e8)", sharesA);
        emit log_named_uint("sharesB (1e8)", sharesB);

        // Deploy half into ETH
        _deployIntoEth(5_000e18);
        
        // Record NAV before loss
        uint256 navBefore = vault.calculateTotalAssetValue() + ((cusd.balanceOf(address(vault)) * CUSD_USD) / 1e18);
        emit log_named_uint("NAV before loss (1e8 USD)", navBefore);

        // ETH halves: portfolio loses 25% of value
        oracle.setPrice(address(weth), ETH_USD / 2);

        // Record NAV after loss, book value (unchanged)
        uint256 navAfterLoss = vault.calculateTotalAssetValue() + ((cusd.balanceOf(address(vault)) * CUSD_USD) / 1e18);
        uint256 bookValue = vault.totalValueLocked();
        uint256 totalShares = vault.totalSupply();

        emit log_named_uint("NAV after loss (1e8 USD)", navAfterLoss);
        emit log_named_uint("book value (1e8 USD)", bookValue);
        emit log_named_uint("total shares (1e8)", totalShares);

        // A's fair NAV entitlement = (sharesA / totalShares) * actualNAV
        uint256 fairNAVforA = (sharesA * navAfterLoss) / totalShares;
        
        // A withdraws
        uint256 paidA = _withdraw(investor, sharesA);
        
        // Excess/deficit = actual received - fair NAV entitlement
        int256 economicTransferA = int256(paidA) - int256(fairNAVforA);

        emit log_named_uint("A fair NAV entitlement (1e8 USD)", fairNAVforA);
        emit log_named_uint("A actual proceeds (1e8 USD)", paidA);
        emit log_named_int("A economic transfer (1e8 USD)", economicTransferA);

        // B's remaining fair NAV = remaining portfolio * (sharesB / remaining shares)
        uint256 navAfterAWithdraw = vault.calculateTotalAssetValue() + ((cusd.balanceOf(address(vault)) * CUSD_USD) / 1e18);
        uint256 sharesAfterA = vault.totalSupply();
        uint256 fairNAVforB = (sharesB * navAfterAWithdraw) / sharesAfterA;

        emit log_named_uint("NAV after A withdraws (1e8 USD)", navAfterAWithdraw);
        emit log_named_uint("B fair NAV entitlement (1e8 USD)", fairNAVforB);

        // Try to withdraw B; may revert or succeed depending on buffer
        bool bSucceeds = true;
        uint256 paidB = 0;
        try this._withdrawB(investorB, sharesB) returns (uint256 result) {
            paidB = result;
            bSucceeds = true;
        } catch {
            bSucceeds = false;
        }

        if (bSucceeds) {
            int256 economicTransferB = int256(paidB) - int256(fairNAVforB);
            emit log_named_uint("B actual proceeds (1e8 USD)", paidB);
            emit log_named_int("B economic transfer (1e8 USD)", economicTransferB);
            
            // Test: A is overpaid (positive transfer) at B's expense
            assertGt(int256(paidA), int256(fairNAVforA), "A extraction: received more than fair share");
        } else {
            emit log("B withdrawal REVERTED; B's claim is trapped");
        }
    }

    function _withdrawB(address who, uint256 shares) external returns (uint256) {
        vm.prank(who);
        return vault.withdraw(shares);
    }

    // === SCENARIO B: Loss → A Withdraws → B Cannot Redeem ===
    
    /// @notice Demonstrate A can redeem book value while B's proportional claim becomes unredeemable.
    /// Quantify: is the trapped value from B's share of the loss, or from A's overconsumption?
    function test_ScenarioB_LossThenRedemptionRaceCondition() public {
        uint256 sharesA = _invest(investor, DEPOSIT_USD);
        uint256 sharesB = _invest(investorB, DEPOSIT_USD);

        _deployIntoEth(5_000e18);

        // Loss scenario
        oracle.setPrice(address(weth), ETH_USD / 2);

        uint256 navAfterLoss = vault.calculateTotalAssetValue() + ((cusd.balanceOf(address(vault)) * CUSD_USD) / 1e18);
        uint256 totalShares = vault.totalSupply();

        // A's pro-rata claim of the remaining real assets
        uint256 proRataRealA = (sharesA * navAfterLoss) / totalShares;
        
        // A's book-value claim (what they get from withdraw)
        uint256 bookClaimA = (sharesA * vault.totalValueLocked()) / totalShares;

        // A's "excess" (overpayment relative to real holdings)
        uint256 excessA = bookClaimA - proRataRealA;

        emit log_named_uint("A pro-rata real holdings (1e8 USD)", proRataRealA);
        emit log_named_uint("A book-value claim (1e8 USD)", bookClaimA);
        emit log_named_uint("A excess paid from buffer (1e8 USD)", excessA);

        // After A withdraws, check if B can still redeem
        uint256 cusdBeforeA = cusd.balanceOf(address(vault));
        _withdraw(investor, sharesA);
        uint256 cusdAfterA = cusd.balanceOf(address(vault));

        uint256 cusdConsumedByA = cusdBeforeA - cusdAfterA;
        emit log_named_uint("cUSD consumed by A (wei)", cusdConsumedByA);

        // B's proportional book-value claim
        uint256 bookClaimB = (sharesB * vault.totalValueLocked()) / vault.totalSupply();
        uint256 cusdRequiredForB = (bookClaimB * (10 ** 18)) / CUSD_USD;

        emit log_named_uint("cUSD remaining in vault (wei)", cusd.balanceOf(address(vault)));
        emit log_named_uint("cUSD required for B's book claim (wei)", cusdRequiredForB);

        // If buffer insufficient, B cannot redeem
        if (cusd.balanceOf(address(vault)) < cusdRequiredForB) {
            emit log("AVAILABILITY ISSUE: B cannot redeem their book-value claim");
            
            // But is this because of their fair loss share, or A's overconsumption?
            uint256 cusdAvailable = cusd.balanceOf(address(vault));
            uint256 bCanRedeem = (cusdAvailable * vault.totalSupply()) / (bookClaimB + cusdAvailable / ((10 ** 18) / CUSD_USD));
            
            emit log_named_uint("B could partially redeem (1e8 USD)", 
                (bCanRedeem * vault.totalValueLocked()) / vault.totalSupply());
        } else {
            emit log("B CAN redeem their book-value claim");
        }
    }

    // === SCENARIO C: Gain → Late Investor Disproportionately Compensated ===
    
    /// @notice Portfolio appreciates; late investor B deposits afterward.
    /// Quantify: does B receive more shares per dollar than A, effectively extracting A's gains?
    function test_ScenarioC_GainLateInvestorShareDilution() public {
        uint256 sharesA = _invest(investor, DEPOSIT_USD);
        
        _deployIntoEth(5_000e18);

        // Portfolio appreciates 3x
        oracle.setPrice(address(weth), ETH_USD * 3);

        uint256 navAfterGain = vault.calculateTotalAssetValue() + ((cusd.balanceOf(address(vault)) * CUSD_USD) / 1e18);
        
        emit log_named_uint("NAV after 3x gain (1e8 USD)", navAfterGain);
        emit log_named_uint("A's shares (1e8)", sharesA);
        emit log_named_uint("A's fair value post-gain (1e8 USD)", (sharesA * navAfterGain) / sharesA); // should equal navAfterGain

        // B now deposits same USD amount
        uint256 sharesB = _invest(investorB, DEPOSIT_USD);

        // Under book-value pricing, B gets 1 share per dollar (just like A did initially)
        // But the vault's real assets are worth 3x, so B is getting a cheap entry
        
        emit log_named_uint("B's shares (1e8)", sharesB);
        emit log_named_uint("B shares per USD invested", sharesB); // if 1:1, B paid $1 for $3 worth

        uint256 totalSharesPostB = vault.totalSupply();
        uint256 navPostB = vault.calculateTotalAssetValue() + ((cusd.balanceOf(address(vault)) * CUSD_USD) / 1e18);

        // B's fair percentage of the appreciated portfolio
        uint256 bFairPercentage = (sharesB * 10000) / totalSharesPostB;
        // B's actual economic value (per share * total nav / total shares)
        uint256 bEconomicValue = (sharesB * navPostB) / totalSharesPostB;

        // A's economic value after B's entry (diluted by book-value entry)
        uint256 aEconomicValuePostB = (sharesA * navPostB) / totalSharesPostB;

        emit log_named_uint("B received fair percentage (bps)", bFairPercentage);
        emit log_named_uint("B economic value after entry (1e8 USD)", bEconomicValue);
        emit log_named_uint("A economic value post-dilution (1e8 USD)", aEconomicValuePostB);

        // Measure value transfer: how much did A lose to B's entry?
        uint256 aFairValueBeforeB = navAfterGain;
        uint256 valueLostByA = aFairValueBeforeB - aEconomicValuePostB;

        emit log_named_uint("A's pre-B economic value (1e8 USD)", aFairValueBeforeB);
        emit log_named_uint("A's post-B economic value (1e8 USD)", aEconomicValuePostB);
        emit log_named_uint("Value transferred from A to B (1e8 USD)", valueLostByA);
    }

    // === SCENARIO D: Gain → Original Investor Redeems Early ===
    
    /// @notice Portfolio appreciates; original investor A redeems.
    /// Quantify: does A receive less than their fair NAV share because redemption uses stale book value?
    function test_ScenarioD_GainEarlyRedeemerReceivesLess() public {
        uint256 sharesA = _invest(investor, DEPOSIT_USD);
        uint256 sharesB = _invest(investorB, DEPOSIT_USD);

        _deployIntoEth(5_000e18);

        // Portfolio appreciates 3x
        oracle.setPrice(address(weth), ETH_USD * 3);

        uint256 navAfterGain = vault.calculateTotalAssetValue() + ((cusd.balanceOf(address(vault)) * CUSD_USD) / 1e18);
        uint256 totalShares = vault.totalSupply();

        emit log_named_uint("NAV after gain (1e8 USD)", navAfterGain);
        emit log_named_uint("Total shares (1e8)", totalShares);

        // A's fair NAV entitlement = (sharesA / totalShares) * navAfterGain
        uint256 fairNAVforA = (sharesA * navAfterGain) / totalShares;

        // A redeems
        uint256 paidA = _withdraw(investor, sharesA);

        // Deficit = fair NAV - actual received
        int256 deficitA = int256(fairNAVforA) - int256(paidA);

        emit log_named_uint("A fair NAV entitlement (1e8 USD)", fairNAVforA);
        emit log_named_uint("A actual proceeds (1e8 USD)", paidA);
        emit log_named_int("A deficit (received less than fair share)", deficitA);

        // The stranded gain: A should have received fairNAVforA but only got paidA
        // This underpayment leaves gain inaccessible to A in the vault
        uint256 strandedGain = fairNAVforA - paidA;  // A's unrealized loss due to stale pricing

        emit log_named_uint("A's underpayment (stranded NAV) (1e8 USD)", strandedGain);

        // B can now attempt to redeem their full share; they should get their pro-rata of remaining NAV
        uint256 navRemaining = vault.calculateTotalAssetValue() + ((cusd.balanceOf(address(vault)) * CUSD_USD) / 1e18);
        uint256 totalSharesAfterA = vault.totalSupply();  // Only B's shares remain
        uint256 fairNAVforB = (sharesB * navRemaining) / totalSharesAfterA;

        emit log_named_uint("Remaining NAV (1e8 USD)", navRemaining);
        emit log_named_uint("B fair NAV after A redeems (1e8 USD)", fairNAVforB);

        // B tries to redeem at book value, but may fail due to insufficient buffer
        // (A consumed it to pay out the excess redemption)
        uint256 cusdRemaining = cusd.balanceOf(address(vault));
        uint256 bookClaimB = (sharesB * vault.totalValueLocked()) / vault.totalSupply();
        uint256 cusdRequiredForB = (bookClaimB * (10 ** 18)) / CUSD_USD;

        emit log_named_uint("B book-value claim (1e8 USD)", bookClaimB);
        emit log_named_uint("cUSD buffer remaining (wei)", cusdRemaining);
        emit log_named_uint("cUSD required for B (wei)", cusdRequiredForB);

        bool bCanRedeem = (cusdRemaining >= cusdRequiredForB);
        emit log(bCanRedeem ? "B CAN redeem their full claim" : "B CANNOT redeem; buffer exhausted by A's redemption");

        // Verify key metrics
        assertTrue(deficitA > 0, "A is underpaid due to stale book value pricing during gains");
        assertEq(strandedGain, uint256(deficitA), "stranded gain equals A's underpayment");
        
        if (!bCanRedeem) {
            emit log("FINDING: Gains cause early redeemer to be underpaid AND later redeemer to be trapped (F3-5B cascade)");
        }
    }
}
