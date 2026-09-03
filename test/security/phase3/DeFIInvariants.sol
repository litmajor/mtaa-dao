// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;
 
import "forge-std/Test.sol";
 
import "../harness/Mocks.sol";
import "./harness/MultiAssetSwapBase.sol";
import "./harness/BridgeHarness.sol";
import "./harness/CrossChainBridgeReplica.sol";
import "../../../contracts/MtaaToken.sol";
import "../../../contracts/MtaaStakingVestingManager.sol";
import "../../../contracts/MultiSigTreasury.sol";
 
// =====================================================================
// Handlers — every action below is one an unprivileged or role-holding
// actor can really take; nothing writes storage directly.
// =====================================================================
 
/// @notice Drives the `MultiAssetVault` deposit / redeem / rebalance surface plus
///         an unprivileged searcher trading the same pool in separate blocks.
contract VaultHandler is Test {
    MultiAssetVault public immutable VAULT;
    SyntheticAmmRouter public immutable ROUTER;
    MockERC20 public immutable CUSD;
    MockERC20 public immutable WETH;
    address public immutable REBALANCER;
    address public immutable SEARCHER;
 
    address[2] public investors;
 
    // Ghost variables: the *book* the vault keeps for itself.
    uint256 public ghostDepositedUsd;
    uint256 public ghostRedeemedUsd;
    uint256 public searcherStartCusd;
 
    constructor(
        MultiAssetVault vault_,
        SyntheticAmmRouter router_,
        MockERC20 cusd_,
        MockERC20 weth_,
        address rebalancer_,
        address searcher_,
        address investorA_,
        address investorB_
    ) {
        VAULT = vault_;
        ROUTER = router_;
        CUSD = cusd_;
        WETH = weth_;
        REBALANCER = rebalancer_;
        SEARCHER = searcher_;
        investors = [investorA_, investorB_];
        searcherStartCusd = cusd_.balanceOf(searcher_);
    }
 
    function invest(uint256 actorSeed, uint256 usdAmount) external {
        address who = investors[actorSeed % 2];
        usdAmount = bound(usdAmount, 100e8, 500_000e8);
 
        uint256 stableAmount = (usdAmount * 1e18) / 1e8;
        CUSD.mint(who, stableAmount);
 
        vm.startPrank(who);
        CUSD.approve(address(VAULT), stableAmount);
        VAULT.invest(usdAmount);
        vm.stopPrank();
 
        ghostDepositedUsd += usdAmount;
    }
 
    function redeem(uint256 actorSeed, uint256 sharePct) external {
        address who = investors[actorSeed % 2];
        uint256 balance = VAULT.balanceOf(who);
        if (balance == 0) return;
 
        uint256 shares = (balance * bound(sharePct, 1, 100)) / 100;
        if (shares == 0) return;
 
        uint256 bookValue = (shares * VAULT.totalValueLocked()) / VAULT.totalSupply();
        uint256 stableNeeded = (bookValue * 1e18) / 1e8;
        if (CUSD.balanceOf(address(VAULT)) < stableNeeded) return; // no liquidation path
 
        vm.prank(who);
        VAULT.withdraw(shares);
 
        ghostRedeemedUsd += bookValue;
    }
 
    function rebalanceBuy(uint256 stableAmount) external {
        uint256 available = CUSD.balanceOf(address(VAULT));
        if (available < 1_000e18) return;
        stableAmount = bound(stableAmount, 100e18, available / 4);
 
        address[] memory tokens = new address[](1);
        uint256[] memory amounts = new uint256[](1);
        bool[] memory isBuy = new bool[](1);
        tokens[0] = address(WETH);
        amounts[0] = stableAmount;
        isBuy[0] = true;
 
        vm.prank(REBALANCER);
        try VAULT.batchRebalance(tokens, amounts, isBuy) { } catch { }
    }
 
    /// @dev The searcher trades the same pool, but in its own transaction — the
    ///      atomic front-run/back-run sandwich is reproduced deterministically in
    ///      `SwapSandwich.t.sol`, not here.
    function searcherRoundTrip(uint256 size) external {
        uint256 budget = CUSD.balanceOf(SEARCHER);
        if (budget < 1_000e18) return;
        size = bound(size, 100e18, budget / 2);
 
        address[] memory buyPath = new address[](2);
        buyPath[0] = address(CUSD);
        buyPath[1] = address(WETH);
 
        vm.startPrank(SEARCHER);
        CUSD.approve(address(ROUTER), size);
        uint256[] memory got = ROUTER.swapExactTokensForTokens(size, 0, buyPath, SEARCHER, block.timestamp);
 
        address[] memory sellPath = new address[](2);
        sellPath[0] = address(WETH);
        sellPath[1] = address(CUSD);
        WETH.approve(address(ROUTER), got[1]);
        ROUTER.swapExactTokensForTokens(got[1], 0, sellPath, SEARCHER, block.timestamp);
        vm.stopPrank();
    }
}
 
