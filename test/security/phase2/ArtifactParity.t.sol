// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../Base.t.sol";

/// @title  Source-of-truth reconciliation: source -> bytecode -> ABI -> backend
/// @notice Phase 1 audited two "vaults" because `contracts/MaonoVault.json` was
///         never regenerated after the Solidity source was replaced by the
///         Phase 1B vault. Phase 2 regenerates the artifact from source
///         (`scripts/build-maono-artifact.mjs`) and these tests are the guard
///         that keeps the two in sync: they fail the moment the committed
///         artifact stops describing `contracts/MaonoVault.sol`.
contract ArtifactParityTest is MaonoVaultBaseTest {
    string internal artifactJson;

    function setUp() public override {
        super.setUp();
        artifactJson = vm.readFile("contracts/MaonoVault.json");
    }

    /// @notice The committed artifact is the compiled current source.
    function test_ArtifactRuntimeCodeMatchesCompiledSource() public view {
        bytes memory fromArtifact = vm.parseBytes(vm.parseJsonString(artifactJson, ".deployedBytecode"));
        bytes memory fromSource = address(implementation).code;

        assertEq(
            keccak256(_stripMetadata(fromArtifact)),
            keccak256(_stripMetadata(fromSource)),
            "contracts/MaonoVault.json is stale - run: node scripts/build-maono-artifact.mjs"
        );
    }

    function test_ArtifactIdentifiesTheCanonicalSource() public view {
        assertEq(vm.parseJsonString(artifactJson, ".contractName"), "MaonoVault_Phase1B");
        assertEq(vm.parseJsonString(artifactJson, ".sourceName"), "contracts/MaonoVault.sol");
    }

    /// @notice The artifact ABI exposes the Phase 1B surface (clone init, upkeep,
    ///         hibernation) and none of the NAV/manager/fee surface of the
    ///         pre-Phase-1B bytecode.
    function test_ArtifactAbiIsThePhase1bSurface() public view {
        string[6] memory expected = [
            "initialize",
            "collectMonthlyUpkeep",
            "reactivateFromHibernation",
            "getVaultStatus",
            "getDiscountedFeePct",
            "getSpawnCostInMTAA"
        ];
        for (uint256 i = 0; i < expected.length; ++i) {
            assertTrue(_abiHas(expected[i]), string.concat("ABI is missing ", expected[i]));
        }

        string[7] memory legacyOnly = [
            "updateNAV",
            "previewNAV",
            "emergencyWithdraw",
            "collectManagementFees",
            "fulfillWithdrawal",
            "setManager",
            "setPerformanceFee"
        ];
        for (uint256 i = 0; i < legacyOnly.length; ++i) {
            assertFalse(_abiHas(legacyOnly[i]), string.concat("stale ABI entry ", legacyOnly[i]));
        }
    }

    /// @notice FINDING (integration): the backend and the deploy script are
    ///         written against the pre-Phase-1B ABI. Every call listed here is
    ///         made by `server/blockchain.ts` / `server/vaultAutomation.ts` and
    ///         reverts against the canonical vault.
    function test_BackendCallsDoNotExistOnTheCanonicalVault() public {
        string[5] memory backendCalls = [
            "previewNAV()", "updateNAV(uint256)", "collectManagementFees()", "emergencyWithdraw(uint256)", "manager()"
        ];
        for (uint256 i = 0; i < backendCalls.length; ++i) {
            (bool ok,) = address(vault).call(abi.encodeWithSignature(backendCalls[i]));
            assertFalse(ok, string.concat("unexpected: canonical vault answers ", backendCalls[i]));
        }
    }

    /// @notice `contracts/deploy_maono_vault.ts` deploys the artifact bytecode
    ///         with three constructor arguments. The canonical vault takes none
    ///         and must be cloned + initialized, so that deployment path is dead.
    function test_LegacyDeploymentPathIsIncompatible() public {
        bytes memory creation = vm.parseBytes(vm.parseJsonString(artifactJson, ".bytecode"));
        bytes memory withCtorArgs = abi.encodePacked(creation, abi.encode(address(asset), treasury, address(0x333A6E)));

        address deployed;
        assembly {
            deployed := create(0, add(withCtorArgs, 0x20), mload(withCtorArgs))
        }
        assertTrue(deployed != address(0), "implementation still deploys");

        // ...but it is an implementation, not a usable vault: initializers are
        // disabled in the constructor, so the deploy script produces a shell.
        vm.expectRevert(abi.encodeWithSignature("InvalidInitialization()"));
        MaonoVault_Phase1B(deployed)
            .initialize(address(asset), "n", "s", vaultOwner, 0, treasury, address(mtaa), address(oracle));
    }

    // ---------------------------------------------------------------- helpers

    function _abiHas(string memory fnName) internal view returns (bool) {
        return _contains(artifactJson, string.concat('"name": "', fnName, '"'));
    }

    function _contains(string memory haystack, string memory needle) internal pure returns (bool) {
        bytes memory h = bytes(haystack);
        bytes memory n = bytes(needle);
        if (n.length == 0 || n.length > h.length) return false;
        for (uint256 i = 0; i <= h.length - n.length; ++i) {
            bool matchFound = true;
            for (uint256 j = 0; j < n.length; ++j) {
                if (h[i + j] != n[j]) {
                    matchFound = false;
                    break;
                }
            }
            if (matchFound) return true;
        }
        return false;
    }

    /// @dev Drops the trailing CBOR metadata so the comparison does not depend
    ///      on absolute source paths or the compiler's metadata settings.
    function _stripMetadata(bytes memory code) internal pure returns (bytes memory) {
        if (code.length < 2) return code;
        uint256 metaLen = (uint256(uint8(code[code.length - 2])) << 8) | uint256(uint8(code[code.length - 1]));
        if (metaLen + 2 > code.length) return code;
        bytes memory out = new bytes(code.length - metaLen - 2);
        for (uint256 i = 0; i < out.length; ++i) {
            out[i] = code[i];
        }
        return out;
    }
}
