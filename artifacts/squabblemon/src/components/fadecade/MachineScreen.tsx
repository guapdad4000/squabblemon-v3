import { useState, type ReactNode } from 'react';
import { getAssetUrl } from '../../lib/assets';
import geometry from '../../lib/fadecadeArt.json';

interface ArcadeCabinetProps {
  artUrl: string;
  aperture: { left: string; width: string; top: string; height: string };
  children: ReactNode;
  testId: string;
  className?: string;
  aspectRatio?: number;
}

export function ArcadeCabinet({ artUrl, aperture, children, testId, className = '', aspectRatio }: ArcadeCabinetProps) {
  const [failed, setFailed] = useState(false);
  const file = artUrl.split('/').at(-1) as keyof typeof geometry;
  const dimensions = geometry[file];
  const bounds = dimensions?.screen;
  const screen = bounds
    ? { left: `${bounds.x}%`, top: `${bounds.y}%`, width: `${bounds.width}%`, height: `${bounds.height}%` }
    : aperture;
  const ratio = dimensions ? dimensions.width / dimensions.height : aspectRatio;
  return (
    <div
      className={`arcade-cabinet ${className}`}
      data-testid={testId}
      data-art-failed={failed}
      style={{ containerType: 'inline-size', aspectRatio: ratio }}
    >
      <img
        className="arcade-cabinet__art"
        src={getAssetUrl(artUrl)}
        alt=""
        role="presentation"
        draggable={false}
        hidden={failed}
        onError={() => setFailed(true)}
      />
      <div className="arcade-cabinet__screen" style={screen}>
        {children}
        <div className="arcade-cabinet__crt-overlay" aria-hidden="true" />
      </div>
      <div className="arcade-cabinet__screen-border" style={screen} />
    </div>
  );
}
