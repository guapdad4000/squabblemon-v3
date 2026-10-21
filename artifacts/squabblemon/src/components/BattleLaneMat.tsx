import { memo } from 'react';
import { playerMatById } from '@workspace/squabblemon-engine/playerMats';
import { PlayerMatImage } from './PlayerMatImage';

/** Source thirds stay on their real lane at every ratio; SVG crops without stretching. */
export const BattleLaneMat = memo(function BattleLaneMat({ playerId, rivalId, lane, full = false }: { playerId: string; rivalId: string; lane: number; full?: boolean }) {
  return <div className="battle-lane-mat" aria-hidden="true" data-lane={lane}>
    {(full ? ['player'] as const : ['rival', 'player'] as const).map(side => {
      const mat = playerMatById(side === 'player' ? playerId : rivalId);
      if (!mat?.laneScene) return null;
      return <svg key={side} className={`battle-lane-mat__half battle-lane-mat__half--${full ? "full" : side}`} data-mat-id={mat.id} data-side={side} viewBox={`${lane * 512} 0 512 1024`} preserveAspectRatio="xMidYMid slice" focusable="false">
        <foreignObject x="0" y="0" width="1536" height="1024"><PlayerMatImage src={mat.assetId} eager/></foreignObject>
      </svg>;
    })}
  </div>;
});
