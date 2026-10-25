-- Add before API rollout. Old API writers automatically maintain these columns.
-- The private archive remains in state; unchanged reads access only live_state
-- and sync_token, so PostgreSQL does not detoast/transfer the replay archive.
ALTER TABLE online_rooms
  ADD COLUMN IF NOT EXISTS sync_token text GENERATED ALWAYS AS (md5(state::text)) STORED,
  ADD COLUMN IF NOT EXISTS live_state jsonb GENERATED ALWAYS AS (state - 'match') STORED;
