// Native suites need independent connections or their own migration/ownership setup.
// Every deferred suite has an explicit maintained command; additions fail closed.
export const nativeDatabaseTestCommands = Object.freeze({
  "kumiteExpansion.native.test.ts": "node scripts/test-kumite-expansion-database.mjs",
  "social.test.ts": "node scripts/test-payments-database.mjs --social",
  "homiesDiagnostics.native.test.ts": "node scripts/test-payments-database.mjs --social",
  "patches.test.ts": "node scripts/test-events-feedback-database.mjs",
  "eventFeedback.test.ts": "node scripts/test-events-feedback-database.mjs",
  "rankedMatchClout.test.ts": "node scripts/test-payments-database.mjs --ranked-clout",
  "flexPulls.test.ts": "node scripts/test-payments-database.mjs --flex-pulls",
  "onlineRetirement.native.test.ts": "node scripts/test-payments-database.mjs --online-retirement",
  "onlinePolling.native.test.ts": "node scripts/test-payments-database.mjs --online-retirement",
  "onlineRoomRetention.native.test.ts": "node scripts/test-payments-database.mjs --online-retirement",
});

export function partitionDatabaseTests(names) {
  const embedded = [];
  const native = [];
  for (const name of names.filter(name => name.endsWith(".test.ts")).sort()) {
    const command = nativeDatabaseTestCommands[name];
    if (command) native.push({ name, command });
    else if (name.endsWith(".native.test.ts")) throw new Error(`Register an explicit native database command for ${name}.`);
    else embedded.push(`src/lib/${name}`);
  }
  return { embedded, native };
}
