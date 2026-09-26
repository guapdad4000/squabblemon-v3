import assert from 'node:assert/strict';
import test from 'node:test';
import { AFTER_HOURS_WAVE } from '../../../lib/squabblemon-engine/src/afterHoursWave';
import { cardCatalog, catalogCardById, cards, validateCardAbilityUpgrades, validateSavedDeck } from './data';
import {
  createAbilityUpgradeSnapshot, createCardInstance, createMatch, getCharacterDistrictMarks, nextRound, playTurnCard,
  type CardInstance, type Lane, type Match, type Owner,
} from './gameEngine';

const ids = AFTER_HOURS_WAVE.map(([id]) => id);
const blank = (): Match => ({ ...createMatch('block', 'block'), round: 1, playerMotion: 9, cpuMotion: 9,
  boards: [[], [], []], playerHand: [], cpuHand: [] });
const unit = (id: string, owner: Owner, lane: Lane = 0, index = 0): CardInstance => ({
  ...createCardInstance(id, owner, 'after-hours-test', index), lane,
});
const find = (m: Match, id: string) => m.boards.flat().find(c => c.cardId === id)!;
function cast(m: Match, id: string, owner: Owner, tier = 0, disabled?: 'silenced' | 'frozen' | 'weakened', targetLane: Lane = 0): Match {
  const source = createCardInstance(id, owner, 'after-hours-cast', m.nextEventSequence);
  if (disabled) source.statuses[disabled] = true;
  const snapshot = createAbilityUpgradeSnapshot(owner === 'player' ? [id] : [], owner === 'cpu' ? [id] : [], {
    [owner]: { [id]: { level: [1, 2, 5, 8][tier], xp: 2800, moveTier: tier } },
  });
  return playTurnCard({ ...m, abilityUpgradeSnapshot: snapshot, phase: owner === 'player' ? 'player' : 'cpu-reveal',
    [owner === 'player' ? 'playerHand' : 'cpuHand']: [source] }, owner, source.instanceId, targetLane);
}

test('after-hours catalog exposes exact identities, rarity, variants, upgrades, packs and legal decks', () => {
  validateCardAbilityUpgrades();
  const expected = {
    sugarfoot: 'Uncommon', 'yn-gokarter': 'Rare', 'yn-atv-lord': 'Epic', janitor: 'Uncommon',
    'homeless-wiseman': 'Legendary', 'juneteenth-chair-guy': 'Mythical', 'squabble-house-manager': 'Rare',
  };
  for (const [id, name] of AFTER_HOURS_WAVE) {
    const card = catalogCardById[id];
    assert.equal(card.name, name);
    assert.equal(card.engineId, id); assert.equal(card.catalogId, id); assert.equal(card.artworkId, id);
    assert.equal(card.rarity, expected[id]); assert.equal(card.artworkLayout, 'portrait');
    assert.deepEqual(card.acquisitionSources, ['Street Packs']);
    assert.equal(card.abilityUpgrades.length, 3); assert.ok(card.variantSlots.length > 0);
  }
  const other = cardCatalog.filter(card => !ids.includes(card.engineId as typeof ids[number])).slice(0, 3).map(card => card.catalogId);
  const deck = [...ids, ...other];
  assert.equal(deck.length, 10);
  assert.equal(validateSavedDeck(deck, deck, 'sugarfoot').valid, true);
  assert.match(cards.sugarfoot.effect, /Weaken/);
});

