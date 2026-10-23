import type { ReactNode } from 'react';
import { styleSetFor } from '@workspace/squabblemon-engine/cosmetics';
import { rankProgress, type OnlineBanner } from '@workspace/squabblemon-engine/multiplayer';
import { RankTrophy } from './RankArtwork';
import { getBuddyBannerImage } from '../data';
import { getAssetUrl } from '../lib/assets';
import { FighterPortrait } from './profile/FighterPortrait';
import { CharacterSticker } from './CharacterBanner';

export type PvpIdentity = { name: string; hero: string; avatarKey?: string; level?: number; rankPoints?: number; banner?: OnlineBanner };

/** Banner artwork for a display-only equipped banner, if it still resolves. */
export function bannerArtUrl(banner?: OnlineBanner) {
  const set = styleSetFor(banner?.cardId);
  if (!banner || !set) return undefined;
  if (banner.cardId === 'buddy') return getBuddyBannerImage();
  return getAssetUrl(set.banner ?? set.background);
}

/** One player's nameplate in the PvP top bar: banner strip, portrait, name and level. */
export function PvpPlate({ side, identity, detail, children, title, backdrop }: { side: 'you' | 'rival'; identity: PvpIdentity; detail?: ReactNode; children?: ReactNode; title?: string; backdrop?: 'brick' }) {
  const art = backdrop === 'brick' ? getAssetUrl('assets/progression/brick-ui-v1.webp') : bannerArtUrl(identity.banner);
  const tier = identity.rankPoints !== undefined && Number.isFinite(identity.rankPoints) ? rankProgress(identity.rankPoints).tier : undefined;
  return <div className={`pvp-plate pvp-plate--${side}`} data-has-banner={art ? 'true' : 'false'} data-finish={identity.banner?.finish ?? 'base'} data-backdrop={backdrop} data-testid={`pvp-plate-${side}`} title={title}>
    <div className="pvp-plate__surface" aria-hidden="true">{art && <img className="pvp-plate__banner" src={art} alt="" aria-hidden="true" decoding="async" />}
    {art && identity.banner?.stickers?.length ? <BannerStickers ids={identity.banner.stickers} /> : null}
    </div>
    <div className="pvp-plate__avatar" data-testid={side === 'you' ? 'pvp-player-avatar' : 'pvp-rival-avatar'}><FighterPortrait cardId={identity.hero} avatarKey={identity.avatarKey} name={identity.name} /></div>
    <div className="pvp-plate__copy">
      <strong title={identity.name}>{identity.name}</strong>
      <div className="pvp-plate__progress">
        {identity.level !== undefined && <span className="pvp-plate__level" aria-label={`Level ${identity.level}`}><b>{identity.level}</b><small>LV</small></span>}
        {tier && <span className="pvp-plate__rank" title={`${tier} · ${identity.rankPoints} rank points`}><RankTrophy tier={tier} /></span>}
        {detail && <span className="pvp-plate__detail">{detail}</span>}
      </div>
    </div>
    {children}
  </div>;
}

/** Up to three stickers the player placed on their equipped banner. */
export function BannerStickers({ ids }: { ids: string[] }) {
  return <div className="pvp-banner-stickers" aria-hidden="true">{ids.slice(0, 3).map(id => <CharacterSticker key={id} id={id} decorative />)}</div>;
}
