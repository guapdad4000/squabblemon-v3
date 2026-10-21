import { memo, useLayoutEffect, useRef } from 'react';
import { MatPairArtwork } from './PlayerMatArtwork';

type Props = { playerId: string; rivalId: string; full?: boolean };
/** Follow the real field, including its scroll viewport and the landscape hand dock. */
export const BattlePlayerMats = memo(function BattlePlayerMats({ playerId, rivalId, full = false }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const single = full || playerId === rivalId;
  useLayoutEffect(() => {
    const node = ref.current, arena = node?.closest<HTMLElement>('.battle-arena');
    const field = arena?.querySelector<HTMLElement>('.battlefield-grid');
    const lane = field?.querySelector<HTMLElement>('.district-lane');
    if (!node || !arena || !field || !lane) return;
    const align = () => {
      const parent = node.getBoundingClientRect(), first = lane.getBoundingClientRect(), visible = field.getBoundingClientRect();
      const join = Math.max(0, Math.min(parent.height, first.top + first.height / 2 - parent.top));
      node.style.setProperty('--mat-split', `${join}px`);
      // One shared scale puts both source midpoints on the score row. Each side
      // reveals only its source half, without resizing a scene inside every lane.
      node.style.setProperty('--mat-canvas-height', `${2 * Math.max(join, parent.height - join)}px`);
      // Portrait framing excludes the header and hand from the camera height.
      // Keep its scale stable while the field scrolls; only the center follows.
      const mobileHeight = Math.min(single ? visible.height : Math.max(visible.height, first.height), visible.width * 1.45);
      const mobileCenter = single ? visible.top - parent.top + visible.height / 2 : join;
      node.style.setProperty('--mat-mobile-height', `${mobileHeight}px`);
      node.style.setProperty('--mat-mobile-center', `${mobileCenter}px`);
    };
    align();
    const observer = new ResizeObserver(align);
    observer.observe(arena); observer.observe(field); observer.observe(lane);
    let frame = 0;
    const onScroll = () => { if (!frame) frame = requestAnimationFrame(() => { frame = 0; align(); }); };
    field.addEventListener('scroll', onScroll, { passive: true });
    return () => { observer.disconnect(); field.removeEventListener('scroll', onScroll); cancelAnimationFrame(frame); };
  }, [single]);
  return <div ref={ref} className="battle-player-mats" data-testid="battle-player-mats" data-player-mat={playerId} data-rival-mat={rivalId} data-mat-layout={single ? 'full' : 'split'} aria-hidden="true"><MatPairArtwork playerId={playerId} rivalId={rivalId} full={single} eager/></div>;
});
