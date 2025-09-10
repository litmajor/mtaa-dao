
import { MaonoVaultService } from "./blockchain";
import { vaultService } from "./services/vaultService";
import { db } from "./db";
import { vaults, vaultPerformance, vaultTransactions } from "../shared/schema";
import { eq } from "drizzle-orm";
import { ethers } from "ethers";

interface AutomationTask {
  id: string;
  type: 'nav_update' | 'performance_fee' | 'rebalance' | 'risk_assessment';
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

  // Start automation service
  start() {
    if (this.isRunning) {
      console.log('Vault automation service is already running');
      return;
    }

    this.isRunning = true;
    console.log('🚀 Starting Vault Automation Service...');

    // Schedule regular tasks
    this.scheduleRegularTasks();
    
    // Process tasks every 30 seconds
    this.intervalId = setInterval(() => {
      this.processTasks().catch(console.error);
    }, 30000);

    console.log('✅ Vault Automation Service started successfully');
  }

  // Stop automation service
  stop() {
    if (!this.isRunning) return;

    this.isRunning = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    
    console.log('⏹️  Vault Automation Service stopped');
  }

  // Schedule regular automation tasks
  private scheduleRegularTasks() {
    // Schedule NAV updates every hour
    this.addTask({
      id: `nav_update_${Date.now()}`,
      type: 'nav_update',
      priority: 'high',
      scheduledAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
      retryCount: 0,
      maxRetries: 3
    });

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
    const now = new Date();
    const dueTasks = this.tasks.filter(task => task.scheduledAt <= now);

    for (const task of dueTasks) {
      try {
        console.log(`🔄 Processing automation task: ${task.type} (${task.id})`);
        
        await this.executeTask(task);
        
        // Remove completed task
        this.tasks = this.tasks.filter(t => t.id !== task.id);
        
        console.log(`✅ Completed automation task: ${task.type} (${task.id})`);

      } catch (error) {
        console.error(`❌ Task failed: ${task.type} (${task.id})`, error);
        
        task.retryCount++;
        
        if (task.retryCount < task.maxRetries) {
          // Reschedule with exponential backoff
          task.scheduledAt = new Date(now.getTime() + Math.pow(2, task.retryCount) * 60000);
          console.log(`🔄 Rescheduling task ${task.id} (attempt ${task.retryCount + 1}/${task.maxRetries})`);
        } else {
          // Max retries exceeded
          console.error(`💥 Task ${task.id} failed after ${task.maxRetries} attempts`);
          this.tasks = this.tasks.filter(t => t.id !== task.id);
        }
      }
    }
  }

  // Execute a specific automation task
  private async executeTask(task: AutomationTask) {
    switch (task.type) {
      case 'nav_update':
        await this.executeNAVUpdate(task);
        break;
      
      case 'performance_fee':
        await this.executePerformanceFeeDistribution(task);
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

  // Execute NAV update
  private async executeNAVUpdate(task: AutomationTask) {
    try {
      // Get current on-chain NAV
      const [currentNAV, lastUpdate] = await MaonoVaultService.getNAV();
      
      // Calculate new NAV based on vault performance
      const activeVaults = await db.query.vaults.findMany({
        where: eq(vaults.isActive, true)
      });

      let totalValue = 0n;
      let totalShares = 0n;

      for (const vault of activeVaults) {
        const vaultPortfolio = await vaultService.getVaultPortfolio(vault.id);
        const vaultValueWei = ethers.parseUnits(vaultPortfolio.totalValueUSD.toString(), 18);
        totalValue += vaultValueWei;
        totalShares += BigInt(1000); // Simplified share calculation
      }

      const newNAV = totalShares > 0n ? totalValue / totalShares : 0n;

      // Update NAV on-chain if significant change
      const navChange = currentNAV > 0n ? (newNAV - currentNAV) * 100n / currentNAV : 100n;
      
      if (navChange > 1n || navChange < -1n) { // More than 1% change
        console.log(`📈 Updating NAV: ${ethers.formatEther(currentNAV)} → ${ethers.formatEther(newNAV)}`);
        
        const tx = await MaonoVaultService.updateNAV(newNAV);
        await tx.wait();
        
        console.log(`✅ NAV updated on-chain: ${tx.hash}`);
      } else {
        console.log('📊 NAV change too small, skipping update');
      }

      // Schedule next NAV update
      this.addTask({
        id: `nav_update_${Date.now()}`,
        type: 'nav_update',
        priority: 'high',
        scheduledAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
        retryCount: 0,
        maxRetries: 3
      });

    } catch (error) {
      console.error('NAV update automation failed:', error);
      throw error;
    }
  }

  // Execute performance fee distribution
  private async executePerformanceFeeDistribution(task: AutomationTask) {
    try {
      // Get recent performance data
      const recentPerformance = await db.query.vaultPerformance.findMany({
        where: eq(vaultPerformance.period, 'daily'),
        limit: 30 // Last 30 days
      });

      let totalProfit = 0n;
      
      for (const performance of recentPerformance) {
        const yield_ = parseFloat(performance.yield || '0');
        if (yield_ > 0) {
          totalProfit += ethers.parseUnits(yield_.toString(), 18);
        }
      }

      if (totalProfit > ethers.parseUnits('100', 18)) { // Minimum $100 profit
        console.log(`💰 Distributing performance fees on profit: ${ethers.formatEther(totalProfit)} USD`);
        
        const tx = await MaonoVaultService.distributePerformanceFee(totalProfit);
        await tx.wait();
        
        console.log(`✅ Performance fees distributed: ${tx.hash}`);
      } else {
        console.log('💰 Insufficient profit for fee distribution');
      }

    } catch (error) {
      console.error('Performance fee distribution failed:', error);
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

// Legacy functions for backward compatibility
export async function automateNAVUpdate(newNav: bigint) {
  try {
    const tx = await MaonoVaultService.updateNAV(newNav);
    console.log("NAV update tx sent:", tx.hash);
    await tx.wait();
    console.log("NAV updated on-chain.");
  } catch (err) {
    console.error("NAV update failed:", err);
    throw new Error("Failed to update NAV: " + (err as Error).message);
  }
}

export async function automatePerformanceFeeDistribution(profit: bigint) {
  try {
    const tx = await MaonoVaultService.distributePerformanceFee(profit);
    console.log("Performance fee tx sent:", tx.hash);
    await tx.wait();
    console.log("Performance fee distributed.");
  } catch (err) {
    console.error("Performance fee distribution failed:", err);
    throw new Error("Failed to distribute performance fee: " + (err as Error).message);
  }
}

// Start automation service if called directly
if (require.main === module) {
  vaultAutomationService.start();
  
  // Graceful shutdown
  process.on('SIGINT', () => {
    console.log('Received SIGINT, shutting down automation service...');
    vaultAutomationService.stop();
    process.exit(0);
  });
}
