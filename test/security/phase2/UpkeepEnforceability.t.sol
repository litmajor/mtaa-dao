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
///         assumption" — had a concrete answer here: **the payer administered
///         the payment**. `collectMonthlyUpkeep` reads `UPKEEP_COSTS_MONTHLY`,
///         `BURN_PERCENTAGES` and `daoTreasury`, and all three used to be
///         `onlyOwner` setters callable by the very account the fee is charged
///         to, in the same block, immediately before paying.
///
///         P2-1 remediation: those three setters are now `onlyPlatform` — only
///         the address that initialized the clone (the factory, owned by the
///         platform) can move them. In this harness the test contract is the
///         initializer, so an unprefixed call is the platform speaking and a
///         `vm.prank(vaultOwner)` call is the payer being refused.
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
    /// @notice P2-1 regression (was: test_OwnerCanPriceItsOwnUpkeepAtZero).
    ///         `setUpkeepCostAt` let the owner write its own invoice to zero and
    ///         satisfy the "payment" in the same block. The payer can no longer
    ///         touch the price at all, and must pay the platform's number.
    function test_OwnerCannotPriceItsOwnUpkeepAtZero() public {
        vm.prank(vaultOwner);
        vm.expectRevert(MaonoVault_Phase1B.NotPlatformAdmin.selector);
        vault.setUpkeepCostAt(SAVINGS, 0);

        assertEq(vault.getMonthlyUpkeepCost(), 15e18, "price unchanged");

        // Paying without MTAA is the only remaining outcome: hibernation.
        vm.warp(block.timestamp + 31 days);
        vm.prank(vaultOwner);
        vault.collectMonthlyUpkeep();
        assertEq(_status(), 1, "the free-upkeep path now ends in hibernation");

        (,, uint256 paid, uint256 burned, uint256 toTreasury) = vault.getVaultMetrics();
        assertEq(paid + burned + toTreasury, 0, "nothing was booked as paid");
    }

    /// @notice P2-1: the whole set of fee-economics levers rejects the payer, and
    ///         every other unprivileged actor, while remaining usable by the platform.
    function test_FeeEconomicsAreExclusivelyPlatformControlled() public {
        address[3] memory unprivileged = [vaultOwner, attacker, bob];
        for (uint256 i = 0; i < unprivileged.length; ++i) {
            vm.startPrank(unprivileged[i]);
            vm.expectRevert(MaonoVault_Phase1B.NotPlatformAdmin.selector);
            vault.setUpkeepCostAt(SAVINGS, 0);
            vm.expectRevert(MaonoVault_Phase1B.NotPlatformAdmin.selector);
            vault.setBurnPercentageAt(SAVINGS, 0);
            vm.expectRevert(MaonoVault_Phase1B.NotPlatformAdmin.selector);
            vault.setDaoTreasury(unprivileged[i]);
            vm.expectRevert(MaonoVault_Phase1B.NotPlatformAdmin.selector);
            vault.setPriceOracle(address(0xDEAD));
            vm.expectRevert(MaonoVault_Phase1B.NotPlatformAdmin.selector);
            vault.setOracleBounds(1, 2);
            vm.expectRevert(MaonoVault_Phase1B.NotPlatformAdmin.selector);
            vault.setOracleCircuitEnabled(false);
            vm.stopPrank();
        }

        // The platform (this contract initialized the clone) still governs them.
        vault.setUpkeepCostAt(SAVINGS, 25e18);
        vault.setBurnPercentageAt(SAVINGS, 4000);
        vault.setDaoTreasury(treasury);
        assertEq(vault.getMonthlyUpkeepCost(), 25e18);
        assertEq(vault.platformAdmin(), address(this));
    }

    /// @notice P2-1 regression (was: test_ZeroPricedUpkeepMakesHibernationUnreachable).
    ///         With the price out of the payer's reach, delinquency has a consequence
    ///         again: a vault whose owner will not pay hibernates.
    function test_ZeroPricedUpkeepIsUnreachableSoHibernationStillBites() public {
        vm.prank(vaultOwner);
        vm.expectRevert(MaonoVault_Phase1B.NotPlatformAdmin.selector);
        vault.setUpkeepCostAt(SAVINGS, 0);

        vm.warp(block.timestamp + 31 days);
        vm.prank(vaultOwner);
        vault.collectMonthlyUpkeep();
        assertEq(_status(), 1, "unpaid vault hibernates");

        // P2-4: and it cannot be kept alive by paying while hibernating.
        vm.warp(block.timestamp + 31 days);
        vm.prank(vaultOwner);
        vm.expectRevert(MaonoVault_Phase1B.VaultIsHibernating.selector);
        vault.collectMonthlyUpkeep();
    }

    /// @notice P2-1 regression (was: test_OwnerCanRedirectTheTreasuryShareToItself).
    ///         `setDaoTreasury` used to be owner-settable, returning the non-burned
    ///         share of every upkeep to the payer. The proceeds now go where the
    ///         platform pointed them, and the owner is out of pocket in full.
    function test_OwnerCannotRedirectTheTreasuryShareToItself() public {
        _deployVault(18, uint8(INVESTING)); // 30% burn / 70% treasury
        _fundOwnerWithMtaa(1_000e18);

        vm.prank(vaultOwner);
        vm.expectRevert(MaonoVault_Phase1B.NotPlatformAdmin.selector);
        vault.setDaoTreasury(vaultOwner);
        assertEq(vault.daoTreasury(), treasury, "destination unchanged");

        uint256 before = mtaa.balanceOf(vaultOwner);
        _upkeep();
        uint256 spent = before - mtaa.balanceOf(vaultOwner);

        (,, uint256 paid, uint256 burned, uint256 toTreasury) = vault.getVaultMetrics();
        assertEq(spent, paid, "the owner pays the whole invoice");
        assertEq(toTreasury, (paid * 7000) / 10000, "70% to the platform treasury");
        assertEq(mtaa.balanceOf(treasury), toTreasury, "and it arrives there");
        assertEq(burned, paid - toTreasury);

        console2.log("---- economics: treasury redirect blocked (INVESTING vault)");
        console2.log("  nominal upkeep :", paid);
        console2.log("  net cost       :", spent);
        console2.log("  platform income:", toTreasury);
    }

    /// @notice P2-1 regression (was: test_BurnPercentagePlusTreasuryRedirectMakeUpkeepFree).
    ///         Composing a zero burn percentage with a redirected treasury used to
    ///         round-trip the whole upkeep back to the owner. Neither lever is
    ///         reachable now, so the composition is dead.
    function test_BurnPercentagePlusTreasuryRedirectCannotMakeUpkeepFree() public {
        _deployVault(18, uint8(INVESTING));
        _fundOwnerWithMtaa(1_000e18);

        vm.startPrank(vaultOwner);
        vm.expectRevert(MaonoVault_Phase1B.NotPlatformAdmin.selector);
        vault.setBurnPercentageAt(INVESTING, 0);
        vm.expectRevert(MaonoVault_Phase1B.NotPlatformAdmin.selector);
        vault.setDaoTreasury(vaultOwner);
        vm.stopPrank();

        uint256 mtaaBefore = mtaa.balanceOf(vaultOwner);
        uint256 supplyBefore = mtaa.totalSupply();
        _upkeep();

        (,, uint256 paid, uint256 burned, uint256 toTreasury) = vault.getVaultMetrics();
        assertEq(mtaaBefore - mtaa.balanceOf(vaultOwner), paid, "upkeep really cost the owner");
        assertEq(supplyBefore - mtaa.totalSupply(), burned, "MTAA really was burned");
        assertGt(burned, 0);
        assertEq(mtaa.balanceOf(treasury), toTreasury);

        console2.log("---- economics: self-dealt upkeep blocked");
        console2.log("  booked as paid :", paid);
        console2.log("  real cost      :", paid);
    }

    // ==================================================================
    // 3. Scenario D — the MTAA discount, measured
    // ==================================================================
    /// @notice M-1 regression. The discount used to be
    ///         `min(50, floor(sqrt(balance/1e18)) * 2.5)` read from the caller's
    ///         balance at payment time, so the acquire -> pay -> dispose loop halved
    ///         the annual bill at zero capital risk. Measured again over a year, the
    ///         loop now costs exactly the list price, and the only way to pay less is
    ///         to actually lock MTAA up for the whole period.
    function test_ScenarioD_AcquireDiscountRepayLoopOverTwelveMonths() public {
        uint256 monthly = vault.getMonthlyUpkeepCost(); // 15 MTAA, SAVINGS
        uint256 borrowed = 400e18; // used to saturate the curve at 50%

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

        // Sustained staker: 400 MTAA genuinely locked in the vault all year.
        _deployVault(18, uint8(SAVINGS));
        _fundOwnerWithMtaa(monthly * 12 + 400e18);
        uint256 stakerStart = mtaa.balanceOf(vaultOwner);
        vm.prank(vaultOwner);
        vault.stakeMtaaForDiscount(400e18);
        vm.warp(block.timestamp + vault.DISCOUNT_MIN_STAKE_DURATION());
        for (uint256 i = 0; i < 12; ++i) {
            _upkeep();
        }
        vm.prank(vaultOwner);
        vault.unstakeMtaa(400e18);
        uint256 stakerSpend = stakerStart - mtaa.balanceOf(vaultOwner);

        console2.log("---- economics: 12 months of upkeep");
        console2.log("  nominal (15 MTAA x 12)  :", monthly * 12);
        console2.log("  honest owner spent      :", honestSpend);
        console2.log("  discount farmer spent   :", farmerSpend);
        console2.log("  sustained staker spent  :", stakerSpend);
        console2.log("  staker capital locked   :", uint256(400e18));

        assertEq(farmerSpend, honestSpend, "borrowing buys no advantage over paying honestly");
        assertEq(honestSpend, monthly * 12, "the list price is what is charged");
        assertEq(stakerSpend, (monthly * 12) / 2, "the discount survives, but only for locked capital");
    }

    // ==================================================================
    // 4. Hibernation as a cheaper alternative to compliance
    // ==================================================================
    /// @notice P2-2 regression (was: test_HibernationIsCheaperThanCompliance).
    ///         The reactivation fee used to be 1.5x *one* month however long the vault
    ///         hibernated, so freezing depositors was strictly cheaper than paying. It
    ///         is now 1.5x per hibernated month, and depositors are not frozen for the
    ///         whole period either (see HibernationLifecycle.t.sol).
    function test_HibernationIsNoLongerCheaperThanCompliance() public {
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

        assertEq(spent, (monthly * 150) / 100 * 12, "1.5 months charged per hibernated month");
        assertGt(spent, monthly * 12, "a year of freeze costs more than a year of upkeep");

        console2.log("---- economics: 12 months hibernating");
        console2.log("  compliant cost (MTAA) :", monthly * 12);
        console2.log("  delinquent cost (MTAA):", spent);
        console2.log("  depositor assets frozen:", frozen);

        _assertConservation("hibernation economics");
    }

    /// @notice P2-1 regression (was: test_ReactivationFeeIsRepricedByTheOwnerBeforePaying).
    ///         The reactivation invoice was self-priced too. The owner can no longer
    ///         move the table, so reactivation must be paid at the platform's price.
    function test_ReactivationFeeCannotBeRepricedByTheOwner() public {
        _hibernate();

        vm.prank(vaultOwner);
        vm.expectRevert(MaonoVault_Phase1B.NotPlatformAdmin.selector);
        vault.setUpkeepCostAt(SAVINGS, 0);

        // With no MTAA the owner cannot reactivate at all.
        vm.prank(vaultOwner);
        vm.expectRevert();
        vault.reactivateFromHibernation();
        assertEq(_status(), 1, "still hibernating");

        _fundOwnerWithMtaa(1_000e18);
        uint256 expected = vault.getReactivationCost();
        uint256 before = mtaa.balanceOf(vaultOwner);
        vm.prank(vaultOwner);
        vault.reactivateFromHibernation();

        assertEq(_status(), 0, "reactivated");
        assertEq(before - mtaa.balanceOf(vaultOwner), expected, "paid the platform price");
        assertGt(expected, 0, "reactivation is never free");
    }

    // ==================================================================
    // 5. Oracle view is owner-controlled
    // ==================================================================
    /// @notice P2-1 regression (was: test_SpawnPricingViewIsOwnerControlled).
    ///         `getSpawnCostInMTAA()` is a *view* fed by the oracle and the oracle
    ///         bounds. Both setters were owner-controlled, so an integrator reading
    ///         spawn pricing off a vault read a number its owner could pick. They are
    ///         platform-controlled now; the clamping behaviour below is unchanged.
    function test_SpawnPricingViewIsPlatformControlled() public {
        uint256 honest = vault.getSpawnCostInMTAA();

        MockPriceOracle hostile = new MockPriceOracle(1_000_000);
        vm.prank(vaultOwner);
        vm.expectRevert(MaonoVault_Phase1B.NotPlatformAdmin.selector);
        vault.setPriceOracle(address(hostile));

        vault.setPriceOracle(address(hostile)); // platform
        uint256 manipulated = vault.getSpawnCostInMTAA();

        assertTrue(manipulated != honest || honest == vault.MIN_SPAWN_COST_MTAA());
        assertEq(manipulated, vault.MIN_SPAWN_COST_MTAA(), "clamped to the floor, not zero");

        // The floor clamp is the real protection. The ceiling is dead code: the
        // oracle reports whole USD cents, so the cheapest representable price
        // (1 cent) already quotes only 500 MTAA, a quarter of MAX_SPAWN_COST.
        hostile.setPrice(1);
        vault.setOracleBounds(1, 10_000_000);
        assertEq(vault.getSpawnCostInMTAA(), 500e18, "minimum representable price");
        assertLt(500e18, vault.MAX_SPAWN_COST_MTAA(), "MAX_SPAWN_COST_MTAA is unreachable");

        // Share accounting is untouched by any of it.
        _depositTracked(bob, 1_000e18);
        _assertConservation("oracle manipulation");
    }
}
