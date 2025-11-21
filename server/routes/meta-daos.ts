
import { Router } from 'express';
import { metaDaoService } from '../services/metaDaoService';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// Create MetaDAO
router.post('/create', authenticateToken, async (req, res) => {
  try {
    const result = await metaDaoService.createMetaDAO({
      name: req.body.name,
      description: req.body.description,
      type: req.body.type,
      foundingDaoIds: req.body.foundingDaoIds,
      creatorId: req.user!.id
    });
    
    res.json({ success: true, ...result });
  } catch (error) {
    res.status(400).json({ success: false, error: (error as Error).message });
  }
});

// Submit cross-DAO proposal
router.post('/:metaDaoId/proposals', authenticateToken, async (req, res) => {
  try {
    const result = await metaDaoService.submitCrossDAOProposal({
      metaDaoId: req.params.metaDaoId,
      proposerDaoId: req.body.proposerDaoId,
      title: req.body.title,
      description: req.body.description,
      proposalType: req.body.proposalType,
      budget: req.body.budget,
      beneficiaryDaos: req.body.beneficiaryDaos
    });
    
    res.json({ success: true, ...result });
  } catch (error) {
    res.status(400).json({ success: false, error: (error as Error).message });
  }
});

// Vote on proposal
router.post('/proposals/:proposalId/vote', authenticateToken, async (req, res) => {
  try {
    await metaDaoService.voteOnProposal({
      proposalId: req.params.proposalId,
      daoId: req.body.daoId,
      vote: req.body.vote
    });
    
    res.json({ success: true });
  } catch (error) {
    res.status(400).json({ success: false, error: (error as Error).message });
  }
});

export default router;
