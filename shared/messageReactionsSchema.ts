import { pgTable, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';

export const messageReactions = pgTable(
  'message_reactions',
  {
    messageId: text('message_id').notNull(),
    userId: text('user_id').notNull(),
    daoId: text('dao_id').notNull(),
    emoji: text('emoji').notNull(),
    createdAt: timestamp('created_at').defaultNow(),
  },
  (table) => ({
    // Composite unique index to prevent duplicate reactions
    uniqueReaction: uniqueIndex('unique_reaction_idx').on(
      table.messageId,
      table.userId,
      table.emoji
    ),
  })
);

export type MessageReaction = typeof messageReactions.$inferSelect;
export type NewMessageReaction = typeof messageReactions.$inferInsert;