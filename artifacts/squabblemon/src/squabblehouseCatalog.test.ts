import assert from 'node:assert/strict';
import test from 'node:test';
import { cardCatalog, catalogCardById, catalogCardByEngineId, cards, decks, getCardImage, starterRecipes, validateCardAbilityUpgrades, validateSavedDeck } from './data';
import characterRevisions from './characterRevisions.json';
import { choosePackCardFromTier } from '../../../lib/squabblemon-engine/src/packRules';

const staffIds = ['squabblehouse-security', 'squabblehouse-teknician', 'griddle-master', 'inmate-reformed'];
const dogIds = ['cane-corso-red', 'blue-nose-pit'];
const addedStaffIds = ['squabblehouse-bus-boy', 'squabblehouse-cashier', 'waffle-warlord'];
const supportEngineId = 'sideofhands';
const supportCatalogId = 'a-side-of-hands';
const newIds = [...staffIds, ...dogIds, ...addedStaffIds];
const printedBudgets: Record<string, [number, number]> = {
  'squabblehouse-security': [3, 4],
  'squabblehouse-teknician': [5, 5],
  'griddle-master': [3, 3],
  'inmate-reformed': [3, 3],
  'cane-corso-red': [2, 3],
  'blue-nose-pit': [2, 4],
  'squabblehouse-bus-boy': [1, 2],
  'squabblehouse-cashier': [2, 3],
  'waffle-warlord': [5, 5],
};
const rarities: Record<string, string> = {
  'squabblehouse-security': 'Legendary',
  'squabblehouse-teknician': 'Mythical',
  'griddle-master': 'Rare',
  'inmate-reformed': 'Rare',
  'cane-corso-red': 'Rare',
  'blue-nose-pit': 'Rare',
  'squabblehouse-bus-boy': 'Uncommon',
  'squabblehouse-cashier': 'Rare',
  'waffle-warlord': 'Legendary',
};

test('Squabblehouse staff and dogs register as collectible, pack-eligible cards with their authored rarity and faction tags', () => {
  validateCardAbilityUpgrades();
  assert.equal(cardCatalog.length, 298);
  for (const id of newIds) {
    const card = catalogCardById[id];
    assert.ok(card, id);
    assert.equal(catalogCardByEngineId[id], card);
    assert.equal(card.catalogId, id);
    assert.equal(card.engineId, id);
    assert.equal(card.artworkId, id);
    assert.deepEqual([card.cost, card.power], printedBudgets[id]);
    assert.equal(card.rarity, rarities[id]);
    assert.deepEqual(card.acquisitionSources, ['Street Packs']);
    assert.equal(card.abilityUpgrades.length, 3, `${id} should have three upgrade steps`);
    assert.equal(card.variantSlots.length, 3, `${id} should have three cosmetic variants`);
    assert.equal(card.faction, 'Squabblehouse', `${id} should not fall through to Independent`);
    assert.equal(card.crewTags.includes('Squabblehouse'), staffIds.includes(id) || addedStaffIds.includes(id));
    if (!staffIds.includes(id) && !addedStaffIds.includes(id)) assert.ok(card.crewTags.includes('OG-support'));
    if (id === 'waffle-warlord') {
      assert.equal(getCardImage(id), `/assets/characters/waffle-warlord.webp?v=${characterRevisions['waffle-warlord']}`);
    }

    const tier = cardCatalog.filter(entry => entry.rarity === card.rarity && entry.acquisitionSources.includes('Street Packs'));
    const pulled = choosePackCardFromTier({
      rarity: card.rarity,
      tier,
      pulledCardIds: new Set(),
      ownedCardIds: new Set(),
      protectNew: true,
      rng: () => tier.findIndex(entry => entry.catalogId === id),
    });
    assert.equal(pulled.catalogId, id, `${id} can be selected from its regular Street Pack rarity tier`);
  }
});

test('A Side of Hands is a pack-eligible support with its catalog alias and no staff tag', () => {
  const support = catalogCardById[supportCatalogId];
  assert.ok(support);
  assert.equal(catalogCardByEngineId[supportEngineId], support);
  assert.equal(support.id, supportCatalogId);
  assert.equal(support.engineId, supportEngineId);
  assert.equal(support.catalogId, supportCatalogId);
  assert.equal(support.artworkId, supportCatalogId);
  assert.equal(getCardImage(supportEngineId), `/assets/characters/a-side-of-hands.webp?v=${characterRevisions[supportCatalogId]}`);
  assert.deepEqual([support.cost, support.power], [2, 0]);
  assert.equal(support.type, 'Earth');
  assert.equal(support.kind, 'support');
  assert.equal(support.rarity, 'Rare');
  assert.equal(support.faction, 'Squabblehouse');
  assert.deepEqual(support.acquisitionSources, ['Street Packs']);
  assert.equal(support.abilityUpgrades.length, 3);
  assert.equal(support.variantSlots.length, 3);
  assert.equal(support.crewTags.includes('Squabblehouse'), false);

  const tier = cardCatalog.filter(entry => entry.rarity === support.rarity && entry.acquisitionSources.includes('Street Packs'));
  const pulled = choosePackCardFromTier({
    rarity: support.rarity,
    tier,
    pulledCardIds: new Set(),
    ownedCardIds: new Set(),
    protectNew: true,
    rng: () => tier.findIndex(entry => entry.catalogId === supportCatalogId),
  });
  assert.equal(pulled.catalogId, supportCatalogId);
});

