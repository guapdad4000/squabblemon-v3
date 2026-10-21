import assert from 'node:assert/strict';
import test from 'node:test';
import { cards, catalogCardByEngineId } from './data';
import {
  createAbilityUpgradeSnapshot, createCardInstance, createMatch, createMatchFromEngineCards,
  nextRound, playTurnCard, type CardInstance, type Lane, type Match, type Owner, type StoryEncounterSnapshot,
} from './gameEngine';

const json = <T>(value: T): T => JSON.parse(JSON.stringify(value));
const blank = (): Match => ({ ...createMatch('block', 'block'), round: 1,
  boards: [[], [], []], playerHand: [], cpuHand: [], playerCardIds: [], cpuCardIds: [],
  playerDrawIndex: 0, cpuDrawIndex: 0, playerMotion: 0, cpuMotion: 0,
  squabbleByOwner: { player: false, cpu: false } });
const unit = (id: string, owner: Owner, index = 0) => createCardInstance(id, owner, 'freak-rework', index);
const find = (m: Match, c: CardInstance): CardInstance => [...m.playerHand, ...m.cpuHand, ...m.boards.flat()]
  .find(card => card.instanceId === c.instanceId)!;
const advance = (m: Match) => nextRound({ ...m, phase: 'resolved', playerMotion: 0, cpuMotion: 0 });
function deploy(m: Match, source: CardInstance, lane: Lane = 0, squabble = false): Match {
  const hand = source.owner === 'player' ? 'playerHand' : 'cpuHand';
  return playTurnCard({ ...m, phase: source.owner === 'player' ? 'player' : 'cpu-reveal',
    [hand]: [...m[hand].filter(card => card.instanceId !== source.instanceId), source],
    playerMotion: 9, cpuMotion: 9,
  }, source.owner, source.instanceId, lane, squabble);
}

test('Energy Drink Freak retains its identity as a 3/4 Water Epic and does not change Energy Drink support', () => {
  assert.deepEqual([cards.rainmaker.cost, cards.rainmaker.power, cards.rainmaker.type], [3, 4, 'Water']);
  assert.equal(catalogCardByEngineId.rainmaker.rarity, 'Epic');
  assert.equal(catalogCardByEngineId.rainmaker.catalogId, 'rainmaker');
  assert.deepEqual([cards.energydrink.cost, cards.energydrink.kind], [1, 'support']);
  assert.match(cards.energydrink.effect, /Restore 3 Motion/);
  assert.match(cards.rainmaker.effect, /From round 2/);
});

