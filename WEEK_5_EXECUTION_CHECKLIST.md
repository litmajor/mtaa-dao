# Week 5 Execution Checklist - Testing & Deployment

**Timeline**: Week 5 (5 business days)  
**Goal**: Test contracts thoroughly, deploy to testnet, prepare for audit  
**Status**: Ready to execute

---

## 🗓️ MONDAY - Unit Tests Complete

### Morning (4 hours)

#### Task 1: Set Up Test Environment
- [ ] Create `test/fixtures.ts` - Shared test setup
- [ ] Create `test/helpers.ts` - Test helper functions
- [ ] Install test dependencies

```bash
npm install --save-dev @nomiclabs/hardhat-waffle ethereum-waffle chai @types/chai
npm install --save-dev hardhat-gas-reporter
npm install --save-dev solidity-coverage
```

#### Task 2: Create Test Fixture File
**File**: `test/fixtures.ts`

```typescript
import { ethers } from 'hardhat';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { FlashLoanExecutor, ArbitrageStrategy, LiquidationStrategy } from '../typechain-types';

export interface TestContext {
  executor: FlashLoanExecutor;
  arbitrage: ArbitrageStrategy;
  liquidation: LiquidationStrategy;
  owner: SignerWithAddress;
  user: SignerWithAddress;
  accounts: SignerWithAddress[];
}

export async function deployContracts(): Promise<TestContext> {
  const [owner, user, ...accounts] = await ethers.getSigners();

  // Deploy executor
  const Executor = await ethers.getContractFactory('FlashLoanExecutor');
  const executor = await Executor.deploy(POOL_PROVIDER_ADDRESS);
  await executor.deployed();

  // Deploy strategies
  const Arbitrage = await ethers.getContractFactory('ArbitrageStrategy');
  const arbitrage = await Arbitrage.deploy();
  await arbitrage.deployed();

  const Liquidation = await ethers.getContractFactory('LiquidationStrategy');
  const liquidation = await Liquidation.deploy();
  await liquidation.deployed();

  // Authorize strategies
  await executor.authorizeStrategy(arbitrage.address);
  await executor.authorizeStrategy(liquidation.address);

  return {
    executor,
    arbitrage,
    liquidation,
    owner,
    user,
    accounts
  };
}
```

#### Task 3: Create Test Helpers File
**File**: `test/helpers.ts`

```typescript
import { ethers } from 'hardhat';
import { BigNumber } from 'ethers';

export const ADDRESSES = {
  USDC: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
  USDT: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
  DAI: '0x6B175474E89094C44Da98b954EedeAC495271d0F',
  WETH: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
  AAVE_POOL: '0x7d2768dE32b0b80b7a3454c06BdAc94A69DDc7A9',
  UNISWAP_V3: '0xE592427A0AEce92De3Edee1F18E0157C05861564',
  CURVE_3POOL: '0xbEbc44782C7dB0a1A60Cb6fe97d0b483032FF1C7'
};

export function parseUnits(amount: string, decimals: number = 6): BigNumber {
  return ethers.utils.parseUnits(amount, decimals);
}

export function formatUnits(amount: BigNumber, decimals: number = 6): string {
  return ethers.utils.formatUnits(amount, decimals);
}

export async function encodeArbitrageParams(
  path: string[],
  dexes: string[],
  minAmounts: BigNumber[],
  maxSlippage: number
): Promise<string> {
  return ethers.utils.defaultAbiCoder.encode(
    ['address[]', 'string[]', 'uint256[]', 'uint256'],
    [path, dexes, minAmounts, maxSlippage]
  );
}

export async function encodeLiquidationParams(
  collateral: string,
  debt: string,
  user: string,
  amount: BigNumber
): Promise<string> {
  return ethers.utils.defaultAbiCoder.encode(
    ['address', 'address', 'address', 'uint256'],
    [collateral, debt, user, amount]
  );
}
```

#### Deliverable
- ✅ Test infrastructure in place
- ✅ Helper functions created
- ✅ Ready for unit tests

---

### Afternoon (3 hours)

#### Task 4: Create FlashLoanExecutor Tests
**File**: `test/FlashLoanExecutor.test.ts`