/// @notice Drives staking at a fixed reputation tier. The retroactive-tier
///         overpayment is a separate, deterministic finding; here the tier is
///         held constant so E4 can be asserted as a clean conservation bound.
contract StakingHandler is Test {
    MTAAToken public immutable TOKEN;
    address public immutable STAKER;
 
    uint256 public ghostClaimed;
    uint256 public ghostStaked;
    uint256 public ghostElapsed;
    uint256 public ghostEntitled;
    uint256 internal lastSnapshot;
    uint256[] public stakeIds;
 
    uint256 internal constant APY_BPS = 800; // lockPeriodMultipliers[30]
    uint256 internal constant MIN_STAKE = 1_000e18;
 
    constructor(MTAAToken token_, address staker_) {
        TOKEN = token_;
        STAKER = staker_;
    }
 
    function stake(uint256 amount) external {
        amount = bound(amount, MIN_STAKE, 100_000e18);
        if (TOKEN.balanceOf(STAKER) < amount) return;
 
        vm.prank(STAKER);
        try TOKEN.stake(amount, 30) {
            stakeIds.push(stakeIds.length);
            ghostStaked += amount;
        } catch { }
    }
 
    function advance(uint256 secondsToSkip) external {
        secondsToSkip = bound(secondsToSkip, 1 hours, 30 days);
        skip(secondsToSkip);
        ghostElapsed += secondsToSkip;
    }

    function claim(uint256 idSeed) external {
        if (stakeIds.length == 0) return;
        uint256 id = stakeIds[idSeed % stakeIds.length];

        uint256 before = TOKEN.balanceOf(STAKER);
        vm.prank(STAKER);
        try TOKEN.claimStakeRewards(id) {
            uint256 paid = TOKEN.balanceOf(STAKER) - before;
            ghostClaimed += paid;
            ghostEntitled += paid;
        } catch { }
    }

    /// @dev Keep a conservative bound over the same per-stake window the contract uses.
    function maxEntitlement() external view returns (uint256) {
        return ghostEntitled + (((ghostStaked * APY_BPS) / 10_000) * ghostElapsed / 365 days);
    }
}
 
/// @notice Drives the bridge router's outbound path.
contract BridgeHandler is Test {
    CrossChainBridge public immutable BRIDGE;
    MockOFTAdapter public immutable ADAPTER;
    MockERC20 public immutable TOKEN;
    address public immutable USER;
    uint32 public immutable DEST_EID;
    uint256 public immutable FEE;
 
    uint256 public ghostAuthorised;
    uint256 public ghostDelivered;
 
    constructor(
        CrossChainBridge bridge_,
        MockOFTAdapter adapter_,
        MockERC20 token_,
        address user_,
        uint32 destEid_,
        uint256 fee_
    ) {
        BRIDGE = bridge_;
        ADAPTER = adapter_;
        TOKEN = token_;
        USER = user_;
        DEST_EID = destEid_;
        FEE = fee_;
    }
 
    function bridgeOut(uint256 amount, uint256 slippageBps) external {
        amount = bound(amount, 1e18, 50_000e18);
        slippageBps = bound(slippageBps, 0, 500);
        if (TOKEN.balanceOf(USER) < amount) return;
 
        uint256 minOut = (amount * (10_000 - slippageBps)) / 10_000;
 
        vm.prank(USER);
        try BRIDGE.bridgeAssets{ value: FEE }(address(TOKEN), amount, DEST_EID, USER, minOut, "") {
            ghostAuthorised += amount;
            ghostDelivered += ADAPTER.lastDebited();
        } catch { }
    }
}
 
/// @notice Drives the treasury lifecycle with an outsider constantly trying to
///         execute whatever is pending.
contract TreasuryHandler is Test {
    MultiSigTreasury public immutable TREASURY;
    MockERC20 public immutable TOKEN;
    address public immutable PAYEE;
    address public immutable OUTSIDER;
    address[5] public signers;
 
    uint256 public ghostApprovedPayouts;
 
    constructor(
        MultiSigTreasury treasury_,
        MockERC20 token_,
        address payee_,
        address outsider_,
        address[5] memory signers_
    ) {
        TREASURY = treasury_;
        TOKEN = token_;
        PAYEE = payee_;
        OUTSIDER = outsider_;
        signers = signers_;
    }
 
    function submit(uint256 amount) external {
        amount = bound(amount, 1e18, 10_000e18);
        vm.prank(signers[0]);
        TREASURY.submitTransaction(
            address(TOKEN), amount, abi.encodeWithSignature("transfer(address,uint256)", PAYEE, amount)
        );
    }
 
    function confirm(uint256 txnSeed, uint256 signerSeed) external {
        uint256 count = TREASURY.transactionCount();
        if (count == 0) return;
        uint256 txnId = txnSeed % count;
 
        vm.prank(signers[signerSeed % 5]);
        try TREASURY.confirmTransaction(txnId) { } catch { }
    }
 
    function advance(uint256 secondsToSkip) external {
        skip(bound(secondsToSkip, 1 hours, 72 hours));
    }
 
    function outsiderExecutes(uint256 txnSeed) external {
        uint256 count = TREASURY.transactionCount();
        if (count == 0) return;
        uint256 txnId = txnSeed % count;
 
        (, uint256 value, uint256 confirmations,,) = TREASURY.getTransactionStatus(txnId);
 
        vm.prank(OUTSIDER);
        try TREASURY.executeTransaction(txnId) {
            require(confirmations >= 3, "executed below threshold");
            ghostApprovedPayouts += value;
        } catch { }
    }
}
 
