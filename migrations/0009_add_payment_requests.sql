
-- Payment Requests table
CREATE TABLE IF NOT EXISTS "payment_requests" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "from_user_id" varchar REFERENCES "users"("id") NOT NULL,
  "to_user_id" varchar REFERENCES "users"("id"),
  "to_address" varchar,
  "amount" numeric(18, 8) NOT NULL,
  "currency" varchar NOT NULL,
  "description" text,
  "qr_code" text,
  "celo_uri" text,
  "status" varchar DEFAULT 'pending',
  "expires_at" timestamp,
  "paid_at" timestamp,
  "transaction_hash" varchar,
  "metadata" jsonb,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now()
);

-- Payment Receipts table
CREATE TABLE IF NOT EXISTS "payment_receipts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "transaction_id" uuid REFERENCES "wallet_transactions"("id"),
  "payment_request_id" uuid REFERENCES "payment_requests"("id"),
  "receipt_number" varchar UNIQUE NOT NULL,
  "pdf_url" text,
  "email_sent" boolean DEFAULT false,
  "email_sent_at" timestamp,
  "metadata" jsonb,
  "created_at" timestamp DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS "idx_payment_requests_from_user" ON "payment_requests"("from_user_id");
CREATE INDEX IF NOT EXISTS "idx_payment_requests_to_user" ON "payment_requests"("to_user_id");
CREATE INDEX IF NOT EXISTS "idx_payment_requests_status" ON "payment_requests"("status");
CREATE INDEX IF NOT EXISTS "idx_payment_receipts_transaction" ON "payment_receipts"("transaction_id");
