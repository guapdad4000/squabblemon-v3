import assert from 'node:assert/strict';
import test from 'node:test';
import * as engineData from '@workspace/squabblemon-engine/data';
import { cards, cardCatalog } from './data';
import {
  createAbilityUpgradeSnapshot, createCardInstance, createMatch, nextRound,
  type CardInstance, type Lane, type Match, type Owner,
} from './gameEngine';
import { REPLACED_BONDS } from '../../../lib/squabblemon-engine/src/creativeReworks';

const carriers = [
  ['Light', 'abuela', 'pinaynurse'],
  ['Plant', 'gardener', 'rastamon'],
  ['Earth', 'torta', 'manman'],
  ['Air', 'slipstream', 'gust'],
  ['Dark', 'gamer', 'nerd'],
  ['Poison', 'nail', 'bottle'],
  ['Normal', 'barber', 'cornball'],
  ['Fire', 'guap', 'folks'],
  ['Water', 'monsoonanchor', 'vibe'],
  ['Electric', 'piratedj', 'batteryback'],
] as const;
const restored = new Set(['abuela', 'gardener', 'torta', 'slipstream', 'gamer', 'nail', 'barber']);
const retired = ['honestthot', 'icecream', 'concrete', 'incel', 'circuitcaptain', 'canopykeeper'];
const handKey = (owner: Owner) => owner === 'player' ? 'playerHand' : 'cpuHand';
const unit = (id: string, owner: Owner, index: number, lane: Lane | null = null): CardInstance => ({
  ...createCardInstance(id, owner, 'elemental-hand-test', index), lane,
});
const blank = (round = 3): Match => ({
  ...createMatch('vibes', 'vibes'), round, phase: 'resolved',
  playerHand: [], cpuHand: [], boards: [[], [], []],
  playerDrawIndex: 100, cpuDrawIndex: 100,
});
const find = (match: Match, card: CardInstance) =>
  match.boards.flat().find(entry => entry.instanceId === card.instanceId)!;
const json = <T>(value: T): T => JSON.parse(JSON.stringify(value));

test('the assembled engine and collection cover all ten types with the named live carriers', () => {
  assert(Object.hasOwn(engineData, 'ELEMENTAL_HAND_BONUS_CARDS'), 'shared registry is exported through workspace engine data');
  assert.deepEqual(engineData.ELEMENTAL_HAND_BONUS_CARDS, Object.fromEntries(carriers.map(([element, id]) => [element, id])));
  assert.equal(carriers.length, 10);
  assert.deepEqual(new Set(carriers.map(([element]) => element)), new Set(Object.values(cards).filter(card => card.kind !== 'support' && !card.hazard).map(card => card.type)));
  for (const [element, id] of carriers) {
    const card = cards[id];
    const catalog = cardCatalog.find(entry => entry.engineId === id)!;
    assert(catalog, `${id} must be collectable`);
    assert.equal(card.type, element, id);
    assert.equal(card.elementalBond, element, id);
    assert.equal(catalog.elementalBond, element, `${id} catalog metadata`);
    if (restored.has(id)) {
      assert.match(card.effect, /^On Reveal:/, `${id} retains its reveal kit`);
      assert(card.effect.endsWith(`Ongoing: While ${card.name} is in your hand, your other ${element} characters on the board gain +1 Hands at round end.`), id);
    }
    assert.deepEqual(card.abilityUpgrades.map(upgrade => upgrade.id), [1, 2, 3].map(tier => `${id}:upgrade:${tier}`), id);
  }
  assert.deepEqual([...REPLACED_BONDS].sort(), [...retired].sort(), 'only the four restored creative bonds leave the retired-source guard');
  for (const id of retired) assert.equal(cards[id].elementalBond, undefined, `${id} stays retired`);
  assert.equal(cards.gamer.elementalBond, 'Dark');
  assert.equal(cards.incel.elementalBond, undefined, 'Incel is not the Dark carrier');
});

