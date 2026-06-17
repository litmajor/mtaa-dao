
# ═══════════════════════════════════════════════════════════════════════════════
#  MTAAToken TESTNET DEPLOYMENT & TESTING GUIDE
# ═══════════════════════════════════════════════════════════════════════════════

## PART 1: PRE-DEPLOYMENT SETUP

### 1.1 Install Foundry (if not already installed)
```bash
curl -L https://foundry.paradigm.xyz | bash
foundryup
```

### 1.2 Create Project Structure
```bash
mkdir mtaa-testnet && cd mtaa-testnet
forge init --force
```

### 1.3 Install Dependencies
```bash
forge install OpenZeppelin/openzeppelin-contracts@v5.0.2
forge install smartcontractkit/chainlink-brownie-contracts@1.1.1
```

### 1.4 remappings.txt
```
@openzeppelin/=lib/openzeppelin-contracts/
@chainlink/=lib/chainlink-brownie-contracts/
```

### 1.5 Create Mock Contracts (for testnet)

**MockPriceFeed.sol** — Simulates Chainlink oracle
```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract MockPriceFeed {
    uint8 public decimals = 8;
    int256 public price = 1000000; // $0.01 per MTAA (1 MTAA = 1 cent)
    uint256 public updatedAt;
    uint80 public roundId = 1;

    constructor() {
        updatedAt = block.timestamp;
    }

    function latestRoundData() external view returns (
        uint80, int256, uint256, uint256, uint80
    ) {
        return (roundId, price, block.timestamp - 300, updatedAt, roundId);
    }

    function setPrice(int256 _price) external {
        price = _price;
        updatedAt = block.timestamp;
        roundId++;
    }

    function setStale() external {
        updatedAt = block.timestamp - 2 hours; // Makes price stale
    }
}
```

**MockTreasury.sol** — Simple treasury for testing
```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract MockTreasury {
    receive() external payable {}
}
```

**MockReputationEngine.sol**
```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract MockReputationEngine {
    mapping(address => uint256) public scores;

    function recordEvent(address user, string calldata, uint256, int256 change) external {
        if (change > 0) scores[user] += uint256(change);
        else scores[user] -= uint256(-change);
    }
}
```

**MockAPYCalculator.sol**
```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract MockAPYCalculator {
    function calculateAPY(uint256) external pure returns (uint256) {
        return 1000; // 10% APY
    }
}
```

---

## PART 2: DEPLOYMENT SCRIPT

**script/DeployMTAA.s.sol**
```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/MTAAToken.sol";
import "../src/mocks/MockPriceFeed.sol";
import "../src/mocks/MockTreasury.sol";
import "../src/mocks/MockReputationEngine.sol";
import "../src/mocks/MockAPYCalculator.sol";

contract DeployMTAA is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        vm.startBroadcast(deployerPrivateKey);

        // Deploy mocks
        MockTreasury treasury = new MockTreasury();
        MockReputationEngine repEngine = new MockReputationEngine();
        MockAPYCalculator apyCalc = new MockAPYCalculator();
        MockPriceFeed priceFeed = new MockPriceFeed();

        // Deploy MTAA Token
        MTAAToken mtaa = new MTAAToken(
            deployer,           // _owner
            address(treasury),  // _multiSigTreasury
            address(repEngine), // _reputationEngine
            address(apyCalc)    // _apyCalculator
        );

        // Set price feed
        mtaa.setPriceFeed(address(priceFeed));

        // Set USD fees (e.g., $10 DAO creation = 10 * 1e8 = 1e9)
        mtaa.setFeeUsd(mtaa.FEE_DAO_CREATION(), 10 * 1e8);

        vm.stopBroadcast();

        console.log("MTAA Token: ", address(mtaa));
        console.log("Treasury:   ", address(treasury));
        console.log("Price Feed: ", address(priceFeed));
        console.log("Rep Engine: ", address(repEngine));
        console.log("APY Calc:   ", address(apyCalc));
        console.log("Owner:      ", deployer);
        console.log("Owner Balance: ", mtaa.balanceOf(deployer) / 1e18, "MTAA");
    }
}
```

---

## PART 3: COMPREHENSIVE TEST SUITE

