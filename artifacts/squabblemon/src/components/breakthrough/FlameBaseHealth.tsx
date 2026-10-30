import { useEffect, useRef, useState } from 'react';
import './assets/flame-health/flame-health.css';

/** Animated two-breach presentation. The score changes before this animation. */
export default function FlameBaseHealth({
  lost,
  reducedMotion,
}: {
  lost: number;
  reducedMotion: boolean;
}) {
  const value = Math.max(0, Math.min(2, lost));
  const previous = useRef(value);
  const [hit, setHit] = useState(0);
  useEffect(() => {
    if (reducedMotion) setHit(0);
    else if (value > previous.current) setHit(value);
    else if (value < previous.current) setHit(0);
    previous.current = value;
  }, [value, reducedMotion]);
  const phase =
    !reducedMotion && hit === value && hit > 0
      ? value === 1
        ? 'hit-one'
        : 'hit-two'
      : value === 0
        ? 'full'
        : value === 1
          ? 'half'
          : 'empty';
  return (
    <span
      className="bt-base-health"
      role="img"
      aria-label={`${2 - value} of 2 base hits remaining`}
    >
      <i
        key={`${phase}-${value}`}
        className={`bt-flame-art bt-flame-${phase}`}
        aria-hidden="true"
        onAnimationEnd={(event) => {
          if (
            event.target === event.currentTarget &&
            event.animationName === `bt-flame-${phase}`
          )
            setHit(0);
        }}
      />
    </span>
  );
}
