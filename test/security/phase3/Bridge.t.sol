// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;
 
import "forge-std/Test.sol";
 
import "../harness/Mocks.sol";
import "./harness/BridgeHarness.sol";
import "./harness/CrossChainBridgeReplica.sol";
 
/// @notice Phase 3B — `CrossChainBridge` outbound path.
///
/// The production file does not compile (see BR-1 / the replica header), so
/// these tests run against a generated copy whose only delta is one NatSpec
/// comment line. The router is send-only: there is no local receiving or
/// finalisation function, so replay, domain-separation and message-ordering
/// attacks have no local surface and are not asserted here.
contract BridgeTest is Test {
    MockERC20 internal cusd;
    MockOFTAdapter internal adapter;
    CrossChainBridge internal bridge;
 
    address internal owner = address(this);
    address internal user = address(0x5E4D);
    address internal attacker = address(0xBAD);
    address internal recipient = address(0xDE57);
 
    uint32 internal constant HOME_EID = 30_125; // Celo
    uint32 internal constant DEST_EID = 30_101; // Ethereum
    uint256 internal constant FEE = 0.01 ether;
    uint256 internal constant AMOUNT = 1_000e18;
 
    function setUp() public {
        cusd = new MockERC20("Celo Dollar", "cUSD", 18);
        adapter = new MockOFTAdapter(address(cusd), FEE);
        bridge = new CrossChainBridge(HOME_EID, "Celo");
 
        bridge.configureSupportedChain(DEST_EID, "Ethereum", 200_000);
        bridge.setTokenAdapter(address(cusd), address(adapter));
        bridge.mapToken(address(cusd), DEST_EID, address(0xFEED));
 
        cusd.mint(user, 1_000_000e18);
        vm.prank(user);
        cusd.approve(address(bridge), type(uint256).max);
        vm.deal(user, 10 ether);
    }
 
    function _bridge(uint256 amount, uint256 minAmountLDZ) internal returns (bytes32) {
        vm.prank(user);
        return bridge.bridgeAssets{ value: FEE }(address(cusd), amount, DEST_EID, recipient, minAmountLDZ, "");
    }
 
    // ------------------------------------------------------------------
    // E5 — conservation of the authorised amount
    // ------------------------------------------------------------------
 
    /// @notice What leaves the user equals what the adapter is asked to send, and
    ///         the user's `minAmountLD` is forwarded to LayerZero unmodified.
    function test_AmountAndMinimumAreForwardedUnchanged() public {
        uint256 minOut = (AMOUNT * 9_800) / 10_000;
        uint256 userBefore = cusd.balanceOf(user);
 
        _bridge(AMOUNT, minOut);
 
        assertEq(userBefore - cusd.balanceOf(user), AMOUNT, "exactly the authorised amount is debited");
        assertEq(adapter.lastDebited(), AMOUNT, "adapter receives the full amount");
        (uint32 dstEid, bytes32 to, uint256 amountLD, uint256 minAmountLD,,,) = adapter.lastSendParam();
        assertEq(dstEid, DEST_EID, "destination is the user's");
        assertEq(to, bytes32(uint256(uint160(recipient))), "recipient is the user's");
        assertEq(amountLD, AMOUNT, "amount is the user's");
        assertEq(minAmountLD, minOut, "minimum is the user's, not the router's");
        assertEq(cusd.balanceOf(address(bridge)), 0, "router keeps nothing");
    }
 
    /// @notice NEGATIVE RESULT: the router refuses a destination minimum below its
    ///         own slippage floor, so a user (or a frontend) cannot submit a
    ///         bridge with no meaningful protection.
    function test_MinimumBelowSlippageFloorIsRejected() public {
        uint256 floor = (AMOUNT * 9_500) / 10_000; // default 5% limit
 
        vm.prank(user);
        vm.expectRevert(abi.encodeWithSelector(CrossChainBridge.SlippageExceeded.selector, floor - 1, floor));
        bridge.bridgeAssets{ value: FEE }(address(cusd), AMOUNT, DEST_EID, recipient, floor - 1, "");
 
        // Zero is the dangerous default and is rejected too.
        vm.prank(user);
        vm.expectRevert(abi.encodeWithSelector(CrossChainBridge.SlippageExceeded.selector, 0, floor));
        bridge.bridgeAssets{ value: FEE }(address(cusd), AMOUNT, DEST_EID, recipient, 0, "");
    }
 
    /// @notice The floor is only a *local* check on the argument. Enforcement of
    ///         `minAmountLD` is delegated entirely to the adapter: an adapter that
    ///         debits less than it was asked to leaves the difference behind, and
    ///         the router neither notices nor reverts. TRUST ASSUMPTION, scoped to
    ///         the owner-configured adapter.
    function test_RouterDoesNotVerifyTheAdapterHonouredTheMinimum() public {
        adapter.setDebitBps(5_000); // adapter takes only half
 
        _bridge(AMOUNT, (AMOUNT * 9_800) / 10_000);
 
        assertEq(adapter.lastDebited(), AMOUNT / 2, "adapter under-delivered");
        assertEq(cusd.balanceOf(address(bridge)), AMOUNT / 2, "remainder is stranded in the router");
        // No revert, and the transfer is recorded as Pending exactly as if it had
        // been honoured.
    }
 
    /// @notice Fuzzed E5: over the whole valid range, debit == authorised amount
    ///         and the router retains nothing.
    function testFuzz_ConservationAcrossAmounts(uint256 amount, uint256 slippageBps) public {
        amount = bound(amount, 1, 500_000e18);
        slippageBps = bound(slippageBps, 0, 500);
 
        uint256 minOut = (amount * (10_000 - slippageBps)) / 10_000;
        vm.assume(minOut >= (amount * 9_500) / 10_000);
 
        uint256 userBefore = cusd.balanceOf(user);
        _bridge(amount, minOut);
 
        assertEq(userBefore - cusd.balanceOf(user), amount, "no over-debit");
        assertEq(adapter.lastDebited(), amount, "no under-send");
        assertEq(cusd.balanceOf(address(bridge)), 0, "no residue");
    }
 
    // ------------------------------------------------------------------
    // E6 — adapter isolation
    // ------------------------------------------------------------------
 
    /// @notice CONFIRMED DESIGN RISK: the first bridge grants the adapter an
    ///         unlimited, never-revoked allowance over the router's balance of
    ///         that token. The router is meant to hold nothing between calls, so
    ///         the exposure is any balance that does accumulate — stray transfers,
    ///         or the residue the under-delivering adapter above leaves behind.
    function test_AdapterKeepsAnUnlimitedStandingAllowance() public {
        _bridge(AMOUNT, (AMOUNT * 9_800) / 10_000);
 
        assertEq(
            cusd.allowance(address(bridge), address(adapter)),
            type(uint256).max,
            "allowance is unlimited and outlives the operation"
        );
 
        // A user mistakenly sends tokens straight to the router.
        vm.prank(user);
        cusd.transfer(address(bridge), 50_000e18);
 
        // The adapter can take them at any later time, with no bridge in progress.
        adapter.pullFromRouter(address(bridge), 50_000e18);
        assertEq(cusd.balanceOf(address(bridge)), 0, "stray balance drained by the adapter");
    }
 
    /// @notice The same standing allowance also covers the residue created by an
    ///         under-delivering adapter, so that residue is not recoverable by
    ///         the owner's rescue function if the adapter claims it first.
    function test_StrandedResidueIsReachableByTheAdapter() public {
        adapter.setDebitBps(5_000);
        _bridge(AMOUNT, (AMOUNT * 9_800) / 10_000);
 
        adapter.pullFromRouter(address(bridge), AMOUNT / 2);
        assertEq(cusd.balanceOf(address(bridge)), 0, "residue taken without a second bridge");
    }
 
    /// @notice NEGATIVE RESULT: this is bounded by ownership. An unprivileged
    ///         actor cannot install an adapter, map a token, or enable a chain,
    ///         so the malicious-adapter path requires a compromised owner.
    function test_UnprivilegedActorCannotConfigureRouting() public {
        vm.startPrank(attacker);
 
        vm.expectRevert();
        bridge.setTokenAdapter(address(cusd), attacker);
 
        vm.expectRevert();
        bridge.mapToken(address(cusd), DEST_EID, attacker);
 
        vm.expectRevert();
        bridge.configureSupportedChain(99, "Evil", 200_000);
 
        vm.expectRevert();
        bridge.setTokenSlippageLimit(address(cusd), 10_000);
 
        vm.expectRevert();
        bridge.rescueERC20(address(cusd), attacker, 1);
 
        vm.stopPrank();
    }
 
    /// @notice The owner can set the slippage limit to 100%, which disables the
    ///         local floor entirely and allows `minAmountLD == 0`. Owner-scoped,
    ///         but worth stating: the floor is a configuration, not a guarantee.
    function test_OwnerCanDisableTheSlippageFloorEntirely() public {
        bridge.setTokenSlippageLimit(address(cusd), 10_000);
 
        _bridge(AMOUNT, 0);
        (,,, uint256 minAmountLD,,,) = adapter.lastSendParam();
        assertEq(minAmountLD, 0, "unprotected send accepted");
    }
 
    // ------------------------------------------------------------------
    // Routing allowlist and lifecycle (negative results)
    // ------------------------------------------------------------------
 
    /// @notice NEGATIVE RESULT: unconfigured chains, unmapped tokens and missing
    ///         adapters are all rejected before any token moves.
    function test_UnconfiguredRoutesAreRejected() public {
        vm.startPrank(user);
 
        vm.expectRevert(abi.encodeWithSelector(CrossChainBridge.ChainNotSupported.selector, uint32(99)));
        bridge.bridgeAssets{ value: FEE }(address(cusd), AMOUNT, 99, recipient, AMOUNT, "");
 
        MockERC20 other = new MockERC20("Other", "OTH", 18);
        vm.expectRevert(
            abi.encodeWithSelector(CrossChainBridge.TokenNotMapped.selector, address(other), DEST_EID)
        );
        bridge.bridgeAssets{ value: FEE }(address(other), AMOUNT, DEST_EID, recipient, AMOUNT, "");
 
        vm.expectRevert(CrossChainBridge.ZeroAddress.selector);
        bridge.bridgeAssets{ value: FEE }(address(cusd), AMOUNT, DEST_EID, address(0), AMOUNT, "");
 
        vm.expectRevert(CrossChainBridge.InvalidAmount.selector);
        bridge.bridgeAssets{ value: FEE }(address(cusd), 0, DEST_EID, recipient, 0, "");
 
        vm.stopPrank();
    }
 
    /// @notice NEGATIVE RESULT: a disabled chain stops new sends, and pausing
    ///         stops all of them.
    function test_DisabledChainAndPauseStopSends() public {
        bridge.disableChain(DEST_EID);
        vm.prank(user);
        vm.expectRevert(abi.encodeWithSelector(CrossChainBridge.ChainNotActive.selector, DEST_EID));
        bridge.bridgeAssets{ value: FEE }(address(cusd), AMOUNT, DEST_EID, recipient, AMOUNT, "");
 
        bridge.configureSupportedChain(DEST_EID, "Ethereum", 200_000);
        bridge.pause();
        vm.prank(user);
        vm.expectRevert();
        bridge.bridgeAssets{ value: FEE }(address(cusd), AMOUNT, DEST_EID, recipient, AMOUNT, "");
    }
 
    /// @notice NEGATIVE RESULT: an underpaid message fee is rejected rather than
    ///         silently sent with insufficient gas.
    function test_UnderpaidFeeIsRejected() public {
        vm.prank(user);
        vm.expectRevert(CrossChainBridge.FeeTransferFailed.selector);
        bridge.bridgeAssets{ value: FEE - 1 }(address(cusd), AMOUNT, DEST_EID, recipient, AMOUNT, "");
    }
 
    /// @notice Transfer records are keyed by the LayerZero GUID and are only ever
    ///         written, never advanced past `Pending`: there is no local
    ///         completion, failure or refund path. INFORMATIONAL — the status
    ///         field cannot be relied on off-chain as a delivery signal.
    function test_TransferRecordsRemainPendingForever() public {
        bytes32 id = _bridge(AMOUNT, (AMOUNT * 9_800) / 10_000);
 
        (address u, address t,, uint256 amt,,,, CrossChainBridge.TransferStatus status) = bridge.transfers(id);
        assertEq(u, user);
        assertEq(t, address(cusd));
        assertEq(amt, AMOUNT);
        assertTrue(status == CrossChainBridge.TransferStatus.Pending, "status is Pending");
 
        // There is no function on the router that can move it any further.
    }
}