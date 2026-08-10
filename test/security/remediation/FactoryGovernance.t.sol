// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../Base.t.sol";
import "../../../contracts/MaonoVaultFactory.sol";

/// @notice Minimal gateway so `deployVault()` can run: spawn credit is consumed
///         elsewhere in production and is not the subject of these tests.
contract PermissiveSpawnGateway is IDAOSpawnGateway {
    function consumeSpawnCredit(address, uint256) external {}
}

/// @title  P2-1 / P2-7 / M-2 — vaults are governed by the platform that spawned them
/// @notice The remediation moved every fee/oracle/treasury lever from the vault owner
///         to `platformAdmin`, which `initialize()` records as its caller. In
///         production that caller is always the factory (vaults are only ever created
///         as clones through `deployVault()`), so this suite deploys the real factory
///         and exercises the whole chain: factory owner -> factory -> vault.
contract FactoryGovernanceTest is Test {
    MaonoVaultFactory_Phase1B internal factory;
    MaonoVault_Phase1B internal implementation;
    MaonoVault_Phase1B internal vault;

    MockERC20 internal asset;
    MockMTAA internal mtaa;
    MockPriceOracle internal oracle;
    PermissiveSpawnGateway internal gateway;

    address internal platform = address(this);
    address internal platformTreasury = address(0x7BEA5);
    address internal vaultOwner = address(0xA11CE);
    address internal attacker = address(0xBAD);

    function setUp() public {
        asset = new MockERC20("Celo Dollar", "cUSD", 18);
        mtaa = new MockMTAA();
        oracle = new MockPriceOracle(500);
        gateway = new PermissiveSpawnGateway();
        implementation = new MaonoVault_Phase1B();

        address[] memory assets = new address[](1);
        assets[0] = address(asset);
        factory = new MaonoVaultFactory_Phase1B(
            address(implementation), platformTreasury, address(mtaa), address(oracle), assets
        );
        factory.setSpawnGateway(address(gateway));

        vm.prank(vaultOwner);
        vault = MaonoVault_Phase1B(factory.deployVault(address(asset), "Maono", "mv", 0));
    }

    // ------------------------------------------------------------------
    // P2-7: the canonical deployment path
    // ------------------------------------------------------------------
    function test_DeployedVaultIsAnInitializedCloneOwnedByTheCaller() public view {
        assertTrue(factory.isLegitimateVault(address(vault)));
        assertEq(vault.owner(), vaultOwner, "the deployer owns the vault");
        assertEq(vault.platformAdmin(), address(factory), "the factory is the platform admin");
        assertEq(vault.asset(), address(asset));
        assertEq(vault.daoTreasury(), platformTreasury);
        assertEq(uint256(vault.getVaultStatus()), 0, "ACTIVE");
        assertTrue(address(vault).code.length < address(implementation).code.length, "EIP-1167 clone");
    }

    function test_CloneCannotBeReinitializedAndTheImplementationIsLocked() public {
        vm.prank(attacker);
        vm.expectRevert();
        vault.initialize(address(asset), "x", "x", attacker, 0, attacker, address(mtaa), address(oracle));

        vm.prank(attacker);
        vm.expectRevert();
        implementation.initialize(address(asset), "x", "x", attacker, 0, attacker, address(mtaa), address(oracle));
    }

    // ------------------------------------------------------------------
    // P2-1: only the platform, through the factory, moves the economics
    // ------------------------------------------------------------------
    function test_PlatformConfiguresVaultEconomicsThroughTheFactory() public {
        factory.setVaultUpkeepCost(address(vault), 0, 40e18);
        assertEq(vault.getMonthlyUpkeepCost(), 40e18);

        factory.setVaultBurnPercentage(address(vault), 0, 2500);
        factory.setVaultOracleBounds(address(vault), 1, 10_000_000);
        factory.setVaultOracleCircuitEnabled(address(vault), false);
        factory.syncVaultTreasury(address(vault));
        assertEq(vault.daoTreasury(), platformTreasury);
    }

    function test_NeitherTheVaultOwnerNorAnyoneElseCanReachThoseLevers() public {
        address[2] memory outsiders = [vaultOwner, attacker];
        for (uint256 i = 0; i < outsiders.length; ++i) {
            // Directly on the vault: the factory is the platform admin, not them.
            vm.startPrank(outsiders[i]);
            vm.expectRevert(MaonoVault_Phase1B.NotPlatformAdmin.selector);
            vault.setUpkeepCostAt(0, 0);
            vm.expectRevert(MaonoVault_Phase1B.NotPlatformAdmin.selector);
            vault.setDaoTreasury(outsiders[i]);
            vm.expectRevert(MaonoVault_Phase1B.NotPlatformAdmin.selector);
            vault.setBurnPercentageAt(0, 0);

            // ...and through the factory: that is the platform's own gate.
            vm.expectRevert(abi.encodeWithSignature("OwnableUnauthorizedAccount(address)", outsiders[i]));
            factory.setVaultUpkeepCost(address(vault), 0, 0);
            vm.expectRevert(abi.encodeWithSignature("OwnableUnauthorizedAccount(address)", outsiders[i]));
            factory.syncVaultTreasury(address(vault));
            vm.stopPrank();
        }
        assertEq(vault.getMonthlyUpkeepCost(), 15e18, "price unmoved");
    }

    /// @notice The forwarders only speak to vaults this factory actually deployed, so
    ///         a look-alike vault cannot borrow the factory's authority.
    function test_FactoryRefusesToConfigureForeignVaults() public {
        MaonoVault_Phase1B rogue = MaonoVault_Phase1B(Clones.clone(address(implementation)));
        rogue.initialize(address(asset), "r", "r", attacker, 0, attacker, address(mtaa), address(oracle));

        vm.expectRevert(MaonoVaultFactory_Phase1B.VaultNotRegistered.selector);
        factory.setVaultUpkeepCost(address(rogue), 0, 1);
    }

    // ------------------------------------------------------------------
    // M-2: the supported-asset model
    // ------------------------------------------------------------------
    /// @notice MTAA is custodied by the vault (upkeep, discount stake), so it can never
    ///         be the underlying — enforced at both the allowlist and the deploy path.
    function test_MtaaCanNeverBecomeAVaultAsset() public {
        vm.expectRevert(MaonoVaultFactory_Phase1B.AssetIsMtaaToken.selector);
        factory.addSupportedAsset(address(mtaa), "MTAA");

        MaonoVault_Phase1B mtaaVault = MaonoVault_Phase1B(Clones.clone(address(implementation)));
        vm.prank(attacker);
        vm.expectRevert(MaonoVault_Phase1B.MtaaCannotBeTheAsset.selector);
        mtaaVault.initialize(address(mtaa), "x", "x", attacker, 0, attacker, address(mtaa), address(oracle));
    }

    /// @notice Vaults exist only over allowlisted assets, and the allowlist is the
    ///         platform's. That is the enforcement point for the M-2 invariant.
    function test_VaultsOnlyExistOverAllowlistedAssets() public {
        MockERC20 stranger = new MockERC20("Stranger", "STR", 18);

        vm.prank(vaultOwner);
        vm.expectRevert(MaonoVaultFactory_Phase1B.UnsupportedAsset.selector);
        factory.deployVault(address(stranger), "x", "x", 0);

        vm.prank(attacker);
        vm.expectRevert(abi.encodeWithSignature("OwnableUnauthorizedAccount(address)", attacker));
        factory.addSupportedAsset(address(stranger), "STR");

        factory.addSupportedAsset(address(stranger), "STR");
        vm.prank(vaultOwner);
        factory.deployVault(address(stranger), "x", "x", 0);
    }

    /// @notice Belt and braces for M-2: even if an incompatible token were allowlisted
    ///         by mistake, a fee-on-transfer deposit is rejected instead of minting
    ///         shares against assets that never arrived.
    function test_FeeOnTransferDepositIsRejectedRatherThanUnderbacked() public {
        FeeOnTransferERC20 fee = new FeeOnTransferERC20(100); // 1%
        factory.addSupportedAsset(address(fee), "FEE");
        vm.prank(vaultOwner);
        MaonoVault_Phase1B feeVault = MaonoVault_Phase1B(factory.deployVault(address(fee), "f", "f", 0));

        fee.mint(vaultOwner, 1_000e18);
        vm.startPrank(vaultOwner);
        fee.approve(address(feeVault), type(uint256).max);
        vm.expectRevert(MaonoVault_Phase1B.AssetTransferMismatch.selector);
        feeVault.deposit(1_000e18, vaultOwner);
        vm.stopPrank();

        assertEq(feeVault.totalSupply(), 0, "no unbacked shares exist");
        assertEq(feeVault.totalAssets(), fee.balanceOf(address(feeVault)), "accounting intact");
    }

    /// @notice And the invariant the whole model rests on holds for a compliant asset.
    function test_TotalAssetsTracksTheBalanceForCompliantAssets() public {
        asset.mint(vaultOwner, 1_000e18);
        vm.startPrank(vaultOwner);
        asset.approve(address(vault), type(uint256).max);
        vault.deposit(1_000e18, vaultOwner);
        vm.stopPrank();

        assertEq(vault.totalAssets(), asset.balanceOf(address(vault)));
        assertEq(vault.totalAssets(), 1_000e18);
    }
}
