// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./Phase2Base.sol";

/// @title  Cross-function authorization: who really controls the upkeep price
/// @notice `MaonoVaultFactory_Phase1B` sets the economic parameters of a vault
///         at `initialize()` time (platform treasury, MTAA token, vault type)
///         and the vault then charges its owner a monthly upkeep in MTAA that
///         is burned and/or forwarded to that treasury.
///
///         The Phase 2 question of Step 7 — "authorization state that becomes
///         invalid because another function can mutate the underlying
///         assumption" — has a concrete answer here: **the payer is the
///         administrator of the payment**. `collectMonthlyUpkeep` reads
///         `UPKEEP_COSTS_MONTHLY`, `BURN_PERCENTAGES` and `daoTreasury`, and
///         all three are `onlyOwner` setters callable by the very account the
///         fee is charged to, in the same block, immediately before paying.
///
///         None of this touches depositor assets: it is a protocol-revenue
///         finding, classified PRIVILEGED / OWNER-ONLY.
contract UpkeepEnforceabilityTest is Phase2Base {
    uint256 internal constant SAVINGS = 0;
    uint256 internal constant INVESTING = 3;

    function setUp() public override {
        super.setUp();
        _fund(bob, 1_000_000e18);
    }

    // ==================================================================
    // 1. Upkeep is unenforceable: nobody but the payer can trigger it
    // ==================================================================
    /// @notice FINDING (H, protocol revenue): `collectMonthlyUpkeep()` is
    ///         `onlyOwner` and the vault has no accrued-liability accounting.
    ///         If the owner simply never calls it, the vault stays ACTIVE
    ///         forever, depositors keep transacting, and the protocol collects
    ///         nothing. Phase 1A's missing-`onlyOwner` bug was fixed by making
    ///         the fee uncollectable by anyone else — including the protocol.
    function test_UpkeepIsNeverCollectedIfTheOwnerStaysSilent() public {
        _depositTracked(bob, 100_000e18);

        vm.warp(block.timestamp + 3650 days); // ten years

        assertEq(_status(), 0, "vault is still ACTIVE after a decade of non-payment");
        (,, uint256 paid, uint256 burned, uint256 toTreasury) = vault.getVaultMetrics();
        assertEq(paid + burned + toTreasury, 0, "protocol collected nothing");

        // Depositors are entirely unaffected: the vault still works.
        vm.prank(bob);
        vault.deposit(1e18, bob);
        ledger.deposited += 1e18;
        _assertConservation("silent owner");

        // ...and nobody else can force the payment.
        address[3] memory outsiders = [attacker, treasury, bob];
        for (uint256 i = 0; i < outsiders.length; ++i) {
            vm.prank(outsiders[i]);
            vm.expectRevert(abi.encodeWithSignature("OwnableUnauthorizedAccount(address)", outsiders[i]));
            vault.collectMonthlyUpkeep();
        }

        console2.log("---- economics: silent owner, 120 months");
        console2.log("  upkeep nominally due (MTAA) :", vault.getMonthlyUpkeepCost() * 120);
        console2.log("  upkeep actually paid (MTAA) :", paid);
    }

    /// @notice Even a co-operative owner only ever pays for one month: there is
    ///         no backpay, so a call after N idle months costs the same as a
    ///         call after one.
    function test_SkippedMonthsAreFree() public {
        _fundOwnerWithMtaa(1_000e18);
        uint256 monthly = vault.getMonthlyUpkeepCost();

        vm.warp(block.timestamp + 365 days);
        vm.prank(vaultOwner);
        vault.collectMonthlyUpkeep();

        (,, uint256 paid,,) = vault.getVaultMetrics();
        assertLe(paid, monthly, "twelve idle months cost at most one month");

        console2.log("---- economics: 12 months elapsed, 1 call");
        console2.log("  nominal annual upkeep :", monthly * 12);
        console2.log("  actually charged      :", paid);
    }

    // ==================================================================
    // 2. The payer sets the price
    // ==================================================================
    /// @notice FINDING (H, protocol revenue): `setUpkeepCostAt` lets the owner
    ///         write its own invoice to zero and then satisfy the "payment" in
    ///         the same block, keeping the vault ACTIVE forever at zero cost
    ///         and burning no MTAA.
    function test_OwnerCanPriceItsOwnUpkeepAtZero() public {
        vm.prank(vaultOwner);
        vault.setUpkeepCostAt(SAVINGS, 0);

        vm.warp(block.timestamp + 31 days);
        vm.prank(vaultOwner);
        vault.collectMonthlyUpkeep();

        assertEq(_status(), 0, "vault stays ACTIVE");
        (,, uint256 paid, uint256 burned, uint256 toTreasury) = vault.getVaultMetrics();
        assertEq(paid, 0);
        assertEq(burned, 0);
        assertEq(toTreasury, 0);
        assertEq(mtaa.balanceOf(vaultOwner), 0, "owner never needed a single MTAA");
        assertEq(vault.getUpkeepDueDate(), block.timestamp + 30 days, "clock reset for free");
    }

    /// @notice The same lever removes the only consequence of delinquency:
    ///         with a zero price the balance check can never fail, so the vault
    ///         can never auto-hibernate.
    function test_ZeroPricedUpkeepMakesHibernationUnreachable() public {
        vm.prank(vaultOwner);
        vault.setUpkeepCostAt(SAVINGS, 0);

        for (uint256 i = 0; i < 24; ++i) {
            vm.warp(block.timestamp + 31 days);
            vm.prank(vaultOwner);
            vault.collectMonthlyUpkeep();
            assertEq(_status(), 0);
        }
    }

    /// @notice FINDING (M, protocol revenue): `setDaoTreasury` is owner-settable
    ///         on the vault even though the factory chose the platform treasury.
    ///         Redirecting it returns the non-burned share of every upkeep to
    ///         the payer, so the real fee is only the burn percentage.
    function test_OwnerCanRedirectTheTreasuryShareToItself() public {
        _deployVault(18, uint8(INVESTING)); // 30% burn / 70% treasury
        _fundOwnerWithMtaa(1_000e18);

        vm.prank(vaultOwner);
        vault.setDaoTreasury(vaultOwner);

        uint256 before = mtaa.balanceOf(vaultOwner);
        _upkeep();
        uint256 spent = before - mtaa.balanceOf(vaultOwner);

        (,, uint256 paid, uint256 burned, uint256 toTreasury) = vault.getVaultMetrics();
        assertEq(toTreasury, (paid * 7000) / 10000, "70% routed to the redirected treasury");
        assertEq(spent, burned, "net cost to the owner is the burn only");
        assertEq(mtaa.balanceOf(treasury), 0, "platform treasury received nothing");

        console2.log("---- economics: treasury redirect (INVESTING vault)");
        console2.log("  nominal upkeep :", paid);
        console2.log("  net cost       :", spent);
        console2.log("  platform loss  :", toTreasury);
    }

    /// @notice Composed: zero burn percentage + redirected treasury = the whole
    ///         upkeep round-trips back to the owner. Every step is a documented
    ///         owner privilege; the combination nullifies the monetization.
    function test_BurnPercentagePlusTreasuryRedirectMakeUpkeepFree() public {
        _deployVault(18, uint8(INVESTING));
        _fundOwnerWithMtaa(1_000e18);

        vm.startPrank(vaultOwner);
        vault.setBurnPercentageAt(INVESTING, 0);
        vault.setDaoTreasury(vaultOwner);
        vm.stopPrank();

        uint256 mtaaBefore = mtaa.balanceOf(vaultOwner);
        uint256 supplyBefore = mtaa.totalSupply();
        _upkeep();

        assertEq(mtaa.balanceOf(vaultOwner), mtaaBefore, "upkeep cost the owner nothing");
        assertEq(mtaa.totalSupply(), supplyBefore, "no MTAA was burned");
        (,, uint256 paid, uint256 burned,) = vault.getVaultMetrics();
        assertGt(paid, 0, "the vault still books it as paid");
        assertEq(burned, 0);

        console2.log("---- economics: self-dealt upkeep");
        console2.log("  booked as paid :", paid);
        console2.log("  real cost      :", uint256(0));
    }

    // ==================================================================
    // 3. Scenario D — the MTAA discount, measured
    // ==================================================================
    /// @notice The discount is `min(50, floor(sqrt(balance/1e18)) * 2.5)` read
    ///         from the caller's balance at payment time. Phase 1 showed it is
    ///         flash-loanable; Phase 2 measures the repeated advantage of the
    ///         acquire -> pay -> dispose loop over a year.
    function test_ScenarioD_AcquireDiscountRepayLoopOverTwelveMonths() public {
        uint256 monthly = vault.getMonthlyUpkeepCost(); // 15 MTAA, SAVINGS
        uint256 borrowed = 400e18; // saturates the curve at 50%

        // Honest owner: holds only what it needs, pays every month.
        _fundOwnerWithMtaa(monthly * 12);
        uint256 honestStart = mtaa.balanceOf(vaultOwner);
        for (uint256 i = 0; i < 12; ++i) {
            _upkeep();
        }
        uint256 honestSpend = honestStart - mtaa.balanceOf(vaultOwner);

        // Discount farmer: borrows 400 MTAA inside each payment transaction and
        // returns it immediately. Capital at risk: zero.
        _deployVault(18, uint8(SAVINGS));
        _fundOwnerWithMtaa(monthly * 12);
        uint256 farmerStart = mtaa.balanceOf(vaultOwner);
        for (uint256 i = 0; i < 12; ++i) {
            mtaa.mint(vaultOwner, borrowed); // "flash loan" in
            _upkeep();
            vm.prank(vaultOwner);
            mtaa.transfer(address(0xFEE1), borrowed); // repaid in the same tx
        }
        uint256 farmerSpend = farmerStart - mtaa.balanceOf(vaultOwner);

        console2.log("---- economics: 12 months of upkeep");
        console2.log("  nominal (15 MTAA x 12)  :", monthly * 12);
        console2.log("  honest owner spent      :", honestSpend);
        console2.log("  discount farmer spent   :", farmerSpend);
        console2.log("  capital at risk         :", uint256(0));

        assertLt(farmerSpend, honestSpend, "the loop is strictly cheaper");
        assertEq(farmerSpend, (monthly * 12) / 2, "saturated discount halves the nominal bill");
        // The honest owner is also discounted (holding the MTAA it needs to pay
        // already moves it up the curve), so the nominal price is never charged
        // to anyone: the list price is unreachable by construction.
        assertLt(honestSpend, monthly * 12, "even the compliant owner never pays list price");
    }

    // ==================================================================
    // 4. Hibernation as a cheaper alternative to compliance
    // ==================================================================
    /// @notice FINDING (M, protocol revenue + depositor liveness): the
    ///         reactivation fee is 1.5x *one* month regardless of how long the
    ///         vault hibernated, and is priced from the owner-settable table at
    ///         reactivation time. Beyond two idle months, delinquency plus a
    ///         single reactivation is cheaper than paying — while depositors are
    ///         frozen for the entire period at zero cost to the owner.
    function test_HibernationIsCheaperThanCompliance() public {
        uint256 monthly = vault.getMonthlyUpkeepCost();
        _depositTracked(bob, 100_000e18);

        _hibernate(); // owner holds no MTAA
        uint256 frozen = vault.totalAssets();
        vm.warp(block.timestamp + 365 days);

        _fundOwnerWithMtaa(1_000e18);
        uint256 before = mtaa.balanceOf(vaultOwner);
        vm.prank(vaultOwner);
        vault.reactivateFromHibernation();
        uint256 spent = before - mtaa.balanceOf(vaultOwner);

        assertEq(spent, (monthly * 150) / 100, "1.5 months, no backpay");
        assertLt(spent, monthly * 12, "a year of freeze is cheaper than a year of upkeep");

        console2.log("---- economics: 12 months hibernating");
        console2.log("  compliant cost (MTAA) :", monthly * 12);
        console2.log("  delinquent cost (MTAA):", spent);
        console2.log("  depositor assets frozen:", frozen);
        console2.log("  cost of freezing them :", uint256(0));

        _assertConservation("hibernation economics");
    }

    /// @notice The reactivation invoice is also self-priced: the owner can lower
    ///         the table first and pay 1.5x the new number.
    function test_ReactivationFeeIsRepricedByTheOwnerBeforePaying() public {
        _hibernate();

        vm.startPrank(vaultOwner);
        vault.setUpkeepCostAt(SAVINGS, 0);
        vault.reactivateFromHibernation();
        vm.stopPrank();

        assertEq(_status(), 0, "reactivated");
        (,, uint256 paid,,) = vault.getVaultMetrics();
        assertEq(paid, 0, "reactivation was free");
        assertEq(mtaa.balanceOf(vaultOwner), 0, "no MTAA required at all");
    }

    // ==================================================================
    // 5. Oracle view is owner-controlled
    // ==================================================================
    /// @notice `getSpawnCostInMTAA()` is a *view* fed by an owner-settable
    ///         oracle and owner-settable bounds. It never touches share math,
    ///         but any integrator reading spawn pricing from a vault instead of
    ///         the factory reads an owner-controlled number.
    function test_SpawnPricingViewIsOwnerControlled() public {
        uint256 honest = vault.getSpawnCostInMTAA();

        MockPriceOracle hostile = new MockPriceOracle(1_000_000);
        vm.prank(vaultOwner);
        vault.setPriceOracle(address(hostile));
        uint256 manipulated = vault.getSpawnCostInMTAA();

        assertTrue(manipulated != honest || honest == vault.MIN_SPAWN_COST_MTAA());
        assertEq(manipulated, vault.MIN_SPAWN_COST_MTAA(), "clamped to the floor, not zero");

        // The floor clamp is the real protection. The ceiling is dead code: the
        // oracle reports whole USD cents, so the cheapest representable price
        // (1 cent) already quotes only 500 MTAA, a quarter of MAX_SPAWN_COST.
        hostile.setPrice(1);
        vm.prank(vaultOwner);
        vault.setOracleBounds(1, 10_000_000);
        assertEq(vault.getSpawnCostInMTAA(), 500e18, "minimum representable price");
        assertLt(500e18, vault.MAX_SPAWN_COST_MTAA(), "MAX_SPAWN_COST_MTAA is unreachable");

        // Share accounting is untouched by any of it.
        _depositTracked(bob, 1_000e18);
        _assertConservation("oracle manipulation");
    }
}
