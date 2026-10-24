import React, { useLayoutEffect, useMemo, useRef } from 'react';
import { getBattleArtCues, type BattleArtCue } from '@workspace/squabblemon-engine/battleArtwork';
import type { PresentationEffect } from './PlayLoop';
import { getAssetUrl } from '../lib/assets';
import { battlePortraitUrl } from '../lib/battlePortrait';
import './battle-art-effects.css';

/** One bounded burst per confirmed event, without timers, game writes or per-frame layout reads. */
export function BattleArtEffects({ effect, reducedMotion }: { effect: PresentationEffect; reducedMotion: boolean }) {
  const host = useRef<HTMLDivElement>(null);
  const cues = useMemo(() => effect.artCues ?? getBattleArtCues(effect), [effect]);
  useLayoutEffect(() => {
    const root = host.current?.closest('.battle-arena');
    if (!root || !cues.length) return;
    const bounds = root.getBoundingClientRect();
    const field = root.querySelector('.battlefield-grid')?.getBoundingClientRect() ?? bounds;
    const points = new Map<string, { x: number; y: number } | null>();
    const point = (id: string | undefined, cue: BattleArtCue) => {
      const key = `${id ?? ''}:${cue.owner}:${cue.lane}`;
      if (points.has(key)) return points.get(key)!;
      const card = id ? root.querySelector<HTMLElement>(`[data-card-zone="board"][data-instance-id="${CSS.escape(id)}"]`) : null;
      const zone = card?.closest('.battle-card-stack') ?? root.querySelector(`[data-testid="lane-${cue.lane}-${cue.owner}-zone"]`);
      const z = zone?.getBoundingClientRect(), c = card?.getBoundingClientRect();
      if (!z || z.width <= 0 || z.height <= 0) { points.set(key, null); return null; }
      const visible = c && c.top < z.bottom && c.bottom > z.top && c.left < z.right && c.right > z.left;
      const area = visible ? c : z;
      const result = { x: Math.max(36, Math.min(bounds.width - 36, area.left + area.width / 2 - bounds.left)),
        y: Math.max(field.top - bounds.top + 38, Math.min(field.bottom - bounds.top - 38, Math.max(z.top, Math.min(z.bottom, area.top + area.height / 2)) - bounds.top)) };
      points.set(key, result);
      return result;
    };
    const nodes = host.current?.querySelectorAll<HTMLElement>('[data-art-cue]');
    // Capture every anchor before revealing any cue. Interleaving a cue's style
    // writes with the next target's reads forces layout again for multi-target art.
    const placements = cues.map((cue, index) => {
      const node = nodes?.[index];
      return node ? { node, to: point(cue.targetId, cue), from: cue.fromId ? point(cue.fromId, cue) : null } : null;
    });
    for (const placement of placements) {
      if (!placement) continue;
      const { node, to, from } = placement;
      node.style.display = to ? '' : 'none';
      if (!to) continue;
      node.style.left = `${to.x}px`;
      node.style.top = `${to.y}px`;
      node.style.setProperty('--cue-x', `${from ? from.x - to.x : 0}px`);
      node.style.setProperty('--cue-y', `${from ? from.y - to.y : 18}px`);
    }
  }, [cues]);
  return <div ref={host} className="battle-art-effects" aria-hidden="true" data-reduced-motion={reducedMotion}>
    {cues.map(cue => <div key={cue.id} className={`battle-art-cue battle-art-cue--${cue.kind}`} data-art-cue={cue.id} data-testid={`art-cue-${cue.kind}`}
      style={{ display: 'none' }}>
      <img src={battlePortraitUrl(getAssetUrl(`assets/${cue.artwork}.webp`))} alt="" draggable={false} decoding="async"/><span>{cue.label}</span>
    </div>)}
  </div>;
}
