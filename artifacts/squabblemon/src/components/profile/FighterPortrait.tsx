import { useState } from 'react';
import { UserRound } from 'lucide-react';
import type { PlayerBootstrap } from '@workspace/api-client-react';
import { catalogCardById } from '@workspace/squabblemon-engine/data';
import { avatarSticker } from '@workspace/squabblemon-engine/cosmetics';
import { CharacterSticker } from '../CharacterBanner';
import { getCardImage } from '../../lib/assets';
import '../../styles/player-avatar.css';

export function catalogPortrait(id: string) {
  const card = Object.hasOwn(catalogCardById, id) ? catalogCardById[id] : undefined;
  return card && card.kind !== 'support' && card.kind !== 'token' ? card : undefined;
}

export function profilePortrait(profile: PlayerBootstrap['profile']) {
  const saved = catalogPortrait(profile.avatarKey);
  const sticker = avatarSticker(profile.avatarKey);
  const card = saved ?? profile.ownedCardIds.map(catalogPortrait).find(Boolean) ?? catalogPortrait('cornball')!;
  return { card, avatarKey: sticker ? profile.avatarKey : card.catalogId, name: sticker?.sticker.name ?? card.name, isSticker: !!sticker, isFallback: !saved && !sticker };
}

/** The text fallback remains usable even when every illustration request fails. */
export function FighterPortrait({ cardId = 'cornball', avatarKey, name, decorative = false }: {
  cardId?: string; avatarKey?: string; name: string; decorative?: boolean;
}) {
  const [failedSource, setFailedSource] = useState('');
  const sticker = avatarSticker(avatarKey);
  if (sticker) return <div className="fighter-portrait fighter-portrait--sticker" data-avatar-key={avatarKey}
    role={decorative ? undefined : 'img'} aria-label={decorative ? undefined : `${name} avatar`} aria-hidden={decorative || undefined}>
    <CharacterSticker id={sticker.sticker.id} decorative />
  </div>;
  const src = getCardImage(catalogPortrait(avatarKey ?? '')?.catalogId ?? cardId);
  const failed = failedSource === src;
  return <div className="fighter-portrait" aria-hidden={decorative || undefined}>
    {failed ? <div className="fighter-portrait__fallback">
      <UserRound aria-hidden="true" size={48} />
      <span>{name}</span><small>Portrait unavailable</small>
    </div> : <img src={src} alt={decorative ? '' : `${name} portrait`} draggable={false} decoding="async" onError={() => setFailedSource(src)} />}
  </div>;
}
