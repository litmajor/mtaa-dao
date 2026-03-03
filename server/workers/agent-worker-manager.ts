/**
 * 🏗️ Agent Worker Manager
 * 
 * Spawns and manages the isolated agent worker process/thread
 * 
 * Main server calls this to:
 * - Start/stop agent worker
 * - Query agent data (get stats, health, forecasts)
 * - Monitor worker health
 * 
 * Benefits over inline agents:
 * ✅ API process remains responsive
 * ✅ Agent crashes don't kill API
 * ✅ Can restart agents independently
 * ✅ Easy to monitor memory/CPU usage
 * ✅ Can run on separate server if needed
 */

import { fork, ChildProcess } from 'child_process';
import path from 'path';
import { Logger } from '../utils/logger';

const logger = Logger.getLogger();

export class AgentWorkerManager {
  private worker: ChildProcess | null = null;
  private isRunning = false;
  private startTime: Date | null = null;
  private messageHandlers: Map<string, (data: any) => void> = new Map();
  private pendingRequests: Map<string, (data: any) => void> = new Map();
  private requestIdCounter = 0;

  /**
   * Start the agent worker
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn('[AGENT_MANAGER] Worker already running');
      return;
    }

    try {
      logger.info('[AGENT_MANAGER] Starting agent worker...');

      // Spawn worker process
      const workerPath = path.resolve(__dirname, 'agent-worker.ts');
      const agentPort = parseInt(process.env.AGENT_PORT || process.env.PORT || '5000');
      const agentHost = process.env.AGENT_HOST || 'localhost';
      const agentBaseUrl = process.env.AGENT_BASE_URL || `http://${agentHost}:${agentPort}`;
      
      this.worker = fork(workerPath, [], {
        silent: false, // Show worker logs
        env: {
          ...process.env,
          AGENT_BASE_URL: agentBaseUrl,
          AGENT_PERF_INTERVAL: process.env.AGENT_PERF_INTERVAL || '120000',
          AGENT_DOMAIN_INTERVAL: process.env.AGENT_DOMAIN_INTERVAL || '300000',
          AGENT_CAPACITY_INTERVAL: process.env.AGENT_CAPACITY_INTERVAL || '600000',
          AGENT_HEALTH_INTERVAL: process.env.AGENT_HEALTH_INTERVAL || '15000',
        },
      });

      // Setup message handling
      this.worker.on('message', (message) => this.handleWorkerMessage(message));
      this.worker.on('error', (error) => this.handleWorkerError(error));
      this.worker.on('exit', (code, signal) => this.handleWorkerExit(code, signal));

      this.isRunning = true;
      this.startTime = new Date();

      logger.info('[AGENT_MANAGER] ✅ Agent worker started (PID: ' + this.worker.pid + ')');
    } catch (error) {
      logger.error('[AGENT_MANAGER] Failed to start agent worker:', error);
      this.isRunning = false;
      throw error;
    }
  }

  /**
   * Stop the agent worker gracefully
   */
  async stop(): Promise<void> {
    if (!this.isRunning || !this.worker) return;

    logger.info('[AGENT_MANAGER] Stopping agent worker...');

    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        logger.warn('[AGENT_MANAGER] Worker kill timeout, forcing...');
        this.worker?.kill('SIGKILL');
        resolve();
      }, 5000);

      this.sendMessage({ type: 'stop' }, (response) => {
        clearTimeout(timeout);
        this.isRunning = false;
        resolve();
      });
    });
  }

  /**
   * Get performance optimizer stats
   */
  async getPerformanceStats(): Promise<any> {
    return this.sendMessageAndWait({ type: 'get-perf-stats' }, 'perf-stats-response');
  }

  /**
   * Get domain health
   */
  async getDomainHealth(domain?: string): Promise<any> {
    return this.sendMessageAndWait(
      { type: 'get-domain-health', domain },
      'domain-health-response'
    );
  }

  /**
   * Get capacity forecast
   */
  async getCapacityForecast(): Promise<any> {
    return this.sendMessageAndWait(
      { type: 'get-capacity-forecast' },
      'capacity-forecast-response'
    );
  }

  /**
   * Get worker health
   */
  async getWorkerHealth(): Promise<any> {
    return this.sendMessageAndWait({ type: 'get-agent-health' }, 'agent-worker-health');
  }

  // ════════════════════════════════════════════════════════════════════════════════
  // Private: Message Handling
  // ════════════════════════════════════════════════════════════════════════════════

  private sendMessage(message: any, callback?: (response: any) => void): void {
    if (!this.worker || !this.isRunning) {
      logger.warn('[AGENT_MANAGER] Worker not running');
      callback?.(null);
      return;
    }

    // Add tracking for async responses
    if (callback) {
      const messageId = `req_${++this.requestIdCounter}`;
      message._id = messageId;
      this.pendingRequests.set(messageId, callback);

      // Timeout after 10 seconds
      setTimeout(() => {
        if (this.pendingRequests.has(messageId)) {
          this.pendingRequests.delete(messageId);
          logger.warn(`[AGENT_MANAGER] Request ${messageId} timed out`);
          callback(null);
        }
      }, 10000);
    }

    try {
      this.worker.send(message);
    } catch (error) {
      logger.error('[AGENT_MANAGER] Failed to send message to worker:', error);
      callback?.(null);
    }
  }

  private async sendMessageAndWait(message: any, responseType: string): Promise<any> {
    return new Promise((resolve) => {
      this.sendMessage(message, (response) => {
        resolve(response?.data);
      });
    });
  }

  private handleWorkerMessage(message: any): void {
    if (!message || !message.type) return;

    // Handle pending request responses
    if (message._id && this.pendingRequests.has(message._id)) {
      const callback = this.pendingRequests.get(message._id);
      this.pendingRequests.delete(message._id);
      callback?.(message);
      return;
    }

    // Log other messages
    if (message.type !== 'agent-worker-health') {
      logger.info('[AGENT_MANAGER] Worker message:', message.type);
    }

    // Store message handlers if needed
    const handler = this.messageHandlers.get(message.type);
    handler?.(message);
  }

  private handleWorkerError(error: Error): void {
    logger.error('[AGENT_MANAGER] Worker error:', error);
  }

  private handleWorkerExit(code: number | null, signal: string | null): void {
    logger.warn('[AGENT_MANAGER] Worker exited', { code, signal });
    this.isRunning = false;

    // Auto-restart on crash
    if (code !== 0 && signal !== 'SIGTERM') {
      logger.info('[AGENT_MANAGER] Restarting worker after crash...');
      setTimeout(() => this.start().catch((e) => logger.error('[AGENT_MANAGER] Restart failed:', e)), 5000);
    }
  }
}

// Singleton instance
let managerInstance: AgentWorkerManager | null = null;

export function getAgentWorkerManager(): AgentWorkerManager {
  if (!managerInstance) {
    managerInstance = new AgentWorkerManager();
  }
  return managerInstance;
}

export function initAgentWorkerManager(): AgentWorkerManager {
  return getAgentWorkerManager();
}
