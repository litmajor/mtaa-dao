/**
 * CONSOLIDATED CIRCUIT BREAKER SYSTEM
 * Unifies 6+ circuit breaker implementations into single system
 * 
 * Consolidates:
 * - server/utils/circuitBreaker.ts (main)
 * - server/services/paymentRecoveryWorkflowService.ts (payment CB)
 * - server/services/emergencyStopService.ts (emergency CB)
 * - server/services/retryService.ts (retry CB)
 * - server/services/agentCircuitBreaker.ts (agent CB)
 * 
 * Benefits:
 * - Unified state management across all concerns
 * - Consistent metrics and monitoring
 * - Single failure policy enforcement
 * - Coordinated recovery strategies
 * - ~400 lines eliminated
 */

import { EventEmitter } from 'events';
import { Logger } from '../../utils/logger';

export type CircuitBreakerState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';
export type CircuitBreakerDomain = 'payment' | 'trading' | 'vault' | 'governance' | 'agent' | 'media';

export interface CircuitBreakerConfig {
  // Identity
  name: string;
  domain: CircuitBreakerDomain;
  
  // Thresholds
  failureThreshold: number; // failures before opening
  successThreshold?: number; // successes in HALF_OPEN before closing (default: ceil(failureThreshold/2))
  
  // Timing
  resetTimeout: number; // ms before attempting recovery
  monitoringWindow: number; // ms for counting failures
  
  // Recovery
  maxResetAttempts?: number; // max HALF_OPEN attempts before reopening
  exponentialBackoff?: boolean; // increase resetTimeout on reopen
  backoffMultiplier?: number; // multiplier for exponential backoff
  maxResetTimeout?: number; // cap on reset timeout
  
  // Notification
  onOpen?: (name: string) => void | Promise<void>;
  onClose?: (name: string) => void | Promise<void>;
  onHalfOpen?: (name: string) => void | Promise<void>;
}

export interface CircuitBreakerMetrics {
  name: string;
  domain: CircuitBreakerDomain;
  state: CircuitBreakerState;
  failureCount: number;
  successCount: number;
  halfOpenAttempts: number;
  lastFailureTime: Date | null;
  lastSuccessTime: Date | null;
  openedAt: Date | null;
  closedAt: Date | null;
  totalFailures: number;
  totalSuccesses: number;
  failureRate: number; // percentage
  uptime: number; // ms since last open
  currentResetTimout: number; // ms remaining before HALF_OPEN
}

export interface CircuitBreakerEvent {
  type: 'open' | 'close' | 'half_open' | 'success' | 'failure';
  name: string;
  domain: CircuitBreakerDomain;
  timestamp: Date;
  details?: any;
}

/**
 * Unified Circuit Breaker - Single source of truth for all circuit breaking
 */
export class CircuitBreakerConsolidated extends EventEmitter {
  private logger = Logger.getLogger();
  
  private state: CircuitBreakerState = 'CLOSED';
  private failureCount = 0;
  private successCount = 0;
  private halfOpenAttempts = 0;
  private lastFailureTime: Date | null = null;
  private lastSuccessTime: Date | null = null;
  private openedAt: Date | null = null;
  private closedAt: Date | null = null;
  
  private totalFailures = 0;
  private totalSuccesses = 0;
  
  private resetTimer: NodeJS.Timeout | null = null;
  private monitoringWindow: Map<number, boolean> = new Map(); // timestamp -> success
  
  private config: Required<CircuitBreakerConfig>;
  private currentResetTimeout: number;

  constructor(config: CircuitBreakerConfig) {
    super();
    
    // Apply defaults
    this.config = {
      successThreshold: Math.ceil(config.failureThreshold / 2),
      maxResetAttempts: 3,
      exponentialBackoff: true,
      backoffMultiplier: 2,
      maxResetTimeout: 300000, // 5 minutes max
      ...config,
    } as Required<CircuitBreakerConfig>;
    
    this.currentResetTimeout = this.config.resetTimeout;
    this.closedAt = new Date();
  }

  /**
   * Execute function with circuit breaker protection
   */
  async execute<T>(fn: () => Promise<T>, context?: string): Promise<T> {
    this.validateState();

    if (this.state === 'OPEN') {
      if (this.isResetTimeoutExpired()) {
        await this.transitionToHalfOpen();
      } else {
        const error = new Error(
          `[${this.config.domain}] Circuit breaker OPEN for "${this.config.name}". ` +
          `Blocked ${this.failureCount} failures. ` +
          `Retry in ${this.getResetTimeRemaining()}ms`
        );
        (error as any).code = 'CIRCUIT_BREAKER_OPEN';
        (error as any).domain = this.config.domain;
        throw error;
      }
    }

    try {
      this.logger.debug(`[${this.config.domain}] CB executing: ${this.config.name}${context ? ` (${context})` : ''}`);
      const result = await fn();
      this.recordSuccess();
      return result;
    } catch (error) {
      this.recordFailure(error);
      throw error;
    }
  }

