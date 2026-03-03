/**
 * Treasury Price Update Service
 * 
 * Automatically updates treasury positions with live prices
 * Listens to symbol universe price updates and propagates to database
 */

import { EventEmitter } from 'events';
import { pool } from '../db';
import { symbolUniverseService, PriceUpdate } from './symbolUniverseService';
import { logger } from '../utils/logger';

export interface TreasuryPositionUpdate {
  positionId: string;
  symbol: string;
  balance: string;
  price: number;
  balanceUSD: string;
  source: string;
  daoType: string;
  timestamp: string;
}

/**
 * Treasury Price Update Service
 * Keeps treasury positions in sync with live prices
 */
export class TreasuryPriceUpdateService extends EventEmitter {
  private priceUpdateEmitter = new EventEmitter();
  private consecutiveErrors: Map<string, number> = new Map();
  private readonly MAX_CONSECUTIVE_ERRORS = 5;
  private updateQueue: PriceUpdate[] = [];
  private isProcessing = false;

  constructor() {
    super();
    this.initialize();
  }

  /**
   * Initialize service
   */
  private initialize(): void {
    logger.info('🔄 Initializing Treasury Price Update Service...');

    // Listen to all price updates from symbol universe
    symbolUniverseService.onPriceUpdate(async (update: PriceUpdate) => {
      await this.handlePriceUpdate(update);
    });

    // Process update queue periodically
    setInterval(() => this.processUpdateQueue(), 5000);

    logger.info('✅ Treasury Price Update Service ready');
  }

  /**
   * Handle incoming price update
   */
  private async handlePriceUpdate(update: PriceUpdate): Promise<void> {
    try {
      // Find all positions with this symbol
      const positions = await this.getTreasuryPositions(update.symbol);

      if (positions.length === 0) {
        logger.debug(`[Treasury] No positions found for ${update.symbol}`);
        return;
      }

      // Queue updates for batch processing
      for (const position of positions) {
        const balanceUSD = (parseFloat(position.balance) * update.price).toFixed(2);

        this.updateQueue.push({
          symbol: update.symbol,
          price: update.price,
          source: update.source,
          timestamp: Date.now()
        });

        // Emit position update event (for WebSocket subscribers)
        this.priceUpdateEmitter.emit('position-updated', {
          positionId: position.id,
          symbol: update.symbol,
          balance: position.balance,
          price: update.price,
          balanceUSD,
          source: update.source,
          daoType: position.daoType,
          timestamp: new Date(update.timestamp).toISOString()
        } as TreasuryPositionUpdate);

        // Update database
        await this.updatePositionPrice(
          position.id,
          update.symbol,
          update.price,
          balanceUSD,
          update.source
        );
      }

      // Reset error counter on success
      this.consecutiveErrors.set(update.symbol, 0);
    } catch (error: any) {
      const errorCount = (this.consecutiveErrors.get(update.symbol) || 0) + 1;
      this.consecutiveErrors.set(update.symbol, errorCount);

      if (errorCount <= this.MAX_CONSECUTIVE_ERRORS) {
        logger.error(
          `[Treasury] Error updating positions for ${update.symbol} (${errorCount}/${this.MAX_CONSECUTIVE_ERRORS}):`,
          error.message
        );
      } else {
        logger.error(
          `[Treasury] Symbol ${update.symbol} exceeded max retry errors. Disabling updates.`
        );
      }
    }
  }

  /**
   * Get treasury positions for a symbol
   */
  private async getTreasuryPositions(symbol: string): Promise<any[]> {
    try {
      const result = await pool.query(
        `SELECT id, symbol, chain, balance, "daoType"
         FROM treasury_positions
         WHERE symbol = $1 AND balance > 0
         ORDER BY "daoType" DESC`,
        [symbol]
      );

      return result.rows.map(row => ({
        id: row.id,
        symbol: row.symbol,
        chain: row.chain,
        balance: row.balance,
        daoType: row.daoType
      }));
    } catch (error: any) {
      logger.error(`[Treasury] Failed to query positions for ${symbol}:`, error.message);
      return [];
    }
  }

  /**
   * Update single position price in database
   */
  private async updatePositionPrice(
    positionId: string,
    symbol: string,
    price: number,
    balanceUSD: string,
    source: string
  ): Promise<void> {
    try {
      await pool.query(
        `UPDATE treasury_positions
         SET "balanceUsd" = $1,
             "lastPriceUpdate" = NOW(),
             "priceSource" = $2,
             "updatedAt" = NOW()
         WHERE id = $3`,
        [balanceUSD, source, positionId]
      );

      logger.debug(
        `[Treasury] Updated position ${positionId}: ${symbol} = $${price} (${source})`
      );
    } catch (error: any) {
      logger.error(
        `[Treasury] Failed to update position ${positionId}:`,
        error.message
      );
    }
  }

  /**
   * Process batch update queue
   */
  private async processUpdateQueue(): Promise<void> {
    if (this.isProcessing || this.updateQueue.length === 0) {
      return;
    }

    this.isProcessing = true;

    try {
      const updates = this.updateQueue.splice(0, 100); // Process 100 at a time

      for (const update of updates) {
        // Re-fetch positions and update
        const positions = await this.getTreasuryPositions(update.symbol);
        for (const position of positions) {
          const balanceUSD = (parseFloat(position.balance) * update.price).toFixed(2);
          await this.updatePositionPrice(
            position.id,
            update.symbol,
            update.price,
            balanceUSD,
            update.source
          );
        }
      }

      logger.debug(`[Treasury] Processed ${updates.length} price updates from queue`);
    } catch (error: any) {
      logger.error('[Treasury] Queue processing error:', error.message);
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Manually trigger price update for symbol
   */
  async triggerPriceUpdate(symbol: string): Promise<void> {
    try {
      logger.info(`[Treasury] Manually triggered price update for ${symbol}`);

      const price = await symbolUniverseService.getPrice(symbol, 'USD');
      if (!price) {
        logger.warn(`[Treasury] Failed to get price for ${symbol}`);
        return;
      }

      await this.handlePriceUpdate({
        symbol,
        price: price.price,
        source: price.source,
        timestamp: Date.now()
      });
    } catch (error: any) {
      logger.error(`[Treasury] Manual trigger failed for ${symbol}:`, error.message);
    }
  }

  /**
   * Get history of position price changes
   */
  async getPositionPriceHistory(
    positionId: string,
    limit: number = 100
  ): Promise<any[]> {
    try {
      const result = await pool.query(
        `SELECT symbol, price, source, "recordedAt"
         FROM treasury_position_price_history
         WHERE position_id = $1
         ORDER BY "recordedAt" DESC
         LIMIT $2`,
        [positionId, limit]
      );

      return result.rows;
    } catch (error: any) {
      logger.error(`[Treasury] Failed to get price history for ${positionId}:`, error.message);
      return [];
    }
  }

  /**
   * Subscribe to position updates
   */
  onPositionUpdate(callback: (update: TreasuryPositionUpdate) => void): void {
    this.priceUpdateEmitter.on('position-updated', callback);
  }

  /**
   * Get service statistics
   */
  getStats() {
    return {
      updateQueueLength: this.updateQueue.length,
      isProcessing: this.isProcessing,
      errorStates: Object.fromEntries(this.consecutiveErrors)
    };
  }
}

/**
 * Singleton instance
 */
export const treasuryPriceUpdateService = new TreasuryPriceUpdateService();
