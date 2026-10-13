BEGIN;
CREATE TABLE IF NOT EXISTS community_decks (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), clerk_user_id text NOT NULL REFERENCES player_profiles(clerk_user_id) ON DELETE CASCADE,
 week text NOT NULL, name text NOT NULL CHECK (length(name) BETWEEN 1 AND 60), strategy text NOT NULL CHECK (length(strategy) BETWEEN 1 AND 280),
 card_ids jsonb NOT NULL CHECK (jsonb_typeof(card_ids)='array' AND jsonb_array_length(card_ids)=10), hero_card_id text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), CONSTRAINT community_decks_author_week UNIQUE(clerk_user_id,week)
);
CREATE INDEX IF NOT EXISTS community_decks_week_order ON community_decks(week,created_at,id);
CREATE TABLE IF NOT EXISTS community_deck_votes (
 deck_id uuid NOT NULL REFERENCES community_decks(id) ON DELETE CASCADE, clerk_user_id text NOT NULL REFERENCES player_profiles(clerk_user_id) ON DELETE CASCADE,
 created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(deck_id,clerk_user_id)
);
CREATE INDEX IF NOT EXISTS community_deck_votes_author ON community_deck_votes(clerk_user_id);
CREATE INDEX IF NOT EXISTS fade_park_standings_points ON player_profiles ((CASE WHEN jsonb_typeof(story_progress->'fadePark'->'points')='number' THEN (story_progress->'fadePark'->>'points')::numeric ELSE 0 END) DESC) WHERE story_progress ? 'fadePark';
COMMIT;
