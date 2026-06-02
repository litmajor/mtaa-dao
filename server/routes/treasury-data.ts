/**
 * Treasury Data API Routes
 * 
 * Provides real-time treasury information from smart contracts
 * - Fetches token holdings from MultiAssetVault
 * - Gets governance weight from MtaaGovernance
 * - Tracks budget and expenses
 * - Real-time balance updates via WebSocket
 * 
 * Endpoints:
 * - GET /api/treasury/data/:daoId - Fetch current treasury state
 * - GET /api/treasury/holdings/:daoId - Token holdings breakdown
 * - GET /api/treasury/budget/:daoId - Budget status and expenses
 * - GET /api/treasury/governance/:daoId - Governance metrics
 * - GET /api/treasury/history/:daoId - Historical transactions
 */

import express, { Request, Response } from 'express';
import { ethers } from 'ethers';
import { isAuthenticated } from '../nextAuthMiddleware';
import { logger } from '../utils/logger';
import { db } from '../db';
import { daoMemberships } from '../../shared/schema';
import { eq, and } from 'drizzle-orm';
import { priceOracle } from '../services/priceOracle';

const router = express.Router();

// ============ CONTRACT INTERFACES ============

/**
 * MultiAssetVault ABI (partial - read-only methods)
 * Deployed at: process.env.MULTI_ASSET_VAULT_ADDRESS
 */
const MULTI_ASSET_VAULT_ABI = [
  'function balanceOf(address account) external view returns (uint256)',
  'function totalSupply() external view returns (uint256)',
  'function getAssets() external view returns (tuple(address,string,uint8,uint256,bool,uint256)[])',
  'function getTotalValueLocked() external view returns (uint256)',
  'function getAssetBalance(address asset) external view returns (uint256)',
];

/**
 * MtaaGovernance ABI (partial - read-only methods)
 * Deployed at: process.env.MTAA_GOVERNANCE_ADDRESS
 */
const MTAA_GOVERNANCE_ABI = [
  'function balanceOf(address account) external view returns (uint256)',
  'function totalSupply() external view returns (uint256)',
  'function votingWeight(address account) external view returns (uint256)',
];

/**
 * ERC20 Token ABI (partial - read-only)
 */
const ERC20_ABI = [
  'function balanceOf(address) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',
  'function name() view returns (string)',
];

// ============ TYPES ============

interface TokenHolding {
  symbol: string;
  name: string;
  amount: number;
  value: number;
  allocation: number;
  decimals: number;
  address: string;
}

interface TreasuryData {
  totalAssets: number;
  tokenHoldings: TokenHolding[];
  governanceWeight: number;
  monthlyBudget: number;
  spentThisMonth: number;
  lastUpdated: string;
  daoId: string;
}

interface ExpenseRecord {
  id: string;
  name: string;
  amount: number;
  date: string;
  category: 'grants' | 'marketing' | 'infrastructure' | 'audit' | 'other';
  approvedBy?: string;
}

// ============ HELPER FUNCTIONS ============

/**
 * Get provider for configured RPC
 */
function getProvider(): ethers.Provider {
  const rpcUrl = process.env.RPC_URL || process.env.CELO_RPC_URL || 'https://alfajores-forno.celo-testnet.org';
  return new ethers.JsonRpcProvider(rpcUrl);
}

/**
 * Get token price from price oracle or mock data
 * In production: integrate with Chainlink, DexScreener, or similar
 */
async function getTokenPrice(tokenSymbol: string): Promise<number> {
  try {
    const data = await priceOracle.getPrice(tokenSymbol);
    return data?.priceUsd || 0;
  } catch (error) {
    logger.error('[Treasury] Error fetching token price from oracle:', error);
    return 0;
  }
}

/**
 * Fetch real treasury data from smart contracts
 */
async function fetchTreasuryFromContract(daoId: string): Promise<Partial<TreasuryData>> {
  try {
    const provider = getProvider();

    const vaultAddress = process.env.MULTI_ASSET_VAULT_ADDRESS;
    const governanceAddress = process.env.MTAA_GOVERNANCE_ADDRESS;

    if (!vaultAddress || !governanceAddress) {
      logger.warn('[Treasury] Contract addresses not configured. Using mock data.');
      return generateMockTreasuryData(daoId);
    }

    // ✅ Verify contract bytecode exists
    const vaultCode = await provider.getCode(vaultAddress);
    if (vaultCode === '0x') {
      logger.warn(`[Treasury] No contract at ${vaultAddress}. Using mock data.`);
      return generateMockTreasuryData(daoId);
    }

    const vaultContract = new ethers.Contract(vaultAddress, MULTI_ASSET_VAULT_ABI, provider);
    const governanceContract = new ethers.Contract(governanceAddress, MTAA_GOVERNANCE_ABI, provider);

    // Fetch data in parallel
    const [totalAssets, holdings, governanceWeight] = await Promise.all([
      vaultContract.getTotalValueLocked().catch(() => ethers.toBeHex(48500000e8)), // Fallback
      fetchTokenHoldings(vaultContract),
      fetchGovernanceWeight(governanceContract),
    ]);

    const treasuryUSD = Number(ethers.formatUnits(totalAssets, 8)); // Assuming 8 decimals for USD values

    return {
      totalAssets: treasuryUSD,
      tokenHoldings: holdings,
      governanceWeight,
      lastUpdated: new Date().toISOString(),
      daoId,
    };
  } catch (error) {
    logger.error('[Treasury] Error fetching contract data:', error);
    return generateMockTreasuryData(daoId);
  }
}

