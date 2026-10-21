import { useState, type CSSProperties } from 'react';
import { getAssetUrl } from '../lib/assets';

/** Native format selection: one request, with WebP for browsers without AVIF. */
export function PlayerMatImage({ src, portrait, thumbnail = false, eager = false, className, style }: {
  src: string; portrait?: string; thumbnail?: boolean; eager?: boolean; className?: string; style?: CSSProperties;
}) {
  const optimized = src.startsWith('assets/player-mats/v4/');
  const image = optimized && thumbnail ? src.replace('.webp', '-thumb.webp') : src;
  const portraitImage = thumbnail ? undefined : portrait;
  const [failedImage, setFailedImage] = useState<string | null>(null);
  const modern = optimized && failedImage !== image;
  return <picture className="player-mat-media">
    {portraitImage && <>
      {modern && <source media="(orientation: portrait)" type="image/avif" srcSet={getAssetUrl(portraitImage.replace('.webp', '.avif'))}/>}
      <source media="(orientation: portrait)" srcSet={getAssetUrl(portraitImage)}/>
    </>}
    {modern && <source type="image/avif" srcSet={getAssetUrl(image.replace('.webp', '.avif'))}/>}
    <img src={getAssetUrl(image)} className={className} style={style} alt="" draggable={false} loading={eager ? 'eager' : 'lazy'} decoding="async" onError={modern ? () => setFailedImage(image) : undefined}/>
  </picture>;
}
