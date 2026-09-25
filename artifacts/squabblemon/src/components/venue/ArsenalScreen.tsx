import type { ReactNode, Ref } from 'react';
import { ArsenalTabs } from '../ArsenalTabs';
import { useLocation } from 'wouter';
import '../../styles/arsenal.css';

/** Shared open stage for card management screens. */
export function ArsenalScreen({ children, className = '', label, rootRef }: { children: ReactNode; className?: string; label: string; rootRef?: Ref<HTMLElement> }) {
  const [path] = useLocation();
  const showTabs = path === '/game/collection' || path === '/game/decks' || path.startsWith('/game/decks/');
  return <section ref={rootRef} aria-label={label} className={`arsenal-screen ${className}`}>{showTabs && <ArsenalTabs />}{children}</section>;
}
