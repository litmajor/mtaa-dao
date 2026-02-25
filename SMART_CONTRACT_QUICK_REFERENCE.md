# Smart Contract Quick Reference Guide

**All contracts you need to write for automated flash loan execution**

---

## 📋 Contract Checklist

### Must-Write Contracts (Critical Path)
- [ ] **FlashLoanExecutor.sol** - Core borrowing & execution (250-300 lines)
- [ ] **ArbitrageStrategy.sol** - Triangular swap cycles (200-250 lines)

### Should-Write Contracts (High Value)
- [ ] **LiquidationStrategy.sol** - Collateral liquidation (150-200 lines)
- [ ] **PriceOracle.sol** - Multi-source price feeds (100-150 lines)

### Can-Write Later (Nice to Have)
- [ ] **MEVExtractor.sol** - Advanced MEV strategies (100-150 lines)
- [ ] **GasOptimizer.sol** - Gas cost calculations (50-100 lines)

---

## 🎯 Contract Dependencies

```
┌─────────────────────────┐
│  FlashLoanExecutor      │  ← Main orchestrator
│  (calls strategies)     │
└──────────┬──────────────┘
           │
    ┌──────┴──────────────────┐
    │                         │
    ▼                         ▼
┌──────────────┐      ┌──────────────┐
│ ArbitrageStr │      │ Liquidation  │
│ ategy.sol    │      │ Strategy.sol │
└──────┬───────┘      └──────┬───────┘
       │                     │
    ┌──┴─────────────────┬───┴──┐
    ▼                    ▼      ▼
┌─────────────┐  ┌──────────┐ ┌────────────┐
│ Uniswap V3  │  │  Curve   │ │ Aave Pool  │
│  Router     │  │  Pool    │ │ (Lending)  │
└─────────────┘  └──────────┘ └────────────┘
```

---

## 💻 Code Templates

### 1. Flash Loan Executor - Main Entry Point
```solidity
// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import '@aave/core-v3/contracts/flashloan/base/FlashLoanReceiverBase.sol';

contract FlashLoanExecutor is FlashLoanReceiverBase {
  address public owner;
  
  // Key functions:
  function executeFlashLoan(
    address asset,
    uint256 amount,
    address strategy,
    bytes calldata params
  ) external onlyOwner {
    // Trigger Aave flash loan
  }
  
  function executeOperation(
    address asset,
    uint256 amount,
    uint256 premium,
    address initiator,
    bytes calldata params
  ) external override onlyPool returns (bool) {
    // Called by Aave during flash loan
    // Execute strategy here
  }
}
```

**Line Count**: ~250-300 lines  
**Complexity**: ⭐⭐⭐ (High - state management)  
**Deployment Cost**: ~$2K Ethereum, ~$1-10 Polygon

---

### 2. Arbitrage Strategy - Swap Execution
```solidity
pragma solidity ^0.8.0;

contract ArbitrageStrategy {
  // Key functions:
  function execute(
    address asset,
    uint256 amount,
    bytes calldata params
  ) external returns (bool success, uint256 profit) {
    // Decode: path[], dexes[], minAmounts[]
    // Execute swaps in sequence
    // Calculate profit
    // Repay flash loan + fee
  }
}
```

**Line Count**: ~200-250 lines  
**Complexity**: ⭐⭐ (Medium - swap math)  
**Deployment Cost**: ~$1.5K Ethereum, ~$2-5 Polygon

---

### 3. Liquidation Strategy - Bonus Collection
```solidity
pragma solidity ^0.8.0;

contract LiquidationStrategy {
  function execute(
    address asset,
    uint256 amount,
    bytes calldata params
  ) external returns (bool success, uint256 profit) {
    // Decode: collateral, debt, user, debtAmount
    // Call Aave liquidationCall()
    // Get collateral bonus (15%)
    // Swap back to borrowed asset
    // Return profit
  }
}
```

**Line Count**: ~150-200 lines  
**Complexity**: ⭐⭐ (Medium - liquidation math)  
**Deployment Cost**: ~$1.5K Ethereum

---

## 🔧 Integration Points

### With Backend APIs

```typescript
// Your backend generates this data:
{
  "opportunities": [
    {
      "id": "opp-001",
      "type": "arbitrage",
      "asset": "USDC",
      "amount": "100000",
      "path": ["USDC", "USDT", "DAI", "USDC"],
      "dexes": ["uniswap", "curve", "sushiswap"],
      "expectedProfit": "2000",
      "minAmounts": ["90000", "89000", "98000"],
      "maxSlippage": "500" // 0.5%
    }
  ]
}

// Your frontend calls backend to get opportunities
const opportunities = await fetch('/api/lending/flash-loans');

// When user clicks "Execute":
const tx = await flashLoanExecutor.executeFlashLoan(
  USDC_ADDRESS,
  ethers.utils.parseUnits('100000', 6),
  ARBITRAGE_STRATEGY_ADDRESS,
  encodeParams(opportunity)
);
```

---

## 📊 Gas Budget

### Ethereum Mainnet
```
Contract              Gas Used        Cost @ 50 gwei
─────────────────────────────────────────────────
FlashLoan execution   ~200,000        ~$10
Arbitrage swap        ~250,000        ~$12.50
Liquidation           ~350,000        ~$17.50
─────────────────────────────────────────────────
Per execution         ~800,000        ~$40

Min profitable:       $2,000 profit
Min success rate:     2% (break even)
```

### Polygon
```
Per execution:        ~$2-5
Min profitable:       $100 profit
Min success rate:     50% (break even)
```

### Arbitrum
```
Per execution:        ~$0.10-0.50
Min profitable:       $10 profit
Min success rate:     100% (break even)
```

---

## 🧪 Testing Checklist

