CREATE TABLE IF NOT EXISTS "telegram_referral_attributions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "telegram_user_id" varchar NOT NULL UNIQUE,
  "referrer_id" varchar NOT NULL REFERENCES "users"("id"),
  "token" varchar(256) NOT NULL,
  "expires_at" timestamp NOT NULL,
  "used" boolean NOT NULL DEFAULT false,
  "used_at" timestamp,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "telegram_referral_attributions_expires_idx"
  ON "telegram_referral_attributions" ("expires_at");
