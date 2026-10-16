BEGIN;
-- Fade Park lobby, search and queue polls filter rooms by JSON status. Finished
-- battles keep large compressed snapshots, so without these partial indexes each
-- read unpacked every room ever played. Predicates match onlineMatches.ts.
CREATE INDEX IF NOT EXISTS online_rooms_ranked_queue ON online_rooms (created_at) WHERE (state->>'status') = 'waiting' AND (state ? 'ranked');
CREATE INDEX IF NOT EXISTS online_rooms_ranked_open_host ON online_rooms (host_user_id, created_at) WHERE (state->>'status') IN ('waiting', 'active') AND (state ? 'ranked');
CREATE INDEX IF NOT EXISTS online_rooms_ranked_open_guest ON online_rooms (guest_user_id, created_at) WHERE (state->>'status') IN ('waiting', 'active') AND (state ? 'ranked');
COMMIT;
