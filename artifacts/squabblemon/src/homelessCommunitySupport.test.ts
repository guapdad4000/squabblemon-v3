import assert from 'node:assert/strict';
import test from 'node:test';
import { cardCatalog, cards, decks, engineIdsToCatalogIds, validateSavedDeck } from '../../../lib/squabblemon-engine/src/data';
import { HOMELESS_CHARACTER_IDS, isHomelessCharacter } from '../../../lib/squabblemon-engine/src/homelessFamily';
import { createCardInstance, createMatch, createMatchFromEngineCards, nextRound, pass, playTurnCard,
  revealCpuTurn, verifyMatchTranscript, type CardInstance, type Lane, type Match, type Owner, type PlayerMove,
} from '../../../lib/squabblemon-engine/src/gameEngine';
import { listLegalBalancePlays } from '../../../lib/squabblemon-engine/src/balanceLab';
import { applyOnlineCommand, createOnlineRoom, joinOnlineRoom } from '../../../lib/squabblemon-engine/src/multiplayer';
import { autoBuildDeck, recommendedWorkshopCrews, workshopSuggestions } from './lib/deckWorkshop';

const blank = (): Match => ({ ...createMatch('block', 'block'), round: 3, boards: [[], [], []],
  playerHand: [], cpuHand: [], playerMotion: 9, cpuMotion: 9 });
const unit = (id: string, owner: Owner, lane: Lane, index = 0): CardInstance => ({
  ...createCardInstance(id, owner, 'community-fixture', index), lane,
});
const find = (m: Match, c: CardInstance) => m.boards.flat().find(x => x.instanceId === c.instanceId)!;
function cast(m: Match, id: string, owner: Owner, lane: Lane = 0, patch: Partial<CardInstance> = {}) {
  const source = { ...createCardInstance(id, owner, 'community-play', m.nextEventSequence), ...patch };
  return { source, after: playTurnCard({ ...m, phase: owner === 'player' ? 'player' : 'cpu-reveal',
    [owner === 'player' ? 'playerHand' : 'cpuHand']: [source], playerMotion: 9, cpuMotion: 9 },
  owner, source.instanceId, lane) };
}

test('Homeless family uses collectible identities, including Cracked Head and Wiseman', () => {
  assert.deepEqual(HOMELESS_CHARACTER_IDS,
    ['homelessguy', 'homelessyn', 'homelesslegend', 'homeless-wiseman', 'cracked-head']);
  for (const id of HOMELESS_CHARACTER_IDS) {
    assert(cardCatalog.some(c => c.engineId === id));
    assert(isHomelessCharacter(unit(id, 'player', 0)));
  }
  const copy = { ...unit('scammer', 'player', 0), copiedAbilityCardId: 'homelesslegend', id: 'homeless-legend' };
  assert(!isHomelessCharacter(copy), 'copying an ability or changing artwork does not change family identity');
  assert(!isHomelessCharacter({ ...unit('cracked-head', 'player', 0), kind: 'token' }));
  assert(!isHomelessCharacter({ ...unit('cracked-head', 'player', 0), hazard: true }));
  assert(!isHomelessCharacter({ ...unit('cracked-head', 'player', 0), kind: 'support' }));
});

