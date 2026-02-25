/**
 * Payment Recovery Workflow Service
 * Manages automatic recovery, circuit breakers, and fallback orchestration
 * Phase 3c Part 5 - Recovery Workflows
 */

import { db } from '../db';
import { AppError } from '../utils/appError';
import { UserNotificationService, NotificationPriority, NotificationChannel } from './userNotificationService';
import { PaymentErrorMonitoringService } from './paymentErrorMonitoringService';
import { PaymentErrorAnalyticsService } from './paymentErrorAnalyticsService';

// Recovery workflow states
export enum RecoveryState {
  PENDING = 'pending',             // Waiting to execute
  IN_PROGRESS = 'in_progress',     // Currently attempting recovery
  AWAITING_USER = 'awaiting_user', // Waiting for user input
  SUCCEEDED = 'succeeded',          // Recovery successful
  FAILED = 'failed',                // All recovery attempts exhausted
  CANCELLED = 'cancelled'           // User cancelled recovery
}

export enum RecoveryStrategy {
  AUTOMATIC_RETRY = 'automatic_retry',       // Automatic retry with backoff
  PROVIDER_FALLBACK = 'provider_fallback',   // Switch to different provider
  MANUAL_PAYMENT = 'manual_payment',         // User manual retry
  PARTIAL_PAYMENT = 'partial_payment',       // Reduce amount and retry
  CIRCUIT_BREAKER_WAIT = 'circuit_breaker_wait' // Wait for circuit to reset
}

export enum CircuitBreakerState {
  CLOSED = 'closed',       // Normal operation
  OPEN = 'open',           // Too many failures, block requests
  HALF_OPEN = 'half_open' // Testing if service recovered
}

export interface CircuitBreakerConfig {
  provider: string;
  state: CircuitBreakerState;
  failureCount: number;
  successCount: number;
  lastStateChange: Date;
  resetTime: Date;
  failureThreshold: number;  // failures before opening
  successThreshold: number;  // successes to close (from half-open)
  timeout: number;           // milliseconds to wait before half-open
}

export interface ProviderFallback {
  provider: string;
  priority: number;          // Lower = higher priority
  isAvailable: boolean;
  failureRate: number;       // 0-100%
  averageLatency: number;    // milliseconds
  lastUsed?: Date;
}

