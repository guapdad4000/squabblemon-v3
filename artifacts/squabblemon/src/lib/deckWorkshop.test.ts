import { autoBuildDeck } from './deckWorkshop';
import { cardCatalog, cards } from '../data';
import assert from 'node:assert/strict';
import test from 'node:test';
import { recommendedWorkshopCrews, replaceDeckCard, summarizeDeckTest, workshopSuggestions } from './deckWorkshop';
import { ROOKIE_CORE_IDS, ROOKIE_MENTOR_CORE_IDS, LATER_DROP_STARTER_IDS, STARTER_STREET_REPLACEMENTS, starterStreetCrew, catalogCardById, ROOKIE_FOUNDATION_IDS, catalogIdsToEngineIds, engineIdsToCatalogIds, decks } from '../data';
import { createMatchFromEngineCards, pass, playCard, revealCpu, nextRound, verifyMatchTranscript } from '../gameEngine';
import { createDefaultBalanceDecks } from '@workspace/squabblemon-engine/balanceLab';

test('Counterplay audit distinguishes the legacy shell from the recommended practice crew', () => {
  const audit = createDefaultBalanceDecks();
  const legacy = audit.find(deck => deck.id === 'focus-counterplay')!;
  const recommended = audit.find(deck => deck.id === 'focus-counterplay-coherent')!;
  assert.match(legacy.name, /Legacy Comparison/);
  assert.deepEqual(recommended.cardIds, recommendedWorkshopCrews.counterplay);
  assert.notDeepEqual(legacy.cardIds, recommended.cardIds);
});

test('a full mixed deck keeps the replaced slot and moves its cover without duplicates', () => {
  const original = { name: 'Mine', cardIds: [...ROOKIE_CORE_IDS], heroCardId: 'rastamon', recipeId: null };
  const changed = replaceDeckCard(original, 5, 'nail-tech');
  assert.equal(changed.cardIds[5], 'nail-tech');
  assert.deepEqual(changed.cardIds.slice(0,5), original.cardIds.slice(0,5));
  assert.equal(changed.heroCardId, 'nail-tech');
  assert.equal(original.cardIds[5], 'rastamon');
  assert.equal(replaceDeckCard(changed, 5, changed.cardIds[0]), changed);
  assert.equal(replaceDeckCard(changed, -1, 'landlord'), changed);
  assert.equal(new Set(ROOKIE_FOUNDATION_IDS).size, 24);
  for (const id of ['cornball', 'plug', 'snow-bunny', 'dr-fade']) assert(ROOKIE_FOUNDATION_IDS.includes(id));
});

test('custom deck transcript replays the issued roster even if the saved deck changes', () => {
  const ids = catalogIdsToEngineIds(replaceDeckCard({ name: 'Mine', cardIds: [...ROOKIE_CORE_IDS], heroCardId: 'hooper', recipeId: null }, 3, 'nail-tech').cardIds);
  const issued = [...ids];
  let match = createMatchFromEngineCards('my-first-crew', issued, 'combo', decks.find(deck => deck.id === 'combo')!.cards);
  const snapshot = match.abilityUpgradeSnapshot;
  const moves: Array<{ cardInstanceId: string | null; lane: number | null; squabble: boolean }> = [];
  for (let round = 1; round <= 6; round++) {
    const card = match.playerHand.find(card => card.cost <= match.playerMotion);
    const move = { cardInstanceId: card?.instanceId ?? null, lane: card ? 0 : null, squabble: false };
    moves.push(move);
    match = card ? playCard(match, 'player', card.instanceId, 0) : pass(match, 'player');
    match = nextRound(revealCpu(match));
  }
  ids.reverse(); // A later editor change cannot affect this match.
  const replay = verifyMatchTranscript('my-first-crew', 'combo', moves, snapshot, issued);
  assert.deepEqual(replay.boards, match.boards);
  assert.equal(replay.phase, 'complete');
  assert.throws(() => verifyMatchTranscript('my-first-crew', 'combo', moves, snapshot, ids));
  assert.throws(() => verifyMatchTranscript('my-first-crew', 'combo', [{ ...moves[0], cardInstanceId: 'forged' }, ...moves.slice(1)], snapshot, issued));
  assert.match(summarizeDeckTest(match, 'nail-tech'), /Nail Tech/);
});

