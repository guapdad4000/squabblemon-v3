-- Additive migration. Apply with the deployment database migration process before enabling friend matches.
BEGIN;
CREATE TABLE IF NOT EXISTS online_rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), code text NOT NULL UNIQUE,
  host_user_id text NOT NULL REFERENCES player_profiles(clerk_user_id) ON DELETE CASCADE,
  guest_user_id text REFERENCES player_profiles(clerk_user_id) ON DELETE CASCADE,
  create_request_id uuid NOT NULL, state jsonb NOT NULL, expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS online_rooms_create_once ON online_rooms(host_user_id, create_request_id);
CREATE INDEX IF NOT EXISTS online_rooms_host ON online_rooms(host_user_id);
CREATE INDEX IF NOT EXISTS online_rooms_guest ON online_rooms(guest_user_id);
CREATE TABLE IF NOT EXISTS online_commands (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), room_id uuid NOT NULL REFERENCES online_rooms(id) ON DELETE CASCADE,
  revision integer NOT NULL, user_id text NOT NULL, request_id uuid NOT NULL, command jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS online_commands_request_once ON online_commands(room_id, user_id, request_id);
CREATE UNIQUE INDEX IF NOT EXISTS online_commands_revision ON online_commands(room_id, revision);
COMMIT;
