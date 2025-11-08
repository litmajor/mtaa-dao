
import { db } from '../db';
import { vaults, vaultTokenHoldings, vaultPerformance } from '../../shared/schema';
import { eq, and } from 'drizzle-orm';
import { priceOracle } from './priceOracle';
import { Logger } from '../utils/logger';
import { ethers } from 'ethers';

/**
 * Automated NAV Update Service
 * Integrates with price oracle to keep vault valuations current
 */
export class NAVUpdateService {
  private logger = Logger.getLogger();
  private updateInterval: NodeJS.Timeout | null = null;

  /**
   * Start automated NAV updates
   * Runs every 15 minutes by default
   */
  startAutomatedUpdates(intervalMinutes: number = 15): void {
    if (this.updateInterval) {
      this.logger.warn('NAV update service already running');
      return;
    }

    this.logger.info(`Starting automated NAV updates every ${intervalMinutes} minutes`);
    
    // Initial update
    this.updateAllVaultNAVs().catch(error => {
      this.logger.error('Initial NAV update failed:', error);
    });

    // Schedule recurring updates
    this.updateInterval = setInterval(async () => {
      await this.updateAllVaultNAVs();
    }, intervalMinutes * 60 * 1000);
  }

  /**
   * Stop automated updates
   */
  stopAutomatedUpdates(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
      this.logger.info('Stopped automated NAV updates');
    }
  }

  /**
   * Update NAV for all active vaults
   */
  async updateAllVaultNAVs(): Promise<void> {
    try {
      this.logger.info('Starting NAV update cycle for all vaults');

      const activeVaults = await db.query.vaults.findMany({
        where: eq(vaults.isActive, true)
      });

      const results = await Promise.allSettled(
        activeVaults.map(vault => this.updateVaultNAV(vault.id))
      );

      const successful = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;

      this.logger.info(`NAV update cycle complete. Success: ${successful}, Failed: ${failed}`);
    } catch (error) {
      this.logger.error('NAV update cycle failed:', error);
      throw error;
    }
  }

  /**
   * Update NAV for a specific vault
   */
  async updateVaultNAV(vaultId: string): Promise<{
    vaultId: string;
    previousNAV: number;
    newNAV: number;
    changePercent: number;
  }> {
    try {
      const vault = await db.query.vaults.findFirst({
        where: eq(vaults.id, vaultId)
      });

      if (!vault) {
        throw new Error(`Vault ${vaultId} not found`);
      }

      // Get all token holdings for this vault
      const holdings = await db.query.vaultTokenHoldings.findMany({
        where: eq(vaultTokenHoldings.vaultId, vaultId)
      });

      let totalValueUSD = 0;
      const previousTVL = parseFloat(vault.totalValueLocked || '0');

      // Calculate value of each holding
      for (const holding of holdings) {
        try {
          const price = await priceOracle.getPrice(holding.tokenSymbol);
          
          if (price) {
            const balance = parseFloat(holding.balance);
            const valueUSD = balance * price.priceUsd;
            totalValueUSD += valueUSD;

            // Update holding with current price
            await db.update(vaultTokenHoldings)
              .set({
                valueUSD: valueUSD.toString(),
                lastPriceUpdate: new Date()
              })
              .where(eq(vaultTokenHoldings.id, holding.id));
          } else {
            this.logger.warn(`No price available for ${holding.tokenSymbol} in vault ${vaultId}`);
          }
        } catch (error) {
          this.logger.error(`Failed to update price for ${holding.tokenSymbol}:`, error);
        }
      }

      // Update vault TVL
      await db.update(vaults)
        .set({
          totalValueLocked: totalValueUSD.toString(),
          updatedAt: new Date()
        })
        .where(eq(vaults.id, vaultId));

      const changePercent = previousTVL > 0 
        ? ((totalValueUSD - previousTVL) / previousTVL) * 100 
        : 0;

      this.logger.info(`Updated NAV for vault ${vaultId}: $${totalValueUSD.toFixed(2)} (${changePercent > 0 ? '+' : ''}${changePercent.toFixed(2)}%)`);

      return {
        vaultId,
        previousNAV: previousTVL,
        newNAV: totalValueUSD,
        changePercent
      };
    } catch (error) {
      this.logger.error(`Failed to update NAV for vault ${vaultId}:`, error);
      throw error;
    }
  }

  /**
   * Trigger immediate NAV update for a specific vault
   * Used after deposits/withdrawals
   */
  async triggerImmediateUpdate(vaultId: string): Promise<void> {
    this.logger.info(`Triggering immediate NAV update for vault ${vaultId}`);
    await this.updateVaultNAV(vaultId);
  }

  /**
   * Record NAV history for analytics
   */
  private async recordNAVHistory(vaultId: string, nav: number): Promise<void> {
    try {
      const now = new Date();
      const periodStart = new Date(now);
      periodStart.setHours(0, 0, 0, 0);
      
      const periodEnd = new Date(periodStart);
      periodEnd.setDate(periodEnd.getDate() + 1);

      await db.insert(vaultPerformance).values({
        vaultId,
        period: 'daily',
        periodStart,
        periodEnd,
        startingValue: nav.toString(),
        endingValue: nav.toString()
      });
    } catch (error) {
      this.logger.error('Failed to record NAV history:', error);
    }
  }
}

export const navUpdateService = new NAVUpdateService();
