import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  RULES, createGame, advance,
  type FighterDefinition, type Unit,
} from '@workspace/squabblemon-engine/breakthrough';
import BreakthroughHowToPlay from './BreakthroughHowToPlay';

const roster: FighterDefinition[] = Array.from({ length: 10 }, (_, i) => ({
  id: `guide-${i}`, name: `Guide fighter ${i}`, cost: 2, hands: 4,
  art: '', description: 'No extra ability.', ability: 'none',
}));
function unit(id: string, side: 'player' | 'opponent', hands: number): Unit {
  return { id, side, hands, cardId: roster[side === 'player' ? 0 : 1].id,
    lane: 0, position: side === 'player' ? .499 : .501,
    baseHands: hands, maxHands: hands, nextEffectAt: Infinity, squabbled: false };
}

test('guide keeps the win condition visible and optional detail in native disclosures', () => {
  const html = renderToStaticMarkup(<BreakthroughHowToPlay />);
  assert.match(html, /aria-labelledby="[^"]+"/);
  assert.equal((html.match(/class="bt-howto-number"/g) ?? []).length, 4);
  assert.equal((html.match(/<details/g) ?? []).length, 3);
  assert.doesNotMatch(html, /<details[^>]* open/);
  assert.match(html, /At 0:00 → most breaches → most surviving Hands → draw/);
  assert.ok(html.indexOf('At 0:00') < html.indexOf('<details'));
  assert.match(html, /BETA IN PREPARATION/);
  assert.match(html, /local CPU practice, with no account rewards/);
  assert.match(html, /Online matchmaking and its rewards are not live/);
});

test('shown Motion, hand and clock values agree with a fresh match', () => {
  const html = renderToStaticMarkup(<BreakthroughHowToPlay />);
  const game = createGame(roster);
  assert.match(html, new RegExp(`<b>${game.durationMs / 60000}:00</b> CLOCK`));
  assert.match(html, new RegExp(`Start ${game.players.player.motion} Motion`));
  assert.match(html, new RegExp(`cap ${RULES.motionCap}`));
  assert.match(html, new RegExp(`Begin with ${game.players.player.hand.length} cards`));
  assert.match(html, new RegExp(`final ${RULES.lastStandMs / 1000} seconds`));
  const afterTwoSeconds = advance(game, 1 / RULES.motionPerSecond * 1000);
  assert.equal(afterTwoSeconds.players.player.motion, RULES.startingMotion + 1);
});

test('the collision example is true for the live no-defense rules', () => {
  const game = createGame(roster);
  game.units = [unit('guide-seven', 'player', 7), unit('guide-five', 'opponent', 5)];
  const result = advance(game, RULES.tickMs);
  assert.deepEqual(result.units.map(({ side, hands }) => ({ side, hands })), [
    { side: 'player', hands: 2 },
  ]);
  const html = renderToStaticMarkup(<BreakthroughHowToPlay />);
  assert.match(html, /Without abilities or protection: 7 Hands against 5 Hands/);
});

test('multiple mounted guides have distinct accessible heading IDs', () => {
  const html = renderToStaticMarkup(<><BreakthroughHowToPlay /><BreakthroughHowToPlay /></>);
  const labels = [...html.matchAll(/aria-labelledby="([^"]+)"/g)].map((match) => match[1]);
  assert.equal(labels.length, 2);
  assert.notEqual(labels[0], labels[1]);
  for (const label of labels) assert.ok(html.includes(`id="${label}"`));
});
