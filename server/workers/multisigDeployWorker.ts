import { jobQueueService } from '../services/jobQueueService';
import { db } from '../db';
import { eq } from 'drizzle-orm';
import { Logger } from '../utils/logger';
import { wallets, multisigWallets, multisigSigners, multisigCreationJobs } from '../../shared/schema';

const logger = Logger.getLogger();

// Register processor for multisig-deploy jobs
jobQueueService.registerProcessor('multisig-deploy', async (job: any) => {
  const { jobId, daoId, signers, requiredSignatures, chainId } = job.data || {};
  try {
    logger.info(`[MultisigWorker] Starting job ${jobId}`);
    await jobQueueService.setJobStatus(job.id, { status: 'processing', progress: 10 });

    // Mark DB job as processing
    await db.update(multisigCreationJobs).set({ status: 'processing' }).where(eq(multisigCreationJobs.jobId, jobId));

    // Simulate deployment steps with progress updates
    await jobQueueService.setJobStatus(job.id, { status: 'processing', progress: 25 });
    await new Promise(r => setTimeout(r, 1200));
    await jobQueueService.setJobStatus(job.id, { status: 'processing', progress: 50 });
    await new Promise(r => setTimeout(r, 1200));

    // Create a treasury wallet record for this multisig (system-owned placeholder)
    const [wallet] = await db.insert(wallets).values({ userId: 'system', daoId, currency: 'ETH', address: `multisig-${jobId}`, walletType: 'treasury' }).returning();

    // Insert multisig wallet record (contractAddress will be updated after onchain deploy)
    const contractAddress = `SIM-${jobId}`;
    const [mw] = await db.insert(multisigWallets).values({ walletId: wallet.id, daoId, contractAddress, chain: 'ethereum', chainId: chainId || 1, requiredSignatures, totalSigners: Array.isArray(signers) ? signers.length : 0, walletStandard: 'gnosis', deployedAt: new Date(), deploymentTxHash: `0xSIM${jobId}` }).returning();

    // Insert signer placeholders
    if (Array.isArray(signers)) {
      for (let i = 0; i < signers.length; i++) {
        const s = signers[i];
        await db.insert(multisigSigners).values({ multisigWalletId: mw.id, userId: 'system', signerAddress: s, signerIndex: i }).returning();
      }
    }

    // Mark job DB record completed
    await db.update(multisigCreationJobs).set({ status: 'completed', updatedAt: new Date() }).where(eq(multisigCreationJobs.jobId, jobId));

    await jobQueueService.setJobResult(job.id, { multisigWalletId: mw.id, contractAddress, deploymentTxHash: `0xSIM${jobId}` });

    logger.info(`[MultisigWorker] Completed job ${jobId} -> wallet ${mw.id}`);
    return { multisigWalletId: mw.id, contractAddress };
  } catch (error: any) {
    logger.error('[MultisigWorker] failed:', error);
    await db.update(multisigCreationJobs).set({ status: 'failed', updatedAt: new Date() }).where(eq(multisigCreationJobs.jobId, jobId));
    await jobQueueService.setJobError(job.id, error);
    throw error;
  }
});
