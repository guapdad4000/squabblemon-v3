import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const sqRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('Friendly Fades, Gang Backdrop (Decks), and Inventory use fixed fullscreen wallpapers and no blocking @import', () => {
  const friendlyFadesCss = readFileSync(path.join(sqRoot, 'src/styles/friendly-fades.css'), 'utf8');
  const gangBackdropCss = readFileSync(path.join(sqRoot, 'src/styles/gang-backdrop.css'), 'utf8');
  const inventoryCss = readFileSync(path.join(sqRoot, 'src/styles/inventory.css'), 'utf8');

  assert.doesNotMatch(friendlyFadesCss, /@import\s+url\(/);
  assert.match(friendlyFadesCss, /\.ff-stage--alley\s+\.fa-scene__image\s*\{[^}]*position:\s*fixed;\s*inset:\s*0;[^}]*width:\s*100vw;\s*height:\s*100dvh/);
  assert.match(gangBackdropCss, /\.gang-backdrop\s*\{[\s\S]*?position:\s*fixed;[\s\S]*?width:\s*100vw;\s*\n?\s*height:\s*100dvh/);
  assert.match(inventoryCss, /\.inventory-room__backdrop\s*\{[^}]*position:\s*fixed;\s*inset:\s*0;\s*width:\s*100vw;\s*height:\s*100dvh/);
});

test('Inventory, FriendlyFadesHub, ChallengesHub, Decks, and Missions remove duplicate shard readouts and filler copy', () => {
  const inventory = readFileSync(path.join(sqRoot, 'src/pages/game/Inventory.tsx'), 'utf8');
  const friendlyFadesHub = readFileSync(path.join(sqRoot, 'src/components/social/FriendlyFadesHub.tsx'), 'utf8');
  const challengesHub = readFileSync(path.join(sqRoot, 'src/pages/game/ChallengesHub.tsx'), 'utf8');
  const decks = readFileSync(path.join(sqRoot, 'src/pages/game/Decks.tsx'), 'utf8');
  const missions = readFileSync(path.join(sqRoot, 'src/pages/game/Missions.tsx'), 'utf8');

  assert.doesNotMatch(inventory, /YOUR STASH \/ READY WHEN YOU ARE|SIGNATURE COLLECTIONS \/ MAKE IT YOURS|label:'Universal Shards'/);
  assert.doesNotMatch(friendlyFadesHub, /<FadeRules\s*\/>/);
  assert.doesNotMatch(challengesHub, /No Shortcuts|Battle rewards are saved after each verified fight/);
  assert.doesNotMatch(decks, /Every gang starts with you\.|Mix any owned cards\. Saving an example creates your own gang\./);
  assert.doesNotMatch(missions, /Work speaks\.|Every fade moves you forward/);
});

test('collection-sunset-standoff.webp and paper-grain.jpg are compressed and Decks/Kumite/Multiplayer memoize validateSavedDeck', () => {
  const sunsetStat = statSync(path.join(sqRoot, 'src/assets/collection-sunset-standoff.webp'));
  const paperGrainStat = statSync(path.join(sqRoot, 'public/assets/inspector/paper-grain.jpg'));

  assert.ok(sunsetStat.size < 600_000, `Expected collection-sunset-standoff.webp < 600KB, got ${sunsetStat.size}`);
  assert.ok(paperGrainStat.size < 250_000, `Expected paper-grain.jpg < 250KB, got ${paperGrainStat.size}`);

  const decks = readFileSync(path.join(sqRoot, 'src/pages/game/Decks.tsx'), 'utf8');
  const kumite = readFileSync(path.join(sqRoot, 'src/pages/game/Kumite.tsx'), 'utf8');
  const multiplayer = readFileSync(path.join(sqRoot, 'src/pages/game/Multiplayer.tsx'), 'utf8');

  assert.match(decks, /const\s+validatedSavedDecks\s*=\s*useMemo\(/);
  assert.match(kumite, /const\s+decks\s*=\s*useMemo\(/);
  assert.match(multiplayer, /const\s+crews\s*=\s*useMemo\(/);
});
