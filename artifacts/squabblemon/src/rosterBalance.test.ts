import assert from 'node:assert/strict';
import test from 'node:test';
import { cards, cardCatalog } from './data';
import { ROSTER_REVISION_IDS, isActiveOngoing } from '../../../lib/squabblemon-engine/src/rosterBalance';
import { createMatch, createCardInstance, playTurnCard, nextRound, suppressMatchPresentationEvents, type Match, type Owner, type Lane, type CardInstance } from './gameEngine';

const blank = (): Match => ({ ...createMatch('block', 'block'), round: 3, boards: [[], [], []], playerHand: [], cpuHand: [], playerMotion: 9, cpuMotion: 9 });
const unit = (id: string, owner: Owner, lane: Lane, index = 0): CardInstance => ({ ...createCardInstance(id, owner, 'fixture', index), lane });
const find = (m: Match, c: CardInstance) => m.boards.flat().find(x => x.instanceId === c.instanceId)!;
const mark = (m: Match, kind: string) => m.creativeMarks?.find(x => x.kind === kind);
const end = (m: Match) => nextRound({ ...m, phase: 'resolved' });
function cast(m: Match, id: string, owner: Owner, lane: Lane = 0) {
  const source = createCardInstance(id, owner, 'play', m.nextEventSequence);
  return { source, after: playTurnCard({ ...m, phase: owner === 'player' ? 'player' : 'cpu-reveal', [owner === 'player' ? 'playerHand' : 'cpuHand']: [source], playerMotion: 9, cpuMotion: 9 }, owner, source.instanceId, lane) };
}
function unprotect(m: Match, target: CardInstance): Match {
  return { ...m, timedEffects: m.timedEffects.filter(x => x.targetInstanceId !== target.instanceId), boards: m.boards.map(l => l.map(c => c.instanceId === target.instanceId ? { ...c, statuses: { ...c.statuses, protected: false } } : c)) as Match['boards'] };
}

test('40 revisions preserve the 202 collectible identities and instantiate their new budgets', () => {
  assert.equal(new Set(ROSTER_REVISION_IDS).size, 40);
  assert.equal(cardCatalog.length, 202);
  const budgets: Record<string, [number, number]> = { 'atl-scammer': [2, 2], failedathlete: [3, 3], lawyer: [3, 3], 'tattoo-artist': [3, 3], 'inmate-kingpin': [4, 4], 'juneteenth-chair-guy': [4, 4], livewire: [3, 3], subwaymagician: [3, 3], squabbleserver: [1, 2], stylist: [2, 2] };
  for (const [id, pair] of Object.entries(budgets)) {
    const c = createCardInstance(id, 'player');
    assert.deepEqual([c.cost, c.basePower], pair, id);
    assert.equal(c.effect, cards[id].effect);
  }
  assert.equal(cards['the-concert'].cost, 2);
});

