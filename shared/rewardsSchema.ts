import { pgTable, varchar, timestamp, integer, uuid, numeric } from 'drizzle-orm/pg-core';

export const reward_requests = pgTable('reward_requests', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: varchar('user_id').notNull(),
  userAchievementId: uuid('user_achievement_id').notNull(),
  amountUnits: numeric('amount_units', { precision: 38, scale: 0 }).notNull(),
  status: varchar('status').notNull().default('pending'),
  attempts: integer('attempts').default(0),
  idempotencyKey: varchar('idempotency_key').notNull(),
  txHash: varchar('tx_hash'),
  lastAttemptAt: timestamp('last_attempt_at'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
  processedAt: timestamp('processed_at')
});

export type RewardRequest = typeof reward_requests.$inferSelect;
