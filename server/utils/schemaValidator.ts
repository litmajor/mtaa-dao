/**
 * Database Schema Validator
 * Ensures schema consistency on startup - fail fast if mismatch
 */

import { db } from '../storage';
import { logger } from './logger';
import { sql } from 'drizzle-orm';

export interface TableSchema {
  name: string;
  columns: {
    name: string;
    type: string;
    not_null?: boolean;
  }[];
}

function normalizeDbResult<T>(result: unknown): T[] {
  if (!result) return [];
  if (Array.isArray(result)) return result;
  if (typeof result === 'object' && result !== null) {
    if ('rows' in result) {
      return ((result as any).rows ?? []) as T[];
    }
    if ('rows' in (result as any)?.result) {
      return (((result as any).result as any).rows ?? []) as T[];
    }
  }
  return [];
}

function parseExistsResult(result: unknown): boolean {
  const rows = normalizeDbResult<Record<string, unknown>>(result);
  if (!rows.length) return false;
  const firstRow = rows[0] || {};
  const keys = Object.keys(firstRow);
  if (!keys.length) return false;
  const key = keys.find(k => k.toLowerCase() === 'exists');
  const value = key ? firstRow[key] : undefined;
  return value === true || value === 't' || value === 'true' || value === 1 || value === '1';
}

/**
 * Validate that required tables exist with correct structure
 */
export async function validateDatabaseSchema(): Promise<boolean> {
  try {
    logger.info('[SCHEMA] Starting database schema validation...');

    const requiredTables = [
      'platform_metrics',
      'defi_protocol_metrics',
      'cefi_exchange_metrics',
      'blockchain_health_metrics',
      'liquidity_pool_metrics',
      'revenue_metrics',
      'payment_provider_metrics',
      'agent_performance_metrics',
      'api_usage_metrics',
      'platform_growth_metrics',
      'referral_metrics',
      'leaderboard_rankings',
      'reward_distribution',
      'dao_analytics',
      'support_ticket_metrics',
      'circuit_breaker_states',
      'provider_fallbacks',
      'blockchain_transactions',
    ];

    const existingTables: string[] = [];
    const missingTables: string[] = [];

    // Check each required table
    for (const tableName of requiredTables) {
      try {
        const result = await db.execute(sql.raw(
          `SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = '${tableName}') AS exists`
        ));

        if (parseExistsResult(result)) {
          existingTables.push(tableName);
          logger.info(`[SCHEMA] ✅ Table exists: ${tableName}`);
        } else {
          missingTables.push(tableName);
          logger.warn(`[SCHEMA] ❌ Table missing: ${tableName}`);
        }
      } catch (error) {
        logger.error(`[SCHEMA] Error checking table ${tableName}:`, (error as Error).message);
        missingTables.push(tableName);
      }
    }

    // Report findings
    logger.info(`[SCHEMA] Validation complete: ${existingTables.length}/${requiredTables.length} tables exist`);

    if (missingTables.length > 0) {
      logger.error('[SCHEMA] ❌ CRITICAL: Missing required tables:', missingTables);
      logger.error('[SCHEMA] Run migrations with: npm run migrate');
      return false;
    }

    logger.info('[SCHEMA] ✅ All required tables exist');
    return true;
  } catch (error) {
    logger.error('[SCHEMA] Validation failed:', error);
    return false;
  }
}

/**
 * Validate platform_metrics table has all required columns
 */
export async function validatePlatformMetricsSchema(): Promise<boolean> {
  const requiredColumns = [
    'id',
    'timestamp',
    'total_daos',
    'active_daos',
    'total_members',
    'total_vaults',
    'active_vaults',
    'total_tvl',
    'total_transactions',
    'total_fees',
    'total_revenue', 
    'cpu_usage',
    'memory_usage',
    'disk_usage',
    'network_latency',
    'created_at',
    'updated_at',
  ];

  try {
    const result = await db.execute(sql.raw(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'platform_metrics'
      ORDER BY ordinal_position
    `));

    const rows = normalizeDbResult<{ column_name: string }>(result);
    if (rows.length === 0) {
      logger.error('[SCHEMA] platform_metrics table not found');
      return false;
    }

    const existingColumns = rows.map(row => row.column_name);
    const missingColumns = requiredColumns.filter(col => !existingColumns.includes(col));

    if (missingColumns.length > 0) {
      logger.error('[SCHEMA] platform_metrics missing columns:', missingColumns);
      return false;
    }

    logger.info('[SCHEMA] ✅ platform_metrics schema valid');
    return true;
  } catch (error) {
    logger.error('[SCHEMA] Failed to validate platform_metrics:', error);
    return false;
  }
}

/**
 * Strict insert contract - validate before insert
 */
export function validateInsertMetrics(data: any): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Required fields that must not be undefined/null
  const requiredFields = [
    'totalDAOs',
    'activeDAOs',
    'totalMembers',
    'totalVaults',
    'activeVaults',
    'totalTVL',
    'totalTransactions',
    'totalFees',
    'totalRevenue',
    'cpuUsage',
    'memoryUsage',
    'diskUsage',
    'networkLatency',
  ];

  for (const field of requiredFields) {
    if (!(field in data)) {
      errors.push(`Missing required field: ${field}`);
    }
    if (data[field] === undefined || data[field] === null) {
      errors.push(`${field} cannot be null or undefined`);
    }
  }

  // Type validation - numeric fields
  const numericFields = ['totalDAOs', 'activeDAOs', 'totalMembers', 'totalVaults', 'activeVaults', 'totalTransactions', 'cpuUsage', 'memoryUsage', 'diskUsage', 'networkLatency'];
  for (const field of numericFields) {
    if (data[field] !== undefined && typeof data[field] !== 'number') {
      errors.push(`${field} must be numeric, got ${typeof data[field]}`);
    }
  }

  // Type validation - string numeric fields (decimals as strings in Postgres)
  const stringNumericFields = ['totalTVL', 'totalFees', 'totalRevenue'];
  for (const field of stringNumericFields) {
    if (data[field] !== undefined && typeof data[field] !== 'string') {
      errors.push(`${field} must be string (decimal), got ${typeof data[field]}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

export const schemaValidator = {
  validateDatabaseSchema,
  validatePlatformMetricsSchema,
  validateInsertMetrics,
};