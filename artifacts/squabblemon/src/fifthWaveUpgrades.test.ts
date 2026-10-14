import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const sqRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('Phase 1 (Tasks 1-4): Huge Visual Pass rules exist in fan-navigation, hall-of-hands, gang-wall, safehouse-bulletin, deck-carousel, and result-immersive', () => {
  const fanNavCss = readFileSync(path.join(sqRoot, 'src/components/venue/fan-navigation.css'), 'utf8');
  const hallOfHandsCss = readFileSync(path.join(sqRoot, 'src/styles/hall-of-hands.css'), 'utf8');
  const gangWallCss = readFileSync(path.join(sqRoot, 'src/styles/gang-wall.css'), 'utf8');
  const safehouseBulletinCss = readFileSync(path.join(sqRoot, 'src/styles/safehouse-bulletin.css'), 'utf8');
  const deckCarouselCss = readFileSync(path.join(sqRoot, 'src/styles/deck-carousel.css'), 'utf8');
  const resultImmersiveCss = readFileSync(path.join(sqRoot, 'src/styles/result-immersive.css'), 'utf8');

  assert.match(fanNavCss, /\.fan-menu__choice\.is-active\s+img/);
  assert.match(hallOfHandsCss, /\.progression-sign:hover:not\(:disabled\)/);
  assert.match(gangWallCss, /0\s+0\s+14px\s+rgba\(247,\s*223,\s*165/);
  assert.match(safehouseBulletinCss, /\.bulletin-event:hover/);
  assert.match(deckCarouselCss, /\.deck-carousel__edit:hover/);
  assert.match(resultImmersiveCss, /\.result-immersive__scores\s*>\s*div\[data-winner=['"]?player['"]?\]/);
});

test('Phase 2 (Tasks 5-8): Battle Pass rules exist in battle-header, battle-attack-polish, battle-effects, and battle-board', () => {
  const battleHeaderCss = readFileSync(path.join(sqRoot, 'src/components/battle-header.css'), 'utf8');
  const battleAttackCss = readFileSync(path.join(sqRoot, 'src/components/battle-attack-polish.css'), 'utf8');
  const battleEffectsCss = readFileSync(path.join(sqRoot, 'src/components/battle-effects.css'), 'utf8');
  const battleBoardCss = readFileSync(path.join(sqRoot, 'src/components/battle-board.css'), 'utf8');

  assert.match(battleHeaderCss, /@keyframes\s+rival-thinking-pulse/);
  assert.match(battleAttackCss, /\.attack-delta\.is-gain\s+strong/);
  assert.match(battleEffectsCss, /\.decision-clock-track\s+i\s*\{[^}]*box-shadow:\s*0\s+0\s+10px\s+currentColor/);
  assert.match(battleBoardCss, /\.district-prompt\.is-ready/);
});

test('Phase 3 (Tasks 9-12): Mini-Games Pass rules exist in arcade-polish, fadecade-road, stockz, and boss-raid-design', () => {
  const arcadePolishCss = readFileSync(path.join(sqRoot, 'src/styles/arcade-polish.css'), 'utf8');
  const fadecadeRoadCss = readFileSync(path.join(sqRoot, 'src/styles/fadecade-road.css'), 'utf8');
  const stockzCss = readFileSync(path.join(sqRoot, 'src/styles/stockz.css'), 'utf8');
  const bossRaidDesignCss = readFileSync(path.join(sqRoot, 'src/styles/boss-raid-design.css'), 'utf8');

  assert.match(arcadePolishCss, /\.arcade-objective__progress\s+i\s*\{[^}]*box-shadow:/);
  assert.match(fadecadeRoadCss, /\.fadecade-road-node\.is-boss\s+b\s*\{[^}]*box-shadow:/);
  assert.match(stockzCss, /\.stockz-cabinet\s+path\s*\{[\s\S]*?drop-shadow/);
  assert.match(bossRaidDesignCss, /\.raid-v3\s+\.raid-directive\s*\{[\s\S]*?border-top:/);
});

test('Phase 4 (Tasks 13-16): Performance Pass memoizes ParkChessBoard targets, pools ArcadeGames AudioContext, uses ref DOM updates in BossRaidTargetLine, and skips JSON clone in applyEventState', () => {
  const parkChessBoard = readFileSync(path.join(sqRoot, 'src/components/fadecade/ParkChessBoard.tsx'), 'utf8');
  const arcadeGames = readFileSync(path.join(sqRoot, 'src/components/fadecade/ArcadeGames.tsx'), 'utf8');
  const bossRaidTargetLine = readFileSync(path.join(sqRoot, 'src/components/fadecade/BossRaidTargetLine.tsx'), 'utf8');
  const playLoop = readFileSync(path.join(sqRoot, 'src/components/PlayLoop.tsx'), 'utf8');

  assert.match(parkChessBoard, /const\s+legalTargets\s*=\s*useMemo\(\(\)\s*=>\s*new\s+Set\(/);
  assert.match(arcadeGames, /let\s+sharedArcadeAudioContext:\s*AudioContext\s*\|\s*null\s*=\s*null/);
  assert.doesNotMatch(bossRaidTargetLine, /useState/);
  assert.match(bossRaidTargetLine, /setAttribute\(['"]d['"]/);
  assert.match(playLoop, /shareEqual\(visual,\s*\{\s*\.\.\.authoritative,\s*\.\.\.event\.replay\[key\]\s*\}\)/);
});
