import { lazy, Suspense, useCallback, useEffect, useRef, type ComponentProps, type ComponentType } from 'react';
import type { RewardStinger } from './RewardStinger';
import { getAssetUrl } from '../lib/assets';
import { canPlayOptionalBroadcast } from '../lib/optionalBroadcastMedia';
import './RewardStinger.css';

type Props = ComponentProps<typeof RewardStinger>;

function FinishWithoutMedia({ onComplete }: Props) {
  useEffect(() => { onComplete(); }, [onComplete]);
  return null;
}

// Download presentation code only for a confirmed eligible event, never at boot.
const Player = lazy<ComponentType<Props>>(() => import('./RewardStinger')
  .then(module => ({ default: module.RewardStinger }))
  .catch(() => ({ default: FinishWithoutMedia })));

function PosterFallback({ clip, onComplete, actionLabel = 'Show rewards', maxDurationMs }: Props) {
  const callback = useRef(onComplete), settled = useRef(false);
  callback.current = onComplete;
  const done = useCallback(() => {
    if (settled.current) return;
    settled.current = true;
    callback.current();
  }, []);
  useEffect(() => {
    settled.current = false;
    const timer = window.setTimeout(done, Math.min(800, maxDurationMs ?? 800));
    const visibility = () => { if (document.hidden) done(); };
    document.addEventListener('visibilitychange', visibility);
    return () => {
      settled.current = true;
      window.clearTimeout(timer);
      document.removeEventListener('visibilitychange', visibility);
    };
  }, [done, maxDurationMs]);
  return <section className="reward-stinger" data-testid="reward-stinger" data-clip={clip.id}
    aria-label="Decorative Squabblemon reward broadcast">
    <div className="reward-stinger__frame" aria-hidden="true"><img src={getAssetUrl(clip.poster)} alt="" /></div>
    <header><span>Squabblemon · Reward broadcast</span><small>Decorative city footage</small></header>
    <button autoFocus className="reward-stinger__skip" onClick={done}>{actionLabel} →</button>
  </section>;
}

export function DeferredRewardStinger(props: Props) {
  if (!canPlayOptionalBroadcast()) return <FinishWithoutMedia {...props} />;
  return <Suspense fallback={<PosterFallback {...props} />}><Player {...props} /></Suspense>;
}