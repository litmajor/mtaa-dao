import { Router } from 'express';
import { db } from '../db';
import { logger } from '../utils/logger';
import {
  investmentPools,
  poolAssets,
  poolInvestments,
  poolWithdrawals,
  poolPerformance,
  poolRebalances,
  portfolioTemplates,
  templateAssetAllocations,
  rebalancingSettings,
} from '../../shared/schema';
import { eq, desc, sql, and } from 'drizzle-orm';
import { priceOracle } from '../services/priceOracle';
import { performanceTrackingService } from '../services/performanceTrackingService';
import { rebalancingService } from '../services/rebalancingService';
import { triggerManualRebalance, triggerManualSnapshot } from '../jobs/investmentPoolsAutomation';
import { investmentPoolPricingService } from '../services/investmentPoolPricingService';

const router = Router();

// =====================================================
// INVESTMENT POOL MANAGEMENT
// =====================================================

// GET /api/investment-pools - List all investment pools
router.get('/', async (req, res) => {
  try {
    const pools = await db
      .select({
        id: investmentPools.id,
        daoId: investmentPools.daoId,
        name: investmentPools.name,
        symbol: investmentPools.symbol,
        description: investmentPools.description,
        totalValueLocked: investmentPools.totalValueLocked,
        shareTokenSupply: investmentPools.shareTokenSupply,
        sharePrice: investmentPools.sharePrice,
        performanceFee: investmentPools.performanceFee,
        minimumInvestment: investmentPools.minimumInvestment,
        isActive: investmentPools.isActive,
        createdAt: investmentPools.createdAt,
      })
      .from(investmentPools)
      .where(eq(investmentPools.isActive, true))
      .orderBy(desc(investmentPools.createdAt));

    res.json({ pools });
  } catch (error) {
    logger.error('Error fetching investment pools:', error);
    res.status(500).json({ error: 'Failed to fetch investment pools' });
  }
});

// GET /api/investment-pools/:id - Get pool details with assets
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Get pool info
    const [pool] = await db
      .select()
      .from(investmentPools)
      .where(eq(investmentPools.id, id));

    if (!pool) {
      return res.status(404).json({ error: 'Pool not found' });
    }

    // Get pool assets
    const assets = await db
      .select()
      .from(poolAssets)
      .where(eq(poolAssets.poolId, id));

    // Get latest prices for all assets
    const assetSymbols = assets.map(a => a.assetSymbol);
    const prices = await priceOracle.getPrices(assetSymbols);

    // Update asset prices and values
    const assetsWithPrices = assets.map(asset => {
      const priceData = prices.get(asset.assetSymbol);
      return {
        ...asset,
        currentPriceUsd: priceData?.priceUsd || 0,
        priceChange24h: priceData?.priceChange24h || 0,
        marketCap: priceData?.marketCap || 0,
      };
    });

    // Calculate total investor count
    const investorCount = await db
      .select({ count: sql<number>`count(DISTINCT ${poolInvestments.userId})` })
      .from(poolInvestments)
      .where(eq(poolInvestments.poolId, id));

    res.json({
      pool,
      assets: assetsWithPrices,
      investorCount: investorCount[0].count,
    });
  } catch (error) {
    logger.error('Error fetching pool details:', error);
    res.status(500).json({ error: 'Failed to fetch pool details' });
  }
});

// GET /api/investment-pools/:id/performance - Get pool performance history
router.get('/:id/performance', async (req, res) => {
  try {
    const { id } = req.params;
    const { days = '30' } = req.query;

    const daysInt = parseInt(days as string);
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysInt);

    const performance = await db
      .select()
      .from(poolPerformance)
      .where(
        and(
          eq(poolPerformance.poolId, id),
          sql`${poolPerformance.snapshotAt} >= ${startDate}`
        )
      )
      .orderBy(poolPerformance.snapshotAt);

    res.json({ performance });
  } catch (error) {
    logger.error('Error fetching pool performance:', error);
    res.status(500).json({ error: 'Failed to fetch performance data' });
  }
});

