-- Additive migration: existing style_shards and receipt history remain untouched.
-- Deploy before the server version that reads style_shard_balances.
BEGIN;
ALTER TABLE player_profiles
  ADD COLUMN IF NOT EXISTS style_shard_balances jsonb NOT NULL DEFAULT '{}'::jsonb;
COMMIT;
