-- Bound daily ranked reward counting to this player's UTC day, not their
-- lifetime JSON receipt history. No existing claim or wallet is changed.
CREATE INDEX IF NOT EXISTS player_collection_claims_user_created
  ON player_collection_claims (clerk_user_id, created_at);
