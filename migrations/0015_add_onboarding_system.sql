
-- Onboarding Steps Table
CREATE TABLE "onboarding_steps" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "step_id" varchar NOT NULL UNIQUE,
  "title" varchar NOT NULL,
  "description" varchar,
  "order" integer NOT NULL,
  "is_required" boolean DEFAULT true,
  "category" varchar DEFAULT 'general',
  "estimated_minutes" integer DEFAULT 5,
  "icon" varchar,
  "created_at" timestamp DEFAULT now()
);

-- Onboarding Progress Table
CREATE TABLE "onboarding_progress" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" varchar NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "current_step" varchar NOT NULL,
  "completed_steps" jsonb DEFAULT '[]'::jsonb,
  "skipped_steps" jsonb DEFAULT '[]'::jsonb,
  "progress" integer DEFAULT 0,
  "is_completed" boolean DEFAULT false,
  "started_at" timestamp DEFAULT now(),
  "completed_at" timestamp,
  "last_activity_at" timestamp DEFAULT now(),
  "metadata" jsonb DEFAULT '{}'::jsonb
);

CREATE INDEX "idx_onboarding_progress_user_id" ON "onboarding_progress"("user_id");
CREATE INDEX "idx_onboarding_progress_is_completed" ON "onboarding_progress"("is_completed");

-- Insert default onboarding steps
INSERT INTO "onboarding_steps" ("step_id", "title", "description", "order", "is_required", "category", "estimated_minutes", "icon") VALUES
  ('welcome', 'Welcome to MtaaDAO', 'Get introduced to the platform', 1, true, 'general', 2, 'Sparkles'),
  ('wallet_setup', 'Setup Your Wallet', 'Create or connect your crypto wallet', 2, true, 'financial', 5, 'Wallet'),
  ('profile_complete', 'Complete Your Profile', 'Add your details and preferences', 3, false, 'general', 3, 'User'),
  ('dao_join', 'Join or Create a DAO', 'Participate in community governance', 4, true, 'governance', 5, 'Users'),
  ('first_contribution', 'Make Your First Contribution', 'Support your community financially', 5, false, 'financial', 3, 'DollarSign'),
  ('first_vote', 'Cast Your First Vote', 'Participate in decision making', 6, false, 'governance', 2, 'Vote'),
  ('treasury_explore', 'Explore Treasury Features', 'Learn about fund management', 7, false, 'financial', 5, 'PiggyBank'),
  ('tour_complete', 'Tour Complete', 'You are all set!', 8, true, 'general', 1, 'CheckCircle');