test('Everybody Eats and the workshop agree on a legal owned Cracked Head/Foodz crew', () => {
  const deck = decks.find(d => d.id === 'community-table')!;
  const expected = ['homelessguy', 'homelessyn', 'homelesslegend', 'cracked-head', 'community-cook', 'foodz',
    'night-bus-driver', 'delivery-app-cyclist', 'bluetooth-unc', 'booster'];
  assert.deepEqual(deck.cards, expected);
  assert.deepEqual(recommendedWorkshopCrews.community, expected);
  const catalogIds = engineIdsToCatalogIds(expected);
  assert(validateSavedDeck(catalogIds, catalogIds, cards['community-cook'].id).valid);
  const lesson = workshopSuggestions.find(s => s.cardId === 'community-cook')!;
  assert.deepEqual(lesson.testCrew, catalogIds);
  assert.match(lesson.detail, /Cracked Head/);
  assert.match(lesson.detail, /Foodz/);
  const owned = cardCatalog.map(c => c.catalogId);
  const built = autoBuildDeck({ name: 'Cracked Head community', cardIds: [], heroCardId: 'cracked-head', recipeId: null }, owned);
  assert.deepEqual(new Set(built.cardIds), new Set(catalogIds));
  assert.equal(built.heroCardId, 'cracked-head');
  const missingFinisher = catalogIds.filter(id => id !== 'cracked-head');
  const withoutOwnership = autoBuildDeck({ name: 'Earn the finisher', cardIds: [], heroCardId: 'community-cook', recipeId: null }, missingFinisher);
  assert(!withoutOwnership.cardIds.includes('cracked-head'), 'recommendations never grant an unowned story reward');
});

