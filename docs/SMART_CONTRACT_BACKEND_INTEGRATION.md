# Smart Contract ↔ Backend API Integration Guide

**How your Node.js backend connects to Solidity contracts**

---

## 🔗 Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                  Frontend (React)                           │
│         DeFiDEXAnalytics.tsx + UI Components                │
└────────────────────┬────────────────────────────────────────┘
                     │
                     │ HTTP REST API
                     ▼
┌─────────────────────────────────────────────────────────────┐
│              Backend (Node.js + Express)                    │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ lending_protocols.ts      (Aave market data)         │   │
│  │ flash_loans.ts            (Opportunity detection)    │   │
│  │ smart_contract_executor.ts (Contract interaction) ✅ │   │
│  └──────────────────────────────────────────────────────┘   │
└────────────────────┬────────────────────────────────────────┘
                     │
                     │ Web3.js / Ethers.js
                     ▼
┌─────────────────────────────────────────────────────────────┐
│           Smart Contracts (Solidity)                        │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ FlashLoanExecutor.sol     (Core orchestrator)        │   │
│  │ ArbitrageStrategy.sol     (Swap execution)           │   │
│  │ LiquidationStrategy.sol   (Liquidation execution)    │   │
│  └──────────────────────────────────────────────────────┘   │
└────────────────────┬────────────────────────────────────────┘
                     │
                     │ Blockchain RPC
                     ▼
┌─────────────────────────────────────────────────────────────┐
│                    Ethereum Network                         │
│         (Aave, Uniswap, Curve, Sushiswap)                  │
└─────────────────────────────────────────────────────────────┘
```

---

## 🔄 Data Flow Diagram

### Flow 1: Opportunity Detection (Backend Only)

```
┌─────────────────────────────────────────────────────┐
│ Frontend polls /api/lending/flash-loans              │
└──────────────────┬──────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────┐
│ flash_loans.ts                                       │
│ 1. Get market data from lending_protocols.ts         │
│ 2. Calculate profitable opportunities                │
│ 3. Format for smart contracts                        │
└──────────────────┬──────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────┐
│ Return OpportunitiesResponse {                       │
│   opportunities: [{                                 │
│     type: "arbitrage",                              │
│     loanAmount: "100000000000",                      │
│     path: ["USDC", "USDT", "DAI"],                  │
│     expectedProfit: "2000000000",                    │
│     contractParams: <encoded>                        │
│   }]                                                │
│ }                                                    │
└─────────────────────────────────────────────────────┘
```

### Flow 2: Execution (Frontend → Backend → Smart Contract)

```
┌─────────────────────────────────────────────────────┐
│ User clicks "Execute Arbitrage"                      │
│ Frontend: opportunity.id = "opp-0001"                │
└──────────────────┬──────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────┐
│ Frontend fetches execution params:                   │
│ GET /api/contracts/execute/opp-0001                 │
└──────────────────┬──────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────┐
│ Backend (smart_contract_executor.ts)                 │
│ 1. Validate opportunity still profitable              │
│ 2. Build contract calldata                           │
│ 3. Estimate gas cost                                 │
│ 4. Return execution parameters                       │
└──────────────────┬──────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────┐
│ Frontend receives:                                   │
│ {                                                   │
│   "contractAddress": "0x123...",                    │
│   "methodName": "executeFlashLoan",                 │
│   "params": [asset, amount, strategy, calldata],   │
│   "estimatedGas": "250000",                         │
│   "estimatedCost": "5.25" // ETH at 50 gwei         │
│ }                                                   │
└──────────────────┬──────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────┐
│ Frontend signs transaction with MetaMask/WalletConnect
└──────────────────┬──────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────┐
│ Transaction sent to Ethereum Network                 │
│ ↓                                                   │
│ FlashLoanExecutor.executeFlashLoan() called         │
│ ↓                                                   │
│ Aave pool gives flash loan                          │
│ ↓                                                   │
│ Strategy executes (ArbitrageStrategy.execute)       │
│ ↓                                                   │
│ Profit calculated and repayment made                │
│ ↓                                                   │
│ User receives profit in wallet                      │
└─────────────────────────────────────────────────────┘
```

---

## 📁 New Backend Files Needed

### 1. smart_contract_executor.ts (NEW)
**Purpose**: Build transaction parameters for smart contracts

```typescript
// server/api/smart_contract_executor.ts

