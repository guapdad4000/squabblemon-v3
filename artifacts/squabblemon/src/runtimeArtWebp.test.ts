import assert from 'node:assert/strict';
import { existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const convertedAssets = [
  'public/assets/fade-park/park',
  'public/assets/fade-park/search-versus',
  'public/assets/progression/brick',
  'public/assets/progression/gang-wall',
  'public/assets/progression/graffiti-paint-v2',
  'public/assets/progression/hall-wallpaper',
  'public/assets/progression/hall-of-hands',
  'public/assets/NEW_ASSETS_ADDED/squabblemon_battle_fx_asset_sheet',
  'public/assets/selection/underpass',
  'public/assets/selection/dossier',
  'public/assets/training/dr-fade-coach',
  'public/assets/fade-alley/night',
];

test('high-traffic runtime backdrops and sprite sheets have smaller lossless WebP files', () => {
  for (const base of convertedAssets) {
    const pngPath = path.join(rootDir, `${base}.png`);
    const webpPath = path.join(rootDir, `${base}.webp`);
    assert.ok(existsSync(webpPath), `Missing WebP asset: ${base}.webp`);
    assert.ok(statSync(webpPath).size < statSync(pngPath).size, `Expected ${base}.webp to be smaller than .png`);
  }
});

test('runtime components and stylesheets reference .webp for converted high-traffic assets', () => {
  const files = [
    'src/pages/game/FadePark.tsx',
    'src/components/ParkResult.tsx',
    'src/components/GangWall.tsx',
    'src/pages/game/CareerBoard.tsx',
    'src/pages/game/Market.tsx',
    'src/components/StoryCrewSelect.tsx',
    'src/components/social/FadeAlleyScene.tsx',
    'src/index.css',
  ];
  const combined = files.map(f => readFileSync(path.join(rootDir, f), 'utf8')).join('\n');
  for (const base of convertedAssets) {
    const rel = base.replace(/^public\//, '');
    assert.doesNotMatch(combined, new RegExp(`${rel.replaceAll('/', '\\/')}\\.png`));
    assert.match(combined, new RegExp(`${rel.replaceAll('/', '\\/')}\\.webp`));
  }
});
