ALTER TABLE player_matches ADD COLUMN IF NOT EXISTS challenge_run_id uuid REFERENCES challenge_runs(id);
DROP INDEX IF EXISTS challenge_runs_bound_match;
CREATE INDEX IF NOT EXISTS challenge_runs_match_lookup ON player_matches(challenge_run_id) WHERE challenge_run_id IS NOT NULL;