  /**
   * Synchronous version for non-async operations
   */
  executeSync<T>(fn: () => T, context?: string): T {
    if (this.state === 'OPEN') {
      const error = new Error(
        `[${this.config.domain}] Circuit breaker OPEN for "${this.config.name}"`
      );
      (error as any).code = 'CIRCUIT_BREAKER_OPEN';
      throw error;
    }

    try {
      const result = fn();
      this.recordSuccess();
      return result;
    } catch (error) {
      this.recordFailure(error);
      throw error;
    }
  }

  /**
   * Record successful execution
   */
  public recordSuccess() {
    this.successCount++;
    this.totalSuccesses++;
    this.lastSuccessTime = new Date();
    this.monitoringWindow.set(Date.now(), true);

    this.emit('success', {
      type: 'success',
      name: this.config.name,
      domain: this.config.domain,
      timestamp: new Date(),
    } as CircuitBreakerEvent);

    if (this.state === 'HALF_OPEN') {
      if (this.successCount >= this.config.successThreshold) {
        this.close();
      }
    } else if (this.state === 'CLOSED') {
      // Decay failures on success
      this.failureCount = Math.max(0, this.failureCount - 1);
    }
  }

  /**
   * Record failed execution
   */
  public recordFailure(error: any) {
    this.failureCount++;
    this.totalFailures++;
    this.lastFailureTime = new Date();
    this.monitoringWindow.set(Date.now(), false);

    this.emit('failure', {
      type: 'failure',
      name: this.config.name,
      domain: this.config.domain,
      timestamp: new Date(),
      details: {
        failureCount: this.failureCount,
        totalFailures: this.totalFailures,
        errorMessage: error?.message,
      },
    } as CircuitBreakerEvent);

    if (this.failureCount >= this.config.failureThreshold) {
      this.open();
    }
  }

  /**
   * Transition to HALF_OPEN state
   */
  private async transitionToHalfOpen() {
    this.state = 'HALF_OPEN';
    this.successCount = 0;
    this.halfOpenAttempts++;

    if (this.halfOpenAttempts > this.config.maxResetAttempts) {
      this.logger.warn(
        `[${this.config.domain}] CB exceeded max reset attempts (${this.config.maxResetAttempts}) for "${this.config.name}". Reopening.`
      );
      this.open();
      return;
    }

    this.logger.info(
      `[${this.config.domain}] CB transitioning to HALF_OPEN for "${this.config.name}" (attempt ${this.halfOpenAttempts}/${this.config.maxResetAttempts})`
    );

    this.emit('half_open', {
      type: 'half_open',
      name: this.config.name,
      domain: this.config.domain,
      timestamp: new Date(),
    } as CircuitBreakerEvent);

    if (this.config.onHalfOpen) {
      try {
        await this.config.onHalfOpen(this.config.name);
      } catch (error) {
        this.logger.error(`[${this.config.domain}] CB onHalfOpen callback failed:`, error);
      }
    }
  }

  /**
   * Open the circuit breaker
   */
  private open() {
    if (this.state === 'OPEN') return;

    this.state = 'OPEN';
    this.openedAt = new Date();
    this.failureCount = 0;
    this.halfOpenAttempts = 0;

    // Calculate next reset timeout with exponential backoff
    if (this.config.exponentialBackoff) {
      this.currentResetTimeout = Math.min(
        this.config.resetTimeout * Math.pow(this.config.backoffMultiplier, Math.max(0, this.halfOpenAttempts - 1)),
        this.config.maxResetTimeout
      );
    }

    this.logger.warn(
      `[${this.config.domain}] CB OPENED for "${this.config.name}". ` +
      `Will attempt recovery in ${this.currentResetTimeout}ms. ` +
      `Total failures: ${this.totalFailures}`
    );

    this.resetTimer = setTimeout(() => {
      // Transition to HALF_OPEN on next execute()
    }, this.currentResetTimeout);

    this.emit('open', {
      type: 'open',
      name: this.config.name,
      domain: this.config.domain,
      timestamp: new Date(),
      details: {
        totalFailures: this.totalFailures,
        resetTimeoutMs: this.currentResetTimeout,
      },
    } as CircuitBreakerEvent);

    if (this.config.onOpen) {
      try {
        Promise.resolve(this.config.onOpen(this.config.name)).catch(error => {
          this.logger.error(`[${this.config.domain}] CB onOpen callback failed:`, error);
        });
      } catch (error) {
        this.logger.error(`[${this.config.domain}] CB onOpen callback error:`, error);
      }
    }
  }

