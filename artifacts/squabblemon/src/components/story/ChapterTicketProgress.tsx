/**
 * ChapterTicketProgress — the chapter-card widget that shows the
 * 3-battle → 3-stars → 1-ticket loop in action.
 *
 * Renders a compact progress meter (perfectClears / battleCount, with
 * ticketsEarned / ticketsAvailable), a row of battle chips that highlight
 * which ones have been 3-starred, and a forecast for fresh chapters.
 */
import { motion } from 'framer-motion';
import { Star, Ticket, MapPin } from 'lucide-react';
import { summarizeChapterTickets, type ChapterTicketProgress as Progress } from '../../lib/story/ticketLedger';
import type { StoryChapter } from '@workspace/squabblemon-engine/story';

export interface ChapterTicketProgressProps {
  chapter: StoryChapter;
  nodeProgressById: Readonly<Record<string, { stars: number; cleared: boolean }>>;
  /** Optional callback when the player taps a battle chip (to focus the map). */
  onSelectBattle?: (nodeId: string) => void;
}

export function ChapterTicketProgress({
  chapter,
  nodeProgressById,
  onSelectBattle,
}: ChapterTicketProgressProps) {
  const progress: Progress = summarizeChapterTickets(chapter, nodeProgressById);
  return (
    <div
      className="flex w-full flex-col gap-3 border border-white/10 bg-black/80 p-3 backdrop-blur-md md:p-4"
      data-testid="chapter-ticket-progress"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="font-mono text-[9px] uppercase tracking-[0.3em] text-white/45">
          {progress.isCompact ? 'Compact Ticket Run' : 'Long-Form Arc'}
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 font-mono text-[10px] uppercase tracking-widest text-white/55">
            <Star className="h-3 w-3 text-primary" />
            {progress.perfectClears} / {progress.battleCount}
          </div>
          <div className="flex items-center gap-1 font-mono text-[10px] uppercase tracking-widest text-primary">
            <Ticket className="h-3 w-3" />
            {progress.ticketsEarned} / {progress.ticketsAvailable}
          </div>
        </div>
      </div>
      <div className="h-1.5 w-full overflow-hidden border border-white/10 bg-black/50">
        <motion.div
          className="h-full bg-primary"
          initial={{ width: 0 }}
          animate={{ width: `${Math.min(progress.progressFraction * 100, 100)}%` }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        />
      </div>
      <div className="grid grid-cols-3 gap-2">
        {progress.battles.map((battle) => {
          const perfect = battle.ticketAwarded;
          const partial = battle.cleared && !perfect;
          return (
            <button
              key={battle.nodeId}
              type="button"
              onClick={() => onSelectBattle?.(battle.nodeId)}
              className={`flex flex-col items-start gap-1 border p-2 text-left transition-colors ${
                perfect
                  ? 'border-primary bg-primary/10 text-primary'
                  : partial
                    ? 'border-white/30 bg-white/5 text-white/75'
                    : 'border-white/10 bg-black/40 text-white/35 hover:border-white/25 hover:text-white/55'
              }`}
            >
              <div className="flex w-full items-center justify-between">
                <span className="truncate font-display text-xs font-black italic uppercase">
                  {battle.title}
                </span>
                <span className="flex items-center gap-0.5 text-[9px]">
                  {[0, 1, 2].map((i) => (
                    <Star
                      key={i}
                      className={`h-2.5 w-2.5 ${i < battle.stars ? 'fill-current' : 'opacity-25'}`}
                    />
                  ))}
                </span>
              </div>
              <div className="flex items-center gap-1 font-mono text-[8px] uppercase tracking-widest">
                <MapPin className="h-2.5 w-2.5" /> {Math.round(battle.mapPosition.x)}, {Math.round(battle.mapPosition.y)}
              </div>
              {perfect && (
                <div className="font-mono text-[8px] uppercase tracking-widest text-primary">
                  +1 Ticket Earned
                </div>
              )}
            </button>
          );
        })}
      </div>
      {progress.ticketsRemaining > 0 && (
        <div className="border-t border-white/10 pt-2 font-mono text-[9px] uppercase tracking-widest text-white/45">
          {progress.ticketsRemaining} more ticket{progress.ticketsRemaining === 1 ? '' : 's'} available — 3-star every battle.
        </div>
      )}
    </div>
  );
}
