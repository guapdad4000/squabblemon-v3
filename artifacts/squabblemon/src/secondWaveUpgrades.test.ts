import assert from 'node:assert/strict';
import { existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const sqRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = path.resolve(sqRoot, '../..');

test('playerState batches mission inserts, parallelizes bootstrap reads, and skips redundant profile writes', () => {
  const playerStateSource = readFileSync(path.join(repoRoot, 'artifacts/api-server/src/lib/playerState.ts'), 'utf8');
  const playerRoutesSource = readFileSync(path.join(repoRoot, 'artifacts/api-server/src/routes/player.ts'), 'utf8');

  assert.doesNotMatch(playerStateSource, /for\s*\(\s*const\s+template\s+of\s+MISSION_TEMPLATES\s*\)\s*\{\s*await\s+db/);
  assert.match(playerStateSource, /MISSION_TEMPLATES\.map\(/);
  assert.match(playerStateSource, /Promise\.all\(\[/);
  assert.match(playerRoutesSource, /await\s+deliverLatePatchLetters\(userId\)/);
  assert.doesNotMatch(playerRoutesSource, /if\s*\(\s*await\s+deliverLatePatchLetters\(userId\)\s*\)\s*state\s*=\s*await\s+getPlayerBootstrap\(userId\)/);
});

test('KeyedVideo supports pausing after first frame and Battle memoizes hand card playability', () => {
  const keyedVideoSource = readFileSync(path.join(sqRoot, 'src/components/KeyedVideo.tsx'), 'utf8');
  const battleSource = readFileSync(path.join(sqRoot, 'src/components/Battle.tsx'), 'utf8');

  assert.match(keyedVideoSource, /paused\?:\s*boolean/);
  assert.match(battleSource, /paused=\{Boolean\(m\.squabbleUsed\s*\|\|\s*reducedMotion\)\}/);
  assert.match(battleSource, /const\s+handPlayability\s*=\s*React\.useMemo\(/);
});

test('win-w and loss-l animated WebP assets and trimmed rank promotion cinematic reduce media payload', () => {
  const winGif = path.join(sqRoot, 'public/assets/results/win-w.gif');
  const winWebp = path.join(sqRoot, 'public/assets/results/win-w.webp');
  const lossGif = path.join(sqRoot, 'public/assets/results/loss-l.gif');
  const lossWebp = path.join(sqRoot, 'public/assets/results/loss-l.webp');
  const cinematicMp4 = path.join(sqRoot, 'src/assets/promotion/squabblehouse-openart-cinematic-v1.mp4');

  assert.ok(existsSync(winWebp), 'Expected public/assets/results/win-w.webp to exist');
  assert.ok(existsSync(lossWebp), 'Expected public/assets/results/loss-l.webp to exist');
  assert.ok(statSync(winWebp).size < statSync(winGif).size, 'Expected win-w.webp to be smaller than win-w.gif');
  assert.ok(statSync(lossWebp).size < statSync(lossGif).size, 'Expected loss-l.webp to be smaller than loss-l.gif');
  assert.ok(statSync(cinematicMp4).size < 12 * 1024 * 1024, 'Expected trimmed rank-up MP4 to be under 12 MB');

  const resultArtworkSource = readFileSync(path.join(sqRoot, 'src/components/ResultArtwork.tsx'), 'utf8');
  const parkResultSource = readFileSync(path.join(sqRoot, 'src/components/ParkResult.tsx'), 'utf8');
  assert.match(resultArtworkSource, /win-w'\s*:\s*'loss-l'\}\.webp/);
  assert.match(parkResultSource, /win-w'\s*:\s*'loss-l'\}\.webp/);
});

test('Gacha stage escalates 3-beat strike intensity and Fadecade cabinets glow on hover/focus', () => {
  const shopSource = readFileSync(path.join(sqRoot, 'src/pages/game/Shop.tsx'), 'utf8');
  const gachaStageCss = readFileSync(path.join(sqRoot, 'src/styles/gacha-stage.css'), 'utf8');
  const challengesHubCss = readFileSync(path.join(sqRoot, 'src/styles/challenges-hub.css'), 'utf8');

  assert.match(shopSource, /data-strike-intensity=\{isPunching\s*\?\s*fightBeat\.intensity\s*:\s*undefined\}/);
  assert.match(gachaStageCss, /\.gacha-stage\[data-strike-intensity=['"]heavy['"]\]/);
  assert.match(gachaStageCss, /\.gacha-stage\[data-strike-intensity=['"]finisher['"]\]/);
  assert.match(challengesHubCss, /\.arcade-cabinet:is\(:hover,\s*:focus-within\)/);
});
