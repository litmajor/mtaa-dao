// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "@openzeppelin/contracts/proxy/Clones.sol";

import "../../contracts/MaonoVault.sol";
import "./harness/Mocks.sol";

/// @notice Shared harness for the Mtaa security research suite.
///         Deploys `MaonoVault_Phase1B` exactly the way `MaonoVaultFactory_Phase1B`
///         does it: EIP-1167 clone of an implementation + initialize().
abstract contract MaonoVaultBaseTest is Test {
    MaonoVault_Phase1B internal implementation;
    MaonoVault_Phase1B internal vault;

    MockERC20 internal asset;
    MockMTAA internal mtaa;
    MockPriceOracle internal oracle;

    address internal vaultOwner = address(0xA11CE);
    address internal treasury = address(0x7BEA5);
    address internal attacker = address(0xBAD);
    address internal victim = address(0x1C71);
    address internal bob = address(0xB0B);

    uint8 internal constant DECIMALS_OFFSET = 3;

    function _deployVault(uint8 assetDecimals, uint8 vaultType) internal {
        asset = new MockERC20("Celo Dollar", "cUSD", assetDecimals);
        mtaa = new MockMTAA();
        oracle = new MockPriceOracle(500);

        implementation = new MaonoVault_Phase1B();
        vault = MaonoVault_Phase1B(Clones.clone(address(implementation)));
        vault.initialize(
            address(asset), "Maono Vault Share", "mvUSD", vaultOwner, vaultType, treasury, address(mtaa), address(oracle)
        );

        vm.label(address(vault), "MaonoVault");
        vm.label(address(asset), "Asset");
        vm.label(attacker, "Attacker");
        vm.label(victim, "Victim");
    }

    /// @notice Deploy a vault over an arbitrary (possibly malicious) asset.
    function _deployVaultWithAsset(address assetAddr, uint8 vaultType) internal {
        mtaa = new MockMTAA();
        oracle = new MockPriceOracle(500);
        implementation = new MaonoVault_Phase1B();
        vault = MaonoVault_Phase1B(Clones.clone(address(implementation)));
        vault.initialize(
            assetAddr, "Maono Vault Share", "mvUSD", vaultOwner, vaultType, treasury, address(mtaa), address(oracle)
        );
    }

    function setUp() public virtual {
        _deployVault(18, 0);
    }

    // ---------------------------------------------------------------- helpers

    function _fund(address who, uint256 amount) internal {
        asset.mint(who, amount);
        vm.prank(who);
        asset.approve(address(vault), type(uint256).max);
    }

    function _deposit(address who, uint256 amount) internal returns (uint256 shares) {
        vm.prank(who);
        shares = vault.deposit(amount, who);
    }

    function _redeemAll(address who) internal returns (uint256 assets) {
        uint256 shares = vault.balanceOf(who);
        vm.prank(who);
        assets = vault.redeem(shares, who, who);
    }

    /// @notice Unsolicited transfer of the underlying straight into the vault.
    ///         The vault has no `totalAssets()` override, so this is credited
    ///         to the share price ("donation" / forced-transfer attack).
    function _donate(address from, uint256 amount) internal {
        vm.prank(from);
        asset.transfer(address(vault), amount);
    }

    /// @dev Emits a machine-readable economic ledger line for a manipulation
    ///      attempt. Every suspicious state transition is quantified this way.
    function _logEconomics(
        string memory label,
        uint256 startingCapital,
        uint256 assetsDeposited,
        uint256 sharesReceived,
        uint256 assetsWithdrawn,
        uint256 endingCapital
    ) internal pure {
        console2.log("---- economics:", label);
        console2.log("  attacker starting capital :", startingCapital);
        console2.log("  assets deposited          :", assetsDeposited);
        console2.log("  shares received           :", sharesReceived);
        console2.log("  assets withdrawn          :", assetsWithdrawn);
        console2.log("  attacker ending capital   :", endingCapital);
        if (endingCapital >= startingCapital) {
            console2.log("  attacker PROFIT           :", endingCapital - startingCapital);
        } else {
            console2.log("  attacker LOSS             :", startingCapital - endingCapital);
        }
    }
}
