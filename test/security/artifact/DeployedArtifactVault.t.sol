// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../harness/Mocks.sol";

/// @notice ABI of the *legacy artifact*
///         `test/security/artifact/legacy/MaonoVault.legacy.json`. Until Phase 2
///         this bytecode sat at `contracts/MaonoVault.json` even though the
///         Solidity source had been replaced by the Phase 1B vault, so
///         `server/blockchain.ts` (updateNAV, previewNAV, emergencyWithdraw)
///         is still written against it. Its Solidity source is not in the
///         repository, so it is tested black-box by deploying the archived
///         bytecode on a local chain.
interface IMaonoVaultDeployed {
    function asset() external view returns (address);
    function manager() external view returns (address);
    function owner() external view returns (address);
    function daoTreasury() external view returns (address);
    function decimals() external view returns (uint8);

    function totalAssets() external view returns (uint256);
    function totalSupply() external view returns (uint256);
    function balanceOf(address) external view returns (uint256);
    function transfer(address to, uint256 amount) external returns (bool);
    function convertToShares(uint256) external view returns (uint256);
    function convertToAssets(uint256) external view returns (uint256);
    function previewDeposit(uint256) external view returns (uint256);
    function previewMint(uint256) external view returns (uint256);
    function previewWithdraw(uint256) external view returns (uint256);
    function previewRedeem(uint256) external view returns (uint256);
    function previewNAV() external view returns (uint256, uint256);
    function maxWithdraw(address) external view returns (uint256);
    function maxRedeem(address) external view returns (uint256);

    function deposit(uint256 assets, address receiver) external returns (uint256);
    function mint(uint256 shares, address receiver) external returns (uint256);
    function withdraw(uint256 assets, address receiver, address owner_) external returns (uint256);
    function redeem(uint256 shares, address receiver, address owner_) external returns (uint256);

    function updateNAV(uint256 newNAV) external;
    function lastNAV() external view returns (uint256);
    function lastNAVUpdate() external view returns (uint256);
    function collectManagementFees() external;
    function emergencyWithdraw(uint256 amount) external;
    function fulfillWithdrawal(uint256 requestId) external;
    function withdrawalRequestCounter() external view returns (uint256);
    function withdrawalRequests(uint256) external view returns (address, uint256, uint256, bool);

    function setManager(address) external;
    function setPerformanceFee(uint256) external;
    function setManagementFee(uint256) external;
    function setVaultCap(uint256) external;
    function setMinDeposit(uint256) external;
    function setWithdrawalDelay(uint256) external;
    function setLargeWithdrawalThreshold(uint256) external;

    function performanceFee() external view returns (uint256);
    function managementFee() external view returns (uint256);
    function minDeposit() external view returns (uint256);
    function vaultCap() external view returns (uint256);
    function largeWithdrawalThreshold() external view returns (uint256);
    function withdrawalDelay() external view returns (uint256);
    function totalManagementFeesCollected() external view returns (uint256);
    function totalPerformanceFeesCollected() external view returns (uint256);
    function lastManagementFeeCollection() external view returns (uint256);
    function pause() external;
    function unpause() external;
}

