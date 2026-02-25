/**
 * LOW-PRIORITY PERSISTENCE GAPS - IMPLEMENTATION PLAN
 * 
 * 10 gaps identified and ready for implementation:
 * 1. Snapshot History - Track governance snapshots and historical states
 * 2. Activity Feeds - User activity tracking and feed generation
 * 3. Message Logs - Direct message history and archival
 * 4. Type Definitions - Contribution type metadata and tracking
 * 5. Feature Flags - Per-DAO feature toggles and experiments
 * 6. Analytics Events - Custom event tracking for analytics
 * 7. API Keys - API key management and rate limiting
 * 8. User Preferences - Extended user preferences beyond settings
 * 9. Caching Metadata - Cache invalidation and hit tracking
 * 10. Audit Events - Detailed audit trail for compliance
 */

// ===== LOW-PRIORITY PERSISTENCE GAPS - PHASE 5 =====

// Gap #1: Snapshot History Table
export const snapshotHistory = pgTable("snapshot_history", {
  id: uuid("id").primaryKey().defaultRandom(),
  daoId: uuid("dao_id").references(() => daos.id, { onDelete: 'cascade' }).notNull(),
  snapshotType: varchar("snapshot_type", { length: 50 }).notNull(), // proposal, governance, treasury, membership
  snapshotName: varchar("snapshot_name", { length: 255 }),
  description: text("description"),
  
  // State snapshot
  blockNumber: bigint("block_number"), // Blockchain block number at snapshot
  blockTimestamp: timestamp("block_timestamp"), // When this snapshot was taken
  dataSnapshot: jsonb("data_snapshot").notNull(), // Full snapshot of relevant data
  
  // Metadata
  createdBy: varchar("created_by").references(() => users.id),
  metadata: jsonb("metadata"), // Additional context (tags, notes, source)
  isActive: boolean("is_active").default(true),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  daoIdx: index("snapshot_history_dao_idx").on(table.daoId),
  typeIdx: index("snapshot_history_type_idx").on(table.snapshotType),
  timeIdx: index("snapshot_history_time_idx").on(table.createdAt),
}));

export type SnapshotHistory = typeof snapshotHistory.$inferSelect;
export type InsertSnapshotHistory = typeof snapshotHistory.$inferInsert;

// Gap #2: Activity Feeds Table
export const activityFeeds = pgTable("activity_feeds", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: varchar("user_id").references(() => users.id, { onDelete: 'cascade' }).notNull(),
  daoId: uuid("dao_id").references(() => daos.id, { onDelete: 'cascade' }),
  
  // Activity details
  activityType: varchar("activity_type", { length: 100 }).notNull(), // created, updated, deleted, commented, voted, etc
  entityType: varchar("entity_type", { length: 50 }).notNull(), // proposal, task, comment, member, setting, etc
  entityId: varchar("entity_id", { length: 255 }).notNull(), // ID of the entity
  entityTitle: varchar("entity_title", { length: 500 }), // Human-readable title
  
  // Actor and context
  actorId: varchar("actor_id").references(() => users.id), // Who performed the action
  description: text("description"), // Human-readable description
  metadata: jsonb("metadata"), // Additional data (old value, new value, etc)
  
  // Visibility and engagement
  isPublic: boolean("is_public").default(true),
  likeCount: integer("like_count").default(0),
  commentCount: integer("comment_count").default(0),
  
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  userIdx: index("activity_feeds_user_idx").on(table.userId),
  daoIdx: index("activity_feeds_dao_idx").on(table.daoId),
  typeIdx: index("activity_feeds_type_idx").on(table.activityType),
  timeIdx: index("activity_feeds_time_idx").on(table.createdAt),
}));

export type ActivityFeed = typeof activityFeeds.$inferSelect;
export type InsertActivityFeed = typeof activityFeeds.$inferInsert;

