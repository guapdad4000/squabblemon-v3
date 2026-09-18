import { useState } from 'react';
import { getAssetUrl } from '../lib/assets';
import './animated-logo.css';

const layers = [
  { name: 'crest', width: 900, height: 984 },
  { name: 'glove-left', width: 900, height: 955 },
  { name: 'glove-right', width: 900, height: 1001 },
  { name: 'wordmark', width: 1400, height: 366 },
] as const;

/** Four independent transparent assets; motion never blocks authentication. */
export function AnimatedLogo({ className = '' }: { className?: string }) {
  const [paused, setPaused] = useState(false);
  return (
    <div className={`animated-logo ${className}`} data-paused={paused}>
      <div className="animated-logo__art" role="img" aria-label="Squabblemon — crowned shield and boxing gloves">
        <div className="animated-logo__halo" aria-hidden="true" />
        {layers.map(({ name, width, height }) => (
          <div key={name} className={`animated-logo__layer animated-logo__${name}`}>
            <img
              src={getAssetUrl(`brand/layers/${name}.webp`)}
              alt=""
              width={width}
              height={height}
              draggable={false}
              decoding="async"
            />
          </div>
        ))}
      </div>
      <button
        type="button"
        className="animated-logo__toggle"
        aria-label={paused ? 'Play logo animation' : 'Pause logo animation'}
        onClick={() => setPaused(value => !value)}
        title={paused ? 'Play logo animation' : 'Pause logo animation'}
      >
        <span aria-hidden="true">{paused ? '▶' : 'Ⅱ'}</span>
      </button>
    </div>
  );
}