test('workshop teaches each affected archetype without creating or replacing decks', () => {
  assert.deepEqual(
    workshopSuggestions.map(lesson => lesson.cardId),
    ['landlord', 'dorothy', 'alice', 'sherlock', 'guap', 'bottle-girl', 'inmate-crafty', 'demario', 'the-opening-act', 'personal-trainer', 'boo-boo-the-fool', 'side-chick', 'ms-mary-mack', 'counter'],
  );
  for (const lesson of workshopSuggestions) {
    assert.ok(lesson.title.length > 0);
    assert.ok(lesson.detail.length > 0);
    assert.ok(lesson.testCrew.length >= 4);
    assert.ok(lesson.testCrew.includes(lesson.cardId));
    assert.deepEqual(engineIdsToCatalogIds(catalogIdsToEngineIds([...lesson.testCrew])), lesson.testCrew, `${lesson.cardId}: every suggested slot uses its collectible identity`);
  }
});

test('the four revised lessons expose complete legal balance-lab crews', () => {
  const lessons = Object.fromEntries(workshopSuggestions.map(lesson => [lesson.cardId, lesson]));
  const expected = {
    'inmate-crafty': recommendedWorkshopCrews.cellblock,
    sherlock: recommendedWorkshopCrews.detectives,
    demario: recommendedWorkshopCrews.mushroom,
    counter: recommendedWorkshopCrews.counterplay,
  } as const;
  for (const [cardId, engineCardIds] of Object.entries(expected)) {
    assert.equal(engineCardIds.length, 10);
    assert.equal(new Set(engineCardIds).size, 10);
    assert.deepEqual(lessons[cardId].testCrew, engineIdsToCatalogIds([...engineCardIds]));
    assert.deepEqual(catalogIdsToEngineIds(lessons[cardId].testCrew), [...engineCardIds]);
  }
});

test('revised workshop copy explains the dependable setup and bounded payoff', () => {
  const detail = (cardId: string) => workshopSuggestions.find(lesson => lesson.cardId === cardId)!.detail;
  assert.match(detail('inmate-crafty'), /another inmate or a real support card first/i);
  assert(detail('inmate-crafty').includes(`${cards['inmate-crafty'].cost}/${cards['inmate-crafty'].power} Crafty`));
  assert.match(detail('inmate-crafty'), /\+3 locally and \+3 across districts/);
  assert.match(detail('sherlock'), /actual Sherlock cancellation/i);
  assert.match(detail('sherlock'), /weakest other character \+2/i);
  assert(detail('sherlock').includes(`Watson is a ${cards.watson.cost}/${cards.watson.power}`));
  assert.match(detail('sherlock'), /repairs up to 3 actual damage/i);
  assert.match(detail('sherlock'), /Protects that ally or a fallback ally, and Protects Sherlock anywhere/i);
  assert(detail('demario').includes(`${cards.demario.cost}/${cards.demario.power} Demario`));
  assert.match(detail('demario'), /Normal or Powered Luigion consumes it once for \+2/);
  assert.match(detail('demario'), /SQUABBLE is optional for the powered jump/i);
  assert.doesNotMatch(detail('demario'), /adds only the powered jump/i);
  assert.match(detail('counter'), /two 1-Hand encore shots per match, at most once per round/i);
  assert.match(detail('counter'), /Gamer still rewards new Silence and Weaken/i);
  assert.doesNotMatch(detail('counter'), /Closet Nerd (?:costs|is) 3/i);
});


test('starter crews reserve fairytale cards for a later drop and migrate without duplicates', () => {
  for (const id of LATER_DROP_STARTER_IDS) assert(!ROOKIE_FOUNDATION_IDS.includes(id));
  for (const id of Object.values(STARTER_STREET_REPLACEMENTS)) assert(catalogCardById[id], id);
  const old = ['alice', 'oz', 'tin-man', 'lion', 'dorothy', 'scarecrow', 'cheshire', 'queen-of-hearts', 'wifey', 'dr-fade'];
  const next = starterStreetCrew(old);
  assert.equal(next.length, 10);
  assert.equal(new Set(next).size, 10);
  assert(next.every(id => !LATER_DROP_STARTER_IDS.includes(id as typeof LATER_DROP_STARTER_IDS[number])));
  assert.deepEqual(starterStreetCrew(next), next);
  assert.deepEqual(starterStreetCrew(ROOKIE_MENTOR_CORE_IDS), ROOKIE_MENTOR_CORE_IDS);
});


