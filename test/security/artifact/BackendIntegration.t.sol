// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../Base.t.sol";
import "./DeployedArtifactVault.t.sol";

/// @title  Backend <-> contract integration mismatches
/// @notice `server/blockchain.ts` binds `contracts/MaonoVault.json` to
///         `MAONO_CONTRACT_ADDRESS`. These tests check that every call the
///         backend makes actually exists on the code it may be pointed at.
contract BackendIntegrationTest is MaonoVaultBaseTest {
    IMaonoVaultDeployed internal artifactVault;
    MockERC20 internal artifactAsset;

    address internal manager = address(0x333A6E);

    function setUp() public override {
        super.setUp();
        artifactAsset = new MockERC20("cUSD", "cUSD", 18);
        bytes memory initCode = abi.encodePacked(
            vm.getCode("contracts/MaonoVault.json"), abi.encode(address(artifactAsset), treasury, manager)
        );
        address d;
        assembly {
            d := create(0, add(initCode, 0x20), mload(initCode))
        }
        artifactVault = IMaonoVaultDeployed(d);
    }

    /// @notice FINDING: `MaonoVaultService.distributePerformanceFee()` is called
    ///         by the NAV automation, but no such function exists in the
    ///         artifact. Every performance-fee distribution reverts.
    function test_DistributePerformanceFeeDoesNotExist() public {
        vm.prank(manager);
        (bool ok,) =
            address(artifactVault).call(abi.encodeWithSignature("distributePerformanceFee(uint256)", uint256(1e18)));
        assertFalse(ok, "backend calls a function the contract does not have");
    }

    /// @notice The two MaonoVaults in this repository are not interchangeable:
    ///         pointing the backend at a Phase 1B vault breaks NAV automation,
    ///         and the artifact has none of the Phase 1B upkeep surface.
    function test_TheTwoVaultsShareNoAdminSurface() public {
        string[4] memory artifactOnly =
            ["updateNAV(uint256)", "previewNAV()", "emergencyWithdraw(uint256)", "collectManagementFees()"];
        for (uint256 i = 0; i < artifactOnly.length; ++i) {
            (bool ok,) = address(vault).call(abi.encodeWithSignature(artifactOnly[i]));
            assertFalse(ok, "Phase 1B does not implement the backend's NAV/fee API");
        }

        string[3] memory phase1bOnly =
            ["collectMonthlyUpkeep()", "reactivateFromHibernation()", "getMonthlyUpkeepCost()"];
        for (uint256 i = 0; i < phase1bOnly.length; ++i) {
            (bool ok,) = address(artifactVault).call(abi.encodeWithSignature(phase1bOnly[i]));
            assertFalse(ok, "the artifact does not implement the upkeep model");
        }
    }

    /// @notice Both contracts do agree on the ERC-4626 entry points the
    ///         frontend uses, so deposits/withdrawals do not silently target
    ///         the wrong ABI.
    function test_Erc4626SurfaceIsCommonToBoth() public view {
        assertEq(vault.asset(), address(asset));
        assertEq(artifactVault.asset(), address(artifactAsset));
        assertEq(vault.decimals(), 21); // 18 + _decimalsOffset()
        assertEq(artifactVault.decimals(), 18);
    }
}
