import assert from 'node:assert/strict';
import test from 'node:test';
import { abilityFailed, abilityTookEffect, FAILED_ABILITY_BEAT_MS } from './abilityOutcome';
import { createCardInstance, createMatch, playCard, type CardInstance } from './gameEngine';
import { specialMoveForEvent, planSpecialMoveBeat } from './specialMoves';
import { createOnlineRoom, joinOnlineRoom, onlineRoomView } from '@workspace/squabblemon-engine/multiplayer';
import { decks } from './data';
import { toPresentationEffect } from './lib/useOnlineEffectPresenter';

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

test('tablet-only Anunaki placement succeeds and has its special locally and online', () => {
  for (const id of ['nabu', 'utu']) {
    const source = createCardInstance(id, 'player', 'tablet-outcome', 0);
    const initial = { ...createMatch('block', 'combo'), playerMotion: 20, playerHand: [source], boards: [[], [], []] as [CardInstance[], CardInstance[], CardInstance[]] };
    const resolved = playCard(initial, 'player', source.instanceId, 0);
    const event = resolved.effectLog.find(e => e.note === 'Placed an Ancient Tablet.')!;
    assert(event && abilityTookEffect(event));
    assert(specialMoveForEvent(event), `${id} should play its placement movie`);
    const member = (userId: string) => ({ userId, name: userId, ready: false, deck: decks[0] });
    let room = joinOnlineRoom(createOnlineRoom(member('a'), 'player', 0), member('b'), 0);
    room.match = resolved;
    for (const viewer of ['a', 'b']) {
      const view = onlineRoomView(room, 'TABLET', viewer, 1);
      const publicEvent = view.events.find(e => e.sequence === event.sequence)!;
      assert.deepEqual(publicEvent.tabletPlaced, [{ owner: 'player', lane: 0 }]);
      assert(!('replay' in publicEvent));
      const presentation = toPresentationEffect(publicEvent, view.seat, [])!;
      assert(presentation && abilityTookEffect(presentation));
      assert(specialMoveForEvent(presentation));
    }
  }
});

test('Caucus starts one movie, while chain-copy damage and summon events skip extra movies', () => {
  let chain: ReturnType<typeof playCard> | undefined;
  for (let index = 0; index < 50 && !chain; index++) {
    const source = createCardInstance('caucus-mountaineer', 'player', 'caucus-film', index);
    const enemy = target('cpu', false, 50);
    const initial = { ...createMatch('block', 'combo'), playerMotion: 20, playerHand: [source], boards: [[enemy], [], []] as [CardInstance[], CardInstance[], CardInstance[]] };
    const resolved = playCard(initial, 'player', source.instanceId, 0);
    if (resolved.boards[0].filter(c => c.cardId === 'caucus-mountaineer').length > 1) chain = resolved;
  }
  assert(chain, 'found a deterministic seed with a chain');
  const hits = chain.effectLog.filter(e => e.note === 'Lab Accident landed for 1 damage.');
  assert(hits.length > 1);
  assert(specialMoveForEvent(hits[0]), 'original play keeps its movie');
  for (const hit of hits.slice(1)) {
    assert(hit.cardInstanceId.startsWith('summon:'));
    assert.equal(specialMoveForEvent(hit), null, 'copies keep their hit feedback without another movie');
  }
});

test('Anu tablet payment is a visible play event for both seats, without revealing replay data', () => {
  const source = createCardInstance('anu', 'player', 'tablet-payment', 0);
  const initial = { ...createMatch('block', 'combo'), playerMotion: 20, playerHand: [source],
    ancientTablets: [{ owner: 'player' as const, lane: 1 as const }], boards: [[], [], []] as [CardInstance[], CardInstance[], CardInstance[]] };
  const resolved = playCard(initial, 'player', source.instanceId, 0);
  const event = resolved.effectLog.find(e => e.type === 'play' && e.cardId === 'anu')!;
  assert.deepEqual(event.replay.before.ancientTablets, [{ owner: 'player', lane: 1 }]);
  assert.deepEqual(event.replay.after.ancientTablets, []);
  const member = (userId: string) => ({ userId, name: userId, ready: false, deck: decks[0] });
  const room = { ...joinOnlineRoom(createOnlineRoom(member('a'), 'player', 0), member('b'), 0), match: resolved };
  for (const viewer of ['a', 'b']) {
    const view = onlineRoomView(room, 'ANU', viewer, 1);
    const publicEvent = view.events.find(e => e.sequence === event.sequence)!;
    assert.deepEqual(publicEvent.tabletConsumed, [{ owner: 'player', lane: 1 }]);
    assert(!('replay' in publicEvent));
    const presentation = toPresentationEffect(publicEvent, view.seat, [])!;
    assert(presentation && presentation.tabletChanged);
    assert.equal(specialMoveForEvent(presentation), null, 'paying the cost is a play, not a second ability movie');
  }
});
