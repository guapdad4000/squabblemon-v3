import assert from 'node:assert/strict';
import { FULL_ROSTER_BUFFS } from '../../../lib/squabblemon-engine/src/fullRosterBuffs';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { cards, ELEMENTAL_HAND_BONUS_CARDS } from './data';
import { CARD_BALANCE_VERSION, ONLINE_RULES_VERSION } from '@workspace/squabblemon-engine/multiplayer';
import {
  createAbilityUpgradeSnapshot, createCardInstance, createMatch, getCharacterDistrictMarks, nextRound, playTurnCard,
  type CardInstance, type Lane, type Match, type Owner,
} from './gameEngine';

const frozen = JSON.parse(readFileSync(new URL('../../../scripts/results/all-decks-v35-no-guap/catalog-snapshot.json', import.meta.url), 'utf8'));
const plan = JSON.parse(readFileSync(new URL('../../../scripts/results/all-decks-v35-no-guap/plan.json', import.meta.url), 'utf8'));
const owners = ['player', 'cpu'] as const;
const enemyOf = (owner: Owner): Owner => owner === 'player' ? 'cpu' : 'player';
const json = <T>(value: T): T => JSON.parse(JSON.stringify(value));
const blank = (owner: Owner = 'player', tier = 0, ids: string[] = []): Match => ({
  ...createMatch('block', 'block'), round: 3, playerMotion: 9, cpuMotion: 9,
  playerHand: [], cpuHand: [], boards: [[], [], []], playerDrawIndex: 100, cpuDrawIndex: 100,
  abilityUpgradeSnapshot: createAbilityUpgradeSnapshot(
    owner === 'player' ? ids : [], owner === 'cpu' ? ids : [],
    { [owner]: Object.fromEntries(ids.map(id => [id, { xp: tier ? 4500 : 0, level: tier ? 10 : 1, moveTier: tier }])) },
  ),
});
const unit = (id: string, owner: Owner, lane: Lane, index = 1): CardInstance => ({
  ...createCardInstance(id, owner, 'crew-parity-fixture', index), lane,
});
const find = (m: Match, c: CardInstance): CardInstance => {
  const found = m.boards.flat().find(x => x.instanceId === c.instanceId);
  assert(found, `${c.cardId} (${c.instanceId}) should remain on board`);
  return found;
};
function cast(m: Match, id: string, owner: Owner = 'player', lane: Lane = 0, statuses: Partial<CardInstance['statuses']> = {}, motion = 9) {
  const source = createCardInstance(id, owner, 'crew-parity-cast', m.nextEventSequence);
  source.statuses = { ...source.statuses, ...statuses };
  const hand = owner === 'player' ? 'playerHand' : 'cpuHand';
  const after = playTurnCard({
    ...m, phase: owner === 'player' ? 'player' : 'cpu-reveal',
    [owner === 'player' ? 'playerMotion' : 'cpuMotion']: motion, [hand]: [source],
  }, owner, source.instanceId, lane);
  return { source, after };
}
const advance = (m: Match) => nextRound({ ...m, phase: 'resolved' });
const remove = (m: Match, source: CardInstance): Match => ({
  ...m, boards: m.boards.map(lane => lane.filter(c => c.instanceId !== source.instanceId)) as Match['boards'],
});
function cover(m: Match, c: CardInstance) {
  c.statuses.protected = true;
  m.timedEffects.push({ id: `cover:${c.instanceId}`, kind: 'church-protection', owner: c.owner,
    sourceInstanceId: c.instanceId, targetInstanceId: c.instanceId, lane: c.lane!,
    startsAtRound: 1, expiresAtRound: 99, expiration: 'match-complete' });
}
const traps = (m: Match, kind: string) => (m.districtTraps ?? []).filter(t => t.kind === kind);