// Gap #3: Message Logs Table
export const messageLogs = pgTable("message_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  
  // Message participants
  senderId: varchar("sender_id").references(() => users.id).notNull(),
  recipientId: varchar("recipient_id").references(() => users.id).notNull(),
  daoId: uuid("dao_id").references(() => daos.id, { onDelete: 'cascade' }), // Group chat
  
  // Message content
  content: text("content").notNull(),
  contentType: varchar("content_type", { length: 50 }).default("text"), // text, image, file, code
  threadId: uuid("thread_id"), // For threaded conversations
  replyToId: uuid("reply_to_id").references(() => messageLogs.id), // Reply to message
  
  // Status
  isRead: boolean("is_read").default(false),
  isEdited: boolean("is_edited").default(false),
  isDeleted: boolean("is_deleted").default(false),
  isDraft: boolean("is_draft").default(false),
  
  // Attachments
  attachmentUrls: text("attachment_urls").array(), // Array of file URLs
  
  // Metadata
  metadata: jsonb("metadata"), // Reactions, mentions, links, etc
  editedAt: timestamp("edited_at"),
  readAt: timestamp("read_at"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  senderIdx: index("message_logs_sender_idx").on(table.senderId),
  recipientIdx: index("message_logs_recipient_idx").on(table.recipientId),
  threadIdx: index("message_logs_thread_idx").on(table.threadId),
  timeIdx: index("message_logs_time_idx").on(table.createdAt),
}));

export type MessageLog = typeof messageLogs.$inferSelect;
export type InsertMessageLog = typeof messageLogs.$inferInsert;

// Gap #4: Type Definitions Table
export const typeDefinitions = pgTable("type_definitions", {
  id: uuid("id").primaryKey().defaultRandom(),
  daoId: uuid("dao_id").references(() => daos.id, { onDelete: 'cascade' }).notNull(),
  
  // Type info
  entityType: varchar("entity_type", { length: 100 }).notNull(), // contribution, task, proposal, etc
  typeName: varchar("type_name", { length: 255 }).notNull(), // Specific type name
  displayName: varchar("display_name", { length: 255 }),
  
  // Definition
  description: text("description"),
  schema: jsonb("schema"), // JSON schema for validation
  requiredFields: text("required_fields").array(), // Array of required field names
  defaultValues: jsonb("default_values"), // Default values for new instances
  
  // Metadata
  icon: varchar("icon", { length: 255 }), // Icon identifier
  color: varchar("color", { length: 7 }), // Hex color
  category: varchar("category", { length: 50 }), // Grouping category
  sortOrder: integer("sort_order").default(0),
  isActive: boolean("is_active").default(true),
  
  // Audit
  createdBy: varchar("created_by").references(() => users.id),
  metadata: jsonb("metadata"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  daoTypeIdx: index("type_definitions_dao_type_idx").on(table.daoId, table.entityType),
}));

export type TypeDefinition = typeof typeDefinitions.$inferSelect;
export type InsertTypeDefinition = typeof typeDefinitions.$inferInsert;

// Gap #5: Feature Flags Table
export const featureFlags = pgTable("feature_flags", {
  id: uuid("id").primaryKey().defaultRandom(),
  
  // Feature info
  flagName: varchar("flag_name", { length: 255 }).notNull().unique(), // Global unique name
  displayName: varchar("display_name", { length: 255 }),
  description: text("description"),
  
  // Scope
  scope: varchar("scope", { length: 50 }).notNull(), // global, dao, user, organization
  daoId: uuid("dao_id").references(() => daos.id, { onDelete: 'cascade' }), // If DAO-scoped
  userId: varchar("user_id").references(() => users.id, { onDelete: 'cascade' }), // If user-scoped
  
  // Status
  isEnabled: boolean("is_enabled").default(false),
  rolloutPercentage: integer("rollout_percentage").default(0), // 0-100% of users
  
  // Type
  flagType: varchar("flag_type", { length: 50 }).default("boolean"), // boolean, percentage, user-list, rule
  flagValue: jsonb("flag_value"), // For non-boolean flags
  
  // Management
  category: varchar("category", { length: 50 }), // experiment, beta, maintenance, bugfix
  enabledAt: timestamp("enabled_at"),
  disabledAt: timestamp("disabled_at"),
  expiresAt: timestamp("expires_at"), // Auto-disable after date
  
  // Metadata
  metadata: jsonb("metadata"), // A/B test data, metrics, etc
  createdBy: varchar("created_by").references(() => users.id),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  nameIdx: index("feature_flags_name_idx").on(table.flagName),
  daoIdx: index("feature_flags_dao_idx").on(table.daoId),
  enabledIdx: index("feature_flags_enabled_idx").on(table.isEnabled),
}));

export type FeatureFlag = typeof featureFlags.$inferSelect;
export type InsertFeatureFlag = typeof featureFlags.$inferInsert;

