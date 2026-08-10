// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";

import "../../../../contracts/MultiAssetVault.sol";
import "./DefiHarness.sol";

/// @notice Shared Phase 3 fixture for the `MultiAssetVault` swap layer.
///
/// Everything is local and deterministic: a constant-product pool whose spot
/// price starts exactly at the oracle price, a vault wired to that pool, and an
/// unprivileged MEV searcher with no protocol role whatsoever.
abstract contract MultiAssetSwapBase is Test {
    MultiAssetVault internal vault;
    SyntheticAmmRouter internal router;
    MultiAssetPriceOracle internal oracle;
    MockERC20 internal cusd;
    MockERC20 internal wbtc;
    MockERC20 internal weth;
    MevSearcher internal searcher;

    address internal admin = address(0xA11CE);
    address internal manager = address(0x111A9E);
    address internal rebalancer = address(0xB0B);
    address internal feeCollector = address(0xFEE);
    address internal investor = address(0x1C71);
    address internal liquidityProvider = address(0x11D);

    /// @dev $60,000 per BTC, USD scaled by 1e8 the way the vault's oracle is.
    uint256 internal constant BTC_USD = 60_000e8;
    uint256 internal constant CUSD_USD = 1e8;
    uint256 internal constant ETH_USD = 3_000e8;

    /// @dev Pools start at exactly the oracle price.
    uint256 internal constant POOL_BTC = 100e8;
    uint256 internal constant POOL_CUSD = 6_000_000e18;
    uint256 internal constant POOL_ETH = 1_000e18;
    uint256 internal constant POOL_CUSD_ETH = 3_000_000e18;

    function _deploySwapFixture() internal {
        cusd = new MockERC20("Celo Dollar", "cUSD", 18);
        wbtc = new MockERC20("Wrapped BTC", "WBTC", 8);
        weth = new MockERC20("Wrapped Ether", "WETH", 18);

        oracle = new MultiAssetPriceOracle();
        oracle.setPrice(address(cusd), CUSD_USD);
        oracle.setPrice(address(wbtc), BTC_USD);
        oracle.setPrice(address(weth), ETH_USD);

        router = new SyntheticAmmRouter();
        searcher = new MevSearcher(router);

        vm.startPrank(admin);
        vault = new MultiAssetVault("Multi-Asset Pool", "MAP", feeCollector, address(oracle), address(router));
        vault.grantRole(vault.MANAGER_ROLE(), manager);
        vault.grantRole(vault.REBALANCER_ROLE(), rebalancer);
        vault.setStablecoin(address(cusd));
        vault.registerAsset("BTC", address(wbtc), 8, 5_000);
        vault.registerAsset("ETH", address(weth), 18, 5_000);
        vm.stopPrank();

        _seedPool();
    }

    function _seedPool() private {
        wbtc.mint(liquidityProvider, POOL_BTC);
        weth.mint(liquidityProvider, POOL_ETH);
        cusd.mint(liquidityProvider, POOL_CUSD + POOL_CUSD_ETH);

        vm.startPrank(liquidityProvider);
        wbtc.approve(address(router), POOL_BTC);
        weth.approve(address(router), POOL_ETH);
        cusd.approve(address(router), POOL_CUSD + POOL_CUSD_ETH);
        router.addLiquidity(address(wbtc), POOL_BTC, address(cusd), POOL_CUSD);
        router.addLiquidity(address(weth), POOL_ETH, address(cusd), POOL_CUSD_ETH);
        vm.stopPrank();
    }

    /// @dev Give the vault a BTC position to rebalance out of.
    function _fundVaultWithBtc(uint256 amount) internal {
        wbtc.mint(address(vault), amount);
    }

    function _sellBtcViaRebalance(uint256 amount) internal {
        address[] memory tokens = new address[](1);
        uint256[] memory amounts = new uint256[](1);
        bool[] memory isBuy = new bool[](1);
        tokens[0] = address(wbtc);
        amounts[0] = amount;
        isBuy[0] = false;

        vm.prank(rebalancer);
        vault.batchRebalance(tokens, amounts, isBuy);
    }

    function _buyBtcViaRebalance(uint256 stableAmount) internal {
        address[] memory tokens = new address[](1);
        uint256[] memory amounts = new uint256[](1);
        bool[] memory isBuy = new bool[](1);
        tokens[0] = address(wbtc);
        amounts[0] = stableAmount;
        isBuy[0] = true;

        vm.prank(rebalancer);
        vault.batchRebalance(tokens, amounts, isBuy);
    }
}
