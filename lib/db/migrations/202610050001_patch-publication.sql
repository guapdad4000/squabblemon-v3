BEGIN;
CREATE TABLE IF NOT EXISTS patch_drafts (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 version text NOT NULL,
 title text NOT NULL,
 patch_date date NOT NULL,
 overview text NOT NULL,
 buffs jsonb NOT NULL DEFAULT '[]'::jsonb,
 changes jsonb NOT NULL DEFAULT '[]'::jsonb,
 soft_currency integer NOT NULL DEFAULT 50,
 pack_tickets integer NOT NULL DEFAULT 0,
 status text NOT NULL DEFAULT 'draft',
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 created_by text NOT NULL,
 published_at timestamptz,
 published_by text,
 intended_count integer NOT NULL DEFAULT 0,
 delivered_count integer NOT NULL DEFAULT 0,
 failed_count integer NOT NULL DEFAULT 0,
 last_error text,
 campaign_id text,
 CONSTRAINT patch_drafts_status_check CHECK (status IN ('draft','published')),
 CONSTRAINT patch_drafts_gift_check CHECK (soft_currency BETWEEN 0 AND 100 AND pack_tickets BETWEEN 0 AND 1),
 CONSTRAINT patch_drafts_counts_check CHECK (intended_count >= 0 AND delivered_count >= 0 AND failed_count >= 0)
);
CREATE UNIQUE INDEX IF NOT EXISTS patch_drafts_version_unique ON patch_drafts(version);
CREATE INDEX IF NOT EXISTS patch_drafts_public_order ON patch_drafts(published_at DESC);
CREATE TABLE IF NOT EXISTS patch_delivery_targets (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 patch_id uuid NOT NULL REFERENCES patch_drafts(id) ON DELETE CASCADE,
 clerk_user_id text NOT NULL,
 status text NOT NULL DEFAULT 'pending',
 attempts integer NOT NULL DEFAULT 0,
 last_error text,
 delivered_at timestamptz,
 CONSTRAINT patch_delivery_status_check CHECK (status IN ('pending','delivered','failed','missing'))
);
CREATE UNIQUE INDEX IF NOT EXISTS patch_delivery_patch_user_unique ON patch_delivery_targets(patch_id, clerk_user_id);
CREATE INDEX IF NOT EXISTS patch_delivery_work_queue ON patch_delivery_targets(patch_id, status, clerk_user_id);
COMMIT;