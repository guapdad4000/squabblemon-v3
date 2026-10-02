import assert from 'node:assert/strict';
import { cards } from '@workspace/squabblemon-engine/data';
import { createDefaultBalanceDecks, type BalanceDeck } from '@workspace/squabblemon-engine/balanceLab';
import { elementDecks } from './element-balance-audit-decks';

// Keep Vite asset types outside the scripts project while loading the exact offered crews.
const workshopModuleUrl = new URL('../../artifacts/squabblemon/src/lib/deckWorkshop.ts', import.meta.url).href;
const { recommendedWorkshopCrews } = await import(workshopModuleUrl) as {
  recommendedWorkshopCrews: Record<'cellblock' | 'mushroom', readonly string[]>;
};

export const excludedRankingCardIds = ['guap'] as const;
export const guapRankingReplacement = 'redneck-evil';

/** Authored recipes and established comparison builds, not arbitrary card combinations. */
export function allRankingDecks(): BalanceDeck[] {
  const candidates: BalanceDeck[] = [
    ...createDefaultBalanceDecks(),
    ...elementDecks,
    {
      id: 'focused-red-set', name: 'Blood / Red Set',
      cardIds: ['triple-og-red', 'block-spinner', 'redside1', 'ganger-red', 'cane-corso-red',
        'initiation', 'guap', 'folks', 'cognac', 'bustdown'],
    },
    {
      id: 'focused-blue-set', name: 'Crip / Blue Set',
      cardIds: ['triple-og-blue', 'look-out', 'blueside1', 'ganger-blue', 'blue-nose-pit',
        'initiation', 'waterboy', 'alchy', 'cognac', 'bustdown'],
    },
    { id: 'cellblock-pressure', name: 'Cellblock Pressure', cardIds: [...recommendedWorkshopCrews.cellblock] },
    { id: 'mushroom-plant', name: 'Mushroom Garden', cardIds: [...recommendedWorkshopCrews.mushroom] },
  ];
  const unique = new Map<string, BalanceDeck>();
  for (const deck of candidates) {
    assert.equal(deck.cardIds.length, 10, `${deck.id}: requires ten cards`);
    assert.equal(new Set(deck.cardIds).size, 10, `${deck.id}: repeated card`);
    assert(deck.cardIds.every(id => cards[id] && cards[id].kind !== 'token' && !cards[id].hazard),
      `${deck.id}: nonplayable card`);
    const existing = unique.get(deck.id);
    if (existing) {
      assert.deepEqual(existing.cardIds, deck.cardIds, `${deck.id}: conflicting crew definitions`);
      assert.equal(existing.orderKey, deck.orderKey, `${deck.id}: conflicting order keys`);
    } else unique.set(deck.id, { ...deck, cardIds: [...deck.cardIds] });
  }
  // Audit-only substitutions: preserve slot, engine ID and draw-order key.
  // Never edit the live card or shared authored recipes to change a test roster.
  const result = [...unique.values()].map(deck => ({
    ...deck,
    name: deck.id === 'focus-fire-guap' ? 'Fire Pressure' : deck.name,
    cardIds: deck.cardIds.map(id => id === 'guap' ? guapRankingReplacement : id),
  }));
  for (const deck of result) {
    assert.equal(deck.cardIds.length, 10);
    assert.equal(new Set(deck.cardIds).size, 10, `${deck.id}: replacement duplicated a card`);
    assert(deck.cardIds.every(id => cards[id] && cards[id].kind !== 'token' && !cards[id].hazard));
    assert(deck.cardIds.every(id => !excludedRankingCardIds.some(excluded => excluded === id)),
      `${deck.id}: excluded card in ranking build`);
  }
  assert.equal(new Set(result.map(deck => [...deck.cardIds].sort().join('|'))).size, result.length,
    'Duplicate compositions must not receive extra weight in the league');
  return result;
}