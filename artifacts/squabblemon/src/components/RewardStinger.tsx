import { useEffect, useRef, useState } from 'react';
import { getAssetUrl } from '../lib/assets';
import type { RewardClip } from '../lib/broadcastCatalog';
import { canPlayOptionalBroadcast } from '../lib/optionalBroadcastMedia';
import type { BattleSpeed } from '../battleSpeed';
import './RewardStinger.css';

export type { RewardClip } from '../lib/broadcastCatalog';

/**
 * A silent, decorative broadcast, not footage of the player's exact crew.
 * Its owner controls saving, queue dismissal and navigation independently.
 */
export function RewardStinger({
  clip, onComplete, speed = 1, actionLabel = 'Show rewards', maxDurationMs,
}: {
  clip: RewardClip; onComplete: () => void; speed?: BattleSpeed;
  actionLabel?: string; maxDurationMs?: number;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const skip = useRef<HTMLButtonElement>(null);
  const complete = useRef(onComplete);
  complete.current = onComplete;
  const finish = useRef<() => void>(() => {});
  const [allowed] = useState(canPlayOptionalBroadcast);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    let active = true, settled = false;
    const media = video.current;
    let decodeTimer = 0, stallTimer = 0, deadline = 0;
    const release = () => {
      window.clearTimeout(decodeTimer);
      window.clearTimeout(stallTimer);
      window.clearTimeout(deadline);
      if (media) {
        media.pause();
        media.removeAttribute('src');
        media.load();
      }
    };
    const done = () => {
      if (!active || settled) return;
      settled = true;
      release();
      complete.current();
    };
    finish.current = done;
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const connection = (navigator as Navigator & { connection?: EventTarget }).connection;
    const policyChanged = () => { if (!canPlayOptionalBroadcast()) done(); };
    const observer = new MutationObserver(policyChanged);
    document.addEventListener('visibilitychange', policyChanged);
    motion.addEventListener('change', policyChanged);
    connection?.addEventListener('change', policyChanged);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-reduce-motion'] });
    if (!allowed || !canPlayOptionalBroadcast() || !media) {
      done();
    } else {
      skip.current?.focus();
      const started = () => {
        if (!active || settled) return;
        window.clearTimeout(decodeTimer);
        window.clearTimeout(stallTimer);
        setPlaying(true);
      };
      const stalled = () => {
        if (!active || settled) return;
        window.clearTimeout(stallTimer);
        stallTimer = window.setTimeout(done, 650);
      };
      media.addEventListener('playing', started);
      media.addEventListener('waiting', stalled);
      media.addEventListener('stalled', stalled);
      media.addEventListener('ended', done);
      media.addEventListener('error', done);
      media.playbackRate = speed;
      // Set src only after the policy check. No mount/preload can request a whole pool.
      media.src = getAssetUrl(clip.video);
      decodeTimer = window.setTimeout(done, 900);
      deadline = window.setTimeout(done, maxDurationMs ?? Math.min(4800, clip.duration * 1000 / speed + 1000));
      void media.play().catch(done);
      return () => {
        active = false;
        finish.current = () => {};
        observer.disconnect();
        document.removeEventListener('visibilitychange', policyChanged);
        motion.removeEventListener('change', policyChanged);
        connection?.removeEventListener('change', policyChanged);
        media.removeEventListener('playing', started);
        media.removeEventListener('waiting', stalled);
        media.removeEventListener('stalled', stalled);
        media.removeEventListener('ended', done);
        media.removeEventListener('error', done);
        release();
      };
    }
    return () => {
      active = false;
      finish.current = () => {};
      observer.disconnect();
      document.removeEventListener('visibilitychange', policyChanged);
      motion.removeEventListener('change', policyChanged);
      connection?.removeEventListener('change', policyChanged);
      release();
    };
    // Selection and the hold budget belong to this single-play instance.
    // A speed change below retimes playback without restarting the clip.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clip.id, allowed]);

  useEffect(() => { if (video.current) video.current.playbackRate = speed; }, [speed]);
  return <section className="reward-stinger" data-testid="reward-stinger" data-clip={clip.id}
    data-style={clip.style} aria-label="Decorative Squabblemon reward broadcast">
    <div className="reward-stinger__frame" aria-hidden="true">
      <img src={getAssetUrl(clip.poster)} alt="" />
      {allowed && <video ref={video} muted playsInline preload="none" data-playing={playing} />}
    </div>
    <header><span>Squabblemon · Reward broadcast</span><small>Decorative city footage</small></header>
    <button ref={skip} type="button" className="reward-stinger__skip" onClick={() => finish.current()}>
      {actionLabel} <span aria-hidden="true">→</span>
    </button>
  </section>;
}