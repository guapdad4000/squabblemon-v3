import { memo, useLayoutEffect, useRef } from 'react';
import { playerMatById } from '@workspace/squabblemon-engine/playerMats';
import { MatCharacter, MatPairArtwork } from './PlayerMatArtwork';

type Props = { playerId: string; rivalId: string; full?: boolean };
/** Follow the real field, including its scroll viewport and the landscape hand dock. */
export const BattlePlayerMats = memo(function BattlePlayerMats({ playerId, rivalId, full = false }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const node = ref.current, arena = node?.closest<HTMLElement>('.battle-arena');
    const field = arena?.querySelector<HTMLElement>('.battlefield-grid');
    const lane = field?.querySelector<HTMLElement>('.district-lane');
    if (!node || !arena || !field || !lane) return;
    const align = () => {
      const parent = arena.getBoundingClientRect(), box = field.getBoundingClientRect(), first = lane.getBoundingClientRect();
      const join = first.top + first.height / 2 - parent.top;
      node.style.setProperty('--mat-split', `${join}px`);
      arena.style.setProperty('--mat-field-top', `${box.top - parent.top}px`);
      arena.style.setProperty('--mat-field-bottom', `${Math.max(0, parent.bottom - box.bottom)}px`);
      arena.style.setProperty('--mat-field-left', `${box.left - parent.left}px`);
      arena.style.setProperty('--mat-field-width', `${box.width}px`);
      arena.style.setProperty('--mat-visible-join', `${Math.min(box.bottom - parent.top, Math.max(box.top - parent.top + 80, join))}px`);
    };
    align();
    const observer = new ResizeObserver(align);
    observer.observe(arena); observer.observe(field); observer.observe(lane);
    let frame = 0;
    const onScroll = () => { if (!frame) frame = requestAnimationFrame(() => { frame = 0; align(); }); };
    field.addEventListener('scroll', onScroll, { passive: true });
    return () => { observer.disconnect(); field.removeEventListener('scroll', onScroll); cancelAnimationFrame(frame); };
  }, []);
  return <div ref={ref} className="battle-player-mats" data-testid="battle-player-mats" data-player-mat={playerId} data-rival-mat={rivalId} data-mat-layout={full ? 'full' : 'split'} aria-hidden="true"><MatPairArtwork playerId={playerId} rivalId={rivalId} full={full} showCharacter={false} eager/></div>;
});
export const BattleMatCharacters = memo(function BattleMatCharacters({ playerId, rivalId, full = false }: Props) {
  return <div className="battle-mat-characters" aria-hidden="true">
    {(full ? ['player'] as const : ['rival','player'] as const).map(side => {
      const mat = playerMatById(side === 'player' ? playerId : rivalId);
      return mat?.characterId ? <div key={side} className={`battle-mat-character-anchor battle-mat-character-anchor--${side}`}><MatCharacter mat={mat} side={side}/></div> : null;
    })}
  </div>;
});