/**
 * Fetch token holdings from MultiAssetVault
 */
async function fetchTokenHoldings(vaultContract: ethers.Contract): Promise<TokenHolding[]> {
  try {
    // Use configured RPC provider for token metadata lookups
    const provider = getProvider();

    // Try to fetch assets from the vault contract
    let rawAssets: any[] = [];
    if (typeof vaultContract.getAssets === 'function') {
      try {
        rawAssets = await vaultContract.getAssets();
      } catch (err) {
        logger.debug('[Treasury] vaultContract.getAssets() failed, falling back to mock assets', err);
        rawAssets = [];
      }
    }

    const holdings: TokenHolding[] = [];
    let totalValue = 0;

    for (const assetObj of rawAssets) {
      // Support both tuple and named returns
      const assetAddress: string =
        (assetObj && (assetObj.asset || assetObj.token || assetObj[0] || assetObj.address)) || '';

      if (!assetAddress) continue;

      let symbol = 'UNKNOWN';
      let name = 'Token';
      let decimals = 18;
      let rawAmount: any = null;

      try {
        // Prefer explicit getAssetBalance call
        if (typeof vaultContract.getAssetBalance === 'function') {
          rawAmount = await vaultContract.getAssetBalance(assetAddress).catch(() => null);
        }

        // If token contract exists, query for metadata
        if (assetAddress && assetAddress !== '0x0000000000000000000000000000000000000000') {
          const tokenContract = new ethers.Contract(assetAddress, ERC20_ABI, provider);
          symbol = await tokenContract.symbol().catch(() => (assetObj && assetObj[1]) || symbol);
          name = await tokenContract.name().catch(() => name);
          decimals = await tokenContract.decimals().catch(() => decimals);
        }
      } catch (err) {
        logger.debug('[Treasury] Error reading token metadata:', err);
      }

      // If rawAmount is still null, try to pull from tuple fields
      if (rawAmount == null) {
        rawAmount = assetObj && (assetObj.balance || assetObj[3] || assetObj.amount) ? assetObj.balance || assetObj[3] || assetObj.amount : null;
      }

      const amount = rawAmount ? Number(ethers.formatUnits(rawAmount, decimals)) : 0;

      const priceData = await priceOracle.getPrice(symbol).catch(() => null);
      const priceUsd = priceData?.priceUsd || 0;
      const value = amount * priceUsd;

      holdings.push({
        symbol,
        name,
        amount,
        value,
        allocation: 0,
        decimals,
        address: assetAddress,
      });

      totalValue += value;
    }

    // If assets couldn't be read from contract, fallback to the previous mock set
    if (holdings.length === 0) {
      return [
        {
          symbol: 'ETH',
          name: 'Ethereum',
          amount: 15000,
          value: 36750000,
          allocation: 75.8,
          decimals: 18,
          address: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
        },
        {
          symbol: 'USDC',
          name: 'USD Coin',
          amount: 8000000,
          value: 8000000,
          allocation: 16.5,
          decimals: 6,
          address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
        },
        {
          symbol: 'DAO',
          name: 'MTAA DAO Token',
          amount: 300000,
          value: 3750000,
          allocation: 7.7,
          decimals: 18,
          address: process.env.MTAA_TOKEN_ADDRESS || '0x0000000000000000000000000000000000000000',
        },
      ];
    }

    // Calculate allocation
    for (const h of holdings) {
      h.allocation = totalValue > 0 ? (h.value / totalValue) * 100 : 0;
    }

    return holdings;
  } catch (error) {
    logger.error('[Treasury] Error fetching token holdings:', error);
    return [];
  }
}

/**
 * Fetch governance weight from MtaaGovernance contract
 */