test('crew parity rules 45 preserves other stats outside approved rivalry and Combo buffs', () => {
  assert.equal(CARD_BALANCE_VERSION, 50);
  assert.equal(ONLINE_RULES_VERSION, 50);
  assert.equal(frozen.balanceVersion, 35);
  for (const [id, old] of Object.entries(frozen.cards) as [string, { cost: number; power: number }][]) {
    const discounted: Record<string, number> = { 'ganger-blue': 2, 'techbro': 3 };
    assert.equal(cards[id].cost, discounted[id] ?? old.cost, `${id} Motion`);
    assert.equal(cards[id].power, FULL_ROSTER_BUFFS[id] ?? (id === 'techbro' ? 4 : ['cane-corso-red', 'streamer'].includes(id) ? 3 : old.power), `${id} printed Hands`);
  }
});

test('exact frozen v35 shared Air/Water audit rosters and GUAP retain assembled kits', () => {
  assert.equal(plan.balanceVersion, 35);
  const rosters = plan.decks.filter((d: { id: string }) => ['element-air', 'element-water'].includes(d.id));
  assert.equal(rosters.length, 2);
  const ids = [...new Set<string>(rosters.flatMap((d: { cardIds: string[] }) => d.cardIds))];
  assert.equal(ids.length, 20);
  for (const id of [...ids, 'guap']) {
    const old = frozen.cards[id];
    assert(old, `${id} exists in frozen assembled catalog`);
    const actual = Object.fromEntries(Object.keys(old).map(key => [key, (cards[id] as unknown as Record<string, unknown>)[key]]));
    assert.deepEqual(json(actual), old, `${id} assembled kit must not drift`);
  }
});

test('all ten elemental hand-provider identities remain unchanged', () => {
  assert.deepEqual(ELEMENTAL_HAND_BONUS_CARDS, {
    Light: 'abuela', Plant: 'gardener', Earth: 'torta', Air: 'slipstream', Dark: 'gamer',
    Poison: 'nail', Normal: 'barber', Fire: 'guap', Water: 'monsoonanchor', Electric: 'piratedj',
  });
});

test('Blue Triple OG pays declared training once for actual displacement, even through reveal disables', () => {
  for (const owner of owners) for (const tier of [0, 3]) for (const status of ['silenced', 'frozen', 'weakened'] as const) {
    const m = blank(owner, tier, ['triple-og-blue']);
    const foe = unit('hooper', enemyOf(owner), 0);
    m.boards[0] = [foe];
    const result = cast(m, 'triple-og-blue', owner, 0, { [status]: true });
    assert.notEqual(find(result.after, foe).lane, 0, 'sanctioned reveal still displaces');
    assert.equal(find(result.after, result.source).powerModifier, tier, 'three +1 upgrades, not recursively trained');
    assert.throws(() => cast(m, 'triple-og-blue', owner, 1), /left|district|lane/i);
  }
});

test('Blue Triple OG pays training for positive homage, but not a completely empty no-op', () => {
  for (const owner of owners) {
    const m = blank(owner, 3, ['triple-og-blue']);
    const ally = unit('hooper', owner, 1);
    const foe = unit('techbro', enemyOf(owner), 0);
    foe.powerModifier = 20;
    foe.statuses.locked = true;
    m.boards = [[foe], [ally], []];
    const result = cast(m, 'triple-og-blue', owner);
    assert.equal(find(result.after, ally).powerModifier, -1, 'actual side homage');
    assert.equal(find(result.after, result.source).powerModifier, 4, 'one homage plus exactly three training');
    const noOp = cast(blank(owner, 3, ['triple-og-blue']), 'triple-og-blue', owner);
    assert.equal(find(noOp.after, noOp.source).powerModifier, 0);
  }
});