**test/MTAAToken.t.sol**
```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/MTAAToken.sol";
import "../src/mocks/MockPriceFeed.sol";
import "../src/mocks/MockTreasury.sol";
import "../src/mocks/MockReputationEngine.sol";
import "../src/mocks/MockAPYCalculator.sol";

contract MTAATokenTest is Test {
    MTAAToken public mtaa;
    MockPriceFeed public priceFeed;
    MockTreasury public treasury;
    MockReputationEngine public repEngine;
    MockAPYCalculator public apyCalc;

    address owner = address(1);
    address alice = address(2);
    address bob = address(3);
    address oracle = address(4);
    address emergency = address(5);

    function setUp() public {
        vm.startPrank(owner);

        treasury = new MockTreasury();
        repEngine = new MockReputationEngine();
        apyCalc = new MockAPYCalculator();

        mtaa = new MTAAToken(
            owner,
            address(treasury),
            address(repEngine),
            address(apyCalc)
        );

        priceFeed = new MockPriceFeed();
        mtaa.setPriceFeed(address(priceFeed));

        // Grant roles
        mtaa.grantRole(mtaa.ORACLE_ROLE(), oracle);
        mtaa.grantRole(mtaa.EMERGENCY_ROLE(), emergency);
        mtaa.grantRole(mtaa.DISTRIBUTOR_ROLE(), owner);

        // Fund test accounts
        mtaa.transfer(alice, 100_000 * 1e18);
        mtaa.transfer(bob, 100_000 * 1e18);

        vm.stopPrank();
    }

    // ═══════════════════════════════════════════════════════════════════════
    // BASIC ERC20 TESTS
    // ═══════════════════════════════════════════════════════════════════════

    function test_InitialSupply() public view {
        assertEq(mtaa.totalSupply(), 125_000_000 * 1e18);
        assertEq(mtaa.balanceOf(owner), 125_000_000 * 1e18 - 200_000 * 1e18);
    }

    function test_Transfer() public {
        vm.prank(alice);
        mtaa.transfer(bob, 1000 * 1e18);
        assertEq(mtaa.balanceOf(bob), 101_000 * 1e18);
    }

    function test_Transfer_InsufficientBalance() public {
        vm.prank(alice);
        vm.expectRevert(
            abi.encodeWithSelector(
                MTAAToken.InsufficientBalance.selector,
                100_000 * 1e18,
                200_000 * 1e18
            )
        );
        mtaa.transfer(bob, 200_000 * 1e18);
    }

    // ═══════════════════════════════════════════════════════════════════════
    // PAUSE TESTS (FIX #1)
    // ═══════════════════════════════════════════════════════════════════════

    function test_Pause_BlocksTransfer() public {
        vm.prank(owner);
        mtaa.pause();

        vm.prank(alice);
        vm.expectRevert(Pausable.EnforcedPause.selector);
        mtaa.transfer(bob, 1000 * 1e18);
    }

    function test_Pause_BlocksBurn() public {
        vm.prank(owner);
        mtaa.pause();

        vm.prank(alice);
        vm.expectRevert(Pausable.EnforcedPause.selector);
        mtaa.burn(100 * 1e18);
    }

    function test_Pause_AllowsMint() public {
        vm.prank(owner);
        mtaa.pause();

        // Oracle can still mint rewards while paused
        vm.prank(oracle);
        mtaa.completeDailyChallenge(alice, "test", 10 * 1e18);

        assertGt(mtaa.balanceOf(alice), 100_000 * 1e18);
    }

    // ═══════════════════════════════════════════════════════════════════════
    // STAKING TESTS
    // ═══════════════════════════════════════════════════════════════════════

    function test_Stake() public {
        vm.prank(alice);
        uint256 stakeId = mtaa.stake(10_000 * 1e18, 30);

        assertEq(stakeId, 0);
        assertEq(mtaa.stakedBalances(alice), 10_000 * 1e18);
        assertEq(mtaa.totalStakedAmount(), 10_000 * 1e18);
    }

    function test_Stake_LocksTransfer() public {
        vm.prank(alice);
        mtaa.stake(90_000 * 1e18, 30);

        // Try to transfer more than available (unstaked)
        vm.prank(alice);
        vm.expectRevert(MTAAToken.StakeLocked.selector);
        mtaa.transfer(bob, 20_000 * 1e18); // Only 10k available
    }

    function test_Stake_InsufficientBalance() public {
        vm.prank(alice);
        vm.expectRevert(
            abi.encodeWithSelector(
                MTAAToken.InsufficientBalance.selector,
                100_000 * 1e18,
                200_000 * 1e18
            )
        );
        mtaa.stake(200_000 * 1e18, 30);
    }

    function test_Stake_MinimumAmount() public {
        vm.prank(alice);
        vm.expectRevert(
            abi.encodeWithSelector(
                MTAAToken.StakeAmountTooLow.selector,
                100 * 1e18,
                1000 * 1e18
            )
        );
        mtaa.stake(100 * 1e18, 30);
    }

    function test_Unstake_BeforeLock() public {
        vm.prank(alice);
        mtaa.stake(10_000 * 1e18, 30);

        vm.prank(alice);
        vm.expectRevert(MTAAToken.StakeLocked.selector);
        mtaa.unstake(0);
    }

    function test_Unstake_AfterLock() public {
        vm.prank(alice);
        mtaa.stake(10_000 * 1e18, 30);

        // Warp past lock period
        vm.warp(block.timestamp + 31 days);

        uint256 balanceBefore = mtaa.balanceOf(alice);

        vm.prank(alice);
        mtaa.unstake(0);

        // Should receive rewards (minted)
        assertGe(mtaa.balanceOf(alice), balanceBefore);
        assertEq(mtaa.stakedBalances(alice), 0);
    }

    function test_ClaimRewards() public {
        vm.prank(alice);
        mtaa.stake(10_000 * 1e18, 30);

        vm.warp(block.timestamp + 30 days);

        uint256 balanceBefore = mtaa.balanceOf(alice);

        vm.prank(alice);
        mtaa.claimStakeRewards(0);

        assertGt(mtaa.balanceOf(alice), balanceBefore);
    }

    // ═══════════════════════════════════════════════════════════════════════
    // ORACLE/PRICE FEED TESTS (FIX #4, #5)
    // ═══════════════════════════════════════════════════════════════════════

    function test_PriceFeed_StalePrice() public {
        priceFeed.setStale();

        vm.prank(alice);
        vm.expectRevert(
            abi.encodeWithSelector(MTAAToken.StalePriceFeed.selector, 0, 1 hours)
        );
        mtaa.payDAOCreationFeeWithToken(address(mtaa), 1000 * 1e18);
    }

    function test_PriceFeed_NormalPrice() public {
        // Price = $0.01, fee = $10 usd8 = 10 * 1e8
        // Expected MTAA = (10 * 1e8 * 1e18) / (0.01 * 1e8) = 10 * 1e18 / 0.01 = 1000 MTAA

        vm.prank(owner);
        mtaa.setFeeUsd(mtaa.FEE_DAO_CREATION(), 10 * 1e8); // $10

        vm.prank(alice);
        mtaa.payDAOCreationFeeWithToken(address(mtaa), 2000 * 1e18); // Provide extra

        // Should burn 50% and send 50% to treasury
        assertGt(mtaa.totalBurned(), 0);
    }

    function test_PriceFeed_ZeroPrice() public {
        priceFeed.setPrice(0);

        vm.prank(alice);
        vm.expectRevert("Invalid price from oracle");
        mtaa.payDAOCreationFeeWithToken(address(mtaa), 1000 * 1e18);
    }

    // ═══════════════════════════════════════════════════════════════════════
    // FEE SYSTEM TESTS (FIX #2)
    // ═══════════════════════════════════════════════════════════════════════

    function test_DAOCreationFee_Disabled() public {
        vm.prank(owner);
        mtaa.toggleDaoCreationFee(false);

        // Should return early, no fee collected
        uint256 balanceBefore = mtaa.balanceOf(alice);

        vm.prank(alice);
        mtaa.payDAOCreationFee();

        assertEq(mtaa.balanceOf(alice), balanceBefore);
    }

    function test_VaultDeploymentFee() public {
        uint256 balanceBefore = mtaa.balanceOf(alice);

        vm.prank(alice);
        mtaa.payVaultDeploymentFee();

        assertEq(mtaa.balanceOf(alice), balanceBefore - 500 * 1e18);
    }

    // ═══════════════════════════════════════════════════════════════════════
    // EMERGENCY MINT TESTS (FIX #3)
    // ═══════════════════════════════════════════════════════════════════════

    function test_EmergencyMint_Timelock() public {
        vm.prank(emergency);
        mtaa.scheduleEmergencyMint(alice, 1000 * 1e18);

        // Try to execute immediately
        vm.prank(emergency);
        vm.expectRevert(
            abi.encodeWithSelector(
                MTAAToken.MintRequestNotReady.selector,
                block.timestamp + 48 hours
            )
        );
        mtaa.executeEmergencyMint(0);
    }

    function test_EmergencyMint_ExecuteAfterDelay() public {
        vm.prank(emergency);
        mtaa.scheduleEmergencyMint(alice, 1000 * 1e18);

        vm.warp(block.timestamp + 49 hours);

        uint256 balanceBefore = mtaa.balanceOf(alice);

        vm.prank(emergency);
        mtaa.executeEmergencyMint(0);

        assertEq(mtaa.balanceOf(alice), balanceBefore + 1000 * 1e18);
    }

    function test_EmergencyMint_AlreadyExecuted() public {
        vm.prank(emergency);
        mtaa.scheduleEmergencyMint(alice, 1000 * 1e18);

        vm.warp(block.timestamp + 49 hours);

        vm.prank(emergency);
        mtaa.executeEmergencyMint(0);

        vm.prank(emergency);
        vm.expectRevert(MTAAToken.MintRequestAlreadyExecuted.selector);
        mtaa.executeEmergencyMint(0);
    }

    // ═══════════════════════════════════════════════════════════════════════
    // BURN SYSTEM TESTS (FIX #8)
    // ═══════════════════════════════════════════════════════════════════════

    function test_QuarterlyBurn_RespectsTarget() public {
        // Burn target is 10M
        vm.prank(owner);
        mtaa.quarterlyBurn();

        assertGt(mtaa.totalBurned(), 0);
        assertLt(mtaa.totalBurned(), 10_000_000 * 1e18);
    }

    function test_QuarterlyBurn_Cooldown() public {
        vm.prank(owner);
        mtaa.quarterlyBurn();

        vm.prank(owner);
        vm.expectRevert(
            abi.encodeWithSelector(
                MTAAToken.QuarterlyBurnCooldown.selector,
                block.timestamp + 90 days
            )
        );
        mtaa.quarterlyBurn();
    }

    function test_QuarterlyBurn_TargetReached() public {
        // Set target very low to trigger
        vm.prank(owner);
        mtaa.setBurnTarget(mtaa.totalBurned() + 1);

        vm.prank(owner);
        mtaa.quarterlyBurn();

        vm.prank(owner);
        vm.expectRevert(MTAAToken.BurnTargetReached.selector);
        mtaa.quarterlyBurn();
    }

    // ═══════════════════════════════════════════════════════════════════════
    // DAILY CHALLENGE TESTS (FIX #9)
    // ═══════════════════════════════════════════════════════════════════════

    function test_DailyChallenge_Cap() public {
        vm.prank(oracle);
        vm.expectRevert(
            abi.encodeWithSelector(
                MTAAToken.DailyRewardCapExceeded.selector,
                200 * 1e18,
                100 * 1e18
            )
        );
        mtaa.completeDailyChallenge(alice, "test", 200 * 1e18);
    }

    function test_DailyChallenge_Streak() public {
        // Day 1
        vm.warp(86400 * 1);
        vm.prank(oracle);
        mtaa.completeDailyChallenge(alice, "test", 10 * 1e18);

        // Day 2
        vm.warp(86400 * 2);
        vm.prank(oracle);
        mtaa.completeDailyChallenge(alice, "test2", 10 * 1e18);

        assertEq(mtaa.streakDays(alice), 2);
    }

    function test_DailyChallenge_Duplicate() public {
        vm.warp(86400 * 1);
        vm.prank(oracle);
        mtaa.completeDailyChallenge(alice, "test", 10 * 1e18);

        vm.prank(oracle);
        vm.expectRevert(MTAAToken.ChallengeAlreadyCompleted.selector);
        mtaa.completeDailyChallenge(alice, "test", 10 * 1e18);
    }

    // ═══════════════════════════════════════════════════════════════════════
    // VESTING TESTS
    // ═══════════════════════════════════════════════════════════════════════

    function test_Vesting() public {
        vm.prank(owner);
        mtaa.createVestingSchedule(
            alice,
            10_000 * 1e18,
            block.timestamp,
            365 days,
            30 days,
            MTAAToken.VestingType.COMMUNITY_REWARDS
        );

        // Before cliff
        assertEq(mtaa.getVestableAmount(alice), 0);

        // After cliff, half way
        vm.warp(block.timestamp + 215 days); // 30 + 185 = 215
        uint256 vestable = mtaa.getVestableAmount(alice);
        assertApproxEqRel(vestable, 5_000 * 1e18, 0.01e18);

        // Claim
        uint256[] memory indices = new uint256[](1);
        indices[0] = 0;

        vm.prank(alice);
        mtaa.vestSchedules(indices);

        assertEq(mtaa.balanceOf(alice), 100_000 * 1e18 + vestable);
    }

    // ═══════════════════════════════════════════════════════════════════════
    // REPUTATION TESTS
    // ═══════════════════════════════════════════════════════════════════════

    function test_Reputation_Update() public {
        vm.prank(oracle);
        mtaa.updateReputation(alice, 5000);

        assertEq(mtaa.reputationScores(alice), 5000);
        assertEq(uint256(mtaa.getReputationTier(alice)), uint256(MTAAToken.ReputationTier.ELDER));
    }

    function test_Reputation_MaxScore() public {
        vm.prank(oracle);
        vm.expectRevert(
            abi.encodeWithSelector(
                MTAAToken.InvalidReputationScore.selector,
                2_000_000,
                1_000_000
            )
        );
        mtaa.updateReputation(alice, 2_000_000);
    }

    // ═══════════════════════════════════════════════════════════════════════
    // ACCESS CONTROL TESTS
    // ═══════════════════════════════════════════════════════════════════════

    function test_OnlyOwner_Setters() public {
        vm.prank(alice);
        vm.expectRevert();
        mtaa.setPriceFeed(address(priceFeed));

        vm.prank(owner);
        mtaa.setPriceFeed(address(priceFeed)); // Should succeed
    }

    function test_OnlyOracle_DailyChallenge() public {
        vm.prank(alice);
        vm.expectRevert();
        mtaa.completeDailyChallenge(alice, "test", 10 * 1e18);
    }

    // ═══════════════════════════════════════════════════════════════════════
    // MAX_SUPPLY TESTS
    // ═══════════════════════════════════════════════════════════════════════

    function test_MaxSupply_Enforced() public {
        // Try to mint more than max
        vm.prank(emergency);
        mtaa.scheduleEmergencyMint(alice, 1_000_000_000 * 1e18);

        vm.warp(block.timestamp + 49 hours);

        vm.prank(emergency);
        vm.expectRevert(MTAAToken.MaxSupplyExceeded.selector);
        mtaa.executeEmergencyMint(0);
    }

    // ═══════════════════════════════════════════════════════════════════════
    // GOVERNANCE (ERC20Votes) TESTS
    // ═══════════════════════════════════════════════════════════════════════

    function test_Delegate() public {
        vm.prank(alice);
        mtaa.delegate(bob);

        assertEq(mtaa.delegates(alice), bob);
        assertEq(mtaa.getVotes(bob), mtaa.balanceOf(alice));
    }

    function test_VotingPower_AfterStake() public {
        vm.prank(alice);
        mtaa.delegate(alice);

        uint256 votesBefore = mtaa.getVotes(alice);

        vm.prank(alice);
        mtaa.stake(50_000 * 1e18, 30);

        // Staked tokens should still count for voting power
        // (Since tokens aren't actually transferred)
        assertEq(mtaa.getVotes(alice), votesBefore);
    }
}
```

