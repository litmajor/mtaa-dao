import express from 'express';
import { Logger } from '../utils/logger';
import { db } from '../db';
import { multisigCreationJobs } from '../../shared/schema';
import { jobQueueService } from '../services/jobQueueService';
import { v4 as uuidv4 } from 'uuid';

const router = express.Router();
const logger = Logger.getLogger();

// POST /api/multisig-create
router.post('/', async (req, res) => {
  try {
    const { daoId, signers, requiredSignatures, chainId } = req.body;
    if (!daoId || !Array.isArray(signers) || signers.length < 2 || !requiredSignatures) {
      return res.status(400).json({ error: 'daoId, signers (>=2) and requiredSignatures are required' });
    }

    // Persist creation request to DB and enqueue worker job
    const jobId = uuidv4();
    await db.insert(multisigCreationJobs).values({ jobId, daoId, signers: JSON.stringify(signers), requiredSignatures, chainId: chainId || null, payload: JSON.stringify(req.body) });

    // Queue job for background worker
    const queuedId = await jobQueueService.queueJob('multisig-deploy', { jobId, daoId, signers, requiredSignatures, chainId });
    logger.info(`[Multisig Create] Queued multisig creation for dao ${daoId} job=${jobId} queue=${queuedId}`);
    return res.status(202).json({ success: true, jobId, queuedId, status: 'queued', message: 'Multisig creation queued' });
  } catch (error: any) {
    logger.error('[Multisig Create] error:', error);
    res.status(500).json({ error: 'Failed to queue multisig creation' });
  }
});

export default router;
