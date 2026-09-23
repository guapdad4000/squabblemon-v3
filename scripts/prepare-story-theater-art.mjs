import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const require = createRequire(new URL("../artifacts/squabblemon/package.json", import.meta.url));
const sharp = require("sharp");
const sourceRoot = path.resolve("attached_assets/generated_images");
const outputRoot = path.resolve("artifacts/squabblemon/public/assets/story/theater");
const sources = [
  ["story-theater-master.png", "theater.webp", 1600],
  ["story-curtain-cutout.png", "curtain-left.webp", 700],
  ["story-curtain-cutout.png", "curtain-right.webp", 700],
  ["story-season-one-poster.png", "season-one.webp", 800],
  ["story-season-two-poster.png", "season-two.webp", 800],
  ["story-sherlock-poster.png", "sherlock.webp", 800],
  ["story-rooftop-morning.png", "rooftop.webp", 1600],
  ["story-evidence-board.png", "evidence.webp", 1200],
];

await mkdir(outputRoot, { recursive: true });
const manifest = [];
for (const [source, output, width] of sources) {
  let image = sharp(path.join(sourceRoot, source));
  if (output === "curtain-right.webp") image = image.flop();
  if (output.startsWith("curtain-")) image = image.trim({ threshold: 10 });
  const result = await image.resize({ width, withoutEnlargement: true }).webp({ quality: 83, alphaQuality: 90 })
    .toFile(path.join(outputRoot, output));
  manifest.push({ source, output, width: result.width, height: result.height, bytes: result.size });
}
await writeFile(path.join(outputRoot, "manifest.json"), JSON.stringify({
  description: "Original generated, text-free story artwork. Live labels remain accessible HTML.",
  assets: manifest,
}, null, 2) + "\n");
console.log(JSON.stringify(manifest, null, 2));