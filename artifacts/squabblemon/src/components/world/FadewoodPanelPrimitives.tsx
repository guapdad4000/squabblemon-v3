import type { ButtonHTMLAttributes } from 'react';
import '../venue/cinema-nav.css';
import './fadewood-panels.css';

/** The same bolted green street signs used on the shared Squabble Express board. */
export function FadewoodPanelSign({ children, right = true, className = '', type = 'button', ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { right?: boolean }) {
  return <button {...props} type={type} className={`express-sign express-sign--${right ? 'right' : 'left'} fadewood-panel__sign ${className}`}>
    <span className="express-sign__post" aria-hidden="true" /><span className="express-sign__board"><span className="express-sign__bolt" aria-hidden="true" /><strong>{children}</strong><span className="express-sign__arrow" aria-hidden="true">{right ? '›' : '‹'}</span></span>
  </button>;
}