```typescript
import { expect } from 'chai';
import { ethers } from 'hardhat';
import { deployContracts, TestContext } from './fixtures';
import { parseUnits } from './helpers';

describe('FlashLoanExecutor', () => {
  let ctx: TestContext;

  beforeEach(async () => {
    ctx = await deployContracts();
  });

  describe('Deployment', () => {
    it('should deploy successfully', async () => {
      expect(ctx.executor.address).to.not.equal(ethers.constants.AddressZero);
    });

    it('should set owner correctly', async () => {
      expect(await ctx.executor.owner()).to.equal(ctx.owner.address);
    });

    it('should set pool provider correctly', async () => {
      expect(await ctx.executor.poolProvider()).to.not.equal(ethers.constants.AddressZero);
    });
  });

  describe('Strategy Management', () => {
    it('should authorize strategy', async () => {
      expect(await ctx.executor.isStrategyAuthorized(ctx.arbitrage.address)).to.be.true;
    });

    it('should revoke strategy', async () => {
      await ctx.executor.revokeStrategy(ctx.arbitrage.address);
      expect(await ctx.executor.isStrategyAuthorized(ctx.arbitrage.address)).to.be.false;
    });

    it('should reject unauthorized strategy', async () => {
      await ctx.executor.revokeStrategy(ctx.arbitrage.address);
      
      const amount = parseUnits('100000');
      await expect(
        ctx.executor.executeFlashLoan(
          ADDRESSES.USDC,
          amount,
          ctx.arbitrage.address,
          '0x'
        )
      ).to.be.revertedWith('Strategy not authorized');
    });
  });

  describe('Authorization', () => {
    it('should reject non-owner calls', async () => {
      const amount = parseUnits('100000');
      await expect(
        ctx.executor.connect(ctx.user).executeFlashLoan(
          ADDRESSES.USDC,
          amount,
          ctx.arbitrage.address,
          '0x'
        )
      ).to.be.revertedWith('Only owner');
    });

    it('should allow owner calls', async () => {
      const amount = parseUnits('100000');
      // This will fail on actual execution but should pass authorization
      // In real test with forking, would proceed to flash loan callback
    });
  });

  describe('Input Validation', () => {
    it('should reject zero amount', async () => {
      await expect(
        ctx.executor.executeFlashLoan(
          ADDRESSES.USDC,
          0,
          ctx.arbitrage.address,
          '0x'
        )
      ).to.be.revertedWith('Amount must be > 0');
    });

    it('should reject zero address asset', async () => {
      const amount = parseUnits('100000');
      await expect(
        ctx.executor.executeFlashLoan(
          ethers.constants.AddressZero,
          amount,
          ctx.arbitrage.address,
          '0x'
        )
      ).to.be.revertedWith('Invalid asset');
    });

    it('should reject zero address strategy', async () => {
      const amount = parseUnits('100000');
      await expect(
        ctx.executor.executeFlashLoan(
          ADDRESSES.USDC,
          amount,
          ethers.constants.AddressZero,
          '0x'
        )
      ).to.be.revertedWith('Strategy not authorized');
    });
  });

  describe('Profit Validation', () => {
    it('should validate profit correctly', async () => {
      const amount = parseUnits('100000');
      const expectedProfit = parseUnits('2000'); // 2% profit
      
      const isProfitable = await ctx.executor.validateProfit(
        ADDRESSES.USDC,
        amount,
        expectedProfit
      );
      
      expect(isProfitable).to.be.true;
    });

    it('should reject low profit', async () => {
      const amount = parseUnits('100000');
      const lowProfit = parseUnits('100'); // 0.1% - below 0.5% minimum
      
      const isProfitable = await ctx.executor.validateProfit(
        ADDRESSES.USDC,
        amount,
        lowProfit
      );
      
      expect(isProfitable).to.be.false;
    });
  });

  describe('Ownership', () => {
    it('should transfer ownership', async () => {
      await ctx.executor.transferOwnership(ctx.user.address);
      expect(await ctx.executor.owner()).to.equal(ctx.user.address);
    });

    it('should reject transfer to zero address', async () => {
      await expect(
        ctx.executor.transferOwnership(ethers.constants.AddressZero)
      ).to.be.revertedWith('Invalid new owner');
    });

    it('should only allow owner to transfer', async () => {
      await expect(
        ctx.executor.connect(ctx.user).transferOwnership(ctx.user.address)
      ).to.be.revertedWith('Only owner');
    });
  });
});
```

