/**
 * server/jobs/retention.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Nightly data lifecycle job.
 *
 * What it does:
 * 1. Roll up metrics tables into metrics_daily_rollup before deleting them
 * 2. Delete rows older than their retention window from append-only tables
 * 3. Drop old monthly partitions (O(1), no table scan)
 * 4. Create next month's partitions so inserts never hit the default partition
 * 5. VACUUM ANALYZE the tables that just had large deletes
 *
 * Schedule: 02:00 EAT (23:00 UTC) nightly — low-traffic window for Nairobi
 *
 * Add to server/index.ts startup (AFTER migrations, BEFORE other jobs):
 * import { initRetentionJob } from './jobs/retention';
 * await initRetentionJob();
 */

import cron    from 'node-cron';
import { db }  from '../db';
import { sql, lt, and, eq } from 'drizzle-orm';
import {
  auditLogs,
  systemLogs,
  activityFeed,
  walletAccessLog,
  notificationHistory,
  notifications,
  assetPriceHistory,
  executionMetrics,
  mlTrainingData,
  platformMetrics,
  sessionNotifications,
  executionHistory,
  daoAnalytics,
  revenueMetrics,
} from '../../shared/schema';
import { Logger } from '../utils/logger';

const logger = Logger.getLogger();

// ── Retention Windows ────────────────────────────────────────────────────────

const RETENTION = {
  // Compliance / financial — keep longer
  auditLogs:            365,  // 1 year (regulatory)
  revenueMetrics:       730,  // 2 years (financial records)
  executionHistory:     180,  // 6 months

  // Operational logs — short-lived
  systemLogs:           14,   // 2 weeks
  sessionNotifications: 30,

  // User-facing — keep until stale
  notifications:        60,   // 2 months (unread kept longer — see below)
  notificationHistory:  30,
  activityFeed:         90,

  // Security logs
  walletAccessLog:      90,

  // Market data — raw candles replaced by aggregates
  assetPriceHistory:    180,

  // ML / analytics
  executionMetrics:     90,
  mlTrainingData:       180,
  platformMetrics:      90,
  daoAnalytics:         90,
} as const;

// ── Helpers ──────────────────────────────────────────────────────────────────

function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

async function vacuumTable(tableName: string): Promise<void> {
  try {
    // VACUUM cannot run inside a transaction — use raw sql with execute
    await db.execute(sql.raw(`VACUUM ANALYZE ${tableName}`));
    logger.info(`[Retention] VACUUM ANALYZE ${tableName} done`);
  } catch (err) {
    // Non-fatal: Neon serverless sometimes disallows explicit VACUUM
    logger.warn(`[Retention] VACUUM skipped for ${tableName}:`,
      err instanceof Error ? err.message : err);
  }
}

async function deleteWithCount(
  tableName: string,
  deleteQuery: Promise<any>,
): Promise<void> {
  const before = Date.now();
  try {
    await deleteQuery;
    logger.info(`[Retention] ${tableName}: deleted in ${Date.now() - before}ms`);
  } catch (err) {
    logger.error(`[Retention] ${tableName} delete failed:`,
      err instanceof Error ? err.message : err);
  }
}

// ── Step 1: Roll up metrics before deletion ──────────────────────────────────
// We aggregate daily values into metrics_daily_rollup so we don't lose trends
// when we delete old rows from the raw tables.

async function rollupPlatformMetrics(): Promise<void> {
  try {
    await db.execute(sql`
      INSERT INTO metrics_daily_rollup (metric_name, entity_id, date, value, dimensions)
      SELECT
        'total_daos'      AS metric_name,
        NULL              AS entity_id,
        DATE(timestamp)   AS date,
        MAX(total_daos)   AS value,
        '{}'::jsonb       AS dimensions
      FROM platform_metrics
      WHERE timestamp < ${daysAgo(RETENTION.platformMetrics)}
      GROUP BY DATE(timestamp)
      ON CONFLICT (metric_name, entity_id, date) DO NOTHING
    `);

    await db.execute(sql`
      INSERT INTO metrics_daily_rollup (metric_name, entity_id, date, value, dimensions)
      SELECT
        'total_members'   AS metric_name,
        NULL              AS entity_id,
        DATE(timestamp)   AS date,
        MAX(total_members) AS value,
        '{}'::jsonb       AS dimensions
      FROM platform_metrics
      WHERE timestamp < ${daysAgo(RETENTION.platformMetrics)}
      GROUP BY DATE(timestamp)
      ON CONFLICT (metric_name, entity_id, date) DO NOTHING
    `);

    await db.execute(sql`
      INSERT INTO metrics_daily_rollup (metric_name, entity_id, date, value, dimensions)
      SELECT
        'total_tvl'       AS metric_name,
        NULL              AS entity_id,
        DATE(timestamp)   AS date,
        MAX(total_tvl)    AS value,
        '{}'::jsonb       AS dimensions
      FROM platform_metrics
      WHERE timestamp < ${daysAgo(RETENTION.platformMetrics)}
      GROUP BY DATE(timestamp)
      ON CONFLICT (metric_name, entity_id, date) DO NOTHING
    `);

    logger.info('[Retention] platform_metrics rolled up');
  } catch (err) {
    logger.error('[Retention] platform_metrics rollup failed:',
      err instanceof Error ? err.message : err);
  }
}

