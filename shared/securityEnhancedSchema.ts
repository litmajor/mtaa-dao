// Enhanced Security Schema - Production-Grade Authentication Tables
// Add these tables to improve security, auditing, and user experience

import { pgTable, uuid, varchar, text, timestamp, boolean, integer, jsonb } from "drizzle-orm/pg-core";
import { users } from "./schema";

/**
 * 1. LOGIN ATTEMPTS TABLE
 * Purpose: Persistent tracking of failed login attempts (backup for Redis)
 * Benefits: Historical data, forensics, pattern detection
 */
export const loginAttempts = pgTable("login_attempts", {
  id: uuid("id").primaryKey().defaultRandom(),
  identifier: varchar("identifier").notNull(), // email or phone
  userId: varchar("user_id").references(() => users.id), // null if user not found
  ipAddress: varchar("ip_address").notNull(),
  userAgent: text("user_agent"),
  attemptResult: varchar("attempt_result").notNull(), // success, failed_password, failed_not_found, account_locked
  failureReason: text("failure_reason"),
  location: jsonb("location"), // { country, city, lat, lon } from IP geolocation
  deviceFingerprint: text("device_fingerprint"),
  createdAt: timestamp("created_at").defaultNow(),
});

/**
 * 2. SECURITY EVENTS TABLE
 * Purpose: Dedicated security event logging separate from audit logs
 * Benefits: Focused security monitoring, alerting, incident response
 */
