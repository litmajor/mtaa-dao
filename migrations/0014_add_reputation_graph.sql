
-- Add contribution graph table
CREATE TABLE IF NOT EXISTS "contribution_graph" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" varchar NOT NULL REFERENCES "users"("id"),
  "contribution_type" varchar NOT NULL,
  "dao_id" uuid REFERENCES "daos"("id"),
  "value" numeric(18, 8),
  "reputation_weight" integer NOT NULL,
  "impact_score" integer DEFAULT 0,
  "verified" boolean DEFAULT false,
  "verified_by" varchar REFERENCES "users"("id"),
  "verified_at" timestamp,
  "proof_data" jsonb,
  "on_chain_tx_hash" varchar,
  "metadata" jsonb,
  "related_entity_id" uuid,
  "related_entity_type" varchar,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now()
);

-- Add reputation badges table (Soulbound NFTs)
CREATE TABLE IF NOT EXISTS "reputation_badges" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" varchar NOT NULL REFERENCES "users"("id"),
  "badge_type" varchar NOT NULL,
  "badge_tier" varchar NOT NULL,
  "name" varchar NOT NULL,
  "description" text,
  "image_url" varchar,
  "category" varchar NOT NULL,
  "criteria_type" varchar NOT NULL,
  "criteria_value" integer,
  "token_id" varchar UNIQUE,
  "contract_address" varchar,
  "chain_id" integer DEFAULT 44787,
  "is_soulbound" boolean DEFAULT true,
  "is_active" boolean DEFAULT true,
  "expires_at" timestamp,
  "metadata" jsonb,
  "earned_at" timestamp DEFAULT now(),
  "revoked_at" timestamp,
  "revoked_reason" text
);

-- Add economic identity table
CREATE TABLE IF NOT EXISTS "economic_identity" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" varchar NOT NULL UNIQUE REFERENCES "users"("id"),
  "phone_number" varchar,
  "contribution_score" integer DEFAULT 0,
  "liquidity_score" integer DEFAULT 0,
  "governance_score" integer DEFAULT 0,
  "social_score" integer DEFAULT 0,
  "reliability_score" integer DEFAULT 0,
  "total_score" integer DEFAULT 0,
  "credit_limit" numeric(18, 2) DEFAULT 0,
  "default_risk" varchar DEFAULT 'unknown',
  "loan_count" integer DEFAULT 0,
  "loan_default_count" integer DEFAULT 0,
  "active_days" integer DEFAULT 0,
  "last_active_date" timestamp,
  "longest_streak" integer DEFAULT 0,
  "current_streak" integer DEFAULT 0,
  "phone_verified" boolean DEFAULT false,
  "kyc_verified" boolean DEFAULT false,
  "address_verified" boolean DEFAULT false,
  "verification_metadata" jsonb,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now()
);

-- Add skill verifications table
CREATE TABLE IF NOT EXISTS "skill_verifications" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" varchar NOT NULL REFERENCES "users"("id"),
  "skill_name" varchar NOT NULL,
  "skill_category" varchar NOT NULL,
  "verified" boolean DEFAULT false,
  "verified_by" varchar REFERENCES "users"("id"),
  "verification_method" varchar,
  "verification_proof" jsonb,
  "proficiency_level" varchar NOT NULL,
  "endorsement_count" integer DEFAULT 0,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now()
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS "idx_contribution_graph_user_id" ON "contribution_graph"("user_id");
CREATE INDEX IF NOT EXISTS "idx_contribution_graph_type" ON "contribution_graph"("contribution_type");
CREATE INDEX IF NOT EXISTS "idx_contribution_graph_verified" ON "contribution_graph"("verified");
CREATE INDEX IF NOT EXISTS "idx_reputation_badges_user_id" ON "reputation_badges"("user_id");
CREATE INDEX IF NOT EXISTS "idx_reputation_badges_type" ON "reputation_badges"("badge_type");
CREATE INDEX IF NOT EXISTS "idx_economic_identity_phone" ON "economic_identity"("phone_number");
CREATE INDEX IF NOT EXISTS "idx_skill_verifications_user_id" ON "skill_verifications"("user_id");

-- Add proof_hash and verifiable columns to msiamo_points
ALTER TABLE "msiamo_points" ADD COLUMN IF NOT EXISTS "verifiable" boolean DEFAULT true;
ALTER TABLE "msiamo_points" ADD COLUMN IF NOT EXISTS "proof_hash" varchar;
