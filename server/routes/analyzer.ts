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
    const { walletTransactions } = await import('../../shared/schema');
    const { eq } = await import('drizzle-orm');
    const { db } = await import('../db');
    const transactions = await db.select().from(walletTransactions).where(eq(walletTransactions.id, transactionId));
    const transaction = transactions[0];

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

// Comprehensive DAO analysis
router.get('/dao/:daoId/comprehensive', isAuthenticated, async (req, res) => {
  try {
    const { daoId } = req.params;

    const [treasury, governance, fraud] = await Promise.all([
      analyzerAgent.analyzeTreasuryHealth(daoId),
      analyzerAgent.analyzeGovernance(daoId),
      analyzerAgent.detectFraud(daoId)
    ]);

    // Convert threat levels to numbers
    const getThreatValue = (level: any): number => {
      if (typeof level === 'string') {
        const map: { [key: string]: number } = { 'low': 1, 'medium': 2, 'high': 3, 'critical': 4 };
        return map[level.toLowerCase()] || 0;
      }
      return typeof level === 'number' ? level : 0;
    };

    res.json({
      success: true,
      data: {
        treasury,
        governance,
        fraud,
        overallThreatLevel: Math.max(
          getThreatValue(treasury.threatLevel),
          getThreatValue(governance.threatLevel),
          getThreatValue(fraud.threatLevel)
        )
      }
    });
  } catch (error: any) {
    logger.error('Error performing comprehensive DAO analysis', error);
    res.status(500).json({ error: error.message });
  }
});

// Node profiling
router.get('/node/:userId', isAuthenticated, async (req, res) => {
  try {
    const { userId } = req.params;
    const { daoId } = req.query;

    const profile = await analyzerAgent.profileNode(userId, daoId as string);

    res.json({ success: true, data: profile });
  } catch (error: any) {
    logger.error('Error profiling node', error);
    res.status(500).json({ error: error.message });
  }
});

// System monitoring
router.get('/system/monitor', isAuthenticated, async (req, res) => {
  try {
    const healthReport = await analyzerAgent.monitorSystemHealth();

    res.json({ success: true, data: healthReport });
  } catch (error: any) {
    logger.error('Error monitoring system health', error);
    res.status(500).json({ error: error.message });
  }
});

// Analyzer metrics
router.get('/metrics', isAuthenticated, async (req, res) => {
  try {
    const metrics = analyzerAgent.getMetrics();
    res.json({ success: true, data: metrics });
  } catch (error: any) {
    logger.error('Error getting analyzer metrics', error);
    res.status(500).json({ error: error.message });
  }
});

// ========== ROTATION & PROPORTIONAL SELECTION ENDPOINTS ==========