// Gap #6: Analytics Events Table
export const analyticsEvents = pgTable("analytics_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  
  // Event info
  eventName: varchar("event_name", { length: 100 }).notNull(), // page_view, button_click, transaction, error
  eventCategory: varchar("event_category", { length: 50 }).notNull(), // engagement, conversion, technical, security
  
  // User context
  userId: varchar("user_id").references(() => users.id, { onDelete: 'set null' }),
  daoId: uuid("dao_id").references(() => daos.id, { onDelete: 'set null' }),
  sessionId: varchar("session_id", { length: 255 }), // Session tracking
  
  // Event details
  eventValue: varchar("event_value", { length: 500 }), // Value associated with event
  eventLabel: varchar("event_label", { length: 255 }),
  
  // Context
  pageUrl: varchar("page_url", { length: 500 }),
  referrer: varchar("referrer", { length: 500 }),
  userAgent: text("user_agent"),
  ipAddress: varchar("ip_address", { length: 45 }), // IPv4 or IPv6
  
  // Metadata
  properties: jsonb("properties"), // Custom properties (conversion rate, amount, etc)
  metadata: jsonb("metadata"),
  
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  userIdx: index("analytics_events_user_idx").on(table.userId),
  eventIdx: index("analytics_events_event_idx").on(table.eventName),
  timeIdx: index("analytics_events_time_idx").on(table.createdAt),
}));

export type AnalyticsEvent = typeof analyticsEvents.$inferSelect;
export type InsertAnalyticsEvent = typeof analyticsEvents.$inferInsert;

// Gap #7: API Keys Table
export const apiKeys = pgTable("api_keys", {
  id: uuid("id").primaryKey().defaultRandom(),
  
  // Owner
  userId: varchar("user_id").references(() => users.id, { onDelete: 'cascade' }).notNull(),
  
  // Key info
  keyName: varchar("key_name", { length: 255 }).notNull(),
  keyPrefix: varchar("key_prefix", { length: 10 }).notNull(), // First 10 chars shown to user
  keyHash: varchar("key_hash", { length: 255 }).notNull().unique(), // Hashed key for verification
  
  // Permissions
  permissions: text("permissions").array(), // Array of permission strings (read:proposals, write:tasks, etc)
  allowedIps: text("allowed_ips").array(), // IP whitelist
  allowedOrigins: text("allowed_origins").array(), // CORS origins whitelist
  
  // Rate limiting
  rateLimitRequests: integer("rate_limit_requests"), // Max requests per window
  rateLimitWindow: integer("rate_limit_window").default(3600), // Window in seconds (default 1 hour)
  
  // Usage tracking
  lastUsedAt: timestamp("last_used_at"),
  usageCount: integer("usage_count").default(0),
  
  // Status
  isActive: boolean("is_active").default(true),
  expiresAt: timestamp("expires_at"), // Key expiration date
  
  // Metadata
  description: text("description"),
  metadata: jsonb("metadata"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  userIdx: index("api_keys_user_idx").on(table.userId),
  prefixIdx: index("api_keys_prefix_idx").on(table.keyPrefix),
  activeIdx: index("api_keys_active_idx").on(table.isActive),
}));

export type ApiKey = typeof apiKeys.$inferSelect;
export type InsertApiKey = typeof apiKeys.$inferInsert;

