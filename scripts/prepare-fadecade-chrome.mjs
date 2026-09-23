import { readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const sharp = createRequire(new URL('../artifacts/squabblemon/package.json', import.meta.url))('sharp');
const root = fileURLToPath(new URL('../', import.meta.url));
const output = path.join(root, 'artifacts/squabblemon/public/assets/fadecade');
const upload = time => path.join(root, `attached_assets/ChatGPT_Image_Sep_23,_2026,_${time}_AM_1790164765069.png`);
const geometry = {};
const manifest = JSON.parse(await readFile(path.join(output, 'manifest.json'), 'utf8'));

// These uploads already have real alpha. Preserve all black ink and yellow
// lettering surfaces; remove only faint alpha fringe, then trim empty margins.
async function prepare(filename, input, crop, textArea) {
  const source = crop ? sharp(input).extract(crop) : sharp(input);
  const { data, info } = await source.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let left = info.width, right = -1, top = info.height, bottom = -1;
  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < info.width; x++) {
      const index = (y * info.width + x) * 4;
      const alpha = data[index + 3];
      if (alpha <= 8) data[index + 3] = 0;
      else if (alpha >= 250) data[index + 3] = 255;
      if (alpha > 20) {
        left = Math.min(left, x); right = Math.max(right, x);
        top = Math.min(top, y); bottom = Math.max(bottom, y);
      }
    }
  }
  if (right < left) throw new Error(`No visible artwork in ${filename}`);
  left = Math.max(0, left - 2); top = Math.max(0, top - 2);
  right = Math.min(info.width - 1, right + 2); bottom = Math.min(info.height - 1, bottom + 2);
  const result = await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } })
    .extract({ left, top, width: right - left + 1, height: bottom - top + 1 })
    .webp({ quality: 93, alphaQuality: 100, effort: 6 })
    .toFile(path.join(output, filename));
  const size = { width: result.width, height: result.height };
  manifest.images[filename] = size;
  geometry[filename] = { ...size, textArea };
}

const sheet = await sharp(upload('04_55_11')).metadata();
if (!sheet.width || !sheet.height || sheet.width % 2) throw new Error('Side-flag sheet must contain two equal columns.');
const half = sheet.width / 2;
await prepare('flag-left.webp', upload('04_55_11'), { left: 0, top: 0, width: half, height: sheet.height },
  { x: 26, y: 32, width: 52, height: 35 });
await prepare('flag-right.webp', upload('04_55_11'), { left: half, top: 0, width: half, height: sheet.height },
  { x: 22, y: 32, width: 52, height: 35 });
await prepare('stats-banner.webp', upload('04_59_09'), null,
  { x: 27, y: 29, width: 46, height: 36 });
await prepare('footer-banner.webp', upload('04_58_10'), null,
  { x: 23, y: 34, width: 54, height: 32 });
await writeFile(path.join(root, 'artifacts/squabblemon/src/lib/fadecadeChrome.json'), `${JSON.stringify(geometry, null, 2)}\n`);
await writeFile(path.join(output, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(JSON.stringify(geometry, null, 2));