test('Look Out trains only on the first actual enemy call, not on arming or later plays', () => {
  for (const owner of owners) for (const tier of [0, 3]) {
    const watching = cast(blank(owner, tier, ['look-out']), 'look-out', owner, 1);
    assert.equal(find(watching.after, watching.source).powerModifier, 0);
    const called = cast(watching.after, 'oink', enemyOf(owner), 2).after;
    assert.equal(find(called, watching.source).powerModifier, tier);
    assert.equal(called.discountTokens.filter(t => t.sourceInstanceId === watching.source.instanceId).length, 1);
    const later = cast(called, 'plug', enemyOf(owner), 0).after;
    assert.equal(find(later, watching.source).powerModifier, tier);
    assert.equal(later.discountTokens.filter(t => t.sourceInstanceId === watching.source.instanceId).length, 1);
  }
});

test('disabled or removed Look Out cannot call or train', () => {
  for (const owner of owners) for (const status of ['silenced', 'frozen', 'weakened', 'removed'] as const) {
    const watching = cast(blank(owner, 3, ['look-out']), 'look-out', owner, 1);
    let m = json(watching.after);
    if (status === 'removed') m = remove(m, watching.source);
    else find(m, watching.source).statuses[status] = true;
    const after = cast(m, 'oink', enemyOf(owner), 2).after;
    assert.equal(after.discountTokens.filter(t => t.sourceInstanceId === watching.source.instanceId).length, 0);
    if (status !== 'removed') assert.equal(find(after, watching.source).powerModifier, 0);
  }
});

test('Initiation grants entrant +2 base/+5 tier3 even after source removal', () => {
  for (const owner of owners) for (const tier of [0, 3]) {
    const armed = cast(blank(owner, tier, ['initiation']), 'initiation', owner, 1);
    const first = cast(remove(armed.after, armed.source), 'cornball', owner, 1);
    assert.equal(find(first.after, first.source).powerModifier, 2 + tier);
    assert.equal(traps(first.after, 'initiation').length, 0);
    const second = cast(first.after, 'cornball', owner, 1);
    assert.equal(find(second.after, second.source).powerModifier, 0, 'spent mark cannot train a second entrant');
  }
});

test('Initiation keeps majority/tie/no-faction rules, including natural Blue-Nose membership', () => {
  for (const owner of owners) for (const [ids, color] of [
    [[], undefined], [['blue-nose-pit'], 'blue'], [['ganger-blue', 'ganger-red'], undefined],
    [['ganger-blue', 'blue-nose-pit', 'ganger-red'], 'blue'], [['ganger-red'], 'red'],
  ] as const) {
    const m = blank();
    m.boards[1] = ids.map((id, index) => unit(id, owner, 1, index));
    const armed = cast(m, 'initiation', owner, 1).after;
    const joined = cast(armed, 'cornball', owner, 1);
    assert.equal(find(joined.after, joined.source).gangTag, color, ids.join(','));
    assert.equal(find(joined.after, joined.source).powerModifier, 2);
  }
});

test('Initiation ignores support and movement arrivals; replacement trains only the consuming source once', () => {
  for (const owner of owners) {
    let m = cast(blank(owner, 3, ['initiation']), 'initiation', owner, 1).after;
    m = cast(m, 'soulfood', owner, 1).after;
    assert.equal(traps(m, 'initiation').length, 1, 'support does not consume');
    const traveler = cast(m, 'gust', owner, 0);
    assert.equal(find(traveler.after, traveler.source).lane, 1);
    assert.equal(traps(traveler.after, 'initiation').length, 1, 'successful move does not consume');
    const replaced = cast(traveler.after, 'initiation', owner, 1).after;
    assert.equal(traps(replaced, 'initiation').length, 1);
    const entrant = cast(replaced, 'cornball', owner, 1);
    assert.equal(find(entrant.after, entrant.source).powerModifier, 5, 'not +8 from the replaced mark');
  }
});

