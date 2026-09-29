import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";

const runner = fileURLToPath(new URL("./test-payments-database.mjs", import.meta.url));

// No inherited credentials, and no PostgreSQL tools on PATH. Refusal must happen
// before cluster discovery, network access, schema creation, or fixture writes.
for (const [name, value] of [
  ["remote", "postgresql://fixture:never-print-this@production.invalid/database"],
  ["loopback", "postgresql://fixture:never-print-this@127.0.0.1:5432/database"],
  ["empty", ""],
  ["whitespace", "   "],
]) {
  test(`Homies load refuses a caller-supplied ${name} database URL`, () => {
    const result = spawnSync(process.execPath, [runner, "--social-load"], {
      env: { PATH: "/no-postgres-tools", DATABASE_URL: value },
      encoding: "utf8",
      timeout: 5_000,
    });
    assert.ifError(result.error);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /fresh owned cluster\. Unset DATABASE_URL/);
    assert.doesNotMatch(result.stdout + result.stderr, /never-print-this|production\.invalid/);
    assert.doesNotMatch(result.stdout, /Using fresh|Saved/);
  });
}

test("Homies load cannot be combined with another database test mode", () => {
  for (const mode of ["--social", "--social-browser", "--mail"]) {
    const result = spawnSync(process.execPath, [runner, "--social-load", mode], {
      env: { PATH: "/no-postgres-tools" },
      encoding: "utf8",
      timeout: 5_000,
    });
    assert.ifError(result.error);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /cannot be combined/);
  }
});