// POST /api/investment-pools/:id/invest - Invest in a pool
router.post('/:id/invest', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = (req.user as any)?.id;
    const { amountUsd, paymentToken = 'cUSD' } = req.body;

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (!amountUsd || amountUsd <= 0) {
      return res.status(400).json({ error: 'Invalid investment amount' });
    }

    // Get pool
    const [pool] = await db
      .select()
      .from(investmentPools)
      .where(eq(investmentPools.id, id));

    if (!pool) {
      return res.status(404).json({ error: 'Pool not found' });
    }

    if (!pool.isActive) {
      return res.status(400).json({ error: 'Pool is not active' });
    }

    if (amountUsd < Number(pool.minimumInvestment)) {
      return res.status(400).json({
        error: `Minimum investment is $${pool.minimumInvestment}`,
      });
    }

    // Calculate shares to mint
    let sharesMinted: number;
    const currentSupply = Number(pool.shareTokenSupply);
    const currentTVL = Number(pool.totalValueLocked);

    if (currentSupply === 0) {
      // First investment: 1:1 ratio
      sharesMinted = amountUsd;
    } else {
      // Subsequent investments: proportional to TVL
      sharesMinted = (amountUsd * currentSupply) / currentTVL;
    }

    const sharePriceAtInvestment = Number(pool.sharePrice);

    // Calculate fees based on DAO tier
    const feeCalculation = await investmentPoolPricingService.calculateInvestmentFees(id, amountUsd);

    // Record investment
    const [investment] = await db
      .insert(poolInvestments)
      .values({
        poolId: id,
        userId,
        investmentAmountUsd: amountUsd.toString(),
        sharesMinted: sharesMinted.toString(),
        sharePriceAtInvestment: sharePriceAtInvestment.toString(),
        paymentToken,
        status: 'completed',
      })
      .returning();

    // Record revenue
    await investmentPoolPricingService.recordPoolRevenue(id, 'investment', {
      platformFee: feeCalculation.platformFee,
      tier: feeCalculation.tier,
    });

    // Update pool TVL and supply
    const newTVL = currentTVL + amountUsd;
    const newSupply = currentSupply + sharesMinted;
    const newSharePrice = newSupply > 0 ? newTVL / newSupply : 1.0;

    await db
      .update(investmentPools)
      .set({
        totalValueLocked: newTVL.toString(),
        shareTokenSupply: newSupply.toString(),
        sharePrice: newSharePrice.toString(),
      })
      .where(eq(investmentPools.id, id));

    logger.info(`Investment completed: User ${userId} invested $${amountUsd} in pool ${id}`);

    res.json({
      investment,
      sharesMinted,
      newSharePrice,
      totalShares: newSupply,
    });
  } catch (error) {
    logger.error('Error processing investment:', error);
    res.status(500).json({ error: 'Failed to process investment' });
  }
});

