import { useEffect, useState } from 'react';
import layers from '../drFadeLayers.json';
import { getAssetUrl } from '../lib/assets';
import './dr-fade-card.css';

/** Registered artist-supplied layers; motion never changes the combat state. */
export function DrFadeArt({ className = '', animated = true }: { className?: string; animated?: boolean }) {
  return <span className={'dr-fade-art ' + (animated ? 'dr-fade-art--alive ' : '') + className} aria-hidden="true">
    <span className="dr-fade-art__canvas">
      {layers.layers.map(layer => <img key={layer.name} className={'dr-fade-art__' + layer.name}
        src={getAssetUrl(layer.asset)} alt="" decoding="async" draggable={false}
        style={{ left: layer.x / layers.width * 100 + '%', top: layer.y / layers.height * 100 + '%',
          width: layer.width / layers.width * 100 + '%', height: layer.height / layers.height * 100 + '%' }} />)}
      <i className="dr-fade-art__glint" />
    </span>
  </span>;
}

export function DrFadeEntrance({ cueId, squabble = false }: { cueId: number; squabble?: boolean }) {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    setVisible(true);
    const timeout = window.setTimeout(() => setVisible(false), 1000);
    return () => window.clearTimeout(timeout);
  }, [cueId]);
  if (!visible) return null;
  return <div className={'dr-fade-entrance ' + (squabble ? 'dr-fade-entrance--squabble' : '')}
    data-testid="dr-fade-entrance" aria-hidden="true">
    <DrFadeArt animated={false} />
    <i className="dr-fade-entrance__impact" />
    <div className="dr-fade-entrance__caption"><span>{squabble ? 'SQUABBLE · DR. FADE' : 'THE FIRST LESSON'}</span>
      <strong>Watch close. You’re next.</strong></div>
  </div>;
}
