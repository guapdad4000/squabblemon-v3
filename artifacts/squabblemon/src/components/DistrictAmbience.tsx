import { memo, type CSSProperties } from 'react';
import './district-ambience.css';

type DistrictAmbienceProps = {
  id: string;
  index?: number;
  enabled?: boolean;
  reducedMotion?: boolean;
  /** Pause decorative loops while a cinematic or inspection needs the focus. */
  active?: boolean;
};

const sparkTrails = [
  { '--spark-x': '-9px', '--spark-y': '-12px', '--spark-turn': '-35deg' },
  { '--spark-x': '3px', '--spark-y': '-17px', '--spark-turn': '12deg' },
  { '--spark-x': '11px', '--spark-y': '-9px', '--spark-turn': '45deg' },
  { '--spark-x': '-13px', '--spark-y': '2px', '--spark-turn': '-75deg' },
  { '--spark-x': '14px', '--spark-y': '3px', '--spark-turn': '70deg' },
] as (CSSProperties & Record<'--spark-x' | '--spark-y' | '--spark-turn', string>)[];

/** Local atmosphere only. No timers, layout changes, images, or input surfaces. */
export const DistrictAmbience = memo(function DistrictAmbience({
  id, index = 0, enabled = true, reducedMotion = false, active = true,
}: DistrictAmbienceProps) {
  if (!enabled || !['bodega', 'pirate-radio', 'construction-site'].includes(id)) return null;

  return <span className={`district-ambience district-ambience--${id}`}
    data-testid="district-ambience" data-district-ambience={id}
    data-motion={reducedMotion ? 'reduced' : 'full'} data-active={active ? 'true' : 'false'}
    style={{ '--ambience-delay': `${index * -2.7}s` } as CSSProperties} aria-hidden="true">
    {id === 'bodega' && <span className="district-ambience__neon"><i /><i /><i /></span>}
    {id === 'pirate-radio' && <span className="district-ambience__signal"><i /><i /><i /></span>}
    {id === 'construction-site' && <span className="district-ambience__welder">
      <b />{sparkTrails.map((style, spark) => <i key={spark} style={style} />)}
    </span>}
  </span>;
});
