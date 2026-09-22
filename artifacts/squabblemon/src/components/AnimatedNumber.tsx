import { useEffect, useRef } from 'react';
import { animate, useReducedMotion } from 'framer-motion';

/** Keep the announced value exact while the decorative number counts into place. */
export function AnimatedNumber({ value = 0, from = 0, delay = 0, prefix = '', className = '', reducedMotion = false }: {
  value: number; from?: number; delay?: number; prefix?: string; className?: string; reducedMotion?: boolean;
}) {
  const node = useRef<HTMLSpanElement>(null);
  const previous = useRef(from);
  const systemReduced = useReducedMotion();
  useEffect(() => {
    const reduced = reducedMotion || systemReduced || document.documentElement.dataset.reduceMotion === 'true';
    const start = previous.current;
    previous.current = value;
    if (reduced) { if (node.current) node.current.textContent = value.toLocaleString(); return; }
    const controls = animate(start, value, { duration: .75, delay, ease: 'easeOut',
      onUpdate: number => { if (node.current) node.current.textContent = Math.round(number).toLocaleString(); } });
    return () => controls.stop();
  }, [value, delay, systemReduced, reducedMotion]);
  return <span className={className} aria-label={prefix + value.toLocaleString()}><span aria-hidden="true">{prefix}<span ref={node}>{value.toLocaleString()}</span></span></span>;
}
