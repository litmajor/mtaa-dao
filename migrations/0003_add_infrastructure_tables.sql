
-- Add audit_logs table for security logging
CREATE TABLE IF NOT EXISTS "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"timestamp" timestamp DEFAULT now() NOT NULL,
	"user_id" varchar,
	"user_email" varchar,
	"action" varchar NOT NULL,
	"resource" varchar NOT NULL,
	"resource_id" varchar,
	"method" varchar NOT NULL,
	"endpoint" varchar NOT NULL,
	"ip_address" varchar NOT NULL,
	"user_agent" varchar NOT NULL,
	"status" integer NOT NULL,
	"details" jsonb,
	"severity" varchar DEFAULT 'low' NOT NULL,
	"category" varchar DEFAULT 'security' NOT NULL,
	"created_at" timestamp DEFAULT now()
);

-- Add system_logs table for application logging
CREATE TABLE IF NOT EXISTS "system_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"level" varchar DEFAULT 'info' NOT NULL,
	"message" text NOT NULL,
	"service" varchar DEFAULT 'api' NOT NULL,
	"metadata" jsonb,
	"timestamp" timestamp DEFAULT now() NOT NULL
);

-- Add notification_history table
CREATE TABLE IF NOT EXISTS "notification_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"type" varchar NOT NULL,
	"title" varchar NOT NULL,
	"message" text NOT NULL,
	"read" boolean DEFAULT false,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now(),
	"read_at" timestamp
);

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS "audit_logs_user_id_idx" ON "audit_logs" ("user_id");
CREATE INDEX IF NOT EXISTS "audit_logs_timestamp_idx" ON "audit_logs" ("timestamp");
CREATE INDEX IF NOT EXISTS "audit_logs_severity_idx" ON "audit_logs" ("severity");
CREATE INDEX IF NOT EXISTS "system_logs_level_idx" ON "system_logs" ("level");
CREATE INDEX IF NOT EXISTS "system_logs_timestamp_idx" ON "system_logs" ("timestamp");
CREATE INDEX IF NOT EXISTS "notification_history_user_id_idx" ON "notification_history" ("user_id");
CREATE INDEX IF NOT EXISTS "notification_history_read_idx" ON "notification_history" ("read");

-- Add foreign key constraints
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "notification_history" ADD CONSTRAINT "notification_history_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
