/**
 * Migration Runner
 * Execute all database migrations to set up the database
 */

import { migrateCEXTables, rollbackCEXTables } from './004-cex-tables';
import { migrateFuturesInfrastructure, rollbackFuturesInfrastructure } from './005-futures-infrastructure';
import { migrateNotificationTables } from './001-notification-system';
import { migrateRulesEngine } from './002-rules-engine';
import { migrateLimitOrdersTables } from './003-limit-orders';
import { migrateCrossChainTables, rollbackCrossChainTables } from './007-cross-chain-support';
import { migrateAgentSubscriptions, rollbackAgentSubscriptions } from './018-agent-subscriptions-indexer';
import { migrateRecoveryWorkflows, rollbackRecoveryWorkflows } from './019-recovery-workflows';
import { migrateStrategyTables, rollbackStrategyTables } from './022-strategy-schema';
import { migrateIdempotencyKeysTable, rollbackIdempotencyKeysTable } from './020-idempotency-keys';
import { migratePaymentSystemTables, rollbackPaymentSystemTables } from './021-payment-system-tables';
import { migrateBlockchainTransactions, rollbackBlockchainTransactions } from './021-blockchain-transactions';
import { migrateYukiWatchlists, rollbackYukiWatchlists } from './023-yuki-watchlists';
import { migrateRewardRequestsTable, rollbackRewardRequestsTable } from './024-reward-requests';
import { migrateDomainEventsTable, rollbackDomainEventsTable } from './025-domain-events';
import { migrateProcessedEventsTable, rollbackProcessedEventsTable } from './026-processed-events';
import { migrateEventDeadLettersTable, rollbackEventDeadLettersTable } from './027-event-dead-letters';
import { migrateCommandLogTable, rollbackCommandLogTable } from './028-command-log';
import { migratePaymentDomainTables, rollbackPaymentDomainTables } from './029-payment-domain';
import { migrateVaultDomainTables, rollbackVaultDomainTables } from './030-vault-domain';
import { migrateTreasuryDomainTables, rollbackTreasuryDomainTables } from './031-treasury-domain';
import { migrateInvestmentPoolsTables, rollbackInvestmentPoolsTables } from './032-investment-pools';
import { migrateMonitoringMetricsTables, rollbackMonitoringMetricsTables } from './033-monitoring-metrics';
import { migrateTokenomicsTables, rollbackTokenomicsTables } from './034-tokenomics';

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
      await migrateLimitOrdersTables();
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
      await migrateFuturesInfrastructure();
    } catch (err: any) {
      errors.push(`Futures infrastructure migration failed: ${err.message}`);
      throw err; // Critical: depends on cex_credentials, stop here
    }

    try {
      await migrateCrossChainTables();
    } catch (err: any) {
      errors.push(`Cross-chain migration failed: ${err.message}`);
      // Non-critical, continue with other migrations
    }

    try {
      await migrateAgentSubscriptions();
    } catch (err: any) {
      errors.push(`Agent subscriptions migration failed: ${err.message}`);
    }

    try {
      await migrateStrategyTables();
    } catch (err: any) {
      errors.push(`Strategy schema migration failed: ${err.message}`);
    }


    try {
      await migrateRecoveryWorkflows();
    } catch (err: any) {
      errors.push(`Recovery workflows migration failed: ${err.message}`);
    }

    try {
      await migrateDomainEventsTable();
    } catch (err: any) {
      errors.push(`Domain events migration failed: ${err.message}`);
    }

    try {
      await migrateProcessedEventsTable();
    } catch (err: any) {
      errors.push(`Processed events migration failed: ${err.message}`);
    }

    try {
      await migrateEventDeadLettersTable();
    } catch (err: any) {
      errors.push(`Event dead letters migration failed: ${err.message}`);
    }

    try {
      await migrateCommandLogTable();
    } catch (err: any) {
      errors.push(`Command log migration failed: ${err.message}`);
    }

    try {
      await migrateIdempotencyKeysTable();
    } catch (err: any) {
      errors.push(`Idempotency keys table migration failed: ${err.message}`);
    }

    try {
      await migratePaymentDomainTables();
    } catch (err: any) {
      errors.push(`Payment domain migration failed: ${err.message}`);
      throw err; // Critical migration: do not continue with incomplete payment schema
    }

    try {
      await migratePaymentSystemTables();
    } catch (err: any) {
      errors.push(`Payment system tables migration failed: ${err.message}`);
      throw err; // Critical migration: do not continue with incomplete payment recovery/circuit breaker schema
    }

    try {
      await migrateBlockchainTransactions();
    } catch (err: any) {
      errors.push(`Blockchain transactions migration failed: ${err.message}`);
      throw err; // Critical migration: do not continue with incomplete blockchain transaction tracking schema
    }

    try {
      await migrateVaultDomainTables();
    } catch (err: any) {
      errors.push(`Vault domain migration failed: ${err.message}`);
      throw err;
    }

    try {
      await migrateTreasuryDomainTables();
    } catch (err: any) {
      errors.push(`Treasury domain migration failed: ${err.message}`);
      throw err;
    }

    try {
      await migrateInvestmentPoolsTables();
    } catch (err: any) {
      errors.push(`Investment pools migration failed: ${err.message}`);
      throw err;
    }

    try {
      await migrateYukiWatchlists();
    } catch (err: any) {
      errors.push(`Yuki watchlists migration failed: ${err.message}`);
      throw err;
    }

    try {
      await migrateRewardRequestsTable();
    } catch (err: any) {
      errors.push(`Reward requests migration failed: ${err.message}`);
      throw err;
    }

    try {
      await migrateMonitoringMetricsTables();
    } catch (err: any) {
      errors.push(`Monitoring metrics migration failed: ${err.message}`);
      throw err;
    }

    try {
      await migrateTokenomicsTables();
    } catch (err: any) {
      errors.push(`Tokenomics tables migration failed: ${err.message}`);
      throw err;
    }

    const duration = Date.now() - startTime;
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
      await rollbackBlockchainTransactions();
    } catch (err: any) {
      errors.push(`Blockchain transactions rollback failed: ${err.message}`);
    }

    try {
      await rollbackCommandLogTable();
    } catch (err: any) {
      errors.push(`Command log rollback failed: ${err.message}`);
    }

    try {
      await rollbackEventDeadLettersTable();
    } catch (err: any) {
      errors.push(`Event dead letters rollback failed: ${err.message}`);
    }

    try {
      await rollbackProcessedEventsTable();
    } catch (err: any) {
      errors.push(`Processed events rollback failed: ${err.message}`);
    }

    try {
      await rollbackDomainEventsTable();
    } catch (err: any) {
      errors.push(`Domain events rollback failed: ${err.message}`);
    }

    try {
      await rollbackRewardRequestsTable();
    } catch (err: any) {
      errors.push(`Reward requests rollback failed: ${err.message}`);
    }

    try {
      await rollbackYukiWatchlists();
    } catch (err: any) {
      errors.push(`Yuki watchlists rollback failed: ${err.message}`);
    }

    try {
      await rollbackMonitoringMetricsTables();
    } catch (err: any) {
      errors.push(`Monitoring metrics rollback failed: ${err.message}`);
    }

    try {
      await rollbackTokenomicsTables();
    } catch (err: any) {
      errors.push(`Tokenomics rollback failed: ${err.message}`);
    }

    try {
      await rollbackInvestmentPoolsTables();
    } catch (err: any) {
      errors.push(`Investment pools rollback failed: ${err.message}`);
    }

    try {
      await rollbackTreasuryDomainTables();
    } catch (err: any) {
      errors.push(`Treasury domain rollback failed: ${err.message}`);
    }

    try {
      await rollbackVaultDomainTables();
    } catch (err: any) {
      errors.push(`Vault domain rollback failed: ${err.message}`);
    }

    try {
      await rollbackPaymentDomainTables();
    } catch (err: any) {
      errors.push(`Payment domain rollback failed: ${err.message}`);
    }

    try {      await rollbackPaymentSystemTables();
    } catch (err: any) {
      errors.push(`Payment system tables rollback failed: ${err.message}`);
    }

    try {
      await rollbackIdempotencyKeysTable();
    } catch (err: any) {
      errors.push(`Idempotency keys table rollback failed: ${err.message}`);
    }

    try {
      await rollbackRecoveryWorkflows();
    } catch (err: any) {
      errors.push(`Recovery workflows rollback failed: ${err.message}`);
    }

    try {
      await rollbackAgentSubscriptions();
    } catch (err: any) {
      errors.push(`Agent subscriptions rollback failed: ${err.message}`);
    }

    try {
      await rollbackCrossChainTables();
    } catch (err: any) {
      errors.push(`Cross-chain rollback failed: ${err.message}`);
    }

    try {
      await rollbackCEXTables();
    } catch (err: any) {
      errors.push(`CEX tables rollback failed: ${err.message}`);
    }

    try {
      await rollbackFuturesInfrastructure();
    } catch (err: any) {
      errors.push(`Futures infrastructure rollback failed: ${err.message}`);
    } 

    try {
      await rollbackStrategyTables();
    } catch (err: any) {
      errors.push(`Strategy schema rollback failed: ${err.message}`);
    }

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
    // Futures infrastructure depends on cex_credentials, so roll it back first
    await rollbackFuturesInfrastructure();
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
      // Agent network & indexer tables
      'dao_agent_subscriptions',
      'indexer_checkpoints',
      // Payment recovery tables
      'recovery_workflows',
      'manual_intervention_requests',
      // Idempotency tracking table
      'idempotency_keys',
      // Payment system supporting tables
      'circuit_breaker_states',
      'reversible_actions',
      'action_reversals',
      'action_approvals',
      // Blockchain transaction tracking
      'blockchain_transactions',
    ],
    willModify: [
      'payment_sagas (add: wallet_from, wallet_to, vault_id, metadata)',
      'recovery_workflows (add: requires_user_consent, user_consent_granted)',
      'manual_intervention_requests (add: resolution_type, resolution_notes, resolved_at, resolved_by)',
    ],
    risks: [
      'Note: api_key_encrypted and api_secret_encrypted will store sensitive data - ensure encryption utility is configured',
      'Note: Ensure database user has sufficient permissions to create tables',
      'Note: Consider running migrations during maintenance window for production',
      'Note: Cross-chain transfers require bridge contracts to be deployed and configured',
      'Note: Agent subscriptions require smart contract event listener daemon processes',
      'Note: Circuit breaker states require multi-node consensus if deployed across multiple instances',
      'Note: Reversible actions require careful grace period and approval workflow management',
      'Note: Blockchain transaction tracking requires proper chain_id and status management',
    ],
  };
}

// Usage examples:
// npx ts-node -O '{"module":"commonjs"}' scripts/migrate.ts
// Or call directly in your application startup:
// if (process.env.RUN_MIGRATIONS === 'true') {
//   await runAllMigrations();
// }
