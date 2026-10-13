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

-- Preserve the actual winner identity even when profiles change or are deleted.
CREATE OR REPLACE FUNCTION protect_kumite_winner_history() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'Kumite winner history is immutable';
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS kumite_winner_history_immutable ON kumite_winners;
CREATE TRIGGER kumite_winner_history_immutable
  BEFORE UPDATE OR DELETE ON kumite_winners
  FOR EACH ROW EXECUTE FUNCTION protect_kumite_winner_history();
