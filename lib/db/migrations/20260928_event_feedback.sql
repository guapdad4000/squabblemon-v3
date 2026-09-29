CREATE TABLE IF NOT EXISTS event_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clerk_user_id text NOT NULL REFERENCES player_profiles(clerk_user_id) ON DELETE CASCADE,
  retry_id uuid NOT NULL,
  display_name text NOT NULL,
  category text NOT NULL,
  message text NOT NULL,
  created_at timestamptz(3) NOT NULL DEFAULT now(),
  CONSTRAINT event_feedback_category_check CHECK (category IN ('bug', 'suggestion', 'general')),
  CONSTRAINT event_feedback_message_check CHECK (char_length(message) BETWEEN 1 AND 2000 AND message = btrim(message)),
  CONSTRAINT event_feedback_display_name_check CHECK (char_length(display_name) BETWEEN 1 AND 200)
);
CREATE UNIQUE INDEX IF NOT EXISTS event_feedback_author_retry_unique ON event_feedback(clerk_user_id, retry_id);
CREATE INDEX IF NOT EXISTS event_feedback_feed_order ON event_feedback(created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS event_feedback_author_time ON event_feedback(clerk_user_id, created_at DESC);