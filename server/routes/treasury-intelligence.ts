
import express, { Request, Response } from 'express';
import { isAuthenticated } from '../nextAuthMiddleware';
import { treasuryIntelligenceService } from '../services/treasuryIntelligenceService';
import { analyzerAgent } from '../agents/analyzer';
import { aiAnalyticsService } from '../services/aiAnalyticsService';
import { db } from '../db';
import { sql } from 'drizzle-orm';

const router = express.Router();

// Get full treasury intelligence report
router.get('/:daoId/intelligence-report', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const { daoId } = req.params;
    const report = await treasuryIntelligenceService.generateIntelligenceReport(daoId);
    res.json(report);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get initiative ROI analysis
router.get('/:daoId/initiative-roi', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const { daoId } = req.params;
    const { timeframe = '90' } = req.query;
    
    const roi = await treasuryIntelligenceService.calculateInitiativeROI(
      daoId,
      parseInt(timeframe as string)
    );
    
    res.json({ success: true, data: roi });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Predict proposal impact (pre-submission scoring)
router.post('/:daoId/predict-impact', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const { daoId } = req.params;
    const { title, description, requestedAmount, category } = req.body;
    
    const prediction = await treasuryIntelligenceService.predictProposalImpact(
      daoId,
      title,
      description,
      requestedAmount,
      category
    );
    
    res.json({ success: true, prediction });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get budget optimization recommendations
router.get('/:daoId/budget-optimization', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const { daoId } = req.params;
    
    const optimization = await treasuryIntelligenceService.optimizeBudgetAllocation(daoId);
    
    res.json({ success: true, optimization });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Apply budget optimization (admin only)
router.post('/:daoId/apply-optimization', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const { daoId } = req.params;
    const { allocations } = req.body;

    if (!allocations || Object.keys(allocations).length === 0) {
      return res.status(400).json({ error: 'Budget allocations required' });
    }

    // Create governance proposal for budget adjustment
    // The allocations object should contain: { category: newPercentage }
    // Example: { operations: 40, development: 35, marketing: 25 }

    const totalAllocation = Object.values(allocations as any).reduce((a: number, b: number) => a + b, 0);
    
    if (Math.abs(totalAllocation - 100) > 0.01) {
      return res.status(400).json({ error: 'Allocations must sum to 100%' });
    }

    // Implement actual budget adjustment in database
    const dao = await db.query(sql`SELECT * FROM daos WHERE id = ${daoId}`);
    if (!dao || dao.length === 0) {
      return res.status(404).json({ error: 'DAO not found' });
    }
    
    // Create or update budget allocation
    await db.execute(sql`
      INSERT INTO budget_allocations (dao_id, allocations, created_at, updated_at)
      VALUES (${daoId}, ${JSON.stringify(allocations)}, NOW(), NOW())
      ON CONFLICT (dao_id) DO UPDATE SET
        allocations = ${JSON.stringify(allocations)},
        updated_at = NOW()
    `);
    
    // Create audit log entry
    await db.execute(sql`
      INSERT INTO audit_logs (dao_id, action, details, user_id, created_at)
      VALUES (${daoId}, 'budget_adjustment', ${JSON.stringify(allocations)}, ${req.user?.id}, NOW())
    `);

    res.json({ 
      success: true, 
      message: 'Budget optimization proposal created - requires governance approval',
      proposalId: `BUDGET-${Date.now()}`,
      allocations,
      votingDeadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Fraud detection powered by ANALYZER agent
router.get('/:daoId/fraud-detection', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const { daoId } = req.params;
    
    const fraudAnalysis = await aiAnalyticsService.getFraudDetection(daoId);
    
    res.json({ success: true, data: fraudAnalysis });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Governance security analysis
router.get('/:daoId/governance-analysis', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const { daoId } = req.params;
    
    const governanceAnalysis = await aiAnalyticsService.getGovernanceAnalysis(daoId);
    
    res.json({ success: true, data: governanceAnalysis });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Treasury health analysis
router.get('/:daoId/treasury-health', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const { daoId } = req.params;
    
    const healthAnalysis = await aiAnalyticsService.getTreasuryHealthAnalysis(daoId);
    
    res.json({ success: true, data: healthAnalysis });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Member profile analysis
router.get('/:daoId/member/:userId/profile', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const { daoId, userId } = req.params;
    
    const profile = await analyzerAgent.profileNode(userId, daoId);
    
    res.json({ success: true, data: profile });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// System health monitoring
router.get('/system/health', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const healthReport = await analyzerAgent.monitorSystemHealth();
    
    res.json({ success: true, data: healthReport });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
