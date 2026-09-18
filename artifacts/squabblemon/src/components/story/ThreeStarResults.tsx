/**
 * ThreeStarResults — the 3-star battle result card.
 *
 * Shows how many stars the player earned (0–3), which objectives they hit,
 * and the ticket they just earned (if any). Designed to slot in next to
 * the existing result screen without conflicting with it.
 */
import { motion } from 'framer-motion';
import { Star, Ticket, CheckCircle2, XCircle } from 'lucide-react';
import {
  TICKETS_PER_PERFECT_BATTLE,
  ticketsForStars,
  type StoryStarObjective,
} from '@workspace/squabblemon-engine/story';
import { getCardImage } from '../../data';

export interface ThreeStarResultsProps {
  stars: number;
  objectives: readonly StoryStarObjective[];
  /** Per-objective pass/fail map; absent entries default to "missed". */
  hitObjectives?: Readonly<Record<string, boolean>>;
  /** Optional reward summary line under the stars. */
  rewardLine?: string;
  /** Optional title (e.g. "Chapter One — Welcome to the Block"). */
  title?: string;
}

const STAR_PATH =
  'polygon(50% 0%,61% 35%,98% 35%,68% 57%,79% 91%,50% 70%,21% 91%,32% 57%,2% 35%,39% 35%)';

export function ThreeStarResults({
  stars,
  objectives,
  hitObjectives = {},
  rewardLine,
  title,
}: ThreeStarResultsProps) {
  const ticketsEarned = ticketsForStars(stars);
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className="flex w-full flex-col gap-4 border border-white/10 bg-black/85 p-4 backdrop-blur-md md:p-5"
      data-testid="three-star-results"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <div className="font-mono text-[9px] uppercase tracking-[0.3em] text-white/45">
            Battle Outcome
          </div>
          {title && (
            <h3 className="mt-1 font-display text-2xl font-black italic uppercase leading-none md:text-3xl">
              {title}
            </h3>
          )}
        </div>
        <div className="flex items-center gap-1.5" aria-label={`${stars} of 3 stars`}>
          {[0, 1, 2].map((i) => {
            const filled = i < stars;
            return (
              <motion.span
                key={i}
                initial={{ scale: 0.6, rotate: -10, opacity: 0 }}
                animate={{ scale: 1, rotate: 0, opacity: 1 }}
                transition={{ delay: 0.2 + i * 0.1, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                className={`grid h-7 w-7 place-items-center ${filled ? 'text-primary' : 'text-white/15'}`}
                style={{ clipPath: `path("${STAR_PATH}")`, background: 'currentColor' }}
                aria-hidden
              />
            );
          })}
          <span className="ml-2 font-display text-2xl font-black italic text-white/85">
            {stars}/3
          </span>
        </div>
      </div>

      {objectives.length > 0 && (
        <ul className="grid gap-1.5 text-sm">
          {objectives.map((objective) => {
            const hit = hitObjectives[objective.id] ?? false;
            return (
              <li
                key={objective.id}
                className={`flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest ${
                  hit ? 'text-primary' : 'text-white/30 line-through'
                }`}
              >
                {hit ? <CheckCircle2 className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
                {objective.description}
              </li>
            );
          })}
        </ul>
      )}

      <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
        <div className="flex items-center gap-2 border border-white/10 bg-black/40 px-3 py-2">
          <Star className="h-4 w-4 text-primary" />
          <span className="font-mono text-[10px] uppercase tracking-widest text-white/55">
            Stars
          </span>
          <span className="ml-auto font-display text-xl font-black italic text-white">
            {stars}
          </span>
        </div>
        <div
          className={`flex items-center gap-2 border px-3 py-2 transition-colors ${
            ticketsEarned > 0 ? 'border-primary bg-primary/15 text-primary' : 'border-white/10 bg-black/40 text-white/45'
          }`}
        >
          <Ticket className="h-4 w-4" />
          <span className="font-mono text-[10px] uppercase tracking-widest">Ticket</span>
          <span className="ml-auto font-display text-xl font-black italic">
            +{ticketsEarned > 0 ? ticketsEarned : 0}
          </span>
        </div>
      </div>

      {ticketsEarned > 0 && (
        <div
          className="border border-primary/40 bg-primary/10 p-3 text-center font-display text-sm font-black italic uppercase text-primary"
          role="status"
        >
          Clean sweep! +{ticketsEarned} Street Pack Ticket
          {ticketsEarned === 1 ? '' : 's'} for the 3-star run.
        </div>
      )}

      {rewardLine && (
        <div className="border-t border-white/10 pt-3 font-mono text-[10px] uppercase tracking-widest text-white/55">
          {rewardLine}
        </div>
      )}

      <div className="hidden">{/* Keep imports warm for hot reload safety. */}{getCardImage('unused')}</div>
      <div className="text-[10px] text-white/30">
        {TICKETS_PER_PERFECT_BATTLE} ticket per 3-star clean sweep — first clear only.
      </div>
    </motion.div>
  );
}