test('auto build uses ten distinct owned cards, preserves a partial lineup, and supports undo by leaving the input untouched', () => {
  const owned = cardCatalog.slice(0, 24).map(card => card.catalogId);
  const draft = { name: 'My crew', cardIds: owned.slice(0, 2), heroCardId: owned[0], recipeId: null };
  const next = autoBuildDeck(draft, owned);
  assert.equal(next.cardIds.length, 10);
  assert.equal(new Set(next.cardIds).size, 10);
  assert(next.cardIds.every(id => owned.includes(id)));
  assert(draft.cardIds.every(id => next.cardIds.includes(id)));
  assert.equal(next.heroCardId, draft.heroCardId);
  assert.equal(draft.cardIds.length, 2);
});
test('auto build never invents missing cards when the collection is too small', () => {
  const owned = cardCatalog.slice(0, 4).map(card => card.catalogId);
  const next = autoBuildDeck({name:'Small',cardIds:[],heroCardId:owned[0],recipeId:null}, [...owned, owned[0], 'invalid']);
  assert.equal(next.cardIds.length, 4);
  assert(next.cardIds.every(id => owned.includes(id)));
});


test('Music and Fitness lessons expose complete owned-card recipes and coherent automatic builds', () => {
  const cases = [
    ['the-opening-act', 'music', 'music-industry'],
    ['personal-trainer', 'fitness', 'fitness-circuit'],
  ] as const;
  const owned = cardCatalog.map(card => card.catalogId);
  for (const [hero, crewKey, starterId] of cases) {
    const engineIds = [...recommendedWorkshopCrews[crewKey]];
    const catalogIds = engineIdsToCatalogIds(engineIds);
    assert.equal(engineIds.length, 10);
    assert.equal(new Set(engineIds).size, 10);
    const lesson = workshopSuggestions.find(item => item.cardId === hero)!;
    assert.deepEqual(lesson.testCrew, catalogIds);
    const starter = decks.find(deck => deck.id === starterId)!;
    assert(starter, starterId + ' is a discoverable starter recipe');
    assert.deepEqual(new Set(starter.cards), new Set(engineIds));
    const original = { name: 'My crew', cardIds: [hero], heroCardId: hero, recipeId: null };
    const built = autoBuildDeck(original, owned);
    assert.deepEqual(new Set(built.cardIds), new Set(catalogIds));
    assert.deepEqual(original.cardIds, [hero], 'automatic build must not mutate the player draft');
  }
});

test('new faction builds preserve chosen partial lineups and never recruit an unowned performer', () => {
  const hero = 'the-opening-act';
  const owned = cardCatalog.map(card => card.catalogId).filter(id => id !== 'the-og-rap-legend');
  const built = autoBuildDeck({ name: 'My remix', cardIds: [hero, 'cornball'], heroCardId: hero, recipeId: null }, owned);
  assert.equal(built.cardIds.length, 10);
  assert(built.cardIds.includes('cornball'));
  assert(!built.cardIds.includes('the-og-rap-legend'));
  assert.equal(new Set(built.cardIds).size, 10);
});


test('each new Street Legends practice crew has ten unique collectible cards and covers all fifteen people', () => {
  const personalIds = ['boo-boo-the-fool', 'mr-mc-hands', 'ms-mary-mack', 'pimp-swookie', 'og-uncle-harley-davidson', 'suga-mama', 'side-chick', 'gas-station-window-wiper', 'parole-officer', 'work-hubby', 'he-just-a-friend', 'crazy-ex-boyfriend', 'uncle-sam', 'apartment-maintenance-sage', 'bail-bonds-auntie'];
  const covered = new Set<string>();
  for (const key of ['investigations', 'relationships', 'streetgrowth'] as const) {
    const crew = [...recommendedWorkshopCrews[key]];
    assert.equal(crew.length, 10);
    assert.equal(new Set(crew).size, 10);
    for (const id of engineIdsToCatalogIds(crew)) {
      assert(catalogCardById[id]);
      assert.notEqual(catalogCardById[id].kind, 'token');
      covered.add(id);
    }
  }
  for (const id of personalIds) assert(covered.has(id), id + ' needs an authored practice crew');
});
