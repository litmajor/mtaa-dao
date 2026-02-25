/**
 * Bot Database Service Layer
 * Provides database operations for bot management
 */

import { db } from '../index';
import {
  bots,
  botTrades,
  botPerformance,
  botActionLog,
  Bot,
  BotInsert,
  BotTrade,
  BotTradeInsert,
  BotPerformance,
  BotPerformanceInsert,
  BotActionLog,
  BotActionLogInsert,
} from './schema/bots';
import { eq, and, desc, asc, gte, lte, inArray } from 'drizzle-orm';

/**
 * Create a new bot deployment
 */
export async function createBot(data: BotInsert): Promise<Bot> {
  const [bot] = await db.insert(bots).values(data).returning();
  return bot;
}

/**
 * Get bot by ID
 */
export async function getBotById(botId: string): Promise<Bot | null> {
  const [bot] = await db
    .select()
    .from(bots)
    .where(eq(bots.id, botId))
    .limit(1);
  return bot || null;
}

/**
 * Get all bots for a user
 */
export async function getUserBots(userId: string): Promise<Bot[]> {
  return db
    .select()
    .from(bots)
    .where(eq(bots.userId, userId))
    .orderBy(desc(bots.deployedAt));
}

/**
 * Get active bots for a user
 */
export async function getActiveBots(userId: string): Promise<Bot[]> {
  return db
    .select()
    .from(bots)
    .where(and(eq(bots.userId, userId), eq(bots.status, 'running')))
    .orderBy(desc(bots.deployedAt));
}

/**
 * Update bot status
 */
export async function updateBotStatus(
  botId: string,
  status: string,
  errorMessage?: string
): Promise<Bot | null> {
  const updateData: any = {
    status,
    updatedAt: new Date(),
  };

  if (status === 'paused') {
    updateData.pausedAt = new Date();
  } else if (status === 'stopped') {
    updateData.stoppedAt = new Date();
  }

  if (errorMessage) {
    updateData.errorMessage = errorMessage;
  }

  const [bot] = await db
    .update(bots)
    .set(updateData)
    .where(eq(bots.id, botId))
    .returning();

  return bot || null;
}

/**
 * Update bot configuration
 */
export async function updateBotConfig(
  botId: string,
  config: Record<string, any>
): Promise<Bot | null> {
  const [bot] = await db
    .update(bots)
    .set({
      configuration: config,
      updatedAt: new Date(),
    })
    .where(eq(bots.id, botId))
    .returning();

  return bot || null;
}

/**
 * Delete bot (soft or hard delete)
 */
export async function deleteBot(botId: string): Promise<void> {
  // Soft delete by setting status to 'stopped'
  await updateBotStatus(botId, 'stopped');
}

/**
 * Record a bot trade
 */
export async function recordBotTrade(data: BotTradeInsert): Promise<BotTrade> {
  const [trade] = await db
    .insert(botTrades)
    .values(data)
    .returning();
  return trade;
}

/**
 * Get bot trades
 */
export async function getBotTrades(
  botId: string,
  limit: number = 100,
  offset: number = 0
): Promise<BotTrade[]> {
  return db
    .select()
    .from(botTrades)
    .where(eq(botTrades.botId, botId))
    .orderBy(desc(botTrades.createdAt))
    .limit(limit)
    .offset(offset);
}

/**
 * Get bot trades by status
 */
export async function getBotTradesByStatus(
  botId: string,
  status: string
): Promise<BotTrade[]> {
  return db
    .select()
    .from(botTrades)
    .where(and(eq(botTrades.botId, botId), eq(botTrades.status, status)))
    .orderBy(desc(botTrades.createdAt));
}

/**
 * Get bot trades by pair
 */
export async function getBotTradesByPair(
  botId: string,
  pair: string
): Promise<BotTrade[]> {
  return db
    .select()
    .from(botTrades)
    .where(and(eq(botTrades.botId, botId), eq(botTrades.pair, pair)))
    .orderBy(desc(botTrades.createdAt));
}

/**
 * Get bot trades in date range
 */