// Get contribution weights for all members
router.get('/contributions/:daoId', isAuthenticated, async (req, res) => {
  try {
    const { daoId } = req.params;
    const { timeframe = '90d' } = req.query;

    // Verify DAO exists
    const dao = await storage.getDao(daoId);

    if (!dao) {
      return res.status(404).json({ error: 'DAO not found' });
    }

    // Get all approved members
    const members = await storage.getDaoMembers(daoId);

    if (members.length === 0) {
      return res.json({
        success: true,
        data: {
          members: [],
          totalContributions: 0,
          period: timeframe,
          daoId
        }
      });
    }

    // Get contribution weights
    const { ContributionAnalyzer } = await import('../core/nuru/analytics/contribution_analyzer');
    const analyzer = new ContributionAnalyzer();
    const memberIds = members.map((m: any) => m.userId || m.id);
    const weights = await analyzer.getContributionWeights(daoId, memberIds, timeframe as string);

    // Format response with member details
    const memberContributions = members.map((member: any) => ({
      userId: member.userId || member.id,
      name: member.name || 'Unknown',
      weight: weights[member.userId || member.id] || 0,
      joinedAt: member.joinedAt,
      status: member.status
    })).sort((a: any, b: any) => b.weight - a.weight);

    const totalWeight = memberContributions.reduce((sum: number, m: any) => sum + m.weight, 0);

    res.json({
      success: true,
      data: {
        members: memberContributions,
        totalContributions: totalWeight,
        period: timeframe,
        daoId,
        averageWeight: totalWeight / members.length,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error: any) {
    logger.error('Error fetching contribution weights', error);
    res.status(500).json({ error: error.message });
  }
});

// Execute proportional selection
router.post('/proportional/select/:daoId', isAuthenticated, async (req, res) => {
  try {
    const { daoId } = req.params;

    // Verify DAO exists
    const dao = await storage.getDao(daoId);

    if (!dao) {
      return res.status(404).json({ error: 'DAO not found' });
    }

    // Import rotation service
    const { selectRotationRecipient, RotationSelectionMethod } = await import('../api/rotation_service');

    // Execute proportional selection
    const selectedUserId = await selectRotationRecipient(
      daoId,
      RotationSelectionMethod.PROPORTIONAL
    );

    // Get selected member details
    const members = await storage.getDaoMembers(daoId);
    const selectedMember = members.find((m: any) => m.userId === selectedUserId);

    // Get all dao members for analysis
    const { ContributionAnalyzer } = await import('../core/nuru/analytics/contribution_analyzer');
    const analyzer = new ContributionAnalyzer();
    const allMembers = await storage.getDaoMembers(daoId);
    const memberIds = allMembers.map((m: any) => m.userId || m.id);
    const weights = await analyzer.getContributionWeights(daoId, memberIds, '90d');
    const selectedWeight = weights[selectedUserId] || 1;
    const totalWeight = Object.values(weights).reduce((a: number, b: any) => a + (b as number), 0);
    const probability = (selectedWeight / totalWeight) * 100;

    res.json({
      success: true,
      data: {
        selectedUserId,
        selectedMember: {
          userId: selectedMember?.userId,
          name: selectedMember?.name,
          joinedAt: selectedMember?.joinedAt
        },
        weight: selectedWeight,
        probabilityOfSelection: probability.toFixed(2) + '%',
        totalContestants: allMembers.length,
        selectionMethod: 'proportional',
        timestamp: new Date().toISOString()
      }
    });
  } catch (error: any) {
    logger.error('Error in proportional selection', error);
    res.status(500).json({ error: error.message });
  }
});

// Get rotation history
router.get('/rotation/history/:daoId', isAuthenticated, async (req, res) => {
  try {
    const { daoId } = req.params;
    const { limit = '50' } = req.query;
    const limitNum = Math.min(parseInt(limit as string) || 50, 500);

    // Verify DAO exists
    const dao = await storage.getDao(daoId);

    if (!dao) {
      return res.status(404).json({ error: 'DAO not found' });
    }

    // Get rotation history from database
    const { daoRotationCycles } = await import('../../shared/schema');
    const { eq, desc } = await import('drizzle-orm');
    const { db } = await import('../db');
    const cycles = await db.select().from(daoRotationCycles)
      .where(eq(daoRotationCycles.daoId, daoId))
      .orderBy(desc(daoRotationCycles.createdAt))
      .limit(limitNum);

    // Get current cycle details
    const currentCycle = cycles[0] || null;

    // Get next potential recipient using proportional selection
    const { selectRotationRecipient, RotationSelectionMethod } = await import('../api/rotation_service');
    let nextRecipient = null;
    try {
      nextRecipient = await selectRotationRecipient(
        daoId,
        RotationSelectionMethod.PROPORTIONAL
      );
    } catch (e) {
      logger.warn(`Could not determine next recipient for DAO ${daoId}`, e);
    }

    res.json({
      success: true,
      data: {
        daoId,
        currentCycleNumber: dao.currentRotationCycle || 0,
        currentCycle: currentCycle ? {
          cycleNumber: currentCycle.cycleNumber,
          recipientId: currentCycle.recipientUserId,
          amountDistributed: currentCycle.amountDistributed,
          distributedAt: currentCycle.distributedAt
        } : null,
        nextRecipientUserId: nextRecipient,
        recentCycles: cycles.slice(0, 10).map((cycle: any) => ({
          cycleNumber: cycle.cycleNumber,
          recipientId: cycle.recipientUserId,
          amountDistributed: cycle.amountDistributed,
          distributedAt: cycle.distributedAt
        })),
        totalCycles: cycles.length,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error: any) {
    logger.error('Error fetching rotation history', error);
    res.status(500).json({ error: error.message });
  }
});

// Process rotation cycle
router.post('/rotation/cycle/:daoId', isAuthenticated, async (req, res) => {
  try {
    const { daoId } = req.params;
    const { method = 'proportional' } = req.body;

    // Verify DAO exists
    const dao = await storage.getDao(daoId);

    if (!dao) {
      return res.status(404).json({ error: 'DAO not found' });
    }

    // Import rotation service
    const { selectRotationRecipient, RotationSelectionMethod } = await import('../api/rotation_service');

    // Map method string to enum
    let rotationMethod: any;
    switch (method.toLowerCase()) {
      case 'sequential':
        rotationMethod = RotationSelectionMethod.SEQUENTIAL;
        break;
      case 'lottery':
        rotationMethod = RotationSelectionMethod.LOTTERY;
        break;
      case 'proportional':
      default:
        rotationMethod = RotationSelectionMethod.PROPORTIONAL;
    }

    // Execute selection to get recipient
    const selectedUserId = await selectRotationRecipient(daoId, rotationMethod);

    // Get selected member details
    const members = await storage.getDaoMembers(daoId);
    const selectedMember = members.find((m: any) => m.userId === selectedUserId);

    res.json({
      success: true,
      data: {
        cycleNumber: (dao.currentRotationCycle || 0) + 1,
        selectedRecipient: selectedUserId,
        recipientName: selectedMember?.name,
        method: method,
        daoId,
        status: 'pending_distribution',
        timestamp: new Date().toISOString()
      }
    });
  } catch (error: any) {
    logger.error('Error processing rotation cycle', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;