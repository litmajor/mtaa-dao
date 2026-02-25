/**
 * Migration: Phase 1 - Account System
 * Creates all tables required for account management
 */

import { sql } from "drizzle-orm";
import type { MigrationMeta } from "drizzle-orm/migrator";

export const up = async (db: any) => {
  // Create accounts table
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "accounts" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "user_id" varchar NOT NULL,
      "dao_id" uuid,
      "account_type" varchar(50) NOT NULL,
      "account_name" varchar(255) NOT NULL,
      "account_number" varchar(50) UNIQUE,
      "status" varchar(20) DEFAULT 'active' NOT NULL,
      "currency" varchar(10) DEFAULT 'KES' NOT NULL,
      "primary_wallet_id" uuid,
      "daily_limit" numeric(18, 8),
      "monthly_limit" numeric(18, 8),
      "min_balance" numeric(18, 8) DEFAULT '0',
      "max_balance" numeric(18, 8),
      "balance" numeric(18, 8) DEFAULT '0',
      "total_deposited" numeric(18, 8) DEFAULT '0',
      "total_withdrawn" numeric(18, 8) DEFAULT '0',
      "total_transactions" integer DEFAULT 0,
      "last_activity_at" timestamp,
      "is_verified" boolean DEFAULT false,
      "is_blocked" boolean DEFAULT false,
      "requires_approval" boolean DEFAULT false,
      "allow_auto_withdrawal" boolean DEFAULT true,
      "risk_level" varchar(20) DEFAULT 'low',
      "compliance_flags" jsonb DEFAULT '[]'::jsonb,
      "kyc_status" varchar(20) DEFAULT 'pending',
      "created_at" timestamp DEFAULT NOW() NOT NULL,
      "updated_at" timestamp,
      "verified_at" timestamp,
      "closed_at" timestamp,
      FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE,
      FOREIGN KEY ("dao_id") REFERENCES "daos"("id") ON DELETE CASCADE,
      FOREIGN KEY ("primary_wallet_id") REFERENCES "wallets"("id")
    );
  `);

  // Create indexes for accounts
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "accounts_user_idx" ON "accounts"("user_id");
  `);
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "accounts_dao_idx" ON "accounts"("dao_id");
  `);
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "accounts_status_idx" ON "accounts"("status");
  `);
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "accounts_number_idx" ON "accounts"("account_number");
  `);

  // Create account transactions table
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "account_transactions" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "account_id" uuid NOT NULL,
      "transaction_type" varchar(50) NOT NULL,
      "amount" numeric(18, 8) NOT NULL,
      "currency" varchar(10) NOT NULL,
      "description" text,
      "reference" varchar(100),
      "from_account_id" uuid,
      "to_account_id" uuid,
      "from_user_id" varchar,
      "to_user_id" varchar,
      "status" varchar(20) DEFAULT 'completed',
      "balance_before" numeric(18, 8),
      "balance_after" numeric(18, 8),
      "transaction_hash" varchar(255),
      "chain_id" integer,
      "metadata" jsonb DEFAULT '{}'::jsonb,
      "ip_address" varchar(45),
      "user_agent" varchar,
      "created_at" timestamp DEFAULT NOW(),
      "completed_at" timestamp,
      FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE CASCADE,
      FOREIGN KEY ("from_account_id") REFERENCES "accounts"("id"),
      FOREIGN KEY ("to_account_id") REFERENCES "accounts"("id"),
      FOREIGN KEY ("from_user_id") REFERENCES "users"("id"),
      FOREIGN KEY ("to_user_id") REFERENCES "users"("id")
    );
  `);

  // Create indexes for account transactions
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "account_transactions_account_idx" ON "account_transactions"("account_id");
  `);
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "account_transactions_type_idx" ON "account_transactions"("transaction_type");
  `);
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "account_transactions_status_idx" ON "account_transactions"("status");
  `);
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "account_transactions_date_idx" ON "account_transactions"("created_at");
  `);
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "account_transactions_reference_idx" ON "account_transactions"("reference");
  `);

  // Create account settings table
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "account_settings" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "account_id" uuid UNIQUE NOT NULL,
      "default_transaction_type" varchar(50),
      "auto_deposit_enabled" boolean DEFAULT false,
      "auto_withdrawal_enabled" boolean DEFAULT false,
      "auto_withdrawal_amount" numeric(18, 8),
      "auto_withdrawal_frequency" varchar(50),
      "notify_on_deposit" boolean DEFAULT true,
      "notify_on_withdrawal" boolean DEFAULT true,
      "notify_on_low_balance" boolean DEFAULT true,
      "low_balance_threshold" numeric(18, 8),
      "notify_on_limit_reached" boolean DEFAULT true,
      "require_pin_for_transactions" boolean DEFAULT false,
      "require_two_factor_for_large" boolean DEFAULT false,
      "large_transaction_threshold" numeric(18, 8),
      "display_balance_publicly" boolean DEFAULT false,
      "allow_public_transfers" boolean DEFAULT false,
      "metadata" jsonb DEFAULT '{}'::jsonb,
      "created_at" timestamp DEFAULT NOW(),
      "updated_at" timestamp,
      FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE CASCADE
    );
  `);

  // Create account statements table
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "account_statements" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "account_id" uuid NOT NULL,
      "statement_period" varchar(20) NOT NULL,
      "period_start" timestamp NOT NULL,
      "period_end" timestamp NOT NULL,
      "opening_balance" numeric(18, 8) NOT NULL,
      "closing_balance" numeric(18, 8) NOT NULL,
      "total_deposits" numeric(18, 8) DEFAULT '0',
      "total_withdrawals" numeric(18, 8) DEFAULT '0',
      "total_transfers" numeric(18, 8) DEFAULT '0',
      "total_fees" numeric(18, 8) DEFAULT '0',
      "total_interest" numeric(18, 8) DEFAULT '0',
      "transaction_count" integer DEFAULT 0,
      "statement_url" text,
      "generated_at" timestamp,
      "is_downloaded" boolean DEFAULT false,
      "downloaded_at" timestamp,
      "created_at" timestamp DEFAULT NOW(),
      FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE CASCADE
    );
  `);

  // Create index for account statements
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "account_statements_account_period" ON "account_statements"("account_id", "period_start");
  `);

  // Create account access logs table
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "account_access_logs" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "account_id" uuid NOT NULL,
      "user_id" varchar,
      "action" varchar(100) NOT NULL,
      "resource_type" varchar(50),
      "resource_id" varchar,
      "ip_address" varchar(45),
      "user_agent" text,
      "location" varchar(200),
      "status" varchar(20) DEFAULT 'success',
      "failure_reason" text,
      "metadata" jsonb DEFAULT '{}'::jsonb,
      "created_at" timestamp DEFAULT NOW(),
      FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE CASCADE,
      FOREIGN KEY ("user_id") REFERENCES "users"("id")
    );
  `);

  // Create indexes for account access logs
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "account_access_logs_account_idx" ON "account_access_logs"("account_id");
  `);
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "account_access_logs_user_idx" ON "account_access_logs"("user_id");
  `);
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "account_access_logs_date_idx" ON "account_access_logs"("created_at");
  `);
};

export const down = async (db: any) => {
  // Drop tables in reverse order
  await db.execute(sql`DROP TABLE IF EXISTS "account_access_logs" CASCADE;`);
  await db.execute(sql`DROP TABLE IF EXISTS "account_statements" CASCADE;`);
  await db.execute(sql`DROP TABLE IF EXISTS "account_settings" CASCADE;`);
  await db.execute(sql`DROP TABLE IF EXISTS "account_transactions" CASCADE;`);
  await db.execute(sql`DROP TABLE IF EXISTS "accounts" CASCADE;`);
};

export const meta: MigrationMeta = {
  name: "001_phase1_account_system",
};
