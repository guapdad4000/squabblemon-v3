import { useEffect, useRef, type CSSProperties } from 'react';
import { getAssetUrl } from '../lib/assets';

export const BATTLE_DUST_DURATION_MS = 6_200;
const LOAD_TIMEOUT_MS = 2_000;
const source = getAssetUrl('assets/effects/battle-start-smoke.webp');

/** True-alpha image playback avoids mobile WebM decoders that discard alpha. */
export function BattleStartSmoke({ onComplete }: { onComplete: () => void }) {
  const imageRef = useRef<HTMLImageElement>(null);
  const onCompleteRef = useRef(onComplete);

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    const image = imageRef.current;
    if (!image) return;
    const controller = new AbortController();
    let objectUrl: string | undefined;
    let stopped = false;
    let started = false;
    let playbackTimer: number | undefined;
    let loadingTimer: number | undefined;

    const dispose = () => {
      if (stopped) return false;
      stopped = true;
      window.clearTimeout(loadingTimer);
      window.clearTimeout(playbackTimer);
      controller.abort();
      image.hidden = true;
      image.removeAttribute('src');
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      return true;
    };
    const finish = () => {
      if (dispose()) onCompleteRef.current();
    };
    const start = () => {
      if (stopped || started) return;
      started = true;
      window.clearTimeout(loadingTimer);
      image.dataset.ready = 'true';
      // Image animation has no ended event. Never leave its last frame mounted.
      playbackTimer = window.setTimeout(finish, BATTLE_DUST_DURATION_MS);
    };
    const onVisibilityChange = () => {
      if (document.hidden) finish();
    };

    image.hidden = false;
    image.dataset.ready = 'false';
    image.addEventListener('load', start);
    image.addEventListener('error', finish);
    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('pagehide', finish);
    loadingTimer = window.setTimeout(finish, LOAD_TIMEOUT_MS);

    // A fresh object URL restarts a cached one-shot image on every new match,
    // without downloading another copy or depending on video autoplay.
    void fetch(source, { signal: controller.signal })
      .then(response => {
        if (!response.ok) throw new Error(`Dust artwork failed to load: ${response.status}`);
        return response.blob();
      })
      .then(blob => {
        if (stopped) return;
        objectUrl = URL.createObjectURL(blob);
        image.src = objectUrl;
      })
      .catch(() => finish());

    return () => {
      dispose();
      image.removeEventListener('load', start);
      image.removeEventListener('error', finish);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('pagehide', finish);
    };
  }, []);

  return (
    <img
      ref={imageRef}
      className="battle-start-smoke"
      data-source={source}
      data-ready="false"
      style={{ '--battle-dust-duration': `${BATTLE_DUST_DURATION_MS}ms` } as CSSProperties}
      alt=""
      aria-hidden="true"
      draggable={false}
    />
  );
}