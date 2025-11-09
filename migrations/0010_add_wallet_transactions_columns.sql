-- Migration: Add missing columns to wallet_transactions for schema sync
ALTER TABLE "wallet_transactions" ADD COLUMN "vault_id" uuid REFERENCES "vaults"("id");
ALTER TABLE "wallet_transactions" ADD COLUMN "dao_id" uuid REFERENCES "daos"("id");
ALTER TABLE "wallet_transactions" ADD COLUMN "disbursement_id" varchar;
ALTER TABLE "wallet_transactions" ADD COLUMN "updated_at" timestamp DEFAULT now();
ALTER TABLE "wallet_transactions" ADD COLUMN "metadata" jsonb DEFAULT '{}'::jsonb;
