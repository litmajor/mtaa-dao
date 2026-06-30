/**
 * Flash Loan Opportunities API
 * Detects and calculates profitable flash loan strategies
 * Includes arbitrage, liquidations, collateral swaps, and MEV
 */

import { Router, Request, Response } from 'express';
import { ethers } from 'ethers';
import { createWalletIfValid } from '../utils/cryptoWallet';

const router = Router();

interface FlashLoanOpportunity {
  id: string;
  protocol: string;
  asset: string;
  loanAmount: number;
  feeAmount: number;
  feePercentage: number;
  profitPotential: number;
  riskLevel: 'low' | 'medium' | 'high';
  executionStrategy: 'arbitrage' | 'liquidation' | 'swap' | 'mev';
  estimatedGasUsage: number;
  estimatedGasCost: number;
  netProfit: number;
  roi: number;
  confidence: number;
  description: string;
  timestamp: number;
}

interface FlashLoanSummary {
  activeOpportunities: number;
  bestOpportunity: FlashLoanOpportunity | null;
  averageProfitPotential: number;
  averageNetProfit: number;
  totalDailyOpportunities: number;
  lastScanTime: number;
}

/**
 * Mock Flash Loan Opportunities
 * In production, these would be calculated from real market data
 * Updated with fact-checked values as of January 2026:
 * - Flash loan fee: 0.05% based on Aave docs
 * - Arbitrage profits: Typically 0.5-1% based on recent reports
 * - Liquidation bonus: 4.5-8.5% average ~7% for most assets
 * - MEV/Swap: Adjusted to 0.5-2%
 * - Gas costs: Updated to current low levels (Ethereum ~0.16 USD for 200k gas, Polygon ~0.04 USD, Arbitrum ~0.01 USD)
 */
const generateMockOpportunities = (chain: string, loanAmount: number = 100000): FlashLoanOpportunity[] => {
  const baseOpportunities: FlashLoanOpportunity[] = [
    {
      id: 'fl-arb-001',
      protocol: 'aave-v3',
      asset: 'USDC',
      loanAmount: loanAmount,
      feeAmount: loanAmount * 0.0005, // 0.05%
      feePercentage: 0.05,
      profitPotential: loanAmount * 0.007, // 0.7% arbitrage (updated average)
      riskLevel: 'low',
      executionStrategy: 'arbitrage',
      estimatedGasUsage: 200000,
      estimatedGasCost: chain === 'ethereum' ? 0.16 : chain === 'polygon' ? 0.04 : 0.01,
      netProfit: 0, // Calculated below
      roi: 0, // Calculated below
      confidence: 92,
      description: 'Triangular arbitrage: USDC → USDT → DAI → USDC (Uniswap → Sushiswap → Curve)',
      timestamp: Date.now(),
    },
    {
      id: 'fl-liq-001',
      protocol: 'aave-v3',
      asset: 'ETH',
      loanAmount: loanAmount * 0.01, // 1% of USDC in ETH equivalent
      feeAmount: loanAmount * 0.01 * 0.0005,
      feePercentage: 0.05,
      profitPotential: loanAmount * 0.07, // 7% liquidation bonus (updated average)
      riskLevel: 'medium',
      executionStrategy: 'liquidation',
      estimatedGasUsage: 350000,
      estimatedGasCost: chain === 'ethereum' ? 0.29 : chain === 'polygon' ? 0.07 : 0.02,
      netProfit: 0,
      roi: 0,
      confidence: 85,
      description: 'Liquidate underwater ETH position on Aave, collect ~7% liquidation bonus',
      timestamp: Date.now(),
    },
    {
      id: 'fl-swap-001',
      protocol: 'aave-v3',
      asset: 'USDC',
      loanAmount: loanAmount * 0.5,
      feeAmount: loanAmount * 0.5 * 0.0005,
      feePercentage: 0.05,
      profitPotential: loanAmount * 0.005, // 0.5% from better routing
      riskLevel: 'low',
      executionStrategy: 'swap',
      estimatedGasUsage: 250000,
      estimatedGasCost: chain === 'ethereum' ? 0.21 : chain === 'polygon' ? 0.05 : 0.01,
      netProfit: 0,
      roi: 0,
      confidence: 90,
      description: 'Multi-hop swap optimization: Find best route through multiple DEXes',
      timestamp: Date.now(),
    },
    {
      id: 'fl-mev-001',
      protocol: 'aave-v3',
      asset: 'USDC',
      loanAmount: loanAmount,
      feeAmount: loanAmount * 0.0005,
      feePercentage: 0.05,
      profitPotential: loanAmount * 0.015, // 1.5% MEV extraction (adjusted)
      riskLevel: 'high',
      executionStrategy: 'mev',
      estimatedGasUsage: 300000,
      estimatedGasCost: chain === 'ethereum' ? 0.25 : chain === 'polygon' ? 0.06 : 0.02,
      netProfit: 0,
      roi: 0,
      confidence: 78,
      description: 'Advanced MEV: Front-run pending transactions for profit',
      timestamp: Date.now(),
    },
    {
      id: 'fl-arb-002',
      protocol: 'aave-v3',
      asset: 'DAI',
      loanAmount: loanAmount * 1.5,
      feeAmount: loanAmount * 1.5 * 0.0005,
      feePercentage: 0.05,
      profitPotential: loanAmount * 0.008, // 0.8% arbitrage
      riskLevel: 'low',
      executionStrategy: 'arbitrage',
      estimatedGasUsage: 210000,
      estimatedGasCost: chain === 'ethereum' ? 0.17 : chain === 'polygon' ? 0.04 : 0.01,
      netProfit: 0,
      roi: 0,
      confidence: 88,
      description: 'Stablecoin arbitrage: DAI ↔ USDC ↔ USDT cycles on Curve',
      timestamp: Date.now(),
    },
    {
      id: 'fl-arb-003',
      protocol: 'aave-v3',
      asset: 'USDT',
      loanAmount: loanAmount * 1.2,
      feeAmount: loanAmount * 1.2 * 0.0005,
      feePercentage: 0.05,
      profitPotential: loanAmount * 0.006, // 0.6% arbitrage
      riskLevel: 'low',
      executionStrategy: 'arbitrage',
      estimatedGasUsage: 195000,
      estimatedGasCost: chain === 'ethereum' ? 0.16 : chain === 'polygon' ? 0.04 : 0.01,
      netProfit: 0,
      roi: 0,
      confidence: 91,
      description: 'Cross-chain arbitrage: USDT on Polygon vs Arbitrum',
      timestamp: Date.now(),
    },
  ];

  // Calculate net profit and ROI for each
  return baseOpportunities.map(opp => ({
    ...opp,
    netProfit: opp.profitPotential - opp.feeAmount - opp.estimatedGasCost,
    roi: ((opp.profitPotential - opp.feeAmount - opp.estimatedGasCost) / opp.loanAmount) * 100,
  }));
};

