import { motion, useReducedMotion } from 'framer-motion';
import '../../styles/fade-series.css';

export type FadeSeries = { you: number; rival: number; draws: number };

/** One tally digit on the board. It flips only when its own count changes. */
function SeriesCount({ value, reduced, tone }: { value: number; reduced: boolean; tone: 'you' | 'rival' | 'draw' }) {
  return <span className="fade-series__count" data-tone={tone}>
    <motion.b key={value}
      initial={reduced ? false : { rotateX: -85, y: -8, opacity: 0 }}
      animate={{ rotateX: 0, y: 0, opacity: 1 }}
      transition={{ type: 'spring', damping: 14, stiffness: 320 }}>{value}</motion.b>
  </span>;
}

/**
 * Head-to-head record for the games played inside one friendly room.
 * Server-owned: this only presents what the room state reports.
 */
export function FadeSeriesBoard({ series, rivalName, gameNumber, reducedMotion = false, variant = 'lobby' }: {
  series: FadeSeries;
  rivalName?: string;
  gameNumber?: number;
  reducedMotion?: boolean;
  variant?: 'lobby' | 'result';
}) {
  const systemReduced = useReducedMotion();
  const reduced = reducedMotion || Boolean(systemReduced) ||
    (typeof document !== 'undefined' && document.documentElement.dataset.reduceMotion === 'true');
  const rival = rivalName?.trim() ? rivalName.trim().toUpperCase() : 'RIVAL';
  const label = `Room series: you ${series.you}, ${rival.toLowerCase()} ${series.rival}` +
    (series.draws ? `, ${series.draws} drawn` : '');
  return <div className={'fade-series fade-series--' + variant} data-testid="fade-series" role="group" aria-label={label}>
    <span className="fade-series__tag">ROOM SERIES{gameNumber ? ` · GAME ${gameNumber}` : ''}</span>
    <div className="fade-series__line">
      <span className="fade-series__side"><small>YOU</small><SeriesCount value={series.you} reduced={reduced} tone="you" /></span>
      <em aria-hidden="true">–</em>
      <span className="fade-series__side fade-series__side--rival"><SeriesCount value={series.rival} reduced={reduced} tone="rival" /><small>{rival}</small></span>
    </div>
    {series.draws > 0 && <span className="fade-series__draws">
      <SeriesCount value={series.draws} reduced={reduced} tone="draw" /> DRAWN</span>}
  </div>;
}
