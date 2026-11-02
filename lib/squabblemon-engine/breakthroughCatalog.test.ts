import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { cardCatalog, starterRecipes, validateSavedDeck } from './src/data';
import { anunakiCards } from './src/anunakiWave';
import { createGame, deploy, deploymentCost } from './src/breakthrough';
import {
  BREAKTHROUGH_ROSTER,
  BREAKTHROUGH_COMPATIBILITY,
  BREAKTHROUGH_STARTER_DECKS,
  breakthroughCardCompatibility,
  buildBreakthroughRoster,
  resolveBreakthroughCard,
  validateBreakthroughDeck,
} from './src/breakthroughCatalog';
test('registry supports all 311 canonical cards including Anunaki', () => {
  assert.equal(cardCatalog.length, 311);
  assert.equal(BREAKTHROUGH_COMPATIBILITY.length, 311);
  assert.equal(BREAKTHROUGH_ROSTER.length, 311);
  assert.equal(
    BREAKTHROUGH_COMPATIBILITY.filter((c) => c.supported).length,
    311,
  );
  assert.deepEqual(
    BREAKTHROUGH_COMPATIBILITY.filter((c) => !c.supported)
      .map((c) => c.cardId)
      .sort(),
    [],
  );
  for (const c of BREAKTHROUGH_ROSTER) {
    const canonical = cardCatalog.find((x) => x.catalogId === c.id)!;
    assert.equal(c.cost, canonical.cost);
    assert.equal(c.hands, canonical.power);
    assert.equal(c.element, canonical.type);
    assert.equal(c.printedDescription, canonical.effect);
    assert.equal(c.name, canonical.name);
    assert.ok(c.description);
  }
  const custom = buildBreakthroughRoster((c) => `art:${c.catalogId}`);
  assert.ok(custom.every((c) => c.art === `art:${c.id}`));
  assert.equal(resolveBreakthroughCard('pinaynurse'), undefined);
  assert.equal(resolveBreakthroughCard('made-up'), undefined);
  for (const c of BREAKTHROUGH_COMPATIBILITY.filter((c) => !c.supported))
    assert.ok(c.reason, c.cardId);
});
test('owned Anunaki decks validate and cards deploy without mutating inputs', () => {
  const cards = Object.keys(anunakiCards);
  assert.equal(validateBreakthroughDeck(cards, cards, 'anu').valid, true);
  for (const cardId of cards) {
    const state = createGame(BREAKTHROUGH_ROSTER, { decks: { player: cards, opponent: cards } });
    state.players.player.hand = [cardId]; state.players.player.motion = 9;
    const snapshot = structuredClone(state);
    assert.equal(deploy(state, 'player', cardId, 0).error, undefined);
    assert.deepEqual(state, snapshot);
  }
});
test('all fifteen canonical starter recipes are complete and passownership/hero/compatibility together', () => {
  assert.equal(BREAKTHROUGH_STARTER_DECKS.length, 15);
  assert.deepEqual(
    BREAKTHROUGH_STARTER_DECKS.map((c) => c.id).sort(),
    starterRecipes.map((c) => c.id).sort(),
  );
  for (const deck of BREAKTHROUGH_STARTER_DECKS) {
    const result = validateBreakthroughDeck(
      deck.catalogCardIds,
      deck.catalogCardIds,
      deck.hero,
    );
    assert.equal(result.valid, true, JSON.stringify(result));
    assert.equal(result.unsupportedCardIds.length, 0);
  }
});
test('saveddecks remainunchanged and failclosed forunknown,unowned,duplicates andmissinghero', () => {
  const deck = BREAKTHROUGH_STARTER_DECKS[0],
    cards = [...deck.catalogCardIds],
    snapshot = [...cards];
  assert.equal(
    validateBreakthroughDeck(cards, [], deck.hero).missingCardIds.length,
    10,
  );
  assert.equal(validateBreakthroughDeck(cards, cards, null).valid, false);
  assert.equal(validateBreakthroughDeck(cards, cards, 'guap').valid, false);
  const unknown = [...cards];
  unknown[0] = 'unknown-card';
  assert.deepEqual(
    validateBreakthroughDeck(unknown, unknown, deck.hero).unknownCardIds,
    ['unknown-card'],
  );
  const duplicate = [...cards];
  duplicate[0] = duplicate[1];
  assert.equal(
    validateBreakthroughDeck(duplicate, duplicate, deck.hero).valid,
    false,
  );
  assert.deepEqual(cards, snapshot);
});