/**
 * GET /api/lending/flash-loans
 * Get available flash loan opportunities
 */
router.get('/flash-loans', (req: Request, res: Response) => {
  try {
    const { chain = 'ethereum', minProfit = '500', loanAmount = '100000' } = req.query;

    const minProfitNum = Number(minProfit);
    const loanAmountNum = Number(loanAmount);

    // Generate opportunities
    let opportunities = generateMockOpportunities(String(chain), loanAmountNum);

    // Filter by minimum profit
    opportunities = opportunities.filter(opp => opp.netProfit >= minProfitNum);

    // Sort by ROI (highest first)
    opportunities.sort((a, b) => b.roi - a.roi);

    res.json(opportunities);
  } catch (error) {
    console.error('Error fetching flash loan opportunities:', error);
    res.status(500).json({ error: 'Failed to fetch flash loan opportunities' });
  }
});

/**
 * GET /api/lending/flash-loans/summary
 * Get summary of flash loan market
 */
router.get('/flash-loans/summary', (req: Request, res: Response) => {
  try {
    const { chain = 'ethereum' } = req.query;

    const opportunities = generateMockOpportunities(String(chain));

    const bestOpportunity = opportunities.reduce((best, opp) => 
      opp.netProfit > best.netProfit ? opp : best
    , opportunities[0]);

    const averageProfitPotential =
      opportunities.reduce((sum, opp) => sum + opp.profitPotential, 0) /
      opportunities.length;

    const averageNetProfit =
      opportunities.reduce((sum, opp) => sum + opp.netProfit, 0) /
      opportunities.length;

    const summary: FlashLoanSummary = {
      activeOpportunities: opportunities.length,
      bestOpportunity,
      averageProfitPotential,
      averageNetProfit,
      totalDailyOpportunities: opportunities.length * 4, // Rough estimate
      lastScanTime: Date.now(),
    };

    res.json(summary);
  } catch (error) {
    console.error('Error fetching flash loan summary:', error);
    res.status(500).json({ error: 'Failed to fetch summary' });
  }
});

/**
 * POST /api/lending/flash-loans/simulate
 * Simulate a flash loan execution
 */
