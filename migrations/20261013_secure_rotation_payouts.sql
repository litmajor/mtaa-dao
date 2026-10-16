-- Run: node scripts/apply_sql_migration.js migrations/20261013_secure_rotation_payouts.sql
-- Persist and de-duplicate manual payout references, and prevent a M-Pesa receipt
-- from being credited to more than one live contribution or payout globally.

BEGIN;

ALTER TABLE dao_rotation_cycles
  ADD COLUMN IF NOT EXISTS payment_reference varchar;

CREATE UNIQUE INDEX IF NOT EXISTS dao_rotation_cycles_payment_reference_unique
  ON dao_rotation_cycles (lower(payment_reference))
  WHERE payment_reference IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS dao_contributions_mpesa_reference_unique
  ON dao_contributions (
    lower(coalesce(
      nullif(metadata->>'mpesaCode', ''),
      nullif(metadata->>'mpesaReceipt', '')
    ))
  )
  WHERE currency = 'KES'
    AND nullif(coalesce(
      nullif(metadata->>'mpesaCode', ''),
      nullif(metadata->>'mpesaReceipt', '')
    ), '') IS NOT NULL
    AND status IS DISTINCT FROM 'rejected';

CREATE TABLE IF NOT EXISTS dao_rotation_payout_confirmations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dao_id uuid NOT NULL REFERENCES daos (id) ON DELETE CASCADE,
  cycle_id uuid NOT NULL UNIQUE REFERENCES dao_rotation_cycles (id) ON DELETE CASCADE,
  confirmer_id varchar NOT NULL REFERENCES users (id),
  created_at timestamp DEFAULT now()
);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM dao_contribution_approvals
    GROUP BY contribution_id, approver_id
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION
      'Cannot create dao_contribution_approvals_one_per_approver: duplicate contribution/approver rows already exist';
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS dao_contribution_approvals_one_per_approver
  ON dao_contribution_approvals (contribution_id, approver_id);

COMMIT;
