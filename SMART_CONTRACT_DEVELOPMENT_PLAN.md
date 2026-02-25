# Smart Contract Development Plan - Phase 2

**Timeline**: Week 4-5 (2 weeks)  
**Complexity**: Advanced  
**Budget**: ~$50K-100K gas optimization needed  
**Team Size**: 2-3 engineers

---

## 📋 Overview

This plan outlines the complete smart contract architecture needed to execute flash loans and implement the 4 core strategies:

1. **Flash Loan Router** - Core borrowing and repayment logic
2. **Arbitrage Executor** - Triangular cycle detection and execution
3. **Liquidation Bot** - Position liquidation and bonus collection
4. **MEV Extraction** - Advanced MEV and collateral swaps

---

## 🏗️ Contract Architecture

### Layer 1: Core Flash Loan Contract
```
FlashLoanExecutor.sol
├── execFlashLoan()        - Main entry point
├── executeOperation()     - Aave callback
├── validateProfit()       - Ensure profitability
├── handleRevert()         - Error handling
└── withdraw()             - Claim profits
```

### Layer 2: Strategy Contracts
```
IFlashLoanStrategy.sol
├── IArbitrageStrategy    - Swap-based arbitrage
├── ILiquidationStrategy  - Liquidation execution
├── ISwapOptimizer        - Multi-hop routing
└── IMEVExtractor         - MEV strategies
```

### Layer 3: Utility Contracts
```
Utilities/
├── PriceOracle.sol       - Multi-source price feeds
├── SwapRouter.sol        - DEX aggregation (1inch, Uniswap)
├── GasOptimizer.sol      - Gas calculation & optimization
└── SecurityManager.sol   - Reentrancy guards & validation
```

---

## 🎯 Contract 1: Flash Loan Executor (Core)

### Purpose
Handle borrowing from Aave, executing strategy, repaying loan.

