import { build } from "esbuild";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const output = path.join(
  root,
  "artifacts/gameplay-test-db/online-browser-host.mjs",
);
await build({
  absWorkingDir: root,
  entryPoints: ["artifacts/squabblemon/e2e/online-server.ts"],
  outfile: output,
  bundle: true,
  platform: "node",
  format: "esm",
  packages: "external",
  alias: {
    "@workspace/db": path.join(root, "lib/db/src/index.ts"),
    "@workspace/squabblemon-engine": path.join(
      root,
      "lib/squabblemon-engine/src",
    ),
    "@workspace/api-zod": path.join(root, "lib/api-zod/src/index.ts"),
  },
});
await import(pathToFileURL(output).href);
