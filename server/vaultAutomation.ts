import { MaonoVaultService } from "./blockchain";
import { vaultService } from "./services/vaultService";
import { db } from "./db";
import { vaults } from "../shared/schema";
import { eq } from "drizzle-orm";
import { ethers } from "ethers";
import { Logger } from "./utils/logger";
import { AppError } from "./utils/appError";

/** `VaultStatus.HIBERNATING` in contracts/MaonoVault.sol */
const VAULT_STATUS_HIBERNATING = 1;
/** Start warning about the monthly upkeep three days before it falls due. */
const UPKEEP_WARNING_WINDOW_MS = 3 * 24 * 60 * 60 * 1000;

interface AutomationTask {
  id: string;
  type: 'upkeep' | 'rebalance' | 'risk_assessment';
  priority: 'high' | 'medium' | 'low';
  scheduledAt: Date;
  retryCount: number;
  maxRetries: number;
  vaultId?: string;
  params?: any;
}

class VaultAutomationService {
  private isRunning = false;
  private tasks: AutomationTask[] = [];
  private intervalId: NodeJS.Timeout | null = null;
  private logger: Logger;

  constructor() {
    this.logger = new Logger('vault-automation');
  }

  // Start automation service
  start(): void {
    if (this.isRunning) {
      this.logger.warn('Vault automation service is already running');
      return;
    }

    this.logger.info('🚀 Starting Vault Automation Service...');

    try {
      this.isRunning = true;
      const startTime = Date.now(); // Record start time

      // Schedule regular tasks
      this.scheduleRegularTasks();

      // Process tasks every 30 seconds
      this.intervalId = setInterval(async () => {
        try {
          await this.processTasks();
        } catch (error) {
          await this.logger.securityLog(
            'Critical error in automation task processing',
            'high',
            { error: error instanceof Error ? error.message : String(error) }
          );

          // Don't stop the service entirely, but log the error
          this.logger.error('Error processing automation tasks', error);
        }
      }, 30000);

      const startupDuration = Date.now() - startTime;
      this.logger.info('✅ Vault Automation Service started successfully');
      this.logger.info(`Performance: automation_service_startup took ${startupDuration}ms`, {
        performance: true,
        operation: 'automation_service_startup',
        duration: startupDuration,
        scheduledTasks: this.tasks.length,
        intervalMs: 30000
      });

    } catch (error) {
      this.logger.error('Failed to start Vault Automation Service', error);
      this.isRunning = false;
      throw new AppError('Failed to start vault automation service', 500);
    }
  }

  // Stop automation service
  stop() {
    if (!this.isRunning) {
      this.logger.warn('Vault automation service is not running');
      return;
    }

    this.isRunning = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    this.logger.info('⏹️  Vault Automation Service stopped');
  }

  // Schedule regular automation tasks
  private scheduleRegularTasks() {
    // Only schedule upkeep monitoring if contract is configured
    if (MaonoVaultService.isConfigured()) {
      // Check the upkeep clock every hour
      this.addTask({
        id: `upkeep_${Date.now()}`,
        type: 'upkeep',
        priority: 'high',
        scheduledAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
        retryCount: 0,
      maxRetries: 3
    });
    } else {
      this.logger.warn('⚠️  Upkeep automation skipped: MaonoVault contract not configured');
      this.logger.info('   Deploy MaonoVault contract and set MAONO_CONTRACT_ADDRESS in .env to enable automation');
    }

    // Schedule vault rebalancing every 6 hours
    this.addTask({
      id: `rebalance_all_${Date.now()}`,
      type: 'rebalance',
      priority: 'medium',
      scheduledAt: new Date(Date.now() + 6 * 60 * 60 * 1000), // 6 hours
      retryCount: 0,
      maxRetries: 2
    });

    // Schedule risk assessment every 24 hours
    this.addTask({
      id: `risk_assessment_${Date.now()}`,
      type: 'risk_assessment',
      priority: 'low',
      scheduledAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
      retryCount: 0,
      maxRetries: 2
    });
  }

