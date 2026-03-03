/**
 * Automatic Phase Manager
 * 
 * Manages automatic progression through discovery phases:
 * Phase 1 (100 pairs) → Phase 2 (500 pairs) → Phase 3 (2000+ pairs)
 * 
 * Also supports manual trigger for scans
 */

import { logger } from '../utils/logger';
import { EventEmitter } from 'events';

export interface PhaseConfig {
  phase: number;
  name: string;
  pairsPerExchange: number;
  scanInterval: string; // Cron-like: '0 0 * * *' for daily at midnight
  autoProgressAfterMs: number; // Auto-progress after this duration
  parallelExchanges: number;
  batchSize: number;
  estimatedTimeMs: number;
  enabled: boolean;
}

export interface PhaseProgress {
  phase: number;
  status: 'not-started' | 'in-progress' | 'completed';
  startedAt?: number;
  completedAt?: number;
  totalPairs: number;
  exchangesCompleted: number;
  totalExchanges: number;
  lastError?: string;
  nextPhaseEligibleAt?: number;
}

class AutomaticPhaseManager extends EventEmitter {
  private currentPhase: number = 1;
  private phaseProgress: Map<number, PhaseProgress> = new Map();
  private phaseScanTimer: NodeJS.Timer | null = null;
  private autoProgressTimer: Map<number, NodeJS.Timer> = new Map();
  private isInitialized: boolean = false;

  // Phase configuration - adjust these for your needs
  private readonly PHASE_CONFIGS: PhaseConfig[] = [
    {
      phase: 1,
      name: 'Initial Discovery',
      pairsPerExchange: 100,
      scanInterval: '0 0 * * *', // Daily at midnight
      autoProgressAfterMs: 24 * 60 * 60 * 1000, // 24 hours
      parallelExchanges: 3,
      batchSize: 20,
      estimatedTimeMs: 5 * 60 * 1000, // 5 minutes
      enabled: true
    },
    {
      phase: 2,
      name: 'Extended Discovery',
      pairsPerExchange: 500,
      scanInterval: '0 2 * * 0', // Weekly Sunday 2 AM
      autoProgressAfterMs: 7 * 24 * 60 * 60 * 1000, // 7 days
      parallelExchanges: 2,
      batchSize: 50,
      estimatedTimeMs: 12 * 60 * 1000, // 12 minutes
      enabled: false
    },
    {
      phase: 3,
      name: 'Full Market Coverage',
      pairsPerExchange: 2000,
      scanInterval: '0 0 * * 0', // Weekly Sunday midnight
      autoProgressAfterMs: 0, // No auto-progress from Phase 3
      parallelExchanges: 1,
      batchSize: 100,
      estimatedTimeMs: 30 * 60 * 1000, // 30 minutes
      enabled: false
    }
  ];

  constructor() {
    super();
  }

  /**
   * Initialize phase manager
   * Loads previous state and starts timers
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    logger.info('🚀 Initializing Automatic Phase Manager...');

    try {
      // Initialize phase tracking
      for (const config of this.PHASE_CONFIGS) {
        this.phaseProgress.set(config.phase, {
          phase: config.phase,
          status: 'not-started',
          totalPairs: 0,
          exchangesCompleted: 0,
          totalExchanges: 6 // Binance, Kraken, Coinbase, Bybit, KuCoin, OKX
        });
      }

      // Load Phase 1 immediately
      await this.startPhase(1);

      this.isInitialized = true;
      logger.info('✅ Phase Manager initialized - Phase 1 started');
    } catch (error: any) {
      logger.error('❌ Phase Manager initialization failed:', error.message);
      throw error;
    }
  }

  /**
   * Get current phase
   */
  getCurrentPhase(): number {
    return this.currentPhase;
  }

  /**
   * Get phase configuration
   */
  getPhaseConfig(phase: number): PhaseConfig | null {
    return this.PHASE_CONFIGS[phase - 1] || null;
  }

  /**
   * Get progress for a phase
   */
  getPhaseProgress(phase: number): PhaseProgress | null {
    return this.phaseProgress.get(phase) || null;
  }

  /**
   * Get all phases progress
   */
  getAllPhasesProgress(): PhaseProgress[] {
    return Array.from(this.phaseProgress.values());
  }

  /**
   * Manually trigger a scan at current phase
   * Returns estimated time until completion
   */
  async triggerManualScan(): Promise<{
    phase: number;
    estimatedDurationMs: number;
    estimatedCompletionTime: Date;
  }> {
    logger.info(`👤 Manual scan triggered for Phase ${this.currentPhase}`);

    const config = this.getPhaseConfig(this.currentPhase);
    if (!config) {
      throw new Error(`Invalid phase: ${this.currentPhase}`);
    }

    // Emit event for scanner to pick up
    this.emit('manual-scan-request', {
      phase: this.currentPhase,
      timestamp: Date.now()
    });

    return {
      phase: this.currentPhase,
      estimatedDurationMs: config.estimatedTimeMs,
      estimatedCompletionTime: new Date(Date.now() + config.estimatedTimeMs)
    };
  }