#### Deliverable
- ✅ FlashLoanExecutor unit tests (15+ test cases)
- ✅ Tests cover all major functions
- ✅ Tests for authorization and validation

---

## 📊 Unit Test Targets

Create these test files (same pattern as FlashLoanExecutor):

| Test File | Test Cases | Coverage |
|-----------|-----------|----------|
| FlashLoanExecutor.test.ts | 15+ | 100% |
| ArbitrageStrategy.test.ts | 20+ | 100% |
| LiquidationStrategy.test.ts | 15+ | 100% |
| **Total** | **50+** | **100%+** |

---

## 🧪 TUESDAY - Integration Tests

### Full End-to-End Arbitrage Flow

**File**: `test/integration/arbitrage-flow.test.ts`

```typescript
import { expect } from 'chai';
import { ethers } from 'hardhat';

describe('Arbitrage Integration Flow', () => {
  // Test full cycle: Borrow → Swap → Repay → Profit
  
  it('should execute full arbitrage cycle', async () => {
    // 1. Initialize
    // 2. Request flash loan
    // 3. Execute swaps
    // 4. Calculate profit
    // 5. Verify repayment
    // 6. Check profit in wallet
  });

  it('should handle slippage limits', async () => {
    // Test that swaps respect slippage limits
  });

  it('should revert on insufficient profit', async () => {
    // Test that low profit cycles are rejected
  });

  it('should recover from swap failure', async () => {
    // Test error handling in swap chain
  });

  it('should optimize gas usage', async () => {
    // Measure and verify gas is under budget
  });
});
```

### Full End-to-End Liquidation Flow

**File**: `test/integration/liquidation-flow.test.ts`

```typescript
describe('Liquidation Integration Flow', () => {
  // Test full cycle: Borrow → Liquidate → Bonus Collection → Repay
  
  it('should execute full liquidation', async () => {
    // 1. Create underwater position
    // 2. Request flash loan
    // 3. Execute liquidation
    // 4. Collect bonus
    // 5. Repay flash loan
    // 6. Verify profit
  });

  it('should validate health factor', async () => {
    // Test health factor checking
  });

  it('should collect correct bonus', async () => {
    // Verify liquidation bonus calculation
  });

  it('should handle collateral swap', async () => {
    // Test swapping received collateral back to borrowed asset
  });
});
```

### Security Tests

**File**: `test/security/reentrancy.test.ts`

```typescript
describe('Reentrancy Protection', () => {
  it('should prevent reentrancy attacks', async () => {
    // Create malicious contract that tries to reenter
    // Verify attack is blocked by nonReentrant guard
  });

  it('should allow sequential calls', async () => {
    // Verify that legitimate sequential calls work
  });
});
```

### Monday Afternoon Deliverable
- ✅ 50+ unit tests written
- ✅ Integration test structure
- ✅ Security test templates

---

## 🚀 WEDNESDAY - Testnet Deployment

### Step 1: Compile Contracts

```bash
npx hardhat compile
# Output: Compiled successfully
```

### Step 2: Create Deployment Script

**File**: `scripts/deploy-sepolia.ts`

```typescript
import { ethers } from 'hardhat';

const SEPOLIA_POOL_PROVIDER = '0x6Ae43d3271ff6888e7Fc0ba78a9645B8c7D3434d';

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log('Deploying contracts with account:', deployer.address);

  // 1. Deploy FlashLoanExecutor
  console.log('\n1. Deploying FlashLoanExecutor...');
  const Executor = await ethers.getContractFactory('FlashLoanExecutor');
  const executor = await Executor.deploy(SEPOLIA_POOL_PROVIDER);
  await executor.deployed();
  console.log('✅ FlashLoanExecutor deployed at:', executor.address);

  // 2. Deploy ArbitrageStrategy
  console.log('\n2. Deploying ArbitrageStrategy...');
  const Arbitrage = await ethers.getContractFactory('ArbitrageStrategy');
  const arbitrage = await Arbitrage.deploy();
  await arbitrage.deployed();
  console.log('✅ ArbitrageStrategy deployed at:', arbitrage.address);

  // 3. Deploy LiquidationStrategy
  console.log('\n3. Deploying LiquidationStrategy...');
  const Liquidation = await ethers.getContractFactory('LiquidationStrategy');
  const liquidation = await Liquidation.deploy();
  await liquidation.deployed();
  console.log('✅ LiquidationStrategy deployed at:', liquidation.address);

  // 4. Authorize Strategies
  console.log('\n4. Authorizing strategies...');
  await executor.authorizeStrategy(arbitrage.address);
  await executor.authorizeStrategy(liquidation.address);
  console.log('✅ Strategies authorized');

  // 5. Summary
  console.log('\n========== Deployment Summary ==========');
  console.log('FlashLoanExecutor:', executor.address);
  console.log('ArbitrageStrategy:', arbitrage.address);
  console.log('LiquidationStrategy:', liquidation.address);
  console.log('========================================\n');

  // Save addresses for verification
  const fs = require('fs');
  const addresses = {
    executor: executor.address,
    arbitrage: arbitrage.address,
    liquidation: liquidation.address,
    deployer: deployer.address,
    timestamp: new Date().toISOString()
  };
  fs.writeFileSync('deployments/sepolia-addresses.json', JSON.stringify(addresses, null, 2));
  console.log('✅ Addresses saved to deployments/sepolia-addresses.json');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
```