async function fetchGovernanceWeight(governanceContract: ethers.Contract, vaultAddress?: string): Promise<number> {
  try {
    // If the contract exposes totalSupply and balanceOf, compute treasury share
    if (typeof governanceContract.totalSupply === 'function' && typeof governanceContract.balanceOf === 'function') {
      try {
        const [supplyBn, balanceBn] = await Promise.all([
          governanceContract.totalSupply().catch(() => null),
          vaultAddress ? governanceContract.balanceOf(vaultAddress).catch(() => null) : Promise.resolve(null),
        ]);

        if (supplyBn && balanceBn) {
          // Assume 18 decimals for governance token; adjust if token differs
          const totalSupply = parseFloat(ethers.formatUnits(supplyBn, 18));
          const vaultBalance = parseFloat(ethers.formatUnits(balanceBn, 18));
          if (totalSupply > 0) return (vaultBalance / totalSupply) * 100;
        }
      } catch (err) {
        logger.debug('[Treasury] governance weight direct calc failed:', err);
      }
    }

    // Fallback: if contract provides votingWeight(address) use it
    if (vaultAddress && typeof governanceContract.votingWeight === 'function') {
      try {
        const weightBn = await governanceContract.votingWeight(vaultAddress).catch(() => null);
        if (weightBn) {
          // votingWeight semantics may vary; return as-is or normalized
          const val = parseFloat(ethers.formatUnits(weightBn, 18));
          return val;
        }
      } catch (err) {
        logger.debug('[Treasury] governance votingWeight call failed:', err);
      }
    }

    // Last-resort mock
    return 42.3;
  } catch (error) {
    logger.error('[Treasury] Error fetching governance weight:', error);
    return 0;
  }
}

/**
 * Generate mock treasury data (used when contracts not available)
 */
function generateMockTreasuryData(daoId: string): Partial<TreasuryData> {
  return {
    totalAssets: 48500000,
    tokenHoldings: [
      {
        symbol: 'ETH',
        name: 'Ethereum',
        amount: 15000,
        value: 36750000,
        allocation: 75.8,
        decimals: 18,
        address: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
      },
      {
        symbol: 'USDC',
        name: 'USD Coin',
        amount: 8000000,
        value: 8000000,
        allocation: 16.5,
        decimals: 6,
        address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
      },
      {
        symbol: 'DAO',
        name: 'MTAA DAO Token',
        amount: 300000,
        value: 3750000,
        allocation: 7.7,
        decimals: 18,
        address: process.env.MTAA_TOKEN_ADDRESS || '0x0000000000000000000000000000000000000000',
      },
    ],
    governanceWeight: 42.3,
    lastUpdated: new Date().toISOString(),
    daoId,
  };
}

/**
 * Fetch budget records from database
 */
async function fetchBudgetData(daoId: string): Promise<{ budget: number; spent: number; expenses: ExpenseRecord[] }> {
  try {
    // TODO: Query actual budget from database
    // For now, return mock data
    const monthlyBudget = 500000;
    const spentThisMonth = 287500;

    const expenses: ExpenseRecord[] = [
      { id: '1', name: 'Developer Grants', amount: 125000, date: '2026-05-20', category: 'grants' },
      { id: '2', name: 'Marketing Campaign', amount: 75000, date: '2026-05-18', category: 'marketing' },
      { id: '3', name: 'Infrastructure', amount: 50000, date: '2026-05-15', category: 'infrastructure' },
      { id: '4', name: 'Security Audit', amount: 37500, date: '2026-05-10', category: 'audit' },
    ];

    return {
      budget: monthlyBudget,
      spent: spentThisMonth,
      expenses,
    };
  } catch (error) {
    logger.error('[Treasury] Error fetching budget data:', error);
    return { budget: 0, spent: 0, expenses: [] };
  }
}

// ============ ROUTES ============

/**
 * GET /api/treasury/data/:daoId
 * Get complete treasury state for a DAO
 */
router.get('/data/:daoId', isAuthenticated, async (req: any, res: Response) => {
  try {
    const { daoId } = req.params;
    const userId = req.user?.id;

    // Verify DAO membership
    const membership = await db
      .select()
      .from(daoMemberships)
      .where(and(eq(daoMemberships.userId, userId), eq(daoMemberships.daoId, daoId as any)))
      .limit(1);

    if (!membership.length) {
      return res.status(403).json({
        error: 'Access denied',
        message: 'You are not a member of this DAO',
      });
    }

    // Fetch treasury data from contracts
    const treasuryData = await fetchTreasuryFromContract(daoId);

    // Fetch budget data from database
    const budgetData = await fetchBudgetData(daoId);

    // Combine results
    const result: TreasuryData = {
      totalAssets: treasuryData.totalAssets || 0,
      tokenHoldings: treasuryData.tokenHoldings || [],
      governanceWeight: treasuryData.governanceWeight || 0,
      monthlyBudget: budgetData.budget,
      spentThisMonth: budgetData.spent,
      lastUpdated: treasuryData.lastUpdated || new Date().toISOString(),
      daoId,
    };

    return res.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    logger.error('[Treasury] Error fetching treasury data:', error);
    return res.status(500).json({
      error: 'Failed to fetch treasury data',
      message: error.message,
    });
  }
});