test('Initiation restored/echoed marks keep base recruitment but never double-train a source', () => {
  for (const owner of owners) {
    const setup = cast(blank(owner, 3, ['initiation']), 'initiation', owner, 1);
    const mark = json(traps(setup.after, 'initiation')[0]);
    const first = cast(setup.after, 'cornball', owner, 1);
    assert.equal(find(first.after, first.source).powerModifier, 5);
    const restored = json(first.after);
    restored.districtTraps = [...(restored.districtTraps ?? []), mark];
    const second = cast(restored, 'cornball', owner, 1);
    assert.equal(find(second.after, second.source).powerModifier, 2, 'same source has already paid training');

    // Public replay snapshots carry the echoed-setup flag independently of a live source.
    const echoed = json(setup.after);
    echoed.districtTraps = echoed.districtTraps!.map(t => ({ ...t, echoed: true }));
    const recruit = cast(remove(echoed, setup.source), 'cornball', owner, 1);
    assert.equal(find(recruit.after, recruit.source).powerModifier, 2, 'an echo keeps base +2 only');
  }
});

test('Ganger Blue covers the weakest remote other ally for +3, or +4 for natural/tagged Blue', () => {
  for (const owner of owners) for (const membership of ['ordinary', 'natural', 'tagged'] as const) {
    const m = blank();
    const weak = unit(membership === 'natural' ? 'blue-nose-pit' : 'cornball', owner, 2);
    if (membership === 'tagged') weak.gangTag = 'blue';
    const strong = unit('techbro', owner, 1, 2);
    strong.powerModifier = 10;
    const local = unit('cornball', owner, 0, 3);
    m.boards = [[local], [strong], [weak]];
    const result = cast(m, 'ganger-blue', owner);
    assert.equal(find(result.after, weak).powerModifier, membership === 'ordinary' ? 3 : 4);
    assert(find(result.after, weak).statuses.protected);
    assert.equal(find(result.after, strong).powerModifier, 10);
    assert.equal(find(result.after, local).powerModifier, 0);
    const solo = cast(blank(), 'ganger-blue', owner);
    assert.equal(find(solo.after, solo.source).powerModifier, 1);
  }
});

test('Blue-Nose Pit first delayed OG support trains once, with OG +1 and no dog base growth', () => {
  for (const owner of owners) for (const tier of [0, 3]) {
    const dog = cast(blank(owner, tier, ['blue-nose-pit']), 'blue-nose-pit', owner, 1);
    assert.equal(find(dog.after, dog.source).powerModifier, 0, 'no OG, no training');
    const og = cast(dog.after, 'triple-og-blue', owner, 0);
    const supported = advance(og.after);
    assert.equal(find(supported, dog.source).lane, 0);
    assert.equal(find(supported, dog.source).powerModifier, tier + 2);
    assert.equal(find(supported, og.source).powerModifier, 1);
    const again = advance(supported);
    assert.equal(find(again, dog.source).powerModifier, tier + 2, 'later support cannot repeat first-success training');
    assert.equal(find(again, og.source).powerModifier, 2, 'base OG support remains once per round');
  }
});

test('disabled Blue-Nose Pit waits for real support before its first training payout', () => {
  for (const owner of owners) {
    const dog = cast(blank(owner, 3, ['blue-nose-pit']), 'blue-nose-pit', owner, 0);
    const og = unit('triple-og-blue', owner, 0, 9);
    dog.after.boards[0].push(og);
    find(dog.after, dog.source).statuses.silenced = true;
    const disabled = advance(dog.after);
    assert.equal(find(disabled, dog.source).powerModifier, 0);
    assert.equal(find(disabled, og).powerModifier, 0);
    find(disabled, dog.source).statuses.silenced = false;
    const active = advance(disabled);
    assert.equal(find(active, dog.source).powerModifier, 3);
    assert.equal(find(active, og).powerModifier, 1);
  }
});

