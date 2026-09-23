CREATE TABLE IF NOT EXISTS payment_orders (
 id text PRIMARY KEY,
 clerk_user_id text NOT NULL REFERENCES player_profiles(clerk_user_id),
 idempotency_key text NOT NULL,
 offer_id text NOT NULL,
 offer_name text NOT NULL,
 catalog_version text NOT NULL,
 mode text NOT NULL CHECK (mode IN ('test','live')),
 currency text NOT NULL,
 amount_minor integer NOT NULL CHECK (amount_minor > 0),
 clout integer NOT NULL CHECK (clout > 0),
 price_id text NOT NULL,
 tax_mode text NOT NULL DEFAULT 'none' CHECK (tax_mode = 'none'),
 status text NOT NULL DEFAULT 'pending',
 session_id text,
 payment_intent_id text,
 checkout_url text,
 session_params jsonb NOT NULL,
 expires_at timestamptz NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 paid_at timestamptz,
 failed_at timestamptz,
 refunded_at timestamptz,
 disputed_at timestamptz,
 fulfilled_at timestamptz,
 refunded_amount_minor integer NOT NULL DEFAULT 0,
 disputed boolean NOT NULL DEFAULT false
);
CREATE UNIQUE INDEX IF NOT EXISTS payment_order_request_unique ON payment_orders(clerk_user_id,idempotency_key);
CREATE UNIQUE INDEX IF NOT EXISTS payment_order_session_unique ON payment_orders(session_id);
CREATE UNIQUE INDEX IF NOT EXISTS payment_order_intent_unique ON payment_orders(payment_intent_id);
CREATE INDEX IF NOT EXISTS payment_order_owner_created ON payment_orders(clerk_user_id,created_at);
CREATE TABLE IF NOT EXISTS payment_events (
 id text PRIMARY KEY,
 order_id text NOT NULL REFERENCES payment_orders(id),
 type text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS payment_fulfillments (
 order_id text PRIMARY KEY REFERENCES payment_orders(id),
 clout integer NOT NULL CHECK (clout > 0),
 created_at timestamptz NOT NULL DEFAULT now()
);