
import express from 'express';
import { db } from '../storage';
import { 
  proposalExecutionQueue, 
  proposals,
  daos
} from '../../shared/schema';
import { eq, and, desc } from 'drizzle-orm';
import { isAuthenticated } from '../auth';
import { ProposalExecutionService } from '../proposalExecutionService';

const router = express.Router();

// Get execution queue for a DAO
router.get('/:daoId/queue', isAuthenticated, async (req, res) => {
  try {
    const { daoId } = req.params;
    
    // Check if user has admin access
    const userId = (req.user as any).claims.sub;
    // Add permission check here
    
    const executions = await db.select()
      .from(proposalExecutionQueue)
      .where(eq(proposalExecutionQueue.daoId, daoId))
      .orderBy(desc(proposalExecutionQueue.createdAt));
    
    res.json({
      success: true,
      data: executions
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch execution queue',
      error: error.message
    });
  }
});

// Manually execute a proposal
router.post('/:daoId/execute/:proposalId', isAuthenticated, async (req, res) => {
  try {
    const { daoId, proposalId } = req.params;
    const userId = (req.user as any).claims.sub;
    
    // Check permissions (admin/elder only)
    // Add permission check here
    
    // Get the execution from queue
    const execution = await db.select()
      .from(proposalExecutionQueue)
      .where(and(
        eq(proposalExecutionQueue.proposalId, proposalId),
        eq(proposalExecutionQueue.daoId, daoId),
        eq(proposalExecutionQueue.status, 'pending')
      ))
      .limit(1);
    
    if (!execution.length) {
      return res.status(404).json({
        success: false,
        message: 'No pending execution found for this proposal'
      });
    }
    
    // Execute the proposal
    await ProposalExecutionService.executeProposal(execution[0]);
    
    res.json({
      success: true,
      message: 'Proposal executed successfully'
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Failed to execute proposal',
      error: error.message
    });
  }
});

// Cancel proposal execution
router.delete('/:daoId/cancel/:executionId', isAuthenticated, async (req, res) => {
  try {
    const { daoId, executionId } = req.params;
    const userId = (req.user as any).claims.sub;
    
    // Check permissions
    // Add permission check here
    
    await db.update(proposalExecutionQueue)
      .set({ status: 'cancelled' })
      .where(and(
        eq(proposalExecutionQueue.id, executionId),
        eq(proposalExecutionQueue.daoId, daoId)
      ));
    
    res.json({
      success: true,
      message: 'Execution cancelled successfully'
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Failed to cancel execution',
      error: error.message
    });
  }
});

export default router;
