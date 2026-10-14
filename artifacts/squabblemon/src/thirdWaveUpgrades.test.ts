import assert from 'node:assert/strict';
import { existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const sqRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = path.resolve(sqRoot, '../..');

test('Gym 3D scene avoids 8.8MB getImageData/putImageData, pools spark geometry/materials, and skips idle 2D canvas clears', () => {
  const gymScene = readFileSync(path.join(sqRoot, 'public/scenes/gym/scene.js'), 'utf8');

  assert.doesNotMatch(gymScene, /getImageData\(|putImageData\(/);
  assert.match(gymScene, /lastBagDamageStage/);
  assert.match(gymScene, /SPARK_GEOMETRY/);
  assert.match(gymScene, /SPARK_MATERIALS/);
  assert.doesNotMatch(gymScene, /spark\.geometry\.dispose\(\)/);
  assert.match(gymScene, /speedlinesDirty/);
});

test('Kumite service skips redundant tournament writes and only locks active rooms and transitioning entrants', () => {
  const kumiteSource = readFileSync(path.join(repoRoot, 'artifacts/api-server/src/lib/kumite.ts'), 'utf8');

  assert.match(kumiteSource, /if\s*\(\s*JSON\.stringify\(state\)\s*!==\s*JSON\.stringify\(row\.state\)\s*\)/);
  assert.match(kumiteSource, /match\.roomCode\s*&&\s*match\.status\s*!==\s*['"]complete['"]/);
  assert.match(kumiteSource, /activeStates/);
});

test('Final 6 active runtime PNGs have smaller lossless WebP equivalents and updated component/CSS references', () => {
  const webpAssets = [
    'public/assets/fade-alley/fade-alley-logo',
    'public/assets/fade-alley/add-homie-paper',
    'public/assets/fade-alley/street-sentinel-still',
  ];

  for (const rel of webpAssets) {
    const png = path.join(sqRoot, `${rel}.png`);
    const webp = path.join(sqRoot, `${rel}.webp`);
    assert.ok(existsSync(webp), `Expected ${rel}.webp to exist`);
    assert.ok(statSync(webp).size < statSync(png).size, `Expected ${rel}.webp to be smaller than ${rel}.png`);
  }

  assert.ok(
    statSync(path.join(sqRoot, 'public/assets/inspector/classified-stamp.png')).size < 150 * 1024,
    'Expected classified-stamp.png to be optimized under 150 KiB',
  );
  assert.ok(
    statSync(path.join(sqRoot, 'public/assets/inspector/scout-stamp.png')).size < 150 * 1024,
    'Expected scout-stamp.png to be optimized under 150 KiB',
  );

  const fadeAlleyScene = readFileSync(path.join(sqRoot, 'src/components/social/FadeAlleyScene.tsx'), 'utf8');
  const alleyAvatar = readFileSync(path.join(sqRoot, 'src/components/social/AlleyAvatar.tsx'), 'utf8');
  const friendlyFadesHub = readFileSync(path.join(sqRoot, 'src/components/social/FriendlyFadesHub.tsx'), 'utf8');

  assert.match(fadeAlleyScene, /fade-alley-logo\.webp/);
  assert.match(fadeAlleyScene, /street-sentinel-still\.webp/);
  assert.match(alleyAvatar, /street-sentinel-still\.webp/);
  assert.match(friendlyFadesHub, /add-homie-paper\.webp/);
});

test('BattleAttack consolidates board DOM queries into a single querySelectorAll pass', () => {
  const battleAttackSource = readFileSync(path.join(sqRoot, 'src/components/BattleAttack.tsx'), 'utf8');
  const matches = battleAttackSource.match(/querySelectorAll<HTMLElement>\('\[data-card-zone="board"\]\[data-instance-id\]'\)/g) ?? [];
  assert.equal(matches.length, 1, 'Expected exactly one board card querySelectorAll in BattleAttack');
});

test('Card inspector stamp slam, Kumite live bracket pulse, and Story Map active beacon styles are present', () => {
  const fighterResumeCss = readFileSync(path.join(sqRoot, 'src/styles/fighter-resume.css'), 'utf8');
  const kumiteCss = readFileSync(path.join(sqRoot, 'src/styles/kumite.css'), 'utf8');
  const storyMapCss = readFileSync(path.join(sqRoot, 'src/styles/story-map.css'), 'utf8');

  assert.match(fighterResumeCss, /@keyframes\s+dossier-stamp-slam/);
  assert.match(kumiteCss, /@keyframes\s+kumite-live-match-pulse/);
  assert.match(storyMapCss, /@keyframes\s+story-node-beacon/);
});
