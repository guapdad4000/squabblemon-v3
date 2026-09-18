import type { CSSProperties, ReactNode } from 'react';
import '../../styles/studio.css';

export function ProgressRing({
  value,
  max,
  label,
  children,
}: {
  value: number;
  max: number;
  label: string;
  children?: ReactNode;
}) {
  const progress = max > 0 ? Math.max(0, Math.min(1, value / max)) : 0;
  return (
    <span
      className="studio-progress"
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={Math.max(1, max)}
      aria-valuenow={Math.min(Math.max(0, value), Math.max(1, max))}
      style={{ '--progress': progress } as CSSProperties}
    >
      {children ?? `${value}/${max}`}
    </span>
  );
}
