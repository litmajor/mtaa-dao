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

// Real Morio AI integration
const morioIntegration = {
  analyzeDAO: async (daoId: string, context: any) => {
    try {
      const analysis = await morio.analyzeDAO(daoId, context);
      return analysis;
    } catch (error) {
      logger.warn('Morio analysis fallback: using Nuru', { daoId, error });
      const fallback = await nuru.analyzeDomain('dao', daoId, { ...context, fallback: true });
      return fallback;
    }
  },
  processChat: async (userId: string, message: string, context: any) => {
    try {
      const response = await morio.chat(userId, message, context);
      return response;
    } catch (error) {
      logger.warn('Morio chat fallback: using Nuru', { userId, error });
      const fallback = await nuru.analyzeQuery(message, { userId, ...context, fallback: true });
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
      { concurrency: 2 } // 2 concurrent analyses
    );

    jobQueueService.registerProcessor(
      'morio-chat',
      async (job: Job<JobPayload>) => await this.processChat(job),
      { concurrency: 3 } // 3 concurrent chat sessions
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

      // Process chat via AI
      const response = await morioIntegration.processChat(userId, message, enrichedContext);

      await job.progress(95);

      const result = {
        userId,
        daoId,
        message,
        response,
        timestamp: new Date(),
        duration: Date.now() - job.data.timestamp
      };

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
      const { daos, daoMemberships, treasuries } = await import('../../shared/schema');
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
        memberCount: memberCount.length,
        treasury: await this.getTreasuryData(daoId)
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
      const { db } = await import('../db');
      const { userPreferences } = await import('../../shared/schema');
      const { eq } = await import('drizzle-orm');

      const prefs = await db.query.userPreferences.findFirst({
        where: eq(userPreferences.userId, userId)
      });

      return prefs || {};
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
      const { db } = await import('../db');
      const { treasuries } = await import('../../shared/schema');
      const { eq } = await import('drizzle-orm');

      const treasury = await db.query.treasuries.findFirst({
        where: eq(treasuries.daoId, daoId)
      });

      return treasury ? { balance: treasury.balance, assets: treasury.assets } : null;
    } catch (error) {
      logger.warn('Failed to fetch treasury data:', error);
      return null;
    }
  }
}

