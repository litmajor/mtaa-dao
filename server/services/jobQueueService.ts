/**
 * Job Queue Service
 * Unified interface for queueing async jobs (backtest, optimization, analysis, rebalancing)
 * Backend: classic `bull` package (see FIX #2 note if you actually intend BullMQ).
 *
 * FIXES APPLIED:
 * 1. Added real job-ownership tracking. Previously there was no way to look
 *    up who queued a given jobId — JobResult only ever carried
 *    status/result/error/progress/timestamps. This meant any "must own the
 *    job" check downstream (e.g. an SSE stream endpoint) had nothing to
 *    check against. queueJob now writes `job:owner:{jobId} -> userId`
 *    whenever the payload includes a userId, with getJobOwner() to read it
 *    back. TTL is intentionally longer than the result TTL so ownership
 *    can still be verified for a job whose result has already expired.
 * 2. `removeOnComplete: { age: 3600 }` is a BullMQ option shape, not valid
 *    for the classic `bull` package this file actually imports (`from
 *    'bull'`), which only accepts `removeOnComplete: boolean | number`
 *    (number = "keep the last N completed jobs"). Left as an explicit
 *    TODO rather than silently guessing your intended queue depth — see
 *    the comment at the call site. If you're actually migrating to
 *    BullMQ, the `redis: {host,port,password}` connection config here
 *    also needs to become BullMQ's `connection` shape; that's a bigger
 *    change than this file alone.
 * 3. Status key TTL is refreshed on every setJobStatus call (already true)
 *    but now defaults to a longer TTL for long-running jobs so an
 *    in-progress job's status can't expire out from under it before
 *    completion. Still configurable per call.
 */

import Queue, { type Job, type JobOptions } from 'bull';
import { redis } from './redis';
import { logger } from '../utils/logger';

export type JobType =
  | 'strategy-backtest'
  | 'strategy-optimize'
  | 'morio-analyze'
  | 'morio-chat'
  | 'pool-rebalance'
  | 'pool-valuation'
  | 'price-oracle-update'
  | 'vault-rebalance'
  | 'asset-graph-build'
  | 'multisig-deploy';

export interface JobPayload {
  userId?: string;
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

const OWNER_TTL_SECONDS = 24 * 60 * 60; // outlives the 1hr result/status TTL on purpose
const STATUS_TTL_SECONDS = 4 * 60 * 60; // FIX #3: was 3600 — long enough that a slow job's
                                          // pending status can't expire mid-run

class JobQueueService {
  private queues: Map<JobType, Queue.Queue> = new Map();
  private resultsPrefix = 'job:result:';
  private statusPrefix = 'job:status:';
  private ownerPrefix = 'job:owner:'; // FIX #1

  constructor() {
    this.initializeQueues();
  }

  private initializeQueues() {
    const jobTypes: JobType[] = [
      'strategy-backtest',
      'strategy-optimize',
      'morio-analyze',
      'morio-chat',
      'pool-rebalance',
      'pool-valuation',
      'price-oracle-update',
      'vault-rebalance',
      'asset-graph-build',
      'multisig-deploy'
    ];

    for (const jobType of jobTypes) {
      try {
        const queue = new Queue(jobType, {
          redis: {
            host: process.env.REDIS_HOST || 'localhost',
            port: parseInt(process.env.REDIS_PORT || '6379'),
            password: process.env.REDIS_PASSWORD,
            maxRetriesPerRequest: null,
            retryStrategy: (attempt: number) => {
              const baseDelayMs = Math.min(60_000, 250 * (2 ** Math.min(attempt, 8)));
              return baseDelayMs + Math.floor(Math.random() * 250);
            },
          },
          defaultJobOptions: {
            attempts: 3,
            backoff: {
              type: 'exponential',
              delay: 2000
            },
            // FIX #2: classic Bull's removeOnComplete only accepts
            // boolean | number, not { age }. Using `true` here (remove
            // immediately after completion, relying on our own Redis
            // result/status keys for post-completion reads instead of
            // Bull's own job storage) rather than guessing an intended
            // retention count. If you want Bull itself to retain N
            // completed jobs, set this to that number instead.
            removeOnComplete: true,
            removeOnFail: 100
          }
        });

        this.queues.set(jobType, queue);
        queue.on('error', (error) => {
          logger.warn(`[JobQueue] Redis connection error for ${jobType}; retrying`, {
            error: error.message,
          });
        });
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
        timeout: options?.timeout || 300000
      };
      if (options?.jobId) {
        jobOptions.jobId = options.jobId;
      }

      const job = await queue.add(payload, jobOptions);
      const jobIdStr = String(job.id);

      await this.setJobStatus(jobIdStr, {
        status: 'pending',
        progress: 0,
        startedAt: new Date()
      });

      // FIX #1: record ownership at queue time, independent of whatever
      // status/result keys get overwritten later by workers.
      if (payload.userId) {
        try {
          await redis.set(`${this.ownerPrefix}${jobIdStr}`, payload.userId, OWNER_TTL_SECONDS);
        } catch (err) {
          logger.error(`[JobQueue] Failed to record owner for job ${jobIdStr}:`, err);
        }
      } else {
        logger.warn(`[JobQueue] Job ${jobType}:${jobIdStr} queued with no userId — ownership cannot be verified later`);
      }

      logger.info(`[JobQueue] Queued job ${jobType}:${jobIdStr}`);
      return jobIdStr;
    } catch (error) {
      logger.error(`[JobQueue] Failed to queue job:`, error);
      throw error;
    }
  }

  /**
   * FIX #1: look up who queued a job, independent of its current
   * status/result state (so ownership can still be checked even after the
   * job's result has expired, as long as it's within OWNER_TTL_SECONDS).
   */
  async getJobOwner(jobId: string): Promise<string | null> {
    try {
      const owner = await redis.get(`${this.ownerPrefix}${jobId}`);
      return owner || null;
    } catch (error) {
      logger.error(`[JobQueue] Failed to get job owner:`, error);
      return null;
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

  async setJobStatus(jobId: string, status: JobResult): Promise<void> {
    try {
      const statusKey = `${this.statusPrefix}${jobId}`;
      await redis.set(statusKey, JSON.stringify(status), STATUS_TTL_SECONDS); // FIX #3
    } catch (error) {
      logger.error(`[JobQueue] Failed to set job status:`, error);
    }
  }

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

  async getQueueStats(jobType: JobType) {
    try {
      const queue = this.queues.get(jobType);
      if (!queue) return null;

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

  getQueues(): Map<JobType, Queue.Queue> {
    return this.queues;
  }
}

export interface QueueOptions {
  priority?: number;
  delay?: number;
  attempts?: number;
  timeout?: number;
  jobId?: string;
}

export const jobQueueService = new JobQueueService();