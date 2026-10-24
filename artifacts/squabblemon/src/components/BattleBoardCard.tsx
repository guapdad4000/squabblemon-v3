import React from 'react';
import { LayoutGroup } from 'framer-motion';
import type { CardInstance, CharacterDistrictMark } from '../gameEngine';
import { CardView } from './CardView';

/** The item strip reserves space only when a rendered artwork badge exists. */
export function battleItemStripPresence(marks: readonly Pick<CharacterDistrictMark, 'lane' | 'artworkId'>[], districtCount: number) {
  return Array.from({ length: districtCount }, (_, lane) => marks.some(mark => mark.lane === lane && Boolean(mark.artworkId)));
}

/** A crowded crew can increase the shared grid row height in every district. */
export function battleBoardLayoutDependency(
  boards: readonly (readonly Pick<CardInstance, 'instanceId' | 'owner'>[])[],
  staged: { instanceId: string; owner: CardInstance['owner']; lane: number } | null,
  layoutMode: string,
) {
  return JSON.stringify([layoutMode, boards.map(cards => cards.map(card => [card.instanceId, card.owner])), staged]);
}

// Stable inspection handlers let unchanged board cards skip timer/HUD renders.
export const BattleBoardCard = React.memo(function BattleBoardCard({ card, inspect, ...props }: Omit<React.ComponentProps<typeof CardView>, 'onInspect' | 'onClick'> & { inspect: (card: CardInstance) => void; card: CardInstance }) {
  const onInspect = React.useCallback(() => inspect(card), [card, inspect]);
  const onClick = React.useCallback((event: React.MouseEvent) => { event.stopPropagation(); inspect(card); }, [card, inspect]);
  // Phase changes detach this card's inspection projection. An independent group
  // prevents that teardown from dirtying every other board and hand card. With
  // no group id the existing battle-inspect-* shared transition remains global.
  return <LayoutGroup inherit={false}><CardView {...props} battleArtwork boardPresentation="combat" card={card} onInspect={onInspect} onClick={onClick} /></LayoutGroup>;
});
