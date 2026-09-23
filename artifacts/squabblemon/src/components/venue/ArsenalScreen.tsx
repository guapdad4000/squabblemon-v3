import type { ReactNode, Ref } from 'react';
import '../../styles/arsenal.css';

/** Shared open stage for card management screens. */
export function ArsenalScreen({ children, className = '', label, rootRef }: { children: ReactNode; className?: string; label: string; rootRef?: Ref<HTMLElement> }) {
  return <section ref={rootRef} aria-label={label} className={`arsenal-screen ${className}`}>{children}</section>;
}
