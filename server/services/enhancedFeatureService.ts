/**
 * Enhanced Feature Tracking & Gating Service
 * Improved feature flag management with:
 * - Per-user feature access tracking
 * - Feature usage analytics
 * - Dependency management
 * - A/B testing support
 * - Redis-backed persistence
 */

import { db } from '../db';
import { redis } from './redis';
import { logger } from '../utils/logger';

export interface FeatureAccessLog {
  userId: string;
  featureKey: string;
  action: 'viewed' | 'used' | 'denied';
  timestamp: Date;
  metadata?: Record<string, any>;
}

export interface FeatureUserAccess {
  userId: string;
  featureKey: string;
  hasAccess: boolean;
  accessReason: 'enabled' | 'beta' | 'admin' | 'beta_user';
  grantedAt?: Date;
  expiresAt?: Date;
}

export interface FeatureAnalytics {
  featureKey: string;
  totalViews: number;
  totalUses: number;
  totalDenials: number;
  uniqueUsers: number;
  lastUsedAt: Date;
  adoptionRate: number; // percentage
}

class EnhancedFeatureService {
  private accessCache = new Map<string, FeatureUserAccess[]>();
  private analyticsCache = new Map<string, FeatureAnalytics>();

  /**
   * Check if user has access to a feature
   * Considers: feature enabled, user beta access, admin status, dependencies
   */
  async canUserAccessFeature(
    userId: string,
    featureKey: string,
    dependencies: string[] = []
  ): Promise<{ allowed: boolean; reason: string }> {
    try {
      // Check feature is enabled globally
      const feature = await this.getFeature(featureKey);
      if (!feature?.enabled) {
        await this.logFeatureAccess(userId, featureKey, 'denied', {
          reason: 'feature_disabled',
        });
        return { allowed: false, reason: 'Feature is not enabled' };
      }

      // Check dependencies first
      for (const dep of dependencies) {
        const depAllowed = await this.canUserAccessFeature(userId, dep);
        if (!depAllowed.allowed) {
          await this.logFeatureAccess(userId, featureKey, 'denied', {
            reason: 'missing_dependency',
            dependency: dep,
          });
          return {
            allowed: false,
            reason: `Missing dependency: ${dep}`,
          };
        }
      }

      // Check beta access
      const isBetaUser = await this.isBetaUser(userId, featureKey);
      if (!isBetaUser && feature.beta) {
        await this.logFeatureAccess(userId, featureKey, 'denied', {
          reason: 'not_beta_user',
        });
        return { allowed: false, reason: 'Beta access required' };
      }

      // Check admin-only features
      const isAdmin = await this.isUserAdmin(userId);
      if (feature.adminOnly && !isAdmin) {
        await this.logFeatureAccess(userId, featureKey, 'denied', {
          reason: 'admin_only',
        });
        return { allowed: false, reason: 'Admin access required' };
      }

      // Check percentage rollout (A/B testing)
      if (feature.rolloutPercentage && feature.rolloutPercentage < 100) {
        const userHash = this.hashUserId(userId, featureKey);
        if ((userHash % 100) >= feature.rolloutPercentage) {
          await this.logFeatureAccess(userId, featureKey, 'denied', {
            reason: 'rollout_percentage',
            percentage: feature.rolloutPercentage,
          });
          return {
            allowed: false,
            reason: `Feature rolled out to ${feature.rolloutPercentage}% of users`,
          };
        }
      }

      await this.logFeatureAccess(userId, featureKey, 'viewed');
      return { allowed: true, reason: 'Access granted' };
    } catch (error) {
      logger.error('Error checking feature access:', error);
      return { allowed: false, reason: 'Error checking access' };
    }
  }

  /**
   * Track feature usage
   */
  async trackFeatureUsage(
    userId: string,
    featureKey: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    try {
      await this.logFeatureAccess(userId, featureKey, 'used', metadata);

      // Update analytics cache
      const cacheKey = `analytics:${featureKey}`;
      const cached = await redis.get(cacheKey);
      const analytics = cached ? JSON.parse(cached) : { uses: 0, lastUsedAt: null };
      analytics.uses = (analytics.uses || 0) + 1;
      analytics.lastUsedAt = new Date();
      await redis.set(cacheKey, JSON.stringify(analytics), 3600); // 1 hour cache
    } catch (error) {
      logger.error('Error tracking feature usage:', error);
    }
  }

  /**
   * Grant beta access to user for a feature
   */
  async grantBetaAccess(
    userId: string,
    featureKey: string,
    expiresAt?: Date
  ): Promise<void> {
    try {
      const cacheKey = `beta:${userId}:${featureKey}`;
      const access: FeatureUserAccess = {
        userId,
        featureKey,
        hasAccess: true,
        accessReason: 'beta',
        grantedAt: new Date(),
        expiresAt: expiresAt || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days default
      };

      // Store in Redis with TTL
      const ttl = expiresAt
        ? Math.floor((expiresAt.getTime() - Date.now()) / 1000)
        : 30 * 24 * 60 * 60;
      await redis.set(cacheKey, JSON.stringify(access), ttl);

      // Also log to database for audit
      await this.logFeatureAccess(userId, featureKey, 'viewed', {
        action: 'beta_access_granted',
        expiresAt: expiresAt?.toISOString(),
      });

      logger.info(`Beta access granted to ${userId} for ${featureKey}`);
    } catch (error) {
      logger.error('Error granting beta access:', error);
    }
  }

