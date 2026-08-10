// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "@openzeppelin/contracts/proxy/Clones.sol";

import "../../../contracts/MaonoVault.sol";
import "../harness/Mocks.sol";

/// @notice Stateful handler: drives the vault through arbitrary sequences of
///         *individually valid* operations from four unprivileged actors plus
///         the owner, and maintains an independent ledger of every asset that
///         entered or left the vault. Reverts are swallowed on purpose — the
///         handler explores the reachable state space, the invariants judge it.
contract VaultHandler is Test {
    MaonoVault_Phase1B public vault;
    MockERC20 public asset;
    MockMTAA public mtaa;
    address public owner;

    address[4] public actors;
    address public currentActor;

    // independent ledger
    uint256 public totalIn; // deposits + mints + donations
    uint256 public totalOut; // withdrawals + redemptions
    uint256 public zeroShareDeposits; // deposits that minted no shares at all

    mapping(bytes32 => uint256) public calls;

    modifier useActor(uint256 seed) {
        currentActor = actors[seed % actors.length];
        vm.startPrank(currentActor);
        _;
        vm.stopPrank();
    }

    modifier count(bytes32 name) {
        calls[name]++;
        _;
    }

    constructor(MaonoVault_Phase1B _vault, MockERC20 _asset, MockMTAA _mtaa, address _owner) {
        vault = _vault;
        asset = _asset;
        mtaa = _mtaa;
        owner = _owner;

        actors = [address(0xA1), address(0xA2), address(0xA3), address(0xA4)];
        for (uint256 i = 0; i < actors.length; ++i) {
            asset.mint(actors[i], 1_000_000e18);
            vm.prank(actors[i]);
            asset.approve(address(vault), type(uint256).max);
        }
    }

    // ------------------------------------------------------------ user actions

    function deposit(uint256 actorSeed, uint256 amount) external useActor(actorSeed) count("deposit") {
        amount = bound(amount, 0, asset.balanceOf(currentActor));
        try vault.deposit(amount, currentActor) returns (uint256 shares) {
            totalIn += amount;
            if (shares == 0 && amount > 0) zeroShareDeposits++;
        } catch {}
    }

    function mintShares(uint256 actorSeed, uint256 shares) external useActor(actorSeed) count("mint") {
        shares = bound(shares, 0, 1_000_000e21);
        uint256 cost = vault.previewMint(shares);
        if (cost > asset.balanceOf(currentActor)) return;
        try vault.mint(shares, currentActor) returns (uint256 paid) {
            totalIn += paid;
        } catch {}
    }

    function withdraw(uint256 actorSeed, uint256 amount) external useActor(actorSeed) count("withdraw") {
        amount = bound(amount, 0, vault.maxWithdraw(currentActor));
        try vault.withdraw(amount, currentActor, currentActor) {
            totalOut += amount;
        } catch {}
    }

    function redeem(uint256 actorSeed, uint256 shares) external useActor(actorSeed) count("redeem") {
        shares = bound(shares, 0, vault.balanceOf(currentActor));
        try vault.redeem(shares, currentActor, currentActor) returns (uint256 assets) {
            totalOut += assets;
        } catch {}
    }

    function transferShares(uint256 actorSeed, uint256 toSeed, uint256 shares)
        external
        useActor(actorSeed)
        count("transfer")
    {
        address to = actors[toSeed % actors.length];
        shares = bound(shares, 0, vault.balanceOf(currentActor));
        try vault.transfer(to, shares) {} catch {}
    }

    function donate(uint256 actorSeed, uint256 amount) external useActor(actorSeed) count("donate") {
        amount = bound(amount, 0, asset.balanceOf(currentActor) / 10);
        asset.transfer(address(vault), amount);
        totalIn += amount;
    }

    // ----------------------------------------------------------- owner actions

    function upkeep(uint256 mtaaSeed, uint256 warpSeed) external count("upkeep") {
        vm.warp(block.timestamp + bound(warpSeed, 1 days, 90 days));
        uint256 top = bound(mtaaSeed, 0, 100e18);
        mtaa.mint(owner, top);
        vm.startPrank(owner);
        mtaa.approve(address(vault), type(uint256).max);
        try vault.collectMonthlyUpkeep() {} catch {}
        vm.stopPrank();
    }

    function reactivate(uint256 mtaaSeed) external count("reactivate") {
        mtaa.mint(owner, bound(mtaaSeed, 0, 100e18));
        vm.startPrank(owner);
        mtaa.approve(address(vault), type(uint256).max);
        try vault.reactivateFromHibernation() {} catch {}
        vm.stopPrank();
    }

    function togglePause(uint256 seed) external count("pause") {
        vm.startPrank(owner);
        if (seed % 2 == 0) {
            try vault.pause() {} catch {}
        } else {
            try vault.unpause() {} catch {}
        }
        vm.stopPrank();
    }

    // ------------------------------------------------------------------ views

    function actorCount() external pure returns (uint256) {
        return 4;
    }

    function sumRedeemable() external view returns (uint256 total) {
        for (uint256 i = 0; i < actors.length; ++i) {
            total += vault.previewRedeem(vault.balanceOf(actors[i]));
        }
    }

    function sumShares() external view returns (uint256 total) {
        for (uint256 i = 0; i < actors.length; ++i) {
            total += vault.balanceOf(actors[i]);
        }
    }
}

