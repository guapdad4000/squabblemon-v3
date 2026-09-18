import { build } from "esbuild";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

// Bundling lets the verification use the live workspace sources even when local
// Windows package links are copies. Runtime service dependencies stay external.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const entries = process.argv.slice(2);
if (!entries.length)
  entries.push(
    "artifacts/squabblemon/src/multiplayer.test.ts",
    "artifacts/api-server/src/lib/onlineMatches.test.ts",
  );
const outputs = [];
for (const [index, entry] of entries.entries()) {
  const output = path.join(
    root,
    "artifacts/gameplay-test-db",
    `online-check-${index}.mjs`,
  );
  await build({
    absWorkingDir: root,
    entryPoints: [entry],
    outfile: output,
    bundle: true,
    platform: "node",
    format: "esm",
    packages: "external",
    define: {
      "import.meta.url": JSON.stringify(
        pathToFileURL(path.resolve(root, entry)).href,
      ),
    },
    alias: {
      "@workspace/db": path.join(root, "lib/db/src/index.ts"),
      "@workspace/api-zod": path.join(root, "lib/api-zod/src/index.ts"),
      "@workspace/squabblemon-engine": path.join(
        root,
        "lib/squabblemon-engine/src",
      ),
    },
  });
  outputs.push(output);
}
const result = spawnSync(process.execPath, ["--test", ...outputs], {
  cwd: path.join(root, "artifacts/squabblemon"),
  env: process.env,
  stdio: "inherit",
});
process.exitCode = result.status ?? 1;
