/**
 * Morio Job Worker
 * Processes AI analysis and chat jobs asynchronously
 */

import { Job } from 'bull';
import type { JobPayload } from '../services/jobQueueService';
import { jobQueueService } from '../services/jobQueueService';
import { logger } from '../utils/logger';
import { morio } from '../agents/morio';
import { nuru } from '../core/nuru';

// Real Morio AI integration (use any casts to avoid strict type mismatches)
const morioIntegration = {
  analyzeDAO: async (daoId: string, context: any) => {
    try {
      const analysis = await (morio as any).analyzeDAO?.(daoId, context);
      return analysis;
    } catch (error) {
      logger.warn('Morio analysis fallback: using Nuru', { daoId, error });
      const fallback = await (nuru as any).analyzeDomain?.('dao', daoId, { ...context, fallback: true });
      return fallback;
    }
  },
  processChat: async (userId: string, message: string, context: any) => {
    try {
      const response = await (morio as any).chat?.(userId, message, context);
      return response;
    } catch (error) {
      logger.warn('Morio chat fallback: using Nuru', { userId, error });
      const fallback = await (nuru as any).analyzeQuery?.(message, { userId, ...context, fallback: true });
      return { response: fallback, fallback: true, timestamp: new Date() };
    }
  }
};

export class MorioJobWorker {
  /**
   * Initialize Morio job processors
   */
  static initialize() {
    jobQueueService.registerProcessor(
      'morio-analyze',
      async (job: Job<JobPayload>) => await this.processAnalyze(job),
      2 // 2 concurrent analyses
    );

    jobQueueService.registerProcessor(
      'morio-chat',
      async (job: Job<JobPayload>) => await this.processChat(job),
      3 // 3 concurrent chat sessions
    );

    logger.info('[MorioJobWorker] Initialized with 2 analyze + 3 chat slots');
  }

  /**
   * Process DAO analysis job
   */
  static async processAnalyze(job: Job<JobPayload>): Promise<any> {
    const { userId, daoId, analysisType = 'full', parameters = {} } = job.data;

    try {
      logger.info(`[MorioAnalysis] Starting for DAO ${daoId} by user ${userId}`);

      await job.progress(20);

      // Fetch DAO context
      const daoContext = await this.getDAOContext(daoId);
      
      // Perform AI analysis
      const analysis = await morioIntegration.analyzeDAO(daoId, {
        type: analysisType,
        params: parameters,
        context: daoContext
      });

      await job.progress(90);

      const result = {
        daoId,
        userId,
        analysis,
        analysisType,
        completedAt: new Date(),
        duration: Date.now() - job.data.timestamp
      };

      logger.info(`[MorioAnalysis] Completed for DAO ${daoId}`);
      return result;
    } catch (error) {
      logger.error(`[MorioAnalysis] Failed for DAO ${daoId}:`, error);
      throw error;
    }
  }

  /**
   * Process chat job
   */
  static async processChat(job: Job<JobPayload>): Promise<any> {
    const { userId, daoId, message, context = {} } = job.data;

    try {
      logger.info(`[MorioChat] Processing message from user ${userId}`);

      await job.progress(15);

      // Enrich context with user data
      const enrichedContext = {
        ...context,
        userId,
        daoId,
        userPreferences: await this.getUserPreferences(userId)
      };

      // Publish intermediate status (enriching/context ready)
      try {
        await jobQueueService.setJobStatus(job.id as any, {
          status: 'processing',
          progress: 25,
          result: { type: 'trace', step: 'context_enriched', message: 'Context enriched for processing' }
        });
      } catch (e) {
        logger.warn('Failed to publish intermediate job status:', e);
      }

      // Attempt to get NURU understanding early to provide a thinking-chain trace
      let understanding: any = null;
      try {
        understanding = await (await import('../core/nuru')).nuru.understand(message, enrichedContext as any);
        await jobQueueService.setJobStatus(job.id as any, {
          status: 'processing',
          progress: 45,
          result: { type: 'trace', step: 'nuru_understanding', data: { intent: understanding.intent, confidence: understanding.confidence, sentiment: understanding.sentiment } }
        });
      } catch (e) {
        logger.warn('NURU early understanding failed (non-fatal):', e);
      }

      // Process chat via AI
      const response = await morioIntegration.processChat(userId, message, enrichedContext);

      // If we have LLM-like partials in response, attempt to publish them
      try {
        await jobQueueService.setJobStatus(job.id as any, {
          status: 'processing',
          progress: 85,
          result: { type: 'trace', step: 'response_generated', data: { preview: response?.response?.text || response } }
        });
      } catch (e) {
        logger.warn('Failed to publish response preview status:', e);
      }

      await job.progress(95);

      const result = {
        userId,
        daoId,
        message,
        response,
        timestamp: new Date(),
        duration: Date.now() - job.data.timestamp
      };

      // Final status update before completing
      try {
        await jobQueueService.setJobResult(job.id as any, result);
      } catch (e) {
        logger.warn('Failed to persist job result via jobQueueService:', e);
      }

      logger.info(`[MorioChat] Completed for user ${userId}`);
      return result;
    } catch (error) {
      logger.error(`[MorioChat] Failed for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Fetch DAO context for analysis
   */
  private static async getDAOContext(daoId: string) {
    try {
      // Import DB dynamically to avoid circular dependencies
      const { db } = await import('../db');
      const { daos, daoMemberships } = await import('../../shared/schema');
      const { eq } = await import('drizzle-orm');

      const dao = await db.query.daos.findFirst({
        where: eq(daos.id, daoId)
      });

      const memberCount = await db.query.daoMemberships.findMany({
        where: eq(daoMemberships.daoId, daoId)
      });

      return {
        name: dao?.name,
        description: dao?.description,
        memberCount: memberCount.length
      };
    } catch (error) {
      logger.warn('Failed to fetch DAO context:', error);
      return { daoId };
    }
  }

  /**
   * Get user preferences
   */
  private static async getUserPreferences(userId: string) {
    try {
      // Avoid tight coupling to schema; return empty prefs or extend to use storage later
      return {};
    } catch (error) {
      logger.warn('Failed to fetch user preferences:', error);
      return {};
    }
  }

  /**
   * Get treasury data for DAO
   */
  private static async getTreasuryData(daoId: string) {
    try {
      // Treasury lookup postponed; return null for now to avoid schema mismatches
      return null;
    } catch (error) {
      logger.warn('Failed to fetch treasury data:', error);
      return null;
    }
  }
}