router.post('/flash-loans/simulate', (req: Request, res: Response) => {
  try {
    const {
      protocol = 'aave-v3',
      asset = 'USDC',
      loanAmount = 100000,
      strategy = 'arbitrage',
      chain = 'ethereum',
    } = req.body;

    // Get profit potential based on strategy (updated multipliers)
    let profitMultiplier = 0.007; // 0.7% for arbitrage
    let gasMultiplier = 1;
    let riskLevel: 'low' | 'medium' | 'high' = 'low';

    switch (strategy) {
      case 'liquidation':
        profitMultiplier = 0.07; // 7% liquidation bonus
        gasMultiplier = 1.75;
        riskLevel = 'medium';
        break;
      case 'swap':
        profitMultiplier = 0.005; // 0.5%
        gasMultiplier = 1.25;
        riskLevel = 'low';
        break;
      case 'mev':
        profitMultiplier = 0.015; // 1.5%
        gasMultiplier = 1.5;
        riskLevel = 'high';
        break;
    }

    // Calculate costs and profits
    const fee = loanAmount * 0.0005; // 0.05% Aave fee
    const baseGasUsage = strategy === 'liquidation' ? 350000 : 200000;
    const gasUsage = baseGasUsage * gasMultiplier;
    
    // Updated gas cost per unit in USD based on current prices
    const gasCostPerUnit = chain === 'ethereum' ? 8.22e-7 : chain === 'polygon' ? 1.79e-7 : 6.68e-7; // Approx for Arbitrum similar to ETH but lower
    const gasCost = gasUsage * gasCostPerUnit;

    const profitPotential = loanAmount * profitMultiplier;
    const netProfit = profitPotential - fee - gasCost;
    const roi = (netProfit / loanAmount) * 100;

    // Calculate break-even
    const breakEvenAmount = (fee + gasCost) / profitMultiplier;

    res.json({
      simulation: {
        protocol,
        asset,
        chain,
        strategy,
        loanAmount,
        fee,
        gasCost,
        profitPotential,
        netProfit,
        roi,
        riskLevel,
        breakEvenAmount,
        confidence: 85,
        estimatedExecutionTime: '15-30 seconds',
        gasUsage,
        timestamp: Date.now(),
      },
    });
  } catch (error) {
    console.error('Error simulating flash loan:', error);
    res.status(500).json({ error: 'Failed to simulate flash loan' });
  }
});

/**
 * GET /api/lending/flash-loans/estimate/:strategy
 * Get estimated profit for a specific strategy
 */
router.get('/flash-loans/estimate/:strategy', (req: Request, res: Response) => {
  try {
    const { strategy } = req.params;
    const { loanAmount = '100000', chain = 'ethereum' } = req.query;

    const loanAmountNum = Number(loanAmount);

    // Estimate based on strategy (updated)
    const strategies: Record<string, any> = {
      arbitrage: {
        name: 'Triangular Arbitrage',
        profitPercentage: 0.7,
        gasUsage: 200000,
        riskLevel: 'low',
        description: 'Find triangular cycles and execute swaps',
        expectedROI: 0.6,
      },
      liquidation: {
        name: 'Liquidation Execution',
        profitPercentage: 7.0,
        gasUsage: 350000,
        riskLevel: 'medium',
        description: 'Liquidate underwater positions for bonus',
        expectedROI: 6.5,
      },
      swap: {
        name: 'Optimized Swap Routing',
        profitPercentage: 0.5,
        gasUsage: 250000,
        riskLevel: 'low',
        description: 'Route through multiple pools for better rate',
        expectedROI: 0.4,
      },
      mev: {
        name: 'MEV Extraction',
        profitPercentage: 1.5,
        gasUsage: 300000,
        riskLevel: 'high',
        description: 'Extract value from pending transactions',
        expectedROI: 1.2,
      },
    };

    const strategyData = strategies[strategy];
    if (!strategyData) {
      return res.status(404).json({ error: 'Strategy not found' });
    }

    const fee = loanAmountNum * 0.0005;
    // Updated gas cost per unit
    const gasCostPerUnit = chain === 'ethereum' ? 8.22e-7 : 1.79e-7;
    const gasCost = strategyData.gasUsage * gasCostPerUnit;
    const profit = loanAmountNum * (strategyData.profitPercentage / 100);
    const netProfit = profit - fee - gasCost;

    res.json({
      strategy: strategyData.name,
      loanAmount: loanAmountNum,
      chain,
      fee,
      gasCost,
      profit,
      netProfit,
      expectedROI: strategyData.expectedROI,
      riskLevel: strategyData.riskLevel,
      description: strategyData.description,
      gasUsage: strategyData.gasUsage,
      timestamp: Date.now(),
    });
  } catch (error) {
    console.error('Error estimating profit:', error);
    res.status(500).json({ error: 'Failed to estimate profit' });
  }
});

/**
 * POST /api/lending/flash-loans/execute
 * Execute a flash loan on-chain via the FlashLoanExecutor contract.
 * Required env vars: RPC_URL, FLASH_EXECUTOR_ADDRESS, FLASH_EXECUTOR_PRIVATE_KEY
 * Body params: { asset, loanAmount, strategy, strategyParams?, tokenDecimals? }
 */