export const securityEvents = pgTable("security_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: varchar("user_id").references(() => users.id),
  eventType: varchar("event_type").notNull(), // login_success, login_failed, account_locked, password_changed, 2fa_enabled, suspicious_activity
  severity: varchar("severity").notNull(), // low, medium, high, critical
  ipAddress: varchar("ip_address").notNull(),
  userAgent: text("user_agent"),
  location: jsonb("location"),
  details: jsonb("details"), // additional context
  resolved: boolean("resolved").default(false),
  resolvedBy: varchar("resolved_by").references(() => users.id),
  resolvedAt: timestamp("resolved_at"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

/**
 * 3. PASSWORD HISTORY TABLE
 * Purpose: Track password history to prevent reuse
 * Benefits: Enforce password rotation policies, prevent common reuse attacks
 */
export const passwordHistory = pgTable("password_history", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  passwordHash: varchar("password_hash").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

/**
 * 4. TWO FACTOR AUTHENTICATION TABLE
 * Purpose: Store 2FA settings and backup codes
 * Benefits: Enhanced security, account recovery
 */
export const twoFactorAuth = pgTable("two_factor_auth", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: varchar("user_id").references(() => users.id).notNull().unique(),
  method: varchar("method").notNull(), // totp, sms, email
  enabled: boolean("enabled").default(false),
  secret: text("secret"), // encrypted TOTP secret
  backupCodes: jsonb("backup_codes"), // array of hashed backup codes
  phoneNumber: varchar("phone_number"), // for SMS 2FA
  email: varchar("email"), // for email 2FA
  lastUsedAt: timestamp("last_used_at"),
  enabledAt: timestamp("enabled_at"),
  disabledAt: timestamp("disabled_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

/**
 * 5. USER DEVICES TABLE
 * Purpose: Track and manage trusted devices
 * Benefits: Device recognition, suspicious login detection
 */
export const userDevices = pgTable("user_devices", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  deviceName: varchar("device_name"), // "Chrome on Windows", "iPhone 13"
  deviceFingerprint: text("device_fingerprint").notNull().unique(),
  deviceType: varchar("device_type"), // mobile, desktop, tablet
  browser: varchar("browser"),
  os: varchar("os"),
  trusted: boolean("trusted").default(false),
  lastIpAddress: varchar("last_ip_address"),
  lastLocation: jsonb("last_location"),
  lastUsedAt: timestamp("last_used_at"),
  trustedAt: timestamp("trusted_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

/**
 * 6. EMAIL DELIVERY LOG TABLE
 * Purpose: Track all email deliveries (OTP, notifications, etc.)
 * Benefits: Debugging, delivery monitoring, compliance
 */
export const emailDeliveryLog = pgTable("email_delivery_log", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: varchar("user_id").references(() => users.id),
  toEmail: varchar("to_email").notNull(),
  subject: varchar("subject").notNull(),
  template: varchar("template"), // otp, password_reset, welcome, notification
  status: varchar("status").notNull(), // pending, sent, delivered, failed, bounced
  provider: varchar("provider"), // sendgrid, ses, gmail
  providerMessageId: varchar("provider_message_id"),
  errorMessage: text("error_message"),
  metadata: jsonb("metadata"),
  sentAt: timestamp("sent_at"),
  deliveredAt: timestamp("delivered_at"),
  openedAt: timestamp("opened_at"),
  clickedAt: timestamp("clicked_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

/**
 * 7. SMS DELIVERY LOG TABLE
 * Purpose: Track all SMS deliveries (OTP, notifications, etc.)
 * Benefits: Debugging, cost tracking, delivery monitoring
 */
export const smsDeliveryLog = pgTable("sms_delivery_log", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: varchar("user_id").references(() => users.id),
  toPhone: varchar("to_phone").notNull(),
  message: text("message").notNull(),
  template: varchar("template"), // otp, notification, alert
  status: varchar("status").notNull(), // pending, sent, delivered, failed
  provider: varchar("provider"), // africas_talking, twilio
  providerMessageId: varchar("provider_message_id"),
  cost: varchar("cost"), // cost in local currency
  errorMessage: text("error_message"),
  metadata: jsonb("metadata"),
  sentAt: timestamp("sent_at"),
  deliveredAt: timestamp("delivered_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

/**
 * 8. OAUTH CONNECTIONS TABLE
 * Purpose: Track OAuth provider connections (Google, Telegram, etc.)
 * Benefits: Account linking, SSO management
 */
export const oauthConnections = pgTable("oauth_connections", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  provider: varchar("provider").notNull(), // google, telegram, github
  providerUserId: varchar("provider_user_id").notNull(),
  providerEmail: varchar("provider_email"),
  providerUsername: varchar("provider_username"),
  accessToken: text("access_token"), // encrypted
  refreshToken: text("refresh_token"), // encrypted
  tokenExpiresAt: timestamp("token_expires_at"),
  scope: text("scope"),
  profileData: jsonb("profile_data"),
  lastSyncedAt: timestamp("last_synced_at"),
  connectedAt: timestamp("connected_at").defaultNow(),
  disconnectedAt: timestamp("disconnected_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

/**
 * 9. API KEYS TABLE
 * Purpose: User-generated API keys for programmatic access
 * Benefits: API access, automation, integrations
 */
export const apiKeys = pgTable("api_keys", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  name: varchar("name").notNull(),
  keyHash: varchar("key_hash").notNull().unique(), // hashed API key
  keyPrefix: varchar("key_prefix").notNull(), // first 8 chars for identification
  permissions: jsonb("permissions").default([]), // array of allowed permissions
  rateLimit: integer("rate_limit").default(1000), // requests per hour
  ipWhitelist: jsonb("ip_whitelist").default([]), // array of allowed IPs
  enabled: boolean("enabled").default(true),
  lastUsedAt: timestamp("last_used_at"),
  lastUsedIp: varchar("last_used_ip"),
  expiresAt: timestamp("expires_at"),
  revokedAt: timestamp("revoked_at"),
  revokedReason: text("revoked_reason"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

/**
 * 10. REFRESH TOKENS TABLE
 * Purpose: Track refresh tokens separately from sessions
 * Benefits: Token rotation, revocation, security monitoring
 */
export const refreshTokens = pgTable("refresh_tokens", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  tokenHash: varchar("token_hash").notNull().unique(),
  deviceId: uuid("device_id").references(() => userDevices.id),
  ipAddress: varchar("ip_address").notNull(),
  userAgent: text("user_agent"),
  expiresAt: timestamp("expires_at").notNull(),
  revokedAt: timestamp("revoked_at"),
  revokedReason: varchar("revoked_reason"), // logout, security, expired
  replacedBy: uuid("replaced_by"), // for token rotation
  createdAt: timestamp("created_at").defaultNow(),
});

/**
 * 11. ACCOUNT RECOVERY TABLE
 * Purpose: Track account recovery attempts and tokens
 * Benefits: Secure password reset, account recovery audit trail
 */
export const accountRecovery = pgTable("account_recovery", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  recoveryType: varchar("recovery_type").notNull(), // password_reset, account_unlock, 2fa_reset
  token: varchar("token").notNull().unique(),
  method: varchar("method").notNull(), // email, sms, security_questions
  ipAddress: varchar("ip_address").notNull(),
  userAgent: text("user_agent"),
  status: varchar("status").notNull().default("pending"), // pending, used, expired, cancelled
  expiresAt: timestamp("expires_at").notNull(),
  usedAt: timestamp("used_at"),
  cancelledAt: timestamp("cancelled_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

/**
 * 12. SESSION AUDITS TABLE
 * Purpose: Detailed session activity tracking
 * Benefits: User activity monitoring, session forensics
 */
export const sessionAudits = pgTable("session_audits", {
  id: uuid("id").primaryKey().defaultRandom(),
  sessionId: uuid("session_id"),
  userId: varchar("user_id").references(() => users.id).notNull(),
  action: varchar("action").notNull(), // session_created, session_renewed, session_terminated
  ipAddress: varchar("ip_address").notNull(),
  userAgent: text("user_agent"),
  location: jsonb("location"),
  deviceId: uuid("device_id").references(() => userDevices.id),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Export types
export type LoginAttempt = typeof loginAttempts.$inferSelect;
export type SecurityEvent = typeof securityEvents.$inferSelect;
export type PasswordHistory = typeof passwordHistory.$inferSelect;
export type TwoFactorAuth = typeof twoFactorAuth.$inferSelect;
export type UserDevice = typeof userDevices.$inferSelect;
export type EmailDeliveryLog = typeof emailDeliveryLog.$inferSelect;
export type SmsDeliveryLog = typeof smsDeliveryLog.$inferSelect;
export type OauthConnection = typeof oauthConnections.$inferSelect;
export type ApiKey = typeof apiKeys.$inferSelect;
export type RefreshToken = typeof refreshTokens.$inferSelect;
export type AccountRecovery = typeof accountRecovery.$inferSelect;
export type SessionAudit = typeof sessionAudits.$inferSelect;