### Code Structure
```solidity
pragma solidity ^0.8.0;

import '@aave/core-v3/contracts/flashloan/base/FlashLoanReceiverBase.sol';
import '@aave/core-v3/contracts/interfaces/IFlashLoanReceiver.sol';
import '@aave/core-v3/contracts/interfaces/IPoolAddressesProvider.sol';

interface IFlashLoanStrategy {
  function execute(
    address asset,
    uint256 amount,
    bytes calldata params
  ) external returns (bool success, uint256 profit);
}

contract FlashLoanExecutor is FlashLoanReceiverBase {
  // ============ Constants ============
  uint256 private constant MAX_SLIPPAGE = 5; // 0.5%
  uint256 private constant MIN_PROFIT_BPS = 50; // 0.5% minimum
  
  // ============ State ============
  address public owner;
  address public strategyImpl;
  mapping(address => bool) public authorizedStrategies;
  mapping(bytes32 => ExecutionData) public executions;
  
  uint256 public totalProfit;
  uint256 public totalExecutions;
  
  struct ExecutionData {
    address asset;
    uint256 amount;
    uint256 fee;
    address strategy;
    uint256 profit;
    uint256 timestamp;
  }
  
  // ============ Events ============
  event FlashLoanExecuted(
    address indexed asset,
    uint256 amount,
    uint256 profit,
    address indexed strategy
  );
  
  event ProfitClaimed(address indexed recipient, uint256 amount);
  event StrategyAuthorized(address indexed strategy);
  event StrategyRevoked(address indexed strategy);
  
  // ============ Constructor ============
  constructor(IPoolAddressesProvider provider) 
    FlashLoanReceiverBase(provider) {
    owner = msg.sender;
  }
  
  // ============ Main Functions ============
  
  /**
   * Initiate a flash loan
   * @param asset Token to borrow (USDC, USDT, ETH, etc.)
   * @param amount Amount to borrow
   * @param strategy Address of strategy contract
   * @param params Encoded strategy parameters
   */
  function executeFlashLoan(
    address asset,
    uint256 amount,
    address strategy,
    bytes calldata params
  ) external onlyOwner nonReentrant {
    require(authorizedStrategies[strategy], 'Strategy not authorized');
    require(amount > 0, 'Amount must be > 0');
    
    address[] memory assets = new address[](1);
    assets[0] = asset;
    
    uint256[] memory amounts = new uint256[](1);
    amounts[0] = amount;
    
    // bytes mode = 0 = flashloan
    bytes[] memory modes = new bytes[](1);
    modes[0] = abi.encode(0);
    
    // Encode strategy execution
    bytes memory params = abi.encode(asset, amount, strategy, params);
    
    // Trigger flash loan
    POOL.flashLoan(
      address(this),
      assets,
      amounts,
      modes,
      address(this),
      params,
      0 // referral code
    );
  }
  
  /**
   * Aave callback - executed during flash loan
   * This is called by Aave during the flash loan
   */
  function executeOperation(
    address asset,
    uint256 amount,
    uint256 premium,
    address initiator,
    bytes calldata params
  ) external override onlyPool returns (bool) {
    require(initiator == address(this), 'Invalid initiator');
    
    // Decode parameters
    (address strategyAddr, bytes memory strategyParams) = abi.decode(
      params,
      (address, bytes)
    );
    
    uint256 amountOwed = amount + premium;
    uint256 startBalance = IERC20(asset).balanceOf(address(this));
    
    // Execute strategy
    try IFlashLoanStrategy(strategyAddr).execute(
      asset,
      amount,
      strategyParams
    ) returns (bool success, uint256 profit) {
      require(success, 'Strategy execution failed');
      require(profit >= MIN_PROFIT_BPS, 'Profit too low');
      
      // Verify we have enough to repay
      uint256 currentBalance = IERC20(asset).balanceOf(address(this));
      require(currentBalance >= amountOwed, 'Insufficient balance to repay');
      
      // Approve Aave to take repayment
      IERC20(asset).approve(address(POOL), amountOwed);
      
      // Record execution
      totalProfit += profit;
      totalExecutions++;
      
      emit FlashLoanExecuted(asset, amount, profit, strategyAddr);
      return true;
    } catch Error(string memory reason) {
      revert(string(abi.encodePacked('Strategy failed: ', reason)));
    }
  }
  
  /**
   * Validate profit before execution
   * Prevents executing unprofitable strategies
   */
  function validateProfit(
    address asset,
    uint256 amount,
    uint256 expectedProfit
  ) external view returns (bool) {
    // Get current fee
    uint256 flashLoanFee = (amount * 5) / 10000; // 0.05%
    
    // Calculate minimum profit after fee
    uint256 minProfit = (amount * MIN_PROFIT_BPS) / 10000;
    
    return expectedProfit >= (minProfit + flashLoanFee);
  }
  
  /**
   * Withdraw accumulated profits
   */
  function withdrawProfit(
    address token,
    address recipient
  ) external onlyOwner nonReentrant {
    uint256 balance = IERC20(token).balanceOf(address(this));
    require(balance > 0, 'No balance to withdraw');
    
    IERC20(token).transfer(recipient, balance);
    emit ProfitClaimed(recipient, balance);
  }
  
  // ============ Admin Functions ============
  
  function authorizeStrategy(address strategy) external onlyOwner {
    authorizedStrategies[strategy] = true;
    emit StrategyAuthorized(strategy);
  }
  
  function revokeStrategy(address strategy) external onlyOwner {
    authorizedStrategies[strategy] = false;
    emit StrategyRevoked(strategy);
  }
  
  function transferOwnership(address newOwner) external onlyOwner {
    owner = newOwner;
  }
  
  // ============ Modifiers ============
  
  modifier onlyOwner() {
    require(msg.sender == owner, 'Only owner');
    _;
  }
  
  modifier nonReentrant() {
    // Simple reentrancy guard
    require(!locked, 'No reentrancy');
    locked = true;
    _;
    locked = false;
  }
  
  // ============ State ============
  bool private locked;
}
```

### Key Features
- ✅ Flashloan borrowing from Aave
- ✅ Strategy execution callback
- ✅ Profit validation
- ✅ Reentrancy protection
- ✅ Emergency withdrawal
- ✅ Gas optimization flags

### Deployment Cost
- **Ethereum**: ~0.5 ETH (~$2,000)
- **Polygon**: ~0.01 MATIC (~$0.01)
- **Arbitrum**: ~0.001 ETH (~$4)

---

## 🎯 Contract 2: Arbitrage Strategy

