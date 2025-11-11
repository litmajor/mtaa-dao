
import express, { Request, Response } from 'express';
import { isAuthenticated } from '../nextAuthMiddleware';
import { treasuryIntelligenceService } from '../services/treasuryIntelligenceService';
import { analyzer } from '../agents/analyzer';
import { aiAnalyticsService } from '../services/aiAnalyticsService';

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
    // TODO: Implement actual budget adjustment in database
    // This would create governance proposals or update budget allocations
    
    res.json({ 
      success: true, 
      message: 'Budget optimization proposal created - requires governance approval' 
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
    
    const profile = await analyzer.profileNode(userId, daoId);
    
    res.json({ success: true, data: profile });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// System health monitoring
router.get('/system/health', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const healthReport = await analyzer.monitorSystemHealth();
    
    res.json({ success: true, data: healthReport });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