// POST /api/investment-pools/:id/withdraw - Withdraw from a pool
router.post('/:id/withdraw', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = (req.user as any)?.id;
    const { shares } = req.body;

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (!shares || shares <= 0) {
      return res.status(400).json({ error: 'Invalid share amount' });
    }

    // Get pool
    const [pool] = await db
      .select()
      .from(investmentPools)
      .where(eq(investmentPools.id, id));

    if (!pool) {
      return res.status(404).json({ error: 'Pool not found' });
    }

    // Calculate user's total shares
    const userInvestments = await db
      .select({ shares: poolInvestments.sharesMinted })
      .from(poolInvestments)
      .where(
        and(
          eq(poolInvestments.poolId, id),
          eq(poolInvestments.userId, userId),
          eq(poolInvestments.status, 'completed')
        )
      );

    const userWithdrawals = await db
      .select({ shares: poolWithdrawals.sharesBurned })
      .from(poolWithdrawals)
      .where(
        and(
          eq(poolWithdrawals.poolId, id),
          eq(poolWithdrawals.userId, userId),
          eq(poolWithdrawals.status, 'completed')
        )
      );

    const totalInvested = userInvestments.reduce(
      (sum, inv) => sum + Number(inv.shares),
      0
    );
    const totalWithdrawn = userWithdrawals.reduce(
      (sum, wd) => sum + Number(wd.shares),
      0
    );
    const availableShares = totalInvested - totalWithdrawn;

    if (shares > availableShares) {
      return res.status(400).json({
        error: `Insufficient shares. Available: ${availableShares}`,
      });
    }

    // Calculate withdrawal value
    const currentTVL = Number(pool.totalValueLocked);
    const currentSupply = Number(pool.shareTokenSupply);
    const sharePriceAtWithdrawal = Number(pool.sharePrice);
    const withdrawalValue = shares * sharePriceAtWithdrawal;

    // Get user's initial investment for profit calculation
    const totalInvested = userInvestments.reduce(
      (sum, inv) => sum + Number(inv.investmentAmountUsd),
      0
    );
    const userSharesInvested = userInvestments.reduce(
      (sum, inv) => sum + Number(inv.sharesMinted),
      0
    );
    const avgCostBasis = userSharesInvested > 0 ? totalInvested / userSharesInvested : 0;
    const initialInvestment = shares * avgCostBasis;

    // Calculate tiered fees
    const feeCalculation = await investmentPoolPricingService.calculateWithdrawalFees(
      id,
      withdrawalValue,
      initialInvestment
    );

    const netAmount = feeCalculation.netAmount;

    // Record withdrawal
    const [withdrawal] = await db
      .insert(poolWithdrawals)
      .values({
        poolId: id,
        userId,
        sharesBurned: shares.toString(),
        withdrawalValueUsd: withdrawalValue.toString(),
        sharePriceAtWithdrawal: sharePriceAtWithdrawal.toString(),
        feeCharged: feeCalculation.totalFees.toString(),
        netAmount: netAmount.toString(),
        status: 'completed',
      })
      .returning();

    // Record revenue
    await investmentPoolPricingService.recordPoolRevenue(id, 'withdrawal', {
      platformFee: feeCalculation.platformFee,
      performanceFee: feeCalculation.performanceFee,
      tier: feeCalculation.tier,
    });

    // Update pool TVL and supply
    const newTVL = currentTVL - withdrawalValue;
    const newSupply = currentSupply - shares;
    const newSharePrice = newSupply > 0 ? newTVL / newSupply : 1.0;

    await db
      .update(investmentPools)
      .set({
        totalValueLocked: newTVL.toString(),
        shareTokenSupply: newSupply.toString(),
        sharePrice: newSharePrice.toString(),
      })
      .where(eq(investmentPools.id, id));

    logger.info(`Withdrawal completed: User ${userId} withdrew ${shares} shares from pool ${id}`);

    res.json({
      withdrawal,
      netAmount,
      feeCharged,
      remainingShares: availableShares - shares,
    });
  } catch (error) {
    logger.error('Error processing withdrawal:', error);
    res.status(500).json({ error: 'Failed to process withdrawal' });
  }
});

