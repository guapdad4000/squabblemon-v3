import type { CSSProperties } from 'react';
import { getLocationArtwork } from '../locationArtwork';
import './location-artwork.css';

/** Decorative only: the existing lane button owns all input and accessible text. */
export function LocationNode({ id, index = 0 }: { id: string; index?: number }) {
  const art = getLocationArtwork(id);
  return <span className="location-node" data-location-art={id} aria-hidden="true"
    style={{ '--location-drift-delay': `${index * -2.3}s` } as CSSProperties}>
    <span className="location-node__aura" />
    <img className="location-node__scene" src={art.node} alt="" width="600" height="400"
      decoding="async" draggable={false} />
    <span className="location-node__shade" />
  </span>;
}

/** Three softly blended scenes follow the issued locations, including in replays. */
export function LocationWallpaper({ ids }: { ids: readonly string[] }) {
  return <div className="location-wallpaper" aria-hidden="true">
    {ids.slice(0, 3).map((id, index) => {
      const art = getLocationArtwork(id);
      return <img key={`${index}:${id}`} src={art.node}
        srcSet={`${art.node} 600w, ${art.wallpaper} 1200w`} sizes="33vw"
        alt="" width="1200" height="800" decoding="async" draggable={false} />;
    })}
  </div>;
}