router.post('/flash-loans/execute', async (req: Request, res: Response) => {
  try {
    const { asset, loanAmount, strategy, strategyParams = '0x', tokenDecimals } = req.body || {};

    if (!asset || !loanAmount || !strategy) {
      return res.status(400).json({ error: 'Missing required parameters: asset, loanAmount, strategy' });
    }

    const RPC_URL = process.env.RPC_URL;
    const PRIVATE_KEY = process.env.FLASH_EXECUTOR_PRIVATE_KEY || process.env.PRIVATE_KEY;
    const FLASH_EXECUTOR_ADDRESS = process.env.FLASH_EXECUTOR_ADDRESS;

    if (!RPC_URL || !PRIVATE_KEY || !FLASH_EXECUTOR_ADDRESS) {
      console.error('Missing on-chain configuration for flash loan execution');
      return res.status(500).json({ error: 'Server not configured to execute on-chain flash loans' });
    }

    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const signer = createWalletIfValid(PRIVATE_KEY, provider);
    if (!signer) {
      console.error('Invalid FLASH_EXECUTOR_PRIVATE_KEY or PRIVATE_KEY; cannot execute on-chain flash loans');
      return res.status(500).json({ error: 'Server not configured to execute on-chain flash loans' });
    }

    // Minimal ABI for executor
    const executorAbi = [
      'function executeFlashLoan(address asset,uint256 amount,address strategy,bytes params) external returns (bytes32)'
    ];

    // Minimal ERC20 ABI to read decimals
    const erc20Abi = ['function decimals() view returns (uint8)'];

    const executor = new ethers.Contract(FLASH_EXECUTOR_ADDRESS, executorAbi, signer);

    // Determine token decimals (best-effort)
    let decimals = 18;
    if (tokenDecimals) {
      decimals = Number(tokenDecimals);
    } else {
      try {
        const token = new ethers.Contract(asset, erc20Abi, provider);
        const d: any = await token.decimals();
        decimals = Number(d ?? 18);
      } catch (err) {
        // ignore - fall back to 18
      }
    }

    // Convert human amount to token units
    const amount = ethers.parseUnits(String(loanAmount), decimals);

    // Validate and prepare `strategyParams`.
    let paramsBytes = '0x';

    // If the client provided a JSON shape for params with types/values, encode server-side
    if (strategyParams && typeof strategyParams === 'object' && Array.isArray(strategyParams.paramTypes) && Array.isArray(strategyParams.paramValues)) {
      try {
        paramsBytes = new ethers.AbiCoder().encode(strategyParams.paramTypes, strategyParams.paramValues);
      } catch (err: any) {
        console.error('Failed to ABI-encode strategyParams object', err);
        return res.status(400).json({ error: 'Invalid strategyParams paramTypes/paramValues for ABI encoding' });
      }
    } else if (typeof strategyParams === 'string') {
      // Accept '0x' or hex string. Validate format and size.
      const hex = strategyParams;
      if (hex === '0x' || hex === '') {
        paramsBytes = '0x';
      } else {
        const isHex = /^0x[0-9a-fA-F]*$/.test(hex);
        if (!isHex) return res.status(400).json({ error: 'strategyParams must be a hex string starting with 0x or an object with paramTypes/paramValues' });
        const byteLen = (hex.length - 2) / 2;
        const MAX_BYTES = 4096; // limit to 4KB of params
        if (!Number.isInteger(byteLen) || byteLen < 0 || byteLen > MAX_BYTES) {
          return res.status(400).json({ error: `strategyParams hex length invalid or exceeds ${MAX_BYTES} bytes` });
        }
        paramsBytes = hex;
      }
    } else {
      paramsBytes = '0x';
    }

    // Basic validation for addresses and amount
    if (!ethers.isAddress(asset)) return res.status(400).json({ error: 'Invalid asset address' });
    if (!ethers.isAddress(strategy)) return res.status(400).json({ error: 'Invalid strategy address' });
    const loanNum = Number(loanAmount);
    if (!isFinite(loanNum) || loanNum <= 0) return res.status(400).json({ error: 'Invalid loanAmount' });

    console.log('Submitting executeFlashLoan tx', { FLASH_EXECUTOR_ADDRESS, asset, amount: amount.toString(), strategy, paramsBytesLength: (paramsBytes || '').length });

    const tx = await executor.executeFlashLoan(asset, amount, strategy, paramsBytes, { gasLimit: 1_500_000 });
    const receipt = await tx.wait();

    res.json({ txHash: tx.hash, receipt });
  } catch (error: any) {
    console.error('Error executing flash loan:', error);
    res.status(500).json({ error: String(error?.message ?? error) });
  }
});

export default router;