### For Each Contract
- [ ] Unit test: deploy & initialize
- [ ] Unit test: execute main function
- [ ] Unit test: profit calculation
- [ ] Unit test: error handling
- [ ] Integration test: with Aave mock
- [ ] Integration test: with DEX mock
- [ ] Gas cost benchmark
- [ ] Security review

### For Flash Loan Flow
- [ ] Test: valid flash loan
- [ ] Test: invalid strategy
- [ ] Test: profit too low
- [ ] Test: slippage exceeded
- [ ] Test: insufficient repayment
- [ ] Test: reentrancy attack
- [ ] Test: oracle manipulation

---

## 📈 Testing Example

```typescript
describe('FlashLoanExecutor', () => {
  let executor, arbitrage;
  let USDC, USDT, DAI;
  
  before(async () => {
    // Deploy contracts
    executor = await FlashLoanExecutor.deploy(aaveProvider);
    arbitrage = await ArbitrageStrategy.deploy();
    
    // Authorize strategy
    await executor.authorizeStrategy(arbitrage.address);
  });
  
  it('Should execute profitable arbitrage', async () => {
    const amount = ethers.utils.parseUnits('100000', 6); // 100k USDC
    
    // Prepare opportunity
    const path = [USDC.address, USDT.address, DAI.address, USDC.address];
    const params = encodeParams({ path, /* ... */ });
    
    // Execute flash loan
    await executor.executeFlashLoan(
      USDC.address,
      amount,
      arbitrage.address,
      params
    );
    
    // Check profit
    const profit = await executor.totalProfit();
    expect(profit).to.be.gt(ethers.utils.parseUnits('2000', 6)); // Min 2k
  });
  
  it('Should reject unprofitable execution', async () => {
    // ... setup low-profit scenario
    await expect(tx).to.be.reverted;
  });
});
```

---

## 🚀 Deployment Checklist

### Before Testnet
- [ ] All contracts compile without warnings
- [ ] 100%+ test coverage
- [ ] Gas optimization complete
- [ ] Security review passed

### Before Mainnet
- [ ] Testnet deployment successful
- [ ] All strategies working live
- [ ] Profit calculations accurate
- [ ] Formal security audit passed
- [ ] Emergency pause implemented
- [ ] Monitoring alerts configured

---

## 📞 Key Contract Addresses (Mainnet)

```
Ethereum:
  AAVE_POOL: 0x7d2768dE32b0b80b7a3454c06BdAc94A69DDc7A9
  AAVE_PROVIDER: 0xB53C1a33E56550A8E60385f1d1A5F5d1d4Fa0F66
  UNISWAP_ROUTER: 0xE592427A0AEce92De3Edee1F18E0157C05861564
  CURVE_3POOL: 0xbEbc44782C7dB0a1A60Cb6fe97d0b483032FF1C7

Polygon:
  AAVE_POOL: 0x794a61358D6845594F94dc1DB02A252b5b4814aD
  UNISWAP_ROUTER: 0x68b3465833fb72B5A828cEEBCC11D2949FA7D582
  CURVE_AAVE: 0x445FE580eF8d70FF569aB36e80c647af338db351

Arbitrum:
  AAVE_POOL: 0x794a61358D6845594F94dc1DB02A252b5b4814aD
  UNISWAP_ROUTER: 0x68b3465833fb72B5A828cEEBCC11D2949FA7D582
```

---

## 🔐 Security Considerations

### Flash Loan Attack Vectors
1. ✅ Reentrancy: Use `nonReentrant` modifier
2. ✅ Insufficient repayment: Validate balance before callback end
3. ✅ Price oracle manipulation: Use time-weighted prices
4. ✅ MEV sandwich attacks: Set `maxSlippage` limits

### Code Security
1. ✅ Input validation: Check amounts, addresses, paths
2. ✅ Error handling: Revert with clear messages
3. ✅ Access control: `onlyOwner` on critical functions
4. ✅ Safe math: Use SafeMath or Solidity 0.8.0+

---

## ✨ Optimization Tips

### Gas Savings
- Use `calldata` instead of `memory` for params
- Combine multiple checks into single require
- Cache storage reads in local variables
- Use bit packing for flags

### Execution Speed
- Batch multiple swaps in one transaction
- Use Uniswap V3 for best rates (algorithm routing)
- Pre-calculate prices off-chain
- Monitor mempool for timing

---

## 📚 Key Resources

| Resource | Purpose | Link |
|----------|---------|------|
| Aave Flash Loans | Understanding flash loan API | https://docs.aave.com/developers/guides/flash-loans |
| Uniswap V3 SDK | Price quotes & routing | https://docs.uniswap.org/sdk/ |
| Curve Contracts | Stablecoin swap logic | https://curve.readthedocs.io/ |
| OpenZeppelin | Safe primitives | https://docs.openzeppelin.com/contracts/ |
| Hardhat | Local testing | https://hardhat.org/getting-started |

---

## 🎓 Learning Path

1. **Day 1**: Understand Aave flash loans
   - Read: Flash Loan docs
   - Watch: YT tutorials
   - Code: Simple flashloan example

2. **Day 2-3**: Build arbitrage logic
   - Study: Uniswap routing
   - Code: Swap executor
   - Test: Local arbitrage execution

3. **Day 4-5**: Build liquidation logic
   - Study: Aave liquidation mechanics
   - Code: Liquidation executor
   - Test: Mock liquidation

4. **Day 6-7**: Testing & optimization
   - Write unit tests
   - Gas optimization
   - Security review

---

**Timeline**: Week 4-5  
**Team Size**: 2-3 engineers  
**Estimated Cost**: $40K-50K (development)

**Ready to start writing contracts? Pick FlashLoanExecutor first! 🚀**