---

## PART 4: RUNNING TESTS

```bash
# Run all tests
forge test -vv

# Run specific test
forge test --match-test test_Stake -vvv

# Run with gas report
forge test --gas-report

# Run coverage
forge coverage
```

---

## PART 5: DEPLOY TO SEPOLIA TESTNET

### 5.1 Set environment variables
```bash
export PRIVATE_KEY="your_testnet_private_key"
export SEPOLIA_RPC="https://rpc.sepolia.org"
export ETHERSCAN_API_KEY="your_etherscan_api_key"
```

### 5.2 Deploy
```bash
forge script script/DeployMTAA.s.sol:DeployMTAA \
  --rpc-url $SEPOLIA_RPC \
  --broadcast \
  --verify \
  --etherscan-api-key $ETHERSCAN_API_KEY
```

### 5.3 Sepolia Chainlink Price Feed (if using real oracle)
- ETH/USD: `0x694AA1769357215DE4FAC081bf1f309aDC325306`
- Check https://docs.chain.link/data-feeds/price-feeds/addresses for others

---

## PART 6: MANUAL TESTING CHECKLIST (Post-Deploy)

Use Etherscan or cast to verify each function:

```bash
# Read functions
cast call <CONTRACT_ADDRESS> "totalSupply()" --rpc-url $SEPOLIA_RPC
cast call <CONTRACT_ADDRESS> "balanceOf(address)" <YOUR_ADDRESS> --rpc-url $SEPOLIA_RPC
cast call <CONTRACT_ADDRESS> "stakedBalances(address)" <YOUR_ADDRESS> --rpc-url $SEPOLIA_RPC
cast call <CONTRACT_ADDRESS> "getReputationTier(address)" <YOUR_ADDRESS> --rpc-url $SEPOLIA_RPC

# Write functions (requires private key)
cast send <CONTRACT_ADDRESS> "stake(uint256,uint256)" 1000000000000000000000 30 \
  --rpc-url $SEPOLIA_RPC --private-key $PRIVATE_KEY

cast send <CONTRACT_ADDRESS> "unstake(uint256)" 0 \
  --rpc-url $SEPOLIA_RPC --private-key $PRIVATE_KEY

cast send <CONTRACT_ADDRESS> "claimStakeRewards(uint256)" 0 \
  --rpc-url $SEPOLIA_RPC --private-key $PRIVATE_KEY

# Admin functions
cast send <CONTRACT_ADDRESS> "pause()" \
  --rpc-url $SEPOLIA_RPC --private-key $PRIVATE_KEY

cast send <CONTRACT_ADDRESS> "unpause()" \
  --rpc-url $SEPOLIA_RPC --private-key $PRIVATE_KEY
```

