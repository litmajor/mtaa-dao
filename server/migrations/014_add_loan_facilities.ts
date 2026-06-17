import { sql } from "drizzle-orm";
import type { PostgresDB } from "drizzle-orm/postgres-js";

/**
 * Migration 014: Add `loan_facilities` table to record on-chain LoanFacility contracts
 */
export async function up(db: PostgresDB) {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS loan_facilities (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      dao_id UUID NOT NULL REFERENCES daos(id) ON DELETE CASCADE,
      address VARCHAR(255),
      stablecoin VARCHAR(255),
      elder_council VARCHAR(255),
      funded_amount DECIMAL(18,8) DEFAULT 0,
      metadata JSONB DEFAULT '{}',
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS loan_facilities_dao_id_idx ON loan_facilities(dao_id);
    CREATE INDEX IF NOT EXISTS loan_facilities_address_idx ON loan_facilities(address);
  `);
}

export async function down(db: PostgresDB) {
  await db.execute(sql`DROP TABLE IF EXISTS loan_facilities;`);
}