// GET /api/investment-pools/:id/my-investment - Get user's investment in a pool
router.get('/:id/my-investment', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = (req.user as any)?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Get all user investments
    const investments = await db
      .select()
      .from(poolInvestments)
      .where(
        and(
          eq(poolInvestments.poolId, id),
          eq(poolInvestments.userId, userId)
        )
      )
      .orderBy(desc(poolInvestments.investedAt));

    // Get all user withdrawals
    const withdrawals = await db
      .select()
      .from(poolWithdrawals)
      .where(
        and(
          eq(poolWithdrawals.poolId, id),
          eq(poolWithdrawals.userId, userId)
        )
      )
      .orderBy(desc(poolWithdrawals.withdrawnAt));

    // Calculate totals
    const totalInvested = investments.reduce(
      (sum, inv) => sum + Number(inv.investmentAmountUsd),
      0
    );
    const totalShares = investments.reduce(
      (sum, inv) => sum + Number(inv.sharesMinted),
      0
    );
    const sharesWithdrawn = withdrawals.reduce(
      (sum, wd) => sum + Number(wd.sharesBurned),
      0
    );
    const currentShares = totalShares - sharesWithdrawn;

    // Get pool to calculate current value
    const [pool] = await db
      .select()
      .from(investmentPools)
      .where(eq(investmentPools.id, id));

    const currentValue = pool ? currentShares * Number(pool.sharePrice) : 0;
    const totalReturn = currentValue - totalInvested;
    const returnPercentage = totalInvested > 0 ? (totalReturn / totalInvested) * 100 : 0;

    res.json({
      investments,
      withdrawals,
      summary: {
        totalInvested,
        currentShares,
        currentValue,
        totalReturn,
        returnPercentage,
      },
    });
  } catch (error) {
    logger.error('Error fetching user investment:', error);
    res.status(500).json({ error: 'Failed to fetch investment data' });
  }
});

// GET /api/investment-pools/prices - Get current prices for all supported assets
router.get('/prices/current', async (req, res) => {
  try {
    const { symbols = 'BTC,ETH,SOL,BNB,XRP,LTC' } = req.query;
    const symbolArray = (symbols as string).split(',').map(s => s.trim());

    const prices = await priceOracle.getPrices(symbolArray);

    const priceData: Record<string, any> = {};
    prices.forEach((data, symbol) => {
      priceData[symbol] = data;
    });

    res.json({ prices: priceData });
  } catch (error) {
    logger.error('Error fetching prices:', error);
    res.status(500).json({ error: 'Failed to fetch prices' });
  }
});

// =====================================================
// PHASE 2: TEMPLATES & ANALYTICS
// =====================================================

// GET /api/investment-pools/templates - Get all portfolio templates
router.get('/templates', async (req, res) => {
  try {
    const templates = await db
      .select()
      .from(portfolioTemplates)
      .where(eq(portfolioTemplates.isActive, true));

    // Get allocations for each template
    const templatesWithAllocations = await Promise.all(
      templates.map(async (template) => {
        const allocations = await db
          .select()
          .from(templateAssetAllocations)
          .where(eq(templateAssetAllocations.templateId, template.id));

        return {
          ...template,
          allocations,
        };
      })
    );

    res.json({ templates: templatesWithAllocations });
  } catch (error) {
    logger.error('Error fetching templates:', error);
    res.status(500).json({ error: 'Failed to fetch templates' });
  }
});

// GET /api/investment-pools/:id/analytics - Get comprehensive analytics for a pool
router.get('/:id/analytics', async (req, res) => {
  try {
    const { id } = req.params;

    const analytics = await performanceTrackingService.getPoolAnalytics(id);

    if (!analytics) {
      return res.status(404).json({ error: 'Pool not found' });
    }

    res.json(analytics);
  } catch (error) {
    logger.error('Error fetching pool analytics:', error);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

// GET /api/investment-pools/:id/rebalancing-status - Get rebalancing status
router.get('/:id/rebalancing-status', async (req, res) => {
  try {
    const { id } = req.params;

    const status = await rebalancingService.getRebalancingStatus(id);

    res.json(status);
  } catch (error) {
    logger.error('Error fetching rebalancing status:', error);
    res.status(500).json({ error: 'Failed to fetch rebalancing status' });
  }
});

// POST /api/investment-pools/:id/trigger-rebalance - Manually trigger rebalancing (admin)
router.post('/:id/trigger-rebalance', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = (req.user as any)?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // TODO: Add admin role check
    // if (!isAdmin(userId)) {
    //   return res.status(403).json({ error: 'Admin access required' });
    // }

    const result = await triggerManualRebalance(id);

    res.json({
      success: true,
      rebalanced: result,
      message: result 
        ? 'Rebalancing completed successfully' 
        : 'No rebalancing needed at this time',
    });
  } catch (error) {
    logger.error('Error triggering rebalance:', error);
    res.status(500).json({ error: 'Failed to trigger rebalance' });
  }
});

// POST /api/investment-pools/:id/trigger-snapshot - Manually trigger performance snapshot (admin)
router.post('/:id/trigger-snapshot', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = (req.user as any)?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    await triggerManualSnapshot(id);

    res.json({
      success: true,
      message: 'Performance snapshot recorded',
    });
  } catch (error) {
    logger.error('Error triggering snapshot:', error);
    res.status(500).json({ error: 'Failed to trigger snapshot' });
  }
});

