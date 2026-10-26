-- Metadata-only expansion: stored generated columns rewrite the entire replay
-- archive under ACCESS EXCLUSIVE and exceed Netlify's migration deadline.
-- Existing rows remain NULL and use the authoritative API fallback. Every new
-- state write (including older API writers) fills both projections atomically.
ALTER TABLE online_rooms
  ADD COLUMN IF NOT EXISTS sync_token text,
  ADD COLUMN IF NOT EXISTS live_state jsonb;

CREATE OR REPLACE FUNCTION refresh_online_room_live_state() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW.sync_token := md5(NEW.state::text);
  NEW.live_state := NEW.state - 'match';
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER online_rooms_live_state
BEFORE INSERT OR UPDATE OF state, sync_token, live_state ON online_rooms
FOR EACH ROW EXECUTE FUNCTION refresh_online_room_live_state();