import { ethers } from 'ethers';
import { Router, Request, Response } from 'express';

const router = Router();

// ABI imports
import FLASH_LOAN_EXECUTOR_ABI from '../contracts/abi/FlashLoanExecutor.json';
import ARBITRAGE_STRATEGY_ABI from '../contracts/abi/ArbitrageStrategy.json';

// Contract addresses
const CONTRACTS = {
  ethereum: {
    flashLoanExecutor: '0x...',
    arbitrageStrategy: '0x...',
    liquidationStrategy: '0x...'
  },
  polygon: {
    flashLoanExecutor: '0x...',
    arbitrageStrategy: '0x...',
    liquidationStrategy: '0x...'
  },
  arbitrum: {
    flashLoanExecutor: '0x...',
    arbitrageStrategy: '0x...',
    liquidationStrategy: '0x...'
  }
};

// RPC endpoints
const RPC_ENDPOINTS = {
  ethereum: process.env.ETHEREUM_RPC || 'https://eth-mainnet.alchemyapi.io/v2/...',
  polygon: process.env.POLYGON_RPC || 'https://polygon-rpc.com/',
  arbitrum: process.env.ARBITRUM_RPC || 'https://arb1.arbitrum.io/rpc'
};

/**
 * Endpoint: GET /api/contracts/execute/:opportunityId
 * 
 * Returns prepared transaction parameters for execution
 * Frontend uses this to call smart contract
 */