for (const owner of ['player', 'cpu'] as const) {
  const enemy: Owner = owner === 'player' ? 'cpu' : 'player';
  for (const id of HOMELESS_CHARACTER_IDS)
    test(`${owner}: Cook heals, cleanses, strengthens and protects ${id} once per recipient`, () => {
      const patient = { ...unit(id, owner, 0), basePower: 10, powerModifier: -2, recoverableDamage: 2 };
      patient.statuses.frozen = true; patient.statuses.silenced = true;
      patient.statuses.weakened = true; patient.statuses.locked = true; patient.statuses.burnStacks = 2;
      const m = { ...blank(), boards: [[patient], [], []] as Match['boards'] };
      const before = JSON.stringify(m), first = cast(m, 'community-cook', owner);
      assert.equal(JSON.stringify(m), before);
      assert.deepEqual(cast(JSON.parse(before), 'community-cook', owner).after, first.after);
      const fed = find(first.after, patient);
      assert.equal(fed.powerModifier, 2, 'two lost Hands restored before the explicit +2 family growth');
      assert.equal(fed.recoverableDamage, 0, 'restored injury is spent, preventing a second heal');
      assert(fed.statuses.protected);
      assert(!fed.statuses.frozen && !fed.statuses.silenced && !fed.statuses.weakened && !fed.statuses.locked);
      assert.equal(fed.statuses.burnStacks, 0);
      const repeat = cast(JSON.parse(JSON.stringify(first.after)), 'community-cook', owner).after;
      assert.equal(find(repeat, patient).powerModifier, 2);
      assert.equal(find(repeat, patient).recoverableDamage, 0);
    });

  test(`${owner}: Cook feeds healthy Cracked Head five Hands while preserving ordinary meals`, () => {
    const finisher = unit('cracked-head', owner, 0);
    const fed = cast({ ...blank(), boards: [[finisher], [], []] }, 'community-cook', owner).after;
    assert.equal(find(fed, finisher).powerModifier, 5);
    assert(find(fed, finisher).statuses.protected);
    const ordinary = { ...unit('cornball', owner, 0), basePower: 10 };
    const healthy = cast({ ...blank(), boards: [[ordinary], [], []] }, 'community-cook', owner).after;
    assert.equal(find(healthy, ordinary).powerModifier, 3);
    assert(!find(healthy, ordinary).statuses.protected);
    const injured = { ...ordinary, powerModifier: -5, recoverableDamage: 5 };
    const healed = cast({ ...blank(), boards: [[injured], [], []] }, 'community-cook', owner).after;
    assert.equal(find(healed, injured).powerModifier, -1, 'ordinary recovery retains its four-Hand ceiling');
    assert.equal(find(healed, injured).recoverableDamage, 1);
  });

  test(`${owner}: Cook's healed Legend cannot recover the same damage again at round end`, () => {
    const legend = { ...unit('homelesslegend', owner, 0), powerModifier: -2, recoverableDamage: 2 };
    const healed = cast({ ...blank(), boards: [[legend], [], []] }, 'community-cook', owner).after;
    const next = nextRound({ ...healed, phase: 'resolved', playerHand: [], cpuHand: [] });
    assert.equal(find(next, legend).powerModifier, 2);
    assert.equal(find(next, legend).recoverableDamage, 0);
  });

  test(`${owner}: Cook spends only restored healing credit when Name Check withholds part of the gain`, () => {
    const patient = { ...unit('homelesslegend', owner, 0), basePower: 10, powerModifier: -4, recoverableDamage: 4 };
    const watcher = unit('pimp-swookie', enemy, 1);
    const m = { ...blank(), boards: [[patient], [watcher], []] as Match['boards'] };
    m.creativeMarks = [{ id: 'legacy-name-check', kind: 'sl-name-check', source: watcher, owner: enemy,
      lane: 0, targets: [patient.instanceId], expires: 99 }];
    const result = cast(m, 'community-cook', owner).after;
    assert.equal(find(result, patient).powerModifier, 0, 'two actual injury restored, then explicit +2 family growth');
    assert.equal(find(result, patient).recoverableDamage, 2, 'withheld recovery did not spend the remaining injury credit');
    assert(!result.creativeMarks?.some(x => x.kind === 'sl-name-check'));
  });

  test(`${owner}: Foodz adds one protected community serving per district without losing his broad meal`, () => {
    const family = [unit('cracked-head', owner, 0), unit('homelessyn', owner, 1), unit('homelesslegend', owner, 2)];
    family[0].statuses.silenced = true;
    const ordinary = { ...unit('cornball', owner, 0, 90), basePower: 1 };
    ordinary.statuses.frozen = true;
    const stronger = { ...unit('homelessguy', owner, 1, 91), powerModifier: 20 };
    const m = { ...blank(), boards: [[family[0], ordinary], [family[1], stronger], [family[2]]] as Match['boards'] };
    const before = JSON.stringify(m), result = cast(m, 'foodz', owner);
    assert.equal(JSON.stringify(m), before);
    assert.deepEqual(cast(JSON.parse(before), 'foodz', owner).after, result.after);
    assert.equal(find(result.after, ordinary).powerModifier, 2, 'ordinary weakest ally keeps the general meal');
    assert(!find(result.after, ordinary).statuses.frozen);
    assert.equal(find(result.after, family[0]).powerModifier, 2, 'a different Homeless recipient still receives its community serving');
    assert(!find(result.after, family[0]).statuses.silenced);
    for (const c of family.slice(1)) assert.equal(find(result.after, c).powerModifier, 4, 'general meal plus community serving');
    assert(family.every(c => find(result.after, c).statuses.protected));
    assert.equal(find(result.after, stronger).powerModifier, 20, 'one weakest family recipient per district');
    assert.equal(result.after.foodzCommunityServed?.[owner], true);
    assert.equal(result.after.foodzCommunityServed?.[enemy], undefined);
    assert(result.after.effectLog.some(e => e.replay.after.foodzCommunityServed?.[owner] === true),
      'the once-only community serving is preserved in authoritative replay state');
    const repeat = cast(JSON.parse(JSON.stringify(result.after)), 'foodz', owner, 2).after;
    assert.equal(find(repeat, family[2]).powerModifier, 6, 'a repeated Foodz keeps its ordinary +2 but cannot repeat family +2');
  });

  test(`${owner}: Foodz does not spend community serving before a Homeless ally exists`, () => {
    const ordinary = unit('cornball', owner, 0);
    let m = cast({ ...blank(), boards: [[ordinary], [], []] }, 'foodz', owner).after;
    assert.equal(m.foodzCommunityServed?.[owner], undefined);
    const finisher = unit('cracked-head', owner, 1, 40);
    m = { ...m, boards: [m.boards[0], [finisher], []] };
    const served = cast(m, 'foodz', owner, 2).after;
    assert.equal(served.foodzCommunityServed?.[owner], true);
    assert.equal(find(served, finisher).powerModifier, 4);
    assert(find(served, finisher).statuses.protected);
  });

  for (const id of ['community-cook', 'foodz'])
    test(`${owner}: disabled ${id} cannot pay a Homeless meal or consume its entitlement`, () => {
      const patient = unit('cracked-head', owner, 0);
      const disabled = createCardInstance(id, owner).statuses;
      disabled.silenced = true;
      const result = cast({ ...blank(), boards: [[patient], [], []] }, id, owner, 0, { statuses: disabled }).after;
      assert.equal(find(result, patient).powerModifier, 0);
      assert(!find(result, patient).statuses.protected);
      assert.equal(result.foodzCommunityServed?.[owner], undefined);
      assert(!result.creativeMarks?.some(x => x.id === `sw:${owner}:meal:${patient.instanceId}`));
    });

  for (const id of ['community-cook', 'foodz'])
    test(`${owner}: ${id} support agrees with authoritative online resolution after serialization`, () => {
      const patient = unit('cracked-head', owner, 0);
      const source = createCardInstance(id, owner, 'community-online', 0);
      const initial = { ...blank(), boards: [[patient], [], []] as Match['boards'],
        phase: owner === 'player' ? 'player' as const : 'cpu-reveal' as const,
        [owner === 'player' ? 'playerHand' : 'cpuHand']: [source] };
      const expected = playTurnCard(JSON.parse(JSON.stringify(initial)), owner, source.instanceId, 0);
      const member = (userId: string) => ({ userId, name: userId, ready: false,
        deck: { ...decks.find(d => d.id === 'block')!, cards: [...decks.find(d => d.id === 'block')!.cards] } });
      let room = joinOnlineRoom(createOnlineRoom(member('a'), 'player', 0), member('b'), 0);
      room = applyOnlineCommand(room, 'player', { type: 'ready' }, 1);
      room = applyOnlineCommand(room, 'cpu', { type: 'ready' }, 2);
      const actual = applyOnlineCommand({ ...room, match: initial, activeSeat: owner, turnsEnded: 0 },
        owner, { type: 'play', instanceId: source.instanceId, lane: 0, squabble: false }, 10);
      assert.deepEqual(actual.match!.boards, expected.boards);
      assert.deepEqual(actual.match!.creativeMarks, expected.creativeMarks);
      assert.deepEqual(actual.match!.foodzCommunityServed, expected.foodzCommunityServed);
    });
}

