import { useEffect, useRef, useState } from 'react';
import idle from './assets/hallway/poster-idle.webp';
import exit from './assets/hallway/poster-exit.webp';
import still from './assets/hallway/poster-still.webp';

/** Decode only while visible. The final curl cues the paper rush; routing waits for full coverage. */
export function BreakthroughPoster({ leaving, reducedMotion, paused, onComplete }: {
  leaving: boolean; reducedMotion: boolean; paused: boolean; onComplete(): void;
}) {
  const root = useRef<HTMLSpanElement>(null);
  const complete = useRef(onComplete);
  complete.current = onComplete;
  const [visible, setVisible] = useState(false);
  const [exitLoaded, setExitLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const node = root.current;
    if (!node) return;
    let intersecting = false;
    const update = () => setVisible(intersecting && !document.hidden);
    const observer = new IntersectionObserver(([entry]) => { intersecting = entry.isIntersecting; update(); });
    observer.observe(node);
    document.addEventListener('visibilitychange', update);
    return () => { observer.disconnect(); document.removeEventListener('visibilitychange', update); };
  }, []);
  useEffect(() => {
    if (!leaving) return;
    // Image load failure, slow network and reduced motion must never trap navigation.
    const timer = setTimeout(() => complete.current(), reducedMotion || failed || !visible ? 0 : exitLoaded ? 2200 : 6000);
    return () => clearTimeout(timer);
  }, [leaving, reducedMotion, failed, visible, exitLoaded]);
  const animated = visible && !reducedMotion && !failed;
  return <>
    <span ref={root} className="km-poster" data-exiting={leaving}>
      <img key={leaving ? 'exit' : animated && !paused ? 'idle' : 'still'}
        src={leaving && animated ? exit : animated && !paused ? idle : still}
        width={336} height={504} alt="Breakthrough. Live PvP. Three lanes, two breaches. Press start."
        draggable={false} onLoad={() => { if (leaving) setExitLoaded(true); }} onError={() => setFailed(true)} />
    </span>
  </>;
}
