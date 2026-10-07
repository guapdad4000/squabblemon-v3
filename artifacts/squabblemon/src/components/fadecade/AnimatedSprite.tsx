import { useEffect, useId, useRef, useState, type CSSProperties } from 'react';
import { getAssetUrl } from '../../lib/assets';
import { MOTION_ASSET_ROOT, type SpriteAnimation } from './motionSpriteCatalog';
import '../../styles/minigame-motion.css';

// All sprites share one observer and visibility listener; playback never needs a render tick.
const watched = new Set<HTMLElement>();
const onVisible = new Map<HTMLElement, () => void>();
let observer: IntersectionObserver | null = null;
function visibilityChanged() {
  for (const element of watched) element.dataset.motionHidden = String(document.hidden);
}
export function observeMotionElement(element: HTMLElement, visible?: () => void) {
  if (!watched.size) {
    document.addEventListener('visibilitychange', visibilityChanged);
    if (typeof IntersectionObserver !== 'undefined') observer = new IntersectionObserver(entries => {
      for (const entry of entries) {
        const target = entry.target as HTMLElement;
        target.dataset.motionVisible = String(entry.isIntersecting);
        if (entry.isIntersecting) { onVisible.get(target)?.(); onVisible.delete(target); }
      }
    });
  }
  watched.add(element);
  if (visible) { if (observer) onVisible.set(element, visible); else visible(); }
  element.dataset.motionHidden = String(document.hidden);
  observer?.observe(element);
  return () => {
    observer?.unobserve(element);
    watched.delete(element);
    onVisible.delete(element);
    if (!watched.size) {
      observer?.disconnect();
      observer = null;
      document.removeEventListener('visibilitychange', visibilityChanged);
    }
  };
}
export function motionSpriteUrl(animation: SpriteAnimation) {
  return getAssetUrl(`${MOTION_ASSET_ROOT}/${animation.atlas}.webp`);
}
export function AnimatedSprite({ animation, name, className = '', style, paused = false, animationKey, fallback, defer = false }: {
  animation: SpriteAnimation;
  name: string;
  className?: string;
  style?: CSSProperties;
  paused?: boolean;
  animationKey?: string | number;
  fallback?: string;
  defer?: boolean;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const clipId = `sprite-frame-${useId().replace(/:/g, '')}`;
  const [ready, setReady] = useState(!defer);
  const [failedSource, setFailedSource] = useState<string | null>(null);
  const source = motionSpriteUrl(animation);
  useEffect(() => ref.current ? observeMotionElement(ref.current, defer ? () => setReady(true) : undefined) : undefined, [defer]);
  const canRender = ready || !defer;
  const first = animation.firstFrame ?? 0;
  const width = animation.cellWidth;
  const motionStyle = {
    '--motion-duration': `${animation.duration}ms`,
    '--motion-0': `${-first * width}px`,
    '--motion-1': `${-(first + 1) * width}px`,
    '--motion-2': `${-(first + 2) * width}px`,
    '--motion-3': `${-(first + 3) * width}px`,
    '--motion-still': `${-(animation.stillFrame ?? first) * width}px`,
    ...style,
  } as CSSProperties;
  return <span ref={ref} className={`motion-sprite ${className}`} style={motionStyle}
    data-sprite={name} data-atlas={animation.atlas} data-row={animation.row}
    data-motion-ready={canRender} data-loop={animation.loop} data-frames={animation.frames ?? 4} data-paused={paused} aria-hidden="true">
    {!canRender ? <svg viewBox={`0 0 ${width} ${animation.cellHeight}`} focusable="false" /> : failedSource === source && fallback ? <img src={fallback} alt="" draggable={false} /> :
      <svg viewBox={`0 0 ${width} ${animation.cellHeight}`} preserveAspectRatio="xMidYMid meet" focusable="false">
        <defs><clipPath id={clipId}><rect width={width} height={animation.cellHeight} /></clipPath></defs>
        <g clipPath={`url(#${clipId})`}>
        <image key={`${source}-${animation.row}-${first}-${animationKey ?? ''}`} className="motion-sprite__image"
          href={source} x="0" y={-animation.row * animation.cellHeight}
          width={width * 4} height={animation.cellHeight * animation.rows}
          onError={() => setFailedSource(source)} />
        </g>
      </svg>}
  </span>;
}
