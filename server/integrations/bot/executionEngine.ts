/**
 * Bot Execution Engine
 * Handles bot lifecycle, strategy execution, and trade management
 */

import { Bot, BotTrade } from '../../db/schema/bots';
import * as botService from '../../db/services/botService';
import { recordBotTradeHandler } from '../../api/handlers/botHandlers';
import { exchangeManager } from '../exchanges/manager';
import { ExchangeConnector, OrderRequest, OrderResponse } from '../exchanges/types';

interface BotExecutor {
  botId: string;
  bot: Bot;
  interval: NodeJS.Timeout | null;
  isRunning: boolean;
  lastCheck: Date;
}

interface ExecutionContext {
  pair: string;
  currentPrice: number;
  timestamp: Date;
  indicators: Record<string, any>;
}

interface StrategySignal {
  action: 'BUY' | 'SELL' | 'HOLD' | 'CLOSE';
  confidence: number; // 0-1
  reason: string;
  targetPrice?: number;
  stopLoss?: number;
}

export class BotExecutionEngine {
  private executors: Map<string, BotExecutor> = new Map();
  private strategyRegistry: Map<string, any> = new Map();

  /**
   * Deploy and start a bot
   */
  async deployBot(
    userId: string,
    strategyId: string,
    botName: string,
    inputs: Record<string, any>,
    riskControl: Record<string, any>,
    exchanges: string[],
    initialCapital: number
  ): Promise<Bot> {
    try {
      // 1. Create bot in database
      const botId = `bot-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const bot = await botService.createBot({
        id: botId,
        userId,
        strategyId,
        botName,
        configuration: { inputs, riskControl },
        exchanges: exchanges as any,
        status: 'running',
        initialCapital: initialCapital.toString(),
      });

      // 2. Initialize exchange connections
      await this.initializeExchanges(exchanges, userId);

      // 3. Initialize performance tracking
      await botService.upsertBotPerformance({
        id: `perf-${botId}`,
        botId,
        userId,
      });

      // 4. Start execution loop
      this.startBotExecution(bot);

      // 5. Record action
      await botService.recordBotAction({
        id: `log-${Date.now()}`,
        botId,
        userId,
        action: 'deployed',
        description: `Bot deployed with strategy ${strategyId}`,
        newState: { status: 'running', strategyId },
      });

      return bot;
    } catch (error) {
      throw new Error(`Failed to deploy bot: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Start execution loop for a bot
   */
  private startBotExecution(bot: Bot): void {
    const executor: BotExecutor = {
      botId: bot.id,
      bot,
      interval: null,
      isRunning: true,
      lastCheck: new Date(),
    };

    // Execute strategy every 60 seconds (configurable)
    executor.interval = setInterval(async () => {
      if (!executor.isRunning) return;

      try {
        await this.executeBotCycle(executor);
      } catch (error) {
        console.error(`Bot execution error (${bot.id}):`, error);
        // Update bot status to error
        await botService.updateBotStatus(bot.id, 'error', error instanceof Error ? error.message : 'Unknown error');
      }
    }, 60000); // Run every minute

    this.executors.set(bot.id, executor);
  }

  /**
   * Execute one bot cycle (check strategy, place orders if needed)
   */
  private async executeBotCycle(executor: BotExecutor): Promise<void> {
    const { bot } = executor;
    const config = bot.configuration as any;

    // 1. Get current prices
    const tickers = await this.getTickers(config.inputs.pairs || ['BTC/USDT']);

    // 2. Calculate indicators
    const indicators = await this.calculateIndicators(bot.id, config.inputs);

    // 3. Get strategy signal
    const signal = await this.getStrategySignal(bot.strategyId, config.inputs, indicators);

    if (signal.action === 'HOLD') {
      return; // No action needed
    }

    // 4. Check risk controls
    if (!this.validateRiskControls(bot.id, signal, config.riskControl)) {
      return; // Skip trade due to risk constraints
    }

    // 5. Execute trade
    for (const exchange of config.exchanges) {
      const connector = exchangeManager.getConnector(exchange);
      const pair = config.inputs.pair || 'BTC/USDT';

      try {
        const orderRequest: OrderRequest = {
          pair,
          side: signal.action as 'BUY' | 'SELL',
          type: 'market',
          quantity: config.inputs.quantity || 0.01,
        };

        if (signal.targetPrice) {
          orderRequest.type = 'limit';
          orderRequest.price = signal.targetPrice;
        }

        const order = await connector.placeOrder(orderRequest);

        // 6. Record trade
        await this.recordTrade(bot.id, bot.userId, exchange, order, signal.reason);

        // 7. Update performance
        await this.updateBotPerformance(bot.id);
      } catch (error) {
        console.error(`Failed to execute trade on ${exchange}:`, error);
      }
    }
  }

  /**
   * Get strategy signal
   */
  private async getStrategySignal(
    strategyId: string,
    inputs: Record<string, any>,
    indicators: Record<string, any>
  ): Promise<StrategySignal> {
    // Strategy execution logic - example for RSI strategy
    switch (strategyId) {
      case 'rsi_oversold':
        return this.executeRSIStrategy(inputs, indicators);
      case 'daily_dca':
        return this.executeDCAStrategy(inputs, indicators);
      case 'bitcoin_grid':
        return this.executeGridStrategy(inputs, indicators);
      case 'macd_momentum':
        return this.executeMACDStrategy(inputs, indicators);
      default:
        return {
          action: 'HOLD',
          confidence: 0,
          reason: 'Unknown strategy',
        };
    }
  }

  /**
   * RSI Oversold Strategy
   */
  private executeRSIStrategy(inputs: Record<string, any>, indicators: Record<string, any>): StrategySignal {
    const rsi = indicators.RSI || 50;
    const threshold = inputs.rsiThreshold || 30;
    const quantity = inputs.quantity || 0.01;

    if (rsi < threshold) {
      return {
        action: 'BUY',
        confidence: (30 - rsi) / 30, // Higher confidence if deeper oversold
        reason: `RSI ${rsi.toFixed(1)} < ${threshold} (oversold)`,
      };
    } else if (rsi > 70) {
      return {
        action: 'SELL',
        confidence: (rsi - 70) / 30,
        reason: `RSI ${rsi.toFixed(1)} > 70 (overbought)`,
      };
    }

    return {
      action: 'HOLD',
      confidence: 0,
      reason: `RSI ${rsi.toFixed(1)} neutral`,
    };
  }

  /**
   * Daily DCA Strategy
   */
  private executeDCAStrategy(inputs: Record<string, any>, indicators: Record<string, any>): StrategySignal {
    const hour = new Date().getHours();
    const dcaHour = inputs.dcaHour || 9; // Buy at 9 AM UTC
    const quantity = inputs.quantity || 0.01;

    if (hour === dcaHour) {
      return {
        action: 'BUY',
        confidence: 0.8,
        reason: `Daily DCA at ${dcaHour}:00 UTC`,
      };
    }

    return {
      action: 'HOLD',
      confidence: 0,
      reason: `DCA waiting for ${dcaHour}:00 UTC`,
    };
  }

  /**
   * Grid Trading Strategy
   */
  private executeGridStrategy(inputs: Record<string, any>, indicators: Record<string, any>): StrategySignal {
    // Grid strategy: place buy orders at every 5% drop
    const currentPrice = indicators.price || 50000;
    const gridStep = inputs.gridStep || 0.05; // 5%
    const lowerBand = inputs.lowerBand || currentPrice * 0.9;

    if (currentPrice <= lowerBand) {
      return {
        action: 'BUY',
        confidence: 0.7,
        reason: `Grid: Price ${currentPrice} at support level`,
        targetPrice: currentPrice * (1 - gridStep),
      };
    }

    return {
      action: 'HOLD',
      confidence: 0,
      reason: 'Grid: Waiting for price movement',
    };
  }

  /**
   * MACD Momentum Strategy
   */
  private executeMACDStrategy(inputs: Record<string, any>, indicators: Record<string, any>): StrategySignal {
    const macd = indicators.MACD || 0;
    const signal = indicators.MACDSignal || 0;
    const histogram = indicators.MACDHistogram || 0;

    if (macd > signal && histogram > 0) {
      return {
        action: 'BUY',
        confidence: Math.abs(histogram) / 1000, // Normalized
        reason: `MACD bullish crossover (${macd.toFixed(1)} > ${signal.toFixed(1)})`,
      };
    } else if (macd < signal && histogram < 0) {
      return {
        action: 'SELL',
        confidence: Math.abs(histogram) / 1000,
        reason: `MACD bearish crossover`,
      };
    }

    return {
      action: 'HOLD',
      confidence: 0,
      reason: 'MACD neutral',
    };
  }

  /**
   * Record trade in database
   */
  private async recordTrade(
    botId: string,
    userId: string,
    exchange: string,
    order: OrderResponse,
    triggerReason: string
  ): Promise<void> {
    const trade: any = {
      id: `trade-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      botId,
      userId,
      pair: order.pair,
      side: order.side,
      orderType: order.type,
      quantity: order.quantity.toString(),
      filledQuantity: order.filledQuantity.toString(),
      entryPrice: (order.price || 0).toString(),
      filledPrice: (order.filledPrice || 0).toString(),
      fee: order.fee.toString(),
      totalValue: (order.filledQuantity * (order.filledPrice || 0)).toString(),
      status: order.status,
      exchange,
      triggerReason,
      createdAt: order.timestamp,
      filledAt: order.timestamp,
    };

    await botService.recordBotTrade(trade);
  }

  /**
   * Calculate technical indicators
   */
  private async calculateIndicators(botId: string, inputs: Record<string, any>): Promise<Record<string, any>> {
    // TODO: Integrate with TA-Lib or similar for real indicators
    // For now, return mock data
    return {
      RSI: 45 + Math.random() * 20,
      MACD: Math.random() * 100 - 50,
      MACDSignal: Math.random() * 100 - 50,
      MACDHistogram: Math.random() * 50 - 25,
      price: 45000 + Math.random() * 5000,
    };
  }

  /**
   * Get current tickers from all exchanges
   */
  private async getTickers(pairs: string[]): Promise<Map<string, number>> {
    const tickers = new Map<string, number>();
    const exchanges = exchangeManager.getInitializedExchanges();

    if (exchanges.length === 0) {
      throw new Error('No exchanges connected');
    }

    for (const pair of pairs) {
      try {
        const connector = exchangeManager.getConnector(exchanges[0]);
        const ticker = await connector.getTicker(pair);
        tickers.set(pair, ticker.last);
      } catch (error) {
        console.error(`Failed to get ticker for ${pair}:`, error);
      }
    }

    return tickers;
  }

  /**
   * Validate risk controls
   */
  private validateRiskControls(
    botId: string,
    signal: StrategySignal,
    riskControl: Record<string, any>
  ): boolean {
    // Check if risk controls prevent this trade
    if (riskControl.paused) {
      return false;
    }

    if (signal.confidence < 0.5 && riskControl.minConfidence) {
      return false;
    }

    return true;
  }

  /**
   * Update bot performance metrics
   */
  private async updateBotPerformance(botId: string): Promise<void> {
    const trades = await botService.getBotTrades(botId);

    let wins = 0;
    let losses = 0;
    let totalProfit = 0;

    for (const trade of trades) {
      if (trade.pnl) {
        totalProfit += Number(trade.pnl);
        if (Number(trade.pnl) > 0) wins++;
        else if (Number(trade.pnl) < 0) losses++;
      }
    }

    const winRate = trades.length > 0 ? (wins / trades.length) * 100 : 0;
    const profitFactor = losses > 0 ? wins / losses : wins > 0 ? wins : 0;

    await botService.upsertBotPerformance({
      id: `perf-${botId}`,
      botId,
      userId: (await botService.getBotById(botId))?.userId || '',
      totalTrades: trades.length,
      winningTrades: wins,
      losingTrades: losses,
      winRate: winRate.toString(),
      profitFactor: profitFactor.toString(),
      totalProfit: totalProfit.toString(),
      lastTradeAt: trades[0]?.createdAt,
    });
  }

  /**
   * Initialize exchange connections for bot
   */
  private async initializeExchanges(exchanges: string[], userId: string): Promise<void> {
    // TODO: Get user's exchange credentials from secure storage
    // For now, this would be called with stored credentials
    for (const exchangeName of exchanges) {
      try {
        // This would need to retrieve actual credentials
        // await exchangeManager.initializeExchange({
        //   name: exchangeName,
        //   credentials: { apiKey: '...', apiSecret: '...' },
        // });
      } catch (error) {
        console.error(`Failed to initialize ${exchangeName}:`, error);
      }
    }
  }

  /**
   * Pause bot execution
   */
  async pauseBot(botId: string): Promise<void> {
    const executor = this.executors.get(botId);
    if (executor) {
      executor.isRunning = false;
      await botService.updateBotStatus(botId, 'paused');
    }
  }

  /**
   * Resume bot execution
   */
  async resumeBot(botId: string): Promise<void> {
    const executor = this.executors.get(botId);
    if (executor) {
      executor.isRunning = true;
      await botService.updateBotStatus(botId, 'running');
    }
  }

  /**
   * Stop bot execution
   */
  async stopBot(botId: string): Promise<void> {
    const executor = this.executors.get(botId);
    if (executor) {
      executor.isRunning = false;
      if (executor.interval) {
        clearInterval(executor.interval);
      }
      this.executors.delete(botId);
      await botService.updateBotStatus(botId, 'stopped');
    }
  }

  /**
   * Get bot execution status
   */
  getExecutorStatus(botId: string): BotExecutor | null {
    return this.executors.get(botId) || null;
  }
}

// Singleton instance
export const botExecutionEngine = new BotExecutionEngine();
