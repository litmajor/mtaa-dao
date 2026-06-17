# Hisa/MtaaDAO — Complete Schema Audit
> All 12 schema files accounted. `operational/schema` still pending.

---

## Summary

| Metric | Count |
|---|---|
| Schema files audited | 12 of 13 |
| Total table definitions (incl. duplicates) | 224 |
| **Unique table names** | **219** |
| Duplicate table names (crash risk) | **5** |
| Functional redundancies (non-crashing) | 2 |

---

## Table Count by File

| File | Tables |
|---|---|
| `schema.ts` | 175 |
| `securityEnhancedSchema.ts` | 12 |
| `financialEnhancedSchema.ts` | 10 |
| `accountSchema.ts` | 8 |
| `kycSchema.ts` | 3 |
| `vestingSchema.ts` | 3 |
| `escrowSchema.ts` | 3 |
| `transactionFlowSchema.ts` | 3 |
| `invoiceSchema.ts` | 2 |
| `onboardingSchema.ts` | 2 |
| `poolShareSchema.ts` | 2 |
| `messageReactionsSchema.ts` | 1 |
| `operational/schema` | ❓ pending |

---

## 🔴 Critical Duplicates — Will Crash on Migration

Each of these causes Drizzle/Postgres to see the same table name registered twice.
Fix all 5 before running `drizzle-kit push` or any migration.

---

### 1. `message_reactions`
**In:** `schema.ts` + `messageReactionsSchema.ts`

| Column | `schema.ts` | `messageReactionsSchema.ts` |
|---|---|---|
| `id` (PK) | ✓ uuid | ✗ missing |
| `messageId` | uuid FK→daoMessages cascade | text, no FK |
| `userId` | varchar FK→users cascade | text, no FK |
| `daoId` | ✗ missing | text |
| `emoji` | varchar(10) | text |
| unique constraint | ✗ missing | ✓ on (messageId, userId, emoji) |

**Fix — keep in `schema.ts`, delete `messageReactionsSchema.ts`:**
```ts
export const messageReactions = pgTable("message_reactions", {
  id: uuid("id").primaryKey().defaultRandom(),
  messageId: uuid("message_id")
    .references(() => daoMessages.id, { onDelete: 'cascade' }).notNull(),
  userId: varchar("user_id")
    .references(() => users.id, { onDelete: 'cascade' }).notNull(),
  daoId: uuid("dao_id").references(() => daos.id),   // ADD from messageReactionsSchema
  emoji: varchar("emoji", { length: 10 }).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  uniqueReaction: uniqueIndex("unique_reaction_idx")  // ADD from messageReactionsSchema
    .on(table.messageId, table.userId, table.emoji),
}));
```

---

### 2. `refresh_tokens`
**In:** `schema.ts` + `securityEnhancedSchema.ts`

| Column | `schema.ts` | `securityEnhancedSchema.ts` |
|---|---|---|
| `revoked` (boolean) | ✓ | ✗ |
| `rotatedAt` | ✓ | ✗ |
| `updatedAt` | ✓ | ✗ |
| `deviceId` FK→userDevices | ✗ | ✓ |
| `revokedReason` | ✗ | ✓ |
| `replacedBy` (rotation chain) | ✗ | ✓ |

**Fix — keep in `securityEnhancedSchema.ts`, delete from `schema.ts`:**
```ts
export const refreshTokens = pgTable("refresh_tokens", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: varchar("user_id")
    .references(() => users.id, { onDelete: 'cascade' }).notNull(),
  tokenHash: varchar("token_hash").notNull().unique(),
  deviceId: uuid("device_id").references(() => userDevices.id),
  ipAddress: varchar("ip_address").notNull(),
  userAgent: text("user_agent"),
  expiresAt: timestamp("expires_at").notNull(),
  revoked: boolean("revoked").default(false),          // ADD from schema.ts
  revokedAt: timestamp("revoked_at"),
  revokedReason: varchar("revoked_reason"),
  rotatedAt: timestamp("rotated_at"),                  // ADD from schema.ts
  replacedBy: uuid("replaced_by"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),     // ADD from schema.ts
});
```

---

### 3. `api_keys`
**In:** `schema.ts` + `securityEnhancedSchema.ts`

| Column | `schema.ts` | `securityEnhancedSchema.ts` |
|---|---|---|
| `isActive` | ✓ | ✗ (uses `enabled`) |
| `metadata` | ✓ | ✗ |
| `keyPrefix` | ✗ | ✓ |
| `lastUsedIp` | ✗ | ✓ |
| `revokedAt` + `revokedReason` | ✗ | ✓ |

