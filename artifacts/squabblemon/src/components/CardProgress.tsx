import React from 'react';
import { cardProgressDetails, type CardProgress as Progress } from '@workspace/squabblemon-engine/cardProgression';

export function CardProgress({
  progress,
  compact = false,
  className = '',
}: {
  progress?: Progress;
  compact?: boolean;
  className?: string;
}) {
  const details = cardProgressDetails(progress);
  return (
    <div className={className} data-testid="card-progress">
      <div className="flex items-center justify-between font-mono uppercase tracking-wider mb-0.5">
        <span className={compact ? 'text-[5px] md:text-[7px] text-primary font-bold' : 'text-[8px] md:text-[10px] text-primary font-bold'}>LV {details.level}</span>
        {!compact && (
          <span className="text-[6px] md:text-[8px] text-white/50">
            {details.isMaxLevel ? 'MAX' : `${details.xpIntoLevel}/${details.xpForNextLevel} XP`}
          </span>
        )}
      </div>
      <div className={`${compact ? 'h-0.5' : 'h-1 md:h-1.5'} w-full bg-black/60 border border-white/10 overflow-hidden rounded-sm`}>
        <div className="h-full bg-primary relative" style={{ width: `${details.progressPercent}%` }}>
          <div className="absolute inset-0 bg-[linear-gradient(90deg,transparent_0%,rgba(255,255,255,0.4)_50%,transparent_100%)] w-full opacity-50" />
        </div>
      </div>
    </div>
  );
}