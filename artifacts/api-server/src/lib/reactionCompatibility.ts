import { ANUNAKI_EVENT_REACTION_PACKS, ANUNAKI_RAID_REACTION_PACK, type ReactionView } from '@workspace/squabblemon-engine/reactions';

const eventReactionIds = new Set<string>([...ANUNAKI_EVENT_REACTION_PACKS, ANUNAKI_RAID_REACTION_PACK].flatMap(pack => [...pack.reactionIds]));
export const isAnunakiReaction = (id: string): boolean => eventReactionIds.has(id);

/** Old open tabs cannot render new reaction IDs. Filter per request, not per account or room. */
export function reactionViewForClient(view: ReactionView, supportsAnunaki: boolean): ReactionView {
  if (supportsAnunaki) return view;
  return {
    ...view,
    latest: Object.fromEntries(Object.entries(view.latest).filter(([, event]) => !event || !isAnunakiReaction(event.reactionId))),
    owned: view.owned.filter(id => !isAnunakiReaction(id)),
    tray: view.tray.filter(id => !isAnunakiReaction(id)),
  };
}
