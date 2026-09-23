import { getAssetUrl } from '../lib/assets';

/** The same one-shot dust clearing for solo and online battle starts. */
export function BattleStartSmoke({ onComplete }: { onComplete: () => void }) {
  return (
    <video
      className="battle-start-smoke"
      src={getAssetUrl('assets/effects/battle-start-smoke.webm')}
      autoPlay
      muted
      playsInline
      preload="auto"
      aria-hidden="true"
      onEnded={onComplete}
      onError={onComplete}
    />
  );
}