export async function getBotTradesInRange(
  botId: string,
  startDate: Date,
  endDate: Date
): Promise<BotTrade[]> {
  return db
    .select()
    .from(botTrades)
    .where(
      and(
        eq(botTrades.botId, botId),
        gte(botTrades.createdAt, startDate),
        lte(botTrades.createdAt, endDate)
      )
    )
    .orderBy(asc(botTrades.createdAt));
}

/**
 * Update bot trade (mark as filled, closed, etc.)
 */
export async function updateBotTrade(
  tradeId: string,
  updates: Partial<BotTrade>
): Promise<BotTrade | null> {
  const [trade] = await db
    .update(botTrades)
    .set(updates)
    .where(eq(botTrades.id, tradeId))
    .returning();

  return trade || null;
}

/**
 * Create or update bot performance
 */
export async function upsertBotPerformance(
  data: BotPerformanceInsert
): Promise<BotPerformance> {
  // Check if performance record exists
  const [existing] = await db
    .select()
    .from(botPerformance)
    .where(eq(botPerformance.botId, data.botId))
    .limit(1);

  if (existing) {
    const [updated] = await db
      .update(botPerformance)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(botPerformance.botId, data.botId))
      .returning();
    return updated;
  } else {
    const [created] = await db
      .insert(botPerformance)
      .values(data)
      .returning();
    return created;
  }
}

/**
 * Get bot performance
 */
export async function getBotPerformance(
  botId: string
): Promise<BotPerformance | null> {
  const [perf] = await db
    .select()
    .from(botPerformance)
    .where(eq(botPerformance.botId, botId))
    .limit(1);

  return perf || null;
}

/**
 * Get user bots with performance
 */
export async function getUserBotsWithPerformance(userId: string) {
  return db
    .select()
    .from(bots)
    .leftJoin(
      botPerformance,
      eq(bots.id, botPerformance.botId)
    )
    .where(eq(bots.userId, userId))
    .orderBy(desc(bots.deployedAt));
}

/**
 * Record bot action
 */
export async function recordBotAction(
  data: BotActionLogInsert
): Promise<BotActionLog> {
  const [log] = await db
    .insert(botActionLog)
    .values(data)
    .returning();

  return log;
}

/**
 * Get bot action log
 */
export async function getBotActionLog(
  botId: string,
  limit: number = 50
): Promise<BotActionLog[]> {
  return db
    .select()
    .from(botActionLog)
    .where(eq(botActionLog.botId, botId))
    .orderBy(desc(botActionLog.createdAt))
    .limit(limit);
}

/**
 * Get bot statistics
 * Summary stats across all bots
 */
export async function getUserBotStats(userId: string) {
  const userBots = await getUserBots(userId);
  const activeBots = await getActiveBots(userId);

  let totalProfit = 0;
  let totalTrades = 0;
  let winningTrades = 0;

  for (const bot of userBots) {
    const perf = await getBotPerformance(bot.id);
    if (perf) {
      totalProfit += Number(perf.totalProfit || 0);
      totalTrades += perf.totalTrades;
      winningTrades += perf.winningTrades;
    }
  }

  return {
    totalBots: userBots.length,
    activeBots: activeBots.length,
    totalProfit,
    totalTrades,
    avgWinRate: totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0,
  };
}

/**
 * Get leaderboard (top performing bots)
 */
export async function getTopBots(
  metric: 'profit' | 'winRate' | 'sharpe' = 'profit',
  limit: number = 10
) {
  let orderBy;

  switch (metric) {
    case 'winRate':
      orderBy = desc(botPerformance.winRate);
      break;
    case 'sharpe':
      orderBy = desc(botPerformance.sharpeRatio);
      break;
    default:
      orderBy = desc(botPerformance.totalProfit);
  }

  return db
    .select()
    .from(botPerformance)
    .orderBy(orderBy)
    .limit(limit);
}

/**
 * Clean up old trades (archive old data)
 */
export async function archiveOldTrades(botId: string, beforeDate: Date) {
  // In production, you might want to archive to a separate table
  // This just returns the trades that would be archived
  return db
    .select()
    .from(botTrades)
    .where(
      and(
        eq(botTrades.botId, botId),
        lte(botTrades.createdAt, beforeDate)
      )
    );
}
