import { pgTable, pgEnum, text, varchar, integer, boolean, timestamp, decimal, jsonb, serial, uniqueIndex } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { users } from './schema';
import { nanoid } from 'nanoid';

// Achievement tiers
export const achievementTierEnum = pgEnum('achievement_tier', [
  'bronze',
  'silver',
  'gold',
  'platinum',
  'diamond',
  'legendary'
]);

// Achievement categories
export const achievementCategoryEnum = pgEnum('achievement_category', [
  'community',
  'governance',
  'contribution',
  'reputation',
  'wealth',
  'trading',
  'lending',
  'staking',
  'nft',
  'special_event',
  'milestone'
]);

// Achievement status for users
export const achievementStatusEnum = pgEnum('achievement_status', [
  'locked',
  'unlocked',
  'claimed',
  'nft_minted'
]);

/**
 * Achievement definitions - Core achievement metadata
 */
export const achievements = pgTable('achievements', {
  id: varchar('id', { length: 255 }).primaryKey().$defaultFn(() => nanoid()),
  
  // Basic Info
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description').notNull(),
  category: achievementCategoryEnum('category').notNull(),
  tier: achievementTierEnum('tier').notNull().default('bronze'),
  
  // Criteria
  criteria: jsonb('criteria').notNull(), // { type: 'referrals' | 'voting' | 'contributions' | 'reputation' | 'transactions' | ..., threshold: number }
  requiresApproval: boolean('requires_approval').default(false),
  
  // Rewards
  rewardPoints: integer('reward_points').notNull().default(0),
  rewardTokens: varchar('reward_tokens', { length: 255 }).notNull().default('0'),
  nftMintable: boolean('nft_mintable').notNull().default(false),
  
  // NFT-specific
  nftRarity: varchar('nft_rarity', { length: 50 }), // 'common', 'uncommon', 'rare', 'epic', 'legendary'
  nftImageUrl: text('nft_image_url'),
  nftMetadataUri: text('nft_metadata_uri'),
  nftTradeableAfterDays: integer('nft_tradeable_after_days').default(0),
  
  // Display
  icon: varchar('icon', { length: 100 }),
  badgeColor: varchar('badge_color', { length: 50 }),
  displayOrder: integer('display_order').default(0),
  
  // Lifecycle
  isActive: boolean('is_active').notNull().default(true),
  isHidden: boolean('is_hidden').notNull().default(false),
  
  // Metadata
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  
  // Search & indexing
  tags: text('tags').array(),
});

/**
 * User Achievement Progress - Track user progress toward each achievement
 */
