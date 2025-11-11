
/**
 * Analyzer Agent API Routes
 */

import express from 'express';
import { isAuthenticated } from '../nextAuthMiddleware';
import { analyzerAgent } from '../agents/analyzer';
import { storage } from '../storage';
import { Logger } from '../utils/logger';

const router = express.Router();
const logger = new Logger('analyzer-routes');

// Initialize agent
analyzerAgent.initialize().catch(err => {
  logger.error('Failed to initialize analyzer agent', err);
});

// Get agent status
router.get('/status', isAuthenticated, async (req, res) => {
  try {
    const status = analyzerAgent.getStatus();
    const metrics = analyzerAgent.getMetrics();
    const config = analyzerAgent.getConfig();

    res.json({
      success: true,
      data: { status, metrics, config }
    });
  } catch (error: any) {
    logger.error('Error getting analyzer status', error);
    res.status(500).json({ error: error.message });
  }
});

// Analyze transaction
router.post('/analyze/transaction/:transactionId', isAuthenticated, async (req, res) => {
  try {
    const { transactionId } = req.params;
    
    // Fetch transaction from database
    const transaction = await storage.db.query.walletTransactions.findFirst({
      where: (transactions, { eq }) => eq(transactions.id, transactionId)
    });

    if (!transaction) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    const analysis = await analyzerAgent.analyzeTransaction(transaction);

    res.json({
      success: true,
      data: analysis
    });
  } catch (error: any) {
    logger.error('Error analyzing transaction', error);
    res.status(500).json({ error: error.message });
  }
});

// Analyze proposal
router.post('/analyze/proposal/:proposalId', isAuthenticated, async (req, res) => {
  try {
    const { proposalId } = req.params;

    const proposal = await storage.getProposal(proposalId);
    const votes = await storage.getVotesByProposal(proposalId);

    const analysis = await analyzerAgent.analyzeProposal(proposal, votes);

    res.json({
      success: true,
      data: analysis
    });
  } catch (error: any) {
    logger.error('Error analyzing proposal', error);
    res.status(500).json({ error: error.message });
  }
});

// Analyze vault
router.post('/analyze/vault/:vaultId', isAuthenticated, async (req, res) => {
  try {
    const { vaultId } = req.params;

    const transactions = await storage.getVaultTransactions(vaultId, 100, 0);

    const analysis = await analyzerAgent.analyzeVault(vaultId, transactions);

    res.json({
      success: true,
      data: analysis
    });
  } catch (error: any) {
    logger.error('Error analyzing vault', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
