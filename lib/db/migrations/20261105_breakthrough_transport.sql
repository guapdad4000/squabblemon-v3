-- Ephemeral compressed transport for hosts that cannot deliver LISTEN/NOTIFY.
-- No game authority or player profile data is stored here. The journal remains authoritative.
CREATE TABLE IF NOT EXISTS breakthrough_transport (
  id bigserial PRIMARY KEY,
  channel text NOT NULL CHECK (channel ~ '^bt_[a-z0-9_]{1,59}$'),
  payload text NOT NULL CHECK (length(payload) <= 2800000),
  expires_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS breakthrough_transport_channel ON breakthrough_transport(channel,id);
CREATE INDEX IF NOT EXISTS breakthrough_transport_expiry ON breakthrough_transport(expires_at);
ALTER TABLE breakthrough_transport ENABLE ROW LEVEL SECURITY;