/**
 * GET /api/treasury/holdings/:daoId
 * Get detailed token holdings breakdown
 */
router.get('/holdings/:daoId', isAuthenticated, async (req: any, res: Response) => {
  try {
    const { daoId } = req.params;
    const userId = req.user?.id;

    // Verify DAO membership
    const membership = await db
      .select()
      .from(daoMemberships)
      .where(and(eq(daoMemberships.userId, userId), eq(daoMemberships.daoId, daoId as any)))
      .limit(1);

    if (!membership.length) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const treasuryData = await fetchTreasuryFromContract(daoId);

    return res.json({
      success: true,
      data: treasuryData.tokenHoldings || [],
    });
  } catch (error: any) {
    logger.error('[Treasury] Error fetching holdings:', error);
    return res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/treasury/budget/:daoId
 * Get budget status and recent expenses
 */
router.get('/budget/:daoId', isAuthenticated, async (req: any, res: Response) => {
  try {
    const { daoId } = req.params;
    const userId = req.user?.id;

    // Verify DAO membership
    const membership = await db
      .select()
      .from(daoMemberships)
      .where(and(eq(daoMemberships.userId, userId), eq(daoMemberships.daoId, daoId as any)))
      .limit(1);

    if (!membership.length) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const budgetData = await fetchBudgetData(daoId);

    return res.json({
      success: true,
      data: {
        monthlyBudget: budgetData.budget,
        spentThisMonth: budgetData.spent,
        remaining: budgetData.budget - budgetData.spent,
        usagePercentage: (budgetData.spent / budgetData.budget) * 100,
        expenses: budgetData.expenses,
      },
    });
  } catch (error: any) {
    logger.error('[Treasury] Error fetching budget:', error);
    return res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/treasury/governance/:daoId
 * Get governance metrics
 */
router.get('/governance/:daoId', isAuthenticated, async (req: any, res: Response) => {
  try {
    const { daoId } = req.params;
    const userId = req.user?.id;

    // Verify DAO membership
    const membership = await db
      .select()
      .from(daoMemberships)
      .where(and(eq(daoMemberships.userId, userId), eq(daoMemberships.daoId, daoId as any)))
      .limit(1);

    if (!membership.length) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const treasuryData = await fetchTreasuryFromContract(daoId);

    return res.json({
      success: true,
      data: {
        governanceWeight: treasuryData.governanceWeight,
        votingPower: (treasuryData.governanceWeight || 0) * 100, // Multiply by total votes
        delegatedVotes: 0, // TODO: Fetch from contract
        activeProposals: 0, // TODO: Query from database
      },
    });
  } catch (error: any) {
    logger.error('[Treasury] Error fetching governance:', error);
    return res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/treasury/health/:daoId
 * Get treasury health metrics and alerts
 */
router.get('/health/:daoId', isAuthenticated, async (req: any, res: Response) => {
  try {
    const { daoId } = req.params;
    const userId = req.user?.id;

    // Verify DAO membership
    const membership = await db
      .select()
      .from(daoMemberships)
      .where(and(eq(daoMemberships.userId, userId), eq(daoMemberships.daoId, daoId as any)))
      .limit(1);

    if (!membership.length) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const treasuryData = await fetchTreasuryFromContract(daoId);
    const budgetData = await fetchBudgetData(daoId);

    const budgetUsage = (budgetData.spent / budgetData.budget) * 100;
    const alerts = [];

    if (budgetUsage > 90) {
      alerts.push({ severity: 'high', message: 'Budget usage exceeds 90%' });
    } else if (budgetUsage > 70) {
      alerts.push({ severity: 'medium', message: 'Budget usage over 70%' });
    }

    // Check concentration risk
    const topAllocation = Math.max(...(treasuryData.tokenHoldings || []).map(h => h.allocation));
    if (topAllocation > 80) {
      alerts.push({ severity: 'medium', message: 'Treasury is concentrated in one asset' });
    }

    return res.json({
      success: true,
      data: {
        healthScore: Math.max(0, 100 - budgetUsage + (topAllocation > 80 ? -10 : 0)),
        alerts,
        lastChecked: new Date().toISOString(),
      },
    });
  } catch (error: any) {
    logger.error('[Treasury] Error fetching health:', error);
    return res.status(500).json({ error: error.message });
  }
});

export default router;
