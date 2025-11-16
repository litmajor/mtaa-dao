
import { Router } from 'express';
import { db } from '../db';
import { logger } from '../utils/logger';
import { poolShareListings, poolShareTrades } from '../../shared/schema';
import { eq, and, desc } from 'drizzle-orm';

const router = Router();

// List shares for sale
router.post('/:poolId/list-shares', async (req, res) => {
  try {
    const { poolId } = req.params;
    const userId = (req.user as any)?.id;
    const { shares, pricePerShare } = req.body;

    if (!userId) return res.status(401).json({ error: 'Authentication required' });

    // Create listing
    const [listing] = await db.insert(poolShareListings).values({
      poolId,
      sellerId: userId,
      shares: shares.toString(),
      pricePerShare: pricePerShare.toString(),
      status: 'active',
    }).returning();

    logger.info(`User ${userId} listed ${shares} shares for $${pricePerShare} each in pool ${poolId}`);

    res.json({ listing });
  } catch (error) {
    logger.error('Error listing shares:', error);
    res.status(500).json({ error: 'Failed to list shares' });
  }
});

// Buy shares from marketplace
router.post('/listings/:listingId/buy', async (req, res) => {
  try {
    const { listingId } = req.params;
    const buyerId = (req.user as any)?.id;
    const { shares } = req.body;

    if (!buyerId) return res.status(401).json({ error: 'Authentication required' });

    // Get listing
    const [listing] = await db.select()
      .from(poolShareListings)
      .where(eq(poolShareListings.id, listingId));

    if (!listing) return res.status(404).json({ error: 'Listing not found' });
    if (listing.status !== 'active') return res.status(400).json({ error: 'Listing not active' });

    const totalCost = Number(shares) * Number(listing.pricePerShare);

    // Record trade
    const [trade] = await db.insert(poolShareTrades).values({
      listingId,
      buyerId,
      sellerId: listing.sellerId,
      poolId: listing.poolId,
      shares: shares.toString(),
      pricePerShare: listing.pricePerShare,
      totalAmount: totalCost.toString(),
      status: 'completed',
    }).returning();

    // Update listing (reduce available shares)
    const remainingShares = Number(listing.shares) - Number(shares);
    await db.update(poolShareListings)
      .set({
        shares: remainingShares.toString(),
        status: remainingShares === 0 ? 'sold' : 'active',
      })
      .where(eq(poolShareListings.id, listingId));

    logger.info(`Trade executed: ${buyerId} bought ${shares} shares from ${listing.sellerId}`);

    res.json({ trade, totalCost });
  } catch (error) {
    logger.error('Error buying shares:', error);
    res.status(500).json({ error: 'Failed to buy shares' });
  }
});

// Get marketplace listings
router.get('/:poolId/marketplace', async (req, res) => {
  try {
    const { poolId } = req.params;

    const listings = await db.select()
      .from(poolShareListings)
      .where(and(
        eq(poolShareListings.poolId, poolId),
        eq(poolShareListings.status, 'active')
      ))
      .orderBy(desc(poolShareListings.createdAt));

    res.json({ listings });
  } catch (error) {
    logger.error('Error fetching marketplace:', error);
    res.status(500).json({ error: 'Failed to fetch marketplace' });
  }
});

export default router;
