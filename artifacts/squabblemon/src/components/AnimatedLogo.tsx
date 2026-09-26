import { useState } from 'react';
import { getAssetUrl } from '../lib/assets';
import './animated-logo.css';

/** The supplied brand lockup stays intact; only its reflected light moves. */
export function AnimatedLogo({ className = '' }: { className?: string }) {
  const [paused, setPaused] = useState(false);
  return (
    <div className={`animated-logo ${className}`} data-paused={paused}>
      <div className="animated-logo__art">
        <img
          src={getAssetUrl('brand/prismatic/logos/squabblemon-lockup-gold.webp')}
          alt="Squabblemon — prismatic gold wordmark and impact fists"
          width={1440}
          height={822}
          draggable={false}
          decoding="async"
        />
      </div>
      <button
        type="button"
        className="animated-logo__toggle"
        aria-label={paused ? 'Play logo animation' : 'Pause logo animation'}
        aria-pressed={paused}
        onClick={() => setPaused(value => !value)}
        title={paused ? 'Play logo animation' : 'Pause logo animation'}
      >
        <span aria-hidden="true">{paused ? '▶' : 'Ⅱ'}</span>
      </button>
    </div>
  );
}
