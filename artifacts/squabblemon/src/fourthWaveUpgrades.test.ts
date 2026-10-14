import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const sqRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = path.resolve(sqRoot, '../..');

test('Task 1 & 6: CharacterCollections memoizes ownedCardSet, sets, visible, and marks completed packs with data-complete', () => {
  const source = readFileSync(path.join(sqRoot, 'src/pages/game/CharacterCollections.tsx'), 'utf8');

  assert.match(source, /const\s+ownedCardSet\s*=\s*useMemo\(/);
  assert.match(source, /const\s+sets\s*=\s*useMemo\(/);
  assert.match(source, /const\s+visible\s*=\s*useMemo\(/);
  assert.match(source, /data-complete=\{complete\s*\?\s*'true'\s*:\s*undefined\}/);
});

test('Task 2: social.ts parallelizes relations, blocks, and invitations reads inside state()', () => {
  const source = readFileSync(path.join(repoRoot, 'artifacts/api-server/src/lib/social.ts'), 'utf8');

  assert.match(source, /const\s+\[rows,\s*blockedRows,\s*invitationRows\]\s*=\s*await\s+Promise\.all\(\[/);
});

test('Task 3: AlleyAvatar pauses WebGL loop on visibilitychange and throttles lobby animation to 30fps', () => {
  const source = readFileSync(path.join(sqRoot, 'src/components/social/AlleyAvatar.tsx'), 'utf8');

  assert.match(source, /document\.addEventListener\(['"]visibilitychange['"]/);
  assert.match(source, /1000\s*\/\s*30/);
});

test('Task 4: deckBoxScene avoids 3.3MB getImageData/putImageData in updateRoughness and caches hostRect on resize', () => {
  const source = readFileSync(path.join(sqRoot, 'src/components/decks/deckBoxScene.ts'), 'utf8');

  assert.doesNotMatch(source, /roughnessContext\.getImageData\(/);
  assert.match(source, /globalCompositeOperation\s*=\s*['"]difference['"]/);
  assert.match(source, /let\s+hostRect\s*=/);
});

test('Tasks 5-11: Visual polish rules exist across character-styles, extras-studio, compact-deck-picker, bounty-hunter, market-shelves, training-studio, and fade-park', () => {
  const characterStylesCss = readFileSync(path.join(sqRoot, 'src/styles/character-styles.css'), 'utf8');
  const extrasStudioCss = readFileSync(path.join(sqRoot, 'src/styles/extras-studio.css'), 'utf8');
  const compactDeckPickerCss = readFileSync(path.join(sqRoot, 'src/styles/compact-deck-picker.css'), 'utf8');
  const bountyHunterCss = readFileSync(path.join(sqRoot, 'src/styles/bounty-hunter.css'), 'utf8');
  const marketShelvesCss = readFileSync(path.join(sqRoot, 'src/styles/market-shelves.css'), 'utf8');
  const trainingStudioCss = readFileSync(path.join(sqRoot, 'src/styles/training-studio.css'), 'utf8');
  const fadeParkCss = readFileSync(path.join(sqRoot, 'src/styles/fade-park.css'), 'utf8');

  assert.match(characterStylesCss, /\.style-deck-cover\s*>\s*img:hover/);
  assert.match(extrasStudioCss, /\.extras-pack\[data-complete=['"]?true['"]?\]/);
  assert.match(compactDeckPickerCss, /\.compact-deck-picker__deck\[aria-pressed=['"]?true['"]?\]\s+\.compact-deck-picker__box/);
  assert.match(bountyHunterCss, /\.bounty-poster\[data-status=['"]claimable['"]\]/);
  assert.match(marketShelvesCss, /\.corner-product:is\(:hover,\s*:focus-within\)\s+\.bodega-led/);
  assert.match(trainingStudioCss, /\.training-session::before/);
  assert.match(fadeParkCss, /\.park-rank-track\s+i\s*\{[^}]*linear-gradient/);
});
