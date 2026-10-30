import type { CSSProperties, ReactNode } from "react";

/** Shared raid composition. Numbers and sprites come from the authoritative raid
 * adapter; this component owns no battle rules, timers, or media playback. */
export type RaidCinematicPresentation = {
  title: string;
  subtitle: string;
  backdrop: string;
  portrait?: string;
  sprite: ReactNode | ((state: { paused: boolean; reducedMotion: boolean; hit: boolean }) => ReactNode);
  phaseLabel?: string;
  projectionLabel?: string;
  lethalLabel?: string;
  phase?: string;
  meta?: ReactNode;
};

export function RaidCinematicHero({
  title, subtitle, backdrop, portrait, sprite, phaseLabel, phase = "healthy", meta,
  projectionLabel = "NEXT STRIKE", lethalLabel = "FINISHER",
  hp, maxHp, projectedDamage = 0, hit = false, paused = false,
  reducedMotion = false, onInspect, inspectLabel, healthLabel = "Persistent boss HP",
}: RaidCinematicPresentation & {
  hp: number;
  maxHp: number;
  projectedDamage?: number;
  hit?: boolean;
  paused?: boolean;
  reducedMotion?: boolean;
  onInspect?: () => void;
  inspectLabel?: string;
  healthLabel?: string;
}) {
  const maximum = Math.max(1, maxHp);
  const shown = Math.max(0, Math.min(hp, maximum));
  const projection = Math.min(shown, Math.max(0, projectedDamage));
  const lethal = shown > 0 && projection >= shown;
  return (
    <section className="raid-cinema-hero raid-boss" data-testid="raid-cinema-hero"
      data-boss-phase={phase} data-hit={hit} data-defeated={hp <= 0}
      data-paused={paused || reducedMotion}
      style={{ "--raid-cinema-backdrop": `url("${backdrop}")` } as CSSProperties}>
      <div className="raid-cinema-backdrop" aria-hidden="true" />
      {portrait && <img className="raid-cinema-portrait" src={portrait} alt="" draggable={false} decoding="async" aria-hidden="true" />}
      <span className="raid-cinema-radial" aria-hidden="true" />
      <div className="raid-boss-scene" aria-hidden="true" data-hit={hit}
        data-defeated={hp <= 0} data-boss-phase={phase}>
        <div className="raid-boss-figure" data-testid="raid-boss-figure">
          {typeof sprite === "function" ? sprite({ paused, reducedMotion, hit }) : sprite}
          <span className="raid-boss-impact-anchor" />
        </div>
        <span className="raid-scene-ground" />
      </div>
      <div className="raid-boss-title">
        <span className="raid-cinema-operation">BOSS RAID</span>
        {onInspect ? <button type="button" className="raid-boss-inspect"
          aria-label={inspectLabel ?? `Inspect ${title}`} onClick={onInspect}>{subtitle} <span aria-hidden="true">↗</span></button>
          : <span className="raid-cinema-subtitle">{subtitle}</span>}
        <h1>{title}</h1>
      </div>
      <div className="raid-cinema-phase">
        <span aria-hidden="true">VS</span>
        {phaseLabel && <strong>{phaseLabel}</strong>}
        {meta && <div className="raid-cinema-meta">{meta}</div>}
      </div>
      <div className="raid-hp-wrap" data-animated={!paused && !reducedMotion}>
        <div className="raid-scoreline"><b>{shown.toLocaleString()} <small>/ {maxHp.toLocaleString()} HP</small></b>
          {projection > 0 && <span className="raid-projected-strike" data-lethal={lethal}>{lethal ? lethalLabel : projectionLabel} −{projectedDamage.toLocaleString()}</span>}
        </div>
        <div className="raid-hp" role="progressbar" aria-label={healthLabel}
          aria-valuemin={0} aria-valuemax={maxHp} aria-valuenow={shown}>
          <span className="raid-hp-trail" aria-hidden="true" style={{width: `${shown / maximum * 100}%`}} />
          <span className="raid-hp-live" aria-hidden="true" style={{width: `${shown / maximum * 100}%`}}><i className="raid-hp-glint" /><i className="raid-hp-edge" /></span>
          {projection > 0 && <span className="raid-hp-projected" aria-hidden="true" data-lethal={lethal}
            style={{"--projected-left": `${(shown - projection) / maximum * 100}%`, "--projected-width": `${projection / maximum * 100}%`} as CSSProperties} />}
        </div>
      </div>
    </section>
  );
}