test('Sherlock watches both other districts, skips passive entrances, and shares ONE cancellation/reward', () => {
  for (const owner of owners) for (const tier of [0, 3]) {
    const m = blank(owner, tier, ['sherlock']);
    const ally = unit('cornball', owner, 1);
    m.boards[1] = [ally];
    const setup = cast(m, 'sherlock', owner, 1);
    assert.deepEqual(traps(setup.after, 'stakeout').map(t => t.lane).sort(), [0, 2]);
    const passive = cast(setup.after, 'tinman', enemyOf(owner), 0);
    assert.equal(traps(passive.after, 'stakeout').length, 2);
    assert(!find(passive.after, passive.source).statuses.silenced);
    const caught = cast(passive.after, 'plug', enemyOf(owner), 2);
    assert.equal(caught.after.discountTokens.filter(t => t.sourceInstanceId === caught.source.instanceId).length, 0, 'entrance canceled');
    assert.equal(traps(caught.after, 'stakeout').length, 0, 'both source marks consumed together');
    assert.equal(find(caught.after, setup.source).powerModifier - find(setup.after, setup.source).powerModifier, 2);
    assert.equal(find(caught.after, ally).powerModifier, 2);
    const later = cast(caught.after, 'plug', enemyOf(owner), 0);
    assert.equal(later.after.discountTokens.filter(t => t.sourceInstanceId === later.source.instanceId).length, 1, 'other district cannot cancel again');
    assert.equal(find(later.after, ally).powerModifier, 2);
  }
});

test('Sherlock excludes own district, persists through next round, then expires', () => {
  for (const owner of owners) {
    const setup = cast(blank(), 'sherlock', owner, 1);
    const local = cast(setup.after, 'cornball', enemyOf(owner), 1);
    assert.equal(find(local.after, setup.source).statuses.burnStacks, 1, 'own district entrance resolves normally');
    assert.equal(traps(local.after, 'stakeout').length, 2);
    const next = advance(local.after);
    assert.equal(traps(next, 'stakeout').length, 2);
    const caught = cast(next, 'plug', enemyOf(owner), 0);
    assert.equal(caught.after.discountTokens.filter(t => t.sourceInstanceId === caught.source.instanceId).length, 0);
    const expired = advance(next);
    assert(!getCharacterDistrictMarks(expired).some(mark => mark.text.includes('Stakeout')));
    const late = cast(expired, 'plug', enemyOf(owner), 0);
    assert.equal(late.after.discountTokens.filter(t => t.sourceInstanceId === late.source.instanceId).length, 1, 'expired stakeout cannot cancel');
  }
});

test('Sherlock only stakes out the other districts unlocked for its enemy', () => {
  for (const owner of owners) {
    const m = blank();
    m.storyEncounter = {
      id: 'crew-parity-lock', battlefieldAssetId: '', soundHooks: {},
      enemy: { id: 'crew-parity-enemy', name: 'Enemy', portraitAssetId: '', deckId: 'block',
        cardIds: ['cornball'], behaviorProfile: 'balanced' },
      modifiers: { laneLocks: [{ round: 3, owner: enemyOf(owner), lanes: [2] }] },
    };
    const setup = cast(m, 'sherlock', owner, 1);
    assert.deepEqual(traps(setup.after, 'stakeout').map(t => t.lane), [0]);
    assert.equal(traps(setup.after, 'stakeout')[0].expiresAfterRound, 4);
  }
});

test('Sherlock shared marks replay deterministically and source death/disable suppresses reward, not stakeout', () => {
  for (const owner of owners) for (const disabled of ['removed', 'silenced', 'frozen', 'weakened'] as const) {
    const m = blank(), ally = unit('cornball', owner, 1);
    m.boards[1] = [ally];
    const setup = cast(m, 'sherlock', owner, 1);
    let ready = json(setup.after);
    if (disabled === 'removed') ready = remove(ready, setup.source);
    else find(ready, setup.source).statuses[disabled] = true;
    const action = (state: Match) => cast(state, 'plug', enemyOf(owner), 2);
    const a = action(json(ready)), b = action(json(ready));
    assert.deepEqual(a.after, b.after, 'serialized public match snapshot has deterministic continuation');
    assert.equal(a.after.discountTokens.filter(t => t.sourceInstanceId === a.source.instanceId).length, 0);
    assert.equal(traps(a.after, 'stakeout').length, 0);
    assert.equal(find(a.after, ally).powerModifier, 0);
    if (disabled !== 'removed') assert.equal(find(a.after, setup.source).powerModifier, 0);
  }
});

