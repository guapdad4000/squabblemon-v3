// Helper to seed workspace package copies into the consumer node_modules.
// Mirrors what pnpm would do via its virtual store when the install is
// blocked by file locks or filesystem quirks.
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");

const consumers = [
  path.join(root, "artifacts", "api-server", "node_modules", "@workspace"),
  path.join(root, "artifacts", "squabblemon", "node_modules", "@workspace"),
];

const links = [
  ["db", path.join(root, "lib", "db")],
  ["api-zod", path.join(root, "lib", "api-zod")],
  ["api-client-react", path.join(root, "lib", "api-client-react")],
  ["squabblemon-engine", path.join(root, "lib", "squabblemon-engine")],
];

function copyRecursive(src, dest) {
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
    for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
      // Skip nested node_modules and TS build info; they would explode the copy.
      if (entry.name === "node_modules" || entry.name === "tsconfig.tsbuildinfo") continue;
      copyRecursive(path.join(src, entry.name), path.join(dest, entry.name));
    }
  } else if (stat.isFile()) {
    fs.copyFileSync(src, dest);
  }
}

for (const targetBase of consumers) {
  fs.mkdirSync(targetBase, { recursive: true });
  for (const [name, src] of links) {
    const dest = path.join(targetBase, name);
    if (fs.existsSync(dest)) {
      fs.rmSync(dest, { recursive: true, force: true });
    }
    copyRecursive(src, dest);
    console.log(`linked ${name} -> ${dest}`);
  }
}

