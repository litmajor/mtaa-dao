// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;
 
import "forge-std/Test.sol";
 
import "../../../contracts/MtaaToken.sol";
import "../../../contracts/MtaaStakingVestingManager.sol";
 
/// @notice Phase 3B — staking reward conservation (E4).
///
/// Accrual is `amount × apy × elapsed / 365 days`, measured from
/// `lastRewardClaim`, then multiplied by the staker's reputation tier **read at
/// claim time**. Rewards are freshly minted by `MtaaToken`, so any over-payment
/// is dilution borne by every holder rather than a transfer from a reward pool.
///
/// Invariant: a staker cannot claim more than the accrual their stake earned
/// under the tier that was in force while it was earning.
contract StakingRewardsTest is Test {
    MTAAToken internal token;
    MtaaStakingVestingManager internal manager;
 
    address internal owner = address(0xA11CE);
    address internal treasury = address(0x7BEA5);
    address internal staker = address(0x57A4E);
    address internal other = address(0x07E4);
 
    uint256 internal constant STAKE = 100_000e18;
    uint256 internal constant LOCK_DAYS = 30;
    /// @dev `lockPeriodMultipliers[30] = 800` → 8% APY when no APY calculator is set.
    uint256 internal constant APY_BPS = 800;
 
    function setUp() public {
        vm.startPrank(owner);
        token = new MTAAToken(owner, treasury, address(0), address(0));
        manager = new MtaaStakingVestingManager(address(token));
        manager.setTokenContract(address(token));
        token.setStakingManager(address(manager));
        token.transfer(staker, 1_000_000e18);
        token.transfer(other, 1_000_000e18);
        vm.stopPrank();
    }
 
    function _stake(address who, uint256 amount) internal returns (uint256) {
        vm.prank(who);
        return token.stake(amount, LOCK_DAYS);
    }
 
    function _setTier(address who, uint256 score) internal {
        vm.prank(owner);
        token.updateReputation(who, score);
    }
 
    /// @dev The accrual the protocol's own formula produces before any tier bonus.
    function _baseAccrual(uint256 amount, uint256 elapsed) internal pure returns (uint256) {
        return ((amount * APY_BPS) / 10_000) * elapsed / 365 days;
    }
 
    // ------------------------------------------------------------------
    // Scenario A — tier upgrade after accrual
    // ------------------------------------------------------------------
 
    /// @notice A staker who sits at MEMBER for the whole accrual period and is
    ///         promoted to SHOGUN immediately before claiming is paid 3× on the
    ///         entire history, including the part earned at 1×.
    function test_ScenarioA_TierUpgradeRetroactivelyMultipliesPastAccrual() public {
        uint256 stakeId = _stake(staker, STAKE);
 
        skip(30 days);
 
        uint256 earnedAtMemberTier = token.calculateStakeRewards(staker, stakeId);
        assertEq(earnedAtMemberTier, _baseAccrual(STAKE, 30 days), "unmultiplied accrual");
 
        // SHOGUN threshold is a reputation score of 100,000, granted by ORACLE_ROLE.
        _setTier(staker, 100_000);
 
        uint256 balanceBefore = token.balanceOf(staker);
        vm.prank(staker);
        token.claimStakeRewards(stakeId);
        uint256 paid = token.balanceOf(staker) - balanceBefore;
 
        emit log_named_decimal_uint("accrued at MEMBER tier", earnedAtMemberTier, 18);
        emit log_named_decimal_uint("actually minted       ", paid, 18);
 
        assertEq(paid, (earnedAtMemberTier * 300) / 100, "entire history paid at the new 3x multiplier");
        assertEq(paid - earnedAtMemberTier, earnedAtMemberTier * 2, "200% of the accrual is unearned");
    }
 
    /// @notice The same promotion applied *before* the accrual period pays the
    ///         same amount, which is what makes the retroactive case an
    ///         over-payment rather than a timing artefact: waiting to claim is
    ///         strictly better than claiming as you go.
    function test_ScenarioA_DelayingTheClaimStrictlyDominatesClaimingEarly() public {
        uint256 idA = _stake(staker, STAKE);
        uint256 idB = _stake(other, STAKE);
 
        skip(30 days);
 
        // `staker` claims while still MEMBER, then is promoted.
        vm.prank(staker);
        token.claimStakeRewards(idA);
        _setTier(staker, 100_000);
 
        // `other` is promoted first and claims the identical accrual afterwards.
        _setTier(other, 100_000);
        uint256 beforeOther = token.balanceOf(other);
        vm.prank(other);
        token.claimStakeRewards(idB);
        uint256 paidOther = token.balanceOf(other) - beforeOther;
 
        // Both then accrue nothing further and unstake at the same moment.
        assertGt(paidOther, _baseAccrual(STAKE, 30 days), "delayed claimer is paid the 3x");
        emit log_named_decimal_uint("claim-then-promote", _baseAccrual(STAKE, 30 days), 18);
        emit log_named_decimal_uint("promote-then-claim", paidOther, 18);
    }
 
    // ------------------------------------------------------------------
    // Scenario B — tier downgrade
    // ------------------------------------------------------------------
 
    /// @notice The mechanism is symmetric: a demotion retroactively erases the
    ///         bonus on rewards that were genuinely earned at the higher tier.
    ///         Same root cause, opposite sign, harms the user rather than the
    ///         protocol.
    function test_ScenarioB_TierDowngradeRetroactivelyRemovesEarnedBonus() public {
        _setTier(staker, 100_000);
        uint256 stakeId = _stake(staker, STAKE);
 
        skip(30 days);
        uint256 earnedAtShogun = token.calculateStakeRewards(staker, stakeId);
        assertEq(earnedAtShogun, (_baseAccrual(STAKE, 30 days) * 300) / 100, "accrued at 3x");
 
        _setTier(staker, 0);
 
        uint256 balanceBefore = token.balanceOf(staker);
        vm.prank(staker);
        token.claimStakeRewards(stakeId);
        uint256 paid = token.balanceOf(staker) - balanceBefore;
 
        assertEq(paid, _baseAccrual(STAKE, 30 days), "bonus earned at SHOGUN is lost entirely");
        assertLt(paid, earnedAtShogun, "demotion is retroactive too");
    }
 
    // ------------------------------------------------------------------
    // Scenario C — claim and lock boundaries (negative results)
    // ------------------------------------------------------------------
 
    /// @notice NEGATIVE RESULT: flash-staking is structurally impossible. The
    ///         shortest configured lock is 30 days and `unstakeFor` enforces it,
    ///         so borrow → stake → claim → unstake → repay cannot complete.
    function test_ScenarioC_FlashStakeIsImpossible() public {
        uint256 stakeId = _stake(staker, STAKE);
 
        vm.prank(staker);
        vm.expectRevert(bytes("Stake locked"));
        token.unstake(stakeId);
 
        // Not even one second early.
        skip(30 days - 1);
        vm.prank(staker);
        vm.expectRevert(bytes("Stake locked"));
        token.unstake(stakeId);
 
        skip(1);
        vm.prank(staker);
        token.unstake(stakeId);
        assertEq(token.balanceOf(address(manager)), 0, "principal returned exactly at expiry");
    }
 
    /// @notice NEGATIVE RESULT: a second claim in the same block accrues nothing
    ///         and reverts, so claims cannot be duplicated.
    function test_ScenarioC_DuplicateClaimInSameBlockReverts() public {
        uint256 stakeId = _stake(staker, STAKE);
        skip(30 days);
 
        vm.prank(staker);
        token.claimStakeRewards(stakeId);
 
        vm.prank(staker);
        vm.expectRevert(bytes("No rewards"));
        token.claimStakeRewards(stakeId);
    }
 
    /// @notice NEGATIVE RESULT: unstaking after a claim pays only the accrual
    ///         since that claim — the claimed period is not paid twice.
    function test_ScenarioC_ClaimThenUnstakeDoesNotDoublePay() public {
        uint256 stakeId = _stake(staker, STAKE);
 
        skip(20 days);
        uint256 balanceBefore = token.balanceOf(staker);
        vm.prank(staker);
        token.claimStakeRewards(stakeId);
        uint256 firstClaim = token.balanceOf(staker) - balanceBefore;
 
        skip(10 days);
        uint256 midBalance = token.balanceOf(staker);
        vm.prank(staker);
        token.unstake(stakeId);
        uint256 secondPayout = token.balanceOf(staker) - midBalance - STAKE;
 
        assertApproxEqAbs(
            firstClaim + secondPayout,
            _baseAccrual(STAKE, 30 days),
            1e12,
            "split payouts sum to the single-period accrual"
        );
    }
 
    /// @notice NEGATIVE RESULT: repeated dust claims lose value to flooring
    ///         rather than accumulating it, so claim-spamming is not farmable.
    function test_ScenarioC_DustClaimsCannotAccumulateProfit() public {
        uint256 stakeId = _stake(staker, STAKE);
 
        uint256 balanceBefore = token.balanceOf(staker);
        for (uint256 i = 0; i < 30; ++i) {
            skip(1 days);
            vm.prank(staker);
            token.claimStakeRewards(stakeId);
        }
        uint256 split = token.balanceOf(staker) - balanceBefore;
 
        assertLe(split, _baseAccrual(STAKE, 30 days), "splitting never pays more than claiming once");
    }
 
    /// @notice NEGATIVE RESULT: only the token contract may drive the manager.
    function test_ScenarioC_ManagerRejectsDirectCalls() public {
        uint256 stakeId = _stake(staker, STAKE);
        skip(30 days);
 
        vm.prank(staker);
        vm.expectRevert(bytes("Unauthorized"));
        manager.claimStakeRewardsFor(staker, stakeId);
 
        vm.prank(staker);
        vm.expectRevert(bytes("Unauthorized"));
        manager.unstakeFor(staker, stakeId);
 
        vm.prank(staker);
        vm.expectRevert(bytes("Unauthorized"));
        manager.stakeFor(staker, STAKE, LOCK_DAYS);
    }
 
    /// @notice NEGATIVE RESULT: a staker cannot claim against another staker's
    ///         stake id — ids are namespaced per address, so the lookup finds
    ///         nothing rather than someone else's position.
    function test_ScenarioC_CannotClaimAnotherStakersPosition() public {
        uint256 victimStake = _stake(other, STAKE);
        skip(30 days);
 
        vm.prank(staker);
        vm.expectRevert(bytes("Stake not found"));
        token.claimStakeRewards(victimStake);
    }
 
    // ------------------------------------------------------------------
    // Scenario D — fuzz
    // ------------------------------------------------------------------
 
    /// @notice E4 with a constant tier: however the staker splits their claims,
    ///         total payout never exceeds the accrual for the elapsed time.
    function testFuzz_ClaimSplittingNeverIncreasesTotalRewards(
        uint256 amount,
        uint256 firstLeg,
        uint256 secondLeg
    ) public {
        amount = bound(amount, 1_000e18, 500_000e18);
        firstLeg = bound(firstLeg, 1 days, 60 days);
        secondLeg = bound(secondLeg, 1 days, 60 days);
 
        vm.prank(owner);
        token.transfer(staker, amount);
        uint256 stakeId = _stake(staker, amount);
 
        uint256 balanceBefore = token.balanceOf(staker);
 
        skip(firstLeg);
        vm.prank(staker);
        token.claimStakeRewards(stakeId);
 
        skip(secondLeg);
        vm.prank(staker);
        token.claimStakeRewards(stakeId);
 
        uint256 paid = token.balanceOf(staker) - balanceBefore;
        assertLe(paid, _baseAccrual(amount, firstLeg + secondLeg), "no reward inflation from splitting");
    }
 
    /// @notice E4 violated by tier timing: the payout for an unchanged stake and
    ///         unchanged elapsed time depends purely on *when* the tier changed
    ///         relative to the claim. Fuzzed over stake size, duration and the
    ///         fraction of the period spent at the lower tier.
    function testFuzz_RetroactiveMultiplierOverpaysAcrossTheRange(
        uint256 amount,
        uint256 elapsed,
        uint256 lowTierBps
    ) public {
        amount = bound(amount, 1_000e18, 500_000e18);
        elapsed = bound(elapsed, 2 days, 120 days);
        lowTierBps = bound(lowTierBps, 1, 9_999);
 
        vm.prank(owner);
        token.transfer(staker, amount);
        uint256 stakeId = _stake(staker, amount);
 
        uint256 lowPeriod = (elapsed * lowTierBps) / 10_000;
        skip(lowPeriod);
        _setTier(staker, 100_000); // promote to SHOGUN part-way through
        skip(elapsed - lowPeriod);
 
        uint256 balanceBefore = token.balanceOf(staker);
        vm.prank(staker);
        token.claimStakeRewards(stakeId);
        uint256 paid = token.balanceOf(staker) - balanceBefore;
 
        // Time-weighted entitlement: 1x while MEMBER, 3x after promotion.
        uint256 entitled =
            _baseAccrual(amount, lowPeriod) + (_baseAccrual(amount, elapsed - lowPeriod) * 300) / 100;
 
        assertGe(paid, entitled, "payout is never below the time-weighted entitlement");
        // And it is strictly above it whenever any time was spent at the lower tier.
        if (lowPeriod > 1 days) {
            assertGt(paid, entitled, "the low-tier portion is paid at the high-tier rate");
        }
    }
}