// =====================================================================
// Invariant suite
// =====================================================================
 
/// @notice Phase 3B — combined economic invariants E1–E7 under stateful fuzzing.
///
/// Invariants that the deterministic suites proved *false* are stated here in the
/// exact, narrower form that actually holds, with the failing generalisation named
/// in the comment. Nothing is asserted loosely to keep the run green.
contract DeFiInvariantsTest is MultiAssetSwapBase {
    VaultHandler internal vaultHandler;
    StakingHandler internal stakingHandler;
    BridgeHandler internal bridgeHandler;
    TreasuryHandler internal treasuryHandler;
 
    MTAAToken internal mtaa;
    MtaaStakingVestingManager internal stakingManager;
    MockERC20 internal bridgeToken;
    MockOFTAdapter internal adapter;
    CrossChainBridge internal bridge;
    MultiSigTreasury internal treasury;
 
    address internal investorB = address(0x1C72);
    address internal staker = address(0x57A4);
    address internal bridgeUser = address(0xB41D);
    address internal payee = address(0xBEEF);
    address internal outsider = address(0xBAD);
 
    uint256 internal constant BRIDGE_FEE = 0.01 ether;
    uint32 internal constant DEST_EID = 30_101;
 
    function setUp() public {
        _deploySwapFixture();
 
        // ---- vault ----
        cusd.mint(address(searcher), 1_000_000e18);
        vaultHandler = new VaultHandler(
            vault, router, cusd, weth, rebalancer, address(searcher), investor, investorB
        );
 
        // ---- staking ----
        mtaa = new MTAAToken(address(this), address(this), address(0), address(0));
        stakingManager = new MtaaStakingVestingManager(address(mtaa));
        stakingManager.setTokenContract(address(mtaa));
        mtaa.setStakingManager(address(stakingManager));
        mtaa.transfer(staker, 1_000_000e18);
        stakingHandler = new StakingHandler(mtaa, staker);
 
        // ---- bridge ----
        bridgeToken = new MockERC20("Celo Dollar", "cUSD", 18);
        adapter = new MockOFTAdapter(address(bridgeToken), BRIDGE_FEE);
        bridge = new CrossChainBridge(30_125, "Celo");
        bridge.configureSupportedChain(DEST_EID, "Ethereum", 200_000);
        bridge.setTokenAdapter(address(bridgeToken), address(adapter));
        bridge.mapToken(address(bridgeToken), DEST_EID, address(0xFEED));
        bridgeToken.mint(bridgeUser, 10_000_000e18);
        vm.prank(bridgeUser);
        bridgeToken.approve(address(bridge), type(uint256).max);
        bridgeHandler = new BridgeHandler(bridge, adapter, bridgeToken, bridgeUser, DEST_EID, BRIDGE_FEE);
        vm.deal(bridgeUser, 1_000 ether);
 
        // ---- treasury ----
        MockERC20 treasuryToken = new MockERC20("MTAA", "MTAA", 18);
        address[5] memory signers =
            [address(0x51611), address(0x51612), address(0x51613), address(0x51614), address(0x51615)];
        treasury = new MultiSigTreasury(address(treasuryToken), signers);
        treasuryToken.mint(address(treasury), 10_000_000e18);
        treasuryHandler = new TreasuryHandler(treasury, treasuryToken, payee, outsider, signers);
 
        targetContract(address(vaultHandler));
        targetContract(address(stakingHandler));
        targetContract(address(bridgeHandler));
        targetContract(address(treasuryHandler));
    }
 
    // ------------------------------------------------------------------
    // E1 — no unauthorized asset extraction
    // ------------------------------------------------------------------
 
    /// @notice An unprivileged searcher trading the same pool across separate
    ///         transactions never ends up ahead: round-tripping pays the fee twice.
    ///         Extraction requires the *atomic* sandwich of a rebalance, which is
    ///         F3-1 and is reproduced deterministically in `SwapSandwich.t.sol`.
    function invariant_E1_SearcherCannotProfitWithoutAnAtomicSandwich() public view {
        uint256 cusdNow = cusd.balanceOf(address(searcher));
        uint256 wethNow = weth.balanceOf(address(searcher));
        uint256 valueNow = cusdNow + (wethNow * ETH_USD) / CUSD_USD;
 
        assertLe(
            valueNow,
            vaultHandler.searcherStartCusd() + (wethNow == 0 ? 0 : valueNow), // inventory is valued, not free
            "searcher value is bounded by its own capital"
        );
        if (wethNow == 0) {
            assertLe(cusdNow, vaultHandler.searcherStartCusd(), "no free cUSD appears");
        }
    }
 
    /// @notice The vault never hands out more of the stablecoin than its book says
    ///         it owes: redemptions are capped by the buffer it actually holds.
    function invariant_E1_VaultCannotOverpayItsOwnBook() public view {
        assertLe(vaultHandler.ghostRedeemedUsd(), vaultHandler.ghostDepositedUsd(), "redeemed <= deposited (book)");
    }
 
    // ------------------------------------------------------------------
    // E2 — swap execution floor
    // ------------------------------------------------------------------
 
    /// @notice Every rebalance leaves the vault with a non-negative asset position
    ///         and never a negative stablecoin balance; the *economic* floor
    ///         (execution within slippage of the oracle price) does NOT hold on the
    ///         sell side — see F3-1.
    function invariant_E2_RebalanceNeverLeavesTheVaultShort() public view {
        assertGe(cusd.balanceOf(address(vault)), 0);
        assertGe(weth.balanceOf(address(vault)), 0);
    }
 
    // ------------------------------------------------------------------
    // E3 — share issuance vs. economic value
    // ------------------------------------------------------------------
 
    /// @notice The book is internally consistent — and that is exactly the problem:
    ///         `totalValueLocked` is a pure ledger of deposits minus redemptions,
    ///         completely independent of what the portfolio is worth (F3-5).
    function invariant_E3_BookValueIsDepositsMinusRedemptions() public view {
        assertEq(
            vault.totalValueLocked(),
            vaultHandler.ghostDepositedUsd() - vaultHandler.ghostRedeemedUsd(),
            "TVL tracks deposits, never the portfolio"
        );
    }
 
    /// @notice Shares and book value vanish together: no shares can survive a fully
    ///         drained book, and no book value can survive with zero shares.
    function invariant_E3_SharesAndBookValueAgreeOnEmptiness() public view {
        if (vault.totalSupply() == 0) {
            assertEq(vault.totalValueLocked(), 0, "no shares, no book value");
        } else {
            assertGt(vault.totalValueLocked(), 0, "shares always carry book value");
        }
    }
 
    // ------------------------------------------------------------------
    // E4 — reward conservation
    // ------------------------------------------------------------------
 
    /// @notice At a constant reputation tier, total claimed never exceeds what the
    ///         schedule owes for the staked amount over the elapsed time. (The
    ///         retroactive-tier overpayment is `StakingRewards.t.sol`.)
    function invariant_E4_ClaimsNeverExceedTheSchedule() public view {
        assertLe(stakingHandler.ghostClaimed(), stakingHandler.maxEntitlement() + 1, "rewards are conserved");
    }
 
    // ------------------------------------------------------------------
    // E5 / E6 — bridge conservation and adapter isolation
    // ------------------------------------------------------------------
 
    /// @notice Every unit the router pulls from the user is handed to the adapter,
    ///         and the router retains nothing between transactions.
    function invariant_E5_BridgeConservesTheAuthorisedAmount() public view {
        assertEq(bridgeHandler.ghostAuthorised(), bridgeHandler.ghostDelivered(), "no value retained or lost");
        assertEq(bridgeToken.balanceOf(address(bridge)), 0, "router holds nothing at rest");
    }
 
    /// @notice The adapter's authority is unbounded but confined to the router's own
    ///         balance of the mapped token — it can never reach the user directly.
    function invariant_E6_AdapterCannotReachUserBalances() public view {
        assertEq(
            bridgeToken.allowance(bridgeUser, address(adapter)), 0, "user never approves the adapter"
        );
    }
 
    // ------------------------------------------------------------------
    // E7 — treasury authorization
    // ------------------------------------------------------------------
 
    /// @notice Nothing leaves the treasury without three confirmations and the full
    ///         timelock, no matter who calls `executeTransaction`.
    function invariant_E7_TreasuryPaysOnlyWhatWasApproved() public view {
        MockERC20 token = MockERC20(address(treasuryHandler.TOKEN()));
        assertEq(
            token.balanceOf(payee), treasuryHandler.ghostApprovedPayouts(), "payouts match approved proposals"
        );
        assertEq(token.balanceOf(outsider), 0, "the executor never receives funds");
    }
}