test('the complete Everybody Eats crew including Cracked Head replays through the authoritative verifier', () => {
  const community = decks.find(d => d.id === 'community-table')!, rival = decks.find(d => d.id === 'block')!;
  let m = createMatchFromEngineCards(community.id, [...community.cards], rival.id, [...rival.cards]);
  const moves: PlayerMove[] = [];
  while (m.phase !== 'complete') {
    const plays = listLegalBalancePlays(m, 'player', false);
    const chosen = plays.sort((a, b) => {
      const rank = (id: string) => id === 'foodz' ? 1 : id === 'community-cook' ? 2 : isHomelessCharacter({ cardId: id }) ? 0 : 3;
      return rank(a.cardId) - rank(b.cardId) || a.cost - b.cost || a.lane - b.lane;
    })[0];
    if (chosen) {
      moves.push({ cardInstanceId: chosen.instanceId, lane: chosen.lane, squabble: false, endTurn: false });
      m = playTurnCard(m, 'player', chosen.instanceId, chosen.lane);
    } else {
      moves.push({ cardInstanceId: null, lane: null, squabble: false, endTurn: true });
      m = nextRound(revealCpuTurn(pass(m, 'player')));
    }
    assert(moves.length <= 64);
  }
  assert.equal(m.foodzCommunityServed?.player, true);
  assert(m.effectLog.some(e => e.type === 'play' && e.cardId === 'cracked-head' && e.owner === 'player'));
  assert.deepEqual(verifyMatchTranscript(community.id, rival.id, moves, undefined, community.cards), m);
});