test('the previous saved staff/utility crew remains legal without being rewritten to the new recipe', () => {
  const previousEngineIds = [
    'squabble-house-manager', 'plug', 'waterboy', 'squabblehouse-security',
    'squabblehouse-teknician', 'griddle-master', 'inmate-reformed', 'janitor', 'laundry', 'nail',
  ];
  const savedCardIds = previousEngineIds.map(id => catalogCardByEngineId[id].catalogId);
  const before = JSON.stringify(savedCardIds);
  assert.equal(validateSavedDeck(savedCardIds, savedCardIds, 'squabblehouse-security').valid, true);
  assert.equal(JSON.stringify(savedCardIds), before);
  assert.notDeepEqual(savedCardIds, starterRecipes.find(recipe => recipe.id === 'squabblehouse-shift')!.catalogCardIds);
});

test('diner crew classifications retain staff identities without replacing collection factions', () => {
  for (const [engineId, catalogId] of [
    ['squabble-house-manager', 'squabble-house-manager'],
    ['squabblecook', 'squabble-house-male'],
    ['squabbleserver', 'squabble-house-female'],
    ['janitor', 'janitor'],
  ]) {
    const card = catalogCardByEngineId[engineId];
    assert.ok(card, engineId);
    assert.equal(card.catalogId, catalogId);
    assert.ok(card.crewTags.includes('Squabblehouse'), engineId);
  }
  for (const engineId of ['squabble-house-manager', 'squabblecook', 'squabbleserver']) {
    assert.equal(catalogCardByEngineId[engineId].faction, 'Squabblehouse');
  }
  assert.equal(catalogCardByEngineId.squabblecook.name, 'SquabbleHouse Cook');
  assert.equal(catalogCardByEngineId.squabbleserver.name, 'SquabbleHouse Server');
});

test('every diner card display name starts with the SquabbleHouse brand', () => {
  for (const engineId of [
    'squabble-house-manager', 'squabblehouse-bus-boy', 'squabblehouse-cashier',
    'squabblehouse-security', 'squabblehouse-teknician', 'griddle-master', 'inmate-reformed',
    'janitor', 'waffle-warlord', 'sideofhands', 'squabblecook', 'squabbleserver',
  ]) {
    assert.match(catalogCardByEngineId[engineId].name, /^SquabbleHouse /, engineId);
  }
});

test('Squabblehouse Shift is a legal ten-card staff recipe with no gang cards', () => {
  const recipe = decks.find(deck => deck.id === 'squabblehouse-shift');
  const registeredRecipe = starterRecipes.find(deck => deck.id === 'squabblehouse-shift');
  assert.ok(recipe);
  assert.ok(registeredRecipe);
  assert.deepEqual(recipe.cards, [
    'squabble-house-manager', 'squabblehouse-bus-boy', 'squabblehouse-cashier', 'squabblehouse-security',
    'squabblehouse-teknician', 'griddle-master', 'inmate-reformed', 'janitor', 'waffle-warlord', 'sideofhands',
  ]);
  assert.equal(recipe.archetype, 'Staff & Support');
  for (const gangCardId of [...dogIds, 'triple-og-blue', 'triple-og-red']) {
    assert.equal(recipe.cards.includes(gangCardId), false, `${gangCardId} belongs in a gang deck, not the staff recipe`);
    assert.ok(catalogCardByEngineId[gangCardId], `${gangCardId} must remain available outside this recipe`);
  }
  assert.doesNotMatch(recipe.plan, /kennel backup|OG finishers/);
  assert.equal(new Set(recipe.cards).size, 10);
  assert.equal(recipe.cards.length, 10);
  assert.deepEqual(registeredRecipe.catalogCardIds, recipe.cards.map(engineId => catalogCardByEngineId[engineId].id));
  assert.equal(validateSavedDeck(registeredRecipe.catalogCardIds, registeredRecipe.catalogCardIds, recipe.hero).valid, true);
  assert.deepEqual([cards.janitor.cost, cards.janitor.power], [3, 3]);
  assert.equal(cards.janitor.ability, 'Turn It Around');
  assert.match(cards.janitor.effect,
    /Two charges\/district\/round separately reverse first enemy Hands loss\/harmful status on any ally and first enemy-forced move\/return\/execution on staff/i);
  assert.match(cards.janitor.effect, /\+2 Hands each/i);
  assert.match(cards.janitor.effect, /duplicates share both/i);
  assert.match(cards.janitor.effect, /damage deaths use harm/i);
});
