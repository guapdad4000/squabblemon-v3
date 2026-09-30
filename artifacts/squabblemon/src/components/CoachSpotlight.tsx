import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { DrFadePortrait } from './DrFade';
import { useTutorialVoice } from '../lib/useTutorialVoice';

type Rect = { top: number; left: number; width: number; height: number };
/** The highlighted control remains the real app control; everything else waits. */
export function CoachSpotlight({ target, title, children, step, onNext, nextLabel = 'Got it', onTarget, narrate = true, voiceIds, nonBlocking = false, onDismiss }: {
  target: string; title: string; children: React.ReactNode; step: string;
  onNext?: () => void; nextLabel?: string; onTarget?: () => void; narrate?: boolean; voiceIds?: readonly string[]; nonBlocking?: boolean; onDismiss?: () => void;
}) {
  useTutorialVoice(typeof children === 'string' ? children : null, narrate, voiceIds);
  const [rect, setRect] = useState<Rect | null>(null);
  const [revealed, setRevealed] = useState(false);
  useEffect(() => { setRevealed(false); }, [target, step]);
  const panel = useRef<HTMLElement>(null);
  const callback = useRef(onTarget);
  callback.current = onTarget;
  const interactiveTarget = !onNext;
  useEffect(() => {
    let element: HTMLElement | null = null;
    let frame = 0;
    const measure = () => {
      element = document.querySelector<HTMLElement>(target);
      if (!element) { setRect(null); return; }
      const r = element.getBoundingClientRect();
      const next = { top: Math.max(4, r.top - 6), left: Math.max(4, r.left - 6), width: Math.min(r.width + 12, innerWidth - 8), height: Math.min(r.height + 12, innerHeight - 8) };
      setRect(previous => previous && Object.keys(next).every(key => previous[key as keyof Rect] === next[key as keyof Rect]) ? previous : next);
    };
    frame = requestAnimationFrame(() => {
      element = document.querySelector<HTMLElement>(target);
      element?.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'instant' });
      measure();
      if (!nonBlocking) (panel.current?.querySelector('button') ?? element)?.focus({ preventScroll: true });
    });
    const observer = new ResizeObserver(measure);
    observer.observe(document.body);
    // Style/class/hidden mutations move targets without touching childList —
    // the safehouse markers slide into place via inline style after the scene
    // projects them, and an unmeasured move leaves the mask covering the target.
    // Skip our own overlay's mutations and coalesce to one measure a frame.
    let mutationFrame = 0;
    const mutations = new MutationObserver(records => {
      if (!records.some(record => !(record.target instanceof HTMLElement && record.target.closest('.fade-spotlight')))) return;
      if (mutationFrame) return;
      mutationFrame = requestAnimationFrame(() => { mutationFrame = 0; measure(); });
    });
    mutations.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['style', 'class', 'hidden'] });
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    const allowed = (node: EventTarget | null) => node instanceof Node && ((interactiveTarget && element?.contains(node)) || panel.current?.contains(node));
    const guard = (event: Event) => {
      if (!allowed(event.target)) { event.preventDefault(); event.stopImmediatePropagation(); }
    };
    const clicked = (event: MouseEvent) => {
      guard(event);
      if (event.target instanceof Node && element?.contains(event.target)) {
        // Run after the actual control's own handler.
        queueMicrotask(() => callback.current?.());
      }
    };
    const keys = (event: KeyboardEvent) => {
      if (event.key === 'Tab') {
        const targetElement = interactiveTarget ? element : null;
        const candidates = [...(targetElement?.matches('button,input,a,[tabindex="0"]') ? [targetElement] : []), ...Array.from(targetElement?.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),a,[tabindex="0"]') ?? []), ...Array.from(panel.current?.querySelectorAll<HTMLElement>('button') ?? [])].filter(e => e.getClientRects().length);
        if (candidates.length) {
          event.preventDefault();
          const index = candidates.indexOf(document.activeElement as HTMLElement);
          candidates[(index + (event.shiftKey ? candidates.length - 1 : 1)) % candidates.length].focus();
        }
      } else if (['Enter', ' ', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) guard(event);
    };
    if (!nonBlocking) {
      document.addEventListener('click', clicked, true);
      document.addEventListener('pointerdown', guard, true);
      document.addEventListener('keydown', keys, true);
    }
    return () => {
      cancelAnimationFrame(frame); cancelAnimationFrame(mutationFrame); observer.disconnect(); mutations.disconnect();
      window.removeEventListener('resize', measure); window.removeEventListener('scroll', measure, true);
      document.removeEventListener('click', clicked, true); document.removeEventListener('pointerdown', guard, true); document.removeEventListener('keydown', keys, true);
    };
  }, [target, step, interactiveTarget, nonBlocking]);
  const battleDiagram = step.startsWith('ROUND') ? target.includes('squabble') ? 'double' : target.includes('lane-') ? 'districts' : target.includes('next-round') ? 'bank' : target.includes('card-') ? 'card' : 'play' : null;
  const atBottom = rect ? rect.top < window.innerHeight * .48 : true;
  const beside = rect && innerWidth > 1000 ? rect.left + rect.width + 565 < innerWidth ? 'right' : rect.left > 565 ? 'left' : null : null;
  const sideStyle = rect && beside ? { left: beside === 'right' ? rect.left + rect.width + 24 : rect.left - 554, top: Math.max(16, Math.min(innerHeight - (panel.current?.offsetHeight ?? 260) - 16, rect.top)), bottom: 'auto', transform: 'none' } : undefined;
  return createPortal(<div className="fade-spotlight" data-testid="fade-spotlight" data-coach-target={target} data-revealed={revealed} data-nonblocking={nonBlocking}>
    {rect ? <>
      <div className="fade-mask" style={{ inset: '0 0 auto', height: rect.top }} />
      <div className="fade-mask" style={{ top: rect.top, left: 0, width: rect.left, height: rect.height }} />
      <div className="fade-mask" style={{ top: rect.top, left: rect.left + rect.width, right: 0, height: rect.height }} />
      <div className="fade-mask" style={{ top: rect.top + rect.height, insetInline: 0, bottom: 0 }} />
      <div className="fade-target" style={rect} />
    </> : <div className="fade-mask" style={{ inset: 0 }} />}
    <section ref={panel} className={'fade-tip ' + (atBottom ? 'fade-tip--bottom' : 'fade-tip--top')} style={sideStyle} role="region" aria-label="Dr. Fade’s guide">
      <DrFadePortrait pose={beside === 'right' ? 'left' : beside === 'left' ? 'right' : atBottom ? 'up' : 'down'} />
      <div><span className="fade-eyebrow">DR. FADE / {step}</span>
        {battleDiagram && <div className="fade-lesson-diagram" aria-label={battleDiagram === 'districts' ? 'Lead in two of three districts' : battleDiagram === 'double' ? 'Double base Hands once per match' : battleDiagram === 'bank' ? 'Carry up to one unused Motion' : 'Spend Motion to add Hands'}>
          {battleDiagram === 'districts' ? <><b>WIN</b><b>WIN</b><i>3</i><span>2 of 3 districts</span></> : battleDiagram === 'double' ? <><b>HANDS</b><i>×</i><b>2</b><span>Once per match</span></> : battleDiagram === 'bank' ? <><b>0–1</b><i>→</i><b>NEXT</b><span>Unused Motion carries</span></> : <><b>MOTION</b><i>→</i><b>HANDS</b><span>Cost → district strength</span></>}
        </div>}
        <div aria-live="polite" aria-atomic="true"><h2>{title}</h2><p>{children}</p></div>
        <button type="button" className="fade-reveal" aria-pressed={revealed} onClick={() => setRevealed(value => !value)}>{revealed ? "Focus this step" : "Show the whole scene"}</button>
        {onDismiss && <button type="button" className="fade-reveal" onClick={onDismiss}>Hide tip (reopen anytime)</button>}
        {onNext && <button className="venue-button venue-button--gold" onClick={onNext}>{nextLabel}</button>}
        {!rect && <p role="status">Finding your next step…</p>}
      </div>
    </section>
  </div>, document.body);
}
