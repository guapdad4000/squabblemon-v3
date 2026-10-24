export type PackGymFilmState = 'poster' | 'playing' | 'failed';
/** A video follows the visible-time clock. It never advances or blocks a saved reward. */
export function startPackGymFilm({ video, active, paused, speed, elapsed, start, duration, onState }: {
  video: HTMLVideoElement; active: boolean; paused: boolean; speed: number; elapsed: () => number;
  start: number; duration: number; onState: (state: PackGymFilmState) => void;
}) {
  let disposed = false, started = false, failed = false, presented = false, attempt = 0, frame: number | undefined;
  const current = () => Math.max(0, (elapsed() - start) / 1000);
  const eligible = () => !disposed && !failed && active && !paused && current() < duration;
  const showFrame = () => {
    if (!eligible() || video.readyState < 2) return;
    const generation = attempt;
    if (typeof video.requestVideoFrameCallback === 'function') {
      if (frame !== undefined) video.cancelVideoFrameCallback(frame);
      frame = video.requestVideoFrameCallback(() => {
        frame = undefined;
        if (eligible() && generation === attempt) { presented = true; onState('playing'); }
      });
    } else { presented = true; onState('playing'); }
  };
  const fail = () => { if (!disposed) { failed = true; video.pause(); onState('failed'); } };
  const play = () => {
    if (!eligible() || started || video.readyState < 2) return;
    started = true;
    const generation = ++attempt;
    // Late data joins the shot where the timeline is now, never replays an expired intro.
    try {
      const target = Math.min(current(), duration - 1 / 30);
      // Small decode jitter should not create an endless seek/canplay cycle.
      if (Math.abs(video.currentTime - target) > .08) video.currentTime = target;
      video.playbackRate = speed;
      const pending = video.play();
      void pending?.then(() => { if (disposed || generation !== attempt) return; showFrame(); }).catch(() => { if (!disposed && generation === attempt) fail(); });
    } catch { fail(); }
  };
  video.muted = true;
  video.pause();
  onState('poster');
  if (!active) { try { video.currentTime = 0; } catch { /* Metadata may not be available yet. */ } }
  video.addEventListener('loadeddata', play);
  video.addEventListener('canplay', play);
  video.addEventListener('playing', showFrame);
  video.addEventListener('waiting', waiting);
  video.addEventListener('error', fail);
  function waiting() {
    if (!eligible()) return;
    // The presentation clock continues during buffering. Rejoin it when data returns.
    started = false; attempt++;
    if (frame !== undefined) { video.cancelVideoFrameCallback(frame); frame = undefined; }
    // A buffering frame is still the last good part of this shot. Replacing it
    // with its poster flashes a different moment, especially near the smoke end.
    if (!presented) onState('poster');
  }
  if (video.error) fail(); else play();
  return () => {
    disposed = true;
    if (frame !== undefined) video.cancelVideoFrameCallback(frame);
    video.removeEventListener('loadeddata', play);
    video.removeEventListener('canplay', play);
    video.removeEventListener('playing', showFrame);
    video.removeEventListener('waiting', waiting);
    video.removeEventListener('error', fail);
    video.pause();
  };
}
