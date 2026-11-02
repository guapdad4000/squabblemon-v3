-- Dedicated Breakthrough room owner state. Public admission remains release-gated.
CREATE TABLE IF NOT EXISTS breakthrough_rooms (
  room_id text PRIMARY KEY,
  owner_fence bigint NOT NULL CHECK (owner_fence > 0),
  lease_until timestamptz NOT NULL,
  revision bigint NOT NULL CHECK (revision >= 0),
  checkpoint_revision bigint NOT NULL CHECK (checkpoint_revision <= revision),
  checkpoint jsonb NOT NULL,
  expires_at timestamptz NOT NULL
);
CREATE TABLE IF NOT EXISTS breakthrough_room_journal (
  room_id text NOT NULL REFERENCES breakthrough_rooms(room_id) ON DELETE CASCADE,
  revision bigint NOT NULL,
  entry jsonb NOT NULL,
  PRIMARY KEY (room_id, revision)
);
CREATE TABLE IF NOT EXISTS breakthrough_room_outbox (
  id text PRIMARY KEY,
  room_id text NOT NULL REFERENCES breakthrough_rooms(room_id),
  event jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  settled_at timestamptz
);
CREATE INDEX IF NOT EXISTS breakthrough_room_outbox_pending ON breakthrough_room_outbox (created_at) WHERE settled_at IS NULL;
