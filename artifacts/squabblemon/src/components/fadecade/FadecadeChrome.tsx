import { type CSSProperties, type ReactNode, useEffect, useRef, useState } from 'react';
import { getAssetUrl } from '../../lib/assets';
import chrome from '../../lib/fadecadeChrome.json';
import '../../styles/fadecade-chrome.css';

function useScrollRetract(enabled: boolean, reducedMotion: boolean) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const scrollOwner = element.closest<HTMLElement>('.immersive-shell');
    const stage = element.classList.contains('fadecade-chrome-flag')
      ? element.closest('.fadecade-feature')?.querySelector('.fadecade-hero-stage') ?? element
      : element;
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    let frame = 0;
    function update() {
      frame = 0;
      if (!element) return;
      let reveal = 1;
      if (enabled && !reducedMotion && !preference.matches) {
        const viewport = scrollOwner?.getBoundingClientRect();
        const top = Math.max(0, viewport?.top ?? 0);
        const bottom = Math.min(window.innerHeight, viewport?.bottom ?? window.innerHeight);
        const height = Math.max(1, bottom - top);
        const bounds = stage.getBoundingClientRect();
        // The lower banner must remain readable while it is in view on phones,
        // even when the taller cabinet has already scrolled past. Measure its
        // untransformed position so its own retraction cannot feed back into it.
        const transform = stage === element ? window.getComputedStyle(element).transform : 'none';
        const shift = transform === 'none' ? 0 : new DOMMatrixReadOnly(transform).m42;
        const distance = Math.abs(bounds.top - shift + bounds.height / 2 - (top + bottom) / 2);
        reveal = 1 - Math.min(1, Math.max(0, (distance - height * 0.32) / (height * 0.5)));
      }
      element.style.setProperty('--chrome-reveal', reveal.toFixed(3));
      element.dataset.retract = String(reveal < 0.05);
    }
    function schedule() {
      if (!frame) frame = window.requestAnimationFrame(update);
    }
    // The immersive shell, not window/document, owns the arcade's scroll.
    const owner = scrollOwner ?? window;
    owner.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    preference.addEventListener('change', schedule);
    const resize = new ResizeObserver(schedule);
    resize.observe(stage);
    update();
    return () => {
      owner.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      preference.removeEventListener('change', schedule);
      resize.disconnect();
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [enabled, reducedMotion]);
  return ref;
}

function ChromeFrame({ file, className, children, retract = false, reducedMotion = false, ariaLive }: {
  file: keyof typeof chrome; className: string; children: ReactNode;
  retract?: boolean; reducedMotion?: boolean; ariaLive?: 'polite' | 'assertive' | 'off';
}) {
  const ref = useScrollRetract(retract, reducedMotion);
  const [missing, setMissing] = useState(false);
  const { width, height, textArea } = chrome[file];
  const style = {
    aspectRatio: `${width} / ${height}`,
    '--safe-left': `${textArea.x}%`, '--safe-top': `${textArea.y}%`,
    '--safe-width': `${textArea.width}%`, '--safe-height': `${textArea.height}%`,
  } as CSSProperties;
  return <div ref={ref} className={className} style={style} aria-live={ariaLive}
    data-art-missing={missing} data-reduced-motion={reducedMotion}>
    {!missing && <img src={getAssetUrl(`assets/fadecade/${file}`)} alt="" className="fadecade-chrome-img"
      width={width} height={height} draggable={false} onError={() => setMissing(true)} />}
    <div className="fadecade-chrome-content">{children}</div>
  </div>;
}

export function ChromeFlag({ side, children, reducedMotion = false }: {
  side: 'left' | 'right'; children: ReactNode; reducedMotion?: boolean;
}) {
  return <ChromeFrame file={`flag-${side}.webp`} className={`fadecade-chrome-flag fadecade-chrome-flag--${side}`}
    retract reducedMotion={reducedMotion}>{children}</ChromeFrame>;
}

export function ChromeBanner({ variant, children, ariaLive, reducedMotion = false }: {
  variant: 'stats' | 'footer'; children: ReactNode; reducedMotion?: boolean; ariaLive?: 'polite' | 'assertive' | 'off';
}) {
  return <ChromeFrame file={`${variant}-banner.webp`} className={`fadecade-chrome-banner fadecade-chrome-banner--${variant}`}
    ariaLive={ariaLive} retract={variant === 'stats'} reducedMotion={reducedMotion}>{children}</ChromeFrame>;
}