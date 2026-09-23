import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const require = createRequire(new URL('../artifacts/squabblemon/package.json', import.meta.url));
const sharp = require('sharp');
const outputRoot = path.resolve('artifacts/squabblemon/public/assets/story/theater');
const sources = [
  ['ChatGPT_Image_Sep_22,_2026,_09_08_04_PM_1790136544907.png', 'cinema-curtain.webp', 620],
  ['ChatGPT_Image_Sep_22,_2026,_09_04_39_PM_1790136544907.png', 'cinema-film-strip.webp', 1440],
  ['f870a746-3124-48bd-8512-21a3f7411dcf_1790136544907.png', 'cinema-reel.webp', 760],
  ['ChatGPT_Image_Sep_22,_2026,_08_53_35_PM_1790136544907.png', 'cinema-logo.webp', 1200],
];

await mkdir(outputRoot, { recursive: true });
const assets = [];
for (const [source, output, width] of sources) {
  const input = path.resolve('attached_assets', source);
  const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let left = info.width, top = info.height, right = 0, bottom = 0;
  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < info.width; x++) {
      if (data[(y * info.width + x) * 4 + 3] <= 4) continue;
      left = Math.min(left, x); right = Math.max(right, x);
      top = Math.min(top, y); bottom = Math.max(bottom, y);
    }
  }
  const result = await sharp(input)
    .extract({ left, top, width: right - left + 1, height: bottom - top + 1 })
    .resize({ width, withoutEnlargement: true })
    .webp({ quality: 90, alphaQuality: 100 })
    .toFile(path.join(outputRoot, output));
  assets.push({ source, output, width: result.width, height: result.height, bytes: result.size });
}
await writeFile(path.join(outputRoot, 'cinema-decor-manifest.json'), JSON.stringify({
  description: 'User-supplied transparent cinema artwork, alpha-trimmed without distorting proportions.',
  assets,
}, null, 2) + '\n');
console.log(JSON.stringify(assets, null, 2));