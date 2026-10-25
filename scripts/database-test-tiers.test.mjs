import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import test from "node:test";
import { nativeDatabaseTestCommands, partitionDatabaseTests } from "./database-test-tiers.mjs";

test("database tiers retain campaign and generic mail while naming every deferred native suite", () => {
  const names = readdirSync(new URL("../artifacts/api-server/src/lib/", import.meta.url));
  const { embedded, native } = partitionDatabaseTests(names);
  assert(embedded.includes("src/lib/newAccountCampaignRoutes.test.ts"));
  assert(embedded.includes("src/lib/storyMoveSolver.test.ts"));
  assert(embedded.includes("src/lib/mail.test.ts"));
  assert.equal(embedded.length + native.length, names.filter(name => name.endsWith(".test.ts")).length);
  assert.deepEqual(native.map(entry => entry.name).sort(), Object.keys(nativeDatabaseTestCommands).sort());
  for (const entry of native) {
    const [, runner, flag] = entry.command.split(" ");
    const source = readFileSync(new URL(`../${runner}`, import.meta.url), "utf8");
    assert(source.includes(entry.name), `${entry.name} must be in its dedicated runner`);
    if (flag) assert(source.includes(flag), `${flag} must be accepted by its dedicated runner`);
  }
});

test("an unregistered native suite is an error, never an implicit skip", () => {
  assert.throws(() => partitionDatabaseTests(["new-lock.native.test.ts"]), /Register an explicit native/);
  assert.deepEqual(partitionDatabaseTests(["README.md", "ordinary.test.ts"]), { embedded: ["src/lib/ordinary.test.ts"], native: [] });
});