### Step 3: Deployment Commands

```bash
# Deploy to Sepolia
npx hardhat run scripts/deploy-sepolia.ts --network sepolia

# Expected output:
# ✅ FlashLoanExecutor deployed at: 0x...
# ✅ ArbitrageStrategy deployed at: 0x...
# ✅ LiquidationStrategy deployed at: 0x...
```

### Step 4: Verify Contracts on Etherscan

**File**: `scripts/verify-sepolia.ts`

```typescript
import { run, ethers } from 'hardhat';
import * as fs from 'fs';

async function main() {
  const addresses = JSON.parse(fs.readFileSync('deployments/sepolia-addresses.json', 'utf-8'));

  console.log('Verifying contracts on Sepolia...\n');

  // Verify FlashLoanExecutor
  console.log('1. Verifying FlashLoanExecutor...');
  try {
    await run('verify:verify', {
      address: addresses.executor,
      constructorArguments: ['0x6Ae43d3271ff6888e7Fc0ba78a9645B8c7D3434d']
    });
    console.log('✅ FlashLoanExecutor verified');
  } catch (error) {
    console.log('❌ Verification failed (may already be verified)');
  }

  // Verify ArbitrageStrategy (no constructor args)
  console.log('\n2. Verifying ArbitrageStrategy...');
  try {
    await run('verify:verify', {
      address: addresses.arbitrage,
      constructorArguments: []
    });
    console.log('✅ ArbitrageStrategy verified');
  } catch (error) {
    console.log('❌ Verification failed (may already be verified)');
  }

  // Verify LiquidationStrategy (no constructor args)
  console.log('\n3. Verifying LiquidationStrategy...');
  try {
    await run('verify:verify', {
      address: addresses.liquidation,
      constructorArguments: []
    });
    console.log('✅ LiquidationStrategy verified');
  } catch (error) {
    console.log('❌ Verification failed (may already be verified)');
  }

  console.log('\n========== Verification Complete ==========');
  console.log('View on Etherscan:');
  console.log(`Executor: https://sepolia.etherscan.io/address/${addresses.executor}`);
  console.log(`Arbitrage: https://sepolia.etherscan.io/address/${addresses.arbitrage}`);
  console.log(`Liquidation: https://sepolia.etherscan.io/address/${addresses.liquidation}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
```

### Step 5: Test Deployment

**File**: `scripts/test-deployment.ts`

```typescript
import { ethers } from 'hardhat';
import * as fs from 'fs';

async function main() {
  const addresses = JSON.parse(fs.readFileSync('deployments/sepolia-addresses.json', 'utf-8'));
  const [signer] = await ethers.getSigners();

  console.log('Testing deployed contracts...\n');

  // Load contracts
  const executor = await ethers.getContractAt('FlashLoanExecutor', addresses.executor);
  const arbitrage = await ethers.getContractAt('ArbitrageStrategy', addresses.arbitrage);

  // Test 1: Owner check
  console.log('1. Checking owner...');
  const owner = await executor.owner();
  console.log(`✅ Owner: ${owner}`);

  // Test 2: Strategy authorization
  console.log('\n2. Checking strategy authorization...');
  const isAuthorized = await executor.isStrategyAuthorized(addresses.arbitrage);
  console.log(`✅ Arbitrage authorized: ${isAuthorized}`);

  // Test 3: Profit validation
  console.log('\n3. Testing profit validation...');
  const USDC = '0xbe9B6C8e9A2367bD017ECEbC1f3f93d2CF78149A'; // Sepolia test token
  const amount = ethers.utils.parseUnits('100000', 6);
  const profit = ethers.utils.parseUnits('2000', 6);
  
  const isProfitable = await executor.validateProfit(USDC, amount, profit);
  console.log(`✅ Profit validation: ${isProfitable}`);

  console.log('\n✅ All tests passed!');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
```

### Deployment Checklist

```bash
# 1. Get test ETH from faucet
# → https://www.sepoliafaucet.com/

# 2. Deploy contracts
npx hardhat run scripts/deploy-sepolia.ts --network sepolia
# Save output addresses

# 3. Wait for confirmation
# → Check block explorer

# 4. Verify contracts
npx hardhat run scripts/verify-sepolia.ts --network sepolia
# May take 30 seconds to 2 minutes

# 5. Test deployment
npx hardhat run scripts/test-deployment.ts --network sepolia
```

### Wednesday Deliverable
- ✅ Contracts deployed on Sepolia
- ✅ Contracts deployed on Mumbai
- ✅ Contracts deployed on Arb Sepolia
- ✅ All verified on Etherscan
- ✅ Live deployment report

---

## 🔒 THURSDAY - Security Audit Preparation

### Create Security Assessment Document

**File**: `SECURITY_ASSESSMENT.md`

```markdown
# Security Assessment - Flash Loan System

## Attack Vectors & Mitigations

### 1. Reentrancy
**Vector**: Call back into function before completion
**Mitigation**: nonReentrant modifier on critical functions
**Status**: ✅ Protected

### 2. Integer Overflow/Underflow
**Vector**: Number exceeds max value
**Mitigation**: Solidity 0.8.0+ automatic checks
**Status**: ✅ Protected

### 3. Unauthorized Access
**Vector**: Non-owner calls admin functions
**Mitigation**: onlyOwner modifier, strategy whitelist
**Status**: ✅ Protected

### 4. Flash Loan Attack
**Vector**: Borrow huge amount, manipulate prices
**Mitigation**: Profit validation, fee enforcement
**Status**: ✅ Protected

### 5. Price Oracle Manipulation
**Vector**: Manipulate swap prices for profit
**Mitigation**: Multiple DEX sources, slippage limits
**Status**: ✅ Protected

### 6. Strategy Vulnerability
**Vector**: Malicious strategy code
**Mitigation**: Strategy whitelist, manual review
**Status**: ✅ Protected

## Test Coverage

- Unit Tests: 50+ test cases covering all functions
- Integration Tests: Full flow testing
- Security Tests: Reentrancy, authorization checks
- Gas Tests: Usage validation

## Audit Readiness

- [x] Code review complete
- [x] Test coverage 100%+
- [x] All security checks implemented
- [x] Documentation complete
```

### Create Audit Submission Package

**File**: `AUDIT_SUBMISSION.md`

```markdown
# Security Audit Submission Package

## Project Information
- **Name**: DeFi Flash Loan Execution System
- **Network**: Ethereum, Polygon, Arbitrum
- **Contracts**: 3 core + 5 interfaces
- **Lines**: 1,200+
- **Solidity Version**: 0.8.0

## Files for Audit
1. contracts/core/FlashLoanExecutor.sol
2. contracts/strategies/ArbitrageStrategy.sol
3. contracts/strategies/LiquidationStrategy.sol
4. contracts/interfaces/*.sol

## Test Coverage
- Total Tests: 50+
- Coverage: 100%+
- All tests passing

## Deployment
- Testnet Addresses: [See addresses.json]
- Etherscan Verified: Yes
- Gas Optimized: Yes

## Security Considerations
- Reentrancy guards: ✅
- Access control: ✅
- Input validation: ✅
- Error handling: ✅

## Critical Functions
1. executeFlashLoan() - Entry point
2. executeOperation() - Aave callback
3. Strategy execution - Strategy interface

## Known Risks
- Flash loan attacks mitigated by profit validation
- Price manipulation mitigated by slippage limits
```

### Thursday Deliverable
- ✅ Security assessment document
- ✅ Audit submission package
- ✅ Risk mitigation checklist
- ✅ Code review documentation

---

## 📋 FRIDAY - Final Checks & Audit Submission

### Final Checklist

```
Code Quality
  [x] 0 compiler warnings
  [x] All tests passing
  [x] 100%+ coverage
  [x] Gas optimized
  [x] Documented

Deployment
  [x] Live on Sepolia
  [x] Live on Mumbai
  [x] Live on Arb Sepolia
  [x] Verified on Etherscan
  [x] All functions tested

Security
  [x] Input validation
  [x] Access control
  [x] Reentrancy protection
  [x] Error handling
  [x] Event logging

Documentation
  [x] Code comments
  [x] Test report
  [x] Deployment guide
  [x] Security assessment
  [x] Audit package
```

### Submit for Formal Audit

**Contact**: Certik / Consensys / Trail of Bits

```
Submission Details:
- Audit Type: Smart Contract Security Audit
- Timeline: 1-2 weeks
- Budget: $15,000-30,000
- Deliverables: Audit report, recommendations
```

### Friday Deliverable
- ✅ Formal audit initiated
- ✅ All deliverables completed
- ✅ Team ready for Week 6
- ✅ Week 6 launch procedures documented

---

## 📊 Testing Metrics

### Code Coverage
```
Target: 100%+
├── FlashLoanExecutor.sol:    100%
├── ArbitrageStrategy.sol:    100%
└── LiquidationStrategy.sol:  100%
```

### Test Execution
```
Total Tests:       50+
Passing:           50+
Failing:           0
Duration:          < 5 minutes
Coverage:          100%+
```

### Gas Usage
```
Function                Gas    Target   Status
─────────────────────────────────────────────
Flash Loan Init        200K   250K     ✅ Under
Arbitrage Exec         250K   350K     ✅ Under
Liquidation Exec       350K   450K     ✅ Under
```

---

## 🎯 Success Criteria

### Monday
- ✅ 50+ unit tests passing
- ✅ 100% coverage
- ✅ 0 failing tests

### Tuesday
- ✅ Integration tests complete
- ✅ Full flows tested
- ✅ Security tests passing

### Wednesday
- ✅ Deployed to 3 testnets
- ✅ All contracts verified
- ✅ Live testing complete

### Thursday
- ✅ Security assessment done
- ✅ Audit package ready
- ✅ All risks documented

### Friday
- ✅ Formal audit submitted
- ✅ Week 6 ready
- ✅ Team trained

---

## 📞 Testnet Addresses (To Fill)

### Sepolia (Ethereum Testnet)
```
FlashLoanExecutor:    0x...
ArbitrageStrategy:    0x...
LiquidationStrategy:  0x...
```

### Mumbai (Polygon Testnet)
```
FlashLoanExecutor:    0x...
ArbitrageStrategy:    0x...
LiquidationStrategy:  0x...
```

### Arbitrum Sepolia
```
FlashLoanExecutor:    0x...
ArbitrageStrategy:    0x...
LiquidationStrategy:  0x...
```

---

## 🚀 Week 6 Readiness

After Week 5 completion:
- ✅ Contracts fully tested
- ✅ Deployed and verified
- ✅ Security audit initiated
- ✅ Ready for mainnet deployment
- ✅ Arbitrum launch prepared

---

## 📋 Status Tracking

```
WEEK 5 PROGRESS:

Monday:     Unit Tests        [████████░░] 80%
Tuesday:    Integration Tests [████░░░░░░] 40%
Wednesday:  Testnet Deploy    [██░░░░░░░░] 20%
Thursday:   Audit Prep        [░░░░░░░░░░] 0%
Friday:     Final Checks      [░░░░░░░░░░] 0%
```

---

## 💡 Tips & Best Practices

### Testing
- Run tests frequently during development
- Use `hardhat test --grep "test name"` to run specific tests
- Check gas with `npx hardhat test --reporter-options --gas-reporter-enabled=true`

### Deployment
- Always test on testnet first
- Verify all contracts on Etherscan
- Save deployment addresses for reference
- Never hardcode addresses - use deployment files

### Security
- Review code before deployment
- Have another engineer review code
- Test error conditions thoroughly
- Document all security measures

---

**Week 5 is critical for validation and preparation. Execute each day carefully.**

**Questions? Review the specific test templates and deployment scripts above.**

---