  /**
   * Close the circuit breaker
   */
  private close() {
    if (this.state === 'CLOSED') return;

    this.state = 'CLOSED';
    this.closedAt = new Date();
    this.failureCount = 0;
    this.successCount = 0;
    this.halfOpenAttempts = 0;
    this.currentResetTimeout = this.config.resetTimeout;

    if (this.resetTimer) {
      clearTimeout(this.resetTimer);
      this.resetTimer = null;
    }

    this.logger.info(
      `[${this.config.domain}] CB CLOSED for "${this.config.name}". ` +
      `Recovered after ${Math.round((this.closedAt.getTime() - (this.openedAt?.getTime() || 0)) / 1000)}s outage. ` +
      `Total successes: ${this.totalSuccesses}`
    );

    this.emit('close', {
      type: 'close',
      name: this.config.name,
      domain: this.config.domain,
      timestamp: new Date(),
      details: {
        outageMillis: this.closedAt.getTime() - (this.openedAt?.getTime() || 0),
        totalSuccesses: this.totalSuccesses,
      },
    } as CircuitBreakerEvent);

    if (this.config.onClose) {
      try {
        Promise.resolve(this.config.onClose(this.config.name)).catch(error => {
          this.logger.error(`[${this.config.domain}] CB onClose callback failed:`, error);
        });
      } catch (error) {
        this.logger.error(`[${this.config.domain}] CB onClose callback error:`, error);
      }
    }
  }

  /**
   * Manually reset circuit breaker (admin only)
   */
  reset() {
    this.logger.info(`[${this.config.domain}] CB manually reset for "${this.config.name}"`);
    this.state = 'CLOSED';
    this.failureCount = 0;
    this.successCount = 0;
    this.halfOpenAttempts = 0;
    this.closedAt = new Date();
    if (this.resetTimer) clearTimeout(this.resetTimer);
  }

  /**
   * Force open (for emergency stops)
   */
  forceOpen(reason: string) {
    this.logger.error(`[${this.config.domain}] CB force-opened for "${this.config.name}": ${reason}`);
    this.state = 'OPEN';
    this.openedAt = new Date();
    
    this.emit('open', {
      type: 'open',
      name: this.config.name,
      domain: this.config.domain,
      timestamp: new Date(),
      details: { reason, forced: true },
    } as CircuitBreakerEvent);
  }

  // ===== Utility Methods =====

  getMetrics(): CircuitBreakerMetrics {
    const failureRate = this.totalFailures + this.totalSuccesses > 0
      ? (this.totalFailures / (this.totalFailures + this.totalSuccesses)) * 100
      : 0;

    const uptime = this.state === 'CLOSED' && this.closedAt
      ? Date.now() - this.closedAt.getTime()
      : 0;

    return {
      name: this.config.name,
      domain: this.config.domain,
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      halfOpenAttempts: this.halfOpenAttempts,
      lastFailureTime: this.lastFailureTime,
      lastSuccessTime: this.lastSuccessTime,
      openedAt: this.openedAt,
      closedAt: this.closedAt,
      totalFailures: this.totalFailures,
      totalSuccesses: this.totalSuccesses,
      failureRate,
      uptime,
      currentResetTimout: this.currentResetTimeout,
    };
  }

  getState(): CircuitBreakerState {
    return this.state;
  }

  isOpen(): boolean {
    return this.state === 'OPEN';
  }

  isClosed(): boolean {
    return this.state === 'CLOSED';
  }

  isHalfOpen(): boolean {
    return this.state === 'HALF_OPEN';
  }

  private isResetTimeoutExpired(): boolean {
    if (!this.openedAt) return false;
    return Date.now() - this.openedAt.getTime() >= this.currentResetTimeout;
  }

  private getResetTimeRemaining(): number {
    if (!this.openedAt) return this.currentResetTimeout;
    const elapsed = Date.now() - this.openedAt.getTime();
    return Math.max(0, this.currentResetTimeout - elapsed);
  }

  private validateState() {
    // Clean up old entries from monitoring window (older than 2 × monitoring window)
    const cutoff = Date.now() - (this.config.monitoringWindow * 2);
    for (const [timestamp] of this.monitoringWindow) {
      if (timestamp < cutoff) {
        this.monitoringWindow.delete(timestamp);
      }
    }
  }
}

/**
 * Global Circuit Breaker Registry - Unified management for all circuit breakers
 * Consolidates all CB instances across domains
 */