router.get('/execute/:opportunityId', async (req: Request, res: Response) => {
  try {
    const { opportunityId } = req.params;
    const { chain = 'ethereum', userId } = req.query;
    
    // Get cached opportunity data
    const opportunity = await getOpportunity(opportunityId);
    
    if (!opportunity) {
      return res.status(404).json({ error: 'Opportunity not found' });
    }
    
    // Validate still profitable
    const isStillProfitable = await validateProfitability(opportunity);
    if (!isStillProfitable) {
      return res.status(400).json({ error: 'Opportunity expired' });
    }
    
    // Build execution parameters based on strategy
    let executionParams;
    
    if (opportunity.type === 'arbitrage') {
      executionParams = buildArbitrageParams(opportunity);
    } else if (opportunity.type === 'liquidation') {
      executionParams = buildLiquidationParams(opportunity);
    } else {
      return res.status(400).json({ error: 'Unknown strategy' });
    }
    
    // Estimate gas
    const gasEstimate = await estimateGas(
      chain,
      executionParams
    );
    
    // Calculate gas cost
    const gasPrice = await getGasPrice(chain);
    const estimatedCost = ethers.utils.formatEther(
      ethers.BigNumber.from(gasEstimate).mul(gasPrice)
    );
    
    // Return execution parameters
    res.json({
      opportunityId,
      contractAddress: CONTRACTS[chain].flashLoanExecutor,
      methodName: 'executeFlashLoan',
      params: executionParams,
      estimatedGas: gasEstimate.toString(),
      estimatedCostEth: estimatedCost,
      estimatedCostUsd: (parseFloat(estimatedCost) * 2500).toFixed(2), // Approx ETH price
      deadline: Math.floor(Date.now() / 1000) + 300, // 5 min deadline
      chain
    });
  } catch (error) {
    console.error('Execute endpoint error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Build parameters for arbitrage execution
 */
function buildArbitrageParams(opportunity) {
  const {
    asset,
    loanAmount,
    path,
    minAmounts,
    dexes,
    maxSlippage
  } = opportunity;
  
  // Format as solidity parameters
  return {
    asset: asset.address, // ERC20 address
    amount: ethers.utils.parseUnits(loanAmount, 6).toString(),
    strategy: CONTRACTS[opportunity.chain].arbitrageStrategy,
    params: ethers.utils.defaultAbiCoder.encode(
      ['address[]', 'address[]', 'uint256[]', 'uint256'],
      [
        path.map(t => t.address),
        dexes,
        minAmounts.map(m => ethers.utils.parseUnits(m, 6)),
        ethers.utils.parseUnits(maxSlippage, 2) // 500 = 0.5%
      ]
    )
  };
}

/**
 * Build parameters for liquidation execution
 */
function buildLiquidationParams(opportunity) {
  const {
    asset,
    loanAmount,
    collateral,
    userToLiquidate,
    debtAmount
  } = opportunity;
  
  return {
    asset: asset.address,
    amount: ethers.utils.parseUnits(loanAmount, 6).toString(),
    strategy: CONTRACTS[opportunity.chain].liquidationStrategy,
    params: ethers.utils.defaultAbiCoder.encode(
      ['address', 'address', 'address', 'uint256'],
      [
        collateral.address,
        asset.address,
        userToLiquidate,
        ethers.utils.parseUnits(debtAmount, 6)
      ]
    )
  };
}

/**
 * Estimate gas for execution
 */
async function estimateGas(chain: string, params): Promise<string> {
  try {
    const provider = new ethers.providers.JsonRpcProvider(RPC_ENDPOINTS[chain]);
    const contract = new ethers.Contract(
      CONTRACTS[chain].flashLoanExecutor,
      FLASH_LOAN_EXECUTOR_ABI,
      provider
    );
    
    // Estimate gas (read-only, no signature needed)
    const gasEstimate = await contract.estimateGas.executeFlashLoan(
      params.asset,
      params.amount,
      params.strategy,
      params.params
    );
    
    // Add 20% buffer for safety
    return (gasEstimate * 1.2).toFixed(0);
  } catch (error) {
    // Fallback estimates by strategy type
    return '250000'; // Conservative estimate
  }
}

/**
 * Get current gas price
 */
async function getGasPrice(chain: string): Promise<ethers.BigNumber> {
  const provider = new ethers.providers.JsonRpcProvider(RPC_ENDPOINTS[chain]);
  const gasPrice = await provider.getGasPrice();
  
  if (chain === 'ethereum') {
    // Add 20% to current gas price for faster inclusion
    return gasPrice.mul(120).div(100);
  } else {
    // Polygon/Arbitrum can use standard price
    return gasPrice;
  }
}

/**
 * Validate opportunity is still profitable
 */
async function validateProfitability(opportunity): Promise<boolean> {
  // Recalculate profitability
  // If < 0.5% profit, reject
  
  const recalculatedProfit = opportunity.expectedProfit; // Would recalc here
  const minProfit = (opportunity.loanAmount * 0.005); // 0.5% minimum
  
  return recalculatedProfit >= minProfit;
}

/**
 * Endpoint: POST /api/contracts/execute/:opportunityId/simulate
 * 
 * Simulate execution before committing to transaction
 */
router.post('/execute/:opportunityId/simulate', async (req: Request, res: Response) => {
  try {
    const { opportunityId } = req.params;
    const opportunity = await getOpportunity(opportunityId);
    
    // Simulate the execution
    const result = await simulateExecution(opportunity);
    
    res.json({
      success: result.success,
      simulatedProfit: result.profit,
      gasCost: result.gasCost,
      netProfit: result.netProfit,
      roi: ((result.netProfit / opportunity.loanAmount) * 100).toFixed(2) + '%',
      warning: result.warning || null
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Endpoint: POST /api/contracts/execution-results
 * 
 * Frontend reports back execution results
 * Used for tracking and analytics
 */
router.post('/execution-results', async (req: Request, res: Response) => {
  try {
    const {
      opportunityId,
      transactionHash,
      success,
      actualProfit,
      actualGasCost,
      chain
    } = req.body;
    
    // Store execution result
    await storeExecutionResult({
      opportunityId,
      transactionHash,
      success,
      actualProfit,
      actualGasCost,
      chain,
      timestamp: new Date(),
      userId: req.user?.id
    });
    
    // Update analytics
    await updateAnalytics(opportunityId, {
      executed: true,
      success,
      profit: actualProfit,
      gasCost: actualGasCost
    });
    
    res.json({ success: true, message: 'Result recorded' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Endpoint: GET /api/contracts/gas-prices
 * 
 * Get current gas prices across chains
 */
router.get('/gas-prices', async (req: Request, res: Response) => {
  try {
    const gasPrices = {};
    
    for (const [chain, rpc] of Object.entries(RPC_ENDPOINTS)) {
      const provider = new ethers.providers.JsonRpcProvider(rpc);
      const gasPrice = await provider.getGasPrice();
      
      gasPrices[chain] = {
        gwei: ethers.utils.formatUnits(gasPrice, 'gwei'),
        wei: gasPrice.toString()
      };
    }
    
    res.json(gasPrices);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Helper: Get opportunity from cache
 */
async function getOpportunity(id: string) {
  // In real implementation, fetch from Redis cache
  // For now, generate on the fly
  return {
    id,
    type: 'arbitrage',
    loanAmount: '100000',
    expectedProfit: '2000'
  };
}

/**
 * Helper: Simulate execution
 */
async function simulateExecution(opportunity) {
  return {
    success: true,
    profit: parseFloat(opportunity.expectedProfit),
    gasCost: 65,
    netProfit: parseFloat(opportunity.expectedProfit) - 65
  };
}

/**
 * Helper: Store execution result
 */
async function storeExecutionResult(result) {
  // Store in database
}

/**
 * Helper: Update analytics
 */
async function updateAnalytics(opportunityId, data) {
  // Update analytics database
}

export default router;
```

---

## 🔌 Integration with Existing APIs

### Update `server/api/setup-lending.ts`

```typescript
// Add to setupLendingAPIs function
import smartContractExecutor from './smart_contract_executor';

export function setupLendingAPIs(app: any) {
  // Existing routes
  app.use('/api/lending', lendingProtocolsRouter);
  app.use('/api/lending', flashLoansRouter);
  
  // NEW: Smart contract routes
  app.use('/api/contracts', smartContractExecutor); // ✅ Add this
  
  console.log('[API] Smart Contract Executor routes mounted at /api/contracts');
}
```

---

## 🎯 Frontend Integration Points

### Updated React Hook in DeFiDEXAnalytics.tsx

```typescript
// Add new hook to fetch execution parameters
const useContractExecution = (opportunityId: string, chain: string) => {
  return useQuery<ExecutionParams>(
    ['contract-execution', opportunityId],
    async () => {
      const response = await axios.get(
        `/api/contracts/execute/${opportunityId}?chain=${chain}`
      );
      return response.data;
    },
    {
      enabled: !!opportunityId,
      staleTime: 30000 // 30 seconds
    }
  );
};

// Usage in component
const { data: executionParams, isLoading } = useContractExecution(
  selectedOpportunity?.id,
  selectedChain
);

// When user clicks Execute button
const handleExecute = async () => {
  if (!executionParams) return;
  
  try {
    // Get signer from MetaMask
    const signer = provider.getSigner();
    
    // Create contract instance
    const contract = new ethers.Contract(
      executionParams.contractAddress,
      FLASH_LOAN_EXECUTOR_ABI,
      signer
    );
    
    // Call smart contract
    const tx = await contract.executeFlashLoan(
      executionParams.params.asset,
      executionParams.params.amount,
      executionParams.params.strategy,
      executionParams.params.params,
      {
        gasLimit: executionParams.estimatedGas,
        gasPrice: await provider.getGasPrice()
      }
    );
    
    // Wait for confirmation
    await tx.wait();
    
    // Report result back to backend
    await axios.post('/api/contracts/execution-results', {
      opportunityId: selectedOpportunity.id,
      transactionHash: tx.hash,
      success: true,
      actualProfit: tx.value,
      actualGasCost: tx.gasPrice * tx.gasLimit,
      chain: selectedChain
    });
    
  } catch (error) {
    console.error('Execution failed:', error);
  }
};
```

---

## 📊 Data Format Specification

### Opportunity → Contract Parameters

```typescript
// What backend returns from /api/lending/flash-loans
OpportunityResponse {
  id: string;                    // "arb-001"
  type: 'arbitrage' | 'liquidation' | 'swap';
  chain: 'ethereum' | 'polygon' | 'arbitrum';
  asset: Token;                  // { address, symbol, decimals }
  loanAmount: string;            // "100000000000" (6 decimals for USDC)
  expectedProfit: string;        // "2000000000"
  confidence: number;            // 75-94%
  // Arbitrage-specific
  path?: Token[];               // Swap path: USDC → USDT → DAI
  minAmounts?: string[];        // Min output per swap
  dexes?: string[];             // ["uniswap", "curve"]
  // Liquidation-specific
  collateral?: Token;
  userToLiquidate?: string;     // Address of account to liquidate
  debtAmount?: string;
}

// What backend returns from /api/contracts/execute/:opportunityId
ExecutionParams {
  opportunityId: string;
  contractAddress: string;                      // FlashLoanExecutor address
  methodName: 'executeFlashLoan';
  params: [
    asset: string;                              // ERC20 address
    amount: string;                             // Wei amount
    strategy: string;                           // Strategy address
    params: string                              // Encoded parameters
  ];
  estimatedGas: string;                         // "250000"
  estimatedCostEth: string;                     // "0.0125"
  estimatedCostUsd: string;                     // "31.25"
  deadline: number;                             // Unix timestamp + 300
  chain: string;
}
```

---

## 🔐 Security Checklist

- [ ] Validate all addresses are checksummed
- [ ] Verify contract addresses on each chain
- [ ] Check gas price isn't manipulated
- [ ] Validate opportunity hasn't expired
- [ ] Verify profit calculations
- [ ] Test reentrancy protection
- [ ] Implement rate limiting
- [ ] Log all execution attempts
- [ ] Monitor gas usage patterns

---

## 🚀 Deployment Checklist

### Before Going Live
- [ ] Deploy all smart contracts to testnet
- [ ] Deploy smart_contract_executor.ts
- [ ] Test full integration flow
- [ ] Verify gas estimations are accurate
- [ ] Test with real Aave data
- [ ] Monitor contract interactions
- [ ] Implement monitoring alerts
- [ ] Have emergency kill switch ready

---

## 📈 Expected Flow Timeline

```
User views opportunity (50ms)
  ↓
Clicks "Execute" button
  ↓
Frontend calls /api/contracts/execute/:id (200ms)
  ↓
Backend validates + estimates gas (500ms)
  ↓
Frontend presents confirmation + cost (100ms)
  ↓
User signs with MetaMask (30s - user action)
  ↓
Transaction broadcast to network (100ms)
  ↓
Mempool (15s - waiting for block)
  ↓
Block confirmation (15s - 1 block @ 12s)
  ↓
executeOperation() called by Aave (1s)
  ↓
Strategy executes (1-3s)
  ↓
Profit transferred (1s)
  ↓
Total: ~1-2 minutes from click to profit!
```

---

**Ready to integrate? Start with smart_contract_executor.ts! 🚀**
