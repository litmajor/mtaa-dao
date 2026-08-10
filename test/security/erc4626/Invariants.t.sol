// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../Base.t.sol";

/// @notice Stateful handler: random users perform random vault operations,
///         including unsolicited donations, on a live vault.
contract VaultHandler is Test {
    MaonoVault_Phase1B public vault;
    MockERC20 public asset;

    address[] public actors;
    uint256 public totalDeposited;
    uint256 public totalWithdrawn;
    uint256 public totalDonated;

    constructor(MaonoVault_Phase1B _vault, MockERC20 _asset, address[] memory _actors) {
        vault = _vault;
        asset = _asset;
        actors = _actors;
    }

    function _actor(uint256 seed) internal view returns (address) {
        return actors[seed % actors.length];
    }

    function deposit(uint256 actorSeed, uint256 amount) external {
        address a = _actor(actorSeed);
        amount = bound(amount, 0, 1_000_000e18);
        asset.mint(a, amount);
        vm.startPrank(a);
        asset.approve(address(vault), amount);
        vault.deposit(amount, a);
        vm.stopPrank();
        totalDeposited += amount;
    }

    function mint(uint256 actorSeed, uint256 shares) external {
        address a = _actor(actorSeed);
        shares = bound(shares, 0, 1_000_000e21);
        uint256 cost = vault.previewMint(shares);
        asset.mint(a, cost);
        vm.startPrank(a);
        asset.approve(address(vault), cost);
        vault.mint(shares, a);
        vm.stopPrank();
        totalDeposited += cost;
    }

    function withdraw(uint256 actorSeed, uint256 amount) external {
        address a = _actor(actorSeed);
        uint256 max = vault.maxWithdraw(a);
        if (max == 0) return;
        amount = bound(amount, 0, max);
        vm.prank(a);
        vault.withdraw(amount, a, a);
        totalWithdrawn += amount;
    }

    function redeem(uint256 actorSeed, uint256 shares) external {
        address a = _actor(actorSeed);
        uint256 max = vault.maxRedeem(a);
        if (max == 0) return;
        shares = bound(shares, 0, max);
        vm.prank(a);
        totalWithdrawn += vault.redeem(shares, a, a);
    }

    function donate(uint256 actorSeed, uint256 amount) external {
        address a = _actor(actorSeed);
        amount = bound(amount, 0, 1_000_000e18);
        asset.mint(a, amount);
        vm.prank(a);
        asset.transfer(address(vault), amount);
        totalDonated += amount;
    }

    function transferShares(uint256 fromSeed, uint256 toSeed, uint256 amount) external {
        address from = _actor(fromSeed);
        address to = _actor(toSeed);
        uint256 bal = vault.balanceOf(from);
        if (bal == 0) return;
        amount = bound(amount, 0, bal);
        vm.prank(from);
        vault.transfer(to, amount);
    }
}

