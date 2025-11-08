
-- DAO Creation Tracking
CREATE TABLE IF NOT EXISTS "dao_creation_tracker" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" varchar NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "dao_id" varchar NOT NULL REFERENCES "daos"("id") ON DELETE CASCADE,
  "created_at" timestamp DEFAULT now(),
  "verification_method" varchar NOT NULL, -- 'phone', 'wallet', 'social'
  "verification_data" jsonb DEFAULT '{}'::jsonb,
  "is_verified" boolean DEFAULT false
);

-- Social Proof Verifications
CREATE TABLE IF NOT EXISTS "dao_social_verifications" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "dao_id" varchar NOT NULL REFERENCES "daos"("id") ON DELETE CASCADE,
  "verifier_user_id" varchar NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "verified_at" timestamp DEFAULT now(),
  "verification_type" varchar DEFAULT 'member_invite', -- 'member_invite', 'community_vouch'
  "metadata" jsonb DEFAULT '{}'::jsonb
);

-- DAO Identity NFTs
CREATE TABLE IF NOT EXISTS "dao_identity_nfts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "dao_id" varchar NOT NULL UNIQUE REFERENCES "daos"("id") ON DELETE CASCADE,
  "nft_token_id" varchar,
  "nft_contract_address" varchar,
  "minted_at" timestamp DEFAULT now(),
  "mint_cost_mtaa" numeric DEFAULT 10,
  "is_verified" boolean DEFAULT false,
  "metadata_uri" varchar
);

-- Indexes
CREATE INDEX "idx_dao_creation_tracker_user" ON "dao_creation_tracker"("user_id");
CREATE INDEX "idx_dao_creation_tracker_created" ON "dao_creation_tracker"("created_at");
CREATE INDEX "idx_dao_social_verifications_dao" ON "dao_social_verifications"("dao_id");
CREATE INDEX "idx_dao_identity_nfts_dao" ON "dao_identity_nfts"("dao_id");

-- Add cooldown tracking to users
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "last_dao_creation" timestamp;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "total_daos_created" integer DEFAULT 0;

-- Add verification flags to DAOs
ALTER TABLE "daos" ADD COLUMN IF NOT EXISTS "is_verified" boolean DEFAULT false;
ALTER TABLE "daos" ADD COLUMN IF NOT EXISTS "verification_score" integer DEFAULT 0;
ALTER TABLE "daos" ADD COLUMN IF NOT EXISTS "social_proof_count" integer DEFAULT 0;
ALTER TABLE "daos" ADD COLUMN IF NOT EXISTS "requires_verification" boolean DEFAULT true;
