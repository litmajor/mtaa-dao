BEGIN;

CREATE TABLE IF NOT EXISTS dao_rotation_payouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dao_id uuid NOT NULL REFERENCES daos (id) ON DELETE CASCADE,
  cycle_id uuid NOT NULL UNIQUE REFERENCES dao_rotation_cycles (id) ON DELETE CASCADE,
  attempt_number integer NOT NULL DEFAULT 1,
  recipient_phone varchar NOT NULL,
  amount_kes integer NOT NULL,
  treasurer_id varchar NOT NULL REFERENCES users (id),
  elder_id varchar NOT NULL REFERENCES users (id),
  status varchar NOT NULL DEFAULT 'queued',
  conversation_id varchar UNIQUE,
  originator_conversation_id varchar UNIQUE,
  transaction_id varchar UNIQUE,
  result_code integer,
  result_description text,
  callback_metadata jsonb DEFAULT '{}',
  requested_at timestamp DEFAULT now(),
  completed_at timestamp,
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);

CREATE INDEX IF NOT EXISTS dao_rotation_payouts_status_requested_idx
  ON dao_rotation_payouts (status, requested_at);

COMMIT;
