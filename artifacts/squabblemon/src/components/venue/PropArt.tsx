import { getAssetUrl } from '../../lib/assets';

export type PropArtId = 'collection-box' | 'deck-stack' | 'foil-pack' | 'neighborhood-map' | 'championship-chain' | 'sticker-phone' | 'portable-speaker' | 'style-hanger' | 'fight-ticket' | 'clout-bag';

/** Decorative art: the surrounding heading or control supplies its accessible name. */
export function PropArt({ id, className = '' }: { id: PropArtId; className?: string }) {
  return <img className={`venue-prop ${className}`} src={getAssetUrl(id === 'championship-chain' ? 'assets/rewards/squabble-chain.webp' : ['style-hanger', 'fight-ticket', 'clout-bag'].includes(id) ? `assets/rewards/${id}.webp` : `assets/props/${id}.webp`)}
    alt="" aria-hidden="true" width={512} height={512} decoding="async" draggable={false} />;
}
