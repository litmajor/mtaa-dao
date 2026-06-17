/**
 * Database Relations
 * Defines relationships between bot tables
 */

import { relations } from 'drizzle-orm';
import { bots, botTrades, botPerformance, botActionLog } from '../schema/bots';
import { users } from '../../../shared/schema';

/**
 * Bot Relations
 * - One user has many bots
 * - One bot has many trades
 * - One bot has one performance record
 * - One bot has many action logs
 */
export const botsRelations = relations(bots, ({ one, many }) => ({
  user: one(users, {
    fields: [bots.userId],
    references: [users.id],
  }),
  trades: many(botTrades),
  performance: one(botPerformance),
  actionLogs: many(botActionLog),
}));

/**
 * Bot Trades Relations
 * - Many trades belong to one bot
 * - Many trades belong to one user
 */
export const botTradesRelations = relations(botTrades, ({ one }) => ({
  bot: one(bots, {
    fields: [botTrades.botId],
    references: [bots.id],
  }),
  user: one(users, {
    fields: [botTrades.userId],
    references: [users.id],
  }),
}));

/**
 * Bot Performance Relations
 * - One performance record belongs to one bot
 * - One performance record belongs to one user
 */
export const botPerformanceRelations = relations(botPerformance, ({ one }) => ({
  bot: one(bots, {
    fields: [botPerformance.botId],
    references: [bots.id],
  }),
  user: one(users, {
    fields: [botPerformance.userId],
    references: [users.id],
  }),
}));

/**
 * Bot Action Log Relations
 * - Many action logs belong to one bot
 */
export const botActionLogRelations = relations(botActionLog, ({ one }) => ({
  bot: one(bots, {
    fields: [botActionLog.botId],
    references: [bots.id],
  }),
}));

/**
 * User Relations Extension
 * Note: Add these to your existing users relations
 */
export const userBotsExtension = relations(users, ({ many }) => ({
  bots: many(bots),
  botTrades: many(botTrades),
  botPerformance: many(botPerformance),
}));
