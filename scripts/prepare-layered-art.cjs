const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

// Export existing supplied artwork; retain source filenames for future art updates.
const root = path.resolve('artifacts/squabblemon/public/assets');
const source = 'E:/Downloads/openart-download (3)';
const names = ['violet-stage', 'sunset-block', 'gold-vault', 'crown-court', 'gold-alley', 'moon-rooftop', 'training-hall', 'green-underpass', 'locked-street', 'garden-court', 'civic-summit', 'motion-court', 'ice-alley', 'tidal-street', 'sunlit-hall', 'red-court', 'gold-plaza', 'old-town', 'red-alley', 'green-street', 'shadow-stairs', 'blue-arcade', 'festival-street', 'sound-stage', 'corner-store', 'morning-block'];
(async () => {
  const files = fs.readdirSync(source).filter(f => f.endsWith('.png')).sort();
  if (files.length !== names.length) throw new Error('Review the source inventory before importing a changed folder.');
  const out = path.join(root, 'layered');
  fs.mkdirSync(out, { recursive: true });
  const manifest = [];
  for (const [i, file] of files.entries()) {
    await sharp(path.join(source, file)).resize({ width: 1600, withoutEnlargement: true }).webp({ quality: 82 }).toFile(path.join(out, `${names[i]}.webp`));
    manifest.push({ name: names[i], source: file });
  }
  const atlas = path.join(root, 'a38f82bc-235c-4cda-9592-c27eba64f5b9.png');
  const crops = {
    'button-obsidian': [40, 151, 368, 100],
    'button-stone': [439, 151, 361, 100],
    'card-rim': [42, 677, 173, 281],
    'motion-medallion': [928, 38, 83, 83],
    'squabble-crest': [1076, 272, 134, 137],
  };
  for (const [name, [left, top, width, height]] of Object.entries(crops)) {
    const mask = name === 'motion-medallion'
      ? `<circle cx="41.5" cy="41.5" r="40" fill="white"/>`
      : name.startsWith('button-')
        ? `<rect x="1" y="2" width="${width - 2}" height="${height - 4}" rx="42" fill="white"/>`
        : `<path d="M 14 1 H ${width - 14} L ${width - 1} 14 V ${height - 14} L ${width - 14} ${height - 1} H 14 L 1 ${height - 14} V 14 Z" fill="white"/>`;
    await sharp(atlas).extract({ left, top, width, height }).ensureAlpha().composite([{ input: Buffer.from(`<svg width="${width}" height="${height}">${mask}</svg>`), blend: 'dest-in' }]).webp({ quality: 94 }).toFile(path.join(out, `${name}.webp`));
  }
  fs.writeFileSync(path.join(out, 'sources.json'), JSON.stringify({ environments: manifest, components: { source: path.basename(atlas), crops } }, null, 2));
  console.log(`Prepared ${names.length} environments and ${Object.keys(crops).length} illustrated components.`);
})();
