-- Profile row locking serializes payment, inventory and independent banner-family guarantees.
ALTER TABLE player_profiles ADD COLUMN IF NOT EXISTS featured_pack_progress jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE player_pack_openings ADD COLUMN IF NOT EXISTS featured_progress jsonb;