### Checklist:
- [ ] Deploy contract successfully
- [ ] Verify initial supply is 125M MTAA
- [ ] Transfer tokens between accounts
- [ ] Stake tokens and verify stakedBalances updates
- [ ] Try to transfer more than unstaked amount → expect StakeLocked
- [ ] Wait for lock period, then unstake and claim rewards
- [ ] Test pause/unpause (transfers blocked when paused, mints still work)
- [ ] Test fee payment (burn + treasury split)
- [ ] Test oracle-priced fee payment
- [ ] Test daily challenge completion (capped at maxDailyRewardAmount)
- [ ] Test emergency mint scheduling and execution (48h delay)
- [ ] Test quarterly burn (respects target and cooldown)
- [ ] Test vesting schedule creation and claiming
- [ ] Test reputation updates
- [ ] Verify MAX_SUPPLY enforcement on all mint paths
- [ ] Verify voting power (ERC20Votes) works correctly

---

## PART 7: KNOWN ISSUES TO WATCH DURING TESTING

1. **Soft Lock Staking**: Tokens stay in user wallet. Verify _update() correctly
   blocks transfers of staked amounts. Try edge cases with multiple stakes.

2. **Oracle Price Edge Cases**: Test with very low prices (1 wei), very high
   prices, and stale prices. Verify _mtAAForUsd8() handles all correctly.

3. **Fee Token Selection**: Compare MTAA fee payment (50% burn) vs USDC fee
   payment (0% burn). This is a design issue, not a bug.

4. **Emergency Mint Cancellation**: There's no cancel function. Once scheduled,
   it WILL execute after 48h unless you revoke EMERGENCY_ROLE first.

5. **APY Multiplier Bounds**: Test setLockPeriodMultiplier with extreme values
   (0, 1, 1000000). Currently no upper bound.

6. **Gas Costs**: completeDailyChallenge uses string parameter — monitor gas
   costs. If too high, consider switching to bytes32 in production.