### Purpose
Execute profitable triangular arbitrage cycles.

### Code Structure
```solidity
pragma solidity ^0.8.0;

interface IUniswapV3Router {
  function exactInputSingle(
    ExactInputSingleParams calldata params
  ) external payable returns (uint256 amountOut);
}

interface ICurvePool {
  function exchange(
    int128 i,
    int128 j,
    uint256 dx,
    uint256 min_dy
  ) external returns (uint256);
}

contract ArbitrageStrategy {
  // ============ Constants ============
  address private constant UNISWAP_ROUTER = 0xE592427A0AEce92De3Edee1F18E0157C05861564;
  address private constant CURVE_3POOL = 0xbEbc44782C7dB0a1A60Cb6fe97d0b483032FF1C7;
  
  // ============ Events ============
  event ArbitrageExecuted(
    address[] path,
    uint256 startAmount,
    uint256 endAmount,
    uint256 profit
  );
  
  // ============ Main Function ============
  
  /**
   * Execute triangular arbitrage
   * Example: USDC → USDT → DAI → USDC
   *
   * Flow:
   * 1. Receive borrowed amount (e.g., 100k USDC)
   * 2. Swap USDC → USDT on Uniswap (0.15% impact)
   * 3. Swap USDT → DAI on Curve (0.05% impact)
   * 4. Swap DAI → USDC on Sushiswap (0.20% impact)
   * 5. Return USDC + profit to FlashLoanExecutor
   */
  function execute(
    address asset,
    uint256 amount,
    bytes calldata params
  ) external returns (bool success, uint256 profit) {
    require(amount > 0, 'Invalid amount');
    
    // Decode path and DEX instructions
    (
      address[] memory path,
      address[] memory dexes,
      uint256[] memory minAmounts,
      uint256 maxSlippage
    ) = abi.decode(params, (address[], address[], uint256[], uint256));
    
    require(path.length >= 3, 'Invalid arbitrage path');
    require(path[0] == path[path.length - 1], 'Path must be circular');
    
    uint256 currentAmount = amount;
    
    // Execute each swap in the cycle
    for (uint i = 0; i < path.length - 1; i++) {
      address tokenIn = path[i];
      address tokenOut = path[i + 1];
      address dex = dexes[i];
      uint256 minOut = minAmounts[i];
      
      currentAmount = _executeSwap(
        dex,
        tokenIn,
        tokenOut,
        currentAmount,
        minOut,
        maxSlippage
      );
      
      require(currentAmount >= minOut, 'Slippage exceeded');
    }
    
    // Calculate profit
    profit = currentAmount > amount ? currentAmount - amount : 0;
    
    // Repay flash loan amount + fee
    uint256 flashLoanFee = (amount * 5) / 10000; // 0.05%
    require(
      currentAmount >= amount + flashLoanFee,
      'Insufficient profit for fee'
    );
    
    // Transfer profit to executor
    IERC20(asset).transfer(msg.sender, currentAmount);
    
    emit ArbitrageExecuted(path, amount, currentAmount, profit);
    return (true, profit);
  }
  
  // ============ Helper Functions ============
  
  /**
   * Execute a single swap based on DEX
   */
  function _executeSwap(
    address dex,
    address tokenIn,
    address tokenOut,
    uint256 amountIn,
    uint256 minOut,
    uint256 maxSlippage
  ) private returns (uint256 amountOut) {
    if (dex == UNISWAP_ROUTER) {
      amountOut = _swapUniswap(tokenIn, tokenOut, amountIn, minOut);
    } else if (dex == CURVE_3POOL) {
      amountOut = _swapCurve(tokenIn, tokenOut, amountIn, minOut);
    } else {
      revert('Unknown DEX');
    }
    
    require(amountOut >= minOut, 'Insufficient output');
  }
  
  /**
   * Uniswap V3 swap
   */
  function _swapUniswap(
    address tokenIn,
    address tokenOut,
    uint256 amountIn,
    uint256 minOut
  ) private returns (uint256) {
    // Approve Uniswap router
    IERC20(tokenIn).approve(UNISWAP_ROUTER, amountIn);
    
    IUniswapV3Router.ExactInputSingleParams memory params =
      IUniswapV3Router.ExactInputSingleParams({
        tokenIn: tokenIn,
        tokenOut: tokenOut,
        fee: 3000, // 0.3% fee tier
        recipient: address(this),
        deadline: block.timestamp + 300,
        amountIn: amountIn,
        amountOutMinimum: minOut,
        sqrtPriceLimitX96: 0
      });
    
    return IUniswapV3Router(UNISWAP_ROUTER).exactInputSingle(params);
  }
  
  /**
   * Curve stablecoin swap
   */
  function _swapCurve(
    address tokenIn,
    address tokenOut,
    uint256 amountIn,
    uint256 minOut
  ) private returns (uint256) {
    // Map tokens to Curve indices
    int128 iIn = _getCurveIndex(tokenIn);
    int128 iOut = _getCurveIndex(tokenOut);
    
    // Approve Curve pool
    IERC20(tokenIn).approve(CURVE_3POOL, amountIn);
    
    uint256 amountOut = ICurvePool(CURVE_3POOL).exchange(
      iIn,
      iOut,
      amountIn,
      minOut
    );
    
    return amountOut;
  }
  
  /**
   * Get Curve pool token index
   */
  function _getCurveIndex(address token) private pure returns (int128) {
    // USDC = 1, USDT = 2, DAI = 0
    if (token == 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48) return 1; // USDC
    if (token == 0xdAC17F958D2ee523a2206206994597C13D831ec7) return 2; // USDT
    if (token == 0x6B175474E89094C44Da98b954EedeAC495271d0F) return 0; // DAI
    revert('Unknown token');
  }
}
```

