import assert from 'node:assert/strict';
import test from 'node:test';
import { abilityFailed, abilityTookEffect, FAILED_ABILITY_BEAT_MS } from './abilityOutcome';
import { createCardInstance, createMatch, playCard, type CardInstance } from './gameEngine';
import { specialMoveForEvent, planSpecialMoveBeat } from './specialMoves';

function cast(id: string, targets: CardInstance[] = [], disabled = false, index = 0) {
  const source = createCardInstance(id, 'player', 'outcome', index);
  if (disabled) source.statuses.silenced = true;
  const initial = { ...createMatch('block', 'combo'), playerMotion: 20, playerHand: [source], boards: [targets, [], []], timedEffects: targets.filter(c => c.statuses.protected).map(c => ({ id: `shield:${c.instanceId}`, kind: 'church-protection' as const, sourceInstanceId: c.instanceId, targetInstanceId: c.instanceId, owner: c.owner, lane: 0 as const, startsAtRound: 1, expiresAtRound: 2, expiration: 'round-start' as const })) };
  const resolved = playCard(initial, 'player', source.instanceId, 0);
  const event = resolved.effectLog.find(e => e.type === 'ability' && e.cardId === id)!;
  assert.ok(event, `${id} emits an ability event`);
  return event;
}
const target = (owner: 'player' | 'cpu', shield = false, powerModifier = 0) => {
  const card = { ...createCardInstance('hooper', owner, 'target', 1), lane: 0 as const };
  card.statuses.protected = shield;
  card.powerModifier = powerModifier;
  return card;
};

test('empty targets and silenced attempts skip videos and do not consume the first successful playback', () => {
  for (const event of [cast('barber'), cast('barber', [target('player')], true), cast('drfade')]) {
    assert.equal(abilityFailed(event), true);
    assert.equal(specialMoveForEvent(event), null);
    const plan = planSpecialMoveBeat(specialMoveForEvent(event), { owner: 'player', sourceInstanceId: event.cardInstanceId, moveId: 'char37' }, new Set(), FAILED_ABILITY_BEAT_MS);
    assert.deepEqual(plan, { durationMs: 260, playKey: null });
  }
  assert.ok(specialMoveForEvent(cast('barber', [target('player')])));
});

test('shielded attacks fail, while partially successful multi-target abilities retain their special', () => {
  assert.equal(abilityTookEffect(cast('barber', [target('cpu', true, 2)])), false);
  const applied = cast('barber', [target('cpu', true), target('player')]);
  assert.equal(abilityTookEffect(applied), true);
  assert.ok(specialMoveForEvent(applied));
});

test('real buffs, damage, protection, and discounts count even without a score change', () => {
  for (const event of [cast('barber', [target('player')]), cast('barber', [target('cpu', false, 2)]), cast('wifey'), cast('plug')]) {
    assert.equal(abilityTookEffect(event), true, event.note);
  }
});

test('notes and attempt bookkeeping alone are not a successful move; missing evidence fails closed', () => {
  const event = cast('barber');
  event.note = 'A spectacular success!';
  event.replay.after.nextArrivalOrder += 1;
  if (event.source?.after) event.source.after.lastEffectNote = 'Changed feedback';
  assert.equal(abilityTookEffect(event), false);
  assert.equal(specialMoveForEvent({ type: 'ability', kind: 'ability', cardId: 'barber' }), null);
});


test('movement and freeze remain successful specials', () => {
  for (const event of [cast('bikelife'), cast('snow', [target('cpu')])]) {
    assert.equal(abilityTookEffect(event), true, event.note);
  }
});


test('a missed summon chance does not play the special', () => {
  const event = cast('shiesty');
  assert.equal(event.replay.after.boards.flat().length, event.replay.before.boards.flat().length);
  assert.equal(abilityFailed(event), true);
});


test('successful summon rolls retain the special', () => {
  const events = Array.from({ length: 16 }, (_, i) => cast('shiesty', [], false, i));
  const summoned = events.filter(event => event.replay.after.boards.flat().length > event.replay.before.boards.flat().length);
  assert.ok(summoned.length > 0);
  for (const event of summoned) assert.equal(abilityTookEffect(event), true);
});

test('successful delayed creative setups retain their special before they change Hands', () => {
  for (const event of [cast('mr-trick'), cast('hooper', [target('cpu')])]) {
    assert.equal(abilityTookEffect(event), true, event.note);
    assert.ok(specialMoveForEvent(event));
  }
});

test('buffs to frozen targets count even when effective Hands stay unchanged', () => {
  const frozen = target('player'); frozen.statuses.frozen = true;
  assert.equal(abilityTookEffect(cast('barber', [frozen])), true);
});
