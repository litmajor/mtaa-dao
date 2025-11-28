
import express from 'express';
import { contributionIndexer } from '../services/contributionIndexerService';
import { isAuthenticated } from '../auth';
import { db } from '../db';
import { wallets } from '../../shared/schema';
import { eq, and, sql } from 'drizzle-orm';
import { ethers } from 'ethers';

const router = express.Router();

// Get pending contributions for a DAO
router.get('/pending/:daoId', isAuthenticated, async (req, res) => {
  try {
    const { daoId } = req.params;
    const pending = await contributionIndexer.getPendingContributions(daoId);
    
    res.json({
      success: true,
      pending,
      count: pending.length
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get all pending contributions (for user)
router.get('/pending', isAuthenticated, async (req, res) => {
  try {
    const userId = (req.user as any)?.claims?.id;
    
    // Get user's wallet addresses
    const userWallets = await db
      .select({ address: wallets.address })
      .from(wallets)
      .where(
        and(
          eq(wallets.userId, userId),
          eq(wallets.isActive, true)
        )
      );

    const addresses = userWallets.map(w => w.address.toLowerCase());
    
    // Filter pending contributions by user's wallets
    const allPending = await contributionIndexer.getPendingContributions();
    const userPending = allPending.filter(
      p => addresses.includes(p.fromAddress.toLowerCase())
    );
    
    res.json({
      success: true,
      pending: userPending,
      count: userPending.length
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Claim a contribution from external wallet
router.post('/claim', isAuthenticated, async (req, res) => {
  try {
    const userId = (req.user as any)?.claims?.id;
    const { transactionHash, walletAddress, signature } = req.body;

    if (!transactionHash || !walletAddress || !signature) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields'
      });
    }

    // Verify signature to prove wallet ownership
    const message = `I am claiming contribution ${transactionHash} for MtaaDAO`;
    const recoveredAddress = ethers.verifyMessage(message, signature);

    if (recoveredAddress.toLowerCase() !== walletAddress.toLowerCase()) {
      return res.status(403).json({
        success: false,
        error: 'Signature verification failed'
      });
    }

    // Claim the contribution
    const success = await contributionIndexer.claimContribution(
      userId,
      transactionHash,
      walletAddress
    );

    if (success) {
      res.json({
        success: true,
        message: 'Contribution claimed successfully'
      });
    } else {
      res.status(400).json({
        success: false,
        error: 'Failed to claim contribution'
      });
    }
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Link external wallet to user account
router.post('/link-wallet', isAuthenticated, async (req, res) => {
  try {
    const userId = (req.user as any)?.claims?.id;
    const { walletAddress, signature } = req.body;

    // Verify signature
    const message = `Link wallet ${walletAddress} to MtaaDAO account`;
    const recoveredAddress = ethers.verifyMessage(message, signature);

    if (recoveredAddress.toLowerCase() !== walletAddress.toLowerCase()) {
      return res.status(403).json({
        success: false,
        error: 'Signature verification failed'
      });
    }

    // Check if wallet is already linked
    const existing = await db
      .select()
      .from(wallets)
      .where(sql`LOWER(${wallets.address}) = LOWER(${walletAddress})`)
      .limit(1);

    if (existing.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Wallet already linked to an account'
      });
    }

    // Link wallet
    await db.insert(wallets).values({
      userId,
      address: walletAddress,
      currency: 'multi',
      walletType: 'personal',
      isActive: true
    });

    res.json({
      success: true,
      message: 'Wallet linked successfully'
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;
