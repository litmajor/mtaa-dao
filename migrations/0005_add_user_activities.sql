
CREATE TABLE IF NOT EXISTS "user_activities" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"action" varchar(255) NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "user_activities_user_id_idx" ON "user_activities" ("user_id");
CREATE INDEX IF NOT EXISTS "user_activities_action_idx" ON "user_activities" ("action");
CREATE INDEX IF NOT EXISTS "user_activities_created_at_idx" ON "user_activities" ("created_at");