**Fix — keep in `securityEnhancedSchema.ts`, delete from `schema.ts`:**
```ts
export const apiKeys = pgTable("api_keys", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: varchar("user_id")
    .references(() => users.id, { onDelete: 'cascade' }).notNull(),
  name: varchar("name").notNull(),
  keyHash: varchar("key_hash").notNull().unique(),
  keyPrefix: varchar("key_prefix").notNull(),
  permissions: jsonb("permissions").default([]),
  rateLimit: integer("rate_limit").default(1000),
  ipWhitelist: jsonb("ip_whitelist").default([]),
  isActive: boolean("is_active").default(true),        // use isActive not enabled
  lastUsedAt: timestamp("last_used_at"),
  lastUsedIp: varchar("last_used_ip"),
  expiresAt: timestamp("expires_at"),
  revokedAt: timestamp("revoked_at"),
  revokedReason: text("revoked_reason"),
  metadata: jsonb("metadata").default({}),             // ADD from schema.ts
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});
```

---

### 4. `user_reputation`
**In:** `schema.ts` + `financialEnhancedSchema.ts`

These are not the same concept. They share only `id`, `userId`, `updatedAt`.

| Aspect | `schema.ts` version | `financialEnhancedSchema.ts` version |
|---|---|---|
| Purpose | Per-DAO score breakdown | Platform-wide gamification |
| Has `daoId` | ✓ | ✗ |
| Score fields | proposalScore, voteScore, contributionScore | totalPoints, weeklyPoints, badge, level, streak |

**Fix — rename the financial version:**
```ts
// financialEnhancedSchema.ts: rename table to user_gamification
export const userGamification = pgTable("user_gamification", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: varchar("user_id").references(() => users.id).notNull().unique(),
  totalPoints: integer("total_points").default(0),
  weeklyPoints: integer("weekly_points").default(0),
  monthlyPoints: integer("monthly_points").default(0),
  currentStreak: integer("current_streak").default(0),
  longestStreak: integer("longest_streak").default(0),
  lastActivity: timestamp("last_activity").defaultNow(),
  badge: varchar("badge").default("Bronze"),
  level: integer("level").default(1),
  nextLevelPoints: integer("next_level_points").default(100),
  updatedAt: timestamp("updated_at").defaultNow(),
});
// Also update: InsertUserReputation → InsertUserGamification, insertUserReputationSchema, etc.
```

---

### 5. `cross_chain_transfers`
**In:** `schema.ts` + `accountSchema.ts`

These are different abstraction levels — only 7 of ~25 total columns overlap.
The `accountSchema.ts` version is canonical (proper bridge tracking, fee breakdown, source/target split).

**Fix — delete from `schema.ts`, re-export from accountSchema:**
```ts
// In schema.ts, replace the table definition with:
export { crossChainTransfers } from './accountSchema';

// If you need vaultId linkage, add it to accountSchema.ts version:
vaultId: uuid("vault_id").references(() => vaults.id),
```

---

## 🟡 Non-Crashing Redundancies (Clean Up When Convenient)

### A. 2FA columns on `users` table
The `users` table has `twoFactorEnabled`, `twoFactorMethod`, `twoFactorSecret`,
`twoFactorBackupCodes`, `twoFactorSetupAt`, `twoFactorVerifiedAt`, `twoFactorRecoveryEmail`
as direct columns. These duplicate the purpose of the `two_factor_auth` table in
`securityEnhancedSchema.ts`, which is properly normalized with a FK.

**Action:** Write a migration to move existing data, then drop those 7 columns from `users`.
```sql
INSERT INTO two_factor_auth (user_id, method, enabled, secret, backup_codes, enabled_at)
SELECT id, two_factor_method, two_factor_enabled, two_factor_secret,
       two_factor_backup_codes, two_factor_setup_at
FROM users WHERE two_factor_enabled = true;

ALTER TABLE users
  DROP COLUMN two_factor_enabled,
  DROP COLUMN two_factor_method,
  DROP COLUMN two_factor_secret,
  DROP COLUMN two_factor_backup_codes,
  DROP COLUMN two_factor_setup_at,
  DROP COLUMN two_factor_verified_at,
  DROP COLUMN two_factor_recovery_email;
```

### B. `user_kyc` vs `kyc_verifications`
These serve different purposes — keep both.
- `user_kyc` (schema.ts): lightweight profile-level KYC, used for membership gating
- `kyc_verifications` (kycSchema.ts): full compliance KYC with AML screening, document storage, tiered limits

---

## Complete Table List (219 unique)

