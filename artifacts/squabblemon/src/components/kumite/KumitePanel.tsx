import { useId, type ReactNode } from 'react';

export function KumitePanel({ title, aside, children, className = '' }: { title: string; aside?: ReactNode; children: ReactNode; className?: string }) {
  const id = useId();
  return <section className={`kumite-panel ${className}`} aria-labelledby={id}>
    <header className="kumite-panel__head"><h2 id={id}>{title}</h2>{aside && <span>{aside}</span>}</header>
    <div className="kumite-panel__body">{children}</div>
  </section>;
}
