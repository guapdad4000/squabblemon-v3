// Package the generated PNG originals as transparent, consistently sized web assets.
const fs = require('node:fs');
const path = require('node:path');
const sharp = require('sharp');
const root = path.resolve(__dirname, '../artifacts/squabblemon');
const names = ['safehouse', 'streets', 'collection', 'fight', 'crew', 'bounties', 'shop', 'profile'];

(async () => {
  const output = path.join(root, 'public/brand/navigation-painted');
  fs.mkdirSync(output, { recursive: true });
  for (const name of names) {
    const original = path.join(root, 'reference/navigation-painted', `${name}.png`);
    const { data, info } = await sharp(original).raw().toBuffer({ resolveWithObject: true });
    if (info.channels !== 4) throw new Error(`${name}: missing alpha`);
    let left = info.width, top = info.height, right = -1, bottom = -1, clear = 0;
    for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) {
      if (data[(y * info.width + x) * 4 + 3] > 16) {
        left = Math.min(left, x); right = Math.max(right, x);
        top = Math.min(top, y); bottom = Math.max(bottom, y);
      } else clear++;
    }
    if (right < left || clear < info.width * info.height * .05) throw new Error(`${name}: invalid transparent artwork`);
    const result = await sharp(original)
      .extract({ left, top, width: right - left + 1, height: bottom - top + 1 })
      .resize({ width: 512, height: 512, fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .webp({ quality: 88, alphaQuality: 100 })
      .toFile(path.join(output, `${name}.webp`));
    console.log(`${name}: ${result.width}x${result.height}, ${Math.round(result.size / 1024)} KB`);
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
