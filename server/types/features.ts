/**
 * Feature System Type Definitions
 * Shared types for enhanced feature tracking, analytics, and A/B testing
 */

/**
 * Core feature definition with metadata
 */
export interface FeatureDefinition {
  key: string;
  name: string;
  description: string;
  category: 'core' | 'experimental' | 'beta' | 'deprecated';
  enabled: boolean;
  tier?: 'free' | 'pro' | 'enterprise'; // Tier requirement
  dependencies?: string[]; // Other features required
  rolloutPercentage?: number; // 0-100, for A/B testing
}

/**
 * Per-user feature access state
 */
export interface UserFeatureAccess {
  userId: string;
  featureKey: string;
  hasAccess: boolean;
  reason?: 'enabled' | 'admin' | 'beta' | 'tier' | 'rollout' | 'dependency_missing';
  grantedAt?: Date;
  expiresAt?: Date;
}

/**
 * Beta access grant for a user
 */
export interface BetaAccessGrant {
  userId: string;
  featureKey: string;
  grantedAt: Date;
  expiresAt?: Date; // Undefined means indefinite
  grantedBy?: string; // Admin who granted access
  reason?: string; // Why beta access was granted
}

/**
 * Feature usage event logged for analytics
 */
export interface FeatureUsageEvent {
  userId: string;
  featureKey: string;
  timestamp: Date;
  metadata?: Record<string, any>;
  sessionId?: string;
  duration?: number; // milliseconds
}

/**
 * Aggregated feature analytics
 */
export interface FeatureAnalytics {
  featureKey: string;
  totalUsageEvents: number;
  uniqueUsers: Set<string>;
  usageByDay: Map<string, number>;
  usageByUser: Map<string, number>;
  averageUsagePerUser: number;
  lastAccessed?: Date;
  firstAccessed?: Date;
  peakUsageTime?: {
    hour: number;
    day: string;
    count: number;
  };
}

/**
 * A/B test configuration for a feature
 */
export interface ABTestConfig {
  featureKey: string;
  rolloutPercentage: number; // 0-100
  startedAt: Date;
  endedAt?: Date;
  controlGroup: string[]; // User IDs in control (no feature)
  treatmentGroup: string[]; // User IDs receiving feature
  variant?: string; // Label for this variant
}

/**
 * Feature access check result
 */
export interface FeatureAccessCheckResult {
  allowed: boolean;
  reason?: string;
  details?: {
    isAdmin?: boolean;
    isEnabled?: boolean;
    isBetaUser?: boolean;
    hasTier?: boolean;
    dependenciesMet?: boolean;
    rolloutEligible?: boolean;
    expiresAt?: Date;
  };
}

/**
 * Feature rollout configuration
 */
export interface RolloutConfig {
  featureKey: string;
  percentage: number; // 0-100
  updatedAt: Date;
  updatedBy?: string; // Admin who made change
}

/**
 * Feature usage summary for dashboard
 */
export interface FeatureUsageSummary {
  featureKey: string;
  name: string;
  description: string;
  enabled: boolean;
  totalUsers: number;
  activeUsers: number; // Last 7 days
  totalUsage: number;
  usageGrowth: number; // % change from previous period
  adoptionRate: number; // % of eligible users
  rolloutPercentage: number;
  lastUpdated: Date;
}

/**
 * Feature access request for audit logging
 */
export interface FeatureAccessAuditLog {
  userId: string;
  featureKey: string;
  timestamp: Date;
  allowed: boolean;
  reason?: string;
  ip?: string;
  userAgent?: string;
}

/**
 * Configuration for enhanced feature service
 */
export interface EnhancedFeatureServiceConfig {
  redisEnabled: boolean;
  analyticsEnabled: boolean;
  auditLoggingEnabled: boolean;
  cacheTTL: number; // seconds
  maxAnalyticsRetention: number; // days
}

/**
 * Response from feature check endpoint
 */
export interface FeatureCheckResponse {
  success: boolean;
  featureKey: string;
  allowed: boolean;
  reason?: string;
  details?: FeatureAccessCheckResult['details'];
}

/**
 * Response from analytics endpoint
 */
export interface FeatureAnalyticsResponse {
  success: boolean;
  featureKey: string;
  analytics?: {
    totalUsage: number;
    uniqueUsers: number;
    averageUsagePerUser: number;
    usageByDay?: Record<string, number>;
    lastAccessed?: string;
  };
}

/**
 * Request body for granting beta access
 */
export interface GrantBetaAccessRequest {
  userId: string;
  featureKey: string;
  expiresAt?: Date;
  reason?: string;
}

/**
 * Request body for setting feature rollout
 */
export interface SetFeatureRolloutRequest {
  featureKey: string;
  percentage: number; // 0-100
}

/**
 * Feature tier requirements
 */
export enum FeatureTier {
  FREE = 'free',
  PRO = 'pro',
  ENTERPRISE = 'enterprise',
}

/**
 * Feature categories for organization
 */
export enum FeatureCategory {
  CORE = 'core',
  EXPERIMENTAL = 'experimental',
  BETA = 'beta',
  DEPRECATED = 'deprecated',
}

/**
 * Access denial reasons for detailed feedback
 */
export enum AccessDenialReason {
  FEATURE_DISABLED = 'feature_disabled',
  INSUFFICIENT_TIER = 'insufficient_tier',
  ADMIN_ONLY = 'admin_only',
  MISSING_DEPENDENCY = 'missing_dependency',
  NOT_IN_ROLLOUT = 'not_in_rollout',
  BETA_ACCESS_EXPIRED = 'beta_access_expired',
  UNKNOWN = 'unknown',
}
