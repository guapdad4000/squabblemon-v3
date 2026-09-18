import { getAssetUrl } from '../../lib/assets';

export type PropArtId = 'collection-box' | 'deck-stack' | 'foil-pack' | 'neighborhood-map' | 'championship-chain' | 'sticker-phone' | 'portable-speaker';

/** Decorative art: the surrounding heading or control supplies its accessible name. */
export function PropArt({ id, className = '' }: { id: PropArtId; className?: string }) {
  return <img className={`venue-prop ${className}`} src={getAssetUrl(`assets/props/${id}.webp`)}
    alt="" aria-hidden="true" width={512} height={512} decoding="async" draggable={false} />;
}