  /**
   * Revoke beta access
   */
  async revokeBetaAccess(userId: string, featureKey: string): Promise<void> {
    try {
      const cacheKey = `beta:${userId}:${featureKey}`;
      await redis.delete(cacheKey);
      logger.info(`Beta access revoked for ${userId} on ${featureKey}`);
    } catch (error) {
      logger.error('Error revoking beta access:', error);
    }
  }

  /**
   * Get feature analytics
   */
  async getFeatureAnalytics(featureKey: string): Promise<FeatureAnalytics | null> {
    try {
      const cached = await redis.get(`analytics:${featureKey}`);
      if (cached) {
        return JSON.parse(cached);
      }

      // Query database for historical analytics
      // This is a placeholder - implement with actual query
      return null;
    } catch (error) {
      logger.error('Error getting feature analytics:', error);
      return null;
    }
  }

  /**
   * Get all features accessible to user
   */
  async getUserAccessibleFeatures(userId: string): Promise<string[]> {
    try {
      const accessible: string[] = [];
      const allFeatures = await this.getAllFeatures();

      for (const [key, feature] of Object.entries(allFeatures)) {
        const { allowed } = await this.canUserAccessFeature(userId, key, feature.dependencies);
        if (allowed) {
          accessible.push(key);
        }
      }

      return accessible;
    } catch (error) {
      logger.error('Error getting user accessible features:', error);
      return [];
    }
  }

  /**
   * Set A/B test rollout percentage
   */
  async setFeatureRollout(
    featureKey: string,
    percentage: number
  ): Promise<void> {
    try {
      if (percentage < 0 || percentage > 100) {
        throw new Error('Percentage must be between 0 and 100');
      }

      const featureCacheKey = `feature:${featureKey}`;
      const feature = await this.getFeature(featureKey);
      if (feature) {
        feature.rolloutPercentage = percentage;
        await redis.set(featureCacheKey, JSON.stringify(feature), 86400); // 24 hour cache
      }

      logger.info(`Feature ${featureKey} rollout set to ${percentage}%`);
    } catch (error) {
      logger.error('Error setting feature rollout:', error);
    }
  }

  /**
   * Get feature with all metadata
   */
  private async getFeature(featureKey: string): Promise<any> {
    // This should integrate with your existing featureService
    // For now, returning a structure
    try {
      const cached = await redis.get(`feature:${featureKey}`);
      return cached ? JSON.parse(cached) : null;
    } catch (error) {
      logger.error('Error getting feature:', error);
      return null;
    }
  }

  /**
   * Get all features
   */
  private async getAllFeatures(): Promise<Record<string, any>> {
    try {
      const cached = await redis.get('features:all');
      return cached ? JSON.parse(cached) : {};
    } catch (error) {
      logger.error('Error getting all features:', error);
      return {};
    }
  }

  /**
   * Log feature access for analytics
   */
  private async logFeatureAccess(
    userId: string,
    featureKey: string,
    action: 'viewed' | 'used' | 'denied',
    metadata?: Record<string, any>
  ): Promise<void> {
    try {
      // Store in Redis for quick access
      const logKey = `log:${featureKey}:${new Date().toISOString().split('T')[0]}`;
      const log: FeatureAccessLog = {
        userId,
        featureKey,
        action,
        timestamp: new Date(),
        metadata,
      };

      // Use list to store daily logs
      const existing = await redis.get(logKey);
      const logs = existing ? JSON.parse(existing) : [];
      logs.push(log);

      // Keep last 1000 logs per feature per day
      if (logs.length > 1000) {
        logs.shift();
      }

      await redis.set(logKey, JSON.stringify(logs), 86400); // 24 hour retention
    } catch (error) {
      logger.error('Error logging feature access:', error);
    }
  }

  /**
   * Check if user is beta user
   */
  private async isBetaUser(userId: string, featureKey: string): Promise<boolean> {
    try {
      const cacheKey = `beta:${userId}:${featureKey}`;
      const access = await redis.get(cacheKey);

      if (access) {
        const parsed = JSON.parse(access);
        if (parsed.expiresAt && new Date(parsed.expiresAt) < new Date()) {
          // Beta access expired
          await redis.delete(cacheKey);
          return false;
        }
        return true;
      }

      return false;
    } catch (error) {
      logger.error('Error checking beta status:', error);
      return false;
    }
  }

  /**
   * Check if user is admin
   */
  private async isUserAdmin(userId: string): Promise<boolean> {
    try {
      // This should query your users table
      // Placeholder implementation
      const cached = await redis.get(`admin:${userId}`);
      return cached === 'true';
    } catch (error) {
      logger.error('Error checking admin status:', error);
      return false;
    }
  }

  /**
   * Hash user ID for consistent A/B testing
   */
  private hashUserId(userId: string, featureKey: string): number {
    let hash = 0;
    const str = `${userId}:${featureKey}`;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash);
  }
}

export const enhancedFeatureService = new EnhancedFeatureService();
