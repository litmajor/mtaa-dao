// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;
 
import "forge-std/Test.sol";
 
import "../harness/Mocks.sol";
import "../../../contracts/MultiSigTreasury.sol";
 
/// @notice Phase 3B — `MultiSigTreasury` authorization, timelock and proposal
///         lifecycle (E7).
///
/// The treasury deliberately executes arbitrary calldata against an allowlisted
/// target, so "arbitrary call exists" is not a finding on its own. What matters
/// is whether an unauthorized actor can cause execution, and whether an approval
/// can outlive the conditions under which it was given.
contract TreasuryTest is Test {
    MockERC20 internal mtaa;
    MultiSigTreasury internal treasury;
 
    address internal signer1 = address(0x51611);
    address internal signer2 = address(0x51612);
    address internal signer3 = address(0x51613);
    address internal signer4 = address(0x51614);
    address internal signer5 = address(0x51615);
    address internal replacement = address(0x51616);
 
    address internal outsider = address(0xBAD);
    address internal payee = address(0xBEEF);
 
    uint256 internal constant FUNDS = 1_000_000e18;
    uint256 internal constant PAYMENT = 50_000e18;
 
    function setUp() public {
        mtaa = new MockERC20("MTAA", "MTAA", 18);
        address[5] memory s = [signer1, signer2, signer3, signer4, signer5];
        treasury = new MultiSigTreasury(address(mtaa), s);
        mtaa.mint(address(treasury), FUNDS);
    }
 
    function _submitPayment(uint256 amount) internal returns (uint256 txnId) {
        txnId = treasury.transactionCount();
        vm.prank(signer1);
        treasury.submitTransaction(
            address(mtaa), amount, abi.encodeWithSignature("transfer(address,uint256)", payee, amount)
        );
    }
 
    function _confirm(uint256 txnId, address who) internal {
        vm.prank(who);
        treasury.confirmTransaction(txnId);
    }
 
    // ------------------------------------------------------------------
    // A. Authorization
    // ------------------------------------------------------------------
 
    /// @notice NEGATIVE RESULT: E7 holds against outsiders. A non-signer can
    ///         neither propose nor confirm, so they cannot manufacture the three
    ///         approvals execution requires.
    function test_OutsiderCannotProposeOrConfirm() public {
        vm.prank(outsider);
        vm.expectRevert(bytes("Only signer can call"));
        treasury.submitTransaction(address(mtaa), PAYMENT, "");
 
        uint256 txnId = _submitPayment(PAYMENT);
 
        vm.prank(outsider);
        vm.expectRevert(bytes("Only signer can call"));
        treasury.confirmTransaction(txnId);
    }
 
    /// @notice NEGATIVE RESULT: two of five is not enough, and the shortfall is
    ///         checked before the timelock, so waiting does not help.
    function test_TwoConfirmationsCannotExecute() public {
        uint256 txnId = _submitPayment(PAYMENT);
        _confirm(txnId, signer1);
        _confirm(txnId, signer2);
 
        skip(48 hours);
        vm.expectRevert(bytes("Need 3+ confirmations"));
        treasury.executeTransaction(txnId);
 
        assertEq(mtaa.balanceOf(payee), 0, "no funds moved");
    }
 
    /// @notice NEGATIVE RESULT: a signer cannot double-count their own approval.
    function test_SignerCannotConfirmTwice() public {
        uint256 txnId = _submitPayment(PAYMENT);
        _confirm(txnId, signer1);
 
        vm.prank(signer1);
        vm.expectRevert(bytes("Already confirmed by you"));
        treasury.confirmTransaction(txnId);
    }
 
    // ------------------------------------------------------------------
    // B. Timelock
    // ------------------------------------------------------------------
 
    /// @notice NEGATIVE RESULT: the 48-hour delay is enforced to the second.
    function test_TimelockIsEnforcedToTheSecond() public {
        uint256 txnId = _submitPayment(PAYMENT);
        _confirm(txnId, signer1);
        _confirm(txnId, signer2);
        _confirm(txnId, signer3);
 
        skip(48 hours - 1);
        vm.expectRevert(bytes("Timelock not expired (48 hours required)"));
        treasury.executeTransaction(txnId);
 
        skip(1);
        treasury.executeTransaction(txnId);
        assertEq(mtaa.balanceOf(payee), PAYMENT, "executes exactly at expiry");
    }
 
    /// @notice NEGATIVE RESULT: replay is blocked by the `executed` flag.
    function test_ExecutionCannotBeReplayed() public {
        uint256 txnId = _submitPayment(PAYMENT);
        _confirm(txnId, signer1);
        _confirm(txnId, signer2);
        _confirm(txnId, signer3);
        skip(48 hours);
 
        treasury.executeTransaction(txnId);
        vm.expectRevert(bytes("Already executed"));
        treasury.executeTransaction(txnId);
 
        assertEq(mtaa.balanceOf(payee), PAYMENT, "paid exactly once");
    }
 
    // ------------------------------------------------------------------
    // C. Permissionless execution
    // ------------------------------------------------------------------
 
    /// @notice Anyone may execute an already-approved, unlocked transaction. The
    ///         effect is fixed at submission time (target, calldata, recipient and
    ///         amount are all immutable), so this is a liveness property rather
    ///         than an authorization hole: the caller chooses only *when* within
    ///         the executable window, not *what*.
    function test_AnyoneMayExecuteAnApprovedTransaction() public {
        uint256 txnId = _submitPayment(PAYMENT);
        _confirm(txnId, signer1);
        _confirm(txnId, signer2);
        _confirm(txnId, signer3);
        skip(48 hours);
 
        vm.prank(outsider);
        treasury.executeTransaction(txnId);
 
        assertEq(mtaa.balanceOf(payee), PAYMENT, "funds reach the approved payee, not the caller");
        assertEq(mtaa.balanceOf(outsider), 0, "executor gains nothing");
    }
 
    // ------------------------------------------------------------------
    // D. Stale proposals and signer rotation
    // ------------------------------------------------------------------
 
    /// @notice CONFIRMED DESIGN RISK: an approved transaction never expires. A
    ///         payment authorised under one set of conditions stays executable
    ///         indefinitely, and its calldata is frozen — so an amount that made
    ///         sense at approval time is still paid a year later.
    function test_ApprovedTransactionNeverExpires() public {
        uint256 txnId = _submitPayment(PAYMENT);
        _confirm(txnId, signer1);
        _confirm(txnId, signer2);
        _confirm(txnId, signer3);
 
        skip(365 days);
 
        vm.prank(outsider);
        treasury.executeTransaction(txnId);
        assertEq(mtaa.balanceOf(payee), PAYMENT, "a year-old approval still pays out");
    }
 
    /// @notice The mitigation exists and works: any confirming signer can revoke
    ///         before execution, dropping the count below the threshold.
    function test_RevocationBeforeExecutionBlocksAStaleTransaction() public {
        uint256 txnId = _submitPayment(PAYMENT);
        _confirm(txnId, signer1);
        _confirm(txnId, signer2);
        _confirm(txnId, signer3);
        skip(48 hours);
 
        vm.prank(signer2);
        treasury.revokeConfirmation(txnId);
 
        vm.expectRevert(bytes("Need 3+ confirmations"));
        treasury.executeTransaction(txnId);
    }
 
    /// @notice CONFIRMED DESIGN RISK: signer rotation does not purge outstanding
    ///         approvals. A key that is rotated out — the standard response to a
    ///         suspected compromise — keeps its confirmation on every pending
    ///         transaction, and can no longer revoke it because `revokeConfirmation`
    ///         is `onlySigner`. The removed key's approval is therefore permanent.
    function test_RotatedOutSignerKeepsItsPendingApprovals() public {
        uint256 txnId = _submitPayment(PAYMENT);
        _confirm(txnId, signer1);
        _confirm(txnId, signer2);
        _confirm(txnId, signer3);
 
        // Rotate signer3 out through the multisig itself.
        uint256 rotationId = treasury.transactionCount();
        vm.prank(signer1);
        treasury.submitTransaction(
            address(treasury),
            0,
            abi.encodeWithSignature("replaceSigner(address,address)", signer3, replacement)
        );
        _confirm(rotationId, signer1);
        _confirm(rotationId, signer2);
        _confirm(rotationId, signer4);
        skip(48 hours);
        treasury.executeTransaction(rotationId);
 
        address[5] memory current = treasury.getSigners();
        assertEq(current[2], replacement, "signer3 has been rotated out");
 
        // Its approval still counts.
        assertTrue(treasury.hasConfirmed(txnId, signer3), "stale approval survives rotation");
 
        // And it can no longer be withdrawn by anyone.
        vm.prank(signer3);
        vm.expectRevert(bytes("Only signer can call"));
        treasury.revokeConfirmation(txnId);
 
        vm.prank(replacement);
        vm.expectRevert(bytes("Not confirmed by you"));
        treasury.revokeConfirmation(txnId);
 
        // The pending payment executes on the strength of the removed key.
        vm.prank(outsider);
        treasury.executeTransaction(txnId);
        assertEq(mtaa.balanceOf(payee), PAYMENT, "executed with a rotated-out signer's approval");
    }
 
    /// @notice The remaining signers are not powerless — they can revoke their own
    ///         approvals to bring the count back below three. Recorded so the risk
    ///         above is scored as a design weakness, not an unstoppable path.
    function test_RemainingSignersCanStillNeutraliseAStaleApproval() public {
        uint256 txnId = _submitPayment(PAYMENT);
        _confirm(txnId, signer1);
        _confirm(txnId, signer2);
        _confirm(txnId, signer3);
 
        vm.prank(signer1);
        treasury.revokeConfirmation(txnId);
        skip(48 hours);
 
        vm.expectRevert(bytes("Need 3+ confirmations"));
        treasury.executeTransaction(txnId);
    }
 
    // ------------------------------------------------------------------
    // Target allowlist and the unused `value` field
    // ------------------------------------------------------------------
 
    /// @notice NEGATIVE RESULT: the target allowlist blocks execution against any
    ///         contract other than MTAA or the treasury itself, and the check runs
    ///         even after three approvals and a full timelock.
    function test_NonAllowlistedTargetCannotExecute() public {
        MockERC20 other = new MockERC20("Other", "OTH", 18);
        other.mint(address(treasury), FUNDS);
 
        uint256 txnId = treasury.transactionCount();
        vm.prank(signer1);
        treasury.submitTransaction(
            address(other), PAYMENT, abi.encodeWithSignature("transfer(address,uint256)", payee, PAYMENT)
        );
        _confirm(txnId, signer1);
        _confirm(txnId, signer2);
        _confirm(txnId, signer3);
        skip(48 hours);
 
        vm.expectRevert(bytes("Target not allowed"));
        treasury.executeTransaction(txnId);
    }

    /// @notice POSITIVE RESULT: a new protocol target can only be authorized by
    ///         the same 3-of-5, 48-hour self-governance path.
    function test_TargetAllowlistCanOnlyChangeThroughMultisig() public {
        address beacon = address(0xBEE7);

        vm.expectRevert(bytes("Must go through multisig"));
        treasury.setAllowedTarget(beacon, true);

        uint256 txnId = treasury.transactionCount();
        vm.prank(signer1);
        treasury.submitTransaction(
            address(treasury),
            0,
            abi.encodeWithSignature("setAllowedTarget(address,bool)", beacon, true)
        );
        _confirm(txnId, signer1);
        _confirm(txnId, signer2);
        _confirm(txnId, signer3);

        skip(48 hours);
        treasury.executeTransaction(txnId);

        assertTrue(treasury.allowedTargets(beacon), "target enabled by multisig");
    }

    /// @notice POSITIVE RESULT: signer rotation is approved in advance and
    ///         becomes permissionlessly executable on the annual due date.
    function test_SignerRotationIsScheduledAndAutomated() public {
        uint256 effectiveAt = treasury.nextRotationDue();
        uint256 txnId = treasury.transactionCount();
        vm.prank(signer1);
        treasury.submitTransaction(
            address(treasury),
            0,
            abi.encodeWithSignature(
                "scheduleSignerRotation(address,address,uint256)", signer1, replacement, effectiveAt
            )
        );
        _confirm(txnId, signer1);
        _confirm(txnId, signer2);
        _confirm(txnId, signer3);

        skip(48 hours);
        treasury.executeTransaction(txnId);

        vm.expectRevert(bytes("Rotation not due"));
        treasury.executeScheduledSignerRotation(signer1);

        vm.warp(effectiveAt);
        treasury.executeScheduledSignerRotation(signer1);

        assertEq(treasury.signers(0), replacement, "scheduled signer replaced");
        assertEq(treasury.nextRotationDue(), effectiveAt + treasury.ROTATION_INTERVAL(), "next rotation advanced");
    }
 
    /// @notice INFORMATIONAL: `Transaction.value` is recorded, emitted and shown by
    ///         `getTransactionStatus`, but `executeTransaction` calls the target
    ///         with no value at all. The field is decorative — a proposal that
    ///         reads as "send 50,000" on-chain moves whatever the calldata says,
    ///         which need not agree.
    function test_ValueFieldIsRecordedButNeverUsed() public {
        uint256 txnId = treasury.transactionCount();
        vm.prank(signer1);
        treasury.submitTransaction(
            address(mtaa),
            PAYMENT, // the headline "amount"
            abi.encodeWithSignature("transfer(address,uint256)", payee, PAYMENT * 2) // what actually moves
        );
        _confirm(txnId, signer1);
        _confirm(txnId, signer2);
        _confirm(txnId, signer3);
        skip(48 hours);
        treasury.executeTransaction(txnId);
 
        (, uint256 declaredValue,,,) = treasury.getTransactionStatus(txnId);
        assertEq(declaredValue, PAYMENT, "record says 50,000");
        assertEq(mtaa.balanceOf(payee), PAYMENT * 2, "calldata moved 100,000");
    }
 
    /// @notice NEGATIVE RESULT: a call that reverts inside the target does not
    ///         leave the transaction half-applied — the whole execution reverts,
    ///         though the `executed` flag was already set, so the attempt is
    ///         rolled back and can be retried.
    function test_FailingInnerCallRevertsTheWholeExecution() public {
        uint256 txnId = _submitPayment(FUNDS * 2); // more than the treasury holds
        _confirm(txnId, signer1);
        _confirm(txnId, signer2);
        _confirm(txnId, signer3);
        skip(48 hours);
 
        vm.expectRevert();
        treasury.executeTransaction(txnId);
 
        (,,, bool executed,) = treasury.getTransactionStatus(txnId);
        assertFalse(executed, "flag rolled back with the rest of the state");
        assertEq(mtaa.balanceOf(payee), 0, "nothing moved");
    }
 
    /// @notice Fuzzed E7: no combination of fewer than three confirmations and any
    ///         elapsed time lets an outsider move treasury funds.
    function testFuzz_SubThresholdApprovalsNeverExecute(uint8 confirmCount, uint256 wait) public {
        confirmCount = uint8(bound(confirmCount, 0, 2));
        wait = bound(wait, 0, 3_650 days);
 
        uint256 txnId = _submitPayment(PAYMENT);
        address[3] memory available = [signer1, signer2, signer3];
        for (uint256 i = 0; i < confirmCount; ++i) {
            _confirm(txnId, available[i]);
        }
 
        skip(wait);
        vm.prank(outsider);
        vm.expectRevert();
        treasury.executeTransaction(txnId);
 
        assertEq(mtaa.balanceOf(payee), 0, "treasury untouched");
    }
}