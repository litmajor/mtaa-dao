/**
 * Job Queue Service
 * Unified interface for queueing async jobs (backtest, optimization, analysis, rebalancing)
 * Supports BullMQ backend with Redis
 */

import Queue, { Job, JobOptions } from 'bull';
import { redis } from './redis';
import { logger } from '../utils/logger';

// Job type definitions
export type JobType = 
  | 'strategy-backtest'
  | 'strategy-optimize'
  | 'morio-analyze'
  | 'morio-chat'
  | 'pool-rebalance'
  | 'price-oracle-update'
  | 'vault-rebalance'
  | 'asset-graph-build'
  | 'multisig-deploy';
  

export interface JobPayload {
  [key: string]: any;
}

export interface JobResult {
  status: 'pending' | 'processing' | 'completed' | 'failed';
  result?: any;
  error?: string;
  progress?: number;
  startedAt?: Date;
  completedAt?: Date;
}

class JobQueueService {
  private queues: Map<JobType, Queue.Queue> = new Map();
  private resultsPrefix = 'job:result:';
  private statusPrefix = 'job:status:';

  constructor() {
    this.initializeQueues();
  }

  /**
   * Initialize job queues
   */
  private initializeQueues() {
    const jobTypes: JobType[] = [
      'strategy-backtest',
      'strategy-optimize',
      'morio-analyze',
      'morio-chat',
      'pool-rebalance',
      'price-oracle-update',
      'vault-rebalance',
      'asset-graph-build'
      , 'multisig-deploy' as JobType
    ];

    for (const jobType of jobTypes) {
      try {
        const queue = new Queue(jobType, {
          redis: {
            host: process.env.REDIS_HOST || 'localhost',
            port: parseInt(process.env.REDIS_PORT || '6379'),
            password: process.env.REDIS_PASSWORD
          },
          defaultJobOptions: {
            attempts: 3,
            backoff: {
              type: 'exponential',
              delay: 2000
            },
            removeOnComplete: {
              age: 3600 // Keep results for 1 hour
            }
          }
        });

        this.queues.set(jobType, queue);

        logger.info(`[JobQueue] Initialized queue for ${jobType}`);
      } catch (error) {
        logger.error(`[JobQueue] Failed to initialize queue ${jobType}:`, error);
      }
    }
  }

  /**
   * Queue a new job
   */
  async queueJob(
    jobType: JobType,
    payload: JobPayload,
    options?: QueueOptions
  ): Promise<string> {
    try {
      const queue = this.queues.get(jobType);
      if (!queue) {
        throw new Error(`Queue not found for job type: ${jobType}`);
      }

      const jobOptions: JobOptions = {
        priority: options?.priority || 5,
        delay: options?.delay || 0,
        attempts: options?.attempts || 3,
        timeout: options?.timeout || 300000 // 5 minutes default
      };

      const job = await queue.add(payload, jobOptions);

      // Store initial status
      const jobIdStr = String(job.id);
      await this.setJobStatus(jobIdStr, {
        status: 'pending',
        progress: 0,
        startedAt: new Date()
      });

      logger.info(`[JobQueue] Queued job ${jobType}:${jobIdStr}`);
      return jobIdStr;
    } catch (error) {
      logger.error(`[JobQueue] Failed to queue job:`, error);
      throw error;
    }
  }

  /**
   * Get job status and result
   */
  async getJobResult(jobId: string): Promise<JobResult | null> {
    try {
      const result = await redis.get(`${this.resultsPrefix}${jobId}`);
      if (result) {
        return JSON.parse(result);
      }

      const status = await redis.get(`${this.statusPrefix}${jobId}`);
      if (status) {
        return JSON.parse(status);
      }

      return null;
    } catch (error) {
      logger.error(`[JobQueue] Failed to get job result:`, error);
      return null;
    }
  }

  /**
   * Update job status (called by workers)
   */
  async setJobStatus(jobId: string, status: JobResult): Promise<void> {
    try {
      const statusKey = `${this.statusPrefix}${jobId}`;
      await redis.set(statusKey, JSON.stringify(status), 3600); // 1 hour TTL
    } catch (error) {
      logger.error(`[JobQueue] Failed to set job status:`, error);
    }
  }

  /**
   * Store job result (called by workers on completion)
   */
  async setJobResult(jobId: string, result: any, ttl = 3600): Promise<void> {
    try {
      const resultData: JobResult = {
        status: 'completed',
        result,
        completedAt: new Date()
      };
      const resultKey = `${this.resultsPrefix}${jobId}`;
      await redis.set(resultKey, JSON.stringify(resultData), ttl);
    } catch (error) {
      logger.error(`[JobQueue] Failed to set job result:`, error);
    }
  }

  /**
   * Store job error (called by workers on failure)
   */
  async setJobError(jobId: string, error: Error): Promise<void> {
    try {
      const errorData: JobResult = {
        status: 'failed',
        error: error.message,
        completedAt: new Date()
      };
      const statusKey = `${this.statusPrefix}${jobId}`;
      await redis.set(statusKey, JSON.stringify(errorData), 3600);
    } catch (err) {
      logger.error(`[JobQueue] Failed to set job error:`, err);
    }
  }

  /**
   * Get queue stats
   */
  async getQueueStats(jobType: JobType) {
    try {
      const queue = this.queues.get(jobType);
      if (!queue) {
        return null;
      }

      const [active, waiting, completed, failed] = await Promise.all([
        queue.getActiveCount(),
        queue.getWaitingCount(),
        queue.getCompletedCount(),
        queue.getFailedCount()
      ]);

      return { active, waiting, completed, failed };
    } catch (error) {
      logger.error(`[JobQueue] Failed to get queue stats:`, error);
      return null;
    }
  }

  /**
   * Register job processor (called by worker services)
   */
  registerProcessor(
    jobType: JobType,
    processor: (job: Job<JobPayload>) => Promise<any>,
    concurrency = 2
  ) {
    try {
      const queue = this.queues.get(jobType);
      if (!queue) {
        throw new Error(`Queue not found for job type: ${jobType}`);
      }

      queue.process(concurrency, async (job: Job<JobPayload>) => {
        const idStr = String(job.id);
        try {
          logger.info(`[JobQueue] Processing job ${jobType}:${idStr}`);
          const result = await processor(job);
          await this.setJobResult(idStr, result);
          return result;
        } catch (error) {
          logger.error(`[JobQueue] Job processing failed ${jobType}:${idStr}:`, error);
          await this.setJobError(idStr, error as Error);
          throw error;
        }
      });

      logger.info(`[JobQueue] Registered processor for ${jobType}`);
    } catch (error) {
      logger.error(`[JobQueue] Failed to register processor:`, error);
    }
  }

  /**
   * Get all queues (for monitoring)
   */
  getQueues(): Map<JobType, Queue.Queue> {
    return this.queues;
  }
}

export interface QueueOptions {
  priority?: number;
  delay?: number;
  attempts?: number;
  timeout?: number;
}

export const jobQueueService = new JobQueueService();

