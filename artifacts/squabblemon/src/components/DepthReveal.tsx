import type { ReactNode } from 'react';

const SPARKS = Array.from({ length: 14 }, (_, i) => {
  const angle = (i / 14) * Math.PI * 2;
  const reach = 90 + (i % 3) * 30;
  return { '--i': i, '--dx': `${Math.cos(angle) * reach}px`, '--dy': `${Math.sin(angle) * reach}px` } as React.CSSProperties;
});

/** 3D flip-and-burst around a newly revealed card or reward. Re-key to replay. */
export function DepthReveal({ rarity, children, className = '' }: { rarity?: string; children: ReactNode; className?: string }) {
  return (
    <div className={`depth-reveal ${className}`} data-rarity={rarity?.toLowerCase()}>
      <span className="depth-reveal__burst" aria-hidden="true" />
      <div className="depth-reveal__turn">
        {children}
        <span className="depth-reveal__back" aria-hidden="true" />
      </div>
      {SPARKS.map((style, i) => <span key={i} className="depth-reveal__spark" style={style} aria-hidden="true" />)}
    </div>
  );
}