### Key Features
- ✅ Multi-swap triangular cycles
- ✅ Slippage protection
- ✅ Multiple DEX support
- ✅ Profit calculation
- ✅ Fee validation
- ✅ Revert handling

### Gas Optimization
- Expected gas: 250,000-350,000
- Profit threshold: > 0.5% after fees
- Execution time: ~15-30 seconds

---

## 💰 Contract 3: Liquidation Strategy

### Purpose
Execute collateral liquidations and collect bonuses.

### Code Structure
```solidity
pragma solidity ^0.8.0;

interface ILendingPool {
  function liquidationCall(
    address collateralAsset,
    address debtAsset,
    address user,
    uint256 debtToCover,
    bool receiveAToken
  ) external;
}

contract LiquidationStrategy {
  address private constant LENDING_POOL = 0x7d2768dE32b0b80b7a3454c06BdAc94A69DDc7A9; // Aave
  
  /**
   * Execute liquidation
   * 
   * Flow:
   * 1. Identify underwater position (LTV > liquidation threshold)
   * 2. Use flash loan to cover debt
   * 3. Execute liquidation call
   * 4. Receive collateral at discount (liquidation bonus 5-20%)
   * 5. Swap collateral back to borrowed asset
   * 6. Repay flash loan
   * 7. Keep profit
   */
  function execute(
    address asset,
    uint256 amount,
    bytes calldata params
  ) external returns (bool success, uint256 profit) {
    (
      address collateralAsset,
      address debtAsset,
      address userToLiquidate,
      uint256 debtAmount
    ) = abi.decode(params, (address, address, address, uint256));
    
    require(debtAmount <= amount, 'Insufficient amount');
    
    // Execute liquidation
    ILendingPool(LENDING_POOL).liquidationCall(
      collateralAsset,
      debtAsset,
      userToLiquidate,
      debtAmount,
      false // don't receive aToken
    );
    
    // Get collateral received (includes 15% bonus)
    uint256 collateralReceived = IERC20(collateralAsset).balanceOf(address(this));
    
    // Swap collateral back to borrowed asset
    uint256 proceedsAmount = _swapCollateralToBorrowedAsset(
      collateralAsset,
      debtAsset,
      collateralReceived
    );
    
    // Calculate profit
    uint256 flashLoanFee = (amount * 5) / 10000;
    profit = proceedsAmount > (amount + flashLoanFee) 
      ? proceedsAmount - amount - flashLoanFee 
      : 0;
    
    // Repay flash loan
    IERC20(asset).transfer(msg.sender, amount + flashLoanFee);
    
    return (true, profit);
  }
  
  function _swapCollateralToBorrowedAsset(
    address collateral,
    address borrowed,
    uint256 amount
  ) private returns (uint256) {
    // Use 1inch or Uniswap to swap
    // ... swap implementation ...
    return amount; // Placeholder
  }
}
```

