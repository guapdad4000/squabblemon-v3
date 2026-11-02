CREATE TABLE IF NOT EXISTS park_rival_standings (
  season text NOT NULL,
  persona_id text NOT NULL,
  stats jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (season, persona_id)
);
ALTER TABLE park_rival_standings ENABLE ROW LEVEL SECURITY;