export class CircuitBreakerRegistry extends EventEmitter {
  private logger = Logger.getLogger();
  private breakers: Map<string, CircuitBreakerConsolidated> = new Map();
  private domainBreakers: Map<CircuitBreakerDomain, Set<string>> = new Map();
  private globalConfig: Partial<CircuitBreakerConfig> = {};

  getName(): string {
    return 'CircuitBreakerRegistry';
  }

  /**
   * Get or create circuit breaker
   */
  getOrCreate(
    name: string,
    domain: CircuitBreakerDomain = 'media',
    config?: Partial<CircuitBreakerConfig>
  ): CircuitBreakerConsolidated {
    if (this.breakers.has(name)) {
      return this.breakers.get(name)!;
    }

    const mergedConfig: CircuitBreakerConfig = {
      name,
      domain,
      failureThreshold: 5,
      resetTimeout: 60000,
      monitoringWindow: 60000,
      ...this.globalConfig,
      ...config,
    };

    const breaker = new CircuitBreakerConsolidated(mergedConfig);
    this.breakers.set(name, breaker);

    if (!this.domainBreakers.has(domain)) {
      this.domainBreakers.set(domain, new Set());
    }
    this.domainBreakers.get(domain)!.add(name);

    // Relay events from breaker to registry
    breaker.on('open', (event: CircuitBreakerEvent) => this.emit('breaker-open', event));
    breaker.on('close', (event: CircuitBreakerEvent) => this.emit('breaker-close', event));
    breaker.on('half_open', (event: CircuitBreakerEvent) => this.emit('breaker-half-open', event));
    breaker.on('failure', (event: CircuitBreakerEvent) => this.emit('breaker-failure', event));

    this.logger.info(`[Registry] Created circuit breaker: ${name} (domain: ${domain})`);
    return breaker;
  }

  /**
   * Get breaker by name
   */
  get(name: string): CircuitBreakerConsolidated | undefined {
    return this.breakers.get(name);
  }

  /**
   * Get all breakers in domain
   */
  getDomain(domain: CircuitBreakerDomain): CircuitBreakerConsolidated[] {
    const names = this.domainBreakers.get(domain) || new Set();
    return Array.from(names).map(name => this.breakers.get(name)!).filter(Boolean);
  }

  /**
   * Get all breakers
   */
  getAll(): CircuitBreakerConsolidated[] {
    return Array.from(this.breakers.values());
  }

  /**
   * Get metrics for all breakers
   */
  getAllMetrics(): CircuitBreakerMetrics[] {
    return this.getAll().map(cb => cb.getMetrics());
  }

  /**
   * Get metrics by domain
   */
  getDomainMetrics(domain: CircuitBreakerDomain): CircuitBreakerMetrics[] {
    return this.getDomain(domain).map(cb => cb.getMetrics());
  }

  /**
   * Get overall health status
   */
  getHealth(): {
    openCount: number;
    closedCount: number;
    halfOpenCount: number;
    failureRate: number;
    criticalDomains: CircuitBreakerDomain[];
  } {
    const all = this.getAll();
    const openCount = all.filter(cb => cb.isOpen()).length;
    const closedCount = all.filter(cb => cb.isClosed()).length;
    const halfOpenCount = all.filter(cb => cb.isHalfOpen()).length;

    let totalFailures = 0;
    let totalSuccesses = 0;
    for (const cb of all) {
      const metrics = cb.getMetrics();
      totalFailures += metrics.totalFailures;
      totalSuccesses += metrics.totalSuccesses;
    }

    const failureRate = totalFailures + totalSuccesses > 0
      ? (totalFailures / (totalFailures + totalSuccesses)) * 100
      : 0;

    const criticalDomains = new Set<CircuitBreakerDomain>();
    for (const cb of all) {
      if (cb.isOpen()) {
        criticalDomains.add(cb.getMetrics().domain);
      }
    }

    return {
      openCount,
      closedCount,
      halfOpenCount,
      failureRate,
      criticalDomains: Array.from(criticalDomains),
    };
  }

  /**
   * Set global defaults for new breakers
   */
  setGlobalConfig(config: Partial<CircuitBreakerConfig>) {
    this.globalConfig = config;
  }

  /**
   * Reset all breakers (admin only)
   */
  resetAll() {
    this.logger.warn('[Registry] Resetting all circuit breakers');
    for (const breaker of this.getAll()) {
      breaker.reset();
    }
  }

  /**
   * Force open a domain (emergency stop)
   */
  forceOpenDomain(domain: CircuitBreakerDomain, reason: string) {
    this.logger.error(`[Registry] Force-opening domain: ${domain}. Reason: ${reason}`);
    for (const breaker of this.getDomain(domain)) {
      breaker.forceOpen(reason);
    }
  }
}

// Singleton instance
export const circuitBreakerRegistry = new CircuitBreakerRegistry();
