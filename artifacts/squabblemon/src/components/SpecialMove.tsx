import { useEffect, useRef, useState } from 'react';
import { getMoveClipUrl, keyChromaPixels, type MoveClip } from '../specialMoves';
import './special-moves.css';
import { createChromaRenderer } from '../lib/chromaRenderer';

/** Video is decorative: decoding or autoplay failure must never hold up a battle. */
export function SpecialMove({ clip, onStatus, audioEnabled = false, speed = 1 }: { clip: MoveClip; onStatus?: (status: string) => void; audioEnabled?: boolean; speed?: number }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const media = useRef<HTMLVideoElement | null>(null);
  const audioRequested = useRef(audioEnabled);
  const resumePlayback = useRef<(() => void) | null>(null);
  const [useGpu, setUseGpu] = useState(true);
  useEffect(() => {
    audioRequested.current = audioEnabled;
    if (media.current) {
      media.current.muted = !audioEnabled;
      if (audioEnabled) resumePlayback.current?.();
    }
  }, [audioEnabled]);
  useEffect(() => {
    const surface = canvas.current;
    if (!surface) return;
    // Playback status is written to the canvas directly: state here re-rendered the
    // whole battle twice per clip.
    const setReady = (ready: boolean) => { surface.dataset.ready = String(ready); };
    const setMuted = (muted: boolean) => { surface.dataset.muted = String(muted); };
    setReady(false);
    let renderer: ReturnType<typeof createChromaRenderer>;
    try { renderer = createChromaRenderer(surface, `move-${clip.chroma}`, pixels => keyChromaPixels(pixels, clip.chroma), useGpu); }
    catch { setUseGpu(false); return; }
    if (!renderer) return;
    surface.dataset.renderer = renderer.kind;
    const contextLost = (event: Event) => { event.preventDefault(); setUseGpu(false); };
    surface.addEventListener('webglcontextlost', contextLost);
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let video: HTMLVideoElement | undefined;
    let frame = 0, videoFrame = 0, lastFrame = 0, lastMediaTime = -1, stopped = false, revealed = false;
    const cancelDraw = () => {
      cancelAnimationFrame(frame);
      if (videoFrame) video?.cancelVideoFrameCallback(videoFrame);
      frame = videoFrame = 0;
    };
    const scheduleDraw = () => {
      if (stopped || !video || video.paused || document.hidden || frame || videoFrame) return;
      if (typeof video.requestVideoFrameCallback === 'function') {
        videoFrame = video.requestVideoFrameCallback(now => { videoFrame = 0; draw(now); });
      } else {
        frame = requestAnimationFrame(now => { frame = 0; draw(now); });
      }
    };
    const draw = (now: number) => {
      if (stopped || !video || document.hidden || video.paused) return;
      const interval = 1000 / 24;
      if ((!revealed || now - lastFrame >= interval - 1) && video.readyState >= 2 && !video.seeking && video.currentTime !== lastMediaTime) {
        // Keep fractional time so a 30fps source does not collapse to 15fps.
        lastFrame = !revealed ? now : now - Math.max(0, (now - lastFrame) % interval);
        lastMediaTime = video.currentTime;
        try {
          renderer.draw(video);
          if (!revealed) { revealed = true; setReady(true); onStatus?.('Playing'); }
        } catch { fail(); return; }
      }
      scheduleDraw();
    };
    const stop = () => {
      stopped = true;
      cancelDraw();
      video?.pause();
      setReady(false);
    };
    const fail = () => { if (stopped) return; stop(); onStatus?.('Clip unavailable — using the card effect.'); };
    const play = async () => {
      if (!video || stopped || document.hidden || video.ended) return;
      try { await video.play(); scheduleDraw(); }
      catch {
        if (stopped) return;
        // Browser sound restrictions must never prevent the animation itself.
        if (!video.muted) {
          video.muted = true;
          try { await video.play(); scheduleDraw(); } catch { fail(); }
        } else fail();
      }
    };
    const visibility = () => { if (document.hidden) { cancelDraw(); video?.pause(); } else void play(); };
    document.addEventListener('visibilitychange', visibility);
    const reduce = () => {
      if (motion.matches || document.documentElement.dataset.reduceMotion === 'true') {
        stop(); onStatus?.('Reduced motion — using the card effect.');
      }
    };
    motion.addEventListener('change', reduce);
    const observer = new MutationObserver(reduce);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-reduce-motion'] });
    reduce();
    const timer = window.setTimeout(() => {
      if (!revealed && !stopped) fail();
    }, 1600);
    if (!stopped) {
      video = document.createElement('video');
      media.current = video;
      resumePlayback.current = () => { void play(); };
      video.muted = !audioRequested.current;
      video.volume = .7;
      setMuted(video.muted);
      video.onvolumechange = () => { if (!stopped && video) setMuted(video.muted); };
      video.playsInline = true;
      video.preload = 'auto';
      video.onloadedmetadata = () => {
        if (!video || stopped) return;
        surface.width = Math.min(288, video.videoWidth || 288);
        surface.height = Math.round(surface.width * (video.videoHeight / video.videoWidth || 16 / 9));
        video.currentTime = Math.max(0, Math.min(clip.startSeconds, Math.max(0, video.duration - .1)));
        video.playbackRate = clip.playbackRate * (speed > 0 ? speed : 1);
        void play();
      };
      video.onerror = fail;
      video.onended = stop;
      video.src = getMoveClipUrl(clip);
      video.onplaying = scheduleDraw;
      video.onpause = cancelDraw;
      scheduleDraw();
    }
    return () => {
      stopped = true;
      clearTimeout(timer);
      cancelDraw();
      motion.removeEventListener('change', reduce);
      document.removeEventListener('visibilitychange', visibility);
      observer.disconnect();
      media.current = null;
      resumePlayback.current = null;
      surface.removeEventListener('webglcontextlost', contextLost);
      renderer.dispose();
      if (video) {
        video.onplaying = null; video.onpause = null; video.onloadedmetadata = null; video.onerror = null; video.onended = null; video.onvolumechange = null;
        video.pause(); video.removeAttribute('src'); video.load();
      }
    };
  }, [clip, onStatus, useGpu]);
  // A speed change mid-clip retimes the running video rather than restarting it.
  useEffect(() => {
    if (media.current) media.current.playbackRate = clip.playbackRate * (speed > 0 ? speed : 1);
  }, [clip.playbackRate, speed]);
  return <canvas key={useGpu ? 'gpu' : 'cpu'} ref={canvas} className="special-move-canvas" data-testid="special-move-canvas" data-ready="false" data-muted="true" aria-hidden="true" />;
}
