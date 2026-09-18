import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { Maximize2, Minimize2 } from 'lucide-react';
import '../../styles/arsenal.css';

const FocusContext = createContext({ focused: false, toggle: () => {} });

/** Shared open stage for card management screens. Focus stays local to this screen. */
export function ArsenalScreen({ children, className = '', label }: { children: ReactNode; className?: string; label: string }) {
  const [focused, setFocused] = useState(false);
  useEffect(() => {
    if (!focused) return;
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !document.querySelector('dialog[open], [role="dialog"]')) setFocused(false);
    };
    window.addEventListener('keydown', escape);
    return () => window.removeEventListener('keydown', escape);
  }, [focused]);
  return <FocusContext.Provider value={{ focused, toggle: () => setFocused(value => !value) }}>
    <section aria-label={label} className={`arsenal-screen ${focused ? 'arsenal-screen--focused' : ''} ${className}`}>{children}</section>
  </FocusContext.Provider>;
}

export function FocusViewButton() {
  const { focused, toggle } = useContext(FocusContext);
  const Icon = focused ? Minimize2 : Maximize2;
  return <button type="button" className="arsenal-icon" aria-label={focused ? 'Exit focus view' : 'Focus view'}
    aria-pressed={focused} title={focused ? 'Exit focus view (Esc)' : 'Focus view'} onClick={toggle}><Icon size={18} aria-hidden="true" /></button>;
}
