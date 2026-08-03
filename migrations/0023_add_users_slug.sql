-- Add slug column to users, backfill from username/email/id, and create case-insensitive unique index
BEGIN;

ALTER TABLE users ADD COLUMN IF NOT EXISTS slug varchar(255);

-- Backfill slug from username when available, else from email local-part, else from id
UPDATE users SET slug = lower(regexp_replace(coalesce(username, split_part(email, '@', 1), id), '[^a-z0-9]+', '-', 'g'))
WHERE slug IS NULL;

-- For any remaining duplicates, append short id suffix to ensure uniqueness
WITH duplicates AS (
  SELECT slug FROM users GROUP BY slug HAVING COUNT(*) > 1
)
UPDATE users u
SET slug = u.slug || '-' || substr(u.id::text, 1, 8)
FROM duplicates d
WHERE u.slug = d.slug;

-- Final safety: ensure any NULL slugs are set
UPDATE users SET slug = lower(regexp_replace(coalesce(username, split_part(email, '@', 1), id), '[^a-z0-9]+', '-', 'g'))
WHERE slug IS NULL;

-- Create case-insensitive unique index on lower(slug)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_class WHERE relname = 'users_slug_unique_idx'
  ) THEN
    CREATE UNIQUE INDEX users_slug_unique_idx ON users (lower(slug));
  END IF;
END
$$;

COMMIT;
