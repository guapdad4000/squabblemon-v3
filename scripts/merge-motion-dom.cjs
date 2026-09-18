// One-off merge for the motion-dom package. The on-disk install was
// truncated by Windows file-locking during pnpm install; we downloaded the
// matching tarball from the registry and re-hydrate the directory.
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const root = path.resolve(__dirname, "..");
const target = path.join(root, "node_modules", "motion-dom");
const tmpTar = path.join(process.env.TEMP, "motion-dom.tgz");
const tmpExtract = path.join(process.env.TEMP, "motion-dom-pkg", "package");

if (!fs.existsSync(target)) {
  console.error("motion-dom not present at", target);
  process.exit(1);
}

if (!fs.existsSync(tmpExtract)) {
  console.error("missing extracted tarball at", tmpExtract);
  process.exit(1);
}

function copyRecursive(src, dest) {
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
    for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
      copyRecursive(path.join(src, entry.name), path.join(dest, entry.name));
    }
  } else if (stat.isFile()) {
    fs.copyFileSync(src, dest);
  }
}

// Replace the broken on-disk install with the freshly extracted tarball.
fs.rmSync(target, { recursive: true, force: true });
fs.mkdirSync(target, { recursive: true });
copyRecursive(tmpExtract, target);
console.log("rehydrated motion-dom at", target);
