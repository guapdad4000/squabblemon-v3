import assert from 'node:assert/strict';
import test from 'node:test';
import { createMatch, createCardInstance, createAbilityUpgradeSnapshot, playTurnCard, type Match, type Owner, type Lane, type CardInstance } from './gameEngine';
const owners = ['player', 'cpu'] as const;
const other = (o: Owner): Owner => o === 'player' ? 'cpu' : 'player';
const blank = (owner: Owner, tier: number): Match => ({ ...createMatch('block', 'block'), round: 3,
  playerMotion: 9, cpuMotion: 9, playerHand: [], cpuHand: [], boards: [[], [], []],
  abilityUpgradeSnapshot: createAbilityUpgradeSnapshot(['look-out', 'ganger-blue', 'blueside1', 'triple-og-blue', 'blue-nose-pit'], ['look-out', 'ganger-blue', 'blueside1', 'triple-og-blue', 'blue-nose-pit'],
    { [owner]: Object.fromEntries(['look-out', 'ganger-blue', 'blueside1', 'triple-og-blue', 'blue-nose-pit'].map(id => [id, { xp: tier ? 4500 : 0, level: tier ? 10 : 1, moveTier: tier }])) }),
});
let serial = 0;
const unit = (id: string, owner: Owner, lane: Lane): CardInstance => ({ ...createCardInstance(id, owner, 'crip-buffs', serial++), lane });
const get = (m: Match, c: CardInstance) => m.boards.flat().find(x => x.instanceId === c.instanceId)!;
function cast(m: Match, id: string, owner: Owner, lane: Lane) {
  const c = unit(id, owner, lane);
  const after = playTurnCard({ ...m, phase: owner === 'player' ? 'player' : 'cpu-reveal',
    [owner === 'player' ? 'playerMotion' : 'cpuMotion']: 9,
    [owner === 'player' ? 'playerHand' : 'cpuHand']: [{ ...c, lane: null }] }, owner, c.instanceId, lane);
  return { c, after };
}
for (const owner of owners) for (const tier of [0, 3]) {
  test(`Crossfire rewards distinct remote Blue Set districts with at most +2 (${owner}, tier ${tier})`, () => {
    const m = blank(owner, tier);
    const tagged = unit('cornball', owner, 2); tagged.gangTag = 'blue';
    m.boards = [[], [unit('look-out', owner, 1), unit('blue-nose-pit', owner, 1)], [tagged]];
    const { c, after } = cast(m, 'blueside1', owner, 0);
    assert.equal(get(after, c).powerModifier, 3 + tier, 'self Blue Side + two distinct Blue Set districts + training');
    const local = blank(owner, tier);
    local.boards[0] = [unit('look-out', owner, 0)];
    local.boards[1] = [unit('ganger-blue', other(owner), 1)];
    const solo = cast(local, 'blueside1', owner, 0);
    assert.equal(get(solo.after, solo.c).powerModifier, 1 + tier, 'local allies and enemy Blue Set do not add remote bonuses');
  });
  test(`Look Out helps one weakest other Blue ally only on the actual call (${owner}, tier ${tier})`, () => {
    const m = blank(owner, tier);
    const weak = unit('cornball', owner, 2); weak.gangTag = 'blue';
    const strong = unit('ganger-blue', owner, 0); strong.powerModifier = 10;
    m.boards = [[strong], [], [weak]];
    const setup = cast(m, 'look-out', owner, 1);
    assert.equal(get(setup.after, weak).powerModifier, 0);
    const called = cast(setup.after, 'hooper', other(owner), 0).after;
    assert.equal(get(called, weak).powerModifier, 2);
    assert.equal(get(called, strong).powerModifier, 10);
    assert.equal(get(called, setup.c).powerModifier, tier);
    assert(called.effectLog.some(e => e.cardInstanceId === setup.c.instanceId && e.targets.some(t => t.cardInstanceId === weak.instanceId)));
    const again = cast(called, 'hooper', other(owner), 2).after;
    assert.equal(get(again, weak).powerModifier, 2, 'call cannot pay twice');
  });
  test(`Ganger Blue gains +1 only when covering a Blue Set ally (${owner}, tier ${tier})`, () => {
    for (const tagged of [false, true]) {
      const m = blank(owner, tier), ally = unit('cornball', owner, 2);
      if (tagged) ally.gangTag = 'blue';
      m.boards[2] = [ally];
      const { c, after } = cast(m, 'ganger-blue', owner, 0);
      assert.equal(get(after, c).powerModifier, tier + (tagged ? 1 : 0));
      assert.equal(get(after, ally).powerModifier, tagged ? 4 : 3);
      assert(get(after, ally).statuses.protected);
    }
  });
}
test('Silence stops the new Look Out crew bonus and leaves its call unspent', () => {
  const m = blank('player', 3), ally = unit('blue-nose-pit', 'player', 2);
  m.boards[2] = [ally];
  const setup = cast(m, 'look-out', 'player', 1);
  get(setup.after, setup.c).statuses.silenced = true;
  const after = cast(setup.after, 'hooper', 'cpu', 0).after;
  assert.equal(get(after, ally).powerModifier, 0);
  assert.equal(get(after, setup.c).lookoutReady, true);
});
for (const owner of owners) test(`Look Out does not buff itself, ordinary allies, or the opponent (${owner})`, () => {
  const m = blank(owner, 0), ordinary = unit('cornball', owner, 2), enemyBlue = unit('blue-nose-pit', other(owner), 1);
  m.boards = [[], [enemyBlue], [ordinary]];
  const setup = cast(m, 'look-out', owner, 0);
  const after = cast(setup.after, 'hooper', other(owner), 2).after;
  assert.equal(get(after, setup.c).powerModifier, 0);
  assert.equal(get(after, ordinary).powerModifier, 0);
  assert.equal(get(after, enemyBlue).powerModifier, 0);
  assert.equal(after.discountTokens.filter(t => t.sourceInstanceId === setup.c.instanceId).length, 1);
});

