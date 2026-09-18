CREATE TABLE "player_profiles" (
	"clerk_user_id" text PRIMARY KEY NOT NULL,
	"display_name" text DEFAULT 'New Challenger' NOT NULL,
	"avatar_key" text DEFAULT 'rastamon' NOT NULL,
	"onboarding_step" text DEFAULT 'profile' NOT NULL,
	"starter_deck_id" text,
	"street_rep" integer DEFAULT 0 NOT NULL,
	"xp" integer DEFAULT 0 NOT NULL,
	"level" integer DEFAULT 1 NOT NULL,
	"soft_currency" integer DEFAULT 0 NOT NULL,
	"pack_tickets" integer DEFAULT 0 NOT NULL,
	"style_shards" integer DEFAULT 0 NOT NULL,
	"pack_pity" integer DEFAULT 0 NOT NULL,
	"deck_slots" integer DEFAULT 4 NOT NULL,
	"cosmetic_currency" integer DEFAULT 0 NOT NULL,
	"collection_progress" integer DEFAULT 0 NOT NULL,
	"story_chapter" integer DEFAULT 1 NOT NULL,
	"story_node" integer DEFAULT 0 NOT NULL,
	"tutorial_completed" boolean DEFAULT false NOT NULL,
	"starter_reward_claimed" boolean DEFAULT false NOT NULL,
	"age_confirmed_at" timestamp with time zone,
	"terms_accepted_at" timestamp with time zone,
	"settings" jsonb DEFAULT '{"reducedMotion":false,"turnTimerEnabled":true}'::jsonb NOT NULL,
	"owned_card_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"card_progression" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"discovered_card_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"owned_variants" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"equipped_variants" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"unlocked_cosmetic_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"unlocked_character_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"saved_decks" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"story_progress" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"inbox" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"pack_history" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_active_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "player_missions" (
	"id" serial PRIMARY KEY NOT NULL,
	"clerk_user_id" text NOT NULL,
	"mission_key" text NOT NULL,
	"cadence" text NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"progress" integer DEFAULT 0 NOT NULL,
	"goal" integer NOT NULL,
	"reward_currency" text NOT NULL,
	"reward_amount" integer NOT NULL,
	"claimed_at" timestamp with time zone,
	"reset_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "player_matches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clerk_user_id" text NOT NULL,
	"mode" text NOT NULL,
	"player_deck_id" text NOT NULL,
	"rival_deck_id" text NOT NULL,
	"story_node_id" text,
	"story_content_version" integer,
	"story_encounter_snapshot" jsonb,
	"story_progression_snapshot" jsonb,
	"player_engine_card_ids" jsonb,
	"player_card_progression_snapshot" jsonb,
	"card_xp_rewards" jsonb,
	"story_first_clear" boolean,
	"story_stars" integer,
	"story_boss_highest_phase" integer,
	"story_granted_rewards" jsonb,
	"outcome" text,
	"rounds" integer,
	"districts_won" integer,
	"reward_xp" integer,
	"reward_street_rep" integer,
	"reward_soft_currency" integer,
	"reward_pack_tickets" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "player_pack_openings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clerk_user_id" text NOT NULL,
	"idempotency_key" text NOT NULL,
	"odds_version" text NOT NULL,
	"payment_method" text NOT NULL,
	"cost" integer NOT NULL,
	"rewards" jsonb NOT NULL,
	"pity_before" integer NOT NULL,
	"pity_after" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "player_collection_claims" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clerk_user_id" text NOT NULL,
	"milestone_key" text NOT NULL,
	"reward" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "player_story_actions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clerk_user_id" text NOT NULL,
	"idempotency_key" text NOT NULL,
	"node_id" text NOT NULL,
	"action_kind" text NOT NULL,
	"request_fingerprint" text NOT NULL,
	"payload" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "player_story_actions_user_key_unique" UNIQUE("clerk_user_id","idempotency_key")
);
--> statement-breakpoint
CREATE TABLE "player_story_nodes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clerk_user_id" text NOT NULL,
	"chapter_id" text NOT NULL,
	"node_id" text NOT NULL,
	"cleared" boolean DEFAULT false NOT NULL,
	"stars" integer DEFAULT 0 NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"wins" integer DEFAULT 0 NOT NULL,
	"last_outcome" text,
	"dialogue_seen" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"boss_progress" jsonb DEFAULT '{"highestPhase":0}'::jsonb NOT NULL,
	"first_cleared_at" timestamp with time zone,
	"last_played_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "player_story_nodes_user_node_unique" UNIQUE("clerk_user_id","node_id"),
	CONSTRAINT "player_story_nodes_stars_range" CHECK ("player_story_nodes"."stars" between 0 and 3),
	CONSTRAINT "player_story_nodes_attempts_nonnegative" CHECK ("player_story_nodes"."attempts" >= 0),
	CONSTRAINT "player_story_nodes_wins_nonnegative" CHECK ("player_story_nodes"."wins" >= 0)
);
--> statement-breakpoint
CREATE TABLE "player_story_reward_claims" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clerk_user_id" text NOT NULL,
	"chapter_id" text NOT NULL,
	"node_id" text NOT NULL,
	"reward_key" text NOT NULL,
	"reward" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "player_story_reward_claims_user_reward_unique" UNIQUE("clerk_user_id","reward_key")
);
--> statement-breakpoint
CREATE TABLE "online_commands" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"room_id" uuid NOT NULL,
	"revision" integer NOT NULL,
	"user_id" text NOT NULL,
	"request_id" uuid NOT NULL,
	"command" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "online_rooms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"host_user_id" text NOT NULL,
	"guest_user_id" text,
	"create_request_id" uuid NOT NULL,
	"state" jsonb NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "online_rooms_code_unique" UNIQUE("code")
);
--> statement-breakpoint
ALTER TABLE "player_missions" ADD CONSTRAINT "player_missions_clerk_user_id_player_profiles_clerk_user_id_fk" FOREIGN KEY ("clerk_user_id") REFERENCES "public"."player_profiles"("clerk_user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "player_matches" ADD CONSTRAINT "player_matches_clerk_user_id_player_profiles_clerk_user_id_fk" FOREIGN KEY ("clerk_user_id") REFERENCES "public"."player_profiles"("clerk_user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "player_pack_openings" ADD CONSTRAINT "player_pack_openings_clerk_user_id_player_profiles_clerk_user_id_fk" FOREIGN KEY ("clerk_user_id") REFERENCES "public"."player_profiles"("clerk_user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "player_collection_claims" ADD CONSTRAINT "player_collection_claims_clerk_user_id_player_profiles_clerk_user_id_fk" FOREIGN KEY ("clerk_user_id") REFERENCES "public"."player_profiles"("clerk_user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "player_story_actions" ADD CONSTRAINT "player_story_actions_clerk_user_id_player_profiles_clerk_user_id_fk" FOREIGN KEY ("clerk_user_id") REFERENCES "public"."player_profiles"("clerk_user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "player_story_nodes" ADD CONSTRAINT "player_story_nodes_clerk_user_id_player_profiles_clerk_user_id_fk" FOREIGN KEY ("clerk_user_id") REFERENCES "public"."player_profiles"("clerk_user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "player_story_reward_claims" ADD CONSTRAINT "player_story_reward_claims_clerk_user_id_player_profiles_clerk_user_id_fk" FOREIGN KEY ("clerk_user_id") REFERENCES "public"."player_profiles"("clerk_user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "online_commands" ADD CONSTRAINT "online_commands_room_id_online_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."online_rooms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "online_rooms" ADD CONSTRAINT "online_rooms_host_user_id_player_profiles_clerk_user_id_fk" FOREIGN KEY ("host_user_id") REFERENCES "public"."player_profiles"("clerk_user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "online_rooms" ADD CONSTRAINT "online_rooms_guest_user_id_player_profiles_clerk_user_id_fk" FOREIGN KEY ("guest_user_id") REFERENCES "public"."player_profiles"("clerk_user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "player_missions_user_key_unique" ON "player_missions" USING btree ("clerk_user_id","mission_key");--> statement-breakpoint
CREATE UNIQUE INDEX "player_pack_openings_user_key_unique" ON "player_pack_openings" USING btree ("clerk_user_id","idempotency_key");--> statement-breakpoint
CREATE INDEX "player_pack_openings_user_created_idx" ON "player_pack_openings" USING btree ("clerk_user_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "player_collection_claims_user_milestone_unique" ON "player_collection_claims" USING btree ("clerk_user_id","milestone_key");--> statement-breakpoint
CREATE UNIQUE INDEX "online_commands_request_once" ON "online_commands" USING btree ("room_id","user_id","request_id");--> statement-breakpoint
CREATE UNIQUE INDEX "online_commands_revision" ON "online_commands" USING btree ("room_id","revision");--> statement-breakpoint
CREATE UNIQUE INDEX "online_rooms_create_once" ON "online_rooms" USING btree ("host_user_id","create_request_id");--> statement-breakpoint
CREATE INDEX "online_rooms_host" ON "online_rooms" USING btree ("host_user_id");--> statement-breakpoint
CREATE INDEX "online_rooms_guest" ON "online_rooms" USING btree ("guest_user_id");