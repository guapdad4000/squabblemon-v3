import { useEffect, useRef, useState } from 'react';
import { getMoveClipUrl, keyChromaPixels, type MoveClip } from '../specialMoves';
import './special-moves.css';

/** Video is decorative: decoding or autoplay failure must never hold up a battle. */
export function SpecialMove({ clip, onStatus, audioEnabled = false }: { clip: MoveClip; onStatus?: (status: string) => void; audioEnabled?: boolean }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const media = useRef<HTMLVideoElement | null>(null);
  const audioRequested = useRef(audioEnabled);
  const resumePlayback = useRef<(() => void) | null>(null);
  const [muted, setMuted] = useState(true);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    audioRequested.current = audioEnabled;
    if (media.current) {
      media.current.muted = !audioEnabled;
      if (audioEnabled) resumePlayback.current?.();
    }
  }, [audioEnabled]);
  useEffect(() => {
    setReady(false);
    const surface = canvas.current;
    const context = surface?.getContext('2d', { willReadFrequently: true });
    if (!surface || !context) return;
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let video: HTMLVideoElement | undefined;
    let frame = 0, lastFrame = 0, stopped = false, revealed = false;
    const stop = () => {
      stopped = true;
      cancelAnimationFrame(frame);
      video?.pause();
      setReady(false);
    };
    const fail = () => { if (stopped) return; stop(); onStatus?.('Clip unavailable — using the card effect.'); };
    const play = async () => {
      if (!video || stopped || document.hidden || video.ended) return;
      try { await video.play(); }
      catch {
        if (stopped) return;
        // Browser sound restrictions must never prevent the animation itself.
        if (!video.muted) {
          video.muted = true;
          try { await video.play(); } catch { fail(); }
        } else fail();
      }
    };
    const visibility = () => { if (document.hidden) video?.pause(); else void play(); };
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
        video.playbackRate = clip.playbackRate;
        void play();
      };
      video.onerror = fail;
      video.onended = stop;
      video.src = getMoveClipUrl(clip);
      const draw = (now: number) => {
        if (stopped || !video) return;
        if (now - lastFrame >= 1000 / 24 && video.readyState >= 2 && !video.seeking) {
          lastFrame = now;
          try {
            context.drawImage(video, 0, 0, surface.width, surface.height);
            const pixels = context.getImageData(0, 0, surface.width, surface.height);
            keyChromaPixels(pixels.data, clip.chroma);
            context.putImageData(pixels, 0, 0);
            if (!revealed) { revealed = true; setReady(true); onStatus?.('Playing'); }
          } catch { fail(); return; }
        }
        frame = requestAnimationFrame(draw);
      };
      frame = requestAnimationFrame(draw);
    }
    return () => {
      stopped = true;
      clearTimeout(timer);
      cancelAnimationFrame(frame);
      motion.removeEventListener('change', reduce);
      document.removeEventListener('visibilitychange', visibility);
      observer.disconnect();
      media.current = null;
      resumePlayback.current = null;
      if (video) {
        video.onloadedmetadata = null; video.onerror = null; video.onended = null; video.onvolumechange = null;
        video.pause(); video.removeAttribute('src'); video.load();
      }
    };
  }, [clip, onStatus]);
  return <canvas ref={canvas} className="special-move-canvas" data-testid="special-move-canvas" data-ready={ready} data-muted={muted} aria-hidden="true" />;
}
