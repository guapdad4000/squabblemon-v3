import { useEffect, useRef, useState } from 'react';

/** Purely visual lag; combat always reads the current authoritative Hands. */
export default function HandsMeter({
  value,
  maximum,
}: {
  value: number;
  maximum: number;
}) {
  const prior = useRef(value);
  const [trail, setTrail] = useState(value);
  const [pulse, setPulse] = useState({ key: 0, kind: '' });
  useEffect(() => {
    const previous = prior.current;
    prior.current = value;
    if (value === previous) return;
    const damage = value < previous;
    setPulse((p) => ({ key: p.key + 1, kind: damage ? 'damage' : 'heal' }));
    if (!damage) {
      setTrail(value);
      return;
    }
    setTrail(Math.max(previous, value));
    const timer = setTimeout(() => setTrail(value), 160);
    return () => clearTimeout(timer);
  }, [value]);
  const percent = (n: number) =>
    Math.max(0, Math.min(100, (n / Math.max(1, maximum)) * 100));
  const level = percent(value),
    tone = level > 50 ? 'healthy' : level > 25 ? 'hurt' : 'critical';
  return (
    <div className={`bt-hands-meter bt-meter-${tone}`} aria-hidden="true">
      <i className="bt-meter-chunk" style={{ width: `${percent(trail)}%` }} />
      <i className="bt-meter-fill" style={{ width: `${level}%` }} />
      <span key={pulse.key} className={`bt-meter-pulse bt-meter-${pulse.kind}`}>
        {pulse.kind === 'heal' && (
          <>
            <i />
            <i />
            <i />
          </>
        )}
      </span>
    </div>
  );
}
