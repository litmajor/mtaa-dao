
import { pgTable, uuid, varchar, decimal, timestamp } from 'drizzle-orm/pg-core';
import { investmentPools } from './schema';
import { users } from './schema';

export const poolShareListings = pgTable('pool_share_listings', {
  id: uuid('id').primaryKey().defaultRandom(),
  poolId: uuid('pool_id').references(() => investmentPools.id, { onDelete: 'cascade' }),
  sellerId: varchar('seller_id').references(() => users.id),
  shares: decimal('shares', { precision: 18, scale: 8 }).notNull(),
  pricePerShare: decimal('price_per_share', { precision: 18, scale: 8 }).notNull(),
  status: varchar('status', { length: 20 }).default('active'), // active, sold, cancelled
  createdAt: timestamp('created_at').defaultNow(),
  expiresAt: timestamp('expires_at'),
});

export const poolShareTrades = pgTable('pool_share_trades', {
  id: uuid('id').primaryKey().defaultRandom(),
  listingId: uuid('listing_id').references(() => poolShareListings.id),
  poolId: uuid('pool_id').references(() => investmentPools.id),
  buyerId: varchar('buyer_id').references(() => users.id),
  sellerId: varchar('seller_id').references(() => users.id),
  shares: decimal('shares', { precision: 18, scale: 8 }).notNull(),
  pricePerShare: decimal('price_per_share', { precision: 18, scale: 8 }).notNull(),
  totalAmount: decimal('total_amount', { precision: 18, scale: 2 }).notNull(),
  status: varchar('status', { length: 20 }).default('completed'),
  tradedAt: timestamp('traded_at').defaultNow(),
});