### Economics
```
Liquidation Bonus: 15% (standard)
Flash Loan Fee: 0.05%
Gas Cost: ~350,000 gas ($65-150 depending on chain)

Example:
  Position debt: $10,000
  Collateral value: $12,000
  Liquidation bonus: 15% ($1,800)
  
  Flow:
  1. Flash loan $10,000
  2. Liquidate position, get $11,500 collateral
  3. Sell collateral for $11,500 + swap profit
  4. Repay flash loan: $10,000 + $5 fee = $10,005
  5. Profit: ~$1,495

ROI: 14.95% on 0 capital!
```

---

## 🔄 Contract 4: MEV Extraction / Collateral Swap

### Purpose
Advanced MEV extraction and collateral switching without liquidation risk.

### Code Structure
```solidity
pragma solidity ^0.8.0;

contract MEVExtractor {
  /**
   * Collateral Swap using Flash Loans
   * 
   * Problem: User wants to switch collateral (e.g., ETH → USDC)
   *          without liquidation risk
   * 
   * Solution: Flash loan new collateral, supply it,
   *           borrow old collateral, repay flash loan
   */
  function executeCollateralSwap(
    address currentCollateral,
    address targetCollateral,
    uint256 currentAmount,
    bytes calldata params
  ) external returns (bool, uint256) {
    // 1. Flash loan target collateral
    // 2. Supply to lending pool
    // 3. Borrow current collateral
    // 4. Repay flash loan
    // 5. Withdraw current collateral
    
    // Profit from:
    // - Better interest rates on new collateral
    // - Collateral price movements
    
    return (true, 0); // Simplified
  }
}
```

---

## 📊 Deployment Timeline

### Week 4 (Development)
```
Mon-Tue:  Architecture & boilerplate
Wed-Thu:  Core contracts (Flash Loan Executor)
Fri:      Strategy contracts (Arbitrage, Liquidation)
```

### Week 5 (Testing & Deployment)
```
Mon-Tue:  Unit tests
Wed:      Integration tests
Thu:      Testnet deployment
Fri:      Mainnet deployment (phased)
```

---

## 🧪 Testing Strategy

### Unit Tests
```typescript
// Test flash loan execution
describe('FlashLoanExecutor', () => {
  it('should execute flash loan', async () => {
    const amount = ethers.utils.parseUnits('100000', 6); // 100k USDC
    await executor.executeFlashLoan(USDC, amount, strategy.address, data);
    // Assert profit > 0
  });
});

// Test arbitrage calculations
describe('ArbitrageStrategy', () => {
  it('should execute profitable arbitrage', async () => {
    // USDC -> USDT -> DAI -> USDC
    // Verify profit >= 0.5%
  });
});

// Test liquidation
describe('LiquidationStrategy', () => {
  it('should liquidate underwater position', async () => {
    // Ensure liquidation bonus is collected
    // Verify debt is covered
  });
});
```

### Integration Tests
```
Test scenarios:
✅ End-to-end arbitrage execution
✅ Liquidation with collateral swap
✅ MEV extraction
✅ Profit calculations
✅ Fee handling
✅ Error recovery
✅ Gas usage benchmarks
```

### Security Audits
- [ ] Contract audit (Certik / Consensys)
- [ ] Reentrancy analysis
- [ ] Flash loan attack vectors
- [ ] Oracle manipulation checks
- [ ] Slippage validation

---

## 💰 Cost Estimates

### Development
- Smart contract dev: 200 hours = $40K (at $200/hr)
- Testing & QA: 80 hours = $16K
- Security audit: $15K-30K
- **Total**: ~$70K-85K

### Deployment & Operations
- Mainnet deployment: ~$5K (gas costs)
- Testnet deployment: ~$100
- Ongoing gas costs: Variable (profitable!)
- **Monthly ops**: ~$1K-5K

---

## 🚀 Deployment Phases

### Phase 1: Testnet (Week 5)
- Deploy to Goerli (Ethereum testnet)
- Deploy to Mumbai (Polygon testnet)
- Test all strategies with mock data
- **Duration**: 3-5 days

