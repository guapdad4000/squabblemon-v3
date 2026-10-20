import assert from 'node:assert/strict';
import test from 'node:test';
import { autoBuildDeck, recommendedWorkshopCrews, type DeckDraft } from './deckWorkshop';
import { cardCatalog, catalogCardByEngineId, catalogCardById, canonicalElement } from '../data';

const catalogCrew = (engineCardIds: readonly string[]): string[] =>
  engineCardIds.map(cardId => catalogCardByEngineId[cardId].catalogId);

// Frozen pre-optimization selection policy, including stable score/locale ties.
function referenceAutoBuildDeck(draft: DeckDraft, ownedIds: readonly string[], element?: string | null): DeckDraft {
  const pool = [...new Set(ownedIds)].filter(id => catalogCardById[id] && catalogCardById[id].kind !== 'token');
  const owned = new Set(pool);
  const focus = element ? canonicalElement(element) : null;
  const focusedPool = pool.filter(id => canonicalElement(catalogCardById[id].type) === focus && catalogCardById[id].kind !== 'support');
  const hero = owned.has(draft.heroCardId) && (!focus || canonicalElement(catalogCardById[draft.heroCardId].type) === focus)
    ? draft.heroCardId : (focus ? focusedPool[0] ?? pool.find(id => canonicalElement(catalogCardById[id].type) === focus) : undefined) ?? pool.find(id => catalogCardById[id].kind !== 'support') ?? pool[0] ?? '';
  const chosen = !focus && draft.cardIds.length < 10 ? [...new Set(draft.cardIds)].filter(id => owned.has(id)).slice(0, 10) : [];
  if (hero && !chosen.includes(hero)) chosen.unshift(hero);
  const anchor = catalogCardById[hero];
  // Authored crews give these new factions a coherent starting point. Partial
  // player lineups still keep their chosen cards; only open slots are filled.
  const preferredCrew = anchor?.faction === 'Music Industry' ? recommendedWorkshopCrews.music
    : anchor?.faction === 'Fitness' ? recommendedWorkshopCrews.fitness
    : anchor?.faction === 'Family' ? recommendedWorkshopCrews.family
    : anchor?.faction === 'Community' || anchor?.artworkId?.startsWith('homeless-') ? recommendedWorkshopCrews.community : [];
  const preferred = new Set(catalogCrew(preferredCrew));
  while (chosen.length < 10) {
    const supports = chosen.filter(id => catalogCardById[id].kind === 'support').length;
    const cheap = chosen.filter(id => catalogCardById[id].cost <= 2).length;
    const expensive = chosen.filter(id => catalogCardById[id].cost >= 5).length;
    const score = (id: string) => {
      const c = catalogCardById[id];
      return (focus && canonicalElement(c.type) === focus ? 60 : 0)
        + (preferred.has(id) ? 40 : 0)
        + (anchor && c.faction === anchor.faction ? 8 : 0)
        + (anchor && c.type === anchor.type ? 4 : 0)
        + (c.cost <= 2 && cheap < 4 ? 10 : 0)
        + (c.cost >= 3 && c.cost <= 4 ? 5 : 0)
        - (c.cost >= 5 && expensive >= 2 ? 18 : 0)
        - (c.kind === 'support' && supports >= 2 ? 24 : 0)
        + c.power / Math.max(1, c.cost);
    };
    const next = pool.filter(id => !chosen.includes(id)).sort((a, z) => score(z) - score(a) || a.localeCompare(z))[0];
    if (!next) break;
    chosen.push(next);
  }
  // Opening hand has playable costs; later draws supply finishers.
  const ordered = chosen.sort((a, z) => catalogCardById[a].cost - catalogCardById[z].cost || a.localeCompare(z));
  return { ...draft, cardIds: ordered, heroCardId: hero, recipeId: null };
}

const allOwned = cardCatalog.map(card => card.catalogId);
const draft = (heroCardId: string, cardIds: string[] = []): DeckDraft => ({
  name: 'Reference parity', cardIds, heroCardId, recipeId: 'unchanged-input',
});

test('single-pass selection matches the previous policy for every catalog hero and element', t => {
  const focuses = [null, ...new Set(cardCatalog.map(card => canonicalElement(card.type)))];
  let cases = 0;
  for (const hero of allOwned) {
    for (const focus of focuses) {
      const input = draft(hero);
      const savedInput = structuredClone(input);
      assert.deepEqual(autoBuildDeck(input, allOwned, focus), referenceAutoBuildDeck(input, allOwned, focus), `${hero} / ${focus ?? 'mixed'}`);
      assert.deepEqual(input, savedInput);
      cases++;
    }
  }
  t.diagnostic(`Exact ordered roster, hero, recipe and draft parity for ${cases} full-catalog hero/focus cases.`);
});

test('selection retains exact policy for short, duplicate, unknown and partial inputs', () => {
  const collections = [[], allOwned.slice(0, 4), allOwned.slice(0, 10), allOwned.slice(0, 24), [...allOwned].reverse(), ['unknown', ...allOwned.slice(0, 18), ...allOwned.slice(0, 4), 'unknown']];
  const focuses = [undefined, null, '', 'Water', 'Plant', 'Electric', 'Normal', 'not-an-element'];
  for (const owned of collections) {
    for (const hero of ['', 'unknown', owned[0] ?? '', 'the-opening-act', 'personal-trainer']) {
      for (const initial of [[], owned.slice(0, 2), [...owned.slice(0, 2), ...owned.slice(0, 2)], owned.slice(0, 10), ['unknown', ...owned.slice(0, 3)]]) {
        for (const focus of focuses) {
          const input = draft(hero, initial);
          const savedInput = structuredClone(input);
          const savedOwned = [...owned];
          assert.deepEqual(autoBuildDeck(input, owned, focus), referenceAutoBuildDeck(input, owned, focus));
          assert.deepEqual(input, savedInput);
          assert.deepEqual(owned, savedOwned);
        }
      }
    }
  }
});

test('full-catalog builds read each remaining candidate score exactly once per open slot', t => {
  let scoreReads = 0;
  const originals = cardCatalog.map(card => [card, Object.getOwnPropertyDescriptor(card, 'power')!] as const);
  try {
    for (const [card, descriptor] of originals) {
      Object.defineProperty(card, 'power', { configurable: descriptor.configurable, enumerable: descriptor.enumerable, get() { scoreReads++; return descriptor.value; } });
    }
    for (const hero of ['the-opening-act', 'personal-trainer', 'hooper']) {
      scoreReads = 0;
      const before = referenceAutoBuildDeck(draft(hero), allOwned);
      const beforeReads = scoreReads;
      scoreReads = 0;
      const after = autoBuildDeck(draft(hero), allOwned);
      const afterReads = scoreReads;
      const eligible = cardCatalog.filter(card => card.kind !== 'token').length;
      const expectedReads = Array.from({ length: 9 }, (_, index) => eligible - index - 1).reduce((sum, count) => sum + count, 0);
      assert.deepEqual(after, before);
      assert.equal(afterReads, expectedReads);
      assert(afterReads < beforeReads / 3, 'selection should eliminate repeated comparator scoring, not just relocate it');
      t.diagnostic(`${hero}: score evaluations ${beforeReads} -> ${afterReads}; identical roster.`);
    }
  } finally {
    for (const [card, descriptor] of originals) Object.defineProperty(card, 'power', descriptor);
  }
});
