import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  BREAKTHROUGH_STARTER_DECKS,
  BREAKTHROUGH_ROSTER,
} from '@workspace/squabblemon-engine/breakthroughCatalog';
import { cardCatalog } from '@workspace/squabblemon-engine/data';
import {
  createGame,
  advance,
  chooseAi,
  deploy,
} from '@workspace/squabblemon-engine/breakthrough';
import { storyDeckReturnPath } from '../../lib/deckJourney';
import {
  accountPracticeDecks,
  practiceDeckLegality,
  practiceLoaner,
  practiceOpponent,
  breakthroughDeckEditorPath,
} from './practiceDecks';
import type { PlayerBootstrap } from '@workspace/api-client-react';

const owned = cardCatalog.map((card) => card.catalogId);
const recipe = BREAKTHROUGH_STARTER_DECKS[0];
const saved = {
  id: 'saved-a',
  name: 'My Crew',
  heroCardId: recipe.hero,
  cardIds: [...recipe.catalogCardIds],
};
const profile = {
  savedDecks: [saved],
  ownedCardIds: owned,
} as unknown as PlayerBootstrap['profile'];
test('account practice includes real saved decks and owned starters without changing either', () => {
  const before = JSON.stringify(profile),
    decks = accountPracticeDecks(profile);
  assert.deepEqual(decks[0], saved);
  assert.equal(practiceDeckLegality(decks[0], owned).valid, true);
  assert.equal(JSON.stringify(profile), before);
  assert(
    BREAKTHROUGH_STARTER_DECKS.every((recipe) =>
      decks.some((deck) => deck.id === recipe.id),
    ),
  );
});
test('unknown saved cards remain visible and fail canonical admission without replacements', () => {
  const deck = {
    ...saved,
    cardIds: [...saved.cardIds.slice(0, 9), 'not-a-canonical-card'],
  };
  const rows = accountPracticeDecks({
    ...profile,
    savedDecks: [deck],
  } as unknown as PlayerBootstrap['profile']);
  assert.deepEqual(rows[0].cardIds, deck.cardIds);
  const check = practiceDeckLegality(rows[0], owned);
  assert.equal(check.valid, false);
  assert.deepEqual(check.unknownCardIds, ['not-a-canonical-card']);
});
test('missing captain is validated rather than replaced by the first card', () => {
  const decks = accountPracticeDecks({
    ...profile,
    savedDecks: [{ ...saved, heroCardId: null }],
  } as unknown as PlayerBootstrap['profile']);
  assert.equal(decks[0].heroCardId, '');
  assert.equal(practiceDeckLegality(decks[0], owned).valid, false);
});
test('loaner is explicit, compatible and does not mutate account crews', () => {
  const before = JSON.stringify(profile),
    loaner = practiceLoaner();
  assert(loaner.id.startsWith('loaner:'));
  assert.equal(practiceDeckLegality(loaner, loaner.cardIds).valid, true);
  assert.equal(JSON.stringify(profile), before);
});
test('editor return permits only the exact Breakthrough destination and keeps encoding safe', () => {
  const path = breakthroughDeckEditorPath('saved / one');
  assert(path.startsWith('/game/decks/saved%20%2F%20one?'));
  assert.equal(
    storyDeckReturnPath(path.split('?')[1]),
    '/game/kumite/breakthrough',
  );
  for (const target of [
    'https://evil.test',
    '//evil.test',
    '/game/kumite/breakthrough/../../settings',
    '/game/kumite/breakthrough?evil=1',
  ])
    assert.equal(
      storyDeckReturnPath(`returnTo=${encodeURIComponent(target)}`),
      null,
    );
});
test('all fifteen real canonical starter crews complete actual CPU practice and rematch from clean state', () => {
  assert.equal(BREAKTHROUGH_STARTER_DECKS.length, 15);
  for (const [index, recipe] of BREAKTHROUGH_STARTER_DECKS.entries()) {
    const seed = 100 + index,
      decks = {
        player: [...recipe.catalogCardIds],
        opponent: practiceOpponent(seed),
      };
    const initial = createGame(BREAKTHROUGH_ROSTER, { seed, decks });
    let s = initial;
    while (s.status === 'playing') {
      for (const side of ['player', 'opponent'] as const) {
        const move = chooseAi(s, side, 'counter');
        if (move) {
          const result = deploy(
            s,
            side,
            move.cardId,
            move.lane,
            move.squabble,
            move.target,
          );
          assert.equal(result.error, undefined);
          s = result.state;
        }
      }
      s = advance(s, 50);
    }
    assert.equal(s.status, 'complete');
    assert(s.commands.length > 0);
    assert.deepEqual(createGame(BREAKTHROUGH_ROSTER, { seed, decks }), initial);
  }
});
