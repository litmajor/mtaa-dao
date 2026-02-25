import { sql } from "drizzle-orm";
import type { PostgresDB } from "drizzle-orm/postgres-js";

/**
 * Migration: Add Micro-Withdrawals System
 * 
 * Creates tables for:
 * - microWithdrawals: Individual user micro-withdrawal requests
 * - microWithdrawalBatches: Consolidated batches of withdrawals
 */
export async function up(db: PostgresDB) {
  // Create microWithdrawals table
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS micro_withdrawals (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      amount DECIMAL(10, 2) NOT NULL,
      currency VARCHAR(10) NOT NULL,
      to_address VARCHAR(255) NOT NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'pending',
      batch_id UUID REFERENCES micro_withdrawal_batches(id) ON DELETE SET NULL,
      estimated_gas_fee DECIMAL(18, 8),
      actual_gas_fee DECIMAL(18, 8),
      transaction_hash VARCHAR(255),
      cancelled_at TIMESTAMP,
      cancelled_reason TEXT,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
      processed_at TIMESTAMP,
      
      CHECK (amount >= 0.50 AND amount <= 10.00),
      CHECK (to_address ~ '^0x[a-fA-F0-9]{40}$'),
      CHECK (currency IN ('USDC', 'USDT', 'cUSD', 'ETH')),
      CHECK (status IN ('pending', 'batched', 'processed', 'failed', 'cancelled'))
    );

    CREATE INDEX micro_withdrawals_user_id_idx ON micro_withdrawals(user_id);
    CREATE INDEX micro_withdrawals_status_idx ON micro_withdrawals(status);
    CREATE INDEX micro_withdrawals_batch_id_idx ON micro_withdrawals(batch_id);
    CREATE INDEX micro_withdrawals_created_at_idx ON micro_withdrawals(created_at);
    CREATE INDEX micro_withdrawals_user_status_idx ON micro_withdrawals(user_id, status);
  `);

  // Create microWithdrawalBatches table
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS micro_withdrawal_batches (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      request_count INTEGER NOT NULL,
      total_amount DECIMAL(18, 2) NOT NULL,
      currency VARCHAR(10) NOT NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'pending',
      estimated_gas_fee DECIMAL(18, 8),
      actual_gas_fee DECIMAL(18, 8),
      transaction_hash VARCHAR(255),
      failure_reason TEXT,
      triggered_by VARCHAR(50) NOT NULL,
      processed_at TIMESTAMP,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
      
      CHECK (status IN ('pending', 'processing', 'processed', 'failed')),
      CHECK (triggered_by IN ('count', 'amount', 'time', 'manual', 'api'))
    );

    CREATE INDEX micro_withdrawal_batches_status_idx ON micro_withdrawal_batches(status);
    CREATE INDEX micro_withdrawal_batches_created_at_idx ON micro_withdrawal_batches(created_at);
    CREATE INDEX micro_withdrawal_batches_triggered_by_idx ON micro_withdrawal_batches(triggered_by);
  `);
}

export async function down(db: PostgresDB) {
  // Drop tables in reverse order of creation
  await db.execute(sql`
    DROP TABLE IF EXISTS micro_withdrawals;
  `);

  await db.execute(sql`
    DROP TABLE IF EXISTS micro_withdrawal_batches;
  `);
}
