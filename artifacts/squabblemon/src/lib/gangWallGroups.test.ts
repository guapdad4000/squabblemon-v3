import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { PlayerBootstrap } from '@workspace/api-client-react';
import { cardCatalog, canonicalElement, decks, type CatalogCard } from '../data';
import { GangWall } from '../components/GangWall';
import { createGangWallGroupReader, getGangWallGroups, type WallMode } from './gangWallGroups';

// Original GangWall useMemo body. Group and card order are presentation behavior.
function referenceGroups(mode: WallMode, catalog: readonly CatalogCard[] = cardCatalog) {
  return mode === 'elements'
    ? [...new Set(catalog.map(card => canonicalElement(card.type)))].map(name => ({
      name, cards: catalog.filter(card => canonicalElement(card.type) === name),
    }))
    : mode === 'groups'
      ? [...new Set(catalog.map(card => card.faction))].map(name => ({
        name, cards: catalog.filter(card => card.faction === name),
      }))
      : mode === 'bonds'
        ? catalog.filter(card => card.elementalBond).map(card => ({
          name: card.name,
          cards: [card, ...catalog.filter(partner => partner.catalogId !== card.catalogId
            && canonicalElement(partner.type) === card.elementalBond)],
          note: card.effect,
        }))
        : decks.filter(crew => crew.archetype.includes('Combo') || crew.id === 'voltage' || crew.id === 'compound')
          .map(crew => ({
            name: crew.name, cards: catalog.filter(card => crew.cards.includes(card.engineId)), note: crew.plan,
          }));
}

const modes: WallMode[] = ['elements', 'groups', 'bonds', 'combos', 'road'];

test('shared groups retain every original group, ordered card, note and road fallback', () => {
  for (const mode of modes) {
    const groups = getGangWallGroups(mode);
    assert.deepEqual(groups, referenceGroups(mode), mode);
    assert.equal(getGangWallGroups(mode), groups, `${mode} returns the same public grouping across remounts`);
    for (const group of groups) {
      assert(group.cards.every(card => cardCatalog.includes(card)), 'retain original catalog card identity');
    }
  }
  assert.equal(getGangWallGroups('road'), getGangWallGroups('combos'), 'road keeps the existing combo-based paint/art fallback');
});

test('only four immutable grouping containers are retained, without freezing shared catalog cards', () => {
  const read = createGangWallGroupReader(cardCatalog, decks);
  const results = modes.map(read);
  assert.equal(new Set(results).size, 4);
  for (const groups of results) {
    assert(Object.isFrozen(groups));
    for (const group of groups) {
      assert(Object.isFrozen(group));
      assert(Object.isFrozen(group.cards));
    }
  }
  assert.equal(read('road'), read('combos'));
  assert.equal(Object.isFrozen(cardCatalog[0]), false, 'do not change the mutability of shared engine objects');
});

test('revisiting grouping modes eliminates repeated public-catalog scans', t => {
  let propertyReads = 0;
  const tracked = cardCatalog.map(card => new Proxy(card, {
    get(target, property, receiver) {
      propertyReads++;
      return Reflect.get(target, property, receiver);
    },
  }));
  const read = createGangWallGroupReader(tracked, decks);
  // Ten visits to all five tabs, matching mode changes that invalidated useMemo.
  const visits = Array.from({ length: 10 }, () => modes).flat();
  visits.forEach(mode => referenceGroups(mode, tracked));
  const before = propertyReads;
  propertyReads = 0;
  visits.forEach(read);
  const after = propertyReads;
  assert(after > 0, 'initial lazy grouping still does the real work');
  assert(after < before / 10, 'road reuses combos and every later tab visit reuses its group');
  propertyReads = 0;
  visits.forEach(read);
  assert.equal(propertyReads, 0, 'no catalog reads for any later mode visit');
  assert.equal(new Set(visits.map(read)).size, 4, 'visit count cannot grow the cache');
  t.diagnostic(`${visits.length} tab visits: catalog property reads ${before} -> ${after}; next ${visits.length} visits -> 0.`);
});

test('cached public groups never cache player ownership or reward state', () => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'sessionStorage');
  let mode: WallMode = 'elements';
  Object.defineProperty(globalThis, 'sessionStorage', {
    configurable: true,
    value: { getItem: (key: string) => key.endsWith(':mode') ? JSON.stringify(mode) : null },
  });
  const featured = getGangWallGroups('elements')[0].cards[0];
  const render = (ownedCardIds: string[], status: string, busy = false) => renderToStaticMarkup(createElement(GangWall, {
    bootstrap: {
      profile: { id: 'render-fixture', ownedCardIds },
      collectionRoad: [{ id: 'milestone', title: 'First mark', threshold: 2, status, rewardLabel: 'Pack ticket', description: 'Your earned reward' }],
    } as unknown as PlayerBootstrap,
    onClaim: () => undefined, busy, error: '',
  }));
  try {
    assert.match(render([featured.catalogId], 'locked'), /IN YOUR CREW/);
    assert.match(render([], 'locked'), /NOT COLLECTED/);
    mode = 'road';
    const claimable = render([], 'claimable');
    assert.match(claimable, /button-claim-milestone/);
    assert.match(claimable, /Claim your reward/);
    assert.match(render([], 'claimable', true), /Collecting/);
    const claimed = render([], 'claimed');
    assert.match(claimed, /Collected/);
    assert.doesNotMatch(claimed, /button-claim-milestone/);
  } finally {
    if (descriptor) Object.defineProperty(globalThis, 'sessionStorage', descriptor);
    else Reflect.deleteProperty(globalThis, 'sessionStorage');
  }
});
