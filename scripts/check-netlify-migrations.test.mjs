import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { checkNetlifyMigrationCoverage } from './check-netlify-migrations.mjs';

function fixture(t) {
  const root = mkdtempSync(path.join(os.tmpdir(), 'native-migration-coverage-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  for (const directory of ['lib/db/migrations', 'lib/db/src/schema', 'netlify/database/migrations']) {
    mkdirSync(path.dirname(path.join(root, directory)), { recursive: true });
    cpSync(path.join(process.cwd(), directory), path.join(root, directory), { recursive: true });
  }
  return root;
}

test('current native history covers development SQL, schema, and consolidated online-room baseline', () => {
  assert.equal(checkNetlifyMigrationCoverage().tables, 17);
});

test('social tables and active invitation uniqueness require native migration coverage', t => {
  const root = fixture(t);
  const file = path.join(root, 'netlify/database/migrations/202610020001_social/migration.sql');
  writeFileSync(file, readFileSync(file, 'utf8').replace(/CREATE UNIQUE INDEX IF NOT EXISTS social_invite_active_pair[^;]+;/, ''));
  assert.throws(() => checkNetlifyMigrationCoverage(root), /social_invite_active_pair/);
});

test('existing targeted room reservation backfill requires native coverage', t => {
  const root = fixture(t);
  const file = path.join(root, 'netlify/database/migrations/202610020001_social/migration.sql');
  writeFileSync(file, readFileSync(file, 'utf8').replace(/UPDATE online_rooms SET invite_only[^;]+;/, ''));
  assert.throws(() => checkNetlifyMigrationCoverage(root), /social reservation backfill/);
});

test('omitting a required table from native history blocks release', t => {
  const root = fixture(t);
  rmSync(path.join(root, 'netlify/database/migrations/202610010003_challenge-road'), { recursive: true });
  assert.throws(() => checkNetlifyMigrationCoverage(root), /table challenge_runs/);
});

test('omitting an added column from native history blocks release', t => {
  const root = fixture(t);
  const file = path.join(root, 'netlify/database/migrations/202610010003_challenge-road/migration.sql');
  writeFileSync(file, readFileSync(file, 'utf8').replace(
    'ALTER TABLE player_matches ADD COLUMN IF NOT EXISTS challenge_run_id uuid REFERENCES challenge_runs(id);',
    ''
  ));
  assert.throws(() => checkNetlifyMigrationCoverage(root), /column player_matches\.challenge_run_id/);
});

test('new development SQL and schema columns also require native DDL', t => {
  const root = fixture(t);
  writeFileSync(path.join(root, 'lib/db/migrations/20261002_new_feature.sql'),
    'CREATE TABLE new_feature (id uuid PRIMARY KEY, state text NOT NULL);\nALTER TABLE player_profiles ADD COLUMN new_feature_enabled boolean;');
  assert.throws(() => checkNetlifyMigrationCoverage(root), error =>
    /table new_feature/.test(error.message) && /column player_profiles\.new_feature_enabled/.test(error.message));

  rmSync(path.join(root, 'lib/db/migrations/20261002_new_feature.sql'));
  const schema = path.join(root, 'lib/db/src/schema/playerProfiles.ts');
  writeFileSync(schema, readFileSync(schema, 'utf8').replace(
    'clerkUserId: text("clerk_user_id").primaryKey(),',
    'clerkUserId: text("clerk_user_id").primaryKey(),\n  newFeatureEnabled: boolean("new_feature_enabled"),'
  ));
  assert.throws(() => checkNetlifyMigrationCoverage(root), /column player_profiles\.new_feature_enabled/);
});

test('missing uniqueness protection blocks release', t => {
  const root = fixture(t);
  const file = path.join(root, 'netlify/database/migrations/202610010003_challenge-road/migration.sql');
  writeFileSync(file, readFileSync(file, 'utf8').replace(
    /CREATE UNIQUE INDEX IF NOT EXISTS challenge_runs_one_active_user[^;]+;/, ''
  ));
  assert.throws(() => checkNetlifyMigrationCoverage(root), /index challenge_runs_one_active_user/);
});

test('index-only and constraint-only development migrations require native coverage', t => {
  const root = fixture(t);
  const file = path.join(root, 'lib/db/migrations/20261002_guards.sql');
  writeFileSync(file, 'CREATE UNIQUE INDEX IF NOT EXISTS player_profiles_display_unique ON player_profiles(display_name);');
  assert.throws(() => checkNetlifyMigrationCoverage(root), /index player_profiles_display_unique/);
  writeFileSync(file, 'ALTER TABLE player_profiles ADD CONSTRAINT player_profiles_level_positive CHECK (level > 0);');
  assert.throws(() => checkNetlifyMigrationCoverage(root), /constraint player_profiles\.player_profiles_level_positive/);
});

test('a native column with an incompatible type or missing required nullability fails', t => {
  const root = fixture(t);
  const file = path.join(root, 'netlify/database/migrations/202610010003_challenge-road/migration.sql');
  writeFileSync(file, readFileSync(file, 'utf8').replace('seed integer NOT NULL', 'seed text'));
  assert.throws(() => checkNetlifyMigrationCoverage(root), /column definition challenge_runs\.seed/);
});

test('changed defaults and omitted index removals block release', t => {
  const root = fixture(t);
  const file = path.join(root, 'netlify/database/migrations/202610010003_challenge-road/migration.sql');
  const original = readFileSync(file, 'utf8');
  writeFileSync(file, original.replace("status text NOT NULL DEFAULT 'active'", "status text NOT NULL DEFAULT 'done'"));
  assert.throws(() => checkNetlifyMigrationCoverage(root), /column definition challenge_runs\.status/);
  writeFileSync(file, original.replace('DROP INDEX IF EXISTS challenge_runs_bound_match;', ''));
  assert.throws(() => checkNetlifyMigrationCoverage(root), /drop index challenge_runs_bound_match/);
});

test('unknown development ALTER statements fail closed', t => {
  const root = fixture(t);
  writeFileSync(path.join(root, 'lib/db/migrations/20261002_type.sql'),
    'ALTER TABLE player_profiles ALTER COLUMN level TYPE text;');
  assert.throws(() => checkNetlifyMigrationCoverage(root), /Unsupported development ALTER TABLE/);
});

const feedbackMigration = 'netlify/database/migrations/202610010005_event-feedback/migration.sql';

test('shared Events feedback needs its native table and per-author retry uniqueness', t => {
  const root = fixture(t);
  const file = path.join(root, feedbackMigration);
  const original = readFileSync(file, 'utf8');
  writeFileSync(file, original.replace(
    /CREATE UNIQUE INDEX IF NOT EXISTS event_feedback_author_retry_unique[^;]+;/, ''
  ));
  assert.throws(() => checkNetlifyMigrationCoverage(root), /index event_feedback_author_retry_unique/);
  writeFileSync(file, '');
  assert.throws(() => checkNetlifyMigrationCoverage(root), /table event_feedback/);
});

test('feedback category and bounded-message checks inside CREATE TABLE cannot be omitted or weakened', t => {
  const root = fixture(t);
  const file = path.join(root, feedbackMigration);
  const original = readFileSync(file, 'utf8');
  writeFileSync(file, original.replace(/^.*CONSTRAINT event_feedback_message_check.*\n/m, ''));
  assert.throws(() => checkNetlifyMigrationCoverage(root), /constraint event_feedback.event_feedback_message_check/);
  writeFileSync(file, original.replace("category IN ('bug', 'suggestion', 'general')", "category IN ('bug', 'suggestion', 'general', 'other')"));
  assert.throws(() => checkNetlifyMigrationCoverage(root), /constraint event_feedback.event_feedback_category_check/);
});

test('feedback keyset pagination requires matching millisecond timestamp precision', t => {
  const root = fixture(t);
  const file = path.join(root, feedbackMigration);
  const original = readFileSync(file, 'utf8');
  writeFileSync(file, original.replace('timestamptz(3)', 'timestamptz'));
  assert.throws(() => checkNetlifyMigrationCoverage(root), /column definition event_feedback.created_at/);
  writeFileSync(file, original.replace('timestamptz(3)', 'timestamp(3) with time zone'));
  assert.doesNotThrow(() => checkNetlifyMigrationCoverage(root));
});

test('feedback listing and account-limit indexes require matching ordering', t => {
  const root = fixture(t);
  const file = path.join(root, feedbackMigration);
  const original = readFileSync(file, 'utf8');
  writeFileSync(file, original.replace('event_feedback(created_at DESC, id DESC)', 'event_feedback(created_at ASC, id DESC)'));
  assert.throws(() => checkNetlifyMigrationCoverage(root), /index event_feedback_feed_order/);
  writeFileSync(file, original.replace(/CREATE INDEX IF NOT EXISTS event_feedback_author_time[^;]+;/, ''));
  assert.throws(() => checkNetlifyMigrationCoverage(root), /index event_feedback_author_time/);
});