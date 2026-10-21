import type { CardInstance, EffectLogEntry, Lane, Owner } from './gameEngine';

/** Presentation identities are distinct from collectible ownership and old artwork IDs. */
export const SUMMON_ARTWORK: Record<string, { artwork: string; creator: string }> = {
  'buddy-bud': { artwork: 'buddy-bud', creator: 'Buddy' },
  cardguard: { artwork: 'card-guard', creator: 'Queen of Hearts' },
  grin: { artwork: 'grin', creator: 'Cheshire' },
  guyana: { artwork: 'guyana', creator: 'Ashlee' },
  steward: { artwork: 'steward', creator: 'Captain Jigga' },
  'smile-bomb': { artwork: 'smile-bomb', creator: 'Kyle' },
  'demario-mushroom': { artwork: 'demario-mushroom', creator: 'DeMario' },
  'burnt-plate': { artwork: 'burnt-plate', creator: 'The Cookout' },
};
export const ITEM_ARTWORK: Record<string, string> = {
  stash: 'contraband', boarding: 'boarding-pass', lunch: 'packed-lunch', queue: 'queue-ticket',
  seed: 'seed', encore: 'encore', watch: 'watch', verse: 'verse', treat: 'treat', kit: 'emergency-kit',
};
export type BattleArtCue = {
  id: string; kind: 'plant' | 'sprout' | 'guard' | 'pass' | 'heal';
  artwork: string; owner: Owner; lane: Lane; fromId?: string; targetId: string; label: string;
};

/** Read only confirmed before/after state. This small projection is safe for the public event payload. */
export function getBattleArtCues(event: EffectLogEntry): BattleArtCue[] {
  if (!event.replay || event.type !== 'ability') return [];
  const before = event.replay.before, after = event.replay.after;
  const oldCards = new Map(before.boards.flat().map(card => [card.instanceId, card]));
  const newCards = new Map(after.boards.flat().map(card => [card.instanceId, card]));
  const cues: BattleArtCue[] = [];
  const add = (kind: BattleArtCue['kind'], artwork: string, target: CardInstance, fromId: string | undefined, label: string, id: string) => {
    if (target.lane !== null) cues.push({ id: `${event.sequence}:${id}`, kind, artwork, owner: target.owner, lane: target.lane, fromId, targetId: target.instanceId, label });
  };
  for (const card of newCards.values()) {
    if (oldCards.has(card.instanceId)) continue;
    if (card.cardId === 'buddy-bud') add('plant', 'characters/buddy-bud', card, card.buddyBud?.sourceInstanceId, 'Planted', card.instanceId);
    if (card.cardId === 'cardguard') add('guard', 'characters/card-guard', card, event.cardInstanceId, 'Royal Guard', card.instanceId);
  }
  for (const bud of oldCards.values()) {
    if (!bud.buddyBud || bud.buddyBud.sprouted || (newCards.has(bud.instanceId) && !newCards.get(bud.instanceId)?.buddyBud?.sprouted)) continue;
    // Destruction, cleanup and removal are not a sprout. The recipient must have a confirmed +3 change.
    if (after.round < bud.buddyBud.sproutsAtRound || event.cardInstanceId !== bud.buddyBud.sourceInstanceId) continue;
    const recipient = event.targets.map(p => newCards.get(p.cardInstanceId)).find(c => c && c.owner === bud.owner && c.lane === bud.lane && (c.powerModifier - (oldCards.get(c.instanceId)?.powerModifier ?? c.powerModifier)) === 3);
    if (recipient) add('sprout', 'characters/buddy-bud', recipient, bud.instanceId, '+3 Hands', bud.instanceId);
  }
  const nextMarks = new Map((after.creativeMarks ?? []).map(mark => [mark.id, mark]));
  for (const mark of before.creativeMarks ?? []) {
    const next = nextMarks.get(mark.id);
    if (mark.kind === 'stash' && event.cardInstanceId === mark.source.instanceId) {
      const carrier = next ? newCards.get(next.targets[0]) : (mark.seen?.length === 2 ? event.targets.map(p => newCards.get(p.cardInstanceId)).find(c => c && c.owner === mark.owner && c.cardId.startsWith('inmate-') && !mark.seen?.includes(c.instanceId) && c.powerModifier > (oldCards.get(c.instanceId)?.powerModifier ?? c.powerModifier)) : undefined);
      if (carrier && carrier.instanceId !== mark.targets[0]) add('pass', 'items/contraband', carrier, mark.targets[0] ?? mark.source.instanceId, next ? 'Contraband' : '3 carriers · paid', mark.id);
    }
    if (mark.kind === 'lunch' && !next && event.cardInstanceId === mark.source.instanceId) {
      const target = newCards.get(mark.targets[0]), prior = oldCards.get(mark.targets[0]);
      const healed = target && prior ? target.powerModifier - prior.powerModifier : 0;
      if (target && healed > 0) add('heal', 'items/packed-lunch', target, undefined, `+${healed} healed`, mark.id);
    }
  }
  return cues;
}