import { decks } from './data';
import { canAffordSelection, createMatchFromEngineCards, createDistrictSnapshot, pass, nextRound, revealCpuTurn, verifyMatchTranscript, type PlayerMove } from './gameEngine';
for (const tier of [0, 3]) test(`Crip crew actions replay exactly under authoritative rules (tier ${tier})`, () => {
  const ids = ['triple-og-blue', 'look-out', 'blueside1', 'ganger-blue', 'blue-nose-pit', 'initiation', 'waterboy', 'alchy', 'cognac', 'bustdown'];
  const opponent = decks.find(d => d.id === 'block')!;
  const snapshot = createAbilityUpgradeSnapshot(ids, opponent.cards, {
    player: Object.fromEntries(ids.map(id => [id, { xp: tier ? 4500 : 0, level: tier ? 10 : 1, moveTier: tier }])),
  });
  const districts = createDistrictSnapshot('crip-followup-replay');
  let local = createMatchFromEngineCards('focused-blue-set', ids, opponent.id, opponent.cards, undefined, undefined, snapshot, districts);
  const moves: PlayerMove[] = [];
  while (local.phase !== 'complete') {
    const choice = local.playerHand.flatMap(card => ([0, 1, 2] as Lane[])
      .filter(lane => canAffordSelection(local, 'player', card.instanceId, lane)).map(lane => ({ card, lane })))[0];
    if (choice) {
      const squabble = !local.squabbleUsed && local.round >= 4;
      moves.push({ cardInstanceId: choice.card.instanceId, lane: choice.lane, squabble, endTurn: false });
      local = playTurnCard(local, 'player', choice.card.instanceId, choice.lane, squabble);
    } else {
      moves.push({ cardInstanceId: null, lane: null, squabble: false, endTurn: true });
      local = nextRound(revealCpuTurn(pass(local, 'player')));
    }
    assert(moves.length <= 64);
  }
  const replay = verifyMatchTranscript('focused-blue-set', opponent.id, JSON.parse(JSON.stringify(moves)),
    JSON.parse(JSON.stringify(snapshot)), ids, JSON.parse(JSON.stringify(districts)));
  assert.deepEqual(replay, local);
});