### schema.ts (175)
`activity_feed`, `agent_performance_metrics`, `api_keys`*, `api_usage_metrics`, `asset_edges`,
`asset_graph_versions`, `asset_nodes`, `asset_price_history`, `asset_state_snapshots`,
`audit_logs`, `beta_access`, `billing_history`, `bill_split_participants`, `bill_split_payments`,
`bill_splits`, `biometric_settings`, `blockchain_health_metrics`, `bridge_transfers`,
`budget_plans`, `cefi_exchange_metrics`, `chain_info`, `chains`, `comment_likes`, `config`,
`content_reports`, `contributions`, `contribution_graph`*, `correlation_matrices`,
`cross_chain_proposals`, `cross_chain_transfers`*, `dao_achievement_milestones`,
`dao_analytics`, `dao_content`, `dao_contribution_approvals`, `dao_contribution_types`,
`dao_contributions`, `dao_creation_tracker`, `dao_engagement_metrics`, `dao_identity_nfts`,
`dao_invitations`, `dao_invites`, `dao_memberships`, `dao_messages`, `dao_multisig_config`,
`dao_of_the_week`, `dao_ratings`, `dao_rotation_cycles`, `dao_rules`, `dao_settings`,
`dao_social_verifications`, `dao_treasury_credits`, `daos`, `defi_protocol_metrics`,
`execution_history`, `execution_metrics`, `execution_statistics`, `file_uploads`,
`leaderboard_rankings`, `leaderboards`, `limit_orders`, `liquidity_pool_metrics`,
`loan_facilities`, `locked_savings`, `logs`, `message_attachments`, `message_reactions`*,
`ml_training_data`, `mtaa_distribution_rules`, `multisig_creation_jobs`, `multisig_signatures`,
`multisig_signer_keys`, `multisig_signers`, `multisig_transaction_signatures`,
`multisig_transactions`, `multisig_wallets`, `notification_history`, `notification_metadata`,
`notification_preferences`, `notifications`, `payment_provider_metrics`, `payment_receipts`,
`payment_requests`, `payment_transactions`, `pending_transactions`, `pin_reset_requests`,
`platform_announcements`, `platform_growth_metrics`, `platform_metrics`, `platform_revenue`,
`pool_assets`, `pool_governance_settings`, `pool_investments`, `pool_performance`,
`pool_proposals`, `pool_rebalances`, `pool_swap_transactions`, `pool_vote_delegations`,
`pool_votes`, `pool_withdrawals`, `portfolio_templates`, `proposal_comments`,
`proposal_execution_queue`, `proposal_likes`, `proposal_templates`, `proposals`,
`quorum_history`, `rebalancing_settings`, `referral_metrics`, `referral_rewards`,
`referral_tiers`, `refresh_tokens`*, `revenue_metrics`, `reward_distribution`,
`rule_executions`, `rule_templates`, `savings_goals`, `session_notifications`, `sessions`,
`stable_asset_registry`, `stable_inflow_events`, `subscriptions`, `success_stories`,
`support_ticket_metrics`, `support_tickets`, `system_logs`, `task_attachments`, `task_history`,
`task_templates`, `tasks`, `template_asset_allocations`, `treasury_approvals`,
`treasury_audit_log`, `treasury_budget_allocations`, `treasury_health_history`,
`treasury_limits`, `treasury_multisig_transactions`, `treasury_positions`,
`treasury_reconciliation_audits`, `treasury_transactions`, `treasury_whitelist`,
`treasury_withdrawal_approvals`, `user_achievements`, `user_activities`,
`user_announcement_views`, `user_badges`, `user_contexts`, `user_follows`, `user_identities`,
`user_kyc`, `user_moderation_log`, `user_notification_preferences`, `user_reputation`*,
`users`, `vault_governance_proposals`, `vault_performance`, `vault_risk_assessments`,
`vault_strategy_allocations`, `vault_token_holdings`, `vault_transactions`,
`vault_withdrawal_tracking`, `vaults`, `venue_performance`, `vote_delegations`,
`votes`, `vouchers`, `wallet_access_log`, `wallet_private_keys`, `wallet_public_keys`,
`wallet_security_settings`, `wallet_seed_phrases`, `wallet_sessions`, `wallet_transactions`,
`wallets`, `withdrawal_approvals`

*duplicated — see fixes above

### accountSchema.ts (8)
`account_access_logs`, `account_settings`, `account_statements`, `account_transactions`,
`accounts`, `chain_accounts`, `chain_metrics`, `cross_chain_transfers`*

### securityEnhancedSchema.ts (12)
`account_recovery`, `api_keys`*, `email_delivery_log`, `login_attempts`, `oauth_connections`,
`password_history`, `refresh_tokens`*, `security_events`, `session_audits`,
`sms_delivery_log`, `two_factor_auth`, `user_devices`

### financialEnhancedSchema.ts (10)
`airdrop_eligibility`, `contribution_graph`, `economic_identity`, `micro_withdrawal_batches`,
`micro_withdrawals`, `msiamo_conversions`, `msiamo_points`, `reputation_badges`,
`skill_verifications`, `user_reputation`*

### transactionFlowSchema.ts (3)
`deposits`, `internal_transfers`, `withdrawals`

### kycSchema.ts (3)
`compliance_audit_logs`, `kyc_verifications`, `suspicious_activities`

### vestingSchema.ts (3)
`vesting_claims`, `vesting_milestones`, `vesting_schedules`

### escrowSchema.ts (3)
`escrow_accounts`, `escrow_disputes`, `escrow_milestones`

### invoiceSchema.ts (2)
`invoice_payments`, `invoices`

### onboardingSchema.ts (2)
`onboarding_progress`, `onboarding_steps`

### poolShareSchema.ts (2)
`pool_share_listings`, `pool_share_trades`

### messageReactionsSchema.ts (1)
`message_reactions`* — DELETE THIS FILE, merge into schema.ts

---