async function rollupDaoAnalytics(): Promise<void> {
  try {
    await db.execute(sql`
      INSERT INTO metrics_daily_rollup
        (metric_name, entity_id, date, value, dimensions)
      SELECT
        'dao_treasury_balance'   AS metric_name,
        dao_id                   AS entity_id,
        DATE(created_at)         AS date,
        MAX(treasury_balance)    AS value,
        jsonb_build_object('dao_type', MAX(dao_type)) AS dimensions
      FROM dao_analytics
      WHERE created_at < ${daysAgo(RETENTION.daoAnalytics)}
      GROUP BY dao_id, DATE(created_at)
      ON CONFLICT (metric_name, entity_id, date) DO NOTHING
    `);

    logger.info('[Retention] dao_analytics rolled up');
  } catch (err) {
    logger.error('[Retention] dao_analytics rollup failed:',
      err instanceof Error ? err.message : err);
  }
}

async function rollupAssetPrices(): Promise<void> {
  try {
    await db.execute(sql`
      INSERT INTO metrics_daily_rollup
        (metric_name, entity_id, date, value, dimensions)
      SELECT
        'asset_price_close'   AS metric_name,
        NULL                  AS entity_id,
        DATE(recorded_at)     AS date,
        (ARRAY_AGG(price_usd ORDER BY recorded_at DESC))[1] AS value,
        jsonb_build_object('symbol', asset_symbol) AS dimensions
      FROM asset_price_history
      WHERE recorded_at < ${daysAgo(RETENTION.assetPriceHistory)}
      GROUP BY asset_symbol, DATE(recorded_at)
      ON CONFLICT (metric_name, entity_id, date) DO NOTHING
    `);

    logger.info('[Retention] asset_price_history rolled up');
  } catch (err) {
    logger.error('[Retention] asset_price_history rollup failed:',
      err instanceof Error ? err.message : err);
  }
}

async function rollupRevenueMetrics(): Promise<void> {
  try {
    // Collect summaries of your processing revenue indicators (assuming columns: total_revenue, platform_cut, etc.)
    await db.execute(sql`
      INSERT INTO metrics_daily_rollup
        (metric_name, entity_id, date, value, dimensions)
      SELECT
        'daily_total_revenue' AS metric_name,
        NULL                  AS entity_id,
        DATE(timestamp)       AS date,
        SUM(total_revenue)    AS value,
        '{}'::jsonb           AS dimensions
      FROM revenue_metrics
      WHERE timestamp < ${daysAgo(RETENTION.revenueMetrics)}
      GROUP BY DATE(timestamp)
      ON CONFLICT (metric_name, entity_id, date) DO NOTHING
    `);

    logger.info('[Retention] revenue_metrics rolled up');
  } catch (err) {
    logger.error('[Retention] revenue_metrics rollup failed:',
      err instanceof Error ? err.message : err);
  }
}

// ── Step 2: Delete old rows ──────────────────────────────────────────────────

async function runDeletions(): Promise<string[]> {
  const vacuumTargets: string[] = [];

  // system_logs — most aggressive, 14 days
  await deleteWithCount('system_logs', db
    .delete(systemLogs)
    .where(lt(systemLogs.timestamp, daysAgo(RETENTION.systemLogs)))
  );
  vacuumTargets.push('system_logs');

  // audit_logs — kept 1 year, compliance-grade
  await deleteWithCount('audit_logs', db
    .delete(auditLogs)
    .where(lt(auditLogs.timestamp, daysAgo(RETENTION.auditLogs)))
  );

  // revenue_metrics — kept 2 years, financial regulatory tracking
  await deleteWithCount('revenue_metrics', db
    .delete(revenueMetrics)
    .where(lt(revenueMetrics.timestamp, daysAgo(RETENTION.revenueMetrics)))
  );
  vacuumTargets.push('revenue_metrics');

  // activity_feed — 90 days
  await deleteWithCount('activity_feed', db
    .delete(activityFeed)
    .where(lt(activityFeed.createdAt, daysAgo(RETENTION.activityFeed)))
  );
  vacuumTargets.push('activity_feed');

  // wallet_access_log — 90 days
  await deleteWithCount('wallet_access_log', db
    .delete(walletAccessLog)
    .where(lt(walletAccessLog.createdAt, daysAgo(RETENTION.walletAccessLog)))
  );

  // notification_history — 30 days
  await deleteWithCount('notification_history', db
    .delete(notificationHistory)
    .where(lt(notificationHistory.createdAt, daysAgo(RETENTION.notificationHistory)))
  );

  // notifications — 60 days, but only READ ones
  // Unread notifications are kept indefinitely until user reads them
  await deleteWithCount('notifications (read)', db
    .delete(notifications)
    .where(and(
      lt(notifications.createdAt, daysAgo(RETENTION.notifications)),
      eq(notifications.read, true)
    ))
  );
  vacuumTargets.push('notifications');

  // session_notifications — 30 days
  await deleteWithCount('session_notifications', db
    .delete(sessionNotifications)
    .where(lt(sessionNotifications.createdAt, daysAgo(RETENTION.sessionNotifications)))
  );

  // asset_price_history — 180 days (after rollup)
  await deleteWithCount('asset_price_history', db
    .delete(assetPriceHistory)
    .where(lt(assetPriceHistory.recordedAt, daysAgo(RETENTION.assetPriceHistory)))
  );

  // execution_metrics — 90 days
  await deleteWithCount('execution_metrics', db
    .delete(executionMetrics)
    .where(lt(executionMetrics.recordedAt, daysAgo(RETENTION.executionMetrics)))
  );

  // execution_history — 180 days
  await deleteWithCount('execution_history', db
    .delete(executionHistory)
    .where(lt(executionHistory.createdAt, daysAgo(RETENTION.executionHistory)))
  );

  // ml_training_data — 180 days
  await deleteWithCount('ml_training_data', db
    .delete(mlTrainingData)
    .where(lt(mlTrainingData.recordedAt, daysAgo(RETENTION.mlTrainingData)))
  );

  // platform_metrics — 90 days (after rollup)
  await deleteWithCount('platform_metrics', db
    .delete(platformMetrics)
    .where(lt(platformMetrics.timestamp, daysAgo(RETENTION.platformMetrics)))
  );
  vacuumTargets.push('platform_metrics');

  // dao_analytics — 90 days (after rollup)
  await deleteWithCount('dao_analytics', db
    .delete(daoAnalytics)
    .where(lt(daoAnalytics.createdAt, daysAgo(RETENTION.daoAnalytics)))
  );

  return vacuumTargets;
}