// GET /api/investment-pools/:id/performance-chart - Get data for performance chart
router.get('/:id/performance-chart', async (req, res) => {
  try {
    const { id } = req.params;
    const { days = '30' } = req.query;

    const daysInt = parseInt(days as string);
    const history = await performanceTrackingService.getPerformanceHistory(id, daysInt);

    // Format for chart display
    const chartData = history.map(snapshot => ({
      date: snapshot.snapshotAt,
      tvl: Number(snapshot.tvl),
      sharePrice: Number(snapshot.sharePrice),
      return: Number(snapshot.totalReturnPercentage),
      btc: Number(snapshot.btcPrice),
      eth: Number(snapshot.ethPrice),
      sol: Number(snapshot.solPrice),
      bnb: Number(snapshot.bnbPrice),
      xrp: Number(snapshot.xrpPrice),
      ltc: Number(snapshot.ltcPrice),
    }));

    res.json({ data: chartData });
  } catch (error) {
    logger.error('Error fetching performance chart:', error);
    res.status(500).json({ error: 'Failed to fetch chart data' });
  }
});

// POST /api/investment-pools/create - Create a new investment pool (admin)
router.post('/create', async (req, res) => {
  try {
    const userId = (req.user as any)?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const {
      name,
      symbol,
      description,
      templateId,
      minimumInvestment,
      performanceFee,
      autoRebalance,
    } = req.body;

    // Validate input
    if (!name || !symbol) {
      return res.status(400).json({ error: 'Name and symbol are required' });
    }

    // Create pool
    const [pool] = await db
      .insert(investmentPools)
      .values({
        name,
        symbol,
        description,
        minimumInvestment: minimumInvestment?.toString() || '10.00',
        performanceFee: performanceFee || 200,
        createdBy: userId,
      })
      .returning();

    // If template is provided, copy asset allocations
    if (templateId) {
      const allocations = await db
        .select()
        .from(templateAssetAllocations)
        .where(eq(templateAssetAllocations.templateId, templateId));

      for (const allocation of allocations) {
        await db.insert(poolAssets).values({
          poolId: pool.id,
          assetSymbol: allocation.assetSymbol,
          assetName: allocation.assetSymbol, // Will be enriched later
          targetAllocation: allocation.targetAllocation,
          isActive: true,
        });
      }

    }

    // Create rebalancing settings if auto-rebalance is enabled
    if (autoRebalance) {
      await db.insert(rebalancingSettings).values({
        poolId: pool.id,
        autoRebalanceEnabled: true,
        rebalanceFrequency: 'weekly',
        rebalanceThreshold: 500, // 5%
      });
    }

    logger.info(`Pool created: ${name} (${symbol}) by user ${userId}`);

    res.json({
      pool,
      message: 'Investment pool created successfully',
    });
  } catch (error) {
    logger.error('Error creating pool:', error);
    res.status(500).json({ error: 'Failed to create pool' });
  }
});

export default router;

