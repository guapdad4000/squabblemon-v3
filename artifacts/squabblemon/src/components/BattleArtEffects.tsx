import React, { useLayoutEffect, useRef, useState } from 'react';
import { getBattleArtCues, type BattleArtCue } from '@workspace/squabblemon-engine/battleArtwork';
import type { PresentationEffect } from './PlayLoop';
import { getAssetUrl } from '../lib/assets';
import './battle-art-effects.css';

type PositionedCue = BattleArtCue & { x: number; y: number; dx: number; dy: number };

/** One bounded burst per confirmed event, without timers, game writes or per-frame layout reads. */
export function BattleArtEffects({ effect, reducedMotion }: { effect: PresentationEffect; reducedMotion: boolean }) {
  const host = useRef<HTMLDivElement>(null);
  const [positions, setPositions] = useState<PositionedCue[]>([]);
  useLayoutEffect(() => {
    const root = host.current?.closest('.battle-arena');
    if (!root) return;
    const bounds = root.getBoundingClientRect();
    const field = root.querySelector('.battlefield-grid')?.getBoundingClientRect() ?? bounds;
    const nodes = Array.from(root.querySelectorAll<HTMLElement>('[data-card-zone="board"][data-instance-id]'));
    const point = (id: string | undefined, cue: BattleArtCue) => {
      const card = nodes.find(node => node.dataset.instanceId === id);
      const zone = card?.closest('.battle-card-stack') ?? root.querySelector(`[data-testid="lane-${cue.lane}-${cue.owner}-zone"]`);
      const z = zone?.getBoundingClientRect(), c = card?.getBoundingClientRect();
      if (!z || z.width <= 0 || z.height <= 0) return null;
      const visible = c && c.top < z.bottom && c.bottom > z.top && c.left < z.right && c.right > z.left;
      const area = visible ? c : z;
      return { x: Math.max(36, Math.min(bounds.width - 36, area.left + area.width / 2 - bounds.left)),
        y: Math.max(field.top - bounds.top + 38, Math.min(field.bottom - bounds.top - 38, Math.max(z.top, Math.min(z.bottom, area.top + area.height / 2)) - bounds.top)) };
    };
    setPositions((effect.artCues ?? getBattleArtCues(effect)).flatMap(cue => {
      const to = point(cue.targetId, cue), from = cue.fromId ? point(cue.fromId, cue) : null;
      return to ? [{ ...cue, ...to, dx: from ? from.x - to.x : 0, dy: from ? from.y - to.y : 18 }] : [];
    }));
  }, [effect]);
  return <div ref={host} className="battle-art-effects" aria-hidden="true" data-reduced-motion={reducedMotion}>
    {positions.map(cue => <div key={cue.id} className={`battle-art-cue battle-art-cue--${cue.kind}`} data-testid={`art-cue-${cue.kind}`}
      style={{ left: cue.x, top: cue.y, '--cue-x': `${cue.dx}px`, '--cue-y': `${cue.dy}px` } as React.CSSProperties}>
      <img src={getAssetUrl(`assets/${cue.artwork}.webp`)} alt="" draggable={false}/><span>{cue.label}</span>
    </div>)}
  </div>;
}