for (const owner of ['player', 'cpu'] as const) {
  const enemy: Owner = owner === 'player' ? 'cpu' : 'player';
  for (const [element, id, targetId] of carriers) {
    test(`${owner}: ${id} grants its ${element} hand bonus across districts, excluding noneligible cards`, () => {
      const holder = unit(id, owner, 1);
      const allies = ([0, 1, 2] as const).map(lane => unit(targetId, owner, 10 + lane, lane));
      const opponent = unit(targetId, enemy, 20, 0);
      const wrongElement = unit(element === 'Normal' ? 'folks' : 'cornball', owner, 21, 1);
      // Typed fixtures isolate eligibility from a support's or hazard's printed element.
      const support = { ...unit('subwaymap', owner, 22, 0), type: element };
      const hazard = { ...unit(targetId, owner, 23, 1), hazard: true as const };
      const unplayed = unit(targetId, owner, 24);
      // Defensive source exclusion also applies to a saved snapshot containing its board alias.
      const sourceAlias = { ...holder, lane: 2 as const };
      const match: Match = {
        ...blank(), [handKey(owner)]: [holder, unplayed],
        boards: [[allies[0], opponent, support], [allies[1], wrongElement, hazard], [allies[2], sourceAlias]],
      };
      const before = JSON.stringify(match);
      const after = nextRound(match);
      for (const ally of allies) assert.equal(find(after, ally).powerModifier, 1, `${id} friendly district ${ally.lane}`);
      for (const excluded of [opponent, wrongElement, support, hazard, sourceAlias]) {
        assert.equal(find(after, excluded).powerModifier, 0, `${id} excludes ${excluded.instanceId}`);
      }
      for (const inHand of [holder, unplayed]) {
        assert.equal(after[handKey(owner)].find(card => card.instanceId === inHand.instanceId)?.powerModifier, 0, 'hand cards are not recipients');
      }
      assert.equal(JSON.stringify(match), before, 'round end preserves its input');
      assert.deepEqual(nextRound(json(match)), after, 'JSON-restored round end is deterministic');
    });

    test(`${owner}: ${id} bonuses persist and tick at final round, but stop when it leaves hand`, () => {
      const holder = unit(id, owner, 1), ally = unit(targetId, owner, 2, 1);
      const initial: Match = { ...blank(5), [handKey(owner)]: [holder], boards: [[], [ally], []] };
      const advanced = nextRound(initial);
      assert.equal(advanced.round, 6);
      assert.equal(find(advanced, ally).powerModifier, 1);
      const completed = nextRound({ ...json(advanced), phase: 'resolved' });
      assert.equal(completed.phase, 'complete');
      assert.equal(find(completed, ally).powerModifier, 2, 'final scoring includes the second persistent tick');
      const removed = nextRound({ ...json(advanced), phase: 'resolved', [handKey(owner)]: [] });
      assert.equal(find(removed, ally).powerModifier, 1, 'leaving hand stops future ticks without undoing old Hands');
    });

    test(`${owner}: drawing ${id} cannot buff the preceding round`, () => {
      const ally = unit(targetId, owner, 2, 0);
      const match: Match = {
        ...blank(4), boards: [[ally], [], []],
        ...(owner === 'player' ? { playerCardIds: [id], playerDrawIndex: 0 } : { cpuCardIds: [id], cpuDrawIndex: 0 }),
      };
      const drawn = nextRound(match);
      assert.equal(find(drawn, ally).powerModifier, 0);
      assert.equal(drawn[handKey(owner)][0]?.cardId, id);
      const next = nextRound({ ...drawn, phase: 'resolved' });
      assert.equal(find(next, ally).powerModifier, 1, 'holder first buffs after its own round in hand');
    });

    if (restored.has(id)) test(`${owner}: ${id} grants exactly +1 per eligible unit even with all reveal upgrades`, () => {
      for (let tier = 0; tier <= 3; tier++) {
        const holder = unit(id, owner, 1);
        const allies = ([0, 1, 2] as const).map(lane => unit(targetId, owner, 10 + lane, lane));
        const match: Match = {
          ...blank(6), [handKey(owner)]: [holder], boards: [[allies[0]], [allies[1]], [allies[2]]],
          abilityUpgradeSnapshot: createAbilityUpgradeSnapshot(owner === 'player' ? [id] : [], owner === 'cpu' ? [id] : [], {
            [owner]: { [id]: { xp: 2800, level: 8, moveTier: tier } },
          }),
        };
        const after = nextRound(match);
        for (const ally of allies) assert.equal(find(after, ally).powerModifier, 1, `${id} tier ${tier} district ${ally.lane}`);
      }
    });
  }

  test(`${owner}: Sushi Chef still distributes trained hand-bond extras`, () => {
    for (let tier = 0; tier <= 3; tier++) {
      const id = 'monsoonanchor', holder = unit(id, owner, 1), ally = unit('vibe', owner, 2, 0);
      const match: Match = {
        ...blank(6), [handKey(owner)]: [holder], boards: [[ally], [], []],
        abilityUpgradeSnapshot: createAbilityUpgradeSnapshot(owner === 'player' ? [id] : [], owner === 'cpu' ? [id] : [], {
          [owner]: { [id]: { xp: 2800, level: 8, moveTier: tier } },
        }),
      };
      assert.equal(find(nextRound(match), ally).powerModifier, 1 + tier, `Sushi Chef tier ${tier}`);
    }
  });

  test(`${owner}: all six retired sources stay blocked even with historical hand-bond metadata`, () => {
    for (const id of retired) {
      const element = cards[id].type;
      const targetId = carriers.find(([type]) => type === element)![2];
      const holder = { ...unit(id, owner, 1), elementalBond: element };
      const ally = unit(targetId, owner, 2, 0);
      const after = nextRound(json({
        ...blank(6), [handKey(owner)]: [holder], boards: [[ally], [], []],
      } as Match));
      assert.equal(find(after, ally).powerModifier, 0, `${id} cannot restore its retired bonus through a saved snapshot`);
    }
  });
}

test('both owners can hold the same elemental carrier without crossing sides', () => {
  for (const [, id, targetId] of carriers) {
    const player = unit(targetId, 'player', 1, 0), cpu = unit(targetId, 'cpu', 2, 2);
    const after = nextRound({
      ...blank(6), playerHand: [unit(id, 'player', 3)], cpuHand: [unit(id, 'cpu', 4)],
      boards: [[player], [], [cpu]],
    });
    assert.equal(find(after, player).powerModifier, 1, `${id} player receives only its own source`);
    assert.equal(find(after, cpu).powerModifier, 1, `${id} CPU receives only its own source`);
  }
});