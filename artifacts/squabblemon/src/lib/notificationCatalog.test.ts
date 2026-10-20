import assert from 'node:assert/strict';
import { test } from 'node:test';
import { cardCatalog, catalogCardById } from '../data';
import { CHARACTER_STYLE_SETS } from '@workspace/squabblemon-engine/cosmetics';
import { collectionNotifications } from './notificationCatalog';
import { referenceCollectionNotifications } from './testFixtures/notificationCatalog.reference';

const ids = cardCatalog.map(card => card.catalogId);
const variants = cardCatalog.flatMap(card => card.variantSlots.map(variant => variant.id));
const cosmetics = [
  ...Object.values(CHARACTER_STYLE_SETS).flatMap(set =>
    ['stickers', 'backdrop', 'banner-finish', 'unknown'].map(kind => `style:${set.cardId}:${kind}`)),
  ...ids.map(id => `mastery:${id}`),
  'badge:after-hours', 'badge:street-draft', 'badge:neighborhood', 'badge:unknown',
  'story-key:chapter-one', 'side-alley-tagged-cardback', 'block-party-crowned',
  '', 'style', 'style:missing:stickers', 'mastery:constructor', 'mastery:__proto__',
  'badge:toString', 'unknown:a/b?:c', 'story-key', 'unknown',
];

test('the existing direct catalog index is identical to first-match searches', () => {
  assert.equal(new Set(ids).size, ids.length, 'authored card IDs are unique');
  for (const card of cardCatalog) assert.equal(catalogCardById[card.catalogId], card);
});

test('a first sparse variant lookup does the original search, without indexing unrelated variants', () => {
  const profile = { ownedCardIds: [], ownedVariants: [variants.at(-1)!], unlockedCosmeticIds: [] };
  let predicates = 0;
  const original = cardCatalog.find;
  const descriptor = Object.getOwnPropertyDescriptor(cardCatalog, 'find');
  Object.defineProperty(cardCatalog, 'find', {
    configurable: true,
    value(predicate: (value: typeof cardCatalog[number], index: number, array: typeof cardCatalog) => unknown) {
      return original.call(cardCatalog, (card, index, array) => {
        predicates++;
        return predicate(card, index, array);
      });
    },
  });
  try {
    const baseline = referenceCollectionNotifications(profile);
    const baselinePredicates = predicates;
    predicates = 0;
    assert.deepEqual(collectionNotifications(profile), baseline);
    assert.equal(predicates, baselinePredicates, 'cold lookup scans exactly the same cards');
    predicates = 0;
    assert.deepEqual(collectionNotifications(profile), baseline);
    assert.equal(predicates, 0, 'only repeat lookup is skipped');
  } finally {
    if (descriptor) Object.defineProperty(cardCatalog, 'find', descriptor);
    else Reflect.deleteProperty(cardCatalog, 'find');
  }
});

test('collection notices preserve exact fields, order, duplicates and unknown-ID fallback', () => {
  const profiles = [
    { ownedCardIds: [], ownedVariants: [], unlockedCosmeticIds: [] },
    { ownedCardIds: ids, ownedVariants: variants, unlockedCosmeticIds: cosmetics },
    { ownedCardIds: ['constructor', '__proto__', 'toString', 'hasOwnProperty', '', 'missing/card?'],
      ownedVariants: ['constructor', '__proto__', 'toString', '', 'unknown'], unlockedCosmeticIds: cosmetics },
    { ownedCardIds: [...ids].reverse(), ownedVariants: [...variants].reverse(), unlockedCosmeticIds: [...cosmetics].reverse() },
    { ownedCardIds: [ids[0], ids[0], ids.at(-1)!], ownedVariants: [variants[0], variants[0]], unlockedCosmeticIds: [cosmetics[0], cosmetics[0]] },
  ];
  for (let seed = 1; seed <= 160; seed++) {
    profiles.push({
      ownedCardIds: ids.filter((_, index) => (index * 13 + seed) % (seed % 9 + 2) === 0),
      ownedVariants: variants.filter((_, index) => (index * 7 + seed) % (seed % 11 + 2) === 0),
      unlockedCosmeticIds: cosmetics.filter((_, index) => (index + seed * 17) % (seed % 7 + 2) === 0),
    });
  }
  for (const profile of profiles) {
    const before = JSON.stringify(profile);
    assert.equal(JSON.stringify(collectionNotifications(profile)), JSON.stringify(referenceCollectionNotifications(profile)));
    assert.equal(JSON.stringify(profile), before, 'input ownership must not be changed');
  }
});

test('every call reads current ownership and returns fresh notices, never cached player state', () => {
  const profile = { ownedCardIds: [ids[0]], ownedVariants: [variants[0]], unlockedCosmeticIds: [cosmetics[0]] };
  const first = collectionNotifications(profile);
  const repeated = collectionNotifications(profile);
  assert.notEqual(first, repeated);
  assert.notEqual(first[0], repeated[0]);
  profile.ownedCardIds.splice(0, 1, ids.at(-1)!);
  profile.ownedVariants.length = 0;
  profile.unlockedCosmeticIds.push('story-key:new-chapter');
  assert.deepEqual(collectionNotifications(profile), referenceCollectionNotifications(profile));
  assert.deepEqual(collectionNotifications({ ownedCardIds: [], ownedVariants: [], unlockedCosmeticIds: [] }), []);
  first[0].title = 'modified caller result';
  assert.deepEqual(collectionNotifications(profile), referenceCollectionNotifications(profile));
});

test('full-collection notice renders eliminate repeated linear catalog searches', t => {
  const profile = { ownedCardIds: ids, ownedVariants: variants, unlockedCosmeticIds: cosmetics };
  let predicates = 0;
  const original = cardCatalog.find;
  const descriptor = Object.getOwnPropertyDescriptor(cardCatalog, 'find');
  Object.defineProperty(cardCatalog, 'find', {
    configurable: true,
    value(predicate: (value: typeof cardCatalog[number], index: number, array: typeof cardCatalog) => unknown) {
      return original.call(cardCatalog, (card, index, array) => {
        predicates++;
        return predicate(card, index, array);
      });
    },
  });
  try {
    const baseline = referenceCollectionNotifications(profile);
    const before = predicates;
    predicates = 0;
    const result = collectionNotifications(profile);
    assert.deepEqual(result, baseline);
    assert.equal(predicates, 0);
    assert.ok(before > 50000);
    t.diagnostic(`${ids.length} cards / ${variants.length} variants / ${cosmetics.length} cosmetics: ${before} → ${predicates} linear catalog predicate visits; exact ${result.length}-notice output`);
  } finally {
    if (descriptor) Object.defineProperty(cardCatalog, 'find', descriptor);
    else Reflect.deleteProperty(cardCatalog, 'find');
  }
});