// ── Step 3: Partition management ─────────────────────────────────────────────

async function managePartitions(): Promise<void> {
  const partitionedTables = [
    { table: 'asset_state_snapshots', keepMonths: 3 },
    { table: 'audit_logs',             keepMonths: 13 }, // 12 + 1 buffer
    { table: 'system_logs',            keepMonths: 1  }, // weekly partitions handled separately
  ];

  for (const { table, keepMonths } of partitionedTables) {
    try {
      // Create next month's partition so inserts never hit the default partition
      await db.execute(sql.raw(
        `SELECT create_next_month_partition('${table}')`
      ));

      // Drop the partition that's now outside our retention window
      await db.execute(sql.raw(
        `SELECT drop_old_partition('${table}', ${keepMonths})`
      ));
    } catch (err) {
      // Table may not be partitioned yet (first run before 0011 migration)
      logger.warn(`[Retention] Partition management skipped for ${table}:`,
        err instanceof Error ? err.message : err);
    }
  }

  // system_logs uses weekly partitions — special handling
  try {
    // Create a new weekly partition 7 days ahead
    const nextWeekStart = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const weekEnd       = new Date(nextWeekStart.getTime() + 7 * 24 * 60 * 60 * 1000);
    const partName      = `system_logs_${nextWeekStart.toISOString().slice(0, 10).replace(/-/g, '')}`;

    await db.execute(sql.raw(`
      CREATE TABLE IF NOT EXISTS ${partName}
        PARTITION OF system_logs
        FOR VALUES FROM ('${nextWeekStart.toISOString()}') TO ('${weekEnd.toISOString()}')
    `));

    logger.info(`[Retention] Created system_logs partition: ${partName}`);
  } catch (err) {
    logger.warn('[Retention] system_logs weekly partition skipped:',
      err instanceof Error ? err.message : err);
  }
}

// ── Main job ─────────────────────────────────────────────────────────────────

async function runRetentionCycle(): Promise<void> {
  const start = Date.now();
  logger.info('[Retention] Starting nightly retention cycle...');

  try {
    // 1. Roll up metrics before deleting raw rows
    await rollupPlatformMetrics();
    await rollupDaoAnalytics();
    await rollupAssetPrices();
    await rollupRevenueMetrics();

    // 2. Delete old rows
    const vacuumTargets = await runDeletions();

    // 3. Manage partitions
    await managePartitions();

    // 4. VACUUM the tables that had large deletes (helps Neon reclaim storage)
    for (const table of vacuumTargets) {
      await vacuumTable(table);
    }

    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    logger.info(`[Retention] Cycle complete in ${elapsed}s`);

  } catch (err) {
    logger.error('[Retention] Cycle failed:',
      err instanceof Error ? err.message : err);
  }
}

export function initRetentionJob(): void {
  // Run at 02:00 EAT = 23:00 UTC
  cron.schedule('0 23 * * *', runRetentionCycle, { timezone: 'UTC' });
  logger.info('[Retention] Nightly retention job scheduled (23:00 UTC / 02:00 EAT)');
}

// Manual trigger for testing: tsx server/jobs/retention.ts
if (process.argv[1]?.endsWith('retention.ts') || process.argv[1]?.endsWith('retention.js')) {
  runRetentionCycle()
    .then(() => process.exit(0))
    .catch((err) => { console.error(err); process.exit(1); });
}