for (const owner of owners) for (const tier of [0, 3]) {
  test(`CLUE reinforces one Blue ally per remote district and trains on support (${owner}, ${tier})`, () => {
    const m = blank(owner, tier);
    const weak = unit('look-out', owner, 1), strong = unit('ganger-blue', owner, 1);
    strong.powerModifier = 10;
    const tagged = unit('cornball', owner, 2); tagged.gangTag = 'blue';
    const local = unit('blue-nose-pit', owner, 0);
    m.boards = [[local], [strong, weak], [tagged]];
    const result = cast(m, 'triple-og-blue', owner, 0);
    assert.equal(get(result.after, weak).powerModifier, 2);
    assert.equal(get(result.after, tagged).powerModifier, 2);
    assert(get(result.after, weak).statuses.protected);
    assert(get(result.after, tagged).statuses.protected);
    assert.equal(get(result.after, strong).powerModifier, 10);
    assert.equal(get(result.after, local).powerModifier, 0);
    assert.equal(get(result.after, result.c).powerModifier, tier, 'support alone earns training exactly once');
    assert(result.after.effectLog.some(e => e.cardInstanceId === result.c.instanceId
      && [weak, tagged].every(c => e.targets.some(t => t.cardInstanceId === c.instanceId))));
  });
  test(`Blue-Nose Pit reinforces one remote ally per round alongside the OG (${owner}, ${tier})`, () => {
    const m = blank(owner, tier);
    const og = unit('triple-og-blue', owner, 0), ally = unit('look-out', owner, 1);
    const ordinary = unit('cornball', owner, 2);
    m.boards = [[og], [ally], [ordinary]];
    const result = cast(m, 'blue-nose-pit', owner, 0);
    assert.equal(get(result.after, og).powerModifier, 1);
    assert.equal(get(result.after, ally).powerModifier, 2);
    assert.equal(get(result.after, result.c).powerModifier, tier);
    assert.equal(get(result.after, ordinary).powerModifier, 0);
    const sameRound = cast(result.after, 'hooper', other(owner), 2).after;
    assert.equal(get(sameRound, ally).powerModifier, 2);
    const again = nextRound({ ...sameRound, phase: 'resolved' });
    assert.equal(get(again, og).powerModifier, 2);
    assert.equal(get(again, ally).powerModifier, 4);
    assert.equal(get(again, result.c).powerModifier, tier, 'training cannot repeat with recurring support');
  });
}
for (const owner of owners) {
  test(`CLUE never reinforces ordinary cards or enemy Blue Set (${owner})`, () => {
    const m = blank(owner, 3), ordinary = unit('cornball', owner, 1), enemy = unit('look-out', other(owner), 2);
    m.boards = [[], [ordinary], [enemy]];
    const result = cast(m, 'triple-og-blue', owner, 0);
    assert.equal(get(result.after, ordinary).powerModifier, 0);
    assert.equal(get(result.after, enemy).powerModifier, 0);
    assert.equal(get(result.after, result.c).powerModifier, 0, 'no homage, movement, or reinforcement: no training');
  });
  test(`Pit remote bonus requires the OG in its district and an active dog (${owner})`, () => {
    const m = blank(owner, 3), og = unit('triple-og-blue', owner, 0), ally = unit('look-out', owner, 1);
    m.boards = [[og], [ally], []];
    const result = cast(m, 'blue-nose-pit', owner, 2);
    assert.equal(get(result.after, ally).powerModifier, 0, 'cannot support across the board before reaching OG');
    get(result.after, result.c).statuses.silenced = true;
    const disabled = nextRound({ ...result.after, phase: 'resolved' });
    assert.equal(get(disabled, ally).powerModifier, 0);
    assert.equal(get(disabled, og).powerModifier, 0);
  });
}

for (const owner of owners) test(`Look Out refreshes with Blue backup but stops after three rounds of calls (${owner})`, () => {
  const m = { ...blank(owner, 3), round: 2, playerDrawIndex: 100, cpuDrawIndex: 100 };
  const ally = unit('blue-nose-pit', owner, 2);
  m.boards[2] = [ally];
  const setup = cast(m, 'look-out', owner, 0);
  let current = setup.after;
  for (let call = 1; call <= 4; call++) {
    current = cast(current, 'hooper', other(owner), 1).after;
    assert.equal(get(current, ally).powerModifier, Math.min(call, 3) * 2);
    assert.equal(get(current, setup.c).lookoutCalls, Math.min(call, 3));
    assert.equal(get(current, setup.c).powerModifier, 3, 'only one training payout');
    const extra = unit('hooper', other(owner), 1);
    current = playTurnCard({ ...current, phase: owner === 'player' ? 'cpu-reveal' : 'player',
      [other(owner) === 'player' ? 'playerHand' : 'cpuHand']: [{ ...extra, lane: null }],
      [other(owner) === 'player' ? 'playerMotion' : 'cpuMotion']: 9 }, other(owner), extra.instanceId, 2);
    assert.equal(get(current, ally).powerModifier, Math.min(call, 3) * 2, 'second play cannot call twice');
    // Clear test opponents between rounds so lane capacity cannot hide a trigger.
    current = { ...current, boards: current.boards.map(l => l.filter(c => c.owner === owner)) as Match['boards'] };
    if (call < 4) current = nextRound({ ...current, phase: 'resolved' });
  }
});

test('Look Out cannot refresh alone after spending its first call', () => {
  const setup = cast(blank('player', 0), 'look-out', 'player', 0);
  const called = cast(setup.after, 'hooper', 'cpu', 1).after;
  const after = nextRound({ ...called, phase: 'resolved' });
  assert.equal(get(after, setup.c).lookoutReady, false);
});

test('Blue setup cards are playable at exactly their new printed cost', () => {
  for (const [id, motion] of [['triple-og-blue', 4], ['ganger-blue', 2]] as const) {
    const m = blank('player', 0), source = unit(id, 'player', 0);
    assert.equal(source.cost, motion);
    const after = playTurnCard({ ...m, playerMotion: motion, playerHand: [{ ...source, lane: null }] }, 'player', source.instanceId, 0);
    assert.equal(after.playerMotion, 0);
    assert(get(after, source));
  }
});

