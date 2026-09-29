-- Netlify owns the transaction for native migrations.
-- Older copies could commit these objects without recording the migration.
-- A retry must preserve existing identities rather than reset their history.
ALTER TABLE social_identities ADD COLUMN IF NOT EXISTS username text;
CREATE UNIQUE INDEX IF NOT EXISTS social_username_unique ON social_identities (username);
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'social_identities'::regclass AND conname = 'social_username_format'
  ) THEN
    ALTER TABLE social_identities ADD CONSTRAINT social_username_format CHECK (username ~ '^[a-z0-9_]{3,24}$');
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'social_identities'::regclass AND conname = 'social_username_reserved'
  ) THEN
    ALTER TABLE social_identities ADD CONSTRAINT social_username_reserved CHECK (username NOT IN ('admin','administrator','system','support','moderator','mod','official','fadebook','squabblemon','deleted','null','undefined'));
  END IF;
END
$$;