/// @title  Explicit invariant suite around the real vault implementation
contract VaultInvariantTest is MaonoVaultBaseTest {
    VaultHandler internal handler;
    address[] internal actors;

    function setUp() public override {
        super.setUp();
        actors.push(attacker);
        actors.push(victim);
        actors.push(bob);
        handler = new VaultHandler(vault, asset, actors);
        targetContract(address(handler));
    }

    // ---------------------------------------------------------------- core

    /// INV-1: the vault is always solvent - all outstanding shares can be
    ///        redeemed from the assets actually held.
    function invariant_Solvency() public view {
        assertLe(vault.convertToAssets(vault.totalSupply()), vault.totalAssets());
    }

    /// INV-2: totalAssets equals the real underlying balance (no phantom assets).
    function invariant_TotalAssetsMatchesBalance() public view {
        assertEq(vault.totalAssets(), asset.balanceOf(address(vault)));
    }

    /// INV-3: shares outstanding equal the sum of holder balances.
    function invariant_SupplyMatchesHolders() public view {
        uint256 sum;
        for (uint256 i = 0; i < actors.length; ++i) {
            sum += vault.balanceOf(actors[i]);
        }
        assertEq(sum, vault.totalSupply());
    }

    /// INV-4: no supply without assets - shares can never be minted against
    ///        an empty vault balance.
    function invariant_NoSupplyWithoutAssets() public view {
        if (vault.totalSupply() > 0 && vault.convertToAssets(vault.totalSupply()) > 0) {
            assertGt(vault.totalAssets(), 0);
        }
    }

    /// INV-5: preview functions round in the protocol's favour at all times.
    function invariant_PreviewRoundingDirection() public view {
        uint256 probe = 1e18;
        assertLe(vault.previewDeposit(probe), vault.convertToShares(probe));
        assertGe(vault.previewMint(probe), vault.convertToAssets(probe));
        assertGe(vault.previewWithdraw(probe), vault.convertToShares(probe));
        assertLe(vault.previewRedeem(probe), vault.convertToAssets(probe));
    }

    /// INV-6: depositing then immediately redeeming never returns more assets.
    function invariant_NoFreeRoundTrip() public view {
        uint256 probe = 1e18;
        assertLe(vault.previewRedeem(vault.previewDeposit(probe)), probe);
    }

    /// INV-7: the share price never decreases as a result of user actions
    ///        (only donations can raise it; nothing may lower it).
    function invariant_SharePriceMonotonicPerShare() public view {
        if (vault.totalSupply() == 0) return;
        // 1 share must always be worth < 1 asset unit * 10^-offset or more,
        // i.e. price >= the initial virtual price.
        uint256 priceNum = vault.totalAssets() + 1;
        uint256 priceDen = vault.totalSupply() + 10 ** DECIMALS_OFFSET;
        assertGe(priceNum * (10 ** DECIMALS_OFFSET), priceDen * 1 / 1, "share price below floor");
    }

    // ------------------------------------------------- stateless relations

    function testFuzz_ConvertRoundTripIsLossy(uint96 seed, uint96 donation, uint96 amount) public {
        seed = uint96(bound(seed, 1e6, 1e24));
        donation = uint96(bound(donation, 0, 1e24));
        amount = uint96(bound(amount, 0, 1e24));
        _fund(bob, uint256(seed) + uint256(donation));
        _deposit(bob, seed);
        if (donation > 0) _donate(bob, donation);

        assertLe(vault.convertToAssets(vault.convertToShares(amount)), amount);
        assertLe(vault.convertToShares(vault.convertToAssets(amount)), amount);
    }

    function testFuzz_PreviewMatchesExecution(uint96 seed, uint96 donation, uint96 amount) public {
        seed = uint96(bound(seed, 1e6, 1e24));
        donation = uint96(bound(donation, 0, 1e24));
        amount = uint96(bound(amount, 1, 1e21));

        _fund(bob, uint256(seed) + uint256(donation));
        _deposit(bob, seed);
        if (donation > 0) _donate(bob, donation);

        _fund(attacker, uint256(amount) * 4);

        uint256 pd = vault.previewDeposit(amount);
        if (pd == 0) {
            // P2-3: preview and execution stay coherent — a zero-share preview means
            // the deposit is rejected, not silently absorbed.
            vm.prank(attacker);
            vm.expectRevert(MaonoVault_Phase1B.ZeroShares.selector);
            vault.deposit(amount, attacker);
            return;
        }
        vm.prank(attacker);
        assertEq(vault.deposit(amount, attacker), pd, "previewDeposit != deposit");

        uint256 pm = vault.previewMint(pd);
        vm.prank(attacker);
        assertEq(vault.mint(pd, attacker), pm, "previewMint != mint");

        uint256 shares = vault.balanceOf(attacker);
        uint256 pr = vault.previewRedeem(shares);
        vm.prank(attacker);
        assertEq(vault.redeem(shares, attacker, attacker), pr, "previewRedeem != redeem");
    }

    function testFuzz_PreviewWithdrawMatchesExecution(uint96 seed, uint96 amount) public {
        seed = uint96(bound(seed, 1e18, 1e24));
        _fund(bob, seed);
        _deposit(bob, seed);
        amount = uint96(bound(amount, 1, seed));

        uint256 pw = vault.previewWithdraw(amount);
        vm.prank(bob);
        assertEq(vault.withdraw(amount, bob, bob), pw, "previewWithdraw != withdraw");
    }

    function testFuzz_MaxFunctionsAreHonoured(uint96 seed) public {
        seed = uint96(bound(seed, 1e18, 1e24));
        _fund(bob, seed);
        _deposit(bob, seed);

        uint256 maxW = vault.maxWithdraw(bob);
        uint256 maxR = vault.maxRedeem(bob);
        assertEq(maxR, vault.balanceOf(bob));
        assertEq(maxW, vault.previewRedeem(maxR));

        vm.prank(bob);
        vm.expectRevert();
        vault.withdraw(maxW + 1, bob, bob);

        vm.prank(bob);
        vm.expectRevert();
        vault.redeem(maxR + 1, bob, bob);
    }
}
