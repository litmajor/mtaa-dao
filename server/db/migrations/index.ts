/**
 * Migration Runner
 * Execute all database migrations to set up the database
 */

import { migrateCEXTables, rollbackCEXTables } from './004-cex-tables';
import { migrateNotificationTables } from './001-notification-system';
import { migrateRulesEngine } from './002-rules-engine';
import { migrateLimitOrders } from './003-limit-orders';
import { migrateCrossChainTables, rollbackCrossChainTables } from './007-cross-chain-support';

export interface MigrationResult {
  success: boolean;
  timestamp: Date;
  duration: number; // milliseconds
  errors?: string[];
}

/**
 * Run all migrations in order
 */
export async function runAllMigrations(): Promise<MigrationResult> {
  const startTime = Date.now();
  const errors: string[] = [];

  try {
    console.log('🚀 Starting migration sequence...\n');

    // Run in order to respect dependencies
    try {
      await migrateNotificationTables();
    } catch (err: any) {
      errors.push(`Notification migration failed: ${err.message}`);
    }

    try {
      await migrateRulesEngine();
    } catch (err: any) {
      errors.push(`Rules engine migration failed: ${err.message}`);
    }

    try {
      await migrateLimitOrders();
    } catch (err: any) {
      errors.push(`Limit orders migration failed: ${err.message}`);
    }

    try {
      await migrateCEXTables();
    } catch (err: any) {
      errors.push(`CEX tables migration failed: ${err.message}`);
      throw err; // This is critical, stop here
    }

    try {
      await migrateCrossChainTables();
    } catch (err: any) {
      errors.push(`Cross-chain migration failed: ${err.message}`);
      // Non-critical, continue with other migrations
    }
    console.log(`\n✅ All migrations completed in ${duration}ms`);

    return {
      success: errors.length === 0,
      timestamp: new Date(),
      duration,
      errors: errors.length > 0 ? errors : undefined,
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`\n❌ Migration sequence failed after ${duration}ms`);
    throw error;
  }
}

/**
 * Rollback migrations (safe operations)
 */
export async function rollbackMigrations(): Promise<MigrationResult> {
  const startTime = Date.now();
  const errors: string[] = [];

  try {
    console.log('🔄 Rolling back migrations...\n');
    
    try {
      await rollbackCrossChainTables();
    } catch (err: any) {
      errors.push(`Cross-chain rollback failed: ${err.message}`);
    }

    await rollbackCEXTables();

    const duration = Date.now() - startTime;
    console.log(`\n✅ Rollback completed in ${duration}ms`);

    return {
      success: errors.length === 0,
      timestamp: new Date(),
      duration,
      errors: errors.length > 0 ? errors : undefined,
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`\n❌ Rollback failed after ${duration}ms`);
    throw error;
  }
}

/**
 * Rollback CEX migrations only (safe operation)
 * @deprecated Use rollbackMigrations() instead
 */
export async function rollbackCEXMigrations(): Promise<MigrationResult> {
  const startTime = Date.now();

  try {
    console.log('🔄 Rolling back CEX migrations...\n');
    await rollbackCEXTables();

    const duration = Date.now() - startTime;
    console.log(`\n✅ Rollback completed in ${duration}ms`);

    return {
      success: true,
      timestamp: new Date(),
      duration,
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`\n❌ Rollback failed after ${duration}ms`);
    throw error;
  }
}

/**
 * Dry run - check migration without executing
 */
export async function dryRunMigrations(): Promise<{
  willCreate: string[];
  willModify: string[];
  risks: string[];
}> {
  return {
    willCreate: [
      // CEX tables
      'cex_prices',
      'cex_orders',
      'cex_credentials',
      'arbitrage_opportunities',
      'exchange_settings',
      // Cross-chain tables
      'cross_chain_chains',
      'cross_chain_tokens',
      'cross_chain_bridges',
      'cross_chain_dexes',
      'cross_chain_trading_pairs',
      'cross_chain_transfers',
      'cross_chain_swaps',
    ],
    willModify: [],
    risks: [
      'Note: api_key_encrypted and api_secret_encrypted will store sensitive data - ensure encryption utility is configured',
      'Note: Ensure database user has sufficient permissions to create tables',
      'Note: Consider running migrations during maintenance window for production',
      'Note: Cross-chain transfers require bridge contracts to be deployed and configured',
    ],
  };
}

// Usage examples:
// npx ts-node -O '{"module":"commonjs"}' scripts/migrate.ts
// Or call directly in your application startup:
// if (process.env.RUN_MIGRATIONS === 'true') {
//   await runAllMigrations();
// }
