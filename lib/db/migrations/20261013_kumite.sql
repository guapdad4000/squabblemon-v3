CREATE TABLE IF NOT EXISTS kumite_tournaments (
  id text PRIMARY KEY,
  state jsonb NOT NULL,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS kumite_winners (
  tournament_id text PRIMARY KEY,
  week_label text NOT NULL,
  champion jsonb NOT NULL,
  won_at timestamptz NOT NULL
);
