
import express from 'express';
import { db } from '../db';
import { achievements, users } from '../../shared/schema';
import { eq, and, sql } from 'drizzle-orm';
import { isAuthenticated } from '../auth';
import { ethers } from 'ethers';

const router = express.Router();

// GET /api/nft-marketplace/listings - Get all active listings
router.get('/listings', async (req, res) => {
  try {
    const { category, rarity, minPrice, maxPrice } = req.query;
    
    // In production, query blockchain for active listings
    const mockListings = [
      {
        tokenId: 1,
        name: 'Pioneer Badge',
        category: 'PIONEER',
        rarity: 4,
        price: ethers.parseEther('10').toString(),
        seller: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
        imageUrl: '/nft/pioneer.png'
      },
      {
        tokenId: 2,
        name: 'Super Contributor',
        category: 'CONTRIBUTOR',
        rarity: 3,
        price: ethers.parseEther('5').toString(),
        seller: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEc',
        imageUrl: '/nft/contributor.png'
      }
    ];

    res.json({ listings: mockListings });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/nft-marketplace/user/:address - Get user's NFTs
router.get('/user/:address', async (req, res) => {
  try {
    const { address } = req.params;
    
    const userAchievements = await db
      .select()
      .from(achievements)
      .where(eq(achievements.userId, address));

    res.json({ achievements: userAchievements });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/nft-marketplace/list - List NFT for sale
router.post('/list', isAuthenticated, async (req, res) => {
  try {
    const { tokenId, price } = req.body;
    
    // In production, interact with smart contract
    res.json({ 
      success: true, 
      message: 'NFT listed successfully',
      tokenId,
      price
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/nft-marketplace/buy - Buy NFT
router.post('/buy', isAuthenticated, async (req, res) => {
  try {
    const { tokenId } = req.body;
    
    // In production, execute purchase transaction
    res.json({ 
      success: true, 
      message: 'NFT purchased successfully',
      tokenId
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/nft-marketplace/unlist - Remove listing
router.post('/unlist', isAuthenticated, async (req, res) => {
  try {
    const { tokenId } = req.body;
    
    res.json({ 
      success: true, 
      message: 'NFT unlisted successfully',
      tokenId
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/nft-marketplace/stats - Marketplace statistics
router.get('/stats', async (req, res) => {
  try {
    const stats = {
      totalListings: 42,
      totalVolume: ethers.parseEther('1250').toString(),
      floorPrice: ethers.parseEther('2.5').toString(),
      uniqueOwners: 128,
      last24hVolume: ethers.parseEther('85').toString()
    };

    res.json({ stats });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
