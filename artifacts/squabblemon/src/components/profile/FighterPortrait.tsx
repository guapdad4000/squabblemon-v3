import { useState } from 'react';
import { UserRound } from 'lucide-react';
import type { PlayerBootstrap } from '@workspace/api-client-react';
import { catalogCardById } from '@workspace/squabblemon-engine/data';
import { getCardImage } from '../../lib/assets';

export function catalogPortrait(id: string) {
  const card = Object.hasOwn(catalogCardById, id) ? catalogCardById[id] : undefined;
  return card && card.kind !== 'support' && card.kind !== 'token' ? card : undefined;
}

export function profilePortrait(profile: PlayerBootstrap['profile']) {
  const saved = catalogPortrait(profile.avatarKey);
  const card = saved ?? profile.ownedCardIds.map(catalogPortrait).find(Boolean) ?? catalogPortrait('cornball')!;
  return { card, isFallback: !saved };
}

/** The text fallback remains usable even when every illustration request fails. */
export function FighterPortrait({ cardId, name, decorative = false }: {
  cardId: string; name: string; decorative?: boolean;
}) {
  const [failedSource, setFailedSource] = useState('');
  const src = getCardImage(cardId);
  const failed = failedSource === src;
  return <div className="fighter-portrait" aria-hidden={decorative || undefined}>
    {failed ? <div className="fighter-portrait__fallback">
      <UserRound aria-hidden="true" size={48} />
      <span>{name}</span><small>Portrait unavailable</small>
    </div> : <img src={src} alt={decorative ? '' : `${name} portrait`} draggable={false} decoding="async" onError={() => setFailedSource(src)} />}
  </div>;
}