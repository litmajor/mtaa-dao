-- Add unique index on daos.name (lowercased) and fail explicitly if duplicates exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_class WHERE relname = 'daos_name_unique_idx'
  ) THEN
    -- Create unique index only when there are no case-insensitive duplicates.
    -- If duplicates exist, fail so the migration cannot silently skip.
    IF EXISTS (
      SELECT 1 FROM (
        SELECT lower(name) AS n, count(*) FROM daos GROUP BY lower(name) HAVING count(*) > 1
      ) t
    ) THEN
      RAISE EXCEPTION 'Cannot create daos_name_unique_idx because case-insensitive duplicate DAO names exist';
    END IF;
    CREATE UNIQUE INDEX daos_name_unique_idx ON daos (lower(name));
  END IF;
END
$$;
