import React from 'react';
import type { CharacterDistrictMark } from '../gameEngine';
import { getAssetUrl } from '../lib/assets';
export function BattleItemBadges({ marks, round, open }: { marks: CharacterDistrictMark[]; round: number; open: (id?: string) => void }) {
  return <div className="battle-item-badges" aria-label="District items">{marks.filter(mark => mark.artworkId).map((mark, i) => {
    const name = mark.artworkId!.replaceAll('-', ' ');
    const counter = mark.progress ? `${mark.progress.current}/${mark.progress.total}` : mark.expiresRound !== undefined && mark.expiresRound < 99 ? `${Math.max(0, mark.expiresRound - round)}T` : '1';
    return <button type="button" key={mark.id ?? i} onClick={event => { event.stopPropagation(); event.currentTarget.focus({ preventScroll: true }); open(mark.id); }}
      className={`battle-item-badge${mark.kind === 'ancient-tablet' ? ' battle-item-badge--tablet' : ''}`} data-owner={mark.owner} data-testid={mark.kind === 'ancient-tablet' ? 'ancient-tablet-badge' : undefined} aria-label={`${mark.owner === 'player' ? 'Your' : 'The Opps’'} ${name}: ${mark.text}`} title={name}>
      <img src={getAssetUrl(`assets/items/${mark.artworkId}.webp`)} alt="" width="40" height="40" draggable={false}/><span>{mark.kind === 'ancient-tablet' ? (mark.owner === 'player' ? 'YOU' : 'OPP') : counter}</span>
    </button>;
  })}</div>;
}
