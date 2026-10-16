import { pool } from '../db';
import type { ExchangeFeeInfo, FeeScheduleVersion } from './exchangeFeeService';

interface FeeScheduleRow {
  exchange: string;
  user_id: string | null;
  effective_from: Date | string;
  effective_to: Date | string | null;
  source_type: FeeScheduleVersion['source'];
  reason: string | null;
  changed_by: string | null;
  last_checked_at: Date | string;
  schedule_info: ExchangeFeeInfo;
}

function toVersion(row: FeeScheduleRow): FeeScheduleVersion {
  return {
    exchange: row.exchange,
    userId: row.user_id,
    lastCheckedAt: new Date(row.last_checked_at).toISOString(),
    effectiveFrom: new Date(row.effective_from).toISOString(),
    effectiveTo: row.effective_to ? new Date(row.effective_to).toISOString() : null,
    source: row.source_type,
    reason: row.reason,
    changedBy: row.changed_by,
    schedule: row.schedule_info,
  };
}

function sameFeeRates(a: ExchangeFeeInfo, b: ExchangeFeeInfo): boolean {
  return JSON.stringify([
    a.baseStructure,
    a.volumeTiers,
    a.stablecoinPairs,
    a.withdrawal ?? null,
    a.nativeTokenDiscount ?? null,
    a.pairFees ?? null,
  ]) === JSON.stringify([
    b.baseStructure,
    b.volumeTiers,
    b.stablecoinPairs,
    b.withdrawal ?? null,
    b.nativeTokenDiscount ?? null,
    b.pairFees ?? null,
  ]);
}

export async function ensureBootstrapFeeSchedules(
  schedules: ExchangeFeeInfo[]
): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const schedule of schedules) {
      await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [schedule.exchange.toLowerCase()]);
      await client.query(
        `INSERT INTO exchange_fee_schedule_history
          (exchange, user_id, effective_from, source_type, reason, schedule_info)
         SELECT $1, NULL, $2, 'bootstrap', 'Built-in fallback schedule', $3::jsonb
         WHERE NOT EXISTS (
           SELECT 1 FROM exchange_fee_schedule_history WHERE exchange = $1 AND user_id IS NULL
         )`,
        [schedule.exchange.toLowerCase(), schedule.asOf, JSON.stringify(schedule)]
      );
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function listFeeScheduleVersions(): Promise<FeeScheduleVersion[]> {
  const { rows } = await pool.query<FeeScheduleRow>(
    `SELECT exchange, user_id, effective_from, effective_to, source_type, reason, changed_by, last_checked_at, schedule_info
     FROM exchange_fee_schedule_history
     ORDER BY exchange, effective_from`
  );
  return rows.map(toVersion);
}

export async function createManualFeeScheduleVersion(
  schedule: ExchangeFeeInfo,
  reason: string,
  changedBy: string
): Promise<{ version: FeeScheduleVersion; changed: boolean }> {
  return createFeeScheduleVersion(schedule, 'manual', null, reason, changedBy);
}

export async function createApiFeeScheduleVersion(
  schedule: ExchangeFeeInfo,
  userId: string
): Promise<{ version: FeeScheduleVersion; changed: boolean }> {
  return createFeeScheduleVersion(
    schedule,
    'api-sync',
    userId,
    'Synchronized from authenticated exchange fee endpoint',
    userId
  );
}

async function createFeeScheduleVersion(
  schedule: ExchangeFeeInfo,
  source: 'manual' | 'api-sync',
  userId: string | null,
  reason: string,
  changedBy: string
): Promise<{ version: FeeScheduleVersion; changed: boolean }> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const exchange = schedule.exchange.toLowerCase();
    const lockKey = `${exchange}:${userId ?? 'global'}`;
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [lockKey]);
    const currentResult = await client.query<FeeScheduleRow>(
      `SELECT exchange, user_id, effective_from, effective_to, source_type, reason, changed_by, last_checked_at, schedule_info
       FROM exchange_fee_schedule_history
       WHERE exchange = $1 AND user_id IS NOT DISTINCT FROM $2 AND effective_to IS NULL
       FOR UPDATE`,
      [exchange, userId]
    );
    const current = currentResult.rows[0];

    if (current && sameFeeRates(current.schedule_info, schedule)) {
      await client.query(
        `UPDATE exchange_fee_schedule_history
         SET last_checked_at = NOW()
         WHERE exchange = $1 AND user_id IS NOT DISTINCT FROM $2 AND effective_to IS NULL`,
        [exchange, userId]
      );
      await client.query('COMMIT');
      return { version: { ...toVersion(current), lastCheckedAt: new Date().toISOString() }, changed: false };
    }

    const effectiveFrom = new Date();
    if (current) {
      const previousStart = new Date(current.effective_from).getTime();
      if (effectiveFrom.getTime() <= previousStart) {
        effectiveFrom.setTime(previousStart + 1);
      }
      await client.query(
        `UPDATE exchange_fee_schedule_history
         SET effective_to = $2
        WHERE exchange = $1 AND user_id IS NOT DISTINCT FROM $3 AND effective_to IS NULL`,
        [exchange, effectiveFrom.toISOString(), userId]
      );
    }

    const { rows } = await client.query<FeeScheduleRow>(
      `INSERT INTO exchange_fee_schedule_history
        (exchange, user_id, effective_from, source_type, reason, changed_by, schedule_info)
       VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
       RETURNING exchange, user_id, effective_from, effective_to, source_type, reason, changed_by, last_checked_at, schedule_info`,
      [exchange, userId, effectiveFrom.toISOString(), source, reason, changedBy, JSON.stringify(schedule)]
    );
    await client.query('COMMIT');
    return { version: toVersion(rows[0]), changed: true };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
