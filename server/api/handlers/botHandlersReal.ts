/**
 * Real Bot Management API Handlers
 * Full implementation connected to database, exchanges, and execution engine
 */

import {
  DeployBotRequest,
  DeployBotResponse,
  BotTradeEvent,
  UpdateBotConfigRequest,
  BotPerformanceResponse,
} from '../types/botTypes';
import * as botService from '../../db/services/botService';
import { botExecutionEngine } from '../../integrations/bot/executionEngine';
import { exchangeManager } from '../../integrations/exchanges/manager';

/**
 * Deploy a new trading bot
 * POST /api/bots/deploy
 */
export async function deployBotHandler(
  userId: string,
  req: DeployBotRequest
): Promise<DeployBotResponse> {
  try {
    // 1. Validate strategy exists
    // TODO: Check against strategy registry
    if (!req.strategyId) {
      throw new Error('Strategy ID is required');
    }

    // 2. Validate inputs match strategy schema
    // TODO: Validate using strategy type definitions
    if (!req.inputs || typeof req.inputs !== 'object') {
      throw new Error('Strategy inputs are required');
    }

    // 3. Validate risk controls
    if (!req.riskControl) {
      throw new Error('Risk control configuration is required');
    }

    // 4. Validate exchanges
    if (!Array.isArray(req.exchanges) || req.exchanges.length === 0) {
      throw new Error('At least one exchange is required');
    }

    // 5. Deploy bot via execution engine
    const bot = await botExecutionEngine.deployBot(
      userId,
      req.strategyId,
      req.botName,
      req.inputs,
      req.riskControl,
      req.exchanges,
      req.initialCapital
    );

    // 6. Get performance record
    const performance = await botService.getBotPerformance(bot.id);

    return {
      id: bot.id,
      strategyId: req.strategyId,
      botName: req.botName,
      status: bot.status as 'running' | 'paused' | 'stopped' | 'error',
      deployedAt: bot.deployedAt?.toISOString() || new Date().toISOString(),
      config: req,
      performance: {
        trades: performance?.totalTrades || 0,
        wins: performance?.winningTrades || 0,
        losses: performance?.losingTrades || 0,
        profit: Number(performance?.totalProfit || 0),
        profitPercent: Number(performance?.totalProfitPercent || 0),
        openPositions: performance?.openPositions || 0,
      },
    };
  } catch (error) {
    throw new Error(`Failed to deploy bot: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Get all bots for current user
 * GET /api/bots
 */
export async function listBotsHandler(userId: string) {
  try {
    const bots = await botService.getUserBotsWithPerformance(userId);

    return bots.map((row: any) => ({
      id: row.bots.id,
      strategyId: row.bots.strategyId,
      botName: row.bots.botName,
      status: row.bots.status,
      deployedAt: row.bots.deployedAt?.toISOString(),
      exchangeCount: Array.isArray(row.bots.exchanges) ? row.bots.exchanges.length : 0,
      performance: {
        trades: row.bot_performance?.totalTrades || 0,
        wins: row.bot_performance?.winningTrades || 0,
        losses: row.bot_performance?.losingTrades || 0,
        profit: Number(row.bot_performance?.totalProfit || 0),
        profitPercent: Number(row.bot_performance?.totalProfitPercent || 0),
        winRate: Number(row.bot_performance?.winRate || 0),
      },
    }));
  } catch (error) {
    throw new Error(`Failed to list bots: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Get specific bot details
 * GET /api/bots/:id
 */
export async function getBotHandler(botId: string, userId: string) {
  try {
    const bot = await botService.getBotById(botId);

    if (!bot) {
      throw new Error('Bot not found');
    }

    if (bot.userId !== userId) {
      throw new Error('Unauthorized: Bot does not belong to this user');
    }

    const performance = await botService.getBotPerformance(botId);
    const trades = await botService.getBotTrades(botId, 10);
    const actionLog = await botService.getBotActionLog(botId, 5);

    return {
      id: bot.id,
      strategyId: bot.strategyId,
      botName: bot.botName,
      status: bot.status,
      deployedAt: bot.deployedAt?.toISOString(),
      stoppedAt: bot.stoppedAt?.toISOString(),
      initialCapital: Number(bot.initialCapital),
      configuration: bot.configuration,
      performance: {
        trades: performance?.totalTrades || 0,
        wins: performance?.winningTrades || 0,
        losses: performance?.losingTrades || 0,
        profit: Number(performance?.totalProfit || 0),
        profitPercent: Number(performance?.totalProfitPercent || 0),
        winRate: Number(performance?.winRate || 0),
        sharpeRatio: Number(performance?.sharpeRatio || 0),
        lastTrade: performance?.lastTradeAt?.toISOString(),
      },
      recentTrades: trades.map((t) => ({
        id: t.id,
        pair: t.pair,
        side: t.side,
        quantity: Number(t.quantity),
        price: Number(t.filledPrice),
        pnl: Number(t.pnl || 0),
        status: t.status,
        timestamp: t.createdAt?.toISOString(),
      })),
      actionLog: actionLog.map((log) => ({
        action: log.action,
        description: log.description,
        timestamp: log.createdAt?.toISOString(),
      })),
    };
  } catch (error) {
    throw new Error(`Failed to get bot: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Pause a running bot
 * POST /api/bots/:id/pause
 */
export async function pauseBotHandler(botId: string, userId: string) {
  try {
    const bot = await botService.getBotById(botId);

    if (!bot) {
      throw new Error('Bot not found');
    }

    if (bot.userId !== userId) {
      throw new Error('Unauthorized');
    }

    await botExecutionEngine.pauseBot(botId);
    const updated = await botService.updateBotStatus(botId, 'paused');

    await botService.recordBotAction({
      id: `log-${Date.now()}`,
      botId,
      userId,
      action: 'paused',
      description: 'Bot paused by user',
      previousState: { status: bot.status },
      newState: { status: 'paused' },
    });

    return {
      id: updated?.id,
      status: 'paused',
      message: 'Bot paused successfully',
    };
  } catch (error) {
    throw new Error(`Failed to pause bot: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Resume a paused bot
 * POST /api/bots/:id/resume
 */
export async function resumeBotHandler(botId: string, userId: string) {
  try {
    const bot = await botService.getBotById(botId);

    if (!bot) {
      throw new Error('Bot not found');
    }

    if (bot.userId !== userId) {
      throw new Error('Unauthorized');
    }

    await botExecutionEngine.resumeBot(botId);
    const updated = await botService.updateBotStatus(botId, 'running');

    await botService.recordBotAction({
      id: `log-${Date.now()}`,
      botId,
      userId,
      action: 'resumed',
      description: 'Bot resumed by user',
      previousState: { status: bot.status },
      newState: { status: 'running' },
    });

    return {
      id: updated?.id,
      status: 'running',
      message: 'Bot resumed successfully',
    };
  } catch (error) {
    throw new Error(`Failed to resume bot: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Stop a bot completely
 * POST /api/bots/:id/stop
 */
export async function stopBotHandler(botId: string, userId: string) {
  try {
    const bot = await botService.getBotById(botId);

    if (!bot) {
      throw new Error('Bot not found');
    }

    if (bot.userId !== userId) {
      throw new Error('Unauthorized');
    }

    // Close all open positions
    // TODO: Implement close all positions logic

    await botExecutionEngine.stopBot(botId);
    const updated = await botService.updateBotStatus(botId, 'stopped');

    await botService.recordBotAction({
      id: `log-${Date.now()}`,
      botId,
      userId,
      action: 'stopped',
      description: 'Bot stopped by user',
      previousState: { status: bot.status },
      newState: { status: 'stopped' },
    });

    return {
      id: updated?.id,
      status: 'stopped',
      message: 'Bot stopped successfully',
    };
  } catch (error) {
    throw new Error(`Failed to stop bot: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Update bot configuration
 * PUT /api/bots/:id/config
 */
export async function updateBotConfigHandler(
  botId: string,
  userId: string,
  updates: UpdateBotConfigRequest
): Promise<any> {
  try {
    const bot = await botService.getBotById(botId);

    if (!bot) {
      throw new Error('Bot not found');
    }

    if (bot.userId !== userId) {
      throw new Error('Unauthorized');
    }

    if (bot.status !== 'paused' && bot.status !== 'stopped') {
      throw new Error('Bot must be paused or stopped to update configuration');
    }

    const currentConfig = bot.configuration as any;
    const newConfig = {
      inputs: updates.inputs || currentConfig.inputs,
      riskControl: updates.riskControl || currentConfig.riskControl,
    };

    const updated = await botService.updateBotConfig(botId, newConfig);

    await botService.recordBotAction({
      id: `log-${Date.now()}`,
      botId,
      userId,
      action: 'config_updated',
      description: 'Bot configuration updated',
      previousState: currentConfig,
      newState: newConfig,
    });

    return {
      id: updated?.id,
      configuration: updated?.configuration,
      message: 'Configuration updated successfully',
    };
  } catch (error) {
    throw new Error(`Failed to update bot config: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Delete a bot
 * DELETE /api/bots/:id
 */
export async function deleteBotHandler(botId: string, userId: string) {
  try {
    const bot = await botService.getBotById(botId);

    if (!bot) {
      throw new Error('Bot not found');
    }

    if (bot.userId !== userId) {
      throw new Error('Unauthorized');
    }

    // Stop bot if running
    if (bot.status === 'running') {
      await stopBotHandler(botId, userId);
    }

    // Soft delete by setting status
    await botService.deleteBot(botId);

    await botService.recordBotAction({
      id: `log-${Date.now()}`,
      botId,
      userId,
      action: 'deleted',
      description: 'Bot deleted by user',
    });

    return {
      id: botId,
      deleted: true,
      message: 'Bot deleted successfully',
    };
  } catch (error) {
    throw new Error(`Failed to delete bot: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Get bot trades
 * GET /api/bots/:id/trades
 */
export async function getBotTradesHandler(
  botId: string,
  userId: string,
  limit: number = 100,
  offset: number = 0
) {
  try {
    const bot = await botService.getBotById(botId);

    if (!bot) {
      throw new Error('Bot not found');
    }

    if (bot.userId !== userId) {
      throw new Error('Unauthorized');
    }

    const trades = await botService.getBotTrades(botId, limit, offset);

    return trades.map((t) => ({
      id: t.id,
      pair: t.pair,
      side: t.side,
      orderType: t.orderType,
      quantity: Number(t.quantity),
      filledQuantity: Number(t.filledQuantity),
      entryPrice: Number(t.entryPrice),
      filledPrice: Number(t.filledPrice),
      fee: Number(t.fee),
      pnl: Number(t.pnl || 0),
      pnlPercent: Number(t.pnlPercent || 0),
      status: t.status,
      exchange: t.exchange,
      triggerReason: t.triggerReason,
      timestamp: t.createdAt?.toISOString(),
      filledAt: t.filledAt?.toISOString(),
    }));
  } catch (error) {
    throw new Error(`Failed to get bot trades: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Get bot performance metrics
 * GET /api/bots/:id/performance
 */
export async function getBotPerformanceHandler(
  botId: string,
  userId: string
): Promise<BotPerformanceResponse> {
  try {
    const bot = await botService.getBotById(botId);

    if (!bot) {
      throw new Error('Bot not found');
    }

    if (bot.userId !== userId) {
      throw new Error('Unauthorized');
    }

    const performance = await botService.getBotPerformance(botId);

    if (!performance) {
      throw new Error('Performance data not found');
    }

    return {
      botId,
      strategyName: bot.botName,
      totalTrades: performance.totalTrades,
      winRate: Number(performance.winRate),
      profitFactor: Number(performance.profitFactor),
      averageWin: Number(performance.averageWin),
      averageLoss: Number(performance.averageLoss),
      largestWin: Number(performance.largestWin),
      largestLoss: Number(performance.largestLoss),
      currentDrawdown: Number(performance.currentDrawdown),
      totalProfit: Number(performance.totalProfit),
      sharpeRatio: Number(performance.sharpeRatio),
      maxConsecutiveWins: performance.maxConsecutiveWins,
      maxConsecutiveLosses: performance.maxConsecutiveLosses,
      avgTradeTime: `${Math.round(performance.averageTradeTime / 60000)}m`,
      totalFeesPaid: Number(performance.totalFeesPaid),
    };
  } catch (error) {
    throw new Error(`Failed to get bot performance: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Helper: Record a trade from bot
 * Called when bot executes a trade
 */
export async function recordBotTradeHandler(botId: string, userId: string, trade: BotTradeEvent) {
  try {
    const bot = await botService.getBotById(botId);

    if (!bot) {
      throw new Error('Bot not found');
    }

    if (bot.userId !== userId) {
      throw new Error('Unauthorized');
    }

    const recorded = await botService.recordBotTrade({
      id: trade.id,
      botId,
      userId,
      pair: trade.pair,
      side: trade.side,
      orderType: trade.type,
      quantity: trade.quantity.toString(),
      filledQuantity: trade.filledQuantity.toString(),
      entryPrice: trade.price.toString(),
      filledPrice: trade.filledPrice.toString(),
      fee: trade.fee.toString(),
      totalValue: (trade.filledQuantity * trade.filledPrice).toString(),
      status: trade.status,
      exchange: trade.exchange,
      pnl: trade.pnl ? trade.pnl.toString() : undefined,
      pnlPercent: trade.pnlPercent ? trade.pnlPercent.toString() : undefined,
      createdAt: new Date(trade.timestamp),
      filledAt: new Date(trade.timestamp),
    });

    return { recorded: true, tradeId: recorded.id };
  } catch (error) {
    throw new Error(`Failed to record trade: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
