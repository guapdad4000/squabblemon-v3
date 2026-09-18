// Restore the rollup native binary that got deleted by Windows file
// locking during pnpm install. Re-extracts the matching tarball from npm.
const fs = require("fs");
const path = require("path");
const os = require("os");

const src = path.join(os.tmpdir(), "rollup-pkg", "package");
const dest = path.join(__dirname, "..", "node_modules", "@rollup", "rollup-win32-x64-msvc");

if (!fs.existsSync(src)) {
  console.error("missing tarball extract at", src);
  process.exit(1);
}

fs.rmSync(dest, { recursive: true, force: true });
fs.mkdirSync(dest, { recursive: true });
for (const entry of fs.readdirSync(src)) {
  fs.copyFileSync(path.join(src, entry), path.join(dest, entry));
}
console.log("restored rollup native to", dest);
