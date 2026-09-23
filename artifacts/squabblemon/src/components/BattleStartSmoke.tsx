import { getAssetUrl } from '../lib/assets';
import { KeyedVideo } from './KeyedVideo';

/** The same one-shot dust clearing for solo and online battle starts. */
export function BattleStartSmoke({ onComplete }: { onComplete: () => void }) {
  return (
    <KeyedVideo
      className="battle-start-smoke"
      src={getAssetUrl('assets/effects/battle-start-smoke.webm')}
      mode="light"
      maxWidth={480}
      onEnded={onComplete}
    />
  );
}