import assert from 'node:assert/strict';
import { stat, writeFile } from 'node:fs/promises';
import sharp from 'sharp';

// Keep the source masters. No resizing, palette reduction, or lossy encoding.
const sources = [
  'src/assets/collection-sunset-standoff.png',
  'public/brand/navigation/squabble-express.png',
  'public/brand/navigation/squabble-express-map.png',
  'public/brand/navigation/back-arrow.png',
  'public/scenes/safehouse/concept.png',
  'public/assets/characters/the-mailman-delivery.png',
  'public/assets/characters/the-mailman-chibi.png',
  'public/assets/market/thank-you-fade-again-bag.png',
  'public/assets/e71f5189-861e-418d-8237-fa20713b9122.png',
  'public/assets/fade-park/park.png',
  'public/assets/fade-park/search-versus.png',
  'public/assets/progression/brick.png',
  'public/assets/progression/gang-wall.png',
  'public/assets/progression/graffiti-paint-v2.png',
  'public/assets/progression/hall-wallpaper.png',
  'public/assets/progression/hall-of-hands.png',
  'public/assets/NEW_ASSETS_ADDED/squabblemon_battle_fx_asset_sheet.png',
  'public/assets/selection/underpass.png',
  'public/assets/selection/dossier.png',
  'public/assets/training/dr-fade-coach.png',
  'public/assets/fade-alley/night.png',
  'public/assets/fade-alley/fade-alley-logo.png',
  'public/assets/fade-alley/add-homie-paper.png',
  'public/assets/fade-alley/street-sentinel-still.png',
];
const report = [];
for (const source of sources) {
  const output = source.replace(/\.png$/, '.webp');
  await sharp(source).keepIccProfile().webp({ lossless: true, effort: 6 }).toFile(output);
  const before = await sharp(source).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const after = await sharp(output).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  assert.equal(after.info.width, before.info.width);
  assert.equal(after.info.height, before.info.height);
  for (let i = 0; i < before.data.length; i += 4) {
    assert.equal(after.data[i + 3], before.data[i + 3], `${source}: alpha changed`);
    // Fully transparent RGB values have no displayed color.
    if (before.data[i + 3]) for (let c = 0; c < 3; c++) assert.equal(after.data[i + c], before.data[i + c], `${source}: visible pixel changed`);
  }
  const item = { source, output, width: before.info.width, height: before.info.height, before: (await stat(source)).size, after: (await stat(output)).size, visiblePixelsIdentical: true };
  report.push(item);
  console.log(`${source}: ${(item.before / 1024).toFixed(0)} → ${(item.after / 1024).toFixed(0)} KiB; identical visible pixels`);
}
if (process.env.ART_REPORT) await writeFile(process.env.ART_REPORT, JSON.stringify(report, null, 2));
