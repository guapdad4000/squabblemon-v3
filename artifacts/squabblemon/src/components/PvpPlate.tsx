import type { ReactNode } from 'react';
import { styleSetFor } from '@workspace/squabblemon-engine/cosmetics';
import type { OnlineBanner } from '@workspace/squabblemon-engine/multiplayer';
import { getBuddyBannerImage } from '../data';
import { getAssetUrl } from '../lib/assets';
import { FighterPortrait } from './profile/FighterPortrait';
import { CharacterSticker } from './CharacterBanner';

export type PvpIdentity = { name: string; hero: string; avatarKey?: string; level?: number; banner?: OnlineBanner };

/** Banner artwork for a display-only equipped banner, if it still resolves. */
export function bannerArtUrl(banner?: OnlineBanner) {
  const set = styleSetFor(banner?.cardId);
  if (!banner || !set) return undefined;
  if (banner.cardId === 'buddy') return getBuddyBannerImage();
  return getAssetUrl(set.banner ?? set.background);
}

/** One player's nameplate in the PvP top bar: banner strip, portrait, name and level. */
export function PvpPlate({ side, identity, detail, children }: { side: 'you' | 'rival'; identity: PvpIdentity; detail?: ReactNode; children?: ReactNode }) {
  const art = bannerArtUrl(identity.banner);
  return <div className={`pvp-plate pvp-plate--${side}`} data-has-banner={art ? 'true' : 'false'} data-finish={identity.banner?.finish ?? 'base'} data-testid={`pvp-plate-${side}`}>
    {art && <img className="pvp-plate__banner" src={art} alt="" aria-hidden="true" decoding="async" />}
    {art && identity.banner?.stickers?.length ? <BannerStickers ids={identity.banner.stickers} /> : null}
    <div className="pvp-plate__avatar" data-testid={side === 'you' ? 'pvp-player-avatar' : 'pvp-rival-avatar'}><FighterPortrait cardId={identity.hero} avatarKey={identity.avatarKey} name={identity.name} /></div>
    <div className="pvp-plate__copy">
      <small>{side === 'you' ? 'You' : 'Rival'}{identity.level !== undefined && <b className="pvp-level">Lv {identity.level}</b>}</small>
      <strong title={identity.name}>{identity.name}</strong>
      {detail && <span className="pvp-plate__detail">{detail}</span>}
    </div>
    {children}
  </div>;
}

/** Up to three stickers the player placed on their equipped banner. */
export function BannerStickers({ ids }: { ids: string[] }) {
  return <div className="pvp-banner-stickers" aria-hidden="true">{ids.slice(0, 3).map(id => <CharacterSticker key={id} id={id} decorative />)}</div>;
}