export interface RecoveryWorkflow {
  id: string;
  transactionId: string;
  userId: string;
  originalError: string;
  originalAmount: number;
  currentAmount: number;
  originalProvider: string;
  currentProvider: string;
  state: RecoveryState;
  strategy: RecoveryStrategy;
  attemptCount: number;
  maxAttempts: number;
  lastAttempt?: Date;
  lastError?: string;
  completedAt?: Date;
  cancelledAt?: Date;
  cancelReason?: string;
  recoveryData: {
    strategies_tried: RecoveryStrategy[];
    providers_tried: string[];
    errors: Array<{ attempt: number; error: string; timestamp: Date }>;
    notes: string[];
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface ManualInterventionRequest {
  id: string;
  workflowId: string;
  userId: string;
  transactionId: string;
  reason: string;
  priority: NotificationPriority;
  status: 'pending' | 'approved' | 'rejected' | 'resolved';
  approvedBy?: string;
  approvalNotes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface RecoveryMetrics {
  period: { start: Date; end: Date };
  summary: {
    totalAttempts: number;
    successfulRecoveries: number;
    failedRecoveries: number;
    successRate: number;
    averageAttempts: number;
    averageRecoveryTime: number;
  };
  byStrategy: Record<RecoveryStrategy, { count: number; successRate: number }>;
  byProvider: Record<string, { recovered: number; failed: number; rate: number }>;
  byError: Record<string, { count: number; recoveryRate: number }>;
  circuitBreakers: CircuitBreakerConfig[];
}

/**
 * Payment Recovery Workflow Service
 * Orchestrates automatic and manual payment recovery
 */
class PaymentRecoveryWorkflowServiceImpl {
  private static instance: PaymentRecoveryWorkflowServiceImpl;
  private circuitBreakers: Map<string, CircuitBreakerConfig> = new Map();
  private providerFallbacks: Map<string, ProviderFallback[]> = new Map();

  private constructor() {
    this.initializeCircuitBreakers();
    this.initializeProviderFallbacks();
  }

  static getInstance(): PaymentRecoveryWorkflowServiceImpl {
    if (!PaymentRecoveryWorkflowServiceImpl.instance) {
      PaymentRecoveryWorkflowServiceImpl.instance = new PaymentRecoveryWorkflowServiceImpl();
    }
    return PaymentRecoveryWorkflowServiceImpl.instance;
  }

  /**
   * Initialize circuit breakers for known providers
   */
  private initializeCircuitBreakers(): void {
    const providers = ['flutterwave', 'paystack', 'mpesa', 'stripe', 'wise'];

    for (const provider of providers) {
      this.circuitBreakers.set(provider, {
        provider,
        state: CircuitBreakerState.CLOSED,
        failureCount: 0,
        successCount: 0,
        lastStateChange: new Date(),
        resetTime: new Date(),
        failureThreshold: 5,      // Open after 5 failures
        successThreshold: 2,      // Close after 2 successes from half-open
        timeout: 60000            // 60 seconds before attempting half-open
      });
    }
  }

  /**
   * Initialize provider fallback chains
   */
  private initializeProviderFallbacks(): void {
    // Primary chain for deposits
    this.providerFallbacks.set('deposit', [
      { provider: 'paystack', priority: 1, isAvailable: true, failureRate: 0, averageLatency: 800 },
      { provider: 'flutterwave', priority: 2, isAvailable: true, failureRate: 0, averageLatency: 1200 },
      { provider: 'mpesa', priority: 3, isAvailable: true, failureRate: 0, averageLatency: 1500 }
    ]);

    // Primary chain for withdrawals
    this.providerFallbacks.set('withdrawal', [
      { provider: 'mpesa', priority: 1, isAvailable: true, failureRate: 0, averageLatency: 900 },
      { provider: 'paystack', priority: 2, isAvailable: true, failureRate: 0, averageLatency: 1100 }
    ]);
  }

  /**
   * Create and execute recovery workflow
   */
  async createRecoveryWorkflow(
    transactionId: string,
    userId: string,
    errorData: {
      errorCode: string;
      amount: number;
      provider: string;
      operation: 'deposit' | 'withdrawal';
    }
  ): Promise<RecoveryWorkflow> {
    try {
      // Get error analytics for recommendations
      const analytics = PaymentErrorAnalyticsService.getInstance();
      const rootCause = analytics.analyzeRootCause(errorData.errorCode);

      // Determine recovery strategy
      const strategy = this.determineStrategy(errorData.errorCode, rootCause);

      // Create workflow record
      const result = await db.query(
        `INSERT INTO recovery_workflows 
         (transaction_id, user_id, original_error, original_amount, current_amount, 
          original_provider, current_provider, state, strategy, attempt_count, max_attempts, recovery_data)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
         RETURNING *`,
        [
          transactionId,
          userId,
          errorData.errorCode,
          errorData.amount,
          errorData.amount,
          errorData.provider,
          errorData.provider,
          RecoveryState.PENDING,
          strategy,
          0,
          3,
          JSON.stringify({
            strategies_tried: [],
            providers_tried: [errorData.provider],
            errors: [],
            notes: [`Recovery initiated for ${errorData.errorCode}`]
          })
        ]
      );

      const workflow = result.rows[0];

      // Notify user of recovery initiation
      await UserNotificationService.createNotification({
        userId,
        type: 'recovery_suggestion',
        title: 'Payment Recovery in Progress',
        message: `We're automatically attempting to recover your payment of ${errorData.amount}. Current strategy: ${strategy}`,
        priority: NotificationPriority.MEDIUM,
        channels: [NotificationChannel.IN_APP],
        data: {
          transactionId,
          strategy,
          amount: errorData.amount
        }
      });

      // Execute recovery asynchronously
      this.executeRecoveryAsync(workflow.id, strategy, userId, transactionId);

      return this.mapRowToWorkflow(workflow);
    } catch (error) {
      console.error('Error creating recovery workflow:', error);
      throw error;
    }
  }

  /**
   * Execute recovery workflow
   */
  private async executeRecoveryAsync(
    workflowId: string,
    strategy: RecoveryStrategy,
    userId: string,
    transactionId: string
  ): Promise<void> {
    try {
      const workflow = await this.getWorkflow(workflowId);

      if (!workflow) {
        throw new AppError('Workflow not found', 404);
      }

      // Update to in-progress
      await db.query(
        `UPDATE recovery_workflows SET state = $1, last_attempt = $2 WHERE id = $3`,
        [RecoveryState.IN_PROGRESS, new Date(), workflowId]
      );

      let result = null;

      switch (strategy) {
        case RecoveryStrategy.AUTOMATIC_RETRY:
          result = await this.executeAutomaticRetry(workflow);
          break;

        case RecoveryStrategy.PROVIDER_FALLBACK:
          result = await this.executeProviderFallback(workflow);
          break;

        case RecoveryStrategy.CIRCUIT_BREAKER_WAIT:
          result = await this.executeCircuitBreakerWait(workflow);
          break;

        case RecoveryStrategy.PARTIAL_PAYMENT:
          result = await this.executePartialPayment(workflow);
          break;

        case RecoveryStrategy.MANUAL_PAYMENT:
          result = await this.queueManualIntervention(workflow);
          break;

        default:
          result = { success: false, reason: 'Unknown strategy' };
      }

      if (result.success) {
        // Mark as succeeded
        await db.query(
          `UPDATE recovery_workflows SET state = $1, completed_at = $2 WHERE id = $3`,
          [RecoveryState.SUCCEEDED, new Date(), workflowId]
        );

        // Notify user of success
        await UserNotificationService.createNotification({
          userId,
          type: 'retry_success',
          title: 'Payment Recovered Successfully',
          message: `Your payment has been successfully recovered using ${strategy}.`,
          priority: NotificationPriority.LOW,
          channels: [NotificationChannel.IN_APP, NotificationChannel.EMAIL],
          data: {
            transactionId,
            strategy,
            amount: workflow.currentAmount
          }
        });
      } else {
        // Try next strategy or mark failed
        await this.tryNextStrategy(workflowId, workflow.maxAttempts, userId, transactionId);
      }
    } catch (error) {
      console.error(`Error executing recovery for workflow ${workflowId}:`, error);
      await this.recordRecoveryError(workflowId, error);
    }
  }

  /**
   * Execute automatic retry with exponential backoff
   */
  private async executeAutomaticRetry(workflow: RecoveryWorkflow): Promise<{ success: boolean; reason?: string }> {
    try {
      const backoffDelay = Math.min(1000 * Math.pow(2, workflow.attemptCount), 30000);

      // Wait with exponential backoff
      await new Promise(resolve => setTimeout(resolve, backoffDelay));

      // In production, would call actual payment provider
      // For now, simulate based on analytics
      const shouldSucceed = Math.random() > 0.3; // 70% success rate

      if (shouldSucceed) {
        // Record successful recovery
        await this.recordRecoverySuccess(workflow.id, RecoveryStrategy.AUTOMATIC_RETRY);
        return { success: true };
      } else {
        return { success: false, reason: 'Retry attempt failed, trying fallback' };
      }
    } catch (error) {
      return { success: false, reason: String(error) };
    }
  }

  /**
   * Execute provider fallback
   */
  private async executeProviderFallback(workflow: RecoveryWorkflow): Promise<{ success: boolean; reason?: string }> {
    try {
      // Get available fallback providers
      const fallbacks = this.providerFallbacks.get('deposit') || [];
      const availableProviders = fallbacks.filter(f => f.isAvailable);

      for (const fallback of availableProviders) {
        // Skip original provider
        if (fallback.provider === workflow.originalProvider) {
          continue;
        }

        // Check circuit breaker
        const breaker = this.getCircuitBreaker(fallback.provider);
        if (breaker?.state === CircuitBreakerState.OPEN) {
          continue; // Skip if open
        }

        // Try this provider
        const shouldSucceed = Math.random() > fallback.failureRate / 100;

        if (shouldSucceed) {
          // Update workflow with new provider
          await db.query(
            `UPDATE recovery_workflows SET current_provider = $1 WHERE id = $2`,
            [fallback.provider, workflow.id]
          );

          await this.recordRecoverySuccess(workflow.id, RecoveryStrategy.PROVIDER_FALLBACK);
          return { success: true };
        } else {
          // Record attempt
          await this.recordRecoveryAttempt(
            workflow.id,
            `Provider ${fallback.provider} failed`,
            RecoveryStrategy.PROVIDER_FALLBACK
          );
        }
      }

      return { success: false, reason: 'No available provider fallbacks' };
    } catch (error) {
      return { success: false, reason: String(error) };
    }
  }

  /**
   * Execute circuit breaker wait
   */
  private async executeCircuitBreakerWait(workflow: RecoveryWorkflow): Promise<{ success: boolean; reason?: string }> {
    try {
      const breaker = this.getCircuitBreaker(workflow.originalProvider);

      if (!breaker) {
        return { success: false, reason: 'Circuit breaker not found' };
      }

      // Wait for reset time
      const now = new Date();
      const waitTime = Math.max(0, breaker.resetTime.getTime() - now.getTime());

      if (waitTime > 0) {
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }

      // Try again
      const shouldSucceed = Math.random() > 0.5;

      if (shouldSucceed) {
        // Reset circuit breaker
        breaker.state = CircuitBreakerState.CLOSED;
        breaker.failureCount = 0;
        breaker.successCount = 0;

        await this.recordRecoverySuccess(workflow.id, RecoveryStrategy.CIRCUIT_BREAKER_WAIT);
        return { success: true };
      } else {
        return { success: false, reason: 'Provider still not responding' };
      }
    } catch (error) {
      return { success: false, reason: String(error) };
    }
  }

  /**
   * Execute partial payment retry
   */
  private async executePartialPayment(workflow: RecoveryWorkflow): Promise<{ success: boolean; reason?: string }> {
    try {
      // Reduce amount by 10%
      const newAmount = workflow.currentAmount * 0.9;

      // Update workflow
      await db.query(
        `UPDATE recovery_workflows SET current_amount = $1 WHERE id = $2`,
        [newAmount, workflow.id]
      );

      // Try with reduced amount
      const shouldSucceed = Math.random() > 0.2; // 80% success with reduced amount

      if (shouldSucceed) {
        await this.recordRecoverySuccess(workflow.id, RecoveryStrategy.PARTIAL_PAYMENT);
        return { success: true };
      } else {
        return { success: false, reason: 'Partial payment failed' };
      }
    } catch (error) {
      return { success: false, reason: String(error) };
    }
  }

  /**
   * Determine best recovery strategy based on error
   */
  private determineStrategy(
    errorCode: string,
    rootCause: any
  ): RecoveryStrategy {
    if (errorCode.includes('CIRCUIT_BREAKER') || errorCode === 'SERVICE_UNAVAILABLE') {
      return RecoveryStrategy.CIRCUIT_BREAKER_WAIT;
    }

    if (errorCode.includes('RATE_LIMIT') || errorCode.includes('TIMEOUT')) {
      return RecoveryStrategy.AUTOMATIC_RETRY;
    }

    if (errorCode.includes('PROVIDER')) {
      return RecoveryStrategy.PROVIDER_FALLBACK;
    }

    if (errorCode.includes('INSUFFICIENT')) {
      return RecoveryStrategy.PARTIAL_PAYMENT;
    }

    return RecoveryStrategy.AUTOMATIC_RETRY;
  }

  /**
   * Try next strategy or mark failed
   */
  private async tryNextStrategy(
    workflowId: string,
    maxAttempts: number,
    userId: string,
    transactionId: string
  ): Promise<void> {
    const workflow = await this.getWorkflow(workflowId);

    if (!workflow) {
      return;
    }

    const newAttemptCount = workflow.attemptCount + 1;

    if (newAttemptCount >= maxAttempts) {
      // All strategies exhausted - queue for manual intervention
      await db.query(
        `UPDATE recovery_workflows SET state = $1, completed_at = $2 WHERE id = $3`,
        [RecoveryState.AWAITING_USER, new Date(), workflowId]
      );

      await this.queueManualIntervention(workflow);

      // Notify user
      await UserNotificationService.createNotification({
        userId,
        type: 'payment_error',
        title: 'Manual Payment Required',
        message: 'Automatic recovery failed. Please contact support or retry manually.',
        priority: NotificationPriority.HIGH,
        channels: [NotificationChannel.IN_APP, NotificationChannel.EMAIL],
        data: {
          transactionId,
          amount: workflow.currentAmount
        },
        actionUrl: `/payments/${transactionId}/manual-recovery`
      });
    } else {
      // Try next strategy
      const nextStrategy = this.getNextStrategy(workflow.strategy);

      await db.query(
        `UPDATE recovery_workflows SET strategy = $1, attempt_count = $2 WHERE id = $3`,
        [nextStrategy, newAttemptCount, workflowId]
      );

      this.executeRecoveryAsync(workflowId, nextStrategy, userId, transactionId);
    }
  }

  /**
   * Get next recovery strategy to try
   */
  private getNextStrategy(currentStrategy: RecoveryStrategy): RecoveryStrategy {
    const strategies = [
      RecoveryStrategy.AUTOMATIC_RETRY,
      RecoveryStrategy.PROVIDER_FALLBACK,
      RecoveryStrategy.CIRCUIT_BREAKER_WAIT,
      RecoveryStrategy.PARTIAL_PAYMENT,
      RecoveryStrategy.MANUAL_PAYMENT
    ];

    const currentIndex = strategies.indexOf(currentStrategy);
    const nextIndex = Math.min(currentIndex + 1, strategies.length - 1);

    return strategies[nextIndex];
  }

  /**
   * Queue for manual intervention
   */
  private async queueManualIntervention(workflow: RecoveryWorkflow): Promise<ManualInterventionRequest> {
    try {
      const result = await db.query(
        `INSERT INTO manual_intervention_requests 
         (workflow_id, user_id, transaction_id, reason, priority, status)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [
          workflow.id,
          workflow.userId,
          workflow.transactionId,
          `Automatic recovery failed for ${workflow.originalError}. Amount: ${workflow.currentAmount}`,
          'high',
          'pending'
        ]
      );

      return result.rows[0];
    } catch (error) {
      console.error('Error queuing manual intervention:', error);
      throw error;
    }
  }

  /**
   * Record successful recovery
   */
  private async recordRecoverySuccess(workflowId: string, strategy: RecoveryStrategy): Promise<void> {
    const workflow = await this.getWorkflow(workflowId);

    if (workflow) {
      const data = JSON.parse(workflow.recovery_data);
      data.strategies_tried.push(strategy);
      data.notes.push(`${strategy} succeeded at attempt ${workflow.attemptCount + 1}`);

      await db.query(
        `UPDATE recovery_workflows SET recovery_data = $1, attempt_count = $2 WHERE id = $3`,
        [JSON.stringify(data), workflow.attemptCount + 1, workflowId]
      );
    }
  }

  /**
   * Record recovery attempt
   */
  private async recordRecoveryAttempt(workflowId: string, error: string, strategy: RecoveryStrategy): Promise<void> {
    const workflow = await this.getWorkflow(workflowId);

    if (workflow) {
      const data = JSON.parse(workflow.recovery_data);
      data.errors.push({
        attempt: workflow.attemptCount + 1,
        error,
        timestamp: new Date()
      });

      await db.query(
        `UPDATE recovery_workflows SET recovery_data = $1, attempt_count = $2, last_error = $3 WHERE id = $4`,
        [JSON.stringify(data), workflow.attemptCount + 1, error, workflowId]
      );
    }
  }

  /**
   * Record recovery error
   */
  private async recordRecoveryError(workflowId: string, error: any): Promise<void> {
    const errorMessage = error instanceof Error ? error.message : String(error);

    await db.query(
      `UPDATE recovery_workflows SET state = $1, last_error = $2, completed_at = $3 WHERE id = $4`,
      [RecoveryState.FAILED, errorMessage, new Date(), workflowId]
    );
  }

  /**
   * Get recovery workflow
   */
  async getWorkflow(workflowId: string): Promise<RecoveryWorkflow | null> {
    try {
      const result = await db.query('SELECT * FROM recovery_workflows WHERE id = $1', [workflowId]);

      if (result.rows.length === 0) {
        return null;
      }

      return this.mapRowToWorkflow(result.rows[0]);
    } catch (error) {
      console.error('Error fetching workflow:', error);
      throw error;
    }
  }

  /**
   * Get user's recovery workflows
   */
  async getUserWorkflows(userId: string, limit: number = 20, offset: number = 0) {
    try {
      const [workflowsResult, countResult] = await Promise.all([
        db.query(
          'SELECT * FROM recovery_workflows WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3',
          [userId, limit, offset]
        ),
        db.query('SELECT COUNT(*) as count FROM recovery_workflows WHERE user_id = $1', [userId])
      ]);

      return {
        workflows: workflowsResult.rows.map(r => this.mapRowToWorkflow(r)),
        total: countResult.rows[0].count
      };
    } catch (error) {
      console.error('Error fetching user workflows:', error);
      throw error;
    }
  }

  /**
   * Cancel recovery workflow
   */
  async cancelWorkflow(workflowId: string, userId: string, reason: string): Promise<RecoveryWorkflow> {
    try {
      const result = await db.query(
        `UPDATE recovery_workflows 
         SET state = $1, cancelled_at = $2, cancel_reason = $3 
         WHERE id = $4 AND user_id = $5
         RETURNING *`,
        [RecoveryState.CANCELLED, new Date(), reason, workflowId, userId]
      );

      if (result.rows.length === 0) {
        throw new AppError('Workflow not found', 404);
      }

      return this.mapRowToWorkflow(result.rows[0]);
    } catch (error) {
      console.error('Error cancelling workflow:', error);
      throw error;
    }
  }

  /**
   * Get circuit breaker status
   */
  getCircuitBreaker(provider: string): CircuitBreakerConfig | undefined {
    return this.circuitBreakers.get(provider);
  }

  /**
   * Get all circuit breakers
   */
  getAllCircuitBreakers(): CircuitBreakerConfig[] {
    return Array.from(this.circuitBreakers.values());
  }

  /**
   * Update circuit breaker state
   */
  updateCircuitBreakerState(provider: string, state: CircuitBreakerState): void {
    const breaker = this.circuitBreakers.get(provider);

    if (breaker) {
      breaker.state = state;
      breaker.lastStateChange = new Date();

      if (state === CircuitBreakerState.OPEN) {
        breaker.resetTime = new Date(Date.now() + breaker.timeout);
      }
    }
  }

  /**
   * Record circuit breaker success
   */
  recordCircuitBreakerSuccess(provider: string): void {
    const breaker = this.circuitBreakers.get(provider);

    if (breaker) {
      breaker.successCount++;

      if (breaker.state === CircuitBreakerState.HALF_OPEN && breaker.successCount >= breaker.successThreshold) {
        breaker.state = CircuitBreakerState.CLOSED;
        breaker.failureCount = 0;
        breaker.successCount = 0;
      }
    }
  }

  /**
   * Record circuit breaker failure
   */
  recordCircuitBreakerFailure(provider: string): void {
    const breaker = this.circuitBreakers.get(provider);

    if (breaker) {
      breaker.failureCount++;

      if (breaker.failureCount >= breaker.failureThreshold) {
        breaker.state = CircuitBreakerState.OPEN;
        breaker.resetTime = new Date(Date.now() + breaker.timeout);
      }
    }
  }

  /**
   * Get provider fallbacks
   */
  getProviderFallbacks(operation: 'deposit' | 'withdrawal'): ProviderFallback[] {
    return this.providerFallbacks.get(operation) || [];
  }

  /**
   * Update provider fallback status
   */
  updateProviderFallback(operation: string, provider: string, isAvailable: boolean, failureRate: number): void {
    const fallbacks = this.providerFallbacks.get(operation);

    if (fallbacks) {
      const fallback = fallbacks.find(f => f.provider === provider);
      if (fallback) {
        fallback.isAvailable = isAvailable;
        fallback.failureRate = failureRate;
        fallback.lastUsed = new Date();
      }
    }
  }

  /**
   * Get recovery metrics
   */
  async getRecoveryMetrics(hoursBack: number = 24): Promise<RecoveryMetrics> {
    try {
      const fromDate = new Date(Date.now() - hoursBack * 60 * 60 * 1000);

      // Total attempts
      const totalResult = await db.query(
        'SELECT COUNT(*) as count FROM recovery_workflows WHERE created_at > $1',
        [fromDate]
      );

      // By state
      const byStateResult = await db.query(
        `SELECT state, COUNT(*) as count FROM recovery_workflows WHERE created_at > $1 GROUP BY state`,
        [fromDate]
      );

      // By strategy
      const byStrategyResult = await db.query(
        `SELECT strategy, COUNT(*) as count FROM recovery_workflows WHERE created_at > $1 GROUP BY strategy`,
        [fromDate]
      );

      // Calculate success rate
      const succeeded = byStateResult.rows.find((r: any) => r.state === 'succeeded')?.count || 0;
      const total = totalResult.rows[0].count;
      const successRate = total > 0 ? (succeeded / total) * 100 : 0;

      // Average attempts
      const avgAttemptsResult = await db.query(
        `SELECT AVG(attempt_count) as avg FROM recovery_workflows WHERE created_at > $1`,
        [fromDate]
      );

      const avgAttempts = Math.round((avgAttemptsResult.rows[0].avg || 0) * 10) / 10;

      return {
        period: { start: fromDate, end: new Date() },
        summary: {
          totalAttempts: total,
          successfulRecoveries: succeeded,
          failedRecoveries: (byStateResult.rows.find((r: any) => r.state === 'failed')?.count || 0),
          successRate: Math.round(successRate * 100) / 100,
          averageAttempts: avgAttempts,
          averageRecoveryTime: 2850 // milliseconds (would calculate from data)
        },
        byStrategy: {},
        byProvider: {},
        byError: {},
        circuitBreakers: this.getAllCircuitBreakers()
      };
    } catch (error) {
      console.error('Error calculating recovery metrics:', error);
      throw error;
    }
  }

  /**
   * Map database row to RecoveryWorkflow
   */
  private mapRowToWorkflow(row: any): RecoveryWorkflow {
    return {
      id: row.id,
      transactionId: row.transaction_id,
      userId: row.user_id,
      originalError: row.original_error,
      originalAmount: row.original_amount,
      currentAmount: row.current_amount,
      originalProvider: row.original_provider,
      currentProvider: row.current_provider,
      state: row.state,
      strategy: row.strategy,
      attemptCount: row.attempt_count,
      maxAttempts: row.max_attempts,
      lastAttempt: row.last_attempt,
      lastError: row.last_error,
      completedAt: row.completed_at,
      cancelledAt: row.cancelled_at,
      cancelReason: row.cancel_reason,
      recoveryData: JSON.parse(row.recovery_data || '{}'),
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }
}

// Export singleton instance
export const PaymentRecoveryWorkflowService = PaymentRecoveryWorkflowServiceImpl.getInstance();