for (const owner of ['player', 'cpu'] as const) {
  const enemy: Owner = owner === 'player' ? 'cpu' : 'player';
  test(`${owner}: all seven resolve deterministically with upgrades and serialize in replay events`, () => {
    for (const id of ids) {
      const m = blank();
      const local = unit('rastamon', owner, 0, 1);
      local.statuses.frozen = true;
      const remote = unit('hooper', owner, 1, 2);
      remote.statuses.weakened = true;
      const foe = unit('techbro', enemy, 0, 3);
      foe.powerModifier = 5;
      m.boards = [[local, foe], [remote], []];
      const json = JSON.stringify(m), after = cast(m, id, owner, 3);
      assert.equal(JSON.stringify(m), json);
      assert.deepEqual(cast(JSON.parse(json), id, owner, 3), after);
      const expectedPower = ['janitor','juneteenth-chair-guy'].includes(id) ? 0 : id === 'squabble-house-manager' ? 4 : 3;
      assert.equal(find(after, id).powerModifier, expectedPower);
      assert.equal(after.effectLog.filter(event => event.abilityMetadata?.sourceCardId === id).length, ['janitor','juneteenth-chair-guy'].includes(id) ? 0 : 3);
      const replay = after.effectLog.at(-1)!.replay.after;
      assert.deepEqual(JSON.parse(JSON.stringify(replay)), replay);
    }
  });

  test(`${owner}: Weaken specialist, chair and manager honor targeting and Protection`, () => {
    let m = blank();
    const strongest = unit('techbro', enemy, 0, 1), weaker = unit('rastamon', enemy, 0, 2);
    strongest.powerModifier = 4; m.boards[0] = [strongest, weaker];
    let after = cast(m, 'sugarfoot', owner);
    assert.equal(find(after, 'techbro').statuses.weakened, true);
    assert.equal(find(after, 'sugarfoot').powerModifier, 0);
    m = blank(); strongest.statuses.weakened = true; m.boards[0] = [strongest];
    after = cast(m, 'sugarfoot', owner);
    assert.equal(find(after, 'sugarfoot').powerModifier, 1);

    m = blank();
    for (const defense of ['protected', 'uncounterable'] as const) {
      m = blank();
      const defended = unit('techbro', enemy);
      defended.statuses.weakened = true;
      defended.statuses[defense] = true;
      m.boards[0] = [defended];
      if (defense === 'protected') {
        m.timedEffects = [{ id: 'shield', kind: 'church-protection', sourceInstanceId: defended.instanceId,
          targetInstanceId: defended.instanceId, owner: enemy, lane: 0, startsAtRound: 1, expiresAtRound: 99, expiration: 'match-complete' }];
      }
      after = cast(m, 'sugarfoot', owner, 3);
      assert.equal(find(after, 'techbro').statuses.weakened, true);
      assert.equal(find(after, 'sugarfoot').powerModifier, 0);
      assert.equal(after.effectLog.filter(event => event.abilityMetadata?.sourceCardId === 'sugarfoot').length, 0);
    }

    m = blank();
    const ally = unit('rastamon', owner), target = unit('techbro', enemy);
    target.powerModifier = 5; m.boards[0] = [ally, target];
    after = cast(m, 'juneteenth-chair-guy', owner);
    assert.equal(find(after, 'techbro').powerModifier, 5);
    assert.equal(find(after, 'rastamon').statuses.protected, false); // Chair now waits to retaliate.

    m = blank();
    const protectedWeakest = unit('rastamon', owner, 0, 4), stronger = unit('techbro', owner, 0, 5);
    protectedWeakest.statuses.protected = true;
    stronger.powerModifier = 5;
    m.boards[0] = [protectedWeakest, stronger];
    after = cast(m, 'juneteenth-chair-guy', owner);
    assert.equal(find(after, 'rastamon').statuses.protected, true);
    assert.equal(find(after, 'techbro').statuses.protected, false);

    m = blank(); m.boards[0] = [unit('rastamon', enemy)];
    after = cast(m, 'squabble-house-manager', owner);
    assert.equal(find(after, 'squabble-house-manager').powerModifier, 1);
    assert.equal(cards['squabble-house-manager'].cost, 1);
    assert.equal(cards['squabble-house-manager'].power, 2);
  });

  test(`${owner}: deterministic movement respects capacity, locks, and success-only buffs`, () => {
    let m = blank();
    const ally = unit('rastamon', owner);
    m.boards[0] = [ally];
    m.boards[1] = [unit('hooper', owner, 1)];
    let after = cast(m, 'yn-gokarter', owner);
    assert.equal(find(after, 'yn-gokarter').lane, 2);

    m = blank();
    const rider = unit('rastamon', owner);
    m.boards[0] = [rider];
    after = cast(m, 'yn-atv-lord', owner);
    assert.equal(find(after, 'rastamon').lane, 1);
    assert.equal(find(after, 'rastamon').powerModifier, 0);
    assert.equal(find(after, 'rastamon').statuses.protected, true);
    assert.equal(find(after, 'yn-atv-lord').lane, 1);

    m = blank();
    const locked = unit('rastamon', owner);
    locked.statuses.locked = true; m.boards[0] = [locked];
    after = cast(m, 'yn-atv-lord', owner, 3);
    assert.equal(find(after, 'rastamon').lane, 0);
    assert.equal(find(after, 'rastamon').powerModifier, 0);
    assert.equal(find(after, 'yn-atv-lord').powerModifier, 0);
  });

  test(`${owner}: Janitor reverses one harmful hit per district each round and resets next round`, () => {
    let m = blank();
    m.boards[0] = [unit('janitor', owner), unit('techbro', owner, 0, 1)];
    m.abilityUpgradeSnapshot = createAbilityUpgradeSnapshot(
      owner === 'player' ? ['janitor'] : ['sugarfoot'],
      owner === 'cpu' ? ['janitor'] : ['sugarfoot'],
      { [owner]: { janitor: { level: 8, xp: 2800, moveTier: 3 } } },
    );
    const attacker = createCardInstance('sugarfoot', enemy, 'janitor-upgrade-test', 1);
    let after = playTurnCard({ ...m, phase: enemy === 'player' ? 'player' : 'cpu-reveal',
      [enemy === 'player' ? 'playerHand' : 'cpuHand']: [attacker] }, enemy, attacker.instanceId, 0);
    assert.equal(find(after, 'techbro').powerModifier, 2);
    assert.equal(find(after, 'techbro').statuses.weakened, false);
    assert.equal(find(after, 'janitor').powerModifier, 3);
    assert.equal(after.effectLog.filter(event => event.abilityMetadata?.sourceCardId === 'janitor').length, 3);
    assert.match(getCharacterDistrictMarks(after).find(mark => mark.owner === owner && mark.lane === 0)!.text, /spent this round/);
    assert.equal(after.janitorReversals?.length, 1);
    after = cast(after, 'sugarfoot', enemy);
    assert.equal(find(after, 'techbro').powerModifier, 2);
    assert.equal(find(after, 'techbro').statuses.weakened, true);
    assert.equal(after.janitorReversals?.length, 1);

    after = nextRound({ ...after, phase: 'resolved', playerHand: [], cpuHand: [] });
    assert.match(getCharacterDistrictMarks(after).find(mark => mark.owner === owner && mark.lane === 0)!.text, /first hostile effect/);
    after = { ...after, [enemy === 'player' ? 'playerMotion' : 'cpuMotion']: 9 };
    after = cast(after, 'inmate-informant', enemy);
    assert.equal(find(after, 'techbro').powerModifier, 4);
    assert.equal(after.janitorReversals?.filter(item => item.round === after.round).length, 1);
    assert.deepEqual(JSON.parse(JSON.stringify(after.effectLog.at(-1)!.replay.after)), after.effectLog.at(-1)!.replay.after);
  });

  test(`${owner}: enemy Burn uses the district reversal once at actual round end`, () => {
    const m = blank(), janitor = unit('janitor', owner), first = unit('techbro', owner, 0, 1), second = unit('hooper', owner, 0, 2);
    first.statuses.burnStacks = 2; second.statuses.burnStacks = 1;
    first.burnSource = { instanceId: 'enemy-burn:1', owner: enemy };
    second.burnSource = { instanceId: 'enemy-burn:2', owner: enemy };
    m.boards[0] = [janitor, first, second];
    let after = nextRound({ ...m, phase: 'resolved' });
    assert.equal(after.boards[0].find(card => card.instanceId === first.instanceId)?.powerModifier, 2);
    assert.equal(after.boards[0].find(card => card.instanceId === first.instanceId)?.statuses.burnStacks, 0);
    assert.equal(after.boards[0].find(card => card.instanceId === second.instanceId)?.powerModifier, -1);
    assert.equal(after.janitorReversals?.filter(item => item.round === 1).length, 1);

    const disabled = blank(), frozenJanitor = unit('janitor', owner), burned = unit('techbro', owner, 0, 3);
    frozenJanitor.statuses.frozen = true;
    burned.statuses.burnStacks = 2; burned.burnSource = { instanceId: 'enemy-burn:3', owner: enemy };
    disabled.boards[0] = [frozenJanitor, burned];
    after = nextRound({ ...disabled, phase: 'resolved' });
    assert.equal(after.boards[0].find(card => card.instanceId === burned.instanceId)?.powerModifier, -2);
    assert.equal(after.janitorReversals?.length ?? 0, 0);
  });

  test(`${owner}: disabled or absent Janitor cannot reverse, and district duplicates share the trigger`, () => {
    for (const status of ['silenced', 'frozen', 'weakened'] as const) {
      const janitor = unit('janitor', owner); janitor.statuses[status] = true;
      const m = blank(); m.boards[0] = [janitor, unit('techbro', owner, 0, 1)];
      const after = cast(m, 'sugarfoot', enemy);
      assert.equal(find(after, 'techbro').statuses.weakened, true);
      assert.equal(after.janitorReversals?.length ?? 0, 0);
    }
    let withoutSource = blank(); withoutSource.boards[0] = [unit('techbro', owner)];
    withoutSource = cast(withoutSource, 'sugarfoot', enemy);
    assert.equal(find(withoutSource, 'techbro').statuses.weakened, true);
    const m = blank();
    m.boards[0] = [unit('janitor', owner, 0, 1), unit('janitor', owner, 0, 2), unit('techbro', owner, 0, 3)];
    const after = cast(m, 'sugarfoot', enemy);
    assert.equal(find(after, 'techbro').powerModifier, 2);
    assert.equal(after.janitorReversals?.length, 1);

    let shieldedMatch = blank();
    const janitor = unit('janitor', owner), shielded = unit('techbro', owner, 0, 9);
    shielded.statuses.protected = true;
    shieldedMatch.boards[0] = [janitor, shielded];
    shieldedMatch.timedEffects = [{ id: 'janitor-shield', kind: 'church-protection', sourceInstanceId: janitor.instanceId,
      targetInstanceId: shielded.instanceId, owner, lane: 0, startsAtRound: 1, expiresAtRound: 99, expiration: 'match-complete' }];
    shieldedMatch = cast(shieldedMatch, 'sugarfoot', enemy);
    assert.equal(shieldedMatch.janitorReversals?.length ?? 0, 0);
    shieldedMatch = cast(shieldedMatch, 'sugarfoot', enemy);
    assert.equal(shieldedMatch.janitorReversals?.length, 1);
    assert.equal(shieldedMatch.boards[0].find(card => card.instanceId === shielded.instanceId)?.powerModifier, 2);
  });

  test(`${owner}: Wiseman prediction is public, deterministic, persistent, one-shot, and respects defenses`, () => {
    let m = blank();
    const crowded = unit('techbro', enemy, 0); crowded.powerModifier = 5;
    m.boards[0] = [crowded]; m.boards[1] = [unit('rastamon', enemy, 1)];
    let after = cast(m, 'homeless-wiseman', owner);
    let trap = after.districtTraps?.find(item => item.kind === 'wiseman');
    assert.equal(trap?.lane, 2); assert.equal(trap?.expiresAfterRound, after.round + 1);
    assert.match(cards['homeless-wiseman'].effect, /public board/);
    after.boards[0] = after.boards[0].filter(card => card.cardId !== 'homeless-wiseman');

    after = cast(after, 'charger', enemy, 0, undefined, 1);
    assert(after.districtTraps?.some(item => item.kind === 'wiseman'));
    after = nextRound({ ...after, phase: 'resolved', playerHand: [], cpuHand: [] });
    after = { ...after, [enemy === 'player' ? 'playerMotion' : 'cpuMotion']: 9 };
    after = cast(after, 'techbro', enemy, 0, undefined, 2);
    const trappedCard = after.boards[2].find(card => card.cardId === 'techbro')!;
    assert.equal(trappedCard.statuses.weakened, true);
    assert.equal(trappedCard.powerModifier, 0);
    assert.equal(after.districtTraps?.some(item => item.kind === 'wiseman'), false);

    m = blank(); m.boards[0] = [unit('techbro', enemy)];
    after = cast(m, 'homeless-wiseman', owner);
    trap = after.districtTraps?.find(item => item.kind === 'wiseman');
    const immune = createCardInstance('techbro', enemy, 'immune', 1);
    immune.statuses.uncounterable = true;
    after = playTurnCard({ ...after, phase: enemy === 'player' ? 'player' : 'cpu-reveal',
      [enemy === 'player' ? 'playerHand' : 'cpuHand']: [immune] }, enemy, immune.instanceId, trap!.lane);
    assert.equal(after.boards[trap!.lane].find(card => card.instanceId === immune.instanceId)?.statuses.weakened, false);
    assert.equal(after.districtTraps?.some(item => item.kind === 'wiseman'), false);

    m = blank(); m.boards[0] = [unit('techbro', enemy)];
    after = cast(m, 'homeless-wiseman', owner);
    trap = after.districtTraps?.find(item => item.kind === 'wiseman');
    const protectedCard = createCardInstance('techbro', enemy, 'protected', 2);
    protectedCard.statuses.protected = true;
    after.timedEffects = [{ id: 'trap-shield', kind: 'church-protection', sourceInstanceId: protectedCard.instanceId,
      targetInstanceId: protectedCard.instanceId, owner: enemy, lane: trap!.lane, startsAtRound: 1, expiresAtRound: 99, expiration: 'match-complete' }];
    after = playTurnCard({ ...after, phase: enemy === 'player' ? 'player' : 'cpu-reveal',
      [enemy === 'player' ? 'playerHand' : 'cpuHand']: [protectedCard] }, enemy, protectedCard.instanceId, trap!.lane);
    const protectedAfter = after.boards[trap!.lane].find(card => card.instanceId === protectedCard.instanceId)!;
    assert.equal(protectedAfter.powerModifier, 0); assert.equal(protectedAfter.statuses.weakened, false);
    assert.equal(after.districtTraps?.some(item => item.kind === 'wiseman'), false);
  });

  test(`${owner}: a new Wiseman replaces the previous prediction and Janitor replay frames stay monotonic`, () => {
    let m = blank();
    let after = cast(m, 'homeless-wiseman', owner, 0, undefined, 2);
    assert.deepEqual(after.districtTraps?.filter(trap => trap.kind === 'wiseman').map(trap => trap.lane), [0]);
    after.boards[0] = [unit('techbro', enemy, 0, 20)];
    after = cast(after, 'homeless-wiseman', owner, 0, undefined, 2);
    assert.deepEqual(after.districtTraps?.filter(trap => trap.kind === 'wiseman').map(trap => trap.lane), [1]);
    after = cast(after, 'techbro', enemy, 0, undefined, 0);
    assert.deepEqual(after.districtTraps?.filter(trap => trap.kind === 'wiseman').map(trap => trap.lane), []);
    assert.equal(after.discountTokens.find(token => token.eligibility === 'wiseman-prediction')?.targetLane, 1);

    m = blank();
    after = cast(m, 'homeless-wiseman', owner, 0, undefined, 2);
    const predicted = after.districtTraps!.find(trap => trap.kind === 'wiseman')!.lane;
    after.boards[predicted] = [unit('janitor', enemy, predicted, 30)];
    const eventStart = after.effectLog.length;
    const entrant = createCardInstance('rastamon', enemy, 'trap-janitor', 31);
    after = playTurnCard({ ...after, phase: enemy === 'player' ? 'player' : 'cpu-reveal',
      [enemy === 'player' ? 'playerHand' : 'cpuHand']: [entrant] }, enemy, entrant.instanceId, predicted);
    const playEvents = after.effectLog.slice(eventStart);
    const consumptionIndex = playEvents.findIndex(event => event.note.startsWith('Told You consumed'));
    assert(consumptionIndex >= 0);
    const events = playEvents.slice(consumptionIndex);
    for (let index = 1; index < events.length; index++) {
      assert.deepEqual(events[index - 1].replay.after, events[index].replay.before);
    }
    const trapCounts = events.map(event => [
      event.replay.before.districtTraps?.filter(trap => trap.kind === 'wiseman').length ?? 0,
      event.replay.after.districtTraps?.filter(trap => trap.kind === 'wiseman').length ?? 0,
    ]);
    assert.equal(trapCounts.filter(([before, end]) => before === 1 && end === 0).length, 1);
    assert(trapCounts.slice(trapCounts.findIndex(([before, end]) => before === 1 && end === 0) + 1)
      .every(([before, end]) => before === 0 && end === 0));
    const victimTransitions = events.flatMap(event => event.targets)
      .filter(target => target.cardInstanceId === entrant.instanceId && target.before && target.after
        && target.before.power !== target.after.power);
    assert.equal(victimTransitions.length, 1);
    assert.equal(after.boards[predicted].find(card => card.instanceId === entrant.instanceId)?.powerModifier, 2);
  });

  test(`${owner}: no legal targets and disabled sources do not train`, () => {
    for (const id of ids) {
      for (const status of ['silenced', 'frozen', 'weakened'] as const) {
        const m = blank();
        m.boards[1] = [unit('rastamon', owner, 1), unit('hooper', owner, 1), unit('cornball', owner, 1), unit('plug', owner, 1)];
        m.boards[2] = [unit('rastamon', owner, 2, 5), unit('hooper', owner, 2, 6), unit('cornball', owner, 2, 7), unit('plug', owner, 2, 8)];
        const after = cast(m, id, owner, 3, status);
        assert.equal(find(after, id).powerModifier, 0);
        assert.equal(after.effectLog.filter(event => event.abilityMetadata?.sourceCardId === id).length, 0);
      }
    }
  });
}