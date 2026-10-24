import { useEffect, useId, useRef, useState, type CSSProperties, type KeyboardEvent, type MouseEvent, type ReactNode } from 'react';
import { ChevronDown, ChevronUp, Swords } from 'lucide-react';
import { cancelFrame, frame } from 'framer-motion';
import './battle-formation.css';

interface BattleFormationProps {
  children: ReactNode;
  /** Includes the staged reveal card so every rendered tile gets a grid slot. */
  count: number;
  /** Settled cards only; the inspector does not contain the staged card back. */
  inspectCount?: number;
  crowded?: boolean;
  label: string;
  onInspect: (event: MouseEvent<HTMLButtonElement>) => void;
  style?: CSSProperties;
  className?: string;
  testId?: string;
}

interface ScrollState {
  scrollable: boolean;
  before: boolean;
  after: boolean;
  remaining: number;
}

const EMPTY_SCROLL: ScrollState = { scrollable: false, before: false, after: false, remaining: 0 };

/** Retains direct card children and the existing battlefield container geometry. */
export function BattleFormation({ children, count, inspectCount = count, crowded = count > 4, label, onInspect, style, className = '', testId }: BattleFormationProps) {
  const stackRef = useRef<HTMLDivElement>(null);
  const rowStarts = useRef<number[]>([]);
  const [scroll, setScroll] = useState<ScrollState>(EMPTY_SCROLL);
  const hintId = useId();
  const inspectable = inspectCount > 0 && (crowded || scroll.scrollable);

  useEffect(() => {
    const stack = stackRef.current;
    if (!stack) return;

    let disposed = false;
    let layoutDirty = true;
    let cardBottoms: number[] = [];
    const observedCards = new Set<HTMLElement>();
    let height = 0;
    let scrollable = false;
    let pending: ScrollState | null = null;
    const publish = () => {
      if (disposed || !pending) return;
      const next = pending;
      pending = null;
      setScroll(previous => previous.scrollable === next.scrollable && previous.before === next.before && previous.after === next.after && previous.remaining === next.remaining ? previous : next);
    };
    const measure = () => {
      if (disposed) return;
      if (layoutDirty) {
        layoutDirty = false;
        const cards = Array.from(stack.children).filter((child): child is HTMLElement => child instanceof HTMLElement && child.matches('.battle-board-card'));
        // Fonts or responsive card contents can resize a row without resizing its
        // scroll viewport. Track direct tiles as well as the stack itself.
        const currentCards = new Set(cards);
        for (const card of observedCards) {
          if (!currentCards.has(card)) { resize?.unobserve(card); observedCards.delete(card); }
        }
        for (const card of cards) {
          if (!observedCards.has(card)) { observedCards.add(card); resize?.observe(card); }
        }
        // Card offsets do not change while scrolling or while artwork transforms.
        // Read each once per layout, then reuse them for every smooth-scroll tick.
        const metrics = cards.map(card => ({ top: card.offsetTop, height: card.offsetHeight }));
        const starts = metrics.map(card => card.top).sort((a, b) => a - b);
        rowStarts.current = starts.filter((top, index) => index === 0 || Math.abs(top - starts[index - 1]) > 2);
        cardBottoms = metrics.map(card => card.top + card.height);
        height = stack.clientHeight;
        const contentHeight = stack.scrollHeight;
        scrollable = contentHeight > height + 2;
        // A previously overflowing small crew must recover after resize. Its own
        // footer cannot make a now-fitting crew stay scrollable.
        if (scrollable && stack.dataset.crowded !== 'true') {
          const side = stack.closest<HTMLElement>('.battle-side');
          const field = stack.closest<HTMLElement>('.battlefield-grid');
          const hub = side?.parentElement?.querySelector<HTMLElement>('.battle-district-hub');
          if (side && field && hub) {
            const sideStyle = getComputedStyle(side), fieldStyle = getComputedStyle(field);
            const px = (value: string) => Number.parseFloat(value) || 0;
            const naturalSide = Math.max(px(sideStyle.getPropertyValue('--formation-side-min')),
              (field.clientHeight - px(fieldStyle.paddingTop) - px(fieldStyle.paddingBottom) - hub.offsetHeight) / 2);
            const naturalHeight = naturalSide - px(sideStyle.paddingTop) - px(sideStyle.getPropertyValue('--formation-base-bottom'));
            if (contentHeight <= naturalHeight + 2) scrollable = false;
          }
        }
      }
      const top = stack.scrollTop;
      // Ignore trailing scroll padding: the cue describes actual hidden cards.
      const remaining = cardBottoms.filter(bottom => bottom > top + height + 2).length;
      const after = scrollable && remaining > 0;
      pending = { scrollable, before: scrollable && top > 2, after, remaining: after ? remaining : 0 };
      // All formations finish reading before a React update can change footers.
      frame.update(publish);
    };
    const scheduleScroll = () => { frame.read(measure); };
    const scheduleLayout = () => { layoutDirty = true; scheduleScroll(); };
    const resize = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(scheduleLayout);
    const childrenChanged = typeof MutationObserver === 'undefined' ? null : new MutationObserver(scheduleLayout);
    resize?.observe(stack);
    childrenChanged?.observe(stack, { childList: true, attributes: true, attributeFilter: ['data-count', 'data-crowded'] });
    stack.addEventListener('scroll', scheduleScroll, { passive: true });
    window.addEventListener('resize', scheduleLayout, { passive: true });
    scheduleLayout();
    return () => {
      disposed = true;
      resize?.disconnect();
      childrenChanged?.disconnect();
      stack.removeEventListener('scroll', scheduleScroll);
      window.removeEventListener('resize', scheduleLayout);
      cancelFrame(measure);
      cancelFrame(publish);
      pending = null;
    };
  }, []);

  const scrollTo = (top: number) => {
    const stack = stackRef.current;
    if (!stack) return;
    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches || stack.closest('[data-reduced-motion="true"]') !== null;
    stack.scrollTo({ top, behavior: reducedMotion ? 'auto' : 'smooth' });
  };
  const advanceRow = (direction: 1 | -1) => {
    const stack = stackRef.current;
    if (!stack) return;
    const destination = direction === 1
      ? rowStarts.current.find(top => top > stack.scrollTop + 2) ?? stack.scrollHeight - stack.clientHeight
      : [...rowStarts.current].reverse().find(top => top < stack.scrollTop - 2) ?? 0;
    scrollTo(destination);
  };
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    // Card keyboard interactions continue to use their canonical inspector.
    if (event.target !== event.currentTarget || !scroll.scrollable) return;
    if (event.key === 'ArrowDown' || event.key === 'PageDown') {
      event.preventDefault();
      advanceRow(1);
    } else if (event.key === 'ArrowUp' || event.key === 'PageUp') {
      event.preventDefault();
      advanceRow(-1);
    } else if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault();
      scrollTo(event.key === 'Home' ? 0 : event.currentTarget.scrollHeight - event.currentTarget.clientHeight);
    }
  };

  return <>
    <div ref={stackRef} className={`battle-card-stack battle-formation-stack ${className}`.trim()} data-count={count} data-crowded={crowded} data-scrollable={scroll.scrollable} data-inspectable={inspectable} data-more-before={scroll.before} data-more-after={scroll.after} data-testid={testId} style={{ ...style, "--formation-count": Math.max(1, count) } as CSSProperties} role="group" aria-label={`${label}, ${count} ${count === 1 ? 'card' : 'cards'}`} aria-describedby={scroll.scrollable ? hintId : undefined} tabIndex={scroll.scrollable ? 0 : undefined} onKeyDown={handleKeyDown}>
      {children}
    </div>
    {scroll.scrollable && <>
      <span id={hintId} className="sr-only">Scroll to see every card. Arrow keys move one complete row; Home returns to the first row. View {inspectCount} opens the full gang.</span>
      <button type="button" className="battle-formation-continuation" aria-label={scroll.after ? `Show the next row in ${label}${scroll.remaining ? `, ${scroll.remaining} more ${scroll.remaining === 1 ? 'card' : 'cards'} below` : ''}` : `Return to the first row in ${label}`} title={scroll.after ? 'More cards below' : 'Back to first row'} data-direction={scroll.after ? 'down' : 'up'} onClick={event => { event.stopPropagation(); scroll.after ? advanceRow(1) : scrollTo(0); }}>
        <span aria-hidden="true">{scroll.after && scroll.remaining > 0 ? `+${scroll.remaining}` : ''}</span>
        {scroll.after ? <ChevronDown size={11} aria-hidden="true" /> : <ChevronUp size={11} aria-hidden="true" />}
      </button>
    </>}
    {inspectable && <button type="button" className="formation-expand battle-formation-inspect" aria-label={`Inspect all ${inspectCount} ${inspectCount === 1 ? 'card' : 'cards'} in ${label}`} onClick={event => { event.stopPropagation(); event.currentTarget.focus({ preventScroll: true }); onInspect(event); }}>
      <Swords size={12} aria-hidden="true" /><span>View {inspectCount}</span>
    </button>}
  </>;
}
