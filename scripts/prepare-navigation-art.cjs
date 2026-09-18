const fs = require('node:fs');
const path = require('node:path');
const sharp = require('sharp');
const root = path.resolve(__dirname, '../artifacts/squabblemon');
const assets = require('../artifacts/squabblemon/reference/navigation-assets.json');
const output = path.join(root, 'public/brand/navigation');
const originals = path.join(root, 'reference/navigation-originals');
fs.mkdirSync(output, { recursive: true });
fs.mkdirSync(originals, { recursive: true });
(async () => {
  for (const { name, source } of assets) {
    const original = path.join(originals, `${name}.png`);
    if (!fs.existsSync(original)) fs.copyFileSync(source, original);
    const { data, info } = await sharp(original).raw().toBuffer({ resolveWithObject: true });
    if (info.channels !== 4) throw new Error(`${name}: missing alpha`);
    let left = info.width, top = info.height, right = 0, bottom = 0, clear = 0;
    for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) {
      if (data[(y * info.width + x) * 4 + 3] > 16) {
        left = Math.min(left, x); right = Math.max(right, x);
        top = Math.min(top, y); bottom = Math.max(bottom, y);
      } else clear++;
    }
    if (clear < info.width * info.height * .05) throw new Error(`${name}: background is not transparent`);
    const result = await sharp(original).extract({ left, top, width: right - left + 1, height: bottom - top + 1 })
      .resize({ width: 512, height: 640, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 86, alphaQuality: 100 }).toFile(path.join(output, `${name}.webp`));
    console.log(`${name}: ${result.width}x${result.height}, ${Math.round(result.size / 1024)} KB`);
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
