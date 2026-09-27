import * as React from 'react';
import { getAssetUrl } from '../../lib/assets';
import './street-close.css';

/**
 * Reusable in-world exit controls pulled from existing game art:
 *  - `red-x`: the hand-painted red X used on bespoke overlays.
 *  - `exit-sign`: the red back-arrow street sign used by GameBackButton.
 *  - `paper-tab`: a torn paper tab for paper/clipboard panels.
 * Every variant is at least 44×44 and respects notch safe areas when pinned.
 */
export type StreetCloseVariant = 'red-x' | 'exit-sign' | 'paper-tab';

export const StreetCloseMark = ({ variant = 'red-x', label }: { variant?: StreetCloseVariant; label?: string }) => (
  variant === 'exit-sign'
    ? <><img src={getAssetUrl('brand/navigation/back-arrow.webp')} alt="" draggable={false} /><span aria-hidden="true">{label ?? 'Exit'}</span></>
    : variant === 'paper-tab'
      ? <span aria-hidden="true">{label ?? 'Close'}</span>
      : <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M5 4.5 12 11l6.6-6.8 1.6 1.7L13.6 12.6l6.7 6.4-1.8 1.7-6.6-6.5-6.5 6.4-1.8-1.6 6.5-6.6L3.4 6.1z" /></svg>
);

export const streetCloseClass = (variant: StreetCloseVariant = 'red-x', className = '') =>
  `street-close street-close--${variant} ${className}`.trim();

export const StreetClose = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: StreetCloseVariant; label?: string }>(
  ({ variant = 'red-x', label, className, children, type = 'button', ...props }, ref) => (
    <button ref={ref} type={type} className={streetCloseClass(variant, className)} {...props}>
      {children ?? <StreetCloseMark variant={variant} label={label} />}
    </button>
  ),
);
StreetClose.displayName = 'StreetClose';