/// @title  The MaonoVault the backend actually integrates with
/// @dev    There is a single canonical vault source, `contracts/MaonoVault.sol`
///         (Phase 1B: upkeep, hibernation, clone). The legacy artifact (NAV,
///         manager, performance/management fees, delayed large withdrawals) is
///         a *different, source-less* contract that the backend is still coded
///         against, so it is kept here as integration-risk evidence.
contract DeployedArtifactVaultTest is Test {
    IMaonoVaultDeployed internal vault;
    MockERC20 internal asset;

    address internal deployer = address(0xDEEDDEED);
    address internal manager = address(0x333A6E);
    address internal treasury = address(0x7BEA5);
    address internal attacker = address(0xBAD);
    address internal bob = address(0xB0B);
    address internal alice = address(0xA71CE);

    address internal ownerAddr;

    function setUp() public {
        asset = new MockERC20("Celo Dollar", "cUSD", 18);
        bytes memory creation = vm.getCode("test/security/artifact/legacy/MaonoVault.legacy.json");
        bytes memory initCode = abi.encodePacked(creation, abi.encode(address(asset), treasury, manager));
        address deployed;
        vm.prank(deployer);
        assembly {
            deployed := create(0, add(initCode, 0x20), mload(initCode))
        }
        require(deployed != address(0), "artifact deployment failed");
        vault = IMaonoVaultDeployed(deployed);
        vm.label(deployed, "MaonoVault(artifact)");

        // Derived from bytecode, not documentation.
        ownerAddr = vault.owner();
    }

    function _raiseCap(uint256 cap) internal {
        vm.prank(ownerAddr);
        vault.setVaultCap(cap);
    }

    function _fund(address who, uint256 amount) internal {
        asset.mint(who, amount);
        vm.prank(who);
        asset.approve(address(vault), type(uint256).max);
    }

    function _deposit(address who, uint256 amount) internal returns (uint256) {
        vm.prank(who);
        return vault.deposit(amount, who);
    }

    // ------------------------------------------------------------------
    // Model discovery
    // ------------------------------------------------------------------
    function test_DiscoverAccountingModel() public {
        console2.log("owner            :", vault.owner());
        console2.log("manager          :", vault.manager());
        console2.log("daoTreasury      :", vault.daoTreasury());
        console2.log("decimals         :", vault.decimals());
        console2.log("minDeposit       :", vault.minDeposit());
        console2.log("vaultCap         :", vault.vaultCap());
        console2.log("performanceFee   :", vault.performanceFee());
        console2.log("managementFee    :", vault.managementFee());
        console2.log("withdrawalDelay  :", vault.withdrawalDelay());
        console2.log("largeWithdrawal  :", vault.largeWithdrawalThreshold());

        _fund(bob, 100_000e18);
        uint256 shares = _deposit(bob, 10_000e18);
        console2.log("shares for 10k   :", shares);
        console2.log("totalAssets      :", vault.totalAssets());
        console2.log("totalSupply      :", vault.totalSupply());

        asset.mint(address(vault), 1_000e18); // donation
        console2.log("totalAssets after 1k donation:", vault.totalAssets());

        vm.prank(manager);
        vault.updateNAV(50_000e18);
        console2.log("lastNAV                      :", vault.lastNAV());
        console2.log("totalAssets after updateNAV  :", vault.totalAssets());
        console2.log("previewRedeem(shares)        :", vault.previewRedeem(shares));

        // Large-withdrawal path
        vm.prank(bob);
        uint256 ret = vault.withdraw(2_000e18, bob, bob);
        console2.log("withdraw(2000) return value  :", ret);
        console2.log("bob asset balance after      :", asset.balanceOf(bob));
        console2.log("withdrawalRequestCounter     :", vault.withdrawalRequestCounter());
        if (vault.withdrawalRequestCounter() > 0) {
            (address user, uint256 amount, uint256 ts, bool fulfilled) = vault.withdrawalRequests(0);
            console2.log("  request[0] user     :", user);
            console2.log("  request[0] amount   :", amount);
            console2.log("  request[0] timestamp:", ts);
            console2.log("  request[0] fulfilled:", fulfilled);
        }
    }

    // ------------------------------------------------------------------
    // Manager-reported NAV must not be able to reprice shares.
    // ------------------------------------------------------------------
    function test_ManagerNavDoesNotRepriceShares() public {
        _fund(bob, 100_000e18);
        uint256 shares = _deposit(bob, 10_000e18);
        uint256 before = vault.previewRedeem(shares);

        vm.prank(manager);
        vault.updateNAV(1_000_000e18); // 100x claimed NAV

        assertEq(vault.previewRedeem(shares), before, "NAV must not reprice shares");
        assertEq(vault.totalAssets(), asset.balanceOf(address(vault)), "totalAssets is the real balance");
    }

    /// @notice FINDING: `previewNAV()` - the value `server/vaultAutomation.ts`
    ///         reports to users - returns the manager-supplied `lastNAV`, not
    ///         the vault's real asset balance. It is unbacked reporting: the
    ///         manager can display any NAV while share redemption is unaffected.
    function test_PreviewNavReportsManagerControlledNumber() public {
        _fund(bob, 100_000e18);
        _deposit(bob, 10_000e18);

        (uint256 navBefore,) = vault.previewNAV();
        assertEq(navBefore, 0, "NAV is 0 until a manager reports one");
        assertEq(vault.totalAssets(), 10_000e18);

        vm.prank(manager);
        vault.updateNAV(1_000_000e18);
        (uint256 nav, uint256 ts) = vault.previewNAV();
        console2.log("  reported NAV :", nav);
        console2.log("  real assets  :", vault.totalAssets());
        console2.log("  reported at  :", ts);
        assertEq(nav, 1_000_000e18, "reported NAV is whatever the manager says");
        assertEq(vault.totalAssets(), 10_000e18, "real assets unchanged");

        // The discrepancy is reporting-only: no assets move and no shares are
        // repriced, so it is not directly extractable on-chain.
        assertEq(vault.previewRedeem(vault.balanceOf(bob)), 10_000e18);
    }

    // ------------------------------------------------------------------
    // emergencyWithdraw: privilege and economic impact.
    // ------------------------------------------------------------------
    function test_EmergencyWithdrawDrainsToTreasuryWhileSharesRemain() public {
        _fund(bob, 100_000e18);
        _deposit(bob, 10_000e18);

        vm.prank(attacker);
        (bool ok,) = address(vault).call(abi.encodeWithSignature("emergencyWithdraw(uint256)", 10_000e18));
        assertFalse(ok, "unprivileged emergencyWithdraw must fail");

        uint256 treasuryBefore = asset.balanceOf(treasury);
        uint256 ownerBefore = asset.balanceOf(ownerAddr);

        vm.prank(ownerAddr);
        vault.emergencyWithdraw(10_000e18);

        console2.log("  treasury delta:", asset.balanceOf(treasury) - treasuryBefore);
        console2.log("  owner delta   :", asset.balanceOf(ownerAddr) - ownerBefore);
        console2.log("  vault left    :", vault.totalAssets());
        console2.log("  shares outstanding:", vault.totalSupply());
        console2.log("  bob claim now :", vault.previewRedeem(vault.balanceOf(bob)));

        // 100% of depositor capital leaves the vault in one privileged call
        // while every share stays outstanding: accounting != economic reality.
        assertEq(vault.totalAssets(), 0);
        assertGt(vault.totalSupply(), 0);
        assertEq(vault.previewRedeem(vault.balanceOf(bob)), 0, "depositor claim wiped out");
    }

    // ------------------------------------------------------------------
    // Unprivileged access-control probes over the whole admin surface.
    // ------------------------------------------------------------------
    function test_AdminSurfaceIsGated() public {
        bytes[9] memory calls = [
            abi.encodeWithSignature("setManager(address)", attacker),
            abi.encodeWithSignature("setPerformanceFee(uint256)", uint256(0)),
            abi.encodeWithSignature("setManagementFee(uint256)", uint256(0)),
            abi.encodeWithSignature("setVaultCap(uint256)", type(uint256).max),
            abi.encodeWithSignature("setMinDeposit(uint256)", uint256(0)),
            abi.encodeWithSignature("setWithdrawalDelay(uint256)", uint256(0)),
            abi.encodeWithSignature("setLargeWithdrawalThreshold(uint256)", type(uint256).max),
            abi.encodeWithSignature("pause()"),
            abi.encodeWithSignature("emergencyWithdraw(uint256)", uint256(1))
        ];
        for (uint256 i = 0; i < calls.length; ++i) {
            vm.prank(attacker);
            (bool ok,) = address(vault).call(calls[i]);
            assertFalse(ok, "unprivileged admin call must revert");
        }

        // updateNAV is the manager's, not the public's.
        vm.prank(attacker);
        (bool navOk,) = address(vault).call(abi.encodeWithSignature("updateNAV(uint256)", 1e30));
        assertFalse(navOk, "unprivileged updateNAV must revert");
    }

    // ------------------------------------------------------------------
    // Delayed large withdrawals: can the queue be abused?
    // ------------------------------------------------------------------
    function test_LargeWithdrawalQueueCannotBeStolenOrReplayed() public {
        _raiseCap(10_000_000e18);
        _fund(bob, 1_000_000e18);
        _deposit(bob, 500_000e18);

        uint256 threshold = vault.largeWithdrawalThreshold();
        vm.prank(bob);
        vault.withdraw(threshold * 2, bob, bob); // queued, not paid

        uint256 id = vault.withdrawalRequestCounter();
        (address user, uint256 amount,, bool fulfilled) = vault.withdrawalRequests(id);
        assertEq(user, bob);
        assertFalse(fulfilled);
        console2.log("  queued amount:", amount);

        // Not claimable before the delay elapses.
        vm.prank(bob);
        (bool early,) = address(vault).call(abi.encodeWithSignature("fulfillWithdrawal(uint256)", id));
        assertFalse(early, "must respect withdrawalDelay");

        vm.warp(block.timestamp + vault.withdrawalDelay() + 1);

        // Only the requester may push it through.
        vm.prank(attacker);
        (bool byStranger,) = address(vault).call(abi.encodeWithSignature("fulfillWithdrawal(uint256)", id));
        assertFalse(byStranger, "third party cannot fulfil someone else's request");

        uint256 bobBefore = asset.balanceOf(bob);
        vm.prank(bob);
        vault.fulfillWithdrawal(id);
        assertEq(asset.balanceOf(bob) - bobBefore, amount, "assets go to the requester");

        // No double-spend.
        vm.prank(bob);
        (bool replay,) = address(vault).call(abi.encodeWithSignature("fulfillWithdrawal(uint256)", id));
        assertFalse(replay, "request must not be fulfillable twice");
    }

    /// @notice FINDING: a queued request neither burns shares nor validates the
    ///         requested amount against the caller's position. Both checks only
    ///         happen at fulfilment time, so unfulfillable requests can be
    ///         created at will.
    function test_QueuedRequestsAreUnvalidatedAtCreation() public {
        _raiseCap(10_000_000e18);
        _fund(bob, 1_000_000e18);
        uint256 shares = _deposit(bob, 500_000e18);

        vm.prank(bob);
        vault.withdraw(vault.largeWithdrawalThreshold() * 2, bob, bob);
        assertEq(vault.balanceOf(bob), shares, "no shares burned at request time");

        // A request far larger than the caller's whole position is accepted.
        _fund(attacker, 20e18);
        _deposit(attacker, 20e18);
        vm.prank(attacker);
        vault.withdraw(400_000e18, attacker, attacker);
        (address user, uint256 amount,,) = vault.withdrawalRequests(vault.withdrawalRequestCounter());
        assertEq(user, attacker);
        assertEq(amount, 400_000e18, "unbacked request accepted");

        // It can never be fulfilled - the position simply is not there.
        vm.warp(block.timestamp + vault.withdrawalDelay() + 1);
        vm.prank(attacker);
        (bool ok,) = address(vault).call(
            abi.encodeWithSignature("fulfillWithdrawal(uint256)", vault.withdrawalRequestCounter())
        );
        assertFalse(ok, "unbacked request cannot be fulfilled");
    }

    /// @notice FINDING: `withdraw()` above the threshold returns a non-zero
    ///         value and emits no transfer. `server/blockchain.ts` treats a
    ///         successful transaction as a completed withdrawal.
    function test_LargeWithdrawReturnsValueWithoutPayingOut() public {
        _raiseCap(10_000_000e18);
        _fund(bob, 1_000_000e18);
        _deposit(bob, 500_000e18);

        uint256 before = asset.balanceOf(bob);
        vm.prank(bob);
        uint256 ret = vault.withdraw(5_000e18, bob, bob);
        assertGt(ret, 0, "non-zero return value");
        assertEq(asset.balanceOf(bob), before, "but nothing was transferred");
    }

    /// @notice FINDING: fulfilment requires `previewWithdraw(amount)` shares,
    ///         which rounds UP, so a request for exactly the depositor's own
    ///         deposit amount is one wei of shares short and reverts forever.
    function test_FullPositionRequestIsUnfulfillableByOneWei() public {
        _raiseCap(10_000_000e18);
        _fund(alice, 1_000_000e18);
        _deposit(alice, 100_000e18);
        asset.mint(address(vault), 100_000e18); // share price 2x

        _fund(bob, 100_000e18);
        uint256 shares = _deposit(bob, 10_000e18);
        vm.prank(bob);
        vault.withdraw(10_000e18, bob, bob); // exactly what bob paid in

        vm.warp(block.timestamp + vault.withdrawalDelay() + 1);
        vm.prank(bob);
        (bool ok, bytes memory err) =
            address(vault).call(abi.encodeWithSignature("fulfillWithdrawal(uint256)", 1));
        console2.log("  bob shares       :", shares);
        console2.log("  shares required  :", vault.previewWithdraw(10_000e18));
        assertFalse(ok, "request stuck by one wei of shares");
        assertEq(bytes4(err), bytes4(0xe450d38c), "InsufficientBalance");

        // Funds are not lost: the user can still exit through redeem().
        vm.prank(bob);
        uint256 out = vault.redeem(shares, bob, bob);
        assertApproxEqAbs(out, 10_000e18, 2);
    }

    // ------------------------------------------------------------------
    // Fee accounting.
    // ------------------------------------------------------------------
    function test_ManagementFeeCannotBeCollectedRepeatedly() public {
        _raiseCap(10_000_000e18);
        _fund(bob, 1_000_000e18);
        _deposit(bob, 100_000e18);

        vm.warp(block.timestamp + 365 days);
        uint256 treasuryBefore = asset.balanceOf(treasury);
        vm.prank(ownerAddr);
        vault.collectManagementFees();
        uint256 firstFee = asset.balanceOf(treasury) - treasuryBefore;
        console2.log("  annual management fee taken:", firstFee);

        vm.prank(ownerAddr);
        vault.collectManagementFees();
        uint256 secondFee = asset.balanceOf(treasury) - treasuryBefore - firstFee;
        console2.log("  immediate second collection:", secondFee);
        assertEq(secondFee, 0, "fees must accrue over time, not per call");

        // 2% annual on 100k = 2k.
        assertApproxEqRel(firstFee, 2_000e18, 1e16);
        assertEq(vault.totalAssets(), asset.balanceOf(address(vault)));
    }

    function test_FeeParametersAreBounded() public {
        vm.prank(ownerAddr);
        (bool ok,) = address(vault).call(abi.encodeWithSignature("setPerformanceFee(uint256)", uint256(10_000)));
        assertFalse(ok, "performance fee must be bounded");
        vm.prank(ownerAddr);
        (ok,) = address(vault).call(abi.encodeWithSignature("setManagementFee(uint256)", uint256(10_000)));
        assertFalse(ok, "management fee must be bounded");
    }

    // ------------------------------------------------------------------
    // Standard ERC-4626 economic invariants on the artifact.
    // ------------------------------------------------------------------
    function test_RoundTripIsNotProfitable() public {
        _raiseCap(10_000_000e18);
        _fund(bob, 1_000_000e18);
        _deposit(bob, 100_000e18);

        _fund(attacker, 100_000e18);
        uint256 start = asset.balanceOf(attacker);
        uint256 shares = _deposit(attacker, 500e18); // below the large-withdrawal threshold
        vm.prank(attacker);
        vault.redeem(shares, attacker, attacker);
        console2.log("  attacker start:", start);
        console2.log("  attacker end  :", asset.balanceOf(attacker));
        assertLe(asset.balanceOf(attacker), start, "round trip must not create value");
    }

    function test_FirstDepositorInflationOnArtifact() public {
        _raiseCap(10_000_000e18);
        _fund(attacker, 1_000_000e18);
        _fund(bob, 10_000e18);

        uint256 minDep = vault.minDeposit();
        console2.log("  minDeposit floor:", minDep);

        vm.prank(attacker);
        uint256 attackerShares = vault.deposit(minDep, attacker);
        vm.prank(attacker);
        asset.transfer(address(vault), 50_000e18); // donation

        uint256 bobShares = _deposit(bob, 10_000e18);
        console2.log("  attacker shares:", attackerShares);
        console2.log("  bob shares     :", bobShares);
        console2.log("  bob redeemable :", vault.previewRedeem(bobShares));

        vm.prank(attacker);
        vault.redeem(attackerShares, attacker, attacker);
        console2.log("  attacker end capital:", asset.balanceOf(attacker));

        assertGt(bobShares, 0, "min deposit floor prevents zero-share rounding");
        assertLe(asset.balanceOf(attacker), 1_000_000e18, "inflation must not be profitable");
    }

    function test_DonationDoesNotMintShares() public {
        _raiseCap(10_000_000e18);
        _fund(bob, 100_000e18);
        uint256 shares = _deposit(bob, 10_000e18);

        asset.mint(attacker, 5_000e18);
        vm.prank(attacker);
        asset.transfer(address(vault), 5_000e18);

        assertEq(vault.balanceOf(attacker), 0);
        assertGt(vault.previewRedeem(shares), 10_000e18, "donation accrues to holders");
    }

    function testFuzz_PreviewsMatchExecution(uint96 seed, uint96 amount) public {
        _raiseCap(type(uint256).max);
        seed = uint96(bound(seed, vault.minDeposit(), 1e24));
        _fund(bob, seed);
        _deposit(bob, seed);

        amount = uint96(bound(amount, vault.minDeposit(), 1e24));
        _fund(attacker, amount);
        uint256 pd = vault.previewDeposit(amount);
        vm.prank(attacker);
        assertEq(vault.deposit(amount, attacker), pd, "previewDeposit != deposit");

        uint256 attackerShares = vault.balanceOf(attacker);
        uint256 pr = vault.previewRedeem(attackerShares);
        if (pr < vault.largeWithdrawalThreshold()) {
            uint256 balBefore = asset.balanceOf(attacker);
            vm.prank(attacker);
            vault.redeem(attackerShares, attacker, attacker);
            assertEq(asset.balanceOf(attacker) - balBefore, pr, "previewRedeem != redeem");
        }
    }

    function testFuzz_NoValueCreatedByDepositRedeem(uint96 seed, uint96 amount) public {
        _raiseCap(type(uint256).max);
        seed = uint96(bound(seed, vault.minDeposit(), 1e24));
        _fund(bob, seed);
        _deposit(bob, seed);

        amount = uint96(bound(amount, vault.minDeposit(), uint96(vault.largeWithdrawalThreshold()) - 1));
        _fund(attacker, amount);
        uint256 start = asset.balanceOf(attacker);
        uint256 shares = _deposit(attacker, amount);
        vm.prank(attacker);
        vault.redeem(shares, attacker, attacker);
        assertLe(asset.balanceOf(attacker), start, "no value created");
    }
}
