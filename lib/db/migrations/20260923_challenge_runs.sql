CREATE TABLE IF NOT EXISTS challenge_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clerk_user_id text NOT NULL REFERENCES player_profiles(clerk_user_id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'active',
  seed integer NOT NULL, encounter_index integer NOT NULL DEFAULT 0, score integer NOT NULL DEFAULT 0,
  entry_date text NOT NULL, entry_number integer NOT NULL, wins integer NOT NULL DEFAULT 0,
  crew_snapshot jsonb NOT NULL, encounter_snapshot jsonb NOT NULL, checkpoints jsonb NOT NULL DEFAULT '[]', transcripts jsonb NOT NULL DEFAULT '[]',
  reward_granted_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(), completed_at timestamptz
);
ALTER TABLE player_matches ADD COLUMN IF NOT EXISTS challenge_run_id uuid REFERENCES challenge_runs(id);
DROP INDEX IF EXISTS challenge_runs_bound_match;
CREATE INDEX IF NOT EXISTS player_matches_challenge_run ON player_matches(challenge_run_id) WHERE challenge_run_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS challenge_runs_one_active_user ON challenge_runs(clerk_user_id) WHERE status = 'active';