for (const owner of ['player', 'cpu'] as const) {
  const enemy: Owner = owner === 'player' ? 'cpu' : 'player';
  const hand = owner === 'player' ? 'playerHand' : 'cpuHand';
  const motion = owner === 'player' ? 'playerMotion' : 'cpuMotion';

  test(`${owner}: no round-one income; three later hand payouts lower base Hands and survive exact JSON recovery`, () => {
    const crew = ['rainmaker', 'cornball', 'plug', 'rastamon', 'hooper', 'bikelife', 'wifey', 'stockz', 'gamer', 'nerd'];
    const opening = createMatchFromEngineCards('freak-start', crew, 'freak-rival', crew);
    assert.equal(opening[motion], 2);
    const openingFreak = opening[hand].find(card => card.cardId === 'rainmaker')!;
    assert.equal(openingFreak.basePower, 4);
    assert.equal(opening.rainmakerPayouts?.[owner]?.count ?? 0, 0);

    const freak = unit('rainmaker', owner), m = blank(); m[hand] = [freak];
    let current = m;
    for (let count = 1; count <= 3; count++) {
      const before = structuredClone(current);
      const next = advance(current), recovered = advance(json(current));
      assert.deepEqual(current, before, 'hand income must not mutate the previous round');
      assert.deepEqual(next, recovered);
      assert.equal(next.round, count + 1);
      assert.equal(next[motion], count + 2, 'one extra Motion is added after the new-round baseline');
      assert.equal(find(next, freak).basePower, 4 - count);
      assert.equal(find(next, freak).powerModifier, 0, 'the crash is a persistent base-Hand cost');
      assert.equal(find(next, freak).rainmakerCrashes, count);
      assert.equal(find(next, freak).recoverableDamage ?? 0, 0);
      assert.deepEqual(next.rainmakerPayouts?.[owner], { round: count + 1, count });
      assert.equal(next.laneDamage?.length, 0);
      assert(next.effectLog.some(event => event.replay.after.rainmakerPayouts?.[owner]?.count === count));
      current = next;
    }
    const exhausted = advance(current);
    assert.equal(exhausted[motion], 5, 'the fourth later round receives no extra income');
    assert.equal(find(exhausted, freak).basePower, 1);
    assert.equal(find(exhausted, freak).rainmakerCrashes, 3);
    assert.deepEqual(exhausted.rainmakerPayouts?.[owner], { round: 4, count: 3 });
  });

  test(`${owner}: duplicate Freaks share one payout per round and fresh copies cannot bypass the match cap`, () => {
    const first = unit('rainmaker', owner, 1), second = unit('rainmaker', owner, 2), m = blank();
    m[hand] = [first, second];
    let current = advance(m);
    assert.equal(current[motion], 3);
    assert.equal(current[hand].reduce((sum, card) => sum + (card.rainmakerCrashes ?? 0), 0), 1);
    assert.equal(current[hand].reduce((sum, card) => sum + card.basePower, 0), 7);
    current = advance(advance(current));
    const fresh = unit('rainmaker', owner, 3);
    current = { ...json(current), [hand]: [fresh] };
    const exhausted = advance(current);
    assert.equal(exhausted[motion], 5);
    assert.equal(find(exhausted, fresh).basePower, 4);
    assert.equal(find(exhausted, fresh).rainmakerCrashes ?? 0, 0);
    assert.equal(exhausted.rainmakerPayouts?.[owner]?.count, 3);
  });

  test(`${owner}: disabled hand abilities neither generate income nor crash or spend a payout`, () => {
    for (const status of ['silenced', 'frozen', 'weakened'] as const) {
      const freak = unit('rainmaker', owner); freak.statuses[status] = true;
      const m = blank(); m[hand] = [freak];
      const result = advance(m);
      assert.equal(result[motion], 2, status);
      assert.equal(find(result, freak).basePower, 4, status);
      assert.equal(find(result, freak).rainmakerCrashes ?? 0, 0, status);
      assert.equal(result.rainmakerPayouts?.[owner]?.count ?? 0, 0, status);
    }
  });

  test(`${owner}: Motion already capped by the encounter cannot spend a crash or shared payout`, () => {
    const freak = unit('rainmaker', owner), m = blank(); m[hand] = [freak];
    const encounter: StoryEncounterSnapshot = {
      id: 'freak-capped-round', enemy: { id: 'rival', name: 'Rival', portraitAssetId: '', deckId: 'empty', cardIds: [], behaviorProfile: 'balanced' },
      battlefieldAssetId: '', soundHooks: {}, modifiers: { roundMotionDeltas: [{ round: 2, owner, amount: 9 }] },
    };
    m.storyEncounter = encounter;
    m.storyRuntime = { activePhaseIndex: -1, appliedEffectIds: [], lanePowerBonuses: [], laneLocks: [] };
    const result = advance(m);
    assert.equal(result[motion], 9);
    assert.equal(find(result, freak).basePower, 4);
    assert.equal(find(result, freak).rainmakerCrashes ?? 0, 0);
    assert.equal(result.rainmakerPayouts?.[owner]?.count ?? 0, 0);
  });

  test(`${owner}: a Freak drawn at round start can pay immediately; income is not a Powerhouse refund`, () => {
    const freak = unit('rainmaker', owner), battery = unit('powerhouse', owner, 1), m = blank();
    m[hand] = [battery];
    m[owner === 'player' ? 'playerCardIds' : 'cpuCardIds'] = ['rainmaker'];
    const result = advance(m), drawn = result[hand].find(card => card.cardId === freak.cardId)!;
    assert.equal(result[motion], 3);
    assert.equal(drawn.basePower, 3);
    assert.equal(drawn.rainmakerCrashes, 1);
    assert.equal(find(result, battery).bankedMotion ?? 0, 0);
    assert.equal(result.rainmakerPayouts?.[enemy]?.count ?? 0, 0);
  });

  test(`${owner}: entering refunds two once, without self damage, and echoed entrances cannot refund`, () => {
    const freak = unit('rainmaker', owner), battery = unit('powerhouse', owner, 1), m = blank(); m[hand] = [freak, battery];
    const first = deploy(m, freak);
    assert.equal(first[motion], 8);
    assert.equal(find(first, freak).basePower, 4);
    assert.equal(find(first, freak).powerModifier, 0);
    assert.equal(find(first, freak).rainmakerRefundUsed, true);
    assert.equal(find(first, freak).recoverableDamage ?? 0, 0);
    assert.equal(first.laneDamage?.length, 0);
    assert.equal(find(first, battery).bankedMotion, 2, 'a genuine entrance refund still banks Motion');
    const echo = unit('tayaty', owner, 2), repeated = deploy(first, echo, 1);
    assert.equal(repeated[motion], 6, 'Tayaty pays three and receives no copied refund');
    assert.equal(find(repeated, battery).bankedMotion, 2);
    assert.deepEqual(repeated, deploy(json(first), echo, 1));
  });

  test(`${owner}: real returns preserve the crash and spent refund; Squabble doubles the remaining base`, () => {
    const freak = unit('rainmaker', owner), m = blank(); m[hand] = [freak];
    const crashed = advance(advance(m)), held = find(crashed, freak);
    assert.equal(held.basePower, 2);
    const first = deploy(crashed, held);
    assert.equal(find(first, freak).rainmakerRefundUsed, true);
    const hatter = unit('madhatter', owner, 1), returned = deploy(first, hatter);
    const guest = returned[hand].find(card => card.instanceId === freak.instanceId)!;
    assert(guest, 'Mad Hatter actually returns the same Freak instance');
    assert.equal(guest.basePower, 2);
    assert.equal(guest.rainmakerCrashes, 2);
    assert.equal(guest.rainmakerRefundUsed, true);
    const replayed = deploy(json(returned), guest, 1, true), placed = find(replayed, freak);
    assert.equal(replayed[motion], 7, 'the one-Motion Hatter return discount applies, without a second refund');
    assert.equal(placed.basePower, 2);
    assert.equal(placed.powerModifier, guest.powerModifier + 2, 'Squabble adds only the two remaining base Hands');
    assert.equal(placed.rainmakerRefundUsed, true);
  });

  test(`${owner}: trained entrance gains happen once; holding or returning cannot farm tiers`, () => {
    const freak = unit('rainmaker', owner), m = blank(); m[hand] = [freak];
    m.abilityUpgradeSnapshot = createAbilityUpgradeSnapshot(owner === 'player' ? ['rainmaker'] : [], owner === 'cpu' ? ['rainmaker'] : [],
      { [owner]: { rainmaker: { level: 8, xp: 2800, moveTier: 3 } } });
    const held = advance(m);
    assert.equal(find(held, freak).powerModifier, 0, 'hand income does not train entrance tiers');
    const first = deploy(held, find(held, freak));
    assert.equal(find(first, freak).powerModifier, 3);
    assert.equal(find(first, freak).rainmakerRefundUsed, true);
    const returned = deploy(first, unit('madhatter', owner, 1));
    const guest = returned[hand].find(card => card.instanceId === freak.instanceId)!;
    assert(guest);
    const next = deploy(returned, guest, 1);
    assert.equal(find(next, freak).powerModifier, guest.powerModifier, 'redeployment gains no extra training');
    assert.equal(find(next, freak).rainmakerRefundUsed, true);
  });
}
