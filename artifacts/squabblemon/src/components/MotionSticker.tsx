import { useEffect, useState } from 'react';
import { getAssetUrl } from '../lib/assets';
import './motion-sticker.css';

type MotionStickerVariant = 'entry' | 'auth' | 'fade-tapes';

const assets: Record<MotionStickerVariant, { animated: string; still: string }> = {
  entry: {
    animated: 'assets/brand-motion/squabble-logo-entry.webp',
    still: 'assets/brand-motion/squabble-logo-entry-still.webp',
  },
  auth: {
    animated: 'assets/brand-motion/squabble-logo-auth.webp',
    still: 'assets/brand-motion/squabble-logo-auth-still.webp',
  },
  'fade-tapes': {
    animated: 'assets/brand-motion/dr-fade-tapes.webp',
    still: 'assets/brand-motion/dr-fade-tapes-still.webp',
  },
};

function shouldReduceMotion() {
  if (typeof window === 'undefined') return true;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
    || document.documentElement.dataset.reduceMotion === 'true';
}

export function MotionSticker({
  variant,
  className = '',
  label,
  eager = false,
}: {
  variant: MotionStickerVariant;
  className?: string;
  label?: string;
  eager?: boolean;
}) {
  const [reducedMotion, setReducedMotion] = useState(shouldReduceMotion);

  useEffect(() => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReducedMotion(shouldReduceMotion());
    preference.addEventListener('change', update);
    const observer = new MutationObserver(update);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-reduce-motion'] });
    return () => {
      preference.removeEventListener('change', update);
      observer.disconnect();
    };
  }, []);

  const asset = assets[variant];
  return (
    <span
      className={`motion-sticker motion-sticker--${variant} ${className}`}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <img
        src={getAssetUrl(reducedMotion ? asset.still : asset.animated)}
        alt=""
        draggable={false}
        decoding="async"
        loading={eager ? 'eager' : 'lazy'}
        fetchPriority={eager ? 'high' : 'auto'}
      />
    </span>
  );
}