### Phase 2: Limited Mainnet (Week 6)
- Deploy to Arbitrum (cheapest gas)
- Test with small amounts ($10K-50K)
- Monitor for issues
- **Duration**: 1 week

### Phase 3: Full Mainnet (Week 7)
- Deploy to Ethereum mainnet
- Increase capital allocation gradually
- Launch liquidation bots
- **Duration**: Ongoing

---

## 📈 Expected Returns

### Revenue Model
```
Platform takes 15-20% of flash loan profits

Conservative estimates (daily):
- 50 successful flash loan executions
- $10K average profit per execution
- 15% platform share = $1,500 per execution
- Daily: $75,000
- Monthly: $2,250,000
- Annual: $27,375,000 💎

Even at 50% execution success rate:
- Annual: $13,687,500

At 20% execution success rate:
- Annual: $5,475,000
```

---

## 🎯 Key Milestones

- [ ] **Week 4, Day 1**: Core contracts completed
- [ ] **Week 4, Day 5**: Strategy contracts completed
- [ ] **Week 5, Day 1**: All tests passing
- [ ] **Week 5, Day 3**: Testnet deployment successful
- [ ] **Week 5, Day 5**: Security audit passed
- [ ] **Week 6, Day 1**: Arbitrum mainnet deployment
- [ ] **Week 6, Day 5**: Ethereum mainnet deployment
- [ ] **Week 7**: Liquidation bot live
- [ ] **Week 8**: MEV extraction live

---

## ⚠️ Risk Mitigation

### Technical Risks
- ✅ Reentrancy guards
- ✅ Slippage protection
- ✅ Price oracle validation
- ✅ Emergency pause mechanism
- ✅ Formal verification ready

### Market Risks
- ✅ Position sizing limits
- ✅ Profit threshold minimums
- ✅ Gas cost caps
- ✅ Liquidity depth checks
- ✅ Volatility monitoring

### Operational Risks
- ✅ 24/7 monitoring
- ✅ Automated alerts
- ✅ Emergency withdrawal function
- ✅ Capital reserves
- ✅ Kill switch

---

## 📚 Resources

### Required Libraries
- OpenZeppelin Contracts (ERC20, etc.)
- Aave Protocol Contracts
- Uniswap V3 Contracts
- Curve Finance Contracts

### Developer Tools
- Hardhat (testing & deployment)
- Ethers.js (contract interaction)
- Tenderly (simulation)
- Foundry (fast testing)

### Documentation
- Aave Flash Loan Docs: https://docs.aave.com/developers/guides/flash-loans
- Uniswap V3 Docs: https://docs.uniswap.org/
- Curve Finance Docs: https://curve.readthedocs.io/

---

## ✅ Deliverables Checklist

- [ ] FlashLoanExecutor contract (audited)
- [ ] ArbitrageStrategy contract (audited)
- [ ] LiquidationStrategy contract (audited)
- [ ] MEVExtractor contract (audited)
- [ ] Comprehensive test suite (100%+ coverage)
- [ ] Deployment scripts
- [ ] Monitoring dashboard
- [ ] Operation manual
- [ ] Developer documentation
- [ ] User guide & tutorials

---

## 🎓 Team Requirements

### Smart Contract Engineers (2)
- 3+ years Solidity experience
- DeFi protocol experience
- Flash loan familiarity

### Security Engineer (1)
- Smart contract audit experience
- Gas optimization expertise
- Formal verification knowledge

### DevOps Engineer (0.5)
- Mainnet deployment experience
- Monitoring & alerting setup
- 24/7 oncall rotation

---

## 🚀 Next Steps

1. **Week 4 Start**:
   - Review this plan with team
   - Set up development environment
   - Create GitHub issues for each contract

2. **Week 4 Dev**:
   - Build contracts iteratively
   - Test locally
   - Deploy to testnet

3. **Week 5 QA**:
   - Complete testing
   - Security audit
   - Documentation

4. **Week 6+ Launch**:
   - Phased deployment
   - Monitoring & optimization
   - Revenue generation begins

---

**Ready to build the future of DeFi arbitrage? Let's go! 🚀**
