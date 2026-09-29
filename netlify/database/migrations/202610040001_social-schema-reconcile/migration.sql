-- Netlify owns this transaction. Previously applied files stay byte-identical.
-- Reconcile additively so both complete and partial schemas preserve player data.
ALTER TABLE online_rooms ADD COLUMN IF NOT EXISTS invite_only boolean NOT NULL DEFAULT false;
CREATE TABLE IF NOT EXISTS social_identities (
 user_id text PRIMARY KEY REFERENCES player_profiles(clerk_user_id) ON DELETE CASCADE,
 friend_code text NOT NULL UNIQUE,
 CONSTRAINT social_friend_code_format CHECK(friend_code ~ '^[A-F0-9]{12}$')
);
CREATE TABLE IF NOT EXISTS social_relationships (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 low_user_id text NOT NULL REFERENCES player_profiles(clerk_user_id) ON DELETE CASCADE,
 high_user_id text NOT NULL REFERENCES player_profiles(clerk_user_id) ON DELETE CASCADE,
 sender_user_id text NOT NULL REFERENCES player_profiles(clerk_user_id) ON DELETE CASCADE,
 status text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT social_pair_order CHECK (low_user_id < high_user_id),
 CONSTRAINT social_sender_member CHECK (sender_user_id IN (low_user_id, high_user_id)),
 CONSTRAINT social_relationship_status CHECK (status IN ('pending','homie','declined','cancelled','removed'))
);
CREATE UNIQUE INDEX IF NOT EXISTS social_pair_once ON social_relationships(low_user_id,high_user_id);
CREATE INDEX IF NOT EXISTS social_relationship_high ON social_relationships(high_user_id);
CREATE TABLE IF NOT EXISTS social_blocks (
 user_id text NOT NULL REFERENCES player_profiles(clerk_user_id) ON DELETE CASCADE,
 target_id text NOT NULL REFERENCES player_profiles(clerk_user_id) ON DELETE CASCADE,
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(user_id,target_id), CONSTRAINT social_block_not_self CHECK(user_id <> target_id)
);
CREATE TABLE IF NOT EXISTS social_invitations (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 sender_user_id text NOT NULL REFERENCES player_profiles(clerk_user_id) ON DELETE CASCADE,
 recipient_user_id text NOT NULL REFERENCES player_profiles(clerk_user_id) ON DELETE CASCADE,
 low_user_id text NOT NULL REFERENCES player_profiles(clerk_user_id) ON DELETE CASCADE,
 high_user_id text NOT NULL REFERENCES player_profiles(clerk_user_id) ON DELETE CASCADE,
 room_id uuid NOT NULL UNIQUE REFERENCES online_rooms(id) ON DELETE CASCADE,
 request_id uuid NOT NULL, deck_id text NOT NULL,
 status text NOT NULL DEFAULT 'pending', expires_at timestamptz NOT NULL DEFAULT now(), created_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT social_invite_pair_order CHECK(low_user_id < high_user_id),
 CONSTRAINT social_invite_members CHECK(sender_user_id <> recipient_user_id AND sender_user_id IN (low_user_id,high_user_id) AND recipient_user_id IN (low_user_id,high_user_id)),
 CONSTRAINT social_invite_status CHECK(status IN ('pending','accepted','declined','cancelled','expired','unavailable','closed'))
);
CREATE UNIQUE INDEX IF NOT EXISTS social_invite_request_once ON social_invitations(sender_user_id,request_id);
CREATE UNIQUE INDEX IF NOT EXISTS social_invite_active_pair ON social_invitations(low_user_id,high_user_id) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS social_invite_recipient ON social_invitations(recipient_user_id);
CREATE TABLE IF NOT EXISTS social_throttle (
 user_id text NOT NULL REFERENCES player_profiles(clerk_user_id) ON DELETE CASCADE,
 action text NOT NULL, window_at timestamptz NOT NULL DEFAULT now(), count integer NOT NULL,
 PRIMARY KEY(user_id,action)
);
UPDATE online_rooms SET invite_only = true WHERE id IN (SELECT room_id FROM social_invitations);
ALTER TABLE social_identities ADD COLUMN IF NOT EXISTS username text;
CREATE UNIQUE INDEX IF NOT EXISTS social_username_unique ON social_identities (username);
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'social_identities'::regclass AND conname = 'social_username_format'
  ) THEN
    ALTER TABLE social_identities ADD CONSTRAINT social_username_format CHECK (username ~ '^[a-z0-9_]{3,24}$');
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'social_identities'::regclass AND conname = 'social_username_reserved'
  ) THEN
    ALTER TABLE social_identities ADD CONSTRAINT social_username_reserved CHECK (username NOT IN ('admin','administrator','system','support','moderator','mod','official','fadebook','squabblemon','deleted','null','undefined'));
  END IF;
END
$$;