export const userAchievementProgress = pgTable('user_achievement_progress', {
  id: varchar('id', { length: 255 }).primaryKey().$defaultFn(() => nanoid()),
  
  // References
  userId: varchar('user_id', { length: 255 }).notNull(),
  achievementId: varchar('achievement_id', { length: 255 }).notNull(),
  
  // Progress tracking
  status: achievementStatusEnum('status').notNull().default('locked'),
  progressValue: decimal('progress_value', { precision: 18, scale: 8 }).default('0'),
  progressPercent: integer('progress_percent').default(0),
  
  // Lifecycle
  unlockedAt: timestamp('unlocked_at'),
  claimedAt: timestamp('claimed_at'),
  nftMintedAt: timestamp('nft_minted_at'),
  nftTokenId: varchar('nft_token_id', { length: 255 }),
  
  // NFT details
  nftContractAddress: varchar('nft_contract_address', { length: 255 }),
  nftTransactionHash: varchar('nft_transaction_hash', { length: 255 }),
  nftTradeableAt: timestamp('nft_tradeable_at'),
  
  // Metadata
  lastCheckedAt: timestamp('last_checked_at'),
  notificationSent: boolean('notification_sent').default(false),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

/**
 * Achievement Badges - Cosmetic badges that can be combined
 */
export const achievementBadges = pgTable('achievement_badges', {
  id: varchar('id', { length: 255 }).primaryKey().$defaultFn(() => nanoid()),
  
  // Basic Info
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  
  // Combination badges - badges that unlock when multiple achievements are earned
  requiredAchievementIds: text('required_achievement_ids').array(),
  
  // Display
  icon: varchar('icon', { length: 100 }),
  badgeColor: varchar('badge_color', { length: 50 }),
  imageUrl: text('image_url'),
  
  // Status
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

/**
 * User Achievement Badges - Track which badges user has unlocked
 */
export const userAchievementBadges = pgTable('user_achievement_badges', {
  id: varchar('id', { length: 255 }).primaryKey().$defaultFn(() => nanoid()),
  
  // References
  userId: varchar('user_id', { length: 255 }).notNull(),
  badgeId: varchar('badge_id', { length: 255 }).notNull(),
  
  // Status
  isEquipped: boolean('is_equipped').default(false),
  unlockedAt: timestamp('unlocked_at').notNull().defaultNow(),
});

/**
 * Achievement Milestones - Progression tiers within achievements
 */
export const achievementMilestones = pgTable('achievement_milestones', {
  id: varchar('id', { length: 255 }).primaryKey().$defaultFn(() => nanoid()),
  
  // References
  achievementId: varchar('achievement_id', { length: 255 }).notNull(),
  
  // Milestone info
  level: integer('level').notNull(), // 1, 2, 3, etc.
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  
  // Threshold
  thresholdValue: decimal('threshold_value', { precision: 18, scale: 8 }).notNull(),
  
  // Rewards at this milestone
  rewardBonus: integer('reward_bonus').default(0), // Additional reward points
  nftMintable: boolean('nft_mintable').default(false),
  
  // Display
  icon: varchar('icon', { length: 100 }),
  order: integer('order').notNull(),
  
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

/**
 * User Milestone Progress - Track milestone progress
 */
export const userMilestoneProgress = pgTable('user_milestone_progress', {
  id: varchar('id', { length: 255 }).primaryKey().$defaultFn(() => nanoid()),
  
  // References
  userId: varchar('user_id', { length: 255 }).notNull(),
  milestoneId: varchar('milestone_id', { length: 255 }).notNull(),
  
  // Status
  completed: boolean('completed').default(false),
  completedAt: timestamp('completed_at'),
  
  // NFT minted for this milestone
  nftTokenId: varchar('nft_token_id', { length: 255 }),
  nftMintedAt: timestamp('nft_minted_at'),
  
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

/**
 * Achievement Leaderboard - Cache for performance
 */
export const achievementLeaderboard = pgTable('achievement_leaderboard', {
  id: varchar('id', { length: 255 }).primaryKey().$defaultFn(() => nanoid()),
  
  // References
  userId: varchar('user_id', { length: 255 }).notNull(),
  
  // Stats
  totalAchievements: integer('total_achievements').notNull().default(0),
  unlockedAchievements: integer('unlocked_achievements').notNull().default(0),
  totalRewardPoints: integer('total_reward_points').notNull().default(0),
  totalRewardTokens: decimal('total_reward_tokens', { precision: 18, scale: 8 }).notNull().default('0'),
  nftCount: integer('nft_count').notNull().default(0),
  tier: achievementTierEnum('tier').notNull().default('bronze'),
  
  // Ranking
  rank: integer('rank'),
  percentile: integer('percentile'),
  
  // Lifecycle
  lastUpdatedAt: timestamp('last_updated_at').notNull().defaultNow(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

/**
 * Achievement Events - Track achievement-related events for analytics
 */
export const achievementEvents = pgTable('achievement_events', {
  id: varchar('id', { length: 255 }).primaryKey().$defaultFn(() => nanoid()),
  
  // References
  userId: varchar('user_id', { length: 255 }).notNull(),
  achievementId: varchar('achievement_id', { length: 255 }).notNull(),
  
  // Event info
  eventType: varchar('event_type', { length: 50 }).notNull(), // 'unlocked', 'claimed', 'nft_minted', 'shared'
  metadata: jsonb('metadata'),
  
  // Tracking
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

/**
 * Special Event Achievements - Limited-time achievements tied to events
 */
export const specialEventAchievements = pgTable('special_event_achievements', {
  id: varchar('id', { length: 255 }).primaryKey().$defaultFn(() => nanoid()),
  
  // Event info
  eventName: varchar('event_name', { length: 255 }).notNull(),
  description: text('description'),
  
  // Reference to achievement
  achievementId: varchar('achievement_id', { length: 255 }).notNull(),
  
  // Dates
  startDate: timestamp('start_date').notNull(),
  endDate: timestamp('end_date').notNull(),
  
  // Limits
  maxAwards: integer('max_awards'),
  awardsCount: integer('awards_count').default(0),
  
  // Status
  isActive: boolean('is_active').default(true),
  
  createdAt: timestamp('created_at').notNull().defaultNow(),
});
