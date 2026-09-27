import assert from "node:assert/strict";
import test from "node:test";
import {
  checkPlayerBootstrapSchema,
  missingPlayerBootstrapSchema,
  PLAYER_BOOTSTRAP_SCHEMA_QUERY,
  requiredPlayerBootstrapColumns,
  type PlayerBootstrapSchemaRow,
} from "./profileCompatibility";

function existingRows(): PlayerBootstrapSchemaRow[] {
  return Object.entries(requiredPlayerBootstrapColumns).flatMap(([table_name, columns]) =>
    columns.map((attname) => ({ table_name, table_exists: true, attname })),
  );
}

test("preflight includes all bootstrap relations and selected columns", () => {
  assert.deepEqual(Object.keys(requiredPlayerBootstrapColumns), [
    "player_profiles", "player_missions", "player_pack_openings",
    "player_collection_claims", "player_matches",
  ]);
  assert.ok(requiredPlayerBootstrapColumns.player_profiles.includes("style_shard_balances"));
  assert.ok(requiredPlayerBootstrapColumns.player_missions.includes("reward_amount"));
  assert.ok(requiredPlayerBootstrapColumns.player_pack_openings.includes("rewards"));
  assert.deepEqual(requiredPlayerBootstrapColumns.player_collection_claims, ["clerk_user_id", "milestone_key"]);
  assert.deepEqual(requiredPlayerBootstrapColumns.player_matches,
    ["id", "clerk_user_id", "mode", "player_deck_id", "completed_at"]);
  assert.deepEqual(missingPlayerBootstrapSchema(existingRows()), { tables: [], columns: [] });
});

test("missing table is reported once, not as a list of missing columns", () => {
  const rows = existingRows().filter((row) => row.table_name !== "player_pack_openings");
  rows.push({ table_name: "player_pack_openings", table_exists: false, attname: null });
  assert.deepEqual(missingPlayerBootstrapSchema(rows), {
    tables: ["player_pack_openings"],
    columns: [],
  });
});

test("missing required column identifies its table and name", () => {
  const rows = existingRows().filter((row) =>
    !(row.table_name === "player_missions" && row.attname === "reward_amount"));
  assert.deepEqual(missingPlayerBootstrapSchema(rows), {
    tables: [],
    columns: ["player_missions.reward_amount"],
  });
});

test("preflight inspects only catalog metadata on the runtime search path", async () => {
  const missing = await checkPlayerBootstrapSchema(async (statement, values) => {
    assert.equal(statement, PLAYER_BOOTSTRAP_SCHEMA_QUERY);
    assert.match(statement, /pg_catalog\.to_regclass\(name\)/);
    assert.match(statement, /pg_catalog\.pg_attribute/);
    assert.deepEqual(values, [Object.keys(requiredPlayerBootstrapColumns)]);
    return { rows: existingRows() };
  });
  assert.deepEqual(missing, { tables: [], columns: [] });
  assert.deepEqual(await checkPlayerBootstrapSchema(async () => ({ rows: [] })), {
    tables: Object.keys(requiredPlayerBootstrapColumns),
    columns: [],
  });
});