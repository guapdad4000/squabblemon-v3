-- Separate format, shared player identity. Queue retries survive cancellation and settlement.
CREATE TABLE IF NOT EXISTS breakthrough_searches (
  user_id text NOT NULL,
  request_id uuid NOT NULL,
  deck_id text NOT NULL,
  member jsonb NOT NULL,
  status text NOT NULL CHECK (status IN ('waiting','paired','cancelled','complete')),
  room_id text REFERENCES breakthrough_rooms(room_id),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  heartbeat_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY(user_id,request_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS breakthrough_searches_active_player
ON breakthrough_searches(user_id) WHERE status IN ('waiting','paired');
CREATE INDEX IF NOT EXISTS breakthrough_searches_waiting ON breakthrough_searches(created_at) WHERE status='waiting';
CREATE INDEX IF NOT EXISTS breakthrough_searches_room ON breakthrough_searches(room_id) WHERE room_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS breakthrough_rooms_recovery ON breakthrough_rooms(lease_until) WHERE checkpoint->>'phase'='active';
CREATE TABLE IF NOT EXISTS breakthrough_records (
  user_id text NOT NULL,
  season text NOT NULL,
  trophies integer NOT NULL DEFAULT 0 CHECK(trophies>=0),
  wins integer NOT NULL DEFAULT 0,
  losses integer NOT NULL DEFAULT 0,
  draws integer NOT NULL DEFAULT 0,
  PRIMARY KEY(user_id,season)
);
CREATE TABLE IF NOT EXISTS breakthrough_receipts (
  room_id text NOT NULL REFERENCES breakthrough_rooms(room_id),
  user_id text NOT NULL,
  opponent_id text NOT NULL,
  season text NOT NULL,
  receipt jsonb NOT NULL,
  settled_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY(room_id,user_id)
);
CREATE INDEX IF NOT EXISTS breakthrough_receipts_daily ON breakthrough_receipts(user_id,settled_at);
