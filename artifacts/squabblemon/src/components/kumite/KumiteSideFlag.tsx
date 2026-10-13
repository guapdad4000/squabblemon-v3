import { useState, type ReactNode } from 'react';
import { getAssetUrl } from '../../lib/assets';

export function KumiteSideFlag({ title, children, className = '' }: { title: string; children: ReactNode; className?: string }) {
  const [fallback, setFallback] = useState(false);
  return <section className={`kumite-side-flag ${className}`} aria-label={title}>
    <img className="kumite-side-flag__cloth" src={getAssetUrl(`assets/kumite/${fallback ? 'yellow-banner' : 'side-flag'}.webp`)} alt="" draggable={false} onError={() => setFallback(true)} />
    <div className="kumite-side-flag__ink"><h2 aria-label={title}>{title.split(' ').map((word, index) => <span key={`${word}-${index}`}>{word}</span>)}</h2>{children}</div>
  </section>;
}
