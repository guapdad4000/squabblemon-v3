import { type CSSProperties, type ReactNode, useEffect, useRef } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { getAssetUrl } from '../../lib/assets';
import '../../styles/fadecade-dialog.css';

export interface FadecadeDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  children: ReactNode;
  kind?: 'road' | 'daily' | 'weekly' | 'training' | 'events' | 'stockz';
}

const MACHINE_BORDERS: Record<NonNullable<FadecadeDialogProps['kind']>, string> = {
  road: 'road-border-9slice.png',
  daily: 'daily-border-9slice.png',
  weekly: 'weekly-border-9slice.png',
  training: 'training-border-9slice.png',
  events: 'events-border-9slice.png',
  stockz: 'stockz-border-9slice.png',
};

export function FadecadeDialog({ open, onOpenChange, title, children, kind = 'road' }: FadecadeDialogProps) {
  const triggerRef = useRef<HTMLElement | null>(null);
  const reducedMotion = typeof document !== 'undefined' && document.querySelector('.fadecade-hub')?.getAttribute('data-reduce-motion') === 'true';
  const borderUrl = getAssetUrl(`assets/fadecade/frames/${MACHINE_BORDERS[kind]}`);
  const borderStyle = {
    '--machine-border': `url("${borderUrl}")`,
  } as CSSProperties;

  useEffect(() => {
    if (!open) return;
    const shell = document.querySelector<HTMLElement>('.immersive-shell');
    if (!shell) return;
    const overflow = shell.style.overflowY;
    shell.style.overflowY = 'hidden';
    return () => { shell.style.overflowY = overflow; };
  }, [open]);

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fadecade-dialog-overlay" data-reduced-motion={reducedMotion} />
        <DialogPrimitive.Content
          className={`fadecade-dialog-content fadecade-dialog-content--${kind}`}
          data-reduced-motion={reducedMotion}
          aria-describedby={undefined}
          onOpenAutoFocus={() => {
            // Capture before Radix moves focus inside the portal, not in an effect
            // which can run after the close button has already received focus.
            const focused = document.activeElement;
            triggerRef.current = focused instanceof HTMLElement && focused !== document.body
              ? focused
              : document.querySelector<HTMLElement>('.fadecade-hub button[aria-expanded="true"]');
          }}
          onCloseAutoFocus={(e) => {
            e.preventDefault();
            if (triggerRef.current && document.contains(triggerRef.current)) {
              triggerRef.current.focus({ preventScroll: true });
            }
          }}
        >
          <div className="fadecade-dialog-artwork-shell" style={borderStyle}>
            <img src={borderUrl} alt="" aria-hidden="true" hidden />
            <div className="fadecade-dialog-console-screen">
              <div className="fadecade-dialog-signal" aria-hidden="true"><i /><i /><i /><span>PLAYER READY</span></div>
              <header className="fadecade-dialog-art-header">
                <div className="fadecade-dialog-header-ink">
                  <span className="fadecade-dialog-eyebrow">
                    {kind === 'road' && 'NO SHORTCUTS'}
                    {kind === 'daily' && 'DAILY BOUNTY'}
                    {kind === 'weekly' && 'WEEKLY BOUNTY'}
                    {kind === 'training' && 'TRAINING'}
                    {kind === 'events' && 'SPECIAL EVENT'}
                    {kind === 'stockz' && 'THE CLOUT EXCHANGE'}
                  </span>
                </div>
              </header>
              <div className="fadecade-dialog-titlebar">
                <DialogPrimitive.Title className="fadecade-dialog-title">{title}</DialogPrimitive.Title>
                <DialogPrimitive.Close className="fadecade-dialog-close" aria-label="Close"><span aria-hidden="true">×</span> Close</DialogPrimitive.Close>
              </div>
              <div className="fadecade-dialog-scroll-body"><div className="fadecade-dialog-inner-content">{children}</div></div>
              <footer className="fadecade-dialog-art-footer">
                <div className="fadecade-dialog-footer-ink"><span>{kind === 'stockz' ? 'YOUR CALL. YOUR CLOUT.' : kind === 'road' ? 'TWO RUNS. ONE ROAD.' : kind === 'daily' || kind === 'weekly' ? 'EARN IT ON THE BLOCK' : 'PICK A CREW. THROW DOWN.'}</span></div>
              </footer>
            </div>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