  // Add a new automation task
  addTask(task: AutomationTask) {
    this.tasks.push(task);
    this.tasks.sort((a, b) => {
      // Sort by priority (high first) then by scheduled time
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      }
      return a.scheduledAt.getTime() - b.scheduledAt.getTime();
    });
  }

  // Process pending tasks
  private async processTasks() {
    try {
      const now = new Date();
      const dueTasks = this.tasks.filter(task => task.scheduledAt <= now);

      if (dueTasks.length === 0) {
        return;
      }

      this.logger.info(`Processing ${dueTasks.length} due automation tasks`);

      for (const task of dueTasks) {
        const taskLogger = this.logger.child({ taskId: task.id, taskType: task.type });

        try {
          taskLogger.info(`🔄 Processing automation task: ${task.type}`);

          await this.executeTask(task);

          // Remove completed task
          this.tasks = this.tasks.filter(t => t.id !== task.id);

          taskLogger.info(`✅ Completed automation task: ${task.type}`);

        } catch (error) {
          taskLogger.error(`❌ Task failed: ${task.type}`, error);

          task.retryCount++;

          if (task.retryCount < task.maxRetries) {
            // Reschedule with exponential backoff
            const backoffMs = Math.pow(2, task.retryCount) * 60000;
            task.scheduledAt = new Date(now.getTime() + backoffMs);
            taskLogger.warn(`🔄 Rescheduling task (attempt ${task.retryCount + 1}/${task.maxRetries})`, {
              nextAttempt: task.scheduledAt.toISOString(),
              backoffMs
            });
          } else {
            // Max retries exceeded
            taskLogger.error(`💥 Task failed after ${task.maxRetries} attempts`);
            this.tasks = this.tasks.filter(t => t.id !== task.id);

            // Log critical failure for monitoring
            await this.logger.securityLog(`Task ${task.id} failed permanently`, 'medium', {
              taskType: task.type,
              vaultId: task.vaultId,
              retryCount: task.retryCount
            });
          }
        }
      }
    } catch (error) {
      this.logger.error('Error in processTasks', error);
    }
  }

  // Execute a specific automation task
  private async executeTask(task: AutomationTask) {
    switch (task.type) {
      case 'upkeep':
        await this.executeUpkeepCheck(task);
        break;

      case 'rebalance':
        await this.executeRebalancing(task);
        break;

      case 'risk_assessment':
        await this.executeRiskAssessment(task);
        break;

      default:
        throw new Error(`Unknown task type: ${task.type}`);
    }
  }

  /**
   * Monitor the vault's ERC-4626 valuation and its upkeep clock.
   *
   * MaonoVault_Phase1B has no NAV to push and no performance fee to distribute:
   * `totalAssets()` is the vault's own balance and the only recurring on-chain
   * obligation is the monthly upkeep, which is owner-signed and burns MTAA.
   * Paying it is therefore opt-in (MAONO_AUTO_UPKEEP), and hibernation is
   * reported rather than resolved because reactivation is a funding decision.
   */
  private async executeUpkeepCheck(task: AutomationTask) {
    try {
      if (!MaonoVaultService.isConfigured()) {
        this.logger.warn('⚠️  Upkeep check skipped: MaonoVault contract not configured');
        this.logger.info('   Deploy MaonoVault contract and set MAONO_CONTRACT_ADDRESS in .env to enable automation');
        // Don't retry this task
        task.retryCount = task.maxRetries;
        return;
      }

      const [valuation, lifecycle] = await Promise.all([
        MaonoVaultService.getVaultValuation(),
        MaonoVaultService.getVaultLifecycle(),
      ]);

      this.logger.info('📊 Vault valuation', {
        totalAssets: ethers.formatEther(valuation.totalAssets),
        totalSupply: ethers.formatEther(valuation.totalSupply),
        sharePrice: ethers.formatEther(valuation.sharePrice),
      });

      if (lifecycle.status === VAULT_STATUS_HIBERNATING) {
        this.logger.warn('🛑 Vault is hibernating: deposits are closed until the owner reactivates it', {
          nextUpkeepDue: lifecycle.nextUpkeepDue.toString(),
        });
      } else {
        const dueInMs = Number(lifecycle.nextUpkeepDue) * 1000 - Date.now();
        if (dueInMs <= UPKEEP_WARNING_WINDOW_MS) {
          this.logger.warn('⏳ Monthly upkeep is due', {
            dueInHours: Math.round(dueInMs / 3_600_000),
            costMtaa: ethers.formatEther(lifecycle.monthlyUpkeepCost),
          });

          if (dueInMs <= 0 && process.env.MAONO_AUTO_UPKEEP === 'true') {
            const tx = await MaonoVaultService.collectMonthlyUpkeep();
            await tx.wait();
            this.logger.info(`✅ Monthly upkeep paid on-chain: ${tx.hash}`);
          }
        }
      }

      // Schedule the next check
      this.addTask({
        id: `upkeep_${Date.now()}`,
        type: 'upkeep',
        priority: 'high',
        scheduledAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
        retryCount: 0,
        maxRetries: 3
      });

    } catch (error) {
      this.logger.error('Upkeep automation failed', error);
      throw error;
    }
  }

  // Execute vault rebalancing
  private async executeRebalancing(task: AutomationTask) {
    try {
      const activeVaults = await db.query.vaults.findMany({
        where: eq(vaults.isActive, true)
      });

      console.log(`⚖️  Rebalancing ${activeVaults.length} active vaults...`);

      for (const vault of activeVaults) {
        try {
          await vaultService.rebalanceVault(vault.id);
          console.log(`✅ Rebalanced vault: ${vault.name} (${vault.id})`);
        } catch (error) {
          console.warn(`⚠️  Failed to rebalance vault ${vault.id}:`, error);
        }
      }

      // Schedule next rebalancing
      this.addTask({
        id: `rebalance_all_${Date.now()}`,
        type: 'rebalance',
        priority: 'medium',
        scheduledAt: new Date(Date.now() + 6 * 60 * 60 * 1000), // 6 hours
        retryCount: 0,
        maxRetries: 2
      });

    } catch (error) {
      console.error('Vault rebalancing automation failed:', error);
      throw error;
    }
  }

  // Execute risk assessment
  private async executeRiskAssessment(task: AutomationTask) {
    try {
      const activeVaults = await db.query.vaults.findMany({
        where: eq(vaults.isActive, true)
      });

      console.log(`🔍 Performing risk assessment on ${activeVaults.length} vaults...`);

      for (const vault of activeVaults) {
        try {
          await vaultService.performRiskAssessment(vault.id);
          console.log(`✅ Risk assessment completed for vault: ${vault.name}`);
        } catch (error) {
          console.warn(`⚠️  Risk assessment failed for vault ${vault.id}:`, error);
        }
      }

      // Schedule next risk assessment
      this.addTask({
        id: `risk_assessment_${Date.now()}`,
        type: 'risk_assessment',
        priority: 'low',
        scheduledAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
        retryCount: 0,
        maxRetries: 2
      });

    } catch (error) {
      console.error('Risk assessment automation failed:', error);
      throw error;
    }
  }

  // Get automation status
  getStatus() {
    return {
      isRunning: this.isRunning,
      pendingTasks: this.tasks.length,
      tasks: this.tasks.map(task => ({
        id: task.id,
        type: task.type,
        priority: task.priority,
        scheduledAt: task.scheduledAt,
        retryCount: task.retryCount,
        vaultId: task.vaultId
      }))
    };
  }
}

// Create singleton instance
export const vaultAutomationService = new VaultAutomationService();

export async function automateMonthlyUpkeep() {
  try {
    const tx = await MaonoVaultService.collectMonthlyUpkeep();
    console.log("Upkeep tx sent:", tx.hash);
    await tx.wait();
    console.log("Monthly upkeep paid on-chain.");
  } catch (err) {
    console.error("Monthly upkeep failed:", err);
    throw new Error("Failed to pay monthly upkeep: " + (err as Error).message);
  }
}

// Start automation service if called directly
if (import.meta.url === new URL(process.argv[1], 'file://').href) {
  vaultAutomationService.start();

  // Graceful shutdown
  process.on('SIGINT', () => {
    console.log('Received SIGINT, shutting down automation service...');
    vaultAutomationService.stop();
    process.exit(0);
  });
}