// Gap #8: User Preferences Table
export const userPreferences = pgTable("user_preferences", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: varchar("user_id").references(() => users.id, { onDelete: 'cascade' }).notNull().unique(),
  
  // UI Preferences
  theme: varchar("theme", { length: 20 }).default("light"), // light, dark, auto
  language: varchar("language", { length: 10 }).default("en"), // en, es, fr, etc
  dateFormat: varchar("date_format", { length: 20 }).default("YYYY-MM-DD"),
  timeFormat: varchar("time_format", { length: 20 }).default("24h"), // 12h or 24h
  timezone: varchar("timezone", { length: 100 }),
  
  // Content preferences
  defaultView: varchar("default_view", { length: 50 }).default("grid"), // grid, list, compact
  itemsPerPage: integer("items_per_page").default(20),
  autoRefreshInterval: integer("auto_refresh_interval").default(30000), // ms
  
  // Privacy
  showOnlineStatus: boolean("show_online_status").default(true),
  allowSearchIndexing: boolean("allow_search_indexing").default(true),
  showProfilePublically: boolean("show_profile_publicly").default(true),
  
  // Notifications (more granular than settings)
  notificationSound: boolean("notification_sound").default(true),
  desktopNotifications: boolean("desktop_notifications").default(true),
  emailNotifications: boolean("email_notifications").default(true),
  pushNotifications: boolean("push_notifications").default(true),
  
  // Feature preferences
  enableBeta: boolean("enable_beta").default(false),
  enableAnalytics: boolean("enable_analytics").default(true),
  
  // Accessibility
  highContrast: boolean("high_contrast").default(false),
  reducedMotion: boolean("reduced_motion").default(false),
  fontSize: varchar("font_size", { length: 20 }).default("medium"), // small, medium, large, xlarge
  
  // Other
  metadata: jsonb("metadata"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type UserPreference = typeof userPreferences.$inferSelect;
export type InsertUserPreference = typeof userPreferences.$inferInsert;

// Gap #9: Caching Metadata Table
export const cachingMetadata = pgTable("caching_metadata", {
  id: uuid("id").primaryKey().defaultRandom(),
  
  // Cache key info
  cacheKey: varchar("cache_key", { length: 500 }).notNull().unique(),
  cacheType: varchar("cache_type", { length: 50 }).notNull(), // user, dao, proposal, balance, price, etc
  
  // Related entity
  entityType: varchar("entity_type", { length: 50 }),
  entityId: varchar("entity_id", { length: 255 }),
  userId: varchar("user_id").references(() => users.id, { onDelete: 'cascade' }),
  daoId: uuid("dao_id").references(() => daos.id, { onDelete: 'cascade' }),
  
  // Cache status
  isValid: boolean("is_valid").default(true),
  invalidatedAt: timestamp("invalidated_at"),
  invalidationReason: varchar("invalidation_reason", { length: 255 }), // reason for invalidation
  
  // Usage metrics
  hitCount: integer("hit_count").default(0),
  missCount: integer("miss_count").default(0),
  lastAccessedAt: timestamp("last_accessed_at"),
  
  // TTL
  expiresAt: timestamp("expires_at"),
  ttlSeconds: integer("ttl_seconds"), // Time to live in seconds
  
  // Metadata
  metadata: jsonb("metadata"), // Cache-specific data
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  keyIdx: index("caching_metadata_key_idx").on(table.cacheKey),
  typeIdx: index("caching_metadata_type_idx").on(table.cacheType),
  expiresIdx: index("caching_metadata_expires_idx").on(table.expiresAt),
}));

export type CachingMetadata = typeof cachingMetadata.$inferSelect;
export type InsertCachingMetadata = typeof cachingMetadata.$inferInsert;

// Gap #10: Audit Events Table
export const auditEvents = pgTable("audit_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  
  // Actor
  actorId: varchar("actor_id").references(() => users.id, { onDelete: 'set null' }),
  actorRole: varchar("actor_role", { length: 50 }), // admin, user, system, etc
  
  // Action
  action: varchar("action", { length: 100 }).notNull(), // create, read, update, delete, export, import, etc
  resourceType: varchar("resource_type", { length: 100 }).notNull(), // user, proposal, dao, setting, etc
  resourceId: varchar("resource_id", { length: 255 }), // ID of the resource affected
  
  // Entity context
  daoId: uuid("dao_id").references(() => daos.id, { onDelete: 'cascade' }),
  
  // Change details
  beforeValue: jsonb("before_value"), // State before change
  afterValue: jsonb("after_value"), // State after change
  changesSummary: text("changes_summary"), // Human-readable summary
  
  // Access context
  ipAddress: varchar("ip_address", { length: 45 }),
  userAgent: text("user_agent"),
  sessionId: varchar("session_id", { length: 255 }),
  
  // Status
  status: varchar("status", { length: 50 }).default("success"), // success, failure, partial
  errorMessage: text("error_message"), // If failed
  
  // Severity for alerting
  severity: varchar("severity", { length: 20 }).default("info"), // info, warning, critical
  requiresReview: boolean("requires_review").default(false),
  
  // Metadata
  metadata: jsonb("metadata"),
  
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  actorIdx: index("audit_events_actor_idx").on(table.actorId),
  actionIdx: index("audit_events_action_idx").on(table.action),
  resourceIdx: index("audit_events_resource_idx").on(table.resourceType),
  daoIdx: index("audit_events_dao_idx").on(table.daoId),
  timeIdx: index("audit_events_time_idx").on(table.createdAt),
  severityIdx: index("audit_events_severity_idx").on(table.severity),
}));

export type AuditEvent = typeof auditEvents.$inferSelect;
export type InsertAuditEvent = typeof auditEvents.$inferInsert;