test('OG Vegan gives other friendly Plant +2 and retains self +1; tier3 training stays bounded', () => {
  for (const owner of owners) for (const tier of [0, 3]) {
    const m = blank(owner, tier, ['sprout']), plant = unit('rastamon', owner, 0);
    m.boards[0] = [plant];
    const result = cast(m, 'sprout', owner);
    assert.equal(find(result.after, plant).powerModifier, 2);
    assert.equal(find(result.after, result.source).powerModifier, 1 + tier);
    const solo = cast(blank(owner, tier, ['sprout']), 'sprout', owner);
    assert.equal(find(solo.after, solo.source).powerModifier, 0, 'no self-only Plant fallback');
  }
});

test('Matcha preserves high-Motion self +2 and afflicted cleanse +1; fallback is OTHER local Plant only', () => {
  for (const owner of owners) {
    const high = cast(blank(), 'rootnurse', owner, 0, {}, 6);
    assert.equal(find(high.after, high.source).powerModifier, 2);
    const dirty = unit('cornball', owner, 0);
    dirty.statuses.frozen = true;
    const m = blank(); m.boards[0] = [dirty];
    const cleaned = cast(m, 'rootnurse', owner, 0, {}, 5);
    assert(!find(cleaned.after, dirty).statuses.frozen);
    assert.equal(find(cleaned.after, dirty).powerModifier, 1);
    const local = unit('rastamon', owner, 0, 2), generic = unit('cornball', owner, 0, 3);
    const remote = unit('sprout', owner, 2, 4);
    const fallback = blank(); fallback.boards = [[local, generic], [], [remote]];
    const result = cast(fallback, 'rootnurse', owner, 0, {}, 5);
    assert.equal(find(result.after, local).powerModifier, 1);
    assert.equal(find(result.after, generic).powerModifier, 0);
    assert.equal(find(result.after, remote).powerModifier, 0);
    assert.equal(find(result.after, result.source).powerModifier, 0);
    const solo = cast(blank(), 'rootnurse', owner, 0, {}, 5);
    assert.equal(find(solo.after, solo.source).powerModifier, 0);
  }
});

test('Spare Gus retains remote hit2/local weakestother+1 and adds exactly ONE remote Plant +1', () => {
  for (const owner of owners) {
    const m = blank(), local = unit('cornball', owner, 0);
    const plant1 = unit('rastamon', owner, 1, 2), plant2 = unit('sprout', owner, 2, 3);
    const foe = unit('techbro', enemyOf(owner), 2, 4); foe.powerModifier = 10;
    m.boards = [[local], [plant1], [plant2, foe]];
    const result = cast(m, 'gardenwall', owner);
    assert.equal(find(result.after, foe).powerModifier, 8);
    assert.equal(find(result.after, local).powerModifier, 1);
    assert.equal(find(result.after, plant1).powerModifier + find(result.after, plant2).powerModifier, 1);
    assert.equal(find(result.after, result.source).powerModifier, 0);
  }
});

test('Torta immediately Protects its Earth partner, then grants +3 each once on next round', () => {
  for (const owner of owners) {
    const m = blank(), partner = unit('manman', owner, 0);
    m.boards[0] = [partner];
    const setup = cast(m, 'torta', owner);
    assert(find(setup.after, partner).statuses.protected, 'successful pair immediately protects partner');
    assert.equal(find(setup.after, partner).powerModifier, 0, 'payoff remains delayed');
    const next = advance(setup.after);
    assert.equal(find(next, partner).powerModifier, 0, 'next-round payoff is at round END, not start');
    const paid = advance(next);
    assert.equal(find(paid, partner).powerModifier, 3);
    assert.equal(find(paid, setup.source).powerModifier, 3);
    const again = advance(paid);
    assert.equal(find(again, partner).powerModifier, 3);
    assert.equal(find(again, setup.source).powerModifier, 3);
    const noPair = cast(blank(owner, 3, ['torta']), 'torta', owner);
    assert.equal(find(noPair.after, noPair.source).powerModifier, 0, 'no setup, no training');
    assert.equal(noPair.after.creativeMarks?.filter(x => x.kind === 'ground').length ?? 0, 0);
  }
});

