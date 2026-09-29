import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

// Only called with a client belonging to the disposable PostgreSQL cluster in
// test-events-feedback-database.mjs. This never discovers a database from env.
export async function verifyNativeMigrationTransactions(client, root) {
  const directory = join(root, "netlify/database/migrations");
  const migrations = readdirSync(directory).sort();
  const firstPending = migrations.indexOf("202610010005_event-feedback");
  assert.ok(firstPending > 0, "The pre-social migration baseline must be present.");
  const baseline = migrations.slice(0, firstPending);
  const pending = migrations.slice(firstPending);
  const relation = async name =>
    (await client.query("SELECT to_regclass($1)::text AS name", [name])).rows[0].name;

  async function batch(entries, { rollback = false, failAtEnd = false } = {}) {
    await client.query("BEGIN");
    const transaction = (await client.query("SELECT txid_current()::text AS id")).rows[0].id;
    try {
      for (const entry of entries) {
        await client.query(readFileSync(join(directory, entry, "migration.sql"), "utf8"));
        // node-postgres tolerates COMMIT on an idle connection. A savepoint and
        // transaction identity check expose the same escaped transaction that
        // Netlify's lib/pq runner rejects when it eventually tries to commit.
        await client.query("SAVEPOINT runner_transaction_probe");
        const current = (await client.query("SELECT txid_current()::text AS id")).rows[0].id;
        assert.equal(current, transaction, `${entry} replaced the runner transaction.`);
        await client.query("RELEASE SAVEPOINT runner_transaction_probe");
      }
      if (failAtEnd) await client.query("SELECT 1 / 0");
      await client.query(rollback ? "ROLLBACK" : "COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }
  }

  // Fresh installations must remain one transaction through all SQL files.
  await batch(migrations, { rollback: true });
  assert.equal(await relation("public.player_profiles"), null, "Fresh history escaped rollback.");
  assert.equal(await relation("public.social_identities"), null, "Social DDL escaped rollback.");

  // Reproduce an upgrade from the five migrations preceding this release.
  await batch(baseline);
  await client.query("CREATE TABLE migration_transaction_probe (id integer PRIMARY KEY, value text NOT NULL)");
  await client.query("INSERT INTO migration_transaction_probe VALUES (1, 'preserve-existing-data')");
  await client.query("INSERT INTO player_profiles (clerk_user_id, soft_currency, style_shards) VALUES ('migration_retry_probe', 1234, 17)");
  await assert.rejects(batch(pending, { failAtEnd: true }), error => error.code === "22012");
  for (const table of ["event_feedback", "social_identities", "social_relationships", "social_blocks", "social_invitations", "social_throttle"]) {
    assert.equal(await relation(`public.${table}`), null, `${table} survived a failed migration batch.`);
  }
  assert.deepEqual((await client.query("SELECT * FROM migration_transaction_probe")).rows,
    [{ id: 1, value: "preserve-existing-data" }]);
  assert.equal(await relation("public.player_profiles"), "player_profiles");

  // A retry must apply and commit normally, with the new username protection.
  await batch(pending);
  await client.query("INSERT INTO social_identities (user_id, friend_code, username) VALUES ('migration_retry_probe', 'A1B2C3D4E5F6', 'existing_player')");

  // The failed production deploy committed the objects but not its migration
  // ledger. Replaying the pending files over that schema must be nondestructive.
  await batch(pending);
  assert.deepEqual((await client.query("SELECT friend_code, username FROM social_identities WHERE user_id = 'migration_retry_probe'")).rows,
    [{ friend_code: "A1B2C3D4E5F6", username: "existing_player" }]);
  assert.deepEqual((await client.query("SELECT soft_currency, style_shards FROM player_profiles WHERE clerk_user_id = 'migration_retry_probe'")).rows,
    [{ soft_currency: 1234, style_shards: 17 }]);
  const columns = await client.query("SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'social_identities' AND column_name = 'username'");
  assert.equal(columns.rowCount, 1);
  const constraints = await client.query("SELECT conname FROM pg_constraint WHERE conrelid = 'social_identities'::regclass AND conname IN ('social_username_format', 'social_username_reserved')");
  assert.equal(constraints.rowCount, 2);
  assert.equal(await relation("public.social_username_unique"), "social_username_unique");
  assert.deepEqual((await client.query("SELECT * FROM migration_transaction_probe")).rows,
    [{ id: 1, value: "preserve-existing-data" }]);
  for (const invalid of ["UpperCase!", "admin"]) {
    await assert.rejects(client.query("UPDATE social_identities SET username = $1 WHERE user_id = 'migration_retry_probe'", [invalid]),
      error => error.code === "23514");
  }
  await client.query("DELETE FROM player_profiles WHERE clerk_user_id = 'migration_retry_probe'");
  await client.query("DROP TABLE migration_transaction_probe");
  console.info(`Native transaction checks passed: ${migrations.length} fresh migrations, ${pending.length} upgrade migrations, rollback, retry, and partial-commit recovery preserving balances and identities.`);
}