function losingBlueBoard(owner: Owner, tier: number) {
  const m = blank(owner, tier), enemy = unit('techbro', other(owner), 0);
  enemy.powerModifier = 100;
  enemy.statuses.locked = true;
  m.boards[0] = [enemy];
  return m;
}
for (const owner of owners) for (const tier of [0, 3]) {
  test(`Blue homage preserves one-Hand and immune Blue donors (${owner}, ${tier})`, () => {
    const m = losingBlueBoard(owner, tier);
    const low = unit('look-out', owner, 0); low.powerModifier = 1 - low.basePower;
    const immune = unit('blueside1', owner, 0);
    const tagged = unit('cornball', owner, 0); tagged.gangTag = 'blue';
    m.boards[0].push(low, immune, tagged);
    const result = cast(m, 'triple-og-blue', owner, 0);
    for (const ally of [low, immune, tagged]) assert.equal(get(result.after, ally).powerModifier, ally.powerModifier);
    assert.equal(get(result.after, result.c).powerModifier, 3 + tier);
  });
  test(`Homage caps at four and prioritizes Blue Set over taxing ordinary allies (${owner}, ${tier})`, () => {
    const m = losingBlueBoard(owner, tier);
    const local = ['look-out', 'ganger-blue', 'blue-nose-pit'].map(id => unit(id, owner, 0));
    const remote = unit('cornball', owner, 1); remote.gangTag = 'blue';
    const fifth = unit('hooper', owner, 1); fifth.gangTag = 'blue'; fifth.powerModifier = 10;
    const ordinary = unit('hooper', owner, 2);
    m.boards[0].push(...local); m.boards[1] = [remote, fifth]; m.boards[2] = [ordinary];
    const result = cast(m, 'triple-og-blue', owner, 0);
    assert.equal(get(result.after, result.c).powerModifier, 4 + tier);
    for (const ally of local) assert.equal(get(result.after, ally).powerModifier, 0);
    assert.equal(get(result.after, remote).powerModifier, 2, 'reinforcement, without an homage deduction');
    assert.equal(get(result.after, fifth).powerModifier, 10, 'fifth donor neither pays nor adds more homage');
    assert.equal(get(result.after, ordinary).powerModifier, 0, 'ordinary card is not taxed after Blue fills the cap');
  });
  test(`Ordinary homage retains its one-Hand floor and obeys the four-Hand cap (${owner}, ${tier})`, () => {
    const m = losingBlueBoard(owner, tier);
    const ordinary = Array.from({ length: 5 }, (_, i) => unit('hooper', owner, i < 3 ? 1 : 2));
    const low = unit('cornball', owner, 0); low.powerModifier = 1 - low.basePower;
    m.boards[0].push(low); m.boards[1] = ordinary.slice(0, 3); m.boards[2] = ordinary.slice(3);
    const result = cast(m, 'triple-og-blue', owner, 0);
    assert.equal(get(result.after, result.c).powerModifier, 4 + tier);
    assert.equal(ordinary.reduce((sum, ally) => sum - get(result.after, ally).powerModifier, 0), 4);
    assert.equal(get(result.after, low).powerModifier, low.powerModifier);
  });
}
for (const owner of owners) {
  test(`Blue homage still requires losing the home district (${owner})`, () => {
    const m = blank(owner, 3), ally = unit('ganger-blue', owner, 0);
    m.boards[0] = [ally];
    const result = cast(m, 'triple-og-blue', owner, 0);
    assert.equal(get(result.after, ally).powerModifier, 0);
    assert.equal(get(result.after, result.c).powerModifier, 0);
  });
  test(`Tayaty's Homage echo also caps at four without copying CLUE training (${owner})`, () => {
    const m = losingBlueBoard(owner, 3);
    const blue = Array.from({ length: 5 }, (_, i) => {
      const c = unit('cornball', owner, i < 3 ? 1 : 2); c.gangTag = 'blue'; return c;
    });
    m.boards[1] = blue.slice(0, 3); m.boards[2] = blue.slice(3);
    m.lastRevealedCardId = 'triple-og-blue';
    const result = cast(m, 'tayaty', owner, 0);
    assert.equal(get(result.after, result.c).powerModifier, 5, 'Act Up +1 and capped homage +4');
    assert(blue.every(c => get(result.after, c).powerModifier >= 0), 'echo cannot tax Blue donors');
    assert(!result.after.effectLog.some(e => e.abilityMetadata?.sourceInstanceId === result.c.instanceId
      && e.abilityMetadata.sourceCardId === 'triple-og-blue'));
  });
}
