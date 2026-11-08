import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { hallwayArt } from './hallwayArt';
import './flyerWipe.css';

export const KUMITE_ENTRY_READY = 'kumite:entry-ready';
const COVER_MS = 680;
const REVEAL_MS = 700;
const sheets = [
  {left:'-8%', angle:'-16deg', x:'-135vw', y:'75vh', out:'-120vw', delay:0, art:'paper', print:'NEXT\nFIGHT.'},
  {left:'104%', angle:'15deg', x:'135vw', y:'95vh', out:'130vw', delay:35, art:'flyer', print:''},
  {left:'22%', angle:'-10deg', x:'-85vw', y:'140vh', out:'-65vw', delay:80, art:'paper', print:'BRING\nYOUR\nCREW.'},
  {left:'80%', angle:'13deg', x:'95vw', y:'135vh', out:'85vw', delay:115, art:'paper', print:'THE\nKUMITE.'},
  {left:'49%', angle:'-7deg', x:'20vw', y:'135vh', out:'-20vw', delay:155, art:'flyer', print:''},
] as const;

type Props = { onCovered(): void; onFinished(): void };
/** Independent overlay root survives the route unmount; readiness controls the reveal. */
function FlyerWipe({ onCovered, onFinished }: Props) {
  const [phase, setPhase] = useState<'cover' | 'hold' | 'reveal'>('cover');
  const callbacks = useRef({onCovered, onFinished});
  callbacks.current = {onCovered, onFinished};
  useEffect(() => {
    let handedOff = false, revealing = false, closed = false;
    const timers = new Set<ReturnType<typeof setTimeout>>();
    const later = (fn: () => void, ms: number) => { const timer = setTimeout(() => { timers.delete(timer); fn(); }, ms); timers.add(timer); };
    const finish = () => { if (!closed) { closed = true; callbacks.current.onFinished(); } };
    const reveal = () => {
      if (!handedOff || revealing || closed) return;
      revealing = true;
      // Let the destination commit under a fully opaque paper stack before it moves away.
      later(() => { if (!closed) { setPhase('reveal'); later(finish, REVEAL_MS); } }, 80);
    };
    const handoff = () => {
      if (handedOff || closed) return;
      handedOff = true;
      // Commit the opaque cover before navigation; CSS and timer clocks can differ by a frame.
      flushSync(() => setPhase('hold'));
      callbacks.current.onCovered();
      later(reveal, 1800); // A missing route-ready event must never trap the player.
    };
    const skip = () => { handoff(); finish(); };
    const key = (event: KeyboardEvent) => { if (event.key === 'Escape') { event.preventDefault(); skip(); } };
    const visibility = () => { if (document.hidden) skip(); };
    const motion = matchMedia('(prefers-reduced-motion: reduce)');
    const preference = () => { if (motion.matches) skip(); };
    document.addEventListener(KUMITE_ENTRY_READY, reveal);
    document.addEventListener('visibilitychange', visibility);
    document.addEventListener('keydown', key);
    motion.addEventListener('change', preference);
    if (motion.matches || document.hidden) later(skip, 0); else later(handoff, COVER_MS);
    return () => {
      closed = true; for (const timer of timers) clearTimeout(timer);
      document.removeEventListener(KUMITE_ENTRY_READY, reveal);
      document.removeEventListener('visibilitychange', visibility);
      document.removeEventListener('keydown', key);
      motion.removeEventListener('change', preference);
    };
  }, []);
  return <div className="km-flyer-wipe" data-phase={phase}>
    <span className="sr-only" role="status">Opening Breakthrough</span>
    <div className="km-flyer-wipe__stack" aria-hidden="true">
      {sheets.map((sheet, index) => <div key={index} className="km-flyer-wipe__sheet" data-hero={index === 4} style={{
        '--paper-left':sheet.left, '--paper-angle':sheet.angle, '--paper-x':sheet.x, '--paper-y':sheet.y,
        '--paper-out':sheet.out, '--paper-delay':`${sheet.delay}ms`, '--paper-exit-delay':`${(4-index)*28}ms`,
      } as CSSProperties}>
        <img src={sheet.art === 'flyer' ? hallwayArt.flyer : hallwayArt.paper} alt="" draggable={false} />
        {sheet.print && <div className="km-flyer-wipe__print"><small>UNDERGROUND / LIVE PVP</small><b>{sheet.print}</b><span>THREE LANES / TWO BREACHES</span></div>}
      </div>)}
    </div>
  </div>;
}

/** UI-only ceremony. Cancellation before handoff must not navigate later. */
export function startFlyerWipe(onCovered: () => void, reducedMotion: boolean) {
  let handedOff = false, disposed = false;
  if (reducedMotion || matchMedia('(prefers-reduced-motion: reduce)').matches || document.hidden) {
    onCovered(); return { cancelIfPending() {} };
  }
  const host = document.createElement('div');
  host.className = 'km-flyer-transition-host';
  document.body.append(host);
  const root = createRoot(host);
  const app = document.getElementById('root');
  const previousInert = app?.inert ?? false;
  if (app) app.inert = true;
  const dispose = () => {
    if (disposed) return; disposed = true;
    root.unmount(); host.remove();
    if (app) app.inert = previousInert;
    if (handedOff) {
      const heading = document.querySelector<HTMLElement>('.bt-flyer-lobby h1');
      if (heading) { heading.tabIndex = -1; heading.focus({preventScroll:true}); }
    }
  };
  root.render(<FlyerWipe onCovered={() => { if (!handedOff) { handedOff = true; onCovered(); } }} onFinished={dispose} />);
  return { cancelIfPending() { if (!handedOff) dispose(); } };
}
