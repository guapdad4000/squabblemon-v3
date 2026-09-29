import { useState, type CSSProperties, type ReactNode } from 'react';
const getAssetUrl = (path: string) => `/__mockup/images/fadebook-current/${path.split('/').pop()}`;

/**
 * Illustrated Squabble Phone (portrait) / Squabble Tablet (landscape).
 * One tree for both orientations: <picture> + CSS swap the art, so state never remounts.
 * The screen element is the only vertical scroll owner.
 */
export function DeviceFrame({ label, children, className = '', testId }: { label: string; children: ReactNode; className?: string; testId?: string }) {
  const [failed, setFailed] = useState(false);
  return <div className={`sq-device-stage ${className}`}>
    <div className="sq-device" data-art-failed={failed || undefined}
      style={failed ? undefined : { '--sq-tablet-art': `url("${getAssetUrl('assets/homies/squabble-tablet.webp')}")` } as CSSProperties}>
      {!failed && <picture className="sq-device__art" aria-hidden="true">
        <source media="(orientation: landscape)" srcSet={getAssetUrl('assets/homies/squabble-tablet.webp')} />
        <img src={getAssetUrl('assets/homies/squabble-phone.webp')} alt="" draggable={false} decoding="async" onError={() => setFailed(true)} />
      </picture>}
      <section className="sq-device__screen" aria-label={label} tabIndex={-1} data-testid={testId}>
        <div className="sq-device__content">{children}</div>
      </section>
    </div>
  </div>;
}
