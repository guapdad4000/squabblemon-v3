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
      <div className="flex items-center justify-between font-mono uppercase tracking-wider">
        <span className={compact ? 'text-[7px] text-primary' : 'text-[9px] text-primary'}>LV {details.level}</span>
        {!compact && (
          <span className="text-[8px] text-white/45">
            {details.isMaxLevel ? 'MAX' : `${details.xpIntoLevel}/${details.xpForNextLevel} XP`}
          </span>
        )}
      </div>
      <div className={`${compact ? 'mt-0.5 h-0.5' : 'mt-1 h-1'} overflow-hidden bg-white/10`}>
        <div className="h-full bg-primary" style={{ width: `${details.progressPercent}%` }} />
      </div>
    </div>
  );
}