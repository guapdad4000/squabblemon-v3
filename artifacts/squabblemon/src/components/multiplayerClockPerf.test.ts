import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { computeTurnSecondsRemaining } from './MultiplayerBattle';

const mpBattleSource = readFileSync(new URL('./MultiplayerBattle.tsx', import.meta.url), 'utf8');
const deckWorkbenchSource = readFileSync(new URL('./DeckWorkbench.tsx', import.meta.url), 'utf8');
const gangWallSource = readFileSync(new URL('./GangWall.tsx', import.meta.url), 'utf8');

test('computeTurnSecondsRemaining quantizes sub-second ticks to integer seconds', () => {
  const deadline = 50_000;
  const offset = 0;
  assert.equal(computeTurnSecondsRemaining(deadline, 30_100, offset), 20);
  assert.equal(computeTurnSecondsRemaining(deadline, 30_350, offset), 20);
  assert.equal(computeTurnSecondsRemaining(deadline, 30_850, offset), 20);
  assert.equal(computeTurnSecondsRemaining(deadline, 31_050, offset), 19);
  assert.equal(computeTurnSecondsRemaining(deadline, 60_000, offset), 0);
});

test('MultiplayerBattle only updates state when integer remaining seconds change and stops polling when complete', () => {
  assert.doesNotMatch(mpBattleSource, /setInterval\(\(\)\s*=>\s*setNow\(Date\.now\(\)\),\s*250\)/);
  assert.match(mpBattleSource, /computeTurnSecondsRemaining/);
});

test('DeckWorkbench memoizes validation and GangWall reuses its bounded catalog cache', () => {
  assert.match(deckWorkbenchSource, /useMemo\(\(\)\s*=>\s*crewInsights\(draft\.cardIds\)/);
  assert.match(deckWorkbenchSource, /useMemo\(\(\)\s*=>\s*validateSavedDeck\(/);
  assert.match(gangWallSource, /getGangWallGroups\(mode\)/);
});