for (const owner of ['player', 'cpu'] as const) {
  const enemy: Owner = owner === 'player' ? 'cpu' : 'player';
  test(`${owner}: active-engine targeting beats larger vanilla bodies and ignores disabled engines`, () => {
    for (const id of ['teacher', 'nerd', 'bouncer', 'scammer']) {
      const engine = unit('stockz', enemy, 0), big = { ...unit('og', enemy, 0), basePower: 20 };
      let m = blank(); m.boards[0] = [big, engine];
      const out = cast(m, id, owner); m = out.after;
      if (id === 'bouncer') { assert.notEqual(find(m, engine).lane, 0); assert.equal(find(m, big).lane, 0); }
      else if (id === 'scammer') { assert.equal(find(m, out.source).copiedAbilityCardId, 'stockz'); assert.equal(find(m, out.source).basePower, engine.basePower); }
      else { assert(find(m, engine).statuses.silenced); assert(!find(m, big).statuses.silenced); }
      engine.statuses.silenced = true;
      assert(!isActiveOngoing(engine));
      const fallback = cast({ ...blank(), boards: [[big, engine], [], []] }, id, owner);
      if (id === 'bouncer') assert.notEqual(find(fallback.after, big).lane, 0);
      else if (id === 'scammer') { assert.equal(find(fallback.after, fallback.source).basePower, 7); assert.equal(find(fallback.after, fallback.source).powerModifier, 1); assert.equal(find(fallback.after, fallback.source).copiedAbilityCardId, undefined); }
      else assert(find(fallback.after, big).statuses.silenced);
    }
  });
  test(`${owner}: Nerd earns its interrupt reward only on a successful new silence`, () => {
    for (const protectedTarget of [false, true]) {
      const engine = unit('stockz', enemy, 0);
      let m = blank(); m.boards[0] = [engine];
      if (protectedTarget) m = cast(m, 'bustdown', enemy).after;
      m[enemy === 'player' ? 'playerHand' : 'cpuHand'] = [createCardInstance('og', enemy)];
      const out = cast(m, 'nerd', owner);
      assert.equal(find(out.after, out.source).powerModifier, protectedTarget ? 0 : 1);
      assert.equal(find(out.after, engine).statuses.silenced, !protectedTarget);
    }
  });
  test(`${owner}: Feds prioritize removable bonus over total power and do not record damage`, () => {
    const big = { ...unit('og', enemy, 0), basePower: 20, power: 20 }, bonus = { ...unit('cornball', enemy, 0), powerModifier: 3 };
    const m = cast({ ...blank(), boards: [[big, bonus], [], []] }, 'thefeds', owner).after;
    assert.equal(find(m, bonus).powerModifier, 0); assert(find(m, bonus).statuses.locked);
    assert.equal(find(m, bonus).recoverableDamage ?? 0, 0); assert(!find(m, big).statuses.locked);
  });
  test(`${owner}: Charger needs three characters and protects only a local Electric character`, () => {
    for (const count of [2, 3]) {
      const electric = unit('livewire', owner, 0), friends = [electric, unit('og', owner, 0), unit('cornball', owner, 0)].slice(0, count);
      const m = cast({ ...blank(), boards: [friends, [], []] }, 'charger', owner).after;
      assert.equal(find(m, electric).statuses.protected, count === 3);
      assert(m[owner === 'player' ? 'playerMotion' : 'cpuMotion'] <= 9);
      assert(!find(m, friends[1]).statuses.protected);
    }
  });
  test(`${owner}: Cognac grants three to Fire and two to another element`, () => {
    for (const id of ['youngbull', 'cornball']) {
      const target = unit(id, owner, 0);
      const m = cast({ ...blank(), boards: [[target], [], []] }, 'cognac', owner).after;
      assert.equal(find(m, target).powerModifier, cards[id].type === 'Fire' ? 3 : 2);
    }
  });
  test(`${owner}: Stylist refreshes once after movement, never on a blocked move`, () => {
    const ally = unit('cornball', owner, 0);
    let m = cast({ ...blank(), boards: [[ally], [], []] }, 'stylist', owner).after;
    assert.equal(find(m, ally).powerModifier, 1); assert(find(m, ally).statuses.protected);
    m = unprotect(m, ally);
    m.boards[0] = m.boards[0].map(c => c.instanceId === ally.instanceId ? { ...c, statuses: { ...c.statuses, locked: true } } : c);
    m = cast(m, 'subwaymap', owner).after;
    assert(mark(m, 'fitting')); assert(!find(m, ally).statuses.protected);
    m.boards[0] = m.boards[0].map(c => c.instanceId === ally.instanceId ? { ...c, statuses: { ...c.statuses, locked: false } } : c);
    m = cast(m, 'subwaymap', owner).after;
    assert.notEqual(find(m, ally).lane, 0); assert(find(m, ally).statuses.protected); assert(!mark(m, 'fitting'));
    m = unprotect(m, ally); m = cast(m, 'subwaymap', owner, find(m, ally).lane!).after;
    assert(!find(m, ally).statuses.protected);
  });
  test(`${owner}: Chess completes its second mark without immediately dealing damage`, () => {
    const first = unit('og', enemy, 0);
    let m = cast({ ...blank(), boards: [[first], [], []] }, 'chessregular', owner, 2).after;
    assert.equal(mark(m, 'fork')?.targets.length, 1);
    const second = cast(m, 'og', enemy, 1); m = second.after;
    assert(mark(m, 'fork')?.ready); assert.equal(find(m, first).powerModifier, 0);
    assert.equal(find(m, second.source).powerModifier, 0);
    m = cast(JSON.parse(JSON.stringify(m)), 'og', enemy, 0).after;
    assert.equal(find(m, second.source).powerModifier, -2); assert.equal(find(m, first).powerModifier, 0);
    assert(!mark(m, 'fork'));
  });
  test(`${owner}: Drama survives two quiet rounds and pays exactly one branch`, () => {
    const foe = unit('og', enemy, 0);
    const out = cast({ ...blank(), boards: [[foe], [], []] }, 'bbldemon', owner);
    let m = end(end(out.after)); assert(mark(m, 'drama'));
    m = cast(m, 'og', enemy, 1).after;
    assert.equal(find(m, out.source).powerModifier, 2); assert(!mark(m, 'drama'));
    m = cast(m, 'og', enemy, 2).after; assert.equal(find(m, out.source).powerModifier, 2);
  });
  test(`${owner}: Ahki pays departure then actual homecoming, not an intermediate move`, () => {
    for (const fast of [false, true]) {
      const ally = unit('cornball', owner, 0);
      let m = { ...blank(), boards: [[ally], [], []] as Match['boards'] };
      if (fast) m = suppressMatchPresentationEvents(m);
      m = cast(m, 'ahki', owner).after;
      m = cast(m, 'subwaymap', owner).after;
      assert.equal(find(m, ally).powerModifier, 3); // reveal + departure + Map
      m = cast(m, 'subwaymap', owner, 1).after;
      assert.equal(find(m, ally).lane, 2); assert.equal(find(m, ally).powerModifier, 4);
      assert(mark(m, 'loyalty'));
      m = cast(m, 'the-kickback', owner, 0).after;
      assert.equal(find(m, ally).lane, 0); assert.equal(find(m, ally).powerModifier, 5);
      assert(!mark(m, 'loyalty'));
    }
  });
  test(`${owner}: Divorced Dad pays a deliberate timely homecoming and does not force it`, () => {
    const ally = unit('cornball', owner, 1);
    const start = cast({ ...blank(), boards: [[], [ally], []] }, 'divorceddad', owner).after;
    assert.equal(find(end(end(start)), ally).lane, 0);
    const home = cast(start, 'break', owner).after;
    assert.equal(find(home, ally).lane, 1); assert.equal(find(home, ally).powerModifier, 1); assert(!mark(home, 'visit'));
  });
  test(`${owner}: Verse pays a movement arrival only once`, () => {
    const ally = unit('cornball', owner, 1);
    let m = cast({ ...blank(), boards: [[], [ally], []] }, 'failedrapper', owner).after;
    m = cast(m, 'vibe', owner).after;
    assert.equal(find(m, ally).powerModifier, 3); assert(!mark(m, 'verse'));
    const later = cast(m, 'cornball', owner);
    assert.equal(find(later.after, later.source).powerModifier, 0);
  });
  test(`${owner}: Busker pays its first visitor before a second is available`, () => {
    const a = unit('cornball', owner, 1), b = unit('og', owner, 2);
    const busker = unit('busker', owner, 0);
    let m = { ...blank(), boards: [[busker], [a], [b]] as Match['boards'] };
    const firstVibe = cast(m, 'vibe', owner); m = firstVibe.after;
    assert.equal(find(m, a).powerModifier, 2); // first tip + Vibe
    const secondVibe = cast(m, 'vibe', owner); m = secondVibe.after;
    assert.equal(find(m, a).powerModifier, 2); assert.equal(find(m, firstVibe.source).powerModifier, 1);
    assert.equal(find(m, secondVibe.source).powerModifier, 3); assert.equal(find(m, b).powerModifier, 1);
    assert.equal(find(m, busker).creativeRound, m.round);
  });
  test(`${owner}: Dance Captain lets an ordinary character follow a dancer once`, () => {
    const dancer = { ...unit('break', owner, 1), basePower: 1 }, follower = unit('og', owner, 2), captain = unit('dancecaptain', owner, 0);
    let m = { ...blank(), boards: [[captain], [dancer], [follower]] as Match['boards'] };
    m = cast(m, 'vibe', owner).after;
    assert.equal(find(m, dancer).powerModifier, 1);
    m = cast(m, 'vibe', owner).after;
    assert.equal(find(m, follower).powerModifier, 3); assert.equal(find(m, captain).creativeCount, 1);
  });
  test(`${owner}: Father can tutor a high-Hands ally but never tutors that ally twice`, () => {
    const ally = unit('og', owner, 0);
    let m = cast({ ...blank(), boards: [[ally], [], []] }, 'nigerian-father', owner).after;
    assert.equal(find(m, ally).powerModifier, 1); assert(find(m, ally).creativeUsed?.tutored);
    m = { ...m, boards: [[find(m, ally)], [], []] };
    m = cast(m, 'workboots', owner).after;
    assert.equal(find(m, ally).powerModifier, 3);
    m = end(end(m));
    assert.equal(find(m, ally).powerModifier, 5); assert(!mark(m, 'goal'));
    m = { ...m, boards: [[find(m, ally)], [], []] };
    m = cast(m, 'nigerian-father', owner).after;
    assert.equal(find(m, ally).powerModifier, 5); assert(!mark(m, 'goal'));
  });
  test(`${owner}: Ice Cream pays an existing ally immediately or waits for a later arrival`, () => {
    const ally = unit('cornball', owner, 0);
    let m = cast({ ...blank(), boards: [[ally], [], []] }, 'icecream', owner).after;
    assert.equal(find(m, ally).powerModifier, 2); assert(!mark(m, 'treat'));
    const late = cast(m, 'cornball', owner); assert.equal(find(late.after, late.source).powerModifier, 0);
    m = cast(blank(), 'icecream', owner).after; assert(mark(m, 'treat'));
    const arrival = cast(m, 'cornball', owner); assert.equal(find(arrival.after, arrival.source).powerModifier, 2); assert(!mark(arrival.after, 'treat'));
  });
  test(`${owner}: Rent-a-Cop warning hits a stationary play for one and is consumed`, () => {
    let m = cast(blank(), 'rent-a-cop', owner).after;
    const foe = cast(m, 'og', enemy); m = foe.after;
    assert.equal(find(m, foe.source).powerModifier, -1); assert(!mark(m, 'warning'));
    const next = cast(m, 'og', enemy); assert.equal(find(next.after, next.source).powerModifier, 0);
  });
  test(`${owner}: Hookah fallback is once per round even with several fully burning destinations`, () => {
    const hookah = unit('godofhookah', owner, 0);
    const foes = ([0, 1, 2] as Lane[]).map(l => { const c = unit('og', enemy, l, l); c.statuses.burnStacks = 1; return c; });
    const m = end({ ...blank(), boards: [[hookah, foes[0]], [foes[1]], [foes[2]]] });
    assert.equal(find(m, hookah).powerModifier, 1);
    assert(foes.every(c => find(m, c).powerModifier === -1));
  });
  test(`${owner}: Cookout sends both meals to an occupied lane and its plate cannot burn twice`, () => {
    const ally = unit('og', owner, 2);
    let m = cast({ ...blank(), boards: [[], [], [ally]] }, 'the-cookout', owner).after;
    assert.equal(find(m, ally).powerModifier, 2);
    assert(m.boards.flat().filter(c => c.cardId === 'soulfood').every(c => c.lane === 2));
    m = end(m); assert.equal(find(m, ally).powerModifier, 1);
    m = end(m); assert.equal(find(m, ally).powerModifier, 1);
    assert(!m.boards.flat().some(c => c.cardId === 'burnt-plate'));
  });
  test(`${owner}: Cloudbreak rewards the ally left behind only after a successful move`, () => {
    const ally = unit('cornball', owner, 0);
    const out = cast({ ...blank(), boards: [[ally], [], []] }, 'cloudbreak', owner);
    assert.notEqual(find(out.after, out.source).lane, 0);
    assert.equal(find(out.after, ally).powerModifier, 2); assert(find(out.after, ally).statuses.protected);
  });
  test(`${owner}: Coach retries the newly eligible Barber and stops after success`, () => {
    const barber = cast(blank(), 'barber', owner);
    assert.equal(find(barber.after, barber.source).creativeEntranceSucceeded, false);
    let m = cast(barber.after, 'cornercoach', owner).after;
    assert(mark(m, 'coach')?.ready);
    const arrival = cast(m, 'cornball', owner); m = arrival.after;
    assert.equal(find(m, arrival.source).powerModifier, 1); assert(!mark(m, 'coach'));
    m = cast(m, 'cornball', owner, 1).after;
    assert.equal(find(m, arrival.source).powerModifier, 1);
  });
  test(`${owner}: Redneck Evil detonates when its primed target dies before Burn, once`, () => {
    const victim = { ...unit('cornball', enemy, 0), basePower: 2 }, neighbor = unit('cornball', enemy, 0, 1);
    let m = cast({ ...blank(), boards: [[victim, neighbor], [], []] }, 'redneck-evil', owner).after;
    assert(mark(m, 'primer'));
    m = cast(m, 'inmate-informant', owner).after;
    assert.equal(find(m, victim), undefined); assert.equal(find(m, neighbor), undefined);
    assert(!mark(m, 'primer'));
    const later = cast(m, 'og', enemy); m = end(later.after);
    assert.equal(find(m, later.source).powerModifier, find(later.after, later.source).powerModifier);
  });
  test(`${owner}: fully prevented Burn cannot award Hookah's fallback`, () => {
    const hookah = unit('godofhookah', owner, 2), victim = unit('og', enemy, 0), adjacent = unit('og', enemy, 1, 1);
    let m = cast({ ...blank(), boards: [[victim], [adjacent], [hookah]] }, 'firstaid', enemy).after;
    m = { ...m, boards: m.boards.map(l => l.map(c => c.instanceId === victim.instanceId || c.instanceId === adjacent.instanceId ? {
      ...c, statuses: { ...c.statuses, burnStacks: 1, uncounterable: c.instanceId === adjacent.instanceId }, burnSource: { instanceId: hookah.instanceId, owner }
    } : c)) as Match['boards'] };
    m = end(m);
    assert.equal(find(m, victim).powerModifier, 0); assert.equal(find(m, hookah).powerModifier, 0);
  });
}