/// @title Economic invariants over arbitrary sequences of valid operations
contract VaultInvariantsTest is Test {
    MaonoVault_Phase1B internal vault;
    MockERC20 internal asset;
    MockMTAA internal mtaa;
    MockPriceOracle internal oracle;
    VaultHandler internal handler;

    address internal vaultOwner = address(0xA11CE);
    address internal treasury = address(0x7BEA5);

    function setUp() public {
        asset = new MockERC20("Celo Dollar", "cUSD", 18);
        mtaa = new MockMTAA();
        oracle = new MockPriceOracle(500);

        MaonoVault_Phase1B implementation = new MaonoVault_Phase1B();
        vault = MaonoVault_Phase1B(Clones.clone(address(implementation)));
        vault.initialize(
            address(asset), "Maono Vault Share", "mvUSD", vaultOwner, 0, treasury, address(mtaa), address(oracle)
        );

        handler = new VaultHandler(vault, asset, mtaa, vaultOwner);
        targetContract(address(handler));

        bytes4[] memory selectors = new bytes4[](9);
        selectors[0] = VaultHandler.deposit.selector;
        selectors[1] = VaultHandler.mintShares.selector;
        selectors[2] = VaultHandler.withdraw.selector;
        selectors[3] = VaultHandler.redeem.selector;
        selectors[4] = VaultHandler.transferShares.selector;
        selectors[5] = VaultHandler.donate.selector;
        selectors[6] = VaultHandler.upkeep.selector;
        selectors[7] = VaultHandler.reactivate.selector;
        selectors[8] = VaultHandler.togglePause.selector;
        targetSelector(FuzzSelector({addr: address(handler), selectors: selectors}));
    }

    /// @notice I1 — the vault's books are its balance. No NAV, no receivables.
    function invariant_TotalAssetsEqualsBalance() public view {
        assertEq(vault.totalAssets(), asset.balanceOf(address(vault)));
    }

    /// @notice I2 — solvency: everything every holder could redeem right now is
    ///         backed by assets actually held.
    function invariant_ClaimsAreFullyBacked() public view {
        assertLe(handler.sumRedeemable(), vault.totalAssets());
        assertLe(vault.convertToAssets(vault.totalSupply()), vault.totalAssets());
    }

    /// @notice I3 — conservation: assets held equal everything that came in
    ///         minus everything that went out. No leakage, no creation.
    function invariant_AssetConservation() public view {
        assertEq(vault.totalAssets(), handler.totalIn() - handler.totalOut());
    }

    /// @notice I4 — no unprivileged actor can extract more than it put in over
    ///         any sequence: aggregate user P&L is never positive.
    function invariant_UsersNeverExtractMoreThanTheyContributed() public view {
        assertLe(handler.totalOut(), handler.totalIn());
    }

    /// @notice I5 — the share ledger is closed: every share belongs to a known
    ///         actor (the vault mints to no one else and never self-holds).
    function invariant_ShareSupplyIsFullyAttributed() public view {
        assertEq(handler.sumShares(), vault.totalSupply());
        assertEq(vault.balanceOf(address(vault)), 0);
    }

    /// @notice I6 — the vault never charges the depositor base in the asset:
    ///         all protocol revenue is MTAA-denominated.
    function invariant_ProtocolTakesNoAssetFee() public view {
        assertEq(asset.balanceOf(treasury), 0);
        assertEq(asset.balanceOf(vaultOwner), 0);
    }

    /// @notice I7 — assets that back no share ("stranded": donations to a
    ///         share-less or near-empty vault, deposits that rounded to zero
    ///         shares, exit dust) are never paid out to anyone. They may only
    ///         accumulate; the users as a group never get them back.
    ///         Documented by test_DonationToAnEmptyVaultIsStranded,
    ///         test_DonationToANearEmptyVaultIsMostlyStranded and
    ///         EconomicComposition.test_ZeroShareDepositIsSilentlyAbsorbed.
    function invariant_StrandedAssetsAreNeverPaidOut() public view {
        uint256 stranded = vault.totalAssets() - vault.convertToAssets(vault.totalSupply());
        assertLe(handler.totalOut() + stranded, handler.totalIn());
        if (vault.totalSupply() == 0) {
            assertEq(handler.sumRedeemable(), 0, "claims exist without shares");
        }
    }

    /// @notice Assets sent to a share-less vault have no owner: the virtual
    ///         share offset means a later depositor recovers only part of them
    ///         and the rest stays stranded. Nobody profits, so this is an
    ///         INFORMATIONAL donation result, not a vulnerability.
    function test_DonationToAnEmptyVaultIsStranded() public {
        address donor = address(0xD00);
        asset.mint(donor, 10_000e18);
        vm.prank(donor);
        asset.transfer(address(vault), 10_000e18);

        assertEq(vault.totalSupply(), 0);
        assertEq(vault.totalAssets(), 10_000e18);

        address late = address(0x1A7E);
        asset.mint(late, 10_000e18);
        vm.startPrank(late);
        asset.approve(address(vault), type(uint256).max);
        uint256 shares = vault.deposit(10_000e18, late);
        uint256 out = vault.redeem(shares, late, late);
        vm.stopPrank();

        assertLe(out, 10_000e18, "late depositor cannot profit from the stranded pot");
        console2.log("  stranded before         :", uint256(10_000e18));
        console2.log("  late depositor recovered:", out);
        console2.log("  still stranded          :", vault.totalAssets());
    }

    /// @notice The same effect at a smaller scale: with only a handful of real
    ///         shares outstanding, the 1000 virtual shares of the ERC-4626
    ///         offset absorb almost all of a donation, and that share of it can
    ///         never be redeemed. The inflation defence converts an inflation
    ///         attack into a self-inflicted loss for the donor.
    function test_DonationToANearEmptyVaultIsMostlyStranded() public {
        address holder = address(0x111);
        asset.mint(holder, 1_000e18);
        vm.startPrank(holder);
        asset.approve(address(vault), type(uint256).max);
        vault.mint(1, holder); // one wei of share
        asset.transfer(address(vault), 100e18); // donate
        uint256 out = vault.redeem(vault.balanceOf(holder), holder, holder);
        vm.stopPrank();

        assertEq(vault.totalSupply(), 0);
        assertLt(out, 100e18 / 100, "donor recovered more than 1% of the donation");
        console2.log("  donated  :", uint256(100e18));
        console2.log("  recovered:", out);
        console2.log("  stranded :", vault.totalAssets());
    }

    /// @notice I8 — status is always one of the two reachable states; CLOSED is
    ///         unreachable in the current source.
    function invariant_StatusIsReachable() public view {
        assertLe(uint256(vault.getVaultStatus()), 1);
    }

    function invariant_CallSummary() public view {
        console2.log("deposit   :", handler.calls("deposit"));
        console2.log("mint      :", handler.calls("mint"));
        console2.log("withdraw  :", handler.calls("withdraw"));
        console2.log("redeem    :", handler.calls("redeem"));
        console2.log("transfer  :", handler.calls("transfer"));
        console2.log("donate    :", handler.calls("donate"));
        console2.log("upkeep    :", handler.calls("upkeep"));
        console2.log("reactivate:", handler.calls("reactivate"));
        console2.log("pause     :", handler.calls("pause"));
        console2.log("zero-share deposits observed:", handler.zeroShareDeposits());
    }
}
