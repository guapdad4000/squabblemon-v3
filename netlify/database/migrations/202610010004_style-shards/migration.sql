-- Preserve all existing universal shards and historical receipts.
-- Netlify applies this additive migration before publishing the new API.
ALTER TABLE player_profiles
  ADD COLUMN IF NOT EXISTS style_shard_balances jsonb NOT NULL DEFAULT '{}'::jsonb;