test('Torta one pair per side requires both here and not losing, and pays at final round end', () => {
  for (const owner of owners) {
    const m = blank(), partner = unit('manman', owner, 0);
    m.boards[0] = [partner];
    const first = cast(m, 'torta', owner);
    const second = cast(first.after, 'torta', owner);
    assert.equal(second.after.creativeMarks?.filter(x => x.kind === 'ground' && x.owner === owner).length, 1);
    const lostPartner = advance(remove(first.after, partner));
    assert.equal(find(lostPartner, first.source).powerModifier, 0);
    const losing = json(first.after), foe = unit('techbro', enemyOf(owner), 0, 30);
    foe.powerModifier = 30; losing.boards[0].push(foe);
    assert.equal(find(advance(losing), first.source).powerModifier, 0);
    const final = json(m); final.round = 6;
    const lastPair = cast(final, 'torta', owner);
    const paid = advance(lastPair.after);
    assert.equal(find(paid, partner).powerModifier, 3);
    assert.equal(find(paid, lastPair.source).powerModifier, 3);
  }
});

test('Concrete remote parcels cleanse, give Earth+2/others+1, and stay one-use/expiring after source death', () => {
  for (const owner of owners) for (const earth of [false, true]) {
    const setup = cast(blank(), 'concrete', owner, 0);
    const ready = remove(setup.after, setup.source);
    const entrant = cast(ready, earth ? 'manman' : 'cornball', owner, 1,
      { frozen: true, silenced: true, weakened: true, burnStacks: 2 });
    const opened = find(entrant.after, entrant.source);
    assert.equal(opened.powerModifier, earth ? 2 : 1, 'disabled entrant has no reveal buff');
    assert.equal(opened.statuses.burnStacks, 0);
    assert(!opened.statuses.frozen && !opened.statuses.silenced && !opened.statuses.weakened);
    assert.equal(entrant.after.creativeMarks?.filter(x => x.kind === 'home-parcel' && x.lane === 1).length, 0);
    const again = cast(entrant.after, 'manman', owner, 1, { silenced: true });
    assert.equal(find(again.after, again.source).powerModifier, 0);
    const expired = advance(advance(ready));
    assert.equal(expired.creativeMarks?.filter(x => x.kind === 'home-parcel').length ?? 0, 0);
  }
});

test('Shotta opens for 2 and encores for 1, max two encores per match and one per round, blocked shots still spend', () => {
  for (const owner of owners) for (const blocked of [false, true]) {
    const m = blank(), foe = unit('techbro', enemyOf(owner), 0);
    foe.powerModifier = 20;
    const remote = unit('techbro', enemyOf(owner), 1, 2); remote.powerModifier = 20;
    if (blocked) cover(m, remote);
    m.boards = [[foe], [remote], []];
    const shot = cast(m, 'counter', owner);
    assert.equal(find(shot.after, foe).powerModifier, 18);
    const first = cast(shot.after, 'plug', owner, 1).after;
    assert.equal(find(first, remote).powerModifier, blocked ? 20 : 19);
    assert.equal(find(first, shot.source).homecomingEncores, 1);
    const sameRound = cast(first, 'plug', owner, 1).after;
    assert.equal(find(sameRound, shot.source).homecomingEncores, 1);
    const second = cast(advance(sameRound), 'plug', owner, 1).after;
    assert.equal(find(second, shot.source).homecomingEncores, 2);
    assert.equal(find(second, remote).powerModifier, blocked ? 19 : 18, 'Protection blocked/spent on first encore only');
    const capped = cast(advance(second), 'plug', owner, 1).after;
    assert.equal(find(capped, shot.source).homecomingEncores, 2);
  }
});