  /**
   * Manually trigger a scan for specific phase
   */
  async triggerPhaseScanning(phase: number): Promise<{
    phase: number;
    estimatedDurationMs: number;
    estimatedCompletionTime: Date;
  }> {
    const config = this.getPhaseConfig(phase);
    if (!config) {
      throw new Error(`Invalid phase: ${phase}`);
    }

    logger.info(`👤 Manual phase scan triggered for Phase ${phase}`);

    this.emit('phase-scan-request', {
      phase,
      timestamp: Date.now()
    });

    return {
      phase,
      estimatedDurationMs: config.estimatedTimeMs,
      estimatedCompletionTime: new Date(Date.now() + config.estimatedTimeMs)
    };
  }

  /**
   * Called when phase scanning completes
   * Automatically triggers auto-progress if configured
   */
  async onPhaseCompleted(phase: number, totalPairs: number): Promise<void> {
    const progress = this.phaseProgress.get(phase);
    if (!progress) return;

    // Update progress
    progress.status = 'completed';
    progress.completedAt = Date.now();
    progress.totalPairs = totalPairs;
    progress.exchangesCompleted = 6; // All exchanges

    logger.info(`✅ Phase ${phase} completed: ${totalPairs} pairs discovered`);

    // Emit completion event
    this.emit('phase-completed', {
      phase,
      totalPairs,
      timestamp: Date.now()
    });

    // Auto-progress to next phase if configured
    const config = this.getPhaseConfig(phase);
    if (config && config.autoProgressAfterMs > 0) {
      const nextPhase = phase + 1;
      const nextConfig = this.getPhaseConfig(nextPhase);

      if (nextConfig && nextConfig.enabled) {
        logger.info(
          `⏱️ Auto-progressing to Phase ${nextPhase} in ${config.autoProgressAfterMs}ms...`
        );

        // Set timer for auto-progression
        const timer = setTimeout(async () => {
          try {
            await this.startPhase(nextPhase);
          } catch (error: any) {
            logger.error(
              `❌ Auto-progression to Phase ${nextPhase} failed:`,
              error.message
            );
          }
        }, config.autoProgressAfterMs);

        this.autoProgressTimer.set(phase, timer);

        // Mark when eligible for next phase
        progress.nextPhaseEligibleAt = Date.now() + config.autoProgressAfterMs;
      }
    }
  }

  /**
   * Start phase scanning
   */
  private async startPhase(phase: number): Promise<void> {
    const config = this.getPhaseConfig(phase);
    if (!config || !config.enabled) {
      logger.warn(`Phase ${phase} is disabled`);
      return;
    }

    const progress = this.phaseProgress.get(phase)!;
    progress.status = 'in-progress';
    progress.startedAt = Date.now();

    this.currentPhase = phase;

    logger.info(`
🔍 Starting Phase ${phase}: ${config.name}
   ├─ Pairs per exchange: ${config.pairsPerExchange}
   ├─ Estimated duration: ${config.estimatedTimeMs}ms
   └─ Parallel exchanges: ${config.parallelExchanges}
    `);

    // Emit event for scanner to start
    this.emit('phase-start', {
      phase,
      config,
      timestamp: Date.now()
    });
  }

  /**
   * Mark phase as in progress and update progress
   */
  reportProgress(
    phase: number,
    exchangesCompleted: number,
    totalExchanges: number
  ): void {
    const progress = this.phaseProgress.get(phase);
    if (progress) {
      progress.exchangesCompleted = exchangesCompleted;
      progress.totalExchanges = totalExchanges;

      if (exchangesCompleted % 2 === 0) {
        logger.debug(
          `Phase ${phase} progress: ${exchangesCompleted}/${totalExchanges} exchanges`
        );
      }
    }
  }

  /**
   * Report phase error
   */
  reportError(phase: number, error: string): void {
    const progress = this.phaseProgress.get(phase);
    if (progress) {
      progress.lastError = error;
      logger.error(`Phase ${phase} error: ${error}`);
    }
  }

  /**
   * Jump to a specific phase (admin only)
   * Cancels any pending auto-progression
   */
  async jumpToPhase(phase: number): Promise<void> {
    if (phase < 1 || phase > 3) {
      throw new Error('Invalid phase: must be 1, 2, or 3');
    }

    logger.warn(`⚠️ Jumping to Phase ${phase} (admin override)`);

    // Cancel any pending auto-progression
    const pendingTimer = this.autoProgressTimer.get(phase - 1);
    if (pendingTimer) {
      clearTimeout(pendingTimer as any);
      this.autoProgressTimer.delete(phase - 1);
    }

    // Reset any in-progress states
    for (const [phaseNum, progress] of this.phaseProgress) {
      if (phaseNum < phase && progress.status === 'in-progress') {
        progress.status = 'completed';
      }
    }

    await this.startPhase(phase);
  }

  /**
   * Get status dashboard
   */
  getDashboard() {
    return {
      currentPhase: this.currentPhase,
      isInitialized: this.isInitialized,
      phases: this.PHASE_CONFIGS.map(config => ({
        phase: config.phase,
        name: config.name,
        enabled: config.enabled,
        pairsPerExchange: config.pairsPerExchange,
        estimatedDurationMs: config.estimatedTimeMs,
        progress: this.phaseProgress.get(config.phase)
      }))
    };
  }
}

export const automaticPhaseManager = new AutomaticPhaseManager();
