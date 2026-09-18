/**
 * DialogueScene — the in-battle / in-node dialogue renderer.
 *
 * Story Mode's drama lives in these exchanges. The component renders the
 * speaker portrait, their line, optional beat counter, and a Continue /
 * Skip-All footer. It listens to the StoryDialogueLine.soundHook for
 * optional audio cues, and emits `onAdvance` so the parent can persist
 * dialogue progress.
 */
import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Volume2 } from 'lucide-react';
import { getAssetUrl } from '../../data';
import type { StoryDialogueLine } from '@workspace/squabblemon-engine/story';
import { isStoryCharacter } from '../../lib/story/characterRoster';

export interface DialogueSceneProps {
  lines: readonly StoryDialogueLine[];
  startIndex?: number;
  onAdvance?: (line: StoryDialogueLine, index: number) => void;
  onComplete?: () => void;
  /** Optional speaker color override, e.g. primary (yellow) for the player. */
  speakerAccent?: 'primary' | 'accent' | 'muted';
  /** Compact mode for in-battle dialogue that needs less stage. */
  compact?: boolean;
}

export function DialogueScene({
  lines,
  startIndex = 0,
  onAdvance,
  onComplete,
  speakerAccent = 'primary',
  compact = false,
}: DialogueSceneProps) {
  const [index, setIndex] = useState(Math.min(startIndex, Math.max(lines.length - 1, 0)));
  const total = lines.length;
  const line = lines[index];
  useEffect(() => {
    setIndex(Math.min(startIndex, Math.max(lines.length - 1, 0)));
  }, [lines, startIndex]);

  const accentClass = useMemo(() => {
    if (speakerAccent === 'accent') return 'text-accent';
    if (speakerAccent === 'muted') return 'text-white/55';
    return 'text-primary';
  }, [speakerAccent]);

  if (!line) {
    return null;
  }

  const advance = () => {
    onAdvance?.(line, index);
    if (index >= total - 1) {
      onComplete?.();
      return;
    }
    setIndex((current) => current + 1);
  };

  const skipAll = () => {
    onAdvance?.(line, index);
    onComplete?.();
  };

  const showCharacterPortrait = isStoryCharacter(
    line.portraitAssetId
      ?.replace(/^assets\/characters\//, '')
      .replace(/\.webp$/, ''),
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      className={`flex w-full flex-col gap-3 ${compact ? 'text-sm' : ''}`}
      data-testid="dialogue-scene"
    >
      <AnimatePresence mode="wait">
        <motion.div
          key={`${line.speaker}-${index}`}
          initial={{ opacity: 0, x: 12 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -12 }}
          transition={{ duration: 0.25 }}
          className="flex items-end gap-3 md:gap-4"
        >
          {line.portraitAssetId && (
            <div className="relative flex-none">
              <img
                src={getAssetUrl(line.portraitAssetId)}
                alt={line.speaker}
                className={`${compact ? 'h-14 w-14' : 'h-20 w-20 md:h-24 md:w-24'} flex-none rounded-sm border-2 ${accentClass.replace('text-', 'border-')} bg-black object-contain`}
                loading="eager"
              />
              {showCharacterPortrait && (
                <span
                  className="absolute -right-1 -top-1 grid h-5 w-5 place-items-center rounded-full border border-black bg-primary text-[8px] font-black uppercase text-black"
                  title="Story character"
                >
                  S
                </span>
              )}
            </div>
          )}
          <div className="min-w-0 flex-1 border-2 border-white/15 bg-black/85 p-3 backdrop-blur-md md:p-4">
            <div className={`font-mono text-[10px] uppercase tracking-[0.25em] ${accentClass} md:text-xs`}>
              {line.speaker}
            </div>
            <p className="mt-2 text-sm leading-snug text-white/85 md:text-base">
              {line.text}
            </p>
            {line.soundHook && (
              <div className="mt-2 inline-flex items-center gap-1 font-mono text-[9px] uppercase tracking-widest text-white/40">
                <Volume2 className="h-3 w-3" /> {line.soundHook}
              </div>
            )}
          </div>
        </motion.div>
      </AnimatePresence>
      <div className="flex items-center justify-between gap-3 font-mono text-[10px] uppercase tracking-widest text-white/45">
        <span>
          Line {index + 1} / {total}
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={skipAll}
            className="border border-white/20 px-3 py-1.5 text-white/55 transition-colors hover:border-white/40 hover:text-white"
          >
            Skip
          </button>
          <button
            type="button"
            onClick={advance}
            className="border border-primary bg-primary/15 px-4 py-1.5 text-primary transition-colors hover:bg-primary/25"
          >
            {index >= total - 1 ? 'Done' : 'Continue'}
          </button>
        </div>
      </div>
    </motion.div>
  );
}
