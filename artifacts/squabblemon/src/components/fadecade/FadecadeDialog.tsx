import { type CSSProperties, type ReactNode, useEffect, useRef, useState } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { getAssetUrl } from '../../lib/assets';
import chrome from '../../lib/fadecadeChrome.json';
import '../../styles/fadecade-dialog.css';

export interface FadecadeDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  children: ReactNode;
  kind?: 'road' | 'daily' | 'weekly' | 'training' | 'events';
}

export function FadecadeDialog({ open, onOpenChange, title, children, kind = 'road' }: FadecadeDialogProps) {
  const triggerRef = useRef<HTMLElement | null>(null);
  const [missingHeader, setMissingHeader] = useState(false);
  const [missingFooter, setMissingFooter] = useState(false);
  const reducedMotion = typeof document !== 'undefined' && document.querySelector('.fadecade-hub')?.getAttribute('data-reduce-motion') === 'true';
  const frameStyle = (file: keyof typeof chrome): CSSProperties => {
    const { width, height, textArea } = chrome[file];
    return {
      aspectRatio: `${width} / ${height}`,
      '--safe-left': `${textArea.x}%`, '--safe-top': `${textArea.y}%`,
      '--safe-width': `${textArea.width}%`, '--safe-height': `${textArea.height}%`,
    } as CSSProperties;
  };

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
          <div className="fadecade-dialog-artwork-shell">
            <header className="fadecade-dialog-art-header" style={frameStyle('stats-banner.webp')} data-art-missing={missingHeader}>
              {!missingHeader && <img src={getAssetUrl('assets/fadecade/stats-banner.webp')} alt="" className="fadecade-dialog-banner-img" draggable={false} onError={() => setMissingHeader(true)} />}
              <div className="fadecade-dialog-header-ink">
                <span className="fadecade-dialog-eyebrow">
                  {kind === 'road' && 'NO SHORTCUTS'}
                  {kind === 'daily' && 'DAILY BOUNTY'}
                  {kind === 'weekly' && 'WEEKLY BOUNTY'}
                  {kind === 'training' && 'TRAINING'}
                  {kind === 'events' && 'SPECIAL EVENT'}
                </span>
              </div>
            </header>
            <div className="fadecade-dialog-titlebar">
              <DialogPrimitive.Title className="fadecade-dialog-title">{title}</DialogPrimitive.Title>
              <DialogPrimitive.Close className="fadecade-dialog-close" aria-label="Close">
                Close
              </DialogPrimitive.Close>
            </div>
            <div className="fadecade-dialog-scroll-body">
              <div className="fadecade-dialog-inner-content">
                {children}
              </div>
            </div>
            <footer className="fadecade-dialog-art-footer" style={frameStyle('footer-banner.webp')} data-art-missing={missingFooter}>
              {!missingFooter && <img src={getAssetUrl('assets/fadecade/footer-banner.webp')} alt="" className="fadecade-dialog-footer-img" draggable={false} onError={() => setMissingFooter(true)} />}
              <div className="fadecade-dialog-footer-ink">
                <span>{kind === 'road' ? 'TWO RUNS. ONE ROAD.' : kind === 'daily' || kind === 'weekly' ? 'EARN IT ON THE BLOCK' : 'PICK A CREW. THROW DOWN.'}</span>
              </div>
            </footer>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
