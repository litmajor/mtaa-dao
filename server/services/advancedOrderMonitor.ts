import { Logger } from '../utils/logger';
import { pool } from '../db';
import { priceOracle } from './priceOracle';
import { orderRouter } from './orderRouter';
import { unifiedStatsUpdater } from './unifiedStatsUpdater';

const logger = Logger.getLogger();

export class AdvancedOrderMonitor {
  private isRunning: boolean = false;
  private intervalId: NodeJS.Timeout | null = null;
  private checkIntervalMs: number = 10000; // Check every 10 seconds

  public start() {
    if (this.isRunning) return;
    this.isRunning = true;
    this.intervalId = setInterval(() => this.processOrders(), this.checkIntervalMs);
    logger.info('[AdvancedOrderMonitor] Started advanced order polling loop');
  }

  public stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
    logger.info('[AdvancedOrderMonitor] Stopped advanced order polling loop');
  }

  private async processOrders() {
    try {
      // Fetch active orders
      const res = await pool.query(`
        SELECT * FROM yuki_advanced_orders 
        WHERE status = 'active'
      `);
      const orders = res.rows;
      if (orders.length === 0) return;

      logger.debug(`[AdvancedOrderMonitor] Evaluating ${orders.length} active orders`);

      for (const order of orders) {
        try {
          await this.evaluateOrder(order);
        } catch (err: any) {
          logger.error(`[AdvancedOrderMonitor] Error evaluating order ${order.id}: ${err.message}`);
        }
      }
    } catch (err: any) {
      logger.error(`[AdvancedOrderMonitor] Failed to fetch orders: ${err.message}`);
    }
  }

  private async evaluateOrder(order: any) {
    const {
      id,
      user_id,
      order_type,
      exchange,
      symbol,
      side,
      amount,
      stop_price,
      take_profit_price,
      metadata
    } = order;

    // Fetch current price
    let currentPriceUsd = 0;
    try {
      // we map symbol to correct feed (e.g. BTC/USDT)
      const feedId = symbol.replace('/', '');
      currentPriceUsd = (await priceOracle.getPrice(feedId))?.priceUsd ?? 0;
    } catch (err) {
      logger.warn(`[AdvancedOrderMonitor] Could not fetch price for ${symbol}, skipping order ${id}`);
      return;
    }

    if (!currentPriceUsd || currentPriceUsd <= 0) return;

    let trigger = false;
    let executionPrice = currentPriceUsd;

    // Evaluate based on order type
    if (order_type === 'twap-chunk') {
      const executeAfter = metadata?.executeAfter ? Number(metadata.executeAfter) : 0;
      if (Date.now() >= executeAfter) {
        trigger = true;
      }
    } else if (order_type === 'stop-loss' && stop_price) {
      if (side === 'sell' && currentPriceUsd <= Number(stop_price)) trigger = true;
      if (side === 'buy' && currentPriceUsd >= Number(stop_price)) trigger = true;
    } else if (order_type === 'take-profit' && take_profit_price) {
      if (side === 'sell' && currentPriceUsd >= Number(take_profit_price)) trigger = true;
      if (side === 'buy' && currentPriceUsd <= Number(take_profit_price)) trigger = true;
    } else if (order_type === 'trailing-stop') {
      // A full implementation would track peak/trough prices in metadata
      // For this implementation, we simplify and check if trigger price is hit
      const currentHighest = metadata?.highestPrice ? Number(metadata.highestPrice) : currentPriceUsd;
      const trailPercent = order.trail_percent ? Number(order.trail_percent) : 0;
      
      if (side === 'sell') {
        const newHighest = Math.max(currentHighest, currentPriceUsd);
        if (newHighest > currentHighest) {
          await pool.query(`UPDATE yuki_advanced_orders SET metadata = $1 WHERE id = $2`, 
            [{ ...metadata, highestPrice: newHighest }, id]);
        }
        const triggerPrice = newHighest * (1 - trailPercent / 100);
        if (currentPriceUsd <= triggerPrice) trigger = true;
      }
    }

    if (trigger) {
      logger.info(`[AdvancedOrderMonitor] Order ${id} triggered at price ${currentPriceUsd}. Executing...`);
      await this.executeOrder(order, currentPriceUsd);
    }
  }

  private async executeOrder(order: any, currentPrice: number) {
    const { id, user_id, symbol, side, amount, exchange } = order;

    try {
      // Execute via order router
      await pool.query(`UPDATE yuki_advanced_orders SET status = 'processing' WHERE id = $1`, [id]);

      const result = await orderRouter.placeOrder({
        userId: user_id,
        symbol,
        side,
        type: 'market',
        amount: Number(amount),
        exchange: exchange || undefined
      });

      // Mark as filled
      await pool.query(`
        UPDATE yuki_advanced_orders 
        SET status = 'filled', updated_at = CURRENT_TIMESTAMP, metadata = metadata || $1::jsonb
        WHERE id = $2
      `, [{ executionResult: result }, id]);

      logger.info(`[AdvancedOrderMonitor] Order ${id} successfully executed.`);
      unifiedStatsUpdater.emitTradeEvent(user_id, Number(amount) * currentPrice);
    } catch (err: any) {
      logger.error(`[AdvancedOrderMonitor] Execution failed for order ${id}: ${err.message}`);
      await pool.query(`
        UPDATE yuki_advanced_orders 
        SET status = 'failed', updated_at = CURRENT_TIMESTAMP, metadata = metadata || $1::jsonb
        WHERE id = $2
      `, [{ error: err.message }, id]);
    }
  }
}

export const advancedOrderMonitor = new AdvancedOrderMonitor();
